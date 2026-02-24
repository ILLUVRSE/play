import crypto, { randomUUID } from 'crypto';
import { getPrisma } from '../lib/prisma';
import { buildPrompt, generateMemeImage, moderatePrompt, validateMemeInput } from '../lib/mememachine';

const POLL_MS = Number(process.env.MEME_POLL_INTERVAL_MS || 4000);
const MAX_ATTEMPTS = Number(process.env.MEME_MAX_ATTEMPTS || 5);
const MAX_DB_SIZE = Number(process.env.MEME_MAX_DB_SIZE || 2_000_000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hmac(key: Buffer | string, data: string) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

async function uploadToS3(key: string, body: Buffer): Promise<void> {
  const bucket = process.env.MEME_S3_BUCKET;
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!bucket) throw new Error('MEME_S3_BUCKET not configured');
  if (!accessKey || !secretKey) throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for S3 uploads');

  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const signingKey = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(`https://${host}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/png',
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorization
    },
    body
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed (${response.status})`);
  }
}

async function persistMeme(inputHash: string, aspect: '1:1' | '4:5' | '16:9', b64_png: string, width: number, height: number) {
  const prisma = getPrisma();
  const bucket = process.env.MEME_S3_BUCKET;

  if (bucket) {
    const key = `memes/${inputHash}-${Date.now()}-${randomUUID().slice(0, 8)}.png`;
    await uploadToS3(key, Buffer.from(b64_png, 'base64'));
    return prisma.memeCache.upsert({
      where: { inputHash },
      create: { inputHash, b64_png: null, s3Key: key, width, height, aspect },
      update: { b64_png: null, s3Key: key, width, height, aspect }
    });
  }

  if (b64_png.length > MAX_DB_SIZE) {
    throw new Error('Generated image too large for DB storage. Configure MEME_S3_BUCKET or increase MEME_MAX_DB_SIZE.');
  }

  return prisma.memeCache.upsert({
    where: { inputHash },
    create: { inputHash, b64_png, width, height, aspect },
    update: { b64_png, width, height, aspect }
  });
}

export async function processJobById(id: number) {
  const prisma = getPrisma();
  const job = await prisma.memeJob.findUnique({ where: { id } });
  if (!job) return;

  if (job.requiresClientKey) {
    await prisma.memeJob.update({ where: { id }, data: { status: 'failed', error: 'Job requires a client key and cannot be processed by server worker.' } });
    return;
  }

  const serverKey = process.env.OPENAI_API_KEY;
  if (!serverKey) {
    await prisma.memeJob.update({ where: { id }, data: { status: 'failed', error: 'OPENAI_API_KEY is required for worker processing.' } });
    return;
  }

  try {
    const input = validateMemeInput((job.payload || {}) as Record<string, unknown>);
    const prompt = buildPrompt(input);
    const image = await generateMemeImage({ apiKey: serverKey, prompt, aspect: input.aspect });
    await moderatePrompt(serverKey, prompt);
    const result = await persistMeme(job.inputHash, input.aspect, image.b64_png, image.width, image.height);
    await prisma.memeJob.update({ where: { id }, data: { status: 'succeeded', resultId: result.id, error: null } });
  } catch (error) {
    const message = (error as Error).message || 'Job failed';
    const updated = await prisma.memeJob.update({ where: { id }, data: { status: 'pending', error: message } });
    if (updated.attempts >= MAX_ATTEMPTS) {
      await prisma.memeJob.update({ where: { id }, data: { status: 'failed', error: message } });
      return;
    }
    const delay = Math.min(30_000, 2 ** updated.attempts * 1000);
    await sleep(delay);
  }
}

export async function claimPendingJobs(limit = 5) {
  const prisma = getPrisma();
  const claimed: number[] = [];

  for (let i = 0; i < limit; i += 1) {
    const claim = await prisma.$transaction(async (tx) => {
      const next = await tx.memeJob.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
      if (!next) return null;
      const updated = await tx.memeJob.updateMany({
        where: { id: next.id, status: 'pending' },
        data: { status: 'running', attempts: { increment: 1 } }
      });
      if (updated.count === 0) return null;
      return next.id;
    });
    if (!claim) break;
    claimed.push(claim);
  }
  return claimed;
}

export async function runDbPollingMode() {
  // eslint-disable-next-line no-console
  console.log('Meme worker running in DB polling mode');
  for (;;) {
    const jobs = await claimPendingJobs(5);
    for (const id of jobs) {
      await processJobById(id);
    }
    await sleep(POLL_MS);
  }
}

export async function runRedisMode() {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    return runDbPollingMode();
  }

  const mod = 'bullmq';
  const imported = (await import(mod)) as {
    Queue: new (name: string, opts: { connection: Record<string, string | undefined> }) => { add: (name: string, data: { id: number }) => Promise<void> };
    Worker: new (
      name: string,
      fn: (job: { data: { id: number } }) => Promise<void>,
      opts: { connection: Record<string, string | undefined> }
    ) => unknown;
  };

  const connection = { url: process.env.REDIS_URL, host: process.env.REDIS_HOST };
  // eslint-disable-next-line no-new
  new imported.Worker('meme-jobs', async (job) => processJobById(job.data.id), { connection });
  const queue = new imported.Queue('meme-jobs', { connection });

  // eslint-disable-next-line no-console
  console.log('Meme worker running in Redis mode');
  for (;;) {
    const claimed = await claimPendingJobs(5);
    for (const id of claimed) {
      await queue.add(`meme-${id}`, { id });
    }
    await sleep(POLL_MS);
  }
}

if (require.main === module) {
  runRedisMode().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Meme worker failed', error);
    process.exit(1);
  });
}

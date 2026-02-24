import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma } from '../../../lib/prisma';
import { buildPrompt, generateMemeImage, validateMemeInput } from '../../../lib/mememachine';
import type { MemeErrorResponse, MemeResult } from '../../../types/games';

const rateMap = new Map<string, { count: number; last: number }>();
const WINDOW = 5000;
const BURST = 3;

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

async function enqueueFallback(inputHash: string, payload: unknown) {
  const prisma = getPrisma();
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await prisma.memeJob.create({ data: { jobId, inputHash, status: 'pending', payload: payload as any, requiresClientKey: false } });
  return jobId;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<MemeResult | MemeErrorResponse | { status: 'pending'; jobId: string }>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const entry = rateMap.get(ip) ?? { count: 0, last: now };
  const elapsed = now - entry.last;
  const count = elapsed > WINDOW ? 1 : entry.count + 1;
  if (elapsed <= WINDOW && count > BURST) return res.status(429).json({ error: 'Too many requests, slow down' });
  rateMap.set(ip, { count, last: now });

  try {
    const validated = validateMemeInput(req.body || {});
    const prisma = getPrisma();
    const cached = await prisma.memeCache.findUnique({ where: { inputHash: validated.hash } });
    if (cached) {
      return res.status(200).json({
        b64_png: cached.b64_png,
        s3Key: cached.s3Key,
        width: cached.width,
        height: cached.height,
        aspect: validated.aspect,
        cached: true
      });
    }

    const serverKey = process.env.OPENAI_API_KEY;
    const headerKey = typeof req.headers['x-openai-key'] === 'string' ? req.headers['x-openai-key'].trim() : '';

    if (!serverKey && !headerKey) {
      return res.status(400).json({
        error: 'No OpenAI key configured. In this environment you must supply x-openai-key or run mememachine locally with OPENAI_API_KEY.'
      });
    }

    const prompt = buildPrompt(validated);
    const effectiveKey = serverKey || headerKey;
    const timeoutMs = 8000;
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SYNC_TIMEOUT')), timeoutMs));
    const generation = generateMemeImage({ apiKey: effectiveKey, prompt, aspect: validated.aspect });

    const image = await Promise.race([generation, timeout]);
    await prisma.memeCache.upsert({
      where: { inputHash: validated.hash },
      create: {
        inputHash: validated.hash,
        b64_png: image.b64_png,
        width: image.width,
        height: image.height,
        aspect: validated.aspect
      },
      update: {
        b64_png: image.b64_png,
        width: image.width,
        height: image.height,
        aspect: validated.aspect
      }
    });

    return res.status(200).json({ ...image, aspect: validated.aspect, cached: false });
  } catch (error) {
    const err = error as Error;
    if (err.message === 'SYNC_TIMEOUT') {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(422).json({
          error:
            'Async queue unavailable without server OPENAI_API_KEY. Please call generate_cached synchronously from the browser with x-openai-key.'
        });
      }
      const validated = validateMemeInput(req.body || {});
      const jobId = await enqueueFallback(validated.hash, req.body || {});
      return res.status(202).json({ status: 'pending', jobId });
    }
    return res.status(400).json({ error: err.message || 'Unable to generate meme' });
  }
}

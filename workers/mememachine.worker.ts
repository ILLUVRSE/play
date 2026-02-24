import OpenAI from 'openai';
import { getPrisma } from '@/lib/prisma';

async function runOnce() {
  const prisma = getPrisma();
  const job = await prisma.memeJob.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
  if (!job) return;
  await prisma.memeJob.update({ where: { id: job.id }, data: { status: 'running', attempts: { increment: 1 } } });
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required for async jobs');
    const payload = job.payload as any;
    const size = payload.aspect === '4:5' ? '1024x1792' : payload.aspect === '16:9' ? '1792x1024' : '1024x1024';
    const width = payload.aspect === '16:9' ? 1792 : 1024;
    const height = payload.aspect === '4:5' ? 1792 : 1024;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const image = await client.images.generate({ model: 'gpt-image-1', prompt: String(payload.idea || 'funny meme'), size });
    const b64_png = image.data?.[0]?.b64_json;
    if (!b64_png) throw new Error('No image returned');
    const result = await prisma.memeCache.upsert({
      where: { inputHash: job.inputHash },
      create: { inputHash: job.inputHash, b64_png, width, height, aspect: payload.aspect || '1:1' },
      update: { b64_png, width, height }
    });
    await prisma.memeJob.update({ where: { id: job.id }, data: { status: 'succeeded', resultId: result.id } });
  } catch (e: any) {
    await prisma.memeJob.update({ where: { id: job.id }, data: { status: 'failed', error: e.message || 'Job failed' } });
  }
}

runOnce().finally(() => process.exit(0));

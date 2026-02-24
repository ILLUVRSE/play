import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma } from '../../../lib/prisma';
import { validateMemeInput } from '../../../lib/mememachine';
import type { MemeErrorResponse, MemeStatusResponse } from '../../../types/games';

type AsyncResponse =
  | { status: 'pending'; jobId: string }
  | { status: 'succeeded'; result: { id: number; b64_png: string | null; s3Key?: string | null; width: number; height: number; aspect: string } }
  | MemeErrorResponse;

export default async function handler(req: NextApiRequest, res: NextApiResponse<AsyncResponse>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serverKey = process.env.OPENAI_API_KEY;
  const headerKey = typeof req.headers['x-openai-key'] === 'string' ? req.headers['x-openai-key'].trim() : '';
  if (!serverKey && !headerKey) {
    return res.status(400).json({
      error: 'No OpenAI key configured. In this environment you must supply x-openai-key or run mememachine locally with OPENAI_API_KEY.'
    });
  }

  if (!serverKey) {
    return res.status(422).json({
      error:
        'Cannot enqueue async meme generation without server OPENAI_API_KEY. Use generate_cached synchronously from browser with x-openai-key.'
    });
  }

  const prisma = getPrisma();
  try {
    const validated = validateMemeInput(req.body || {});
    const cached = await prisma.memeCache.findUnique({ where: { inputHash: validated.hash } });
    if (cached) {
      return res.status(200).json({
        status: 'succeeded',
        result: { id: cached.id, b64_png: cached.b64_png, s3Key: cached.s3Key, width: cached.width, height: cached.height, aspect: cached.aspect }
      });
    }

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await prisma.memeJob.create({
      data: {
        jobId,
        inputHash: validated.hash,
        status: 'pending',
        payload: req.body || {},
        requiresClientKey: false
      }
    });
    return res.status(202).json({ status: 'pending', jobId });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message || 'Invalid request' });
  }
}

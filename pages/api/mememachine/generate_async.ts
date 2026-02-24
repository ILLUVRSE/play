import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma } from '@/lib/prisma';
import { memeInputHash } from '@/lib/gameManager';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const prisma = getPrisma();
  const hash = memeInputHash(req.body || {});
  const cached = await prisma.memeCache.findUnique({ where: { inputHash: hash } });
  if (cached) return res.status(200).json({ status: 'succeeded', result: cached });
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await prisma.memeJob.create({ data: { jobId, inputHash: hash, status: 'pending', payload: req.body || {} } });
  return res.status(202).json({ status: 'pending', jobId });
}

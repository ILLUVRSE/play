import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const prisma = getPrisma();
  const hash = String(req.query.hash || '');
  const id = Number(req.query.id || 0);
  const cached = hash
    ? await prisma.memeCache.findUnique({ where: { inputHash: hash } })
    : id
      ? await prisma.memeCache.findUnique({ where: { id } })
      : null;
  if (!cached) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json(cached);
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma } from '../../../lib/prisma';
import type { MemeErrorResponse, MemeResult } from '../../../types/games';

export default async function handler(req: NextApiRequest, res: NextApiResponse<MemeResult | MemeErrorResponse>) {
  const prisma = getPrisma();
  const hash = String(req.query.hash || '');
  const id = Number(req.query.id || 0);
  const cached = hash
    ? await prisma.memeCache.findUnique({ where: { inputHash: hash } })
    : id
      ? await prisma.memeCache.findUnique({ where: { id } })
      : null;
  if (!cached) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json({
    b64_png: cached.b64_png,
    s3Key: cached.s3Key,
    width: cached.width,
    height: cached.height,
    aspect: cached.aspect as '1:1' | '4:5' | '16:9'
  });
}

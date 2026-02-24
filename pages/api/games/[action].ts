import type { NextApiRequest, NextApiResponse } from 'next';
import { getPrisma } from '@/lib/prisma';
import { createSession } from '@/lib/gameManager';

export default async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const action = String(req.query.action || '');
  const prisma = getPrisma();
  if (req.method === 'POST' && action === 'create') {
    const { partyCode, gameSlug, hostId, options } = req.body || {};
    try {
      const session = await createSession({ partyCode, gameSlug, hostId, options });
      return res.status(200).json(session);
    } catch (e: any) {
      return res.status(400).json({ error: e.message || 'Unable to create game session' });
    }
  }
  if (req.method === 'GET' && action === 'list') {
    const sessions = await prisma.gameSession.findMany({
      where: { partyCode: String(req.query.partyCode || '') },
      include: { game: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ sessions });
  }
  return res.status(404).json({ error: 'Unknown action' });
}

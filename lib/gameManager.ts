import crypto from 'crypto';
import { getPrisma } from '@/lib/prisma';
import { foreheadPoker } from '@/server/games/foreheadPoker';
import { captionBattle } from '@/server/games/captionBattle';
import { pictionary } from '@/server/games/pictionary';

export const adapters = {
  [foreheadPoker.slug]: foreheadPoker,
  [captionBattle.slug]: captionBattle,
  [pictionary.slug]: pictionary
};

export function getAdapter(slug: string) {
  return adapters[slug as keyof typeof adapters] || null;
}

export async function createSession({ partyCode, gameSlug, hostId, options = {} }: { partyCode: string; gameSlug: string; hostId: string; options?: any }) {
  const prisma = getPrisma();
  const adapter = getAdapter(gameSlug);
  if (!adapter) throw new Error('Unknown game');
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!party || !game) throw new Error('Party/game not found');
  return prisma.gameSession.create({
    data: {
      partyCode,
      partyId: party.id,
      gameId: game.id,
      hostId,
      status: 'idle',
      state: adapter.init(options) as any
    },
    include: { game: true }
  });
}

export async function persistAction(sessionId: number, participantId: string, action: any, isHost = false) {
  const prisma = getPrisma();
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { game: true } });
  if (!session) throw new Error('Session not found');
  const adapter = getAdapter(session.game.slug);
  if (!adapter) throw new Error('Adapter not found');
  const nextState = adapter.applyAction(session.state as any, action, { participantId, isHost });
  return prisma.gameSession.update({ where: { id: sessionId }, data: { state: nextState as any } });
}

export function memeInputHash(payload: any) {
  const data = {
    idea: payload.idea || '',
    topText: payload.topText || '',
    bottomText: payload.bottomText || '',
    style: payload.style || 'clean',
    aspect: payload.aspect || '1:1'
  };
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

import { NextApiRequest, NextApiResponse } from 'next';
import { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { getPrisma } from '@/lib/prisma';
import { partyCodeSchema } from '@/lib/validation';

type NextApiResponseServerIO = NextApiResponse & {
  socket: NextApiResponse['socket'] & {
    server: HTTPServer & { io?: IOServer };
  };
};

const connections = new Map<string, { participantId?: string; partyId?: string }>();

export default function handler(_req: NextApiRequest, res: NextApiResponseServerIO) {
  if (res.socket.server.io) {
    return res.end();
  }

  const prisma = getPrisma();

  const io = new IOServer(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: { origin: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000' }
  });

  const lastMessageAt = new Map<string, number>();

  io.on('connection', (socket: Socket) => {
    connections.set(socket.id, {});

    socket.on('party:join', async (payload: { code?: string; participantId?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const party = await prisma.party.findUnique({ where: { code: code.data } });
      if (!party || party.status === 'ended') return;
      let participantId: string | undefined;
      if (payload?.participantId) {
        const participant = await prisma.participant.findFirst({
          where: { id: payload.participantId, partyId: party.id, leftAt: null }
        });
        if (participant) {
          participantId = participant.id;
        }
      }
      socket.join(code.data);
      connections.set(socket.id, { participantId, partyId: party.id });
      if (participantId) {
        io.to(code.data).emit('presence:update', { participantId });
      }
    });

    socket.on('party:leave', async (payload: { code?: string; participantId?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.partyId) return;
      const party = await prisma.party.findUnique({ where: { code: code.data } });
      if (!party || party.id !== connection.partyId) return;
      socket.leave(code.data);
      if (connection.participantId) {
        await prisma.participant.updateMany({
          where: { id: connection.participantId, partyId: party.id },
          data: { leftAt: new Date() }
        });
        io.to(code.data).emit('presence:update', { participantId: connection.participantId, left: true });
      }
      connections.set(socket.id, { partyId: connection.partyId });
    });

    socket.on('seat:reserve', async (payload: { code?: string; seatId?: string; participantId?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const party = await prisma.party.findUnique({ where: { code: code.data } });
      if (!party) return;
      if (!payload?.participantId || !payload?.seatId) return;
      const participant = await prisma.participant.findFirst({
        where: { id: payload.participantId, partyId: party.id, seatId: payload.seatId, leftAt: null }
      });
      if (!participant) return;
      io.to(code.data).emit('seat:update', { seatId: participant.seatId, displayName: participant.displayName });
    });

    socket.on('chat:message', async (payload: { code?: string; text?: string; participantId?: string; seatId?: string; displayName?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.partyId || !connection.participantId) return;
      const party = await prisma.party.findUnique({ where: { code: code.data } });
      if (!party || party.id !== connection.partyId) return;
      const participant = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: party.id, leftAt: null }
      });
      if (!participant) return;
      const now = Date.now();
      const last = lastMessageAt.get(socket.id) ?? 0;
      if (now - last < 1000) return;
      lastMessageAt.set(socket.id, now);

      const text = String(payload?.text || '').slice(0, 200).trim();
      if (!text) return;
      await prisma.message.create({
        data: {
          partyId: party.id,
          participantId: participant.id,
          seatId: participant.seatId,
          displayName: participant.displayName,
          text
        }
      });
      io.to(code.data).emit('chat:message', {
        text,
        seatId: participant.seatId,
        displayName: participant.displayName,
        createdAt: new Date().toISOString()
      });
    });

    socket.on('reaction:send', async (payload: { code?: string; emoji?: string; seatId?: string; displayName?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.partyId || !connection.participantId) return;
      const party = await prisma.party.findUnique({ where: { code: code.data } });
      if (!party || party.id !== connection.partyId) return;
      const participant = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: party.id, leftAt: null }
      });
      if (!participant) return;
      io.to(code.data).emit('reaction:send', {
        emoji: payload?.emoji,
        seatId: participant.seatId,
        displayName: participant.displayName
      });
    });

    socket.on('playback:state', async (payload: { code?: string; playing?: boolean; currentTime?: number }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.partyId || !connection.participantId) return;
      const party = await prisma.party.findUnique({ where: { code: code.data } });
      if (!party || party.id !== connection.partyId) return;
      const host = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: party.id, isHost: true, leftAt: null }
      });
      if (!host) return;
      const playing = Boolean(payload?.playing);
      const currentTime = Number(payload?.currentTime || 0);
      await prisma.playbackState.upsert({
        where: { partyId: party.id },
        update: { playing, currentTime },
        create: { partyId: party.id, playing, currentTime }
      });
      io.to(code.data).emit('playback:state', { playing, currentTime, updatedAt: new Date().toISOString() });
    });

    socket.on('playback:requestSync', async (payload: { code?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.partyId) return;
      const party = await prisma.party.findUnique({
        where: { code: code.data },
        include: { playback: true }
      });
      if (!party || party.id !== connection.partyId) return;
      if (party?.playback) {
        socket.emit('playback:state', {
          playing: party.playback.playing,
          currentTime: party.playback.currentTime,
          updatedAt: party.playback.updatedAt
        });
      }
    });

    socket.on('disconnect', async () => {
      const connection = connections.get(socket.id);
      if (connection?.participantId) {
        await prisma.participant.updateMany({
          where: { id: connection.participantId },
          data: { leftAt: new Date() }
        });
      }
      connections.delete(socket.id);
      lastMessageAt.delete(socket.id);
    });
  });

  res.socket.server.io = io;
  res.end();
}

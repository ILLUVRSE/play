import { NextApiRequest, NextApiResponse } from 'next';
import { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { getPrisma } from '@/lib/prisma';
import { partyCodeSchema } from '@/lib/validation';

type NextApiResponseServerIO = NextApiResponse & {
  socket: NextApiResponse['socket'] & {
    server: HTTPServer & { io?: IOServer };
  };
};

const connections = new Map<string, { participantId?: string; partyId?: string }>();
const participantSockets = new Map<string, string>();

export default function handler(_req: NextApiRequest, res: NextApiResponseServerIO) {
  if (res.socket.server.io) {
    return res.end();
  }

  const prisma = getPrisma();
  const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
  const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
  const roomService =
    livekitUrl && livekitApiKey && livekitApiSecret
      ? new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret)
      : null;

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
        participantSockets.set(participantId, socket.id);
        const participant = await prisma.participant.findFirst({
          where: { id: participantId, partyId: party.id, leftAt: null }
        });
        if (participant) {
          io.to(code.data).emit('presence:update', {
            participantId,
            seatId: participant.seatId,
            displayName: participant.displayName,
            isHost: participant.isHost,
            muted: participant.muted,
            left: false
          });
        }
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
        participantSockets.delete(connection.participantId);
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
      io.to(code.data).emit('seat:update', {
        participantId: participant.id,
        seatId: participant.seatId,
        displayName: participant.displayName,
        isHost: participant.isHost,
        muted: participant.muted
      });
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

    socket.on('playback:state', async (payload: { code?: string; playing?: boolean; currentTime?: number; currentIndex?: number }) => {
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
      const currentIndex = Number(payload?.currentIndex ?? party.currentIndex);
      await prisma.playbackState.upsert({
        where: { partyId: party.id },
        update: { playing, currentTime },
        create: { partyId: party.id, playing, currentTime }
      });
      await prisma.party.update({
        where: { id: party.id },
        data: { currentIndex }
      });
      io.to(code.data).emit('playback:state', { playing, currentTime, currentIndex, updatedAt: new Date().toISOString() });
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
          currentIndex: party.currentIndex,
          updatedAt: party.playback.updatedAt
        });
      }
    });

    socket.on('voice:join', async (payload: { code?: string; participantId?: string }, callback?: (data: { token?: string; roomName?: string; micLocked?: boolean; seatLocked?: boolean; error?: string }) => void) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) {
        callback?.({ error: 'Invalid code' });
        return;
      }
      if (!payload?.participantId) {
        callback?.({ error: 'Missing participant' });
        return;
      }
      const party = await prisma.party.findUnique({ where: { code: code.data } });
      if (!party || party.status === 'ended') {
        callback?.({ error: 'Party not available' });
        return;
      }
      const participant = await prisma.participant.findFirst({
        where: { id: payload.participantId, partyId: party.id, leftAt: null }
      });
      if (!participant) {
        callback?.({ error: 'Participant not found' });
        return;
      }
      if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
        callback?.({ error: 'LiveKit not configured' });
        return;
      }
      const token = new AccessToken(livekitApiKey, livekitApiSecret, {
        identity: participant.id,
        name: participant.displayName,
        metadata: JSON.stringify({
          seatId: participant.seatId,
          displayName: participant.displayName,
          isHost: participant.isHost
        })
      });
      token.addGrant({ roomJoin: true, room: party.code, canPublish: true, canSubscribe: true });
      callback?.({
        token: token.toJwt(),
        roomName: party.code,
        micLocked: party.micLocked,
        seatLocked: party.seatLocked
      });
    });

    socket.on('host:micLock', async (payload: { code?: string; locked?: boolean }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.participantId || !connection.partyId) return;
      const host = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: connection.partyId, isHost: true, leftAt: null }
      });
      if (!host) return;
      const locked = Boolean(payload?.locked);
      const party = await prisma.party.update({
        where: { id: connection.partyId },
        data: { micLocked: locked }
      });
      io.to(party.code).emit('voice:micLock', { locked });
    });

    socket.on('host:seatLock', async (payload: { code?: string; locked?: boolean }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.participantId || !connection.partyId) return;
      const host = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: connection.partyId, isHost: true, leftAt: null }
      });
      if (!host) return;
      const locked = Boolean(payload?.locked);
      const party = await prisma.party.update({
        where: { id: connection.partyId },
        data: { seatLocked: locked }
      });
      io.to(party.code).emit('seat:lock', { locked });
    });

    socket.on('host:mute', async (payload: { code?: string; targetParticipantId?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.participantId || !connection.partyId) return;
      const host = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: connection.partyId, isHost: true, leftAt: null }
      });
      if (!host) return;
      if (!payload?.targetParticipantId) return;
      const participant = await prisma.participant.updateMany({
        where: { id: payload.targetParticipantId, partyId: connection.partyId, leftAt: null, isHost: false },
        data: { muted: true }
      });
      if (!participant.count) return;
      io.to(code.data).emit('voice:mute', { participantId: payload.targetParticipantId, muted: true });
    });

    socket.on('host:unmute', async (payload: { code?: string; targetParticipantId?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.participantId || !connection.partyId) return;
      const host = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: connection.partyId, isHost: true, leftAt: null }
      });
      if (!host) return;
      if (!payload?.targetParticipantId) return;
      const participant = await prisma.participant.updateMany({
        where: { id: payload.targetParticipantId, partyId: connection.partyId, leftAt: null, isHost: false },
        data: { muted: false }
      });
      if (!participant.count) return;
      io.to(code.data).emit('voice:mute', { participantId: payload.targetParticipantId, muted: false });
    });

    socket.on('host:kick', async (payload: { code?: string; targetParticipantId?: string }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.participantId || !connection.partyId) return;
      const host = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: connection.partyId, isHost: true, leftAt: null }
      });
      if (!host) return;
      if (!payload?.targetParticipantId) return;
      await prisma.participant.updateMany({
        where: { id: payload.targetParticipantId, partyId: connection.partyId, leftAt: null },
        data: { leftAt: new Date() }
      });
      const targetSocketId = participantSockets.get(payload.targetParticipantId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('party:kick', { reason: 'kicked' });
      }
      if (roomService) {
        try {
          await roomService.removeParticipant(code.data, payload.targetParticipantId);
        } catch {
          // ignore
        }
      }
      io.to(code.data).emit('presence:update', { participantId: payload.targetParticipantId, left: true });
    });

    socket.on('playlist:update', async (payload: { code?: string; orderedIds?: string[] }) => {
      const code = partyCodeSchema.safeParse(payload?.code);
      if (!code.success) return;
      const connection = connections.get(socket.id);
      if (!connection?.participantId || !connection.partyId) return;
      const host = await prisma.participant.findFirst({
        where: { id: connection.participantId, partyId: connection.partyId, isHost: true, leftAt: null }
      });
      if (!host) return;
      const orderedIds = Array.isArray(payload?.orderedIds) ? payload.orderedIds : [];
      if (!orderedIds.length) return;
      const updates = orderedIds.map((id, index) =>
        prisma.playlistItem.updateMany({
          where: { id, partyId: connection.partyId },
          data: { orderIndex: index }
        })
      );
      await prisma.$transaction(updates);
      const playlist = await prisma.playlistItem.findMany({
        where: { partyId: connection.partyId },
        orderBy: { orderIndex: 'asc' }
      });
      io.to(code.data).emit('playlist:update', { playlist });
    });

    socket.on('disconnect', async () => {
      const connection = connections.get(socket.id);
      if (connection?.participantId) {
        await prisma.participant.updateMany({
          where: { id: connection.participantId },
          data: { leftAt: new Date() }
        });
        participantSockets.delete(connection.participantId);
      }
      connections.delete(socket.id);
      lastMessageAt.delete(socket.id);
    });
  });

  res.socket.server.io = io;
  res.end();
}

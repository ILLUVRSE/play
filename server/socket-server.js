const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const SpacelightGame = require('./game/SpacelightGame');

const prisma = new PrismaClient();
const connections = new Map();
const participantSockets = new Map();
const lastMessageAt = new Map();
const games = new Map(); // gameCode -> SpacelightGame

const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || '';
const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
const roomService =
  livekitUrl && livekitApiKey && livekitApiSecret
    ? new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret)
    : null;

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function isValidCode(code) {
  return /^[A-Z0-9]{6}$/.test(code);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('socket');
});

const io = new Server(server, {
  path: '/api/socket',
  addTrailingSlash: false,
  cors: { origin: process.env.NEXT_PUBLIC_BASE_URL || '*' }
});

// Game Loop
setInterval(() => {
  for (const [code, game] of games.entries()) {
    game.update();
    if (game.status === 'gameover') {
        // Handle game over (save to DB)
        saveGameResults(game);
        games.delete(code);
    }
  }
}, 1000 / 60);

async function saveGameResults(game) {
    try {
        const duration = Math.floor((Date.now() - game.startTime) / 1000);
        await prisma.leaderboard.create({
            data: {
                displayName: Array.from(game.players.values()).map(p => p.displayName).join(', '),
                score: game.score,
                wavesCleared: game.wave - 1,
                duration,
                mode: game.isCoop ? 'coop' : 'solo',
                partyId: game.code.length > 6 ? null : game.code // Simple check if it's a party code
            }
        });
    } catch (e) {
        console.error('Failed to save game results:', e);
    }
}

io.on('connection', (socket) => {
  connections.set(socket.id, {});

  socket.on('party:join', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
    const party = await prisma.party.findUnique({ where: { code } });
    if (!party || party.status === 'ended') return;
    let participantId;
    if (payload?.participantId) {
      const participant = await prisma.participant.findFirst({
        where: { id: payload.participantId, partyId: party.id, leftAt: null }
      });
      if (participant) {
        participantId = participant.id;
      }
    }
    socket.join(code);
    connections.set(socket.id, { participantId, partyId: party.id });
    if (participantId) {
      participantSockets.set(participantId, socket.id);
      const participant = await prisma.participant.findFirst({
        where: { id: participantId, partyId: party.id, leftAt: null }
      });
      if (participant) {
        io.to(code).emit('presence:update', {
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

  socket.on('party:leave', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
    const connection = connections.get(socket.id);
    if (!connection?.partyId) return;
    const party = await prisma.party.findUnique({ where: { code } });
    if (!party || party.id !== connection.partyId) return;
    socket.leave(code);
    if (connection.participantId) {
      await prisma.participant.updateMany({
        where: { id: connection.participantId, partyId: party.id },
        data: { leftAt: new Date() }
      });
      participantSockets.delete(connection.participantId);
      io.to(code).emit('presence:update', { participantId: connection.participantId, left: true });
    }
    connections.set(socket.id, { partyId: connection.partyId });
  });

  socket.on('seat:reserve', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
    const party = await prisma.party.findUnique({ where: { code } });
    if (!party) return;
    if (!payload?.participantId || !payload?.seatId) return;
    const participant = await prisma.participant.findFirst({
      where: { id: payload.participantId, partyId: party.id, seatId: payload.seatId, leftAt: null }
    });
    if (!participant) return;
    io.to(code).emit('seat:update', {
      participantId: participant.id,
      seatId: participant.seatId,
      displayName: participant.displayName,
      isHost: participant.isHost,
      muted: participant.muted
    });
  });

  socket.on('chat:message', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
    const connection = connections.get(socket.id);
    if (!connection?.partyId || !connection.participantId) return;
    const party = await prisma.party.findUnique({ where: { code } });
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
    io.to(code).emit('chat:message', {
      text,
      seatId: participant.seatId,
      displayName: participant.displayName,
      createdAt: new Date().toISOString()
    });
  });

  socket.on('reaction:send', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
    const connection = connections.get(socket.id);
    if (!connection?.partyId || !connection.participantId) return;
    const party = await prisma.party.findUnique({ where: { code } });
    if (!party || party.id !== connection.partyId) return;
    const participant = await prisma.participant.findFirst({
      where: { id: connection.participantId, partyId: party.id, leftAt: null }
    });
    if (!participant) return;
    io.to(code).emit('reaction:send', {
      emoji: payload?.emoji,
      seatId: participant.seatId,
      displayName: participant.displayName
    });
  });

  socket.on('playback:state', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
    const connection = connections.get(socket.id);
    if (!connection?.partyId || !connection.participantId) return;
    const party = await prisma.party.findUnique({ where: { code } });
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
    io.to(code).emit('playback:state', { playing, currentTime, currentIndex, updatedAt: new Date().toISOString() });
  });

  socket.on('playback:requestSync', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
    const connection = connections.get(socket.id);
    if (!connection?.partyId) return;
    const party = await prisma.party.findUnique({
      where: { code },
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

  socket.on('voice:join', async (payload, callback) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) {
      callback?.({ error: 'Invalid code' });
      return;
    }
    if (!payload?.participantId) {
      callback?.({ error: 'Missing participant' });
      return;
    }
    const party = await prisma.party.findUnique({ where: { code } });
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

  socket.on('host:micLock', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
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

  socket.on('host:seatLock', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
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

  socket.on('host:launchGame', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
    const connection = connections.get(socket.id);
    if (!connection?.participantId || !connection.partyId) return;
    const host = await prisma.participant.findFirst({
      where: { id: connection.participantId, partyId: connection.partyId, isHost: true, leftAt: null }
    });
    if (!host) return;

    io.to(code).emit('party:gameLaunch', { game: 'spacelight' });
  });

  socket.on('host:mute', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
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
    io.to(code).emit('voice:mute', { participantId: payload.targetParticipantId, muted: true });
  });

  socket.on('host:unmute', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
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
    io.to(code).emit('voice:mute', { participantId: payload.targetParticipantId, muted: false });
  });

  socket.on('host:kick', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
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
        await roomService.removeParticipant(code, payload.targetParticipantId);
      } catch {
        // ignore
      }
    }
    io.to(code).emit('presence:update', { participantId: payload.targetParticipantId, left: true });
  });

  socket.on('game:join', async (payload) => {
    const code = normalizeCode(payload?.code);
    const displayName = payload?.displayName || 'Unknown Pilot';

    let game = games.get(code);
    if (!game) {
        game = new SpacelightGame(io, code, payload?.isCoop);
        games.set(code, game);
    }

    socket.join(code);
    game.addPlayer(socket.id, displayName);
    socket.emit('game:joined', { code, playerId: socket.id });
  });

  socket.on('game:input', (payload) => {
    const connection = connections.get(socket.id);
    // Use code from payload or connection
    const code = normalizeCode(payload?.code);
    const game = games.get(code);
    if (game) {
        game.handleInput(socket.id, payload.input);
    }
  });

  socket.on('playlist:update', async (payload) => {
    const code = normalizeCode(payload?.code);
    if (!isValidCode(code)) return;
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
    io.to(code).emit('playlist:update', { playlist });
  });

  socket.on('disconnect', async () => {
    // Remove from games
    for (const [code, game] of games.entries()) {
        if (game.players.has(socket.id)) {
            game.removePlayer(socket.id);
        }
    }

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

const port = Number(process.env.SOCKET_PORT || process.env.PORT || 3001);
server.listen(port, () => {
  console.log(`Socket server listening on ${port}`);
});

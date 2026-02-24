const ACTION_WINDOW_MS = 5000;
const ACTION_LIMIT = 10;

function initStateForSlug(slug) {
  if (slug === "forehead-poker") return { players: {}, order: [], deck: [], pot: 0, currentBet: 0, playerBets: {}, phase: "waiting" };
  if (slug === "caption-battle") return { phase: "lobby", image: null, captions: [], votes: {}, scores: {} };
  if (slug === "pictionary") return { phase: "lobby", drawerId: null, secretWord: null, strokes: [], scores: {}, guesses: [] };
  return {};
}

function registerGameHandlers({ io, socket, prisma, connections, rateLimitMap, normalizeCode, isValidCode }) {
  const canAct = () => {
    const key = socket.id;
    const now = Date.now();
    const current = rateLimitMap.get(key) || { count: 0, start: now };
    if (now - current.start > ACTION_WINDOW_MS) {
      rateLimitMap.set(key, { count: 1, start: now });
      return true;
    }
    if (current.count >= ACTION_LIMIT) return false;
    current.count += 1;
    rateLimitMap.set(key, current);
    return true;
  };

  socket.on('game:create', async (payload) => {
    const code = normalizeCode(payload?.partyCode);
    if (!isValidCode(code)) return;
    const conn = connections.get(socket.id);
    if (!conn?.participantId) return;
    const party = await prisma.party.findUnique({ where: { code } });
    if (!party) return;
    const host = await prisma.participant.findFirst({ where: { id: conn.participantId, partyId: party.id, isHost: true, leftAt: null } });
    if (!host) return;
    const game = await prisma.game.findUnique({ where: { slug: String(payload?.gameSlug || '') } });
    if (!game) return;
    const session = await prisma.gameSession.create({ data: { partyCode: code, partyId: party.id, gameId: game.id, hostId: host.id, state: initStateForSlug(game.slug), status: 'idle' }, include: { game: true } });
    io.to(code).emit('game:created', session);
  });

  socket.on('game:action', async (payload) => {
    if (!canAct()) return;
    const conn = connections.get(socket.id);
    if (!conn?.participantId) return;
    const sessionId = Number(payload?.sessionId || 0);
    if (!sessionId) return;
    const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { host: true } });
    if (!session) return;
    io.to(session.partyCode).emit('game:state', { sessionId, action: payload.action || {}, participantId: conn.participantId, ts: Date.now() });
  });


  socket.on('game:join', async (payload) => {
    const sessionId = Number(payload?.sessionId || 0);
    if (!sessionId) return;
    const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) return;
    socket.join(`${session.partyCode}:game:${sessionId}`);
    socket.emit('game:state', { sessionId, state: session.state, ts: Date.now() });
    io.to(session.partyCode).emit('game:playerJoined', { sessionId });
  });

  socket.on('game:start', async (payload) => {
    const sessionId = Number(payload?.sessionId || 0);
    if (!sessionId) return;
    const session = await prisma.gameSession.update({ where: { id: sessionId }, data: { status: 'running', startedAt: new Date() } });
    io.to(session.partyCode).emit('game:started', { sessionId });
  });

  socket.on('game:end', async (payload) => {
    const sessionId = Number(payload?.sessionId || 0);
    if (!sessionId) return;
    const session = await prisma.gameSession.update({ where: { id: sessionId }, data: { status: 'finished', endedAt: new Date() } });
    io.to(session.partyCode).emit('game:ended', { sessionId });
  });

  socket.on('game:vote', async (payload) => {
    const sessionId = Number(payload?.sessionId || 0);
    if (!sessionId) return;
    io.emit('game:votesUpdated', { sessionId, itemId: payload?.itemId });
  });
  socket.on('drawing:stroke', async (payload) => {
    if (!canAct()) return;
    const sessionId = Number(payload?.sessionId || 0);
    if (!sessionId) return;
    const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) return;
    io.to(session.partyCode).emit('drawing:stroke', { sessionId, stroke: payload.stroke });
  });

  socket.on('drawing:clear', async (payload) => {
    const sessionId = Number(payload?.sessionId || 0);
    if (!sessionId) return;
    const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) return;
    io.to(session.partyCode).emit('drawing:clear', { sessionId });
  });
}

module.exports = { registerGameHandlers };

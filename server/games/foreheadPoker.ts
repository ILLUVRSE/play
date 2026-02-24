import { GameAdapter } from './GameAdapter';

type Card = { suit: '♠' | '♥' | '♦' | '♣'; rank: number };

const rankNames = ['high-card', 'pair', 'flush', 'straight', 'straight-flush', 'three-kind'] as const;

export function evaluateThreeCardHand(cards: Card[]) {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const flush = sorted.every((c) => c.suit === sorted[0].suit);
  const unique = [...new Set(ranks)];
  const threeKind = unique.length === 1;
  const pair = unique.length === 2;
  const lowAce = [14, 3, 2].every((r) => ranks.includes(r));
  const straight = (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) || lowAce;

  let rank = 0;
  if (threeKind) rank = 5;
  else if (straight && flush) rank = 4;
  else if (straight) rank = 3;
  else if (flush) rank = 2;
  else if (pair) rank = 1;

  let tiebreakers = [...ranks];
  if (pair) {
    const pairRank = unique.find((r) => ranks.filter((x) => x === r).length === 2) ?? 0;
    const kicker = unique.find((r) => r !== pairRank) ?? 0;
    tiebreakers = [pairRank, kicker];
  }
  if (lowAce) tiebreakers = [3, 2, 1];

  return { rank, label: rankNames[rank], tiebreakers };
}

function buildDeck(): Card[] {
  const suits: Card['suit'][] = ['♠', '♥', '♦', '♣'];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank += 1) deck.push({ suit, rank });
  }
  return deck;
}

function shuffle<T>(arr: T[]) {
  const deck = [...arr];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function compareHands(a: Card[], b: Card[]) {
  const ea = evaluateThreeCardHand(a);
  const eb = evaluateThreeCardHand(b);
  if (ea.rank !== eb.rank) return ea.rank - eb.rank;
  for (let i = 0; i < Math.max(ea.tiebreakers.length, eb.tiebreakers.length); i += 1) {
    const diff = (ea.tiebreakers[i] ?? 0) - (eb.tiebreakers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const foreheadPoker: GameAdapter = {
  slug: 'forehead-poker',
  name: 'Forehead Poker',
  init() {
    return { players: {}, order: [], deck: buildDeck(), pot: 0, currentBet: 0, playerBets: {}, phase: 'waiting' };
  },
  onJoin(state, { participantId }) {
    if (!state.players[participantId]) {
      state.players[participantId] = { cards: [], chips: 100, status: 'active' };
      state.playerBets[participantId] = 0;
      state.order.push(participantId);
    }
    return { ...state };
  },
  applyAction(state, action, ctx) {
    const next: any = { ...state, players: { ...state.players }, playerBets: { ...state.playerBets } };
    if (action.type === 'deal' && ctx.isHost) {
      const deck = shuffle(buildDeck());
      next.deck = deck;
      next.phase = 'betting';
      next.currentBet = 2;
      next.pot = 0;
      for (const pid of next.order) {
        next.players[pid] = { ...next.players[pid], cards: [deck.pop(), deck.pop(), deck.pop()], status: 'active' };
        next.playerBets[pid] = 0;
      }
      return next;
    }
    const p = next.players[ctx.participantId];
    if (!p || p.status !== 'active') return next;
    if (action.type === 'fold') {
      p.status = 'folded';
      return next;
    }
    if (action.type === 'call') {
      const cost = Math.max(0, next.currentBet - (next.playerBets[ctx.participantId] || 0));
      const spend = Math.min(cost, p.chips);
      p.chips -= spend;
      next.playerBets[ctx.participantId] += spend;
      next.pot += spend;
      return next;
    }
    if (action.type === 'raise') {
      const to = Math.max(next.currentBet + 2, Number(action.amount || 0));
      const need = to - (next.playerBets[ctx.participantId] || 0);
      if (need > 0 && need <= p.chips) {
        p.chips -= need;
        next.playerBets[ctx.participantId] += need;
        next.currentBet = to;
        next.pot += need;
      }
    }
    return next;
  },
  evaluate(state) {
    const active = state.order.filter((pid: string) => state.players[pid]?.status === 'active');
    if (active.length === 0) return { winners: [], pot: state.pot };
    let winners = [active[0]];
    for (const pid of active.slice(1)) {
      const cmp = compareHands(state.players[pid].cards, state.players[winners[0]].cards);
      if (cmp > 0) winners = [pid];
      else if (cmp === 0) winners.push(pid);
    }
    return { winners, pot: state.pot };
  },
  serialize(state, viewerId) {
    const players: Record<string, any> = {};
    for (const pid of state.order) {
      const info = state.players[pid];
      players[pid] = {
        ...info,
        cards: pid === viewerId ? info.cards.map(() => ({ hidden: true })) : info.cards
      };
    }
    return { ...state, players };
  }
};

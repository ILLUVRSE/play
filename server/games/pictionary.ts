import { GameAdapter } from './GameAdapter';

const WORDS = ['apple', 'rocket', 'castle', 'guitar', 'volcano', 'penguin', 'planet'];

function normalizeGuess(v: string) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const pictionary: GameAdapter = {
  slug: 'pictionary',
  name: 'Pictionary',
  init() {
    return { phase: 'lobby', drawerId: null, secretWord: null, strokes: [], scores: {}, guesses: [] };
  },
  onJoin(state, { participantId }) {
    if (typeof state.scores[participantId] !== 'number') state.scores[participantId] = 0;
    return { ...state };
  },
  applyAction(state, action, ctx) {
    const next: any = { ...state, strokes: [...state.strokes], scores: { ...state.scores }, guesses: [...state.guesses] };
    if (action.type === 'startRound' && ctx.isHost) {
      next.drawerId = action.drawerId;
      next.secretWord = action.word || WORDS[Math.floor(Math.random() * WORDS.length)];
      next.phase = 'drawing';
      next.strokes = [];
      next.guesses = [];
    } else if (action.type === 'stroke' && ctx.participantId === next.drawerId && next.phase === 'drawing') {
      if (Array.isArray(action.stroke?.points) && action.stroke.points.length <= 128) {
        next.strokes.push(action.stroke);
        next.strokes = next.strokes.slice(-200);
      }
    } else if (action.type === 'clear' && (ctx.participantId === next.drawerId || ctx.isHost)) {
      next.strokes = [];
    } else if (action.type === 'guess' && next.phase === 'drawing') {
      const guess = String(action.text || '').slice(0, 80);
      next.guesses.push({ participantId: ctx.participantId, text: guess });
      if (normalizeGuess(guess) === normalizeGuess(next.secretWord || '')) {
        next.phase = 'round-ended';
        next.scores[ctx.participantId] = (next.scores[ctx.participantId] || 0) + 2;
        if (next.drawerId) next.scores[next.drawerId] = (next.scores[next.drawerId] || 0) + 1;
      }
    }
    return next;
  },
  serialize(state, viewerId) {
    return { ...state, secretWord: viewerId === state.drawerId || state.phase !== 'drawing' ? state.secretWord : null };
  }
};

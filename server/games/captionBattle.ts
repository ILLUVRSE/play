import { GameAdapter } from './GameAdapter';

export const captionBattle: GameAdapter = {
  slug: 'caption-battle',
  name: 'Caption Battle',
  init() {
    return { phase: 'lobby', image: null, captions: [], votes: {}, scores: {}, submittedBy: {} };
  },
  onJoin(state, { participantId }) {
    if (typeof state.scores[participantId] !== 'number') state.scores[participantId] = 0;
    return { ...state };
  },
  applyAction(state, action, ctx) {
    const next: any = { ...state, captions: [...state.captions], votes: { ...state.votes }, scores: { ...state.scores }, submittedBy: { ...state.submittedBy } };
    if (action.type === 'image:add' && ctx.isHost) {
      next.image = action.image;
      next.phase = 'captioning';
    } else if (action.type === 'submitCaption' && next.phase === 'captioning') {
      if (!next.submittedBy[ctx.participantId]) {
        const id = `${Date.now()}-${Math.random()}`;
        next.captions.push({ id, participantId: ctx.participantId, text: String(action.text || '').slice(0, 160), votes: 0 });
        next.submittedBy[ctx.participantId] = id;
      }
    } else if (action.type === 'reveal' && ctx.isHost) {
      next.phase = 'voting';
    } else if (action.type === 'vote' && next.phase === 'voting') {
      next.votes[ctx.participantId] = action.itemId;
      next.captions = next.captions.map((c: any) => ({ ...c, votes: Object.values(next.votes).filter((v) => v === c.id).length }));
    }
    return next;
  },
  evaluate(state) {
    const captions = [...state.captions].sort((a, b) => b.votes - a.votes);
    const winner = captions[0];
    if (winner) state.scores[winner.participantId] = (state.scores[winner.participantId] || 0) + 1;
    return { winner, scores: state.scores };
  },
  serialize(state) {
    return {
      ...state,
      captions: state.phase === 'voting' || state.phase === 'results' ? state.captions.map((c: any) => ({ id: c.id, text: c.text, votes: c.votes })) : []
    };
  }
};

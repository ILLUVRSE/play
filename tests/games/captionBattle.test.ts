import assert from 'assert';
import { captionBattle } from '../../server/games/captionBattle';

let state = captionBattle.init();
state = captionBattle.onJoin!(state, { participantId: 'a' });
state = captionBattle.onJoin!(state, { participantId: 'b' });
state = captionBattle.applyAction(state, { type: 'image:add', image: 'x' }, { participantId: 'host', isHost: true });
state = captionBattle.applyAction(state, { type: 'submitCaption', text: 'one' }, { participantId: 'a' });
state = captionBattle.applyAction(state, { type: 'submitCaption', text: 'two' }, { participantId: 'b' });
state = captionBattle.applyAction(state, { type: 'reveal' }, { participantId: 'host', isHost: true });
state = captionBattle.applyAction(state, { type: 'vote', itemId: state.captions[0].id }, { participantId: 'a' });
state = captionBattle.applyAction(state, { type: 'vote', itemId: state.captions[0].id }, { participantId: 'b' });
const result = captionBattle.evaluate!(state);
assert.equal(result.winner.id, state.captions[0].id);

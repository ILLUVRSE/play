import assert from 'assert';
import { pictionary } from '../../server/games/pictionary';

let state = pictionary.init();
state = pictionary.onJoin!(state, { participantId: 'drawer' });
state = pictionary.applyAction(state, { type: 'startRound', drawerId: 'drawer', word: 'apple' }, { participantId: 'host', isHost: true });
state = pictionary.applyAction(state, { type: 'stroke', stroke: { points: [[0, 0], [1, 1]], color: '#fff', width: 2 } }, { participantId: 'drawer' });
assert.equal(state.strokes.length, 1);

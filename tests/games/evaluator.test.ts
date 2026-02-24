import assert from 'assert';
import { evaluateThreeCardHand } from '../../server/games/foreheadPoker';

const trips = evaluateThreeCardHand([{ suit: '♠', rank: 9 }, { suit: '♥', rank: 9 }, { suit: '♦', rank: 9 }]);
const straight = evaluateThreeCardHand([{ suit: '♠', rank: 10 }, { suit: '♥', rank: 9 }, { suit: '♦', rank: 8 }]);
assert.ok(trips.rank > straight.rank);

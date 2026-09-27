const test = require('node:test');
const assert = require('node:assert/strict');

const execution = require('../js/flight_command_execution.js');
const missions = require('../js/mission_rules.js');
const lifecycle = require('../js/scene_lifecycle.js');
const flightDeck = require('../js/flight_deck_view.js');

test('Flight Command block knowledge has one authoritative list', () => {
    assert.equal(execution.isCommandBlockType('drone_takeoff'), true);
    assert.equal(execution.isCommandBlockType('math_number'), false);
    assert.equal(new Set(execution.COMMAND_BLOCK_TYPES).size, execution.COMMAND_BLOCK_TYPES.length);
});

test('Flight Command execution stops through its interface', async () => {
    const seen = [];
    let stopped = false;
    const result = await execution.runQueue([{ type: 'a' }, { type: 'b' }], {
        shouldStop: () => stopped,
        executeCommand: async command => {
            seen.push(command.type);
            stopped = true;
        }
    });
    assert.deepEqual(seen, ['a']);
    assert.deepEqual(result, { completed: 1, total: 2, stopped: true });
});

test('Mission adapters own pending progress language', () => {
    assert.match(missions.forScene('tunnel').pending({ inspectionCheckpoints: 1 }), /1\/3，可選擇/);
    assert.match(missions.forScene('city').pending({ fireSites: 3 }), /3\/4 個火點/);
    assert.equal(missions.forScene('free').pending({}), '');
});

test('Flight Deck presentation owns screen DOM knowledge', () => {
    const elements = new Map(['main-menu', 'mission-select-menu', 'game-interface'].map(id => [id, { style: {} }]));
    const view = flightDeck.create({ getElementById: id => elements.get(id) || null });
    view.showScreen('deck');
    assert.equal(elements.get('main-menu').style.display, 'none');
    assert.equal(elements.get('game-interface').style.display, 'flex');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const THREE = require('three');

function harness({ width = 1024, savedView = null, blockedStorage = false } = {}) {
    const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'));
    const document = dom.window.document;
    const storage = new Map(savedView ? [['drone-simulator:v2:deck-view', savedView]] : []);
    const program = [{ id: 'student-program', type: 'drone_takeoff' }];
    let resets = 0;
    const c = vm.createContext({
        document, window: { innerWidth: width }, THREE,
        localStorage: { getItem: key => { if (blockedStorage) throw Error('blocked'); return storage.get(key); }, setItem: (key, value) => { if (blockedStorage) throw Error('blocked'); storage.set(key, value); } },
        state: { isRunning: false, isFlying: false, stopSignal: false, missionCompleted: false },
        currentGameMode: 'freeplay', currentSceneType: 'free',
        workspace: { getAllBlocks: () => program, getTopBlocks: () => [] },
        FlightTutorial: require('../js/flight_tutorial.js'),
        initBlockly() {}, refreshGameUILayout() {}, checkTutorialProgress() {},
        requestAnimationFrame: fn => fn(),
        toggleBlocklyPanel: () => document.getElementById('blocklyDiv').classList.add('visible'),
        resetSimulator: () => { resets++; },
        stopInteractiveTutorial() {}, dismissBlocklyDiscoverToast() {}, hideAppMessage() {}, toggleConsole() {},
        setTimeout: () => 1, clearTimeout() {},
        matchMedia: () => ({ matches: true, addEventListener() {} }),
        MutationObserver: class { observe() {} }, ResizeObserver: class { observe() {} },
        camTarget: {}, camRadius: 0, camPhi: 0, followDrone: false,
        FOLLOW_CAMERA_RADIUS: 250, FREE_CAMERA_RADIUS: 1000, updateCameraPosition() {}
    });
    vm.runInContext(fs.readFileSync('js/v2_ui.js', 'utf8'), c);
    return { c, ui: c.window.V2UI, document, program, resets: () => resets, close: () => dom.window.close() };
}

test('landscape tablet starts in split view and execution preserves a chosen code view', () => {
    const h = harness();
    try {
        h.ui.enter();
        assert.equal(h.document.getElementById('game-interface').dataset.view, 'split');
        h.ui.setView('code');
        h.ui.prepareRun();
        assert.equal(h.document.getElementById('game-interface').dataset.view, 'code');
        assert.equal(h.document.getElementById('v2-code-feedback').hidden, false);
        assert.equal(h.document.getElementById('canvas-container').inert, true);
    } finally { h.close(); }
});

test('successful flight returns to the previous editor view without replacing the program', () => {
    const h = harness();
    try {
        h.ui.setView('code'); h.ui.prepareRun(); h.ui.setView('world');
        h.c.window.__tutorialFlightCompleted = true;
        h.ui.programEnded({ completed: 3, total: 3, stopped: false });
        assert.equal(h.document.querySelector('.v2-return-edit').hidden, false);
        const original = h.program.slice();
        h.ui.returnToEditor();
        assert.equal(h.document.getElementById('game-interface').dataset.view, 'code');
        assert.equal(h.c.window.__tutorialReturnedToEdit, true);
        assert.equal(h.resets(), 1, 'existing reset returns the drone to its start for comparison');
        assert.deepEqual(h.program, original);
        assert.equal(h.document.querySelector('.v2-return-edit').hidden, true);
    } finally { h.close(); }
});

test('stopped flights and mission execution do not produce the practice success action', () => {
    const h = harness();
    try {
        h.ui.prepareRun();
        h.ui.programEnded({ completed: 1, total: 3, stopped: true });
        assert.equal(h.document.querySelector('.v2-return-edit').hidden, true);
        h.c.currentGameMode = 'mission';
        h.ui.programEnded({ completed: 3, total: 3, stopped: false });
        assert.equal(h.document.querySelector('.v2-return-edit').hidden, true);
    } finally { h.close(); }
});

test('view choice survives reentry; blocked storage still permits session-only navigation', () => {
    for (const blockedStorage of [false, true]) {
        const h = harness({ blockedStorage, width: 800 });
        try {
            h.ui.enter();
            assert.equal(h.document.getElementById('game-interface').dataset.view, 'code');
            h.ui.setView('split'); h.ui.enter();
            assert.equal(h.document.getElementById('game-interface').dataset.view, 'split');
        } finally { h.close(); }
    }
});

test('reentering a saved world view still prepares the Flight Program', () => {
    const h = harness({ savedView: 'world' });
    try {
        h.ui.enter();
        assert.equal(h.document.getElementById('game-interface').dataset.view, 'world');
        assert.equal(h.document.getElementById('blocklyDiv').classList.contains('visible'), true);
        assert.equal(h.document.getElementById('blocklyDiv').inert, true);
    } finally { h.close(); }
});

test('a flight error keeps explicit failure feedback and never exposes a success action', () => {
    const h = harness();
    try {
        h.c.state.stopSignal = true;
        h.ui.programEnded({ error: new Error('failed'), completed: 0, total: 3 });
        assert.equal(h.document.getElementById('v2-action-status').textContent, '飛行未能完成');
        assert.equal(h.document.querySelector('.v2-return-edit').hidden, true);
    } finally { h.close(); }
});

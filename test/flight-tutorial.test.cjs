const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Blockly = require('blockly/node');
const { javascriptGenerator } = require('blockly/javascript');
const tutorial = require('../js/flight_tutorial.js');
Blockly.JavaScript = javascriptGenerator;
vm.runInNewContext(fs.readFileSync('js/blockly_def.js', 'utf8'), { Blockly });

function withWorkspace(fn) {
    const workspace = new Blockly.Workspace();
    try { return fn(workspace); } finally { workspace.dispose(); }
}

test('each helper action adds only its own connected Flight Program step', () => withWorkspace(ws => {
    for (let step = 0; step < 4; step++) {
        assert.equal(tutorial.inspect(ws, step).complete, false);
        assert.equal(tutorial.addStep(Blockly, ws, step).complete, true);
        const statements = ws.getAllBlocks(false).filter(block => !block.outputConnection);
        assert.equal(statements.length, step + 1);
        assert.equal(tutorial.addStep(Blockly, ws, step).complete, true);
        assert.equal(ws.getAllBlocks(false).filter(block => !block.outputConnection).length, step + 1);
    }
    const context = { cmdQueue: [] };
    vm.runInNewContext(javascriptGenerator.workspaceToCode(ws), context);
    assert.deepEqual(Array.from(context.cmdQueue, cmd => cmd.type), ['takeoff', 'move_forward', 'land']);
    assert.equal(context.cmdQueue[1].param, 1);
}));

test('detached, disabled, reversed and wrong-distance blocks cannot pass the lesson', () => withWorkspace(ws => {
    const event = ws.newBlock('event_start');
    const takeoff = ws.newBlock('drone_takeoff');
    assert.equal(tutorial.inspect(ws, 1).complete, false);
    assert.equal(tutorial.addStep(Blockly, ws, 1).complete, true);
    assert.equal(event.getNextBlock(), takeoff);
    assert.equal(ws.getAllBlocks(false).length, 2, 'reuse the detached student block');
    takeoff.setEnabled(false);
    assert.equal(tutorial.inspect(ws, 1).complete, false);
    takeoff.setEnabled(true);
    tutorial.addStep(Blockly, ws, 2);
    const move = tutorial.distanceBlock(ws);
    move.setFieldValue('BACKWARD', 'DIR');
    assert.equal(tutorial.inspect(ws, 2).complete, false);
    assert.equal(tutorial.addStep(Blockly, ws, 2).complete, false);
    assert.equal(move.getFieldValue('DIR'), 'BACKWARD', 'help preserves the chosen direction');
    move.setFieldValue('FORWARD', 'DIR');
    move.getInputTargetBlock('DIST').setFieldValue(100, 'NUM');
    assert.equal(tutorial.inspect(ws, 2).complete, false);
    assert.equal(tutorial.addStep(Blockly, ws, 2).complete, false);
    assert.equal(Number(move.getInputTargetBlock('DIST').getFieldValue('NUM')), 100, 'help preserves the chosen distance');
    move.getInputTargetBlock('DIST').setFieldValue(50, 'NUM');
    tutorial.addStep(Blockly, ws, 3);
    ws.newBlock('drone_takeoff');
    assert.equal(tutorial.inspect(ws, 3).complete, false, 'stray commands must not execute unnoticed');
}));

test('help never replaces an existing instruction or silently supplies earlier steps', () => withWorkspace(ws => {
    assert.equal(tutorial.addStep(Blockly, ws, 2).complete, false);
    assert.equal(ws.getAllBlocks(false).length, 0);
    tutorial.addStep(Blockly, ws, 0);
    const land = ws.newBlock('drone_land');
    ws.getTopBlocks(false).find(block => block.type === 'event_start').nextConnection.connect(land.previousConnection);
    const before = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
    assert.equal(tutorial.addStep(Blockly, ws, 1).complete, false);
    assert.equal(Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws)), before);
}));

test('help preserves a student-authored distance expression', () => withWorkspace(ws => {
    for (let step = 0; step < 3; step++) tutorial.addStep(Blockly, ws, step);
    const move = tutorial.distanceBlock(ws);
    move.getInputTargetBlock('DIST').dispose();
    const expression = ws.newBlock('math_arithmetic');
    move.getInput('DIST').connection.connect(expression.outputConnection);
    const before = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
    assert.equal(tutorial.addStep(Blockly, ws, 2).complete, false);
    assert.equal(Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws)), before);
}));

function harness(ws) {
    const nodes = {};
    const get = id => nodes[id] ||= { hidden: false, style: {}, textContent: '', disabled: false, classList: { add() {}, remove() {} } };
    const source = fs.readFileSync('js/main.js', 'utf8');
    const context = vm.createContext({
        document: { getElementById: get }, workspace: ws, Blockly, FlightTutorial: tutorial,
        window: {}, state: { isRunning: false }, currentGameMode: 'freeplay',
        V2UI: { showEditor() {} }, scheduleGameUILayoutRefresh() {},
        resetSimulator() {}, setTimeout() {},
        setInterval: () => 1, clearInterval() {}, flushBlocklyAutosave() {},
        ensureBlocklyWorkspaceReady: () => ws
    });
    vm.runInContext(source.slice(source.indexOf('const tutorialSteps ='), source.indexOf('function updateDebugPosition()')), context);
    return { context, get, run: code => vm.runInContext(code, context) };
}

test('the six-step lesson requires explicit progression, a successful flight, and return to edit', () => withWorkspace(ws => {
    const { get, run, context } = harness(ws);
    run('startInteractiveTutorial(); nextTutorialStep()');
    assert.equal(get('tutorial-step-count').textContent, '1 / 6');
    for (let step = 0; step < 4; step++) {
        run('applyTutorialHelper(); checkTutorialProgress(); checkTutorialProgress()');
        assert.equal(get('tutorial-step-count').textContent, `${step + 1} / 6`);
        run('nextTutorialStep()');
    }
    assert.equal(get('tutorial-step-count').textContent, '5 / 6');
    run('nextTutorialStep()');
    assert.equal(get('tutorial-step-count').textContent, '5 / 6');
    context.window.__tutorialFlightCompleted = true;
    run('checkTutorialProgress(); nextTutorialStep()');
    assert.equal(get('tutorial-step-count').textContent, '6 / 6');
    run('nextTutorialStep()');
    assert.equal(get('tutorial-next-btn').hidden, false);
    context.window.__tutorialReturnedToEdit = true;
    run('checkTutorialProgress(); nextTutorialStep()');
    assert.equal(get('tutorial-title').textContent, '第一次飛行完成');
    assert.equal(get('tutorial-next-btn').hidden, true);
    const before = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
    run('stopInteractiveTutorial(); startInteractiveTutorial()');
    assert.equal(get('tutorial-step-count').textContent, '1 / 6');
    assert.equal(get('tutorial-next-btn').hidden, false);
    assert.equal(Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws)), before, 'leaving/replaying never clears student work');
}));

test('tutorial distance editing changes the actual Blockly command', () => withWorkspace(ws => {
    for (let step = 0; step < 4; step++) tutorial.addStep(Blockly, ws, step);
    const { run } = harness(ws);
    run('setTutorialDistance(100)');
    const context = { cmdQueue: [] };
    vm.runInNewContext(javascriptGenerator.workspaceToCode(ws), context);
    assert.equal(context.cmdQueue[1].param, 2);
}));

test('file-origin tutorial entry does not retry or open a coach', async () => {
    const source = fs.readFileSync('js/main.js', 'utf8');
    const c = vm.createContext({ window: { isDroneSimFileOrigin: () => true }, console: { warn() {} } });
    const start = source.indexOf('async function startFreePlay()');
    vm.runInContext(source.slice(start, source.indexOf('// 顯示基地營', start)), c);
    assert.equal(await c.startFreePlay(), false);
    withWorkspace(ws => {
        const { context, get, run } = harness(ws);
        context.currentGameMode = 'mission';
        context.window.isDroneSimFileOrigin = () => true;
        get('tutorial-coach').hidden = true;
        run('startInteractiveTutorial()');
        assert.equal(get('tutorial-coach').hidden, true);
    });
});

test('a failed scene load does not launch the tutorial', async () => {
    const ws = new Blockly.Workspace();
    try {
        const { context, get, run } = harness(ws);
        let attempts = 0;
        context.currentGameMode = 'mission';
        context.startFreePlay = async () => { attempts++; return false; };
        get('tutorial-coach').hidden = true;
        await run('startInteractiveTutorial()');
        assert.equal(attempts, 1);
        assert.equal(get('tutorial-coach').hidden, true);
    } finally { ws.dispose(); }
});

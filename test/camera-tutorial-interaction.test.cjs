const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('three');
const simulator = fs.readFileSync('js/simulator.js', 'utf8');
function touchHarness() {
    const handlers = {};
    const context = vm.createContext({
        camera: new THREE.PerspectiveCamera(45, 700 / 500, 1, 8000),
        renderer: { domElement: { getBoundingClientRect: () => ({left: 0, top: 0, width: 700, height: 500}), addEventListener(name, fn) { handlers[name] = fn; } } },
        isMouseDown: false, isRightMouseDown: false, mouseX: 0, mouseY: 0,
        followDrone: false, camTheta: 45, camPhi: 60, camRadius: 1000, camTarget: { x: 0, y: 0, z: 0 },
        THREE,
        updateCameraPosition() {}
    });
    vm.runInContext(simulator.slice(simulator.indexOf('function updateCameraPosition()'), simulator.indexOf('function animateLoop()')), context);
    context.updateCameraPosition();
    vm.runInContext(simulator.slice(simulator.indexOf('    // 觸控事件 (支援 iPad)'), simulator.indexOf("    window.addEventListener('keydown', (e) =>", simulator.indexOf('    // 觸控事件 (支援 iPad)'))), context);
    return { context, fire(name, points) { handlers[name]({ touches: points.map(([clientX, clientY], identifier) => ({ clientX, clientY, identifier })), preventDefault() {} }); } };
}
test('lifting one pinch finger must not rotate the camera on the remaining finger move', () => {
    const { context: c, fire } = touchHarness();
    fire('touchstart', [[100, 100], [300, 300]]);
    fire('touchmove', [[90, 90], [310, 310]]);
    fire('touchend', [[90, 90]]);
    fire('touchmove', [[91, 91]]);
    assert.ok(Math.abs(c.camTheta - 45) <= 0.5, `unexpected rotation: ${c.camTheta}`);
    assert.ok(Math.abs(c.camPhi - 60) <= 0.5, `unexpected tilt: ${c.camPhi}`);
});
test('cancelled gesture must not leave a stale pinch baseline', () => {
    const { context: c, fire } = touchHarness();
    fire('touchstart', [[100, 100], [300, 300]]);
    fire('touchcancel', []);
    fire('touchstart', [[500, 500]]);
    fire('touchmove', [[502, 500]]);
    assert.equal(c.camTheta, 44);
    assert.equal(c.camRadius, 1000);
});
function tutorialHarness() {
    const nodes = {};
    const get = id => nodes[id] ||= { hidden: false, style: {}, textContent: '', disabled: false };
    const source = fs.readFileSync('js/main.js', 'utf8');
    const c = vm.createContext({ document: { getElementById: get, querySelector: () => ({}) }, workspace: { getAllBlocks: () => ['drone_takeoff','drone_move_cm','drone_land'].map(type => ({ type })) }, window: {}, setInterval: () => 1, clearInterval() {}, setTimeout: fn => fn() });
    vm.runInContext(source.slice(source.indexOf('const tutorialSteps ='), source.indexOf('function updateDebugPosition()')), c);
    return { c, get, run: code => vm.runInContext(code, c) };
}
test('completed tutorial steps stay on the same page until manually advanced', () => {
    const { get, run } = tutorialHarness();
    run('startInteractiveTutorial(); checkTutorialProgress(); checkTutorialProgress();');
    assert.equal(get('tutorial-step-count').textContent, '1 / 5');
    run('nextTutorialStep()');
    assert.equal(get('tutorial-step-count').textContent, '2 / 5');
});

test('pinch zoom is proportional, bounded and does not rotate or tug the follow target', () => {
    const { context: c, fire } = touchHarness();
    c.followDrone = true;
    fire('touchstart', [[100, 100], [300, 100]]);
    fire('touchmove', [[100, 100], [400, 100]]);
    assert.ok(c.camRadius < 700 && c.camRadius > 500);
    assert.equal(c.camTheta, 45);
    assert.equal(c.camPhi, 60);
    assert.equal(c.camTarget.x, 0);
    assert.equal(c.camTarget.z, 0);
    fire('touchmove', [[100, 100], [100000, 100]]);
    assert.equal(c.camRadius, 60);
    fire('touchmove', [[100, 100], [100.01, 100]]);
    assert.equal(c.camRadius, 4000);
});
test('tutorial completion and restart both require explicit progression', () => {
    const { c, get, run } = tutorialHarness();
    run('startInteractiveTutorial(); nextTutorialStep(); nextTutorialStep(); nextTutorialStep(); nextTutorialStep();');
    assert.equal(get('tutorial-step-count').textContent, '5 / 5');
    assert.equal(get('tutorial-next-btn').disabled, true);
    run('nextTutorialStep()');
    assert.equal(get('tutorial-title').textContent, '執行小任務');
    c.window.__tutorialFlightCompleted = true;
    run('checkTutorialProgress(); checkTutorialProgress()');
    assert.equal(get('tutorial-title').textContent, '執行小任務');
    run('nextTutorialStep()');
    assert.equal(get('tutorial-title').textContent, '第一次飛行完成');
    assert.equal(get('tutorial-next-btn').hidden, true);
    run('stopInteractiveTutorial(); startInteractiveTutorial()');
    assert.equal(get('tutorial-step-count').textContent, '1 / 5');
    assert.equal(get('tutorial-next-btn').hidden, false);
});
test('wheel zoom responds more strongly and normalizes pixel/line input', () => {
    const start = simulator.indexOf('function onMouseWheel(');
    const end = simulator.indexOf('function onMouseMove(', start);
    const c = vm.createContext({ camRadius: 1000, renderer: { domElement: { clientHeight: 600 } }, updateCameraPosition() {} });
    vm.runInContext(simulator.slice(start, end), c);
    c.onMouseWheel({ deltaY: -100, deltaMode: 0, preventDefault() {} });
    assert.ok(c.camRadius < 800 && c.camRadius > 700);
    c.camRadius = 1000;
    c.onMouseWheel({ deltaY: -1, deltaMode: 1, preventDefault() {} });
    const lineRadius = c.camRadius;
    c.camRadius = 1000;
    c.onMouseWheel({ deltaY: -16, deltaMode: 0, preventDefault() {} });
    assert.equal(c.camRadius, lineRadius);
});

for (const radius of [250, 1000, 3200]) {
    test(`two-finger pan follows 40 px drag at camera radius ${radius}`, () => {
        const { context: c, fire } = touchHarness();
        c.camRadius = radius;
        c.camPhi = 35;
        const screen = () => {
            c.updateCameraPosition(); c.camera.updateMatrixWorld();
            const point = new THREE.Vector3(0, 0, 0).project(c.camera);
            return [350 * (point.x + 1), 250 * (1 - point.y)];
        };
        const before = screen();
        fire('touchstart', [[250, 250], [450, 250]]);
        fire('touchmove', [[290, 290], [490, 290]]);
        const after = screen();
        for (let i = 0; i < 2; i++) assert.ok(Math.abs(after[i] - before[i] - 40) < .01,
            `axis ${i}: moved ${after[i] - before[i]} px instead of 40`);
        assert.equal(c.camRadius, radius);
        assert.equal(c.camPhi, 35);
    });
}

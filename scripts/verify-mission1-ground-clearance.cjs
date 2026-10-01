const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../promo/node_modules/playwright');
const qa = require('./qa-output.cjs').createRun('verify-mission1-ground-clearance');
const report = { checks: [], poses: [], errors: [] };
const url = process.env.DRONE_URL || 'http://127.0.0.1:8080/';
const check = (name, value) => {
    assert.ok(value, name);
    report.checks.push(name);
    console.log('PASS', name);
};

async function rendered(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function clearance(page, name, altitude = 0) {
    // Settle the follow target before measuring the label; the camera normally
    // eases toward altitude changes over several frames.
    await followView(page);
    const pose = await page.evaluate(() => {
        droneGroup.updateWorldMatrix(true, true);
        const gear = new THREE.Box3().setFromObject(droneGroup.getObjectByName('landing_gear'));
        const gimbal = new THREE.Box3().setFromObject(droneGroup.getObjectByName('gimbal_system'));
        const pad = environmentGroup.getObjectByName('mission1-rescue-detail').children.find(node =>
            node.geometry?.type === 'PlaneGeometry' && node.geometry.parameters.width === 108 &&
            Math.abs(node.position.x - state.x) < 1e-4 && Math.abs(node.position.z - state.z) < 1e-4);
        const padTop = new THREE.Box3().setFromObject(pad).max.y;
        const canvas = renderer.domElement;
        const label = document.getElementById('v2-drone-label');
        const point = new THREE.Vector3(state.x, state.y + 23, state.z).project(camera);
        const transform = label.style.transform.match(/^translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        const labelAligned = !label.hidden && transform &&
            Math.abs(Number(transform[1]) - (point.x + 1) * canvas.clientWidth / 2) < 0.1 &&
            Math.abs(Number(transform[2]) - (1 - point.y) * canvas.clientHeight / 2) < 0.1;
        return { x: state.x, y: state.y, z: state.z, flying: state.isFlying,
            gearBottom: gear.min.y, gimbalBottom: gimbal.min.y, padTop, labelAligned,
            bottomSensor: getSensorReading('bottom', 'cm'), ground: getGroundHeight(state.x, state.z) };
    });
    report.poses.push({ name, ...pose });
    check(`${name}: landing gear clears the visible pad`, pose.gearBottom >= pose.padTop + altitude &&
        pose.gearBottom < pose.padTop + altitude + 0.1);
    check(`${name}: camera stays above the pad`, pose.gimbalBottom > pose.padTop + altitude);
    check(`${name}: label follows the rendered airframe`, pose.labelAligned);
    check(`${name}: simulated altitude and bottom sensor are unchanged`,
        Math.abs(pose.y - altitude) < 1e-4 && Math.abs(pose.bottomSensor - altitude) < 1e-4 && pose.ground === 0);
    return pose;
}

async function followView(page) {
    await page.evaluate(() => {
        closeResultModal(); hideAppMessage(); V2UI.setView('world'); V2UI.camera('follow');
        camRadius = 100; camTheta = 45; camPhi = 80; updateCameraPosition();
    });
    await rendered(page);
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        page.on('pageerror', error => report.errors.push(String(error)));
        await page.goto(url, { waitUntil: 'load' });
        await page.locator('#app-loading').waitFor({ state: 'hidden' });
        await page.evaluate(async () => { await startMission(1); closeBriefing(); });
        await followView(page);
        await page.screenshot({ path: qa.file('alpha-start.png') });
        const start = await clearance(page, 'initial Alpha');
        check('Alpha keeps the original start coordinates', start.x === -675 && start.z === -675 && !start.flying);
        await page.evaluate(() => resetSimulator());
        await clearance(page, 'reset Alpha');
        await page.evaluate(async () => {
            cmdQueue = [{ type: 'takeoff', param: 1 }];
            await executeQueue();
        });
        await clearance(page, 'takeoff Alpha', 80);
        await page.evaluate(async () => { cmdQueue = [{ type: 'land' }]; await executeQueue(); });
        await clearance(page, 'land Alpha');
        await page.evaluate(() => { state.y = 50; emergencyStop(); });
        await clearance(page, 'emergency stop Alpha');

        // Fly the learner's actual Blockly route so arrival/landing is checked
        // through the same flight and completion path as normal mission play.
        const route = fs.readFileSync(path.join(__dirname, '../test/fixtures/mission1-direct.xml'), 'utf8');
        await page.evaluate(xml => {
            resetSimulator(); ensureBlocklyWorkspaceReady(); applyBlocklyWorkspaceXmlText(xml);
            runBlocklyCode();
        }, route);
        await page.waitForFunction(() => !state.isRunning && state.missionCompleted, null, { timeout: 60000 });
        const bravo = await clearance(page, 'land Bravo');
        check('the real route completes at Bravo', Math.abs(bravo.x - 825) < 1e-4 && Math.abs(bravo.z - 675) < 1e-4 && !bravo.flying);
        await followView(page);
        await page.screenshot({ path: qa.file('bravo-land.png') });

        // Reusing the medical airframe must remove the mission's visual lift
        // in free practice, and must never accumulate it on repeated entry.
        for (let pass = 0; pass < 2; pass++) {
            await page.evaluate(async () => { closeResultModal(); await startFreePlay(); });
            await rendered(page);
            const free = await page.evaluate(() => {
                droneGroup.updateWorldMatrix(true, true);
                const bounds = new THREE.Box3().setFromObject(droneGroup.getObjectByName('landing_gear'));
                return { bottom: bounds.min.y, y: state.y };
            });
            check(`free practice ${pass + 1} restores the original ground alignment`, free.bottom >= free.y && free.bottom < free.y + 0.1);
            await page.evaluate(async () => { await startMission(1); closeBriefing(); });
            await clearance(page, `re-enter Alpha ${pass + 1}`);
        }
        check('no browser runtime errors', report.errors.length === 0);
        report.ok = true;
    } finally {
        fs.writeFileSync(qa.file('results.json'), JSON.stringify(report, null, 2));
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

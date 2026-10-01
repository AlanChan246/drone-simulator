const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('../promo/node_modules/playwright');
const qa = require('./qa-output.cjs').createRun('verify-factory-gripper');
const report = { checks: [], errors: [] };
const check = (name, value) => { assert.ok(value, name); report.checks.push(name); console.log('PASS', name); };

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        page.on('pageerror', error => report.errors.push(String(error)));
        await page.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
        await page.locator('#app-loading').waitFor({ state: 'hidden' });
        await page.evaluate(() => startMission(3));
        await page.locator('#briefing-ok-btn').click();
        await page.waitForFunction(() => !!workspace);
        await page.clock.install();
        check('no legacy magnetic gripper exists', await page.evaluate(() => {
            let count = 0;
            FactoryScene.live.group.traverse(node => { if (node.userData.asset === 'factory-kit/crane-magnet') count++; });
            window.__verifiedWorkpiece = FactoryScene.live.group.children.find(node => node.userData.asset === 'factory-kit/cog-a' && node.position.z === 750);
            return count === 0 && !!window.__verifiedWorkpiece;
        }));
        await page.evaluate(xml => {
            workspace.clear();
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), workspace);
            V2UI.setView('world');
        }, fs.readFileSync('test/fixtures/factory-reference.xml', 'utf8'));
        await page.locator('#run-blockly-btn').click({ force: true });
        let carrying = false;
        for (let time = 0; time < 100000; time += 500) {
            await page.clock.fastForward(500);
            if (await page.evaluate(() => !!FactoryMission.data.cargo)) { carrying = true; break; }
        }
        check('real flight program picks up a factory part', carrying);
        const attachment = await page.evaluate(() => {
            const tip = getDroneCargoAttachmentPoint(state);
            const box = new THREE.Box3().setFromObject(window.__verifiedWorkpiece);
            const top = box.getCenter(new THREE.Vector3()); top.y = box.max.y;
            return { error: top.distanceTo(tip), tip: tip.toArray(), top: top.toArray() };
        });
        report.attachment = attachment;
        check('carried part touches the new gripper tips', attachment.error < 1e-4);
        await page.evaluate(() => {
            toggleExecutionPause(true);
            V2UI.setView('world'); followDrone = true;
            camRadius = 150; camTheta = 110; camPhi = 65;
            camTarget.x = state.x; camTarget.y = state.y + 12; camTarget.z = state.z;
            updateCameraPosition();
        });
        await page.screenshot({ path: qa.file('carrying.png') });
        await page.evaluate(() => toggleExecutionPause(false));
        for (let time = 0; time < 650000; time += 500) {
            await page.clock.fastForward(500);
            if (await page.evaluate(() => !state.isRunning)) break;
        }
        report.result = await page.evaluate(() => ({ complete: state.missionCompleted, score: currentScore,
            delivered: FactoryMission.data.delivered.length, cargo: FactoryMission.data.cargo, flying: state.isFlying }));
        check('factory reference still delivers all six parts and lands for 800 points',
            report.result.complete && report.result.score === 800 && report.result.delivered === 6 && !report.result.flying && report.result.cargo === null);
        await page.evaluate(() => { closeResultModal(); resetSimulator(); });
        await page.clock.fastForward(500);
        check('reset clears the carried part without recreating the old tool', await page.evaluate(() => {
            let oldTool = false;
            FactoryScene.live.group.traverse(node => { if (node.userData.asset === 'factory-kit/crane-magnet') oldTool = true; });
            return !oldTool && FactoryMission.data.cargo === null && window.__verifiedWorkpiece.position.z === 750;
        }));
        check('no browser runtime errors', report.errors.length === 0);
        report.ok = true;
    } finally {
        fs.writeFileSync(qa.file('results.json'), JSON.stringify(report, null, 2));
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

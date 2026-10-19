// Real rendered Blockly, flight engine, file controls and browser storage.
// Run against a local server, or FIRST_FLIGHT_URL for a deployed smoke test.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('../promo/node_modules/playwright');
const qa = require('./qa-output.cjs').createRun('verify-first-flight-browser');
const report = { checks: [], errors: [], environment: { physicalDevices: false } };
const check = (name, actual, expected = true) => {
    assert.deepEqual(actual, expected, name);
    report.checks.push(name);
    console.log('PASS', name);
};
let browser, page;
async function xml() {
    return page.evaluate(() => Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)));
}
async function importFile(text, confirm = true) {
    await page.locator('#blockly-import-input').setInputFiles({ name: 'regression.xml', mimeType: 'text/xml', buffer: Buffer.from(text) });
    await page.locator(confirm ? '#app-confirm-ok' : '#app-confirm-cancel').click();
    await page.locator('#app-confirm-modal').waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);
}
async function fly() {
    await page.locator('#run-blockly-btn').click();
    await page.waitForFunction(() => state.isRunning);
    await page.waitForFunction(() => !state.isRunning, null, { timeout: 30000 });
    return page.evaluate(() => ({ x: state.x, y: state.y, z: state.z, flying: state.isFlying, collision: state.collisionDetected }));
}
async function mission(n) {
    await page.evaluate(n => startMission(n), n);
    await page.locator('#briefing-ok-btn').click();
    await page.waitForFunction(() => workspace && !document.getElementById('game-interface').inert);
}
(async () => {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
        page = await context.newPage();
        page.on('pageerror', e => report.errors.push(String(e)));
        page.on('response', r => { if (r.status() >= 400) report.errors.push(r.status() + ' ' + r.url()); });
        const url = process.env.FIRST_FLIGHT_URL || 'http://127.0.0.1:8080/';
        await page.goto(url, { waitUntil: 'load' });
        await page.locator('#app-loading').waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: '從第一次飛行開始', exact: true }).click();
        await page.locator('#tutorial-coach').waitFor({ state: 'visible' });
        check('empty first-flight workspace', await page.evaluate(() => workspace.getAllBlocks(false).length), 0);
        for (let i = 0; i < 4; i++) {
            check('explicit lesson step ' + (i + 1), await page.locator('#tutorial-step-count').innerText(), `${i + 1} / 6`);
            check('cannot skip missing block ' + (i + 1), await page.locator('#tutorial-next-btn').isDisabled());
            await page.locator('#tutorial-add-btn').click();
            await page.waitForFunction(() => !document.getElementById('tutorial-next-btn').disabled);
            check('helper adds one statement only ' + (i + 1), await page.evaluate(() => workspace.getAllBlocks(false).filter(b => !b.outputConnection).length), i + 1);
            await page.locator('#tutorial-next-btn').click();
        }
        check('execution step is gated by actual flight', await page.locator('#tutorial-next-btn').isDisabled());
        const firstProgram = await xml();
        await page.getByRole('button', { name: '離開教學', exact: true }).click();
        await page.getByRole('button', { name: '繼續教學', exact: true }).click();
        check('resume keeps the same step', await page.locator('#tutorial-step-count').innerText(), '5 / 6');
        check('resume preserves all program XML', await xml(), firstProgram);
        await page.locator('.v2-view-switch [data-view="code"]').click();
        const fifty = await fly();
        check('run preserves selected coding view', await page.locator('#game-interface').getAttribute('data-view'), 'code');
        check('real first flight safely landed', !fifty.flying && !fifty.collision);
        check('first flight qualifies lesson', await page.evaluate(() => window.__tutorialFlightCompleted));
        await page.locator('#tutorial-next-btn').click();
        check('return step cannot be skipped', await page.locator('#tutorial-next-btn').isDisabled());
        await page.locator('#v2-code-feedback .v2-return-edit').click();
        check('return keeps all Blockly XML', await xml(), firstProgram);
        check('return resets actual aircraft for comparison', await page.evaluate(() => [state.x, state.z]), [0, 0]);
        await page.locator('#tutorial-next-btn').click();
        check('all six tutorial steps complete', await page.locator('#tutorial-title').innerText(), '第一次飛行完成');
        await page.locator('#tutorial-distance-btn').click();
        check('distance action updates real block', await page.evaluate(() => Number(FlightTutorial.distanceBlock(workspace).getInputTargetBlock('DIST').getFieldValue('NUM'))), 100);
        const hundred = await fly();
        check('100 cm really flies twice the distance', Math.abs(Math.hypot(hundred.x, hundred.z) - 2 * Math.hypot(fifty.x, fifty.z)) < 1);
        const savedFree = await xml();
        await page.getByRole('button', { name: '離開教學', exact: true }).click();
        // Download the actual browser-generated XML, then exercise cancel and failure transactions.
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: '匯出積木程式', exact: true }).click();
        const download = await downloadPromise;
        const downloaded = fs.readFileSync(await download.path(), 'utf8');
        check('export downloads current program verbatim', downloaded, savedFree);
        check('context-specific export filename', download.suggestedFilename(), 'drone-blockly-freeplay.xml');
        const oldXml = fs.readFileSync('test/fixtures/mission1-inspections.xml', 'utf8');
        await importFile(oldXml, false);
        check('cancelled import preserves current program', await xml(), savedFree);
        await importFile('<xml><block type="does_not_exist"/></xml>');
        check('invalid import reports failure', await page.locator('#app-message-banner').innerText().then(t => t.includes('匯入失敗')));
        check('invalid import preserves current program', await xml(), savedFree);
        await importFile(oldXml);
        check('existing legacy XML remains importable', await page.locator('#app-message-banner').innerText().then(t => t.includes('匯入成功')));
        await importFile(downloaded);
        check('export/import round trip preserves current program', await xml(), savedFree);
        const contexts = new Map([['freeplay', savedFree]]);
        for (const n of [1, 2, 3]) {
            await mission(n);
            const text = fs.readFileSync(n === 1 ? 'test/fixtures/mission1-inspections.xml' : n === 2 ? 'test/fixtures/mission2-v2-four-fires.xml' : 'test/fixtures/factory-reference.xml', 'utf8');
            await importFile(text);
            const key = await page.evaluate(() => getBlocklyAutosaveKey());
            const current = await xml();
            contexts.set(key, current);
            check(key + ' saves independently', await page.evaluate(() => localStorage.getItem(getBlocklyAutosaveStorageKey())), current);
        }
        await page.reload({ waitUntil: 'load' });
        await page.locator('#app-loading').waitFor({ state: 'hidden' });
        for (const n of [3, 2, 1]) {
            await mission(n);
            const key = await page.evaluate(() => getBlocklyAutosaveKey());
            check(key + ' restores after full reload', await xml(), contexts.get(key));
        }
        await page.evaluate(() => startFreePlay());
        check('freeplay restores after missions and full reload', await xml(), savedFree);
        // Saved flight view must initialize Blockly before running without visiting code first.
        await page.locator('.v2-view-switch [data-view="world"]').click();
        await page.reload({ waitUntil: 'load' });
        await page.locator('#app-loading').waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: '自由練習', exact: true }).click();
        await page.waitForFunction(() => workspace && workspace.getAllBlocks(false).length > 0);
        check('chosen world view survives reload', await page.locator('#game-interface').getAttribute('data-view'), 'world');
        check('world-view entry restores program', await xml(), savedFree);
        const restoredFlight = await fly();
        check('restored program can run directly in world view', !restoredFlight.flying && !restoredFlight.collision);
        await page.locator('#canvas-container .v2-return-edit').click();
        await page.screenshot({ path: qa.file('first-flight-restored.png') });
        report.environment.browser = browser.version();
        report.environment.url = url;
        check('no browser or resource errors', report.errors, []);
        report.ok = true;
    } finally {
        fs.writeFileSync(qa.file('browser-results.json'), JSON.stringify(report, null, 2));
        await browser?.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

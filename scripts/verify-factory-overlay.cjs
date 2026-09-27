const qa = require('./qa-output.cjs').createRun('verify-factory-overlay');
const { chromium } = require('../promo/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.goto('http://127.0.0.1:8080/');
        await page.locator('#app-loading').waitFor({ state: 'hidden' });
        await page.evaluate(() => startMission(3));
        await page.locator('#briefing-ok-btn').click();
        for (const [width, height] of [[1440,900], [1280,800], [1024,768]]) {
            await page.setViewportSize({ width, height });
            for (const view of ['split','world']) {
                await page.evaluate(v => V2UI.setView(v), view);
                await page.locator('#factory-new-order').click();
                const card = await page.locator('.v2-action').boundingBox();
                const tools = await page.locator('.v2-camera-tools').boundingBox();
                const gap = tools.y - card.y - card.height;
                console.log(`${width} ${view}: gap ${gap}px`);
                assert.ok(gap >= 12, 'wrapped status must leave at least 12px before camera controls');
                await page.locator('.v2-camera-tools button').first().click();
                assert.equal(await page.evaluate(() => followDrone), true);
            }
        }
        await page.evaluate(() => { V2UI.setView('split'); V2UI.camera('map'); });
        await page.waitForTimeout(300);
        await page.screenshot({ path: qa.file('order-overlay-after.png') });
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

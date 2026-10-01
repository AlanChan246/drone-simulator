const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('../promo/node_modules/playwright');
const qa = require('./qa-output.cjs').createRun('verify-mission-airframes');
const report = { checks: [], missions: [], errors: [] };
const url = process.env.DRONE_URL || 'http://127.0.0.1:8080/';
const check = (name, value) => { assert.ok(value, name); report.checks.push(name); console.log('PASS', name); };

async function ready(page) {
    await page.goto(url, { waitUntil: 'load' });
    await page.locator('#app-loading').waitFor({ state: 'hidden' });
}
async function mission(page, id) {
    await page.evaluate(id => { closeResultModal(); closeBriefing(); return startMission(id); }, id);
    await page.locator('#briefing-ok-btn').click();
    await page.evaluate(() => { V2UI.setView('world'); V2UI.camera('follow'); });
    await page.waitForTimeout(150);
}
async function airframe(page) {
    return page.evaluate(() => {
        const frame = droneGroup.children[0];
        frame.updateWorldMatrix(true, true);
        const inverse = droneGroup.matrixWorld.clone().invert(), bounds = new THREE.Box3();
        frame.traverse(node => {
            if (!node.geometry) return;
            if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
            bounds.union(node.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld)));
        });
        const size = bounds.getSize(new THREE.Vector3());
        const textureImages = [];
        frame.traverse(node => {
            if (!node.material) return;
            for (const material of [].concat(node.material)) if (material.map) {
                textureImages.push([material.map.image?.width, material.map.image?.height]);
            }
        });
        return { key: droneGroup.userData.airframeKey, group: droneGroup.uuid, frame: frame.uuid,
            children: droneGroup.children.length, rotors: propellers.map(propeller => propeller.name),
            size: size.toArray(), bottom: bounds.min.y, rotation: frame.rotation.y, textureImages,
            led: droneLedMesh.material.name, follow: followDrone, radius: camRadius };
    });
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        page.on('pageerror', error => report.errors.push(String(error)));
        await ready(page);
        let group;
        for (const [id, key] of [[1, 'medical'], [2, 'wildfireDrone'], [3, 'industrialDrone']]) {
            await mission(page, id);
            const before = await airframe(page);
            group ||= before.group;
            report.missions.push({ id, ...before });
            check(`mission ${id} uses ${key}`, before.key === key);
            check(`mission ${id} keeps the flight group and four rotors`, before.group === group && before.children === 4 && before.rotors.length === 4);
            check(`mission ${id} preserves follow view`, before.follow && before.radius === (id === 3 ? 420 : 220));
            if (id > 1) {
                check(`mission ${id} has the normalized size, ground and heading`,
                    Math.abs(Math.max(before.size[0], before.size[2]) - 49.15) < 1e-4 && Math.abs(before.bottom - 0.02) < 1e-4 && before.rotation === Math.PI);
                check(`mission ${id} binds the inspection lamp`, before.led === 'Inspection_Light');
            }
            if (id === 2) check('wildfire embedded textures decode', before.textureImages.length > 0 && before.textureImages.every(([w, h]) => w > 0 && h > 0));
            await page.evaluate(async () => {
                cmdQueue = [{ type: 'takeoff', param: 1 }];
                await executeQueue();
                hideAppMessage();
            });
            const motion = await page.evaluate(async () => {
                const fixed = [];
                droneGroup.traverse(node => { if (/^(Rotor_|Motor_|Guard_|Arm_|Gripper)/.test(node.name)) fixed.push([node, node.quaternion.clone()]); });
                const angles = propellers.map(propeller => propeller.rotation.y);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                return { spinning: propellers.every((propeller, index) => propeller.rotation.y !== angles[index]),
                    fixed: fixed.every(([node, rotation]) => node.quaternion.equals(rotation)) };
            });
            check(`mission ${id} spins propellers with fixed housings`, motion.spinning && motion.fixed);
            await page.evaluate(id => {
                camRadius = 120; camPhi = 60; camTheta = id === 3 ? 205 : 25;
                updateCameraPosition();
            }, id);
            await page.screenshot({ path: qa.file(`mission-${id}.png`) });
            await page.evaluate(() => dispatchCommand({ type: 'led_hex_bright', color: '#00ff00', brightness: 128 }));
            const led = await page.evaluate(() => ({ color: droneLedMesh.material.color.getHex(), opacity: droneLedMesh.material.opacity, light: droneLedLight.intensity }));
            check(`mission ${id} responds to LED color/brightness`, led.color === 0x00ff00 && Math.abs(led.opacity - 128 / 255) < 1e-6 && led.light > 0);
            await page.evaluate(() => dispatchCommand({ type: 'led_off' }));
            check(`mission ${id} switches LED off`, await page.evaluate(() => droneLedLight.intensity === 0 && droneLedMesh.material.opacity === 0.1));
            await page.evaluate(() => dispatchCommand({ type: 'land' }));
            check(`mission ${id} lands with the active airframe`, await page.evaluate(() => !state.isFlying));
            await page.evaluate(() => resetSimulator());
            const after = await airframe(page);
            check(`mission ${id} reset reuses the airframe`, after.frame === before.frame && after.group === group && after.children === 4);
        }
        for (const id of [2, 3, 1, 3, 2]) {
            await mission(page, id);
            const frame = await airframe(page);
            check(`repeat switch ${id} has one airframe`, frame.group === group && frame.children === 4 && frame.rotors.length === 4);
        }
        await page.evaluate(() => startFreePlay());
        check('free practice restores the medical airframe', (await airframe(page)).key === 'medical');

        // Exercise the production worker in an isolated profile; localhost skips
        // automatic registration during normal development.
        await page.evaluate(async () => {
            await navigator.serviceWorker.register('./sw.js');
            await navigator.serviceWorker.ready;
        });
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
        const cached = await page.evaluate(async () => {
            const cache = await caches.open('drone-simulator-factory-gripper-20261001b');
            return Promise.all(['assets/models/wildfire-response-drone.glb', 'assets/models/industrial-intervention-drone.glb'].map(async path => {
                const response = await cache.match(path); return response?.ok;
            }));
        });
        check('both mission airframes are cached', cached.every(Boolean));
        await context.setOffline(true);
        await page.reload({ waitUntil: 'load' });
        await page.locator('#app-loading').waitFor({ state: 'hidden' });
        for (const [id, key] of [[2, 'wildfireDrone'], [3, 'industrialDrone']]) {
            await mission(page, id);
            check(`offline mission ${id} loads its actual airframe`, (await airframe(page)).key === key);
        }

        const fallbackContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const fallback = await fallbackContext.newPage();
        fallback.on('pageerror', error => report.errors.push(String(error)));
        for (const file of ['wildfire-response-drone.glb', 'industrial-intervention-drone.glb']) {
            await fallback.route('**/' + file, route => route.abort('failed'));
        }
        await ready(fallback);
        for (const id of [2, 3]) {
            await mission(fallback, id);
            const frame = await airframe(fallback);
            check(`missing mission ${id} GLB falls back safely`, frame.key === 'medical' && frame.children === 4 && frame.rotors.length === 4);
        }
        check('no browser runtime errors', report.errors.length === 0);
        report.ok = true;
    } finally {
        fs.writeFileSync(qa.file('results.json'), JSON.stringify(report, null, 2));
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });

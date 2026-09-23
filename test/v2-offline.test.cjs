const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const root = path.join(__dirname, '..');

function worker({ networkFails = false } = {}) {
    const handlers = {};
    const entries = new Map();
    const requested = [];
    const resolve = value => new URL(typeof value === 'string' ? value : value.url, 'https://school.test/drone-simulator/').href;
    const cache = {
        addAll: async files => { for (const file of files) entries.set(resolve(file), { body: file, ok: true }); },
        match: async (request, options = {}) => {
            const target = resolve(request);
            for (const [key, value] of entries) {
                if (key === target || options.ignoreSearch && key.split('?')[0] === target.split('?')[0]) return value;
            }
        },
        put: async (request, response) => entries.set(resolve(request), response)
    };
    const caches = { open: async () => cache, keys: async () => [], delete: async () => true };
    vm.runInNewContext(source, {
        URL, Response, caches,
        self: { location: { origin: 'https://school.test' }, addEventListener: (kind, handler) => handlers[kind] = handler, skipWaiting() {}, clients: { claim() {} } },
        fetch: async request => { requested.push(request.url); if (networkFails) throw new Error('offline'); return new Response('fresh'); }
    });
    return {
        requested,
        install: () => { let promise; handlers.install({ waitUntil: value => promise = value }); return promise; },
        fetch: (url, mode = 'cors') => { let promise; handlers.fetch({ request: { url, method: 'GET', mode }, respondWith: value => promise = value }); return promise; }
    };
}

test('offline installation covers local app dependencies under a Pages subpath', async () => {
    const shell = JSON.parse(source.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]);
    for (const file of shell) assert.ok(fs.existsSync(path.join(root, file)), `missing cached asset: ${file}`);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="((?:js\/|assets\/styles\/|node_modules\/)[^"]+)"/g)) {
        assert.ok(shell.includes(match[1].split('?')[0]), `missing page dependency: ${match[1]}`);
    }
    const instance = worker({ networkFails: true });
    await instance.install();
    const code = await instance.fetch('https://school.test/drone-simulator/js/simulator.js?v=v2');
    assert.equal(code.body, 'js/simulator.js');
});

test('offline navigation can recover but a missing model never receives HTML', async () => {
    const instance = worker({ networkFails: true });
    await instance.install();
    assert.equal((await instance.fetch('https://school.test/drone-simulator/missing', 'navigate')).body, 'index.html');
    const missingModel = await instance.fetch('https://school.test/drone-simulator/missing.glb');
    assert.equal(missingModel.type, 'error');
});

test('an online refresh retrieves current code instead of keeping stale cached code', async () => {
    const instance = worker();
    await instance.install();
    const response = await instance.fetch('https://school.test/drone-simulator/js/main.js');
    assert.equal(await response.text(), 'fresh');
    assert.equal(instance.requested.length, 1);
});

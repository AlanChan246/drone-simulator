const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/theme.js'), 'utf8');
function setup({ saved = null, dark = false, blocked = false } = {}) {
    const root = { dataset: {}, style: {} }, events = {}, controls = [{}, {}, {}];
    const media = { matches: dark, addEventListener: (name, cb) => events.system = cb };
    const storage = new Map([['drone-simulator-theme', saved]]);
    const window = { matchMedia: () => media, addEventListener: (name, cb) => events[name] = cb };
    const document = { documentElement: root, querySelectorAll: () => controls, addEventListener: (name, cb) => events[name] = cb };
    controls.forEach(c => { c.addEventListener = (name, cb) => c.click = cb; c.setAttribute = (name, value) => c[name] = value; });
    vm.runInNewContext(source, { window, document,
        localStorage: { getItem: key => { if (blocked) throw Error(); return storage.get(key); }, setItem: (key, value) => { if (blocked) throw Error(); storage.set(key, value); } },
        getComputedStyle: () => ({ getPropertyValue: () => root.dataset.theme }),
        Blockly: { Themes: { Classic: {} }, Theme: { defineTheme: (name, config) => ({ name, ...config }) } }
    });
    events.DOMContentLoaded();
    return { root, controls, media, events, storage, api: window.DroneTheme };
}
test('first paint follows system; all controls sync; saved preference overrides system on reload', () => {
    const s = setup({ dark: true });
    assert.equal(s.root.dataset.theme, 'dark');
    assert.equal(s.root.style.colorScheme, 'dark');
    assert.ok(s.controls.every(c => c['aria-label'] === (s.root.dataset.theme === 'dark' ? '切換至淺色模式' : '切換至深色模式')));
    s.controls[0].click();
    assert.ok(s.controls.every(c => c['aria-label'] === '切換至深色模式'));
    const reload = setup({ saved: s.storage.get('drone-simulator-theme'), dark: true });
    assert.equal(reload.root.dataset.theme, 'light');
    reload.controls[0].click();
    assert.equal(reload.root.dataset.theme, 'dark');
});
test('only system mode follows live system changes; invalid storage defaults to system', () => {
    const s = setup({ saved: 'invalid' });
    s.media.matches = true; s.events.system();
    assert.equal(s.root.dataset.theme, 'dark');
    s.api.setPreference('light'); s.events.system();
    assert.equal(s.root.dataset.theme, 'light');
    s.api.setPreference('system');
    assert.equal(s.root.dataset.theme, 'dark');
});
test('blocked storage still supports session switching', () => {
    const s = setup({ blocked: true });
    s.api.setPreference('dark');
    assert.equal(s.root.dataset.theme, 'dark');
    assert.ok(s.controls.every(c => c['aria-label'] === '切換至淺色模式'));
});
test('switching updates attached workspace theme without replacement or other mutations', () => {
    const s = setup(); let theme;
    const workspace = Object.freeze({ setTheme: value => theme = value });
    s.api.attachWorkspace(workspace);
    assert.equal(theme.name, 'rescue_light');
    s.api.setPreference('dark');
    assert.equal(theme.name, 'rescue_dark');
    assert.equal(theme.componentStyles.workspaceBackgroundColour, 'dark');
});
test('cross-tab changes and removal synchronize selectors and theme', () => {
    const s = setup();
    s.events.storage({ key: 'drone-simulator-theme', newValue: 'dark' });
    assert.equal(s.root.dataset.theme, 'dark');
    s.events.storage({ key: 'drone-simulator-theme', newValue: null });
    assert.equal(s.root.dataset.theme, 'light');
    assert.ok(s.controls.every(c => c['aria-label'] === (s.root.dataset.theme === 'dark' ? '切換至淺色模式' : '切換至深色模式')));
});

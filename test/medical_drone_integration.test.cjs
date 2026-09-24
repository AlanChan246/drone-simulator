const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const modelSource = fs.readFileSync(path.join(projectRoot, 'js/medical_drone_model.js'), 'utf8');
const simulatorSource = fs.readFileSync(path.join(projectRoot, 'js/simulator.js'), 'utf8');

test('medical rescue drone keeps its identity-defining detailed parts', () => {
    [
        'recessed_medical_cross',
        'hex_bolt_',
        'propeller_',
        'battery_cell_',
        'vent_slot_',
        'gimbal_yaw',
        'gimbal_pitch',
        'battery_socket'
    ].forEach(partName => {
        assert.match(modelSource, new RegExp(partName), `missing model detail: ${partName}`);
    });
    assert.doesNotMatch(modelSource, /new THREE\.BoxGeometry\(4\.05/, 'rotors must keep their shaped blade profile');
});

test('simulator enables the high-definition PBR rendering path', () => {
    assert.match(simulatorSource, /renderer\.setPixelRatio\(Math\.min\(window\.devicePixelRatio \|\| 1, 2\)\)/);
    assert.match(simulatorSource, /renderer\.shadowMap\.type = THREE\.PCFSoftShadowMap/);
    assert.match(simulatorSource, /renderer\.toneMapping = THREE\.ACESFilmicToneMapping/);
    assert.match(simulatorSource, /renderer\.outputEncoding = THREE\.sRGBEncoding/);
    assert.match(simulatorSource, /medical_drone_detail_light/);
});

test('medical drone lighting preserves surface detail without clipping whites', () => {
    assert.match(modelSource, /white: new THREE\.MeshStandardMaterial\(\{ color: 0xd8dcdd/);
    assert.match(simulatorSource, /renderer\.toneMappingExposure = 0\.96/);
    assert.match(simulatorSource, /new THREE\.DirectionalLight\(0xffffff, 0\.32\)/);
});

test('follow view is close while free view retains the map overview', () => {
    assert.match(simulatorSource, /const FOLLOW_CAMERA_RADIUS = 100/);
    assert.match(simulatorSource, /const FREE_CAMERA_RADIUS = 800/);
    assert.match(simulatorSource, /let camTheta = 45; let camPhi = 70/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const THREE = require('three');
const catalog = require('../js/asset_catalog.js');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('js/simulator.js');
const declarations = acorn.parse(source, { ecmaVersion: 'latest' }).body;
const code = name => {
    const node = declarations.find(node => node.id?.name === name);
    assert.ok(node, name);
    return source.slice(node.start, node.end);
};
let templates;

test.before(async () => {
    // Parse the real GLBs using the shipped loader. Only image pixel decoding is
    // stubbed in Node; the browser verifier checks the actual embedded images.
    const runtime = { ...THREE, TextureLoader: class extends THREE.TextureLoader {
        load(url, onLoad) {
            const texture = new THREE.Texture();
            queueMicrotask(() => onLoad(texture));
            return texture;
        }
    } };
    const loaderContext = vm.createContext({ THREE: runtime, TextDecoder, Blob, self: { URL }, console });
    vm.runInContext(read('node_modules/three/examples/js/loaders/GLTFLoader.js'), loaderContext);
    templates = {};
    for (const key of ['wildfireDrone', 'industrialDrone']) {
        const entry = catalog.preload.find(entry => entry.key === key);
        const buffer = fs.readFileSync(path.join(root, entry.path));
        const gltf = await new Promise((resolve, reject) => new runtime.GLTFLoader().parse(
            buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '', resolve, reject));
        templates[key] = gltf.scene;
    }
});

function harness() {
    const window = { THREE };
    const context = vm.createContext({ THREE, window, scene: new THREE.Scene(), droneGroup: null,
        assets: { ...templates }, propellers: [], droneLedMesh: null, droneLedLight: null,
        state: { isFlying: false }, console: { log() {}, warn() {} } });
    vm.runInContext(read('node_modules/three/examples/js/geometries/RoundedBoxGeometry.js'), context);
    vm.runInContext(read('js/medical_drone_model.js'), context);
    for (const name of ['clearDroneAirframe', 'addDroneDetailLight', 'createMissionDroneAirframe',
        'getDroneCargoAttachmentPoint', 'setDroneAirframeForScene', 'animateDronePropellers', 'createDroneModel']) {
        vm.runInContext(code(name), context);
    }
    context.createDroneModel();
    return context;
}
function resources(group) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(node => {
        if (node.geometry) geometries.add(node.geometry);
        if (node.material) for (const material of [].concat(node.material)) {
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
    });
    return { geometries, materials, textures };
}
function snapshot(group) {
    const nodes = [];
    group.traverse(node => nodes.push({ name: node.name, position: node.position.toArray(),
        rotation: node.rotation.toArray(), scale: node.scale.toArray(), userData: JSON.stringify(node.userData),
        geometry: node.geometry?.uuid, materials: node.material && [].concat(node.material).map(material => ({
            uuid: material.uuid, color: material.color?.toArray(), emissive: material.emissive?.toArray(),
            roughness: material.roughness, metalness: material.metalness,
            transparent: material.transparent, opacity: material.opacity, map: material.map?.uuid
        })) }));
    return nodes;
}
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-5, message || `${actual} != ${expected}`);

test('mission GLBs preload with their authored materials and are included offline', () => {
    for (const key of ['wildfireDrone', 'industrialDrone']) {
        const entry = catalog.preload.find(entry => entry.key === key);
        assert.equal(entry.preserveMaterial, true);
        assert.equal(entry.required, false);
        assert.ok(catalog.offline.includes(entry.path));
    }
});

test('real GLBs normalize to the current display size, ground and forward direction', () => {
    const c = harness();
    for (const template of Object.values(templates)) {
        const airframe = c.createMissionDroneAirframe(template);
        const bounds = new THREE.Box3().setFromObject(airframe.root);
        const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
        close(Math.max(size.x, size.z), 49.15);
        close(bounds.min.y, 0.02); close(center.x, 0); close(center.z, 0);
        const original = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
        close(size.x / size.z, original.x / original.z);
        close(size.y / size.x, original.y / original.x);
        const forward = new THREE.Vector3(0, 0, 1).transformDirection(airframe.root.matrixWorld);
        close(forward.x, 0); close(forward.z, -1);
        assert.equal(airframe.rotors.length, 4);
        assert.equal(airframe.ledMesh.material.name, 'Inspection_Light');
        assert.ok(airframe.ledPosition.distanceTo(new THREE.Box3().setFromObject(airframe.ledMesh).getCenter(new THREE.Vector3())) < 1e-5);
        // Clean the standalone instance with the same production disposal path.
        c.clearDroneAirframe(); c.droneGroup.add(airframe.root); c.clearDroneAirframe();
    }
});

test('scene switches preserve the flight group and pose without accumulating airframes', () => {
    const c = harness(), group = c.droneGroup;
    group.position.set(100, 80, -200); group.rotation.y = 0.7;
    for (let pass = 0; pass < 3; pass++) for (const [type, expected] of [
        ['city', 'wildfireDrone'], ['factory', 'industrialDrone'], ['tunnel', 'medical'], ['free', 'medical']
    ]) {
        c.setDroneAirframeForScene(type);
        assert.equal(c.droneGroup, group);
        assert.deepEqual(group.position.toArray(), [100, 80, -200]); close(group.rotation.y, 0.7);
        assert.equal(group.userData.airframeKey, expected);
        assert.equal(group.children.length, 4); assert.equal(c.propellers.length, 4);
        assert.ok(c.propellers.every(propeller => group.getObjectById(propeller.id) === propeller));
        const instance = group.children[0];
        c.setDroneAirframeForScene(type);
        assert.equal(group.children[0], instance, 'same airframe is reused on scene reset');
    }
    c.clearDroneAirframe();
});

test('only the four propellers spin in flight; motors, guards and arm joints remain fixed', () => {
    const c = harness();
    for (const type of ['city', 'factory']) {
        c.setDroneAirframeForScene(type);
        const fixed = [];
        c.droneGroup.traverse(node => { if (!c.propellers.includes(node)) fixed.push([node, node.rotation.toArray()]); });
        const angles = Array.from(c.propellers, propeller => propeller.rotation.y);
        c.animateDronePropellers();
        assert.deepEqual(Array.from(c.propellers, propeller => propeller.rotation.y), angles);
        const positions = Array.from(c.propellers, propeller => propeller.getWorldPosition(new THREE.Vector3()));
        c.state.isFlying = true; c.animateDronePropellers(); c.state.isFlying = false;
        const directions = [1, -1, -1, 1];
        c.propellers.forEach((propeller, index) => {
            close(propeller.rotation.y - angles[index], directions[index] * 0.8);
            close(propeller.getWorldPosition(new THREE.Vector3()).distanceTo(positions[index]), 0);
        });
        for (const [node, rotation] of fixed) assert.deepEqual(node.rotation.toArray(), rotation, node.name);
    }
    c.clearDroneAirframe();
});

test('airframe disposal releases instance geometry, materials and shadows but preserves templates', () => {
    const c = harness(), originals = Object.values(templates).map(snapshot);
    const cachedDisposals = [];
    for (const template of Object.values(templates)) for (const set of Object.values(resources(template))) {
        for (const resource of set) resource.addEventListener('dispose', () => cachedDisposals.push(resource.uuid));
    }
    for (const type of ['city', 'factory', 'tunnel']) {
        const owned = resources(c.droneGroup), counts = new Map();
        for (const resource of [...owned.geometries, ...owned.materials]) {
            counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
        }
        const shadow = c.droneGroup.getObjectByName('medical_drone_detail_light').shadow;
        shadow.map = new THREE.WebGLRenderTarget(1, 1);
        let shadowDisposals = 0; shadow.map.addEventListener('dispose', () => shadowDisposals++);
        const previous = c.droneGroup.children[0];
        c.setDroneAirframeForScene(type);
        for (const count of counts.values()) assert.equal(count, 1);
        assert.equal(shadowDisposals, 1); assert.equal(previous.parent, null);
        assert.deepEqual(Object.values(templates).map(snapshot), originals);
        assert.deepEqual(cachedDisposals, []);
    }
    c.clearDroneAirframe();
});

test('LED color and brightness commands affect the inspection lamp alone, not cached paint', () => {
    const c = harness(), main = read('js/main.js');
    const ast = acorn.parse(main, { ecmaVersion: 'latest' });
    const dispatch = ast.body.find(node => node.id?.name === 'dispatchCommand');
    c.logToConsole = () => {};
    c.flightProgramSession = require('../js/flight_command_execution.js').createSession();
    c.executionSpeed = 1;
    c.setTimeout = resolve => resolve();
    c.isCityMissionScene = () => false;
    vm.runInContext(main.slice(dispatch.start, dispatch.end), c);
    return (async () => {
        for (const type of ['city', 'factory']) {
            c.setDroneAirframeForScene(type);
            const originalTemplates = Object.values(templates).map(snapshot);
            const others = [];
            c.droneGroup.traverse(node => {
                if (node.isMesh && node !== c.droneLedMesh) others.push([node, snapshot(node)]);
            });
            await c.dispatchCommand({ type: 'led_hex_bright', color: '#00ff00', brightness: 255 });
            assert.equal(c.droneLedMesh.material.color.getHex(), 0x00ff00);
            assert.equal(c.droneLedMesh.material.emissive.getHex(), 0x00ff00);
            assert.equal(c.droneLedLight.intensity, 2);
            await c.dispatchCommand({ type: 'led_hex_bright', color: '#ff0000', brightness: 128 });
            close(c.droneLedMesh.material.opacity, 128 / 255);
            await c.dispatchCommand({ type: 'led_off' });
            assert.equal(c.droneLedLight.intensity, 0);
            assert.equal(c.droneLedMesh.material.opacity, 0.1);
            for (const [node, before] of others) assert.deepEqual(snapshot(node), before, node.name);
            assert.deepEqual(Object.values(templates).map(snapshot), originalTemplates);
        }
        c.clearDroneAirframe();
    })();
});

test('missing or malformed optional GLBs use the medical fallback with no stale references', () => {
    const c = harness(), group = c.droneGroup;
    c.setDroneAirframeForScene('factory');
    delete c.assets.wildfireDrone; c.setDroneAirframeForScene('city');
    assert.equal(group.userData.airframeKey, 'medical');
    c.setDroneAirframeForScene('factory');
    c.assets.wildfireDrone = new THREE.Group(); c.setDroneAirframeForScene('city');
    assert.equal(group.userData.airframeKey, 'medical'); assert.equal(group.children.length, 4);
    c.assets.wildfireDrone = templates.wildfireDrone.clone(true);
    const rotor = c.assets.wildfireDrone.getObjectByName('Propeller_FL'); rotor.parent.remove(rotor);
    c.setDroneAirframeForScene('city');
    assert.equal(group.userData.airframeKey, 'medical');
    assert.ok(c.propellers.every(propeller => group.getObjectById(propeller.id) === propeller));
    assert.deepEqual(c.getDroneCargoAttachmentPoint({ x: 10, y: 90, z: -30, heading: 90 }).toArray(), [10, 70, -30]);
    c.clearDroneAirframe();
});

async function factoryHarness() {
    const c = harness();
    c.THREE = { ...THREE, GLTFLoader: class {
        async loadAsync() {
            const scene = new THREE.Group();
            scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, 1), new THREE.MeshStandardMaterial()));
            return { scene };
        }
    } };
    c.FactoryConfig = require('../js/factory/config.js');
    c.FactoryAssetPaths = catalog.factory;
    c.renderer = { shadowMap: { enabled: true } };
    c.camera = new THREE.PerspectiveCamera(45, 1, 1, 8000);
    c.camRadius = 100; c.camTheta = 45; c.camPhi = 70;
    c.matchMedia = () => ({ matches: true });
    c.document = { createElement() { return { getContext() { return new Proxy({}, { get: () => () => {} }); } }; } };
    vm.runInContext(read('js/factory/scene.js'), c);
    await c.window.FactoryScene.preload();
    const view = c.window.FactoryScene.build(c.scene, new THREE.Group());
    c.setDroneAirframeForScene('factory');
    const data = { cargo: null, intake: null, feedRemaining: 0, delivered: [], elapsed: 0, repair: { part: null, status: 'idle' } };
    return { c, view, data };
}

test('factory flight uses the built-in gripper without creating the old hanging magnet', async () => {
    const { c, view, data } = await factoryHarness();
    view.update(data, { x: -1200, y: 94, z: 1200, heading: 0, isFlying: true });
    const magnets = [];
    view.group.traverse(node => { if (node.userData.asset === 'factory-kit/crane-magnet') magnets.push(node); });
    assert.equal(magnets.length, 0, 'the obsolete hanging magnet must not exist in the factory scene');
    assert.ok(c.droneGroup.getObjectByName('Gripper'));
    view.dispose(); c.clearDroneAirframe();
});

test('carried factory parts stay at the real finger tips through turns and return to the intake after release', async () => {
    const { c, view, data } = await factoryHarness();
    c.droneGroup.updateMatrixWorld(true);
    const localTip = new THREE.Vector3();
    for (const side of ['Left', 'Right']) {
        const box = new THREE.Box3().setFromObject(c.droneGroup.getObjectByName('Gripper_Finger_' + side));
        const point = box.getCenter(new THREE.Vector3()); point.y = box.min.y;
        localTip.add(point.multiplyScalar(0.5));
    }
    // FactoryScene.update runs before the RAF updates the flight group's pose.
    // A stale rendered pose must not leave the cargo one frame behind.
    c.droneGroup.position.set(-500, -30, 300); c.droneGroup.rotation.y = 0.7;
    const part = view.group.children.find(node => node.userData.asset === 'factory-kit/cog-a' && node.position.z === 750);
    for (const heading of [0, 90, 180, 270]) {
        const drone = { x: 120, y: 94, z: -300, heading, isFlying: true };
        data.cargo = { id: 'carried-part', status: '正常' };
        view.update(data, drone);
        const box = new THREE.Box3().setFromObject(part);
        const expected = localTip.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(heading))
            .add(new THREE.Vector3(drone.x, drone.y, drone.z));
        const center = box.getCenter(new THREE.Vector3());
        close(center.x, expected.x); close(box.max.y, expected.y); close(center.z, expected.z);
        close(part.rotation.y, THREE.MathUtils.degToRad(heading));
    }
    data.cargo = null; data.intake = { id: 'ready-part' };
    view.update(data, { x: 0, y: 94, z: 750, heading: 90, isFlying: true });
    assert.equal(part.visible, true); assert.deepEqual(part.position.toArray(), [0, 20, 750]);
    close(part.rotation.y, 0);
    data.intake = null; view.update(data, { x: 0, y: 14, z: 750, heading: 0, isFlying: false });
    assert.equal(part.visible, false);
    view.dispose(); c.clearDroneAirframe();
});

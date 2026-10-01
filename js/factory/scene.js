/* Operate mode: five legible factory districts connected by broad flight lanes.
 * Imported Kenney machinery is the visual world; geometry below is only ground,
 * lane marking and instructional labels. Delivery milestones bring the factory to life.
 */
window.FactoryScene = (() => {
    const templates = new Map();
    let loading = null, live = null;
    async function preload() {
        if (loading) return loading;
        loading = (async () => {
            const loader = new THREE.GLTFLoader();
            const items = Object.entries(FactoryAssetPaths);
            for (let i = 0; i < items.length; i += 6) {
                await Promise.all(items.slice(i, i + 6).map(async ([key, path]) => {
                    if (templates.has(key)) return;
                    const model = await loader.loadAsync(path);
                    templates.set(key, model.scene);
                }));
            }
        })().catch(error => { loading = null; throw error; });
        return loading;
    }
    function build(world, parent) {
        const C = FactoryConfig, group = new THREE.Group(); group.name = 'FactoryMission'; parent.add(group);
        const staticRoot = new THREE.Group(); group.add(staticRoot);
        const obstacles = [], geometries = new Map(), materials = new Map(), textures = new Map();
        const background = world.background, fog = world.fog;
        const hemi = world.userData.mainHemiLight, sun = world.userData.mainDirLight;
        const savedLights = world.children.filter(n => n.isLight).map(light => ({ light, color: light.color.clone(), intensity: light.intensity, position: light.position.clone(), ground: light.groundColor?.clone() }));
        const saved = { shadows: renderer.shadowMap.enabled, camera: { radius: camRadius, theta: camTheta, phi: camPhi, near: camera.near }, shadow: {} };
        if (sun) for (const k of ['left', 'right', 'top', 'bottom', 'near', 'far']) saved.shadow[k] = sun.shadow.camera[k];
        world.background = new THREE.Color(0xb8cbca); world.fog = new THREE.Fog(0xb8cbca, 6500, 13000);
        savedLights.forEach(({ light }) => { light.intensity = .08; });
        if (hemi) { hemi.color.setHex(0xe7f0f0); hemi.groundColor.setHex(0x666950); hemi.intensity = .65; }
        if (sun) {
            sun.color.setHex(0xffefd5); sun.intensity = 1.05; sun.position.set(-1500, 2600, -900);
            Object.assign(sun.shadow.camera, { left: -2400, right: 2400, top: 2400, bottom: -2400, near: 10, far: 6000 });
            sun.shadow.camera.updateProjectionMatrix();
        }
        renderer.shadowMap.enabled = true;
        camera.near = 10; camera.updateProjectionMatrix();
        const groundMaterials = new Map(), groundGeometry = new THREE.PlaneGeometry(1, 1);
        // Ground/decal layers need explicit depth separation at long viewing distances.
        // Drawing the layers before models keeps ordinary object occlusion intact.
        const material = (color, layer) => {
            const key = color + ':' + layer;
            if (!groundMaterials.has(key)) groundMaterials.set(key, new THREE.MeshStandardMaterial({
                color: new THREE.Color(color).convertSRGBToLinear(), roughness: 1,
                polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 * layer
            }));
            return groundMaterials.get(key);
        };
        function floor(x, z, w, d, color, y = 0) {
            const layer = y < -3 ? 0 : y < -1.5 ? 1 : y < 0 ? 2 : y < .05 ? 3 : y < .1 ? 4 : y < .5 ? 3 : y < .7 ? 5 : y < .9 ? 6 : 7;
            const mesh = new THREE.Mesh(groundGeometry, material(color, layer));
            mesh.renderOrder = layer - 20;
            mesh.scale.set(w, d, 1); mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.raycast = () => {}; staticRoot.add(mesh); return mesh;
        }
        function instance(key, x, z, size, rotation = 0, y = 0, dynamic = false, solid = true) {
            const template = templates.get(key);
            if (!template) throw new Error(`Missing factory model: ${key}`);
            const copy = template.clone(true);
            copy.traverse(node => {
                if (!node.isMesh) return;
                if (!geometries.has(node.geometry)) geometries.set(node.geometry, node.geometry.clone());
                node.geometry = geometries.get(node.geometry);
                const cloneMaterial = original => {
                    if (!materials.has(original)) {
                        const m = original.clone();
                        if (m.map) {
                            if (!textures.has(m.map)) { const t = m.map.clone(); t.needsUpdate = true; textures.set(m.map, t); }
                            m.map = textures.get(m.map);
                        }
                        m.roughness = .85; m.metalness = .05; materials.set(original, m);
                    }
                    return materials.get(original);
                };
                node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
                node.castShadow = true; node.receiveShadow = true; node.raycast = () => {};
            });
            const bounds = new THREE.Box3().setFromObject(copy), extent = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
            copy.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
            const wrapper = new THREE.Group(); wrapper.add(copy); wrapper.scale.setScalar(size / Math.max(extent.x, extent.z));
            wrapper.position.set(x, y, z); wrapper.rotation.y = rotation; wrapper.userData.asset = key;
            (dynamic ? group : staticRoot).add(wrapper); wrapper.updateMatrixWorld(true);
            if (solid) {
                const box = new THREE.Box3().setFromObject(wrapper);
                obstacles.push({ min: { ...box.min }, max: { ...box.max }, asset: key });
            }
            return wrapper;
        }
        const f = (name, ...args) => instance('factory-kit/' + name, ...args);
        const c = (name, ...args) => instance('city-kit-industrial/' + name, ...args);
        const s = (name, ...args) => instance('space-kit/' + name, ...args);
        function label(text, x, z, color, y = 130, width = 300) {
            const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 112;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fffdf4'; ctx.fillRect(0, 0, 512, 112);
            ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 8); ctx.font = '600 48px "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 61);
            const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
            sprite.position.set(x, y, z); sprite.scale.set(width, width * 112 / 512, 1); sprite.renderOrder = 8; group.add(sprite); return sprite;
        }
        function pad(x, z, color, text) {
            floor(x, z, 260, 260, 0xf4ebda, .5); floor(x, z, 236, 236, color, .7); floor(x, z, 216, 216, 0xe2e2d5, .9);
            const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
            const ctx = canvas.getContext('2d'); ctx.strokeStyle = '#164d48'; ctx.lineWidth = 7; ctx.strokeRect(26, 26, 204, 204);
            ctx.fillStyle = '#164d48'; ctx.font = 'bold 100px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 128, 159);
            const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding;
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -16 }));
            mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 1.2, z); mesh.renderOrder = -12; group.add(mesh);
        }
        // 30 m playable yard; a continuous apron and access road give its boundary context.
        floor(0, 0, 4800, 4800, 0xa0afa1, -4);
        floor(0, 0, 3300, 3300, 0xb4b5a8, -2);
        floor(0, 0, 3000, 3000, 0xd4d1bf, -1);
        for (const x of [-1200, 0, 1200]) floor(x, 0, 320, 2700, 0x74858a, .02);
        for (const z of [-1200, -300, 750, 1200]) floor(0, z, 2700, 320, 0x74858a, .03);
        for (const x of [-1200, 0, 1200]) for (let z = -1350; z <= 1350; z += 150) floor(x, z, 5, 45, 0xf1d58b, .08);
        for (const z of [-1200, -300, 750, 1200]) for (let x = -1350; x <= 1350; x += 150) floor(x, z, 45, 5, 0xf1d58b, .09);
        // Service road and perimeter fence are outside the flying boundary.
        floor(0, 2050, 4400, 280, 0x5c6e72, .01);
        for (let x = -2000; x <= 2000; x += 180) floor(x, 2050, 75, 7, 0xdad8c4, .1);
        for (let p = -1400; p <= 1400; p += 200) {
            s('rail', p, -1530, 200, 0, 0, false, false);
            s('rail', 1530, p, 200, Math.PI / 2, 0, false, false);
            if (p < 800) s('rail', -1530, p, 200, Math.PI / 2, 0, false, false);
        }
        pad(-1200, 1200, 0x28736a, 'H'); pad(0, 750, 0x267995, 'A'); pad(-1200, -300, 0xba681b, 'B'); pad(1200, -300, 0x477c64, 'C'); pad(0, -1200, 0x28736a, 'H');
        label('起飛基地', -1200, 1370, '#164d48', 95);
        label('A 取件台', 0, 940, '#276780', 125);
        label('B 維修站', -1200, -490, '#825713', 170);
        label('C 裝配站', 1200, -490, '#286c4b', 170);
        label('出貨平台', 0, -1400, '#164d48', 125);
        const dispatchReady = label('已備妥！在此降落', 0, -1200, '#17683d', 220, 380); dispatchReady.visible = false;
        // Southwest base and receiving warehouse. Small props remain off the flight lanes.
        c('building-c', -750, 1590, 430, Math.PI);
        f('screen-small', -990, 1400, 70, Math.PI / 2); f('box-large', -920, 1000, 110);
        f('box-small', -730, 980, 65); s('rover', -1680, 1440, 240, Math.PI / 2, 0, false, false);
        c('building-f', 640, 1630, 640, Math.PI);
        c('shipping-container-a', 1150, 1610, 300, Math.PI / 2);
        c('shipping-container-c', 1640, 790, 260, Math.PI / 2);
        for (let i = 0; i < 4; i++) f('conveyor', 310 + i * 100, 975, 100, Math.PI / 2);
        f('conveyor-corner', 210, 975, 100); f('conveyor', -350, 975, 100);
        f('scanner-low', 420, 975, 110);
        // Central industrial islands: each has a coherent service apron and clear 3 m lanes around it.
        floor(-600, 180, 720, 620, 0xb8b7a3, .15); floor(600, 180, 720, 620, 0xb8b7a3, .15);
        f('machine-window', -690, 60, 340); f('machine-bed', -590, 440, 275, Math.PI / 2);
        f('hopper-round', -310, 230, 140); f('crane', -660, 240, 330, 0, .15, false, false);
        f('machine-fortified', 570, 50, 340, Math.PI / 2);
        f('catwalk-straight', 600, 275, 360, Math.PI / 2, 180, false, false);
        f('catwalk-stairs', 880, 330, 190, Math.PI / 2);
        for (const x of [-870, -380, 350, 820]) { f('box-large', x, 500, 110); f('box-small', x + 100, 470, 65); }
        // Repair intake is a clear ground-level magnetic transfer pad, beside the imported machinery.
        f('machine', -800, -800, 300, Math.PI / 2);
        f('screen-panel-wide', -1400, -585, 90);
        const repairArm = f('robot-arm-a', -940, -590, 180, 0, 0, true);
        f('machine-window', -390, -755, 220); f('pipe-large-valve', -450, -710, 140);
        for (let i = 0; i < 3; i++) f('pipe-large-long', -710 + i * 150, -960, 150, Math.PI / 2, 65);
        c('detail-tank', -1780, -780, 260, 0, 0, false, false);
        f('structure-window-wide', -1450, -840, 280, Math.PI / 2, 0, false, false);
        // Assembly line and six delivered modules visibly accumulate alongside the core.
        f('machine-bed', 850, -780, 280);
        const assemblyArm = f('robot-arm-b', 950, -600, 160, Math.PI, 0, true);
        const core = s('machine_generatorLarge', 420, -750, 280, 0, 0, true);
        for (let i = 0; i < 3; i++) f('conveyor-long', 380 + i * 220, -985, 220, 0);
        const modules = [];
        for (let i = 0; i < 6; i++) modules.push(f('cog-a', 300 + i * 115, -985, 64, 0, 45, true, false));
        const assemblyScreen = f('screen-panel-wide', 1400, -575, 85, Math.PI, 0, true);
        const statusMaterials = object => { const list = []; object.traverse(n => { if (!n.isMesh) return; const clone = m => { const c = m.clone(); list.push(c); return c; }; n.material = Array.isArray(n.material) ? n.material.map(clone) : clone(n.material); }); return list; };
        const coreLights = statusMaterials(core), assemblyLights = statusMaterials(assemblyScreen);
        label('救援能源核心', 420, -840, '#164d48', 350, 250);
        // Northern dispatch and peripheral industrial skyline.
        s('craft_cargoA', 780, -1580, 500, Math.PI / 2, 0, false, false);
        f('conveyor-long', 370, -1350, 290, Math.PI / 2, 0, false, false);
        c('building-i', -700, -1640, 490, 0, 0, false, false);
        c('building-a', -1720, 300, 440, Math.PI / 2, 0, false, false);
        c('building-m', 1840, 180, 580, Math.PI / 2, 0, false, false);
        c('water-tower', 1860, -1120, 250, 0, 0, false, false);
        c('detail-tank-large', 1790, 1040, 280, 0, 0, false, false);
        c('solar-panel-landscape-group', -1690, -1260, 400, 0, 0, false, false);
        c('windmill-low', -1810, -1870, 250, 0, 0, false, false);
        s('machine_wireless', 1610, -1840, 230, 0, 0, false, false);
        // Connecting details, stock and boundary planting use the same imported vocabulary.
        for (const [x, z] of [[-900, 110], [450, 1480], [760, 400], [-650, -1480], [1540, 360]]) {
            f('box-long', x, z, 120, .25); f('box-small', x + 85, z + 90, 60);
            s('barrels', x - 90, z + 90, 85); f('warning-orange', x, z - 90, 50);
        }
        for (const x of [-1450, 1450]) for (const z of [1000, 500, 50, -1000]) f('cone', x, z, 38, 0, 0, false, false);
        // The imported part follows the airframe's built-in gripper. It does not
        // become collision/sensor geometry; no separate hanging tool is needed.
        const part = f('cog-a', 0, 750, 46, 0, 20, true, false);
        const cargoHeight = new THREE.Box3().setFromObject(part).getSize(new THREE.Vector3()).y;
        const repairPart = f('cog-a', -1200, -300, 46, 0, 20, true, false);
        const movingStock = [0, 1, 2].map(i => f('box-small', 275 + i * 100, 975, 45, 0, 45, true, false));
        // Batch static model meshes and ground markings without changing their world transforms.
        staticRoot.updateMatrixWorld(true);
        const batches = new Map();
        staticRoot.traverse(mesh => {
            if (!mesh.isMesh) return;
            const key = mesh.geometry.uuid + ':' + (Array.isArray(mesh.material) ? mesh.material.map(m => m.uuid).join(',') : mesh.material.uuid);
            if (!batches.has(key)) batches.set(key, { geometry: mesh.geometry, material: mesh.material, order: mesh.renderOrder, matrices: [] });
            batches.get(key).matrices.push(mesh.matrixWorld.clone());
        });
        group.remove(staticRoot);
        for (const b of batches.values()) {
            const mesh = new THREE.InstancedMesh(b.geometry, b.material, b.matrices.length); mesh.renderOrder = b.order;
            b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.castShadow = b.geometry !== groundGeometry; mesh.receiveShadow = true; mesh.raycast = () => {}; group.add(mesh);
        }
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        function update(data, drone) {
            const cargo = data.cargo, ready = data.intake;
            dispatchReady.visible = data.delivered.length === 6;
            part.visible = !!cargo || !!ready || data.feedRemaining > 0;
            if (cargo) {
                part.position.copy(getDroneCargoAttachmentPoint(drone));
                part.position.y -= cargoHeight;
                part.rotation.y = THREE.MathUtils.degToRad(drone.heading);
            } else {
                part.position.set(data.feedRemaining > 0 ? data.feedRemaining / C.feedSeconds * 150 : 0, 20, 750);
                part.rotation.y = 0;
            }
            repairPart.visible = !!data.repair.part;
            repairArm.rotation.y = data.repair.status === 'working' && !reduced.matches ? Math.sin(data.elapsed * 1.5) * .22 : 0;
            assemblyArm.rotation.y = Math.PI + (data.delivered.length >= 4 && !reduced.matches ? Math.sin(data.elapsed) * .2 : 0);
            modules.forEach((m, i) => { m.visible = i < data.delivered.length; });
            coreLights.forEach(m => { m.emissive.setHex(0x42866d); m.emissiveIntensity = data.delivered.length >= 6 ? .35 : 0; });
            assemblyLights.forEach(m => { m.emissive.setHex(0x57a9ac); m.emissiveIntensity = data.delivered.length >= 4 ? .4 : 0; });
            modules.forEach(m => { m.rotation.y = data.delivered.length >= 6 && !reduced.matches ? data.elapsed * .4 : 0; });
            core.position.y = data.delivered.length >= 6 && !reduced.matches ? 4 + Math.sin(data.elapsed * 2) * 2 : 0;
            movingStock.forEach((m, i) => { m.position.x = data.delivered.length >= 2 && !reduced.matches ? 275 + ((data.elapsed * 24 + i * 100) % 340) : 275 + i * 100; });
        }
        live = { group, obstacles, update,
            dispose() {
                world.background = background; world.fog = fog; renderer.shadowMap.enabled = saved.shadows;
                savedLights.forEach(({ light, color, intensity, position, ground }) => {
                    light.color.copy(color); light.intensity = intensity; light.position.copy(position);
                    if (ground) light.groundColor.copy(ground);
                });
                if (sun) { Object.assign(sun.shadow.camera, saved.shadow); sun.shadow.camera.updateProjectionMatrix(); }
                camRadius = saved.camera.radius; camTheta = saved.camera.theta; camPhi = saved.camera.phi; camera.near = saved.camera.near; camera.updateProjectionMatrix();
                live = null;
            }
        };
        return live;
    }
    return { preload, build, get live() { return live; } };
})();

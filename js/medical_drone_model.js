(function (global) {
    'use strict';

    const THREE = global.THREE;

    function createMedicalDroneModel() {
        const root = new THREE.Group();
        root.name = 'medical_rescue_drone';

        const materials = {
            white: new THREE.MeshStandardMaterial({ color: 0xd8dcdd, roughness: 0.42, metalness: 0.04 }),
            red: new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 }),
            graphite: new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.65, metalness: 0.15 }),
            dark: new THREE.MeshStandardMaterial({ color: 0x0d1012, roughness: 0.48, metalness: 0.28 }),
            cyan: new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2, roughness: 0.2, transparent: true, opacity: 0.76 }),
            amber: new THREE.MeshStandardMaterial({ color: 0xff982d, emissive: 0xff6b18, emissiveIntensity: 1.2, roughness: 0.3 }),
            glass: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.9, clearcoat: 1, clearcoatRoughness: 0.02 }),
            lens: new THREE.MeshPhysicalMaterial({ color: 0x16262d, emissive: 0x0b1f2c, emissiveIntensity: 0.8, roughness: 0.04, metalness: 0.75, clearcoat: 1 })
        };
        const rotors = [];
        const ledMeshes = [];
        const parts = [];
        const nodes = {};

        function register(part, kind) {
            part.userData.partKind = kind || 'part';
            parts.push(part);
            if (part.name) nodes[part.name] = part;
            return part;
        }

        function markRelief(object, part) {
            object.userData.explodeWithParent = true;
            object.userData.part = part;
            return object;
        }

        function addMesh(name, geometry, material, parent, position, rotation) {
            const value = new THREE.Mesh(geometry, material);
            value.name = name;
            value.position.set.apply(value.position, position || [0, 0, 0]);
            value.rotation.set.apply(value.rotation, rotation || [0, 0, 0]);
            value.castShadow = true;
            value.receiveShadow = true;
            parent.add(value);
            return value;
        }

        function rounded(name, size, radius, material, parent, position, rotation) {
            const Geometry = THREE.RoundedBoxGeometry || THREE.BoxGeometry;
            const geometry = THREE.RoundedBoxGeometry
                ? new Geometry(size[0], size[1], size[2], 2, radius)
                : new Geometry(size[0], size[1], size[2]);
            return addMesh(name, geometry, material, parent, position, rotation);
        }

        function tubeBetween(name, a, b, radius, material, parent) {
            const direction = b.clone().sub(a);
            const value = addMesh(name, new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material, parent);
            value.position.copy(a.clone().add(b).multiplyScalar(0.5));
            value.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
            return value;
        }

        function extrude(name, shape, depth, material, parent, position, rotation) {
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.025, bevelSegments: 1 });
            geometry.center();
            return addMesh(name, geometry, material, parent, position, rotation);
        }

        const hull = register(new THREE.Group());
        hull.name = 'center_fuselage';
        root.add(hull);
        rounded('main_chassis', [3.15, 1.32, 4.05], 0.34, materials.white, hull, [0, 0.25, 0]);
        rounded('underside_pan', [2.55, 0.38, 3.25], 0.16, materials.graphite, hull, [0, -0.48, 0.08]);
        markRelief(rounded('top_red_lid', [2.18, 0.16, 2.82], 0.24, materials.red, hull, [0, 1.02, -0.05]), 'center_fuselage');
        markRelief(rounded('top_lid_beveled_seam', [2.34, 0.07, 2.98], 0.26, materials.dark, hull, [0, 0.93, -0.05]), 'center_fuselage');

        const badgeShape = new THREE.Shape();
        badgeShape.moveTo(-0.4, -0.52); badgeShape.lineTo(0.4, -0.52); badgeShape.lineTo(0.58, -0.34);
        badgeShape.lineTo(0.58, 0.34); badgeShape.lineTo(0.4, 0.52); badgeShape.lineTo(-0.4, 0.52);
        badgeShape.lineTo(-0.58, 0.34); badgeShape.lineTo(-0.58, -0.34); badgeShape.closePath();
        markRelief(extrude('front_medical_badge', badgeShape, 0.08, materials.red, hull, [0, 0.32, -2.05]), 'center_fuselage');
        const cross = new THREE.Shape();
        cross.moveTo(-0.22, -0.37); cross.lineTo(0.22, -0.37); cross.lineTo(0.22, -0.22); cross.lineTo(0.37, -0.22);
        cross.lineTo(0.37, 0.22); cross.lineTo(0.22, 0.22); cross.lineTo(0.22, 0.37); cross.lineTo(-0.22, 0.37);
        cross.lineTo(-0.22, 0.22); cross.lineTo(-0.37, 0.22); cross.lineTo(-0.37, -0.22); cross.lineTo(-0.22, -0.22); cross.closePath();
        markRelief(extrude('recessed_medical_cross', cross, 0.065, materials.white, hull, [0, 0.32, -2.105]), 'center_fuselage');

        const propulsion = new THREE.Group();
        propulsion.name = 'propulsion_system';
        root.add(propulsion);
        [
            { id: 'FL', x: -4.25, z: -3.05, spin: 1 }, { id: 'FR', x: 4.25, z: -3.05, spin: -1 },
            { id: 'BL', x: -4.25, z: 3.05, spin: -1 }, { id: 'BR', x: 4.25, z: 3.05, spin: 1 }
        ].forEach(function (motorInfo) {
            const arm = register(new THREE.Group());
            arm.name = 'arm_' + motorInfo.id;
            propulsion.add(arm);
            const start = new THREE.Vector3(Math.sign(motorInfo.x) * 1.25, 0.48, Math.sign(motorInfo.z) * 1.45);
            const end = new THREE.Vector3(motorInfo.x, 0.48, motorInfo.z);
            const mid = start.clone().add(end).multiplyScalar(0.5);
            const angle = Math.atan2(end.x - start.x, end.z - start.z);
            const armBeam = rounded('arm_beam_' + motorInfo.id, [0.58, 0.48, start.distanceTo(end) + 0.24], 0.12, materials.graphite, arm, [mid.x, mid.y, mid.z], [0, angle, 0]);
            armBeam.scale.set(1, 1, 0.98);
            rounded('arm_socket_' + motorInfo.id, [0.78, 0.62, 0.72], 0.13, materials.dark, arm, [start.x, start.y, start.z], [0, angle, 0]);
            for (let i = 0; i < 2; i++) {
                const bolt = addMesh('hex_bolt_' + motorInfo.id + '_' + i, new THREE.CylinderGeometry(0.075, 0.075, 0.025, 6), materials.dark, arm, [start.x + Math.cos(angle) * (i ? -0.17 : 0.17), 0.82, start.z - Math.sin(angle) * (i ? -0.17 : 0.17)]);
                markRelief(bolt, 'arm_' + motorInfo.id);
            }

            const motor = register(new THREE.Group());
            motor.name = 'motor_pod_' + motorInfo.id;
            motor.position.set(motorInfo.x, 0.52, motorInfo.z);
            propulsion.add(motor);
            addMesh('motor_housing_' + motorInfo.id, new THREE.CylinderGeometry(0.46, 0.52, 0.82, 12), materials.white, motor, [0, 0.1, 0]);
            const ring = addMesh('cyan_led_ring_' + motorInfo.id, new THREE.CylinderGeometry(0.515, 0.515, 0.22, 32), materials.cyan, motor, [0, -0.38, 0]);
            ledMeshes.push(ring);
            addMesh('motor_core_' + motorInfo.id, new THREE.CylinderGeometry(0.3, 0.34, 0.55, 16), materials.dark, motor, [0, 0.74, 0]);

            const rotor = register(new THREE.Group(), 'pivot');
            rotor.name = 'rotor_' + motorInfo.id;
            rotor.userData.spin = motorInfo.spin;
            rotor.position.set(0, 1.1, 0);
            motor.add(rotor);
            rotors.push(rotor);
            addMesh('hub_' + motorInfo.id, new THREE.CylinderGeometry(0.22, 0.25, 0.17, 16), materials.dark, rotor);
            const bladeShape = new THREE.Shape();
            bladeShape.moveTo(0.10, -0.10); bladeShape.lineTo(1.72, -0.22); bladeShape.lineTo(2.10, -0.08);
            bladeShape.lineTo(2.10, 0.08); bladeShape.lineTo(1.72, 0.17); bladeShape.lineTo(0.10, 0.10); bladeShape.closePath();
            markRelief(extrude('propeller_' + motorInfo.id + '_A', bladeShape, 0.055, materials.graphite, rotor, [0, 0.08, 0], [Math.PI / 2, 0, 0]), 'rotor_' + motorInfo.id);
            markRelief(extrude('propeller_' + motorInfo.id + '_B', bladeShape, 0.055, materials.graphite, rotor, [0, 0.08, 0], [Math.PI / 2, Math.PI, 0]), 'rotor_' + motorInfo.id);
        });

        const landing = register(new THREE.Group());
        landing.name = 'landing_gear';
        root.add(landing);
        [-1.45, 1.45].forEach(function (x) {
            rounded('landing_skid_' + (x < 0 ? 'L' : 'R'), [0.34, 0.28, 5.05], 0.13, materials.graphite, landing, [x, -1.92, 0.1]);
            [-1.48, 1.48].forEach(function (z) {
                tubeBetween('skid_strut_' + (x < 0 ? 'L' : 'R') + '_' + (z < 0 ? 'F' : 'B'), new THREE.Vector3(x * 0.7, -0.48, z), new THREE.Vector3(x, -1.82, z * 1.04), 0.18, materials.graphite, landing);
            });
        });
        tubeBetween('skid_crossbar_front', new THREE.Vector3(-1.45, -1.7, -1.48), new THREE.Vector3(1.45, -1.7, -1.48), 0.11, materials.graphite, landing);

        const gimbalSystem = new THREE.Group();
        gimbalSystem.name = 'gimbal_system';
        root.add(gimbalSystem);
        const gimbalYaw = register(new THREE.Group(), 'pivot');
        gimbalYaw.name = 'gimbal_yaw';
        gimbalYaw.position.set(0, -0.64, -1.72);
        gimbalSystem.add(gimbalYaw);
        rounded('gimbal_yoke_bridge', [1.1, 0.26, 0.3], 0.08, materials.graphite, gimbalYaw);
        [-0.47, 0.47].forEach(function (x) { rounded('gimbal_yoke_side_' + (x < 0 ? 'L' : 'R'), [0.18, 0.78, 0.3], 0.07, materials.graphite, gimbalYaw, [x, -0.28, 0]); });
        const gimbalPitch = register(new THREE.Group(), 'pivot');
        gimbalPitch.name = 'gimbal_pitch';
        gimbalPitch.position.set(0, -0.36, -0.02);
        gimbalYaw.add(gimbalPitch);
        addMesh('camera_body', new THREE.CylinderGeometry(0.4, 0.4, 0.66, 16), materials.dark, gimbalPitch, [0, 0, -0.02], [Math.PI / 2, 0, 0]);
        addMesh('camera_lens_bezel', new THREE.CylinderGeometry(0.31, 0.36, 0.16, 24), materials.glass, gimbalPitch, [0, 0, -0.4], [Math.PI / 2, 0, 0]);
        addMesh('camera_lens', new THREE.SphereGeometry(0.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), materials.lens, gimbalPitch, [0, 0, -0.5], [Math.PI / 2, 0, 0]);

        const batterySocket = register(new THREE.Group(), 'socket');
        batterySocket.name = 'battery_socket';
        batterySocket.position.set(0, 0.2, 1.91);
        root.add(batterySocket);
        const battery = register(new THREE.Group());
        battery.name = 'battery_module';
        batterySocket.add(battery);
        rounded('battery_pack', [1.82, 1.18, 0.48], 0.12, materials.dark, battery, [0, 0.08, 0.2]);
        rounded('battery_release_latch', [1.16, 0.18, 0.35], 0.07, materials.graphite, battery, [0, 0.79, 0.13]);
        [-0.48, 0, 0.48].forEach(function (x, index) { rounded('battery_cell_' + index, [0.4, 0.66, 0.08], 0.035, materials.graphite, battery, [x, 0.02, 0.49]); });
        [-0.31, 0, 0.31].forEach(function (x, index) { rounded('battery_status_' + index, [0.24, 0.1, 0.07], 0.025, materials.amber, battery, [x, 0.62, 0.5]); });

        const vents = register(new THREE.Group());
        vents.name = 'rear_cooling_vents';
        vents.position.set(0, -0.76, 2.12);
        root.add(vents);
        rounded('vent_frame', [1.48, 0.56, 0.18], 0.10, materials.dark, vents);
        for (let i = 0; i < 9; i++) markRelief(rounded('vent_slot_' + i, [0.085, 0.34, 0.05], 0.025, materials.graphite, vents, [(i - 4) * 0.135, 0, 0.11]), 'rear_cooling_vents');

        const originalPositions = new Map();
        parts.forEach(function (part) { originalPositions.set(part, part.position.clone()); });
        const selectable = [];
        root.traverse(function (object) {
            if (object.name) nodes[object.name] = object;
            if (object.isMesh) selectable.push(object);
        });

        root.userData.sculptRuntime = {
            nodes: nodes,
            parts: parts,
            selectable: selectable,
            setExplode: function (amount) {
                parts.forEach(function (part) {
                    const base = originalPositions.get(part);
                    if (!base) return;
                    const radial = base.clone().multiplyScalar(1 + amount * 0.55);
                    radial.y += Math.sign(base.y || 1) * amount * 0.16;
                    part.position.copy(radial);
                });
            },
            setBatteryEject: function (amount) { batterySocket.position.z = 1.91 + amount * 1.25; }
        };

        root.userData.rotors = rotors;
        root.userData.ledMeshes = ledMeshes;
        root.userData.gimbal = gimbalYaw;
        return root;
    }

    global.createMedicalDroneModel = createMedicalDroneModel;
}(window));

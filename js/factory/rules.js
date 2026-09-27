(function (root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./config.js') : root.FactoryConfig);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.FactoryRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
    class MissionError extends Error {
        constructor(message, code) { super(message); this.name = 'MissionError'; this.code = code; }
    }
    const fail = (text, code) => { throw new MissionError(text, code); };
    function random(seed) {
        let value = seed >>> 0;
        return () => { value += 0x6D2B79F5; let t = Math.imul(value ^ value >>> 15, value | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }
    function makeOrder(seed = 0, previous = null) {
        const rng = random(seed);
        const statuses = [...C.initialOrder];
        if (seed !== 0) {
            for (let i = statuses.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [statuses[i], statuses[j]] = [statuses[j], statuses[i]]; }
            if (previous && statuses.every((s, i) => s === previous[i].status)) {
                const other = statuses.findIndex(s => s !== statuses[0]);
                [statuses[0], statuses[other]] = [statuses[other], statuses[0]];
            }
        }
        return Object.freeze(statuses.map((status, index) => Object.freeze({
            id: `F${seed}-${index + 1}`, status,
            repairSeconds: C.repairTimes[seed === 0 ? index % 3 : Math.floor(rng() * 3)]
        })));
    }
    function near(drone, name) {
        const p = C.ports[name];
        return !!drone.isFlying && Math.hypot(drone.x - p.x, drone.z - p.z) <= C.radius
            && drone.y - p.y >= C.minAltitude && drone.y - p.y <= C.maxAltitude;
    }
    function create(seed = 0, order = makeOrder(seed)) {
        const data = {
            seed, order, elapsed: 0, flew: false, completed: false,
            delivered: [], cargo: null, intake: null, feedRemaining: C.feedSeconds,
            repair: { status: 'idle', part: null, remaining: 0 },
            learning: { loopDeliveries: {}, branches: [] }
        };
        function tick(seconds) {
            if (!Number.isFinite(seconds) || seconds < 0 || data.completed) return;
            data.elapsed += seconds;
            if (data.feedRemaining > 0) {
                data.feedRemaining = Math.max(0, data.feedRemaining - seconds);
                if (data.feedRemaining === 0 && data.delivered.length < order.length) data.intake = { ...order[data.delivered.length] };
            }
            if (data.repair.status === 'working') {
                data.repair.remaining = Math.max(0, data.repair.remaining - seconds);
                if (data.repair.remaining === 0) { data.repair.part.status = '正常'; data.repair.status = 'ready'; }
            }
        }
        function pickup(drone) {
            if (data.cargo) fail('夾具已有零件。先把它送到合適的操作口。', 'cargo-full');
            if (near(drone, 'intake')) {
                if (!data.intake) fail('取件台還沒有零件。使用「等待直到」確認零件到站。', 'intake-empty');
                data.cargo = data.intake; data.intake = null;
            } else if (near(drone, 'repair')) {
                if (data.repair.status !== 'ready') fail('維修尚未完成。啟動維修後，等待「維修完成？」成立才夾取。', 'repair-not-ready');
                data.cargo = data.repair.part;
                data.repair = { status: 'idle', part: null, remaining: 0 };
            } else fail('還未對準取件台或維修站。飛到標線內，高度保持 50–180 cm。', 'out-of-range');
            return data.cargo.id;
        }
        function drop(drone) {
            if (!data.cargo) fail('夾具是空的。先到取件台夾取一件零件。', 'cargo-empty');
            if (near(drone, 'repair')) {
                if (data.cargo.status !== '故障') fail('這件零件正常，請直接送到裝配站。', 'normal-to-repair');
                if (data.repair.status !== 'idle') fail('維修站已有零件，先完成並取回它。', 'repair-busy');
                data.repair = { status: 'loaded', part: data.cargo, remaining: 0 };
                data.cargo = null;
            } else if (near(drone, 'assembly')) {
                if (data.cargo.status !== '正常') fail('這件零件仍有故障，先送到維修站。', 'faulty-to-assembly');
                if (data.delivered.includes(data.cargo.id)) fail('這件零件已交付，不能重複計分。', 'duplicate');
                data.delivered.push(data.cargo.id); data.cargo = null;
                if (data.delivered.length < order.length) data.feedRemaining = C.feedSeconds;
            } else fail('還未對準維修站或裝配站。飛到標線內，高度保持 50–180 cm。', 'out-of-range');
        }
        function startRepair(drone) {
            if (!near(drone, 'repair')) fail('請飛近維修站的操作口再啟動維修。', 'out-of-range');
            if (data.repair.status !== 'loaded') fail('維修站需要先放入一件故障零件，而且不能重複啟動。', 'repair-not-loaded');
            data.repair.status = 'working'; data.repair.remaining = data.repair.part.repairSeconds;
        }
        function finish(drone) {
            if (data.completed) return false;
            const p = C.ports.goal;
            if (data.flew && data.delivered.length === order.length && !data.cargo && !drone.isFlying
                && drone.y >= 0 && drone.y <= 15 && Math.hypot(drone.x - p.x, drone.z - p.z) <= C.radius) {
                data.completed = true; return true;
            }
            return false;
        }
        function sensor(name) {
            switch (name) {
                case 'factory_intake_ready': return !!data.intake;
                case 'factory_cargo_status': return data.cargo ? data.cargo.status : '無零件';
                case 'factory_repair_ready': return data.repair.status === 'ready';
                case 'factory_delivered': return data.delivered.length;
                default: fail('不支援這個工廠偵測積木。', 'unknown-sensor');
            }
        }
        return { data, tick, pickup, drop, startRepair, finish, sensor,
            score: () => data.delivered.length * 100 + (data.completed ? 200 : 0) };
    }
    // Swept sphere approximated by an expanded AABB. Tests the complete movement segment,
    // so low frame rates and large distance blocks cannot tunnel through a building.
    function segmentHitsBox(a, b, box, radius = C.droneRadius) {
        let low = 0, high = 1;
        for (const axis of ['x', 'y', 'z']) {
            const min = box.min[axis] - radius, max = box.max[axis] + radius, delta = b[axis] - a[axis];
            if (Math.abs(delta) < 1e-10) { if (a[axis] < min || a[axis] > max) return false; }
            else {
                let t1 = (min - a[axis]) / delta, t2 = (max - a[axis]) / delta;
                if (t1 > t2) [t1, t2] = [t2, t1];
                low = Math.max(low, t1); high = Math.min(high, t2);
                if (low > high) return false;
            }
        }
        return true;
    }
    function canMove(a, b, obstacles = []) {
        const half = C.size / 2 - C.droneRadius;
        return Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.z)
            && Math.abs(b.x) <= half && Math.abs(b.z) <= half && b.y >= 0 && b.y <= C.flightLimit
            && !obstacles.some(box => segmentHitsBox(a, b, box));
    }
    return Object.freeze({ create, makeOrder, near, segmentHitsBox, canMove, MissionError });
});

/* Narrow adapter between the factory's rules/runtime and the existing Flight Deck. */
window.FactoryMission = (() => {
    let mission = null, view = null, lastFrame = 0, actionNumber = 0;
    const active = () => typeof currentSceneType !== 'undefined' && currentSceneType === 'factory';
    function cancelled(token) { return !token.isCurrent() || !active() || state.stopSignal; }
    function check(token) { if (cancelled(token)) throw new FactoryRuntime.ProgramError('執行已停止。'); }
    function stop() {
        flightProgramSession.cancel(); state.stopSignal = true; state.isRunning = false;
        executionDebug.paused = false; executionDebug.stepBudget = 0; releaseExecutionGate(); updatePauseButton();
        if (currentExecutingBlockId) highlightBlock(currentExecutingBlockId, false);
        currentExecutingBlockId = null;
        if (workspace) workspace.highlightBlock(null);
        if (window.FactoryUI) { FactoryUI.status('已停止', '飛行與夾具狀態已保留。可重設後再試。'); FactoryUI.sync(); }
    }
    function reset() {
        stop(); closeBriefing(); closeResultModal(); hideAppMessage(); clearConsole();
        mission = FactoryRules.create(mission ? mission.data.seed : 0, mission ? mission.data.order : undefined);
        cmdQueue = []; currentScore = 0; hasTakenOff = false; takeoffTime = 0;
        state.isFlying = false; state.missionCompleted = false; state.collisionDetected = false;
        syncDroneToStart(); lastFrame = performance.now();
        V2UI.resetFeedback(); FactoryUI.sync(); view.update(mission.data, state);
        logToConsole('工廠已重設，積木與訂單次序已保留。');
    }
    function newOrder() {
        if (!active() || state.isRunning || !mission) return;
        const seed = mission.data.seed + 1, order = FactoryRules.makeOrder(seed, mission.data.order);
        mission = FactoryRules.create(seed, order); reset();
        FactoryUI.status('新訂單已準備', '積木已保留，試用同一程式處理新訂單。');
    }
    function build() {
        view = FactoryScene.build(scene, environmentGroup);
        mission = FactoryRules.create();
        startPosition = { ...FactoryConfig.spawn }; spawnPosition = { ...FactoryConfig.spawn };
        targetPosition = { x: FactoryConfig.ports.goal.x, z: FactoryConfig.ports.goal.z };
        currentMazeGrid = null; lastFrame = performance.now();
        environmentGroup.userData.disposeFactory = () => { stop(); view.dispose(); view = null; mission = null; delete environmentGroup.userData.disposeFactory; };
        environmentGroup.userData.sceneVariant = 'factory';
    }
    function frame() {
        if (!active() || !mission || !view) return;
        const now = performance.now(), dt = lastFrame ? Math.max(0, now - lastFrame) / 1000 * executionSpeed : 0;
        lastFrame = now;
        if (document.getElementById('game-interface').style.display !== 'none') mission.tick(dt);
        currentScore = mission.score(); view.update(mission.data, state);
    }
    function sensor(type, fields = {}) {
        if (type.startsWith('factory_')) return mission.sensor(type);
        const unit = fields.UNIT || 'cm';
        let distance = Math.max(0, state.y);
        if (type === 'range' && fields.TYPE !== 'bottom') {
            const offset = fields.TYPE === 'left' ? 90 : fields.TYPE === 'right' ? -90 : 0;
            const rad = THREE.MathUtils.degToRad(state.heading + offset);
            const origin = new THREE.Vector3(state.x, state.y, state.z), dir = new THREE.Vector3(-Math.sin(rad), 0, -Math.cos(rad));
            const ray = new THREE.Ray(origin, dir), hit = new THREE.Vector3(); distance = 500;
            const walls = view.obstacles.concat([
                { min: { x: -1510, y: 0, z: -1510 }, max: { x: -1500, y: 1000, z: 1510 } },
                { min: { x: 1500, y: 0, z: -1510 }, max: { x: 1510, y: 1000, z: 1510 } },
                { min: { x: -1510, y: 0, z: -1510 }, max: { x: 1510, y: 1000, z: -1500 } },
                { min: { x: -1510, y: 0, z: 1500 }, max: { x: 1510, y: 1000, z: 1510 } }
            ]);
            for (const b of walls) if (ray.intersectBox(new THREE.Box3(new THREE.Vector3(b.min.x, b.min.y, b.min.z), new THREE.Vector3(b.max.x, b.max.y, b.max.z)), hit)) distance = Math.min(distance, origin.distanceTo(hit));
        }
        const factor = unit === 'mm' ? 10 : unit === 'm' ? .01 : unit === 'in' ? 1 / 2.54 : 1;
        return Math.round(distance * factor * 100) / 100;
    }
    async function sleep(seconds, token) {
        const end = performance.now() + seconds * 1000 / executionSpeed;
        do { check(token); await new Promise(resolve => setTimeout(resolve, Math.min(25, Math.max(0, end - performance.now())))); } while (performance.now() < end);
        check(token);
    }
    async function animate(seconds, update, token) {
        const begin = performance.now(), duration = Math.max(1, seconds * 1000 / executionSpeed);
        return new Promise((resolve, reject) => {
            function step(now) {
                try { check(token); const p = Math.min(1, (now - begin) / duration); update(p); if (p === 1) resolve(); else requestAnimationFrame(step); }
                catch (error) { reject(error); }
            }
            requestAnimationFrame(step);
        });
    }
    function numeric(value, name, min = 0, max = 10000) {
        const n = Number(value); if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name}請使用 ${min}–${max} 之間的數字。`); return n;
    }
    async function action(type, args, token) {
        check(token);
        if (type === 'drone_print') { logToConsole(String(args.TEXT)); return; }
        if (type === 'drone_takeoff') {
            if (state.isFlying) throw new Error('無人機已在空中，毋須再次起飛。');
            const y = state.y; await animate(1.5, p => { state.y = y + 80 * p; }, token);
            check(token); state.isFlying = true; hasTakenOff = true; mission.data.flew = true; if (!takeoffTime) takeoffTime = Date.now(); return;
        }
        if (!state.isFlying) throw new Error('先接上「起飛」，再操控無人機或夾具。');
        if (type === 'drone_land') {
            const from = { x: state.x, y: state.y, z: state.z };
            if (!FactoryRules.canMove(from, { ...from, y: 0 }, view.obstacles)) throw new Error('下方有機器，請移到清空的平台再降落。');
            await animate(1.5, p => { state.y = from.y * (1 - p); }, token); check(token); state.isFlying = false;
            if (mission.finish(state)) { state.missionCompleted = true; currentScore = mission.score(); }
            return;
        }
        if (type === 'factory_pickup' || type === 'factory_drop') {
            await sleep(.8, token); check(token);
            if (type === 'factory_pickup') mission.pickup(state); else mission.drop(state);
            currentScore = mission.score(); view.update(mission.data, state); return;
        }
        if (type === 'factory_start_repair') { mission.startRepair(state); return; }
        if (type === 'drone_turn_degree' || type === 'drone_turn' || type === 'drone_turn_heading') {
            const begin = state.heading, amount = numeric(args.DEGREE, '角度', -3600, 3600);
            const end = type === 'drone_turn_heading' ? amount : begin + amount * (args.DIR === 'LEFT' ? 1 : -1);
            await animate(1, p => { state.heading = begin + (end - begin) * p; }, token); return;
        }
        if (type === 'drone_move_cm' || type === 'drone_move_time') {
            const distance = type === 'drone_move_cm' ? numeric(args.DIST, '距離') : numeric(args.DURATION, '飛行時間', 0, 200) * 50 * numeric(args.POWER, '動力', 0, 100) / 100;
            const r = THREE.MathUtils.degToRad(state.heading), directions = {
                FORWARD: [-Math.sin(r), 0, -Math.cos(r)], BACKWARD: [Math.sin(r), 0, Math.cos(r)],
                LEFT: [-Math.cos(r), 0, Math.sin(r)], RIGHT: [Math.cos(r), 0, -Math.sin(r)], UP: [0, 1, 0], DOWN: [0, -1, 0]
            };
            const d = directions[args.DIR]; if (!d) throw new Error('請選擇有效飛行方向。');
            const start = { x: state.x, y: state.y, z: state.z };
            await animate(distance / 50, p => {
                const next = { x: start.x + d[0] * distance * p, y: start.y + d[1] * distance * p, z: start.z + d[2] * distance * p };
                if (!FactoryRules.canMove(state, next, view.obstacles)) { state.collisionDetected = true; throw new Error('航線碰到機器或場地邊界。沿標線通道飛行，高度不得超過 500 cm。'); }
                state.x = next.x; state.y = next.y; state.z = next.z; Object.assign(lastSafePos, next);
            }, token); return;
        }
        throw new Error('這個動作尚未支援，請使用工廠工具箱內的積木。');
    }
    async function run() {
        if (state.isRunning || !mission) return;
        if (mission.data.completed) { FactoryUI.status('本張訂單已完成', '重試或換一張訂單，再執行你的程式。'); return; }
        const ws = initBlockly(); if (!ws) return;
        let program;
        try { program = FactoryRuntime.snapshot(ws); }
        catch (error) { report(error); return; }
        const token = flightProgramSession.begin(); actionNumber = 0; state.stopSignal = false; state.isRunning = true; state.collisionDetected = false;
        executionDebug.paused = false; executionDebug.stepBudget = 0; updatePauseButton(); V2UI.prepareRun();
        let failure = null;
        try {
            await FactoryRuntime.execute(program, {
                shouldStop: () => cancelled(token), sensor, simulatedTime: () => mission.data.elapsed,
                sleep: seconds => sleep(seconds, token), delivered: () => mission.data.delivered.length,
                beforeBlock: async (node, count) => {
                    await waitForExecutionGate(node.id); check(token);
                    if (currentExecutingBlockId) highlightBlock(currentExecutingBlockId, false);
                    currentExecutingBlockId = node.id; highlightBlock(node.id, true);
                    executionDebug.currentIndex = count - 1; actionNumber = count; FactoryUI.command(node, count);
                },
                action: (type, args) => action(type, args, token),
                onLoop: (id, iteration, delivered) => {
                    if (delivered > 0) {
                        const entries = mission.data.learning.loopDeliveries[id] || (mission.data.learning.loopDeliveries[id] = []);
                        entries.push({ iteration, delivered });
                    }
                },
                onBranch: (id, result, reads) => {
                    if (reads.includes('factory_cargo_status')) mission.data.learning.branches.push({ id, result, cargoId: mission.data.cargo && mission.data.cargo.id });
                }
            });
            check(token);
            state.isRunning = false;
            if (mission.data.completed) { FactoryUI.status('任務完成', '六件合格零件已交付，救援裝配線重新運作。'); FactoryUI.result(mission.data); }
            else FactoryUI.status('程式執行完畢', `已交付 ${mission.data.delivered.length}/6。觀察現場；可重設保留積木再試。`);
        } catch (error) {
            if (token.isCurrent() && active()) { state.isRunning = false; if (!state.stopSignal) { failure = error; report(error); } }
        } finally {
            finishFlightProgram(token, () => {
                if (failure && failure.blockId && workspace) workspace.highlightBlock(failure.blockId);
                FactoryUI.sync();
            });
        }
    }
    function report(error) {
        if (error.blockId && workspace) { const block = workspace.getBlockById(error.blockId); if (block) { V2UI.setView(window.innerWidth < 1100 ? 'code' : 'split'); workspace.centerOnBlock(block.id); block.select(); workspace.highlightBlock(block.id); } }
        showAppMessage({ variant: 'warn', title: '這一步需要調整', body: error.message, nextStep: '積木與零件狀態已保留。查看提示，修改後可按重設再試。', focusClose: false });
        logToConsole(error.message); FactoryUI.status('有一步未能完成', error.message);
    }
    return { active, build, frame, reset, stop, run, newOrder, sensor,
        get data() { return mission && mission.data; }, get obstacles() { return view ? view.obstacles : []; }, get actionNumber() { return actionNumber; } };
})();

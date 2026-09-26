/* Storm Island domain rules. Pure, deterministic and independent of rendering. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.Mission3Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const BASE = Object.freeze({ x: -650, y: 14, z: 650, heading: 180 });
    const RELAYS = Object.freeze([
        Object.freeze({ id: 'A', name: '港口', x: -650, y: 100, z: -250 }),
        Object.freeze({ id: 'B', name: '城鎮', x: 100, y: 100, z: 200 }),
        Object.freeze({ id: 'C', name: '山區', x: 600, y: 340, z: -550 })
    ]);
    const STATES = Object.freeze({ 'test-a': [0, 1, 0], 'test-b': [1, 0, 0], 'test-c': [0, 0, 1], 'all-offline': [0, 0, 0] });
    function hash(seed) {
        let h = 2166136261;
        for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
        return h >>> 0;
    }
    function create(seed, testState) {
        const h = hash(seed);
        const preset = STATES[testState] || Object.values(STATES)[h % 4];
        return {
            seed: String(seed), phase: testState ? 0 : h % 24, seconds: 0, backup: 100,
            relays: RELAYS.map((r, i) => ({ ...r, active: !!preset[i], initiallyActive: !!preset[i], scanned: false, restored: false, activating: false })),
            started: false, completed: false, failure: '', distance: 0, exposure: 0,
            scans: 0, redundantScans: 0, redundantActivations: 0, unnecessaryMoves: 0,
            commands: 0, stormReads: 0, statusReads: 0, restored: 0, trace: []
        };
    }
    function relayAt(run, p) {
        return run.relays.find(r => Math.hypot(p.x-r.x, p.z-r.z) <= 85 && Math.abs(p.y-r.y) <= 65);
    }
    function storm(run) {
        const phase = (run.seconds + run.phase) % 24;
        return phase < 9 ? 85 : phase < 13 ? 45 : 15;
    }
    function inStorm(p) { return Math.hypot(p.x-600, p.z+550) < 290 && p.y > 80; }
    function advance(run, seconds, p) {
        if (!run.started || run.completed || run.failure) return;
        // Fixed integration resolution keeps exposure independent of display frame rate.
        for (let remaining=seconds; remaining>1e-8;) {
            const dt = Math.min(.05, remaining);
            if (inStorm(p) && storm(run) >= 70) run.exposure += dt;
            run.seconds += dt;
            remaining -= dt;
        }
        run.backup = run.relays.every(r => r.active) ? 100 : Math.max(0, 100-run.seconds/6);
        if (run.backup <= 0) run.failure = '醫療中心備用電源已耗盡。用迴圈檢查能源站，減少重複飛行後再試。';
        else if (run.exposure >= 30) run.failure = '累積暴露於危險風暴超過 30 秒。先在山區外等待感測值低於 70，再進入。';
    }
    function scan(run, p) {
        const r = relayAt(run, p);
        if (!r) return '未對準能源站：請在標記上方 65 cm 範圍內掃描。';
        run.scans++;
        if (r.scanned) run.redundantScans++;
        r.scanned = true;
        return `${r.id}：${r.active ? 'ACTIVE · 正常供電' : 'OFFLINE · 等待啟動'}`;
    }
    function status(run, p) {
        run.statusReads++;
        const r = relayAt(run, p);
        return !r || !r.scanned ? 'UNKNOWN' : r.active ? 'ACTIVE' : 'OFFLINE';
    }
    function activationIssue(run, p) {
        const r = relayAt(run,p);
        if (!r || !r.scanned) return '先飛到能源站並掃描，再判斷是否需要啟動。';
        if (r.active) { run.redundantActivations++; return '能源站已正常供電：這次啟動沒有作用。使用 IF 跳過 ACTIVE。'; }
        if (inStorm(p) && storm(run)>=70) return '風暴 DANGER：啟動被安全鎖阻止。等待後再次讀取感測器。';
        return '';
    }
    function activate(run,p) {
        const issue = activationIssue(run,p);
        if (issue) return issue;
        const r=relayAt(run,p);r.active=true;r.restored=true;r.activating=false;run.restored++;
        if(run.relays.every(item=>item.active))run.backup=100;
        return `${r.id} 已恢復供電。`;
    }
    function pending(run,p) {
        const unchecked=run.relays.filter(r=>!r.scanned).map(r=>r.id);
        const offline=run.relays.filter(r=>!r.active).map(r=>r.id);
        if(unchecked.length)return `尚未掃描能源站 ${unchecked.join('、')}。先掃描，再用 IF 判斷狀態。`;
        if(offline.length)return `能源站 ${offline.join('、')} 仍然離線。先判斷風暴，再啟動。`;
        if(Math.hypot(p.x-BASE.x,p.z-BASE.z)>85)return '全島已恢復供電；請返回 Drone Base，再使用降落積木。';
        return '已回到基地；使用降落積木完成交班。';
    }
    function land(run,p) {
        const success=run.started&&!run.failure&&run.relays.every(r=>r.active&&r.scanned)&&Math.hypot(p.x-BASE.x,p.z-BASE.z)<=85;
        if(success)run.completed=true;
        return success;
    }
    function score(run, structure) {
        const s=structure||{};
        const safety=Math.max(0,150-Math.round(run.exposure*5));
        const waste=run.redundantScans+run.redundantActivations+run.unnecessaryMoves;
        const efficiency=Math.max(0,Math.min(250,
            (s.loops ? 65 : 0)+(s.conditions&&run.statusReads ? 65 : 0)+(run.stormReads ? 45 : 0)
            +(s.variables ? 25 : 0)+50-Math.max(0,(s.duplicates||0)-2)*8-waste*12-Math.max(0,run.distance-4500)/60));
        const time=Math.max(0,100-Math.floor(Math.max(0,run.seconds-120)/3));
        return { total: run.completed ? 500+safety+Math.round(efficiency)+time : 0, safety, efficiency:Math.round(efficiency), time, waste };
    }
    return { BASE, RELAYS, STATES, create, hash, relayAt, storm, inStorm, advance, scan, status, activationIssue, activate, pending, land, score };
});

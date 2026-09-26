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
            seed: String(seed), phase: 0, seconds: 0, backup: 100,
            relays: RELAYS.map((r, i) => ({ ...r, active: !!preset[i], initiallyActive: !!preset[i], scanned: false, restored: false, activating: false })),
            started: false, completed: false, failure: '', distance: 0, exposure: 0,
            scans: 0, redundantScans: 0, redundantActivations: 0, unnecessaryMoves: 0,
            nextIndex: 0, stormWaits: 0, commands: 0, stormReads: 0, statusReads: 0, restored: 0, trace: []
        };
    }
    function relayAt(run, p) {
        return run.relays.find(r => Math.hypot(p.x-r.x, p.z-r.z) <= 85 && Math.abs(p.y-r.y) <= 65);
    }
    function storm(run) {
        // Only relay ON/OFF states vary. Weather follows the same two-state cycle every run.
        return run.seconds % 40 < 16 ? 85 : 15;
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
        // Medical backup is story context, never a countdown or failure in the normal mission.
        run.backup = 100;
    }
    function scan(run, p) {
        const r = relayAt(run, p);
        if (!r) return '先飛到能源站上方，再掃描。';
        run.scans++;
        if (r.scanned) run.redundantScans++;
        r.scanned = true;
        return `能源站 ${r.id} ${r.active ? '正常。可以前往下一站。' : '關了，需要啟動。'}`;
    }
    function status(run, p) {
        run.statusReads++;
        const r = relayAt(run, p);
        return !r || !r.scanned ? 'UNKNOWN' : r.active ? 'ACTIVE' : 'OFFLINE';
    }
    function activationIssue(run, p) {
        const r = relayAt(run,p);
        if (!r || !r.scanned) return '先掃描，看看能源站是不是關了。';
        if (r.active) { run.redundantActivations++; return '這個能源站已經正常，不需要再啟動。'; }
        return '';
    }
    function activate(run,p) {
        const issue = activationIssue(run,p);
        if (issue) return issue;
        const r=relayAt(run,p);r.active=true;r.restored=true;r.activating=false;run.restored++;
        if(run.relays.every(item=>item.active))run.backup=100;
        return `能源站 ${r.id} 亮起了！`;
    }
    function pending(run,p) {
        const unchecked=run.relays.filter(r=>!r.scanned).map(r=>r.id);
        const offline=run.relays.filter(r=>!r.active).map(r=>r.id);
        if(unchecked.length)return `還有 ${unchecked.length} 個能源站未掃描。修改積木，再按執行。`;
        if(offline.length)return `還有 ${offline.length} 個能源站沒有亮起。用「如果」判斷要不要啟動。`;
        if(Math.hypot(p.x-BASE.x,p.z-BASE.z)>85)return '小島恢復電力了！放「返回基地」，再放「降落」。';
        return '到基地了！放「降落」完成任務。';
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
            (s.loops ? 100 : 0)+(s.conditions&&run.statusReads ? 100 : 0)+50
            -Math.max(0,(s.duplicates||0)-2)*8-waste*12));
        // Time is reported for reflection only; thinking slowly never loses points.
        const time=100;
        return { total: run.completed ? 500+safety+Math.round(efficiency)+time : 0, safety, efficiency:Math.round(efficiency), time, waste };
    }
    return { BASE, RELAYS, STATES, create, hash, relayAt, storm, inStorm, advance, scan, status, activationIssue, activate, pending, land, score };
});

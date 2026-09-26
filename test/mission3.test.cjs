const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/mission3/core.js');
const Blockly=require('blockly/node'),{javascriptGenerator}=require('blockly/javascript');
Blockly.JavaScript=javascriptGenerator;
const scope={Blockly};vm.createContext(scope);
for(const file of ['js/blockly_def.js','js/mission3/blockly.js'])vm.runInContext(fs.readFileSync(file,'utf8'),scope);
function workspace(file='test/fixtures/mission3-reference.xml'){
    const ws=new Blockly.Workspace();Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(fs.readFileSync(file,'utf8')),ws);return ws;
}
async function simulate(ws,preset){
    const run=C.create('primary',preset);let p={...C.BASE},flying=false,printed;const commands=[];
    const code=scope.Mission3Blockly.compile(ws),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
    async function travel(target){
        // This harness exercises generated live decisions; browser QA covers real motion/collision.
        const from={...p};for(let i=1;i<=100;i++){p={x:from.x+(target.x-from.x)*i/100,y:520,z:from.z+(target.z-from.z)*i/100};C.advance(run,.05,p);}p={...target};
    }
    await new AsyncFunction('__command','__sense','__tick',code)(async cmd=>{
        commands.push(cmd.type);assert.ok(commands.length<600);
        if(cmd.type==='takeoff'){flying=true;run.started=true;p.y=100;C.advance(run,1.5,p);}
        if(cmd.type==='hover')C.advance(run,cmd.param,p);
        if(cmd.type==='m3_next'){
            assert.ok(flying);const target=C.RELAYS[run.nextIndex++];assert.ok(target);
            if(target.id==='C')while(C.storm(run)>=70)C.advance(run,.5,p);
            await travel(target);
        }
        if(cmd.type==='m3_travel')await travel(C.RELAYS[cmd.index-1]);
        if(cmd.type==='m3_scan'){C.advance(run,1,p);C.scan(run,p);}
        if(cmd.type==='m3_activate'){assert.equal(C.activationIssue(run,p),'');C.advance(run,2,p);C.activate(run,p);}
        if(cmd.type==='m3_return')await travel({...C.BASE,y:100});
        if(cmd.type==='print')printed=cmd.fn();
        if(cmd.type==='land'){flying=false;p={...C.BASE};C.land(run,p);}
    },type=>type==='storm'?(run.stormReads++,C.storm(run)):C.status(run,p),async()=>{});
    return {run,commands,flying,printed};
}
test('only relay states vary; weather, positions and rules stay the same for every seed',()=>{
    const states=new Set();
    for(let seed=0;seed<100;seed++){
        const run=C.create(seed);assert.deepEqual(run,C.create(seed));
        const pattern=run.relays.map(r=>r.active);states.add(pattern.join());assert.ok(pattern.includes(false));
        assert.equal(run.phase,0);assert.equal(C.storm(run),85);
        assert.deepEqual(run.relays.map(({x,y,z})=>({x,y,z})),C.RELAYS.map(({x,y,z})=>({x,y,z})));
        assert.notDeepEqual(C.create(String(seed)+'a').relays.map(r=>r.active),pattern);
    }
    assert.equal(states.size,4);
});
test('scan provides information; no blind activation or remote scan can complete a relay',()=>{
    const run=C.create('a','all-offline'),p=C.RELAYS[0];
    assert.equal(C.status(run,p),'UNKNOWN');assert.match(C.activate(run,p),/先掃描/);assert.equal(run.restored,0);
    assert.match(C.scan(run,C.BASE),/先飛到/);assert.equal(run.scans,0);
    assert.match(C.scan(run,p),/關了/);assert.equal(C.status(run,p),'OFFLINE');C.activate(run,p);assert.equal(C.status(run,p),'ACTIVE');
    C.activate(run,p);assert.equal(run.restored,1);assert.equal(run.redundantActivations,1);
});
test('storm has only safe/danger; sustained exposure is feedback, not a normal-path failure',()=>{
    const run=C.create(1,'all-offline');run.started=true;const values=new Set();
    for(let i=0;i<160;i++){values.add(C.storm(run));C.advance(run,1,C.RELAYS[2]);}
    assert.deepEqual([...values].sort(),[15,85]);assert.ok(run.exposure>30);assert.equal(run.failure,'');
    C.scan(run,C.RELAYS[2]);assert.equal(C.activationIssue(run,C.RELAYS[2]),'');C.activate(run,C.RELAYS[2]);assert.equal(run.restored,1);
});
test('learning time never drains medical backup or reduces the time score',()=>{
    const run=C.create(1,'all-offline');run.started=true;
    const before=C.score(run,{});C.advance(run,3600,C.BASE);
    assert.equal(run.backup,100);assert.equal(run.failure,'');assert.equal(C.score(run,{}).time,before.time);
});
test('early return, unscanned active station and remaining OFF station cannot complete',()=>{
    const r=C.create(1,'test-a');r.started=true;assert.equal(C.land(r,C.BASE),false);assert.match(C.pending(r,C.BASE),/未掃描/);
    r.relays.forEach(relay=>{relay.scanned=true;});assert.match(C.pending(r,C.BASE),/沒有亮起/);assert.equal(C.land(r,C.BASE),false);
    r.relays.forEach(relay=>{relay.active=true;});assert.equal(C.land(r,C.RELAYS[0]),false);assert.equal(C.land(r,C.BASE),true);
});
test('primary answer is a short Repeat + If + sensor, without variables, comparisons or nested loops',async()=>{
    for(const preset of Object.keys(C.STATES)){
        const ws=workspace();try{
            const blocks=ws.getAllBlocks(false),types=blocks.map(b=>b.type);
            assert.ok(blocks.length<=12);assert.equal(types.filter(t=>t==='controls_repeat_ext').length,1);
            assert.equal(types.filter(t=>t==='controls_if').length,1);assert.ok(types.includes('m3_needs_power'));
            assert.ok(!types.some(t=>/variables|math_change|logic_compare|controls_for|controls_while/.test(t)));
            const {run,commands,flying}=await simulate(ws,preset);
            assert.equal(run.completed,true,preset);assert.equal(run.scans,3);assert.equal(run.redundantActivations,0);assert.equal(flying,false);
            assert.equal(commands.filter(c=>c==='m3_next').length,3);assert.equal(run.restored,run.relays.filter(r=>!r.initiallyActive).length);
            assert.ok(C.score(run,scope.Mission3Blockly.structure(ws)).efficiency>C.score({...run,redundantActivations:4},{duplicates:12}).efficiency);
        }finally{ws.dispose();}
    }
});
test('variables remain optional: they are not required to earn full coding efficiency',()=>{
    const run=C.create(1);run.statusReads=3;
    const beginner=C.score(run,{loops:true,conditions:true});
    assert.equal(beginner.efficiency,250);assert.equal(C.score(run,{loops:true,conditions:true,variables:true}).efficiency,250);
});
test('previous XML with variables, indexed travel and numeric storm sensors still compiles and completes',async()=>{
    for(const preset of Object.keys(C.STATES)){
        const ws=workspace('test/fixtures/mission3-advanced-reference.xml');try{
            const {run,printed}=await simulate(ws,preset);assert.equal(run.completed,true);assert.equal(Number(printed),run.restored);
        }finally{ws.dispose();}
    }
});
test('async compilation restores every shared generator and loop trap',()=>{
    const ws=workspace(),original=javascriptGenerator.drone_takeoff,trap=javascriptGenerator.INFINITE_LOOP_TRAP;
    try{scope.Mission3Blockly.compile(ws);assert.equal(javascriptGenerator.drone_takeoff,original);assert.equal(javascriptGenerator.INFINITE_LOOP_TRAP,trap);
        const code=javascriptGenerator.workspaceToCode(ws);assert.match(code,/cmdQueue.push/);assert.doesNotMatch(code,/await __command/);
    }finally{ws.dispose();}
});
test('IF / ELSE and the boolean weather sensor choose live branches',async()=>{
    const ws=new Blockly.Workspace();Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom('<xml><block type="drone_takeoff"><next><block type="controls_if"><mutation else="1"/><value name="IF0"><block type="m3_storm_safe"/></value><statement name="DO0"><block type="m3_next"/></statement><statement name="ELSE"><block type="drone_hover"/></statement></block></next></block></xml>'),ws);
    try{const code=scope.Mission3Blockly.compile(ws),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
        for(const [weather,expected]of [[15,'m3_next'],[85,'hover']]){const commands=[];await new AsyncFunction('__command','__sense','__tick',code)(async c=>commands.push(c.type),()=>weather,async()=>{});assert.deepEqual(commands,['takeoff',expected]);}
    }finally{ws.dispose();}
});

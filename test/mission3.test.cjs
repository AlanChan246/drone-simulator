const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/mission3/core.js');
const Blockly=require('blockly/node'),{javascriptGenerator}=require('blockly/javascript');
Blockly.JavaScript=javascriptGenerator;
const scope={Blockly};vm.createContext(scope);
for(const file of ['js/blockly_def.js','js/mission3/blockly.js'])vm.runInContext(fs.readFileSync(file,'utf8'),scope);
function reference(){const ws=new Blockly.Workspace();Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(fs.readFileSync('test/fixtures/mission3-reference.xml','utf8')),ws);return ws;}
test('seeded states are reproducible, varied and always contain a repair objective',()=>{
    const states=new Set();
    for(let seed=0;seed<100;seed++){
        const run=C.create(seed);assert.deepEqual(run,C.create(seed));
        const pattern=run.relays.map(r=>r.active);states.add(pattern.join());assert.ok(pattern.includes(false));
        assert.ok(run.phase>=0&&run.phase<24);
        assert.notDeepEqual(C.create(String(seed)+'a').relays.map(r=>r.active),pattern,'fresh-run collision suffix must select a different pattern');
    }
    assert.equal(states.size,4);
});
test('scan is local, unknown before scanning, and activation cannot blindly repair',()=>{
    const run=C.create('a','all-offline'),p={...C.RELAYS[0]};
    assert.equal(C.status(run,p),'UNKNOWN');assert.match(C.activate(run,p),/掃描/);assert.equal(run.restored,0);
    C.scan(run,p);assert.equal(C.status(run,p),'OFFLINE');C.activate(run,p);assert.equal(C.status(run,p),'ACTIVE');
    C.activate(run,p);assert.equal(run.restored,1);assert.equal(run.redundantActivations,1);
    assert.match(C.scan(run,C.BASE),/未對準/);
});
test('storm has observable safe windows and unsafe exposure has a deterministic consequence',()=>{
    const run=C.create(1,'all-offline');run.started=true;const p=C.RELAYS[2];
    C.scan(run,p);assert.equal(C.storm(run),85);assert.match(C.activate(run,p),/DANGER/);
    C.advance(run,13.01,C.BASE);assert.equal(C.storm(run),15);assert.equal(run.exposure,0);
    C.activate(run,p);assert.equal(run.restored,1);
    C.advance(run,120,p);assert.match(run.failure,/風暴/);
});
test('backup drains only during started, unfinished simulation, and the grid restores it',()=>{
    const run=C.create(1,'all-offline');C.advance(run,600,C.BASE);assert.equal(run.backup,100);
    run.started=true;C.advance(run,300,C.BASE);assert.ok(Math.abs(run.backup-50)<1e-6);
    C.advance(run,301,C.BASE);assert.match(run.failure,/備用電源/);
});
test('early return, offline relay and unscanned active relay cannot complete',()=>{
    const r=C.create(1,'test-a');r.started=true;
    assert.equal(C.land(r,C.BASE),false);
    r.relays.forEach(relay=>{relay.active=true;});assert.equal(C.land(r,C.BASE),false);
    r.relays.forEach(relay=>{relay.scanned=true;});assert.equal(C.land(r,C.RELAYS[0]),false);
    assert.equal(C.land(r,C.BASE),true);
});
test('real Blockly reference makes live decisions and completes every reproducible state',async()=>{
    for(const preset of Object.keys(C.STATES))for(let phase=0;phase<24;phase++){
        const ws=reference(),run=C.create(1,preset);let p={...C.BASE},flying=false,printed;run.phase=phase;
        try{
            const code=scope.Mission3Blockly.compile(ws);
            const fn=new (Object.getPrototypeOf(async function(){}).constructor)('__command','__sense','__tick',code);
            const sense=type=>type==='storm'?(run.stormReads++,C.storm(run)):C.status(run,p);
            await fn(async cmd=>{
                run.commands++;
                if(cmd.type==='takeoff'){flying=true;run.started=true;C.advance(run,1.5,p);}
                if(cmd.type==='hover')C.advance(run,cmd.param,p);
                if(cmd.type==='m3_travel'){assert.ok(flying);C.advance(run,5,p);p={...C.RELAYS[cmd.index-1]};}
                if(cmd.type==='m3_scan'){C.advance(run,1,p);C.scan(run,p);}
                if(cmd.type==='m3_activate'){assert.equal(C.activationIssue(run,p),'');C.advance(run,2,p);C.activate(run,p);}
                if(cmd.type==='m3_return'){C.advance(run,5,p);p={...C.BASE};}
                if(cmd.type==='print')printed=cmd.fn();
                if(cmd.type==='land'){flying=false;C.land(run,p);}
            },sense,async()=>{});
            assert.equal(run.completed,true,preset+' phase '+phase);assert.equal(run.scans,3);assert.equal(run.redundantActivations,0);
            assert.equal(Number(printed),run.relays.filter(r=>!r.initiallyActive).length);
            assert.equal(run.failure,'');assert.equal(flying,false);
            const structure=scope.Mission3Blockly.structure(ws);
            assert.ok(C.score(run,structure).efficiency>C.score({...run,redundantActivations:4},{blocks:40,duplicates:12}).efficiency);
        }finally{ws.dispose();}
    }
});
test('async compile restores legacy generators, trap, and learner text remains literal',()=>{
    const ws=reference(),original=javascriptGenerator.drone_takeoff,trap=javascriptGenerator.INFINITE_LOOP_TRAP;
    scope.Mission3Blockly.compile(ws);assert.equal(javascriptGenerator.drone_takeoff,original);assert.equal(javascriptGenerator.INFINITE_LOOP_TRAP,trap);
    const code=javascriptGenerator.workspaceToCode(ws);assert.match(code,/cmdQueue.push/);assert.doesNotMatch(code,/await __command/);ws.dispose();
});
test('nested IF / ELSE evaluates fresh sensors and selects only the matching branch',async()=>{
    const ws=new Blockly.Workspace();
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(`<xml><block type="drone_takeoff"><next><block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="m3_status"/></value><value name="B"><block type="m3_status_value"/></value></block></value><statement name="DO0"><block type="controls_if"><mutation else="1"/><value name="IF0"><block type="logic_compare"><field name="OP">LT</field><value name="A"><block type="m3_storm"/></value><value name="B"><block type="math_number"><field name="NUM">70</field></block></value></block></value><statement name="DO0"><block type="m3_activate"/></statement><statement name="ELSE"><block type="drone_hover"/></statement></block></statement></block></next></block></xml>`),ws);
    try{
        const code=scope.Mission3Blockly.compile(ws),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
        for(const [status,storm,expected]of [['OFFLINE',15,'m3_activate'],['OFFLINE',85,'hover'],['ACTIVE',15,null]]){
            const commands=[];await new AsyncFunction('__command','__sense','__tick',code)(async c=>commands.push(c.type),type=>type==='storm'?storm:status,async()=>{});
            assert.deepEqual(commands,expected?['takeoff',expected]:['takeoff']);
        }
    }finally{ws.dispose();}
});

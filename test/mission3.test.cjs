const test=require('node:test'),assert=require('node:assert/strict');
const config=require('../js/mission3/config.js'),rules=require('../js/mission3/gates.js'),runtime=require('../js/mission3/runtime.js');
const p={x:-450,y:94,z:250};
function opened(){const m=rules.create(config.configuration());m.select(m.signal(p));m.send(p);for(let t=0;t<30;t++)m.tick(100);return m;}
test('gate rejects wrong channel, no-signal crossing and accepted-but-not-open crossing',()=>{
 const m=rules.create(config.configuration());assert.throws(()=>m.send(p),/要求頻道 B/);assert.throws(()=>m.move(p,{...p,z:50}),/尚未收到/);m.select('B');m.send(p);assert.equal(m.isOpen(),false);assert.throws(()=>m.move(p,{...p,z:50}),/太早/);
});
test('sensing has range/height limits; bypass/reverse/frame cannot complete a gate',()=>{
 const m=opened();assert.throws(()=>m.signal({...p,y:400}),/感測範圍/);m.move({...p,x:0},{...p,x:0,z:0});assert.equal(m.snapshot().completed,0);m.move({...p,z:50},p);assert.equal(m.snapshot().completed,0);assert.throws(()=>m.move({...p,x:-325},{...p,x:-325,z:50}),/門框/);m.move(p,{...p,z:50});assert.equal(m.snapshot().completed,1);
});
test('retry keeps exact configuration; each new challenge differs; hardcoding cannot cover configurations',()=>{
 const a=config.configuration('challenge',0),b=config.configuration('challenge',1);assert.notDeepEqual(a.gates.map(g=>g.signal),b.gates.map(g=>g.signal));const m=rules.create(a);m.select('C');m.reset();assert.deepEqual(m.snapshot().configuration,a);assert.equal(m.snapshot().completed,0);assert.throws(()=>rules.create(a).activate({...config.goal,isFlying:false}),/0\/3/);
 for(let j=0;j<6;j++)assert.deepEqual([...config.configuration('challenge',j).gates.map(g=>g.signal)].sort(),['A','B','C']);
});
test('all three gates and a landed core activation are required',()=>{
 const m=rules.create(config.configuration());for(const g of config.gates){const a={x:g.x-g.nx*100,y:g.base+94,z:g.z-g.nz*100},b={x:g.x+g.nx*100,y:g.base+94,z:g.z+g.nz*100};m.select(m.signal(a));m.send(a);for(let i=0;i<60;i++)m.tick(100);m.move(a,b);}
 assert.equal(m.snapshot().completed,3);assert.throws(()=>m.activate({...config.goal,isFlying:true}),/降落/);assert.throws(()=>m.activate({x:500,y:174,z:500,isFlying:false}),/降落/);m.activate({...config.goal,isFlying:false});assert.equal(m.snapshot().activated,true);
});
const exp=(type,fields={},inputs={})=>({type,fields,inputs,id:type});
test('runtime reads sensors after actions and supports live if/else and condition waiting',async()=>{
 let open=false,signal='A';const seen=[];
 const condition=exp('sky_channel_is',{CHANNEL:'B'}),set=exp('sky_set_channel',{CHANNEL:'B'});
 const branch=exp('controls_if',{}, {IF0:condition,DO0:set,ELSE:exp('sky_set_channel',{CHANNEL:'C'})});
 const send=exp('sky_send');branch.next=send;send.next=exp('sky_wait_until',{}, {CONDITION:exp('sky_gate_open')});
 const start=exp('drone_takeoff');start.next=branch;
 const s=await runtime.run({start,procedures:{}},{stopped:()=>false,step:async()=>{},sensor:k=>k==='signal'?signal:open,sleep:async()=>{open=true;},command:async c=>{seen.push(c);if(c.type==='takeoff')signal='B';}});
 assert.equal(seen[1].channel,'B');assert.equal(s.waits,1);assert.equal(open,true);
});
test('runtime yields, stops, and bounds an empty forever loop and impossible wait',async()=>{
 let yields=0;const io={stopped:()=>false,step:async()=>{},sensor:()=>false,sleep:async()=>{yields++;},command:async()=>{}};
 const forever=exp('controls_whileUntil',{MODE:'WHILE'},{BOOL:exp('logic_boolean',{BOOL:'TRUE'})});
 await assert.rejects(runtime.run({start:forever,procedures:{}},io),/條件一直未改變/);assert.equal(yields,200);
 await assert.rejects(runtime.run({start:exp('sky_wait_until',{}, {CONDITION:exp('sky_gate_open')}),procedures:{}},io),/等待條件/);
 await assert.rejects(runtime.run({start:forever,procedures:{}},{...io,stopped:()=>true}),/STOP/);
});
test('distance reading quantizes floating point drift at loop stopping boundaries',()=>{
 const m=rules.create(config.configuration());assert.equal(m.distance({...p,z:250.0000000000016}),100);
});
test('actual Blockly XML compiles into one event and a reusable conditional routine',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),Blockly=require('blockly/node'),{javascriptGenerator}=require('blockly/javascript');Blockly.JavaScript=javascriptGenerator;
 const context={Blockly,window:{}};vm.runInNewContext(fs.readFileSync('js/blockly_def.js','utf8'),context);vm.runInNewContext(fs.readFileSync('js/mission3/blocks.js','utf8'),context);
 const ws=new Blockly.Workspace();try{Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(require('../scripts/mission3-fixtures.cjs').solution()),ws);const p=runtime.compile(ws);assert.equal(p.start.type,'event_start');assert.equal(p.procedures['處理閘門'].type,'controls_if');assert.equal(p.procedures['處理閘門'].inputs.IF0.type,'sky_channel_is');}finally{ws.dispose();}
});
test('a fixed BAC sequence succeeds in Standard but fails five of the six Challenge configurations',()=>{
 function attempt(c){const m=rules.create(c);try{for(const [i,g] of c.gates.entries()){const p={x:g.x-g.nx*100,y:g.base+94,z:g.z-g.nz*100};m.select('BAC'[i]);m.send(p);for(let k=0;k<60;k++)m.tick(100);m.move(p,{...p,x:g.x+g.nx*100,z:g.z+g.nz*100});}return m.snapshot().completed===3;}catch{return false;}}
 assert.equal(attempt(config.configuration()),true);assert.equal(Array.from({length:6},(_,i)=>attempt(config.configuration('challenge',i))).filter(Boolean).length,1);
});

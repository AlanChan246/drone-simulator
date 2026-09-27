const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Blockly=require('blockly/node'),{javascriptGenerator}=require('blockly/javascript');Blockly.JavaScript=javascriptGenerator;
for(const file of ['js/blockly_def.js','js/factory/blocks.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),{Blockly});
const C=require('../js/factory/config.js'),Rules=require('../js/factory/rules.js'),Runtime=require('../js/factory/runtime.js'),F=require('../scripts/factory-fixtures.cjs');
function program(xml){const ws=new Blockly.Workspace();try{Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml),ws);return Runtime.snapshot(ws);}finally{ws.dispose();}}
function harness(seed=0,order){const rules=Rules.create(seed,order),drone={...C.spawn,isFlying:false};let stopped=false;
 const ports={shouldStop:()=>stopped,beforeBlock:async()=>{},sleep:async sec=>rules.tick(sec),sensor:name=>rules.sensor(name),delivered:()=>rules.data.delivered.length,onBranch:(...a)=>rules.data.learning.branches.push(a),onLoop:(id,i,n)=>{if(n)(rules.data.learning.loopDeliveries[id]??=[]).push(i);},
 action:async(type,args)=>{switch(type){case'drone_takeoff':drone.isFlying=true;drone.y+=80;rules.data.flew=true;break;case'drone_land':drone.y=0;drone.isFlying=false;rules.finish(drone);break;case'drone_move_cm':{const dist=+args.DIST,r=drone.heading*Math.PI/180;const d={FORWARD:[-Math.sin(r),-Math.cos(r)],BACKWARD:[Math.sin(r),Math.cos(r)],LEFT:[-Math.cos(r),Math.sin(r)],RIGHT:[Math.cos(r),-Math.sin(r)]}[args.DIR];drone.x+=d[0]*dist;drone.z+=d[1]*dist;rules.tick(dist/50);break;}case'factory_pickup':rules.pickup(drone);break;case'factory_drop':rules.drop(drone);break;case'factory_start_repair':rules.startRepair(drone);break;default:throw Error(type);}}};return{rules,drone,ports,stop:()=>{stopped=true;}};}
const at=name=>({...C.ports[name],y:94,isFlying:true});
test('real Blockly reference uses live branches and loops and solves every three-fault permutation',async()=>{
 const p=program(F.reference());let orders=0;
 for(let mask=0;mask<64;mask++)if(mask.toString(2).replaceAll('0','').length===3){const order=Array.from({length:6},(_,i)=>({id:'p'+i,status:mask&(1<<i)?'故障':'正常',repairSeconds:[6,9,12][i%3]}));const h=harness(mask,order);await Runtime.execute(p,h.ports);assert.equal(h.rules.score(),800);assert.equal(h.rules.data.delivered.length,6);assert.ok(h.rules.data.learning.branches.some(x=>x[1]));assert.ok(h.rules.data.learning.branches.some(x=>!x[1]));orders++;}
 assert.equal(orders,20);
});
test('unrolled and no-argument function programs remain valid ways to finish',async()=>{for(const opts of [{unrolled:true},{procedures:true}]){const h=harness();await Runtime.execute(program(F.reference(opts)),h.ports);assert.equal(h.rules.score(),800);if(opts.unrolled)assert.deepEqual(h.rules.data.learning.loopDeliveries,{});}});
test('fixed status sequence cannot solve a changed order; flying alone never completes',async()=>{
 const fixed=program(F.reference({hardcoded:true}));const order=Rules.makeOrder(1);const h=harness(1,order);await assert.rejects(Runtime.execute(fixed,h.ports));assert.equal(h.rules.data.completed,false);
 const flight=harness();flight.rules.data.flew=true;assert.equal(flight.rules.finish({...C.ports.goal,y:0,isFlying:false}),false);
});
test('order seeds are reproducible, mixed and never repeat the previous permutation',()=>{let prev=Rules.makeOrder();assert.deepEqual(prev.map(x=>x.status),C.initialOrder);for(let s=1;s<60;s++){const next=Rules.makeOrder(s,prev);assert.deepEqual(next,Rules.makeOrder(s,prev));assert.equal(next.filter(x=>x.status==='故障').length,3);assert.notDeepEqual(next.map(x=>x.status),prev.map(x=>x.status));prev=next;}});
test('station errors preserve the part and disallow remote or duplicate actions',()=>{
 const h=harness();h.rules.tick(3);assert.throws(()=>h.rules.pickup({x:0,z:0,y:94,isFlying:true}),/對準/);h.rules.pickup(at('intake'));const id=h.rules.data.cargo.id;
 assert.throws(()=>h.rules.pickup(at('intake')),/已有/);assert.throws(()=>h.rules.drop(at('repair')),/正常/);assert.equal(h.rules.data.cargo.id,id);
 h.rules.drop(at('assembly'));assert.equal(h.rules.score(),100);assert.throws(()=>h.rules.drop(at('assembly')),/空/);assert.equal(h.rules.score(),100);
 h.rules.tick(3);h.rules.pickup(at('intake'));assert.throws(()=>h.rules.drop(at('assembly')),/故障/);h.rules.drop(at('repair'));
 assert.throws(()=>h.rules.pickup(at('repair')),/尚未完成/);h.rules.startRepair(at('repair'));assert.throws(()=>h.rules.startRepair(at('repair')),/重複/);h.rules.tick(30);h.rules.pickup(at('repair'));assert.equal(h.rules.sensor('factory_cargo_status'),'正常');
});
test('operation boundaries and completion require genuine flight and final landing',()=>{
 assert.equal(Rules.near({...at('intake'),x:100,y:50},'intake'),true);assert.equal(Rules.near({...at('intake'),x:100.01},'intake'),false);assert.equal(Rules.near({...at('intake'),y:181},'intake'),false);
 const r=Rules.create();r.data.delivered=r.data.order.map(p=>p.id);assert.equal(r.finish({...C.ports.goal,y:0,isFlying:false}),false);r.data.flew=true;assert.equal(r.finish({...C.ports.goal,y:94,isFlying:true}),false);assert.equal(r.finish({...C.ports.goal,y:0,isFlying:false}),true);assert.equal(r.score(),800);assert.equal(r.finish({...C.ports.goal,y:0,isFlying:false}),false);
});
test('movement segments cannot tunnel through machines, the boundary or ceiling',()=>{const a={x:0,y:94,z:0},b={x:800,y:94,z:0},boxes=[{min:{x:300,y:0,z:-100},max:{x:400,y:300,z:100}}];assert.equal(Rules.canMove(a,b,boxes),false);assert.equal(Rules.canMove(a,{x:800,y:94,z:400},boxes),true);assert.equal(Rules.canMove(a,{x:2000,y:94,z:0}),false);assert.equal(Rules.canMove(a,{x:0,y:501,z:0}),false);});
test('unsupported, goto, empty expressions and missing start fail before execution',()=>{
 for(const xml of [F.xml([F.b('event_start'),F.b('drone_goto_xyz')]),F.xml([F.b('event_start'),F.b('factory_if_else')]),F.xml([F.b('drone_takeoff')])])assert.throws(()=>program(xml));
});
test('waiting rereads live state, guards false conditions, and responds to stop',async()=>{
 const source=F.xml([F.b('event_start'),F.waitFor('factory_intake_ready')]);const h=harness();await Runtime.execute(program(source),h.ports);assert.ok(h.rules.data.intake);
 const stuck=harness();stuck.ports.sensor=()=>false;await assert.rejects(Runtime.execute(program(source),stuck.ports),/60/);
 const stop=harness();stop.ports.sleep=async()=>stop.stop();await assert.rejects(Runtime.execute(program(source),stop.ports),/停止/);
});
test('variable changes and arithmetic execute in order inside loops',async()=>{
 const v='counter';const source=F.xml([F.b('event_start'),F.b('variables_set',F.field('VAR',v)+F.value('VALUE',F.num(0))),F.b('factory_repeat',F.value('TIMES',F.num(3))+`<statement name="DO">${F.chain([F.b('math_change',F.field('VAR',v)+F.value('DELTA',F.num(2)))])}</statement>`)]);
 const h=harness();const result=await Runtime.execute(program(source),h.ports);assert.ok(Object.values(result.variables).includes(6));
});
test('until condition reads updated delivery state, and no part means exactly 無零件',async()=>{
 const original=F.reference();const repeatStart='<block type="factory_repeat"';const src=original.replace(repeatStart,'<block type="factory_until"').replace(/<value name="TIMES">[\s\S]*?<\/value>/,'<value name="BOOL"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="factory_delivered"/></value><value name="B"><shadow type="math_number"><field name="NUM">6</field></shadow></value></block></value>');
 const h=harness();assert.equal(h.rules.sensor('factory_cargo_status'),'無零件');const p=program(src);assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.start));await Runtime.execute(p,h.ports);assert.equal(h.rules.score(),800);
});
test('wait timeout measures elapsed simulation time even if a delayed timer skips frames',async()=>{
 const h=harness();h.ports.sensor=()=>false;h.ports.simulatedTime=()=>h.rules.data.elapsed;h.ports.sleep=async()=>h.rules.tick(20);await assert.rejects(Runtime.execute(program(F.xml([F.b('event_start'),F.waitFor('factory_repair_ready')])),h.ports),/60/);assert.equal(h.rules.data.elapsed,60);
});
test('part ID deduplication prevents score replay independently of an empty gripper',()=>{
 const r=Rules.create();r.tick(3);r.pickup(at('intake'));const part={...r.data.cargo};r.drop(at('assembly'));r.data.cargo=part;assert.throws(()=>r.drop(at('assembly')),/重複計分/);assert.equal(r.score(),100);
});
test('historical factory integration evidence remains immutable',()=>{
 const crypto=require('node:crypto');const hooks=fs.readFileSync('audit/factory/integration-hooks.json');assert.equal(crypto.createHash('sha256').update(hooks).digest('hex'),'507dc7a6c1bbdba9952e5ca532240f5c43b8ebb12d4bd9914944230735185fce');
});

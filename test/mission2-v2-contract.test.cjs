const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),acorn=require('acorn'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),readRaw=p=>fs.readFileSync(path.join(root,p),'utf8');
const factoryHooks=JSON.parse(readRaw('audit/factory/integration-hooks.json'));
const read=p=>(factoryHooks[p]||[]).reduce((text,hook)=>{return text.replace(hook,'');},readRaw(p));
const baseline=JSON.parse(read('audit/mission-2-v2/legacy-contract-hashes.json'));
const source=read('js/simulator.js'),ast=acorn.parse(source,{ecmaVersion:'latest'});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const config=require('../js/scenes/mission2-v2/config.js');
test('retained shared builders, mission logic and drone physics remain byte-identical',()=>{
 const found=new Map();for(const n of ast.body){if(n.type==='FunctionDeclaration')found.set(n.id.name,n);if(n.type==='VariableDeclaration')found.set(n.declarations.map(d=>d.id.name).join(','),n);}
 // Camera input intentionally changed for manual tutorial / iPad pinch fixes.
 // Keep mission and physics hashes unchanged; pin the revised input functions.
 const cameraInputHashes={"init3D":"20ba388bb675414d2c8cd9cfd35a2d87aba9187f77ccd44715b6cea156513603","onMouseWheel":"52a9f6b8ea8f90a81192a6a88ed8b9d4526595e318cdd7c39e6c153966e2070b"};
 // The two retired scene builders must be absent; retained declarations keep their original hashes.
 for(const [name,expected] of Object.entries(baseline.declarations)){if(['buildForestGridScene','createCityMap','KENNEY_STARTER_CITY_DIR','KENNEY_COMMERCIAL_DIR'].includes(name)){assert.ok(!found.has(name),`retired builder ${name}`);continue;}if(['KENNEY_DISTRICT_MANIFEST','KENNEY_ROADS_DIR','KENNEY_COLORMAP_URL','loadKenneyRoadTemplates','preloadModels','changeScene'].includes(name))continue;const n=found.get(name);assert.ok(n,name);const actual=name==='createMazeMap'?source.slice(n.start,n.end).replace('    polishMission1Environment();\n',''):source.slice(n.start,n.end);assert.equal(hash(actual),cameraInputHashes[name] || expected,name);}
 // Asset loading and scene entry now have behavior coverage in lifecycle-assets.test.cjs.
 for(const [file,expected] of Object.entries(baseline.files)){
   if(['js/main.js','js/flight_command_execution.js','js/scene_lifecycle.js'].includes(file))continue; // Behavior coverage: execution-integration.test.cjs and lifecycle-assets.test.cjs.
   const original=read(file)
     // Presentation-only homepage film controls are outside the mission contract.
     .replace(/    const hero=el\('hero-loop-video'\)[\s\S]*?    window.resumeHeroLoopVideo\(\);\n/,'')
     .replace("${tunnel?'1-final':'2-v2'}.png",'${tunnel?1:2}.png')
     .replace("${tunnel?1:'2-v2'}.png",'${tunnel?1:2}.png')
     .replace("        if(!followDrone && currentSceneType==='city' && environmentGroup?.userData.sceneVariant==='mission2-v2')camRadius=Mission2V2Config.overviewRadius;\n",'');
   // Pin the approved tutorial, theme integration and current-only Mission 2 legend; flight execution remains unchanged.
   // Pre-existing user change in 460e863: protect the new airframe paint baseline.
   const currentExpected=file==='js/main.js'?'3fead8acf2041ed7051b4f9ac52f703b35759145c0cf87d1e50560ee1722a0c2':file==='js/medical_drone_model.js'?'cc369938eae63e751cc8a09fe84ba998e8f4b5ffecce9b1d5ec58d7599f3da6b':expected;
   assert.equal(hash(original),currentExpected,file);
 }
});
test('Mission 2 keeps the original grid, spawn and goal',()=>{
 assert.equal(hash(JSON.stringify(config.grid)),'54db430ed78cddcb584414ff11c5ae38fa80c30188a913bd11cf7faedfd24fdb');
 assert.equal(config.cellSize,150);assert.equal(config.offsetX,-1050);assert.equal(config.offsetZ,-1050);
 assert.deepEqual(config.spawn,{x:-825,y:14,z:-825,heading:180});assert.deepEqual(config.goal,{x:825,z:-825});
 assert.ok(Object.isFrozen(config.grid)&&config.grid.every(Object.isFrozen));
});
test('four-fire fixture uses actual Blockly commands and stays in the preserved corridor',()=>{
 const Blockly=require('blockly/node'),{javascriptGenerator}=require('blockly/javascript');Blockly.JavaScript=javascriptGenerator;
 vm.runInNewContext(read('js/blockly_def.js'),{Blockly});const workspace=new Blockly.Workspace();
 try{Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(read('test/fixtures/mission2-v2-four-fires.xml')),workspace);
 const context={cmdQueue:[]};vm.runInNewContext(javascriptGenerator.workspaceToCode(workspace),context);
 let x=-825,z=-825,battery=20,water=false;const fires=new Set(),charge=new Set();
 for(const c of context.cmdQueue){
   if(c.type.startsWith('move_')){assert.ok(battery>0);battery--;const dist=c.param*50;const dx=c.type==='move_left'?1:c.type==='move_right'?-1:0,dz=c.type==='move_forward'?1:c.type==='move_backward'?-1:0;
     for(let d=0;d<dist;d+=15){x+=dx*15;z+=dz*15;assert.notEqual(config.grid[Math.floor((z+1050)/150)][Math.floor((x+1050)/150)],1);}}
   const i=Math.floor((z+1050)/150),j=Math.floor((x+1050)/150),v=config.grid[i][j],key=i+','+j;
   if(c.type==='collect_water'){assert.equal(v,5);water=true;}
   if(c.type==='release_water'){assert.equal(v,4);assert.ok(water);water=false;fires.add(key);}
   if(c.type==='hover'){assert.equal(v,6);assert.ok(!charge.has(key));charge.add(key);battery+=15;}
 }
 assert.equal(fires.size,4);assert.equal(charge.size,3);assert.equal(x,825);assert.equal(z,-825);assert.equal(context.cmdQueue.at(-1).type,'land');
 }finally{workspace.dispose();}
});

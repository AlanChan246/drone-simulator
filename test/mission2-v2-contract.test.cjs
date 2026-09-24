const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),acorn=require('acorn'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const baseline=JSON.parse(read('audit/mission-2-v2/legacy-contract-hashes.json'));
const source=read('js/simulator.js'),ast=acorn.parse(source,{ecmaVersion:'latest'});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const config=require('../js/scenes/mission2-v2/config.js');
test('legacy builders, all mission logic and drone physics remain byte-identical',()=>{
 const found=new Map();for(const n of ast.body){if(n.type==='FunctionDeclaration')found.set(n.id.name,n);if(n.type==='VariableDeclaration')found.set(n.declarations.map(d=>d.id.name).join(','),n);}
 // Only the approved Mission 1 visual hook is excluded; every old statement remains protected.
 for(const [name,expected] of Object.entries(baseline.declarations)){const n=found.get(name);assert.ok(n,name);const actual=name==='createMazeMap'?source.slice(n.start,n.end).replace('    polishMission1Environment();\n',''):source.slice(n.start,n.end);assert.equal(hash(actual),expected,name);}
 for(const [file,expected] of Object.entries(baseline.files)){
   const original=read(file)
     // Presentation-only homepage film controls are outside the mission contract.
     .replace(/    const hero=el\('hero-loop-video'\)[\s\S]*?    window.resumeHeroLoopVideo\(\);\n/,'')
     .replace("${tunnel?'1-final':'2-v2'}.png",'${tunnel?1:2}.png')
     .replace("${tunnel?1:'2-v2'}.png",'${tunnel?1:2}.png')
     .replace("        if(!followDrone && currentSceneType==='city' && environmentGroup?.userData.sceneVariant==='mission2-v2')camRadius=Mission2V2Config.overviewRadius;\n",'')
     .replace("    if (environmentGroup?.userData.sceneVariant === 'mission2-v2') return renderBriefMapLegend(Mission2V2Config.legend);\n",'');
   // Pre-existing user change in 460e863: protect the new airframe paint baseline.
   const currentExpected=file==='js/medical_drone_model.js'?'cc369938eae63e751cc8a09fe84ba998e8f4b5ffecce9b1d5ec58d7599f3da6b':expected;
   assert.equal(hash(original),currentExpected,file);
 }
});
test('independent v2 grid exactly matches the actual Legacy builder',()=>{
 const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='createCityMap');
 let grid;vm.runInNewContext(source.slice(n.start,n.end)+';createCityMap();',{buildForestGridScene:g=>{grid=JSON.parse(JSON.stringify(g));}});
 assert.deepEqual(config.grid,grid);assert.equal(config.cellSize,150);assert.equal(config.offsetX,-1050);assert.equal(config.offsetZ,-1050);
 assert.deepEqual(config.spawn,{x:-825,y:14,z:-825,heading:180});assert.deepEqual(config.goal,{x:825,z:-825});
 assert.ok(Object.isFrozen(config.grid)&&config.grid.every(Object.isFrozen));
});
test('v2 is the default; explicit Legacy query preserves rollback',()=>{
 const context={Mission2V2Config:config,URLSearchParams};vm.runInNewContext(read('js/scenes/mission2-v2/environment.js'),context);
 for(const query of ['','?scene=city','?scene=mission2-v2','?scene=mission1-v2'])assert.equal(context.Mission2V2.selected(query),true);
 assert.equal(context.Mission2V2.selected('?scene=mission2-legacy'),false);
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

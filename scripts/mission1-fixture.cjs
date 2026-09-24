const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),acorn=require('acorn');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/simulator.js'),'utf8');
const ast=acorn.parse(source,{ecmaVersion:'latest'});
const builder=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='createMazeMap');
const gridNode=builder.body.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name==='mazeGrid').declarations[0].init;
const grid=vm.runInNewContext(source.slice(gridNode.start,gridNode.end));
let blocksReady=false;
function commands(file){const Blockly=require('blockly/node'),{javascriptGenerator}=require('blockly/javascript');Blockly.JavaScript=javascriptGenerator;
 if(!blocksReady){vm.runInNewContext(fs.readFileSync(path.join(root,'js/blockly_def.js'),'utf8'),{Blockly});blocksReady=true;}const workspace=new Blockly.Workspace();
 try{Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(fs.readFileSync(path.join(root,'test/fixtures',file),'utf8')),workspace);const context={cmdQueue:[]};vm.runInNewContext(javascriptGenerator.workspaceToCode(workspace),context);return context.cmdQueue;}finally{workspace.dispose();}}
function validate(file){let x=-675,z=-675;const visited=new Set(),inspections=new Set();
 const record=()=>{const i=Math.floor((z+900)/150),j=Math.floor((x+900)/150);if(!grid[i]||grid[i][j]===undefined||grid[i][j]===1)throw Error(`Blocked route at ${i},${j}`);visited.add(`${i},${j}`);return [i,j];};record();
 const program=commands(file);
 for(const c of program){if(c.type.startsWith('move_')){const distance=c.param*50;const dx=c.type==='move_left'?1:c.type==='move_right'?-1:0,dz=c.type==='move_forward'?1:c.type==='move_backward'?-1:0;for(let n=0;n<distance;n+=15){x+=dx*15;z+=dz*15;record();}}
 if(c.type==='hover'){const [i,j]=record();if(grid[i][j]!==4||c.param<3)throw Error('Invalid inspection hover');inspections.add(`${i},${j}`);}}
 if(x!==825||z!==675||program.at(-1).type!=='land')throw Error('Route does not land at Bravo');
 return {commands:program.length,visited:visited.size,inspections:[...inspections],end:{x,z}};}
module.exports={grid,commands,validate,source,ast};

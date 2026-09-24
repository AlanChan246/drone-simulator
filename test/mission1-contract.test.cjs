const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {grid,validate,source,ast}=require('../scripts/mission1-fixture.cjs');
function context(){const scope={state:{x:-675,y:50,z:-675,isFlying:true,missionCompleted:false},currentMazeGrid:grid,currentCellSize:150,mazeOffsetX:-900,mazeOffsetZ:-900,
 visitedWalkableCells:new Set(),tunnelStartCell:{i:1,j:1},tunnelGoalCell:{i:10,j:11},TUNNEL_LEGIT_PATROL_HEIGHT_CM:150,TUNNEL_MISSION_EXIT_MAX_ALT_CM:120,
 TUNNEL_INSPECTION_HOVER_RADIUS_CM:70,TUNNEL_INSPECTION_HOVER_ALT_CM:50,TUNNEL_INSPECTION_HOVER_ALT_TOLERANCE_CM:45,
 TUNNEL_MISSION_TIME_TIERS:[{maxSec:60,bonus:500},{maxSec:90,bonus:350},{maxSec:120,bonus:200},{maxSec:180,bonus:80}],isTunnelMissionScene:()=>true};
 const names=['isWalkableGridVal','getDroneGridCell','recordTunnelPatrolVisit','isVisitedPathConnectedStartToGoal','evaluateTunnelMissionCompletion','isDroneOnInspectionBeacon','getTunnelMissionTimeBonus'];
 vm.createContext(scope);for(const name of names){const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);vm.runInContext(source.slice(n.start,n.end),scope);}return scope;}
test('both real Blockly routes reach Bravo; three inspections remain optional',()=>{
 const full=validate('mission1-inspections.xml'),direct=validate('mission1-direct.xml');assert.equal(full.inspections.length,3);assert.equal(direct.inspections.length,0);
});
test('completion requires a connected low-altitude route and an actual landing',()=>{
 const c=context();c.state.x=825;c.state.z=675;c.state.isFlying=false;
 assert.equal(c.evaluateTunnelMissionCompletion().reason,'invalid_path');
 // A disconnected collection of start and goal cannot finish.
 c.visitedWalkableCells=new Set(['1,1','10,11']);assert.equal(c.evaluateTunnelMissionCompletion().reason,'invalid_path');
 // All walkable cells form a connected route, independent of inspection state.
 grid.forEach((row,i)=>row.forEach((v,j)=>{if(v!==1)c.visitedWalkableCells.add(`${i},${j}`);}));
 assert.equal(c.evaluateTunnelMissionCompletion().ok,true);c.state.isFlying=true;assert.equal(c.evaluateTunnelMissionCompletion().reason,'still_flying');
 c.state.isFlying=false;c.state.y=121;assert.equal(c.evaluateTunnelMissionCompletion().reason,'too_high');c.state.y=50;c.state.x=-675;assert.equal(c.evaluateTunnelMissionCompletion().reason,'not_on_bravo');
});
test('patrol height and inspection boundaries preserve strict tolerances',()=>{
 const c=context();c.state.y=151;c.recordTunnelPatrolVisit();assert.equal(c.visitedWalkableCells.size,0);c.state.y=150;c.recordTunnelPatrolVisit();assert.equal(c.visitedWalkableCells.size,1);
 const b={x:-675,z:-675};c.state.y=50;assert.ok(c.isDroneOnInspectionBeacon(b));c.state.x=-605;assert.equal(c.isDroneOnInspectionBeacon(b),false);c.state.x=-675;c.state.y=95;assert.equal(c.isDroneOnInspectionBeacon(b),false);c.state.y=94;assert.ok(c.isDroneOnInspectionBeacon(b));
});
test('time bonus boundaries do not change',()=>{const c=context();for(const [sec,bonus]of [[60,500],[61,350],[90,350],[91,200],[120,200],[121,80],[180,80],[181,0]])assert.equal(c.getTunnelMissionTimeBonus(sec).bonus,bonus);});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),acorn=require('acorn');
const execution=require('../js/flight_command_execution.js');
const source=fs.readFileSync('js/main.js','utf8'),nodes=acorn.parse(source,{ecmaVersion:'latest'}).body;
function inject(c,names){for(const name of names){const n=nodes.find(n=>n.id?.name===name);assert.ok(n,name);vm.runInContext(source.slice(n.start,n.end),c);}}
function base(extra={}){return vm.createContext({FlightCommandExecution:execution,flightProgramSession:execution.createSession(),state:{isRunning:false,stopSignal:false,isFlying:false},executionDebug:{currentIndex:-1},currentExecutingBlockId:null,
 currentGameMode:'freeplay',currentSceneType:'tunnel',cmdQueue:[],commandToBlockMap:new Map(),window:{},
 updateProgress(){},highlightBlock(){},waitForExecutionGate:async()=>{},isCityMissionScene:()=>false,reportRuntimeIssue(){},console:{log(){},warn(){}},...extra});}

test('queue completion runs on failure and rejects without executing later commands',async()=>{
 const seen=[];let completed;
 await assert.rejects(execution.runQueue([1,2],{shouldStop:()=>false,executeCommand:async n=>{seen.push(n);throw Error('broken');},onComplete:r=>completed=r}),/broken/);
 assert.deepEqual(seen,[1]);assert.equal(completed.completed,0);assert.match(completed.error.message,/broken/);
});
test('actual queue adapter cannot finish or dispatch more commands after stop and immediate restart',async()=>{
 const pending=[],seen=[];const c=base({dispatchCommand:cmd=>{seen.push(cmd.type);return new Promise(r=>pending.push(r));}});
 inject(c,['finishFlightProgram','executeQueue']);c.state.isFlying=true;
 c.cmdQueue=[{type:'move_forward'},{type:'land'}];const first=c.executeQueue();await new Promise(setImmediate);
 c.flightProgramSession.cancel();c.cmdQueue=[{type:'move_left'}];const second=c.executeQueue();await new Promise(setImmediate);
 pending[0]();await first;assert.equal(c.state.isRunning,true);assert.deepEqual(seen,['move_forward','move_left']);
 pending[1]();await second;assert.equal(c.state.isRunning,false);
});
test('actual collect-water wait cannot refill a newer run after cancellation',async()=>{
 let release;const c=base({executionSpeed:1,setTimeout:r=>release=r,findCityInteractionCell:()=>({i:1,j:1}),logToConsole(){},updateHUD(){}});
 inject(c,['dispatchCollectWater']);c.flightProgramSession.begin();const pending=c.dispatchCollectWater();
 c.flightProgramSession.cancel();c.flightProgramSession.begin();c.state.hasWater=false;release();
 await assert.rejects(pending,execution.CancelledError);assert.equal(c.state.hasWater,false);
});
test('actual takeoff animation rejects stale frames before changing the new flight',async()=>{
 const frames=[];const c=base({performance:{now:()=>0},executionSpeed:1,requestAnimationFrame:fn=>frames.push(fn)});
 inject(c,['animateAction']);c.flightProgramSession.begin();let updates=0;
 const pending=c.animateAction(1,()=>updates++);c.flightProgramSession.cancel();c.flightProgramSession.begin();frames.shift()(100);
 await assert.rejects(pending,execution.CancelledError);assert.equal(updates,0);
});
test('factory adapter shares execution cancellation and stale finally cannot stop a newer run',async()=>{
 const pending=[];const c=base({currentSceneType:'factory',workspace:{highlightBlock(){}},initBlockly:()=>({}),releaseExecutionGate(){},updatePauseButton(){},
 performance:{now:()=>0},scene:{},environmentGroup:{userData:{}},FactoryConfig:{spawn:{x:0,y:14,z:0},ports:{goal:{x:0,z:0}}},
 FactoryScene:{build:()=>({dispose(){},update(){}})},FactoryRules:{create:()=>({data:{completed:false,elapsed:0,delivered:[]}})},
 FactoryRuntime:{snapshot:()=>({}),execute:()=>new Promise(r=>pending.push(r)),ProgramError:Error},
 V2UI:{prepareRun(){}},FactoryUI:{sync(){},status(){},result(){}},logToConsole(){},showAppMessage(){}
 });
 c.window.FactoryUI=c.FactoryUI;inject(c,['finishFlightProgram']);vm.runInContext(fs.readFileSync('js/factory/mission.js','utf8'),c);
 const factory=c.window.FactoryMission;factory.build();const first=factory.run();factory.stop();const second=factory.run();
 pending[0]();await first;assert.equal(c.state.isRunning,true);pending[1]();await second;assert.equal(c.state.isRunning,false);
});

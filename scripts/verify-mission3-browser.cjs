/* Real browser/Blockly execution, with accelerated browser time (no state teleport).
 * Run npm start, then node scripts/verify-mission3-browser.cjs.
 * Playwright is supplied by the existing promo workspace. */
const {chromium}=require('../promo/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const f=require('./mission3-fixtures.cjs'),ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'audit/mission-3');
fs.mkdirSync(OUT,{recursive:true});
const report={errors:[],warnings:[],failedRequests:[],expectedMediaCancellations:[],cases:[],viewports:[],regressions:[]};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,colorScheme:'light',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('requestfailed',r=>{const failure={url:r.url(),error:r.failure()?.errorText};if(failure.error==='net::ERR_ABORTED'&&failure.url.endsWith('/assets/video/drone-simulator-promo-45s-web.mp4'))report.expectedMediaCancellations.push(failure);else report.failedRequests.push(failure);});
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.failedRequests.push({url:r.url(),status:r.status()});});
 await page.goto(process.env.DRONE_QA_URL||'http://127.0.0.1:8080/');await page.locator('#app-loading').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>typeof Blockly.JavaScript?.workspaceToCode),'function','Blockly generator must load');
 assert.ok(await page.evaluate(()=>[...document.styleSheets].find(s=>s.href?.includes('mission3.css'))?.cssRules.length>30),'Mission CSS must load');
 assert.deepEqual(report.errors,[], 'initial page errors');
 await page.getByRole('button',{name:'選擇救援任務',exact:true}).click().catch(async()=>page.evaluate(()=>showMissionSelect()));
 await page.screenshot({path:path.join(OUT,'mission-select.png'),fullPage:true});
 await page.locator('.v2-mission-card').filter({hasText:'天空機關城'}).click();await page.locator('#briefing-ok-btn').waitFor({state:'visible'});
 await page.screenshot({path:path.join(OUT,'briefing.png')});await page.locator('#briefing-ok-btn').click();await page.waitForTimeout(800);
 await page.evaluate(()=>V2UI.setView('split'));await page.waitForTimeout(200);
 await page.screenshot({path:path.join(OUT,'launch.png')});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 const snap=()=>page.evaluate(()=>({running:state.isRunning,complete:state.missionCompleted,score:currentScore,xyz:[state.x,state.y,state.z],snapshot:SkyMission.snapshot(),feedback:document.getElementById('sky-feedback').textContent,message:document.getElementById('app-message-body').textContent,xml:Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace))}));
 async function run(xml,{capture=false}={}){
  await page.evaluate(xml=>{closeResultModal();resetSimulator();if(!applyBlocklyWorkspaceXmlText(xml))throw new Error('Import rejected');},xml);
  // Reset/import refreshes button state on the next animation frame; advance the paused QA clock.
  await page.clock.runFor(100);await page.locator('#run-blockly-btn').click();const captured=new Set();let s;
  for(let t=0;t<100000;t+=250){await page.clock.runFor(250);s=await snap();
   if(capture){for(let i=0;i<3;i++)if(s.snapshot.gates[i].status==='accepted'&&!captured.has(i)){
     captured.add(i);await page.evaluate(()=>V2UI.camera('follow'));await page.clock.runFor(100);await page.screenshot({path:path.join(OUT,`gate-${'abc'[i]}.png`)});
   }
   if(s.snapshot.completed===3&&!captured.has('core')){captured.add('core');await page.evaluate(()=>V2UI.camera('map'));await page.clock.runFor(50);await page.screenshot({path:path.join(OUT,'central-tower.png')});}
   }
   if(!s.running)break;
  }
  assert.equal(s.running,false,'program must terminate');return s;
 }
 const good=f.solution();let s=await run(good,{capture:true});assert.equal(s.complete,true,s.feedback);assert.equal(s.score,600);assert.equal(s.snapshot.activated,true);report.cases.push({name:'standard conditional + loop + procedure',completed:s.snapshot.completed,score:s.score,configuration:s.snapshot.configuration});
 await page.screenshot({path:path.join(OUT,'mission-complete.png')});
 const before=s.xml,key=s.snapshot.configuration;
 await page.locator('#result-retry-btn').click();await page.clock.runFor(200);s=await snap();assert.equal(s.xml,before);assert.deepEqual(s.snapshot.configuration,key);assert.equal(s.snapshot.completed,0);report.cases.push({name:'retry preserves configuration and program',passed:true});
 const tests=[
  ['wrong-channel',f.program([f.block('drone_takeoff'),f.move('FORWARD',200),f.channel('A'),f.block('sky_send')]),/要求頻道 B/],
  ['no-signal',f.program([f.block('drone_takeoff'),f.move('FORWARD',400)]),/尚未收到/],
  ['too-early',f.program([f.block('drone_takeoff'),f.move('FORWARD',200),f.channel('B'),f.block('sky_send'),f.move('FORWARD',200)]),/太早/],
  ['wrong-navigation',f.program([f.block('drone_takeoff'),f.move('UP',400),f.move('RIGHT',500),f.move('FORWARD',1000),f.block('sky_activate')]),/0\/3/],
  ['impossible-wait',f.program([f.block('drone_takeoff'),f.move('FORWARD',200),f.block('sky_wait_until','<value name="CONDITION"><block type="sky_gate_open"/></value>')]),/等待條件/]
 ];
 for(const [name,xml,message] of tests){console.log('Testing',name);s=await run(xml);assert.equal(s.complete,false);assert.match(s.feedback,message);report.cases.push({name,feedback:s.feedback,passed:true});if(name==='wrong-channel')await page.screenshot({path:path.join(OUT,'wrong-channel.png')});}
 for(let k=0;k<3;k++){console.log('Testing challenge',k);await page.evaluate(()=>SkyMission.newChallenge());await page.clock.runFor(100);s=await run(good);assert.equal(s.complete,true,s.feedback);report.cases.push({name:`challenge conditional ${k}`,configuration:s.snapshot.configuration,completed:s.snapshot.completed});}
 await page.evaluate(()=>SkyMission.newChallenge());s=await run(f.solution({hardcoded:'A'}));assert.equal(s.complete,false);assert.match(s.feedback,/要求頻道/);report.cases.push({name:'hardcoded fails another configuration',feedback:s.feedback});
 // Reset during takeoff invalidates in-flight continuations, even after a new run begins.
 await page.evaluate(xml=>{resetSimulator();applyBlocklyWorkspaceXmlText(xml);runBlocklyCode();},good);await page.clock.runFor(200);await page.evaluate(()=>resetSimulator());await page.clock.runFor(1000);s=await snap();assert.deepEqual(s.xyz,[-450,14,450]);assert.equal(await page.evaluate(()=>state.isFlying),false);report.cases.push({name:'reset cancels takeoff without stale flying state',passed:true});
 // Pause during a wait and resume; no polling deadlock.
 await page.evaluate(()=>runBlocklyCode());for(let i=0;i<40;i++){await page.clock.runFor(200);if((await snap()).snapshot.gates[0].status==='accepted')break;}
 await page.locator('#debug-pause-btn').click();await page.clock.runFor(3000);assert.equal((await snap()).running,true);await page.locator('#debug-pause-btn').click();for(let i=0;i<200&&(await snap()).running;i++)await page.clock.runFor(250);assert.equal((await snap()).complete,true);report.cases.push({name:'pause and resume through gate waiting',passed:true});
 await page.evaluate(()=>{closeResultModal();resetSimulator();V2UI.camera('map');});
 for(const [width,height] of [[1440,900],[1280,800],[1024,768],[1180,820]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>V2UI.setView(window.innerWidth<1100?'world':'split'));await page.clock.runFor(300);
  const layout=await page.evaluate(()=>{const ids=['run-blockly-btn','sky-strip','canvas-container'];return {overflow:document.documentElement.scrollWidth>innerWidth+1,rects:ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};})};});
  assert.equal(layout.overflow,false);for(const r of layout.rects){assert.ok(r.right<=width+1&&r.bottom<=height+1&&r.x>=-1&&r.y>=-1,JSON.stringify(r));}
  report.viewports.push({width,height,...layout});await page.screenshot({path:path.join(OUT,width===1180?'ipad-landscape.png':`viewport-${width}.png`)});
 }
 await page.setViewportSize({width:1440,height:900});
 report.performance=await page.evaluate(()=>({render:renderer.info.render,memory:renderer.info.memory,dpr:renderer.getPixelRatio(),shadow:renderer.shadowMap.enabled}));
 // The exact same browser session switches back, testing cleanup and restored shared state.
 for(const [id,fixture] of [[1,'mission1-inspections.xml'],[2,'mission2-v2-four-fires.xml']]){
  await page.evaluate(id=>{void startMission(id);},id);await page.clock.runFor(2500);await page.locator('#briefing-ok-btn').click();await page.clock.runFor(400);
  const xml=fs.readFileSync(path.join(ROOT,'test/fixtures',fixture),'utf8');await page.evaluate(xml=>{applyBlocklyWorkspaceXmlText(xml);resetSimulator();runBlocklyCode();},xml);
  for(let t=0;t<180000;t+=500){await page.clock.runFor(500);if(await page.evaluate(()=>state.missionCompleted&&!state.isRunning))break;}
  const result=await page.evaluate(()=>({complete:state.missionCompleted,scene:currentSceneType,variant:environmentGroup.userData.sceneVariant,beacons:beaconsTriggered,fires:firesExtinguished,score:currentScore,running:state.isRunning,shadow:renderer.shadowMap.enabled}));assert.equal(result.complete,true,JSON.stringify(result));if(id===1)assert.equal(result.beacons,3);else assert.equal(result.fires,4);
  report.regressions.push({mission:id,...result});await page.screenshot({path:path.join(OUT,`mission-${id}-regression.png`)});await page.evaluate(()=>closeResultModal());
 }
 await browser.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);report.passed=true;
 fs.writeFileSync(path.join(OUT,'browser-qa.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(OUT,'browser-qa-partial.json'),JSON.stringify(report,null,2));process.exit(1);});

const qa = require('./qa-output.cjs').createRun('verify-factory-browser');
// Real Blockly import + Run. Virtual time accelerates the real animation callbacks;
// this verifier never changes drone coordinates, mission progress or success state.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../promo/node_modules/playwright');
const F=require('./factory-fixtures.cjs');
const output=qa.directory;
const report={environment:{platform:process.platform,viewport:'1440×900',browser:'Chrome headless',clock:'Playwright virtual clock, 500 ms advances',physicalDevices:false},orders:[],checks:[],errors:[],cancelledMedia:[]};
let browser,page;
const check=(name,actual,expected=true)=>{assert.deepEqual(actual,expected,name);report.checks.push(name);console.log('PASS',name);};
async function tick(ms=500){await page.clock.fastForward(ms);}
async function until(predicate,max=650000){for(let t=0;t<max;t+=500){if(await page.evaluate(predicate))return;await tick();}throw Error('Timeout: '+JSON.stringify(await status()));}
async function status(){return page.evaluate(()=>({running:state.isRunning,complete:state.missionCompleted,score:currentScore,data:FactoryMission.data,position:[state.x,state.y,state.z],message:document.getElementById('app-message-banner').innerText}));}
async function importXml(xml){await page.locator('#blockly-import-input').setInputFiles({name:'factory-test.xml',mimeType:'text/xml',buffer:Buffer.from(xml)});await page.locator('#app-confirm-ok').click({force:true});await page.waitForFunction(()=>!document.getElementById('app-confirm-modal').hasAttribute('hidden')?false:workspace.getAllBlocks(false).length>0);await tick(600);await page.evaluate(()=>{resetSimulator();hideAppMessage();});}
async function run(){await tick(500);report.runBefore=await page.evaluate(()=>{const e=document.getElementById('run-blockly-btn'),r=e.getBoundingClientRect();return {disabled:e.disabled,inert:document.getElementById('game-interface').inert,modal:document.getElementById('result-modal').style.cssText,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,250)};});await page.locator('#run-blockly-btn').click({force:true});await tick(20);report.runAfter=await status();}
async function finish(){await until(()=>!state.isRunning);await tick(1000);return status();}
async function shot(name){await page.clock.resume();await page.waitForTimeout(300);await page.evaluate(()=>FactoryUI.sync());await page.screenshot({path:path.join(output,name+'.png')});if(name==='overview')await page.locator('#canvas-container canvas').screenshot({path:qa.file('mission-preview-factory.png')});await page.clock.pauseAt(await page.evaluate(()=>Date.now()+50));}
async function cameraAt(x,z,radius=1000){await page.evaluate(({x,z,radius})=>{V2UI.setView('world');followDrone=false;camTarget.x=x;camTarget.y=40;camTarget.z=z;camRadius=radius;camTheta=20;camPhi=55;updateCameraPosition();onWindowResize();renderer.render(scene,camera);},{x,z,radius});await tick(50);}
async function startMission(n){await page.clock.resume();await page.evaluate(n=>{closeResultModal();emergencyStop();return startMission(n);},n);await page.locator('#briefing-ok-btn').click({force:true});await page.waitForTimeout(250);await page.clock.pauseAt(await page.evaluate(()=>Date.now()+50));await tick(250);}
(async()=>{browser=await chromium.launch({channel:process.env.FACTORY_BROWSER||'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'light'});page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('requestfailed',r=>{if(new URL(r.url()).origin!==new URL(process.env.FACTORY_URL||'http://127.0.0.1:8080/').origin)return;const message=r.url()+': '+r.failure()?.errorText;if(r.resourceType()==='media'&&r.failure()?.errorText==='net::ERR_ABORTED')report.cancelledMedia.push(message);else report.errors.push(message);});page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 await page.goto(process.env.FACTORY_URL||'http://127.0.0.1:8080/',{waitUntil:'load'});await page.locator('#app-loading').waitFor({state:'hidden'});await page.evaluate(()=>document.fonts.ready);
 // Chromium may cancel a media range request once preload metadata is available.
 // Verify the actual video decodes before treating media-only ERR_ABORTED as diagnostic.
 await page.waitForFunction(()=>{const video=document.getElementById('hero-loop-video');return video.error||video.readyState>=1;});
 check('homepage video metadata loads',await page.evaluate(()=>{const v=document.getElementById('hero-loop-video');return !v.error&&v.videoWidth>0&&v.duration>0;}));
 await page.clock.install();await startMission(3);check('factory Blockly workspace initialized',await page.evaluate(()=>!!workspace));
 check('every marked lane has 3 m ground-level clearance',await page.evaluate(()=>FactoryMission.obstacles.filter(b=>b.min.y<=180&&b.max.y>=0).every(b=>![-1200,0,1200].some(x=>b.max.x>x-150&&b.min.x<x+150&&b.max.z>-1350&&b.min.z<1350)&&![-1200,-300,750,1200].some(z=>b.max.z>z-150&&b.min.z<z+150&&b.max.x>-1350&&b.min.x<1350))));
 check('factory style loaded',await page.evaluate(()=>getComputedStyle(document.getElementById('game-interface')).display),'flex');
 await page.evaluate(()=>V2UI.setView('world'));await tick(250);await shot('overview');
 await cameraAt(-1200,1200,900);await shot('base');
 const reference=fs.readFileSync('test/fixtures/factory-reference.xml','utf8');await page.evaluate(()=>V2UI.setView('split'));await importXml(reference);
 const saved=await page.evaluate(()=>{flushBlocklyAutosave();return localStorage.getItem(getBlocklyAutosaveStorageKey());});check('separate factory storage',await page.evaluate(()=>getBlocklyAutosaveKey()),'mission-3-factory');
 await run();await until(()=>FactoryMission.data.cargo!==null);await cameraAt(0,750);await shot('pickup');
 await until(()=>FactoryMission.data.repair.status==='working');await cameraAt(-1200,-300);await shot('repair');
 await until(()=>FactoryMission.data.delivered.length>=4);await cameraAt(1200,-300,1350);await shot('assembly');
 await until(()=>FactoryMission.data.delivered.length===6);await cameraAt(0,-1200,1350);await shot('dispatch');
 let result=await finish();check('reference full flight lands for 800',result.score,800);check('reference has six actual loop deliveries',Object.values(result.data.learning.loopDeliveries)[0].length,6);report.orders.push(result.data);
 await shot('result');
 report.render=await page.evaluate(()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,webgl:renderer.getContext().getParameter(renderer.getContext().VERSION)}));
 for(let i=1;i<=2;i++){await page.evaluate(()=>{closeResultModal();FactoryMission.newOrder();V2UI.setView('code');});check('order '+i+' preserves program',await page.evaluate(()=>Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace))),saved);await run();result=await finish();report.last=result;check('same reference on order '+i,result.score,800);report.orders.push(result.data);}
 check('three different permutations',new Set(report.orders.map(d=>d.order.map(p=>p.status).join())).size,3);
 check('repair times vary',new Set(report.orders.flatMap(d=>d.order.filter(p=>p.status==='故障').map(p=>p.repairSeconds))).size,3);
 await importXml(F.reference({unrolled:true}));await run();result=await finish();check('unrolled succeeds',result.score,800);check('unrolled learning feedback',await page.locator('#v2-result-next').innerText().then(s=>s.includes('放進迴圈')));
 await importXml(F.reference({hardcoded:true}));await run();result=await finish();check('fixed order program fails on changed order',result.complete,false);check('fixed-order error explains wrong part',/正常|故障/.test(result.message));
 const flightOnly=F.xml([F.b('event_start'),F.b('drone_takeoff'),F.move('FORWARD',1500),F.move('RIGHT',1200),F.move('FORWARD',900),F.b('drone_land')]);
 await importXml(flightOnly);await run();result=await finish();check('flight and landing alone cannot finish',result.complete,false);check('flight alone has zero score',result.score,0);
 // Stop and reset while a genuine flight action is active; old RAF cannot mutate reset state.
 await importXml(reference);const order=await page.evaluate(()=>JSON.stringify(FactoryMission.data.order));await run();await tick(3000);await page.evaluate(()=>emergencyStop());const held=await page.evaluate(()=>[state.x,state.y,state.z]);await tick(5000);check('stop holds position',await page.evaluate(()=>[state.x,state.y,state.z]),held);await page.evaluate(()=>resetSimulator());await tick(20000);check('reset cancels previous flight',await page.evaluate(()=>[state.x,state.y,state.z]),[-1200,14,1200]);check('retry retains order',await page.evaluate(()=>JSON.stringify(FactoryMission.data.order)),order);
 // Pausing a repair wait lets the started machine complete, then gates the next block.
 await run();await until(()=>FactoryMission.data.repair.status==='working');await page.evaluate(()=>toggleExecutionPause(true));await tick(6000);await tick(500);check('repair finishes while pause requested',await page.evaluate(()=>FactoryMission.data.repair.status),'ready');check('paused before pickup',await page.evaluate(()=>FactoryMission.data.cargo),null);await page.evaluate(()=>stepExecution());await tick(1000);check('single step picks up repaired part',await page.evaluate(()=>FactoryMission.data.cargo?.status),'正常');await page.evaluate(()=>resetSimulator());await tick(20000);check('reset clears machine without ghost updates',await page.evaluate(()=>FactoryMission.data.repair.status),'idle');
 const stuck=F.xml([F.b('event_start'),F.waitFor('factory_repair_ready')]);await importXml(stuck);await run();await tick(300);await page.evaluate(()=>emergencyStop());await tick(30000);check('stop cancels waiting',await page.evaluate(()=>state.isRunning),false);
 await importXml(stuck);await run();await until(()=>!state.isRunning);check('wait diagnostic',await page.locator('#app-message-banner').innerText().then(s=>s.includes('60')));
 await importXml(reference);await run();await until(()=>currentExecutingBlockId&&workspace.getBlockById(currentExecutingBlockId)?.type==='factory_pickup');await page.evaluate(()=>resetSimulator());await tick(10000);check('reset cancels in-flight pickup promise',await page.evaluate(()=>FactoryMission.data.cargo),null);check('cancelled pickup cannot score',await page.evaluate(()=>currentScore),0);
 await run();await until(()=>FactoryMission.data.repair.status==='working');await page.evaluate(()=>resetSimulator());await tick(20000);check('reset cancels active repair',await page.evaluate(()=>[FactoryMission.data.repair.status,FactoryMission.data.cargo,FactoryMission.data.delivered.length]),['idle',null,0]);
 // Restore reference before screenshot matrix and regression; no complete answer preloaded by application.
 await importXml(reference);await page.evaluate(()=>{V2UI.setView('split');V2UI.camera('map');});await tick(250);
 for(const size of [[1440,900],[1280,800],[1024,768]])for(const theme of ['light','dark']){
  await page.setViewportSize({width:size[0],height:size[1]});await page.evaluate(t=>{DroneTheme.setPreference(t);V2UI.setView('split');V2UI.camera('map');},theme);await tick(300);
  for(const selector of ['#run-blockly-btn','#debug-pause-btn','.program-btn--stop','#factory-new-order']){const b=await page.locator(selector).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=size[0]+1&&b.y+b.height<=size[1]+1,selector+' fits '+size);}
  const orderButton=await page.locator("#factory-new-order").boundingBox(), canvas=await page.locator("#canvas-container").boundingBox(), action=await page.locator(".v2-action").boundingBox();
  assert.ok(Math.abs(orderButton.y-canvas.y-16)<1 && Math.abs(canvas.x+canvas.width-orderButton.x-orderButton.width-16)<1);
  assert.ok(action.x+action.width<orderButton.x,"status and order button do not overlap");
  check('controls fit '+size+' '+theme,true);await shot('layout-'+size.join('x')+'-'+theme);
  await page.evaluate(()=>showMissionBriefing(3));await tick(100);await shot('briefing-'+size.join('x')+'-'+theme);await page.evaluate(()=>closeBriefing());
 }
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>DroneTheme.setPreference('light'));
 const restoredExpected=await page.evaluate(()=>Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)));
 // Existing missions use the shared queue executor, in this same browser/context.
 for(const n of [1,2]){
  await startMission(n);await page.evaluate(()=>V2UI.setView('code'));
  let xml=fs.readFileSync(n===1?'test/fixtures/mission1-inspections.xml':'test/fixtures/mission2-v2-four-fires.xml','utf8');
  if(!xml.includes('event_start'))xml=xml.replace('<block type="drone_takeoff">','<block type="event_start"><next><block type="drone_takeoff">').replace('</xml>','</next></block></xml>');
  await importXml(xml);await run();await until(()=>!state.isRunning,650000);await tick(1500);
  const old=await page.evaluate(()=>({complete:state.missionCompleted,score:currentScore,beacons:beaconsTriggered,fires:firesExtinguished,key:getBlocklyAutosaveKey(),count:workspace.getAllBlocks(false).length,total:document.getElementById('res-total').innerText}));report['mission'+n]=old;console.log('LEGACY',n,JSON.stringify(old));check('mission '+n+' still completes',old.complete);check('mission '+n+' independent save',old.key,'mission-'+n);check('mission '+n+' interactions',n===1?old.beacons:old.fires,n===1?3:4);check('mission '+n+' result score',Number(old.total)>=800);
 }
 await startMission(3);check('factory program restored after other missions',await page.evaluate(()=>Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace))),restoredExpected);
 await page.evaluate(()=>{V2UI.setView('world');V2UI.camera('map');});await tick(500);await shot('final-overview');
 check('no browser or resource errors',report.errors,[]);
 report.environment.browserVersion=browser.version();report.ok=true;
 }finally{fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(report,null,2));await browser?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

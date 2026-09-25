const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const PROMO=path.join(ROOT,'promo');
const FOOTAGE=path.join(PROMO,'public/footage');
const EVIDENCE=path.join(PROMO,'captures');
for(const d of [FOOTAGE,EVIDENCE])fs.mkdirSync(d,{recursive:true});
async function open({dpr=1,clock=true}={}){
 const browser=await chromium.launch({channel:process.env.PROMO_BROWSER||'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:dpr,colorScheme:'light',serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 if(clock)await page.clock.install({time:new Date('2026-09-25T08:00:00Z')});
 await page.goto(process.env.PROMO_URL||'http://127.0.0.1:8080/',{waitUntil:'domcontentloaded'});
 await page.locator('#app-loading').waitFor({state:'hidden',timeout:45000});
 await page.evaluate(()=>document.fonts.ready);
 return {browser,context,page,errors};
}
async function mission(page,n,fixture){
 await page.evaluate(()=>document.querySelector('#promo-world-style')?.remove());
 await page.evaluate(n=>{void startMission(n)},n);
 await page.locator('#briefing-ok-btn').waitFor({state:'visible'});
 await page.locator('#briefing-ok-btn').click();
 await page.waitForTimeout(1200);
 await page.waitForLoadState('networkidle');
 const file=fixture||(n===1?'mission1-direct.xml':'mission2-v2-four-fires.xml');
 let xml=fs.readFileSync(n===2&&!fixture?path.join(PROMO,'fixtures/mission2-promo.xml'):path.join(ROOT,'test/fixtures',file),'utf8');
 if(n===1)xml=xml.replace('<block type="drone_takeoff">','<block type="event_start" x="36" y="40"><next><block type="drone_takeoff">').replace('</xml>','</next></block></xml>');
 await page.evaluate(xml=>{V2UI.setView('split');if(!applyBlocklyWorkspaceXmlText(xml))throw new Error('XML rejected');resetSimulator();},xml);
 await page.waitForTimeout(300);
 return xml;
}
async function pause(page){await page.clock.pauseAt(await page.evaluate(()=>Date.now()+50));}
async function camera(page,{follow=false,radius=500,theta=45,phi=38,target}={}){
 await page.evaluate(o=>{
  V2UI.camera(o.follow?'follow':'map');followDrone=o.follow;camRadius=o.radius;camTheta=o.theta;camPhi=o.phi;
  if(o.target){camTarget.x=o.target[0];camTarget.y=o.target[1];camTarget.z=o.target[2];}
  else if(o.follow){camTarget.x=state.x;camTarget.y=state.y;camTarget.z=state.z;}
  updateCameraPosition();renderer.render(scene, camera);
 },{follow,radius,theta,phi,target});
}
async function world(page){
 await page.evaluate(()=>V2UI.setView('world'));
 const style=await page.addStyleTag({content:'#canvas-container{position:fixed!important;top:0!important;left:0!important;right:auto!important;bottom:auto!important;width:1920px!important;height:1124px!important;z-index:10000!important;border-radius:0!important}#canvas-container>:not(canvas){display:none!important}#canvas-container canvas{border-radius:0!important}'});
 await style.evaluate(el=>el.id='promo-world-style');
 await page.evaluate(()=>{onWindowResize();renderer.render(scene,camera)});
}
async function state(page){return page.evaluate(()=>({scene:currentSceneType,variant:environmentGroup?.userData.sceneVariant||currentSceneType,x:state.x,y:state.y,z:state.z,index:executionDebug.currentIndex,action:document.querySelector('#v2-action-label').textContent,complete:state.missionCompleted,collision:state.collisionDetected,score:state.score,fires:firesExtinguished,time:performance.now()}));}
async function advanceUntil(page,predicate,{step=100,limit=160000}={}){
 for(let t=0;t<limit;t+=step){if(await page.evaluate(predicate))return;await page.clock.runFor(step);}
 const evidence=await page.evaluate(()=>({index:executionDebug.currentIndex,running:state.isRunning,complete:state.missionCompleted,position:[state.x,state.y,state.z],message:document.querySelector('#app-message-banner').innerText,commands:cmdQueue.map(c=>c.type)}));
 throw new Error('Mission condition not reached: '+JSON.stringify(evidence));
}
async function run(page){await page.evaluate(()=>{void runBlocklyCode()});}
async function record(page,id,seconds,{fps=30,each,crop,scale}={}){
 const args=['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-i','pipe:0','-an'];
 const filters=[];if(crop)filters.push(`crop=${crop}`);if(scale)filters.push(`scale=${scale}:flags=lanczos`);if(filters.length)args.push('-vf',filters.join(','));
 args.push('-c:v','libx264','-preset','fast','-crf','15','-pix_fmt','yuv420p','-movflags','+faststart',path.join(FOOTAGE,id+'.mp4'));
 const encoder=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});let err='';encoder.stderr.on('data',d=>err+=d);
 const start=Date.now(),samples=[];
 for(let frame=0;frame<Math.round(seconds*fps);frame++){
  if(each)await each(frame,frame/fps);
  await page.clock.runFor(Math.round((frame+1)*1000/fps)-Math.round(frame*1000/fps));
  const bytes=await page.screenshot({type:'png'});
  if(!encoder.stdin.write(bytes))await once(encoder.stdin,'drain');
  if(frame===Math.round(fps))fs.writeFileSync(path.join(EVIDENCE,id+'.png'),bytes);
  if(frame%fps===0){samples.push({frame,state:await state(page).catch(()=>null)});console.log(`${id} ${frame/fps}/${seconds}s`);}
 }
 encoder.stdin.end();const [code]=await once(encoder,'close');if(code!==0)throw new Error(err);
 const report={id,seconds,fps,frames:Math.round(seconds*fps),captureWallSeconds:(Date.now()-start)/1000,samples};
 fs.writeFileSync(path.join(EVIDENCE,id+'.json'),JSON.stringify(report,null,2));
 return report;
}
module.exports={ROOT,PROMO,FOOTAGE,EVIDENCE,open,mission,pause,camera,world,state,advanceUntil,run,record};

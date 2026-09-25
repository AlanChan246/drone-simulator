const fs=require('node:fs'),path=require('node:path');
const {open,mission,pause,camera,world,state,advanceUntil,run,record,EVIDENCE}=require('./capture-lib.cjs');
const group=process.argv[2]||'all';
async function cursor(page,x,y,down=false){
 await page.mouse.move(x,y);
 await page.evaluate(({x,y,down})=>{
  let el=document.querySelector('#promo-cursor');
  if(!el){el=document.createElement('div');el.id='promo-cursor';el.style.cssText='position:fixed;z-index:100000;pointer-events:none;width:28px;height:36px;';el.innerHTML='<svg viewBox="0 0 28 36"><path d="M3 2L4 28L10 22L16 33L21 30L15 20L25 19Z" fill="#173b37" stroke="white" stroke-width="2"/></svg>';document.body.append(el);}
  el.style.left=x+'px';el.style.top=y+'px';el.style.transform=down?'scale(.85)':'none';
 },{x,y,down});
}
async function ui(){
 const {browser,page,errors}=await open({dpr:2});await pause(page);
 await record(page,'home',3,{crop:'1160:1600:560:300',each:async(f,t)=>cursor(page,600+30*t,520+25*t)});
 await page.locator('[onclick="showMissionSelect()"]').click({force:true});await page.clock.runFor(300);
 await record(page,'mission-select',3,{scale:'1920:1080',each:async(f,t)=>cursor(page,1000-130*Math.min(t/2,1),800-70*Math.min(t/2,1))});
 fs.writeFileSync(path.join(EVIDENCE,'ui-errors.json'),JSON.stringify(errors));await browser.close();
}
async function blockly(){
 const {browser,page,errors}=await open({dpr:2});await mission(page,1);
 await camera(page,{follow:true,radius:420,theta:45,phi:30});
 await page.evaluate(()=>{workspace.setScale(1.25);workspace.scroll(0,0);});
 await pause(page);
 const box=await page.locator('.blocklyEditableText').filter({hasText:'300'}).first().boundingBox();
 const tx=box.x+box.width/2,ty=box.y+box.height/2;
 await record(page,'blockly',6,{scale:'1920:1080',each:async(f,t)=>{
  await cursor(page,tx+160*(1-Math.min(t,1)),ty+80*(1-Math.min(t,1)));
  if(f===35){await page.mouse.click(tx,ty);}
  if(f===50){await page.locator('.blocklyHtmlInput').fill('300');}
  if(f===75){await page.locator('.blocklyHtmlInput').press('Enter');}
 }});
 const b=await page.locator('#run-blockly-btn').boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;
 await record(page,'run',2,{scale:'1920:1080',each:async(f,t)=>{
  const q=Math.min(t/.65,1);await cursor(page,tx+(x-tx)*q,ty+(y-ty)*q,f>=22&&f<26);
  if(f===22)await page.mouse.click(x,y);
 }});
 fs.writeFileSync(path.join(EVIDENCE,'blockly-errors.json'),JSON.stringify(errors));await browser.close();
}
async function mission1(){
 const {browser,page,errors}=await open();const xml=await mission(page,1);await world(page);
 await camera(page,{follow:true,radius:280,theta:40,phi:25});await pause(page);
 await record(page,'m1-hero',4,{each:async(f,t)=>page.evaluate(t=>{camTheta=40+t*1.3;updateCameraPosition()},t)});
 await camera(page,{follow:true,radius:380,theta:40,phi:25});await run(page);
 await record(page,'m1-takeoff',4);
 await camera(page,{follow:true,radius:480,theta:40,phi:22});await record(page,'m1-flight',4);
 await camera(page,{radius:2600,theta:45,phi:38,target:[0,0,0]});await record(page,'m1-wide',2);
 await advanceUntil(page,()=>executionDebug.currentIndex===6&&state.z>400);
 await camera(page,{radius:560,theta:40,phi:25,target:[780,30,640]});await record(page,'m1-landing',5);
 await advanceUntil(page,()=>state.missionCompleted);
 const completed=await state(page);
 await page.evaluate(()=>{document.querySelector('#promo-world-style')?.remove();V2UI.camera('map');onWindowResize()});await page.clock.runFor(600);
 await record(page,'m1-result',5);
 const result=await page.locator('#result-modal').innerText();
 fs.writeFileSync(path.join(EVIDENCE,'mission1-proof.json'),JSON.stringify({xml,completed,result,errors},null,2));await browser.close();
}
async function mission2(){
 const {browser,page,errors}=await open();const xml=await mission(page,2);await world(page);
 await camera(page,{radius:3400,theta:38,phi:48,target:[0,0,0]});await pause(page);
 await record(page,'m2-wide',4,{each:async(f,t)=>page.evaluate(t=>{camTheta=38+t*1.2;camRadius=3400-t*25;updateCameraPosition()},t)});
 await run(page);await advanceUntil(page,()=>executionDebug.currentIndex===4);
 await camera(page,{follow:true,radius:500,theta:45,phi:25});await record(page,'m2-track',4);
 await advanceUntil(page,()=>executionDebug.currentIndex===10&&state.z< -420);
 await camera(page,{radius:650,theta:110,phi:38,target:[825,35,-650]});await record(page,'m2-fire',4);
 await advanceUntil(page,()=>state.missionCompleted);
 const completed=await state(page);
 await page.evaluate(()=>{document.querySelector('#promo-world-style')?.remove();V2UI.camera('map');onWindowResize()});
 await advanceUntil(page,()=>getComputedStyle(document.querySelector('#result-modal')).display!=='none',{step:100,limit:5000});
 await page.clock.runFor(500);
 await page.screenshot({path:path.join(EVIDENCE,'m2-final-result.png')});
 const result=await page.locator('#result-modal').innerText();
 fs.writeFileSync(path.join(EVIDENCE,'mission2-proof.json'),JSON.stringify({xml,completed,result,errors},null,2));await browser.close();
}
(async()=>{for(const [name,fn] of Object.entries({ui,blockly,mission1,mission2})){if(group==='all'||group===name){console.log('Capture group:',name);await fn();}}})().catch(e=>{console.error(e);process.exit(1)});

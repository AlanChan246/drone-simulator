const fs=require('node:fs'),path=require('node:path');
const {open,mission,world,camera,pause,run,record,EVIDENCE}=require('./capture-lib.cjs');
(async()=>{
 let cadence=[];const samples=[],errors=[];
 for(const fps of [30,60]){
  const session=await open();const {browser,page}=session;
  await mission(page,2);await world(page);await camera(page,{follow:true,radius:420,theta:45,phi:30});
  if(fps===30)cadence=await page.evaluate(()=>new Promise(resolve=>{const a=[];let last=performance.now();function tick(t){a.push(t-last);last=t;if(a.length<120)requestAnimationFrame(tick);else resolve(a.slice(1));}requestAnimationFrame(tick)}));
  await pause(page);
  await run(page);samples.push(await record(page,`fps-${fps}`,2,{fps}));
  errors.push(...session.errors);await browser.close();
 }
 cadence.sort((a,b)=>a-b);
 fs.writeFileSync(path.join(EVIDENCE,'fps-comparison.json'),JSON.stringify({rafSource:'Playwright-controlled browser clock; not a hardware frame-rate measurement',clockRafMedian:cadence[Math.floor(cadence.length*.5)],clockRafP95:cadence[Math.floor(cadence.length*.95)],samples,errors},null,2));
})().catch(e=>{console.error(e);process.exit(1)});

const fs=require('node:fs'),path=require('node:path');
const {open,mission,world,camera,pause,EVIDENCE}=require('./capture-lib.cjs');
(async()=>{
 const {browser,page,errors}=await open();
 const shots=[];
 for(const n of [1,2]){
  await mission(page,n);await world(page);
  for(const [name,options] of Object.entries(n===1?{
   hero:{follow:true,radius:320,theta:130,phi:58},
   track:{follow:true,radius:560,theta:40,phi:36},
   wide:{radius:3000,theta:45,phi:42,target:[0,0,0]},
  }:{
   wide:{radius:3400,theta:38,phi:48,target:[0,0,0]},
   track:{follow:true,radius:540,theta:125,phi:36},
   fire:{radius:650,theta:110,phi:38,target:[825,35,-650]},
  })){
   await camera(page,options);await page.waitForTimeout(150);
   const id=`candidate-m${n}-${name}`;await page.screenshot({path:path.join(EVIDENCE,id+'.png')});shots.push({id,options});
  }
 }
 fs.writeFileSync(path.join(EVIDENCE,'candidates.json'),JSON.stringify({shots,errors},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

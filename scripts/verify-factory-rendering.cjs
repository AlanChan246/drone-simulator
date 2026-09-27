const qa = require('./qa-output.cjs').createRun('verify-factory-rendering');
// Compare real road pixels against a higher depth-precision render at the same angle.
const{chromium}=require('../promo/node_modules/playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const out={angles:[]};try{const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://127.0.0.1:8080/',{waitUntil:'load'});await p.locator('#app-loading').waitFor({state:'hidden'});await p.evaluate(()=>startMission(3));await p.locator('#briefing-ok-btn').click();await p.evaluate(()=>V2UI.setView('world'));await p.waitForTimeout(250);
 await p.mouse.move(950,440);await p.mouse.down();await p.mouse.move(1100,550,{steps:25});await p.mouse.up();
 for(const phi of [10,55,80])for(const theta of [-125,-50,25,100]){
 const r=await p.evaluate(({phi,theta})=>{camPhi=phi;camTheta=theta;updateCameraPosition();const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,original=camera.near;
 function render(near){camera.near=near;camera.updateProjectionMatrix();renderer.render(scene,camera);const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;}
 const actual=render(original),reference=render(40);camera.near=original;camera.updateProjectionMatrix();renderer.render(scene,camera);
 const road=new Uint8Array([167,182,183]);let count=0,bad=0;
 for(let i=0;i<reference.length;i+=4){if(Math.max(...[0,1,2].map(c=>Math.abs(reference[i+c]-road[c])))>3)continue;count++;if(Math.max(...[0,1,2].map(c=>Math.abs(reference[i+c]-actual[i+c])))>12)bad++;}
 return{phi,theta,near:original,road:[...road],roadPixels:count,unstablePixels:bad,ratio:bad/Math.max(count,1)};},{phi,theta});out.angles.push(r);console.log(JSON.stringify(r));}
 await p.screenshot({path:qa.file('rotation-after.png')});
 assert.ok(out.angles.every(r=>r.roadPixels>1000&&r.ratio<.005),'visible road depth interference must stay below 0.5% at every angle');
 assert.equal(await p.locator('#factory-tools').count(),0);await p.locator('#factory-new-order').click();assert.equal(await p.evaluate(()=>FactoryMission.data.seed),1);
 await p.evaluate(()=>showMissionBriefing(3));assert.equal(await p.locator('#factory-hint-button').count(),1);await p.locator('#briefing-ok-btn').click();
 await p.evaluate(()=>V2UI.setView('split'));await p.waitForTimeout(300);await p.screenshot({path:qa.file('toolbar-after.png')});
 await p.evaluate(()=>startMission(1));assert.equal(await p.evaluate(()=>camera.near),10);assert.equal(await p.locator('#factory-new-order').isVisible(),false);await p.evaluate(()=>startFreePlay());assert.equal(await p.evaluate(()=>camera.near),1);out.ok=true;
 }finally{fs.writeFileSync(qa.file('rendering-results.json'),JSON.stringify(out,null,2));await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

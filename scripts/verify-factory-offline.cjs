const qa = require('./qa-output.cjs').createRun('verify-factory-offline');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{chromium}=require('../promo/node_modules/playwright');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const report={checks:[],errors:[]};try{
 const c=await b.newContext({viewport:{width:1280,height:800}}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(String(e)));
 await p.goto(process.env.FACTORY_URL||'http://127.0.0.1:8080/',{waitUntil:'load'});await p.locator('#app-loading').waitFor({state:'hidden'});
 // Localhost normally disables automatic SW registration for development; exercise
 // the production worker explicitly in this disposable test browser profile.
 await p.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
 await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 report.cache=await p.evaluate(async()=>{const names=await caches.keys();const cache=await caches.open(names[0]);return {names,entries:(await cache.keys()).length};});
 await c.setOffline(true);await p.reload({waitUntil:'load'});await p.locator('#app-loading').waitFor({state:'hidden'});await p.evaluate(()=>startMission(3));await p.locator('#briefing-ok-btn').click();
 assert.equal(await p.evaluate(()=>FactoryMission.data.order.length),6);assert.equal(await p.evaluate(()=>FactoryScene.live.obstacles.length>0),true);assert.equal(await p.evaluate(()=>!!workspace),true);report.checks.push('offline reload restores UI, all factory models and Blockly');
 const missing=await p.evaluate(async()=>{const urls=Object.values(FactoryAssetPaths);const bad=[];for(const url of urls){const r=await fetch(url);if(!r.ok)bad.push(url);}return bad;});assert.deepEqual(missing,[]);report.checks.push('all 50 local GLBs available offline');
 await p.screenshot({path:qa.file('offline.png')});report.ok=true;
 // A fresh profile simulates a missing model and uses the visible Retry action.
 const c2=await b.newContext({viewport:{width:1280,height:800}}),q=await c2.newPage();let fail=true;
 await q.route('**/factory-mission/factory-kit/machine.glb',route=>fail?route.abort('failed'):route.continue());
 await q.goto('http://127.0.0.1:8080/',{waitUntil:'load'});await q.locator('#app-loading').waitFor({state:'hidden'});await q.evaluate(()=>startMission(3));
 await q.locator('#factory-load-retry').waitFor({state:'visible'});assert.equal(await q.evaluate(()=>FactoryMission.data),null);report.checks.push('missing model reports failure without substitute scene');
 fail=false;await q.locator('#factory-load-retry').click();await q.locator('#briefing-ok-btn').waitFor({state:'visible'});await q.locator('#briefing-ok-btn').click();await q.waitForFunction(()=>!!FactoryMission.data);report.checks.push('Retry loads the actual model and factory');
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report,null,2));
 }finally{fs.writeFileSync(path.resolve(qa.file('offline-results.json')),JSON.stringify(report,null,2));await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

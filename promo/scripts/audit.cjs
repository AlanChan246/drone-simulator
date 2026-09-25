const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'promo/captures/audit');
const url = process.env.PROMO_URL || 'http://127.0.0.1:8080/';
fs.mkdirSync(out, {recursive:true});
(async()=>{
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,colorScheme:'light', serviceWorkers:'block'});
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
  await page.goto(url,{waitUntil:'networkidle'});
  await page.screenshot({path:path.join(out,'home.png')});
  await page.locator('[onclick="showMissionSelect()"]').click();
  await page.screenshot({path:path.join(out,'mission-select.png')});
  const report={url,viewport:{width:1920,height:1080},missions:[],errors};
  for(const mission of [1,2]){
    if(mission===2){await page.evaluate(()=>{closeResultModal();returnToMissionSelect()});}
    await page.locator(`[onclick="startMission(${mission})"]`).click();
    await page.locator('#briefing-ok-btn').waitFor({state:'visible'});
    await page.screenshot({path:path.join(out,`m${mission}-briefing.png`)});
    await page.locator('#briefing-ok-btn').click();
    await page.waitForTimeout(1500);
    const xml=fs.readFileSync(path.join(root,'test/fixtures',mission===1?'mission1-inspections.xml':'mission2-v2-four-fires.xml'),'utf8');
    await page.evaluate(xml=>{V2UI.setView('split');applyBlocklyWorkspaceXmlText(xml);resetSimulator();},xml);
    await page.screenshot({path:path.join(out,`m${mission}-blockly.png`)});
    await page.evaluate(()=>V2UI.setView('world'));
    for(const mode of ['map','top','follow']){
      await page.evaluate(mode=>V2UI.camera(mode),mode);
      await page.waitForTimeout(400);
      await page.screenshot({path:path.join(out,`m${mission}-${mode}.png`)});
    }
    await page.evaluate(()=>V2UI.camera('map'));
    await page.locator('#run-blockly-btn').click();
    const began=Date.now(), samples=[];
    let lastIndex=-1;
    while(Date.now()-began<300000){
      const sample=await page.evaluate(()=>({x:state.x,y:state.y,z:state.z,heading:state.heading,running:state.isRunning,complete:state.missionCompleted,collision:state.collisionDetected,index:executionDebug.currentIndex,action:document.querySelector('#v2-action-label').textContent,variant:environmentGroup.userData.sceneVariant||currentSceneType,fires:typeof firesExtinguished==='number'?firesExtinguished:null}));
      sample.wallSeconds=(Date.now()-began)/1000;samples.push(sample);
      if(sample.index!==lastIndex){console.log(JSON.stringify({mission,...sample}));lastIndex=sample.index;}
      if(sample.complete)break;
      await page.waitForTimeout(500);
    }
    await page.locator('#result-modal').waitFor({state:'visible',timeout:10000});
    await page.screenshot({path:path.join(out,`m${mission}-result.png`)});
    const result=await page.locator('#result-modal').innerText();
    await page.locator('#result-retry-btn').click();
    const reset=await page.evaluate(()=>({completed:state.missionCompleted,x:state.x,y:state.y,z:state.z,fires:firesExtinguished}));
    report.missions.push({mission,samples,result,reset});
    fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({mission,result,reset,errors}));
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

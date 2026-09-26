// Real legacy playthroughs after entering Mission 3. No synthetic completion state.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'audit/mission-3-primary');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const report={date:new Date().toISOString(),missions:[]};
 for(const [id,fixture] of [[1,'mission1-direct.xml'],[2,'mission2-v2-four-fires.xml']]){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:8080/');await page.evaluate(()=>startMission(3));await page.evaluate(()=>closeBriefing());await page.waitForTimeout(200);
 await page.evaluate(x=>applyBlocklyWorkspaceXmlText(x),fs.readFileSync(path.join(root,'test/fixtures/mission3-reference.xml'),'utf8'));await page.evaluate(()=>flushBlocklyAutosave());const saved=await page.evaluate(()=>localStorage.getItem('drone-simulator:v1:blockly-workspace:mission-3'));
 await page.evaluate(id=>startMission(id),id);await page.evaluate(()=>closeBriefing());await page.waitForTimeout(200);
 await page.evaluate(x=>{applyBlocklyWorkspaceXmlText(x);runBlocklyCode()},fs.readFileSync(path.join(root,'test/fixtures',fixture),'utf8'));await page.waitForFunction(()=>!state.isRunning,null,{timeout:150000});
 const result=await page.evaluate(()=>({completed:state.missionCompleted,collision:state.collisionDetected,flying:state.isFlying,fires:firesExtinguished,score:currentScore,position:{x:state.x,y:state.y,z:state.z},hudHidden:document.getElementById('m3-hud').hidden,dispose3:typeof environmentGroup.userData.disposeMission3,dispose2:typeof environmentGroup.userData.disposeMission2V2,categories:[...document.querySelectorAll('.blocklyTreeLabel')].map(x=>x.textContent),saved:localStorage.getItem('drone-simulator:v1:blockly-workspace:mission-3')}));
 assert.ok(result.completed);assert.equal(result.collision,false);assert.ok(result.hudHidden);assert.equal(result.dispose3,'undefined');assert.equal(result.saved,saved);delete result.saved;assert.ok(!result.categories.includes('能源站'));if(id===2){assert.equal(result.fires,4);assert.equal(result.score,1225)}assert.deepEqual(errors,[]);report.missions.push({id,...result,errors});console.log('Mission',id,'passed',JSON.stringify(result));await page.close();
 }
 fs.writeFileSync(path.join(out,'legacy-regression.json'),JSON.stringify(report,null,2)+'\n');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

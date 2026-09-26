// Simulated first-time learner walkthrough; not a study with children.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'audit/mission-3-primary');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1180,height:820}}),report={kind:'Simulated student walkthrough; no human child participants',checks:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/?mission3State=all-offline');await page.evaluate(()=>startMission(3));await page.waitForFunction(()=>workspace&&currentSceneType==='storm');
 const brief=await page.locator('.m3-brief').innerText();for(const word of ['找到能源站','先掃描','關了就啟動','返回基地降落'])assert.ok(brief.includes(word));report.briefing=brief;await page.evaluate(()=>closeBriefing());
 await page.locator('.blocklyTreeLabel').getByText('能源站',{exact:true}).waitFor();
 const cats=await page.locator('.blocklyTreeLabel:visible').allTextContents();assert.deepEqual(cats,['飛行','能源站','如果','重複','進一步']);report.categories=cats;
 for(const label of ['飛行','能源站','如果','重複'])await page.locator('.blocklyTreeRow').filter({has:page.getByText(label,{exact:true})}).click();
 await page.evaluate(()=>{workspace.getToolbox().clearSelection()});
 const program=types=>'<xml xmlns="https://developers.google.com/blockly/xml">'+types.reduceRight((next,t)=>`<block type="${t}">${next?'<next>'+next+'</next>':''}</block>`,'')+'</xml>';
 async function play(xml){await page.evaluate(x=>applyBlocklyWorkspaceXmlText(x),xml);await page.click('#run-blockly-btn');await page.waitForFunction(()=>!state.isRunning,null,{timeout:120000});return page.evaluate(()=>({done:state.missionCompleted,feedback:document.getElementById('m3-feedback').textContent,hint:document.getElementById('m3-hint').textContent,run:JSON.parse(JSON.stringify(Mission3.run))}));}
 let result=await play(program(['event_start','drone_takeoff','m3_next','m3_activate']));assert.equal(result.done,false);assert.equal(result.run.scans,0);assert.equal(result.run.restored,0);assert.match(result.hint,/先掃描/);report.checks.push({case:'activate before scanning cannot repair',...result});
 for(const [width,height,label] of [[1440,900,'desktop'],[1280,800,'laptop'],[1024,768,'tablet'],[1180,820,'ipad-landscape']]){await page.setViewportSize({width,height});await page.evaluate(()=>V2UI.setView('world'));await page.screenshot({path:path.join(out,label+'-hint.png')});}
 await page.evaluate(()=>V2UI.setView('split'));
 await page.evaluate(()=>resetSimulator());
 result=await play(program(['event_start','drone_takeoff','m3_next','m3_scan','m3_activate','m3_next','m3_scan']));assert.equal(result.done,false);assert.equal(result.run.restored,1);assert.match(result.hint,/重複/);report.checks.push({case:'two stations reveal repeated process and preserve one restored relay',...result});
 const reference=fs.readFileSync(path.join(root,'answers/mission-3-primary.xml'),'utf8');result=await play(reference);assert.equal(result.done,true);assert.equal(result.run.restored,3);report.checks.push({case:'edit and rerun reaches completion without resetting restored relay',...result});
 await page.evaluate(()=>document.getElementById('m3-result').close());
 // XML from the previous mission version still imports and compiles in the real workspace.
 await page.evaluate(x=>{applyBlocklyWorkspaceXmlText(x);Mission3Blockly.compile(workspace)},fs.readFileSync(path.join(root,'test/fixtures/mission3-advanced-reference.xml'),'utf8'));report.checks.push({case:'old advanced XML imports and compiles',passed:true});
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'student-walkthrough.json'),JSON.stringify(report,null,2)+'\n');console.log('Student walkthrough passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

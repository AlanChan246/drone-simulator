// Real Blockly -> rendered drone -> relay -> return -> landing. Never sets completion.
// Start npm start first. PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'audit/mission-3');fs.mkdirSync(out,{recursive:true});
const base=process.env.QA_URL||'http://localhost:8080/';
const reference=fs.readFileSync(path.join(root,'test/fixtures/mission3-reference.xml'),'utf8');
const b=(type,body='')=>`<block type="${type}">${body}</block>`;
const value=(name,n)=>`<value name="${name}">${b('math_number',`<field name="NUM">${n}</field>`)}</value>`;
function program(items){let next='';for(const [type,body='']of items.slice().reverse())next=`<block type="${type}">${body}${next?`<next>${next}</next>`:''}</block>`;return `<xml xmlns="https://developers.google.com/blockly/xml">${next}</xml>`;}
(async()=>{
    const browser=await chromium.launch({channel:process.env.QA_CHANNEL||'chrome',headless:true});
    const results=process.env.QA_CONTINUE?JSON.parse(fs.readFileSync(path.join(out,'browser-qa.json'),'utf8')):{date:new Date().toISOString(),states:[],failures:[],viewports:[],errors:[]};
    results.failures=[];results.viewports=[];
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
    page.on('pageerror',e=>results.errors.push(e.message));
    async function enter(preset='test-a'){
        await page.goto(base+'?mission3State='+preset);
        await page.evaluate(()=>startMission(3));
        await page.waitForFunction(()=>currentSceneType==='storm'&&workspace);
        await page.evaluate(()=>closeBriefing());
    }
    async function play(xml){
        await page.evaluate(xml=>{applyBlocklyWorkspaceXmlText(xml);runBlocklyCode();},xml);
        await page.waitForFunction(()=>!state.isRunning,null,{timeout:180000});
        return page.evaluate(()=>({completed:state.missionCompleted,run:JSON.parse(JSON.stringify(Mission3.run)),structure:Mission3.structure,score:Mission3Core.score(Mission3.run,Mission3.structure),feedback:document.getElementById('m3-feedback').textContent}));
    }
    try{
        for(const preset of ['test-a','test-b','test-c','all-offline']){
            if(process.env.QA_CONTINUE&&results.states.some(r=>r.preset===preset&&r.completed))continue;
            await enter(preset);const result=await play(reference);
            assert.ok(result.completed,preset+': '+result.feedback);assert.equal(result.run.scans,3);assert.equal(result.run.redundantActivations,0);assert.equal(result.run.failure,'');
            results.states.push({preset,...result});console.log(preset,'completed',result.run.seconds.toFixed(2),'seconds');
            if(preset==='test-a'){
                await page.screenshot({path:path.join(out,'mission-complete.png')});
                for(const [width,height,label]of [[1440,900,'desktop'],[1280,800,'laptop'],[1024,768,'tablet'],[1180,820,'ipad-landscape']]){
                    await page.setViewportSize({width,height});await page.screenshot({path:path.join(out,label+'-result.png')});
                    assert.ok(await page.evaluate(()=>{const r=document.getElementById('m3-result').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}));
                }
                await page.setViewportSize({width:1440,height:900});
            }
        }
        await page.goto(base+'?mission3Seed=30');await page.evaluate(()=>startMission(3));await page.waitForFunction(()=>currentSceneType==='storm'&&workspace);await page.evaluate(()=>closeBriefing());
        const phaseResult=await play(reference);assert.equal(phaseResult.completed,true);assert.equal(phaseResult.run.phase,22);assert.equal(phaseResult.run.exposure,0);
        results.randomPhase={seed:30,...phaseResult};
        await enter();
        let result=await play(program([['drone_takeoff'],['m3_return'],['drone_land']]));
        assert.equal(result.completed,false);assert.match(result.feedback,/尚未掃描/);results.failures.push({case:'return early',feedback:result.feedback});
        await page.evaluate(()=>resetSimulator());
        result=await play(reference.replaceAll('type="m3_activate"','type="drone_hover"'));
        assert.equal(result.completed,false);assert.match(result.feedback,/仍然離線/);results.failures.push({case:'ignore offline',feedback:result.feedback});
        await page.evaluate(()=>resetSimulator());
        result=await play(program([['drone_takeoff'],['m3_travel',value('INDEX',3)],['m3_scan'],['m3_activate'],['drone_hover',value('DURATION',120)]]));
        assert.equal(result.completed,false);assert.match(result.run.failure,/風暴/);results.failures.push({case:'unsafe storm',exposure:result.run.exposure,feedback:result.feedback});
        await page.evaluate(()=>resetSimulator());
        const repetitive=[['drone_takeoff'],['drone_hover',value('DURATION',11.5)]];
        for(let i=1;i<=3;i++){if(i===3)repetitive.push(['drone_hover',value('DURATION',9)]);repetitive.push(['m3_travel',value('INDEX',i)],['m3_scan'],['m3_activate']);}
        repetitive.push(['m3_return'],['drone_land']);
        result=await play(program(repetitive));
        assert.equal(result.completed,true,result.feedback);assert.ok(result.run.redundantActivations>0);assert.ok(result.score.efficiency<results.states[0].score.efficiency);
        results.failures.push({case:'repetitive program can finish, with lower efficiency',efficiency:result.score.efficiency,redundantActivations:result.run.redundantActivations});
        await page.evaluate(()=>document.getElementById('m3-result').close());
        // Reset interrupts an actual moving program; old animation must not mutate the reset world.
        await page.evaluate(()=>resetSimulator());
        await page.evaluate(xml=>{applyBlocklyWorkspaceXmlText(xml);runBlocklyCode()},reference);
        await page.waitForTimeout(500);await page.evaluate(()=>resetSimulator());await page.waitForTimeout(600);
        assert.deepEqual(await page.evaluate(()=>[state.x,state.y,state.z,state.isRunning]),[-650,14,650,false]);
        results.failures.push({case:'reset cancels live execution',passed:true});
        // Persistence is isolated and survives an actual page reload.
        await page.evaluate(()=>flushBlocklyAutosave());
        const saved=await page.evaluate(()=>localStorage.getItem('drone-simulator:v1:blockly-workspace:mission-3'));
        await page.reload();await page.evaluate(()=>startMission(3));await page.waitForFunction(()=>workspace);await page.evaluate(()=>closeBriefing());
        assert.equal(await page.evaluate(()=>localStorage.getItem('drone-simulator:v1:blockly-workspace:mission-3')),saved);
        assert.ok(await page.evaluate(()=>workspace.getBlocksByType('m3_scan').length>0));
        // True scene screenshots, not illustrations or fabricated success states.
        await page.evaluate(()=>V2UI.setView('world'));await page.waitForTimeout(250);
        const png=await page.evaluate(()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png').split(',')[1]});
        fs.writeFileSync(path.join(root,'assets/images/mission-preview-3.png'),Buffer.from(png,'base64'));
        await page.screenshot({path:path.join(out,'storm-warning.png')});
        for(const [name,x,y,z,radius]of [['drone-base',-650,0,650,1000],['port-relay',-780,0,-390,1450],['town-relay',100,0,300,1350],['medical-centre',650,50,580,1050],['mountain-relay',600,180,-550,1450]]){
            await page.evaluate(({x,y,z,radius})=>{followDrone=false;camTarget={x,y,z};camRadius=radius;updateCameraPosition()},{x,y,z,radius});
            await page.waitForTimeout(150);await page.screenshot({path:path.join(out,name+'.png')});
        }
        for(const [width,height,label]of [[1440,900,'desktop'],[1280,800,'laptop'],[1024,768,'tablet'],[1180,820,'ipad-landscape']]){
            await page.setViewportSize({width,height});await page.evaluate(()=>{V2UI.camera('map');V2UI.setView('split')});await page.waitForTimeout(350);
            await page.screenshot({path:path.join(out,label+'.png')});
            await page.evaluate(()=>V2UI.setView('code'));await page.waitForTimeout(150);await page.screenshot({path:path.join(out,label+'-blockly.png')});
            await page.evaluate(()=>{V2UI.setView('world');showMissionBriefing(3)});await page.waitForTimeout(150);await page.screenshot({path:path.join(out,label+'-briefing.png')});await page.evaluate(()=>closeBriefing());
            const bounds=await page.evaluate(()=>{const h=document.getElementById('m3-hud').getBoundingClientRect(),c=document.getElementById('canvas-container').getBoundingClientRect();return {hudInside:h.left>=c.left&&h.right<=c.right,overflow:document.documentElement.scrollWidth>innerWidth,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};});
            assert.ok(await page.evaluate(()=>environmentGroup.children.filter(m=>m.isInstancedMesh).every(m=>Array.from(m.instanceMatrix.array).every(Number.isFinite))),'finite model transforms');
            assert.equal(bounds.hudInside,true);assert.equal(bounds.overflow,false);results.viewports.push({width,height,label,...bounds});
        }
        await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{returnToMissionSelect();document.querySelector('img[src*="mission-preview-3"]').src='assets/images/mission-preview-3.png?qa='+Date.now()});await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'mission-select.png')});
        assert.equal(results.errors.length,0,results.errors.join('\n'));
    }finally{fs.writeFileSync(path.join(out,'browser-qa.json'),JSON.stringify(results,null,2)+'\n');await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});

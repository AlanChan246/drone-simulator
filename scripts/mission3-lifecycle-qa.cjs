// Local rendering measurements, repeated mission switching and load recovery.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(__dirname,'../audit/mission-3-primary'),base=process.env.QA_URL||'http://localhost:8080/';
(async()=>{
    const browser=await chromium.launch({channel:process.env.QA_CHANNEL||'chrome',headless:true});
    try{
        const page=await browser.newPage({viewport:{width:1180,height:820}}),errors=[],http=[];
        page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)http.push({status:r.status(),url:r.url()})});
        await page.goto(base);
        const report=await page.evaluate(async()=>{
            const t=performance.now();await startMission(3);closeBriefing();const loadMs=performance.now()-t;
            V2UI.camera('map');V2UI.setView('world');
            const mats=new Set(),textures=new Set();let casters=0,lights=0;
            environmentGroup.traverse(o=>{
                if(o.castShadow)casters++;if(o.isLight)lights++;
                for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){
                    mats.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
                }
            });
            const textureSizes=[...textures].map(t=>({width:t.image?.width,height:t.image?.height}));
            const frames=[];let before;
            await new Promise(resolve=>{function frame(t){if(before)frames.push(t-before);before=t;if(frames.length>=120)resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)});
            frames.sort((a,b)=>a-b);
            return {loadMs,materials:mats.size,sceneTextures:textures.size,textureSizes,shadowCasterBatches:casters,sceneLights:lights,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frameMedianMs:frames[60],frameP95Ms:frames[114],renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
        });
        const variation=await page.evaluate(async()=>{
            const pattern=()=>Mission3.run.relays.map(r=>r.initiallyActive).join();
            const before={seed:Mission3.run.seed,pattern:pattern()};resetSimulator();const resetSame=Mission3.run.seed===before.seed;
            await startMission(3);
            const result={resetSame,newSeed:Mission3.run.seed!==before.seed,newPattern:pattern()!==before.pattern};
            // Force repeated RNG values, including the odd FNV buckets that once hung.
            const original=crypto.getRandomValues.bind(crypto);let tested=0;
            try{
                for(let seed=0;seed<16;seed++){
                    crypto.getRandomValues=values=>{values[0]=seed;return values};
                    Mission3.reset(true);const old=pattern();Mission3.reset(true);
                    if(pattern()===old)throw new Error('Fresh mission repeated pattern at seed '+seed);
                    tested++;
                }
            }finally{crypto.getRandomValues=original;}
            return {...result,forcedSeedCases:tested};
        });
        assert.ok(variation.resetSame&&variation.newSeed&&variation.newPattern);assert.equal(variation.forcedSeedCases,16);
        const lifecycle=[];
        for(let i=0;i<3;i++){
            await page.evaluate(()=>startMission(2));await page.evaluate(()=>startMission(3));await page.waitForTimeout(150);
            lifecycle.push(await page.evaluate(()=>({geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,models:environmentGroup.userData.mission3ModelCount})));
        }
        assert.deepEqual(lifecycle[0],lifecycle[1]);assert.deepEqual(lifecycle[1],lifecycle[2]);
        await page.evaluate(()=>closeBriefing());await page.screenshot({path:path.join(out,'performance-viewport.png')});
        assert.equal(errors.length,0);assert.equal(http.length,0);
        fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify({date:new Date().toISOString(),environment:'Local headless Chrome, 1180×820. Not a physical iPad GPU benchmark.',...report,variation,lifecycle,errors,http},null,2)+'\n');
        const context=await browser.newContext({serviceWorkers:'block'}),failurePage=await context.newPage(),failureErrors=[];
        failurePage.on('pageerror',e=>failureErrors.push(e.message));await failurePage.route('**/mission3/manifest.json',r=>r.abort());
        await failurePage.goto(base);await failurePage.evaluate(()=>startMission(3));
        const recovery=await failurePage.evaluate(()=>({message:document.body.innerText.includes('能源島素材未能載入'),retry:document.body.innerText.includes('重新選擇任務三')}));
        assert.ok(recovery.message&&recovery.retry);assert.equal(failureErrors.length,0);
        fs.writeFileSync(path.join(out,'load-recovery.json'),JSON.stringify({recovery,errors:failureErrors},null,2)+'\n');
        console.log('Lifecycle, 16 forced seeds, texture stability and asset-load recovery passed.');
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});

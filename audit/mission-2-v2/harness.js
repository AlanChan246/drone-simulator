/* Local-only browser fixture. This folder is excluded from Pages packaging. */
const frame=document.getElementById('app'),report=document.getElementById('report');
const variant=new URLSearchParams(location.search).get('scene')||'mission2-legacy';
frame.src='../../index.html?scene='+variant;
const run=source=>frame.contentWindow.eval(source);
function show(value){report.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);}
frame.addEventListener('load',async()=>{
    frame.contentWindow.document.addEventListener('keydown',event=>{if(event.key==='F8')document.body.classList.toggle('capture');});
    try{await frame.contentWindow.startMission(2);frame.contentWindow.closeBriefing();
        frame.contentWindow.document.querySelector('[data-view="world"]')?.click();
        show('Ready: '+variant);
    }catch(e){show(e.stack);}
});
function switchVariant(value){run(`history.replaceState(null,'','?scene=${value}');changeScene('city');`);show('Ready: '+value);}
document.getElementById('legacy').onclick=()=>switchVariant('mission2-legacy');
document.getElementById('v2').onclick=()=>switchVariant('mission2-v2');
document.getElementById('capture').onclick=()=>document.body.classList.add('capture');
document.getElementById('reset').onclick=()=>{frame.contentWindow.resetSimulator();show(snapshot());};
function snapshot(){return run(`({variant:environmentGroup.userData.sceneVariant||'legacy',position:{x:state.x,y:state.y,z:state.z,heading:state.heading},running:state.isRunning,flying:state.isFlying,complete:state.missionCompleted,collision:state.collisionDetected,water:state.hasWater,battery:cityBatteryLines,fires:firesExtinguished,firePoints:mission2FirePoints,score:currentScore,stations:forestChargeData.map(s=>({i:s.i,j:s.j,triggered:s.triggered})),commands:cmdQueue.length,draw:{...renderer.info.render},memory:{...renderer.info.memory}})`);}
document.getElementById('status').onclick=()=>show(snapshot());
document.getElementById('metrics').onclick=async()=>{
    show('Measuring 120 display frames…');
    const result=await run(`(async()=>{
        const times=[];let previous=performance.now();
        for(let n=0;n<120;n++)await new Promise(resolve=>requestAnimationFrame(now=>{times.push(now-previous);previous=now;resolve();}));
        times.shift();times.sort((a,b)=>a-b);
        return {variant:environmentGroup.userData.sceneVariant||'legacy',draw:{...renderer.info.render},memory:{...renderer.info.memory},medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)],width:renderer.domElement.width,height:renderer.domElement.height};
    })()`);show(result);
};
document.getElementById('parity').onclick=async()=>{
    show('Comparing Legacy/v2 grid, sensor rays, collision boundaries and lifecycle…');
    await new Promise(r=>setTimeout(r,30));
    try{
    const result=run(`(()=>{
        const results=[];const assert=(condition,label)=>{if(!condition)throw new Error(label);results.push(label);};
        const sensorSample=()=>{environmentGroup.updateMatrixWorld(true);const samples=[];
            // Legacy raycasts its non-wall labels without a camera, which throws in
            // Three r128. Exclude only those labels in this geometry parity probe.
            const spriteRaycast=THREE.Sprite.prototype.raycast;THREE.Sprite.prototype.raycast=function(){};
            try {
            currentMazeGrid.forEach((row,i)=>row.forEach((v,j)=>{if(v===1)return;
                state.x=mazeOffsetX+j*150+75;state.z=mazeOffsetZ+i*150+75;
                for(const y of [40,95,220,400,421]){state.y=y;
                    for(const heading of [0,90,180,270]){state.heading=heading;
                        for(const dir of ['front','left','right'])samples.push(getSensorReading(dir,'cm'));
                    }
                }
            }));return samples;} finally {THREE.Sprite.prototype.raycast=spriteRaycast;} };
        const collisionSample=()=>{const out=[];
            for(let z=-1060;z<=1060;z+=75)for(let x=-1060;x<=1060;x+=75){
                state.x=x;state.z=z;state.y=95;state.collisionDetected=true;lastSafePos={x:-825,y:95,z:-825};handleWallCollision();out.push(state.x,state.z);
            }return out;};
        history.replaceState(null,'','?scene=mission2-legacy');changeScene('city');
        const legacy={grid:JSON.stringify(currentMazeGrid),start:JSON.stringify(startPosition),goal:JSON.stringify(targetPosition),rays:sensorSample(),collisions:collisionSample()};
        const lighting=scene.children.filter(o=>o.isLight).map(o=>[o.color.getHex(),o.intensity,o.position.toArray(),o.groundColor?.getHex()]);
        history.replaceState(null,'','?scene=mission2-v2');changeScene('city');
        assert(JSON.stringify(currentMazeGrid)===legacy.grid,'full grid identical');
        assert(JSON.stringify(startPosition)===legacy.start,'spawn + heading identical');
        assert(JSON.stringify(targetPosition)===legacy.goal,'goal identical');
        const rays=sensorSample();assert(rays.length===legacy.rays.length&&rays.every((v,i)=>Math.abs(v-legacy.rays[i])<.000001),rays.length+' sensor readings identical');
        const collisions=collisionSample();assert(JSON.stringify(collisions)===JSON.stringify(legacy.collisions),'841 collision probes identical');
        resetSimulator();assert(cityBatteryLines===20&&!state.hasWater&&firesExtinguished===0,'reset state');
        let fires=[];environmentGroup.traverse(o=>{if(o.userData.isForestFire)fires.push(o);});
        assert(fires.length===4,'four registered fire sites');
        hideForestFireAt(2,12);assert(fires.find(f=>f.userData.fireIJ==='2,12').userData.effects.visible===false,'extinguish presentation');
        resetCityMissionState();assert(fires.every(f=>f.userData.effects.visible),'fire reset presentation');
        const charge=forestChargeData[0];state.x=charge.x;state.z=charge.z;state.y=95;
        creditForestChargeHover(3);assert(cityBatteryLines===35&&charge.triggered,'charge +15');
        creditForestChargeHover(3);assert(cityBatteryLines===35,'charge once');
        resetCityMissionState();assert(cityBatteryLines===20&&!charge.triggered,'charge reset');
        state.x=825;state.z=-825;state.y=15;state.isFlying=false;
        assert(evaluateCityMissionCompletion().ok&&firesExtinguished===0,'partial completion allowed');
        state.isFlying=true;assert(!evaluateCityMissionCompletion().ok,'hover cannot complete');
        state.isFlying=false;state.y=121;assert(!evaluateCityMissionCompletion().ok,'high landing rejected');
        resetSimulator();[ [2,12],[4,10],[11,5],[12,10] ].forEach(([i,j])=>awardMission2FireScore(i,j));
        assert(mission2FirePoints===575,'fire score 575');awardMission2FireScore(2,12);assert(mission2FirePoints===575,'fire score deduplicated');
        history.replaceState(null,'','?scene=mission2-legacy');changeScene('city');
        const restored=scene.children.filter(o=>o.isLight).map(o=>[o.color.getHex(),o.intensity,o.position.toArray(),o.groundColor?.getHex()]);
        assert(JSON.stringify(lighting)===JSON.stringify(restored),'global lights restored exactly');
        assert(!environmentGroup.userData.sceneVariant,'legacy restored');
        history.replaceState(null,'','?scene=mission2-v2');changeScene('city');
        state.collisionDetected=false;hideAppMessage();
        return {passed:results,final:'v2 reset',sensorCount:rays.length};
    })()`);show(result);
    }catch(e){show({error:e.stack});}
};
async function fly(path){
    try{
        const xml=await (await fetch(path)).text();
        frame.contentWindow.resetSimulator();frame.contentWindow.ensureBlocklyWorkspaceReady();
        // Uses the same real Blockly import and Run entry points as the student UI.
        frame.contentWindow.applyBlocklyWorkspaceXmlText(xml);
        frame.contentWindow.document.getElementById('run-blockly-btn').click();
        show('Running '+path);
        const timer=setInterval(()=>{const value=snapshot();show(value);if(!value.running)clearInterval(timer);},1000);
    }catch(e){show(e.stack);}
}
document.getElementById('reference').onclick=()=>fly('../../test/fixtures/city-reference.xml');
document.getElementById('full').onclick=()=>fly('../../test/fixtures/mission2-v2-four-fires.xml');
// Test-only panel shortcut; never loaded by index.html.
document.addEventListener('keydown',event=>{if(event.key==='F8')document.body.classList.toggle('capture');});

document.getElementById('objective').onclick=()=>{
    run("followDrone=false;camTarget={x:825,y:40,z:-760};camRadius=750;camPhi=50;camTheta=45;updateCameraPosition();");
    show('Objective camera inspection only; drone state is unchanged.');
};
document.getElementById('switchcheck').onclick=()=>{
    const result=run(`(()=>{
        const checks=[];
        for(const type of ['tunnel','free','city','tunnel','city']){
            changeScene(type);
            checks.push({type,variant:environmentGroup.userData.sceneVariant||'legacy',grid:currentMazeGrid?.length||0,start:{...startPosition},lights:scene.children.filter(o=>o.isLight).map(o=>({color:o.color.getHex(),intensity:o.intensity}))});
        }
        const assets=performance.getEntriesByType('resource').filter(e=>/\\.(glb|png)(\\?|$)/.test(e.name));
        return {checks,resources:assets.map(e=>({name:e.name,bytes:e.transferSize}))};
    })()`);show(result);
};

// Export only the rendered world, without flight-deck overlays.
document.getElementById('preview').onclick=()=>show(run(`(()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');})()`));

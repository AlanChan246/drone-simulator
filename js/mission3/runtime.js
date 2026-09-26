/* Owns only Storm Island execution, cancellation, sensors and learner feedback. */
window.Mission3 = (() => {
    const C=Mission3Core;
    let run=null, generation=0, hintIndex=0, currentStructure={};
    const hints=['不是每個能源站都需要啟動。先觀察掃描結果。','先掃描，再用 IF 判斷「狀態 = OFFLINE」；ACTIVE 可以跳過。','用變數記錄站號，重複 3 次，每圈把站號加 1。','山區飛行前反覆讀取感測器。若剛好在 SAFE 尾段，可先等它離開 SAFE，再等下一輪 SAFE，取得完整窗口。'];
    function reset(fresh=false) {
        generation++;
        const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
        const q=new URLSearchParams(location.search);
        let seed=local&&q.has('mission3Seed')?q.get('mission3Seed'):(!fresh&&run?run.seed:String(crypto.getRandomValues(new Uint32Array(1))[0]));
        if(fresh&&run&&!(local&&(q.has('mission3State')||q.has('mission3Seed')))){
            const old=run.relays.map(r=>r.initiallyActive).join();
            // FNV-1a modulo 4: appending 'a' maps every bucket to a different bucket.
            if(C.create(seed).relays.map(r=>r.initiallyActive).join()===old)seed+='a';
        }
        run=C.create(seed,local?q.get('mission3State'):null);
        hintIndex=0;
        setTelemetryText('m3-feedback','掃描後才能確認能源站的狀態。');
        if(document.getElementById('m3-hint'))document.getElementById('m3-hint').textContent='先掃描，讓程式根據結果決定下一步。';
        sync();
    }
    function cancel(){generation++;}
    function message(body,warning=false) {
        logToConsole(body);
        const node=document.getElementById('m3-feedback');if(node)node.textContent=body;
        if(warning)showAppMessage({variant:'warn',title:'調整你的飛行程式',body,nextStep:'觀察感測值與目前積木，修改後重試。',focusClose:false});
    }
    function sense(type) {
        if(!run)throw new Error('能源任務尚未就緒。');
        if(type==='storm'){run.stormReads++;return C.storm(run);}
        if(type==='status')return C.status(run,state);
        if(type==='checked')return run.relays.filter(r=>r.scanned).length;
        throw new Error('未知感測器');
    }
    function valid(token){return token===generation&&currentSceneType==='storm'&&!state.stopSignal;}
    function guard(token){if(!valid(token))throw new Error('M3_STOP');if(run.failure)throw new Error(run.failure);}
    async function motion(seconds, target, token) {
        if(!Number.isFinite(seconds)||seconds<0||seconds>600)throw new Error('時間必須是 0–600 秒的有限數字。');
        const from={x:state.x,y:state.y,z:state.z};
        if(target&&['x','y','z'].some(key=>!Number.isFinite(target[key])))throw new Error('飛行座標必須是有限數字。');
        let elapsed=0, previous=performance.now();
        await new Promise((resolve,reject)=>{
            function frame(now){
                try {
                    guard(token);
                    const dt=Math.min((now-previous)/1000*executionSpeed,seconds-elapsed);previous=now;
                    // Simulation increments stay small even on a slow display: collision cannot tunnel.
                    for(let rest=Math.max(0,dt);rest>1e-8;){
                        const step=Math.min(.025,rest);elapsed+=step;rest-=step;
                        const p=seconds?Math.min(1,elapsed/seconds):1;
                        if(target){
                            const next={x:from.x+(target.x-from.x)*p,y:from.y+(target.y-from.y)*p,z:from.z+(target.z-from.z)*p};
                            if(Mission3Scene.collides(next)){
                                state.collisionDetected=true;run.failure='無人機碰撞建築或山坡。先上升到安全高度，或使用能源站航點避開障礙，再重設重試。';guard(token);
                            }
                            run.distance+=Math.hypot(next.x-state.x,next.y-state.y,next.z-state.z);
                            Object.assign(state,next);
                        }
                        C.advance(run,step,state);guard(token);
                    }
                    sync();
                    if(elapsed+1e-7>=seconds)resolve();else requestAnimationFrame(frame);
                }catch(error){reject(error);}
            }
            if(seconds===0){resolve();return;}
            requestAnimationFrame(frame);
        });
        guard(token);
    }
    async function travel(target,token) {
        if(Math.hypot(state.x-target.x,state.z-target.z)<30)run.unnecessaryMoves++;
        await motion(1,{x:state.x,y:520,z:state.z},token);
        await motion(3,{x:target.x,y:520,z:target.z},token);
        await motion(1,target,token);
    }
    async function command(cmd,token) {
        guard(token);
        if(++run.commands>600)throw new Error('指令超過 600 次。請檢查迴圈停止條件。');
        executionDebug.currentIndex=run.commands-1;
        await waitForExecutionGate(cmd._blockId);guard(token);
        if(currentExecutingBlockId)highlightBlock(currentExecutingBlockId,false);
        highlightBlock(cmd._blockId,true);
        if(window.V2UI)V2UI.command(cmd,run.commands-1,run.commands);
        run.trace.push({type:cmd.type,seconds:+run.seconds.toFixed(2),block:cmd._blockId});
        if(cmd.type!=='takeoff'&&cmd.type!=='print'&&!state.isFlying)throw new Error('先使用起飛積木，再移動或操作能源站。');
        switch(cmd.type) {
            case 'takeoff':
                if(state.isFlying)throw new Error('無人機已起飛，無需重複起飛。');
                run.started=true;state.isFlying=true;hasTakenOff=true;
                await motion(1.5,{x:state.x,y:100,z:state.z},token);break;
            case 'land':
                if(Math.hypot(state.x-C.BASE.x,state.z-C.BASE.z)>85){message(C.pending(run,state),true);break;}
                await motion(1.5,{x:C.BASE.x,y:C.BASE.y,z:C.BASE.z},token);state.isFlying=false;
                if(C.land(run,state)){state.missionCompleted=true;result();}else message(C.pending(run,state),true);
                break;
            case 'm3_travel': {
                const index=Number(cmd.index);
                if(!Number.isInteger(index)||index<1||index>3)throw new Error('能源站編號須為 1、2 或 3。');
                await travel(C.RELAYS[index-1],token);break;
            }
            case 'm3_return':await travel({...C.BASE,y:100},token);break;
            case 'm3_scan':await motion(1,null,token);message(C.scan(run,state));break;
            case 'm3_activate': {
                const issue=C.activationIssue(run,state);
                if(issue){message(issue,true);await motion(.5,null,token);break;}
                const relay=C.relayAt(run,state);relay.activating=true;sync();
                await motion(2,null,token);relay.activating=false;message(C.activate(run,state));break;
            }
            case 'hover':await motion(Number(cmd.param),null,token);break;
            case 'print':message(String(cmd.fn?cmd.fn():cmd.value??cmd.param??cmd.text));break;
            case 'goto_xyz':await motion(5,{x:cmd.x,y:cmd.y,z:cmd.z},token);break;
            case 'set_heading':state.heading=Number(cmd.val);await motion(.5,null,token);break;
            case 'turn_left':case 'turn_right':state.heading+=(cmd.type==='turn_left'?1:-1)*Number(cmd.param);await motion(.5,null,token);break;
            default: {
                if(!/^move_(forward|backward|left|right|up|down)$/.test(cmd.type))throw new Error('這個動作不適用於能源任務。');
                const duration=Number(cmd.param),distance=duration*50*(cmd.power===undefined?1:Number(cmd.power)/50),rad=state.heading*Math.PI/180;
                const dir=cmd.type.slice(5),sign=dir==='backward'||dir==='right'||dir==='down'?-1:1;
                const target={x:state.x,y:state.y,z:state.z};
                if(dir==='up'||dir==='down')target.y+=distance*sign;
                else if(dir==='left'||dir==='right'){target.x-=Math.cos(rad)*distance*sign;target.z+=Math.sin(rad)*distance*sign;}
                else{target.x-=Math.sin(rad)*distance*sign;target.z-=Math.cos(rad)*distance*sign;}
                if(distance===0)run.unnecessaryMoves++;
                await motion(Math.abs(duration),target,token);
            }
        }
        sync();
    }
    async function execute(ws) {
        if(state.isRunning)return;
        let code;
        try{code=Mission3Blockly.compile(ws);}catch(error){message(error.message,true);return;}
        if(run.completed||run.failure){message('請先重設任務，再執行修改後的程式。',true);return;}
        const token=++generation;
        currentStructure=Mission3Blockly.structure(ws);
        state.stopSignal=false;state.isRunning=true;
        V2UI.prepareRun();
        let loops=0;
        try{
            const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
            await new AsyncFunction('__command','__sense','__tick','getSensorReading','state',code)(
                cmd=>command(cmd,token),sense,async()=>{guard(token);if(++loops>600)throw new Error('迴圈超過 600 次。加入等待動作，並檢查感測條件。');await new Promise(r=>setTimeout(r,0));guard(token);},getSensorReading,state);
            if(valid(token)&&!run.completed)message(C.pending(run,state),true);
        }catch(error){
            if(error.message!=='M3_STOP'&&valid(token)){message(error.message,true);if(run.failure)state.isFlying=false;}
        }finally{
            if(token===generation){state.isRunning=false;if(currentExecutingBlockId)highlightBlock(currentExecutingBlockId,false);V2UI.programEnded();sync();}
        }
    }
    function sync() {
        const hud=document.getElementById('m3-hud');if(!hud)return;
        hud.hidden=currentSceneType!=='storm';if(hud.hidden||!run)return;
        const online=run.relays.filter(r=>r.active&&r.scanned).length;
        setTelemetryText('m3-progress',`${online} / 3 已確認供電`);
        const level=C.storm(run);setTelemetryText('m3-storm',`${level>=70?'DANGER · 危險':level>=40?'WARNING · 注意':'SAFE · 安全'} ${level}`);
        document.getElementById('m3-storm').dataset.level=level>=70?'danger':level>=40?'warning':'safe';
        setTelemetryText('m3-power',`${Math.ceil(run.backup)}%`);
        document.getElementById('m3-power-meter').value=run.backup;
        setTelemetryText('active-mission-title','任務三 · 暴風島能源重啟');
        setTelemetryText('top-mission-progress',`${online}/3 能源站`);
        setTelemetryText('v2-objective','掃描、判斷、恢復供電，返回基地降落。');
        setTelemetryText('m3-relays',run.relays.map(r=>`${r.id} ${!r.scanned?'未知':r.activating?'啟動中':r.restored?'已恢復':r.active?'正常':'離線'}`).join('　'));
        if(window.Mission3Scene)Mission3Scene.update(run);
    }
    function hint(){setTelemetryText('m3-hint',hints[Math.min(hintIndex++,hints.length-1)]);}
    function result() {
        const s=C.score(run,currentStructure);currentScore=s.total;
        const dialog=document.getElementById('m3-result');
        dialog.querySelector('[data-summary]').textContent=`全島供電恢復，無人機已安全返回基地。總分 ${s.total} / 1000。`;
        const rows=[['能源站',`${run.restored} 座修復 · 3 座已確認`],['飛行距離',`${(run.distance/100).toFixed(1)} m`],['積木數量',currentStructure.blocks],['重複掃描／多餘動作',`${run.redundantScans} / ${s.waste}`],['危險風暴暴露',`${run.exposure.toFixed(1)} 秒`],['任務時間',`${run.seconds.toFixed(1)} 秒`],['編程效率',`${s.efficiency} / 250`]];
        dialog.querySelector('dl').replaceChildren(...rows.flatMap(([label,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);return [dt,dd];}));
        dialog.querySelector('[data-advice]').textContent=currentStructure.loops&&currentStructure.conditions?'你的程式能重複讀取環境並作出判斷。下一次嘗試減少重複掃描與危險暴露。':'試用迴圈整理重複指令，以 IF 跳過正常能源站，再用風暴感測器決定出發時機。';
        dialog.showModal();
    }
    function briefing(title,content) {
        title.textContent = '任務三：暴風島能源重啟';
        content.innerHTML = `<p class="brief-lead">暴風切斷島上能源。編寫能感測、判斷與重複執行的 Drone Program，恢復供電，再返回基地降落。</p>
        <ol><li>起飛，飛往能源站 1／2／3（港口／城鎮／山區）。</li><li>掃描 → IF 狀態為 OFFLINE → 啟動；ACTIVE 可跳過。</li><li>前往山區前讀取風暴。低於 40 的安全窗口有 11 秒；航程需 5 秒，掃描 1 秒，啟動 2 秒。</li><li>確認三站供電後返回基地，降落完成交班。</li></ol>
        <details><summary>風暴、備用電源與編程效率</summary><p>風暴 ≥70 為 DANGER，會阻止山區啟動並累積暴露；累積 30 秒任務失敗。可在山區外等待，反覆讀取感測器。SAFE 全段為 11 秒，但中途讀到 SAFE 不代表仍剩 11 秒；可觀察風暴轉換，等下一輪完整窗口。</p><p>醫療中心備用電源可支撐 10 分鐘模擬飛行時間；編輯及暫停時不扣電。重設保留同一環境，重新進入任務產生新環境。</p><p>基本完成 500 分、安全 150 分、效率 250 分、時間 100 分。效率綜合迴圈、條件、感測、變數、重複動作及距離，不單看積木數量。</p></details><details><summary>3D 素材與授權</summary><p>Kenney：CC0；Transmission Tower by iPoly3D：CC0。<a href="https://poly.pizza/m/gCcpjaxFdv" target="_blank" rel="noopener">Crane by J-Toastie</a> 使用 <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>，已調整比例及方向。</p></details>`;
    }
    function commandName(cmd){return {m3_travel:`飛往能源站 ${cmd.index}`,m3_scan:'掃描能源站',m3_activate:'啟動能源站',m3_return:'返回基地'}[cmd.type];}
    return {reset,cancel,execute,sense,sync,hint,briefing,commandName,get run(){return run;},get structure(){return currentStructure;}};
})();

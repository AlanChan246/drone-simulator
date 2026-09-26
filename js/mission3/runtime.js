/* Owns only Storm Island execution, cancellation, sensors and learner feedback. */
window.Mission3 = (() => {
    const C=Mission3Core;
    let run=null, generation=0, hintIndex=0, hintContext='start', flightTarget='', currentStructure={};
    const hints={
        start:['先想：到達能源站後，要先做甚麼？','先放「起飛」，再放「前往下一站」。','到達後放「掃描能源站」，先看看結果。'],
        scan:['先掃描，看看能源站是不是關了。','把「掃描能源站」放在「啟動能源站」前面。'],
        decide:['哪個動作只在能源站關了時才需要做？','把「能源站需要啟動？」放進「如果」。','在「如果」裏放「啟動能源站」。正常的就跳過。'],
        repeat:['這組指令又做一次了。哪些積木一直重複？','試試把「前往下一站、掃描、如果」放進「重複 3 次」。'],
        storm:['山區有風暴。先看看「風暴安全？」再決定要不要前進。','「前往下一站」會在危險時等候。想自己控制，可在「進一步」找等待積木。'],
        retry:['看看哪個能源站還沒亮起，再修改積木。','直接再按「執行」：從基地出發，已亮起的能源站會保留。'],
        home:['三個能源站都亮起了！最後要去哪裏？','放「返回基地」，再放「降落」。']
    };
    function setHint(context,open=false){
        if(hintContext!==context){hintContext=context;hintIndex=0;}
        setTelemetryText('m3-hint',hints[context][hintIndex]);
        if(open)document.getElementById('m3-help').open=true;
    }
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
        hintIndex=0;hintContext='start';flightTarget='';
        currentStructure={};
        setTelemetryText('m3-feedback','先放「起飛」，再前往下一站。');
        setHint('start');
        document.getElementById('m3-help').open=false;
        sync();
    }
    function cancel(){generation++;}
    function message(body,warning=false) {
        logToConsole(body);
        const node=document.getElementById('m3-feedback');if(node)node.textContent=body;
        if(warning)setHint(hintContext,true);
    }
    function sense(type) {
        if(!run)throw new Error('能源站還在準備，請稍後再試。');
        if(type==='storm'){run.stormReads++;return C.storm(run);}
        if(type==='status'){
            const status=C.status(run,state);
            if(status==='UNKNOWN'){setHint('scan',true);message('先掃描，才知道要不要啟動。');}
            return status;
        }
        if(type==='checked')return run.relays.filter(r=>r.scanned).length;
        throw new Error('未知感測器');
    }
    function valid(token){return token===generation&&currentSceneType==='storm'&&!state.stopSignal;}
    function guard(token){if(!valid(token))throw new Error('M3_STOP');if(run.failure)throw new Error(run.failure);}
    async function motion(seconds, target, token) {
        if(!Number.isFinite(seconds)||seconds<0||seconds>600)throw new Error('等待時間請填 0 到 600 秒。');
        const from={x:state.x,y:state.y,z:state.z};
        if(target&&['x','y','z'].some(key=>!Number.isFinite(target[key])))throw new Error('飛行位置請填數字，再試一次。');
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
                                state.collisionDetected=true;run.failure='碰到障礙物了。按「重設」再試；「前往下一站」可以繞開障礙。';guard(token);
                            }
                            run.distance+=Math.hypot(next.x-state.x,next.y-state.y,next.z-state.z);
                            Object.assign(state,next);
                        }
                        C.advance(run,step,state);guard(token);
                    }
                    if(C.inStorm(state)&&C.storm(run)>=70){
                        setHint('storm',true);message('這裏有風暴！可以先離開，等安全再來。');
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
        if(++run.commands>600)throw new Error('重複太多次了。試試「重複 3 次」，再按執行。');
        executionDebug.currentIndex=run.commands-1;
        await waitForExecutionGate(cmd._blockId);guard(token);
        if(currentExecutingBlockId)highlightBlock(currentExecutingBlockId,false);
        highlightBlock(cmd._blockId,true);
        if(window.V2UI)V2UI.command(cmd,run.commands-1,run.commands);
        run.trace.push({type:cmd.type,seconds:+run.seconds.toFixed(2),block:cmd._blockId});
        if(cmd.type!=='takeoff'&&cmd.type!=='print'&&!state.isFlying)throw new Error('先放「起飛」，無人機才可以出發。');
        switch(cmd.type) {
            case 'takeoff':
                if(state.isFlying)throw new Error('已經起飛了，不用再放一次「起飛」。');
                run.started=true;state.isFlying=true;hasTakenOff=true;
                await motion(1.5,{x:state.x,y:100,z:state.z},token);break;
            case 'land':
                if(Math.hypot(state.x-C.BASE.x,state.z-C.BASE.z)>85){message(C.pending(run,state),true);break;}
                await motion(1.5,{x:C.BASE.x,y:C.BASE.y,z:C.BASE.z},token);state.isFlying=false;
                if(C.land(run,state)){state.missionCompleted=true;result();}else message(C.pending(run,state),true);
                break;
            case 'm3_next': {
                if(run.nextIndex>=C.RELAYS.length){setHint('home',true);message('三站都去過了。看看是否都亮起，再返回基地。');break;}
                const target=C.RELAYS[run.nextIndex];
                flightTarget=`前往能源站 ${target.id}`;
                if(target.id==='C'&&C.storm(run)>=70){
                    run.stormWaits++;flightTarget='山區有風暴，先等一下';setHint('storm',true);
                    message('導航會在山外等到安全，再出發。');
                    while(C.storm(run)>=70)await motion(.5,null,token);
                }
                flightTarget=`前往能源站 ${target.id}`;message('到達後，先掃描能源站。');
                try{await travel(target,token);run.nextIndex++;}finally{flightTarget='';}
                break;
            }
            case 'm3_travel': {
                const index=Number(cmd.index);
                if(!Number.isInteger(index)||index<1||index>3)throw new Error('能源站編號須為 1、2 或 3。');
                await travel(C.RELAYS[index-1],token);break;
            }
            case 'm3_return':await travel({...C.BASE,y:100},token);break;
            case 'm3_scan':
                await motion(1,null,token);message(C.scan(run,state));
                setHint(C.relayAt(run,state)?'decide':'scan');
                if(run.scans>=2&&!currentStructure.loops)setHint('repeat',true);
                break;
            case 'm3_activate': {
                const issue=C.activationIssue(run,state);
                if(issue){setHint(C.relayAt(run,state)?.scanned?'decide':'scan',true);message(issue);await motion(.5,null,token);break;}
                const relay=C.relayAt(run,state);relay.activating=true;sync();
                try{await motion(2,null,token);message(C.activate(run,state));}finally{relay.activating=false;}break;
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
        // A revised program starts from the base; completed relay work stays visible.
        if(run.started){
            syncDroneToStart();state.isFlying=false;state.collisionDetected=false;hasTakenOff=false;
            message('從基地再試一次，已亮起的能源站會保留。');
        }
        run.nextIndex=0;run.commands=0;flightTarget='';
        const token=++generation;
        currentStructure=Mission3Blockly.structure(ws);
        if(currentStructure.duplicates>=4&&!currentStructure.loops)setHint('repeat',true);
        state.stopSignal=false;state.isRunning=true;
        V2UI.prepareRun();
        let loops=0;
        try{
            const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
            await new AsyncFunction('__command','__sense','__tick','getSensorReading','state',code)(
                cmd=>command(cmd,token),sense,async()=>{guard(token);if(++loops>600)throw new Error('重複停不下來了。看看條件，或改用「重複 3 次」。');await new Promise(r=>setTimeout(r,0));guard(token);},getSensorReading,state);
            if(valid(token)&&!run.completed){
                setHint(['start','home'].includes(hintContext)?'retry':hintContext,true);
                message(C.pending(run,state));
            }
        }catch(error){
            if(error.message!=='M3_STOP'&&valid(token)){message(error.message,true);if(run.failure)state.isFlying=false;}
        }finally{
            if(token===generation){flightTarget='';state.isRunning=false;if(currentExecutingBlockId)highlightBlock(currentExecutingBlockId,false);V2UI.programEnded();sync();}
        }
    }
    function objective(){
        if(run.completed)return '小島恢復電力了！';
        if(run.failure)return '按「重設」，再試一次';
        if(flightTarget)return flightTarget;
        if(run.relays.every(r=>r.active&&r.scanned))return Math.hypot(state.x-C.BASE.x,state.z-C.BASE.z)<85?'在基地降落':'返回基地，再降落';
        const here=C.relayAt(run,state);
        if(here&&!here.scanned)return `掃描能源站 ${here.id}`;
        if(here&&!here.active)return `看看結果：${here.id} 需要啟動`;
        const next=run.relays.find(r=>!r.scanned||!r.active);
        return `前往能源站 ${next.id}`;
    }
    function sync() {
        const hud=document.getElementById('m3-hud');if(!hud)return;
        hud.hidden=currentSceneType!=='storm';if(hud.hidden||!run)return;
        const online=run.relays.filter(r=>r.active&&r.scanned).length,danger=C.storm(run)>=70;
        setTelemetryText('m3-progress',`能源站 ${online} / 3`);
        setTelemetryText('m3-storm',danger?'山區風暴：危險':'山區風暴：安全');
        document.getElementById('m3-storm').dataset.level=danger?'danger':'safe';
        setTelemetryText('m3-objective',objective());
        setTelemetryText('active-mission-title','任務三 · 暴風島能源重啟');
        setTelemetryText('top-mission-progress',`${online}/3 能源站`);
        setTelemetryText('v2-objective','幫小島恢復電力！');
        if(window.Mission3Scene)Mission3Scene.update(run);
    }
    function hint(){hintIndex=Math.min(hintIndex+1,hints[hintContext].length-1);setHint(hintContext);}
    function result() {
        const score=C.score(run,currentStructure);currentScore=score.total;
        const dialog=document.getElementById('m3-result');
        dialog.querySelector('[data-summary]').textContent='小島恢復供電了！無人機也安全回到基地。';
        const fill=(selector,rows)=>dialog.querySelector(selector).replaceChildren(...rows.flatMap(([label,value])=>{
            const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);return [dt,dd];
        }));
        fill('[data-main-results]',[['能源站','3 / 3 亮起'],['安全飛行',run.exposure<.01?'全程避開危險風暴':'下次試試等風暴安全'],['完成時間',`${run.seconds.toFixed(0)} 秒`]]);
        const praise=[];
        if(currentStructure.conditions&&run.statusReads)praise.push('你用了「如果」，讓無人機自己判斷要不要啟動。');
        if(currentStructure.loops)praise.push('你用了「重複」，同一組積木就能處理三站。');
        if(!praise.length)praise.push('你讓小島亮起了！下次試試用「如果」和「重複」。');
        dialog.querySelector('[data-advice]').textContent=praise.join(' ');
        fill('[data-extra-results]',[['總分',`${score.total} / 1000`],['積木',currentStructure.blocks],['多餘動作',score.waste],['飛行距離',`${(run.distance/100).toFixed(1)} m`]]);
        dialog.querySelector('details').open=false;dialog.showModal();
    }
    function briefing(title,content) {
        title.textContent='暴風島能源重啟';
        const icon=path=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
        content.innerHTML=`<div class="m3-brief">
            <p class="m3-story">暴風過後，小島停電了！</p>
            <p>找出關掉的能源站，把它們重新啟動。</p>
            <ol class="m3-steps">
                <li>${icon('M12 21s7-7 7-12A7 7 0 0 0 5 9c0 5 7 12 7 12ZM9 9h6M12 6v6')}<strong>找到能源站</strong></li>
                <li>${icon('M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5M7 12h10')}<strong>先掃描</strong></li>
                <li>${icon('M12 3v9M7 5a8 8 0 1 0 10 0')}<strong>關了就啟動</strong></li>
            </ol>
            <p class="m3-finish">三站都亮起後，返回基地降落！</p>
            <details class="m3-credit"><summary>素材鳴謝</summary><p>Kenney 與 iPoly3D：CC0。<a href="https://poly.pizza/m/gCcpjaxFdv" target="_blank" rel="noopener">Crane by J-Toastie</a>：<a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>，已調整比例及方向。</p></details>
        </div>`;
    }
    function commandName(cmd){return {m3_next:'前往下一站',m3_travel:`前往能源站 ${cmd.index}`,m3_scan:'掃描能源站',m3_activate:'啟動能源站',m3_return:'返回基地'}[cmd.type];}
    return {reset,cancel,execute,sense,sync,hint,briefing,commandName,get run(){return run;},get structure(){return currentStructure;}};
})();

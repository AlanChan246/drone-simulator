/* Integration boundary: the shared simulator only calls these narrow hooks. */
window.SkyMission = (()=>{
    let configuration=SkyGateConfig.configuration(),rules=null,visual=null,generation=0,lastTime=0,error=null,activeBlock=null,stats=null,hasRun=false,executingStep=false;
    const active=()=>currentSceneType==='sky';
    const labels={event_start:'程式開始',controls_if:'判斷感測條件',controls_repeat_ext:'重複執行',controls_whileUntil:'檢查迴圈條件',sky_wait_until:'等待閘門條件成立',procedures_callnoreturn:'執行自訂行為',sky_set_channel:'設定通訊頻道',sky_send:'發送通行訊號',sky_activate:'啟動天空基地'};
    function build(){rules=SkyGateRules.create(configuration);visual=SkyCity.build(scene,environmentGroup,renderer);environmentGroup.userData.sceneVariant='mission3';startPosition={...SkyGateConfig.spawn};targetPosition={...SkyGateConfig.goal};lastTime=performance.now();}
    function dispose(){cancel();visual?.dispose();visual=null;rules=null;delete environmentGroup.userData.sceneVariant;}
    function cancel(){generation++;}
    function reset(){cancel();error=null;stats=null;hasRun=false;executingStep=false;rules?.reset();lastTime=performance.now();SkyUI.reset();visual?.update(rules.snapshot(),0,true);}
    function ground(x,z){const values=SkyGateConfig.platforms.filter(p=>Math.abs(x-p.x)<=p.w/2&&Math.abs(z-p.z)<=p.d/2).map(p=>p.y+14);return values.length?Math.max(...values):-160;}
    function fail(e){if(error)return;error=e;state.stopSignal=true;SkyUI.feedback(e.message,true);showAppMessage({variant:'warn',title:'程式停在這一步',body:e.message,nextStep:'積木與閘門配置已保留。修改後按「重試」從起點驗證。',focusClose:false});if(e.blockId||activeBlock)highlightBlock(e.blockId||activeBlock,true);}
    function moved(from){
        if(!active()||!rules||error)return;
        try{
            rules.move(from,state);
            if(state.isFlying){
                if(state.y<ground(state.x,state.z)-2)throw new Error('無人機低於平台表面。請先上升到航線標示高度。');
                const p=new THREE.Vector3(state.x,state.y,state.z);
                if(visual.obstacles.some(b=>b.clone().expandByScalar(12).containsPoint(p)))throw new Error('研究設備擋住了航線。請沿中央航道飛行，檢查轉向與距離。');
            }
        }catch(e){state.x=from.x;state.y=from.y;state.z=from.z;fail(e);}
    }
    function tick(){if(!active()||!rules)return;const now=performance.now(),dt=Math.max(0,now-lastTime);lastTime=now;if(followDrone)camTheta=state.heading+55;if(state.isRunning&&(executingStep||!executionDebug.paused))rules.tick(dt);SkyUI.sync();visual.update(rules.snapshot(),dt,matchMedia('(prefers-reduced-motion: reduce)').matches);}
    function sensor(name,node){
        if(name==='signal'){const s=rules.signal(state);SkyUI.feedback(`讀取 ${rules.target().name}：${s} ${SkyUI.shape(s)}`);return s;}
        if(name==='open')return rules.isOpen();if(name==='distance')return rules.distance(state);if(name==='height')return state.y;return state[name];
    }
    async function run(ws){
        if(!rules||state.isRunning)return;
        if(hasRun||error||state.missionCompleted||state.isFlying||rules.snapshot().completed){SkyUI.feedback('請先按「重試」，再從起點執行完整程式。',true);return;}
        let program;try{program=SkyProgram.compile(ws);}catch(e){showAppMessage({variant:'warn',title:'請先檢查積木連接',body:e.message,nextStep:'飛行程式需要一個開始積木，以及完整的條件和數值。',focusClose:false});if(e.blockId)highlightBlock(e.blockId,true);return;}
        const token=++generation;const stopped=()=>token!==generation||state.stopSignal||!active();
        state.stopSignal=false;state.isRunning=true;hasRun=true;error=null;V2UI.prepareRun();
        try{
            stats=await SkyProgram.run(program,{
                stopped,sensor,waiting:()=>rules.noteWait(),
                sleep:async ms=>{await new Promise(resolve=>setTimeout(resolve,ms));},
                step:async(node,s)=>{executingStep=false;await waitForExecutionGate(node.id);if(stopped())return;executingStep=true;stats=s;activeBlock=node.id;executionDebug.currentIndex=s.steps-1;highlightBlock(node.id,true);SkyUI.revealBlock(node.id);V2UI.command({type:node.type.replace('drone_',''),text:labels[node.type]||SkyUI.blockLabel(node)},s.steps-1,s.steps);SkyUI.action(labels[node.type]||SkyUI.blockLabel(node));await new Promise(resolve=>setTimeout(resolve,40));},
                command:async cmd=>{
                    if(stopped())return;
                    if(cmd.type==='sky_set_channel'){rules.select(cmd.channel);SkyUI.feedback(`無人機頻道：${cmd.channel} ${SkyUI.shape(cmd.channel)}`);await wait(450);}
                    else if(cmd.type==='sky_send'){const gate=rules.send(state);SkyUI.feedback(`${gate.name} 已接收訊號，正在開啟。`);await wait(300);}
                    else if(cmd.type==='sky_activate'){
                        rules.activate(state);state.missionCompleted=true;currentScore=500+(rules.snapshot().rejections===0?100:0);SkyUI.feedback('天空基地已重新啟動。你的程式完成了任務！');
                        await new Promise(resolve=>setTimeout(resolve,1000));if(!stopped())result();
                    }else{
                        if(cmd.type==='takeoff'&&state.isFlying)throw new Error('無人機已起飛。請用「向上飛行」調整高度。');
                        if(!state.isFlying&&!['takeoff','print'].includes(cmd.type))throw new Error('無人機仍在平台上。請先起飛，再執行飛行指令。');
                        if(cmd.type==='land'&&ground(state.x,state.z)<0)throw new Error('這裏沒有降落平台。請檢查航線，飛回平台上方再降落。');
                        await dispatchCommand(cmd);
                    }
                }
            });
            if(!stopped()&&!state.missionCompleted){const s=rules.snapshot();showAppMessage({variant:'info',title:'程式已結束，基地仍未啟動',body:`已通過 ${s.completed}/3 道閘門。${s.completed===3?'在核心平台降落後，還需要啟動基地。':'請檢查航道、閘門訊號和等待條件。'}`,nextStep:'按「重試」保留配置及積木，再驗證修改。',focusClose:false});}
        }catch(e){if(e.message!=='STOP'&&!stopped())fail(e);}
        finally{if(token===generation){executingStep=false;state.isRunning=false;executionDebug.currentIndex=-1;if(!error&&currentExecutingBlockId)highlightBlock(currentExecutingBlockId,false);V2UI.programEnded();SkyUI.sync();}}
    }
    function result(){const s=rules.snapshot();window.showResultModal({mission:3,row1Label:'智能閘門',row1Count:'3 / 3',row1Score:300,row2Label:'基地重啟',row2Status:'完成',row2Score:200,time:Math.floor(s.elapsed/1000),timeBonus:100,total:600,beacons:3});SkyUI.result(stats,s);}
    function setMode(mode){if(state.isRunning)return;configuration=SkyGateConfig.configuration(mode,configuration.revision);rules=SkyGateRules.create(configuration);resetSimulator();SkyUI.sync();}
    function newChallenge(){if(state.isRunning)return;configuration=SkyGateConfig.configuration('challenge',configuration.revision+1);rules=SkyGateRules.create(configuration);closeResultModal();resetSimulator();SkyUI.feedback(`新挑戰 ${configuration.key} 已就緒；積木保留，訊號與開門速度已更換。`);}
    return {active,build,dispose,cancel,reset,ground,moved,tick,run,setMode,newChallenge,generation:()=>generation,snapshot:()=>rules?.snapshot(),configuration:()=>configuration};
})();

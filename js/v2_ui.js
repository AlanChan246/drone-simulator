/* Presentation only. Simulation state and command/mission rules stay authoritative. */
window.V2UI = (() => {
    const el = id => document.getElementById(id);
    const text = (id, value) => { const node = el(id); if (node && node.textContent !== value) node.textContent = value; };
    let lastSync = 0;
    let lastCommand = '';
    let wasPaused = false;
    let collisionShown = false;
    const paths = {
        play: 'M8 5l12 7-12 7z', pause: 'M8 5v14M16 5v14', stop: 'M6 6h12v12H6z',
        reset: 'M4 10a8 8 0 1 1 1 8M4 4v6h6', back: 'M19 12H5m6-6-6 6 6 6',
        info: 'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
        camera: 'M3 6h18v14H3zM8 6l2-3h4l2 3M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
        more: 'M5 12h.01M12 12h.01M19 12h.01', step: 'M5 5l10 7-10 7zM19 5v14',
        upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5', download: 'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
        minus: 'M5 12h14', plus: 'M5 12h14M12 5v14', fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
        code: 'M9 6l-6 6 6 6M15 6l6 6-6 6', chevron: 'M6 15l6-6 6 6', point: 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0'
    };
    function icon(name) { return `<svg class="v2-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.info}"/></svg>`; }
    function icons() {
        const map = [['#console-toggle-btn>span:first-child','chevron'],['.back-btn-game span:first-child','back'],['#toggle-blockly-btn .ui-icon','code'],['#mission-briefing-btn .ui-icon','info'],['#camera-mode-btn .ui-icon','camera'],['#utility-menu-btn>span:first-child','more'],['#run-blockly-btn>span:first-child','play'],['#debug-pause-btn>span:first-child','pause'],['[onclick="stepExecution()"]>span:first-child','step'],['.program-btn--stop>span:first-child','stop'],['.program-btn[onclick="resetSimulator()"]>span:first-child','reset'],['.breakpoint-dot','point'],['.blockly-tool-btn--import .blockly-tool-btn__glyph','upload'],['.blockly-tool-btn--export .blockly-tool-btn__glyph','download']];
        map.forEach(([selector,name]) => { const node=document.querySelector(selector); if(node)node.innerHTML=icon(name); });
        [['out','minus'],['in','plus'],['reset','fit']].forEach(([action,name]) => {const node=document.querySelector(`[onclick="zoomBlockly('${action}')"]`);if(node)node.innerHTML=icon(name);});
    }
    function setView(view) {
        const deck=el('game-interface'), panel=el('blocklyDiv');
        deck.dataset.view=view;
        if(view!=='world' && !panel.classList.contains('visible')) toggleBlocklyPanel();
        panel.inert=view==='world';
        el('canvas-container').inert=view==='code';
        document.querySelectorAll('.v2-view-switch button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
        requestAnimationFrame(()=>{initBlockly();refreshGameUILayout();});
    }
    function resetFeedback() {
        collisionShown=false;
        hideAppMessage();
        text('v2-action-status','準備飛行');
        text('v2-action-label','積木已保留。調整路線，再試一次。');
        el('v2-command-progress').value=0;
    }
    const projected = new THREE.Vector3();
    function projectLabels(camera, drone, destination) {
        const box=el('canvas-container');
        const canvas=box.querySelector('canvas');
        const width=canvas?.clientWidth||box.clientWidth,height=canvas?.clientHeight||box.clientHeight;
        function place(id,x,y,z,visible) {
            const label=el(id);
            projected.set(x,y,z).project(camera);
            label.hidden=!visible||projected.z>1||projected.z< -1||Math.abs(projected.x)>.9||Math.abs(projected.y)>.8;
            if(!label.hidden)label.style.transform=`translate(${(projected.x+1)*width/2}px,${(1-projected.y)*height/2}px) translate(-50%,-160%)`;
        }
        place('v2-drone-label',drone.x,drone.y+15,drone.z,true);
        place('v2-goal-label',destination.x,0,destination.z,currentGameMode==='mission'&&!followDrone);
    }
    function enter() {
        dismissBlocklyDiscoverToast();
        hideAppMessage();
        toggleConsole(false);
        lastCommand='';
        setView(window.innerWidth<1100?'code':'split');
        camera(currentGameMode==='freeplay'?'follow':'map');
        text('v2-action-status','準備飛行');
        text('v2-action-label','把想法連成積木，再按執行。');
        el('v2-command-progress').value=0;
        setTimeout(()=>{initBlockly();sync();},60);
    }
    function workspaceReady(ws) {
        ws.addChangeListener(()=>{el('v2-empty').hidden=ws.getAllBlocks(false).length>0;});
        el('v2-empty').hidden=ws.getAllBlocks(false).length>0;
    }
    function starter() {
        const ws=ensureBlocklyWorkspaceReady();
        if(!ws)return;
        const apply=()=>{
            const xml='<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_start" x="32" y="32"><next><block type="drone_takeoff"><next><block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><shadow type="math_number"><field name="NUM">50</field></shadow></value><next><block type="drone_land"/></next></block></next></block></next></block></xml>';
            applyBlocklyWorkspaceXmlText(xml); flushBlocklyAutosave();
        };
        if(state.isRunning)return;
        if(ws.getAllBlocks(false).length)showAppConfirm('這會取代目前積木。先匯出保存，或確認改用示範程式。',{title:'載入第一次飛行'}).then(ok=>{if(ok)apply();});else apply();
    }
    function undo(redo) { if(workspace&&!state.isRunning)workspace.undo(redo); }
    function camera(mode) {
        followDrone=mode==='follow';
        camTarget.x=followDrone?state.x:0;camTarget.y=followDrone?state.y:0;camTarget.z=followDrone?state.z:0;
        camRadius=followDrone?(currentGameMode==='freeplay'?FOLLOW_CAMERA_RADIUS:220):(currentGameMode==='freeplay'?FREE_CAMERA_RADIUS:3200);
        if(!followDrone && currentSceneType==='city' && environmentGroup?.userData.sceneVariant==='mission2-v2')camRadius=Mission2V2Config.overviewRadius;
        camPhi=mode==='top'?10:followDrone?30:35;
        updateCameraPosition();
        text('camera-mode-label',followDrone?'跟隨視角':mode==='top'?'俯視':'全景');
        document.querySelectorAll('.v2-camera-tools button').forEach(button=>button.setAttribute('aria-pressed',String(button.textContent===(followDrone?'跟隨':mode==='top'?'俯視':'全景'))));
    }
    const names={takeoff:'起飛',land:'安全降落',move_forward:'向前飛行',move_backward:'向後飛行',move_left:'向左飛行',move_right:'向右飛行',move_up:'上升',move_down:'下降',hover:'懸停觀察',turn_left:'向左轉向',turn_right:'向右轉向',goto_xyz:'飛向指定座標',collect_water:'裝填水箱',release_water:'噴水滅火',set_color:'改變燈光',print:'輸出觀察結果',wait_key:'等待按下空白鍵',turn_time:'按時間轉向',set_var:'設定飛行動力',set_heading:'轉至指定航向',move_complex:'按設定動力飛行'};
    function command(cmd,index,total) {
        lastCommand=names[cmd.type]||'執行飛行指令';
        text('v2-action-status',`指令 ${index+1} / ${total}`);
        text('v2-action-label',lastCommand);
        el('v2-command-progress').max=total;
        el('v2-command-progress').value=index+1;
    }
    function prepareRun(){hideAppMessage();if(el('game-interface').dataset.view==='code')setView('world');}
    function programEnded(result) {
        const incomplete=result && result.completed<result.total;
        text('v2-action-status',state.missionCompleted?'任務完成':state.stopSignal?'已停止':incomplete?'有指令未能執行':'程式執行完畢');
        text('v2-action-label',state.missionCompleted?'救援目標已達成。':state.stopSignal?'調整積木後，可以重設再試。':incomplete?'依照提示調整積木，再試一次。':'觀察飛行結果，再試一個新想法。');
    }
    function sync() {
        const now=Date.now();if(now-lastSync<100)return;lastSync=now;
        const deck=el('game-interface');if(!deck)return;
        if(state.collisionDetected&&!collisionShown){collisionShown=true;showAppMessage({variant:'warn',title:'無人機碰到障礙物',body:'這一步的移動已被擋住。',nextStep:'檢查目前積木的方向與距離；重設後沿道路再試。',focusClose:false});}
        if(!state.collisionDetected)collisionShown=false;
        deck.dataset.scene=currentSceneType;
        deck.dataset.running=String(state.isRunning);
        el('blockly-workspace').inert=state.isRunning;
        document.querySelectorAll('.blockly-tool-btn--import,.v2-editor-footer button').forEach(button=>button.disabled=state.isRunning);
        el('run-blockly-btn').disabled=state.isRunning;
        el('debug-pause-btn').disabled=!state.isRunning;
        document.querySelector('.program-btn--stop').disabled=!state.isRunning&&!state.isFlying;
        text('v2-objective',currentGameMode==='freeplay'?'自由試飛：起飛、移動，再安全降落。':currentSceneType==='tunnel'?'沿道路抵達疏散區並降落。巡檢可額外加分。':'取水滅火，最後在受災區降落。');
        text('hud-flight-state',state.collisionDetected?'碰到障礙物':state.isRunning&&lastCommand==='起飛'?'起飛中':state.isRunning&&lastCommand==='安全降落'?'降落中':state.isFlying?'飛行中':'已降落');
        text('v2-drone-label',state.isRunning?(executionDebug.paused?'無人機 · 已暫停':`無人機 · ${lastCommand||'準備執行'}`):'無人機');
        if(state.isRunning&&executionDebug.paused)text('v2-action-status','下一塊積木前暫停 · 可按單步或繼續');
        else if(state.isRunning&&wasPaused)text('v2-action-status',`指令 ${executionDebug.currentIndex+1} / ${cmdQueue.length}`);
        wasPaused=executionDebug.paused;
        if(el('v2-empty')&&workspace)el('v2-empty').hidden=workspace.getAllBlocks(false).length>0;
    }
    function briefing(id,content) {
        const details=content.innerHTML.replace(/<h4>/g,'<h3>').replace(/<\/h4>/g,'</h3>');
        const tunnel=Number(id)===1;
        content.innerHTML=`<div class="v2-brief-intro"><img src="assets/images/mission-preview-${tunnel?1:'2-v2'}.png" alt="任務場景"><div><h3>${tunnel?'讓情報安全送達。':'把每一趟飛行用在救援上。'}</h3><p>${tunnel?'從基地起飛，沿道路抵達綠色疏散區，使用降落積木完成交班。':'在水源取水、飛到火點噴水，最後在綠色救援平台降落結算。'}</p><ul>${tunnel?'<li>不可飛越建築，也不能直接飛至座標。</li><li>巡檢是加分目標：懸停 3 秒，每處 +100。</li>':'<li>水箱只能裝一份水，用完要重新取水。</li><li>留意電量；充電站懸停 3 秒可補充。</li><li>撲滅愈多火點分數愈高，全滅額外加分。</li>'}</ul></div></div><details class="v2-brief-rules"><summary>地圖圖例、計分與進階提示</summary>${details}</details>`;
        content.querySelectorAll('.brief-legend-badge').forEach(node=>{
            if(['↓','⚡'].includes(node.textContent.trim())){node.innerHTML=icon(node.textContent.trim()==='↓'?'download':'point');node.setAttribute('aria-hidden','true');}
        });
        content.querySelectorAll('.brief-step-icon').forEach(node=>node.remove());
        content.querySelectorAll('.brief-legend-swatch:not(.brief-legend-swatch--model)').forEach(node=>{node.innerHTML=icon(node.classList.contains('brief-legend-swatch--beacon')?'point':'download');});
    }
    function nextMission() {closeResultModal();emergencyStop();if(activeMissionId===1)startMission(2);else showMissionSelect();}
    function toggleTelemetry(){el('game-interface').classList.toggle('show-telemetry');}
    function toggleDebug(){el('game-interface').classList.toggle('show-debug');}
    document.addEventListener('keydown',event=>{
        if(event.key==='Escape'){toggleUtilityMenu(false);return;}
        if(event.key!=='Tab')return;
        const modal=['orientation-hint','app-confirm-modal','result-modal','mission-briefing'].map(el).find(node=>node&&!node.hidden&&getComputedStyle(node).display!=='none');
        if(!modal)return;
        const focusable=[...modal.querySelectorAll('button:not(:disabled),[href],summary,input,select,[tabindex="0"]')].filter(node=>node.getClientRects().length);
        const first=focusable[0],last=focusable.at(-1);if(!first)return;
        if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}
    });
    const modalIds=['orientation-hint','app-confirm-modal','result-modal','mission-briefing','v2-scene-loading'];
    const syncModal=()=>{
        const open=modalIds.some(id=>{const node=el(id);return node&&!node.hidden&&getComputedStyle(node).display!=='none';});
        ['game-interface','main-menu','mission-select-menu'].forEach(id=>{el(id).inert=open;});
    };
    const modalObserver=new MutationObserver(syncModal);
    modalIds.forEach(id=>modalObserver.observe(el(id),{attributes:true,attributeFilter:['hidden','style']}));
    document.querySelector('.skip-link').addEventListener('click',event=>{
        event.preventDefault();
        const target=getComputedStyle(el('game-interface')).display!=='none'?el('game-interface'):
            getComputedStyle(el('mission-select-menu')).display!=='none'?el('mission-select-menu').querySelector('main'):el('main-menu-content');
        target.setAttribute('tabindex','-1');target.focus();
    });
    const consoleObserver=new ResizeObserver(()=>scheduleGameUILayoutRefresh());
    consoleObserver.observe(el('console-panel'));
    icons();
    return {enter,setView,workspaceReady,starter,undo,camera,command,programEnded,sync,briefing,nextMission,toggleTelemetry,toggleDebug,icon,resetFeedback,projectLabels,prepareRun};
})();

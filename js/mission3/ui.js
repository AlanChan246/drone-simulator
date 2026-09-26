/* Mission-specific presentation. No flight commands or gate solving here. */
window.SkyUI=(()=>{
    const el=id=>document.getElementById(id),text=(id,s)=>{if(el(id)&&el(id).textContent!==s)el(id).textContent=s;};
    const shape=s=>({A:'●',B:'▲',C:'■'}[s]||'');let hintIndex=0;
    const hints=['在門前的感測區讀取訊號；字母與圖形一起表示頻道。','用「如果／否則」比較訊號，讓不同分支設定不同通訊頻道。','發送正確訊號後，門仍需要時間開啟。用條件等待確認安全，再飛過。','三道門規則相同。你可以把通訊、等待的積木放進自訂行為，重用三次。'];
    function feedback(s,bad=false){text('sky-feedback',s);el('sky-feedback')?.classList.toggle('sky-feedback--error',bad);sync();}
    function reset(){hintIndex=0;feedback('讀訊號 → 選頻道 → 發送 → 等門開 → 通過');}
    function hint(){feedback(hints[Math.min(hintIndex++,hints.length-1)]);}
    function action(s){text('v2-action-label',s);text('v2-action-status','即時執行 · 感測器隨飛行更新');}
    function revealBlock(id){const b=workspace?.getBlockById(id),svg=b?.getSvgRoot();if(!svg)return;const r=svg.getBoundingClientRect(),w=el('blockly-workspace').getBoundingClientRect();if(r.bottom>w.bottom-20||r.top<w.top+10||r.left>w.right-80||r.right<w.left+100)workspace.centerOnBlock(id);}
    function blockLabel(n){const names={drone_takeoff:'起飛',drone_land:'降落',drone_move_cm:({FORWARD:'向前飛行',BACKWARD:'向後飛行',LEFT:'向左飛行',RIGHT:'向右飛行',UP:'上升',DOWN:'下降'}[n.fields.DIR]),drone_turn_degree:'轉向',drone_hover:'懸停',variables_set:'設定變數',math_change:'改變變數',drone_print:'記錄感測結果'};return names[n.type]||'執行積木';}
    function sync(){
        const enabled=SkyMission.active();el('sky-strip').hidden=!enabled;
        const empty=el('v2-empty')?.querySelector('p');const emptyText=enabled?'從「事件與飛行」加入開始與起飛積木。航線按鈕提供距離；通訊邏輯由你編寫。':'從「飛行指令」拖入起飛積木，或先試一段短程式。';if(empty&&empty.textContent!==emptyText)empty.textContent=emptyText;
        if(!enabled)return;
        const s=SkyMission.snapshot();if(!s)return;
        const status={locked:'待通訊',accepted:'開啟中',open:'可通過',completed:'已通過'};
        s.gates.forEach((g,i)=>{text(`sky-gate-${i+1}`,`${g.status==='completed'?'✓ ':''}${g.id} · ${status[g.status]}`);el(`sky-gate-${i+1}`).dataset.state=g.status;});
        text('sky-channel',`無人機 ${s.channel} ${shape(s.channel)}`);text('sky-config',s.configuration.key);
        el('sky-mode').value=s.configuration.mode;el('sky-mode').disabled=state.isRunning;
        el('sky-new').disabled=state.isRunning;el('sky-retry').disabled=state.isRunning;
        text('v2-objective',s.activated?'基地已啟動':s.completed===3?'核心平台降落 → 啟動天空基地':`感測 → 判斷 → 通過閘門 ${s.completed+1}`);
    }
    function route(){return `<ol class="sky-route"><li><strong>起飛 → 閘門 1</strong><span>前進 200 cm 到感測區。通訊並等門開後，前進 200 cm。</span></li><li><strong>右轉 → 閘門 2</strong><span>右轉 90°、上升 80 cm、前進 300 cm。處理閘門，再前進 200 cm。</span></li><li><strong>左轉 → 閘門 3</strong><span>左轉 90°、上升 80 cm、前進 400 cm。處理閘門，再前進 300 cm。</span></li><li><strong>核心平台</strong><span>降落，然後啟動天空基地。</span></li></ol><p class="sky-note">這是航線資料。如何用條件與等待處理閘門，由你的程式決定。感測範圍：門前 190 cm 內。</p>`;}
    function briefing(content){
        el('briefing-title').textContent='天空機關城';
        content.innerHTML=`<div class="sky-brief"><img src="assets/images/mission-preview-3.jpg" alt="雲海上的研究平台、三道機械門與中央控制塔"><h3>破解三道智能閘門，重啟天空基地！</h3><ol class="sky-flow"><li><strong>讀取訊號</strong><span>A ● / B ▲ / C ■</span></li><li><strong>判斷與發送</strong><span>選頻道，發送訊號</span></li><li><strong>等門開，再通過</strong><span>最後降落並啟動基地</span></li></ol><p>每道閘門都用同一套規則。沒有倒數；失敗後修改積木，再試一次。</p><details><summary>查看航線與編程提示</summary>${route()}<p>「如果／否則」決定發送甚麼訊號；「等待直到」確保門已完全打開。進階玩家可用自訂行為重用同一段邏輯。</p></details></div>`;
    }
    function result(stats,s){
        text('result-modal-title','天空基地，重新啟動！');text('v2-next-mission','選擇其他任務');text('res-row3-label','可靠通訊');text('res-time','三門正確通行');text('res-time-bonus','+100');
        text('v2-result-next',`已完成三道閘門與核心平台。${stats?.procedures?'你重用了自訂行為。':stats?.loops?'你使用了迴圈。':'下一次可以試試重用通訊邏輯。'}按「重試」驗證同一配置，或返回飛行畫面選「新挑戰」。`);
        el('res-grade-block').hidden=false;text('res-grade-badge','可靠通行');el('res-grade-badge').className='result-grade-badge';text('res-grade-desc','完成任務 500 分 + 正確通訊 100 分；不以速度或積木數量扣分。');
    }
    return {shape,feedback,reset,hint,action,blockLabel,sync,route,briefing,result,revealBlock};
})();
document.getElementById('sky-route-content').innerHTML=SkyUI.route();

window.FactoryUI = (() => {
    const el = id => document.getElementById(id), text = (id, value) => { const node = el(id); if (node && node.textContent !== String(value)) node.textContent = value; };
    const hints = [
        '先到 A 取件台夾取零件。用「夾具上的零件狀態」讀取「正常」或「故障」。',
        '把「零件狀態 = 故障」放進如果／否則。故障走維修站，正常直接送裝配站。',
        '故障零件放下後，要啟動維修，再等待「維修完成？」才重新夾取。',
        '每件交付後回到 A。把處理一件的流程放進重複六次，或重複直到已交付零件數等於六。'
    ];
    let hintIndex = 0, lastLabel = '', lastStep = 0;
    const labels = { event_start: '開始工廠程式', drone_takeoff: '起飛', drone_land: '安全降落', drone_move_cm: '按距離飛行', drone_move_time: '按時間飛行',
        drone_turn: '轉向', drone_turn_degree: '轉向', drone_turn_heading: '調整航向', drone_hover: '懸停觀察', drone_print: '輸出觀察結果',
        factory_pickup: '夾取零件', factory_drop: '放下零件', factory_start_repair: '啟動維修', factory_wait: '等待', factory_wait_until: '等待條件成立',
        factory_repeat: '重複處理', controls_repeat_ext: '重複處理', factory_until: '檢查迴圈條件', controls_whileUntil: '檢查迴圈條件',
        factory_if_else: '判斷零件狀態', controls_if: '判斷條件', procedures_callnoreturn: '執行函式積木',
        variables_set: '設定變數', factory_set_variable: '設定變數', math_change: '改變變數', factory_change_variable: '改變變數' };
    function routeDetails() {
        return `<p>每格 150 cm。起飛後朝北，前方為北、右方為東；轉向後，移動方向會跟著改變。</p>
          <table class="brief-time-table"><thead><tr><th>位置</th><th>X / Z（cm）</th></tr></thead><tbody>
          <tr><td>起飛基地</td><td>−1200 / 1200</td></tr><tr><td>A 取件台</td><td>0 / 750</td></tr>
          <tr><td>B 維修站</td><td>−1200 / −300</td></tr><tr><td>C 裝配站</td><td>1200 / −300</td></tr>
          <tr><td>出貨平台</td><td>0 / −1200</td></tr></tbody></table>
          <p>沿灰藍色通道飛行。A 到中央路口向北 1050 cm，再向西或東 1200 cm 到 B 或 C。中央通道亦通往北側出貨平台。操作口半徑 100 cm；操作高度 50–180 cm。不可直接飛到座標。</p>`;
    }
    function setup() {
        if (el('factory-new-order')) return;
        const button = document.createElement('button'); button.id = 'factory-new-order'; button.type = 'button'; button.hidden = true;
        button.textContent = '換一張訂單'; button.className = 'v2-secondary';
        button.addEventListener('click', () => FactoryMission.newOrder());
        el('canvas-container').appendChild(button);
        const extra = document.createElement('div'); extra.className = 'factory-hud'; extra.innerHTML = `<div><small>夾具</small><strong id="factory-cargo">無零件</strong></div><div><small>維修站</small><strong id="factory-repair">空閒</strong></div><div><small>交付</small><strong id="factory-progress">0 / 6</strong></div>`;
        el('hud-display').appendChild(extra);
    }
    function sync() {
        setup(); const active = FactoryMission.active(), data = FactoryMission.data;
        el('factory-new-order').hidden = !active;
        if (!active || !data) return;
        text('active-mission-title', '任務三 · 失控機械工廠'); text('top-mission-progress', `交付 ${data.delivered.length}/6`);
        text('hud-mission-progress', `交付 ${data.delivered.length}/6`);
        text('v2-objective', '辨識零件、送修及交付。完成六件後到出貨平台降落。');
        text('factory-cargo', data.cargo ? data.cargo.status : '無零件');
        text('factory-repair', ({ idle: '空閒', loaded: '待啟動', working: '維修中', ready: '可取回' })[data.repair.status]);
        text('factory-progress', `${data.delivered.length} / 6`); text('factory-order-id', `訂單 F${data.seed} · 重試保留次序`);
        text('hud-score', `得分 ${data.delivered.length * 100 + (data.completed ? 200 : 0)}`);
        text('factory-order-details', data.order.map((p, i) => `${i + 1}. ${p.status}${p.status === '故障' ? `（維修 ${p.repairSeconds} 秒）` : ''}`).join(' → '));
        el('factory-new-order').disabled = state.isRunning;
        el('run-blockly-btn').disabled = state.isRunning;
        el('factory-load-retry')?.remove();
        if (state.isRunning) {
            text('v2-action-status', executionDebug.paused ? '下一塊積木前暫停 · 單步或繼續' : `執行第 ${lastStep} 步`);
            text('v2-action-label', lastLabel);
            text('v2-drone-label', executionDebug.paused ? '無人機 · 已暫停' : `無人機 · ${lastLabel}`);
        }
        el('v2-command-progress').max = 6; el('v2-command-progress').value = data.delivered.length;
        el('v2-command-progress').setAttribute('aria-label', '零件交付進度');
    }
    function status(title, body) { text('v2-action-status', title); text('v2-action-label', body); }
    function command(node, count) { lastLabel = labels[node.type] || '執行積木'; lastStep = count; status(`執行第 ${count} 步`, lastLabel); }
    function briefing(content) {
        text('briefing-title', '任務三：失控機械工廠');
        content.innerHTML = `<div class="v2-brief-intro"><img src="${FactoryConfig.preview}" alt="工廠的收貨、維修、裝配與出貨區"><div><h3>讓救援裝配線重新運作。</h3><p>工廠的分類系統失靈了。讀取零件狀態，把故障零件送修，再交給裝配線。完成六件零件後，在出貨平台降落。</p><ul><li>辨識正常／故障，選擇處理方式。</li><li>故障零件送修，等待完成再夾取。</li><li>重複處理六件零件，完成後降落。</li></ul></div></div>
          <details class="v2-brief-rules"><summary>地圖圖例、計分與進階提示</summary>
          <h3>操作口與航線</h3>${routeDetails()}
          <h3>零件與機器</h3><p>磁力夾具一次只拿一件。B 維修站只收故障零件；C 裝配站只收正常或已修好的零件。下一件會在上一件交付後入站，零件到站會停下等待。</p>
          <h3>計分</h3><p>每件成功交付 +100；六件完成後在出貨平台降落 +200，合共 800 分。沒有倒數、電量或時間扣分。</p>
          <h3>編程提示</h3><p>先測試處理一件零件，用如果／否則選擇路線，再用迴圈處理整張訂單。等待直到能讓程式配合機器進度。</p><p>控制、運算、變數及函式積木對照 Scratch 概念；夾具與工廠偵測屬本模擬器擴充。函式第一版不接受參數或回傳值。</p>
          <p id="factory-hint">先用一件零件測試流程，再考慮如何重複。</p><button type="button" class="v2-secondary" id="factory-hint-button">顯示下一個提示</button><h3>重試與新訂單</h3><p>重試保留積木與次序；換一張訂單會保留積木，更換零件次序與維修時間。可在場景視窗右上角換訂單，用同一程式測試你的判斷是否可靠。</p><p id="factory-order-id"></p><p id="factory-order-details"></p></details>`;
        el('factory-hint-button').addEventListener('click', () => { text('factory-hint', hints[hintIndex % hints.length]); hintIndex++; });
        sync();
    }
    function result(data) {
        window.showResultModal({ mission: 3, row1Label: '合格零件', row1Count: '6 / 6', row1Score: 600,
            row2Label: '出貨平台降落', row2Status: 'YES', row2Score: 200, beacons: 6,
            time: Math.floor(data.elapsed / executionSpeed), timeBonus: 0, total: 800 });
        text('v2-next-mission', '換一張訂單');
        const loops = Object.values(data.learning.loopDeliveries).some(items => new Set(items.map(i => i.iteration)).size >= 2);
        const conditional = data.learning.branches.some(b => b.cargoId && b.result) && data.learning.branches.some(b => b.cargoId && !b.result);
        const messages = [loops ? '你用迴圈重用了多件零件的處理流程。' : '你已完成任務！試試把相同操作放進迴圈，讓程式更容易修改。',
            conditional ? '你根據現場零件狀態選擇了不同處理方式。' : '下一步：用零件狀態作條件判斷，讓程式適應不同訂單。', '保留程式換一張訂單，測試它能否再次完成。'];
        text('v2-result-next', messages.join(' '));
    }
    function loadingError() {
        showAppMessage({ variant: 'error', title: '工廠模型未能完整載入', body: '請檢查網絡，然後重試載入。你的積木儲存不受影響。', focusClose: true });
        el('factory-load-retry')?.remove();
        const retry = document.createElement('button'); retry.id = 'factory-load-retry'; retry.type = 'button'; retry.className = 'v2-secondary'; retry.textContent = '重新載入工廠';
        retry.addEventListener('click', () => { hideAppMessage(); startMission(3); }, { once: true });
        el('app-message-banner').appendChild(retry);
    }
    return { setup, sync, status, command, briefing, result, loadingError };
})();

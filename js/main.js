// ==========================================
// 檔案：js/main.js
// 用途：UI 互動、Blockly 執行核心、指令隊列處理
// ==========================================
// Blockly 工作區變數（延遲初始化）
let workspace = null;
// 保存積木區寬度（百分比）
let savedBlocklyWidth = 30; // 默認 30%

// Blockly 自動儲存（依任務分開存於 localStorage）
const BLOCKLY_AUTOSAVE_PREFIX = 'drone-simulator:v1:blockly-workspace:';
const BLOCKLY_AUTOSAVE_DEBOUNCE_MS = 500;
let blocklyAutosaveContextKey = null;
let blocklyAutosaveLoadedKey = null;
let blocklyAutosaveTimer = null;
let blocklyAutosaveRestoring = false;
let blocklyAutosaveBeforeUnloadHooked = false;

/** 任務一／二預掃描：while 迴圈最大迭代次數（防止條件錯誤卡死瀏覽器） */
const PRESCAN_LOOP_LIMIT = 600;
/** 任務一／二預掃描：指令佇列最大長度 */
const PRESCAN_CMD_QUEUE_LIMIT = 600;
/** 挑戰迷宮即時模式：while 迴圈最大迭代次數 */
const CHALLENGE_LOOP_LIMIT = 12000;

function reportBlocklyGuardError(e) {
    const code = e && e.message;
    if (code === 'LOOP_GUARD') {
        showAppMessage({
            variant: 'error',
            title: '迴圈次數過多',
            body: '「重複 while／重複直到」的條件可能幾乎永遠成立（例如「前方距離 ≠ 0」在空曠處幾乎永遠為真）。按「執行」時程式會同步跑很多圈，導致卡住。',
            nextStep: '請改用「距離 < 120 cm」判斷前方是否有牆，或參考任務說明中的感應器範例。任務一／二不支援即時讀感應器的長迴圈；隨機迷宮挑戰模式才適合 while + 感應器。',
            focusClose: true
        });
        logToConsole(`❌ 程式錯誤：迴圈超過安全上限（${PRESCAN_LOOP_LIMIT} 次）。請檢查 while 條件是否寫錯。`);
        return true;
    }
    if (code === 'CMD_QUEUE_GUARD') {
        showAppMessage({
            variant: 'error',
            title: '指令數量過多',
            body: '程式在按「執行」時一次產生了過多飛行指令，通常是 while 迴圈條件錯誤或缺少停止條件。',
            nextStep: '請縮短迴圈或修正感應器條件（建議用「距離 < 120」判斷障礙，勿用「≠ 0」）。',
            focusClose: true
        });
        logToConsole(`❌ 程式錯誤：指令佇列超過安全上限（${PRESCAN_CMD_QUEUE_LIMIT} 條）。`);
        return true;
    }
    return false;
}

function getBlocklyAutosaveKey() {
    if (activeMissionId === 'challenge'
        || (typeof currentSceneType !== 'undefined' && currentSceneType === 'challenge_maze')) {
        return 'challenge';
    }
    if (currentGameMode === 'freeplay') return 'freeplay';
    if (activeMissionId === 'practice1') return 'practice-1';
    if (activeMissionId === 'practice2') return 'practice-2';
    if (activeMissionId === 1 || activeMissionId === 'training') return 'mission-1';
    if (activeMissionId === 2) return 'mission-2';
    if (typeof currentSceneType !== 'undefined') {
        if (currentSceneType === 'tunnel' || currentSceneType === 'tunnel_practice') {
            return currentSceneType === 'tunnel_practice' ? 'practice-1' : 'mission-1';
        }
        if (currentSceneType === 'city' || currentSceneType === 'city_practice') {
            return currentSceneType === 'city_practice' ? 'practice-2' : 'mission-2';
        }
    }
    return 'freeplay';
}

function isTunnelMissionScene() {
    return typeof currentSceneType !== 'undefined'
        && (currentSceneType === 'tunnel' || currentSceneType === 'tunnel_practice');
}

function isCityMissionScene() {
    return typeof currentSceneType !== 'undefined'
        && (currentSceneType === 'city' || currentSceneType === 'city_practice');
}

function getBlocklyAutosaveStorageKey(contextKey) {
    return BLOCKLY_AUTOSAVE_PREFIX + (contextKey || getBlocklyAutosaveKey());
}

function saveBlocklyWorkspaceToKey(ws, contextKey) {
    if (!ws || blocklyAutosaveRestoring || typeof Blockly === 'undefined') return;
    try {
        const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
        localStorage.setItem(getBlocklyAutosaveStorageKey(contextKey), xml);
    } catch (err) {
        console.warn('[blockly-autosave] 無法寫入 localStorage', err);
    }
}

function restoreBlocklyWorkspaceFromKey(ws, contextKey) {
    if (!ws || typeof Blockly === 'undefined') return;
    let raw;
    try {
        raw = localStorage.getItem(getBlocklyAutosaveStorageKey(contextKey));
    } catch (err) {
        return;
    }
    if (!raw) return;
    try {
        blocklyAutosaveRestoring = true;
        ws.clear();
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(raw), ws);
        console.log('[blockly-autosave] 已還原:', contextKey);
    } catch (err) {
        console.warn('[blockly-autosave] 還原失敗', err);
    } finally {
        blocklyAutosaveRestoring = false;
    }
}

function flushBlocklyAutosave() {
    if (blocklyAutosaveTimer !== null) {
        clearTimeout(blocklyAutosaveTimer);
        blocklyAutosaveTimer = null;
    }
    if (!workspace || !blocklyAutosaveLoadedKey) return;
    saveBlocklyWorkspaceToKey(workspace, blocklyAutosaveLoadedKey);
}

function scheduleBlocklyAutosave() {
    if (blocklyAutosaveTimer !== null) clearTimeout(blocklyAutosaveTimer);
    blocklyAutosaveTimer = setTimeout(() => {
        blocklyAutosaveTimer = null;
        flushBlocklyAutosave();
    }, BLOCKLY_AUTOSAVE_DEBOUNCE_MS);
}

function onBlocklyContextChanged() {
    const newKey = getBlocklyAutosaveKey();
    blocklyAutosaveContextKey = newKey;

    if (blocklyAutosaveTimer !== null) {
        clearTimeout(blocklyAutosaveTimer);
        blocklyAutosaveTimer = null;
    }

    if (!workspace) {
        blocklyAutosaveLoadedKey = null;
        return;
    }

    if (blocklyAutosaveLoadedKey && blocklyAutosaveLoadedKey !== newKey) {
        saveBlocklyWorkspaceToKey(workspace, blocklyAutosaveLoadedKey);
        restoreBlocklyWorkspaceFromKey(workspace, newKey);
    } else if (!blocklyAutosaveLoadedKey) {
        restoreBlocklyWorkspaceFromKey(workspace, newKey);
    }

    blocklyAutosaveLoadedKey = newKey;
}

function initBlocklyAutosave(ws) {
    if (!ws || ws._autosaveInitialized) return;
    ws._autosaveInitialized = true;

    ws.addChangeListener((event) => {
        if (blocklyAutosaveRestoring) return;
        if (event.type === Blockly.Events.FINISHED_LOADING) return;
        if (!blocklyAutosaveLoadedKey) {
            blocklyAutosaveLoadedKey = getBlocklyAutosaveKey();
        }
        scheduleBlocklyAutosave();
    });

    const key = blocklyAutosaveContextKey || getBlocklyAutosaveKey();
    blocklyAutosaveContextKey = key;
    restoreBlocklyWorkspaceFromKey(ws, key);
    blocklyAutosaveLoadedKey = key;

    if (!blocklyAutosaveBeforeUnloadHooked) {
        blocklyAutosaveBeforeUnloadHooked = true;
        window.addEventListener('beforeunload', flushBlocklyAutosave);
    }
}

// 執行控制變數
const executionSpeed = 3.0; // 固定執行速度（3×，不可由 UI 調整）
let currentGameMode = 'mission'; // 當前遊戲模式 ('mission' 或 'freeplay')
let activeMissionId = null; // 當前活動的任務 ID
let lastMissionMenu = 'competition'; // 'competition' | 'practice'
let currentExecutingBlockId = null; // 當前執行的積木 ID
let blockToCommandMap = new Map(); // 積木 ID 到命令索引的映射
let commandToBlockMap = new Map(); // 命令索引到積木 ID 的映射

/** 重新計算 3D 畫布與 Blockly 工作區尺寸（視窗 resize、瀏覽器縮放、面板切換後呼叫） */
let gameUiLayoutRefreshTimer = null;
let gameUiLayoutRefreshHooked = false;

function refreshGameUILayout() {
    const gameInterface = document.getElementById('game-interface');
    if (!gameInterface || gameInterface.style.display === 'none') return;

    gameInterface.offsetHeight;

    if (typeof onWindowResize === 'function') {
        onWindowResize();
    }
    if (workspace && typeof Blockly !== 'undefined') {
        const blocklyDiv = document.getElementById('blocklyDiv');
        if (blocklyDiv && blocklyDiv.classList.contains('visible')) {
            Blockly.svgResize(workspace);
        }
    }
}

function scheduleGameUILayoutRefresh() {
    if (gameUiLayoutRefreshTimer !== null) {
        clearTimeout(gameUiLayoutRefreshTimer);
    }
    gameUiLayoutRefreshTimer = setTimeout(() => {
        gameUiLayoutRefreshTimer = null;
        refreshGameUILayout();
    }, 100);
}

function initGameUiLayoutRefresh() {
    if (gameUiLayoutRefreshHooked) return;
    gameUiLayoutRefreshHooked = true;
    window.addEventListener('resize', scheduleGameUILayoutRefresh);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleGameUILayoutRefresh);
        window.visualViewport.addEventListener('scroll', scheduleGameUILayoutRefresh);
    }
}

// 初始化 Blockly 工作區（在積木區顯示時調用）
function initBlockly() {
    if (!workspace) {
        const blocklyDiv = document.getElementById('blocklyDiv');
        if (blocklyDiv && typeof Blockly !== 'undefined') {
            // 確保容器可見且已顯示
            const gameInterface = document.getElementById('game-interface');
            if (gameInterface && gameInterface.style.display === 'none') {
                console.warn("Blockly container is hidden, cannot initialize");
                return null;
            }
            
            // 確保積木區面板是顯示狀態
            if (!blocklyDiv.classList.contains('visible')) {
                console.warn("Blockly panel is not visible, cannot initialize");
                return null;
            }
            
            workspace = Blockly.inject('blockly-workspace', {
                toolbox: document.getElementById('toolbox'),
                scrollbars: true, 
                trashcan: true,
                grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
                theme: { 
                    'base': 'classic', 
                    'componentStyles': { 
                        'workspaceBackgroundColour': '#1e1e1e', 
                        'toolboxBackgroundColour': '#2d2d2d' 
                    } 
                }
            });
            console.log("Blockly workspace initialized");
            initBlocklyAutosave(workspace);
            
            // 初始化後立即調整大小
            setTimeout(() => {
                blocklyZoom = 1.0;
                if (workspace) workspace.setScale(blocklyZoom);
                refreshGameUILayout();
                initBlocklyResizer();
                updateGotoXyzToolboxVisibility();
            }, 100);

            initGameUiLayoutRefresh();
        }
    } else {
        // 如果已初始化，調整大小以適應容器
        if (workspace && typeof Blockly !== 'undefined') {
            const blocklyDiv = document.getElementById('blocklyDiv');
            if (blocklyDiv && blocklyDiv.classList.contains('visible')) {
                requestAnimationFrame(() => {
                    refreshGameUILayout();
                });
            }
        }
    }
    return workspace;
}

// --- 課堂／無障礙：非阻斷訊息與輕量確認（取代 alert／confirm）---
// 橫幅使用 role="status" + aria-live="polite"：新訊息會播報但不強制打斷讀屏；未用 role="alert" 以免覆蓋教師口述。
let _appMessageAutoHideTimer = null;
let _appConfirmResolve = null;
let _appConfirmPrevFocus = null;
let _appConfirmFocusTrapHandler = null;

function _getAppConfirmFocusables() {
    const modal = document.getElementById('app-confirm-modal');
    if (!modal) return [];
    return Array.from(
        modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.hidden && el.offsetParent !== null);
}

function _installAppConfirmFocusTrap() {
    _removeAppConfirmFocusTrap();
    _appConfirmFocusTrapHandler = function (e) {
        if (e.key !== 'Tab') return;
        const modal = document.getElementById('app-confirm-modal');
        if (!modal || modal.hasAttribute('hidden')) return;
        const focusables = _getAppConfirmFocusables();
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };
    document.addEventListener('keydown', _appConfirmFocusTrapHandler, true);
}

function _removeAppConfirmFocusTrap() {
    if (_appConfirmFocusTrapHandler) {
        document.removeEventListener('keydown', _appConfirmFocusTrapHandler, true);
        _appConfirmFocusTrapHandler = null;
    }
}

function hideAppMessage() {
    const el = document.getElementById('app-message-banner');
    if (el) {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
    }
    if (_appMessageAutoHideTimer) {
        clearTimeout(_appMessageAutoHideTimer);
        _appMessageAutoHideTimer = null;
    }
}

function showAppMessage(opts) {
    const el = document.getElementById('app-message-banner');
    if (!el) {
        console.warn('app-message-banner missing');
        return;
    }
    const titleEl = document.getElementById('app-message-title');
    const bodyEl = document.getElementById('app-message-body');
    const nextEl = document.getElementById('app-message-next');
    const variant = opts.variant === 'warn' || opts.variant === 'error' ? opts.variant : 'info';
    el.classList.remove('app-message--info', 'app-message--warn', 'app-message--error');
    el.classList.add('app-message--' + variant);
    if (titleEl) titleEl.textContent = opts.title || '';
    if (bodyEl) bodyEl.textContent = opts.body || '';
    if (nextEl) {
        if (opts.nextStep) {
            nextEl.hidden = false;
            nextEl.textContent = opts.nextStep;
        } else {
            nextEl.hidden = true;
            nextEl.textContent = '';
        }
    }
    el.hidden = false;
    el.removeAttribute('aria-hidden');
    if (_appMessageAutoHideTimer) {
        clearTimeout(_appMessageAutoHideTimer);
        _appMessageAutoHideTimer = null;
    }
    if (opts.autoHideMs && opts.autoHideMs > 0) {
        _appMessageAutoHideTimer = setTimeout(hideAppMessage, opts.autoHideMs);
    }
    const shouldFocusClose = opts.focusClose === true || ((opts.focusClose !== false) && (variant === 'warn' || variant === 'error'));
    if (shouldFocusClose) {
        requestAnimationFrame(() => {
            const btn = document.getElementById('app-message-close');
            if (btn && typeof btn.focus === 'function') {
                try { btn.focus(); } catch (_) { /* ignore */ }
            }
        });
    }
}

function finishAppConfirm(result) {
    if (!_appConfirmResolve) return;
    _removeAppConfirmFocusTrap();
    const modal = document.getElementById('app-confirm-modal');
    if (modal) {
        modal.setAttribute('hidden', '');
        modal.setAttribute('aria-hidden', 'true');
    }
    const resolveFn = _appConfirmResolve;
    _appConfirmResolve = null;
    resolveFn(!!result);
    const prev = _appConfirmPrevFocus;
    _appConfirmPrevFocus = null;
    requestAnimationFrame(() => {
        if (prev && typeof prev.focus === 'function') {
            try { prev.focus(); } catch (_) { /* ignore */ }
        }
    });
}

function showAppConfirm(message, options) {
    options = options || {};
    return new Promise((resolve) => {
        const modal = document.getElementById('app-confirm-modal');
        const textEl = document.getElementById('app-confirm-text');
        const titleEl = document.getElementById('app-confirm-title');
        const okBtn = document.getElementById('app-confirm-ok');
        const cancelBtn = document.getElementById('app-confirm-cancel');
        if (!modal || !textEl || !titleEl || !okBtn || !cancelBtn) {
            resolve(false);
            return;
        }
        if (_appConfirmResolve) {
            finishAppConfirm(false);
        }
        titleEl.textContent = options.title || '請確認';
        textEl.textContent = message;
        okBtn.textContent = options.confirmLabel || '確認';
        cancelBtn.textContent = options.cancelLabel || '取消';
        _appConfirmPrevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        _appConfirmResolve = resolve;
        modal.removeAttribute('hidden');
        modal.removeAttribute('aria-hidden');
        _installAppConfirmFocusTrap();
        requestAnimationFrame(() => {
            try { okBtn.focus(); } catch (_) { /* ignore */ }
        });
    });
}

function initAppFeedbackUI() {
    const closeMsg = document.getElementById('app-message-close');
    if (closeMsg && !closeMsg.dataset.appFeedbackBound) {
        closeMsg.dataset.appFeedbackBound = '1';
        closeMsg.addEventListener('click', hideAppMessage);
    }
    const ok = document.getElementById('app-confirm-ok');
    const cancel = document.getElementById('app-confirm-cancel');
    if (ok && !ok.dataset.appFeedbackBound) {
        ok.dataset.appFeedbackBound = '1';
        ok.addEventListener('click', () => finishAppConfirm(true));
    }
    if (cancel && !cancel.dataset.appFeedbackBound) {
        cancel.dataset.appFeedbackBound = '1';
        cancel.addEventListener('click', () => finishAppConfirm(false));
    }
}

window.showAppMessage = showAppMessage;
window.hideAppMessage = hideAppMessage;
window.showAppConfirm = showAppConfirm;

function isCompetitionUnlocked() {
    return true;
}

window.isCompetitionUnlocked = isCompetitionUnlocked;
window.showPracticeSelect = showPracticeSelect;

// --- Console 介面功能 ---
function logToConsole(msg) {
    const contentDiv = document.getElementById('console-content');
    if (!contentDiv) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second:"2-digit" });
    
    let displayMsg = msg;
    if (typeof msg === 'object') {
        displayMsg = JSON.stringify(msg);
    }

    entry.innerHTML = `<span class="log-time">[${time}]</span> ${displayMsg}`;
    contentDiv.appendChild(entry);
    
    contentDiv.scrollTop = contentDiv.scrollHeight;
}
function clearConsole() {
    const contentDiv = document.getElementById('console-content');
    if (contentDiv) contentDiv.innerHTML = '';
}
// --- 切換按鈕功能 ---
function toggleCameraMode() {
    followDrone = !followDrone; // 變數來自 simulator.js
    if (followDrone) { // 切換回跟隨時，立即跳轉
        camTarget.x = state.x; camTarget.y = state.y; camTarget.z = state.z;
    }
    const btn = document.getElementById('camera-mode-btn');
    if(btn) {
        btn.innerText = followDrone ? "🎥 視角: 跟隨中" : "🎥 視角: 自由移動";
    }
}

// --- 程式碼執行邏輯 ---

function runBlocklyCode() {
    console.log("runBlocklyCode 被調用，state.isRunning:", state.isRunning);
    
    if (state.isRunning) {
        console.log("執行中，無法再次運行");
        return; 
    }
    
    // 確保停止信號已清除
    state.stopSignal = false;
    
    console.log("準備執行，state.stopSignal:", state.stopSignal);
    
    // 確保 workspace 已初始化
    const currentWorkspace = initBlockly();
    if (!currentWorkspace) {
        showAppMessage({
            variant: 'warn',
            title: 'Blockly 尚未就緒',
            body: '積木區尚未開啟或未完成初始化，無法執行程式。',
            nextStep: '下一步：請先按頂部「顯示積木區」開啟 Blockly，再按「執行」。'
        });
        return;
    }
    
    cmdQueue = [];
    blockToCommandMap.clear();
    commandToBlockMap.clear();
    
    // 用於在代碼執行時追蹤當前積木塊 ID
    let currentBlockIdForCodeGen = null;
    const blockIdQueue = []; // 記錄每個命令對應的積木塊 ID
    
    // --- 開始代碼分析與執行 ---
    try {
        // 🔥 隨機迷宮挑戰模式：跳過預掃描，直接進入即時執行引擎
        if (currentSceneType === 'challenge_maze') {
            console.log("🎲 偵測到挑戰模式，準備生成代碼...");
            
            if (typeof stopMazeCycling === 'function') stopMazeCycling();
            if (typeof createChallengeMaze === 'function') createChallengeMaze();
            
            state.isRunning = true;

            Blockly.JavaScript.INFINITE_LOOP_TRAP =
                'if (state.stopSignal) throw new Error("STOP");\n' +
                `if (++__challengeLoopCount > ${CHALLENGE_LOOP_LIMIT}) throw new Error("LOOP_GUARD");\n` +
                'await wait(30);\n';
            const rawCode = 'var __challengeLoopCount = 0;\n' + Blockly.JavaScript.workspaceToCode(currentWorkspace);
            Blockly.JavaScript.INFINITE_LOOP_TRAP = null;
            
            // 轉換為即時執行格式
            const finalCode = rawCode.replace(/cmdQueue\.push\(/g, 'await executeCommandLive(');
            
            console.log("📜 [挑戰模式] 最終執行代碼內容:\n", finalCode);
            
            runBlocklyCodeChallenge(finalCode);
            return;
        }

        // --- 普通模式的預掃描邏輯 ---
        // 使用 Trap 防止 eval() 內的死循環（超過上限時拋錯並提示，而非卡死瀏覽器）
        Blockly.JavaScript.INFINITE_LOOP_TRAP =
            'if (state.stopSignal) throw "STOP";\n' +
            `if (++__prescanLoopCount > ${PRESCAN_LOOP_LIMIT}) throw new Error("LOOP_GUARD");\n`;
        const code = 'var __prescanLoopCount = 0;\n' + Blockly.JavaScript.workspaceToCode(currentWorkspace);
        Blockly.JavaScript.INFINITE_LOOP_TRAP = null;

        const originalPush = Array.prototype.push;
        
        // 臨時替換 push 方法來捕獲積木塊 ID
        cmdQueue.push = function(...items) {
            items.forEach(item => {
                if (item && typeof item === 'object') {
                    if (currentBlockIdForCodeGen) {
                        blockIdQueue.push(currentBlockIdForCodeGen);
                        item._blockId = currentBlockIdForCodeGen;
                    } else {
                        blockIdQueue.push(null);
                    }
                }
            });
            const result = originalPush.apply(this, items);
            if (this.length > PRESCAN_CMD_QUEUE_LIMIT) {
                throw new Error('CMD_QUEUE_GUARD');
            }
            return result;
        };
        
        // 遍歷積木塊並在生成代碼時設置當前積木塊 ID
        function setCurrentBlockForCodeGen(block) {
            if (!block) return;
            const blockType = block.type;
            const commandGeneratingBlocks = [
                'event_wait_key', 'drone_takeoff', 'drone_land', 'drone_hover',
                'drone_move_time', 'drone_move_cm', 'drone_goto_xyz', 'drone_turn_degree',
                'drone_collect_water', 'drone_release_water',
                'drone_turn_time', 'drone_set_variable', 'drone_turn_heading', 'drone_move_complex',
                'drone_move_complex_infinite', 'drone_set_color', 'drone_set_led_color', 
                'drone_set_led_rgb', 'drone_led_off', 'drone_led_sequence', 'drone_set_heading',
                'console_print'
            ];
            const prevBlockId = currentBlockIdForCodeGen;
            if (commandGeneratingBlocks.includes(blockType)) {
                currentBlockIdForCodeGen = block.id;
            }
            if (block.inputList) {
                block.inputList.forEach(input => {
                    if (input.connection && input.connection.targetBlock()) {
                        setCurrentBlockForCodeGen(input.connection.targetBlock());
                    }
                });
            }
            if (block.nextConnection && block.nextConnection.targetBlock()) {
                setCurrentBlockForCodeGen(block.nextConnection.targetBlock());
            }
            currentBlockIdForCodeGen = prevBlockId;
        }
        
        // 遍歷所有頂層積木塊設置 ID
        currentWorkspace.getTopBlocks(true).forEach(block => {
            setCurrentBlockForCodeGen(block);
        });
        
        try {
            // 執行同步代碼以填充 cmdQueue
            eval(code);
        } finally {
            cmdQueue.push = originalPush;
        }
        
        // 建立命令索引到積木塊 ID 的映射
        // 如果命令有 _blockId 屬性，使用它；否則使用 blockIdQueue
        cmdQueue.forEach((cmd, index) => {
            if (cmd && typeof cmd === 'object') {
                if (cmd._blockId) {
                    commandToBlockMap.set(index, cmd._blockId);
                    delete cmd._blockId; // 清理臨時屬性
                } else if (blockIdQueue[index]) {
                    commandToBlockMap.set(index, blockIdQueue[index]);
                }
            }
        });
        
    } catch (e) {
        cmdQueue.length = 0;
        blockIdQueue.length = 0;
        commandToBlockMap.clear();
        if (e === 'STOP') {
            return;
        }
        if (reportBlocklyGuardError(e)) {
            console.warn('Prescan guard triggered:', e);
            return;
        }
        showAppMessage({
            variant: 'error',
            title: '程式產生錯誤',
            body: String(e),
            nextStep: '請檢查積木連接是否完整，或從主控台查看詳細訊息。',
            focusClose: true
        });
        console.error("Code generation error:", e);
        return;
    }
    
    if (cmdQueue.length === 0) { 
        showAppMessage({
            variant: 'warn',
            title: '沒有可執行的指令',
            body: '工作區內沒有產生任何飛行指令。',
            nextStep: '下一步：請從左側拖入積木（例如「程式開始」與「起飛」），並連接後再執行。',
            focusClose: false
        });
        return; 
    }
    
    console.log(`命令隊列長度: ${cmdQueue.length}, 映射關係: ${commandToBlockMap.size}`);
    console.log("準備調用 executeQueue，state.isRunning:", state.isRunning);
    
    executeQueue();
    
    console.log("executeQueue 調用完成（異步函數已啟動）");
}

/**
 * 🔥 [挑戰模式專用] 即時執行積木代碼
 */
async function runBlocklyCodeChallenge(finalCode) {
    console.log("🚀 啟動挑戰模式即時執行引擎...");
    logToConsole("🚀 啟動自動導航引擎...");
    
    // 1. 使用 Async Function 執行
    try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const executeLogic = new AsyncFunction(
            'executeCommandLive', 
            'wait', 
            'state', 
            'getSensorReading', 
            'logToConsole', 
            'THREE',
            'console',
            finalCode
        );
        
        await executeLogic(
            executeCommandLive, 
            wait, 
            state, 
            getSensorReading, 
            logToConsole,
            THREE,
            console
        );
        
        if (!state.stopSignal) {
            logToConsole("🏁 程式執行完畢。");
        }
    } catch (e) {
        if (e && (e.message === 'STOP' || e.message === '程式已停止')) {
            logToConsole("⏹️ 程式已停止。");
        } else if (reportBlocklyGuardError(e)) {
            /* 已顯示迴圈安全提示 */
        } else {
            console.error("挑戰模式執行出錯:", e);
            logToConsole("❌ 執行出錯: " + (e ? e.message : "Unknown error"));
        }
    } finally {
        console.log("🏁 [Challenge Mode] 引擎執行結束，重設 isRunning 為 false");
        state.isRunning = false;
    }
}

/**
 * 單條指令的即時執行器
 */
async function executeCommandLive(cmd) {
    if (state.stopSignal) throw new Error('STOP');
    
    console.log("⚡ [LIVE] 執行指令:", cmd.type, cmd);
    
    // 記錄指令開始時間
    const cmdStartTime = Date.now();
    
    // 高亮積木
    if (cmd && cmd._blockId) {
        highlightBlock(cmd._blockId, true);
    }
    
    // 執行指令邏輯
    try {
        await dispatchCommand(cmd);
        
        // 🔥 重要修正：如果指令因為碰撞而中止，強制等待一段時間，防止 while 迴圈過快重試
        if (state.collisionDetected) {
            console.log("⚠️ 偵測到碰撞，指令中斷，冷卻 500ms...");
            await wait(500); // 增加延遲讓物理引擎穩定
        }
    } catch (e) {
        console.error("❌ 指令執行失敗:", e);
    }
    
    // 額外保護：如果指令執行時間少於 100ms（代表它可能被立刻中止了），強制等待
    const duration = Date.now() - cmdStartTime;
    if (duration < 100) {
    await wait(100);
    }
    
    if (cmd && cmd._blockId) {
        highlightBlock(cmd._blockId, false);
    }
}

/**
 * 核心指令派發器 (供 executeQueue 與 executeCommandLive 共享)
 * 統一使用「增量更新 (Incremental)」邏輯，防止與物理碰撞引擎產生位置衝突（瞬移/抖動）
 */
async function dispatchCommand(cmd) {
    if (!cmd) return;
    if (isCityMissionScene() && getCityBatteryRemainingLines() <= 0
        && cmd.type && cmd.type.startsWith('move_')) {
        logToConsole('⚠️ 電力耗盡！請找黃色充電站懸停補電（+15 行），或返回基地。');
        if (typeof emergencyStop === 'function') emergencyStop();
        return;
    }
    const param = parseFloat(cmd.param);
    
    // 飛行狀態檢查 (起飛、LED、等按鍵除外)
    if (!state.isFlying && cmd.type !== 'takeoff' && cmd.type !== 'set_color' && !cmd.type.startsWith('led_') && cmd.type !== 'wait_key') { 
        await wait(200); return; 
    }

    // 高亮積木塊
    if (cmd._blockId) {
        if (currentExecutingBlockId) highlightBlock(currentExecutingBlockId, false);
        currentExecutingBlockId = cmd._blockId;
        highlightBlock(currentExecutingBlockId, true);
    }

    switch (cmd.type) {
        case 'collect_water':
            await dispatchCollectWater();
            break;
        case 'release_water':
            await dispatchReleaseWater();
            break;
        case 'wait_key': await waitKey(); break;
        case 'takeoff': 
            console.log("🚀 [Takeoff] 開始起飛動作...");
            state.collisionDetected = false; 
            const takeoffHeight = 80; // 統一高度
            let lastY_p = 0;
            await animateAction(1.5, p => {
                const dp = p - lastY_p;
                state.y += (takeoffHeight * dp);
                lastY_p = p;
                if (Math.abs(p - 0.5) < 0.05 || p > 0.95) {
                    console.log(`   [Takeoff] 進度: ${(p*100).toFixed(0)}%, y: ${state.y.toFixed(1)}`);
                }
            }, { canAbort: false }); 
            state.isFlying = true; 
            hasTakenOff = true; 
            console.log("🚀 [Takeoff] 起飛完成！");
            break;
        case 'land': 
            const groundY = getGroundHeight(state.x, state.z);
            const distToLand = state.y - groundY;
            let lastLand_p = 0;
            await animateAction(1.5, p => {
                const dp = p - lastLand_p;
                state.y -= (distToLand * dp);
                lastLand_p = p;
            }, { canAbort: false }); 
            state.isFlying = false; 
            break;
        case 'hover':
            await wait(param * 1000);
            if (isCityMissionScene() && typeof creditForestChargeHover === 'function') {
                creditForestChargeHover(param);
            } else if (isTunnelMissionScene() && typeof creditTunnelInspectionHover === 'function') {
                creditTunnelInspectionHover(param);
            }
            break;
        case 'goto_xyz':
            if (isTunnelMissionScene()) {
                logToConsole('⚠️ 任務一禁止使用「飛至座標 (Goto XYZ)」；請沿可通行路網飛行。');
                await wait(100);
                break;
            }
            const startPos = { x: state.x, y: state.y, z: state.z };
            let lastGoto_p = 0;
            await animateAction(2.0, p => {
                const dp = p - lastGoto_p;
                state.x += (cmd.x - startPos.x) * dp;
                state.y += (cmd.y - startPos.y) * dp;
                state.z += (cmd.z - startPos.z) * dp;
                lastGoto_p = p;
            });
            break;
        case 'set_heading':
            const startH = state.heading;
            let lastH_p = 0;
            await animateAction(1.0, p => {
                const dp = p - lastH_p;
                state.heading += (cmd.val - startH) * dp;
                lastH_p = p;
            }, { canAbort: false });
            break;
        case 'set_color':
        case 'led_hex_bright':
            if(droneLedMesh) {
                let c = new THREE.Color(cmd.color || cmd.param);
                droneLedMesh.material.color.set(c);
                droneLedMesh.material.opacity = (cmd.brightness !== undefined) ? Math.max(0.1, cmd.brightness / 255) : 1.0;
            }
            if(droneLedLight) {
                droneLedLight.color.set(cmd.color || cmd.param);
                droneLedLight.intensity = (cmd.brightness !== undefined) ? (cmd.brightness / 255) * 2.0 : 2.0;
            }
            await wait(100);
            break;
        case 'led_rgb':
            if(droneLedMesh) {
                let c = new THREE.Color(`rgb(${Math.round(cmd.r)}, ${Math.round(cmd.g)}, ${Math.round(cmd.b)})`);
                droneLedMesh.material.color.set(c);
                droneLedMesh.material.opacity = Math.max(0.1, cmd.brightness / 255);
                if(droneLedLight) {
                    droneLedLight.color.set(c);
                    droneLedLight.intensity = (cmd.brightness / 255) * 2.0;
                }
            }
            await wait(100);
            break;
        case 'led_off':
            if(droneLedMesh) {
                droneLedMesh.material.color.setHex(0xffffff);
                droneLedMesh.material.opacity = 0.1;
            }
            if(droneLedLight) droneLedLight.intensity = 0;
            await wait(100);
            break;
        case 'led_seq':
            if(droneLedMesh) {
                let c = new THREE.Color(`rgb(${Math.round(cmd.r)}, ${Math.round(cmd.g)}, ${Math.round(cmd.b)})`);
                droneLedMesh.material.color.set(c);
                if(droneLedLight) {
                    droneLedLight.color.set(c);
                    droneLedLight.intensity = 2.0; 
                }
            }
            if (cmd.seq === 'DIMMING') {
                await animateAction(1.5, p => {
                    if(droneLedLight) droneLedLight.intensity = 2.0 * Math.abs(Math.sin(p * Math.PI));
                });
            } else {
                await wait(1000); 
            }
            break;
        case 'set_var':
            if(cmd.var === 'ROLL') flightState.roll = cmd.val;
            if(cmd.var === 'PITCH') flightState.pitch = cmd.val;
            if(cmd.var === 'YAW') flightState.yaw = cmd.val;
            if(cmd.var === 'THROTTLE') flightState.throttle = cmd.val;
            break;
        case 'move_complex':
            const complexRad = THREE.MathUtils.degToRad(state.heading);
            const speed = 50; 
            const r = flightState.roll / 100;
            const p_val = flightState.pitch / 100;
            const t = flightState.throttle / 100;
            const cdx = (r * Math.cos(complexRad) - (-p_val) * Math.sin(complexRad)) * speed * param;
            const cdz = (r * Math.sin(complexRad) + (-p_val) * Math.cos(complexRad)) * speed * param;
            const cdy = t * speed * param;
            let lastComplex_p = 0;
            await animateAction(param, prog => {
                const dp = prog - lastComplex_p;
                state.x += cdx * dp;
                state.z += cdz * dp;
                state.y = Math.max(0, state.y + cdy * dp);
                lastComplex_p = prog;
            });
            break;
        case 'turn_time':
            const turnSpd = (cmd.power/100) * 90; 
            const dirMultT = (cmd.dir === 'LEFT') ? 1 : -1;
            let lastTurnT_p = 0;
            await animateAction(param, p => {
                const dp = p - lastTurnT_p;
                state.heading += (turnSpd * param * dirMultT * dp);
                lastTurnT_p = p;
            }, { canAbort: false });
            break;
        case 'print':
            let msgText = cmd.text || "Output";
            if (typeof cmd.fn === 'function') {
                try { msgText = cmd.fn(); } catch(e) { msgText = "Error: " + e.message; }
            }
            logToConsole(msgText);
            console.log("%c[Drone Output] " + msgText, "color: #00adb5");
            await wait(200);
            break;
        default:
            if (cmd.type && cmd.type.startsWith('move_')) {
                const rad = THREE.MathUtils.degToRad(state.heading); 
                let dx = 0, dz = 0; let dy = 0;
                if (cmd.type === 'move_forward') { dx = -Math.sin(rad); dz = -Math.cos(rad); }
                else if (cmd.type === 'move_backward') { dx = Math.sin(rad); dz = Math.cos(rad); }
                else if (cmd.type === 'move_left') { dx = -Math.cos(rad); dz = Math.sin(rad); }
                else if (cmd.type === 'move_right') { dx = Math.cos(rad); dz = -Math.sin(rad); }
                else if (cmd.type === 'move_up') { dy = 1; }
                else if (cmd.type === 'move_down') { dy = -1; }
                
                const totalDist = 50 * (param || 1);
                let lastP = 0;
                await animateAction(param || 1, (p) => { 
                    const dp = p - lastP;
                    state.x += dx * totalDist * dp; 
                    state.z += dz * totalDist * dp;
                    state.y = Math.max(0, state.y + (dy * totalDist * dp));
                    lastP = p;
                });
                // 如果發生碰撞，確保當前狀態座標同步回安全位置，避免下一積木瞬移
                if (state.collisionDetected) {
                    state.x = lastSafePos.x;
                    state.z = lastSafePos.z;
                }
            } else if (cmd.type && cmd.type.startsWith('turn_')) {
                const deg = (cmd.param || 90) * (cmd.type==='turn_left'?1:-1);
                let lastP = 0;
                await animateAction(1.0, p => {
                    const dp = p - lastP;
                    state.heading += deg * dp;
                    lastP = p;
                }, { canAbort: false });
            }
            break;
    }
    if (isCityMissionScene()) consumeCityBatteryLine(cmd);
    // 每個指令結束後的小停頓，讓視覺更平滑
    await wait(200);
}

// 建立積木塊與命令的映射關係
// 注意：這個映射是基於積木塊的執行順序，而不是代碼生成順序
function buildBlockCommandMapping(workspace) {
    blockToCommandMap.clear();
    commandToBlockMap.clear();
    
    // 獲取所有頂層積木塊（按執行順序）
    const topBlocks = workspace.getTopBlocks(true);
    let commandIndex = 0;
    
    function traverseBlocks(block) {
        if (!block) return;
        
        // 只記錄會生成命令的積木塊類型
        const blockType = block.type;
        const commandGeneratingBlocks = [
            'event_wait_key', 'drone_takeoff', 'drone_land', 'drone_hover',
            'drone_move_time', 'drone_move_cm', 'drone_goto_xyz', 'drone_turn_degree',
            'drone_collect_water', 'drone_release_water',
            'drone_turn_time', 'drone_set_variable', 'drone_turn_heading', 'drone_move_complex',
            'drone_move_complex_infinite', 'drone_set_color', 'drone_set_led_color', 
            'drone_set_led_rgb', 'drone_led_off', 'drone_led_sequence', 'drone_set_heading',
            'console_print'
        ];
        
        if (commandGeneratingBlocks.includes(blockType)) {
            // 記錄這個積木塊對應的命令索引
            const blockId = block.id;
            blockToCommandMap.set(blockId, commandIndex);
            commandToBlockMap.set(commandIndex, blockId);
            commandIndex++;
        }
        
        // 遍歷所有輸入連接的積木塊（使用正確的 Blockly API）
        const inputs = block.inputList;
        if (inputs) {
            inputs.forEach(input => {
                if (input.connection && input.connection.targetBlock()) {
                    const childBlock = input.connection.targetBlock();
                    traverseBlocks(childBlock);
                }
            });
        }
        
        // 遍歷下一個積木塊（同一層級的下一個，通過輸出連接）
        if (block.nextConnection && block.nextConnection.targetBlock()) {
            const nextBlock = block.nextConnection.targetBlock();
            traverseBlocks(nextBlock);
        }
    }
    
    // 遍歷所有頂層積木塊
    topBlocks.forEach(block => {
        traverseBlocks(block);
    });
    
    console.log(`建立映射關係: ${commandIndex} 個積木塊`);
}


// 載入任務一參考答案
function loadMazeAnswer() {
    if (!SHOW_MISSION_REFERENCE_ANSWERS) return;
    if (!workspace) {
        toggleBlocklyPanel();
        setTimeout(loadMazeAnswer, 300);
        return;
    }

    // 🔥 隨機迷宮挑戰模式答案
    if (currentSceneType === 'challenge_maze') {
        showAppConfirm(
            '載入高小組參考答案？（感應器優先級 · 右手法則）',
            { title: '挑戰難度', confirmLabel: '高小組', cancelLabel: '改選中學組' }
        ).then((isPrimary) => {
            if (isPrimary) {
                workspace.clear();
                const xmlText = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_start" x="20" y="20"><next><block type="drone_takeoff"><next><block type="controls_whileUntil"><field name="MODE">WHILE</field><value name="BOOL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value><statement name="DO"><block type="controls_if"><mutation elseif="1" else="1"></mutation><value name="IF0"><block type="logic_compare"><field name="OP">GT</field><value name="A"><block type="drone_get_range"><field name="TYPE">right</field><field name="UNIT">cm</field></block></value><value name="B"><block type="math_number"><field name="NUM">120</field></block></value></block></value><statement name="DO0"><block type="drone_turn_degree"><field name="DIR">RIGHT</field><value name="DEGREE"><block type="math_number"><field name="NUM">90</field></block></value><next><block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><block type="math_number"><field name="NUM">150</field></block></value></block></next></block></statement><value name="IF1"><block type="logic_compare"><field name="OP">GT</field><value name="A"><block type="drone_get_range"><field name="TYPE">front</field><field name="UNIT">cm</field></block></value><value name="B"><block type="math_number"><field name="NUM">100</field></block></value></block></value><statement name="DO1"><block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><block type="math_number"><field name="NUM">150</field></block></value></block></statement><statement name="ELSE"><block type="drone_turn_degree"><field name="DIR">LEFT</field><value name="DEGREE"><block type="math_number"><field name="NUM">90</field></block></value></block></statement></block></statement></block></next></block></next></block></xml>`;
                Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xmlText), workspace);
                logToConsole("✅ 已載入 [高小組] 參考答案");
                return;
            }
            showAppConfirm(
                '載入中學組參考答案？（單線 LiDAR · 記憶回溯）',
                { title: '挑戰難度', confirmLabel: '中學組', cancelLabel: '取消' }
            ).then((ok) => {
                if (!ok) return;
                workspace.clear();
                const xmlText = `<xml xmlns="https://developers.google.com/blockly/xml">
  <variables>
    <variable id="v1">path_history</variable>
  </variables>
  <block type="event_start" x="20" y="20">
    <next>
      <block type="variables_set">
        <field name="VAR" id="v1">path_history</field>
        <value name="VALUE">
          <block type="lists_create_empty"></block>
        </value>
        <next>
          <block type="drone_takeoff">
            <next>
              <block type="controls_whileUntil">
                <field name="MODE">WHILE</field>
                <value name="BOOL">
                  <block type="logic_boolean">
                    <field name="BOOL">TRUE</field>
                  </block>
                </value>
                <statement name="DO">
                  <block type="controls_if">
                    <mutation elseif="2" else="1"></mutation>
                    <value name="IF0">
                      <block type="logic_compare">
                        <field name="OP">GT</field>
                        <value name="A">
                          <block type="drone_get_range">
                            <field name="TYPE">right</field>
                            <field name="UNIT">cm</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number">
                            <field name="NUM">120</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO0">
                      <block type="drone_turn_degree">
                        <field name="DIR">RIGHT</field>
                        <value name="DEGREE">
                          <block type="math_number">
                            <field name="NUM">90</field>
                          </block>
                        </value>
                        <next>
                          <block type="drone_move_cm">
                            <field name="DIR">FORWARD</field>
                            <value name="DIST">
                              <block type="math_number">
                                <field name="NUM">150</field>
                              </block>
                            </value>
                            <next>
                              <block type="lists_setIndex">
                                <mutation at="false"></mutation>
                                <field name="MODE">INSERT</field>
                                <field name="WHERE">LAST</field>
                                <value name="LIST">
                                  <block type="variables_get">
                                    <field name="VAR" id="v1">path_history</field>
                                  </block>
                                </value>
                                <value name="TO">
                                  <block type="text">
                                    <field name="TEXT">TURN_RIGHT</field>
                                  </block>
                                </value>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </statement>
                    <value name="IF1">
                      <block type="logic_compare">
                        <field name="OP">GT</field>
                        <value name="A">
                          <block type="drone_get_range">
                            <field name="TYPE">front</field>
                            <field name="UNIT">cm</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number">
                            <field name="NUM">120</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO1">
                      <block type="drone_move_cm">
                        <field name="DIR">FORWARD</field>
                        <value name="DIST">
                          <block type="math_number">
                            <field name="NUM">150</field>
                          </block>
                        </value>
                        <next>
                          <block type="lists_setIndex">
                            <mutation at="false"></mutation>
                            <field name="MODE">INSERT</field>
                            <field name="WHERE">LAST</field>
                            <value name="LIST">
                              <block type="variables_get">
                                <field name="VAR" id="v1">path_history</field>
                              </block>
                            </value>
                            <value name="TO">
                              <block type="text">
                                <field name="TEXT">FORWARD</field>
                              </block>
                            </value>
                          </block>
                        </next>
                      </block>
                    </statement>
                    <value name="IF2">
                      <block type="logic_compare">
                        <field name="OP">GT</field>
                        <value name="A">
                          <block type="drone_get_range">
                            <field name="TYPE">left</field>
                            <field name="UNIT">cm</field>
                          </block>
                        </value>
                        <value name="B">
                          <block type="math_number">
                            <field name="NUM">120</field>
                          </block>
                        </value>
                      </block>
                    </value>
                    <statement name="DO2">
                      <block type="drone_turn_degree">
                        <field name="DIR">LEFT</field>
                        <value name="DEGREE">
                          <block type="math_number">
                            <field name="NUM">90</field>
                          </block>
                        </value>
                        <next>
                          <block type="drone_move_cm">
                            <field name="DIR">FORWARD</field>
                            <value name="DIST">
                              <block type="math_number">
                                <field name="NUM">150</field>
                              </block>
                            </value>
                            <next>
                              <block type="lists_setIndex">
                                <mutation at="false"></mutation>
                                <field name="MODE">INSERT</field>
                                <field name="WHERE">LAST</field>
                                <value name="LIST">
                                  <block type="variables_get">
                                    <field name="VAR" id="v1">path_history</field>
                                  </block>
                                </value>
                                <value name="TO">
                                  <block type="text">
                                    <field name="TEXT">TURN_LEFT</field>
                                  </block>
                                </value>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </statement>
                    <statement name="ELSE">
                      <block type="drone_turn_degree">
                        <field name="DIR">LEFT</field>
                        <value name="DEGREE">
                          <block type="math_number">
                            <field name="NUM">180</field>
                          </block>
                        </value>
                        <next>
                          <block type="drone_print">
                            <value name="TEXT">
                              <block type="text">
                                <field name="TEXT">💀 死胡同！執行回溯...</field>
                              </block>
                            </value>
                          </block>
                        </next>
                      </block>
                    </statement>
                  </block>
                </statement>
              </block>
            </next>
          </block>
        </next>
      </block>
    </next>
  </block>
</xml>`;
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xmlText), workspace);
            logToConsole("✅ 已載入 [中學組] 智慧導航參考答案");
            });
        });
        return;
    }

    // 🔥 任務二：14×14 最優路線（4 火 · 配對水源 · 1 充電 · 終點降落）
    if (isCityMissionScene()) {
        showAppConfirm('這將會清除當前積木並載入「任務二：山火智能應對」最優路線參考答案，確定嗎？', { title: '載入參考答案' }).then((ok) => {
            if (!ok) return;
            workspace.clear();
            const answerXml = typeof MISSION2_ANSWER_XML !== 'undefined'
                ? MISSION2_ANSWER_XML
                : null;
            if (!answerXml) {
                logToConsole('⚠️ 找不到任務二參考答案（mission2_answer.js）。');
                return;
            }
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(answerXml), workspace);
            logToConsole('✅ 已載入任務二 [最優路線] 參考答案：4 火 → 受災區降落。');
        });
        return;
    }

    showAppConfirm('這將會清除當前積木並載入「任務一：坍塌廢墟搜救」參考答案（含三處巡檢點與 Bravo 降落），確定嗎？', { title: '載入參考答案' }).then((ok) => {
        if (!ok) return;
        if (currentSceneType !== 'tunnel') {
            logToConsole('⚠️ 參考答案僅適用於任務一（坍塌廢墟搜救）。');
            return;
        }
        workspace.clear();
        
        // 使用相對移動積木 (move_cm)，避開建築並完成巡檢回報點
        const answerXml = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_start" x="20" y="20">
    <next>
      <block type="drone_takeoff">
        <next>
          <!-- 1. 前往通訊中繼站 (1,6) -->
          <!-- 1. 前往通訊中繼站 (1,6) -->
          <block type="drone_move_cm">
            <field name="DIR">LEFT</field>
            <value name="DIST"><block type="math_number"><field name="NUM">300</field></block></value>
            <next>
              <block type="drone_move_cm">
                <field name="DIR">FORWARD</field>
                <value name="DIST"><block type="math_number"><field name="NUM">300</field></block></value>
                <next>
                  <block type="drone_move_cm">
                    <field name="DIR">LEFT</field>
            <value name="DIST"><block type="math_number"><field name="NUM">300</field></block></value>
            <next>
              <block type="drone_move_cm">
                <field name="DIR">BACKWARD</field>
                <value name="DIST"><block type="math_number"><field name="NUM">300</field></block></value>
                <next>
                          <block type="drone_move_cm">
                            <field name="DIR">LEFT</field>
                            <value name="DIST"><block type="math_number"><field name="NUM">750</field></block></value>
                            <next>
                              <block type="drone_hover">
                                <value name="DURATION"><block type="math_number"><field name="NUM">3.5</field></block></value>
                                <next>
                                  <!-- 2. 前往結構安全掃描點 (5,10) -->
                  <block type="drone_move_cm">
                    <field name="DIR">RIGHT</field>
                                    <value name="DIST"><block type="math_number"><field name="NUM">750</field></block></value>
                    <next>
                      <block type="drone_move_cm">
                        <field name="DIR">FORWARD</field>
                        <value name="DIST"><block type="math_number"><field name="NUM">300</field></block></value>
                        <next>
                          <block type="drone_move_cm">
                            <field name="DIR">RIGHT</field>
                            <value name="DIST"><block type="math_number"><field name="NUM">600</field></block></value>
                            <next>
                                  <block type="drone_move_cm">
                                                <field name="DIR">FORWARD</field>
                                    <value name="DIST"><block type="math_number"><field name="NUM">600</field></block></value>
                                        <next>
                                          <block type="drone_move_cm">
                                            <field name="DIR">LEFT</field>
                                                    <value name="DIST"><block type="math_number"><field name="NUM">450</field></block></value>
                                            <next>
                                              <block type="drone_move_cm">
                                                <field name="DIR">BACKWARD</field>
                                                <value name="DIST"><block type="math_number"><field name="NUM">300</field></block></value>
                                                <next>
                                                  <block type="drone_move_cm">
                                                    <field name="DIR">RIGHT</field>
                                                            <value name="DIST"><block type="math_number"><field name="NUM">150</field></block></value>
                                                    <next>
                                                      <block type="drone_hover">
                                                                <value name="DURATION"><block type="math_number"><field name="NUM">3.5</field></block></value>
                                                        <next>
                                                          <!-- 3. 前往環境感測點 (9,1) -->
                                                          <block type="drone_move_cm">
                                                            <field name="DIR">LEFT</field>
                                                                    <value name="DIST"><block type="math_number"><field name="NUM">150</field></block></value>
                                                            <next>
                                                              <block type="drone_move_cm">
                                                                        <field name="DIR">FORWARD</field>
                                                                <value name="DIST"><block type="math_number"><field name="NUM">300</field></block></value>
                                                                <next>
                                                                  <block type="drone_move_cm">
                                                                            <field name="DIR">LEFT</field>
                                                                            <value name="DIST"><block type="math_number"><field name="NUM">600</field></block></value>
                                                                    <next>
                                                                      <block type="drone_hover">
                                                                                <value name="DURATION"><block type="math_number"><field name="NUM">3.5</field></block></value>
                                                                        <next>
                                                                          <!-- 4. 前往疏散集結區 Bravo -->
                                                                          <block type="drone_move_cm">
                                                                                    <field name="DIR">FORWARD</field>
                                                                            <value name="DIST"><block type="math_number"><field name="NUM">450</field></block></value>
                                                                            <next>
                                                                              <block type="drone_move_cm">
                                                                                        <field name="DIR">LEFT</field>
                                                                                <value name="DIST"><block type="math_number"><field name="NUM">450</field></block></value>
                                                                                <next>
                                                                                  <block type="drone_land"></block>
                                                                                </next>
                                                                                      </block>
                                                                                    </next>
                                                                                  </block>
                                                                                </next>
                                                                              </block>
                                                                            </next>
                                                                          </block>
                                                                        </next>
                                                                      </block>
                                                                    </next>
                                                                  </block>
                                                                </next>
                                                              </block>
                                                            </next>
                                                          </block>
                                                        </next>
                                                      </block>
                                                    </next>
                                                  </block>
                                                </next>
                                              </block>
                                            </next>
                                          </block>
                                        </next>
                                      </block>
                                    </next>
                                  </block>
                                </next>
                              </block>
                            </next>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </next>
  </block>
</xml>`;

        try {
            const xml = Blockly.utils.xml.textToDom(answerXml); // 使用最新 API
            Blockly.Xml.domToWorkspace(xml, workspace);
            logToConsole("✅ 已載入任務一參考答案（Alpha → 三巡檢點 → Bravo 降落）。");
        } catch (e) {
            console.error("載入答案失敗:", e);
            showAppMessage({
                variant: 'error',
                title: '載入答案失敗',
                body: e && e.message ? String(e.message) : '無法將參考答案寫入工作區。',
                nextStep: '請確認已開啟積木區，或重新整理頁面後再試。',
                focusClose: true
            });
        }
    });
}
// --- 任務特定功能派發器 ---
async function dispatchCollectWater() {
    console.log("💧 正在執行取水指令...");
    const cell = typeof findCityInteractionCell === 'function'
        ? findCityInteractionCell(5)
        : null;

    if (cell) {
        await wait(2000);
        state.hasWater = true;
        logToConsole("✅ 取水成功！水箱已滿。");
        updateHUD();
    } else {
        logToConsole("❌ 取水失敗：必須在水源 (藍色池塘) 正上方執行。");
    }
}

async function dispatchReleaseWater() {
    console.log("🔥 正在執行滅火指令...");
    
    if (!state.hasWater) {
        logToConsole("❌ 滅火失敗：水箱是空的，請先去取水！");
        return;
    }

    const cell = typeof findCityInteractionCell === 'function'
        ? findCityInteractionCell(4)
        : null;

    if (cell) {
        await wait(2000); 
        state.hasWater = false;
        if (typeof hideForestFireAt === 'function') hideForestFireAt(cell.i, cell.j);
        if (typeof firesExtinguished !== 'undefined') firesExtinguished++;
        const pts = (typeof awardMission2FireScore === 'function')
            ? awardMission2FireScore(cell.i, cell.j)
            : 0;
        const requiredFires = typeof getRequiredFires === 'function' ? getRequiredFires() : 4;
        const fireSites = typeof getActiveFireSites === 'function'
            ? getActiveFireSites()
            : (typeof FOREST_FIRE_SITES !== 'undefined' ? FOREST_FIRE_SITES : {});
        const site = fireSites[`${cell.i},${cell.j}`];
        const label = site ? site.label : `(${cell.i},${cell.j})`;
        const scoreMsg = pts > 0 ? ` (+${pts} 分)` : '';
        logToConsole(`🌊 滅火成功！${label} 已撲滅。${scoreMsg}（${firesExtinguished}/${requiredFires}）`);
        updateHUD();
    } else {
        logToConsole("❌ 滅火失敗：下方沒有火源。請對準火焰中心執行。");
    }
}

function updateHUD() {
    const hud = document.getElementById('hud-display');
    if (!hud) return;
    
    const alt = isCityMissionScene() ? (state.y - getForestHeight(state.x, state.z)) : state.y;
    const waterStatus = state.hasWater ? '<span style="color:#00adb5">FULL</span>' : '<span style="color:#aaa">EMPTY</span>';
    
    hud.innerHTML = `
        Status: ${state.isFlying ? 'FLYING' : 'LANDED'}<br>
        Alt: ${alt.toFixed(0)} cm<br>
        Water: ${waterStatus}
    `;
}

// 監聽狀態變化以更新 HUD
setInterval(updateHUD, 200);

// --- 重置與停止功能 ---

/** 暫時隱藏任務一／二「💡 參考答案」按鈕（改為 true 可重新開放） */
const SHOW_MISSION_REFERENCE_ANSWERS = false;

function updateMazeAnswerButtonVisibility() {
    const answerBtn = document.getElementById('maze-answer-btn');
    if (!answerBtn) return;
    const show = SHOW_MISSION_REFERENCE_ANSWERS
        && typeof currentSceneType !== 'undefined'
        && (currentSceneType === 'tunnel' || currentSceneType === 'city');
    answerBtn.style.display = show ? '' : 'none';
}
window.updateMazeAnswerButtonVisibility = updateMazeAnswerButtonVisibility;

function updateGotoXyzToolboxVisibility() {
    const blockEl = document.getElementById('toolbox-goto-xyz-block');
    if (blockEl) {
        const hide = isTunnelMissionScene();
        blockEl.style.display = hide ? 'none' : '';
    }
    if (workspace && typeof workspace.updateToolbox === 'function') {
        const toolboxEl = document.getElementById('toolbox');
        if (toolboxEl) {
            workspace.updateToolbox(toolboxEl);
        }
    }
}
window.updateGotoXyzToolboxVisibility = updateGotoXyzToolboxVisibility;

function resetSimulator() {
    state.stopSignal = true; 
    state.isRunning = false;
    state.isFlying = false;
    
    clearConsole();

    cmdQueue = [];
    waitingForKey = false;
    
    // 清除高亮
    if (currentExecutingBlockId) {
        try {
            highlightBlock(currentExecutingBlockId, false);
        } catch (e) {
            console.warn("清除高亮失敗:", e);
        }
        currentExecutingBlockId = null;
    }
    
    // 隱藏進度條
    updateProgress(0, 0);
    
    // 清除映射關係
    blockToCommandMap.clear();
    commandToBlockMap.clear();

    // --- 重置任務狀態 ---
    closeBriefing();
    takeoffTime = 0;
    currentScore = 0;
    state.missionCompleted = false;
    hasTakenOff = false;

    if (typeof resetInspectionBeacons === 'function') {
        resetInspectionBeacons();
    }
    if (typeof resetCityMissionState === 'function') {
        resetCityMissionState();
    } else {
        state.hasWater = false;
        if (typeof resetCityBattery === 'function') resetCityBattery();
    }
    if (typeof resetTunnelPatrolVisits === 'function') {
        resetTunnelPatrolVisits();
    }

    // 如果在隨機迷宮挑戰模式，重置後重新啟動輪換
    if (currentSceneType === 'challenge_maze') {
        if (typeof startMazeCycling === 'function') {
            startMazeCycling();
        }
    }
    if (typeof syncDroneToStart === 'function') {
        syncDroneToStart();
    } else {
        state.x = startPosition.x; 
        state.y = startPosition.y; 
        state.z = startPosition.z; 
        state.heading = startPosition.heading; 
        if (droneGroup) {
            droneGroup.position.set(state.x, state.y, state.z);
            droneGroup.rotation.set(0, THREE.MathUtils.degToRad(state.heading), 0);
            droneGroup.visible = true;
        }
        if (followDrone) {
            camTarget.x = state.x;
            camTarget.y = state.y;
            camTarget.z = state.z;
        }
        if (typeof updateCameraPosition === 'function') updateCameraPosition();
    }

    cityOrder = null; 
    hasHoveredTower = false;
    
    if(droneLedMesh) {
        droneLedMesh.material.color.setHex(0xffffff); // 改回白色
        droneLedMesh.material.opacity = 0.1;
    }
    if(droneLedLight) {
        droneLedLight.color.setHex(0xffffff);
        droneLedLight.intensity = 0;
    }
    
    logToConsole("System Reset Complete.");
    console.log(`System Reset to (${state.x.toFixed(1)}, ${state.y.toFixed(1)}, ${state.z.toFixed(1)})`);
}
function emergencyStop() { 
    state.stopSignal = true; 
    state.isRunning = false;
    state.isFlying = false; 
    state.y = Math.max(0, getGroundHeight(state.x, state.z)); // getGroundHeight 來自 simulator.js
    waitingForStep = false;
    
    // 清除高亮
    if (currentExecutingBlockId) {
        highlightBlock(currentExecutingBlockId, false);
    }
    
    // 隱藏進度條
    updateProgress(0, 0);
}
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms / executionSpeed));
// Wait Key Promise
const waitKey = () => new Promise(resolve => {
    waitingForKey = true;
    const check = setInterval(() => {
        if (state.stopSignal) { clearInterval(check); resolve(); }
        if (!waitingForKey) { clearInterval(check); resolve(); }
    }, 100);
});
// 動畫輔助函數
async function animateAction(durationSec, updateFn, options = { canAbort: true }) {
    const startTime = performance.now(); 
    const durationMs = (durationSec * 1000) / executionSpeed; 
    state.collisionDetected = false; // 重置碰撞旗標
    
    return new Promise(resolve => {
        function loop(currentTime) {
            if (state.stopSignal) { resolve(); return; }
            
            // 如果指令允許被碰撞中斷（如移動指令），則檢查碰撞
            if (options.canAbort && state.collisionDetected) {
                console.log("💥 Animation stopped due to collision");
                resolve();
                return;
            }
            
            const elapsed = currentTime - startTime; 
            const progress = Math.min(elapsed / durationMs, 1);
            updateFn(progress);
            
            if (progress < 1) requestAnimationFrame(loop); else resolve();
        } requestAnimationFrame(loop);
    });
}
// 執行指令隊列
// 高亮當前執行的積木塊
function highlightBlock(blockId, highlight = true) {
    if (!workspace || !blockId) return;
    
    // 清除之前的高亮
    if (currentExecutingBlockId && currentExecutingBlockId !== blockId) {
        const prevBlock = workspace.getBlockById(currentExecutingBlockId);
        if (prevBlock) {
            prevBlock.setHighlighted(false);
        }
    }
    
    // 高亮當前積木塊
    const block = workspace.getBlockById(blockId);
    if (block) {
        block.setHighlighted(highlight);
        currentExecutingBlockId = highlight ? blockId : null;
    }
}

// 更新執行進度顯示（#execution-progress 為 live region；隱藏時 aria-hidden + 重設文字，避免讀屏讀到過期進度）
function updateProgress(current, total) {
    const progressDiv = document.getElementById('execution-progress');
    const progressText = document.getElementById('progress-text');
    if (progressDiv && progressText) {
        if (total > 0) {
            progressDiv.setAttribute('aria-hidden', 'false');
            progressDiv.style.display = 'flex';
            progressText.textContent = `${current}/${total}`;
        } else {
            progressDiv.setAttribute('aria-hidden', 'true');
            progressDiv.style.display = 'none';
            progressText.textContent = '0/0';
        }
    }
}

async function executeQueue() {
    state.isRunning = true; 
    state.stopSignal = false;
    
    console.log("開始執行命令隊列，長度:", cmdQueue.length);
    
    // 顯示進度條
    updateProgress(0, cmdQueue.length);
    
    // 清除之前的高亮
    if (currentExecutingBlockId) {
        try {
            highlightBlock(currentExecutingBlockId, false);
        } catch (e) {
            console.warn("清除高亮失敗:", e);
        }
    }
    
    for (let i = 0; i < cmdQueue.length; i++) {
        if (state.stopSignal) {
            console.log("執行被停止");
            break;
        }

        if (isCityMissionScene() && getCityBatteryRemainingLines() <= 0
            && cmd.type && cmd.type.startsWith('move_')) {
            logToConsole('⚠️ 電力耗盡！請找黃色充電站懸停補電（+15 行），或返回基地。');
            if (typeof emergencyStop === 'function') emergencyStop();
            break;
        }
        
        // 更新進度
        updateProgress(i + 1, cmdQueue.length);
        
        // 高亮當前執行的積木塊（如果映射關係存在）
        try {
            const blockId = commandToBlockMap.get(i);
            if (blockId) {
                highlightBlock(blockId, true);
            }
        } catch (e) {
            // 如果高亮失敗，不影響執行
            console.warn("高亮積木塊失敗:", e);
        }
        
        console.log(`執行命令 ${i + 1}/${cmdQueue.length}: ${cmdQueue[i]?.type || 'unknown'}`);
        
        const cmd = cmdQueue[i];
        const param = parseFloat(cmd.param);
        
        if (!state.isFlying && cmd.type !== 'takeoff' && cmd.type !== 'set_color' && cmd.type !== 'wait_key') { 
            await wait(200); continue; 
        }

        switch (cmd.type) {
            case 'collect_water':
                await dispatchCollectWater();
                break;
            case 'release_water':
                await dispatchReleaseWater();
                break;
            case 'wait_key': await waitKey(); break;
            case 'takeoff': 
                await animateAction(1.5, p => state.y = Math.max(state.y, p * 80), { canAbort: false }); 
                state.isFlying = true; 
                hasTakenOff = true; 
                break;
            case 'land': 
                const sy = state.y; const gy = getGroundHeight(state.x, state.z);
                await animateAction(1.5, p => state.y = sy - ((sy-gy)*p), { canAbort: false }); 
                state.isFlying = false; 
                
                if (hasTakenOff) {
                    const dist = Math.sqrt(
                        Math.pow(state.x - targetPosition.x, 2) + 
                        Math.pow(state.z - targetPosition.z, 2)
                    );
                    
                    logToConsole(`Landing Distance to target: ${dist.toFixed(1)} cm`);

                    if (dist < 20) {
                        currentScore += 10;
                        logToConsole(`✅ Perfect Landing! (+10 Score)`);
                    } else {
                        logToConsole(`❌ Missed Target. (Error > 20cm)`);
                    }
                }
                break;
            case 'hover':
            await wait(param * 1000);
            if (isCityMissionScene() && typeof creditForestChargeHover === 'function') {
                creditForestChargeHover(param);
            } else if (isTunnelMissionScene() && typeof creditTunnelInspectionHover === 'function') {
                creditTunnelInspectionHover(param);
            }
            break;
            case 'set_color': 
                if(droneLedMesh) {
                    // 更新顏色和透明度（開啟狀態）
                    droneLedMesh.material.color.set(cmd.param);
                    droneLedMesh.material.transparent = true;
                    droneLedMesh.material.opacity = 1.0;  // 完全不透明（開啟狀態）
                }
                if(droneLedLight) {
                    droneLedLight.color.set(cmd.param);
                    droneLedLight.intensity = 2.0;
                }
                await wait(200); 
                break;
            // --- LED 邏輯 ---
            case 'led_hex_bright':
                if(droneLedMesh) {
                    let c = new THREE.Color(cmd.color);
                    // 更新顏色和透明度（根據亮度）
                    droneLedMesh.material.color.set(c);
                    droneLedMesh.material.transparent = true;
                    // 根據亮度設置透明度：亮度越高，越不透明
                    droneLedMesh.material.opacity = Math.max(0.1, cmd.brightness / 255);
                    let intensity = (cmd.brightness / 255) * 2.0; 
                    if(droneLedLight) {
                        droneLedLight.color.set(c);
                        droneLedLight.intensity = intensity;
                    }
                }
                await wait(100); 
                break;
            case 'led_rgb':
                if(droneLedMesh) {
                    let c = new THREE.Color(`rgb(${Math.round(cmd.r)}, ${Math.round(cmd.g)}, ${Math.round(cmd.b)})`);
                    // 更新顏色和透明度（根據亮度）
                    droneLedMesh.material.color.set(c);
                    droneLedMesh.material.transparent = true;
                    // 根據亮度設置透明度：亮度越高，越不透明
                    droneLedMesh.material.opacity = Math.max(0.1, cmd.brightness / 255);
                    let intensity = (cmd.brightness / 255) * 2.0;
                    if(droneLedLight) {
                        droneLedLight.color.set(c);
                        droneLedLight.intensity = intensity;
                    }
                }
                await wait(100);
                break;
            case 'led_off':
                if(droneLedMesh) {
                    // 設置為接近透明的白色（關閉狀態）
                    droneLedMesh.material.color.setHex(0xffffff);
                    droneLedMesh.material.transparent = true;
                    droneLedMesh.material.opacity = 0.1;  // 接近透明
                }
                if(droneLedLight) droneLedLight.intensity = 0;
                await wait(100);
                break;
            case 'led_seq':
                if(droneLedMesh) {
                    let c = new THREE.Color(`rgb(${Math.round(cmd.r)}, ${Math.round(cmd.g)}, ${Math.round(cmd.b)})`);
                    // 只更新顏色，不更新 emissive（避免發光效果影響機身）
                    droneLedMesh.material.color.set(c);
                    if(droneLedLight) {
                        droneLedLight.color.set(c);
                        droneLedLight.intensity = 2.0; 
                    }
                }
                if (cmd.seq === 'DIMMING') {
                    await animateAction(1.5, p => {
                        let i = 2.0 * Math.abs(Math.sin(p * Math.PI)); 
                        if(droneLedLight) droneLedLight.intensity = i;
                        // 不更新 emissive，避免發光效果
                    });
                } else {
                    await wait(1000); 
                }
                break;    
            case 'set_var':
                if(cmd.var === 'ROLL') flightState.roll = cmd.val;
                if(cmd.var === 'PITCH') flightState.pitch = cmd.val;
                if(cmd.var === 'YAW') flightState.yaw = cmd.val;
                if(cmd.var === 'THROTTLE') flightState.throttle = cmd.val;
                break;
            case 'set_heading':
                const startH = state.heading;
                await animateAction(1.0, p => state.heading = startH + (cmd.val - startH) * p);
                break;
            case 'move_complex':
                const rad = THREE.MathUtils.degToRad(state.heading);
                const speed = 50; 
                const r = flightState.roll / 100;
                const p_val = flightState.pitch / 100;
                const t = flightState.throttle / 100;
                
                const dx = (r * Math.cos(rad) - (-p_val) * Math.sin(rad)) * speed;
                const dz = (r * Math.sin(rad) + (-p_val) * Math.cos(rad)) * speed;
                const dy = t * speed;

                const curX = state.x; const curY = state.y; const curZ = state.z;
                await animateAction(param, prog => {
                    state.x = curX + dx * param * prog;
                    const groundY = getGroundHeight(state.x, state.z);
                    state.y = Math.max(groundY, curY + dy * param * prog);
                    state.z = curZ + dz * param * prog;
                });
                break;
            case 'goto_xyz':
                if (isTunnelMissionScene()) {
                    logToConsole('⚠️ 任務一禁止使用「飛至座標 (Goto XYZ)」；請沿可通行路網飛行。');
                    await wait(100);
                    break;
                }
                    const gx = state.x, gY = state.y, gz = state.z;
                    await animateAction(2.0, p => {
                        state.x = gx + (cmd.x - gx)*p;
                        state.y = gY + (cmd.y - gY)*p;
                        state.z = gz + (cmd.z - gz)*p;
                    });
                    break;
            case 'turn_time':
                const turnSpd = (cmd.power/100) * 90; 
                const sHT = state.heading;
                const dirMult = (cmd.dir === 'LEFT') ? 1 : -1;
                await animateAction(param, p => { state.heading = sHT + (turnSpd * param * dirMult * p); });
                break;
            case 'print':
                let currentMsg = "Undefined";
                try {
                        currentMsg = cmd.fn(); 
                } catch(e) {
                        currentMsg = "Error: " + e.message;
                }
                logToConsole(currentMsg);
                console.log("%c[Drone Output] " + currentMsg, "color: #00adb5");
                await wait(200); 
                break;
            default:
                if (cmd.type.startsWith('move_')) {
                    const rad = THREE.MathUtils.degToRad(state.heading); let dx = 0, dz = 0; let dy = 0;
                    if (cmd.type === 'move_forward') { dx = -Math.sin(rad); dz = -Math.cos(rad); }
                    else if (cmd.type === 'move_backward') { dx = Math.sin(rad); dz = Math.cos(rad); }
                    else if (cmd.type === 'move_left') { dx = -Math.cos(rad); dz = Math.sin(rad); }
                    else if (cmd.type === 'move_right') { dx = Math.cos(rad); dz = -Math.sin(rad); }
                    else if (cmd.type === 'move_up') { dy = 1; }
                    else if (cmd.type === 'move_down') { dy = -1; }
                    
                    const sX = state.x; const sZ = state.z; const sY = state.y; const dist = 50 * param;
                    await animateAction(param, (p) => { 
                        state.x = sX + (dx * dist * p); 
                        state.z = sZ + (dz * dist * p);
                        const gH = getGroundHeight(state.x, state.z);
                        state.y = Math.max(gH, sY + (dy * dist * p));
                    });
                    // 如果發生碰撞，確保當前狀態座標同步回安全位置，避免下一積木瞬移
                    if (state.collisionDetected) {
                        state.x = lastSafePos.x;
                        state.z = lastSafePos.z;
                    }
                } else if (cmd.type.startsWith('turn_')) {
                    const sH = state.heading; 
                    const deg = cmd.param * (cmd.type==='turn_left'?1:-1);
                    await animateAction(1.0, p => state.heading = sH + deg*p, { canAbort: false });
                }
                break;
        }
        if (isCityMissionScene()) consumeCityBatteryLine(cmd);
        await wait(200);
    }
    
    // 清除高亮
    if (currentExecutingBlockId) {
        highlightBlock(currentExecutingBlockId, false);
    }
    
    // 隱藏進度條
    updateProgress(0, 0);
    
    state.isRunning = false;
}
// ==========================================
// 菜單導航邏輯
// ==========================================

// 等待元素有正確尺寸的輔助函數
async function waitForElementSize(element, maxRetries = 30) {
    if (!element) {
        console.error("Element is null");
        return false;
    }
    
    for (let i = 0; i < maxRetries; i++) {
        // 使用 requestAnimationFrame 確保佈局已更新
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // 強制重新計算佈局
        void element.offsetHeight;
        
        // 檢查多種尺寸屬性
        const width = element.clientWidth || element.offsetWidth || element.getBoundingClientRect().width;
        const height = element.clientHeight || element.offsetHeight || element.getBoundingClientRect().height;
        
        // 也檢查父容器
        const parent = element.parentElement;
        const parentWidth = parent ? (parent.clientWidth || parent.offsetWidth || parent.getBoundingClientRect().width) : 0;
        const parentHeight = parent ? (parent.clientHeight || parent.offsetHeight || parent.getBoundingClientRect().height) : 0;
        
        // 如果寬度和高度都大於 0，則準備好了
        if (width > 0 && height > 0) {
            console.log(`Element ready: ${width}x${height} (attempt ${i + 1}), parent: ${parentWidth}x${parentHeight}`);
            return true;
        }
        
        // 如果寬度已經準備好，但高度為 0，可能是 flex 佈局還在計算
        // 我們可以繼續等待，或者如果寬度足夠大，可以接受（Three.js 可以稍後調整）
        if (width > 100 && i > 10) {
            console.log(`Width ready (${width}px), but height is ${height}px. Proceeding anyway (attempt ${i + 1})`);
            // 強制設置一個最小高度，讓 Three.js 可以初始化
            if (height === 0 && parentHeight > 0) {
                element.style.minHeight = parentHeight + 'px';
                console.log(`Set min-height to ${parentHeight}px`);
            }
            return true;
        }
        
        if (i < 5 || i % 5 === 0) {
            console.log(`Waiting for element size... (attempt ${i + 1}/${maxRetries}) - Current: ${width}x${height}, Parent: ${parentWidth}x${parentHeight}`);
        }
        
        // 額外等待一小段時間
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const finalWidth = element.clientWidth || element.offsetWidth || element.getBoundingClientRect().width;
    const finalHeight = element.clientHeight || element.offsetHeight || element.getBoundingClientRect().height;
    const parent = element.parentElement;
    const parentWidth = parent ? (parent.clientWidth || parent.offsetWidth || parent.getBoundingClientRect().width) : 0;
    const parentHeight = parent ? (parent.clientHeight || parent.offsetHeight || parent.getBoundingClientRect().height) : 0;
    
    // 如果寬度已經準備好，即使高度為 0，也嘗試繼續
    if (finalWidth > 100 && parentHeight > 0) {
        console.warn(`Width ready (${finalWidth}px), but height is ${finalHeight}px. Setting min-height and proceeding.`);
        element.style.minHeight = parentHeight + 'px';
        return true;
    }
    
    console.error(`Element not ready after ${maxRetries} attempts. Final size: ${finalWidth}x${finalHeight}, Parent: ${parentWidth}x${parentHeight}`);
    return false;
}

// 同步積木區切換鈕的輔助科技狀態（aria-expanded 與標籤需與 #blocklyDiv 是否含 .visible 一致）
function setBlocklyToggleA11y(panelExpanded) {
    const toggleBtn = document.getElementById('toggle-blockly-btn');
    if (!toggleBtn) return;
    toggleBtn.setAttribute('aria-expanded', panelExpanded ? 'true' : 'false');
    toggleBtn.setAttribute('aria-controls', 'blocklyDiv');
    toggleBtn.setAttribute('aria-label', panelExpanded ? '隱藏積木區' : '顯示積木區');
    toggleBtn.title = panelExpanded ? '隱藏積木區' : '顯示積木區';
}

const BLOCKLY_DISCOVER_LS_KEY = 'drone-simulator:v1:blockly-discover-dismissed';
let blocklyDiscoverToastTimerId = null;

function dismissBlocklyDiscoverToast() {
    const el = document.getElementById('blockly-discover-toast');
    if (el) {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
    }
    if (blocklyDiscoverToastTimerId !== null) {
        clearTimeout(blocklyDiscoverToastTimerId);
        blocklyDiscoverToastTimerId = null;
    }
    try {
        localStorage.setItem(BLOCKLY_DISCOVER_LS_KEY, '1');
    } catch (err) {
        /* 私人瀏覽等情境無法持久化，略過 */
    }
}

function maybeShowBlocklyDiscoverToast() {
    try {
        if (localStorage.getItem(BLOCKLY_DISCOVER_LS_KEY)) return;
    } catch (err) {
        return;
    }
    const gi = document.getElementById('game-interface');
    if (!gi || gi.style.display === 'none') return;
    const el = document.getElementById('blockly-discover-toast');
    if (!el) return;
    el.hidden = false;
    el.removeAttribute('aria-hidden');
    if (blocklyDiscoverToastTimerId !== null) {
        clearTimeout(blocklyDiscoverToastTimerId);
    }
    blocklyDiscoverToastTimerId = setTimeout(() => {
        blocklyDiscoverToastTimerId = null;
        dismissBlocklyDiscoverToast();
    }, 14000);
}

// 切換積木區顯示/隱藏
function toggleBlocklyPanel() {
    const blocklyPanel = document.getElementById('blocklyDiv');
    const mainContainer = document.querySelector('.main-container');
    const toggleBtn = document.getElementById('toggle-blockly-btn');
    
    if (!blocklyPanel || !mainContainer || !toggleBtn) return;
    
    const isVisible = blocklyPanel.classList.contains('visible');
    
    if (isVisible) {
        // 隱藏積木區 - 保存當前寬度
        const currentWidth = blocklyPanel.offsetWidth;
        const containerWidth = mainContainer.offsetWidth;
        if (currentWidth > 0 && containerWidth > 0) {
            savedBlocklyWidth = (currentWidth / containerWidth) * 100;
            // 確保在合理範圍內
            savedBlocklyWidth = Math.max(25, Math.min(savedBlocklyWidth, 60));
        }
        
        blocklyPanel.classList.remove('visible');
        mainContainer.classList.add('blockly-hidden');
        // 強制重置寬度和 flex
        blocklyPanel.style.flex = '0 0 0';
        blocklyPanel.style.width = '0';
        toggleBtn.textContent = '📦 顯示積木區';
        
        // 等待動畫完成後調整 3D 渲染器大小（動畫時間 150ms）
        setTimeout(() => {
            refreshGameUILayout();
        }, 200);
    } else {
        // 顯示積木區 - 恢復之前保存的寬度
        blocklyPanel.classList.add('visible');
        mainContainer.classList.remove('blockly-hidden');
        // 恢復之前保存的寬度
        blocklyPanel.style.flex = `0 0 ${savedBlocklyWidth}%`;
        blocklyPanel.style.width = `${savedBlocklyWidth}%`;
        toggleBtn.textContent = '📦 隱藏積木區';
        
        // 確保 Blockly 已初始化（只在顯示時初始化）
        if (!workspace) {
            // 等待面板顯示動畫開始後再初始化
            setTimeout(() => {
                initBlockly();
            }, 50);
        } else {
            setTimeout(() => {
                refreshGameUILayout();
            }, 100);
        }

        setTimeout(() => {
            refreshGameUILayout();
            initBlocklyResizer();
        }, 200);
    }
    setBlocklyToggleA11y(blocklyPanel.classList.contains('visible'));
}

// 積木區縮放控制
let blocklyZoom = 1.0; // 默認縮放比例

function zoomBlockly(direction) {
    if (!workspace || typeof Blockly === 'undefined') return;
    
    const zoomStep = 0.1; // 每次縮放 10%
    const minZoom = 0.5; // 最小縮放 50%
    const maxZoom = 2.0; // 最大縮放 200%
    
    if (direction === 'in') {
        blocklyZoom = Math.min(blocklyZoom + zoomStep, maxZoom);
    } else if (direction === 'out') {
        blocklyZoom = Math.max(blocklyZoom - zoomStep, minZoom);
    } else if (direction === 'reset') {
        blocklyZoom = 1.0;
    }
    
    // 應用縮放
    const metrics = workspace.getMetrics();
    if (metrics) {
        workspace.setScale(blocklyZoom);
        workspace.scroll(metrics.viewLeft, metrics.viewTop);
    }
    
    console.log(`Blockly zoom: ${(blocklyZoom * 100).toFixed(0)}%`);
}

function ensureBlocklyWorkspaceReady() {
    const blocklyDiv = document.getElementById('blocklyDiv');
    if (!blocklyDiv || !blocklyDiv.classList.contains('visible')) {
        showAppMessage({
            variant: 'warn',
            title: '積木區尚未開啟',
            body: '請先按頂部「顯示積木區」開啟面板。',
            nextStep: '開啟後即可匯出或匯入積木程式。'
        });
        return null;
    }
    return initBlockly();
}

function getBlocklyWorkspaceXmlText(ws) {
    if (!ws || typeof Blockly === 'undefined') return null;
    return Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));
}

function applyBlocklyWorkspaceXmlText(xmlText) {
    const ws = ensureBlocklyWorkspaceReady();
    if (!ws) return false;
    try {
        blocklyAutosaveRestoring = true;
        ws.clear();
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xmlText), ws);
        if (!blocklyAutosaveLoadedKey) {
            blocklyAutosaveLoadedKey = getBlocklyAutosaveKey();
        }
        flushBlocklyAutosave();
        return true;
    } catch (err) {
        console.error('[blockly-io] 匯入失敗', err);
        return false;
    } finally {
        blocklyAutosaveRestoring = false;
    }
}

function exportBlocklyWorkspace() {
    const ws = ensureBlocklyWorkspaceReady();
    if (!ws) return;

    const xmlText = getBlocklyWorkspaceXmlText(ws);
    if (!xmlText) {
        showAppMessage({
            variant: 'error',
            title: '匯出失敗',
            body: '無法讀取目前積木工作區。',
            focusClose: true
        });
        return;
    }

    const contextKey = getBlocklyAutosaveKey();
    const filename = `drone-blockly-${contextKey}.xml`;

    try {
        const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('[blockly-io] 下載失敗', err);
        showAppMessage({
            variant: 'error',
            title: '匯出失敗',
            body: '無法建立下載檔案。',
            nextStep: '請再試一次，或從主控台查看錯誤訊息。',
            focusClose: true
        });
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(xmlText).catch(() => {});
    }

    logToConsole(`📤 已匯出積木程式：${filename}`);
    showAppMessage({
        variant: 'info',
        title: '匯出成功',
        body: `已下載 ${filename}。`,
        nextStep: '可分享此 XML 檔，或使用「匯入」還原積木。',
        autoHideMs: 6000,
        focusClose: false
    });
}

function triggerBlocklyImport() {
    if (!ensureBlocklyWorkspaceReady()) return;
    const input = document.getElementById('blockly-import-input');
    if (input) input.click();
}

function handleBlocklyImportFile(inputEl) {
    const file = inputEl && inputEl.files && inputEl.files[0];
    inputEl.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const xmlText = typeof reader.result === 'string' ? reader.result.trim() : '';
        if (!xmlText) {
            showAppMessage({
                variant: 'error',
                title: '匯入失敗',
                body: '檔案是空的或無法讀取。',
                focusClose: true
            });
            return;
        }

        showAppConfirm('匯入將取代目前積木程式，確定嗎？', {
            title: '匯入積木',
            confirmLabel: '匯入',
            cancelLabel: '取消'
        }).then((ok) => {
            if (!ok) return;
            if (applyBlocklyWorkspaceXmlText(xmlText)) {
                logToConsole(`📥 已匯入積木程式：${file.name}`);
                showAppMessage({
                    variant: 'info',
                    title: '匯入成功',
                    body: `已載入 ${file.name}。`,
                    nextStep: '變更已自動儲存至目前任務。',
                    autoHideMs: 6000,
                    focusClose: false
                });
            } else {
                showAppMessage({
                    variant: 'error',
                    title: '匯入失敗',
                    body: 'XML 格式無效或與目前積木版本不相容。',
                    nextStep: '請確認檔案為本模擬器匯出的 Blockly XML。',
                    focusClose: true
                });
            }
        });
    };
    reader.onerror = () => {
        showAppMessage({
            variant: 'error',
            title: '匯入失敗',
            body: '無法讀取所選檔案。',
            focusClose: true
        });
    };
    reader.readAsText(file);
}

// 初始化積木區寬度調整功能
let blocklyResizerInitialized = false;

function initBlocklyResizer() {
    const resizer = document.getElementById('blockly-resizer');
    const blocklyPanel = document.getElementById('blocklyDiv');
    const mainContainer = document.querySelector('.main-container');

    if (!resizer || !blocklyPanel || !mainContainer) return;
    if (blocklyResizerInitialized) return;
    blocklyResizerInitialized = true;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let activePointerId = null;

    function applyPanelWidth(clientX) {
        const diff = clientX - startX;
        const newWidth = startWidth + diff;
        const containerWidth = mainContainer.offsetWidth;
        const minWidth = 250;
        const maxWidth = containerWidth * 0.6;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
            const percentage = (newWidth / containerWidth) * 100;
            savedBlocklyWidth = percentage;
            blocklyPanel.style.transition = 'none';
            blocklyPanel.style.flex = `0 0 ${percentage}%`;
            blocklyPanel.style.width = `${percentage}%`;

            if (workspace && typeof Blockly !== 'undefined') {
                Blockly.svgResize(workspace);
            }
            if (typeof onWindowResize === 'function') {
                onWindowResize();
            }
        }
    }

    function beginResize(clientX, pointerId) {
        isResizing = true;
        startX = clientX;
        startWidth = blocklyPanel.offsetWidth;
        activePointerId = pointerId ?? null;
        document.body.classList.add('blockly-resizing');
    }

    function endResize() {
        if (!isResizing) return;
        isResizing = false;
        activePointerId = null;
        document.body.classList.remove('blockly-resizing');
        if (blocklyPanel) {
            blocklyPanel.style.transition = 'opacity 0.3s ease';
        }
    }

    if (window.PointerEvent) {
        resizer.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            beginResize(e.clientX, e.pointerId);
            try {
                resizer.setPointerCapture(e.pointerId);
            } catch (_) { /* ignore */ }
            e.preventDefault();
        }, { passive: false });

        resizer.addEventListener('pointermove', (e) => {
            if (!isResizing || e.pointerId !== activePointerId) return;
            applyPanelWidth(e.clientX);
            e.preventDefault();
        }, { passive: false });

        const onPointerEnd = (e) => {
            if (!isResizing || e.pointerId !== activePointerId) return;
            try {
                resizer.releasePointerCapture(e.pointerId);
            } catch (_) { /* ignore */ }
            endResize();
        };
        resizer.addEventListener('pointerup', onPointerEnd);
        resizer.addEventListener('pointercancel', onPointerEnd);
    } else {
        // 舊版瀏覽器：滑鼠 + 觸控分開處理
        resizer.addEventListener('mousedown', (e) => {
            beginResize(e.clientX, null);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });

        function onMouseMove(e) {
            if (!isResizing) return;
            applyPanelWidth(e.clientX);
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            endResize();
        }

        resizer.addEventListener('touchstart', (e) => {
            if (!e.changedTouches.length) return;
            beginResize(e.changedTouches[0].clientX, null);
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!isResizing) return;
            if (e.touches.length) applyPanelWidth(e.touches[0].clientX);
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (!isResizing) return;
            endResize();
        });

        document.addEventListener('touchcancel', () => {
            if (!isResizing) return;
            endResize();
        });
    }
}

// 返回任務選擇畫面
function returnToMissionSelect() {
    closeResultModal();
    if (currentGameMode === 'freeplay') {
        showMainMenu();
    } else if (lastMissionMenu === 'practice') {
        document.getElementById('game-interface').style.display = 'none';
        document.getElementById('mission-select-menu').style.display = 'none';
        document.getElementById('practice-select-menu').style.display = 'flex';
        document.getElementById('main-menu').style.display = 'none';
    } else {
        document.getElementById('game-interface').style.display = 'none';
        document.getElementById('mission-select-menu').style.display = 'flex';
        document.getElementById('practice-select-menu').style.display = 'none';
        document.getElementById('main-menu').style.display = 'none';
    }
}

// 🔥 挑戰模式：隨機迷宮
function startChallengeMode() {
    activeMissionId = 'challenge';
    currentGameMode = 'mission';
    logToConsole('🔥 挑戰模式：隨機市區迷宮已啟動！');
    logToConsole('💡 使用感應器自動導航；藍／綠箭嘴標示起點與終點。');
    changeScene('challenge_maze');
    logToConsole(`📍 起點已同步: (${state.x.toFixed(0)}, ${state.z.toFixed(0)})`);

    onBlocklyContextChanged();

    showAppConfirm('挑戰模式需要編寫「自動導航」積木（使用感應器）。是否清除當前積木？', { title: '挑戰模式' }).then((ok) => {
        if (!ok || !workspace) return;
        workspace.clear();
        const xmlText = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_start" x="20" y="20"></block></xml>';
        const xml = Blockly.utils.xml.textToDom(xmlText);
        Blockly.Xml.domToWorkspace(xml, workspace);
    });
}

// 顯示任務簡報
const MISSION1_GRADE_TIERS = [
    { min: 920, label: '一等', labelEn: '1st Class', css: 'grade-1', desc: '3/3 巡檢 + 抵達終點 + 極速完成' },
    { min: 720, label: '二等', labelEn: '2nd Class', css: 'grade-2', desc: '完成交班並有多項巡檢加分' },
    { min: 550, label: '三等', labelEn: '3rd Class', css: 'grade-3', desc: '完成終點基本交班' }
];

function getMission1Grade(total) {
    const score = Math.floor(Number(total) || 0);
    for (const tier of MISSION1_GRADE_TIERS) {
        if (score >= tier.min) return Object.assign({ score }, tier);
    }
    return {
        score,
        min: 0,
        label: '待加強',
        labelEn: 'Keep Trying',
        css: 'grade-0',
        desc: '尚未達三等門檻（550 分）— 請確認已在終點降落'
    };
}

const MISSION2_GRADE_TIERS = [
    { min: 950, label: '一等', labelEn: '1st Class', css: 'grade-1', desc: '撲滅 4 處火點 + 高效率完成' },
    { min: 750, label: '二等', labelEn: '2nd Class', css: 'grade-2', desc: '完成滅火任務並有一定時間獎' },
    { min: 550, label: '三等', labelEn: '3rd Class', css: 'grade-3', desc: '撲滅全部火點（基本達標）' }
];

const PRACTICE1_GRADE_TIERS = [
    { min: 450, label: '一等', labelEn: '1st Class', css: 'grade-1', desc: '巡檢 + 抵達終點 + 快速完成' },
    { min: 350, label: '二等', labelEn: '2nd Class', css: 'grade-2', desc: '完成交班並有巡檢加分' },
    { min: 300, label: '三等', labelEn: '3rd Class', css: 'grade-3', desc: '完成終點基本交班' }
];

const PRACTICE2_GRADE_TIERS = [
    { min: 550, label: '一等', labelEn: '1st Class', css: 'grade-1', desc: '撲滅 2 處火點 + 高效率完成' },
    { min: 450, label: '二等', labelEn: '2nd Class', css: 'grade-2', desc: '完成滅火並有一定時間獎' },
    { min: 400, label: '三等', labelEn: '3rd Class', css: 'grade-3', desc: '撲滅全部火點（基本達標）' }
];

function getPractice1Grade(total) {
    const score = Math.floor(Number(total) || 0);
    for (const tier of PRACTICE1_GRADE_TIERS) {
        if (score >= tier.min) return Object.assign({ score }, tier);
    }
    return {
        score,
        min: 0,
        label: '待加強',
        labelEn: 'Keep Trying',
        css: 'grade-0',
        desc: '尚未達三等門檻（300 分）— 請確認已在終點降落'
    };
}

function getPractice2Grade(total) {
    const score = Math.floor(Number(total) || 0);
    for (const tier of PRACTICE2_GRADE_TIERS) {
        if (score >= tier.min) return Object.assign({ score }, tier);
    }
    return {
        score,
        min: 0,
        label: '待加強',
        labelEn: 'Keep Trying',
        css: 'grade-0',
        desc: '尚未達三等門檻（400 分）— 請確認已在受災區降落'
    };
}

function getMission2Grade(total) {
    const score = Math.floor(Number(total) || 0);
    for (const tier of MISSION2_GRADE_TIERS) {
        if (score >= tier.min) return Object.assign({ score }, tier);
    }
    return {
        score,
        min: 0,
        label: '待加強',
        labelEn: 'Keep Trying',
        css: 'grade-0',
        desc: '尚未達三等門檻（550 分）— 請確認已在受災區降落'
    };
}

function renderBriefGradeGrid(tiers) {
    const list = tiers || MISSION1_GRADE_TIERS;
    return `
        <div class="brief-grade-grid">
            ${list.map((t, i) => {
                const next = list[i - 1];
                const range = next ? `${t.min}–${next.min - 1}` : `≥${t.min}`;
                return `<div class="brief-grade brief-grade--${i + 1}">
                    <span class="brief-grade-label">${t.label}</span>
                    <span class="brief-grade-range">${range} 分</span>
                </div>`;
            }).join('')}
        </div>`;
}

function renderBriefTimeTierTable(tiers, overtimeLabel) {
    const tierList = tiers
        || (typeof window !== 'undefined' && window.TUNNEL_MISSION_TIME_TIERS)
        || [];
    const overtime = overtimeLabel || '超過 3 分鐘';
    const rows = tierList.map(t =>
        `<tr><td>${t.label}</td><td>+${t.bonus}</td></tr>`
    ).join('');
    return `
        <table class="brief-time-table">
            <thead><tr><th>完成時間</th><th>加分</th></tr></thead>
            <tbody>${rows}<tr><td>${overtime}</td><td>+0</td></tr></tbody>
        </table>`;
}

function renderBriefMission2FireTable() {
    return `
        <table class="brief-time-table">
            <thead><tr><th>火點</th><th>加分</th></tr></thead>
            <tbody>
                <tr><td>火點 A（最優先）</td><td>+200</td></tr>
                <tr><td>火點 B</td><td>+150</td></tr>
                <tr><td>火點 C</td><td>+125</td></tr>
                <tr><td>火點 D</td><td>+100</td></tr>
                <tr><td>全數撲滅 4/4</td><td>+200</td></tr>
            </tbody>
        </table>`;
}


function renderBriefMapLegend(items) {
    return `
        <ul class="brief-legend">
            ${items.map(item => `
                <li class="brief-legend-item">
                    <span class="brief-legend-swatch ${item.swatchClass}" aria-hidden="true">${item.glyph || ''}</span>
                    <span class="brief-legend-copy">
                        <strong>${item.title}</strong>
                        <span>${item.desc}</span>
                    </span>
                </li>
            `).join('')}
        </ul>`;
}

function renderBriefMission1Legend() {
    return renderBriefMapLegend([
        { swatchClass: 'brief-legend-swatch--start', glyph: '↓', title: '起點', desc: '藍色懸浮箭嘴；木製平台起飛' },
        { swatchClass: 'brief-legend-swatch--beacon', glyph: '', title: '巡檢回報點', desc: '青色光球＋光環；懸停約 3 秒回報' },
        { swatchClass: 'brief-legend-swatch--end', glyph: '↓', title: '終點', desc: '綠色路面區＋綠色懸浮箭嘴；須降落交班' }
    ]);
}

function renderBriefMission2Legend() {
    return renderBriefMapLegend([
        { swatchClass: 'brief-legend-swatch--start', glyph: '↓', title: '起點（基地）', desc: '藍色懸浮箭嘴；木製起降平台' },
        { swatchClass: 'brief-legend-swatch--end', glyph: '↓', title: '終點（受災區）', desc: '綠色懸浮箭嘴；須降落結算成績' },
        { swatchClass: 'brief-legend-swatch--fire', glyph: 'A', title: '火點 A/B/C/D', desc: '火焰上方浮動標籤；金色 A 最優先（+200）' },
        { swatchClass: 'brief-legend-swatch--water', glyph: '', title: '水源', desc: '深藍色圓形水池；Collect Water 裝水' },
        { swatchClass: 'brief-legend-swatch--charge', glyph: '⚡', title: '充電站', desc: '黃色六角平台＋光環；hover ≥3 秒 +15 行（每站一次）' },
        { swatchClass: 'brief-legend-swatch--forest', glyph: '', title: '樹林／岩石', desc: '不可穿越；須繞路規劃' }
    ]);
}

function showMissionBriefing(missionId) {
    console.log("showMissionBriefing called with:", missionId, "active:", activeMissionId);
    
    // 如果沒有傳入 missionId，嘗試使用 activeMissionId
    const targetMissionId = missionId || activeMissionId;
    
    if (!targetMissionId) {
        console.warn("No target mission ID found");
        return;
    }

    _modalFocusBriefingReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const briefingModal = document.getElementById('mission-briefing');
    const title = document.getElementById('briefing-title');
    const content = document.getElementById('briefing-content');
    const icon = document.getElementById('briefing-icon');
    
    if (!briefingModal || !title || !content) return;
    
    if (targetMissionId === 'challenge') {
        title.textContent = '挑戰模式：隨機迷宮';
        icon.textContent = '🔥';
        content.innerHTML = `
            <p class="brief-lead">
                每次生成隨機 13×13 迷宮，用感應器積木自動導航至終點。
                <span class="brief-lead-en">Random 13×13 maze — navigate with sensor blocks.</span>
            </p>
            <h4 class="brief-section-title">提示 Tips</h4>
            <ul class="brief-tips">
                <li>按「執行」鎖定迷宮並開始計時。</li>
                <li>建築不可翻越；建議用前／左／右距離感測搭配轉向。</li>
            </ul>
        `;
    } else if (targetMissionId == 1) {
        title.textContent = '任務一：坍塌廢墟搜救';
        icon.textContent = '🏙️';
        content.innerHTML = `
            <p class="brief-lead">
                地震後通訊中斷，沿可通行路網把情報從起點送到終點。
                <span class="brief-lead-en">Navigate open streets from start to finish after the quake.</span>
            </p>
            <ol class="brief-steps">
                <li class="brief-step">
                    <span class="brief-step-icon">🛫</span>
                    <span class="brief-step-title">起點</span>
                    <span class="brief-step-sub">藍色箭嘴</span>
                </li>
                <li class="brief-step">
                    <span class="brief-step-icon">📡</span>
                    <span class="brief-step-title">巡檢回報（可選）</span>
                    <span class="brief-step-sub">各 +100</span>
                </li>
                <li class="brief-step">
                    <span class="brief-step-icon">🛬</span>
                    <span class="brief-step-title">終點</span>
                    <span class="brief-step-sub">+200</span>
                </li>
            </ol>
            <h4 class="brief-section-title">地圖圖示 Map Legend</h4>
            ${renderBriefMission1Legend()}
            <h4 class="brief-section-title">計分方式 Scoring</h4>
            <div class="brief-score-chips">
                <div class="brief-score-chip"><strong>+100</strong><span>每處巡檢</span></div>
                <div class="brief-score-chip"><strong>+200</strong><span>去到終點</span></div>
            </div>
            <h4 class="brief-section-title">時間獎 Time Bonus</h4>
            ${renderBriefTimeTierTable()}
            <h4 class="brief-section-title">等級門檻 Grades</h4>
            ${renderBriefGradeGrid(MISSION1_GRADE_TIERS)}
            ${SHOW_MISSION_REFERENCE_ANSWERS ? '<p class="brief-note">參考答案約 1000 分（3 巡檢 + 53 秒，極快段）。</p>' : ''}
            <h4 class="brief-section-title">提示 Tips</h4>
            <ul class="brief-tips">
                <li>巡檢點懸停約 3 秒即回報；須在青色球體上方。</li>
                <li>通訊中繼站 (1,6)｜結構安全掃描點 (5,10)｜環境感測點 (9,1)</li>
                <li>須沿路網飛行，不可翻越建築；禁用「飛至座標」積木。</li>
                <li>終點須用<strong>降落</strong>積木完成，懸停不能結算。</li>
            </ul>
        `;
    } else if (targetMissionId == 2) {
        title.textContent = '任務二：山火智能應對';
        icon.textContent = '🔥';
        content.innerHTML = `
            <p class="brief-lead">
                水箱每次僅 1 次水量，須反覆取水、依優先序撲滅 4 處火點。
                <span class="brief-lead-en">Reload at water sources and fight 4 fires by priority.</span>
            </p>
            <ol class="brief-steps">
                <li class="brief-step">
                    <span class="brief-step-icon">🛫</span>
                    <span class="brief-step-title">基地起飛</span>
                    <span class="brief-step-sub">藍色箭嘴</span>
                </li>
                <li class="brief-step">
                    <span class="brief-step-icon">💧</span>
                    <span class="brief-step-title">取水補給</span>
                    <span class="brief-step-sub">藍色水源</span>
                </li>
                <li class="brief-step">
                    <span class="brief-step-icon">🔥</span>
                    <span class="brief-step-title">滅火（A 最優先）</span>
                    <span class="brief-step-sub">4 處火點</span>
                </li>
                <li class="brief-step">
                    <span class="brief-step-icon">⚡</span>
                    <span class="brief-step-title">充電站（可選）</span>
                    <span class="brief-step-sub">hover 3s +15 行</span>
                </li>
                <li class="brief-step">
                    <span class="brief-step-icon">🛬</span>
                    <span class="brief-step-title">受災區降落</span>
                    <span class="brief-step-sub">結算成績</span>
                </li>
            </ol>
            <h4 class="brief-section-title">地圖圖示 Map Legend</h4>
            ${renderBriefMission2Legend()}
            <h4 class="brief-section-title">電池規則 Battery</h4>
            <div class="brief-score-chips">
                <div class="brief-score-chip"><strong>20 行</strong><span>起飛電量</span></div>
                <div class="brief-score-chip"><strong>1 行</strong><span>每次 move cm</span></div>
                <div class="brief-score-chip"><strong>+15 行</strong><span>每充電站一次</span></div>
            </div>
            <h4 class="brief-section-title">計分方式 Scoring</h4>
            ${renderBriefMission2FireTable()}
            <h4 class="brief-section-title">時間獎 Time Bonus</h4>
            ${renderBriefTimeTierTable(window.MISSION2_TIME_TIERS, '超過 10 分鐘')}
            <h4 class="brief-section-title">等級門檻 Grades</h4>
            ${renderBriefGradeGrid(MISSION2_GRADE_TIERS)}
            <p class="brief-note">須飛至受災區（綠色箭嘴）降落結算；撲滅火點愈多分數愈高，全數撲滅額外 +200。${SHOW_MISSION_REFERENCE_ANSWERS ? '參考路線約 1050 分。' : ''}</p>
            <p class="brief-note">轉向／取水／滅火／起降不計行。連續同方向可合併距離以省電。</p>
            <h4 class="brief-section-title">地圖座標 Map</h4>
            <ul class="brief-tips">
                <li>火點 A (2,12) 最優先 → B (4,10) → C (11,5) → D (12,10)</li>
                <li>水源 (1,4)、(4,8)、(9,7)、(12,3) — 最近的不一定最省路。</li>
                <li>充電站 (3,5)、(6,8)、(10,7) — 每站 hover ≥3 秒補一次。</li>
                <li>格線每格 150 cm；在水源格 Collect、火點格 Release。</li>
            </ul>
        `;
    } else if (targetMissionId === 'practice1') {
        title.textContent = '試用一：坍塌廢墟搜救（入門）';
        icon.textContent = '🧪';
        content.innerHTML = `
            <p class="brief-lead">
                <strong>試用關卡 · 非正式比賽地圖。</strong> 8×8 縮小版，1 處巡檢回報點，機制與任務一相同。
                <span class="brief-lead-en">Practice map — 8×8 intro with one inspection checkpoint.</span>
            </p>
            <ol class="brief-steps">
                <li class="brief-step"><span class="brief-step-icon">🛫</span><span class="brief-step-title">起點</span><span class="brief-step-sub">藍色箭嘴</span></li>
                <li class="brief-step"><span class="brief-step-icon">📡</span><span class="brief-step-title">巡檢（可選）</span><span class="brief-step-sub">+100</span></li>
                <li class="brief-step"><span class="brief-step-icon">🛬</span><span class="brief-step-title">終點降落</span><span class="brief-step-sub">+200</span></li>
            </ol>
            <h4 class="brief-section-title">等級門檻 Grades</h4>
            ${renderBriefGradeGrid(PRACTICE1_GRADE_TIERS)}
            <h4 class="brief-section-title">提示 Tips</h4>
            <ul class="brief-tips">
                <li>正式競賽任務為 14×14 完整地圖；此關卡供入門練習。</li>
                <li>須沿路網飛行並在 Bravo 格降落結算。</li>
            </ul>
        `;
    } else if (targetMissionId === 'practice2') {
        title.textContent = '試用二：山火智能應對（入門）';
        icon.textContent = '🧪';
        content.innerHTML = `
            <p class="brief-lead">
                <strong>試用關卡 · 非正式比賽地圖。</strong> 8×8 縮小版，2 處火點、1 水源、1 充電站。
                <span class="brief-lead-en">Practice map — 8×8 intro with 2 fires.</span>
            </p>
            <ol class="brief-steps">
                <li class="brief-step"><span class="brief-step-icon">🛫</span><span class="brief-step-title">基地起飛</span></li>
                <li class="brief-step"><span class="brief-step-icon">💧</span><span class="brief-step-title">取水</span></li>
                <li class="brief-step"><span class="brief-step-icon">🔥</span><span class="brief-step-title">撲滅 2 處火點</span></li>
                <li class="brief-step"><span class="brief-step-icon">⚡</span><span class="brief-step-title">充電站（可選）</span></li>
                <li class="brief-step"><span class="brief-step-icon">🛬</span><span class="brief-step-title">受災區降落</span><span class="brief-step-sub">結算成績</span></li>
            </ol>
            <h4 class="brief-section-title">等級門檻 Grades</h4>
            ${renderBriefGradeGrid(PRACTICE2_GRADE_TIERS)}
            <h4 class="brief-section-title">提示 Tips</h4>
            <ul class="brief-tips">
                <li>火點 A (3,6) 優先於 B (5,5)；水源在 (1,4)。</li>
                <li>須飛至受災區降落結算；全數撲滅 2/2 可額外 +200 分。</li>
                <li>正式競賽為 14×14、4 火點。</li>
            </ul>
        `;
    }
    
    briefingModal.style.display = 'flex';
    // 添加 active class 以觸發動畫，並將焦點移至主要按鈕（模態無障礙）
    setTimeout(() => {
        briefingModal.classList.add('active');
        const ok = document.getElementById('briefing-ok-btn');
        try {
            if (ok && typeof ok.focus === 'function') ok.focus();
        } catch (_) { /* ignore */ }
    }, 10);
}

// 關閉任務簡報
function closeBriefing() {
    const briefing = document.getElementById('mission-briefing');
    if (briefing) {
        briefing.classList.remove('active');
        briefing.style.display = 'none';
    }
    // 任務說明主要由頂列 #mission-briefing-btn 開啟；若焦點來源無法還原則回到該鈕。
    _restoreModalFocus(_modalFocusBriefingReturn, 'mission-briefing-btn');
    _modalFocusBriefingReturn = null;
}

// 顯示主選單
function showMainMenu() {
    document.getElementById('main-menu').style.display = 'flex';
    document.getElementById('mission-select-menu').style.display = 'none';
    const practiceMenu = document.getElementById('practice-select-menu');
    if (practiceMenu) practiceMenu.style.display = 'none';
    document.getElementById('game-interface').style.display = 'none';
    
    // 初始化主菜單 3D 預覽（等待 DOM 更新和 Three.js 載入）
    setTimeout(() => {
        if (typeof THREE !== 'undefined') {
            initMainMenuPreview();
        } else {
            console.warn('⚠️ THREE.js not loaded yet, retrying...');
            setTimeout(() => {
                if (typeof THREE !== 'undefined') {
                    initMainMenuPreview();
                } else {
                    console.error('❌ THREE.js failed to load');
                }
            }, 500);
        }
    }, 200);
}

// 顯示任務選擇畫面
function showMissionSelect() {
    lastMissionMenu = 'competition';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('mission-select-menu').style.display = 'flex';
    const practiceMenu = document.getElementById('practice-select-menu');
    if (practiceMenu) practiceMenu.style.display = 'none';
    document.getElementById('game-interface').style.display = 'none';
    
    // 清理主菜單預覽
    cleanupMainMenuPreview();
    
    // 更新任務預覽場景
    updateMissionPreview();
}

function showPracticeSelect() {
    lastMissionMenu = 'practice';
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('mission-select-menu').style.display = 'none';
    document.getElementById('practice-select-menu').style.display = 'flex';
    document.getElementById('game-interface').style.display = 'none';
    cleanupMainMenuPreview();
    updatePracticePreview();
}

// 啟動任務
async function startMission(missionId) {
    if (window.isDroneSimFileOrigin && window.isDroneSimFileOrigin()) {
        console.warn('Drone Simulator：請用本機 HTTP 開啟（勿雙擊 index.html）。畫面上方應有說明。');
        return;
    }

    const isCompetitionMission = missionId === 1 || missionId === 2 || missionId === '1' || missionId === '2';

    if (missionId === 'practice1' || missionId === 'practice2') {
        lastMissionMenu = 'practice';
    } else if (isCompetitionMission) {
        lastMissionMenu = 'competition';
    }

    currentGameMode = 'mission';
    
    if (missionId === 'practice1') {
        activeMissionId = 'practice1';
    } else if (missionId === 'practice2') {
        activeMissionId = 'practice2';
    } else if (missionId === 'training' || missionId === 1 || missionId === '1') {
        activeMissionId = 1;
    } else if (missionId === 2 || missionId === '2') {
        activeMissionId = 2;
    } else {
        activeMissionId = null;
    }
    console.log("Mission started, activeMissionId set to:", activeMissionId);

    closeBriefing();

    // 先顯示遊戲界面
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('mission-select-menu').style.display = 'none';
    const practiceMenu = document.getElementById('practice-select-menu');
    if (practiceMenu) practiceMenu.style.display = 'none';
    const gameInterface = document.getElementById('game-interface');
    gameInterface.style.display = 'flex';
    
    // 確保積木區默認隱藏，並重置樣式
    const blocklyPanel = document.getElementById('blocklyDiv');
    const mainContainer = document.querySelector('.main-container');
    const toggleBtn = document.getElementById('toggle-blockly-btn');
    if (blocklyPanel && mainContainer && toggleBtn) {
        blocklyPanel.classList.remove('visible');
        mainContainer.classList.add('blockly-hidden');
        // 清除之前設置的寬度樣式，確保使用默認值
        blocklyPanel.style.flex = '';
        blocklyPanel.style.width = '';
        blocklyPanel.style.transition = '';
        toggleBtn.textContent = '📦 顯示積木區';
        setBlocklyToggleA11y(false);
    }
    
    // 強制瀏覽器重新計算佈局
    gameInterface.offsetHeight; // 觸發重排
    
    // 等待界面渲染完成（增加等待時間）
    await new Promise(resolve => setTimeout(resolve, 200));
    initGameUiLayoutRefresh();
    scheduleGameUILayoutRefresh();
    
    setTimeout(() => maybeShowBlocklyDiscoverToast(), 400);
    
    // 注意：Blockly 現在只在用戶點擊顯示按鈕時才初始化
    
    // 確保 3D 引擎已初始化
    if (typeof init3D === 'function') {
        const canvasContainer = document.getElementById('canvas-container');
        
        if (!canvasContainer) {
            console.error("canvas-container element not found");
            return;
        }
        
        // 使用輔助函數等待容器準備好
        const isReady = await waitForElementSize(canvasContainer, 30);
        
        if (!isReady) {
            console.error("Canvas container not ready after retries");
            console.error("Container element:", canvasContainer);
            console.error("Container computed style:", window.getComputedStyle(canvasContainer));
            console.error("Parent container:", canvasContainer.parentElement);
            return;
        }
        
        if (!canvasContainer.querySelector('canvas')) {
            console.log("Initializing 3D engine...");
            // 等待 init3D 完成（它是异步函数）
            await init3D();
            console.log("3D engine initialized successfully");
            
            // 初始化後，再次更新大小以確保使用正確的容器尺寸
            await new Promise(resolve => setTimeout(resolve, 100));
            if (typeof onWindowResize === 'function') {
                onWindowResize();
                console.log("Resized renderer after initialization");
            }
        } else {
            console.log("3D engine already initialized");
            // 即使已初始化，也更新大小
            if (typeof onWindowResize === 'function') {
                onWindowResize();
            }
        }
    }
    
    // 等待 environmentGroup 創建完成
    let retries = 0;
    while (retries < 20 && (typeof environmentGroup === 'undefined' || !environmentGroup)) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retries++;
    }
    
    if (typeof environmentGroup === 'undefined' || !environmentGroup) {
        console.error("environmentGroup not initialized");
        return;
    }
    
    // 根據任務 ID 設置場景
    if (missionId === 'practice1') {
        changeScene('tunnel_practice');
        logToConsole('🧪 試用一：8×8 坍塌廢墟搜救（1 巡檢點 · 入門練習）');
        logToConsole('💡 機制與正式任務一相同，地圖較小。');
    } else if (missionId === 'practice2') {
        changeScene('city_practice');
        logToConsole('🧪 試用二：8×8 山火智能應對（2 火點 · 入門練習）');
        logToConsole('💡 機制與正式任務二相同；須飛至受災區降落結算。');
    } else if (missionId === 'training' || missionId === 1 || missionId === '1') {
        changeScene('tunnel');
        logToConsole('📡 震後通訊中斷。請從指揮所 Alpha 起飛，沿可通行路網前往疏散集結區 Bravo。');
        logToConsole('💡 支路巡檢回報點（通訊／結構／環境）可選完成，停留約 3 秒即上傳資料。');
    } else if (missionId === 2 || missionId === '2') {
        changeScene('city');
        logToConsole('🔥 14×14 山火場：滿電 20 行移動積木；合併 go forward 距離可節省電量。');
        logToConsole('💡 須飛至受災區（綠箭嘴）降落結算；全數撲滅可額外 +200。');
    } else {
        changeScene('free');
    }
    
    // 場景切換後，再次確保渲染器大小正確
    await new Promise(resolve => setTimeout(resolve, 100));
    if (typeof onWindowResize === 'function') {
        onWindowResize();
    }

    if (shouldAutoShowMissionBriefing(missionId)) {
        showMissionBriefing(activeMissionId);
    }

    onBlocklyContextChanged();
}

function shouldAutoShowMissionBriefing(missionId) {
    return missionId === 1 || missionId === 2 || missionId === '1' || missionId === '2'
        || missionId === 'practice1' || missionId === 'practice2';
}

// 啟動自由遊戲
async function startFreePlay() {
    if (window.isDroneSimFileOrigin && window.isDroneSimFileOrigin()) {
        console.warn('Drone Simulator：請用本機 HTTP 開啟（勿雙擊 index.html）。畫面上方應有說明。');
        return;
    }
    currentGameMode = 'freeplay';
    // 先顯示遊戲界面
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('mission-select-menu').style.display = 'none';
    const gameInterface = document.getElementById('game-interface');
    gameInterface.style.display = 'flex';
    
    // 確保積木區默認隱藏，並重置樣式
    const blocklyPanel = document.getElementById('blocklyDiv');
    const mainContainer = document.querySelector('.main-container');
    const toggleBtn = document.getElementById('toggle-blockly-btn');
    if (blocklyPanel && mainContainer && toggleBtn) {
        blocklyPanel.classList.remove('visible');
        mainContainer.classList.add('blockly-hidden');
        // 清除之前設置的寬度樣式，確保使用默認值
        blocklyPanel.style.flex = '';
        blocklyPanel.style.width = '';
        blocklyPanel.style.transition = '';
        toggleBtn.textContent = '📦 顯示積木區';
        setBlocklyToggleA11y(false);
    }
    
    // 強制瀏覽器重新計算佈局
    gameInterface.offsetHeight; // 觸發重排
    
    // 等待界面渲染完成
    await new Promise(resolve => setTimeout(resolve, 200));
    initGameUiLayoutRefresh();
    scheduleGameUILayoutRefresh();
    
    setTimeout(() => maybeShowBlocklyDiscoverToast(), 400);
    
    // 確保 3D 引擎已初始化
    if (typeof init3D === 'function') {
        const canvasContainer = document.getElementById('canvas-container');
        
        if (!canvasContainer) {
            console.error("canvas-container element not found");
            return;
        }
        
        const isReady = await waitForElementSize(canvasContainer, 30);
        
        if (!isReady) {
            console.error("Canvas container not ready after retries");
            return;
        }
        
        if (!canvasContainer.querySelector('canvas')) {
            console.log("Initializing 3D engine...");
            await init3D();
            console.log("3D engine initialized successfully");
            
            await new Promise(resolve => setTimeout(resolve, 100));
            if (typeof onWindowResize === 'function') {
                onWindowResize();
            }
        } else {
            if (typeof onWindowResize === 'function') {
                onWindowResize();
            }
        }
    }
    
    // 等待 environmentGroup 創建完成
    let retries = 0;
    while (retries < 20 && (typeof environmentGroup === 'undefined' || !environmentGroup)) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retries++;
    }
    
    if (typeof environmentGroup === 'undefined' || !environmentGroup) {
        console.error("environmentGroup not initialized");
        return;
    }
    
    changeScene('free');
    
    // 場景切換後，再次確保渲染器大小正確
    await new Promise(resolve => setTimeout(resolve, 200));
    if (typeof onWindowResize === 'function') {
        onWindowResize();
        // 再次調整 Blockly 大小
        if (workspace && typeof Blockly !== 'undefined') {
            Blockly.svgResize(workspace);
        }
    }

    onBlocklyContextChanged();
}

// 顯示基地營
function showBasecamp() {
    showAppMessage({
        variant: 'info',
        title: 'BASECAMP',
        body: '此功能尚在開發中。',
        autoHideMs: 6000,
        focusClose: false
    });
}

// 顯示您的任務
function showYourMissions() {
    showAppMessage({
        variant: 'info',
        title: 'YOUR MISSIONS',
        body: '此功能尚在開發中。',
        autoHideMs: 6000,
        focusClose: false
    });
}

// 載入場景
function showLoadScene() {
    showAppMessage({
        variant: 'info',
        title: 'LOAD SCENE',
        body: '此功能尚在開發中。',
        autoHideMs: 6000,
        focusClose: false
    });
}

// 退出遊戲
function quitGame() {
    showAppConfirm('確定要退出遊戲嗎？', { title: '退出遊戲', confirmLabel: '退出', cancelLabel: '取消' }).then((ok) => {
        if (ok) window.close();
    });
}

// 初始化執行控制（頁面加載時）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExecutionControls);
} else {
    initExecutionControls();
}

function initExecutionControls() {
    initAppFeedbackUI();
}

// 主菜單 3D 預覽場景變數
let mainMenuScene = null;
let mainMenuCamera = null;
let mainMenuRenderer = null;
let mainMenuDrone = null;
let mainMenuAnimationId = null;

// 初始化主菜單 3D 預覽
async function initMainMenuPreview() {
    const previewContainer = document.getElementById('main-menu-preview');
    if (!previewContainer) {
        console.error('❌ main-menu-preview container not found');
        return;
    }

    if (window.isDroneSimFileOrigin && window.isDroneSimFileOrigin()) {
        return;
    }
    
    if (typeof THREE === 'undefined') {
        console.error('❌ THREE.js is not loaded');
        return;
    }
    
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('❌ GLTFLoader is not loaded');
        return;
    }

    console.log('🚀 Initializing main menu 3D preview...');

    // 如果已經初始化，先清理
    if (mainMenuRenderer) {
        cleanupMainMenuPreview();
    }

    // 等待容器有尺寸
    let width = previewContainer.clientWidth;
    let height = previewContainer.clientHeight;
    
    if (width === 0 || height === 0) {
        console.warn('⚠️ Container size is 0, waiting...');
        await new Promise(resolve => setTimeout(resolve, 200));
        width = previewContainer.clientWidth || 800;
        height = previewContainer.clientHeight || 600;
    }
    
    console.log(`📐 Container size: ${width}x${height}`);

    // 創建場景
    mainMenuScene = new THREE.Scene();
    
    // 使用與主菜單一致的背景顏色（透明，讓 CSS 背景顯示）
    // 主菜單背景：linear-gradient(135deg, #e0e7ff 0%, #f0f4ff 50%, #ffffff 100%)
    // 使用淺色背景，讓 3D 模型更突出
    mainMenuScene.background = new THREE.Color(0xe0e7ff);
    
    // 如果需要使用圖片背景，可以取消下面的註釋
    // const textureLoader = new THREE.TextureLoader();
    // textureLoader.load('assets/backgrounds/preview-bg-gemini.png', (texture) => {
    //     mainMenuScene.background = texture;
    //     console.log('✅ Background image loaded');
    // }, undefined, (error) => {
    //     console.warn('⚠️ Failed to load background image, using default color:', error);
    //     mainMenuScene.background = new THREE.Color(0xe0e7ff);
    // });

    // 創建相機
    mainMenuCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    mainMenuCamera.position.set(0, 2, 8);
    mainMenuCamera.lookAt(0, 0, 0);

    // 創建渲染器（確保正確的顏色輸出）
    mainMenuRenderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: false,  // 改為 false，使用背景色
        powerPreference: "high-performance"
    });
    mainMenuRenderer.setSize(width, height);
    mainMenuRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mainMenuRenderer.shadowMap.enabled = true;
    mainMenuRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 確保正確的顏色空間
    if (mainMenuRenderer.outputEncoding !== undefined) {
        mainMenuRenderer.outputEncoding = THREE.sRGBEncoding;
    }
    previewContainer.appendChild(mainMenuRenderer.domElement);

    // 添加燈光（增強燈光以突出模型顏色）
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);  // 增強環境光
    mainMenuScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);  // 增強主光源
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    mainMenuScene.add(directionalLight);

    // 添加補光以突出顏色
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 5, -5);
    fillLight.userData.isFillLight = true;  // 標記為補光，用於動畫
    mainMenuScene.add(fillLight);

    const pointLight = new THREE.PointLight(0x667eea, 0.8);  // 增強彩色光源
    pointLight.position.set(-5, 5, 5);
    pointLight.userData.originalPosition = { x: -5, y: 5, z: 5 };  // 保存原始位置
    mainMenuScene.add(pointLight);
    
    // 添加額外的彩色光源
    const accentLight = new THREE.PointLight(0x764ba2, 0.6);
    accentLight.position.set(5, 3, -5);
    accentLight.userData.originalPosition = { x: 5, y: 3, z: -5 };  // 保存原始位置
    mainMenuScene.add(accentLight);

    // 加載無人機模型
    console.log('📦 Loading drone model...');
    try {
        const loader = new THREE.GLTFLoader();
        loader.load(
            'assets/models/drone.glb',
            (gltf) => {
                console.log('✅ Drone model loaded successfully');
                const droneModel = gltf.scene.clone();
                
                // 計算邊界框
                const bbox = new THREE.Box3().setFromObject(droneModel);
                const size = bbox.getSize(new THREE.Vector3());
                const center = bbox.getCenter(new THREE.Vector3());
                
                console.log(`📏 Model size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
                
                // 縮放模型
                const targetSize = 3;
                const scaleFactor = targetSize / Math.max(size.x, size.y, size.z);
                droneModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
                
                // 旋轉模型
                droneModel.rotation.y = -Math.PI / 2;
                
                // 調整位置
                droneModel.position.set(-center.x * scaleFactor, -center.y * scaleFactor, -center.z * scaleFactor);
                
                // 設置材質（使用與遊戲中相同的顏色）
                const propMeshes = [];  // 收集螺旋槳網格
                const bodyMeshes = [];  // 收集機身網格
                
                droneModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        const meshName = child.name.toLowerCase();
                        const isProp = meshName.includes('prop') || meshName.includes('propeller');
                        const isBody = !isProp && (meshName.includes('body') || meshName.includes('frame') || meshName === '' || meshName.includes('guard'));
                        
                        if (isProp) {
                            propMeshes.push(child);
                        } else if (isBody) {
                            bodyMeshes.push(child);
                        }
                        
                        if (child.material) {
                            // 如果是數組材質，處理每個材質
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            
                            materials.forEach((mat) => {
                                // 根據網格類型設置顏色（與遊戲中一致）
                                if (isProp) {
                                    // 螺旋槳：稍後根據位置設置紅色或黑色
                                    mat.color.setHex(0x111111);  // 默認深色
                                } else {
                                    // 機身和框架：深灰色（與遊戲中一致）
                                    mat.color.setHex(0x222222);
                                }
                                
                                // 調整材質屬性
                                mat.roughness = 0.5;
                                mat.metalness = 0.5;
                                mat.needsUpdate = true;
                            });
                            
                            // 如果材質是數組，更新引用
                            if (Array.isArray(child.material)) {
                                child.material = materials;
                            }
                        } else {
                            // 如果沒有材質，創建一個
                            const color = isProp ? 0x111111 : 0x222222;
                            child.material = new THREE.MeshStandardMaterial({
                                color: color,
                                roughness: 0.5,
                                metalness: 0.5
                            });
                        }
                    }
                });
                
                // 設置螺旋槳顏色（與遊戲中一致：前兩個紅色，後兩個黑色）
                if (propMeshes.length > 0) {
                    // 根據位置排序螺旋槳
                    propMeshes.sort((a, b) => {
                        const aZ = a.position.z;
                        const bZ = b.position.z;
                        return aZ - bZ;  // Z值小的在前（前方）
                    });
                    
                    propMeshes.forEach((prop, index) => {
                        const materials = Array.isArray(prop.material) ? prop.material : [prop.material];
                        materials.forEach((mat) => {
                            // 前兩個（Z值較小）設為紅色，後兩個（Z值較大）設為黑色
                            if (index < 2) {
                                mat.color.setHex(0xff0000);  // 紅色（前方）
                            } else {
                                mat.color.setHex(0x111111);  // 黑色（後方）
                            }
                            mat.needsUpdate = true;
                        });
                    });
                }
                
                mainMenuDrone = new THREE.Group();
                mainMenuDrone.add(droneModel);
                mainMenuScene.add(mainMenuDrone);
                
                console.log('✅ Drone added to scene');
                
                // 開始動畫
                animateMainMenuPreview();
            },
            (progress) => {
                // 載入進度
                if (progress.total > 0) {
                    const percent = (progress.loaded / progress.total) * 100;
                    console.log(`📥 Loading: ${percent.toFixed(1)}%`);
                }
            },
            (error) => {
                console.warn('⚠️ Cannot load drone model, using default geometry:', error);
                createDefaultDroneModel();
                animateMainMenuPreview();
            }
        );
    } catch (error) {
        console.error('❌ Error loading model, using default geometry:', error);
        createDefaultDroneModel();
        animateMainMenuPreview();
    }

    // 處理窗口大小變化
    const handleResize = () => {
        if (!previewContainer || !mainMenuCamera || !mainMenuRenderer) return;
        const newWidth = previewContainer.clientWidth;
        const newHeight = previewContainer.clientHeight;
        mainMenuCamera.aspect = newWidth / newHeight;
        mainMenuCamera.updateProjectionMatrix();
        mainMenuRenderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);
}

// 創建預設無人機模型（如果 GLB 載入失敗）
function createDefaultDroneModel() {
    console.log('🔧 Creating default drone model...');
    if (!mainMenuScene) {
        console.error('❌ Scene not initialized');
        return;
    }
    
    mainMenuDrone = new THREE.Group();
    
    // 使用與遊戲中相同的顏色
    const frameMat = new THREE.MeshPhongMaterial({ 
        color: 0x222222,  // 深灰色機身（與遊戲中一致）
        flatShading: false,
        shininess: 100,
        specular: 0x222222
    });
    
    // 機身
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 32), frameMat);
    body.castShadow = true;
    body.name = 'body';
    mainMenuDrone.add(body);
    
    // 螺旋槳保護環和螺旋槳（與遊戲中一致：前兩個紅色，後兩個黑色）
    const armConfig = [
        {x: -0.9, z: -0.9, propColor: 0xff0000},  // 前方左
        {x: 0.9, z: -0.9, propColor: 0xff0000},  // 前方右
        {x: -0.9, z: 0.9, propColor: 0x111111},  // 後方左
        {x: 0.9, z: 0.9, propColor: 0x111111}    // 後方右
    ];
    
    armConfig.forEach((pos, index) => {
        // 保護環（深灰色）
        const guard = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 32), frameMat);
        guard.rotation.x = Math.PI / 2;
        guard.position.set(pos.x, 0, pos.z);
        guard.name = 'guard_' + index;
        mainMenuDrone.add(guard);
        
        // 螺旋槳（紅色或黑色）
        const propMat = new THREE.MeshBasicMaterial({
            color: pos.propColor,
            transparent: true,
            opacity: 0.9
        });
        const prop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.8), propMat);
        prop.position.set(pos.x, 0.16, pos.z);
        prop.name = 'prop_' + index;  // 用於動畫識別
        mainMenuDrone.add(prop);
    });
    
    mainMenuScene.add(mainMenuDrone);
    console.log('✅ Default drone model created with game colors');
}

// 主菜單預覽動畫變數
let animationTime = 0;
let cameraOrbitRadius = 8;
let cameraOrbitAngle = 0;
let flightPathPhase = 0;  // 飛行路徑階段（0-1）

// 飛行路徑類型
const FLIGHT_PATTERNS = {
    FIGURE_8: 'figure8',      // 8字形
    CIRCLE: 'circle',          // 圓形
    WAVE: 'wave',              // 波浪形
    SPIRAL: 'spiral',          // 螺旋形
    SQUARE: 'square'           // 方形
};

let currentFlightPattern = FLIGHT_PATTERNS.FIGURE_8;
let patternChangeTime = 0;

// 計算飛行路徑位置
function calculateFlightPath(time, pattern) {
    const speed = 0.3;  // 飛行速度
    const t = time * speed;
    
    switch(pattern) {
        case FLIGHT_PATTERNS.FIGURE_8:
            // 8字形路徑
            const radius = 1.5;
            const x = Math.sin(t) * radius;
            const z = Math.sin(t * 2) * radius * 0.5;
            const y = Math.sin(t * 1.5) * 0.4 + 0.2;
            return { x, y, z, roll: Math.sin(t * 2) * 0.1, pitch: Math.cos(t) * 0.15 };
            
        case FLIGHT_PATTERNS.CIRCLE:
            // 圓形路徑
            const circleRadius = 1.2;
            const cx = Math.cos(t) * circleRadius;
            const cz = Math.sin(t) * circleRadius;
            const cy = Math.sin(t * 2) * 0.3;
            return { x: cx, y: cy, z: cz, roll: Math.sin(t) * 0.1, pitch: -Math.cos(t) * 0.1 };
            
        case FLIGHT_PATTERNS.WAVE:
            // 波浪形路徑（前後移動 + 上下波動）
            const waveX = Math.sin(t * 0.8) * 1.0;
            const waveZ = t % (Math.PI * 2);
            const waveY = Math.sin(waveZ * 2) * 0.5;
            return { x: waveX, y: waveY, z: Math.cos(waveZ) * 0.8, roll: 0, pitch: Math.sin(waveZ) * 0.2 };
            
        case FLIGHT_PATTERNS.SPIRAL:
            // 螺旋上升/下降
            const spiralRadius = 1.0 + Math.sin(t * 0.5) * 0.3;
            const spiralX = Math.cos(t) * spiralRadius;
            const spiralZ = Math.sin(t) * spiralRadius;
            const spiralY = (t % (Math.PI * 4)) / (Math.PI * 4) * 0.8 - 0.4;
            return { x: spiralX, y: spiralY, z: spiralZ, roll: Math.sin(t) * 0.15, pitch: Math.cos(t) * 0.1 };
            
        case FLIGHT_PATTERNS.SQUARE:
            // 方形路徑
            const squareT = t % (Math.PI * 2);
            let squareX, squareZ;
            if (squareT < Math.PI / 2) {
                squareX = 1.0;
                squareZ = squareT / (Math.PI / 2) * 1.0 - 0.5;
            } else if (squareT < Math.PI) {
                squareX = 1.0 - (squareT - Math.PI / 2) / (Math.PI / 2) * 2.0;
                squareZ = 0.5;
            } else if (squareT < Math.PI * 1.5) {
                squareX = -1.0;
                squareZ = 0.5 - (squareT - Math.PI) / (Math.PI / 2) * 1.0;
            } else {
                squareX = -1.0 + (squareT - Math.PI * 1.5) / (Math.PI / 2) * 2.0;
                squareZ = -0.5;
            }
            const squareY = Math.sin(t * 2) * 0.3;
            return { x: squareX, y: squareY, z: squareZ, roll: 0, pitch: 0 };
            
        default:
            return { x: 0, y: 0, z: 0, roll: 0, pitch: 0 };
    }
}

// 主菜單預覽動畫循環
function animateMainMenuPreview() {
    if (!mainMenuRenderer || !mainMenuScene || !mainMenuCamera) {
        console.warn('⚠️ Cannot animate: renderer, scene, or camera not initialized');
        return;
    }
    
    animationTime += 0.016;  // 假設 60fps
    
    // 每 15 秒切換一次飛行模式
    patternChangeTime += 0.016;
    if (patternChangeTime > 15) {
        patternChangeTime = 0;
        const patterns = Object.values(FLIGHT_PATTERNS);
        const currentIndex = patterns.indexOf(currentFlightPattern);
        currentFlightPattern = patterns[(currentIndex + 1) % patterns.length];
        console.log(`🔄 Switching to flight pattern: ${currentFlightPattern}`);
    }
    
    // 無人機動畫
    if (mainMenuDrone) {
        // 計算飛行路徑
        const flightPath = calculateFlightPath(animationTime, currentFlightPattern);
        
        // 應用位置
        mainMenuDrone.position.x = flightPath.x;
        mainMenuDrone.position.y = flightPath.y;
        mainMenuDrone.position.z = flightPath.z;
        
        // 應用旋轉（根據飛行方向）
        mainMenuDrone.rotation.y += 0.005;  // 慢速自轉
        
        // 根據飛行路徑添加傾斜效果（roll 和 pitch）
        const baseRotationY = mainMenuDrone.rotation.y;
        mainMenuDrone.rotation.z = flightPath.roll;  // 左右傾斜
        mainMenuDrone.rotation.x = flightPath.pitch;  // 前後傾斜
        
        // 螺旋槳旋轉動畫（如果找到螺旋槳）
        mainMenuDrone.traverse((child) => {
            if (child.isMesh) {
                const meshName = child.name.toLowerCase();
                if (meshName.includes('prop') || meshName.includes('propeller')) {
                    child.rotation.y += 0.3;  // 快速旋轉
                }
            }
        });
    }
    
    // 相機動畫（跟隨無人機，但保持一定距離）
    if (mainMenuDrone) {
        // 相機跟隨無人機，但保持相對位置
        const followDistance = 6;
        const followHeight = 3;
        
        // 計算相機應該在的位置（在無人機後方和上方）
        const dronePos = mainMenuDrone.position;
        const cameraOffsetX = Math.sin(mainMenuDrone.rotation.y) * followDistance;
        const cameraOffsetZ = Math.cos(mainMenuDrone.rotation.y) * followDistance;
        
        const targetCameraX = dronePos.x - cameraOffsetX;
        const targetCameraZ = dronePos.z - cameraOffsetZ;
        const targetCameraY = dronePos.y + followHeight;
        
        // 平滑移動相機（使用線性插值）
        const lerpFactor = 0.05;
        mainMenuCamera.position.x += (targetCameraX - mainMenuCamera.position.x) * lerpFactor;
        mainMenuCamera.position.y += (targetCameraY - mainMenuCamera.position.y) * lerpFactor;
        mainMenuCamera.position.z += (targetCameraZ - mainMenuCamera.position.z) * lerpFactor;
        
        // 相機始終看向無人機
        mainMenuCamera.lookAt(dronePos.x, dronePos.y, dronePos.z);
    } else {
        // 如果沒有無人機，使用軌道動畫
        cameraOrbitAngle += 0.003;
        const cameraX = Math.cos(cameraOrbitAngle) * cameraOrbitRadius;
        const cameraZ = Math.sin(cameraOrbitAngle) * cameraOrbitRadius;
        const cameraY = 2 + Math.sin(animationTime * 0.5) * 0.5;
        
        mainMenuCamera.position.set(cameraX, cameraY, cameraZ);
        mainMenuCamera.lookAt(0, 0, 0);
    }
    
    // 燈光動畫（讓燈光輕微移動，增加動態感）
    if (mainMenuScene.children) {
        mainMenuScene.children.forEach((child) => {
            if (child.type === 'PointLight') {
                // 點光源輕微移動
                const lightAngle = animationTime * 0.4;
                if (child.userData.originalPosition) {
                    const orig = child.userData.originalPosition;
                    child.position.x = orig.x + Math.sin(lightAngle) * 1;
                    child.position.z = orig.z + Math.cos(lightAngle) * 1;
                }
            } else if (child.type === 'DirectionalLight' && child.userData.isFillLight) {
                // 補光輕微移動
                const lightAngle = animationTime * 0.3;
                child.position.x = Math.cos(lightAngle) * 5;
                child.position.z = Math.sin(lightAngle) * 5;
            }
        });
    }
    
    mainMenuRenderer.render(mainMenuScene, mainMenuCamera);
    mainMenuAnimationId = requestAnimationFrame(animateMainMenuPreview);
}

// 清理主菜單預覽
function cleanupMainMenuPreview() {
    if (mainMenuAnimationId) {
        cancelAnimationFrame(mainMenuAnimationId);
        mainMenuAnimationId = null;
    }
    
    if (mainMenuRenderer) {
        const previewContainer = document.getElementById('main-menu-preview');
        if (previewContainer && mainMenuRenderer.domElement) {
            previewContainer.removeChild(mainMenuRenderer.domElement);
        }
        mainMenuRenderer.dispose();
        mainMenuRenderer = null;
    }
    
    mainMenuScene = null;
    mainMenuCamera = null;
    mainMenuDrone = null;
}

const MISSION_PREVIEW_META = {
    1: { caption: '任務一：坍塌廢墟搜救' },
    2: { caption: '任務二：山火智能應對' }
};

const PRACTICE_PREVIEW_META = {
    practice1: { caption: '試用一：坍塌廢墟搜救（8×8 · 1 巡檢點）', imgIndex: 1 },
    practice2: { caption: '試用二：山火智能應對（8×8 · 2 火點）', imgIndex: 2 }
};

function setPracticePreview(missionId) {
    const meta = PRACTICE_PREVIEW_META[missionId];
    if (!meta) return;

    document.querySelectorAll('#practice-preview .mission-preview__img').forEach(img => {
        img.classList.toggle('mission-preview__img--active', Number(img.id.replace('practice-preview-img-', '')) === meta.imgIndex);
    });

    document.querySelectorAll('#practice-select-menu .mission-btn[data-mission-preview]').forEach(btn => {
        btn.classList.toggle('mission-btn--active', btn.dataset.missionPreview === missionId);
    });

    const caption = document.getElementById('practice-preview-caption');
    if (caption) caption.textContent = meta.caption;
}

function updatePracticePreview() {
    setPracticePreview('practice1');
}

function setMissionPreview(missionId) {
    const id = Number(missionId);
    if (!MISSION_PREVIEW_META[id]) return;

    document.querySelectorAll('#mission-preview .mission-preview__img').forEach(img => {
        img.classList.toggle('mission-preview__img--active', Number(img.id.replace('mission-preview-img-', '')) === id);
    });

    document.querySelectorAll('#mission-select-menu .mission-btn[data-mission-preview]').forEach(btn => {
        btn.classList.toggle('mission-btn--active', Number(btn.dataset.missionPreview) === id);
    });

    const caption = document.getElementById('mission-preview-caption');
    if (caption) caption.textContent = MISSION_PREVIEW_META[id].caption;
}

function updateMissionPreview() {
    setMissionPreview(1);
}

// 【關鍵修正】最後必須呼叫 init3D() 來啟動 simulator.js 裡的場景
// 確保 DOM 載入完成後執行
// --- 任務結算彈窗功能（含模態無障礙：焦點、Esc、還原觸發點）---
/** 關閉模態前保存的焦點，供還原（HTMLElement 或 null） */
let _modalFocusResultReturn = null;
let _modalFocusBriefingReturn = null;

function _isUsableFocusReturn(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el === document.body || el === document.documentElement) return false;
    return true;
}

function _isModalOverlayVisible(el) {
    if (!el) return false;
    const st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
}

/** 關閉模態後還原焦點；若保存點不適用則使用 fallbackId 對應元素 */
function _restoreModalFocus(saved, fallbackId) {
    requestAnimationFrame(() => {
        if (_isUsableFocusReturn(saved)) {
            try {
                saved.focus();
                return;
            } catch (_) { /* ignore */ }
        }
        const fb = document.getElementById(fallbackId);
        if (fb && typeof fb.focus === 'function') {
            try {
                fb.focus();
            } catch (_) { /* ignore */ }
        }
    });
}

document.addEventListener('keydown', function onModalEscapeKeydown(e) {
    if (e.key !== 'Escape') return;
    const appConfirm = document.getElementById('app-confirm-modal');
    if (appConfirm && !appConfirm.hasAttribute('hidden')) {
        e.preventDefault();
        e.stopPropagation();
        finishAppConfirm(false);
        return;
    }
    const briefing = document.getElementById('mission-briefing');
    const result = document.getElementById('result-modal');
    const resultShown = result && _isModalOverlayVisible(result);
    const briefingShown = briefing && _isModalOverlayVisible(briefing);
    if (!resultShown && !briefingShown) return;
    e.preventDefault();
    e.stopPropagation();
    if (resultShown) {
        window.closeResultModal();
    } else {
        closeBriefing();
    }
}, true);

window.showResultModal = function(data) {
    _modalFocusResultReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    console.log("🏆 顯示結算彈窗:", data);
    logToConsole("📊 任務完成！正在顯示成績單...");
    
    // 填寫數據
    const elBeacons = document.getElementById('res-beacons');
    const elBeaconsScore = document.getElementById('res-beacons-score');
    const elExitScore = document.getElementById('res-exit-score');
    const elRow1Label = document.getElementById('res-row1-label');
    const elRow2Label = document.getElementById('res-row2-label');
    const elRow2Status = document.getElementById('res-row2-status');
    const elTime = document.getElementById('res-time');
    const elTimeBonus = document.getElementById('res-time-bonus');
    const elTotal = document.getElementById('res-total');

    const isMission1 = data.mission === 1
        || (isTunnelMissionScene() && data.mission !== 2);
    const isMission2 = data.mission === 2
        || (isCityMissionScene() && data.mission !== 1);

    if (elRow1Label) {
        elRow1Label.textContent = data.row1Label || (isMission2 ? '撲滅火點' : '巡檢回報 (Inspections)');
    }
    if (elRow2Label) {
        elRow2Label.textContent = data.row2Label || (isMission2 ? '全數撲滅' : '抵達終點');
    }
    const requiredBeacons = typeof getRequiredBeacons === 'function' ? getRequiredBeacons() : 3;
    const requiredFires = typeof getRequiredFires === 'function' ? getRequiredFires() : 4;
    const isPractice = !!data.isPractice || activeMissionId === 'practice1' || activeMissionId === 'practice2';

    if (elBeacons) {
        elBeacons.innerText = data.row1Count
            || (isMission2 ? `${data.beacons ?? 0} / ${requiredFires}` : `${data.beacons ?? 0} / ${requiredBeacons}`);
    }
    if (elBeaconsScore) elBeaconsScore.innerText = `+${data.row1Score ?? data.beaconsScore ?? 0}`;
    if (elRow2Status) elRow2Status.innerText = data.row2Status || 'YES';
    if (elExitScore) elExitScore.innerText = `+${data.row2Score ?? data.exitScore ?? 0}`;
    if (elTime) elTime.innerText = data.timeTierLabel ? `${data.time}s · ${data.timeTierLabel}` : `${data.time}s`;
    if (elTimeBonus) elTimeBonus.innerText = `+${data.timeBonus}`;
    if (elTotal) elTotal.innerText = data.total;

    const gradeBlock = document.getElementById('res-grade-block');
    const gradeBadge = document.getElementById('res-grade-badge');
    const gradeDesc = document.getElementById('res-grade-desc');
    if (gradeBlock && gradeBadge && gradeDesc) {
        let grade = null;
        if (isPractice && isMission2 && typeof getPractice2Grade === 'function') {
            grade = getPractice2Grade(data.total);
            gradeDesc.textContent = `${grade.desc}（試用門檻：一等 ≥550｜二等 450–549｜三等 400–449）`;
        } else if (isPractice && isMission1 && typeof getPractice1Grade === 'function') {
            grade = getPractice1Grade(data.total);
            gradeDesc.textContent = `${grade.desc}（試用門檻：一等 ≥450｜二等 350–449｜三等 300–349）`;
        } else if (isMission2 && typeof getMission2Grade === 'function') {
            grade = getMission2Grade(data.total);
            gradeDesc.textContent = `${grade.desc}（門檻：一等 ≥950｜二等 750–949｜三等 550–749）`;
        } else if (isMission1 && typeof getMission1Grade === 'function') {
            grade = getMission1Grade(data.total);
            gradeDesc.textContent = `${grade.desc}（門檻：一等 ≥920｜二等 720–919｜三等 550–719）`;
        }
        if (grade) {
            gradeBadge.textContent = `${grade.label} · ${grade.labelEn}`;
            gradeBadge.className = `result-grade-badge ${grade.css}`;
            gradeBlock.hidden = false;
        } else {
            gradeBlock.hidden = true;
        }
    }
    
    const modal = document.getElementById('result-modal');
    if (modal) {
        // 強制顯示
        modal.style.setProperty('display', 'flex', 'important');
        modal.classList.add('active'); // 增加一個 class 輔助
        console.log("✅ 成績單已設置為可見");
        requestAnimationFrame(() => {
            try {
                const toFocus = modal.querySelector('#result-retry-btn') || modal.querySelector('button');
                if (toFocus && typeof toFocus.focus === 'function') toFocus.focus();
            } catch (_) { /* ignore */ }
        });
    } else {
        console.error("❌ 找不到 result-modal 元素");
        showAppMessage({
            variant: 'info',
            title: '任務完成',
            body: `總得分：${data.total}`,
            nextStep: '若未看到成績單面板，請重新整理頁面或檢查頁面是否封鎖彈出視窗。',
            autoHideMs: 12000,
            focusClose: false
        });
    }
}

window.closeResultModal = function() {
    const modal = document.getElementById('result-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    // 成績單多由任務完成回呼開啟，開啟時焦點常在 document.body；此時還原到右下角「執行」較符合後續操作。
    _restoreModalFocus(_modalFocusResultReturn, 'run-blockly-btn');
    _modalFocusResultReturn = null;
}

/** 主控台：enableRoadMaskDebug() — main.js 覆寫 simulator.js 版（script 載入順序：simulator → main），提供快取舊版時的提示 */
window.enableRoadMaskDebug = function () {
    window.__DEBUG_ROAD_MASK__ = true;
    if (typeof setupRoadMaskDebugListener === 'function') {
        setupRoadMaskDebugListener();
    }
    if (typeof logRoadMaskDebugStatus === 'function') {
        logRoadMaskDebugStatus();
        console.log(
            '[road-debug] 滑鼠在 3D 畫布上移動 → markRoadFixHere(2) 記 180° → copyRoadFixReport() 貼給 Cursor'
        );
        return;
    }
    console.error(
        '[road-debug] simulator.js 未載入或版本過舊。請 Cmd+Shift+R（Windows: Ctrl+Shift+R）強制重新整理，' +
        '並在 Network 分頁確認 js/simulator.js 為 200。'
    );
};

window.addEventListener('load', () => {
    // 默認顯示主選單
    showMainMenu();

// 延遲初始化 3D 引擎（僅在需要時）
    // if (typeof init3D === 'function') {
    //     init3D();
    //     console.log("3D Engine Started from main.js");
    // } else {
    //     console.error("Error: init3D function not found. Check simulator.js loading.");
    // }
});
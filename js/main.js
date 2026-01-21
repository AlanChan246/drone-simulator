// ==========================================
// 檔案：js/main.js
// 用途：UI 互動、Blockly 執行核心、指令隊列處理
// ==========================================
// Blockly 工作區變數（延遲初始化）
let workspace = null;
// 保存積木區寬度（百分比）
let savedBlocklyWidth = 30; // 默認 30%

// 執行控制變數
let executionSpeed = 1.0; // 執行速度倍數（1.0 = 正常速度）
let currentGameMode = 'mission'; // 當前遊戲模式 ('mission' 或 'freeplay')
let activeMissionId = null; // 當前活動的任務 ID
let currentExecutingBlockId = null; // 當前執行的積木 ID
let blockToCommandMap = new Map(); // 積木 ID 到命令索引的映射
let commandToBlockMap = new Map(); // 命令索引到積木 ID 的映射

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
            
            workspace = Blockly.inject('blocklyDiv', {
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
            
            // 初始化後立即調整大小
            setTimeout(() => {
                if (workspace && typeof Blockly !== 'undefined') {
                    // 確保積木區面板是顯示狀態
                    const blocklyDiv = document.getElementById('blocklyDiv');
                    if (blocklyDiv && blocklyDiv.classList.contains('visible')) {
                        Blockly.svgResize(workspace);
                        // 重置縮放比例
                        blocklyZoom = 1.0;
                        workspace.setScale(blocklyZoom);
                        console.log("Blockly workspace resized after initialization");
                    }
                }
                // 初始化寬度調整功能
                initBlocklyResizer();
            }, 100);
            
            // 添加窗口大小調整監聽器
            let resizeTimeout;
            const handleResize = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    if (workspace && typeof Blockly !== 'undefined' && blocklyDiv.classList.contains('visible')) {
                        Blockly.svgResize(workspace);
                    }
                }, 100);
            };
            window.addEventListener('resize', handleResize);
        }
    } else {
        // 如果已初始化，調整大小以適應容器
        if (workspace && typeof Blockly !== 'undefined') {
            const blocklyDiv = document.getElementById('blocklyDiv');
            if (blocklyDiv && blocklyDiv.classList.contains('visible')) {
                // 使用 requestAnimationFrame 確保在下一幀調整
                requestAnimationFrame(() => {
                    Blockly.svgResize(workspace);
                });
            }
        }
    }
    return workspace;
}
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

// 切换设置菜单
function toggleSettingsMenu() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
    }
}

// 点击外部关闭设置菜单
document.addEventListener('click', function(event) {
    const settingsMenu = document.getElementById('settings-menu');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsToggle = document.querySelector('.settings-toggle-btn');
    
    if (settingsMenu && settingsPanel && settingsToggle) {
        // 如果点击的不是设置菜单内的元素，则关闭菜单
        if (!settingsMenu.contains(event.target) && settingsPanel.style.display !== 'none') {
            settingsPanel.style.display = 'none';
        }
    }
});
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
        alert("Blockly 工作區未初始化！");
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
            
            Blockly.JavaScript.INFINITE_LOOP_TRAP = 'if (state.stopSignal) throw new Error("STOP");\nawait wait(30);\n';
            const rawCode = Blockly.JavaScript.workspaceToCode(currentWorkspace);
            Blockly.JavaScript.INFINITE_LOOP_TRAP = null;
            
            // 轉換為即時執行格式
            const finalCode = rawCode.replace(/cmdQueue\.push\(/g, 'await executeCommandLive(');
            
            console.log("📜 [挑戰模式] 最終執行代碼內容:\n", finalCode);
            
            runBlocklyCodeChallenge(finalCode);
            return;
        }

        // --- 普通模式的預掃描邏輯 ---
        // 使用 Trap 防止 eval() 內的死循環
        Blockly.JavaScript.INFINITE_LOOP_TRAP = 'if (state.stopSignal) throw "STOP";\n';
        const code = Blockly.JavaScript.workspaceToCode(currentWorkspace);
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
            return originalPush.apply(this, items);
        };
        
        // 遍歷積木塊並在生成代碼時設置當前積木塊 ID
        function setCurrentBlockForCodeGen(block) {
            if (!block) return;
            const blockType = block.type;
            const commandGeneratingBlocks = [
                'event_wait_key', 'drone_takeoff', 'drone_land', 'drone_hover',
                'drone_move_time', 'drone_move_cm', 'drone_goto_xyz', 'drone_turn_degree',
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
        
        // 執行同步代碼以填充 cmdQueue
        eval(code);
        
        // 恢復原始 push 方法
        cmdQueue.push = originalPush;
        
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
        alert("Code Error: " + e); 
        console.error("Code generation error:", e);
        return; 
    }
    
    if (cmdQueue.length === 0) { 
        alert("請拖曳積木!"); 
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
        case 'hover': await wait(param * 1000); break;
        case 'goto_xyz':
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


// 更新執行速度
function updateExecutionSpeed() {
    const slider = document.getElementById('speed-slider');
    const display = document.getElementById('speed-display');
    if (slider && display) {
        executionSpeed = parseFloat(slider.value);
        display.textContent = executionSpeed.toFixed(1) + 'x';
    }
}

// 載入任務一參考答案
function loadMazeAnswer() {
    if (!workspace) {
        toggleBlocklyPanel();
        setTimeout(loadMazeAnswer, 300);
        return;
    }

    // 🔥 隨機迷宮挑戰模式答案
    if (currentSceneType === 'challenge_maze') {
        const choice = prompt("請選擇挑戰難度：\n1. 高小組 (感應器優先級 - 右手法則)\n2. 中學組 (單線 LiDAR - 記憶回溯)", "1");
        
        if (choice === "1") {
            workspace.clear();
            const xmlText = `<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_start" x="20" y="20"><next><block type="drone_takeoff"><next><block type="controls_whileUntil"><field name="MODE">WHILE</field><value name="BOOL"><block type="logic_boolean"><field name="BOOL">TRUE</field></block></value><statement name="DO"><block type="controls_if"><mutation elseif="1" else="1"></mutation><value name="IF0"><block type="logic_compare"><field name="OP">GT</field><value name="A"><block type="drone_get_range"><field name="TYPE">right</field><field name="UNIT">cm</field></block></value><value name="B"><block type="math_number"><field name="NUM">120</field></block></value></block></value><statement name="DO0"><block type="drone_turn_degree"><field name="DIR">RIGHT</field><value name="DEGREE"><block type="math_number"><field name="NUM">90</field></block></value><next><block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><block type="math_number"><field name="NUM">150</field></block></value></block></next></block></statement><value name="IF1"><block type="logic_compare"><field name="OP">GT</field><value name="A"><block type="drone_get_range"><field name="TYPE">front</field><field name="UNIT">cm</field></block></value><value name="B"><block type="math_number"><field name="NUM">100</field></block></value></block></value><statement name="DO1"><block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><block type="math_number"><field name="NUM">150</field></block></value></block></statement><statement name="ELSE"><block type="drone_turn_degree"><field name="DIR">LEFT</field><value name="DEGREE"><block type="math_number"><field name="NUM">90</field></block></value></block></statement></block></statement></block></next></block></next></block></xml>`;
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xmlText), workspace);
            logToConsole("✅ 已載入 [高小組] 參考答案");
        } else if (choice === "2") {
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
        }
        return;
    }

    // 🔥 任務二：森林救援答案 (繞路導航版)
    // 🔥 任務二：森林救援答案 (多火場循環版)
    // 🔥 任務二：森林救援答案 (避障攻略版)
    if (currentSceneType === 'city') {
        if (confirm("這將會清除當前積木並載入「任務二：森林救援」避障攻略版參考答案，確定嗎？")) {
            workspace.clear();
            const answerXml = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_start" x="20" y="20">
    <next>
      <block type="drone_takeoff">
        <next>
          <!-- 1. 前往水源 (3,3)：繞過森林障礙 -->
          <block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><block type="math_number"><field name="NUM">600</field></block></value>
            <next>
              <block type="drone_move_cm"><field name="DIR">LEFT</field><value name="DIST"><block type="math_number"><field name="NUM">1350</field></block></value>
                <next>
                  <block type="drone_move_cm"><field name="DIR">BACKWARD</field><value name="DIST"><block type="math_number"><field name="NUM">300</field></block></value>
                    <next>
                      <block type="drone_move_cm"><field name="DIR">RIGHT</field><value name="DIST"><block type="math_number"><field name="NUM">1050</field></block></value>
                        <next>
                          <block type="drone_collect_water">
                            <next>
                              <!-- 2. 前往火場 (6,7) -->
                              <block type="drone_move_cm"><field name="DIR">LEFT</field><value name="DIST"><block type="math_number"><field name="NUM">1050</field></block></value>
                                <next>
                                  <block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><block type="math_number"><field name="NUM">600</field></block></value>
                                    <next>
                                      <block type="drone_move_cm"><field name="DIR">RIGHT</field><value name="DIST"><block type="math_number"><field name="NUM">600</field></block></value>
                                        <next>
                                          <block type="drone_release_water">
                                            <next>
                                              <!-- 3. 前往終點 (14,14) -->
                                              <block type="drone_move_cm"><field name="DIR">LEFT</field><value name="DIST"><block type="math_number"><field name="NUM">600</field></block></value>
                                                <next>
                                                  <block type="drone_move_cm"><field name="DIR">RIGHT</field><value name="DIST"><block type="math_number"><field name="NUM">1350</field></block></value>
                                                    <next>
                                                      <block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><block type="math_number"><field name="NUM">900</field></block></value>
                                                        <next>
                                                          <block type="drone_move_cm"><field name="DIR">LEFT</field><value name="DIST"><block type="math_number"><field name="NUM">1950</field></block></value>
                                                            <next>
                                                              <block type="drone_move_cm"><field name="DIR">FORWARD</field><value name="DIST"><block type="math_number"><field name="NUM">150</field></block></value>
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
</xml>`;
            Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(answerXml), workspace);
            logToConsole("✅ 已載入任務二森林救援 [避障攻略版] 參考答案。");
        }
        return;
    }

    if (confirm("這將會清除當前積木並載入「相對移動版」參考答案，確定嗎？")) {
        workspace.clear();
        
        // 使用相對移動積木 (move_cm)，避開牆壁並觸發 3 個 Beacons
        const answerXml = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_start" x="20" y="20">
    <next>
      <block type="drone_takeoff">
        <next>
          <!-- 1. 前往第一個 Beacon (1,10) -->
          <!-- 1. 前往第一個 Beacon (1,10) -->
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
                                  <!-- 2. 避開牆壁 (1,4) 原路折返並前往 Beacon 2 (5,3) -->
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
                                                          <!-- 3. 前往第三個 Beacon (7,8) -->
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
                                                                          <!-- 4. 衝向出口 -->
                                                                          <block type="drone_move_cm">
                                                                                    <field name="DIR">FORWARD</field>
                                                                            <value name="DIST"><block type="math_number"><field name="NUM">450</field></block></value>
                                                                            <next>
                                                                              <block type="drone_move_cm">
                                                                                        <field name="DIR">LEFT</field>
                                                                                <value name="DIST"><block type="math_number"><field name="NUM">450</field></block></value>
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
            logToConsole("✅ 已載入任務一完美避障版答案。");
        } catch (e) {
            console.error("載入答案失敗:", e);
            alert("載入答案失敗！");
        }
    }
}
// --- 任務特定功能派發器 ---
async function dispatchCollectWater() {
    console.log("💧 正在執行取水指令...");
    
    // 檢查是否在水源格位 (val === 5)
    const gridX = Math.floor((state.x - mazeOffsetX + currentCellSize/2) / currentCellSize);
    const gridZ = Math.floor((state.z - mazeOffsetZ + currentCellSize/2) / currentCellSize);
    
    let isOnWater = false;
    if (currentMazeGrid && gridZ >= 0 && gridZ < currentMazeGrid.length && gridX >= 0 && gridX < currentMazeGrid[0].length) {
        if (currentMazeGrid[gridZ][gridX] === 5) isOnWater = true;
    }

    if (isOnWater) {
        await wait(2000); // 取水動畫時間
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

    // 精確計算當前格位
    const gridX = Math.floor((state.x - mazeOffsetX) / currentCellSize);
    const gridZ = Math.floor((state.z - mazeOffsetZ) / currentCellSize);
    
    let isOnFire = false;
    if (currentMazeGrid && gridZ >= 0 && gridZ < currentMazeGrid.length && gridX >= 0 && gridX < currentMazeGrid[0].length) {
        if (currentMazeGrid[gridZ][gridX] === 4) isOnFire = true;
    }

    if (isOnFire) {
        await wait(2000); 
        state.hasWater = false;
        logToConsole("🌊 滅火成功！成功撲滅一處火源。");
        
        // 視覺效果：熄滅當前格位的火焰 (檢查 X 與 Z)
        const targetX = gridX * currentCellSize + mazeOffsetX + currentCellSize/2;
        const targetZ = gridZ * currentCellSize + mazeOffsetZ + currentCellSize/2;

        if (typeof environmentGroup !== 'undefined') {
            environmentGroup.children.forEach(obj => {
                // 同時判定 X, Z 座標是否匹配火源位置
                const dx = Math.abs(obj.position.x - targetX);
                const dz = Math.abs(obj.position.z - targetZ);
                if (obj instanceof THREE.Group && dx < 20 && dz < 20) {
                    obj.visible = false; 
                }
            });
        }
        updateHUD();
    } else {
        logToConsole("❌ 滅火失敗：下方沒有火源。請對準火焰中心執行。");
    }
}

function updateHUD() {
    const hud = document.getElementById('hud-display');
    if (!hud) return;
    
    const alt = (currentSceneType === 'city') ? (state.y - getForestHeight(state.x, state.z)) : state.y;
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
    takeoffTime = 0;           // 重置起飛計時
    beaconsTriggered = 0;      // 重置 Beacon 計數
    currentScore = 0;          // 重置分數
    state.missionCompleted = false; // 重置完成狀態
    
    // 如果在隨機迷宮挑戰模式，重置後重新啟動輪換
    if (currentSceneType === 'challenge_maze') {
        if (typeof startMazeCycling === 'function') {
            startMazeCycling();
        }
    }
    if (typeof beaconData !== 'undefined') {
        beaconData.forEach(b => {
            b.triggered = false;
            b.hoverTimer = 0;
            // 恢復 Beacon 顏色 (青色)
            if (b.mesh) {
                b.mesh.traverse(child => {
                    if (child.material) child.material.color.setHex(0x00adb5);
                });
            }
        });
    }

    // --- 重置無人機位置 ---
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

// 更新執行進度顯示
function updateProgress(current, total) {
    const progressDiv = document.getElementById('execution-progress');
    const progressText = document.getElementById('progress-text');
    if (progressDiv && progressText) {
        if (total > 0) {
            progressDiv.style.display = 'flex';
            progressText.textContent = `${current}/${total}`;
        } else {
            progressDiv.style.display = 'none';
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
            case 'hover': await wait(param * 1000); break;
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
        toggleBtn.title = '顯示積木區';
        
        // 等待動畫完成後調整 3D 渲染器大小（動畫時間 150ms）
        setTimeout(() => {
            if (typeof onWindowResize === 'function') {
                onWindowResize();
            }
        }, 200);
    } else {
        // 顯示積木區 - 恢復之前保存的寬度
        blocklyPanel.classList.add('visible');
        mainContainer.classList.remove('blockly-hidden');
        // 恢復之前保存的寬度
        blocklyPanel.style.flex = `0 0 ${savedBlocklyWidth}%`;
        blocklyPanel.style.width = `${savedBlocklyWidth}%`;
        toggleBtn.textContent = '📦 隱藏積木區';
        toggleBtn.title = '隱藏積木區';
        
        // 確保 Blockly 已初始化（只在顯示時初始化）
        if (!workspace) {
            // 等待面板顯示動畫開始後再初始化
            setTimeout(() => {
                initBlockly();
            }, 50);
        } else {
            // 如果已初始化，確保正確顯示
            setTimeout(() => {
                if (workspace && typeof Blockly !== 'undefined') {
                    Blockly.svgResize(workspace);
                }
            }, 100);
        }
        
        // 等待動畫完成後調整 Blockly 和 3D 渲染器大小（動畫時間 150ms）
        setTimeout(() => {
            if (workspace && typeof Blockly !== 'undefined') {
                Blockly.svgResize(workspace);
            }
            // 調整 3D 渲染器大小
            if (typeof onWindowResize === 'function') {
                onWindowResize();
            }
            // 初始化寬度調整功能
            initBlocklyResizer();
        }, 200);
    }
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

// 初始化積木區寬度調整功能
function initBlocklyResizer() {
    const resizer = document.getElementById('blockly-resizer');
    const blocklyPanel = document.getElementById('blocklyDiv');
    const mainContainer = document.querySelector('.main-container');
    
    if (!resizer || !blocklyPanel || !mainContainer) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = blocklyPanel.offsetWidth;
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    });
    
    function handleResize(e) {
        if (!isResizing) return;
        
        const diff = e.clientX - startX; // 向右拖拽增加寬度
        const newWidth = startWidth + diff;
        const containerWidth = mainContainer.offsetWidth;
        const minWidth = 250; // 最小寬度
        const maxWidth = containerWidth * 0.6; // 最大寬度（60%）
        
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            const percentage = (newWidth / containerWidth) * 100;
            // 保存當前寬度
            savedBlocklyWidth = percentage;
            // 禁用過渡動畫以便拖拽時實時響應
            blocklyPanel.style.transition = 'none';
            blocklyPanel.style.flex = `0 0 ${percentage}%`;
            blocklyPanel.style.width = `${percentage}%`;
            
            // 實時調整 Blockly 和 3D 渲染器大小
            if (workspace && typeof Blockly !== 'undefined') {
                Blockly.svgResize(workspace);
            }
            if (typeof onWindowResize === 'function') {
                onWindowResize();
            }
        }
    }
    
    function stopResize() {
        isResizing = false;
        // 恢復過渡動畫
        if (blocklyPanel) {
            blocklyPanel.style.transition = 'opacity 0.3s ease';
        }
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }
    
}

// 返回任務選擇畫面
function returnToMissionSelect() {
    closeResultModal();
    if (currentGameMode === 'freeplay') {
        showMainMenu();
    } else {
        document.getElementById('game-interface').style.display = 'none';
        document.getElementById('mission-select-menu').style.display = 'flex';
        document.getElementById('main-menu').style.display = 'none';
    }
}

// 🔥 挑戰模式：隨機迷宮
function startChallengeMode() {
    logToConsole("🔥 挑戰模式：隨機迷宮已啟動！");
    logToConsole("⚠️ 迷宮將在點擊「執行」後隨機生成。");
    
    // 隱藏參考答案按鈕
    const answerBtn = document.getElementById('maze-answer-btn');
    if (answerBtn) answerBtn.style.display = 'none';
    
    // 1. 切換場景
    currentGameMode = 'mission';
    currentSceneType = 'challenge_maze';
    loadScene('challenge_maze'); 
    
    // 2. 確保同步起點 (loadScene 內部會調用 createChallengeMaze 並設置 spawnPosition)
    resetSimulator(); 
    logToConsole(`📍 起點已同步: (${state.x}, ${state.z})`);

    // 3. 清除積木
    if (confirm("挑戰模式需要編寫「自動導航」積木 (使用感應器)。是否清除當前積木？")) {
        workspace.clear();
        const xmlText = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="event_start" x="20" y="20"></block></xml>';
        const xml = Blockly.utils.xml.textToDom(xmlText);
        Blockly.Xml.domToWorkspace(xml, workspace);
    }
}

// 顯示任務簡報
function showMissionBriefing(missionId) {
    console.log("showMissionBriefing called with:", missionId, "active:", activeMissionId);
    
    // 如果沒有傳入 missionId，嘗試使用 activeMissionId
    const targetMissionId = missionId || activeMissionId;
    
    if (!targetMissionId) {
        console.warn("No target mission ID found");
        return;
    }

    const briefingModal = document.getElementById('mission-briefing');
    const title = document.getElementById('briefing-title');
    const content = document.getElementById('briefing-content');
    const icon = document.getElementById('briefing-icon');
    
    if (!briefingModal || !title || !content) return;
    
    if (targetMissionId == 1) {
        title.textContent = '任務一：隧道迷宮 (TUNNEL MAZE)';
        icon.textContent = '🚇';
        content.innerHTML = `
            <h3 style="color: #4c6ef5; margin-top: 0;">🎯 任務目標 Mission Objective</h3>
            <p>編寫程式控制無人機穿過隧道，並安全降落在終點。</p>
            <p>Program the drone to navigate through the tunnel and land safely at the exit.</p>
            
            <h3 style="color: #ff9800; margin-top: 15px;">💡 提示 Tips</h3>
            <ul style="padding-left: 20px; margin-top: 5px;">
                <li>使用 <strong>[前] 距離感測器</strong> 偵測前方障礙物。<br>Use <strong>[Front] Range Sensor</strong> to detect obstacles.</li>
                <li>當偵測到牆壁時，轉向 (90度) 並繼續飛行。<br>When a wall is detected, turn (90 degrees) and continue flying.</li>
                <li>沿著隧道飛行直到抵達出口。<br>Follow the tunnel until you reach the exit.</li>
                <li>收集沿途的信號標記點 (Beacons) 可獲得額外分數。<br>Collect Beacons along the way for extra points.</li>
            </ul>
        `;
    } else if (targetMissionId == 2) {
        title.textContent = '任務二：山火救援 (FOREST FIRE)';
        icon.textContent = '🔥';
        content.innerHTML = `
            <h3 style="color: #4c6ef5; margin-top: 0;">🎯 任務目標 Mission Objective</h3>
            <p>控制無人機前往水源取水，並撲滅森林中的火源。</p>
            <p>Control the drone to collect water and extinguish fires in the forest.</p>
            
            <h3 style="color: #ff9800; margin-top: 15px;">💡 提示 Tips</h3>
            <ul style="padding-left: 20px; margin-top: 5px;">
                <li>注意避開樹木，它們是障礙物。<br>Avoid trees, they are obstacles.</li>
                <li>前往藍色區域使用 <strong>[Collect Water]</strong> 積木取水。<br>Go to the blue area and use <strong>[Collect Water]</strong> block.</li>
                <li>飛到火源上方使用 <strong>[Release Water]</strong> 積木滅火。<br>Fly over the fire and use <strong>[Release Water]</strong> block.</li>
                <li>注意電池電量！<br>Watch your battery level!</li>
            </ul>
        `;
    }
    
    briefingModal.style.display = 'flex';
    // 添加 active class 以觸發動畫
    setTimeout(() => briefingModal.classList.add('active'), 10);
}

// 關閉任務簡報
function closeBriefing() {
    const briefing = document.getElementById('mission-briefing');
    if (briefing) {
        briefing.classList.remove('active');
        briefing.style.display = 'none';
    }
}

// 顯示主選單
function showMainMenu() {
    document.getElementById('main-menu').style.display = 'flex';
    document.getElementById('mission-select-menu').style.display = 'none';
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
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('mission-select-menu').style.display = 'flex';
    document.getElementById('game-interface').style.display = 'none';
    
    // 清理主菜單預覽
    cleanupMainMenuPreview();
    
    // 更新任務預覽場景
    updateMissionPreview();
}

// 啟動任務
async function startMission(missionId) {
    currentGameMode = 'mission';
    
    // 立即設置 activeMissionId
    if (missionId === 'training' || missionId === 1) {
        activeMissionId = 1;
    } else if (missionId === 2) {
        activeMissionId = 2;
    } else {
        activeMissionId = null;
    }
    console.log("Mission started, activeMissionId set to:", activeMissionId);

    // 先顯示遊戲界面
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('mission-select-menu').style.display = 'none';
    const gameInterface = document.getElementById('game-interface');
    gameInterface.style.display = 'block';
    
    // 隱藏參考答案按鈕
    const answerBtn = document.getElementById('maze-answer-btn');
    if (answerBtn) {
        answerBtn.style.display = 'none';
        console.log(`按鈕顯示狀態更新: 參考答案按鈕已隱藏`);
    }
    
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
        toggleBtn.title = '顯示積木區';
    }
    
    // 強制瀏覽器重新計算佈局
    gameInterface.offsetHeight; // 觸發重排
    
    // 等待界面渲染完成（增加等待時間）
    await new Promise(resolve => setTimeout(resolve, 200));
    
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
    if (missionId === 'training' || missionId === 1) {
        changeScene('tunnel');
    } else if (missionId === 2) {
        changeScene('city');
    } else {
        changeScene('free');
    }
    
    // 場景切換後，再次確保渲染器大小正確
    await new Promise(resolve => setTimeout(resolve, 100));
    if (typeof onWindowResize === 'function') {
        onWindowResize();
    }
}

// 啟動自由遊戲
async function startFreePlay() {
    currentGameMode = 'freeplay';
    // 先顯示遊戲界面
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('mission-select-menu').style.display = 'none';
    const gameInterface = document.getElementById('game-interface');
    gameInterface.style.display = 'block';
    
    // 隱藏參考答案按鈕
    const answerBtn = document.getElementById('maze-answer-btn');
    if (answerBtn) answerBtn.style.display = 'none';
    
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
        toggleBtn.title = '顯示積木區';
    }
    
    // 強制瀏覽器重新計算佈局
    gameInterface.offsetHeight; // 觸發重排
    
    // 等待界面渲染完成（增加等待時間）
    await new Promise(resolve => setTimeout(resolve, 200));
    
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
}

// 顯示基地營
function showBasecamp() {
    alert('BASECAMP 功能開發中...');
}

// 顯示您的任務
function showYourMissions() {
    alert('YOUR MISSIONS 功能開發中...');
}

// 載入場景
function showLoadScene() {
    alert('LOAD SCENE 功能開發中...');
}

// 退出遊戲
function quitGame() {
    if (confirm('確定要退出遊戲嗎？')) {
        window.close();
    }
}

// 初始化執行控制（頁面加載時）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExecutionControls);
} else {
    initExecutionControls();
}

function initExecutionControls() {
    // 速度滑塊監聽器
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) {
        speedSlider.addEventListener('input', updateExecutionSpeed);
        updateExecutionSpeed(); // 初始化顯示
    }
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

// 更新任務預覽場景（簡化版，後續可擴展）
function updateMissionPreview() {
    const previewContainer = document.getElementById('mission-preview');
    if (previewContainer && typeof THREE !== 'undefined') {
        // 這裡可以創建一個簡化的 3D 預覽場景
        // 暫時留空，後續可以實現
    }
}

// 【關鍵修正】最後必須呼叫 init3D() 來啟動 simulator.js 裡的場景
// 確保 DOM 載入完成後執行
// 初始化執行控制
window.addEventListener('load', () => {
    // 速度滑塊監聽器
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) {
        speedSlider.addEventListener('input', updateExecutionSpeed);
        updateExecutionSpeed(); // 初始化顯示
    }
});

    // --- 任務結算彈窗功能 ---
window.showResultModal = function(data) {
    console.log("🏆 顯示結算彈窗:", data);
    logToConsole("📊 任務完成！正在顯示成績單...");
    
    // 填寫數據
    const elBeacons = document.getElementById('res-beacons');
    const elBeaconsScore = document.getElementById('res-beacons-score');
    const elExitScore = document.getElementById('res-exit-score');
    const elTime = document.getElementById('res-time');
    const elTimeBonus = document.getElementById('res-time-bonus');
    const elTotal = document.getElementById('res-total');

    if (elBeacons) elBeacons.innerText = `${data.beacons} / 3`;
    if (elBeaconsScore) elBeaconsScore.innerText = `+${data.beaconsScore}`;
    if (elExitScore) elExitScore.innerText = `+${data.exitScore}`;
    if (elTime) elTime.innerText = `${data.time}s`;
    if (elTimeBonus) elTimeBonus.innerText = `+${data.timeBonus}`;
    if (elTotal) elTotal.innerText = data.total;
    
    const modal = document.getElementById('result-modal');
    if (modal) {
        // 強制顯示
        modal.style.setProperty('display', 'flex', 'important');
        modal.classList.add('active'); // 增加一個 class 輔助
        console.log("✅ 成績單已設置為可見");
    } else {
        console.error("❌ 找不到 result-modal 元素");
        alert(`任務完成！總得分：${data.total}`);
    }
}

window.closeResultModal = function() {
    const modal = document.getElementById('result-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

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
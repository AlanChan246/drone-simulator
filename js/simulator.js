// ==========================================
// 檔案：js/simulator.js
// 用途：Three.js 環境設定、3D 模型 (GLTF)、物理邏輯與全域狀態
// 版本：Holodeck 虛擬訓練室風格
// ==========================================
const container = document.getElementById('canvas-container');
let scene, camera, renderer, droneGroup;
let environmentGroup; 
let droneLedLight, droneLedMesh;  
let propellers = [];
// 全域狀態變數
let cmdQueue = []; 
let currentSceneType = 'free'; 
let cityOrder = null; 
let hasHoveredTower = false; 
let currentScore = 0;      
let hasTakenOff = false;   
let takeoffTime = 0;        // 新增：起飛時間
let beaconsTriggered = 0;   // 新增：已觸發的標記點數量
let beaconData = [];        // 新增：標記點座標與狀態
let spawnPosition = { x: 0, y: 0, z: 0, heading: 180 }; // 新增：場景起點記錄
let targetPosition = { x: 0, z: 0 }; 
let startPosition = { x: 0, y: 0, z: 0, heading: 180 }; // 新增：起始位置記錄
let lightScore = 40;       
let ruinsUpdateFunction = null;

// --- 碰撞偵測相關變數 ---
let currentMazeGrid = null;
let currentCellSize = 0;
let mazeOffsetX = 0;
let mazeOffsetZ = 0;
let lastSafePos = { x: 0, y: 0, z: 0 };
// 模型資產緩存
const assets = {
    corridor: null,
    window: null,
    open: null,
    drone: null,
    tree_pine: null,
    tree_small: null,
    tree_oak: null,
    rock: null,
    bush: null,
    grass: null,
    stump: null,
    log: null,
    lily: null
};
// 飛行狀態
let flightState = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
// 攝影機與操作
let camRadius = 800; 
let camTheta = 45; let camPhi = 50;   
let isMouseDown = false, mouseX = 0, mouseY = 0;
    const state = { 
        x: 0, y: 0, z: 0, 
        heading: 180, 
        isFlying: false, 
        isRunning: false, 
        stopSignal: false, 
        missionCompleted: false,
        hasWater: false // 新增：水箱狀態
    };
let waitingForKey = false;
let camTarget = { x: 0, y: 0, z: 0 }; 
let followDrone = true;               
let isRightMouseDown = false;         
// ==========================================
// 1. 模型載入邏輯 (GLTFLoader)
// ==========================================
async function preloadModels() {
    const loader = new THREE.GLTFLoader();
    
    // 定義所有可能的模型（包括可選的）
    const allModels = [
        { key: 'corridor', path: 'assets/models/corridor.glb', required: true },
        { key: 'window',   path: 'assets/models/corridor_window.glb', required: false },
        { key: 'open',     path: 'assets/models/corridor_open.glb', required: false },
        { key: 'drone',    path: 'assets/models/drone.glb', required: false },
        { key: 'tree_pine', path: 'assets/models/nature/GLTF format/tree_pineTallA.glb', required: false },
        { key: 'tree_small', path: 'assets/models/nature/GLTF format/tree_pineSmallA.glb', required: false },
        { key: 'tree_oak', path: 'assets/models/nature/GLTF format/tree_oak.glb', required: false },
        { key: 'rock', path: 'assets/models/nature/GLTF format/rock_smallA.glb', required: false },
        { key: 'bush', path: 'assets/models/nature/GLTF format/plant_bushLarge.glb', required: false },
        { key: 'grass', path: 'assets/models/nature/GLTF format/grass.glb', required: false },
        { key: 'stump', path: 'assets/models/nature/GLTF format/stump_old.glb', required: false },
        { key: 'log', path: 'assets/models/nature/GLTF format/log.glb', required: false },
        { key: 'lily', path: 'assets/models/nature/GLTF format/lily_large.glb', required: false },
        { key: 'fire_logs', path: 'assets/models/nature/GLTF format/campfire_logs.glb', required: false },
        { key: 'rock_flat', path: 'assets/models/nature/GLTF format/rock_smallFlatA.glb', required: false }
    ];

    console.log("🚀 開始載入 3D 模型...");

    // 只載入存在的模型（跳過不存在的可選模型，避免 404 錯誤）
    // 直接過濾掉已知不存在的可選模型
    const modelsToLoad = allModels.filter(item => {
        // 必需模型始終載入
        if (item.required) return true;
        
        // 可選模型：只載入已知存在的（drone.glb）
        // 如果將來需要添加 window 或 open，可以在這裡添加檢查
        if (item.key === 'drone') return true; // drone.glb 存在
        
        // window 和 open 不存在，直接跳過
        if (item.key === 'window' || item.key === 'open') {
            return false; // 跳過不存在的文件
        }
        
        return true;
    });

    const promises = modelsToLoad.map(item => {
        return new Promise((resolve) => {
            loader.load(item.path, (gltf) => {
                gltf.scene.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        // 讓模型稍微金屬化一點，符合 Holodeck 風格
                        if (child.material) {
                            child.material.roughness = 0.5; 
                            child.material.metalness = 0.5; 
                        }
                    }
                });
                assets[item.key] = gltf.scene; 
                console.log(`✅ Loaded: ${item.key}`);
                resolve();
            }, undefined, (error) => {
                // 錯誤處理（作為備用）
                if (!item.required) {
                    console.warn(`⚠️ Optional model ${item.key} failed to load`);
                } else {
                    console.error(`❌ Error loading required model ${item.path}:`, error);
                }
                resolve(); // 即使失敗也繼續，避免阻塞其他模型載入
            });
        });
    });

    return Promise.all(promises);
}
// ==========================================
// 2. 初始化與環境
// ==========================================
async function init3D() {
    await preloadModels();
    
    // 確保容器有有效尺寸
    let width = container.clientWidth || container.offsetWidth || 800;
    let height = container.clientHeight || container.offsetHeight || 600;
    
    // 如果尺寸無效，等待一下再檢查
    if (width === 0 || height === 0) {
        console.warn("Container size is 0, waiting for layout...");
        await new Promise(resolve => setTimeout(resolve, 100));
        width = container.clientWidth || container.offsetWidth || 800;
        height = container.clientHeight || container.offsetHeight || 600;
    }
    
    // 如果還是無效，使用默認值
    if (width === 0 || height === 0) {
        console.warn(`Container size still invalid (${width}x${height}), using defaults: 800x600`);
        width = 800;
        height = 600;
    }
    
    console.log(`Initializing 3D with container size: ${width}x${height}`);
    
    scene = new THREE.Scene(); 
    // 【風格優化】改為平衡的「專業灰」深藍灰色
    scene.background = new THREE.Color(0x1a1c23); 
    // 霧氣也同步調整
    scene.fog = new THREE.Fog(0x1a1c23, 1500, 6000); 

    camera = new THREE.PerspectiveCamera(45, width / height, 1, 8000);
    updateCameraPosition();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true; 
    renderer.outputEncoding = THREE.sRGBEncoding; 
    
    // 設置 canvas 樣式以適應 flex 布局
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.flex = '1 1 0%'; // 佔用剩餘空間
    renderer.domElement.style.minHeight = '0';
    renderer.domElement.style.minWidth = '0';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.order = '1'; // 確保在 console 之前
    // 注意：不設置 height，讓 flex 布局自動計算
    
    container.appendChild(renderer.domElement);
    
    // 初始化時設置正確的大小（考慮 console-panel）
    // 注意：在 flex 布局中，我们需要等待布局完成后再设置大小
    setTimeout(() => {
        // 使用 onWindowResize 來設置正確的大小
        if (typeof onWindowResize === 'function') {
            onWindowResize();
        } else {
            // 如果 onWindowResize 還未定義，手動計算
            const consolePanel = document.getElementById('console-panel');
            const consoleHeight = consolePanel ? (consolePanel.offsetHeight || 150) : 150;
            const containerHeight = container.clientHeight || container.offsetHeight || height;
            const canvasHeight = Math.max(containerHeight - consoleHeight, 100);
            
            // 設置渲染器大小
            renderer.setSize(width, canvasHeight);
            
            // 更新相機
            camera.aspect = width / canvasHeight;
            camera.updateProjectionMatrix();
        }
        console.log(`Canvas initialized: ${width}x${height}`);
    }, 200);
    
    // 初始化後立即更新大小（確保使用實際尺寸）
    onWindowResize();

    // 燈光設置
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222222, 1.0); 
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); 
    dirLight.position.set(100, 500, 100); 
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; 
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    environmentGroup = new THREE.Group(); 
    scene.add(environmentGroup);

    createDroneModel();
    loadScene('free');

    // 監聽器
    window.addEventListener('resize', onWindowResize);
    container.addEventListener('contextmenu', e => e.preventDefault());
    container.addEventListener('mousedown', (e) => { 
        if (e.button === 0) isMouseDown = true; 
        else if (e.button === 2) {
            isRightMouseDown = true;
            if (followDrone) toggleCameraMode();
        }
        mouseX = e.clientX; mouseY = e.clientY; 
    });
    window.addEventListener('mouseup', () => { isMouseDown = false; isRightMouseDown = false; });
    window.addEventListener('mousemove', onMouseMove);
    container.addEventListener('wheel', onMouseWheel);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && waitingForKey) waitingForKey = false;
    });

    // 確保渲染器已正確設置
    const finalWidth = container.clientWidth || container.offsetWidth;
    const finalHeight = container.clientHeight || container.offsetHeight;
    console.log(`Renderer initialized with size: ${finalWidth}x${finalHeight}`);
    console.log(`Scene children count: ${scene.children.length}`);
    console.log(`Environment group children: ${environmentGroup ? environmentGroup.children.length : 0}`);
    console.log(`Drone group: ${droneGroup ? 'created' : 'not created'}`);
    
    animateLoop();
    console.log("✨ Simulator Ready (Holodeck Mode)!");
}
// ==========================================
// 3. 場景生成邏輯
// ==========================================
function changeScene(type) {
    currentSceneType = type;
    loadScene(type);
    resetSimulator(); 
    
    // 更新場景選擇下拉選單的 UI
    const sceneSelect = document.getElementById('scene-select');
    if (sceneSelect) {
        sceneSelect.value = type;
    }
    
    // 更新參考答案按鈕可見性 (目前設為永久隱藏)
    const answerBtn = document.getElementById('maze-answer-btn');
    if (answerBtn) {
        answerBtn.style.display = 'none';
    }
}
function loadScene(type) {
    // 檢查 environmentGroup 是否已初始化
    if (typeof environmentGroup === 'undefined' || !environmentGroup) {
        console.error("environmentGroup is not initialized. Please wait for init3D() to complete.");
        return;
    }
    
    while(environmentGroup.children.length > 0){ 
        environmentGroup.remove(environmentGroup.children[0]); 
    }
    ruinsUpdateFunction = null; 
    window.mazeAnimations = []; 
    beaconData = [];           
    beaconsTriggered = 0;      
    takeoffTime = 0;           
    spawnPosition = { x: 0, y: 0, z: 0, heading: 180 }; // 預設起點
    currentMazeGrid = null;    // 重置碰撞地圖
    lastSafePos = { x: 0, y: 0, z: 0 }; // 重置安全位置
    state.missionCompleted = false; // 重置任務完成狀態
    currentScore = 0; hasTakenOff = false;
    
    // 清除舊的輪換計時器（如果切換到其他場景）
    if (type !== 'challenge_maze') {
        stopMazeCycling();
    }

    if (type === 'tunnel') {
        createMazeMap(); 
    } else if (type === 'challenge_maze') {
        createEmptyFloor(); 
    } else if (type === 'city') {
        createCityMap();
        targetPosition = { x: 0, z: -650 }; 
    } else {
        createFreeFlightMap();
        targetPosition = { x: 0, z: 0 }; 
    }

    // 強制同步無人機到場景起點
    syncDroneToStart();
}

function syncDroneToStart() {
    if (typeof startPosition === 'undefined') return;
    
    state.x = startPosition.x;
    state.y = startPosition.y;
    state.z = startPosition.z;
    state.heading = typeof startPosition.heading !== 'undefined' ? startPosition.heading : 180;
    
    // 同步安全位置，防止碰撞偵測將無人機拉回 (0,0,0)
    lastSafePos.x = state.x;
    lastSafePos.y = state.y;
    lastSafePos.z = state.z;
    
    // 強制將無人機組移動到正確坐標
    if (droneGroup) {
        droneGroup.position.set(state.x, state.y, state.z);
        droneGroup.rotation.y = THREE.MathUtils.degToRad(state.heading);
        droneGroup.visible = true; // 確保組件可見
        
        // 深度強制：確保所有子網格都強制顯示
        droneGroup.traverse(child => {
            if (child.isMesh) {
                child.visible = true;
                if (child.material) {
                    child.material.visible = true;
                    child.material.opacity = 1.0;
                }
            }
        });
        
        // 如果相機跟隨開啟，確保同步
        if (typeof followDrone !== 'undefined' && followDrone) {
            camTarget.x = state.x;
            camTarget.y = state.y;
            camTarget.z = state.z;
        }
    }
    
    // 同步相機目標到無人機位置
    camTarget.x = state.x;
    camTarget.y = state.y;
    camTarget.z = state.z;
    
    if (typeof updateCameraPosition === 'function') updateCameraPosition();
    console.log(`📍 無人機已同步回起點: (${state.x.toFixed(1)}, ${state.y.toFixed(1)}, ${state.z.toFixed(1)}) Heading: ${state.heading}`);
}

// --- [挑戰模式] 隨機迷宮生成器 ---
let mazeCycleInterval = null;

// 隨機迷宮生成器 (Recursive Backtracker) - 使用 13x13 確保起點終點必為通路
function generateRandomMaze(width, height) {
    const maze = Array(height).fill().map(() => Array(width).fill(1));
    const stack = [];
    const startX = 1, startY = 1;

    maze[startY][startX] = 0;
    stack.push([startX, startY]);

    while (stack.length > 0) {
        const [x, y] = stack[stack.length - 1];
        const neighbors = [];

        // 檢查四個方向 (跳過一格以保留牆壁)
        const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
        // 洗牌方向增加隨機性
        dirs.sort(() => Math.random() - 0.5);

        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && maze[ny][nx] === 1) {
                neighbors.push([nx, ny, dx / 2, dy / 2]);
            }
        }

        if (neighbors.length > 0) {
            const [nx, ny, dx, dy] = neighbors[Math.floor(Math.random() * neighbors.length)];
            maze[y + dy][x + dx] = 0; // 打通中間的牆
            maze[ny][nx] = 0;         // 前進到目標格
            stack.push([nx, ny]);
        } else {
            stack.pop();
        }
    }

    // 設置起點與終點 (13x13 索引為 0-12, 11,11 是安全的通路點)
    maze[1][1] = 2;
    maze[height - 2][width - 2] = 3;
    
    return maze;
}

function startMazeCycling() {
    stopMazeCycling(); // 確保不重複啟動
    logToConsole("⏳ 挑戰模式：迷宮每 5 秒自動更換一次...");
    
    // 立即生成第一個
    createChallengeMaze();
    
    mazeCycleInterval = setInterval(() => {
        // 只有在程式沒在運行時才更換迷宮
        if (!state.isRunning) {
            createChallengeMaze();
        }
    }, 5000);
}

function stopMazeCycling() {
    if (mazeCycleInterval) {
        clearInterval(mazeCycleInterval);
        mazeCycleInterval = null;
    }
}

function createEmptyFloor() {
    createHolodeckRoom();
    // 專業灰網格：主線深青，細線深灰
    const gridHelper = new THREE.GridHelper(5000, 100, 0x00adb5, 0x242832);
    gridHelper.position.y = 0.1;
    environmentGroup.add(gridHelper);
    
    // 啟動 5 秒更換迷宮計時器
    startMazeCycling();
}

function createChallengeMaze() {
    // 清除舊的牆壁與物件
    const wallsToRemove = [];
    environmentGroup.children.forEach(child => {
        if (child.isWall || child.isExit || child.isStart) wallsToRemove.push(child);
    });
    wallsToRemove.forEach(w => environmentGroup.remove(w));

    // 使用 13x13 確保完美連通
    const mazeGrid = generateRandomMaze(13, 13);
    const cellSize = 150; 
    const wallHeight = 120;
    
    // 標準化座標：gridStartX 是最左側邊界的絕對座標
    const gridStartX = -(13 * cellSize) / 2;
    const gridStartZ = -(13 * cellSize) / 2;

    currentMazeGrid = mazeGrid;
    currentCellSize = cellSize;
    mazeOffsetX = gridStartX;
    mazeOffsetZ = gridStartZ;

    const wallMaterial = new THREE.MeshPhongMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.8
    });

    for (let row = 0; row < mazeGrid.length; row++) {
        for (let col = 0; col < mazeGrid[row].length; col++) {
            // 放置在格子中心
            const x = gridStartX + col * cellSize + cellSize / 2;
            const z = gridStartZ + row * cellSize + cellSize / 2;

            if (mazeGrid[row][col] === 1) {
                const wallGeo = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
                const wall = new THREE.Mesh(wallGeo, wallMaterial);
                wall.position.set(x, wallHeight / 2, z);
                wall.isWall = true;
                
                // 牆壁邊緣發光 (深紅色)
                const edges = new THREE.EdgesGeometry(wallGeo);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff0000 }));
                wall.add(line);
                
                environmentGroup.add(wall);
            } else if (mazeGrid[row][col] === 2) {
                spawnPosition = { x, y: 0, z, heading: 180 };
                startPosition = { x, y: 0, z, heading: 180 }; // 同步重置起點
                lastSafePos = { x, y: 0, z };
                
                // 立即更新狀態
                state.x = x;
                state.z = z;
                state.y = 0;
                state.heading = 180;
                
                const startPadGeo = new THREE.PlaneGeometry(cellSize, cellSize);
                const startPad = new THREE.Mesh(startPadGeo, new THREE.MeshPhongMaterial({ color: 0x0044ff, side: THREE.DoubleSide }));
                startPad.rotation.x = -Math.PI / 2;
                startPad.position.set(x, 0.5, z);
                startPad.isStart = true;
                environmentGroup.add(startPad);
            } else if (mazeGrid[row][col] === 3) {
                targetPosition = { x, z };
                const exitLight = new THREE.PointLight(0x00ff00, 2, 300);
                exitLight.position.set(x, 60, z);
                exitLight.isExit = true;
                environmentGroup.add(exitLight);

                const exitPad = new THREE.Mesh(
                    new THREE.PlaneGeometry(cellSize, cellSize),
                    new THREE.MeshPhongMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
                );
                exitPad.rotation.x = -Math.PI / 2;
                exitPad.position.set(x, 0.5, z);
                exitPad.isExit = true;
                environmentGroup.add(exitPad);
            }
        }
    }
    
    // 如果沒在運行，則將無人機移至起點
    if (!state.isRunning) {
        state.x = spawnPosition.x;
        state.z = spawnPosition.z;
        state.y = 0;
        state.heading = spawnPosition.heading || 180;
        
        if (droneGroup) {
            droneGroup.position.set(state.x, state.y, state.z);
            droneGroup.rotation.y = THREE.MathUtils.degToRad(state.heading);
        }
        
        // 同步相機目標到起點，避免相機看向遠方
        camTarget.x = state.x;
        camTarget.y = state.y;
        camTarget.z = state.z;
        updateCameraPosition();
    }
}
function createMazeMap() {
    createHolodeckRoom();
    
    // 1. 地面網格 (平衡版)
    const gridHelper = new THREE.GridHelper(5000, 100, 0x00adb5, 0x242832);
    gridHelper.position.y = 0.1;
    environmentGroup.add(gridHelper);

    // 2. 迷宮設計 (1: 牆壁, 0: 通路, 2: 起點, 3: 終點, 4: 信號標記點 Beacon)
    const mazeGrid = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 0, 0, 1, 0, 0, 0, 0, 0, 4, 1],
        [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1],
        [1, 0, 1, 4, 0, 1, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 4, 1, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 3], // 將終點 3 移到最右側邊界牆壁位置
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];

    const cellSize = 150; // cm (改為 150 以對應地板 3x3 格)
    const wallHeight = 120; // 稍微降低牆高，符合縮小後的比例
    
    // 標準化座標：gridStartX 是最左側邊界 (Edge) 的絕對座標
    const gridStartX = -(mazeGrid[0].length * cellSize) / 2;
    const gridStartZ = -(mazeGrid.length * cellSize) / 2;

    // 儲存迷宮參數供碰撞偵測使用
    currentMazeGrid = mazeGrid;
    currentCellSize = cellSize;
    mazeOffsetX = gridStartX;
    mazeOffsetZ = gridStartZ;

    // 牆壁材質 (科技風)
    const wallGeo = new THREE.BoxGeometry(cellSize, wallHeight, cellSize);
    const wallMat = new THREE.MeshPhongMaterial({ 
        color: 0x1a1a1a, 
        specular: 0x00adb5,
        shininess: 30,
        transparent: true,
        opacity: 0.9
    });

    for (let i = 0; i < mazeGrid.length; i++) {
        for (let j = 0; j < mazeGrid[i].length; j++) {
            const val = mazeGrid[i][j];
            // 放置在格子中心 (Center)
            const x = gridStartX + j * cellSize + cellSize / 2;
            const z = gridStartZ + i * cellSize + cellSize / 2;

            if (val === 1) {
                const wall = new THREE.Mesh(wallGeo, wallMat);
                wall.position.set(x, wallHeight / 2, z);
                wall.isWall = true; // 標記為牆壁供感應器檢測
                
                // 為牆壁增加發光邊緣線框
                const edges = new THREE.EdgesGeometry(wallGeo);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00adb5, transparent: true, opacity: 0.5 }));
                line.position.copy(wall.position);
                line.isWall = true;
                environmentGroup.add(line);
                
                wall.castShadow = true;
                wall.receiveShadow = true;
                environmentGroup.add(wall);
            } else if (val === 2) {
                // 起點
                const landingPad = createLandingPad(x, z);
                environmentGroup.add(landingPad);
                // 設置飛機起始位置並立即同步狀態
                startPosition = { x: x, y: 0, z: z, heading: 180 };
                state.x = x; 
                state.z = z;
                state.y = 0;
                lastSafePos.x = x;
                lastSafePos.y = 0;
                lastSafePos.z = z;
                
                console.log(`📍 隧道迷宮起點已設置: (${x.toFixed(1)}, ${z.toFixed(1)})`);
            } else if (val === 3) {
                // 終點：不放置停機坪，改為移除牆壁的出口效果
                const goalLight = new THREE.PointLight(0x00ff00, 2, 500);
                goalLight.position.set(x, 50, z);
                environmentGroup.add(goalLight);
                
                // 增加一個地面標記 (可選，讓玩家知道這是出口)
                const exitMarkerGeo = new THREE.PlaneGeometry(cellSize, cellSize);
                const exitMarkerMat = new THREE.MeshBasicMaterial({ 
                    color: 0x00ff00, 
                    transparent: true, 
                    opacity: 0.2,
                    side: THREE.DoubleSide 
                });
                const exitMarker = new THREE.Mesh(exitMarkerGeo, exitMarkerMat);
                exitMarker.rotation.x = -Math.PI/2;
                exitMarker.position.set(x, 0.5, z);
                environmentGroup.add(exitMarker);

                targetPosition = { x, z };
            } else if (val === 4) {
                // 信號標記點 Beacon
                createBeacon(x, z);
            }
        }
    }
}

function createBeacon(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 50, z);

    // 標記點數據
    const beacon = {
        x: x,
        z: z,
        triggered: false,
        hoverTimer: 0,
        mesh: group
    };
    beaconData.push(beacon);

    // 核心球體
    const sphereGeo = new THREE.SphereGeometry(20, 32, 32);
    const sphereMat = new THREE.MeshPhongMaterial({ 
        color: 0x00adb5, 
        emissive: 0x00adb5, 
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(sphere);

    // 外環
    const torusGeo = new THREE.TorusGeometry(35, 2, 16, 100);
    const torusMat = new THREE.MeshBasicMaterial({ color: 0x00adb5 });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI/2;
    group.add(torus);

    // 燈光
    const light = new THREE.PointLight(0x00adb5, 1, 300);
    group.add(light);

    // 動畫邏輯
    const update = () => {
        sphere.rotation.y += 0.02;
        torus.rotation.z += 0.05;
        const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        sphere.scale.set(scale, scale, scale);
    };

    // 將更新函數加入場景循環 ( simulator.js 有一個 ruinsUpdateFunction 可借用，或自己建一個陣列)
    if (!window.mazeAnimations) window.mazeAnimations = [];
    window.mazeAnimations.push(update);

    environmentGroup.add(group);
}

// --- [核心功能] 固定配置的隧道地圖 ---
function createFixedTunnelMap() {
    // 檢查 corridor 模型是否已載入
    if (!assets.corridor) {
        console.warn("⚠️ corridor 模型未載入");
        createFreeFlightMap();
        return;
    }

    // ==========================================
    // 【隧道位置配置參數】可在這裡調整隧道的位置
    // ==========================================
    const tunnelConfig = {
        // 隧道起點位置（相對於場景中心）
        startX: 1100,           // X 軸位置（左右）
        startY: 0,           // Y 軸位置（上下，通常保持 0）
        startZ: 600,        // Z 軸位置（前後，負數表示向前延伸）
        
        // 隧道方向角度（度數）
        rotationY: 180,      // 繞 Y 軸旋轉（0=向前，180=向後）
        
        // 起始偏移量（讓隧道起點與停機坪保持距離）
        startOffset: 0,    // 單位：cm，越大隧道起點越遠
        
        // 隧道縮放
        scale: 550,          // 模型縮放倍數
        
        // 段間距調整
        segmentOverlap: 0.995 // 段之間的重疊比例（0.995 = 99.5%，稍微重疊）
    };
    // ==========================================

    // 1. 【解決問題1】加入地面網格
    const gridHelper = new THREE.GridHelper(5000, 100, 0x00adb5, 0x111111); // 青色網格
    gridHelper.position.y = 0.1;
    environmentGroup.add(gridHelper);

    // 2. 【解決問題3】加入 Holodeck 虛擬訓練室背景
    createHolodeckRoom();

    // 加入停機坪
    const landingPad = createLandingPad(0, 0);
    environmentGroup.add(landingPad);

    // 3. 定義隧道序列 - 使用 4 個 corridor 模型
    const layout = [
        'corridor',          // 段 1
        'corridor',          // 段 2
        'corridor',          // 段 3
        'corridor'           // 段 4
    ];

    // 自動計算 corridor 模型的尺寸
    const bbox = new THREE.Box3().setFromObject(assets.corridor);
    const avgSizeZ = bbox.max.z - bbox.min.z;
    
    // 設定縮放和段長度
    const scale = tunnelConfig.scale; 
    const segmentLength = avgSizeZ * scale * tunnelConfig.segmentOverlap; // 稍微重疊以確保無縫連接

    // 生成隧道
    layout.forEach((type, index) => {
        let modelTemplate = assets[type];
        if (!modelTemplate) {
            console.warn(`⚠️ 模型 ${type} 未找到，跳過`);
            return;
        }

        let segment = modelTemplate.clone();
        segment.scale.set(scale, scale, scale);
        
        // 計算每個段的位置
        // Z 軸排列：從起點開始，每個段向後延伸
        let zPos = tunnelConfig.startZ - (index * segmentLength) - tunnelConfig.startOffset;
        let xPos = tunnelConfig.startX;
        let yPos = tunnelConfig.startY;
        
        segment.position.set(xPos, yPos, zPos); 

        // 應用旋轉角度（轉換為弧度）
        segment.rotation.y = THREE.MathUtils.degToRad(tunnelConfig.rotationY);
        
        environmentGroup.add(segment);
    });
    
    console.log(`✅ 隧道已創建：${layout.length} 個段`);
    console.log(`📍 隧道位置：X=${tunnelConfig.startX}, Y=${tunnelConfig.startY}, Z=${tunnelConfig.startZ}, 旋轉=${tunnelConfig.rotationY}°`);
}

function createFreeFlightMap() {
    createHolodeckRoom(); // 自由飛行也加入 Holodeck
    const gridHelper = new THREE.GridHelper(5000, 100, 0x00adb5, 0x242832);
    environmentGroup.add(gridHelper);
    
    startPosition = { x: 0, y: 0, z: 0, heading: 180 };
    const landingPad = createLandingPad(0, 0);
    environmentGroup.add(landingPad);
    
    const coneGeo = new THREE.ConeGeometry(10, 30, 32);
    const coneMat = new THREE.MeshPhongMaterial({ color: 0x00adb5 });
    [{x:200, z:-200}, {x:-200, z:-200}, {x:200, z:200}, {x:-200, z:200}].forEach(pos => {
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(pos.x, 15, pos.z);
        environmentGroup.add(cone);
    });
}

// --- 地形高度計算函數：加入區域整平 (Terraforming) ---
// --- 地形高度計算函數：加入區域整平 (Terraforming) ---
function getForestHeight(x, z) {
    const distToCenter = Math.sqrt(x * x + z * z);
    
    // 檢查座標落在哪個格子內 (使用緩衝範圍判斷，確保整塊格位平整)
    if (currentMazeGrid && currentCellSize) {
        // 檢查中心及四個角落，只要靠近特殊格位就整平
        const checkPoints = [[0,0], [60,60], [-60,60], [60,-60], [-60,-60]];
        for (let p of checkPoints) {
            const gx = Math.floor((x + p[0] - mazeOffsetX) / currentCellSize);
            const gz = Math.floor((z + p[1] - mazeOffsetZ) / currentCellSize);
            
            if (gz >= 0 && gz < currentMazeGrid.length && gx >= 0 && gx < currentMazeGrid[0].length) {
                const val = currentMazeGrid[gz][gx];
                if (val === 5) return -45; // 水源盆地
                if (val === 2 || val === 3) return 0; // 平台地基
            }
        }
    }

    // 基本起伏地形
    if (distToCenter < 400) return 0;

    const wave1 = Math.sin(x * 0.0015) * Math.cos(z * 0.0015) * 150;
    const wave2 = Math.sin(x * 0.003) * 30;
    const wave3 = Math.cos(z * 0.002) * 20;
    const mountainEdge = distToCenter > 2200 ? (distToCenter - 2200) * 0.15 : 0;
    
    return wave1 + wave2 + wave3 + mountainEdge;
}

// --- 生成更自然的森林草地紋理 ---
function createForestTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 底色：深森林綠 (降低飽和度)
    ctx.fillStyle = '#1e351a';
    ctx.fillRect(0, 0, size, size);

    // 加入隨機泥土與草叢斑點 (Organic Noise)
    for (let i = 0; i < 6000; i++) {
        const rx = Math.random() * size;
        const ry = Math.random() * size;
        const rs = 1 + Math.random() * 3;
        const rand = Math.random();
        if (rand > 0.7) ctx.fillStyle = '#2a441e'; // 草地綠
        else if (rand > 0.3) ctx.fillStyle = '#162b12'; // 深綠影
        else ctx.fillStyle = '#3d2b1f'; // 泥土棕
        ctx.fillRect(rx, ry, rs, rs);
    }

    // 極淡的網格線 (輔助用，不應干擾視覺)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    return canvas;
}

function createCityMap() {
    // 森林場景不使用平坦的 Holodeck 房間
    // 1. 山火煙霧大氣效果
    scene.fog = new THREE.FogExp2(0x332211, 0.0005); 

    // 1.2 建立寫實森林材質
    const gridTex = new THREE.CanvasTexture(createForestTexture());
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
    gridTex.repeat.set(8000/150, 8000/150); 

    // 1.5 加入實體地面 (提升解析度至 128x128)
    const groundGeo = new THREE.PlaneGeometry(8000, 8000, 128, 128);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        const height = getForestHeight(vx, -vy);
        posAttr.setZ(i, height); 
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshPhongMaterial({ 
        map: gridTex,
        side: THREE.DoubleSide,
        flatShading: true,
        shininess: 2
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true; 
    environmentGroup.add(ground);

    // 2. 大型森林地圖設計 (16x16)
    const forestGrid = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 0, 0, 0, 0, 0, 1, 1, 4, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
        [1, 0, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
        [1, 0, 1, 0, 1, 4, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
        [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 4, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];

    const cellSize = 150; 
    const offsetX = -(forestGrid[0].length * cellSize) / 2;
    const offsetZ = -(forestGrid.length * cellSize) / 2;

    currentMazeGrid = forestGrid;
    currentCellSize = cellSize;
    mazeOffsetX = offsetX;
    mazeOffsetZ = offsetZ;

    for (let i = 0; i < forestGrid.length; i++) {
        for (let j = 0; j < forestGrid[i].length; j++) {
            const val = forestGrid[i][j];
            const x = j * cellSize + offsetX + cellSize/2;
            const z = i * cellSize + offsetZ + cellSize/2;
            const h = getForestHeight(x, z);

            if (val === 1) {
                // --- 物理碰撞強化：增加隱形格位碰撞盒 ---
                // 確保整格 150x150cm 區域都是實體障礙，無人機無法從樹縫穿過
                const wallBoxGeo = new THREE.BoxGeometry(cellSize, 400, cellSize);
                const wallBoxMat = new THREE.MeshBasicMaterial({ visible: false }); // 隱形
                const wallBox = new THREE.Mesh(wallBoxGeo, wallBoxMat);
                wallBox.position.set(x, 200, z);
                wallBox.isWall = true; 
                environmentGroup.add(wallBox);

                // 判斷是否靠近任何火源
                let isBurnt = false;
                for (let row = 0; row < forestGrid.length; row++) {
                    for (let col = 0; col < forestGrid[row].length; col++) {
                        if (forestGrid[row][col] === 4) {
                            const fx = col * cellSize + offsetX + cellSize/2;
                            const fz = row * cellSize + offsetZ + cellSize/2;
                            const distToFire = Math.sqrt(Math.pow(x - fx, 2) + Math.pow(z - fz, 2));
                            if (distToFire < cellSize * 1.5) {
                                isBurnt = true;
                                break;
                            }
                        }
                    }
                    if (isBurnt) break;
                }

                if (isBurnt && (assets.stump || assets.log)) {
                    // 靠近火源：放置焦黑枯木
                    const burntModel = (Math.random() > 0.5 ? assets.stump : assets.log).clone();
                    const bx = x + (Math.random()-0.5)*40;
                    const bz = z + (Math.random()-0.5)*40;
                    const bh = getForestHeight(bx, bz);
                    burntModel.position.set(bx, bh - 5, bz); // 稍微往下一點點，讓根部埋入土中
                    burntModel.rotation.y = Math.random() * Math.PI * 2;
                    burntModel.scale.set(130, 130, 130);
                    // 變色處理
                    burntModel.traverse(child => {
                        if (child.isMesh) {
                            child.material = child.material.clone();
                            child.material.color.setHex(0x222222); // 焦黑色
                        }
                    });
                    burntModel.isWall = true;
                    environmentGroup.add(burntModel);
                } else {
                    // 正常的集群生成
                    const count = 3 + Math.floor(Math.random() * 4);
                    for (let k = 0; k < count; k++) {
                        let model;
                        const type = Math.random();
                        let s = 100;

                        if (type > 0.7 && assets.tree_pine) {
                            model = assets.tree_pine.clone();
                            s = 150 + Math.random() * 100;
                        } else if (type > 0.4 && assets.tree_oak) {
                            model = assets.tree_oak.clone();
                            s = 100 + Math.random() * 80;
                        } else if (type > 0.2 && assets.bush) {
                            model = assets.bush.clone();
                            s = 60 + Math.random() * 60;
                        } else if (assets.rock) {
                            model = assets.rock.clone();
                            s = 40 + Math.random() * 60;
                        }

                        if (model) {
                            const ox = (Math.random() - 0.5) * cellSize * 0.8;
                            const oz = (Math.random() - 0.5) * cellSize * 0.8;
                            const finalX = x + ox;
                            const finalZ = z + oz;
                            const finalH = getForestHeight(finalX, finalZ);
                            model.position.set(finalX, finalH - 5, finalZ);
                            model.rotation.y = Math.random() * Math.PI * 2;
                            model.scale.set(s, s, s);
                            
                            // --- 強化樹木碰撞偵測 ---
                            // 只要是樹木或大石頭 (val === 1 產生的物件)，全部設為牆壁
                            model.isWall = true;
                            // 增加一個碰撞體屬性，用於後續更精確的圓柱體碰撞檢測
                            model.obstacleRadius = (s / 100) * 25; 
                            
                            environmentGroup.add(model);
                        }
                    }
                }
            } else if (val === 0) {
                // 路徑裝飾
                if (Math.random() > 0.8 && assets.grass) {
                    const grass = assets.grass.clone();
                    grass.scale.set(50, 50, 50);
                    const gx = x + (Math.random()-0.5)*80;
                    const gz = z + (Math.random()-0.5)*80;
                    const gh = getForestHeight(gx, gz);
                    grass.position.set(gx, gh, gz);
                    environmentGroup.add(grass);
                }
            } else if (val === 2 || val === 3) {
                // --- 森林救援木製平台 (替換原本的 H 停機坪) ---
                const h = getForestHeight(x, z);
                const platformGroup = new THREE.Group();
                platformGroup.position.set(x, h, z);
                environmentGroup.add(platformGroup);

                // 主平台 (木板質感)
                const plateGeo = new THREE.BoxGeometry(cellSize * 0.8, 8, cellSize * 0.8);
                const plateMat = new THREE.MeshPhongMaterial({ 
                    color: val === 2 ? 0x5d4037 : 0x2e7d32, // 起點深木色，終點深綠色
                    flatShading: true 
                });
                const plate = new THREE.Mesh(plateGeo, plateMat);
                plate.position.y = 4;
                platformGroup.add(plate);

                // 平台上的標記 (淡色半透明方塊)
                const markerGeo = new THREE.PlaneGeometry(cellSize * 0.5, cellSize * 0.5);
                const markerMat = new THREE.MeshBasicMaterial({ 
                    color: 0xffffff, 
                    transparent: true, 
                    opacity: 0.2,
                    side: THREE.DoubleSide 
                });
                const marker = new THREE.Mesh(markerGeo, markerMat);
                marker.rotation.x = -Math.PI/2;
                marker.position.y = 8.1;
                platformGroup.add(marker);

                // 四角的支撐圓木
                const legGeo = new THREE.CylinderGeometry(8, 8, 30, 8);
                const legMat = new THREE.MeshPhongMaterial({ color: 0x3e2723 });
                [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(dir => {
                    const leg = new THREE.Mesh(legGeo, legMat);
                    leg.position.set(dir[0] * cellSize * 0.35, -5, dir[1] * cellSize * 0.35);
                    platformGroup.add(leg);
                });

                if (val === 2) {
                    startPosition = { x, y: h + 15, z, heading: 180 };
                    spawnPosition = { ...startPosition };
                    state.x = x; state.z = z; state.y = h + 15;
                    lastSafePos = { x, y: h + 15, z };
                } else {
                    targetPosition = { x, z };
                }
            } else if (val === 4) {
                // --- 寫實火場設計 (恢復代碼) ---
                const h = getForestHeight(x, z);
                const fireGroup = new THREE.Group();
                fireGroup.position.set(x, h, z);
                environmentGroup.add(fireGroup);

                // 1. 營火燃料基底
                if (assets.campfire_logs) {
                    const logs = assets.campfire_logs.clone();
                    logs.scale.set(80, 80, 80);
                    logs.position.y = 2;
                    fireGroup.add(logs);
                }

                // 2. 多重火焰核心 (加法混合效果)
                const createFlameLayer = (size, height, color, speed) => {
                    const geo = new THREE.ConeGeometry(size, height, 8);
                    const mat = new THREE.MeshBasicMaterial({ 
                        color: color, 
                        transparent: true, 
                        opacity: 0.6,
                        blending: THREE.AdditiveBlending,
                        side: THREE.DoubleSide
                    });
                    const layer = new THREE.Mesh(geo, mat);
                    layer.position.y = height/2;
                    fireGroup.add(layer);
                    window.mazeAnimations.push(() => {
                        layer.rotation.y += speed;
                        layer.scale.x = layer.scale.z = 1 + Math.sin(Date.now() * 0.01) * 0.1;
                    });
                    return layer;
                };

                createFlameLayer(35, 90, 0xff4400, 0.05); 
                createFlameLayer(25, 70, 0xffaa00, -0.07);
                createFlameLayer(15, 45, 0xffffff, 0.1); 

                // 3. 點亮動態火光
                const fireLight = new THREE.PointLight(0xff6600, 4, 400);
                fireLight.position.y = 60;
                fireGroup.add(fireLight);
                window.mazeAnimations.push(() => {
                    fireLight.intensity = 3 + Math.random() * 2;
                });

                // 4. 煙霧粒子
                for (let m = 0; m < 4; m++) {
                    const smokeGeo = new THREE.SphereGeometry(15, 8, 8);
                    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.4 });
                    const smoke = new THREE.Mesh(smokeGeo, smokeMat);
                    fireGroup.add(smoke);
                    const offset = m * 50;
                    window.mazeAnimations.push(() => {
                        const t = (Date.now() * 0.1 + offset) % 400;
                        smoke.position.y = 60 + t * 0.8;
                        smoke.position.x = Math.sin(t * 0.05) * 20;
                        smoke.scale.setScalar(1 + t * 0.01);
                        smoke.material.opacity = 0.4 * (1 - t / 400);
                    });
                }
            } else if (val === 5) {
                // --- 寫實水源設計 (整平後精確對齊) ---
                const waterH = -44; // 盆地深度為 -45，水面放在 -44 完美嵌入
                const lakeGroup = new THREE.Group();
                lakeGroup.position.set(x, waterH, z);
                environmentGroup.add(lakeGroup);

                const lakeGeo = new THREE.CircleGeometry(cellSize * 0.45, 32); // 縮小一點點，確保在整平區域內
                const lakeMat = new THREE.MeshStandardMaterial({ 
                    color: 0x004488, 
                    metalness: 0.9,
                    roughness: 0.1,
                    transparent: true,
                    opacity: 0.8
                });
                const lake = new THREE.Mesh(lakeGeo, lakeMat);
                lake.rotation.x = -Math.PI/2;
                lake.isWaterSource = true;
                lakeGroup.add(lake);

                // 池邊碎石也對齊盆地高度
                if (assets.rock_flat) {
                    for (let k = 0; k < 10; k++) {
                        const r = assets.rock_flat.clone();
                        const angle = (k / 10) * Math.PI * 2;
                        const dist = cellSize * 0.48; // 碎石貼著水邊，但還在整平格內
                        r.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
                        r.scale.set(40, 20, 40);
                        r.rotation.y = Math.random() * Math.PI;
                        lakeGroup.add(r);
                    }
                }

                // 睡蓮浮在水面
                if (assets.lily) {
                    for (let l = 0; l < 6; l++) {
                        const lily = assets.lily.clone();
                        const ang = Math.random() * Math.PI * 2;
                        const d = cellSize * 0.35 * Math.random();
                        lily.position.set(Math.cos(ang)*d, 0.5, Math.sin(ang)*d);
                        lily.scale.set(45, 45, 45);
                        lakeGroup.add(lily);
                    }
                }
            }
        }
    }
    console.log("🌲 起伏山脈森林火場已載入");
}

// ==========================================
// 4. 共用幾何與工具
// ==========================================

// --- [新功能] 建立 Holodeck 虛擬空間 ---
function createHolodeckRoom() {
    // 建立一個巨大的立方體，但貼圖貼在「內部」(BackSide)
    // 這樣我們就像被包在一個大盒子裡
    const size = 6000;
    const geometry = new THREE.BoxGeometry(size, size/2, size); // 高度矮一點沒關係
    
    // 動態生成電子網格貼圖
    const texture = new THREE.CanvasTexture(createHolodeckTexture());
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 10); // 讓網格重複多次

    const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        side: THREE.BackSide, // 關鍵：顯示內面
        transparent: true,
        opacity: 0.3 // 半透明，比較有科技感
    });

    const room = new THREE.Mesh(geometry, material);
    room.position.y = size/4; // 往上提，讓地板剛好在 0
    environmentGroup.add(room);
}

// 生成電子網格貼圖的 Canvas (平衡版)
function createHolodeckTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // 背景深灰藍
    ctx.fillStyle = '#1a1c23';
    ctx.fillRect(0, 0, size, size);

    // 網格線 (深青色)
    ctx.strokeStyle = '#005566';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, size, size); // 外框
    
    // 十字線
    ctx.beginPath();
    ctx.moveTo(size/2, 0); ctx.lineTo(size/2, size);
    ctx.moveTo(0, size/2); ctx.lineTo(size, size/2);
    ctx.stroke();

    return canvas;
}

function createLandingPad(x, z) {
    const canvas = createLandingPadTexture();
    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(40, 40);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    const pad = new THREE.Mesh(geometry, material);
    pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.2, z);   
    return pad;
}

function createLandingPadTexture() {
    const size = 512; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, size, size);
    const cx = size/2, cy = size/2;
    ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI*2); ctx.fillStyle='#333'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 220, 0, Math.PI*2); ctx.strokeStyle='#333'; ctx.lineWidth=10; ctx.setLineDash([25,15]); ctx.stroke();
    ctx.font='bold 280px Arial'; ctx.fillStyle='#ccff00'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('H', cx, cy+20);
    return canvas;
}

// 建立無人機模型
function createDroneModel() {
    droneGroup = new THREE.Group();
    
    // 如果已載入 GLB 模型，使用它；否則使用預設幾何體
    if (assets.drone) {
        console.log("✅ 使用載入的無人機 GLB 模型");
        const droneModel = assets.drone.clone();
        
        // 計算模型的邊界框以確定大小
        const bbox = new THREE.Box3().setFromObject(droneModel);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        
        console.log(`📏 模型尺寸: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
        console.log(`📍 模型中心: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`);
        
        // 修正：處理模型尺寸為 0 的極端情況，防止縮放係數變為 Infinity
        let scaleFactor = 1.0;
        if (size.x > 0 && size.y > 0 && size.z > 0) {
            const targetSize = 20; // 目標大小約 20 厘米
            scaleFactor = targetSize / Math.max(size.x, size.y, size.z);
        } else {
            console.warn("⚠️ 無人機模型尺寸異常，使用預設縮放");
            scaleFactor = 5.0; // 預設一個合理的縮放值
        }
        
        console.log(`🔧 應用縮放: ${scaleFactor.toFixed(3)}`);
        
        // 調整模型大小和位置
        droneModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // 【終極修正】確保無人機底部絕對對齊地面
        // 先計算縮放後的邊界
        const scaledMinY = bbox.min.y * scaleFactor;
        const scaledCenterX = center.x * scaleFactor;
        const scaledCenterZ = center.z * scaleFactor;

        // 旋轉
        droneModel.rotation.y = -Math.PI / 2;
        
        // 核心對齊：
        // 1. X, Z 對齊中心 (取負值)
        // 2. Y 軸：直接減去縮放後的最小值，這會將模型底部移到 0
        // 3. 再加 1.0 確保完全浮出地面
        droneModel.position.set(-scaledCenterX, -scaledMinY + 1.0, -scaledCenterZ);
        
        console.log(`📍 模型定位校準: Offset Y = ${(-scaledMinY + 1.0).toFixed(2)}`);
        
        // 遍歷模型並收集所有網格信息
        let meshCount = 0;
        const meshNames = [];
        const allMeshes = [];
        let highestY = -Infinity;
        let ledMeshCandidate = null;
        
        // 第一遍遍歷：收集所有網格並找到最高的（LED）
        droneModel.traverse(child => {
            if (child.isMesh) {
                meshCount++;
                const meshName = child.name || `Mesh_${meshCount}`;
                meshNames.push(meshName);
                
                // 計算網格的世界位置
                const bbox = new THREE.Box3().setFromObject(child);
                const center = bbox.getCenter(new THREE.Vector3());
                const worldPos = new THREE.Vector3();
                child.getWorldPosition(worldPos);
                
                allMeshes.push({
                    mesh: child,
                    name: meshName,
                    bbox: bbox,
                    center: center,
                    worldY: worldPos.y
                });
                
                // 找到最高的網格作為 LED 候選
                if (worldPos.y > highestY) {
                    highestY = worldPos.y;
                    ledMeshCandidate = child;
                }
            }
        });
        
        console.log(`📊 模型網格總數: ${meshCount}`);
        console.log(`📋 網格名稱: ${meshNames.join(', ')}`);
        
        // 第二遍遍歷：設置材質
        // 先識別螺旋槳，排除它們不被當作LED
        const propMeshes = [];
        allMeshes.forEach(({mesh: child, name}) => {
            const nameLower = name.toLowerCase();
            const isProp = nameLower.includes('prop') || 
                          nameLower.includes('propeller') || 
                          nameLower.includes('blade');
            if (isProp) {
                propMeshes.push(child);
            }
        });
        
        // 現在設置材質
        allMeshes.forEach(({mesh: child, name, worldY}) => {
            child.castShadow = true;
            child.receiveShadow = true;
            
            const nameLower = name.toLowerCase();
            
            // 先檢查是否是螺旋槳（優先級最高）
            const isProp = propMeshes.includes(child) ||
                          nameLower.includes('prop') || 
                          nameLower.includes('propeller') || 
                          nameLower.includes('blade');
            
            // LED 檢查：必須是最高的，且不是螺旋槳
            const isLED = !isProp && 
                         (child === ledMeshCandidate || 
                          nameLower.includes('led') || 
                          nameLower.includes('lightcase'));
            
            if (isProp) {
                // 螺旋槳：設置固定顏色，稍後會根據位置設置紅/黑
                propellers.push(child);
                console.log(`🌀 找到螺旋槳: ${name}`);
                
                // 確保螺旋槳材質是固定的，不會被LED控制影響
                if (child.material) {
                    // 先設置為默認顏色，稍後會根據位置設置
                    const propMaterial = new THREE.MeshBasicMaterial({
                        color: 0x111111, // 默認黑色
                        transparent: true,
                        opacity: 0.9
                    });
                    child.material = propMaterial;
                }
            } else if (isLED) {
                // LED 部分：設置為可發光的白色材質（可變色）
                if (!droneLedMesh) { // 只設置第一個找到的LED
                    droneLedMesh = child;
                    console.log(`💡 找到 LED 網格: ${name} (Y: ${worldY.toFixed(2)})`);
                    
                if (child.material) {
                    // 創建LED材質，默認關閉（接近透明的白色）
                    const ledMaterial = new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0.1  // 接近透明的白色
                    });
                    child.material = ledMaterial;
                }
                } else {
                    // 如果已經找到LED，其他可能是LED的部分也設為黑色
                    if (child.material) {
                        const bodyMaterial = new THREE.MeshPhongMaterial({
                            color: 0x111111, // 非常黑的黑色
                            shininess: 30,
                            specular: 0x050505
                        });
                        child.material = bodyMaterial;
                        console.log(`⚫ LED候選但已設置其他，設為黑色: ${name}`);
                    }
                }
             } else {
                 // 其他部分：設置為亮銀灰色，並強制關閉透明，增加自發光
                 if (child.material) {
                     child.material = new THREE.MeshPhongMaterial({
                         color: 0x999999, // 亮銀色
                         shininess: 100,
                         specular: 0xffffff,
                         emissive: 0x222222,
                         emissiveIntensity: 0.5,
                         transparent: false,
                         opacity: 1.0,
                         side: THREE.DoubleSide // 確保正反面都渲染
                     });
                 }
             }
        });
        
        droneGroup.add(droneModel);
        console.log(`✅ 無人機模型已添加到場景`);
        
        // 如果沒有找到 LED 網格，創建一個（默認關閉狀態）
        if (!droneLedMesh) {
            console.log(`⚠️ 未找到LED網格，創建預設LED`);
            droneLedMesh = new THREE.Mesh(
                new THREE.SphereGeometry(4, 32, 16), 
                new THREE.MeshBasicMaterial({ 
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.1  // 接近透明的白色（關閉狀態）
                })
            );
            droneLedMesh.scale.set(1, 0.2, 1.3);
            // 將LED放在模型頂部
            const bbox = new THREE.Box3().setFromObject(droneModel);
            const topY = bbox.max.y * droneModel.scale.y;
            droneLedMesh.position.set(0, topY + 0.5, 0);
            droneGroup.add(droneLedMesh);
        }
        
        // LED 燈光（用於照亮環境），默認關閉
        droneLedLight = new THREE.PointLight(0xffffff, 0, 40);  // 強度設為 0（關閉）
        // 將燈光放在LED位置
        if (droneLedMesh) {
            const ledPos = new THREE.Vector3();
            droneLedMesh.getWorldPosition(ledPos);
            droneLedLight.position.copy(ledPos);
        } else {
            droneLedLight.position.set(0, 5, 0);
        }
        droneGroup.add(droneLedLight);
        
        // 設置螺旋槳顏色（如果找到了螺旋槳）
        if (propellers.length > 0) {
            console.log(`🌀 找到 ${propellers.length} 個螺旋槳，設置顏色...`);
            
            // 收集所有螺旋槳的位置信息
            const propPositions = propellers.map((prop, index) => {
                const worldPos = new THREE.Vector3();
                prop.getWorldPosition(worldPos);
                return { prop, index, x: worldPos.x, z: worldPos.z };
            });
            
            // 由於模型已順時針旋轉90度，現在需要根據旋轉後的位置判斷
            // 旋轉後：原來的Z軸變成-X軸，原來的X軸變成Z軸
            // 所以應該按Z值排序：Z值小的（前方）為紅色，Z值大的（後方）為黑色
            propPositions.sort((a, b) => {
                // 按Z排序（前後），Z值越小越靠前
                return a.z - b.z;
            });
            
            console.log(`📍 螺旋槳位置排序（旋轉後，Z值從小到大，即前到後）:`);
            propPositions.forEach((p, i) => {
                console.log(`  ${i}: X=${p.x.toFixed(2)}, Z=${p.z.toFixed(2)}`);
            });
            
            // 前兩個（Z值較小）設為紅色，後兩個（Z值較大）設為黑色
            propPositions.forEach(({prop, index}, sortedIndex) => {
                let color;
                if (sortedIndex < 2) {
                    color = 0xff0000; // 紅色（前方）
                } else {
                    color = 0x111111; // 黑色（後方）
                }
                
                if (prop.material) {
                    // 確保使用固定材質，不會被LED控制影響
                    const propMaterial = new THREE.MeshBasicMaterial({
                        color: color,
                        transparent: true,
                        opacity: 0.9
                    });
                    prop.material = propMaterial;
                    console.log(`  - 螺旋槳 ${index} (排序${sortedIndex}): ${color === 0xff0000 ? '紅色' : '黑色'} (位置: x=${propPositions[sortedIndex].x.toFixed(2)}, z=${propPositions[sortedIndex].z.toFixed(2)})`);
                }
            });
        } else {
            // 如果沒有找到螺旋槳，創建預設的
            console.log(`⚠️ 未找到螺旋槳，創建預設螺旋槳`);
            const armConfig = [
                {x:-9, z:-9, c:0xff0000}, // 前左 - 紅色
                {x:9, z:-9, c:0xff0000},  // 前右 - 紅色
                {x:-9, z:9, c:0x111111},  // 後左 - 黑色
                {x:9, z:9, c:0x111111}    // 後右 - 黑色
            ];
            const frameMat = new THREE.MeshPhongMaterial({ color: 0x111111, flatShading: false }); // 非常黑的黑色
            armConfig.forEach((pos, index) => {
                const prop = new THREE.Mesh(
                    new THREE.BoxGeometry(10, 0.15, 0.8), 
                    new THREE.MeshBasicMaterial({color: pos.c, transparent:true, opacity:0.9})
                );
                prop.position.set(pos.x, 1.6, pos.z);
                propellers.push(prop);
                droneGroup.add(prop);
            });
        }
    } else {
        // 使用預設幾何體（原有邏輯）
        console.log("⚠️ 使用預設幾何體創建無人機");
        const elevation = 1.5; 
        const frameMat = new THREE.MeshPhongMaterial({ color: 0x222222, flatShading: false });
        
        // 機身
        const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.5, 32), frameMat);
        body.scale.set(1, 1, 1.4); body.castShadow = true; body.position.set(0, elevation, 0); 
        droneGroup.add(body);
        
        // LED（默認關閉狀態：接近透明的白色）
        droneLedMesh = new THREE.Mesh(
            new THREE.SphereGeometry(4, 32, 16), 
            new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.1  // 接近透明的白色（關閉狀態）
            })
        );
        droneLedMesh.scale.set(1, 0.2, 1.3); 
        droneLedMesh.position.set(0, 1.3+elevation, 0); 
        droneGroup.add(droneLedMesh);
        droneLedLight = new THREE.PointLight(0xffffff, 0, 40);  // 強度設為 0（關閉）
        droneLedLight.position.set(0, 5+elevation, 0); 
        droneGroup.add(droneLedLight);
        
        // 螺旋槳
        const armConfig = [{x:-9, z:-9, c:0xff0000}, {x:9, z:-9, c:0xff0000}, {x:-9, z:9, c:0x111111}, {x:9, z:9, c:0x111111}];
        armConfig.forEach(pos => {
            const guard = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.3, 8, 32), frameMat);
            guard.rotation.x = Math.PI/2; guard.position.set(pos.x, elevation, pos.z); 
            droneGroup.add(guard);
            
            const prop = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 0.8), new THREE.MeshBasicMaterial({color: pos.c, transparent:true, opacity:0.9}));
            prop.position.set(pos.x, 1.6+elevation, pos.z); 
            propellers.push(prop); 
            droneGroup.add(prop);
        });
    }
    
    scene.add(droneGroup);
}

// --- 物理邏輯與感測器 ---

function handleWallCollision() {
    if (!currentMazeGrid) return;

    // 森林場景樹木較高 (400cm)，隧道場景牆壁較矮 (120cm)
    const wallHeightLimit = currentSceneType === 'city' ? 420 : 125;
    if (state.y > wallHeightLimit) {
        lastSafePos.x = state.x;
        lastSafePos.z = state.z;
        return;
    }

    const droneRadius = 15; // 稍微增加碰撞半徑，更符合視覺感受
    
    // 檢查點：中心、前、後、左、右
    const checkPoints = [
        { x: state.x, z: state.z },
        { x: state.x + droneRadius, z: state.z },
        { x: state.x - droneRadius, z: state.z },
        { x: state.x, z: state.z + droneRadius },
        { x: state.x, z: state.z - droneRadius }
    ];

    let isCollidingX = false;
    let isCollidingZ = false;

    const gridStartX = mazeOffsetX;
    const gridStartZ = mazeOffsetZ;

    // 分開檢查 X 方向
    for (let pt of checkPoints) {
        const j = Math.floor((pt.x - gridStartX) / currentCellSize);
        const i = Math.floor((state.z - gridStartZ) / currentCellSize); 
        if (i >= 0 && i < currentMazeGrid.length && j >= 0 && j < currentMazeGrid[0].length) {
            if (currentMazeGrid[i][j] === 1) { isCollidingX = true; break; }
        }
    }

    // 分開檢查 Z 方向
    for (let pt of checkPoints) {
        const j = Math.floor((state.x - gridStartX) / currentCellSize); 
        const i = Math.floor((pt.z - gridStartZ) / currentCellSize);
        if (i >= 0 && i < currentMazeGrid.length && j >= 0 && j < currentMazeGrid[0].length) {
            if (currentMazeGrid[i][j] === 1) { isCollidingZ = true; break; }
        }
    }

    if (isCollidingX || isCollidingZ) {
        if (isCollidingX) state.x = lastSafePos.x;
        if (isCollidingZ) state.z = lastSafePos.z;
        
        // 增加碰撞視覺/聲音反饋的標記
        if (!state.collisionDetected) {
            console.warn("💥 Collision detected!");
        state.collisionDetected = true;
            // 可以在這裡加入震動相機或閃紅光效果
        }
    } else {
        lastSafePos.x = state.x;
        lastSafePos.z = state.z;
    }
}

function checkMissionLogic() {
    // 即使降落了也應該檢查最後一次出口，或者只要是任務模式就持續檢查
    if (currentSceneType !== 'tunnel' && currentSceneType !== 'challenge_maze') return;

    // 1. 起飛計時 (僅在未完成時計時)
    if (!state.missionCompleted) {
        if (takeoffTime === 0 && state.y > 10) {
            takeoffTime = Date.now();
            logToConsole("⏱️ 任務計時開始！");
        }
    }

    // 2. 標記點觸發檢查 (只有飛行中且未完成才檢查) - 僅隧道迷宮有標記點
    if (currentSceneType === 'tunnel' && state.isFlying && !state.missionCompleted) {
        beaconData.forEach(beacon => {
            if (beacon.triggered) return;

            const dist = Math.sqrt(Math.pow(state.x - beacon.x, 2) + Math.pow(state.z - beacon.z, 2));
            const heightDiff = Math.abs(state.y - 50);

            // 放寬觸發範圍：半徑 70cm，高度差 45cm
            if (dist < 70 && heightDiff < 45) {
                beacon.hoverTimer += 0.02; // 稍微加快計時補償幀率波動
                if (beacon.hoverTimer >= 3.0) { 
                    beacon.triggered = true;
                    beaconsTriggered++;
                    currentScore += 100;
                    logToConsole(`✅ 標記點啟動！(+100分) 目前已啟動: ${beaconsTriggered}/3`);
                    
                    if (beacon.mesh) {
                    beacon.mesh.traverse(child => {
                            if (child.isMesh && child.material) {
                                child.material.color.setHex(0xffff00); // 變為金色
                                if (child.material.emissive) {
                                    child.material.emissive.setHex(0xffff00);
                                    child.material.emissiveIntensity = 1.0;
                                }
                            }
                    });
                    }
                }
            } else {
                beacon.hoverTimer = 0;
            }
        });
    }

    // 3. 終點出口檢查 (放寬條件：只要進入區域，不論是否飛行)
    const distToExit = Math.sqrt(Math.pow(state.x - targetPosition.x, 2) + Math.pow(state.z - targetPosition.z, 2));
    
    if (distToExit < 120 && !state.missionCompleted && takeoffTime !== 0) {
        state.missionCompleted = true;
        state.endTime = Date.now(); 
        
        const timeElapsed = Math.floor((state.endTime - takeoffTime) / 1000);
        const timeBonus = Math.max(0, (300 - timeElapsed) * 2);
        const finalScore = (currentSceneType === 'challenge_maze' ? 500 : 200) + (beaconsTriggered * 100) + timeBonus;
        
        console.log("🏁 成功抵達出口！正在結算成績...");
        logToConsole("🏁 成功抵達出口！正在結算成績...");
        
        state.stopSignal = true;
        state.isRunning = false;

        setTimeout(() => {
            console.log("⏳ 準備調用 showResultModal...");
            if (typeof window.showResultModal === 'function') {
                window.showResultModal({
                    beacons: beaconsTriggered,
                    beaconsScore: beaconsTriggered * 100,
                    exitScore: (currentSceneType === 'challenge_maze' ? 500 : 200),
                    time: timeElapsed,
                    timeBonus: Math.floor(timeBonus),
                    total: Math.floor(finalScore)
                });
            } else {
                alert(`任務完成！總得分：${Math.floor(finalScore)}`);
            }
        }, 800);
    }
}

function getGroundHeight(x, z) {
    return 0; 
}
// 任務二邏輯變數
let waterLoaded = false;
let firesExtinguished = 0;
let batteryLife = 120; // 120秒

function checkCityLogic() {
    if (currentSceneType !== 'city') return;
    if (!state.isFlying || state.missionCompleted) return;

    // 1. 電力消耗邏輯
    if (takeoffTime > 0) {
        const elapsed = (Date.now() - takeoffTime) / 1000;
        batteryLife = Math.max(0, 120 - elapsed);
        if (batteryLife <= 0) {
            logToConsole("⚠️ 電力耗盡！無人機墜毀。");
            if (typeof emergencyStop === 'function') emergencyStop();
            return;
        }
    }

    // 2. 補給站檢查 (400, 400)
    const distToWater = Math.sqrt(Math.pow(state.x - 400, 2) + Math.pow(state.z - 400, 2));
    if (distToWater < 100 && state.y < 30 && !waterLoaded) {
        waterLoaded = true;
        logToConsole("💧 滅火劑裝載完成！(重量增加，速度減半)");
        executionSpeed = 0.5; // 限制執行速度
        if(droneLedMesh) {
            droneLedMesh.material.color.setHex(0x0044ff);
            droneLedMesh.material.opacity = 1.0;
        }
    }

    // 3. 火源投彈檢查
    const fires = [
        { x: -600, z: -600 },
        { x: 0, z: -800 },
        { x: 600, z: -600 }
    ];

    fires.forEach((f, i) => {
        const dist = Math.sqrt(Math.pow(state.x - f.x, 2) + Math.pow(state.z - f.z, 2));
        // 必須在 80-120cm 高度投彈才有效
        if (dist < 100 && state.y > 80 && state.y < 150 && waterLoaded) {
            // 模擬滅火過程
            // logToConsole(`🔥 火源 ${i+1} 正在被撲滅...`);
        }
    });
}
function getSensorReading(type, unit) {
    let value = 0;
    
    // 如果沒有迷宮網格，回傳預設值
    if (!currentMazeGrid) {
        if (type === 'bottom') value = Math.max(0, state.y);
        else value = 500; // 很大的一個數值
    } else {
        // 實作強化的射線檢測
        const rayOriginY = state.y < 10 ? 40 : state.y; 
        const dronePos = new THREE.Vector3(state.x, rayOriginY, state.z);
        const rad = THREE.MathUtils.degToRad(state.heading);
        let rayDirection;

        if (type === 'front') {
            rayDirection = new THREE.Vector3(-Math.sin(rad), 0, -Math.cos(rad));
        } else if (type === 'left') {
            const leftRad = rad + Math.PI / 2;
            rayDirection = new THREE.Vector3(-Math.sin(leftRad), 0, -Math.cos(leftRad));
        } else if (type === 'right') {
            const rightRad = rad - Math.PI / 2;
            rayDirection = new THREE.Vector3(-Math.sin(rightRad), 0, -Math.cos(rightRad));
        } else if (type === 'bottom') {
            value = Math.max(0, state.y);
            if (unit === 'mm') value *= 10; else if (unit === 'm') value /= 100; else if (unit === 'in') value /= 2.54;
            return parseFloat(value.toFixed(2));
        }

        // 核心修正：將射線起點稍微向後移 10cm，確保不會因為中心點剛好在牆壁邊緣而穿過牆壁面
        // 同時將方向向量正規化
        const dir = rayDirection.normalize();
        const safeOrigin = dronePos.clone().add(dir.clone().multiplyScalar(-15)); 
        
        const raycaster = new THREE.Raycaster(safeOrigin, dir);
        // 限制檢測距離為 1000cm (10m)
        raycaster.far = 1000;
        
        // 只檢測 environmentGroup 中的牆壁
        const intersects = raycaster.intersectObjects(environmentGroup.children, true);
        
        if (intersects.length > 0) {
            // 只考慮牆壁 (isWall 屬性)
            const wallIntersects = intersects.filter(i => i.object.isWall || i.object.parent?.isWall);
            if (wallIntersects.length > 0) {
                // 扣除向後偏移的 15cm
                value = Math.max(0, wallIntersects[0].distance - 15);
            } else {
                value = 500;
            }
        } else {
            value = 500;
        }
        
        // 增加調試日誌，查看傳感器讀值
        if (currentSceneType === 'challenge_maze') {
            // console.log(`📡 [Sensor] ${type}: ${value.toFixed(1)} cm`);
        }
    }

    if (unit === 'mm') value *= 10; 
    else if (unit === 'm') value /= 100; 
    else if (unit === 'in') value /= 2.54;
    
    return parseFloat(value.toFixed(2));
}

// --- 渲染循環 ---

function onWindowResize() { 
    if (!container || !camera || !renderer) return;
    
    // 獲取容器的實際尺寸
    const width = container.clientWidth || container.offsetWidth || 800;
    const containerHeight = container.clientHeight || container.offsetHeight || 600;
    
    // 計算 console-panel 的實際高度
    const consolePanel = document.getElementById('console-panel');
    const consoleHeight = consolePanel ? (consolePanel.offsetHeight || 150) : 150;
    
    // canvas 的可用高度 = 容器高度 - console 高度
    const canvasHeight = Math.max(containerHeight - consoleHeight, 100);
    
    // 獲取 canvas 元素的實際顯示尺寸（在 flex 布局中）
    const canvas = renderer.domElement;
    const canvasRect = canvas.getBoundingClientRect();
    const actualCanvasHeight = canvasRect.height || canvasHeight;
    
    // 使用實際顯示高度
    const finalHeight = actualCanvasHeight > 0 ? actualCanvasHeight : canvasHeight;
    
    if (width > 0 && finalHeight > 0) {
        camera.aspect = width / finalHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(width, finalHeight);
        console.log(`Resized canvas: ${width}x${finalHeight} (container: ${containerHeight}px, console: ${consoleHeight}px)`);
    }
}
function onMouseWheel(e) { camRadius+=e.deltaY*0.5; camRadius=Math.max(100,Math.min(1000,camRadius)); updateCameraPosition(); e.preventDefault(); }
function onMouseMove(e) {
    if (!isMouseDown && !isRightMouseDown) return;
    const dx = e.clientX - mouseX; const dy = e.clientY - mouseY; mouseX=e.clientX; mouseY=e.clientY;
    if (isMouseDown) { camTheta-=dx*0.5; camPhi-=dy*0.5; camPhi=Math.max(10,Math.min(85,camPhi)); updateCameraPosition(); }
    else if (isRightMouseDown) {
        const rad = THREE.MathUtils.degToRad(camTheta);
        camTarget.x -= (dx*Math.cos(rad)+dy*Math.sin(rad))*2; camTarget.z -= (dy*Math.cos(rad)-dx*Math.sin(rad))*2;
        updateCameraPosition();
    }
}
function updateCameraPosition() {
    const rt = THREE.MathUtils.degToRad(camTheta), rp = THREE.MathUtils.degToRad(camPhi);
    camera.position.set(camTarget.x + camRadius*Math.sin(rp)*Math.sin(rt), camTarget.y + camRadius*Math.cos(rp)+50, camTarget.z + camRadius*Math.sin(rp)*Math.cos(rt));
    camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
}
function animateLoop() {
    requestAnimationFrame(animateLoop);
    
    // 執行碰撞偵測
    handleWallCollision();

    // 執行任務邏輯 (計分、觸發)
    checkMissionLogic();

    // 執行迷宮動畫 (如 Beacon 旋轉)
    if (window.mazeAnimations) {
        window.mazeAnimations.forEach(fn => fn());
    }

    // 螺旋槳動畫：確保所有螺旋槳都會轉動
    if (state.isFlying && propellers.length > 0) {
        propellers.forEach((p, i) => {
            // 交替旋轉方向
            p.rotation.y += (i % 2 === 0 ? 0.8 : -0.8);
        });
    }
    if (droneGroup) { droneGroup.position.set(state.x, state.y, state.z); droneGroup.rotation.y = THREE.MathUtils.degToRad(state.heading); }
    if (followDrone) { camTarget.x += (state.x - camTarget.x)*0.1; camTarget.y += (state.y - camTarget.y)*0.1; camTarget.z += (state.z - camTarget.z)*0.1; }
    if (ruinsUpdateFunction) ruinsUpdateFunction();
    if (state.isFlying) checkCityLogic();
    
    // 更新 HUD 內容 (加入實時分數與時間)
    let hudHTML = `<div style="margin-bottom:5px; font-weight:bold; color:#00adb5; border-bottom:1px solid rgba(0,173,181,0.3); padding-bottom:5px;">MODE: ${followDrone?"FOLLOW":"FREE LOOK"}</div>`;
    
    if (currentSceneType === 'tunnel') {
        const currentTime = state.missionCompleted ? (state.endTime || Date.now()) : Date.now();
        const timeElapsed = takeoffTime === 0 ? 0 : Math.floor((currentTime - takeoffTime) / 1000);
        hudHTML += `<div style="color:#ff9800; font-size:1.1rem; font-weight:bold;">SCORE: ${Math.floor(currentScore)}</div>`;
        hudHTML += `<div style="color:#ffffff;">TIME: ${timeElapsed}s ${state.missionCompleted ? '🏁' : ''}</div>`;
        hudHTML += `<div style="color:#00ff00;">BEACONS: ${beaconsTriggered}/3</div>`;
        hudHTML += `<div style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;"></div>`;
    }

    if (currentSceneType === 'city') {
        const timeElapsed = takeoffTime === 0 ? 0 : Math.floor((Date.now() - takeoffTime) / 1000);
        const batteryLeft = Math.max(0, 120 - timeElapsed);
        hudHTML += `<div style="color:#ff4400; font-size:1.1rem; font-weight:bold;">BATTERY: ${batteryLeft}s</div>`;
        hudHTML += `<div style="color:${waterLoaded?'#00ff00':'#aaaaaa'};">WATER: ${waterLoaded?'LOADED':'EMPTY'}</div>`;
        hudHTML += `<div style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;"></div>`;
    }

    const displayAlt = currentSceneType === 'city' ? state.y - getForestHeight(state.x, state.z) : state.y;
    hudHTML += `Status: ${state.isFlying?'FLYING':'LANDED'}<br>Alt: ${Math.round(displayAlt)} cm`;
    document.getElementById('hud-display').innerHTML = hudHTML;

    updateCameraPosition();
    renderer.render(scene, camera);
}
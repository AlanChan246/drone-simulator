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
let beaconsTriggered = 0;   // 已完成巡檢回報數（內部變數名保留）
let beaconData = [];        // 巡檢回報點座標與狀態（內部變數名保留）

/** 任務一：依迷宮格 (i,j) 對應巡檢回報點名稱（坍塌廢墟搜救敘事） */
const INSPECTION_CHECKPOINT_NAMES = {
    '1,6': { label: '通訊中繼站', labelEn: 'Comms Relay' },
    '5,10': { label: '結構安全掃描點', labelEn: 'Structural Scan' },
    '9,1': { label: '環境感測點', labelEn: 'Environment Sensor' }
};

/** 任務二 14×14 山火場：火點格 (i,j) → 優先級敘事（供 HUD／評分擴充） */
const FOREST_FIRE_SITES = {
    '2,12': { label: '火點 A', labelEn: 'Fire A', priority: 300, note: '受災區旁·最優先' },
    '4,10': { label: '火點 B', labelEn: 'Fire B', priority: 250, note: '東北區' },
    '11,5': { label: '火點 C', labelEn: 'Fire C', priority: 200, note: '西南區' },
    '12,10': { label: '火點 D', labelEn: 'Fire D', priority: 180, note: '東南遠端' }
};

const MISSION_SCENE_CONFIGS = {
    tunnel: {
        requiredBeacons: 3,
        requiredFires: 4,
        inspectionNames: INSPECTION_CHECKPOINT_NAMES,
        fireSites: FOREST_FIRE_SITES,
        resultMissionId: 1
    },
    city: {
        requiredBeacons: 3,
        requiredFires: 4,
        inspectionNames: INSPECTION_CHECKPOINT_NAMES,
        fireSites: FOREST_FIRE_SITES,
        resultMissionId: 2
    }
};

let activeMissionConfig = MISSION_SCENE_CONFIGS.tunnel;

function applyMissionConfigForScene(type) {
    activeMissionConfig = MISSION_SCENE_CONFIGS[type] || {
        requiredBeacons: 0,
        requiredFires: 0,
        inspectionNames: INSPECTION_CHECKPOINT_NAMES,
        fireSites: FOREST_FIRE_SITES,
        resultMissionId: 0
    };
}

function getRequiredBeacons() {
    return activeMissionConfig.requiredBeacons;
}

function getRequiredFires() {
    return activeMissionConfig.requiredFires;
}

function isTunnelMissionScene() {
    return currentSceneType === 'tunnel';
}

function isCityMissionScene() {
    return currentSceneType === 'city';
}

function getActiveInspectionNames() {
    return activeMissionConfig.inspectionNames || INSPECTION_CHECKPOINT_NAMES;
}

function getActiveFireSites() {
    return activeMissionConfig.fireSites || FOREST_FIRE_SITES;
}
/** 任務二：各格地表高度 (cm)，與 forestGrid 同尺寸 */
let forestHeightGrid = null;
/** 任務二：充電站（懸停 3 秒補電） */
let forestChargeData = [];
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
/** 任務一道路片 Y（供 __DEBUG_ROAD_MASK__ 射線與平面相交） */
let tunnelMazeRoadSurfaceY = 0.38;
/** 任務一 Kenney 街區：最高飛行高度（cm），避免從高空穿越整張地圖 */
const TUNNEL_KENNEY_MAX_FLIGHT_CM = 320;
/** 任務一：抵達終點須低於此高度（cm）才算降落完成 */
const TUNNEL_MISSION_EXIT_MAX_ALT_CM = 120;
/** 任務一：低於此高度飛過的可通行格才計入「沿路網」紀錄（防高空捷徑） */
const TUNNEL_LEGIT_PATROL_HEIGHT_CM = 150;
/** 任務一：時間獎段位（由快到慢；超過最後一檔為 0） */
const TUNNEL_MISSION_TIME_TIERS = [
    { maxSec: 60, bonus: 500, label: '≤ 60 秒', labelShort: '極快' },
    { maxSec: 90, bonus: 350, label: '≤ 90 秒', labelShort: '快' },
    { maxSec: 120, bonus: 200, label: '≤ 2 分鐘', labelShort: '中等' },
    { maxSec: 180, bonus: 80, label: '≤ 3 分鐘', labelShort: '慢' }
];

function getTunnelMissionTimeBonus(timeElapsedSec) {
    const elapsed = Math.max(0, Math.floor(timeElapsedSec));
    for (let i = 0; i < TUNNEL_MISSION_TIME_TIERS.length; i++) {
        const tier = TUNNEL_MISSION_TIME_TIERS[i];
        if (elapsed <= tier.maxSec) {
            return { bonus: tier.bonus, label: tier.labelShort, tierIndex: i };
        }
    }
    return { bonus: 0, label: '超時', tierIndex: -1 };
}

function computeTunnelMissionTimeBonus(timeElapsedSec) {
    return getTunnelMissionTimeBonus(timeElapsedSec).bonus;
}

if (typeof window !== 'undefined') {
    window.TUNNEL_MISSION_TIME_TIERS = TUNNEL_MISSION_TIME_TIERS;
}

let visitedWalkableCells = new Set();
let tunnelStartCell = null;
let tunnelGoalCell = null;
let _tunnelFinishHintLastLog = 0;
let _cityFinishHintLastLog = 0;

/** 路面編輯 UI；false = 隱藏按鈕（任務一路面已寫入 DEFAULT_TUNNEL_ROAD_OVERRIDES） */
const ROAD_EDITOR_UI_ENABLED = false;

/** 路面編輯模式（任務一）：覆寫格子的 Kenney 模型與旋轉 */
const ROAD_EDITOR_STORAGE_KEY = 'drone-simulator-road-overrides-v2';
/** 任務一預設路面（路面編輯器調校；localStorage 同名格可再覆寫） */
const DEFAULT_TUNNEL_ROAD_OVERRIDES = {
    '1,1': { key: 'end', rot: 0 },
    '1,3': { key: 'bend', rot: 0 },
    '3,3': { key: 'cross', rot: 1 },
    '3,1': { key: 'bend', rot: 1 },
    '7,1': { key: 'cross', rot: 1 },
    '7,4': { key: 'cross', rot: 1 },
    '5,4': { key: 'bend', rot: 0 },
    '5,3': { key: 'straight', rot: 0 },
    '3,5': { key: 'cross', rot: 1 },
    '1,5': { key: 'bend', rot: 1 },
    '1,6': { key: 'straight', rot: 0 },
    '3,6': { key: 'bend', rot: 0 },
    '1,10': { key: 'bend', rot: 0 },
    '3,10': { key: 'bend', rot: 3 },
    '3,8': { key: 'bend', rot: 1 },
    '5,8': { key: 'cross', rot: 1 },
    '5,10': { key: 'bend', rot: 0 },
    '5,6': { key: 'bend', rot: 2 },
    '7,8': { key: 'cross', rot: 0 },
    '9,1': { key: 'bend', rot: 1 },
    '10,10': { key: 'cross', rot: 1 },
    '10,11': { key: 'straight', rot: 0 },
    '10,8': { key: 'bend', rot: 2 },
    '9,8': { key: 'cross', rot: 0 }
};
const ROAD_PIECE_KEYS = ['straight', 'bend', 'cross', 'tee', 'end'];
let roadEditorMode = false;
let roadCellOverrides = {};
const roadPieceByCell = {};
let roadEditorSelection = null;
let roadEditorHighlight = null;
let _roadEditorClickInstalled = false;
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
    lily: null,
    kenneyForest: {},
    kenneyDistrictTemplates: [],
    /** @type {{ straight: THREE.Object3D|null, bend: THREE.Object3D|null, cross: THREE.Object3D|null, tee: THREE.Object3D|null, end: THREE.Object3D|null }} */
    kenneyRoads: {
        straight: null,
        bend: null,
        cross: null,
        tee: null,
        end: null
    },
    /** 建築格底：Kenney roads 套件 road-square */
    kenneyPlotTile: null
};

// 須以 setPath 載入：Kenney GLB 內嵌貼圖路徑為相對於檔案目錄的 Textures/colormap.png
const KENNEY_COMMERCIAL_DIR = 'assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/';
const KENNEY_DISTRICT_FILENAMES = [
    'low-detail-building-a.glb',
    'low-detail-building-f.glb',
    'low-detail-building-i.glb',
    'low-detail-building-wide-a.glb',
    'building-g.glb',
    'building-c.glb',
    'building-skyscraper-a.glb',
    'building-skyscraper-b.glb'
];

function prepareKenneyDistrictModel(root) {
    root.traverse(child => {
        if (!child.isMesh || !child.material) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => {
            if (!m) return;
            if ('roughness' in m && m.roughness !== undefined) {
                m.roughness = 0.72;
                if ('metalness' in m && m.metalness !== undefined) m.metalness = Math.min(0.12, m.metalness);
            }
        });
    });
}

async function loadKenneyDistrictTemplates() {
    assets.kenneyDistrictTemplates = [];
    // 每個檔案使用獨立 GLTFLoader + setPath，避免並行 load 時共用 loader 內部 path 狀態，
    // 造成 Textures/colormap.png 解析到錯誤目錄而整體載入失敗。
    const promises = KENNEY_DISTRICT_FILENAMES.map(name => new Promise(resolve => {
        const fileLoader = new THREE.GLTFLoader();
        fileLoader.setPath(KENNEY_COMMERCIAL_DIR);
        fileLoader.load(name, (gltf) => {
            prepareKenneyDistrictModel(gltf.scene);
            assets.kenneyDistrictTemplates.push(gltf.scene);
            console.log(`✅ Kenney district: ${name}`);
            resolve();
        }, undefined, (err) => {
            console.error(`❌ Kenney district load failed (${name}):`, err);
            resolve();
        });
    }));
    await Promise.all(promises);
    if (assets.kenneyDistrictTemplates.length === 0) {
        console.warn('⚠️ 任務一街區：無 Kenney 建築載入，將使用盒子牆。（請用本機 http 伺服器開啟專案，勿用 file://）');
    } else {
        console.log(`🏙️ Kenney 街區建築模板：${assets.kenneyDistrictTemplates.length} 個`);
    }
}

const KENNEY_ROADS_DIR = 'assets/models/kenney_city-kit-roads/Models/GLB format/';
const KENNEY_COLORMAP_URL = KENNEY_ROADS_DIR + 'Textures/colormap.png';
let _kenneyColormapTex = null;

function applySrgbToTexture(tex) {
    if (!tex) return;
    if ('colorSpace' in tex && typeof THREE.SRGBColorSpace !== 'undefined') {
        tex.colorSpace = THREE.SRGBColorSpace;
    } else if ('encoding' in tex && typeof THREE.sRGBEncoding !== 'undefined') {
        tex.encoding = THREE.sRGBEncoding;
    }
    tex.flipY = false;
    tex.needsUpdate = true;
}

function getKenneyColormapTexture() {
    if (!_kenneyColormapTex) {
        _kenneyColormapTex = new THREE.TextureLoader().load(
            KENNEY_COLORMAP_URL,
            (tex) => applySrgbToTexture(tex),
            undefined,
            (err) => console.warn('⚠️ Kenney colormap 載入失敗:', err)
        );
        applySrgbToTexture(_kenneyColormapTex);
    }
    return _kenneyColormapTex;
}

function getKenneyRoadReferenceMaterial() {
    const ref = assets.kenneyRoads && assets.kenneyRoads.straight;
    if (!ref) return null;
    let found = null;
    ref.traverse(child => {
        if (found || !child.isMesh || !child.material) return;
        found = Array.isArray(child.material) ? child.material[0] : child.material;
    });
    return found;
}

/** 建築格地塊：保留 GLB 的 UV，貼圖與道路相同（tile-low 的 UV 常落在色票空白→全白） */
function applyPlotMaterialsLikeRoad(root) {
    const ref = getKenneyRoadReferenceMaterial();
    const plotPhong = (ref && ref.map)
        ? new THREE.MeshPhongMaterial({
            map: ref.map,
            color: ref.color && ref.color.clone ? ref.color.clone() : new THREE.Color(0xcccccc),
            shininess: 14,
            polygonOffset: true,
            polygonOffsetFactor: 4,
            polygonOffsetUnits: 4
        })
        : new THREE.MeshPhongMaterial({
            color: 0x3a4552,
            shininess: 10,
            polygonOffset: true,
            polygonOffsetFactor: 4,
            polygonOffsetUnits: 4
        });
    root.traverse(child => {
        if (!child.isMesh) return;
        child.material = plotPhong.clone();
        child.castShadow = false;
        child.receiveShadow = true;
    });
}

function createSimplePlotPlane(cellSize) {
    const mat = new THREE.MeshPhongMaterial({
        color: 0x3a4552,
        shininess: 10,
        polygonOffset: true,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.98, cellSize * 0.98), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
}

function prepareKenneyPlotModel(root) {
    root.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = false;
        child.receiveShadow = true;
    });
    applyPlotMaterialsLikeRoad(root);
}

function createKenneyPlotInstance(cellSize, rotSteps) {
    if (!assets.kenneyPlotTile) {
        return createSimplePlotPlane(cellSize);
    }
    const group = createKenneyRoadInstance(assets.kenneyPlotTile, cellSize, rotSteps || 0);
    applyPlotMaterialsLikeRoad(group);
    return group;
}

function prepareKenneyRoadModel(root) {
    root.traverse(child => {
        if (!child.isMesh || !child.material) return;
        child.castShadow = false;
        child.receiveShadow = true;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => {
            if (!m) return;
            m.polygonOffset = true;
            m.polygonOffsetFactor = 2;
            m.polygonOffsetUnits = 2;
            if ('roughness' in m && m.roughness !== undefined) {
                m.roughness = 0.82;
                if ('metalness' in m && m.metalness !== undefined) m.metalness = Math.min(0.06, m.metalness);
            }
        });
    });
}

async function loadKenneyRoadTemplates() {
    getKenneyColormapTexture();
    assets.kenneyRoads = { straight: null, bend: null, cross: null, tee: null, end: null };
    const files = {
        straight: 'road-straight.glb',
        bend: 'road-bend.glb',
        cross: 'road-crossroad.glb',
        tee: 'road-split.glb',
        end: 'road-end.glb'
    };
    const entries = Object.entries(files);
    await Promise.all(entries.map(([key, name]) => new Promise(resolve => {
        const fileLoader = new THREE.GLTFLoader();
        fileLoader.setPath(KENNEY_ROADS_DIR);
        fileLoader.load(name, (gltf) => {
            prepareKenneyRoadModel(gltf.scene);
            assets.kenneyRoads[key] = gltf.scene;
            console.log(`✅ Kenney road: ${name}`);
            resolve();
        }, undefined, (err) => {
            console.error(`❌ Kenney road load failed (${name}):`, err);
            resolve();
        });
    })));
    const r = assets.kenneyRoads;
    const ok = r.straight && r.bend && r.cross && r.tee && r.end;
    if (!ok) {
        console.warn('⚠️ 任務一：Kenney 道路未完整載入，將退回平面路面片。');
    } else {
        console.log('🛣️ Kenney 道路模板：straight / bend / cross / tee / end 已就緒');
    }
    assets.kenneyPlotTile = null;
    await new Promise(resolve => {
        const fileLoader = new THREE.GLTFLoader();
        fileLoader.setPath(KENNEY_ROADS_DIR);
        fileLoader.load('road-square.glb', (gltf) => {
            prepareKenneyPlotModel(gltf.scene);
            assets.kenneyPlotTile = gltf.scene;
            console.log('✅ Kenney plot: road-square.glb（建築格底）');
            resolve();
        }, undefined, (err) => {
            console.warn('⚠️ Kenney road-square 未載入，建築格改用灰色平面。', err);
            resolve();
        });
    });
}

/**
 * Kenney GLB/OBJ 實測（rot=0，世界 N=-Z E=+X S=+Z W=-X），再套 KENNEY_ROAD_PHASE_STEPS。
 *
 * | 資產 | rot=0 開口 |
 * |------|------------|
 * | road-straight | 車道沿 ±Z（mask 5→rot1, mask 10→rot0） |
 * | road-bend | rot0 開口 **E+S**（mask 6→0, 3→1, 9→2, 12→3） |
 * | road-split | **N+S+W**（幹道 ±Z，缺 E） |
 * | road-end | **W** |
 * | road-crossroad | 四向對稱 |
 */
/** 整包道路與迷宮軸若有固定偏差，只改此常數 0–3（每步 90°） */
const KENNEY_ROAD_PHASE_STEPS = 0;

let _roadMaskDebugInstalled = false;
let _roadMaskDebugLastKey = '';
let _roadMaskDebugLastT = 0;
let _roadMaskDebugMissLogged = false;
/** 滑鼠最後停留的可通行格（供 markRoadFixHere 使用） */
let _roadMaskDebugLastCell = null;
/** 收集要交給 Cursor 修改的路面旋轉備註 */
const roadFixNotes = [];

function isMazeWalkableCell(val) {
    return val !== 1;
}

function mazeNeighborWalkable(grid, i, j, di, dj) {
    const ni = i + di;
    const nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= grid.length || nj >= grid[0].length) return false;
    return isMazeWalkableCell(grid[ni][nj]);
}

function computeMazeRoadMask(grid, i, j) {
    const N = mazeNeighborWalkable(grid, i, j, -1, 0) ? 1 : 0;
    const E = mazeNeighborWalkable(grid, i, j, 0, 1) ? 2 : 0;
    const S = mazeNeighborWalkable(grid, i, j, 1, 0) ? 4 : 0;
    const W = mazeNeighborWalkable(grid, i, j, 0, -1) ? 8 : 0;
    return N | E | S | W;
}

function roadCellKey(i, j) {
    return i + ',' + j;
}

function getRoadEditorStorageKey() {
    return ROAD_EDITOR_STORAGE_KEY;
}

function getDefaultRoadOverrides() {
    return DEFAULT_TUNNEL_ROAD_OVERRIDES;
}

function isRoadEditorScene() {
    return currentSceneType === 'tunnel';
}

function isRoadEditorUiAvailable() {
    return ROAD_EDITOR_UI_ENABLED && isRoadEditorScene();
}

function reloadRoadEditorScene() {
    if (isRoadEditorScene()) loadScene(currentSceneType);
}

function updateRoadEditorButtonVisibility() {
    const btn = document.getElementById('road-editor-toggle-btn');
    if (!btn) return;
    const show = isRoadEditorUiAvailable();
    btn.hidden = !show;
    btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (!show && roadEditorMode) toggleRoadEditorMode(false);
}

function loadRoadOverridesFromStorage() {
    let fromStorage = {};
    try {
        const raw = localStorage.getItem(getRoadEditorStorageKey());
        fromStorage = raw ? JSON.parse(raw) : {};
    } catch (e) {
        fromStorage = {};
    }
    roadCellOverrides = Object.assign({}, getDefaultRoadOverrides(), fromStorage);
}

function saveRoadOverridesToStorage() {
    try {
        localStorage.setItem(getRoadEditorStorageKey(), JSON.stringify(roadCellOverrides));
    } catch (e) {
        console.warn('[road-editor] 無法寫入 localStorage', e);
    }
}

function getEffectiveRoadPick(i, j, grid) {
    const g = grid || currentMazeGrid;
    const k = roadCellKey(i, j);
    if (roadCellOverrides[k]) {
        return { key: roadCellOverrides[k].key, rot: roadCellOverrides[k].rot };
    }
    const mask = computeMazeRoadMask(g, i, j);
    return selectKenneyRoadPiece(mask);
}

function clearRoadPieceRegistry() {
    Object.keys(roadPieceByCell).forEach(k => delete roadPieceByCell[k]);
}

function getMazeCellWorldCenter(i, j) {
    const x = mazeOffsetX + j * currentCellSize + currentCellSize / 2;
    const z = mazeOffsetZ + i * currentCellSize + currentCellSize / 2;
    return { x, z };
}

function pickMazeCellFromPointerEvent(e) {
    if (!renderer || !renderer.domElement || !camera || !currentMazeGrid || !currentCellSize) return null;
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
    ) {
        return null;
    }
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -tunnelMazeRoadSurfaceY);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    const j = Math.floor((hit.x - mazeOffsetX) / currentCellSize);
    const i = Math.floor((hit.z - mazeOffsetZ) / currentCellSize);
    if (i < 0 || j < 0 || i >= currentMazeGrid.length || j >= currentMazeGrid[0].length) return null;
    if (currentMazeGrid[i][j] === 1) return null;
    return { i, j, gridVal: currentMazeGrid[i][j], hit };
}

function placeKenneyRoadForCell(i, j, x, z, cellSize, mazeRoadY, mazeGrid) {
    const r = assets.kenneyRoads;
    if (!r || !r.straight) return null;
    const pick = getEffectiveRoadPick(i, j, mazeGrid);
    const tpl = r[pick.key];
    if (!tpl) return null;
    const roadPiece = createKenneyRoadInstance(tpl, cellSize, pick.rot);
    roadPiece.position.set(x, mazeRoadY, z);
    roadPiece.userData.isKenneyRoad = true;
    roadPiece.userData.roadCell = { i, j };
    environmentGroup.add(roadPiece);
    roadPieceByCell[roadCellKey(i, j)] = roadPiece;
    return roadPiece;
}

function refreshRoadCell(i, j) {
    const k = roadCellKey(i, j);
    const old = roadPieceByCell[k];
    if (old && old.parent) old.parent.remove(old);
    delete roadPieceByCell[k];
    if (!currentMazeGrid || !currentCellSize) return;
    const val = currentMazeGrid[i][j];
    if (val === 1) return;
    const { x, z } = getMazeCellWorldCenter(i, j);
    const r = assets.kenneyRoads;
    if (r && r.straight) {
        placeKenneyRoadForCell(i, j, x, z, currentCellSize, tunnelMazeRoadSurfaceY, currentMazeGrid);
    }
}

function updateRoadEditorHighlight() {
    if (!roadEditorHighlight) return;
    if (!roadEditorSelection || !currentCellSize) {
        roadEditorHighlight.visible = false;
        return;
    }
    const { x, z } = getMazeCellWorldCenter(roadEditorSelection.i, roadEditorSelection.j);
    roadEditorHighlight.position.set(x, tunnelMazeRoadSurfaceY + 0.08, z);
    roadEditorHighlight.scale.setScalar(currentCellSize * 0.92);
    roadEditorHighlight.visible = true;
}

function updateRoadEditorPanel() {
    const panel = document.getElementById('road-editor-panel');
    const info = document.getElementById('road-editor-cell-info');
    const sel = document.getElementById('road-editor-piece');
    if (!panel || !info) return;
    if (!roadEditorSelection) {
        info.textContent = '點選 3D 畫布上的路面格';
        if (sel) sel.disabled = true;
        return;
    }
    const { i, j } = roadEditorSelection;
    const mask = computeMazeRoadMask(currentMazeGrid, i, j);
    const pick = getEffectiveRoadPick(i, j);
    const auto = selectKenneyRoadPiece(mask);
    const k = roadCellKey(i, j);
    const isOverride = !!roadCellOverrides[k];
    info.innerHTML =
        `格 <b>${i}, ${j}</b> · mask ${mask} (${mask.toString(2).padStart(4, '0')})<br>` +
        `目前 <b>${pick.key}</b> rot <b>${pick.rot}</b>${isOverride ? '（手動）' : '（自動）'}<br>` +
        `自動建議 ${auto.key} rot ${auto.rot}`;
    if (sel) {
        sel.disabled = false;
        sel.value = pick.key;
    }
}

function selectRoadEditorCell(i, j) {
    roadEditorSelection = { i, j };
    updateRoadEditorHighlight();
    updateRoadEditorPanel();
}

function ensureRoadOverride(i, j) {
    const k = roadCellKey(i, j);
    if (!roadCellOverrides[k]) {
        roadCellOverrides[k] = Object.assign({}, getEffectiveRoadPick(i, j));
    }
    return roadCellOverrides[k];
}

function roadEditorRotate(delta) {
    if (!roadEditorSelection) return;
    const { i, j } = roadEditorSelection;
    const o = ensureRoadOverride(i, j);
    o.rot = ((o.rot + (delta || 1)) % 4 + 4) % 4;
    saveRoadOverridesToStorage();
    refreshRoadCell(i, j);
    updateRoadEditorPanel();
}

function roadEditorSetPiece(key) {
    if (!roadEditorSelection || ROAD_PIECE_KEYS.indexOf(key) < 0) return;
    const { i, j } = roadEditorSelection;
    const o = ensureRoadOverride(i, j);
    o.key = key;
    saveRoadOverridesToStorage();
    refreshRoadCell(i, j);
    updateRoadEditorPanel();
}

function roadEditorResetCell() {
    if (!roadEditorSelection) return;
    const { i, j } = roadEditorSelection;
    delete roadCellOverrides[roadCellKey(i, j)];
    saveRoadOverridesToStorage();
    refreshRoadCell(i, j);
    updateRoadEditorPanel();
}

function roadEditorClearAllOverrides() {
    const runClear = () => {
        roadCellOverrides = {};
        saveRoadOverridesToStorage();
        reloadRoadEditorScene();
    };
    if (typeof window.showAppConfirm === 'function') {
        window.showAppConfirm('清除所有手動路面設定？', { title: '路面編輯' }).then((ok) => {
            if (ok) runClear();
        });
        return;
    }
    if (typeof confirm === 'function' && !confirm('清除所有手動路面設定？')) return;
    runClear();
}

function exportRoadOverrides() {
    const text = JSON.stringify(roadCellOverrides, null, 2);
    const count = Object.keys(roadCellOverrides).length;
    console.log('[road-editor] overrides:\n', text);

    const showExportMessage = (body, variant) => {
        if (typeof window.showAppMessage === 'function') {
            window.showAppMessage({
                variant: variant || 'info',
                title: '路面設定已匯出',
                body,
                autoHideMs: 10000,
                focusClose: false
            });
        }
    };

    const downloadJson = () => {
        try {
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tunnel-road-overrides.json';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (e) {
            console.warn('[road-editor] 下載 JSON 失敗', e);
            return false;
        }
    };

    const downloaded = downloadJson();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
            () => {
                showExportMessage(
                    `已複製 ${count} 格設定到剪貼簿` + (downloaded ? '，並已下載 JSON 檔。' : '。'),
                    'info'
                );
            },
            () => {
                if (downloaded) {
                    showExportMessage(`已下載 JSON 檔（共 ${count} 格）。剪貼簿不可用，請用檔案內容。`, 'info');
                } else {
                    showExportMessage(`共 ${count} 格。剪貼簿與下載皆不可用，請開啟開發者工具主控台複製。`, 'warn');
                }
            }
        );
    } else if (downloaded) {
        showExportMessage(`已下載 JSON 檔（共 ${count} 格）。`, 'info');
    } else {
        showExportMessage(`共 ${count} 格。請開啟開發者工具主控台複製 JSON。`, 'warn');
    }

    return text;
}

function importRoadOverrides(json) {
    if (typeof json === 'string') {
        try { json = JSON.parse(json); } catch (e) {
            console.error('[road-editor] JSON 無效', e);
            return;
        }
    }
    if (!json || typeof json !== 'object') return;
    roadCellOverrides = json;
    saveRoadOverridesToStorage();
    reloadRoadEditorScene();
    console.log('[road-editor] 已匯入', Object.keys(roadCellOverrides).length, '格');
}

function ensureRoadEditorHighlightMesh() {
    if (!environmentGroup) return;
    if (roadEditorHighlight) {
        if (!roadEditorHighlight.parent) environmentGroup.add(roadEditorHighlight);
        return;
    }
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    roadEditorHighlight = ring;
    environmentGroup.add(roadEditorHighlight);
}

function roadEditorOnPieceChange(key) {
    roadEditorSetPiece(key);
}

function setupRoadEditorClickListener() {
    if (_roadEditorClickInstalled || !renderer || !renderer.domElement) return;
    _roadEditorClickInstalled = true;
    renderer.domElement.addEventListener('click', (e) => {
        if (!roadEditorMode) return;
        const cell = pickMazeCellFromPointerEvent(e);
        if (!cell) return;
        selectRoadEditorCell(cell.i, cell.j);
    });
}

function onRoadEditorKeyDown(e) {
    if (!roadEditorMode || !roadEditorSelection) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        roadEditorRotate(1);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        roadEditorResetCell();
    }
}

function toggleRoadEditorMode(forceOn) {
    const want = typeof forceOn === 'boolean' ? forceOn : !roadEditorMode;
    if (want && !isRoadEditorUiAvailable()) {
        console.warn('[road-editor] 僅任務一可用（且需開啟 ROAD_EDITOR_UI_ENABLED）');
        if (typeof window.showAppMessage === 'function') {
            window.showAppMessage({
                variant: 'warn',
                title: '路面編輯',
                body: '請先進入任務一，並開啟路面編輯功能。',
                focusClose: false
            });
        }
        return;
    }
    roadEditorMode = want;
    const panel = document.getElementById('road-editor-panel');
    const btn = document.getElementById('road-editor-toggle-btn');
    if (panel) {
        panel.hidden = !roadEditorMode;
        panel.setAttribute('aria-hidden', roadEditorMode ? 'false' : 'true');
    }
    if (btn) btn.classList.toggle('road-editor-toggle-btn--active', roadEditorMode);
    if (container) container.classList.toggle('road-editor-active', roadEditorMode);
    if (renderer && renderer.domElement) {
        renderer.domElement.style.cursor = roadEditorMode ? 'crosshair' : '';
    }
    if (roadEditorMode) {
        loadRoadOverridesFromStorage();
        setupRoadEditorClickListener();
        ensureRoadEditorHighlightMesh();
        updateRoadEditorHighlight();
        updateRoadEditorPanel();
        window.addEventListener('keydown', onRoadEditorKeyDown);
        console.log('[road-editor] 已開啟：左鍵點格選取 · R 轉 90° · 面板切換模型');
    } else {
        if (roadEditorHighlight) roadEditorHighlight.visible = false;
        roadEditorSelection = null;
        window.removeEventListener('keydown', onRoadEditorKeyDown);
        updateRoadEditorPanel();
    }
}

function selectKenneyRoadPiece(mask) {
    if (mask === 15) return { key: 'cross', rot: 0 };
    if (mask === 5) return { key: 'straight', rot: 1 };
    if (mask === 10) return { key: 'straight', rot: 0 };
    if (mask === 13) return { key: 'tee', rot: 0 };
    if (mask === 11) return { key: 'tee', rot: 1 };
    if (mask === 7) return { key: 'tee', rot: 2 };
    if (mask === 14) return { key: 'tee', rot: 3 };
    if (mask === 3) return { key: 'bend', rot: 1 };
    if (mask === 6) return { key: 'bend', rot: 0 };
    if (mask === 12) return { key: 'bend', rot: 3 };
    if (mask === 9) return { key: 'bend', rot: 2 };
    if (mask === 8) return { key: 'end', rot: 0 };
    if (mask === 4) return { key: 'end', rot: 3 };
    if (mask === 2) return { key: 'end', rot: 2 };
    if (mask === 1) return { key: 'end', rot: 1 };
    return { key: 'cross', rot: 0 };
}

function logRoadMaskDebugStatus() {
    const ready = !!(currentSceneType === 'tunnel' && currentMazeGrid && currentCellSize && camera && renderer);
    console.log('[road-debug] 狀態', {
        enabled: !!window.__DEBUG_ROAD_MASK__,
        scene: currentSceneType,
        mazeReady: ready,
        cellSize: currentCellSize,
        roadY: tunnelMazeRoadSurfaceY,
        listener: _roadMaskDebugInstalled
    });
    if (!ready) {
        console.warn('[road-debug] 請先進入「任務一」坍塌廢墟搜救（tunnel），並確認 3D 已載入。');
        return;
    }
    for (let i = 0; i < currentMazeGrid.length; i++) {
        for (let j = 0; j < currentMazeGrid[i].length; j++) {
            if (currentMazeGrid[i][j] === 2) {
                const mask = computeMazeRoadMask(currentMazeGrid, i, j);
                console.log('[road-debug] 起點格', { i, j, mask, pick: getEffectiveRoadPick(i, j) });
                return;
            }
        }
    }
}

function onRoadMaskDebugPointerMove(e) {
    if (!window.__DEBUG_ROAD_MASK__) return;
    if (!renderer || !renderer.domElement || !camera) return;
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
    ) {
        return;
    }
    if (currentSceneType !== 'tunnel' || !currentMazeGrid || !currentCellSize) {
        if (!_roadMaskDebugMissLogged) {
            _roadMaskDebugMissLogged = true;
            console.warn('[road-debug] 非 tunnel 或迷宮未就緒，滑鼠移動不會輸出。');
        }
        return;
    }
    _roadMaskDebugMissLogged = false;
    const now = performance.now();
    if (now - _roadMaskDebugLastT < 120) return;
    _roadMaskDebugLastT = now;
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -tunnelMazeRoadSurfaceY);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    const j = Math.floor((hit.x - mazeOffsetX) / currentCellSize);
    const i = Math.floor((hit.z - mazeOffsetZ) / currentCellSize);
    if (i < 0 || j < 0 || i >= currentMazeGrid.length || j >= currentMazeGrid[0].length) return;
    const val = currentMazeGrid[i][j];
    if (val === 1) return;
    const key = i + ',' + j;
    if (key === _roadMaskDebugLastKey) return;
    _roadMaskDebugLastKey = key;
    const mask = computeMazeRoadMask(currentMazeGrid, i, j);
    const pick = getEffectiveRoadPick(i, j);
    _roadMaskDebugLastCell = { i, j, gridVal: val, mask, pick };
    console.log('[road-debug]', {
        i, j, gridVal: val,
        mask,
        maskBits: mask.toString(2).padStart(4, '0'),
        pick,
        phase: KENNEY_ROAD_PHASE_STEPS,
        hit: { x: +hit.x.toFixed(1), z: +hit.z.toFixed(1) }
    });
    console.log(
        `[road-fix] 若這格要改：markRoadFixHere(2)  // 180°；或 markRoadFix(${i}, ${j}, 2)`
    );
}

function normalizeRoadFixDelta(deltaSteps) {
    return ((deltaSteps % 4) + 4) % 4;
}

function formatRoadFixLine(entry) {
    if (entry.type === 'global') {
        return `global +${entry.deltaSteps * 90}°  (KENNEY_ROAD_PHASE_STEPS = ${entry.deltaSteps})`;
    }
    const wantRot = (entry.oldRot + entry.deltaSteps) % 4;
    return (
        `${entry.i},${entry.j}  mask=${entry.mask} ${entry.key} rot ${entry.oldRot}→${wantRot}  (+${entry.deltaSteps * 90}°)`
    );
}

/** 標記單格：deltaSteps 0–3（每步 90°，2 = 180°） */
function markRoadFix(i, j, deltaSteps) {
    if (!currentMazeGrid) {
        console.warn('[road-fix] 迷宮未載入');
        return;
    }
    const delta = normalizeRoadFixDelta(deltaSteps);
    const mask = computeMazeRoadMask(currentMazeGrid, i, j);
    const pick = getEffectiveRoadPick(i, j);
    const entry = {
        type: 'cell',
        i, j,
        mask,
        key: pick.key,
        oldRot: pick.rot,
        deltaSteps: delta
    };
    roadFixNotes.push(entry);
    console.log('[road-fix] 已記錄', formatRoadFixLine(entry));
}

/** 標記「滑鼠最後指到的那格」 */
function markRoadFixHere(deltaSteps) {
    if (!_roadMaskDebugLastCell) {
        console.warn('[road-fix] 請先在 3D 畫布上移動滑鼠出現 [road-debug]，再執行 markRoadFixHere');
        return;
    }
    const { i, j } = _roadMaskDebugLastCell;
    markRoadFix(i, j, deltaSteps);
}

/** 整張地圖固定多轉：deltaSteps 0–3 */
function markRoadFixGlobal(deltaSteps) {
    const delta = normalizeRoadFixDelta(deltaSteps);
    const entry = { type: 'global', deltaSteps: delta };
    roadFixNotes.push(entry);
    console.log('[road-fix] 已記錄', formatRoadFixLine(entry));
}

function listRoadFixNotes() {
    if (roadFixNotes.length === 0) {
        console.log('[road-fix] （尚無記錄）');
        return [];
    }
    roadFixNotes.forEach((e, idx) => console.log(`[road-fix] ${idx + 1}. ${formatRoadFixLine(e)}`));
    return roadFixNotes.slice();
}

function getRoadFixReport() {
    if (roadFixNotes.length === 0) return '# road-fix\n（尚無記錄）';
    const lines = ['# road-fix（貼給 Cursor 即可）', ...roadFixNotes.map(formatRoadFixLine)];
    return lines.join('\n');
}

function clearRoadFixNotes() {
    roadFixNotes.length = 0;
    console.log('[road-fix] 已清空');
}

function copyRoadFixReport() {
    const text = getRoadFixReport();
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
            () => console.log('[road-fix] 已複製到剪貼簿：\n' + text),
            () => console.log('[road-fix] 請手動複製：\n' + text)
        );
    } else {
        console.log('[road-fix] 請複製以下內容：\n' + text);
    }
    return text;
}

function setupRoadMaskDebugListener() {
    if (_roadMaskDebugInstalled || typeof window === 'undefined') return;
    const target = renderer && renderer.domElement;
    if (!target) return;
    _roadMaskDebugInstalled = true;
    target.addEventListener('pointermove', onRoadMaskDebugPointerMove, { passive: true });
}

/** 主控台執行：enableRoadMaskDebug() 或 window.__DEBUG_ROAD_MASK__ = true 後再呼叫一次 */
function enableRoadMaskDebug() {
    window.__DEBUG_ROAD_MASK__ = true;
    _roadMaskDebugLastKey = '';
    _roadMaskDebugMissLogged = false;
    setupRoadMaskDebugListener();
    logRoadMaskDebugStatus();
    console.log(
        '[road-debug] 滑鼠在 3D 畫布上移動 → 看 [road-debug]\n' +
        '  這格要轉 90°：markRoadFixHere(1)\n' +
        '  這格要轉 180°：markRoadFixHere(2)\n' +
        '  整張圖都差 180°：markRoadFixGlobal(2)\n' +
        '  貼給 Cursor：copyRoadFixReport()'
    );
}

if (typeof window !== 'undefined') {
    window.enableRoadMaskDebug = enableRoadMaskDebug;
    window.markRoadFix = markRoadFix;
    window.markRoadFixHere = markRoadFixHere;
    window.markRoadFixGlobal = markRoadFixGlobal;
    window.listRoadFixNotes = listRoadFixNotes;
    window.getRoadFixReport = getRoadFixReport;
    window.copyRoadFixReport = copyRoadFixReport;
    window.clearRoadFixNotes = clearRoadFixNotes;
    window.toggleRoadEditorMode = toggleRoadEditorMode;
    window.roadEditorRotate = roadEditorRotate;
    window.roadEditorSetPiece = roadEditorSetPiece;
    window.roadEditorResetCell = roadEditorResetCell;
    window.roadEditorClearAllOverrides = roadEditorClearAllOverrides;
    window.exportRoadOverrides = exportRoadOverrides;
    window.importRoadOverrides = importRoadOverrides;
    window.roadEditorOnPieceChange = roadEditorOnPieceChange;
}

function createKenneyRoadInstance(templateScene, cellSize, rotSteps) {
    const pivot = new THREE.Group();
    const model = templateScene.clone(true);
    pivot.add(model);
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxXZ = Math.max(size.x, size.z, 1e-3);
    const s = cellSize / maxXZ;
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    model.position.x -= (box.min.x + box.max.x) / 2;
    model.position.y -= box.min.y;
    model.position.z -= (box.min.z + box.max.z) / 2;
    const outer = new THREE.Group();
    outer.add(pivot);
    const r = ((rotSteps + KENNEY_ROAD_PHASE_STEPS) % 4 + 4) % 4;
    outer.rotation.y = r * Math.PI / 2;
    outer.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = false;
            obj.receiveShadow = true;
        }
    });
    return outer;
}

function createKenneyBuildingInstance(templateScene, cellSize, rotSteps, heightCapCm) {
    const group = new THREE.Group();
    const model = templateScene.clone(true);
    group.add(model);
    model.rotation.y = rotSteps * Math.PI / 2;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxXZ = Math.max(size.x, size.z, 1e-3);
    const cap = heightCapCm || 280;
    const sFoot = (cellSize * 0.88) / maxXZ;
    const sH = cap / Math.max(size.y, 1e-3);
    const s = Math.min(sFoot, sH);
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    model.position.x -= (box.min.x + box.max.x) / 2;
    model.position.y -= box.min.y;
    model.position.z -= (box.min.z + box.max.z) / 2;
    group.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            obj.isWall = true;
        }
    });
    group.isWall = true;
    return group;
}

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
    if (window.isDroneSimFileOrigin && window.isDroneSimFileOrigin()) {
        console.warn('preloadModels 已略過：file:// 無法載入模型，請用 http://localhost 開啟專案。');
        return;
    }
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

    const kenneyForestModels = [
        ['ground_grass', 'nature/ground_grass.glb'],
        ['path_straight', 'nature/ground_pathStraight.glb'],
        ['path_bend', 'nature/ground_pathBend.glb'],
        ['path_tee', 'nature/ground_pathSplit.glb'],
        ['path_cross', 'nature/ground_pathCross.glb'],
        ['path_end', 'nature/ground_pathEnd.glb'],
        ['path_tile', 'nature/ground_pathTile.glb'],
        ['river_tile', 'nature/ground_riverTile.glb'],
        ['forest_tree_a', 'nature/tree_default.glb'],
        ['forest_tree_b', 'nature/tree_detailed.glb'],
        ['forest_tree_c', 'nature/tree_tall.glb'],
        ['forest_tree_burnt', 'nature/tree_oak_dark.glb'],
        ['forest_rock_a', 'nature/rock_largeA.glb'],
        ['forest_rock_b', 'nature/rock_largeB.glb'],
        ['forest_rock_flat', 'nature/rock_smallFlatA.glb'],
        ['forest_stump', 'nature/stump_old.glb'],
        ['forest_fire_logs', 'nature/campfire_logs.glb'],
        ['base_floor', 'survival/floor.glb'],
        ['base_tent', 'survival/tent.glb'],
        ['goal_floor', 'survival/structure-metal-floor.glb'],
        ['goal_shelter', 'survival/structure-canvas.glb'],
        ['supply_box', 'survival/box.glb'],
        ['supply_box_large', 'survival/box-large.glb'],
        ['supply_barrel', 'survival/barrel.glb'],
        ['base_sign', 'survival/signpost.glb'],
        ['goal_sign', 'survival/signpost-single.glb'],
        ['fire_pit', 'survival/campfire-pit.glb'],
        ['charge_machine', 'factory/machine.glb'],
        ['charge_screen', 'factory/screen-panel-small.glb'],
        ['charge_pad', 'factory/indicator-special-area.glb'],
        ['charge_button', 'factory/button-floor-round.glb'],
        ['charge_warning', 'factory/warning-orange.glb']
    ];
    kenneyForestModels.forEach(([key, relativePath]) => {
        allModels.push({
            key: `kenney_forest_${key}`,
            forestKey: key,
            path: `assets/models/kenney/${relativePath}`,
            required: true,
            preserveMaterial: true
        });
    });

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
                        // 舊模型沿用 Holodeck 材質；Kenney 模型保留原廠配色。
                        if (child.material && !item.preserveMaterial) {
                            child.material.roughness = 0.5; 
                            child.material.metalness = 0.5; 
                        }
                    }
                });
                if (item.forestKey) assets.kenneyForest[item.forestKey] = gltf.scene;
                else assets[item.key] = gltf.scene;
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

    await Promise.all(promises);
    await loadKenneyDistrictTemplates();
    await loadKenneyRoadTemplates();
}
// ==========================================
// 2. 初始化與環境
// ==========================================
async function init3D() {
    if (window.isDroneSimFileOrigin && window.isDroneSimFileOrigin()) {
        console.warn('init3D 已略過：file:// 無法載入 3D 資源，請用 http://localhost 開啟專案。');
        return;
    }
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

    // 燈光設置（供任務二切換低照度氛圍）
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x222222, 1.0); 
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); 
    dirLight.position.set(100, 500, 100); 
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; 
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0008;
    if (dirLight.shadow.normalBias !== undefined) dirLight.shadow.normalBias = 0.03;
    scene.add(dirLight);

    scene.userData.mainHemiLight = hemiLight;
    scene.userData.mainDirLight = dirLight;
    scene.userData.defaultHemi = { sky: 0xffffff, ground: 0x222222, intensity: 1.0 };
    scene.userData.defaultDir = { color: 0xffffff, intensity: 1.2 };

    environmentGroup = new THREE.Group(); 
    scene.add(environmentGroup);

    createDroneModel();
    loadScene('free');

    // 監聽器
    window.addEventListener('resize', onWindowResize);
    container.addEventListener('contextmenu', e => e.preventDefault());
    
    // 滑鼠事件
    container.addEventListener('mousedown', (e) => { 
        if (roadEditorMode && e.button === 0) return;
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

    // 觸控事件 (支援 iPad)
    let lastTouchX = 0, lastTouchY = 0;
    let lastTouchDist = 0;

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isMouseDown = true;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
            mouseX = lastTouchX;
            mouseY = lastTouchY;
        } else if (e.touches.length === 2) {
            isMouseDown = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist = Math.sqrt(dx * dx + dy * dy);
            
            // 雙指中心點作為移動起點
            lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            mouseX = lastTouchX;
            mouseY = lastTouchY;
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        e.preventDefault(); // 防止頁面捲動
        
        if (e.touches.length === 1) {
            // 單指旋轉
            const touch = e.touches[0];
            const dx = touch.clientX - lastTouchX;
            const dy = touch.clientY - lastTouchY;
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
            
            camTheta -= dx * 0.5;
            camPhi -= dy * 0.5;
            camPhi = Math.max(10, Math.min(85, camPhi));
            updateCameraPosition();
        } else if (e.touches.length === 2) {
            // 雙指縮放與移動
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // 縮放 (Zoom)
            const zoomDelta = (lastTouchDist - dist) * 2;
            camRadius += zoomDelta;
            camRadius = Math.max(100, Math.min(1000, camRadius));
            lastTouchDist = dist;

            // 雙指移動 (Pan)
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const pdx = centerX - lastTouchX;
            const pdy = centerY - lastTouchY;
            lastTouchX = centerX;
            lastTouchY = centerY;

            const rad = THREE.MathUtils.degToRad(camTheta);
            camTarget.x -= (pdx * Math.cos(rad) + pdy * Math.sin(rad)) * 2;
            camTarget.z -= (pdy * Math.cos(rad) - pdx * Math.sin(rad)) * 2;
            
            updateCameraPosition();
        }
    }, { passive: false });

    container.addEventListener('touchend', () => {
        isMouseDown = false;
        lastTouchDist = 0;
    });

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
    
    setupRoadMaskDebugListener();
    setupRoadEditorClickListener();
    if (ROAD_EDITOR_UI_ENABLED && typeof URLSearchParams !== 'undefined') {
        const q = new URLSearchParams(window.location.search);
        if (q.get('roadEditor') === '1') {
            setTimeout(() => toggleRoadEditorMode(true), 800);
        }
    }
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
    
    // 更新參考答案按鈕：任務一／任務二顯示，其餘隱藏
    if (typeof updateMazeAnswerButtonVisibility === 'function') {
        updateMazeAnswerButtonVisibility();
    }

    if (typeof updateGotoXyzToolboxVisibility === 'function') {
        updateGotoXyzToolboxVisibility();
    }

    updateRoadEditorButtonVisibility();

}

function disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child.geometry) {
            child.geometry.dispose();
        }
        if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                if (!m) return;
                if (m.map) m.map.dispose();
                m.dispose();
            });
        }
    });
}

function loadScene(type) {
    // 檢查 environmentGroup 是否已初始化
    if (typeof environmentGroup === 'undefined' || !environmentGroup) {
        console.error("environmentGroup is not initialized. Please wait for init3D() to complete.");
        return;
    }

    applyMissionConfigForScene(type);

    clearRoadPieceRegistry();
    roadEditorHighlight = null;

    while (environmentGroup.children.length > 0) {
        const child = environmentGroup.children[0];
        environmentGroup.remove(child);
        disposeObject3D(child);
    }
    ruinsUpdateFunction = null; 
    window.mazeAnimations = []; 
    beaconData = [];           
    beaconsTriggered = 0;      
    takeoffTime = 0;           
    spawnPosition = { x: 0, y: 0, z: 0, heading: 180 }; // 預設起點
    currentMazeGrid = null;    // 重置碰撞地圖
    forestHeightGrid = null;
    forestChargeData = [];
    lastSafePos = { x: 0, y: 0, z: 0 }; // 重置安全位置
    resetTunnelRouteTracking();
    state.missionCompleted = false; // 重置任務完成狀態
    state.hasWater = false;
    currentScore = 0; hasTakenOff = false;
    waterLoaded = false;
    if (type === 'city') resetCityBattery();

    if (type === 'tunnel') {
        restoreDefaultSceneLighting();
        createMazeMap(); 
    } else if (type === 'city') {
        createCityMap();
    } else {
        restoreDefaultSceneLighting();
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

    if (isTunnelMissionScene()) {
        resetTunnelPatrolVisits();
    }
}

/**
 * 任務一：Kenney 建築、路面、起終點箭嘴
 * @param {number[][]} mazeGrid
 * @param {{ cellSize?: number, mazeRoadY?: number, gridStartX: number, gridStartZ: number, includeCheckpoints?: boolean, onStartCell?: Function, onGoalCell?: Function }} opts
 */
function buildUrbanMazeVisuals(mazeGrid, opts) {
    const cellSize = opts.cellSize || 150;
    const mazeRoadY = opts.mazeRoadY != null ? opts.mazeRoadY : 0.38;
    const gridStartX = opts.gridStartX;
    const gridStartZ = opts.gridStartZ;
    const wallHeight = 120;

    const addPiece = (obj) => {
        environmentGroup.add(obj);
        return obj;
    };

    const useKenney = assets.kenneyDistrictTemplates && assets.kenneyDistrictTemplates.length > 0;
    const r = assets.kenneyRoads;
    const useKenneyRoads = !!(r && r.straight && r.bend && r.cross && r.tee && r.end);
    const roadMatOpts = { shininess: 10, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    const roadMat = new THREE.MeshPhongMaterial(Object.assign({ color: 0x323540 }, roadMatOpts));
    const roadMatStart = new THREE.MeshPhongMaterial(Object.assign({ color: 0x353845 }, roadMatOpts));
    const roadMatGoal = new THREE.MeshPhongMaterial(Object.assign({}, roadMatOpts, { color: 0x2a3d32, shininess: 12 }));
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
            const x = gridStartX + j * cellSize + cellSize / 2;
            const z = gridStartZ + i * cellSize + cellSize / 2;

            if (val !== 1) {
                if (useKenneyRoads) {
                    const placed = placeKenneyRoadForCell(i, j, x, z, cellSize, mazeRoadY, mazeGrid);
                    if (!placed) {
                        const rm = val === 3 ? roadMatGoal : (val === 2 ? roadMatStart : roadMat);
                        const road = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.99, cellSize * 0.99), rm);
                        road.rotation.x = -Math.PI / 2;
                        road.position.set(x, mazeRoadY, z);
                        road.receiveShadow = true;
                        addPiece(road);
                    }
                } else {
                    const rm = val === 3 ? roadMatGoal : (val === 2 ? roadMatStart : roadMat);
                    const road = new THREE.Mesh(new THREE.PlaneGeometry(cellSize * 0.99, cellSize * 0.99), rm);
                    road.rotation.x = -Math.PI / 2;
                    road.position.set(x, mazeRoadY, z);
                    road.receiveShadow = true;
                    addPiece(road);
                }
            }

            if (val === 1) {
                if (useKenney) {
                    const plotY = mazeRoadY - 0.04;
                    const plot = createKenneyPlotInstance(cellSize, 0);
                    if (plot) {
                        plot.position.set(x, plotY, z);
                        addPiece(plot);
                    }
                    const tIdx = (i * 7 + j * 11) % assets.kenneyDistrictTemplates.length;
                    const tpl = assets.kenneyDistrictTemplates[tIdx];
                    const rot = (i + j * 2) % 4;
                    const heightCap = 230 + ((i + j) % 5) * 28;
                    const building = createKenneyBuildingInstance(tpl, cellSize, rot, heightCap);
                    building.position.set(x, 0, z);
                    addPiece(building);
                } else {
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.set(x, wallHeight / 2, z);
                    wall.isWall = true;
                    const edges = new THREE.EdgesGeometry(wallGeo);
                    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00adb5, transparent: true, opacity: 0.5 }));
                    line.position.copy(wall.position);
                    line.isWall = true;
                    addPiece(line);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    addPiece(wall);
                }
            } else if (val === 2) {
                const padY = mazeRoadY + 0.12;
                addPiece(createLandingPad(x, z, padY));
                const arrow = createWaypointArrowMarker(x, z, padY, {
                    color: 0x4dabf7,
                    emissive: 0x228be6,
                    kind: 'alpha'
                });

                spawnPosition = { x, y: 0, z, heading: 180 };
                startPosition = { x, y: 0, z, heading: 180 };
                lastSafePos = { x, y: 0, z };
                state.x = x;
                state.z = z;
                state.y = 0;
                state.heading = 180;
                if (typeof opts.onStartCell === 'function') opts.onStartCell(i, j, x, z);
            } else if (val === 3) {
                const goalLight = new THREE.PointLight(0x00ff00, 2, 500);
                goalLight.position.set(x, 50, z);
                goalLight.isExit = true;
                addPiece(goalLight);

                const exitMarker = new THREE.Mesh(
                    new THREE.PlaneGeometry(cellSize, cellSize),
                    new THREE.MeshBasicMaterial({
                        color: 0x00ff00,
                        transparent: true,
                        opacity: 0.35,
                        side: THREE.DoubleSide
                    })
                );
                exitMarker.rotation.x = -Math.PI / 2;
                exitMarker.position.set(x, mazeRoadY + 0.15, z);
                exitMarker.isExit = true;
                addPiece(exitMarker);

                const arrow = createWaypointArrowMarker(x, z, mazeRoadY + 0.15, {
                    color: 0x51cf66,
                    emissive: 0x2f9e44,
                    kind: 'bravo'
                });

                targetPosition = { x, z };
                if (typeof opts.onGoalCell === 'function') opts.onGoalCell(i, j, x, z);
            } else if (val === 4 && opts.includeCheckpoints) {
                createBeacon(i, j, x, z);
            }
        }
    }
}

function createMazeMap() {
    createHolodeckRoom();
    loadRoadOverridesFromStorage();
    clearRoadPieceRegistry();

    scene.background = new THREE.Color(0x1e2228);
    scene.fog = new THREE.Fog(0x1e2228, 1600, 5800);
    
    // 地面分層：網格與路面勿太近，否則與 Holodeck 底面（y≈0）易 Z-fighting / 陰影粉刺閃爍
    const mazeGridY = 0.06;
    const mazeRoadY = 0.38;
    tunnelMazeRoadSurfaceY = mazeRoadY;
    ensureRoadEditorHighlightMesh();

    // 1. 地面網格（街區：較低調）
    const gridHelper = new THREE.GridHelper(5000, 100, 0x3d5566, 0x252a32);
    gridHelper.position.y = mazeGridY;
    environmentGroup.add(gridHelper);

    // 2. 迷宮設計 (1: 牆壁, 0: 通路, 2: 指揮所 Alpha, 3: 集結區 Bravo, 4: 巡檢回報點)
    const mazeGrid = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 0, 0, 1, 0, 4, 0, 0, 0, 0, 1],
        [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
        [1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1],
        [1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 4, 1],
        [1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
        [1, 4, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 3], // 將終點 3 移到最右側邊界牆壁位置
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];

    const cellSize = 150; // cm (改為 150 以對應地板 3x3 格)
    
    // 標準化座標：gridStartX 是最左側邊界 (Edge) 的絕對座標
    const gridStartX = -(mazeGrid[0].length * cellSize) / 2;
    const gridStartZ = -(mazeGrid.length * cellSize) / 2;

    // 儲存迷宮參數供碰撞偵測使用
    currentMazeGrid = mazeGrid;
    currentCellSize = cellSize;
    mazeOffsetX = gridStartX;
    mazeOffsetZ = gridStartZ;

    buildUrbanMazeVisuals(mazeGrid, {
        cellSize,
        mazeRoadY,
        gridStartX,
        gridStartZ,
        includeCheckpoints: true,
        onStartCell(i, j, x, z) {
            tunnelStartCell = { i, j };
            console.log(`📍 指揮所 Alpha 起降點: (${x.toFixed(1)}, ${z.toFixed(1)})`);
            if (typeof window !== 'undefined' && window.__DEBUG_ROAD_MASK__) {
                logRoadMaskDebugStatus();
            }
        },
        onGoalCell(i, j) {
            tunnelGoalCell = { i, j };
        }
    });
    updateRoadEditorHighlight();
    updateRoadEditorPanel();
}

function createBeacon(i, j, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 50, z);

    const cellKey = i + ',' + j;
    const meta = getActiveInspectionNames()[cellKey] || { label: '巡檢回報點', labelEn: 'Inspection Point' };

    const beacon = {
        i,
        j,
        x: x,
        z: z,
        label: meta.label,
        labelEn: meta.labelEn,
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
    resetDefaultSimulatorAtmosphere();
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
    
    // 任務二：14×14 場地內依高度圖整格整平
    if (typeof currentSceneType !== 'undefined' && isCityMissionScene()
        && currentMazeGrid && currentCellSize && forestHeightGrid) {
        const gx = Math.floor((x - mazeOffsetX) / currentCellSize);
        const gz = Math.floor((z - mazeOffsetZ) / currentCellSize);
        if (gz >= 0 && gz < currentMazeGrid.length && gx >= 0 && gx < currentMazeGrid[0].length) {
            return forestHeightGrid[gz][gx];
        }
    }

    // 檢查座標落在哪個格子內 (使用緩衝範圍判斷，確保整塊格位平整)
    if (currentMazeGrid && currentCellSize) {
        // 檢查中心及四個角落，只要靠近特殊格位就整平
        const checkPoints = [[0,0], [60,60], [-60,60], [60,-60], [-60,-60]];
        for (let p of checkPoints) {
            const gx = Math.floor((x + p[0] - mazeOffsetX) / currentCellSize);
            const gz = Math.floor((z + p[1] - mazeOffsetZ) / currentCellSize);
            
            if (gz >= 0 && gz < currentMazeGrid.length && gx >= 0 && gx < currentMazeGrid[0].length) {
                const val = currentMazeGrid[gz][gx];
                if (val === 5) return 0; // 水源（全平地）
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

    // 底色：深森林綠（中等照度）
    ctx.fillStyle = '#1a2816';
    ctx.fillRect(0, 0, size, size);

    // 加入隨機泥土與草叢斑點 (Organic Noise)
    for (let i = 0; i < 6000; i++) {
        const rx = Math.random() * size;
        const ry = Math.random() * size;
        const rs = 1 + Math.random() * 3;
        const rand = Math.random();
        if (rand > 0.7) ctx.fillStyle = '#263820'; // 草地綠
        else if (rand > 0.3) ctx.fillStyle = '#121c10'; // 深綠影
        else ctx.fillStyle = '#2e2218'; // 泥土棕
        ctx.fillRect(rx, ry, rs, rs);
    }

    // 極淡的網格線 (輔助用，不應干擾視覺)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    return canvas;
}

/** 任務二：可見地面高度（對應 ground mesh 的 position.y = -0.5） */
function getForestSurfaceY(x, z) {
    return getForestHeight(x, z) - 0.5;
}

/** 任務二：14×14 高度圖（全平地） */
function buildForestHeightGrid(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function forestCellRandom(i, j, salt = 0) {
    const n = Math.sin((i + 1) * 127.1 + (j + 1) * 311.7 + salt * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

function createKenneyForestInstance(key, footprint, heightCap, options = {}) {
    const template = assets.kenneyForest[key];
    if (!template) return null;
    const root = new THREE.Group();
    const model = template.clone(true);
    root.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const footprintScale = footprint / Math.max(size.x, size.z, 1e-3);
    const heightScale = heightCap ? heightCap / Math.max(size.y, 1e-3) : footprintScale;
    model.scale.setScalar(Math.min(footprintScale, heightScale));
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    model.position.x -= (box.min.x + box.max.x) / 2;
    model.position.y -= box.min.y;
    model.position.z -= (box.min.z + box.max.z) / 2;
    root.rotation.y = options.rotation || 0;
    root.position.set(options.x || 0, options.y || 0, options.z || 0);
    root.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = options.castShadow !== false;
        obj.receiveShadow = true;
        if (options.isWall) obj.isWall = true;
    });
    if (options.isWall) root.isWall = true;
    return root;
}

function addKenneyForestProp(parent, key, footprint, heightCap, options = {}) {
    const instance = createKenneyForestInstance(key, footprint, heightCap, options);
    if (instance) parent.add(instance);
    return instance;
}

function getForestPathPiece(grid, i, j) {
    const open = (row, col) => !!grid[row] && grid[row][col] !== undefined && grid[row][col] !== 1;
    const dirs = [open(i - 1, j), open(i, j + 1), open(i + 1, j), open(i, j - 1)];
    const count = dirs.filter(Boolean).length;
    let key = 'path_tile';
    let nativeExits = [];
    if (count >= 4) {
        key = 'path_cross'; nativeExits = [0, 1, 2, 3];
    } else if (count === 3) {
        // Kenney ground_pathSplit 的原生出口為東、南、西。
        key = 'path_tee'; nativeExits = [1, 2, 3];
    } else if (count === 2 && ((dirs[0] && dirs[2]) || (dirs[1] && dirs[3]))) {
        // ground_pathStraight 原生方向為北、南。
        key = 'path_straight'; nativeExits = [0, 2];
    } else if (count === 2) {
        // ground_pathBend 原生出口為東、南。
        key = 'path_bend'; nativeExits = [1, 2];
    } else if (count === 1) {
        // ground_pathEnd 原生出口朝南。
        key = 'path_end'; nativeExits = [2];
    }

    const desired = dirs.map(Boolean);
    for (let steps = 0; steps < 4; steps++) {
        const rotated = [false, false, false, false];
        nativeExits.forEach(direction => {
            // Three.js 正 Y 軸旋轉：北→西→南→東。
            rotated[(direction - steps + 4) % 4] = true;
        });
        if (rotated.every((value, direction) => value === desired[direction])) {
            return { key, rotation: steps * Math.PI / 2 };
        }
    }
    return { key, rotation: 0 };
}

function addForestGroundTile(grid, i, j, x, z, cellSize, value) {
    let piece = { key: 'ground_grass', rotation: 0 };
    if (value === 5) piece = { key: 'river_tile', rotation: 0 };
    else if (value !== 1) piece = getForestPathPiece(grid, i, j);
    const tile = createKenneyForestInstance(piece.key, cellSize, 30, {
        rotation: piece.rotation,
        castShadow: false
    });
    if (!tile) return;
    tile.position.set(x, -0.5, z);
    environmentGroup.add(tile);
}

let forestFlameSpriteSheet = null;

function createForestFlameSpriteSheet() {
    if (forestFlameSpriteSheet) return forestFlameSpriteSheet;
    const frameSize = 128;
    const frameCount = 8;
    const canvas = document.createElement('canvas');
    canvas.width = frameSize * frameCount;
    canvas.height = frameSize;
    const ctx = canvas.getContext('2d');

    for (let frame = 0; frame < frameCount; frame++) {
        const left = frame * frameSize;
        const sway = Math.sin((frame / frameCount) * Math.PI * 2) * 9;
        const pulse = Math.sin((frame / frameCount) * Math.PI * 4) * 5;
        const flamePath = (baseY, width, tipY, offsetX) => {
            ctx.beginPath();
            ctx.moveTo(left + 64 - width / 2, baseY);
            ctx.bezierCurveTo(left + 35 + offsetX, 92, left + 47 + sway, 55, left + 64 + sway, tipY);
            ctx.bezierCurveTo(left + 79 + sway, 58, left + 94 + offsetX, 91, left + 64 + width / 2, baseY);
            ctx.bezierCurveTo(left + 82, 119, left + 45, 120, left + 64 - width / 2, baseY);
            ctx.closePath();
        };

        const outer = ctx.createLinearGradient(0, 25, 0, 122);
        outer.addColorStop(0, 'rgba(255,235,86,0.92)');
        outer.addColorStop(0.42, 'rgba(255,122,22,0.96)');
        outer.addColorStop(1, 'rgba(190,30,8,0.05)');
        ctx.fillStyle = outer;
        flamePath(120, 80 + pulse, 20 + pulse, sway * 0.25);
        ctx.fill();

        const inner = ctx.createLinearGradient(0, 58, 0, 120);
        inner.addColorStop(0, 'rgba(255,255,205,0.95)');
        inner.addColorStop(0.55, 'rgba(255,218,60,0.94)');
        inner.addColorStop(1, 'rgba(255,100,10,0.12)');
        ctx.fillStyle = inner;
        flamePath(121, 42 + pulse * 0.5, 57 - pulse, -sway * 0.2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    forestFlameSpriteSheet = texture;
    return texture;
}

function createForestFireEffects(i, j) {
    const effects = new THREE.Group();
    effects.userData.isForestFireEffects = true;
    const phase = forestCellRandom(i, j, 42) * 1000;

    for (let planeIndex = 0; planeIndex < 2; planeIndex++) {
        const texture = createForestFlameSpriteSheet().clone();
        texture.needsUpdate = true;
        texture.repeat.set(1 / 8, 1);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const flame = new THREE.Mesh(new THREE.PlaneGeometry(64, 102), material);
        flame.position.y = 53;
        flame.rotation.y = planeIndex * Math.PI / 2;
        flame.renderOrder = 3;
        effects.add(flame);
        window.mazeAnimations.push(() => {
            if (!effects.visible) return;
            const frame = Math.floor((Date.now() + phase) / 85) % 8;
            texture.offset.x = frame / 8;
            const flicker = 0.94 + Math.sin((Date.now() + phase) * 0.018) * 0.06;
            flame.scale.set(flicker, 0.97 + (1 - flicker) * 0.6, 1);
        });
    }

    const light = new THREE.PointLight(0xff7a24, 0.9, 260);
    light.position.y = 55;
    effects.add(light);

    const smokeMaterial = new THREE.MeshBasicMaterial({
        color: 0x302d2a,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
    });
    for (let smokeIndex = 0; smokeIndex < 4; smokeIndex++) {
        const smoke = new THREE.Mesh(new THREE.SphereGeometry(10, 8, 8), smokeMaterial.clone());
        effects.add(smoke);
        window.mazeAnimations.push(() => {
            if (!effects.visible) return;
            const cycle = ((Date.now() + phase + smokeIndex * 420) % 1800) / 1800;
            smoke.position.set(
                Math.sin(cycle * Math.PI * 2 + smokeIndex) * 12,
                78 + cycle * 115,
                Math.cos(cycle * Math.PI * 2 + smokeIndex) * 9
            );
            smoke.scale.setScalar(0.7 + cycle * 1.7);
            smoke.material.opacity = 0.2 * (1 - cycle);
        });
    }

    window.mazeAnimations.push(() => {
        if (!effects.visible) return;
        light.intensity = 0.72 + Math.sin((Date.now() + phase) * 0.021) * 0.18 + Math.random() * 0.08;
    });
    return effects;
}

function renderKenneyForestCell(grid, i, j, x, z, h, cellSize, value) {
    if (value === 0) return true;

    if (value === 1) {
        // 格位碰撞盒只負責物理判定，不會渲染。
        const collider = new THREE.Mesh(
            new THREE.BoxGeometry(cellSize, 400, cellSize),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        collider.position.set(x, h + 200, z);
        collider.isWall = true;
        environmentGroup.add(collider);

        const nearFire = grid.some((row, fireI) => row.some((cell, fireJ) => {
            if (cell !== 4) return false;
            return Math.hypot(fireI - i, fireJ - j) < 1.6;
        }));
        const cluster = new THREE.Group();
        cluster.position.set(x, h, z);
        const variants = nearFire
            ? ['forest_tree_burnt', 'forest_stump', 'forest_fire_logs']
            : ['forest_tree_a', 'forest_tree_b', 'forest_tree_c', 'forest_rock_a', 'forest_rock_b'];
        for (let k = 0; k < 3; k++) {
            const r = forestCellRandom(i, j, k + 1);
            const key = variants[Math.floor(r * variants.length)];
            const isRock = key.includes('rock') || key.includes('stump') || key.includes('logs');
            const angle = r * Math.PI * 2;
            const radius = 14 + forestCellRandom(i, j, k + 9) * 38;
            addKenneyForestProp(cluster, key, isRock ? 48 : 58, isRock ? 55 : 165, {
                x: Math.cos(angle) * radius,
                z: Math.sin(angle) * radius,
                rotation: forestCellRandom(i, j, k + 18) * Math.PI * 2,
                isWall: true
            });
        }
        environmentGroup.add(cluster);
        return true;
    }

    if (value === 2 || value === 3) {
        const camp = new THREE.Group();
        camp.position.set(x, h, z);
        if (value === 2) {
            addKenneyForestProp(camp, 'base_floor', 118, 16, { castShadow: false });
            addKenneyForestProp(camp, 'base_tent', 62, 65, { x: 28, z: 25, rotation: Math.PI });
            addKenneyForestProp(camp, 'supply_box', 25, 27, { x: -34, z: 28 });
            addKenneyForestProp(camp, 'supply_barrel', 22, 34, { x: -35, z: -27 });
            addKenneyForestProp(camp, 'base_sign', 24, 58, { x: 42, z: -34, rotation: -Math.PI / 4 });
            startPosition = { x, y: h + 14, z, heading: 180 };
            spawnPosition = { ...startPosition };
            state.x = x; state.z = z; state.y = h + 14;
            lastSafePos = { x, y: h + 14, z };
            createWaypointArrowMarker(x, z, h + 10, {
                color: 0x4dabf7,
                emissive: 0x228be6,
                kind: 'alpha'
            });
        } else {
            addKenneyForestProp(camp, 'goal_floor', 118, 18, { castShadow: false });
            addKenneyForestProp(camp, 'goal_shelter', 66, 70, { x: 25, z: 22, rotation: Math.PI });
            addKenneyForestProp(camp, 'supply_box_large', 31, 34, { x: -31, z: 26 });
            addKenneyForestProp(camp, 'goal_sign', 22, 56, { x: -38, z: -31, rotation: Math.PI / 4 });
            targetPosition = { x, z };
            createWaypointArrowMarker(x, z, h + 10, {
                color: 0x51cf66,
                emissive: 0x2f9e44,
                kind: 'bravo'
            });
        }
        environmentGroup.add(camp);
        return true;
    }

    if (value === 4) {
        const fire = new THREE.Group();
        fire.position.set(x, h, z);
        fire.userData.isForestFire = true;
        fire.userData.fireIJ = `${i},${j}`;
        const pit = addKenneyForestProp(fire, 'fire_pit', 78, 72, { rotation: forestCellRandom(i, j, 30) * Math.PI * 2 });
        const logs = addKenneyForestProp(fire, 'forest_fire_logs', 62, 24, { y: 1, rotation: Math.PI / 3 });
        [pit, logs].forEach(prop => {
            if (!prop) return;
            prop.traverse(child => {
                if (!child.isMesh || !child.material) return;
                child.material = child.material.clone();
                if (child.material.color) child.material.color.multiplyScalar(0.62);
            });
        });
        addKenneyForestProp(fire, 'forest_stump', 28, 38, { x: 45, z: 28, rotation: 1.2 });
        const effects = createForestFireEffects(i, j);
        fire.userData.effects = effects;
        fire.add(effects);
        createFireSiteLabel(fire, i, j);
        environmentGroup.add(fire);
        return true;
    }

    if (value === 5) {
        const water = new THREE.Group();
        water.position.set(x, h, z);
        water.userData.isWaterSource = true;
        for (let k = 0; k < 6; k++) {
            const angle = (k / 6) * Math.PI * 2;
            addKenneyForestProp(water, 'forest_rock_flat', 25, 12, {
                x: Math.cos(angle) * 56,
                z: Math.sin(angle) * 56,
                rotation: angle
            });
        }
        environmentGroup.add(water);
        return true;
    }

    if (value === 6) {
        createForestChargeStation(i, j, x, z, h);
        return true;
    }
    return false;
}

/** 任務二：以 Kenney Factory Kit 組裝充電站。 */
function createForestChargeStation(i, j, x, z, groundH) {
    const group = new THREE.Group();
    group.position.set(x, groundH, z);
    addKenneyForestProp(group, 'charge_pad', 105, 20, { castShadow: false });
    addKenneyForestProp(group, 'charge_machine', 58, 82, { z: 17, isWall: true });
    addKenneyForestProp(group, 'charge_screen', 34, 44, { x: 38, z: -20, rotation: -Math.PI / 4 });
    addKenneyForestProp(group, 'charge_button', 28, 12, { x: -38, z: -24, castShadow: false });
    addKenneyForestProp(group, 'charge_warning', 20, 42, { x: -43, z: 28 });

    // clone(true) 仍會共用材質；每座充電站必須擁有獨立材質，才可分站發光。
    const baseAppearance = [];
    group.traverse(child => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const cloned = materials.map(material => material.clone());
        child.material = Array.isArray(child.material) ? cloned : cloned[0];
        cloned.forEach(material => {
            baseAppearance.push({
                material,
                color: material.color ? material.color.getHex() : null,
                emissive: material.emissive ? material.emissive.getHex() : null,
                emissiveIntensity: material.emissiveIntensity
            });
        });
    });

    environmentGroup.add(group);

    forestChargeData.push({
        i, j, x, z,
        groundH,
        label: '充電站',
        triggered: false,
        hoverTimer: 0,
        mesh: group,
        baseAppearance
    });
}

/** 任務二：高程區塊視覺（土丘台地，非建築） */
function addForestTerrainTerraces(grid, heights, cellSize, offsetX, offsetZ) {
    const tierMat = (h) => new THREE.MeshPhongMaterial({
        color: h >= 200 ? 0x524838 : h >= 120 ? 0x465040 : 0x3a4832,
        flatShading: true
    });

    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
            const h = heights[i][j];
            if (h <= 8) continue;
            const val = grid[i][j];
            if (val === 5) continue;
            const x = j * cellSize + offsetX + cellSize / 2;
            const z = i * cellSize + offsetZ + cellSize / 2;
            const blockH = h + 0.5;
            const terrace = new THREE.Mesh(
                new THREE.BoxGeometry(cellSize * 0.97, blockH, cellSize * 0.97),
                tierMat(h)
            );
            terrace.position.set(x, blockH / 2 - 0.5, z);
            terrace.receiveShadow = true;
            environmentGroup.add(terrace);

            if (val === 0 && h >= 120) {
                const beacon = new THREE.Mesh(
                    new THREE.CylinderGeometry(6, 8, 35, 6),
                    new THREE.MeshPhongMaterial({ color: 0x7a6848, flatShading: true })
                );
                beacon.position.set(x + cellSize * 0.32, h + 20, z + cellSize * 0.32);
                environmentGroup.add(beacon);
            }
        }
    }
}

/** 任務二：場地氛圍光（中等照度，柔和外圈補光） */
function addForestPerimeterLighting(offsetX, offsetZ, mapW, mapD) {
    applyForestSceneAtmosphere();

    const rimSky = new THREE.HemisphereLight(0x5a5448, 0x222018, 0.22);
    environmentGroup.add(rimSky);

    const y = 240;
    const cx = offsetX + mapW / 2;
    const cz = offsetZ + mapD / 2;
    const points = [
        [offsetX, offsetZ],
        [offsetX + mapW, offsetZ],
        [offsetX + mapW, offsetZ + mapD],
        [offsetX, offsetZ + mapD],
        [cx, offsetZ],
        [cx, offsetZ + mapD],
        [offsetX, cz],
        [offsetX + mapW, cz]
    ];
    points.forEach(([px, pz]) => {
        const lamp = new THREE.PointLight(0xd8c8a8, 0.32, mapW * 0.85);
        lamp.position.set(px, y, pz);
        environmentGroup.add(lamp);
    });
}

/** 任務二：在 14×14 山火場上疊加 150cm 格線與通路標記（保留森林情境，非街區風格） */
function addForestPlayfieldGridOverlay(grid, cellSize, offsetX, offsetZ) {
    const rows = grid.length;
    const cols = grid[0].length;
    const mapW = cols * cellSize;
    const mapD = rows * cellSize;
    const gridLift = 0.08;
    const yAt = (x, z) => getForestSurfaceY(x, z) + gridLift;

    const linePoints = [];
    const pushSeg = (x1, z1, x2, z2) => {
        linePoints.push(x1, yAt(x1, z1), z1, x2, yAt(x2, z2), z2);
    };

    // 垂直格線（沿 Z）
    for (let j = 0; j <= cols; j++) {
        const x = offsetX + j * cellSize;
        for (let i = 0; i < rows; i++) {
            const z1 = offsetZ + i * cellSize;
            const z2 = offsetZ + (i + 1) * cellSize;
            pushSeg(x, z1, x, z2);
        }
    }

    // 水平格線（沿 X）
    for (let i = 0; i <= rows; i++) {
        const z = offsetZ + i * cellSize;
        for (let j = 0; j < cols; j++) {
            const x1 = offsetX + j * cellSize;
            const x2 = offsetX + (j + 1) * cellSize;
            pushSeg(x1, z, x2, z);
        }
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
    environmentGroup.add(new THREE.LineSegments(
        gridGeo,
        new THREE.LineBasicMaterial({ color: 0x4a5538, transparent: true, opacity: 0.55, depthWrite: false })
    ));

    // 場地外框（貼地）
    const x0 = offsetX;
    const x1 = offsetX + mapW;
    const z0 = offsetZ;
    const z1 = offsetZ + mapD;
    const borderPoints = [];
    const pushBorder = (x1p, z1p, x2p, z2p) => {
        borderPoints.push(x1p, yAt(x1p, z1p) + 0.03, z1p, x2p, yAt(x2p, z2p) + 0.03, z2p);
    };
    for (let j = 0; j < cols; j++) {
        const xa = offsetX + j * cellSize;
        const xb = offsetX + (j + 1) * cellSize;
        pushBorder(xa, z0, xb, z0);
        pushBorder(xa, z1, xb, z1);
    }
    for (let i = 0; i < rows; i++) {
        const za = offsetZ + i * cellSize;
        const zb = offsetZ + (i + 1) * cellSize;
        pushBorder(x0, za, x0, zb);
        pushBorder(x1, za, x1, zb);
    }
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPoints, 3));
    environmentGroup.add(new THREE.LineSegments(
        borderGeo,
        new THREE.LineBasicMaterial({ color: 0x5c5040, transparent: true, opacity: 0.62, depthWrite: false })
    ));

    const trailMat = new THREE.MeshBasicMaterial({
        color: 0x5a6648,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const trailGeo = new THREE.PlaneGeometry(cellSize * 0.94, cellSize * 0.94);

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (grid[i][j] !== 0) continue;
            const x = j * cellSize + offsetX + cellSize / 2;
            const z = i * cellSize + offsetZ + cellSize / 2;
            const patch = new THREE.Mesh(trailGeo, trailMat);
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(x, getForestSurfaceY(x, z) + gridLift, z);
            patch.renderOrder = 1;
            environmentGroup.add(patch);
        }
    }
}

function buildForestGridScene(forestGrid, logLabel) {
    applyForestSceneAtmosphere();

    const cellSize = 150;
    const offsetX = -(forestGrid[0].length * cellSize) / 2;
    const offsetZ = -(forestGrid.length * cellSize) / 2;

    currentMazeGrid = forestGrid;
    currentCellSize = cellSize;
    mazeOffsetX = offsetX;
    mazeOffsetZ = offsetZ;
    forestHeightGrid = buildForestHeightGrid(forestGrid);
    forestChargeData = [];

    addForestPerimeterLighting(offsetX, offsetZ, forestGrid[0].length * cellSize, forestGrid.length * cellSize);

    // 3. 放置場景物件（基地 2@1,1 · 受災區 3@1,12 · 水/火/充電見格網配置）
    for (let i = 0; i < forestGrid.length; i++) {
        for (let j = 0; j < forestGrid[i].length; j++) {
            const val = forestGrid[i][j];
            const x = j * cellSize + offsetX + cellSize/2;
            const z = i * cellSize + offsetZ + cellSize/2;
            const h = getForestHeight(x, z);
            addForestGroundTile(forestGrid, i, j, x, z, cellSize, val);
            if (renderKenneyForestCell(forestGrid, i, j, x, z, h, cellSize, val)) continue;

            if (val === 1) {
                // --- 物理碰撞強化：增加隱形格位碰撞盒 ---
                // 確保整格 150x150cm 區域都是實體障礙，無人機無法從樹縫穿過
                const wallBoxGeo = new THREE.BoxGeometry(cellSize, 400, cellSize);
                const wallBoxMat = new THREE.MeshBasicMaterial({ visible: false }); // 隱形
                const wallBox = new THREE.Mesh(wallBoxGeo, wallBoxMat);
                wallBox.position.set(x, h + 200, z);
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

                const cluster = new THREE.Group();
                cluster.position.set(x, h, z);
                const count = isBurnt ? 2 : 3;
                for (let k = 0; k < count; k++) {
                    const r = forestCellRandom(i, j, k + 1);
                    const angle = r * Math.PI * 2;
                    const radius = 16 + forestCellRandom(i, j, k + 10) * 34;
                    const options = {
                        x: Math.cos(angle) * radius,
                        z: Math.sin(angle) * radius,
                        rotation: forestCellRandom(i, j, k + 20) * Math.PI * 2,
                        isWall: true
                    };
                    if (isBurnt) {
                        addKenneyForestProp(cluster, k === 0 ? 'forest_tree_burnt' : 'forest_stump', k === 0 ? 55 : 34, k === 0 ? 145 : 45, options);
                    } else {
                        const variants = ['forest_tree_a', 'forest_tree_b', 'forest_tree_c', 'forest_rock_a', 'forest_rock_b'];
                        const key = variants[Math.floor(r * variants.length)];
                        const isRock = key.indexOf('rock') >= 0;
                        addKenneyForestProp(cluster, key, isRock ? 50 : 58, isRock ? 58 : 165, options);
                    }
                }
                environmentGroup.add(cluster);
            } else if (val === 0) {
                // 可飛行路徑已由 Kenney ground_path* 模型完整呈現。
            } else if (val === 2 || val === 3) {
                // --- 森林救援木製平台 (替換原本的 H 停機坪) ---
                const h = getForestHeight(x, z);
                const platformGroup = new THREE.Group();
                platformGroup.position.set(x, h, z);
                environmentGroup.add(platformGroup);

                // 主平台 (木板質感)
                const plateGeo = new THREE.BoxGeometry(cellSize * 0.8, 8, cellSize * 0.8);
                const plateMat = new THREE.MeshPhongMaterial({ 
                    color: val === 2 ? 0x4a3828 : 0x244a28,
                    flatShading: true 
                });
                const plate = new THREE.Mesh(plateGeo, plateMat);
                plate.position.y = 4;
                platformGroup.add(plate);

                // 平台上的標記 (淡色半透明方塊)
                const markerGeo = new THREE.PlaneGeometry(cellSize * 0.5, cellSize * 0.5);
                const markerMat = new THREE.MeshBasicMaterial({ 
                    color: 0xa0a098, 
                    transparent: true, 
                    opacity: 0.18,
                    side: THREE.DoubleSide 
                });
                const marker = new THREE.Mesh(markerGeo, markerMat);
                marker.rotation.x = -Math.PI/2;
                marker.position.y = 8.1;
                platformGroup.add(marker);

                // 四角的支撐圓木
                const legGeo = new THREE.CylinderGeometry(8, 8, 30, 8);
                const legMat = new THREE.MeshPhongMaterial({ color: 0x281a14 });
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
                    createWaypointArrowMarker(x, z, h + 8, {
                        color: 0x4dabf7,
                        emissive: 0x228be6,
                        kind: 'alpha'
                    });
                } else {
                    targetPosition = { x, z };
                    createWaypointArrowMarker(x, z, h + 8, {
                        color: 0x51cf66,
                        emissive: 0x2f9e44,
                        kind: 'bravo'
                    });
                }
            } else if (val === 4) {
                // --- 寫實火場設計 (恢復代碼) ---
                const h = getForestHeight(x, z);
                const fireGroup = new THREE.Group();
                fireGroup.position.set(x, h, z);
                fireGroup.userData.isForestFire = true;
                fireGroup.userData.fireIJ = i + ',' + j;
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
                        opacity: 0.35,
                        blending: THREE.NormalBlending,
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

                createFlameLayer(28, 70, 0x883818, 0.04);
                createFlameLayer(18, 50, 0x994422, -0.05);

                const fireLight = new THREE.PointLight(0x883020, 0.55, 160);
                fireLight.position.y = 40;
                fireGroup.add(fireLight);
                window.mazeAnimations.push(() => {
                    fireLight.intensity = 0.35 + Math.random() * 0.2;
                });

                // 4. 煙霧粒子
                for (let m = 0; m < 3; m++) {
                    const smokeGeo = new THREE.SphereGeometry(12, 8, 8);
                    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.2 });
                    const smoke = new THREE.Mesh(smokeGeo, smokeMat);
                    fireGroup.add(smoke);
                    const offset = m * 50;
                    window.mazeAnimations.push(() => {
                        const t = (Date.now() * 0.1 + offset) % 400;
                        smoke.position.y = 60 + t * 0.8;
                        smoke.position.x = Math.sin(t * 0.05) * 20;
                        smoke.scale.setScalar(1 + t * 0.01);
                        smoke.material.opacity = 0.2 * (1 - t / 400);
                    });
                }

                // 5. 火點優先序標籤（A/B/C/D）
                createFireSiteLabel(fireGroup, i, j);
            } else if (val === 5) {
                // --- 寫實水源設計（全平地：水面略低於地面） ---
                const waterH = h + 1;
                const lakeGroup = new THREE.Group();
                lakeGroup.position.set(x, waterH, z);
                environmentGroup.add(lakeGroup);

                const lakeGeo = new THREE.CircleGeometry(cellSize * 0.45, 32); // 縮小一點點，確保在整平區域內
                const lakeMat = new THREE.MeshStandardMaterial({ 
                    color: 0x003366, 
                    metalness: 0.55,
                    roughness: 0.32,
                    transparent: true,
                    opacity: 0.82
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
            } else if (val === 6) {
                createForestChargeStation(i, j, x, z, h);
            }
        }
    }
    console.log(logLabel || '🌲 Kenney 山火場已載入');
}

function createCityMap() {
    buildForestGridScene([
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 2, 0, 0, 5, 0, 1, 1, 0, 0, 0, 0, 3, 1],
        [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 4, 1],
        [1, 0, 1, 0, 0, 6, 0, 0, 0, 0, 1, 1, 0, 1],
        [1, 0, 1, 1, 0, 0, 1, 1, 5, 0, 4, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1],
        [1, 1, 1, 0, 0, 1, 1, 0, 6, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1],
        [1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 5, 0, 0, 1, 1, 0, 1],
        [1, 1, 0, 1, 1, 1, 0, 6, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 4, 0, 0, 0, 1, 1, 0, 1, 1],
        [1, 0, 5, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ], '🌲 任務二 14×14 山火場已載入（全平地 · 格線 150cm）');
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

function createLandingPad(x, z, yCm) {
    const y = typeof yCm === 'number' ? yCm : 0.2;
    const canvas = createLandingPadTexture();
    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(40, 40);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    const pad = new THREE.Mesh(geometry, material);
    pad.rotation.x = -Math.PI / 2; pad.position.set(x, y, z);
    return pad;
}

/** 任務二：由格座標取得火點字母標籤（A–D） */
function getFireSiteLetterFromCell(i, j) {
    const site = getActiveFireSites()[i + ',' + j];
    if (!site || !site.label) return null;
    const match = site.label.match(/([A-D])\s*$/);
    return match ? match[1] : null;
}

/** 任務二：火點浮動標籤貼圖（A 點金色高亮） */
function createFireLabelTexture(letter, isPriority) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const radius = 100;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    if (isPriority) {
        ctx.fillStyle = 'rgba(255, 213, 79, 0.94)';
        ctx.fill();
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#e65100';
        ctx.stroke();
    } else {
        ctx.fillStyle = 'rgba(32, 18, 12, 0.9)';
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#ff6b35';
        ctx.stroke();
    }

    ctx.font = `bold ${isPriority ? 128 : 112}px Arial, "Microsoft JhengHei", sans-serif`;
    ctx.fillStyle = isPriority ? '#b71c1c' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, cx, cy + 4);

    if (isPriority) {
        ctx.font = 'bold 30px Arial, "Microsoft JhengHei", sans-serif';
        ctx.fillStyle = '#5d4037';
        ctx.fillText('+200', cx, cy + 64);
    }

    return canvas;
}

/** 任務二：在火點上方建立 A/B/C/D 浮動標籤 */
function createFireSiteLabel(fireGroup, i, j) {
    const letter = getFireSiteLetterFromCell(i, j);
    if (!letter) return null;

    const site = getActiveFireSites()[i + ',' + j];
    const sites = getActiveFireSites();
    let maxPriority = 0;
    Object.keys(sites).forEach((key) => {
        const p = sites[key].priority || 0;
        if (p > maxPriority) maxPriority = p;
    });
    const isPriority = !!(site && site.priority >= maxPriority && maxPriority > 0);

    const texture = new THREE.CanvasTexture(createFireLabelTexture(letter, isPriority));
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    const labelSize = isPriority ? 76 : 66;
    const baseY = 98;
    sprite.position.set(0, baseY, 0);
    sprite.scale.set(labelSize, labelSize, 1);
    sprite.renderOrder = 12;
    sprite.userData.fireLabel = letter;

    if (!window.mazeAnimations) window.mazeAnimations = [];
    window.mazeAnimations.push(() => {
        sprite.position.y = baseY + Math.sin(Date.now() * 0.003 + letter.charCodeAt(0) * 0.4) * 7;
    });

    fireGroup.add(sprite);
    return sprite;
}

/**
 * 任務一：立體箭嘴標示（懸浮、指向地面起點／終點）
 * @param {number} x
 * @param {number} z
 * @param {number} groundY 箭嘴指向的地面高度
 * @param {{ color?: number, emissive?: number, kind?: 'alpha'|'bravo' }} options
 */
function createWaypointArrowMarker(x, z, groundY, options) {
    options = options || {};
    const color = options.color != null ? options.color : 0x00adb5;
    const emissive = options.emissive != null ? options.emissive : color;
    const kind = options.kind || 'waypoint';

    const root = new THREE.Group();
    root.position.set(x, groundY, z);
    root.userData.waypointKind = kind;

    const floater = new THREE.Group();
    root.add(floater);

    const shaftH = 58;
    const headH = 40;
    const tipClearance = 10;
    const mat = new THREE.MeshPhongMaterial({
        color,
        emissive,
        emissiveIntensity: 0.5,
        shininess: 36,
        transparent: true,
        opacity: 0.94
    });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 7.5, shaftH, 12), mat);
    shaft.position.y = tipClearance + headH + shaftH / 2;
    floater.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(24, headH, 16), mat.clone());
    head.rotation.x = Math.PI;
    head.position.y = tipClearance + headH / 2;
    floater.add(head);

    const halo = new THREE.Mesh(
        new THREE.RingGeometry(22, 30, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = tipClearance + 1;
    floater.add(halo);

    const light = new THREE.PointLight(color, 1.4, 380);
    light.position.y = tipClearance + headH + shaftH + 18;
    floater.add(light);

    const floatCenter = tipClearance + headH + shaftH + 95;
    const update = () => {
        const t = Date.now() * 0.0022;
        floater.position.y = floatCenter + Math.sin(t) * 14;
        floater.rotation.y += 0.004;
    };
    if (!window.mazeAnimations) window.mazeAnimations = [];
    window.mazeAnimations.push(update);

    environmentGroup.add(root);
    return root;
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

function isWalkableGridVal(val) {
    return val !== 1;
}

function resetTunnelRouteTracking() {
    visitedWalkableCells = new Set();
    tunnelStartCell = null;
    tunnelGoalCell = null;
    _tunnelFinishHintLastLog = 0;
}

function resetTunnelPatrolVisits() {
    visitedWalkableCells = new Set();
    _tunnelFinishHintLastLog = 0;
    if (tunnelStartCell) {
        visitedWalkableCells.add(tunnelStartCell.i + ',' + tunnelStartCell.j);
    }
}

function getDroneGridCell() {
    if (!currentMazeGrid || !currentCellSize) return null;
    const j = Math.floor((state.x - mazeOffsetX) / currentCellSize);
    const i = Math.floor((state.z - mazeOffsetZ) / currentCellSize);
    if (i < 0 || j < 0 || i >= currentMazeGrid.length || j >= currentMazeGrid[0].length) return null;
    return { i, j, val: currentMazeGrid[i][j] };
}

function recordTunnelPatrolVisit() {
    if (!isTunnelMissionScene() || !currentMazeGrid || state.missionCompleted) return;
    if (state.y > TUNNEL_LEGIT_PATROL_HEIGHT_CM) return;
    const cell = getDroneGridCell();
    if (!cell || !isWalkableGridVal(cell.val)) return;
    visitedWalkableCells.add(cell.i + ',' + cell.j);
}

function isVisitedPathConnectedStartToGoal() {
    if (!tunnelStartCell || !tunnelGoalCell || visitedWalkableCells.size === 0) return false;
    const startKey = tunnelStartCell.i + ',' + tunnelStartCell.j;
    const goalKey = tunnelGoalCell.i + ',' + tunnelGoalCell.j;
    if (!visitedWalkableCells.has(startKey) || !visitedWalkableCells.has(goalKey)) return false;

    const queue = [startKey];
    const seen = new Set([startKey]);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    while (queue.length > 0) {
        const key = queue.shift();
        if (key === goalKey) return true;
        const parts = key.split(',');
        const si = parseInt(parts[0], 10);
        const sj = parseInt(parts[1], 10);
        for (let d = 0; d < dirs.length; d++) {
            const ni = si + dirs[d][0];
            const nj = sj + dirs[d][1];
            const nk = ni + ',' + nj;
            if (!visitedWalkableCells.has(nk) || seen.has(nk)) continue;
            seen.add(nk);
            queue.push(nk);
        }
    }
    return false;
}

function evaluateTunnelMissionCompletion() {
    const cell = getDroneGridCell();
    if (!cell || cell.val !== 3) {
        return { ok: false, reason: 'not_on_bravo' };
    }
    if (state.isFlying) {
        return { ok: false, reason: 'still_flying' };
    }
    if (state.y > TUNNEL_MISSION_EXIT_MAX_ALT_CM) {
        return { ok: false, reason: 'too_high' };
    }
    if (!isVisitedPathConnectedStartToGoal()) {
        return { ok: false, reason: 'invalid_path' };
    }
    return { ok: true, reason: null };
}

function maybeLogTunnelFinishHint(reason) {
    const now = Date.now();
    if (now - _tunnelFinishHintLastLog < 3500) return;
    _tunnelFinishHintLastLog = now;
    const messages = {
        not_on_bravo: '⚠️ 請飛入疏散集結區 Bravo 格子並降落，才能完成交班。',
        still_flying: '⚠️ 請在 Bravo 使用「降落」積木完成交班（不可懸停結算）。',
        too_high: '⚠️ 請降低高度後在 Bravo 降落。',
        invalid_path: '⚠️ 未沿可通行路網抵達（不可翻越建築捷徑）。請沿路飛行再試。'
    };
    logToConsole(messages[reason] || '⚠️ 尚不符合任務完成條件。');
}

function handleWallCollision() {
    if (!currentMazeGrid) return;

    const kenneyUrbanMaze = isTunnelMissionScene()
        && assets.kenneyDistrictTemplates
        && assets.kenneyDistrictTemplates.length > 0;

    if (kenneyUrbanMaze && state.y > TUNNEL_KENNEY_MAX_FLIGHT_CM) {
        state.y = TUNNEL_KENNEY_MAX_FLIGHT_CM;
    }

    // 森林場景樹木較高 (400cm)；tunnel Kenney 街區任何高度皆檢查建築格
    let wallHeightLimit = isCityMissionScene() ? 420 : 125;
    if (kenneyUrbanMaze) {
        wallHeightLimit = 280;
    }
    if (!isTunnelMissionScene() && state.y > wallHeightLimit) {
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

const TUNNEL_INSPECTION_HOVER_RADIUS_CM = 70;
const TUNNEL_INSPECTION_HOVER_ALT_CM = 50;
const TUNNEL_INSPECTION_HOVER_ALT_TOLERANCE_CM = 45;
const TUNNEL_INSPECTION_HOVER_SECONDS = 3.0;

function isDroneOnInspectionBeacon(beacon) {
    const dist = Math.sqrt(Math.pow(state.x - beacon.x, 2) + Math.pow(state.z - beacon.z, 2));
    const heightDiff = Math.abs(state.y - TUNNEL_INSPECTION_HOVER_ALT_CM);
    return dist < TUNNEL_INSPECTION_HOVER_RADIUS_CM && heightDiff < TUNNEL_INSPECTION_HOVER_ALT_TOLERANCE_CM;
}

function completeInspectionBeacon(beacon) {
    if (beacon.triggered) return;
    beacon.triggered = true;
    beaconsTriggered++;
    currentScore += 100;
    beacon.hoverTimer = 0;
    const name = beacon.label || '巡檢回報點';
    logToConsole(`✅ 巡檢回報完成：${name} (+100) 已完成 ${beaconsTriggered}/${getRequiredBeacons()}`);
    if (beacon.mesh) {
        beacon.mesh.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.color.setHex(0xffff00);
                if (child.material.emissive) {
                    child.material.emissive.setHex(0xffff00);
                    child.material.emissiveIntensity = 1.0;
                }
            }
        });
    }
}

/** hover 積木結束時計入模擬秒數（不受 3× 執行速度影響） */
function creditTunnelInspectionHover(simulatedSeconds) {
    if (!isTunnelMissionScene() || state.missionCompleted) return;
    let onAnyBeacon = false;
    beaconData.forEach(beacon => {
        if (beacon.triggered) return;
        if (!isDroneOnInspectionBeacon(beacon)) return;
        onAnyBeacon = true;
        beacon.hoverTimer += simulatedSeconds;
        if (beacon.hoverTimer >= TUNNEL_INSPECTION_HOVER_SECONDS) {
            completeInspectionBeacon(beacon);
        } else {
            logToConsole(`⏳ 巡檢回報中… ${beacon.hoverTimer.toFixed(1)}/${TUNNEL_INSPECTION_HOVER_SECONDS} 秒（${beacon.label}）`);
        }
    });
    if (!onAnyBeacon) {
        logToConsole('⚠️ 未在巡檢回報點範圍內：請飛到藍色巡檢點正上方再 hover ≥3 秒。');
    }
}

function checkMissionLogic() {
    if (!isTunnelMissionScene()) return;

    // 1. 起飛計時 (僅在未完成時計時)
    if (!state.missionCompleted) {
        if (takeoffTime === 0 && state.y > 10) {
            takeoffTime = Date.now();
            logToConsole("⏱️ 已離開指揮所 Alpha，任務計時開始！");
        }
    }

    // 2. 巡檢回報點（懸停上傳資料，僅任務一）
    if (isTunnelMissionScene() && state.isFlying && !state.missionCompleted) {
        beaconData.forEach(beacon => {
            if (beacon.triggered) return;
            if (isDroneOnInspectionBeacon(beacon)) {
                beacon.hoverTimer += 0.02;
                if (beacon.hoverTimer >= TUNNEL_INSPECTION_HOVER_SECONDS) {
                    completeInspectionBeacon(beacon);
                }
            } else {
                beacon.hoverTimer = 0;
            }
        });
    }

    // 3. 任務完成：tunnel 須在 Bravo 格、已降落、沿路網連通
    if (isTunnelMissionScene() && !state.missionCompleted && takeoffTime !== 0) {
        const completion = evaluateTunnelMissionCompletion();
        if (!completion.ok) {
            const cell = getDroneGridCell();
            const distToBravo = Math.sqrt(
                Math.pow(state.x - targetPosition.x, 2) + Math.pow(state.z - targetPosition.z, 2)
            );
            if (cell && (cell.val === 3 || distToBravo < 150)) {
                maybeLogTunnelFinishHint(completion.reason);
            }
        } else {
            finishTunnelMission();
        }
        return;
    }

    const distToExit = Math.sqrt(Math.pow(state.x - targetPosition.x, 2) + Math.pow(state.z - targetPosition.z, 2));

}

function finishTunnelMission() {
    if (state.missionCompleted) return;
    state.missionCompleted = true;
    state.endTime = Date.now();

    const timeElapsed = Math.floor((state.endTime - takeoffTime) / 1000);
    const timeResult = getTunnelMissionTimeBonus(timeElapsed);
    const timeBonus = timeResult.bonus;
    const finalScore = 200 + (beaconsTriggered * 100) + timeBonus;

    const finishMsg = '🏁 已抵達疏散集結區 Bravo，情報已交付！正在結算成績…';
    console.log(finishMsg);
    logToConsole(finishMsg);

    state.stopSignal = true;
    state.isRunning = false;

    setTimeout(() => {
        if (typeof window.showResultModal === 'function') {
            window.showResultModal({
                mission: activeMissionConfig.resultMissionId,
                beacons: beaconsTriggered,
                beaconsScore: beaconsTriggered * 100,
                exitScore: 200,
                time: timeElapsed,
                timeTierLabel: timeResult.label,
                timeBonus: Math.floor(timeBonus),
                total: Math.floor(finalScore)
            });
        } else if (typeof window.showAppMessage === 'function') {
            window.showAppMessage({
                variant: 'info',
                title: '任務完成',
                body: `總得分：${Math.floor(finalScore)}`,
                nextStep: '成績單元件未載入時顯示此訊息；請重新整理或檢查 main.js 是否載入。',
                autoHideMs: 12000,
                focusClose: false
            });
        } else {
            alert(`任務完成！總得分：${Math.floor(finalScore)}`);
        }
    }, 800);
}

function getGroundHeight(x, z) {
    if (typeof currentSceneType !== 'undefined' && isCityMissionScene()
        && typeof getForestHeight === 'function') {
        const h = getForestHeight(x, z);
        return h + 15;
    }
    return 0;
}

/** 依迷宮網格估算感測器方向上的牆距（cm），與 raycast 取較小值以對齊 grid 碰撞 */
function estimateGridWallDistance(type) {
    if (!currentMazeGrid || !currentCellSize) return 500;
    const gridStartX = mazeOffsetX;
    const gridStartZ = mazeOffsetZ;
    const rad = THREE.MathUtils.degToRad(state.heading);
    let dx = 0;
    let dz = 0;
    if (type === 'front') {
        dx = -Math.sin(rad);
        dz = -Math.cos(rad);
    } else if (type === 'left') {
        dx = -Math.cos(rad);
        dz = Math.sin(rad);
    } else if (type === 'right') {
        dx = Math.cos(rad);
        dz = -Math.sin(rad);
    } else {
        return 500;
    }
    const step = currentCellSize * 0.45;
    const maxDist = 1000;
    let dist = 0;
    let px = state.x;
    let pz = state.z;
    while (dist < maxDist) {
        px += dx * step;
        pz += dz * step;
        dist += step;
        const j = Math.floor((px - gridStartX) / currentCellSize);
        const i = Math.floor((pz - gridStartZ) / currentCellSize);
        if (i < 0 || j < 0 || i >= currentMazeGrid.length || j >= currentMazeGrid[0].length) {
            break;
        }
        if (currentMazeGrid[i][j] === 1) {
            return Math.max(0, dist - step * 0.5);
        }
    }
    return 500;
}

// 任務二邏輯變數
let waterLoaded = false;
const CITY_BATTERY_START_LINES = 20;
const CITY_BATTERY_CHARGE_LINES = 15;
let cityBatteryLines = CITY_BATTERY_START_LINES;
let firesExtinguished = 0;
let mission2FirePoints = 0;
let mission2FiresScored = new Set();

/** 任務二：受災區降落結算時，相對平台高度上限 (cm) */
const CITY_MISSION_EXIT_MAX_REL_ALT_CM = 120;
/** 任務二：全數撲滅火點額外獎金（須在受災區降落結算時一併判定） */
const MISSION2_ALL_FIRES_BONUS = 200;
const MISSION2_REQUIRED_FIRES = 4;
/** 任務二：時間獎段位（山火任務較長，上限 10 分鐘） */
const MISSION2_TIME_TIERS = [
    { maxSec: 240, bonus: 450, label: '≤ 4 分鐘', labelShort: '極快' },
    { maxSec: 360, bonus: 300, label: '≤ 6 分鐘', labelShort: '快' },
    { maxSec: 480, bonus: 150, label: '≤ 8 分鐘', labelShort: '中等' },
    { maxSec: 600, bonus: 50, label: '≤ 10 分鐘', labelShort: '慢' }
];

function getMission2FirePointValue(i, j) {
    const site = getActiveFireSites()[i + ',' + j];
    if (!site) return 100;
    if (site.priority >= 280) return 200;
    if (site.priority >= 230) return 150;
    if (site.priority >= 190) return 125;
    return 100;
}

function getMission2TimeBonus(timeElapsedSec) {
    const elapsed = Math.max(0, Math.floor(timeElapsedSec));
    for (let i = 0; i < MISSION2_TIME_TIERS.length; i++) {
        const tier = MISSION2_TIME_TIERS[i];
        if (elapsed <= tier.maxSec) {
            return { bonus: tier.bonus, label: tier.labelShort, tierIndex: i };
        }
    }
    return { bonus: 0, label: '超時', tierIndex: -1 };
}

function awardMission2FireScore(i, j) {
    if (!isCityMissionScene() || state.missionCompleted) return 0;
    const key = i + ',' + j;
    if (mission2FiresScored.has(key)) return 0;
    mission2FiresScored.add(key);
    const pts = getMission2FirePointValue(i, j);
    mission2FirePoints += pts;
    currentScore += pts;
    return pts;
}

function evaluateCityMissionCompletion() {
    const cell = getDroneGridCell();
    if (!cell || cell.val !== 3) {
        return { ok: false, reason: 'not_on_goal' };
    }
    if (state.isFlying) {
        return { ok: false, reason: 'still_flying' };
    }
    const groundH = typeof getForestHeight === 'function' ? getForestHeight(state.x, state.z) : 0;
    const relAlt = state.y - groundH;
    if (relAlt > CITY_MISSION_EXIT_MAX_REL_ALT_CM) {
        return { ok: false, reason: 'too_high' };
    }
    return { ok: true, reason: null };
}

function maybeLogCityFinishHint(reason) {
    const now = Date.now();
    if (now - _cityFinishHintLastLog < 3500) return;
    _cityFinishHintLastLog = now;
    const required = getRequiredFires();
    const messages = {
        not_on_goal: '⚠️ 請飛入受災區的金屬救援平台並降落，才能結算成績。',
        still_flying: '⚠️ 請在受災區使用「降落」積木完成交班（不可懸停結算）。',
        too_high: '⚠️ 請降低高度後在受災區降落。'
    };
    logToConsole(messages[reason] || '⚠️ 尚不符合任務完成條件。');
    if (reason === 'not_on_goal' || reason === 'still_flying') {
        logToConsole(`💡 撲滅火點愈多分數愈高；全數 ${required} 處撲滅可額外 +${MISSION2_ALL_FIRES_BONUS} 分。`);
    }
}

function maybeFinishCityMission() {
    if (!isCityMissionScene() || state.missionCompleted || takeoffTime === 0) return;
    const completion = evaluateCityMissionCompletion();
    if (!completion.ok) {
        const cell = getDroneGridCell();
        const distToGoal = Math.sqrt(
            Math.pow(state.x - targetPosition.x, 2) + Math.pow(state.z - targetPosition.z, 2)
        );
        if (cell && (cell.val === 3 || distToGoal < 150)) {
            maybeLogCityFinishHint(completion.reason);
        }
        return;
    }
    finishCityMission();
}

function finishCityMission() {
    if (state.missionCompleted) return;
    state.missionCompleted = true;
    state.endTime = Date.now();

    const timeElapsed = Math.floor((state.endTime - takeoffTime) / 1000);
    const timeResult = getMission2TimeBonus(timeElapsed);
    const requiredFires = getRequiredFires();
    const allFiresCleared = firesExtinguished >= requiredFires;
    const allFiresBonus = allFiresCleared ? MISSION2_ALL_FIRES_BONUS : 0;
    const finalScore = mission2FirePoints + allFiresBonus + timeResult.bonus;
    currentScore = finalScore;

    const finishMsg = allFiresCleared
        ? '🏁 已抵達受災區並降落，全數火點已撲滅！正在結算成績…'
        : '🏁 已抵達受災區並降落，正在結算成績…';
    console.log(finishMsg);
    logToConsole(finishMsg);

    state.stopSignal = true;
    state.isRunning = false;

    setTimeout(() => {
        if (typeof window.showResultModal === 'function') {
            window.showResultModal({
                mission: activeMissionConfig.resultMissionId,
                row1Label: '撲滅火點',
                row1Count: `${firesExtinguished} / ${requiredFires}`,
                row1Score: mission2FirePoints,
                row2Label: '全數撲滅',
                row2Status: allFiresCleared ? 'YES' : `${firesExtinguished}/${requiredFires}`,
                row2Score: allFiresBonus,
                beacons: firesExtinguished,
                beaconsScore: mission2FirePoints,
                exitScore: allFiresBonus,
                time: timeElapsed,
                timeTierLabel: timeResult.label,
                timeBonus: Math.floor(timeResult.bonus),
                total: Math.floor(finalScore)
            });
        } else if (typeof window.showAppMessage === 'function') {
            window.showAppMessage({
                variant: 'info',
                title: '任務完成',
                body: `總得分：${Math.floor(finalScore)}`,
                nextStep: '成績單元件未載入時顯示此訊息；請重新整理或檢查 main.js 是否載入。',
                autoHideMs: 12000,
                focusClose: false
            });
        } else {
            alert(`任務完成！總得分：${Math.floor(finalScore)}`);
        }
    }, 800);
}

if (typeof window !== 'undefined') {
    window.MISSION2_TIME_TIERS = MISSION2_TIME_TIERS;
    window.awardMission2FireScore = awardMission2FireScore;
    window.maybeFinishCityMission = maybeFinishCityMission;
    window.resetInspectionBeacons = resetInspectionBeacons;
    window.resetCityMissionState = resetCityMissionState;
    window.resetTunnelPatrolVisits = resetTunnelPatrolVisits;
}

function resetInspectionBeacons() {
    beaconsTriggered = 0;
    beaconData.forEach((beacon) => {
        beacon.triggered = false;
        beacon.hoverTimer = 0;
        if (!beacon.mesh) return;
        beacon.mesh.traverse((child) => {
            if (!child.isMesh || !child.material) return;
            child.material.color.setHex(0x00adb5);
            if (child.material.emissive) {
                child.material.emissive.setHex(0x00adb5);
                child.material.emissiveIntensity = 0.5;
            }
        });
    });
}

function resetForestChargeStations() {
    forestChargeData.forEach((station) => {
        station.triggered = false;
        station.hoverTimer = 0;
        (station.baseAppearance || []).forEach(base => {
            if (base.color !== null && base.material.color) base.material.color.setHex(base.color);
            if (base.emissive !== null && base.material.emissive) base.material.emissive.setHex(base.emissive);
            if (typeof base.emissiveIntensity === 'number') base.material.emissiveIntensity = base.emissiveIntensity;
        });
    });
}

function resetForestFires() {
    if (typeof environmentGroup === 'undefined') return;
    environmentGroup.traverse((obj) => {
        if (obj.userData && obj.userData.isForestFire) {
            obj.visible = true;
            obj.userData.extinguished = false;
            if (obj.userData.effects) obj.userData.effects.visible = true;
        }
    });
}

function resetCityMissionState() {
    resetCityBattery();
    resetForestFires();
    resetForestChargeStations();
    state.hasWater = false;
}

function resetCityBattery() {
    cityBatteryLines = CITY_BATTERY_START_LINES;
    firesExtinguished = 0;
    mission2FirePoints = 0;
    mission2FiresScored = new Set();
    _cityFinishHintLastLog = 0;
}

/** 任務二：找無人機附近最近的可互動格（水源/火點） */
function findCityInteractionCell(matchVal) {
    if (!isCityMissionScene() || !currentMazeGrid || !currentCellSize) return null;
    let best = null;
    for (let i = 0; i < currentMazeGrid.length; i++) {
        for (let j = 0; j < currentMazeGrid[i].length; j++) {
            const val = currentMazeGrid[i][j];
            if (typeof matchVal === 'function' ? !matchVal(val) : val !== matchVal) continue;
            const cx = j * currentCellSize + mazeOffsetX + currentCellSize / 2;
            const cz = i * currentCellSize + mazeOffsetZ + currentCellSize / 2;
            const dist = Math.hypot(state.x - cx, state.z - cz);
            if (dist < 95 && (!best || dist < best.dist)) {
                best = { i, j, val, dist };
            }
        }
    }
    return best;
}

function hideForestFireAt(i, j) {
    const key = i + ',' + j;
    if (typeof environmentGroup === 'undefined') return;
    environmentGroup.traverse((obj) => {
        if (obj.userData && obj.userData.isForestFire && obj.userData.fireIJ === key) {
            obj.userData.extinguished = true;
            if (obj.userData.effects) obj.userData.effects.visible = false;
        }
    });
}

function getCityBatteryRemainingLines() {
    return cityBatteryLines;
}

function consumeCityBatteryLine(cmd) {
    if (!isCityMissionScene()) return true;
    if (!cmd || !cmd.type || !cmd.type.startsWith('move_')) return true;
    if (cityBatteryLines <= 0) return false;
    cityBatteryLines--;
    return true;
}

function addCityBatteryLines(amount) {
    if (!isCityMissionScene()) return 0;
    const before = cityBatteryLines;
    cityBatteryLines += amount;
    return cityBatteryLines - before;
}

function isDroneOnForestChargePad(station) {
    if (!currentMazeGrid || !currentCellSize) return false;
    const gj = Math.floor((state.x - mazeOffsetX) / currentCellSize);
    const gi = Math.floor((state.z - mazeOffsetZ) / currentCellSize);
    if (gi !== station.i || gj !== station.j) return false;
    const minY = station.groundH + 25;
    const maxY = station.groundH + 220;
    return state.y >= minY && state.y <= maxY;
}

function completeForestCharge(station) {
    station.triggered = true;
    station.hoverTimer = 0;
    const added = addCityBatteryLines(CITY_BATTERY_CHARGE_LINES);
    logToConsole(`⚡ 充電完成！電池 +${added} 行（剩餘 ${getCityBatteryRemainingLines()} 行）`);
    if (station.mesh) {
        station.mesh.traverse(child => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    if (material.color) material.color.setHex(0x81c784);
                    if (material.emissive) {
                        material.emissive.setHex(0x4caf50);
                        material.emissiveIntensity = 0.5;
                    }
                });
            }
        });
    }
}

/** hover 積木結束時計入模擬秒數（不受 3× 執行速度影響） */
function creditForestChargeHover(simulatedSeconds) {
    if (!isCityMissionScene()) return;
    let onAnyPad = false;
    forestChargeData.forEach(station => {
        if (station.triggered) return;
        if (!isDroneOnForestChargePad(station)) return;
        onAnyPad = true;
        station.hoverTimer += simulatedSeconds;
        if (station.hoverTimer >= 3.0) {
            completeForestCharge(station);
        } else {
            logToConsole(`⏳ 充電中… ${station.hoverTimer.toFixed(1)}/3.0 秒（${station.label}）`);
        }
    });
    if (!onAnyPad) {
        logToConsole('⚠️ 未在充電站格位上方：請飛到黃色充電站正上方再 hover ≥3 秒。');
    }
}

function checkCityLogic() {
    if (!isCityMissionScene()) return;
    if (state.missionCompleted) return;

    if (takeoffTime === 0 && state.isFlying) {
        const groundH = typeof getForestHeight === 'function' ? getForestHeight(state.x, state.z) : 0;
        if (state.y > groundH + 35) {
            takeoffTime = Date.now();
            logToConsole('⏱️ 已離開基地，任務計時開始！');
        }
    }

    if (state.isFlying) {
        // 離開充電格時重置未完成的充電進度
        forestChargeData.forEach(station => {
            if (station.triggered) return;
            if (!isDroneOnForestChargePad(station)) {
                station.hoverTimer = 0;
            }
        });
        return;
    }

    maybeFinishCityMission();
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
            if (currentSceneType === 'tunnel') {
                value = Math.min(value, estimateGridWallDistance(type));
            }
        } else {
            value = 500;
        }
        
        // 增加調試日誌，查看傳感器讀值
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

    recordTunnelPatrolVisit();

    // 執行任務邏輯 (計分、觸發)
    checkMissionLogic();

    // 執行迷宮動畫（巡檢回報點旋轉等）
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
    if (isCityMissionScene()) checkCityLogic();
    else if (state.isFlying) checkCityLogic();
    
    // 更新 HUD 內容 (加入實時分數與時間)
    let hudHTML = `<div style="margin-bottom:5px; font-weight:bold; color:#00adb5; border-bottom:1px solid rgba(0,173,181,0.3); padding-bottom:5px;">MODE: ${followDrone?"FOLLOW":"FREE LOOK"}</div>`;
    
    if (isTunnelMissionScene()) {
        const currentTime = state.missionCompleted ? (state.endTime || Date.now()) : Date.now();
        const timeElapsed = takeoffTime === 0 ? 0 : Math.floor((currentTime - takeoffTime) / 1000);
        hudHTML += `<div style="color:#ff9800; font-size:1.1rem; font-weight:bold;">SCORE: ${Math.floor(currentScore)}</div>`;
        hudHTML += `<div style="color:#ffffff;">TIME: ${timeElapsed}s ${state.missionCompleted ? '🏁' : ''}</div>`;
        hudHTML += `<div style="color:#00ff00;">巡檢回報: ${beaconsTriggered}/${getRequiredBeacons()}</div>`;
        hudHTML += `<div style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;"></div>`;
    }

    if (isCityMissionScene()) {
        const currentTime = state.missionCompleted ? (state.endTime || Date.now()) : Date.now();
        const timeElapsed = takeoffTime === 0 ? 0 : Math.floor((currentTime - takeoffTime) / 1000);
        const batteryLeft = getCityBatteryRemainingLines();
        const waterStatus = state.hasWater ? 'FULL' : 'EMPTY';
        const charged = forestChargeData.filter(s => s.triggered).length;
        const chargeTotal = forestChargeData.length;
        hudHTML += `<div style="color:#ff9800; font-size:1.1rem; font-weight:bold;">SCORE: ${Math.floor(currentScore)}</div>`;
        hudHTML += `<div style="color:#ffffff;">TIME: ${timeElapsed}s ${state.missionCompleted ? '🏁' : ''}</div>`;
        hudHTML += `<div style="color:#ff4400; font-size:1.05rem; font-weight:bold;">BATTERY: ${batteryLeft} 行 (移動)</div>`;
        hudHTML += `<div style="color:#ff6b35;">火點: ${firesExtinguished}/${getRequiredFires()}</div>`;
        hudHTML += `<div style="color:${state.hasWater ? '#00adb5' : '#aaa'};">WATER: ${waterStatus}</div>`;
        hudHTML += `<div style="color:#ffd54f;">充電站: ${charged}/${chargeTotal}</div>`;
        hudHTML += `<div style="color:#4dabf7;">起點藍箭嘴 → 終點綠箭嘴</div>`;
        hudHTML += `<div style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;"></div>`;
    }


    const displayAlt = isCityMissionScene() ? state.y - getForestHeight(state.x, state.z) : state.y;
    hudHTML += `Status: ${state.isFlying?'FLYING':'LANDED'}<br>Alt: ${Math.round(displayAlt)} cm`;
    // 結構化 Flight／NAV HUD 由 main.js 統一更新，避免每幀重建 DOM。
    if (typeof window.updateFlightTelemetry === 'function') window.updateFlightTelemetry();

    updateCameraPosition();
    renderer.render(scene, camera);
}

if (typeof window !== 'undefined') {
    window.getRequiredBeacons = getRequiredBeacons;
    window.getRequiredFires = getRequiredFires;
    window.isTunnelMissionScene = isTunnelMissionScene;
    window.isCityMissionScene = isCityMissionScene;
    window.updateRoadEditorButtonVisibility = updateRoadEditorButtonVisibility;
}

/**
 * 驗證任務一參考答案路徑：格線碰撞、三巡檢點、Bravo 連通
 */
const cellSize = 150;
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
    [1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 3],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const CHECKPOINTS = ['1,6', '5,10', '9,1'];
const START = { i: 1, j: 1 };
const GOAL = { i: 10, j: 11 };

/** 與 loadMazeAnswer 任務一路徑一致（heading 180 不變）— 巡檢點已移至 (1,6)/(5,10)/(9,1)，路徑待重算 */
const MOVES = [
    ['LEFT', 300],
    ['FORWARD', 300],
    ['LEFT', 300],
    ['BACKWARD', 300],
    ['LEFT', 750],
    ['RIGHT', 750],
    ['FORWARD', 300],
    ['RIGHT', 600],
    ['FORWARD', 600],
    ['LEFT', 450],
    ['BACKWARD', 300],
    ['RIGHT', 150],
    ['LEFT', 150],
    ['FORWARD', 300],
    ['LEFT', 600],
    ['FORWARD', 450],
    ['LEFT', 450],
];

function headingToDelta(headingDeg, dir) {
    const rad = (headingDeg * Math.PI) / 180;
    const forward = { dx: -Math.sin(rad), dz: -Math.cos(rad) };
    const left = { dx: -Math.cos(rad), dz: Math.sin(rad) };
    const right = { dx: Math.cos(rad), dz: -Math.sin(rad) };
    if (dir === 'FORWARD') return forward;
    if (dir === 'BACKWARD') return { dx: -forward.dx, dz: -forward.dz };
    if (dir === 'LEFT') return left;
    if (dir === 'RIGHT') return right;
    throw new Error('bad dir ' + dir);
}

function worldToGrid(x, z, offsetX, offsetZ) {
    return {
        j: Math.floor((x - offsetX) / cellSize),
        i: Math.floor((z - offsetZ) / cellSize),
    };
}

function gridToWorld(i, j, offsetX, offsetZ) {
    return {
        x: offsetX + j * cellSize + cellSize / 2,
        z: offsetZ + i * cellSize + cellSize / 2,
    };
}

function isWalkable(i, j) {
    if (i < 0 || j < 0 || i >= mazeGrid.length || j >= mazeGrid[0].length) return false;
    return mazeGrid[i][j] !== 1;
}

function bfsConnected(visited, startKey, goalKey) {
    const queue = [startKey];
    const seen = new Set([startKey]);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (queue.length) {
        const key = queue.shift();
        if (key === goalKey) return true;
        const [si, sj] = key.split(',').map(Number);
        for (const [di, dj] of dirs) {
            const nk = `${si + di},${sj + dj}`;
            if (!visited.has(nk) || seen.has(nk)) continue;
            seen.add(nk);
            queue.push(nk);
        }
    }
    return false;
}

function runVerification(runId) {
    const offsetX = -(mazeGrid[0].length * cellSize) / 2;
    const offsetZ = -(mazeGrid.length * cellSize) / 2;
    let heading = 180;
    const startWorld = gridToWorld(START.i, START.j, offsetX, offsetZ);
    let x = startWorld.x;
    let z = startWorld.z;
    const visited = new Set();
    const pathCells = [];

    function recordPos() {
        const { i, j } = worldToGrid(x, z, offsetX, offsetZ);
        const key = `${i},${j}`;
        if (!visited.has(key)) {
            visited.add(key);
            pathCells.push({ i, j, val: mazeGrid[i][j] });
        }
        return { i, j, key };
    }

    recordPos();
    const errors = [];

    for (const [dir, dist] of MOVES) {
        const { dx, dz } = headingToDelta(heading, dir);
        const steps = Math.round(dist / cellSize);
        const stepX = (dx * cellSize);
        const stepZ = (dz * cellSize);
        for (let s = 0; s < steps; s++) {
            x += stepX;
            z += stepZ;
            const { i, j, key } = recordPos();
            if (!isWalkable(i, j)) {
                errors.push(`run ${runId}: wall at (${i},${j}) after ${dir} ${dist}`);
            }
        }
    }

    const end = recordPos();
    for (const cp of CHECKPOINTS) {
        if (!visited.has(cp)) errors.push(`run ${runId}: missed checkpoint ${cp}`);
    }
    if (end.i !== GOAL.i || end.j !== GOAL.j) {
        errors.push(`run ${runId}: ended at (${end.i},${end.j}) expected (${GOAL.i},${GOAL.j})`);
    }
    const startKey = `${START.i},${START.j}`;
    const goalKey = `${GOAL.i},${GOAL.j}`;
    if (!bfsConnected(visited, startKey, goalKey)) {
        errors.push(`run ${runId}: visited cells not connected start→goal`);
    }

    return { errors, end, visitedCount: visited.size, pathCells };
}

const allErrors = [];
for (let r = 1; r <= 5; r++) {
    const { errors, end, visitedCount } = runVerification(r);
    allErrors.push(...errors);
    console.log(`Run ${r}: end=(${end.i},${end.j}) visited=${visitedCount} errors=${errors.length}`);
}

if (allErrors.length) {
    console.error('FAILED:', allErrors);
    process.exit(1);
}
console.log('OK: 5/5 runs — path valid, all checkpoints, reaches Bravo, BFS connected');

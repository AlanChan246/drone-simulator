#!/usr/bin/env node
/**
 * 任務二參考答案生成器：BFS 最短路 + 轉向與 main.js 一致 + 避開樹格驗證
 * 執行：node scripts/build_mission2_answer.js
 */
const fs = require('fs');
const path = require('path');

const grid = [
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
];

function buildHeights(g) {
    const rows = g.length, cols = g[0].length;
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}

const heights = buildHeights(grid);
const CELL = 150;
const OFFSET = -(grid.length * CELL) / 2;
const CRUISE = 80;
const flightY = (gh) => gh + 15 + CRUISE;

function bfs(si, sj, gi, gj) {
    const key = (i, j) => i + ',' + j;
    const q = [[si, sj]];
    const prev = new Map();
    prev.set(key(si, sj), null);
    while (q.length) {
        const [i, j] = q.shift();
        if (i === gi && j === gj) break;
        for (const [di, dj] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= 14 || nj >= 14 || grid[ni][nj] === 1) continue;
            const k = key(ni, nj);
            if (prev.has(k)) continue;
            prev.set(k, [i, j]);
            q.push([ni, nj]);
        }
    }
    const path = [];
    let cur = [gi, gj];
    while (cur) {
        path.push(cur);
        cur = prev.get(key(...cur));
    }
    path.reverse();
    if (path[0][0] !== si || path[0][1] !== sj) {
        throw new Error(`No path (${si},${sj}) -> (${gi},${gj})`);
    }
    return path;
}

/** 與 main.js turn_left (+90) / turn_right (-90) 一致；同方向連續格合併為單一 forward */
function genPathCmds(path, startHeading = 180) {
    let h = startHeading;
    const cmds = [];
    let i = 1;
    while (i < path.length) {
        const [pi, pj] = path[i - 1];
        const [ci, cj] = path[i];
        const di = ci - pi;
        const dj = cj - pj;
        const target = di === 1 ? 180 : di === -1 ? 0 : dj === 1 ? 270 : 90;
        const diff = (target - h + 360) % 360;
        if (diff === 90) {
            cmds.push({ k: 'turn', d: 'LEFT', n: 90 });
            h = (h + 90) % 360;
        } else if (diff === 270) {
            cmds.push({ k: 'turn', d: 'RIGHT', n: 90 });
            h = (h + 270) % 360;
        } else if (diff === 180) {
            cmds.push({ k: 'turn', d: 'RIGHT', n: 180 });
            h = (h + 180) % 360;
        }
        let dist = CELL;
        let ni = ci;
        let nj = cj;
        while (i + 1 < path.length) {
            const [nextI, nextJ] = path[i + 1];
            if (nextI - ni === di && nextJ - nj === dj) {
                dist += CELL;
                i++;
                ni = nextI;
                nj = nextJ;
            } else break;
        }
        cmds.push({ k: 'move', d: 'FORWARD', n: dist });
        i++;
    }
    return { cmds, heading: h };
}

function altCmd(fromY, toY) {
    const diff = Math.round(toY - fromY);
    if (Math.abs(diff) < 25) return [];
    return diff > 0
        ? [{ k: 'move', d: 'UP', n: diff }]
        : [{ k: 'move', d: 'DOWN', n: -diff }];
}

function xmlBlock(c) {
    if (c.k === 'move') {
        return `<block type="drone_move_cm"><field name="DIR">${c.d}</field><value name="DIST"><block type="math_number"><field name="NUM">${c.n}</field></block></value></block>`;
    }
    if (c.k === 'turn') {
        return `<block type="drone_turn_degree"><field name="DIR">${c.d}</field><value name="DEGREE"><block type="math_number"><field name="NUM">${c.n}</field></block></value></block>`;
    }
    if (c.k === 'collect') return `<block type="drone_collect_water"></block>`;
    if (c.k === 'release') return `<block type="drone_release_water"></block>`;
    if (c.k === 'hover') {
        return `<block type="drone_hover"><value name="DURATION"><block type="math_number"><field name="NUM">${c.n}</field></block></value></block>`;
    }
    if (c.k === 'land') return `<block type="drone_land"></block>`;
    return '';
}

function chainBlocks(blocks) {
    let xml = blocks[blocks.length - 1];
    for (let i = blocks.length - 2; i >= 0; i--) {
        xml = blocks[i].replace(/<\/block>$/, `<next>${xml}</next></block>`);
    }
    return xml;
}

function cellAt(x, z) {
    const j = Math.floor((x - OFFSET) / CELL);
    const i = Math.floor((z - OFFSET) / CELL);
    return { i, j, val: grid[i]?.[j] };
}

/** 模擬飛行，確認不進入樹格 (1) */
function validateCommands(allCmds) {
    let x = OFFSET + CELL + CELL / 2;
    let z = OFFSET + CELL + CELL / 2;
    let y = flightY(heights[1][1]);
    let heading = 180;

    const step = (label) => {
        const c = cellAt(x, z);
        if (c.val === 1) {
            throw new Error(`Tree collision at (${c.i},${c.j}) during ${label}; pos=(${x.toFixed(0)},${z.toFixed(0)})`);
        }
    };

    step('start');
    let releaseIdx = 0;
    const fireDests = [[2, 12], [4, 10], [11, 5], [12, 10]];
    for (const c of allCmds) {
        if (c.k === 'turn') {
            const sign = c.d === 'LEFT' ? 1 : -1;
            heading = (heading + sign * c.n + 360) % 360;
        } else if (c.k === 'move') {
            const rad = (heading * Math.PI) / 180;
            let dx = 0, dz = 0, dy = 0;
            if (c.d === 'FORWARD') { dx = -Math.sin(rad); dz = -Math.cos(rad); }
            else if (c.d === 'BACKWARD') { dx = Math.sin(rad); dz = Math.cos(rad); }
            else if (c.d === 'LEFT') { dx = -Math.cos(rad); dz = Math.sin(rad); }
            else if (c.d === 'RIGHT') { dx = Math.cos(rad); dz = -Math.sin(rad); }
            else if (c.d === 'UP') { dy = 1; }
            else if (c.d === 'DOWN') { dy = -1; }
            const steps = 10;
            for (let s = 1; s <= steps; s++) {
                x += (dx * c.n) / steps;
                z += (dz * c.n) / steps;
                y += (dy * c.n) / steps;
                step(`${c.d} ${c.n}`);
            }
        } else if (c.k === 'release') {
            const cell = cellAt(x, z);
            const want = fireDests[releaseIdx++];
            if (cell.i !== want[0] || cell.j !== want[1] || cell.val !== 4) {
                throw new Error(`Release #${releaseIdx} at (${cell.i},${cell.j}) val=${cell.val}, expected fire (${want[0]},${want[1]})`);
            }
        } else if (c.k === 'land') {
            const cell = cellAt(x, z);
            if (cell.i !== 1 || cell.j !== 12) {
                throw new Error(`Land at (${cell.i},${cell.j}), expected evac (1,12)`);
            }
        }
    }
}

const route = [
    ['water', [1, 4]],
    ['charge', [3, 5]],
    ['fire', [2, 12]],
    ['water', [4, 8]],
    ['fire', [4, 10]],
    ['charge', [6, 8]],
    ['water', [9, 7]],
    ['fire', [11, 5]],
    ['charge', [10, 7]],
    ['water', [12, 3]],
    ['fire', [12, 10]],
    ['evac', [1, 12]],
];

let pos = [1, 1];
let heading = 180;
let curY = flightY(heights[1][1]);
const allCmds = [];
let totalCells = 0;

for (const [kind, dest] of route) {
    const path = bfs(pos[0], pos[1], dest[0], dest[1]);
    totalCells += path.length - 1;
    const { cmds, heading: h2 } = genPathCmds(path, heading);
    heading = h2;
    allCmds.push(...cmds);

    const destY = flightY(heights[dest[0]][dest[1]]);
    allCmds.push(...altCmd(curY, destY));
    curY = destY;

    if (kind === 'water') allCmds.push({ k: 'collect' });
    if (kind === 'fire') allCmds.push({ k: 'release' });
    if (kind === 'charge') allCmds.push({ k: 'hover', n: 3.5 });
    pos = dest;
}

allCmds.push(...altCmd(curY, flightY(heights[1][12])));
allCmds.push({ k: 'land' });

validateCommands(allCmds);

const BATTERY_START = 20;
const BATTERY_CHARGE = 15;
const moveBlocks = allCmds.filter(c => c.k === 'move').length;
let battery = BATTERY_START;
let chargesUsed = 0;
for (const c of allCmds) {
    if (c.k === 'move') {
        if (battery <= 0) {
            throw new Error(`Battery depleted before move ${c.n}cm; need more charge stops`);
        }
        battery--;
    }
    if (c.k === 'hover') {
        battery += BATTERY_CHARGE;
        chargesUsed++;
    }
}

const xmlBlocks = allCmds.map(xmlBlock);
const moveChain = chainBlocks(xmlBlocks);
const js = `// 任務二參考答案（BFS 最短路 · 避樹格 · 合併 forward · 自動生成 scripts/build_mission2_answer.js）
// 路線：水→充(3,5)→火A→水→火B→充(6,8)→水→火C→充(10,7)→水→火D→終點 · ${totalCells} 格 · ${moveBlocks} 移動積木 · 充電 ${chargesUsed} 次
window.MISSION2_ANSWER_XML = \`<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="event_start" x="20" y="20">
    <next>
      <block type="drone_takeoff">
        <next>${moveChain}</next>
      </block>
    </next>
  </block>
</xml>\`;`;

const outPath = path.join(__dirname, '../js/mission2_answer.js');
fs.writeFileSync(outPath, js);
console.log('Wrote', outPath, 'blocks:', xmlBlocks.length, 'moves:', moveBlocks, 'cells:', totalCells, 'charges:', chargesUsed);
console.log('Validation: OK (no tree cells crossed)');

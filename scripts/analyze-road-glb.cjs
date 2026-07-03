/**
 * Infer Kenney road openings at rot=0 from GLB mesh position accessors (no Three.js).
 * Run: node scripts/analyze-road-glb.cjs
 */
const fs = require('fs');
const path = require('path');

const ROAD_DIR = path.join(__dirname, '../assets/models/kenney_city-kit-roads/Models/GLB format/');
const FILES = {
  straight: 'road-straight.glb',
  bend: 'road-bend.glb',
  cross: 'road-crossroad.glb',
  tee: 'road-split.glb',
  end: 'road-end.glb',
};

function readGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStart = 20;
  const json = JSON.parse(buf.slice(jsonStart, jsonStart + jsonLen).toString('utf8'));
  const binChunkStart = jsonStart + jsonLen;
  const binLen = buf.readUInt32LE(binChunkStart + 4);
  const bin = buf.slice(binChunkStart + 12, binChunkStart + 12 + binLen);
  return { json, bin };
}

function getAccessorVerts(gltf, bin, accessorIndex) {
  const acc = gltf.accessors[accessorIndex];
  const bv = gltf.bufferViews[acc.bufferView];
  const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const base = off + i * 12;
    out.push([
      bin.readFloatLE(base),
      bin.readFloatLE(base + 4),
      bin.readFloatLE(base + 8),
    ]);
  }
  return out;
}

function allGroundVerts(gltf, bin) {
  const verts = [];
  for (const mesh of gltf.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.attributes.POSITION === undefined) continue;
      verts.push(...getAccessorVerts(gltf, bin, prim.attributes.POSITION));
    }
  }
  const minY = Math.min(...verts.map((v) => v[1]));
  const thresh = minY + 0.2;
  return verts.filter((v) => v[1] <= thresh);
}

function extentAlong(verts, axis) {
  const idx = axis === 'x' ? 0 : 2;
  const c = verts.reduce((s, v) => s + v[idx], 0) / verts.length;
  let maxPos = 0;
  let maxNeg = 0;
  for (const v of verts) {
    const d = v[idx] - c;
    if (d > 0) maxPos = Math.max(maxPos, d);
    else maxNeg = Math.max(maxNeg, -d);
  }
  return { pos: maxPos, neg: maxNeg, c };
}

function openingsAtRot0(verts, minRatio = 0.35) {
  const ex = extentAlong(verts, 'x');
  const ez = extentAlong(verts, 'z');
  const scores = [
    { d: 'N', v: ez.neg },
    { d: 'E', v: ex.pos },
    { d: 'S', v: ez.pos },
    { d: 'W', v: ex.neg },
  ];
  const maxV = Math.max(...scores.map((s) => s.v), 1e-6);
  const dirs = scores.filter((s) => s.v >= maxV * minRatio).map((s) => s.d);
  return { ex, ez, dirs, scores };
}

/** Tee/split: keep top 3 directions by extent score */
function openingsTee(verts) {
  const o = openingsAtRot0(verts, 0.2);
  const top3 = o.scores.sort((a, b) => b.v - a.v).slice(0, 3).map((s) => s.d);
  return top3;
}

const cycle = ['N', 'E', 'S', 'W'];
const bit = { N: 1, E: 2, S: 4, W: 8 };

function rotateDirs(dirs, steps) {
  return dirs.map((d) => cycle[(cycle.indexOf(d) + steps + 4) % 4]);
}

function maskFromDirs(dirs) {
  return dirs.reduce((a, d) => a | bit[d], 0);
}

/** Given model openings at rot0, which rotSteps maps world mask? */
function rotForMask(modelOpenRot0, targetMask) {
  for (let s = 0; s < 4; s++) {
    const m = maskFromDirs(rotateDirs(modelOpenRot0, s));
    if (m === targetMask) return s;
  }
  return -1;
}

for (const [key, file] of Object.entries(FILES)) {
  const { json, bin } = readGlb(path.join(ROAD_DIR, file));
  const verts = allGroundVerts(json, bin);
  const o0 = openingsAtRot0(verts);
  console.log(`\n=== ${file} (${key}) ===`);
  console.log('  +X/-X:', o0.ex.pos.toFixed(3), o0.ex.neg.toFixed(3));
  console.log('  +Z/-Z:', o0.ez.pos.toFixed(3), o0.ez.neg.toFixed(3));
  console.log('  rot0 openings:', o0.dirs.join('+') || 'symmetric');
  for (let s = 0; s < 4; s++) {
    const rd = rotateDirs(o0.dirs, s);
    console.log(`  rot${s} -> ${rd.join('+')} mask=${maskFromDirs(rd)}`);
  }
}

console.log('\n=== Suggested rotSteps (mask -> rot) ===');
const models = {};
for (const [key, file] of Object.entries(FILES)) {
  const { json, bin } = readGlb(path.join(ROAD_DIR, file));
  models[key] = openingsAtRot0(allGroundVerts(json, bin)).dirs;
}

const cases = {
  straight: [[5, 'N+S'], [10, 'E+W']],
  tee: [[7, 'N+E+S'], [11, 'N+E+W'], [13, 'N+S+W'], [14, 'E+S+W']],
  bend: [[3, 'N+E'], [6, 'E+S'], [12, 'S+W'], [9, 'N+W']],
  end: [[8, 'W'], [4, 'S'], [2, 'E'], [1, 'N']],
};

// Re-load tee with top-3 heuristic
{
  const { json, bin } = readGlb(path.join(ROAD_DIR, FILES.tee));
  models.tee = openingsTee(allGroundVerts(json, bin));
  console.log('\n=== tee top-3 openings at rot0 ===', models.tee.join('+'));
}

for (const [kind, list] of Object.entries(cases)) {
  const open0 = models[kind];
  for (const [mask, label] of list) {
    const rot = rotForMask(open0, mask);
    console.log(`  ${kind} mask ${mask} (${label}) -> rot ${rot}`);
  }
}

// Straight: axis with larger total extent = through-traffic
{
  const { json, bin } = readGlb(path.join(ROAD_DIR, FILES.straight));
  const v = allGroundVerts(json, bin);
  const ez = extentAlong(v, 'z');
  const ex = extentAlong(v, 'x');
  const alongZ = ez.pos + ez.neg;
  const alongX = ex.pos + ex.neg;
  console.log('\n=== straight axis ===', alongZ >= alongX ? 'N+S (rot0 for mask 5)' : 'E+W (rot0 for mask 10)');
  console.log('  swap test: mask5 rot', rotForMask(alongZ >= alongX ? ['N', 'S'] : ['E', 'W'], 5));
  console.log('  mask10 rot', rotForMask(alongZ >= alongX ? ['N', 'S'] : ['E', 'W'], 10));
}

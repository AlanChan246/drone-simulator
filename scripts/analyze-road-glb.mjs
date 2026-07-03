/**
 * One-off: infer Kenney road openings at rot=0 from near-ground vertices.
 * Run: node scripts/analyze-road-glb.mjs
 */
import * as THREE from 'three';
import GLTFLoaderModule from 'three/examples/jsm/loaders/GLTFLoader.js';
const GLTFLoader = GLTFLoaderModule.GLTFLoader || GLTFLoaderModule.default || GLTFLoaderModule;
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ROAD_DIR = path.join(ROOT, 'assets/models/kenney_city-kit-roads/Models/GLB format/');

const FILES = {
  straight: 'road-straight.glb',
  bend: 'road-bend.glb',
  cross: 'road-crossroad.glb',
  tee: 'road-split.glb',
  end: 'road-end.glb',
};

function extentAlong(scene, axis) {
  const box = new THREE.Box3().setFromObject(scene);
  const c = box.getCenter(new THREE.Vector3());
  let maxPos = 0;
  let maxNeg = 0;
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.attributes.position;
    if (!pos) return;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      o.localToWorld(v);
      if (v.y > c.y + 0.15) continue;
      const d = v[axis] - c[axis];
      if (d > 0) maxPos = Math.max(maxPos, d);
      else maxNeg = Math.max(maxNeg, -d);
    }
  });
  return { pos: maxPos, neg: maxNeg };
}

function openingsAtRot0(scene) {
  const ex = extentAlong(scene, 'x');
  const ez = extentAlong(scene, 'z');
  const dirs = [];
  if (ez.neg > ez.pos * 0.85) dirs.push('N(-Z)');
  if (ex.pos > ex.neg * 0.85) dirs.push('E(+X)');
  if (ez.pos > ez.neg * 0.85) dirs.push('S(+Z)');
  if (ex.neg > ex.pos * 0.85) dirs.push('W(-X)');
  return { ex, ez, dirs };
}

function rotateOpenings(dirs, steps) {
  const cycle = ['N(-Z)', 'E(+X)', 'S(+Z)', 'W(-X)'];
  const idx = (d) => cycle.indexOf(d);
  return dirs.map((d) => cycle[(idx(d) + steps + 4) % 4]).sort().join('+');
}

const loader = new GLTFLoader();
for (const [key, file] of Object.entries(FILES)) {
  const url = 'file://' + path.join(ROAD_DIR, file);
  const gltf = await new Promise((res, rej) =>
    loader.load(url, res, undefined, rej)
  );
  const scene = gltf.scene;
  const o0 = openingsAtRot0(scene);
  console.log(`\n=== ${file} (${key}) ===`);
  console.log('  extent +X/-X:', o0.ex.pos.toFixed(3), o0.ex.neg.toFixed(3));
  console.log('  extent +Z/-Z:', o0.ez.pos.toFixed(3), o0.ez.neg.toFixed(3));
  console.log('  inferred openings rot0:', o0.dirs.join(' + ') || '(symmetric / cross)');
  for (let s = 0; s < 4; s++) {
    console.log(`  rot ${s}:`, rotateOpenings(o0.dirs, s));
  }
}

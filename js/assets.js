// 资源：读 models/index.json、加载 GLB、归一化、灰盒占位、卡片图片
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { orientedDims } from './slots.js';

/* ---------- 材质 ---------- */
const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + '|' + (o.basic ? 'b' : '') + (o.rough ?? '') + (o.emissive ?? '');
  if (matCache.has(key)) return matCache.get(key);
  const m = o.basic ? new THREE.MeshBasicMaterial({ color })
    : new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.9, metalness: 0, flatShading: true,
        ...(o.emissive ? { emissive: o.emissive, emissiveIntensity: o.emissiveIntensity ?? 1 } : {}) });
  matCache.set(key, m);
  return m;
}
const EDGE = new THREE.LineBasicMaterial({ color: 0x15110d, transparent: true, opacity: 0.38 });
const boxGeoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
  if (!boxGeoCache.has(k)) { const g = new THREE.BoxGeometry(w, h, d); boxGeoCache.set(k, { g, e: new THREE.EdgesGeometry(g) }); }
  return boxGeoCache.get(k);
}
// 一个方块，(x,y,z) 为中心
export function box(parent, w, h, d, color, x = 0, y = 0, z = 0, o = {}) {
  const G = boxGeo(w, h, d);
  const m = new THREE.Mesh(G.g, o.material || mat(color, o));
  m.position.set(x, y, z);
  if (o.edges) m.add(new THREE.LineSegments(G.e, EDGE));
  parent.add(m);
  return m;
}

/* ---------- 测量与"坐稳" ---------- */
function measure(obj) {
  const p = new THREE.Group(); p.add(obj); p.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  p.remove(obj);
  return b;
}
// 包一层，使包围盒底面中心落在原点
function seat(obj) {
  const b = measure(obj), c = b.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  obj.position.x -= c.x; obj.position.y -= b.min.y; obj.position.z -= c.z;
  holder.add(obj);
  return holder;
}

/* ---------- 灰盒占位：按 L×H×W ---------- */
export const TIER_GREY = { big: '#8a847b', mid: '#a49d92', small: '#c3bbae' };
export function greybox(it, onWall) {
  const { l, h, d } = orientedDims(it, onWall);
  const g = new THREE.Group();
  const body = box(g, l, h, d, TIER_GREY[it.tier], 0, h / 2, 0, { edges: true });
  body.castShadow = body.receiveShadow = true;
  // 正面（局部 +z）贴一条深色，方便看朝向；太薄的东西不加
  if (h > 0.12 && d > 0.08) {
    const s = box(g, l * 0.7, Math.min(h * 0.18, 0.12), 0.012, '#4a4038', 0, h * 0.62, d / 2 + 0.006);
    s.receiveShadow = true;
  }
  g.userData.kind = 'greybox';
  return g;
}

/* ---------- 模型 ---------- */
export async function loadModelIndex() {
  try {
    const r = await fetch('models/index.json', { cache: 'no-cache' });
    if (!r.ok) return new Set();
    const j = await r.json();
    return new Set(Array.isArray(j) ? j : Object.keys(j));
  } catch (e) { return new Set(); }
}

const loader = new GLTFLoader();
const gltfCache = new Map();
export function loadGLB(asset) {
  if (!gltfCache.has(asset)) gltfCache.set(asset, loader.loadAsync(`models/${asset}.glb`));
  return gltfCache.get(asset);
}

function prepMaterials(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      // AI 模型的金属贴图在没有环境光贴图时会发黑
      m.metalness = 0; m.metalnessMap = null; m.roughness = 1; m.needsUpdate = true;
    }
    o.castShadow = true; o.receiveShadow = true;
  });
}
// 水平最长边如果在 z 方向，先绕 y 轴转 90°
function longSideToX(node) {
  const sz = measure(node).getSize(new THREE.Vector3());
  if (sz.z > sz.x) { const r = new THREE.Group(); r.add(node); r.rotation.y = Math.PI / 2; return r; }
  return node;
}

// 贴纸物件：等比缩放（H > L 按 H，否则按 L），底部贴地、水平居中；挂墙的扁东西转 +90° 让正面朝外
export function fitItemModel(gltfScene, it, onWall) {
  const root = gltfScene.clone(true);
  prepMaterials(root);
  let node = longSideToX(root);
  const sz = measure(node).getSize(new THREE.Vector3());
  const s = it.H > it.L ? it.H / sz.y : it.L / sz.x;
  const sc = new THREE.Group(); sc.add(node); sc.scale.setScalar(s); node = sc;
  if (orientedDims(it, onWall).flat) { const t = new THREE.Group(); t.add(node); t.rotation.x = Math.PI / 2; node = t; }
  const out = seat(node);
  out.userData.kind = 'model';
  return out;
}

// 房屋构件：按 L × H × W 非等比拉伸，保证严丝合缝
export function fitKitModel(gltfScene, k) {
  const root = gltfScene.clone(true);
  prepMaterials(root);
  let node = longSideToX(root);
  const sz = measure(node).getSize(new THREE.Vector3());
  const sc = new THREE.Group(); sc.add(node); sc.scale.set(k.L / sz.x, k.H / sz.y, k.W / sz.z);
  const out = seat(sc);
  out.userData.kind = 'model';
  return out;
}

/* ---------- 贴纸卡片（阶段 2：cards/ 里放抠好的 PNG） ---------- */
export const cardUrl = asset => `cards/${asset}.png`;

// 渲染器、等距相机、灯光、房屋外壳（构件模型或灰盒）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { box, mat, loadGLB, fitKitModel } from './assets.js';

const DEG = Math.PI / 180;

export function createScene(canvas, stage, layout, opts = {}) {
  const H = layout.house;                          // {w:16.5, d:6, backH:2.6, frontH:0.9}
  const CENTER = new THREE.Vector3(H.w / 2, 0.9, H.d / 2);

  /* ---------- 渲染器 ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.useLegacyLights = true;                 // 沿用小屋调好的光强
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();

  /* ---------- 等距相机：正交投影，镜头固定，只允许小范围转动、平移、缩放 ---------- */
  const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
  const HOME = { az: -0.2, polar: 0.86, dist: 40, zoom: 1 };   // 从左前方略微斜看，能看到大厅隔墙上的武器
  const ISO_LIMITS = { enableRotate: true, minAzimuthAngle: HOME.az - 0.32, maxAzimuthAngle: HOME.az + 0.32, minPolarAngle: 0.55, maxPolarAngle: 1.12 };
  const MAP_LIMITS = { enableRotate: false, minAzimuthAngle: 0, maxAzimuthAngle: 0, minPolarAngle: 0, maxPolarAngle: 0.0001 };
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, screenSpacePanning: true, minZoom: 0.8, maxZoom: 4 }, ISO_LIMITS);
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  const homePos = () => new THREE.Vector3(
    CENTER.x + HOME.dist * Math.sin(HOME.polar) * Math.sin(HOME.az),
    CENTER.y + HOME.dist * Math.cos(HOME.polar),
    CENTER.z + HOME.dist * Math.sin(HOME.polar) * Math.cos(HOME.az));
  const MAP_TGT = new THREE.Vector3(H.w / 2, 0, H.d / 2);
  const mapPos = () => MAP_TGT.clone().add(new THREE.Vector3(0, HOME.dist, 0.001));
  let mode = 'iso', tw = null, savedIso = null;
  function home() {
    if (mode === 'map') { tween(mapPos(), MAP_TGT.clone(), 1, .5); return; }
    tween(homePos(), CENTER.clone(), HOME.zoom, .5);
  }
  function jumpHome() { camera.position.copy(homePos()); camera.zoom = HOME.zoom; camera.updateProjectionMatrix(); controls.target.copy(CENTER); controls.update(); }
  function tween(p1, t1, z1, dur, done) {
    controls.enabled = false;
    tw = { p0: camera.position.clone(), p1, t0: controls.target.clone(), t1, z0: camera.zoom, z1, t: 0, dur, done };
  }
  // 切换 等距 / 俯视地图
  function setMode(m) {
    if (m === mode) return;
    if (m === 'map') {
      savedIso = { p: camera.position.clone(), t: controls.target.clone(), z: camera.zoom };
      mode = 'map'; resize();
      tween(mapPos(), MAP_TGT.clone(), 1, .9, () => Object.assign(controls, MAP_LIMITS));
      for (const g of upper) g.visible = false;
      grid.visible = true;
    } else {
      mode = 'iso'; resize();
      Object.assign(controls, ISO_LIMITS);
      const s = savedIso || { p: homePos(), t: CENTER.clone(), z: HOME.zoom };
      tween(s.p, s.t, s.z, .9);
      for (const g of upper) g.visible = true;
      grid.visible = false;
    }
  }
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  // 每帧：镜头动画中返回 true（这时不要调用 controls.update）
  function update(dt) {
    if (!tw) return false;
    tw.t += dt; const k = Math.min(1, tw.t / tw.dur), e = ease(k);
    camera.position.lerpVectors(tw.p0, tw.p1, e); controls.target.lerpVectors(tw.t0, tw.t1, e);
    camera.zoom = tw.z0 + (tw.z1 - tw.z0) * e; camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    if (k >= 1) { const done = tw.done; tw = null; done && done(); controls.enabled = !opts.isBusy?.(); controls.update(); }
    return true;
  }
  // 平移只能在房子附近
  const PAN_MIN = new THREE.Vector3(2, 0, 0), PAN_MAX = new THREE.Vector3(H.w - 2, 2, H.d);
  controls.addEventListener('change', () => {
    if (tw) return;
    const t = controls.target, c = t.clone().clamp(PAN_MIN, PAN_MAX);
    if (!c.equals(t)) { camera.position.add(c.clone().sub(t)); t.copy(c); }
  });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    // 右侧面板打开时，把长屋放在面板留下的区域中间
    const inset = opts.rightInset ? opts.rightInset(w) : 0;
    const aspect = w / h, ew = (w - inset) / h;
    const fh = mode === 'map' ? Math.max(4.0, 9.6 / ew) : Math.max(5.6, 10.2 / ew);   // 让整栋长屋都在画面里
    Object.assign(camera, { left: -fh * aspect, right: fh * aspect, top: fh, bottom: -fh });
    if (inset) camera.setViewOffset(w, h, inset / 2, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize(); jumpHome();

  /* ---------- 俯视地图的 5 尺网格 ---------- */
  const gp = [];
  for (let x = 0; x <= H.w + 1e-6; x += layout.grid) gp.push(x, .03, 0, x, .03, H.d);
  for (let z = 0; z <= H.d + 1e-6; z += layout.grid) gp.push(0, .03, z, H.w, .03, z);
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x120d09, transparent: true, opacity: .6, depthWrite: false }));
  grid.renderOrder = 1; grid.visible = false; scene.add(grid);

  // 离屏渲染一张静态图（成品图、导出地图用），返回 dataURL
  function renderStill(cam, w, h, bg) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: bg == null, preserveDrawingBuffer: true });
    r.useLegacyLights = true; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setPixelRatio(1); r.setSize(w, h, false);
    if (bg != null) r.setClearColor(bg, 1);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    r.dispose(); r.forceContextLoss();
    return url;
  }
  // 成品图用的等距相机（和默认视角同一方向）
  function isoStillCamera(w, h) {
    const a = w / h, fh = Math.max(4.3, 9.2 / a);
    const c = new THREE.OrthographicCamera(-fh * a, fh * a, fh, -fh, 0.1, 200);
    c.position.copy(homePos()); c.lookAt(CENTER); c.updateProjectionMatrix();
    return c;
  }
  // 导出地图用的俯视相机：正好框住房子，上方是后墙
  function mapStillCamera(pad = 0.5) {
    const c = new THREE.OrthographicCamera(-(H.w / 2 + pad), H.w / 2 + pad, H.d / 2 + pad, -(H.d / 2 + pad), 0.1, 200);
    c.up.set(0, 0, -1); c.position.set(H.w / 2, 40, H.d / 2); c.lookAt(H.w / 2, 0, H.d / 2); c.updateProjectionMatrix();
    return c;
  }

  /* ---------- 灯光（沿用矿工营地的写法） ---------- */
  scene.add(new THREE.HemisphereLight(0xffe8d0, 0x2a2018, 0.5));
  const sun = new THREE.DirectionalLight(0xffdcb0, 0.72);
  sun.position.set(CENTER.x - 5, 14, CENTER.z + 8);
  sun.target.position.set(CENTER.x, 0, CENTER.z);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 9, bottom: -9, near: 1, far: 50 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.14);
  fill.position.set(CENTER.x + 8, 5, CENTER.z + 10);
  scene.add(fill);

  /* ---------- 底座（屋外暂时纯深色，只垫一块深色地基） ---------- */
  const base = new THREE.Group(); scene.add(base);
  box(base, H.w + 0.9, 0.5, H.d + 0.9, '#2a2019', H.w / 2, -0.36, H.d / 2).receiveShadow = true;
  box(base, H.w + 0.7, 0.06, H.d + 0.7, '#3a2c21', H.w / 2, -0.13, H.d / 2).receiveShadow = true;

  /* ---------- 房屋外壳 ---------- */
  const shell = new THREE.Group(); shell.name = 'shell'; scene.add(shell);
  const upper = [];                                  // 俯视地图时要隐藏的上层构件

  async function buildShell(modelSet) {
    const jobs = [];
    for (const k of layout.kit) {
      const g = new THREE.Group();
      g.position.set(k.x, k.y, k.z);
      g.rotation.order = 'YXZ';
      g.rotation.y = (k.ry || 0) * DEG;
      g.rotation.x = -(k.tilt || 0) * DEG;           // 屋顶瓦片：朝屋脊（+z）抬起
      g.userData.kit = k;
      g.add(kitGreybox(k));
      shell.add(g);
      if (k.part === 'upper') upper.push(g);
      if (modelSet.has(k.asset)) {
        jobs.push(loadGLB(k.asset).then(gltf => {
          g.clear(); g.add(fitKitModel(gltf.scene, k));
        }).catch(e => console.warn('构件模型加载失败', k.asset, e)));
      }
    }
    shell.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.isMeshBasicMaterial; o.receiveShadow = true; } });
    await Promise.all(jobs);
  }

  const render = () => renderer.render(scene, camera);

  return { renderer, scene, camera, controls, sun, shell, upper, base, grid, home, resize, render, buildShell, CENTER, setMode, getMode: () => mode, update, renderStill, isoStillCamera, mapStillCamera };
}

/* ---------- 构件灰盒：局部原点在底面中心，长边沿 x ---------- */
const C = {
  b2wall: '#6f6358', b1wall: '#6a6d70', wood: '#5d4636', woodL: '#76583f',
  floorA: '#574b40', floorB: '#5f5246', slateA: '#5f6366', slateB: '#686c70',
  glass: '#22324a', roof: '#4c3a2e',
};
function kitGreybox(k) {
  const g = new THREE.Group(), L = k.L, Ht = k.H, W = k.W;
  const b1 = k.asset.startsWith('b1');
  const wallC = b1 ? C.b1wall : C.b2wall;
  const E = { edges: true };
  switch (k.asset) {
    case 'b2-A16': case 'b1-A05': {                 // 地砖：深浅交替，顺便显出 5 尺网格
      const i = Math.round((k.x - 0.75) / 1.5), j = Math.round((k.z - 0.75) / 1.5), odd = (i + j) % 2;
      const c = b1 ? (odd ? C.slateA : C.slateB) : (odd ? C.floorA : C.floorB);
      box(g, L - 0.02, Ht, W - 0.02, c, 0, Ht / 2, 0);
      break;
    }
    case 'b2-A05': {                                 // 转角墙：L 形，两臂贴在格子外侧，与后墙、左墙对齐
      box(g, L + 0.25, Ht, 0.25, wallC, -0.125, Ht / 2, -W / 2 - 0.125, E);
      box(g, 0.25, Ht, W, wallC, -L / 2 - 0.125, Ht / 2, 0, E);
      break;
    }
    case 'b2-A03': case 'b1-A02': {                  // 带窗墙段：中间开 0.9 × 0.9 的窗洞
      const ow = 0.9, y0 = 1.1, y1 = 2.0, side = (L - ow) / 2;
      box(g, L, y0, W, wallC, 0, y0 / 2, 0, E);
      box(g, L, Ht - y1, W, wallC, 0, (Ht + y1) / 2, 0, E);
      box(g, side, y1 - y0, W, wallC, -(ow + side) / 2, (y0 + y1) / 2, 0, E);
      box(g, side, y1 - y0, W, wallC, (ow + side) / 2, (y0 + y1) / 2, 0, E);
      box(g, ow, y1 - y0, 0.02, C.glass, 0, (y0 + y1) / 2, -W / 2 + 0.03, { basic: true });
      box(g, ow + 0.1, 0.06, 0.18, C.woodL, 0, y0 - 0.03, W / 2 + 0.04);
      break;
    }
    case 'b2-A04': case 'b1-A03': {                  // 带门洞墙段 / 门框：开 1.0 × 2.1 的洞
      const ow = 1.0, oh = 2.1, side = (L - ow) / 2, c = k.asset === 'b1-A03' ? C.b1wall : wallC;
      box(g, side, Ht, W, c, -(ow + side) / 2, Ht / 2, 0, E);
      box(g, side, Ht, W, c, (ow + side) / 2, Ht / 2, 0, E);
      box(g, ow, Ht - oh, W, c, 0, (Ht + oh) / 2, 0, E);
      if (k.asset === 'b1-A03') {                    // 门框木边
        box(g, 0.08, oh, W + 0.06, C.woodL, -ow / 2 - 0.04, oh / 2, 0);
        box(g, 0.08, oh, W + 0.06, C.woodL, ow / 2 + 0.04, oh / 2, 0);
        box(g, ow + 0.16, 0.08, W + 0.06, C.woodL, 0, oh + 0.04, 0);
      }
      break;
    }
    case 'b2-A08': case 'b1-A04': case 'b2-A09':     // 门、窗板
      box(g, L, Ht, W, k.asset === 'b1-A04' ? C.woodL : C.wood, 0, Ht / 2, 0, E);
      break;
    case 'b2-A10': case 'b2-A11': case 'b2-A12':     // 立柱、横梁
      box(g, L, Ht, W, C.wood, 0, Ht / 2, 0, E);
      break;
    case 'b2-A13': {                                 // 屋架：三角桁架（下弦 + 两根斜梁 + 中柱）
      const t = 0.18;
      box(g, L, t, W, C.wood, 0, t / 2, 0, E);
      box(g, t, Ht, W, C.wood, 0, Ht / 2, 0, E);
      const len = Math.hypot(L / 2, Ht), a = Math.atan2(Ht, L / 2);
      for (const sgn of [-1, 1]) {
        const r = box(g, len, t, W, C.wood, sgn * L / 4, Ht / 2, 0, E);
        r.rotation.z = -sgn * a;
      }
      break;
    }
    case 'b2-A15': {                                 // 山墙：实心三角
      const sh = new THREE.Shape();
      sh.moveTo(-L / 2, 0); sh.lineTo(L / 2, 0); sh.lineTo(0, Ht); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false });
      geo.translate(0, 0, -W / 2);
      const m = new THREE.Mesh(geo, mat(C.b2wall));
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x15110d, transparent: true, opacity: 0.38 })));
      g.add(m);
      break;
    }
    case 'b2-A14':                                   // 屋顶瓦片
      box(g, L - 0.04, Ht, W, C.roof, 0, Ht / 2, 0, E);
      break;
    default:                                         // 墙段、矮墙、断墙等：实心方块
      box(g, L, Ht, W, wallC, 0, Ht / 2, 0, E);
  }
  return g;
}

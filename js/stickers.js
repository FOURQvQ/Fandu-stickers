// 拖拽、吸附、落下、叠放锁、拿起时连带撕下
// 手感代码照搬 reference/sticker-hut.html；拖拽平面按 地面 / 墙面 / 叠放 三层分别处理
import * as THREE from 'three';
import { greybox, fitItemModel } from './assets.js';
import { computeSlots, stackPose, WALLS } from './slots.js';
import { GUIDE, AMBER } from './fx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeIn = k => k * k * k;
const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };
const UP = new THREE.Vector3(0, 1, 0);
const STACK_RADIUS = 0.6;               // 叠放物件的吸附半径上限（米）

export function createStickers({ S, layout, fx, P, protos, lights, stage, panel, tray, onChange, toast, blocked }) {
  const { scene, camera, controls } = S;
  const H = layout.house;
  const slots = computeSlots(layout);

  /* ---------- 每张贴纸一条记录 ---------- */
  const recs = new Map();
  for (const it of layout.items) {
    const slot = slots.get(it.asset);
    recs.set(it.asset, { it, slot, onWall: slot.onWall, obj: null, placed: false, free: false, pose: null,
      lightOn: false, light: null, lightCfg: null, card: null, parent: null, kids: [] });
  }
  for (const r of recs.values()) if (r.it.layer === 'stack') { r.parent = recs.get(r.it.on); r.parent.kids.push(r); }
  for (const [asset, L] of lights) { const r = recs.get(asset); if (r) { r.light = L.light; r.lightCfg = L.cfg; } }
  const list = [...recs.values()];

  // 叠放物件的目标跟着父物件"实际"摆放的位置走
  const targetOf = r => r.it.layer === 'stack' ? (r.parent.pose ? stackPose(r.it, r.parent.pose) : null) : r.slot;
  const unlocked = r => r.it.layer !== 'stack' || r.parent.placed;

  // 物件外观：有模型用模型，没有用灰盒
  const visual = r => { const proto = protos.get(r.it.asset); return proto ? fitItemModel(proto, r.it, r.onWall) : greybox(r.it, r.onWall); };
  function spawn(r) {
    if (r.obj) { scene.remove(r.obj); r.obj = null; }
    const g = new THREE.Group();
    g.rotation.order = 'XZY';
    g.add(visual(r));
    g.userData.rec = r;
    scene.add(g); r.obj = g;
    return g;
  }
  // 成品图用：按给定位姿摆一个独立的物件（不进 recs）
  function buildAt(r, pose) {
    const g = new THREE.Group(); g.add(visual(r));
    g.position.set(pose.x, pose.y, pose.z); g.rotation.y = pose.ry;
    return g;
  }

  /* ---------- 定位线：目标的立体虚影 + 地面（墙面）轮廓。只给正在拖的那张贴纸 ---------- */
  let ghost = null;
  function makeGhost(r, T) {
    const holder = new THREE.Group();
    holder.position.set(T.x, T.y, T.z); holder.rotation.y = T.ry;
    const fill = new THREE.MeshBasicMaterial({ color: GUIDE.clone(), transparent: true, opacity: .15, depthWrite: false });
    const vis = visual(r);
    vis.traverse(o => {
      if (o.isMesh) { o.material = fill; o.castShadow = o.receiveShadow = false; o.renderOrder = 2; }
      else if (o.isLineSegments) o.visible = false;
    });
    holder.add(vis);
    const { l, h, d } = T.dims, pad = .06;
    const edgeMat = new THREE.LineBasicMaterial({ color: GUIDE.clone(), transparent: true, opacity: .6, depthWrite: false });
    const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(l, h, d));
    const edges = new THREE.LineSegments(edgeGeo, edgeMat); edges.position.y = h / 2; edges.renderOrder = 3; holder.add(edges);
    const pts = r.onWall
      ? [[-l / 2 - pad, -pad], [l / 2 + pad, -pad], [l / 2 + pad, h + pad], [-l / 2 - pad, h + pad], [-l / 2 - pad, -pad]].map(([x, y]) => new THREE.Vector3(x, y, -d / 2 + .012))
      : [[-l / 2 - pad, -d / 2 - pad], [l / 2 + pad, -d / 2 - pad], [l / 2 + pad, d / 2 + pad], [-l / 2 - pad, d / 2 + pad], [-l / 2 - pad, -d / 2 - pad]].map(([x, z]) => new THREE.Vector3(x, .03, z));
    const footGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const footMat = new THREE.LineDashedMaterial({ color: GUIDE.clone(), dashSize: .13, gapSize: .08, transparent: true, opacity: .9, depthWrite: false });
    const foot = new THREE.Line(footGeo, footMat); foot.computeLineDistances(); foot.renderOrder = 4; holder.add(foot);
    holder.visible = false;
    scene.add(holder);
    return { holder, vis, edges, foot, fill, edgeMat, footMat, dispose() { scene.remove(holder); fill.dispose(); edgeMat.dispose(); footMat.dispose(); edgeGeo.dispose(); footGeo.dispose(); } };
  }
  function clearGhost() { if (ghost) { ghost.dispose(); ghost = null; } }

  /* ---------- 拖拽平面 ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  ray.params.Line.threshold = 0.01;
  function setRay(e) {
    const rc = S.renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function hitHorizontal(y) {
    const o = ray.ray.origin, d = ray.ray.direction;
    if (Math.abs(d.y) < 1e-5) return null;
    return ray.ray.at((y - o.y) / d.y, new THREE.Vector3());
  }
  // 返回 {p, normal}：地面 / 叠放时 p 是底面中心所在点；墙面时 p 是物件中心贴在墙表面的点
  function surfaceHit(r, T) {
    if (!r.onWall) {
      const p = hitHorizontal(T.y); if (!p) return null;
      if (r.it.layer === 'floor') { p.x = clamp(p.x, .25, H.w - .25); p.z = clamp(p.z, .25, H.d - .25); }
      else { p.x = clamp(p.x, -.5, H.w + .5); p.z = clamp(p.z, -.2, H.d + .5); }
      p.y = T.y;
      return { p, normal: UP };
    }
    const W = WALLS[T.wall], n = new THREE.Vector3(...W.normal), cy = T.y + T.dims.h / 2;
    if (T.wall === 'back') {
      // 后墙正对镜头：直接和墙面求交
      const o = ray.ray.origin, d = ray.ray.direction;
      let p = Math.abs(d.z) > 1e-4 ? ray.ray.at((W.surface - o.z) / d.z, new THREE.Vector3()) : null;
      if (!p) { const f = hitHorizontal(cy); if (!f) return null; p = new THREE.Vector3(f.x, cy, W.surface); }
      p.x = clamp(p.x, .45, H.w - .45); p.y = clamp(p.y, .35, H.backH - .25); p.z = W.surface;
      return { p, normal: n };
    }
    // 隔墙几乎侧对镜头，直接求交会非常飘：改成在目标高度上沿墙滑动
    const f = hitHorizontal(cy); if (!f) return null;
    return { p: new THREE.Vector3(W.surface, cy, clamp(f.z, .35, 4.35)), normal: n };
  }
  const targetPoint = (r, T) => r.onWall ? new THREE.Vector3(T.wall === 'back' ? T.x : WALLS[T.wall].surface, T.y + T.dims.h / 2, T.wall === 'back' ? WALLS.back.surface : T.z)
    : new THREE.Vector3(T.x, T.y, T.z);

  /* ---------- 拖拽 ---------- */
  let drag = null, strictMissTips = 0;
  const fly = document.getElementById('fly'), flyImg = document.getElementById('flyImg');
  const inRect = (e, el) => { const rc = el.getBoundingClientRect(); return e.clientX >= rc.left && e.clientX <= rc.right && e.clientY >= rc.top && e.clientY <= rc.bottom; };
  const overStage = e => inRect(e, stage) && (panel.hidden || !inRect(e, panel));
  function moveFly(e) {
    const dx = e.clientX - (drag.lastX ?? e.clientX); drag.lastX = e.clientX; drag.tilt = clamp((drag.tilt || 0) * .7 + dx * 1.2, -18, 18);
    fly.style.transform = `translate(${e.clientX - 46}px,${e.clientY - 46}px) rotate(${drag.tilt}deg) scale(1.08)`;
  }

  function beginDrag(e, r, src) {
    const T = targetOf(r);
    drag = { r, T, obj: r.obj, src, over: false, hit: null, snap: false, surf: null, target: new THREE.Vector3(),
      rot: T.ry, rotT: T.ry, appear: src === 'scene' ? 1 : 0, justAppeared: false, lastX: e.clientX, tilt: 0 };
    clearGhost(); ghost = makeGhost(r, T);
    r.card?.classList.add('lifting');
    flyImg.src = r.card?.querySelector('img')?.src || '';
    document.body.classList.add('dragging'); controls.enabled = false;
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    onChange(r, 'lift');
    onMove(e);
  }
  function startTrayDrag(e, r) {
    if (r.placed || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); fx.ensureAudio();
    if (blocked && blocked()) { toast('俯视地图下不能贴，先点「回到 3D」'); return; }
    if (!unlocked(r)) {                                   // 叠放锁：下面那件还没贴
      fx.sfx.deny(); toast(`先把「${r.parent.it.name}」贴好，才能贴「${r.it.name}」`);
      r.card?.classList.remove('shake'); void r.card?.offsetWidth; r.card?.classList.add('shake');
      return;
    }
    fx.sfx.peel();
    const o = spawn(r); o.visible = false;
    beginDrag(e, r, 'tray');
  }
  // 从场景里拿起已贴好的东西：它上面叠放的东西一起回到贴纸页
  stage.addEventListener('pointerdown', e => {
    if (drag || e.target !== S.renderer.domElement || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (blocked && blocked()) return;
    setRay(e);
    const objs = list.filter(r => r.obj && r.placed).map(r => r.obj);
    const hit = ray.intersectObjects(objs, true).find(h => h.object.isMesh); if (!hit) return;
    let o = hit.object; while (o && !o.userData.rec) o = o.parent; if (!o) return;
    e.stopPropagation(); e.preventDefault();
    const r = o.userData.rec; fx.ensureAudio(); fx.sfx.peel();
    for (const k of r.kids) if (k.placed || k.obj) returnToTray(k);
    r.placed = false; r.free = false; r.lightOn = false; r.pose = null;
    o.userData.anim = null; o.scale.set(1, 1, 1);
    beginDrag(e, r, 'scene');
  }, true);

  function onMove(e) {
    if (!drag) return;
    const r = drag.r, o = drag.obj, was = drag.over;
    drag.over = overStage(e);
    if (drag.over) {
      fly.hidden = true; setRay(e); drag.hit = surfaceHit(r, drag.T);
      if (!o.visible && drag.hit) { o.visible = true; drag.appear = 0; drag.justAppeared = true; }
    } else {
      o.visible = false; drag.hit = null; drag.snap = false; fly.hidden = false; moveFly(e);
      if (was) fx.sfx.whoosh();
    }
    computeTarget();
  }
  function computeTarget() {
    const r = drag.r, T = drag.T, h = drag.hit;
    if (!h) { drag.snap = false; drag.surf = null; return; }
    const tp = targetPoint(r, T);
    const d = r.onWall ? (T.wall === 'back' ? h.p.distanceTo(tp) : Math.abs(h.p.z - tp.z)) : Math.hypot(h.p.x - tp.x, h.p.z - tp.z);
    const R = r.it.layer === 'stack' ? Math.min(P.radius, STACK_RADIUS) : P.radius;
    const wasSnap = drag.snap; drag.snap = d < R;
    if (drag.snap && !wasSnap) fx.sfx.tick();
    const surf = h.p.clone();
    if (drag.snap) { const inner = 1 - d / R; surf.lerp(tp, Math.min(1, P.pull * (.5 + inner))); }
    drag.surf = surf; drag.normal = h.normal; drag.R = R;
    if (!r.onWall) {
      const lift = drag.snap ? P.lift * .45 : P.lift;
      drag.target.set(surf.x, T.y + lift, surf.z);
      drag.rotT = drag.snap || r.it.layer === 'stack' ? T.ry : drag.rot;
    } else {
      drag.target.copy(surf).addScaledVector(h.normal, T.dims.d / 2 + (drag.snap ? P.lift * .25 : P.lift * .55) + .04);
      drag.target.y -= T.dims.h / 2;
      drag.rotT = T.ry;
    }
  }
  window.addEventListener('keydown', e => {
    if (drag && (e.key === 'r' || e.key === 'R') && drag.r.it.layer === 'floor') { drag.rot += Math.PI / 2; computeTarget(); }
  });

  function onUp(e) {
    if (!drag) return;
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
    const d = drag, r = d.r, T = d.T; drag = null;
    clearGhost();
    fly.hidden = true; fx.ind.visible = false; r.card?.classList.remove('lifting');
    document.body.classList.remove('dragging'); controls.enabled = true;
    if (e.type === 'pointercancel' || !d.over || !d.hit) { returnToTray(r); return; }
    if (d.snap) { placeTo(r, { ...T }, true); return; }
    if (P.mode === 'free') {
      const pose = freePose(r, T, d);
      if (pose) { placeTo(r, pose, false); return; }
      returnToTray(r); toast(`「${r.it.name}」要放在「${r.parent.it.name}」上面`); return;
    }
    returnToTray(r);
    if (strictMissTips < 2) { strictMissTips++; toast('严格模式下要贴到它该在的位置，靠近时会被吸过去'); }
  }
  // 自由模式：贴在松手的地方
  function freePose(r, T, d) {
    const s = d.surf, base = { asset: r.it.asset, dims: T.dims, onWall: T.onWall, wall: T.wall };
    if (r.onWall) {
      const W = WALLS[T.wall];
      if (T.wall === 'back') return { ...base, x: s.x, y: s.y - T.dims.h / 2, z: W.surface + T.dims.d / 2, ry: T.ry };
      return { ...base, x: W.surface - T.dims.d / 2, y: s.y - T.dims.h / 2, z: s.z, ry: T.ry };
    }
    if (r.it.layer === 'floor') return { ...base, x: s.x, y: 0, z: s.z, ry: d.rotT };
    // 叠放：必须落在父物件的范围里
    const Pp = r.parent.pose, c = Math.cos(Pp.ry), sn = Math.sin(Pp.ry), dx = s.x - Pp.x, dz = s.z - Pp.z;
    const ox = dx * c - dz * sn, oz = dx * sn + dz * c;
    if (Math.abs(ox) > Pp.dims.l / 2 + .05 || Math.abs(oz) > Pp.dims.d / 2 + .05) return null;
    return { ...base, x: s.x, y: T.y, z: s.z, ry: T.ry };
  }

  function placeTo(r, pose, correct) {
    const o = r.obj; r.placed = true; r.free = !correct; r.pose = pose;
    const normal = r.onWall ? new THREE.Vector3(...WALLS[pose.wall].normal) : UP.clone();
    o.userData.anim = { type: 'drop', t: 0, from: o.position.clone(), to: new THREE.Vector3(pose.x, pose.y, pose.z),
      rotFrom: o.rotation.y, rotTo: pose.ry, axis: r.onWall ? 'z' : 'y', normal, impacted: false, tx: o.rotation.x, tz: o.rotation.z };
    onChange(r, 'place');
  }
  function returnToTray(r) {
    for (const k of r.kids) if (k.placed || k.obj) returnToTray(k);     // 连带撕下
    r.placed = false; r.free = false; r.lightOn = false; r.pose = null;
    r.card?.classList.remove('lifting');
    const o = r.obj;
    if (o) {
      if (!o.visible) { scene.remove(o); r.obj = null; }
      else { fx.sfx.whoosh(); o.userData.anim = { type: 'return', t: 0, s0: o.scale.x }; }
    }
    onChange(r, 'return');
  }
  function impact(r, A) {
    const o = r.obj, size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const rad = A.axis === 'y' ? Math.max(size.x, size.z) / 2 : Math.max(size.x, size.y, size.z) / 2;
    const k = .6 + .4 * Math.min(1, P.lift);
    if (r.free) fx.sfx.soft(); else fx.sfx.thock(k, A.axis === 'z');
    const at = A.axis === 'y' ? A.to.clone() : A.to.clone().add(new THREE.Vector3(0, r.pose.dims.h / 2, 0)).addScaledVector(A.normal, -r.pose.dims.d / 2);
    fx.puff(at, A.normal, rad);
    if (!r.free) fx.ringPulse(at, A.normal, rad * 1.05);
    fx.shake(size.y);
    r.lightOn = true;
  }
  const setAxisScale = (o, axis, a, b) => { if (axis === 'y') o.scale.set(b, a, b); else o.scale.set(b, b, a); };

  /* ---------- 清空 ---------- */
  function reset() {
    for (const r of list) { if (r.obj) scene.remove(r.obj); r.obj = null; r.placed = false; r.free = false; r.pose = null; r.lightOn = false; r.card?.classList.remove('lifting'); }
    onChange(null, 'reset');
  }

  /* ---------- 读存档：父物件先摆，叠放的后摆 ---------- */
  function restore(saved) {
    const S0 = saved && saved.placed; if (!S0) return 0;
    let n = 0, progress = true;
    const todo = list.filter(r => S0[r.it.asset]);
    while (progress) {
      progress = false;
      for (const r of todo) {
        if (r.placed || !unlocked(r)) continue;
        const s = S0[r.it.asset], T = targetOf(r);
        const pose = s.free ? { ...T, x: s.x, y: s.y, z: s.z, ry: s.ry } : { ...T };
        const o = spawn(r); o.position.set(pose.x, pose.y, pose.z); o.rotation.set(0, pose.ry, 0);
        r.placed = true; r.free = !!s.free; r.pose = pose; r.lightOn = true;
        if (r.light) r.light.userData.base = r.lightCfg.intensity;
        n++; progress = true;
      }
    }
    onChange(null, 'restore');
    return n;
  }

  /* ---------- 悬停时显示"可以抓" ---------- */
  let hoverT = 0;
  S.renderer.domElement.addEventListener('pointermove', e => {
    if (drag) return; const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
    setRay(e); const objs = list.filter(r => r.obj && r.placed).map(r => r.obj);
    S.renderer.domElement.style.cursor = ray.intersectObjects(objs, true).some(h => h.object.isMesh) ? 'grab' : '';
  });

  /* ---------- 每帧 ---------- */
  const tmpV = new THREE.Vector3();
  function update(dt, now) {
    fx.ind.visible = false;
    if (drag && drag.obj.visible) {
      const o = drag.obj, flat = !drag.r.onWall;
      if (drag.justAppeared) { o.position.copy(drag.target); o.rotation.y = drag.rotT; drag.justAppeared = false; }
      const a = 1 - Math.exp(-dt * (drag.snap ? 24 : 15));
      const vx = drag.target.x - o.position.x, vz = drag.target.z - o.position.z;
      o.position.lerp(drag.target, a); o.rotation.y = lerpAngle(o.rotation.y, drag.rotT, a);
      if (flat) { o.rotation.x += (clamp(vz * .35, -.32, .32) - o.rotation.x) * a; o.rotation.z += (clamp(-vx * .35, -.32, .32) - o.rotation.z) * a; }
      drag.appear = Math.min(1, drag.appear + dt * 5); o.scale.setScalar(Math.max(.001, easeOutBack(drag.appear)));
      if (drag.surf) {
        const ind = fx.ind; ind.visible = true; ind.position.copy(drag.surf).addScaledVector(drag.normal, .04); fx.orientToSurface(ind, drag.normal);
        ind.material.color.copy(drag.snap ? AMBER : GUIDE); ind.scale.setScalar(drag.snap ? 1.5 : 1);
      }
    }
    // 定位线：默认"靠近才显形"——只有吸住时才出现
    if (ghost) {
      const show = !!(drag && drag.over && drag.hit), snapping = show && drag.snap, st = P.guide;
      const showFill = show && (st === 'all' || st === 'ghost' || snapping);
      const showFoot = show && (st === 'all' || st === 'outline' || snapping);
      ghost.holder.visible = showFill || showFoot;
      ghost.vis.visible = ghost.edges.visible = showFill; ghost.foot.visible = showFoot;
      const pulse = .5 + .5 * Math.sin(now * .008), col = snapping ? AMBER : GUIDE;
      ghost.fill.color.copy(col); ghost.edgeMat.color.copy(col); ghost.footMat.color.copy(col);
      ghost.fill.opacity = snapping ? .3 : .12 + .1 * pulse; ghost.edgeMat.opacity = snapping ? 1 : .45 + .3 * pulse; ghost.footMat.opacity = snapping ? 1 : .8;
    }
    for (const r of list) {
      const o = r.obj; if (!o || !o.userData.anim) continue; const A = o.userData.anim;
      if (A.type === 'return') {
        A.t += dt; const k = Math.min(1, A.t / .2); o.scale.setScalar(Math.max(.001, A.s0 * (1 - k))); o.position.y += dt * 2.5;
        if (k >= 1) { scene.remove(o); if (r.obj === o) r.obj = null; }
        continue;
      }
      A.t += dt * 1000; const D = P.drop;
      if (A.t < D) {
        const k = A.t / D, e = easeIn(k);
        o.position.lerpVectors(A.from, A.to, e); o.rotation.y = lerpAngle(A.rotFrom, A.rotTo, Math.min(1, k * 1.5));
        o.rotation.x = A.tx * (1 - k); o.rotation.z = A.tz * (1 - k);
        const st = P.squash * .45 * k; setAxisScale(o, A.axis, 1 + st, 1 - st * .5);
      } else {
        if (!A.impacted) { A.impacted = true; o.position.copy(A.to); o.rotation.set(0, A.rotTo, 0); impact(r, A); }
        const t = (A.t - D) / 1000, v = P.squash * Math.exp(-7 * t) * Math.cos(20 * t);
        setAxisScale(o, A.axis, 1 - v, 1 + v * .5);
        if (t > .9) { o.scale.set(1, 1, 1); o.userData.anim = null; }
      }
    }
    // 火光：贴上后亮起，拖着走时微亮
    for (const r of list) {
      if (!r.light) continue;
      let target = 0;
      if (r.obj && r.obj.visible) {
        const dims = (r.pose || targetOf(r) || r.slot).dims;
        r.obj.localToWorld(tmpV.set(0, dims.h * r.lightCfg.at[1], r.lightCfg.at[0])); r.light.position.copy(tmpV);
        target = r.lightOn ? r.lightCfg.intensity : (drag && drag.r === r ? r.lightCfg.intensity * .4 : 0);
      }
      const flick = .9 + .07 * Math.sin(now * .009 + r.light.id) + .05 * Math.sin(now * .023 + r.light.id * 3);
      r.light.userData.base = (r.light.userData.base || 0) + (target - (r.light.userData.base || 0)) * Math.min(1, dt * 6);
      r.light.intensity = r.light.userData.base * flick;
    }
  }

  return { recs, list, startTrayDrag, update, reset, restore, buildAt, targetOf, unlocked, isDragging: () => !!drag, dragRec: () => drag && drag.r };
}

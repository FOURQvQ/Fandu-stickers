// 启动：读 layout.json → 加载资源 → 建场景 → 建界面 → 读存档
import * as THREE from 'three';
import { createScene } from './scene.js';
import { loadModelIndex, loadGLB } from './assets.js';
import { createFx } from './fx.js';
import { createStickers } from './stickers.js';
import { createUI, loadParams, toast } from './ui.js';
import { loadSave, writeSave, clearSave } from './save.js';

const $ = s => document.querySelector(s);

// 6 盏点光源：开局全部建好、强度 0，贴上后再亮（中途加光源会让材质重新编译、卡顿）
// at = [沿物件局部 z 前移, 高度占物件高的比例]
const LIGHTS = {
  'b2-P01': { color: 0xff7a2a, intensity: 2.6, distance: 9, at: [0, 0.9] },     // 篝火
  'b1-F05': { color: 0xff7a2a, intensity: 1.6, distance: 6, at: [0.55, 0.3] },  // 石砌灶台
  'b1-S03': { color: 0xffb45c, intensity: 1.6, distance: 6, at: [0.25, 0.5] },  // 壁挂提灯
  'b2-P12': { color: 0xffc070, intensity: 0.9, distance: 4, at: [0, 1.4] },     // 烛台蜡烛
  'b1-P18': { color: 0xffc070, intensity: 0.9, distance: 4, at: [0, 1.4] },     // 黄铜烛台
  'b1-P19': { color: 0xff8a3a, intensity: 1.4, distance: 5, at: [0.35, 0.45] }, // 小铁炉
};

function setLoading(text, frac, err) {
  $('#ldText').innerHTML = err ? `<span class="err">${text}</span>` : text;
  if (frac != null) $('#ldBar').style.width = (frac * 100) + '%';
}

async function boot() {
  let layout;
  try {
    const r = await fetch('layout.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    layout = await r.json();
  } catch (e) {
    setLoading('读不到 layout.json。请在 longhouse-game 文件夹里运行<br><code>python -m http.server</code><br>再用浏览器打开 http://localhost:8000', 0, true);
    return;
  }
  const P = loadParams();
  const modelSet = await loadModelIndex();
  const panelEl = $('#panel');
  let st = null;
  const S = createScene($('#cv'), $('#stage'), layout, {
    rightInset: w => (!panelEl.hidden && w > 900) ? panelEl.offsetWidth + 12 : 0,
    isBusy: () => !!(st && st.isDragging()),
  });
  window.__longhouse = { S, layout, P };            // 方便在控制台里调试

  /* ---------- 房屋外壳 + 模型 ---------- */
  setLoading('搭房子…', 0.1);
  const shellJob = S.buildShell(modelSet);
  const itemAssets = layout.items.map(i => i.asset).filter(a => modelSet.has(a));
  const protos = new Map();
  let nDone = 0;
  setLoading(`加载模型 0 / ${itemAssets.length}`, 0.15);
  await Promise.all([shellJob, ...itemAssets.map(a => loadGLB(a).then(g => {
    protos.set(a, g.scene);
    nDone++; setLoading(`加载模型 ${nDone} / ${itemAssets.length}`, 0.15 + 0.85 * nDone / itemAssets.length);
  }).catch(e => console.warn('模型加载失败，用灰盒代替', a, e)))]);

  /* ---------- 点光源：开局全建好，强度 0 ---------- */
  const lights = new Map();
  for (const [asset, cfg] of Object.entries(LIGHTS)) {
    const L = new THREE.PointLight(cfg.color, 0, cfg.distance, 2);
    S.scene.add(L); lights.set(asset, { light: L, cfg });
  }

  /* ---------- 贴纸 ---------- */
  const fx = createFx(S.scene, P);
  let ui = null;
  st = createStickers({
    S, layout, fx, P, protos, lights,
    stage: $('#stage'), panel: panelEl, tray: $('.tray'),
    onChange: (r, kind) => onChange(kind), toast,
    blocked: () => S.getMode() === 'map',
  });
  ui = createUI({ layout, P, onResize: S.resize });
  ui.buildCards(st.list, st.startTrayDrag);
  $('#homeBtn').addEventListener('click', () => S.home());
  $('#resetBtn').addEventListener('click', () => { st.reset(); clearSave(); toast('已清空，所有贴纸回到贴纸页'); });

  /* ---------- 进度变化：存档 + 完成提示 ---------- */
  const ROOMNAME = { S: '仓储间', H: '大厅', B: '卧室' };
  let prevDone = null, prevAll = false;
  function onChange(kind) {
    if (!ui) return;
    const stats = ui.refresh();
    writeSave(st.list);
    const done = Object.fromEntries(Object.entries(stats.per).map(([k, [a, b]]) => [k, a === b]));
    const all = stats.n === st.list.length;
    if (prevDone && kind === 'place') {
      const newly = Object.keys(done).filter(k => done[k] && !prevDone[k]);
      if (newly.length || (all && !prevAll)) {
        setTimeout(() => {
          fx.sfx.chime();
          if (all && !prevAllShown) {
            prevAllShown = true;
            toast('长屋完成！点「俯视地图」看看跑团视角，还能导出 PNG', 6000);
            $('#mapBtn').classList.add('nudge');
          } else toast(`${newly.map(k => ROOMNAME[k]).join('、')}贴完了！`, 3200);
        }, P.drop + 180);
      }
    }
    if (!all) prevAllShown = false;
    prevDone = done; prevAll = all;
  }
  let prevAllShown = false;

  /* ---------- 俯视地图与导出 ---------- */
  $('#mapBtn').addEventListener('click', () => {
    if (st.isDragging()) return;
    const on = S.getMode() !== 'map';
    S.setMode(on ? 'map' : 'iso'); ui.setMapUI(on);
  });
  $('#exportBtn').addEventListener('click', () => {
    const labelsWas = labels.visible; labels.visible = false; fx.ind.visible = false;
    const url = S.renderStill(S.mapStillCamera(0.5), 3500, 1400, 0x16120f);
    labels.visible = labelsWas;
    fetch(url).then(r => r.blob()).then(blob => {
      const href = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = href; a.download = 'fandu-longhouse-map.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      toast('地图已导出：1 格 = 5 尺，每米 200 像素');
    });
  });

  /* ---------- 测试用：在还没贴的位置显示编号 ---------- */
  const labels = new THREE.Group(); labels.visible = false; S.scene.add(labels);
  const labelOf = new Map();
  for (const r of st.list) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTex(r.it.n), depthTest: false, transparent: true }));
    sp.scale.setScalar(r.it.tier === 'small' ? 0.3 : 0.38); sp.renderOrder = 10;
    labels.add(sp); labelOf.set(r, sp);
  }
  function updateLabels() {
    for (const [r, sp] of labelOf) {
      const T = r.placed ? null : st.targetOf(r);
      sp.visible = !!T;
      if (!T) continue;
      const c = Math.cos(T.ry), s = Math.sin(T.ry), fwd = T.onWall ? T.dims.d / 2 + 0.15 : 0;
      sp.position.set(T.x + fwd * s, T.y + T.dims.h + sp.scale.x * 0.65, T.z + fwd * c);
    }
  }
  const labelBtn = $('#labelBtn');
  labelBtn.addEventListener('click', () => { labels.visible = !labels.visible; labelBtn.setAttribute('aria-pressed', labels.visible); });

  /* ---------- 成品图：开局在后台把 89 件全部按布局摆好，渲染一张等距图 ---------- */
  setLoading('生成成品图…', 1);
  await new Promise(r => setTimeout(r, 30));
  try {
    const tmp = new THREE.Group(); S.scene.add(tmp);
    const v = new THREE.Vector3();
    for (const r of st.list) {
      const g = st.buildAt(r, r.slot); tmp.add(g);
      if (r.light) { g.updateMatrixWorld(true); g.localToWorld(v.set(0, r.slot.dims.h * r.lightCfg.at[1], r.lightCfg.at[0])); r.light.position.copy(v); r.light.intensity = r.lightCfg.intensity; }
    }
    tmp.updateMatrixWorld(true);
    ui.setPreview(S.renderStill(S.isoStillCamera(1600, 720), 1600, 720, 0x1d1915));
    S.scene.remove(tmp);
    for (const r of st.list) if (r.light) r.light.intensity = 0;
  } catch (e) { console.warn('成品图生成失败', e); }

  /* ---------- 读存档 ---------- */
  const saved = loadSave();
  const nRestored = st.restore(saved);
  if (nRestored) toast(`已恢复上次的进度：${nRestored} 件`);

  $('#loading').classList.add('done');

  /* ---------- 渲染循环 ---------- */
  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .05), now = performance.now();
    const tweening = S.update(dt);
    if (!tweening && !st.isDragging()) S.controls.update();
    st.update(dt, now);
    fx.update(dt);
    if (labels.visible) updateLabels();
    const restore = fx.shakeBegin(S.camera, dt);
    S.render();
    restore();
  })();
  window.__longhouse.st = st;
  window.__longhouse.ready = true;
}

function numberTex(n) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fillStyle = 'rgba(22,19,16,.88)'; g.fill();
  g.lineWidth = 8; g.strokeStyle = '#6fd6cb'; g.stroke(); g.fillStyle = '#6fd6cb';
  g.font = 'bold 56px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

boot().catch(e => { console.error(e); setLoading('启动出错：' + e.message, null, true); });

// 贴纸页（标签、卡片）、进度、提示、参数面板、成品图、俯视地图与导出
import { cardUrl } from './assets.js';

const $ = s => document.querySelector(s);
const ROOMS = [['S', '仓储间'], ['H', '大厅'], ['B', '卧室']];

/* ---------- 手感参数（沿用贴纸小屋调好的默认值） ---------- */
export const DEF = { mode: 'strict', guide: 'none', focus: true, radius: 1.0, pull: 0.55, lift: 0.7, drop: 200, squash: 0.24, sound: true, shake: true, dust: true };
const PKEY = 'longhouse-params';
export function loadParams() {
  let P = { ...DEF };
  try { const s = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (s) P = { ...DEF, ...s }; } catch (e) {}
  return P;
}
const saveParams = P => { try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) {} };

/* ---------- 提示条 ---------- */
let toastTimer = 0;
export function toast(msg, ms = 2800) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, ms);
}

export function createUI({ layout, P, onResize }) {
  /* ---------- 贴纸页：三个标签只用来筛选 ---------- */
  const tabsEl = $('#tabs'), cardsEl = $('#cards');
  let room = 'S';
  try { room = localStorage.getItem('longhouse-tab') || 'S'; } catch (e) {}
  const tabBtns = {};
  for (const [id, name] of ROOMS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab');
    b.innerHTML = `<span>${name}</span><small></small>`;
    b.addEventListener('click', () => setRoom(id));
    tabsEl.appendChild(b); tabBtns[id] = b;
  }
  function setRoom(id) {
    room = id;
    try { localStorage.setItem('longhouse-tab', id); } catch (e) {}
    for (const [k, b] of Object.entries(tabBtns)) b.setAttribute('aria-selected', k === id);
    for (const c of cardsEl.children) c.hidden = c.dataset.room !== id;
    cardsEl.scrollTop = 0;
  }

  let recs = [];
  function buildCards(list, startTrayDrag) {
    recs = list;
    for (const r of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card'; b.dataset.room = r.it.room;
      b.setAttribute('aria-label', `贴纸 ${r.it.n} ${r.it.name}`);
      b.innerHTML = `<span class="num">${r.it.n}</span><img class="stk" alt="" draggable="false" src="${cardUrl(r.it.asset)}"><span class="nm">${r.it.name}</span><span class="tag">已贴</span>`;
      b.querySelector('img').addEventListener('error', () => b.classList.add('noimg'), { once: true });
      b.addEventListener('pointerdown', e => startTrayDrag(e, r));
      b.addEventListener('animationend', () => b.classList.remove('shake'));
      cardsEl.appendChild(b); r.card = b;
    }
    setRoom(room);
    refresh();
  }

  /* ---------- 进度 ---------- */
  function refresh() {
    let n = 0, f = 0;
    const per = { S: [0, 0], H: [0, 0], B: [0, 0] };
    for (const r of recs) {
      const ok = r.placed && !r.free;
      if (ok) n++; else if (r.placed) f++;
      per[r.it.room][1]++; if (ok) per[r.it.room][0]++;
      const c = r.card; if (!c) continue;
      c.classList.toggle('used', r.placed);
      const locked = !r.placed && r.it.layer === 'stack' && !r.parent.placed;
      c.classList.toggle('locked', locked);
      c.querySelector('.tag').textContent = r.placed ? (r.free ? '自由' : '已贴') : locked ? `先贴 ${r.parent.it.name}` : '';
    }
    for (const [id] of ROOMS) tabBtns[id].querySelector('small').textContent = `${per[id][0]}/${per[id][1]}`;
    $('#progN').textContent = n; $('#progT').textContent = recs.length;
    $('#progFree').textContent = f ? `（自由 +${f}）` : '';
    $('#meter').style.width = (n / recs.length * 100) + '%';
    return { n, f, per };
  }

  /* ---------- 手感调节面板 ---------- */
  const panel = $('#panel');
  function setPanel(open) { panel.hidden = !open; $('#tuneBtn').setAttribute('aria-pressed', open); $('#stage').classList.toggle('panel-open', open); onResize(); }
  $('#tuneBtn').addEventListener('click', () => setPanel(panel.hidden));
  $('#closePanel').addEventListener('click', () => setPanel(false));
  const fmt = { radius: v => v.toFixed(1) + ' m', pull: v => Math.round(v * 100) + '%', lift: v => v.toFixed(1), drop: v => v + ' ms', squash: v => Math.round(v * 100) + '%' };
  const inputs = [...document.querySelectorAll('[data-k]')];
  for (const el of inputs) {
    const k = el.dataset.k, out = document.getElementById('o-' + k);
    el._sync = () => {
      if (el.type === 'checkbox') el.checked = !!P[k]; else if (el.type === 'radio') el.checked = P[k] === el.value; else el.value = P[k];
      if (out) out.textContent = fmt[k](P[k]);
    };
    el._sync();
    const h = () => {
      if (el.type === 'checkbox') P[k] = el.checked;
      else if (el.type === 'radio') { if (!el.checked) return; P[k] = el.value; }
      else if (el.type === 'range') P[k] = parseFloat(el.value); else P[k] = el.value;
      if (out) out.textContent = fmt[k](P[k]); saveParams(P);
    };
    el.addEventListener('input', h); el.addEventListener('change', h);
  }
  $('#defaults').addEventListener('click', () => { Object.assign(P, DEF); inputs.forEach(el => el._sync()); saveParams(P); });

  /* ---------- 右上角成品图：小图常驻，点一下放大 ---------- */
  const big = $('#previewBig');
  function setPreview(url) { $('#previewImg').src = url; big.querySelector('img').src = url; $('#preview').hidden = false; }
  $('#preview').addEventListener('click', () => { big.hidden = false; });
  big.addEventListener('click', () => { big.hidden = true; });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') big.hidden = true; });

  /* ---------- 俯视地图 ---------- */
  function setMapUI(on) {
    const b = $('#mapBtn');
    b.setAttribute('aria-pressed', on); b.textContent = on ? '回到 3D' : '俯视地图'; b.classList.remove('nudge');
    $('#maptag').hidden = !on; $('#exportBtn').hidden = !on;
    document.body.classList.toggle('map-mode', on);
  }

  return { buildCards, refresh, setRoom, panel, setPreview, setMapUI };
}

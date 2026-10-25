// localStorage 存档：键名 longhouse-save-v1，内容 {version:1, placed:{asset:{x,y,z,ry,free}}}
// 手感参数单独存在 longhouse-params（见 ui.js）。读写都包 try/catch：隐私模式等情况下可能用不了。
const KEY = 'longhouse-save-v1';

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.version === 1 && s.placed) return s;
  } catch (e) {}
  return null;
}

let timer = 0;
export function writeSave(list) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const placed = {};
    for (const r of list) {
      if (!r.placed || !r.pose) continue;
      const p = r.pose;
      placed[r.it.asset] = { x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4), ry: +p.ry.toFixed(4), free: !!r.free };
    }
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, placed })); } catch (e) {}
  }, 150);
}

export function clearSave() {
  clearTimeout(timer);
  try { localStorage.removeItem(KEY); } catch (e) {}
}

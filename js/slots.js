// 根据 layout.json 计算每张贴纸的目标位置（地面 / 墙面 / 叠放）。
// 约定：每个物件的局部原点在"包围盒底面中心"，长边沿局部 x，正面朝局部 +z。
// pose = {x, y, z: 底面中心的世界坐标; ry: 绕 y 轴弧度; dims: {l,h,d} 摆放后的长/高/厚; onWall; wall}

const DEG = Math.PI / 180;
const HALF_WALL = 0.125;            // 墙厚 0.25，隔墙以 x = 4.5 / 12 为中线

// 很扁的东西（高 < 宽 × 0.5）挂墙时绕 x 轴转 +90°，正面朝外：竖向尺寸变成 W，厚度变成 H
export const isFlat = it => it.H < it.W * 0.5;
export function orientedDims(it, onWall) {
  return onWall && isFlat(it) ? { l: it.L, h: it.W, d: it.H, flat: true } : { l: it.L, h: it.H, d: it.W, flat: false };
}

// 各面墙：贴墙的那一侧表面，以及物件的朝向
export const WALLS = {
  back: { ry: 0,         normal: [0, 0, 1],  surface: 0 },                  // 后墙内表面 z = 0
  p1:   { ry: -Math.PI/2, normal: [-1, 0, 0], surface: 4.5 - HALF_WALL },   // 仓储↔大厅隔墙，仓储一侧
  p2:   { ry: -Math.PI/2, normal: [-1, 0, 0], surface: 12 - HALF_WALL },    // 大厅↔卧室隔墙，大厅一侧
};

function wallPose(it, wallId, along, centerY, dims) {
  const W = WALLS[wallId];
  const pose = { asset: it.asset, ry: W.ry, dims, onWall: true, wall: wallId, y: centerY - dims.h / 2 };
  if (wallId === 'back') { pose.x = along; pose.z = W.surface + dims.d / 2; }
  else { pose.x = W.surface - dims.d / 2; pose.z = along; }
  return pose;
}

// 把父物件局部坐标 (ox, oz) 转成世界坐标（three.js 的 rotation.y 规则）
function local(P, ox, oz) {
  const c = Math.cos(P.ry), s = Math.sin(P.ry);
  return { x: P.x + ox * c + oz * s, z: P.z - ox * s + oz * c };
}

// 叠放：根据父物件"实际"位姿实时计算（阶段 2 自由模式下父物件可能不在原位，所以单独导出）
export function stackPose(it, P) {
  const [mode, fs] = (it.ymode || 'top').split(':'), f = parseFloat(fs);
  if (P.onWall) {
    // 父物件在墙上：子物件挂在同一面墙上，沿墙偏移 u × 父长；hang:f = 子物件顶部比父物件底部高 父高 × f（挂钩上的重叠）
    const dims = orientedDims(it, true);
    const xz = local(P, it.u * P.dims.l, (dims.d - P.dims.d) / 2);
    let y;
    if (mode === 'hang') y = P.y + P.dims.h * f - dims.h;
    else if (mode === 'level') y = P.y + P.dims.h * f;
    else y = P.y + P.dims.h;
    return { asset: it.asset, x: xz.x, y, z: xz.z, ry: P.ry, dims, onWall: true, wall: P.wall, parent: it.on };
  }
  const dims = orientedDims(it, false);
  const xz = local(P, it.u * P.dims.l, it.v * P.dims.d);
  let y;
  if (mode === 'top') y = P.y + P.dims.h;
  else if (mode === 'level' || mode === 'hang') y = P.y + P.dims.h * f;   // 架子某一层 / 吊锅架上的锅（底部高度）
  else if (mode === 'floor') y = 0;                                        // 跨在父物件上、落在地面（吊锅架跨篝火）
  else y = P.y + P.dims.h;
  return { asset: it.asset, x: xz.x, y, z: xz.z, ry: P.ry, dims, onWall: false, wall: null, parent: it.on };
}

export function basePose(it) {
  if (it.layer === 'floor') {
    return { asset: it.asset, x: it.x, y: 0, z: it.z, ry: (it.rot || 0) * DEG, dims: orientedDims(it, false), onWall: false, wall: null };
  }
  if (it.layer === 'wall') return wallPose(it, it.wall, it.along, it.y, orientedDims(it, true));
  return null;
}

// 所有贴纸的"正确位置"。返回 Map<asset, pose>
export function computeSlots(layout) {
  const by = new Map(layout.items.map(i => [i.asset, i]));
  const poses = new Map();
  const get = it => {
    if (poses.has(it.asset)) return poses.get(it.asset);
    const p = it.layer === 'stack' ? stackPose(it, get(by.get(it.on))) : basePose(it);
    poses.set(it.asset, p);
    return p;
  };
  for (const it of layout.items) get(it);
  return poses;
}

// 叠放链的最底层（地面或墙面物件）
export function rootOf(layout, asset) {
  const by = new Map(layout.items.map(i => [i.asset, i]));
  let p = by.get(asset);
  while (p && p.layer === 'stack') p = by.get(p.on);
  return p;
}

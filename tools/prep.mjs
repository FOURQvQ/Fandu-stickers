// 模型压缩脚本：按 layout.json 里每件的档位减面、缩贴图，输出到 models/，并登记到压缩记录。
//
// 本地用法（在 longhouse-game 文件夹里）：
//   node tools/prep.mjs            压缩 ..\model\house2 (b1) 和 ..\model\longhouse (b2) 里新的或改过的模型
//   node tools/prep.mjs --force    全部重压
//   node tools/prep.mjs --only b1-F03,b2-T01   只压指定的几个（会无视记录强制重压）
//
// 跳过规则：models/compressed.json 里已登记、原文件内容（sha1）没变、且 models/<编号>.glb 还在 → 跳过。
// 每压完一个立刻写记录，中途出错或关掉也不会丢已完成的。
// 人看的记录：models/压缩记录.md（每次运行自动重新生成，不要手改）。
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, quantize, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import os from 'os';
import { fileURLToPath } from 'url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const optAll = k => args.flatMap((a, i) => a === k ? [args[i + 1]] : []);
const FORCE = args.includes('--force');
const ONLY = opt('--only') ? new Set(opt('--only').split(',').map(s => s.trim().toUpperCase().replace(/^B/, 'b'))) : null;
const BY = opt('--by', `本地 ${os.hostname()}`);
const layoutPath = opt('--layout', path.join(GAME, 'layout.json'));
const outDir = opt('--out', path.join(GAME, 'models'));
let srcs = optAll('--src');
if (!srcs.length) srcs = [`${path.join(GAME, '..', 'model', 'house2')}=b1`, `${path.join(GAME, '..', 'model', 'longhouse')}=b2`];

const L = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
const info = {};
for (const it of L.items) info[it.asset] ??= { tier: it.tier, name: it.name };
for (const s of L.shell) info[s.asset] ??= { tier: 'shell', name: s.name };
// 房屋构件按摆放次数降预算：地砖摆 32 块、立柱 16 根，每块都按 8000 面会很重
const kitCount = {}; for (const k of L.kit) kitCount[k.asset] = (kitCount[k.asset] || 0) + 1;
const shellFaces = id => { const n = kitCount[id] || 1; return n >= 8 ? 2000 : n >= 4 ? 4000 : 8000; };
const BUDGET = { big: { faces: 18000, tex: 1024 }, mid: { faces: 7000, tex: 512 }, small: { faces: 2500, tex: 512 }, shell: { faces: 8000, tex: 1024 } };
const TIER_CN = { big: '大件', mid: '中件', small: '小摆件', shell: '房屋构件' };

fs.mkdirSync(outDir, { recursive: true });
const recPath = path.join(outDir, 'compressed.json');
const rec = fs.existsSync(recPath) ? JSON.parse(fs.readFileSync(recPath, 'utf8')) : {};
const saveRec = () => {
  const tmp = recPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rec, null, 1)); fs.renameSync(tmp, recPath);
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const countTris = doc => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3; return Math.round(t); };
const now = () => { const d = new Date(Date.now() + 8 * 3600e3); return d.toISOString().slice(5, 16).replace('T', ' '); };

let nDone = 0, nSkip = 0, nFail = 0;
for (const s of srcs) {
  const cut = s.lastIndexOf('='); const dir = s.slice(0, cut), prefix = s.slice(cut + 1);
  if (!fs.existsSync(dir)) { console.log(`找不到文件夹 ${dir}，跳过`); continue; }
  for (const f of fs.readdirSync(dir).filter(f => /\.glb$/i.test(f)).sort()) {
    const code = f.replace(/(_glb)?\.glb$/i, '').toUpperCase();
    const id = `${prefix}-${code}`;
    if (ONLY && !ONLY.has(id)) continue;
    const meta = info[id];
    if (!meta) { console.log(`跳过 ${f}：${id} 不在 layout 里`); continue; }
    const srcFile = path.join(dir, f), out = path.join(outDir, `${id}.glb`);
    const buf = fs.readFileSync(srcFile);
    const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
    const r = rec[id];
    if (!FORCE && !ONLY && r && r.sha1 === sha1 && fs.existsSync(out)) { nSkip++; continue; }
    const t0 = Date.now();
    try {
      // 减面：第一轮用保守的误差上限，保留 UV 接缝；
      // AI 模型 UV 碎块多，常被接缝卡住减不下去 → 超过预算 2.5 倍的物件，第二轮允许跨接缝减面（Permissive）
      const B = { ...BUDGET[meta.tier] };
      if (meta.tier === 'shell') B.faces = shellFaces(id);
      const doc = await io.readBinary(new Uint8Array(buf));
      const tris = countTris(doc);
      const ratio = Math.min(1, B.faces / tris);
      const ops = [dedup(), prune(), weld()];
      if (ratio < 0.98) ops.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: meta.tier === 'big' || meta.tier === 'shell' ? 0.01 : 0.025 }));
      await doc.transform(...ops);
      let after = countTris(doc), pass = 1;
      // 房屋构件不走第二轮（会把贴图拉花，地砖最明显）；物件第二轮只减到预算的 2 倍，留余量少拉花
      if (meta.tier !== 'shell' && after > B.faces * 2.5) {
        pass = 2;
        const err = meta.tier === 'big' || meta.tier === 'shell' ? 0.03 : 0.06;
        for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
          const idxAcc = p.getIndices(), pos = p.getAttribute('POSITION');
          if (!idxAcc || p.getMode() !== 4) continue;
          const idx = new Uint32Array(idxAcc.getArray());
          const P = pos.getArray() instanceof Float32Array ? pos.getArray() : Float32Array.from({ length: pos.getCount() * 3 }, (_, i) => pos.getElement(Math.floor(i / 3), [])[i % 3]);
          const target = Math.max(3, Math.floor(idx.length * 2 * B.faces / after / 3) * 3);
          const [out] = MeshoptSimplifier.simplify(idx, P, 3, target, err, ['Permissive']);
          if (out.length >= 3 && out.length < idx.length) { idxAcc.setArray(out); compactPrimitive(p); }
        }
        await doc.transform(prune());
        after = countTris(doc);
      }      await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [B.tex, B.tex], quality: 82 }), quantize());
      fs.writeFileSync(out, await io.writeBinary(doc));
      const outBytes = fs.statSync(out).size;
      rec[id] = { name: meta.name, tier: meta.tier, src: `${path.basename(dir)}/${f}`, srcBytes: buf.length, sha1, trisBefore: tris, trisAfter: after, budget: B.faces, pass, outBytes, by: BY, at: now() };
      saveRec(); nDone++;
      console.log(`${id.padEnd(7)} ${meta.tier.padEnd(5)} ${String(tris).padStart(7)} -> ${String(after).padStart(6)} 面  ${(buf.length / 1e6).toFixed(1)} -> ${(outBytes / 1e6).toFixed(2)} MB  ${pass === 2 ? '二轮' : '    '}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      nFail++; console.log(`!! ${id} 压缩失败：${e.message}`);
    }
  }
}

// models/index.json：游戏读这个决定哪些物件换成真模型
const all = fs.readdirSync(outDir).filter(f => /^b\d-[A-Z]\d+\.glb$/.test(f)).map(f => f.replace('.glb', '')).sort();
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(all));

// models/压缩记录.md
const ids = Object.keys(info).sort();
const missing = ids.filter(id => !rec[id] || !fs.existsSync(path.join(outDir, `${id}.glb`)));
const MB = b => (b / 1e6).toFixed(2);
const done = ids.filter(id => !missing.includes(id));
const sum = (k) => done.reduce((a, id) => a + rec[id][k], 0);
let md = `# 压缩记录\n\n> 由 tools/prep.mjs 自动生成，请勿手改。真正的记录在 compressed.json。\n> 判断"压过没有"看原文件内容（sha1）：朋友重新生成并覆盖了某个文件，下次运行会自动重压。\n\n`;
md += `最后更新：${now()}（${BY}）\n\n`;
md += `**已压 ${done.length} / ${ids.length}**　原始 ${MB(sum('srcBytes'))} MB → 压后 ${MB(sum('outBytes'))} MB　面数 ${sum('trisBefore').toLocaleString()} → ${sum('trisAfter').toLocaleString()}\n\n`;
md += missing.length ? `**还没有模型（${missing.length}）**：${missing.map(id => `${id} ${info[id].name}`).join('、')}\n\n` : `所有物件都有模型了。\n\n`;
md += `| 编号 | 名称 | 档位 | 原文件 | 原大小 MB | 面数（前→后） | 压后 MB | 由谁压 | 时间 |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const id of done) { const r = rec[id]; md += `| ${id} | ${r.name} | ${TIER_CN[r.tier]} | ${r.src} | ${MB(r.srcBytes)} | ${r.trisBefore.toLocaleString()} → ${r.trisAfter.toLocaleString()} | ${MB(r.outBytes)} | ${r.by} | ${r.at} |\n`; }
fs.writeFileSync(path.join(outDir, '压缩记录.md'), md);

console.log(`\n本次压缩 ${nDone} 个，跳过（已压过）${nSkip} 个，失败 ${nFail} 个。共有模型 ${all.length} 个，还缺 ${missing.length} 个。`);
console.log(`记录：${path.join(outDir, '压缩记录.md')}`);

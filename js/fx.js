// 合成音效、尘土、圆环、震屏（从贴纸小屋照搬）
import * as THREE from 'three';

export const GUIDE = new THREE.Color('#6fd6cb'), AMBER = new THREE.Color('#ffc65c');

export function createFx(scene, P) {
  /* ---------- 音效（全部现场合成，不需要音频文件） ---------- */
  let AC = null, master = null, noiseBuf = null;
  function ensureAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .7; master.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * .5, AC.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    } catch (e) { AC = null; }
  }
  function noise(dur, type, f0, f1, gain, q) {
    const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + .02);
  }
  function tone(f0, f1, dur, gain, type) {
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
  }
  const on = () => P.sound && AC;
  const sfx = {
    peel() { if (!on()) return; noise(.15, 'bandpass', 900, 4200, .2, 2.5); },
    tick() { if (!on()) return; tone(1500, 1400, .05, .07, 'triangle'); setTimeout(() => AC && tone(2250, 2100, .05, .05, 'triangle'), 45); },
    thock(k, wall) { if (!on()) return; tone(wall ? 320 : 180, wall ? 110 : 55, .2, .55 * k); noise(.05, 'bandpass', wall ? 3400 : 2600, 1200, .28 * k, 1.2); },
    soft() { if (!on()) return; tone(240, 120, .12, .2); },
    whoosh() { if (!on()) return; noise(.2, 'bandpass', 2200, 500, .09, .8); },
    deny() { if (!on()) return; tone(220, 180, .09, .12, 'square'); setTimeout(() => AC && tone(180, 150, .1, .1, 'square'), 90); },
    // 阶段 3 的完成提示音
    chime() { if (!on()) return; [660, 880, 1320].forEach((f, i) => setTimeout(() => AC && tone(f, f * .98, .35, .12, 'triangle'), i * 110)); },
  };

  /* ---------- 尘土 ---------- */
  const dustGeo = new THREE.IcosahedronGeometry(.06, 0), dust = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: 0xeadfc8, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; scene.add(m); dust.push({ m, v: new THREE.Vector3(), life: 0 });
  }
  let dustIdx = 0;
  function puff(pos, normal, spread) {
    if (!P.dust) return;
    const u = new THREE.Vector3(), v = new THREE.Vector3();
    if (Math.abs(normal.y) > .9) { u.set(1, 0, 0); v.set(0, 0, 1); } else { u.crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize(); v.set(0, 1, 0); }
    for (let i = 0; i < 16; i++) {
      const p = dust[dustIdx++ % dust.length], a = i / 16 * Math.PI * 2 + Math.random() * .4, dir = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      p.m.position.copy(pos).addScaledVector(dir, spread * .55).addScaledVector(normal, .06);
      p.v.copy(dir).multiplyScalar(1.1 + Math.random() * 1.2).addScaledVector(normal, .5 + Math.random() * .4);
      p.life = 1; p.m.visible = true;
    }
  }

  /* ---------- 落地圆环 + 拖拽指示环 ---------- */
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 48), new THREE.MeshBasicMaterial({ color: GUIDE.clone(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false; m.renderOrder = 6; scene.add(m); rings.push({ m, life: 0, r: 1 });
  }
  let ringIdx = 0;
  function orientToSurface(m, normal) {
    m.rotation.set(0, 0, 0);
    if (normal.y > .9) m.rotation.x = -Math.PI / 2; else if (Math.abs(normal.x) > .9) m.rotation.y = Math.PI / 2;
  }
  function ringPulse(pos, normal, r) {
    const R = rings[ringIdx++ % rings.length]; R.m.position.copy(pos).addScaledVector(normal, .04); orientToSurface(R.m, normal); R.r = r; R.life = 1; R.m.visible = true;
  }
  const ind = new THREE.Mesh(new THREE.RingGeometry(.15, .22, 32), new THREE.MeshBasicMaterial({ color: GUIDE.clone(), transparent: true, opacity: .9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  ind.renderOrder = 5; ind.visible = false; scene.add(ind);

  /* ---------- 震屏 ---------- */
  let shakeT = 0, shakeAmp = 0;
  function shake(size) { if (!P.shake) return; shakeT = 1; shakeAmp = .05 + .05 * Math.min(1, size); }

  function update(dt) {
    for (const p of dust) {
      if (p.life <= 0) continue; p.life -= dt * 2.1; p.m.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 4); p.v.y -= dt * 1.2;
      p.m.material.opacity = Math.max(0, p.life) * .7; p.m.scale.setScalar(.6 + (1 - p.life) * 1.3); if (p.life <= 0) p.m.visible = false;
    }
    for (const R of rings) {
      if (R.life <= 0) continue; R.life -= dt * 2.4; const k = 1 - Math.max(0, R.life);
      R.m.scale.setScalar(R.r * (.9 + k * .8)); R.m.material.opacity = Math.max(0, R.life) * .85; if (R.life <= 0) R.m.visible = false;
    }
  }
  // 渲染前抖一下相机，渲染后复原
  function shakeBegin(camera, dt) {
    let sx = 0, sy = 0;
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt * 5); const a = shakeAmp * shakeT * shakeT;
      sx = (Math.random() - .5) * a; sy = (Math.random() - .5) * a; camera.position.x += sx; camera.position.y += sy;
    }
    return () => { camera.position.x -= sx; camera.position.y -= sy; };
  }

  return { ensureAudio, sfx, puff, ringPulse, orientToSurface, ind, shake, update, shakeBegin };
}

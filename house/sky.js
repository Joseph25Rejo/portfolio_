/* The night outside: one painted dome (stars, a far city on the horizon), a moon, and fog that melts the ground into the horizon. */
import * as THREE from '../vendor/three.module.min.js';

const rng = (sd) => { let x = sd >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };

export function buildSky(scene) {
  const W = 2048, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), r = rng(7);
  const grad = g.createLinearGradient(0, 0, 0, H / 2);
  grad.addColorStop(0, '#060a1b'); grad.addColorStop(0.55, '#0f1738'); grad.addColorStop(0.9, '#1b2147'); grad.addColorStop(1, '#2a2340');
  g.fillStyle = grad; g.fillRect(0, 0, W, H / 2);
  g.fillStyle = '#10152e'; g.fillRect(0, H / 2, W, H / 2);
  const glow = g.createLinearGradient(0, H / 2 - 90, 0, H / 2);
  glow.addColorStop(0, 'rgba(255,160,90,0)'); glow.addColorStop(1, 'rgba(255,160,90,.32)'); g.fillStyle = glow; g.fillRect(0, H / 2 - 90, W, 90);
  for (let i = 0; i < 700; i++) { const y = Math.pow(r(), 1.4) * (H / 2 - 40), a = 0.35 + r() * 0.65; g.fillStyle = 'rgba(' + (200 + r() * 55 | 0) + ',' + (210 + r() * 45 | 0) + ',255,' + a.toFixed(2) + ')'; const s = r() < 0.08 ? 2.2 : 1.2; g.fillRect(r() * W, y, s, s); }
  /* the far city: two layers of towers standing on the horizon, with lit windows and a few red beacons */
  [['#161c3b', 0.62, 26], ['#0b1124', 1, 40]].forEach((layer, li) => {
    let x = 0;
    while (x < W) {
      const w = 14 + r() * 34, h = (10 + Math.pow(r(), 1.5) * 52) * layer[1];
      g.fillStyle = layer[0]; g.fillRect(x, H / 2 - h, w, h + 2);
      if (li) {
        for (let wy = H / 2 - h + 4; wy < H / 2 - 3; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 4) if (r() < 0.32) { g.fillStyle = r() < 0.8 ? 'rgba(255,208,132,.85)' : 'rgba(190,215,255,.8)'; g.fillRect(wx, wy, 1.6, 2.2); }
        if (r() < 0.12) { g.fillStyle = 'rgba(255,70,70,.95)'; g.fillRect(x + w / 2 - 1, H / 2 - h - 4, 2, 2); }
      }
      x += w + 1 + r() * 8;
    }
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9000, 40, 20), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -2; scene.add(dome);

  /* moon: a soft disc with a halo, placed to the west beside the windows */
  const mc = document.createElement('canvas'); mc.width = mc.height = 256;
  const m = mc.getContext('2d'), halo = m.createRadialGradient(128, 128, 20, 128, 128, 128);
  halo.addColorStop(0, 'rgba(190,205,255,.55)'); halo.addColorStop(0.35, 'rgba(190,205,255,.16)'); halo.addColorStop(1, 'rgba(190,205,255,0)');
  m.fillStyle = halo; m.fillRect(0, 0, 256, 256);
  const disc = m.createRadialGradient(118, 120, 4, 128, 128, 40);
  disc.addColorStop(0, '#fffdf1'); disc.addColorStop(0.6, '#f3ead0'); disc.addColorStop(1, '#d9cc9f');
  m.fillStyle = disc; m.beginPath(); m.arc(128, 128, 38, 0, 7); m.fill();
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mc), transparent: true, depthWrite: false, fog: false }));
  const el = 22 * Math.PI / 180; moon.position.set(Math.cos(el) * 8400, Math.sin(el) * 8400, 0); moon.lookAt(0, 0, 0); moon.renderOrder = -1; scene.add(moon);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(9300, 64), new THREE.MeshBasicMaterial({ color: 0x141b33 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -61; scene.add(ground);
  scene.fog = new THREE.Fog(0x21203f, 3500, 9000);
  return { dome, moon, ground };
}

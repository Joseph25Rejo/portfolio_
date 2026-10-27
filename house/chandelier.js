/* The chandelier: three brass tiers hanging on a long chain in the middle of the stairwell, candles on every ring, glass
   drops under the lowest. One merged vertex-coloured mesh for the metalwork, one Points draw for the candle glow. */
import * as THREE from '../vendor/three.module.min.js';
import { Builder } from './builder.js';
import { addLight } from './light.js';
import { D, FH, TOP } from './layout.js';

const Y = FH * 2.5 + 40; /* lowest ring: between the stops of floors 2 and 3, so no door shot is blocked */
const TIERS = [[62, 0, 12], [42, 38, 8], [22, 70, 5]]; /* radius, height above the lowest ring, candle count */
const sinz = (a) => Math.sin(a * D), cosz = (a) => Math.cos(a * D);

/* registered before the shell bakes, so the stairwell walls pick up its warmth */
export function chandelierLights() {
  addLight([0, Y + 50, 0], [1, 0.8, 0.5], 1.15, 900);
}

export function buildChandelier(scene, kernel) {
  const B = new Builder(), UP = [0, 1, 0];
  const flat = (rgb) => (p, n) => { const k = n[1] > 0.5 ? 1 : n[1] < -0.5 ? 0.55 : 0.82; return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; };
  const BRASS = flat([226, 190, 112]), DARK = flat([92, 72, 40]), WAX = flat([246, 238, 212]), GLASS = flat([196, 222, 238]), FLAME = () => [255, 240, 180];
  /* a box centred at (x,y,z), half sizes h, turned by `rot` degrees about y */
  const box = (x, y, z, hx, hy, hz, rot, col) => {
    const c = cosz(rot), s = sinz(rot), P = (i, j, k) => [x + (i * hx) * c + (k * hz) * s, y + j * hy, z - (i * hx) * s + (k * hz) * c];
    const q = (a, b, cc, d, h) => B.quad(a, b, cc, d, col, 1, 1, h);
    const rx = [c, 0, -s], rz = [s, 0, c];
    q(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), rz); q(P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), [-rz[0], 0, -rz[2]]);
    q(P(1, -1, -1), P(1, -1, 1), P(1, 1, 1), P(1, 1, -1), rx); q(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), [-rx[0], 0, -rx[2]]);
    q(P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1), UP); q(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), [0, -1, 0]);
  };

  const glows = [];
  /* chain from the skylight lantern down to the hub, then the central column */
  const top = TOP + 380;
  box(0, (top + Y + 120) / 2, 0, 1.6, (top - Y - 120) / 2, 1.6, 0, DARK);
  box(0, Y + 96, 0, 7, 14, 7, 0, BRASS); box(0, Y + 50, 0, 4, 40, 4, 0, BRASS); box(0, Y - 6, 0, 8, 8, 8, 45, BRASS);

  TIERS.forEach(([R, h, n]) => {
    const y = Y + h, seg = Math.max(12, n * 2);
    /* the ring: short boxes laid round a circle */
    for (let i = 0; i < seg; i++) {
      const a = (i + 0.5) * 360 / seg, len = Math.PI * R / seg * 1.08;
      box(R * sinz(a), y, R * cosz(a), len, 2.2, 2.2, a, BRASS);
    }
    /* four spokes up to the column */
    for (let i = 0; i < 4; i++) { const a = i * 90 + 45; box(R / 2 * sinz(a), y + 1, R / 2 * cosz(a), R / 2, 1.6, 1.6, a + 90, DARK); }
    /* candles: a cup, a taper of wax and a flame */
    for (let i = 0; i < n; i++) {
      const a = i * 360 / n + 7, x = R * sinz(a), z = R * cosz(a);
      box(x, y + 5, z, 3.6, 3, 3.6, a, BRASS); box(x, y + 17, z, 2.1, 9, 2.1, a, WAX); box(x, y + 28, z, 0.9, 2.4, 0.9, a, FLAME);
      glows.push(x, y + 32, z);
    }
  });
  /* glass drops under the lowest ring */
  for (let i = 0; i < 24; i++) { const a = i * 15, R = TIERS[0][0]; box(R * sinz(a), Y - 6 - (i % 3) * 2, R * cosz(a), 1.2, 3.5 + (i % 3) * 2, 1.2, a, GLASS); }
  box(0, Y - 26, 0, 2.5, 12, 2.5, 0, GLASS);

  const body = new THREE.Mesh(B.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(body);

  /* one big soft halo plus a spark on every candle, drawn in one go */
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gx = gc.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gg.addColorStop(0, 'rgba(255,244,210,1)'); gg.addColorStop(0.3, 'rgba(255,212,140,.45)'); gg.addColorStop(1, 'rgba(255,200,120,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);
  const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute([0, Y + 40, 0, ...glows], 3));
  const mat = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(gc), size: 58, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc678, fog: false });
  const points = new THREE.Points(gp, mat); points.frustumCulled = false; scene.add(points);

  const c0 = new THREE.Vector3(0, Y + 40, 0), fwd = new THREE.Vector3();
  return {
    body, points, y: Y,
    /* the flames only shimmer while the chandelier is near the camera and in front of it */
    tick(now) {
      const cam = kernel.camera.position;
      if (Math.abs(cam.y - c0.y) > 900) return false;
      const dx = c0.x - cam.x, dy = c0.y - cam.y, dz = c0.z - cam.z, l = Math.hypot(dx, dy, dz) || 1, f = kernel.camera.getWorldDirection(fwd);
      if ((f.x * dx + f.y * dy + f.z * dz) / l < 0.3) return false;
      const t = now / 1000; mat.size = 58 + 5 * Math.sin(t * 7.3) + 3 * Math.sin(t * 12.9 + 1.7);
      return 2;
    }
  };
}

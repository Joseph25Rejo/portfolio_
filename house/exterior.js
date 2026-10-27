/* The outside of the house: plinth, porch, canopy, lanterns, cobble path, lawn, hedges, trees and lamp posts.
   Like the shell, all of it is baked into the shared vertex-coloured mesh; the only extra draw is one `Points` for glows.
   Ground level outside is y = -60 so the porch sits flush with the hall floor (y = 0). */
import * as THREE from '../vendor/three.module.min.js';
import { addLight, shade, mix, hex, grain, extAmb } from './light.js';
import { D, APO, FRONT } from './layout.js';

const GY = -60, WALL = 30, FW = 2 * APO * Math.tan(9 * D) + 1.5;
const C = hex;
const sinz = (a) => Math.sin(a * D), cosz = (a) => Math.cos(a * D);
const UP = [0, 1, 0], DOWN = [0, -1, 0];

/* point lights, registered before anything is baked */
export function exteriorLights() {
  const az = FRONT.az, r = APO + WALL + 70;
  const at = (lat, y, rad) => [rad * sinz(az) - lat * cosz(az), y, rad * cosz(az) + lat * sinz(az)];
  const glows = [];
  [-112, 112].forEach((lat) => { const p = at(lat, 240, r - 40); addLight(p, [1, 0.78, 0.5], 1.5, 560); glows.push(p); });
  const lamps = [];
  [[1000, -170], [1000, 170], [1600, -170], [1600, 170]].forEach(([rad, lat]) => {
    const p = at(lat, 270, rad); addLight(p, [1, 0.8, 0.5], 1.3, 520); lamps.push(p); glows.push(p);
  });
  return { glows, lamps, at };
}

export function buildExterior(scene, B, H, ex) {
  const { slab, fp } = H, az = FRONT.az;
  const ext = (alb, amt) => (p, n) => shade([alb[0] * grain(p, amt || 0.1), alb[1] * grain(p, amt || 0.1), alb[2] * grain(p, amt || 0.1)], p, n, extAmb(n));
  const wquad = (a, b, c, d, col, h, nu, nv) => B.quad(a, b, c, d, col, nu || 1, nv || 1, h);
  const wbox = (x0, x1, y0, y1, z0, z1, col) => {
    wquad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, [0, 0, 1]); wquad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], col, [0, 0, -1]);
    wquad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], col, [1, 0, 0]); wquad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, [-1, 0, 0]);
    wquad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], col, UP);
  };
  const blob = (cx, cy, cz, rx, ry, rz, nu, nv, col) => {
    const P = (i, j) => { const t = Math.PI * j / nv, f = 2 * Math.PI * i / nu; return [cx + rx * Math.sin(t) * Math.sin(f), cy + ry * Math.cos(t), cz + rz * Math.sin(t) * Math.cos(f)]; };
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = P(i, j + 1), b = P(i + 1, j + 1), c = P(i + 1, j), d = P(i, j);
      const m = [(a[0] + b[0] + c[0] + d[0]) / 4 - cx, (a[1] + b[1] + c[1] + d[1]) / 4 - cy, (a[2] + b[2] + c[2] + d[2]) / 4 - cz];
      B.quad(a, b, c, d, col, 1, 1, [m[0] / (rx * rx), m[1] / (ry * ry), m[2] / (rz * rz)]);
    }
  };

  /* plinth under the whole tower */
  for (let m = 0; m < 20; m++) { const a = m * 18, f = (l, y, r) => fp(a, l, y, r); B.quad(f(FW / 2, GY, APO + WALL + 6), f(-FW / 2, GY, APO + WALL + 6), f(-FW / 2, 0, APO + WALL + 6), f(FW / 2, 0, APO + WALL + 6), ext(C('#5B554A')), 1, 1, [sinz(a), 0, cosz(a)]); }

  /* porch: platform flush with the hall floor, two steps down, canopy on two posts */
  const stone = ext(C('#8F8774')), warm = ext(C('#9A8C6E'));
  const R0 = APO + WALL;
  slab(az, -165, 165, GY, 0, R0, R0 + 150, stone, 'oitlr');
  slab(az, -165, 165, -40, -20, R0 + 150, R0 + 210, stone, 'oitlr'); slab(az, -165, 165, GY, -40, R0 + 150, R0 + 210, stone, 'o');
  slab(az, -165, 165, GY, -20, R0 + 210, R0 + 270, stone, 'otlr'); slab(az, -165, 165, GY, -40, R0 + 210, R0 + 270, stone, 'o');
  slab(az, -140, 140, 345, 360, R0, R0 + 160, ext(C('#5A4A32')), 'otbolr');
  [-134, 134].forEach((l) => slab(az, l - 6, l + 6, 0, 345, R0 + 148, R0 + 160, ext(C('#6A5638')), 'oitlr'));
  /* wall lanterns beside the door: body now, glow later */
  [-112, 112].forEach((l) => slab(az, l - 8, l + 8, 220, 262, R0, R0 + 18, ext(C('#9C7A3C'), 0.03), 'oitlr'));

  /* path out to the street, in cobbles, and the lawn round the tower */
  const polar = (ra, rb, a0, a1, y, cell, sub, colA, colB) => {
    const nr = Math.max(1, Math.ceil((rb - ra) / cell)), na = Math.max(1, Math.ceil((a1 - a0) * D * rb / cell));
    for (let ri = 0; ri < nr; ri++) for (let i = 0; i < na; i++) {
      const r0 = ra + (rb - ra) * ri / nr, r1 = ra + (rb - ra) * (ri + 1) / nr, p0 = a0 + (a1 - a0) * i / na, p1 = a0 + (a1 - a0) * (i + 1) / na;
      const P = (aa, rr) => [rr * sinz(aa), y, rr * cosz(aa)];
      B.quad(P(p0, r0), P(p1, r0), P(p1, r1), P(p0, r1), ext((ri + i) % 2 ? colA : colB, 0.18), sub, sub, UP);
    }
  };
  polar(R0 + 6, 1900, 0, 360, GY + 0.2, 220, 2, C('#2B4A38'), C('#264232'));
  for (let i = 0; i < 17; i++) {
    const r0 = R0 + 270 + i * 130, r1 = r0 + 130, w = 120, f = (l, rr) => fp(az, l, GY + 0.6, rr);
    [[-w, 0], [0, w]].forEach(([l0, l1], q) => B.quad(f(l0, r0), f(l1, r0), f(l1, r1), f(l0, r1), ext(C((i + q) % 2 ? '#7B7585' : '#6C6678'), 0.16), 2, 3, UP));
  }

  /* hedges either side of the path, and trees beyond */
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 44; k++) {
    const a = k * 360 / 44 + (rnd() - 0.5) * 3;
    if (Math.abs(((a - az + 540) % 360) - 180) < 9) continue;
    const r = 1150 + (rnd() - 0.5) * 60;
    blob(r * sinz(a), GY + 28, r * cosz(a), 76 + rnd() * 20, 50 + rnd() * 12, 76 + rnd() * 20, 8, 5, ext(C('#1F3A2A'), 0.16));
  }
  for (let k = 0; k < 9; k++) {
    const a = 20 + k * 40 + rnd() * 18, r = 2000 + rnd() * 500, x = r * sinz(a), z = r * cosz(a);
    wbox(x - 14, x + 14, GY, GY + 260, z - 14, z + 14, ext(C('#3A2B1F'), 0.1));
    blob(x, GY + 380, z, 150 + rnd() * 30, 190 + rnd() * 30, 150 + rnd() * 30, 9, 6, ext(C('#1B3326'), 0.18));
  }

  /* lamp posts: dark iron, bright lamp head */
  ex.lamps.forEach((p) => {
    wbox(p[0] - 4, p[0] + 4, GY, p[1] + 20, p[2] - 4, p[2] + 4, ext(C('#25262A'), 0.05));
    wbox(p[0] - 14, p[0] + 14, p[1] - 22, p[1] + 26, p[2] - 14, p[2] + 14, () => [255, 232, 176]);
    wbox(p[0] - 19, p[0] + 19, p[1] + 26, p[1] + 34, p[2] - 19, p[2] + 19, ext(C('#25262A'), 0.05));
  });

  /* glows for lanterns and lamps: one Points draw */
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gx = gc.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gg.addColorStop(0, 'rgba(255,240,200,1)'); gg.addColorStop(0.25, 'rgba(255,208,130,.5)'); gg.addColorStop(1, 'rgba(255,200,120,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);
  const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute(ex.glows.flat(), 3));
  const points = new THREE.Points(gp, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(gc), size: 520, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc678, fog: false }));
  points.frustumCulled = false; scene.add(points);
  return { points };
}

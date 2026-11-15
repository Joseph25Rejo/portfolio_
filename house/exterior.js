/* The outside of the house: plinth, porch, canopy, lanterns, a mottled lawn, a cobbled path with kerbs, planting beds,
   boulders, a garden wall and gate, trimmed hedges, trees of three kinds, and lamp posts.
   Like the shell, all of it is baked into the shared vertex-coloured mesh; the only extra draw is one `Points` for glows.
   Ground level outside is y = -60 so the porch sits flush with the hall floor (y = 0). */
import * as THREE from '../vendor/three.module.min.js';
import { addLight, shade, mix, hex, grain, extAmb } from './light.js';
import { D, APO, FRONT } from './layout.js';

const GY = -60, WALL = 30, FW = 2 * APO * Math.tan(9 * D) + 1.5;
const C = hex;
const sinz = (a) => Math.sin(a * D), cosz = (a) => Math.cos(a * D);
const UP = [0, 1, 0], DOWN = [0, -1, 0];
const BG = [20, 27, 51]; /* the colour of the ground disc beyond the lawn (sky.js), so the lawn can melt into it */

/* smooth value noise on the ground plane, for patches in the lawn and for varying the planting */
const fr = (x) => x - Math.floor(x);
const h2 = (x, z) => fr(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
const vn = (x, z, s) => {
  x /= s; z /= s;
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h2(xi, zi), b = h2(xi + 1, zi), c = h2(xi, zi + 1), d = h2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, z) => vn(x, z, 700) * 0.5 + vn(x, z, 260) * 0.3 + vn(x, z, 90) * 0.2;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* signed angle (degrees) of azimuth a from the front door's azimuth */
const dAz = (a) => ((a - FRONT.az + 540) % 360) - 180;

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
  /* knee-high path lights beyond the lavender: a small warm pool each, no halo */
  const bollards = [];
  [1250, 1390, 1530, 1700, 1840].forEach((rad) => [-178, 178].forEach((lat) => {
    const p = at(lat, -60 + 38, rad); addLight(p, [1, 0.78, 0.5], 0.9, 170); bollards.push(p);
  }));
  return { glows, lamps, bollards, at };
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
  /* a tapered round column (trunks, pine tiers): r0 at y0 narrowing to r1 at y1 */
  const frustum = (cx, cz, y0, y1, r0, r1, sides, col) => {
    const P = (f, y, r) => [cx + r * Math.sin(f), y, cz + r * Math.cos(f)];
    for (let i = 0; i < sides; i++) {
      const f0 = 2 * Math.PI * i / sides, f1 = 2 * Math.PI * (i + 1) / sides, fm = (f0 + f1) / 2;
      B.quad(P(f0, y0, r0), P(f1, y0, r0), P(f1, y1, r1), P(f0, y1, r1), col, 1, 2, [Math.sin(fm), (r0 - r1) / (y1 - y0), Math.cos(fm)]);
    }
  };
  const polarPt = (a, r, y) => [r * sinz(a), y, r * cosz(a)];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* plinth under the whole tower: damp, mossy at the foot, with a footing and a drip ledge (left off the porch facets) */
  const plinth = (p, n, s, t) => {
    const moss = Math.max(0, 1 - t / 0.45) * (0.3 + 0.7 * vn(p[0] + p[2], p[1] * 3, 45)), a = mix(C('#5B554A'), C('#3F5A36'), moss * 0.85), k = grain(p, 0.1);
    return shade([a[0] * k, a[1] * k, a[2] * k], p, n, extAmb(n));
  };
  const ledge = ext(C('#6E675A'), 0.12);
  for (let m = 0; m < 20; m++) {
    const a = m * 18, f = (l, y, r) => fp(a, l, y, r);
    B.quad(f(FW / 2, GY, APO + WALL + 6), f(-FW / 2, GY, APO + WALL + 6), f(-FW / 2, 0, APO + WALL + 6), f(FW / 2, 0, APO + WALL + 6), plinth, 3, 5, [sinz(a), 0, cosz(a)]);
    if (Math.abs(dAz(a)) > 20) {
      slab(a, -FW / 2, FW / 2, -8, 0, APO + WALL + 2, APO + WALL + 14, ledge, 'otb');
      slab(a, -FW / 2, FW / 2, GY, GY + 18, APO + WALL + 2, APO + WALL + 12, ledge, 'ot');
    }
  }
  /* drainpipes down the two wall joints flanking the front */
  [az - 27, az + 27].forEach((a) => slab(a, -4, 4, 0, 880, APO + WALL + 6, APO + WALL + 14, ext(C('#34343a'), 0.05), 'oitlr'));

  /* porch: platform flush with the hall floor, two steps down, canopy on two posts */
  const stone = ext(C('#8F8774')), warm = ext(C('#9A8C6E'));
  const R0 = APO + WALL;
  slab(az, -165, 165, GY, 0, R0, R0 + 150, stone, 'oitlr');
  slab(az, -165, 165, -40, -20, R0 + 150, R0 + 210, stone, 'oitlr'); slab(az, -165, 165, GY, -40, R0 + 150, R0 + 210, stone, 'o');
  slab(az, -165, 165, GY, -20, R0 + 210, R0 + 270, stone, 'otlr'); slab(az, -165, 165, GY, -40, R0 + 210, R0 + 270, stone, 'o');
  slab(az, -140, 140, 345, 360, R0, R0 + 160, ext(C('#5A4A32')), 'otbolr');
  [-134, 134].forEach((l) => slab(az, l - 6, l + 6, 0, 345, R0 + 148, R0 + 160, ext(C('#6A5638')), 'oitlr'));
  /* wall lanterns beside the door: iron frame, glass, capped roof (the halo is added later) */
  const iron = ext(C('#2b2a2c'), 0.04), glass = () => [255, 226, 160], rail = ext(C('#6A5638'), 0.1);
  [-112, 112].forEach((l) => {
    slab(az, l - 9, l + 9, 214, 222, R0, R0 + 20, iron, 'otlr');
    slab(az, l - 6, l + 6, 222, 256, R0 + 4, R0 + 16, glass, 'oitlr');
    [-7, 7].forEach((o) => slab(az, l + o - 1.5, l + o + 1.5, 222, 256, R0 + 14, R0 + 18, iron, 'oitlr'));
    slab(az, l - 9, l + 9, 256, 262, R0, R0 + 20, iron, 'oitlr');
    slab(az, l - 6, l + 6, 262, 270, R0 + 4, R0 + 16, iron, 'oitlr');
    slab(az, l - 2, l + 2, 270, 277, R0 + 8, R0 + 12, iron, 'oitlr');
  });
  /* a brass nameplate by the door */
  slab(az, 84, 102, 150, 168, R0, R0 + 3, ext(C('#B28F4E'), 0.04), 'oitlr');
  /* porch balustrade along both outer edges: rails and balusters (the front stays open at the steps) */
  [-1, 1].forEach((sd) => {
    const l = sd * 158;
    slab(az, l - 5, l + 5, 74, 82, R0 + 20, R0 + 146, rail, 'oitlr');
    slab(az, l - 4, l + 4, 6, 12, R0 + 20, R0 + 146, rail, 'oitlr');
    for (let rr = R0 + 28; rr < R0 + 144; rr += 16) slab(az, l - 2.5, l + 2.5, 12, 74, rr - 2.5, rr + 2.5, rail, 'oitlr');
  });
  /* column bases and capitals on the canopy posts */
  [-134, 134].forEach((l) => {
    slab(az, l - 11, l + 11, 0, 16, R0 + 143, R0 + 165, stone, 'oitlr');
    slab(az, l - 10, l + 10, 330, 345, R0 + 144, R0 + 164, stone, 'oitlr');
  });
  /* doormat */
  slab(az, -52, 52, 0, 2.5, R0 + 70, R0 + 120, ext(C('#4a2f26'), 0.2), 'otlr');
  slab(az, -44, 44, 2.5, 3.2, R0 + 78, R0 + 112, ext(C('#6b4a38'), 0.2), 't');

  /* ---------- the lawn: patchy greens, soft mowing stripes by the house, and a slow fade into the dark ground ---------- */
  const lawn = (p, n) => {
    const x = p[0], z = p[2], rr = Math.hypot(x, z), f = fbm(x, z);
    let a = mix(C('#24472f'), C('#386443'), f);
    a = mix(a, C('#55602f'), sstep(0.6, 0.85, vn(x + 400, z - 300, 230)) * 0.5); /* dry, yellowing patches */
    a = mix(a, C('#1a3024'), sstep(0.65, 0.9, vn(x - 900, z + 120, 380)) * 0.5); /* damp shade */
    const l = -x * cosz(az) + z * sinz(az), k = (1 + 0.06 * Math.sin(l * Math.PI / 140) * (1 - sstep(900, 1700, rr))) * grain(p, 0.12);
    return mix(shade([a[0] * k, a[1] * k, a[2] * k], p, n, extAmb(n)), BG, sstep(1700, 2650, rr));
  };
  { /* one call, so every ring shares a cell count and the seams meet exactly */
    const ra = R0 + 6, rb = 2700, cell = 230, nr = Math.ceil((rb - ra) / cell), na = Math.ceil(2 * Math.PI * rb / cell);
    for (let ri = 0; ri < nr; ri++) for (let i = 0; i < na; i++) {
      const r0 = ra + (rb - ra) * ri / nr, r1 = ra + (rb - ra) * (ri + 1) / nr, p0 = 360 * i / na, p1 = 360 * (i + 1) / na;
      B.quad(polarPt(p0, r0, GY + 0.2), polarPt(p1, r0, GY + 0.2), polarPt(p1, r1, GY + 0.2), polarPt(p0, r1, GY + 0.2), lawn, 4, 4, UP);
    }
  }

  /* ---------- the path: dark mortar underneath, pillowy cobbles in staggered rows, kerb stones along both edges ---------- */
  const PS = R0 + 270, PE = PS + 2200;
  const pw = (r) => 128 + 40 * (1 - sstep(PS, PS + 330, r)); /* half-width: it opens out a little at the steps */
  const cobble = (alb) => (p, n, s, t) => {
    const e = Math.max(Math.abs(s - 0.5), Math.abs(t - 0.5)) * 2, k = (1 - 0.32 * e * e) * grain(p, 0.08);
    return shade([alb[0] * k, alb[1] * k, alb[2] * k], p, n, extAmb(n));
  };
  const cobCols = ['#6C6678', '#7B7585', '#847D8E', '#756B73', '#6B6A76', '#7F7466'].map(C);
  for (let r = PS, row = 0; r < PE; row++) {
    const r1 = r + 22 + rnd() * 10, w = pw((r + r1) / 2);
    B.quad(fp(az, -w - 3, GY + 1.5, r), fp(az, w + 3, GY + 1.5, r), fp(az, w + 3, GY + 1.5, r1), fp(az, -w - 3, GY + 1.5, r1), ext(C('#25221f'), 0.1), 1, 1, UP);
    const n = Math.max(4, Math.round(2 * w / 30)), cw = 2 * w / n, off = (row % 2) * 0.5;
    for (let j = -1; j <= n; j++) {
      const l0 = Math.max(-w, -w + (j + off) * cw), l1 = Math.min(w, -w + (j + off + 1) * cw);
      if (l1 - l0 < 7) continue;
      const g = 2.2, e = () => (rnd() - 0.5) * 2.4, y = GY + 3;
      B.quad(fp(az, l0 + g + e(), y, r + g), fp(az, l1 - g + e(), y, r + g), fp(az, l1 - g + e(), y, r1 - g), fp(az, l0 + g + e(), y, r1 - g), cobble(cobCols[Math.floor(rnd() * cobCols.length)]), 2, 2, UP);
    }
    if (row % 3 === 0) [-1, 1].forEach((sd) => slab(az, sd < 0 ? -w - 13 : w + 2, sd < 0 ? -w - 2 : w + 13, GY, GY + 9, r + 1, r + 80, ext(mix(C('#7E786B'), C('#948C7A'), rnd()), 0.14), 'tlr'));
    r = r1;
  }

  /* ---------- foundation bed: a raised ring of soil round the tower, with a stone lip, shrubs and flowers; open at the porch ---------- */
  const soil = ext(C('#2d2218'), 0.2), lip = ext(C('#7B7567'), 0.16);
  for (let a = 0; a < 360; a += 3) {
    if (Math.abs(dAz(a + 1.5)) < 16) continue;
    const mid = [sinz(a + 1.5), 0, cosz(a + 1.5)];
    B.quad(polarPt(a, R0 + 4, GY + 7), polarPt(a + 3, R0 + 4, GY + 7), polarPt(a + 3, 774, GY + 7), polarPt(a, 774, GY + 7), soil, 2, 2, UP);
    B.quad(polarPt(a, 774, GY + 11), polarPt(a + 3, 774, GY + 11), polarPt(a + 3, 784, GY + 11), polarPt(a, 784, GY + 11), lip, 1, 1, UP);
    B.quad(polarPt(a, 784, GY), polarPt(a + 3, 784, GY), polarPt(a + 3, 784, GY + 11), polarPt(a, 784, GY + 11), lip, 1, 2, mid);
  }
  const greens = ['#1f3d2a', '#27492f', '#2f5636', '#1b3524'].map(C), blooms = ['#E58BB0', '#F2D36B', '#EDE8E0', '#A58BD6', '#E8826B'].map(C);
  for (let a = 4; a < 360; a += 5 + rnd() * 3) {
    if (Math.abs(dAz(a)) < 20) continue;
    const big = rnd() < 0.3;
    for (let k = 0, nb = big ? 1 : 2 + (rnd() < 0.5 ? 1 : 0); k < nb; k++) {
      const aa = a + (rnd() - 0.5) * 2.4, rr = 722 + rnd() * 34, q = polarPt(aa, rr, 0), s = big ? 1.5 : 1;
      const rx = (24 + rnd() * 16) * s;
      blob(q[0], GY + 7 + rx * 0.7, q[2], rx, rx * (0.8 + rnd() * 0.3), rx, 8, 5, ext(greens[Math.floor(rnd() * greens.length)], 0.18));
    }
    const fc = blooms[Math.floor(rnd() * blooms.length)];
    for (let k = 0, nf = 4 + Math.floor(rnd() * 3); k < nf; k++) {
      const aa = a + 3 + (rnd() - 0.5) * 3, rr = 735 + rnd() * 34, q = polarPt(aa, rr, 0);
      blob(q[0], GY + 11, q[2], 6, 5, 6, 5, 3, ext(rnd() < 0.8 ? fc : blooms[Math.floor(rnd() * blooms.length)], 0.1));
    }
  }

  /* terracotta pots at the top of the steps, and a mailbox out by the gate */
  [-125, 125].forEach((l) => {
    const q = fp(az, l, 0, R0 + 118);
    frustum(q[0], q[2], 0, 34, 13, 19, 8, ext(C('#9B5B3A'), 0.12));
    blob(q[0], 50, q[2], 24, 21, 24, 8, 5, ext(greens[1], 0.18));
    for (let k = 0; k < 5; k++) { const f = k * 72 * D; blob(q[0] + 15 * Math.sin(f), 66 + (k % 2) * 5, q[2] + 15 * Math.cos(f), 6, 5, 6, 5, 3, ext(blooms[k % blooms.length], 0.1)); }
  });
  slab(az, 203, 209, GY, GY + 75, 1197, 1203, iron, 'oitlr');
  slab(az, 192, 220, GY + 75, GY + 93, 1188, 1212, ext(C('#8A2F27'), 0.1), 'oitlr');
  slab(az, 220, 222, GY + 86, GY + 104, 1190, 1193, ext(C('#D9B24A'), 0.05), 'oitlr');

  /* ---------- the garden wall, gate pillars and the hedge ring ---------- */
  const GR = 1150, wallStone = ext(C('#7C766B'), 0.22), capStone = ext(C('#948D7E'), 0.14);
  [-1, 1].forEach((sd) => {
    for (let d = 9; d < 27; d += 3) {
      const a0 = az + sd * d, a1 = az + sd * (d + 3), mid = [sinz((a0 + a1) / 2), 0, cosz((a0 + a1) / 2)], inn = mid.map((v) => -v);
      B.quad(polarPt(a0, GR + 10, GY), polarPt(a1, GR + 10, GY), polarPt(a1, GR + 10, GY + 56), polarPt(a0, GR + 10, GY + 56), wallStone, 3, 3, mid);
      B.quad(polarPt(a0, GR - 10, GY), polarPt(a1, GR - 10, GY), polarPt(a1, GR - 10, GY + 56), polarPt(a0, GR - 10, GY + 56), wallStone, 3, 3, inn);
      B.quad(polarPt(a0, GR - 14, GY + 62), polarPt(a1, GR - 14, GY + 62), polarPt(a1, GR + 14, GY + 62), polarPt(a0, GR + 14, GY + 62), capStone, 1, 2, UP);
      B.quad(polarPt(a0, GR + 14, GY + 56), polarPt(a1, GR + 14, GY + 56), polarPt(a1, GR + 14, GY + 62), polarPt(a0, GR + 14, GY + 62), capStone, 1, 1, mid);
      B.quad(polarPt(a0, GR - 14, GY + 56), polarPt(a1, GR - 14, GY + 56), polarPt(a1, GR - 14, GY + 62), polarPt(a0, GR - 14, GY + 62), capStone, 1, 1, inn);
    }
    const l = sd * 160;
    slab(az, l - 16, l + 16, GY, GY + 165, GR - 16, GR + 16, wallStone, 'oitlr');
    slab(az, l - 22, l + 22, GY + 165, GY + 178, GR - 22, GR + 22, capStone, 'oitlr');
    slab(az, l - 12, l + 12, GY + 178, GY + 190, GR - 12, GR + 12, capStone, 'oitlr');
    const q = fp(az, l, 0, GR); blob(q[0], GY + 208, q[2], 17, 19, 17, 8, 5, capStone);
  });
  for (let a = 0; a < 360; a += 1.7) {
    if (Math.abs(dAz(a)) < 28) continue;
    const h = 62 + 38 * h2(Math.floor(a / 9), 3.7), rr = GR + (rnd() - 0.5) * 5, q = polarPt(a, rr, 0);
    blob(q[0], GY + h * 0.5, q[2], 31, h * 0.56, 31, 7, 4, ext(mix(C('#1c3727'), C('#2b5236'), vn(q[0], q[2], 160)), 0.16));
  }

  /* ---------- low planting along the path: lavender beyond the gate, boxwood balls inside it ---------- */
  [-1, 1].forEach((sd) => {
    for (let r = 1215; r < 1960; r += 44 + rnd() * 6) {
      if (Math.abs(r - 1600) < 34) continue;
      const q = fp(az, sd * 153, 0, r);
      blob(q[0], GY + 11, q[2], 14, 11, 14, 7, 4, ext(mix(C('#5C4F96'), C('#8C78BE'), rnd()), 0.16));
    }
    [1060, 1095].forEach((r) => { const q = fp(az, sd * 158, 0, r); blob(q[0], GY + 24, q[2], 23, 22, 23, 8, 5, ext(C('#2a5035'), 0.16)); });
  });

  /* ---------- boulders on the lawn ---------- */
  for (let k = 0; k < 9; k++) {
    const a = rnd() * 360; if (Math.abs(dAz(a)) < 14) continue;
    const r = 860 + rnd() * 240, q = polarPt(a, r, 0), rx = 20 + rnd() * 24;
    blob(q[0], GY + rx * 0.3, q[2], rx, rx * 0.55, rx * (0.8 + rnd() * 0.3), 7, 4, ext(mix(C('#5F626C'), C('#7B7D85'), rnd()), 0.2));
  }

  /* ---------- trees: round, pine and poplar, scattered beyond the hedge ---------- */
  const bark = ext(C('#3A2B1F'), 0.12);
  const leaf = (t) => ext(mix(C('#18301f'), C('#2c5a38'), t), 0.18);
  const tree = (a, r, kind, s) => {
    const x = r * sinz(a), z = r * cosz(a);
    if (kind === 0) {
      frustum(x, z, GY, GY + 270 * s, 19 * s, 10 * s, 6, bark);
      const y0 = GY + 360 * s;
      for (let k = 0; k < 5; k++) {
        const f = (k * 72 + rnd() * 40) * D, o = (80 + rnd() * 20) * s;
        blob(x + o * Math.sin(f), y0 + (rnd() - 0.4) * 80 * s, z + o * Math.cos(f), (92 + rnd() * 24) * s, (80 + rnd() * 24) * s, (92 + rnd() * 24) * s, 9, 6, leaf(rnd()));
      }
      blob(x, y0 + 100 * s, z, 105 * s, 90 * s, 105 * s, 9, 6, leaf(0.75 + rnd() * 0.25));
    } else if (kind === 1) {
      frustum(x, z, GY, GY + 130 * s, 13 * s, 9 * s, 6, bark);
      for (let i = 0; i < 5; i++) frustum(x, z, GY + (70 + i * 95) * s, GY + (70 + i * 95 + 150) * s, (160 - i * 28) * s, 6 * s, 9, leaf(i / 5 * 0.7));
    } else {
      frustum(x, z, GY, GY + 170 * s, 14 * s, 9 * s, 6, bark);
      for (let i = 0; i < 4; i++) blob(x + (rnd() - 0.5) * 16, GY + (270 + i * 125) * s, z + (rnd() - 0.5) * 16, (66 - i * 8) * s, 118 * s, (66 - i * 8) * s, 8, 6, leaf(0.2 + rnd() * 0.6));
    }
  };
  for (let k = 0; k < 20; k++) {
    const a = k * 18 + (rnd() - 0.5) * 12; if (Math.abs(dAz(a)) < 8) continue;
    const kind = rnd(), r = 1900 + rnd() * 800;
    tree(a, r, kind < 0.45 ? 0 : kind < 0.78 ? 1 : 2, 0.8 + rnd() * 0.55);
  }

  /* lamp posts: dark iron, bright lamp head */
  ex.lamps.forEach((p) => {
    const [x, y, z] = p, fe = ext(C('#25262A'), 0.05), bx = (r, y0, y1) => wbox(x - r, x + r, y0, y1, z - r, z + r, fe);
    bx(14, GY, GY + 22); bx(9, GY + 22, GY + 46); bx(4, GY + 46, y + 20); /* flared foot, then the shaft */
    bx(7, GY + 110, GY + 118); bx(7, y - 52, y - 44); /* collars */
    bx(15, y - 30, y - 22); /* lamp tray */
    wbox(x - 11, x + 11, y - 22, y + 26, z - 11, z + 11, () => [255, 232, 176]);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => wbox(x + a * 12 - 2, x + a * 12 + 2, y - 24, y + 28, z + b * 12 - 2, z + b * 12 + 2, fe));
    bx(19, y + 28, y + 34); bx(12, y + 34, y + 41); bx(5, y + 41, y + 48);
    blob(x, y + 54, z, 5, 6, 5, 6, 4, fe);
  });
  /* path bollards: a post and a small lit head */
  ex.bollards.forEach((p) => {
    wbox(p[0] - 3, p[0] + 3, GY, p[1] - 8, p[2] - 3, p[2] + 3, ext(C('#25262A'), 0.05));
    wbox(p[0] - 7, p[0] + 7, p[1] - 8, p[1] + 6, p[2] - 7, p[2] + 7, () => [255, 226, 160]);
    wbox(p[0] - 9, p[0] + 9, p[1] + 6, p[1] + 11, p[2] - 9, p[2] + 9, ext(C('#25262A'), 0.05));
  });

  /* glows for lanterns and lamps: one Points draw */
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gx = gc.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gg.addColorStop(0, 'rgba(255,240,200,1)'); gg.addColorStop(0.25, 'rgba(255,208,130,.5)'); gg.addColorStop(1, 'rgba(255,200,120,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);
  const gp = new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.Float32BufferAttribute(ex.glows.flat(), 3));
  const points = new THREE.Points(gp, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(gc), size: 520, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc678, fog: false }));
  points.frustumCulled = false; scene.add(points);
  return { points };
}

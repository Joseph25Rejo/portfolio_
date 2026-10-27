/* The house shell: tower walls inside and out, floors, landings, ceiling, roof, the spiral stair, doors, sconces and plaques.
   All static surfaces are baked (shape + light) into a single vertex-coloured mesh, and repeated things are instanced,
   so the whole house is about a dozen draw calls. World units are the old CSS px; y is up; az in degrees. */
import * as THREE from '../vendor/three.module.min.js';
import { Builder } from './builder.js';
import { addLight, shade, mix, hex, grain, INT, extAmb } from './light.js';
import { D, RISE, FH, NS, DTH, RI, RO, APO, NF, TOP, DOOR, DOORS, FRONT, HEARTH, FLOORS } from './layout.js';

const FW = 2 * APO * Math.tan(9 * D) + 1.5, WT = 2860, WALL = 30, RR = 254;
const sinz = (az) => Math.sin(az * D), cosz = (az) => Math.cos(az * D);
/* a point on the wall frame of facet `az`: lat runs to the right as seen from inside, rad is distance from the axis */
const fp = (az, lat, y, rad) => [rad * sinz(az) - lat * cosz(az), y, rad * cosz(az) + lat * sinz(az)];
const outN = (az) => [sinz(az), 0, cosz(az)];
const inN = (az) => [-sinz(az), 0, -cosz(az)];
const UP = [0, 1, 0], DOWN = [0, -1, 0];

const C = (h) => hex(h);
const sunF = (az) => 0.5 + 0.5 * Math.cos((az - 265) * D);
const wallAt = (az, y) => {
  const base = mix(C('#A89D86'), C('#DBD0B8'), Math.pow(sunF(az), 0.9)), v = y / TOP;
  return mix(mix(base, C('#6B5F4C'), 0.5 * (1 - v) * (1 - v)), C('#E8DEC6'), 0.16 * v);
};
const azOf = (p) => Math.atan2(p[0], p[2]) / D;
const lit = (alb, o) => (p, n) => shade([alb[0], alb[1], alb[2]].map((v) => v * grain(p, 0.05)), p, n, o || INT);

export function buildShell(scene) {
  const t0 = performance.now();
  /* ---------- lights, placed first so every surface bakes them in ---------- */
  const sconces = [];
  for (let k = 0; k < NF; k++) {
    const az = k % 2 ? 180 : 0;
    [-18, 18].forEach((o) => { sconces.push({ az: az + o, y: FH * k + 335 }); addLight(fp(az + o, 0, FH * k + 335, APO - 40), [1, 0.82, 0.55], 1.25, 430); });
  }
  DOORS.forEach((d) => addLight(fp(d.az, 0, d.base + 90, APO - 150), [1, 0.78, 0.48], 0.55, 420));
  addLight(fp(HEARTH.az, 0, 95, APO - 120), [1, 0.55, 0.22], 0.95, 760);

  const B = new Builder();
  const ext = (alb) => (p, n) => shade([alb[0] * grain(p, 0.08), alb[1] * grain(p, 0.08), alb[2] * grain(p, 0.08)], p, n, extAmb(n));
  const glowCol = (p) => [255, 230, 190];

  /* a flat rectangle on facet az, between lat0..lat1 and y0..y1, at radius rad, facing `dir` (+1 out, -1 in) */
  const sheet = (az, l0, l1, y0, y1, rad, dir, col, nu, nv) => {
    const a = fp(az, l0, y0, rad), b = fp(az, l1, y0, rad), c = fp(az, l1, y1, rad), d = fp(az, l0, y1, rad);
    B.quad(a, b, c, d, col, nu, nv, dir > 0 ? outN(az) : inN(az));
  };
  /* a box on the facet frame; faces: o out, i in, t top, b bottom, l/r sides */
  const slab = (az, l0, l1, y0, y1, r0, r1, col, faces) => {
    faces = faces || 'oitblr';
    const f = (lat, y, r) => fp(az, lat, y, r), s = (a, b, c, d, h) => B.quad(a, b, c, d, col, 1, 1, h);
    if (faces.includes('o')) s(f(l0, y0, r1), f(l1, y0, r1), f(l1, y1, r1), f(l0, y1, r1), outN(az));
    if (faces.includes('i')) s(f(l0, y0, r0), f(l1, y0, r0), f(l1, y1, r0), f(l0, y1, r0), inN(az));
    if (faces.includes('t')) s(f(l0, y1, r0), f(l1, y1, r0), f(l1, y1, r1), f(l0, y1, r1), UP);
    if (faces.includes('b')) s(f(l0, y0, r0), f(l1, y0, r0), f(l1, y0, r1), f(l0, y0, r1), DOWN);
    const rt = [-cosz(az), 0, sinz(az)];
    if (faces.includes('l')) s(f(l0, y0, r0), f(l0, y0, r1), f(l0, y1, r1), f(l0, y1, r0), [-rt[0], 0, -rt[2]]);
    if (faces.includes('r')) s(f(l1, y0, r0), f(l1, y0, r1), f(l1, y1, r1), f(l1, y1, r0), rt);
  };

  /* ---------- walls: 20 facets of 18 degrees ---------- */
  const WIN = [72, 90, 108, 252, 270], OAK = [36, 324, 144, 216];
  const WARM = C('#D8B97E'), TRIM = C('#BFA37A');
  for (let m = 0; m < 20; m++) {
    const az = m * 18;
    let ops = [];
    if (az === 0 || az === 180) ops = DOORS.filter((d) => d.az === az).map((d) => ({ l: 75, y0: d.base, y1: d.base + DOOR.h, door: d }));
    else if (az === FRONT.az) ops = [{ l: 75, y0: 0, y1: DOOR.h, front: true }];
    else if (WIN.includes(az)) ops = [{ l: FW / 2 - 10, y0: 70, y1: WT, win: true }];
    const oak = OAK.includes(az);
    const inCol = (y0) => oak
      ? lit(mix(C('#B59A72'), C('#8E7556'), Math.min(1, y0 / TOP)))
      : (p, n) => shade(wallAt(az, p[1]).map((v) => v * grain(p, 0.05)), p, n, INT);
    const exCol = ext(C('#8B8272'));
    const piece = (l0, l1, y0, y1) => {
      if (y1 - y0 < 0.5 || l1 - l0 < 0.5) return;
      sheet(az, l0, l1, y0, y1, APO, -1, inCol(y0), Math.max(1, Math.ceil((l1 - l0) / 75)), Math.max(1, Math.ceil((y1 - y0) / 110)));
      sheet(az, l0, l1, y0, y1, APO + WALL, 1, exCol, 1, Math.max(1, Math.ceil((y1 - y0) / 500)));
    };
    if (!ops.length) piece(-FW / 2, FW / 2, 0, TOP);
    else {
      const L = ops[0].l;
      piece(-FW / 2, -L, 0, TOP); piece(L, FW / 2, 0, TOP);
      let prev = 0;
      ops.sort((a, b) => a.y0 - b.y0).forEach((o) => { piece(-L, L, prev, o.y0); prev = o.y1; });
      piece(-L, L, prev, TOP);
      ops.forEach((o) => {
        /* the thickness of the wall at the opening: sill, head and both jambs */
        const rv = lit(TRIM);
        slab(az, -L, L, o.y0 - 0.01, o.y0, APO, APO + WALL, rv, 't');
        slab(az, -L, L, o.y1, o.y1 + 0.01, APO, APO + WALL, rv, 'b');
        slab(az, -L - 0.01, -L, o.y0, o.y1, APO, APO + WALL, rv, 'r');
        slab(az, L, L + 0.01, o.y0, o.y1, APO, APO + WALL, rv, 'l');
        if (o.door) {
          /* the recess: the lit room beyond the door */
          const R2 = 70, y0 = o.y0, y1 = o.y1, warm = (p, n, s, t) => mix(C('#A9793A'), C('#FFF4DC'), Math.max(0, 1 - Math.hypot((s - 0.5) * 1.6, (t - 0.22) * 1.1)));
          const back = [fp(az, -L, y0, APO + R2), fp(az, L, y0, APO + R2), fp(az, L, y1, APO + R2), fp(az, -L, y1, APO + R2)];
          B.quad(back[0], back[1], back[2], back[3], warm, 4, 6, inN(az));
          const edge = (p, n, s, t) => mix(C('#E9DFCB'), C('#C79B55'), t);
          [[-L, [-1, 0, 0]], [L, [1, 0, 0]]].forEach((q) => B.quad(fp(az, q[0], y0, APO), fp(az, q[0], y0, APO + R2), fp(az, q[0], y1, APO + R2), fp(az, q[0], y1, APO), edge, 1, 1, [-q[1][0] * -cosz(az) * -1, 0, -q[1][0] * sinz(az)]));
          B.quad(fp(az, -L, y1, APO), fp(az, L, y1, APO), fp(az, L, y1, APO + R2), fp(az, -L, y1, APO + R2), (p, n, s, t) => mix(C('#D8CDB8'), C('#E9D0A2'), t), 1, 1, DOWN);
          B.quad(fp(az, -L, y0, APO), fp(az, L, y0, APO), fp(az, L, y0, APO + R2), fp(az, -L, y0, APO + R2), (p, n, s, t) => mix(C('#E8D4AA'), C('#BF9156'), t), 2, 2, UP);
          /* architrave */
          const ar = lit(C('#C2A57A'));
          slab(az, -L - 12, -L, y0, y1 + 12, APO - 8, APO, ar, 'oltr'); slab(az, L, L + 12, y0, y1 + 12, APO - 8, APO, ar, 'oltr'); slab(az, -L - 12, L + 12, y1, y1 + 12, APO - 8, APO, ar, 'oltb');
        }
        if (o.front) { const ar = lit(C('#8A6A44')); slab(az, -L - 12, -L, 0, o.y1 + 12, APO - 8, APO, ar, 'oltr'); slab(az, L, L + 12, 0, o.y1 + 12, APO - 8, APO, ar, 'oltr'); slab(az, -L - 12, L + 12, o.y1, o.y1 + 12, APO - 8, APO, ar, 'oltb'); }
        if (o.win) {
          const fr = lit(C('#7A6444'));
          slab(az, -3.5, 3.5, o.y0, o.y1, APO - 9, APO - 2, fr, 'oltr');
          for (let q = 1; q <= 6; q++) slab(az, -L, L, FH * q - 4.5, FH * q + 4.5, APO - 9, APO - 2, fr, 'otb');
        }
      });
    }
    /* string courses round the outside */
    for (let q = 1; q <= NF; q++) slab(az, -FW / 2, FW / 2, FH * q - 9, FH * q + 9, APO + WALL, APO + WALL + 8, ext(C('#A39A87')), 'otb');
  }

  /* ---------- floors: coffee tile in polar cells ---------- */
  const tile = (ra, rb, azA, azB, y, up) => {
    /* every row shares one cell count, so the edges between rows meet exactly (no cracks) */
    const nr = Math.max(1, Math.ceil((rb - ra) / 130)), na = Math.max(1, Math.ceil((azB - azA) * D * rb / 130));
    for (let ri = 0; ri < nr; ri++) {
      const r0 = ra + (rb - ra) * ri / nr, r1 = ra + (rb - ra) * (ri + 1) / nr;
      for (let i = 0; i < na; i++) {
        const a0 = azA + (azB - azA) * i / na, a1 = azA + (azB - azA) * (i + 1) / na, alb = C((ri + i) % 2 ? '#5A3C2A' : '#4A3022');
        const P = (az, r) => [r * sinz(az), y, r * cosz(az)];
        B.quad(P(a0, r0), P(a1, r0), P(a1, r1), P(a0, r1), lit(alb), 2, 2, up ? UP : DOWN);
      }
    }
  };
  tile(0, APO + 8, 0, 360, 0, true);
  /* brass ring inlaid round the stair well */
  { const P = (az, r) => [r * sinz(az), 0.6, r * cosz(az)]; for (let i = 0; i < 72; i++) B.quad(P(i * 5, RI - 4), P(i * 5 + 5, RI - 4), P(i * 5 + 5, RI + 4), P(i * 5, RI + 4), () => [214, 176, 98], 1, 1, UP); }
  /* landings 1..6, each a slab: tiled top, soffit below */
  for (let k = 1; k < NF; k++) {
    const y = FH * k, az = 180 * k, a0 = az - 10, a1 = az + 10;
    tile(RI, APO + 8, a0, a1, y, true);
    tile(RI, APO + 8, a0, a1, y - 30, false);
    const P = (a, r, yy) => [r * sinz(a), yy, r * cosz(a)];
    B.quad(P(a0, RI, y - 30), P(a1, RI, y - 30), P(a1, RI, y), P(a0, RI, y), lit(C('#4A3123')), 2, 1, inN(az));
    B.quad(P(a0, RI, y - 30), P(a0, APO + 8, y - 30), P(a0, APO + 8, y), P(a0, RI, y), lit(C('#4A3123')), 1, 1, [-cosz(a0) * -1, 0, sinz(a0) * 1]);
    B.quad(P(a1, RI, y - 30), P(a1, APO + 8, y - 30), P(a1, APO + 8, y), P(a1, RI, y), lit(C('#4A3123')), 1, 1, [cosz(a1), 0, -sinz(a1)]);
  }

  /* ---------- ceiling, ribs, skylight lantern and roof ---------- */
  { const P = (az, r) => [r * sinz(az), TOP, r * cosz(az)]; for (let i = 0; i < 40; i++) for (let j = 0; j < 3; j++) { const r0 = 400 + j * 88, r1 = r0 + 88; B.quad(P(i * 9, r0), P(i * 9 + 9, r0), P(i * 9 + 9, r1), P(i * 9, r1), lit(C('#CDBFA2')), 1, 1, DOWN); } }
  for (let i = 0; i < 6; i++) slab(i * 30, -6, 6, TOP - 14, TOP, 0, APO, lit(C('#7A6238')), 'bltr');
  const roofC = ext(C('#5E5748'));
  { const P = (az, r, y) => [r * sinz(az), y, r * cosz(az)]; for (let i = 0; i < 40; i++) {
      B.quad(P(i * 9, 700, TOP), P(i * 9 + 9, 700, TOP), P(i * 9 + 9, 300, TOP + 420), P(i * 9, 300, TOP + 420), roofC, 1, 2, [sinz(i * 9 + 4.5), 0.5, cosz(i * 9 + 4.5)]);
      B.quad(P(i * 9, 300, TOP + 420), P(i * 9 + 9, 300, TOP + 420), P(i * 9 + 9, 300, TOP + 470), P(i * 9, 300, TOP + 470), () => [210, 225, 255], 1, 1, [sinz(i * 9 + 4.5), 0, cosz(i * 9 + 4.5)]);
      B.quad(P(i * 9, 0, TOP + 470), P(i * 9 + 9, 300, TOP + 470), P(i * 9 + 9, 300, TOP + 470), P(i * 9, 0, TOP + 470), () => [190, 210, 250], 1, 1, UP);
    } }

  const shellMesh = new THREE.Mesh(B.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(shellMesh);

  /* ---------- stair: instanced treads, balusters, one swept handrail ---------- */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const NT = (NF - 1) * NS, treads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), NT);
  const bal = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 130, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), NT);
  const col = new THREE.Color(), railPts = [];
  let ti = 0;
  for (let k = 0; k < NF - 1; k++) {
    if (k > 0) [-9, 0, 9].forEach((o) => railPts.push([180 * k + o, FH * k]));
    for (let j = 1; j <= NS; j++) {
      const az = 180 * k + 10 + DTH * (j - 1) + DTH / 2, h = FH * k + RISE * j, ar = az * D;
      q.setFromAxisAngle(yAxis, ar); sc.set(2 * 450 * Math.sin(DTH / 2 * D) * 1.012, 40, 400); ps.set(450 * Math.sin(ar), h - 20, 450 * Math.cos(ar));
      treads.setMatrixAt(ti, m4.compose(ps, q, sc));
      const tv = 0.5 + 0.5 * Math.cos((az - 265) * D), top = mix(C('#4A3123'), C('#6A4A36'), tv), L = shade([top[0] * grain(ps.toArray(), 0.16), top[1] * grain(ps.toArray(), 0.16), top[2] * grain(ps.toArray(), 0.16)], [ps.x, h, ps.z], UP, INT);
      treads.setColorAt(ti, col.setRGB(L[0] / 255, L[1] / 255, L[2] / 255));
      sc.set(1, 1, 1); ps.set(RR * Math.sin(ar), h + 65, RR * Math.cos(ar));
      bal.setMatrixAt(ti, m4.compose(ps, q, sc));
      const Lb = shade([70, 68, 62], ps.toArray(), [Math.sin(ar), 0, Math.cos(ar)], INT); bal.setColorAt(ti, col.setRGB(Lb[0] / 255, Lb[1] / 255, Lb[2] / 255));
      railPts.push([az, h]); ti++;
    }
  }
  scene.add(treads, bal);
  const rail = new THREE.CatmullRomCurve3(railPts.map((r) => new THREE.Vector3(RR * Math.sin(r[0] * D), r[1] + 130, RR * Math.cos(r[0] * D))), false, 'centripetal');
  const tube = new THREE.TubeGeometry(rail, railPts.length * 2, 4, 6, false);
  { const pos = tube.attributes.position, nor = tube.attributes.normal, cc = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const L = shade([201, 163, 90], [pos.getX(i), pos.getY(i), pos.getZ(i)], [nor.getX(i), nor.getY(i), nor.getZ(i)], INT); cc[i * 3] = L[0] / 255; cc[i * 3 + 1] = L[1] / 255; cc[i * 3 + 2] = L[2] / 255; }
    tube.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
  scene.add(new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ vertexColors: true })));

  /* ---------- doors: one instanced leaf mesh; instance k (0..6) is room door k, instance 7 the front door ---------- */
  const LB = new Builder(), wood = (a, b) => (p, n, s) => (Math.floor(s * 18) % 2 ? a : b);
  const lbox = (x0, x1, y0, y1, z0, z1, f, faces) => {
    const P = (x, y, z) => [x, y, z];
    if (faces.includes('f')) LB.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), f, 18, 1, [0, 0, 1]);
    if (faces.includes('b')) LB.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), f, 1, 1, [0, 0, -1]);
    if (faces.includes('e')) LB.quad(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), f, 1, 1, [1, 0, 0]);
    if (faces.includes('s')) LB.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), f, 1, 1, [-1, 0, 0]);
    if (faces.includes('t')) LB.quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), f, 1, 1, [0, 1, 0]);
  };
  const w1 = wood(C('#D3BE98').map((v) => v), C('#DCC9A4'));
  const wf = (p, n, s) => (Math.floor(s * 18) % 2 ? [211, 190, 152] : [220, 201, 164]);
  lbox(0, 150, 0, 300, -4, 4, wf, 'fbest');
  lbox(14, 136, 20, 130, 4, 4.8, () => [196, 172, 132], 'f'); lbox(14, 136, 160, 280, 4, 4.8, () => [196, 172, 132], 'f');
  lbox(112, 132, 132, 152, 4, 11, () => [200, 160, 82], 'fte'); lbox(78, 126, 138, 146, 4, 10, () => [226, 190, 110], 'ft');
  lbox(-1, 6, 30, 64, 3, 6, () => [150, 118, 58], 'f'); lbox(-1, 6, 236, 270, 3, 6, () => [150, 118, 58], 'f');
  const leaf = new THREE.InstancedMesh(LB.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), NF + 1);
  const leaves = DOORS.map((d) => ({ az: d.az, y: d.base, r: APO + 5, tint: [1, 1, 1] })).concat([{ az: FRONT.az, y: 0, r: APO + 5, tint: [0.55, 0.38, 0.28] }]);
  const setLeaf = (i, ang) => {
    const l = leaves[i], az = l.az, right = new THREE.Vector3(-cosz(az), 0, sinz(az)), z = new THREE.Vector3(-sinz(az), 0, -cosz(az));
    const hinge = new THREE.Vector3(...fp(az, 0, l.y, l.r)).addScaledVector(right, -75);
    const M = new THREE.Matrix4().makeBasis(right, new THREE.Vector3(0, 1, 0), z).setPosition(hinge);
    leaf.setMatrixAt(i, M.multiply(new THREE.Matrix4().makeRotationY(ang))); leaf.instanceMatrix.needsUpdate = true;
  };
  leaves.forEach((l, i) => {
    setLeaf(i, 0);
    const Lc = shade([255, 255, 255], fp(l.az, 0, l.y + 150, APO - 20), inN(l.az), INT);
    leaf.setColorAt(i, col.setRGB(Math.min(1.4, Lc[0] / 255 * l.tint[0]), Math.min(1.4, Lc[1] / 255 * l.tint[1]), Math.min(1.4, Lc[2] / 255 * l.tint[2])));
  });
  scene.add(leaf);

  /* ---------- sconces: brass bodies and an additive glow each ---------- */
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 38, 10), new THREE.MeshBasicMaterial({ color: 0xe9cf8a }), sconces.length);
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; const gx = gc.getContext('2d'), gg = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gg.addColorStop(0, 'rgba(255,236,190,1)'); gg.addColorStop(0.3, 'rgba(255,206,130,.45)'); gg.addColorStop(1, 'rgba(255,200,120,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 64, 64);
  const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc678 }), sconces.length);
  sconces.forEach((s, i) => {
    const right = new THREE.Vector3(-cosz(s.az), 0, sinz(s.az)), z = new THREE.Vector3(-sinz(s.az), 0, -cosz(s.az));
    const M = new THREE.Matrix4().makeBasis(right, new THREE.Vector3(0, 1, 0), z);
    body.setMatrixAt(i, M.clone().setPosition(...fp(s.az, 0, s.y, APO - 6)));
    glow.setMatrixAt(i, M.clone().setPosition(...fp(s.az, 0, s.y + 8, APO - 8)));
  });
  scene.add(body, glow);

  /* ---------- plaques over the room doors: one atlas, one draw ---------- */
  const PW = 576, PH = 144, atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 1024;
  const ax = atlas.getContext('2d');
  const drawPlaques = () => {
    ax.clearRect(0, 0, 1024, 1024);
    FLOORS.forEach((f, i) => {
      const y = i * PH, g2 = ax.createLinearGradient(0, y, 0, y + PH); g2.addColorStop(0, '#EEE8DA'); g2.addColorStop(1, '#D8CFBB');
      ax.fillStyle = g2; ax.fillRect(0, y, PW, PH); ax.fillStyle = 'rgba(255,255,255,.7)'; ax.fillRect(0, y, PW, 3);
      ax.textBaseline = 'middle'; ax.font = '600 64px "Cormorant Garamond",Georgia,serif'; ax.fillStyle = '#6E521F'; ax.fillText(f[0], 40, y + PH / 2 + 3);
      ax.font = '500 56px "Cormorant Garamond",Georgia,serif'; ax.fillStyle = '#292925'; ax.fillText(f[1], 140, y + PH / 2 + 3);
    });
  };
  drawPlaques();
  const atex = new THREE.CanvasTexture(atlas); atex.generateMipmaps = true; atex.minFilter = THREE.LinearMipmapLinearFilter; atex.anisotropy = 4;
  const pg = new THREE.BufferGeometry(), pp = [], pu = [], pi = [];
  DOORS.forEach((d, i) => {
    const a = fp(d.az, -72, d.base + 322, APO - 3), b = fp(d.az, 72, d.base + 322, APO - 3), c = fp(d.az, 72, d.base + 358, APO - 3), e = fp(d.az, -72, d.base + 358, APO - 3);
    const u1 = PW / 1024, v0 = 1 - (i * PH + PH) / 1024, v1 = 1 - (i * PH) / 1024, n0 = pp.length / 3;
    pp.push(...a, ...b, ...c, ...e); pu.push(0, v0, u1, v0, u1, v1, 0, v1); pi.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
  });
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2)); pg.setIndex(pi);
  const plaques = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: atex, side: THREE.DoubleSide }));
  scene.add(plaques);
  if (document.fonts && document.fonts.load) document.fonts.load('600 40px "Cormorant Garamond"').then(() => { drawPlaques(); atex.needsUpdate = true; if (api.onChange) api.onChange(); });

  const api = {
    meshes: { shell: shellMesh, treads, bal, leaf, body, glow, plaques },
    tris: B.tris + LB.tris / 1 * (NF + 1) + NT * 12 * 2,
    buildMs: performance.now() - t0,
    onChange: null,
    /* door k (0..6, or 7 for the front door) opens by `ang` radians, away from the viewer */
    setDoorAngle(k, ang) { setLeaf(k, ang); if (api.onChange) api.onChange(); }
  };
  return api;
}

/* The night outside: one painted dome (stars, a far city, rolling hills, a treeline and a few lit cottages on the horizon),
   a moon, a slow drifting cloud layer that passes over the moon, twinkling stars, an occasional shooting star, and fog that
   melts the ground into the horizon. `tick(t, dt)` drives the moving parts; with reduced motion nothing moves. */
import * as THREE from '../vendor/three.module.min.js';

const rng = (sd) => { let x = sd >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const TAU = Math.PI * 2;

export function buildSky(scene, opts) {
  opts = opts || {};
  const reduce = !!opts.reduce;
  const W = 2048, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), r = rng(7), HZ = H / 2;
  const grad = g.createLinearGradient(0, 0, 0, HZ);
  grad.addColorStop(0, '#060a1b'); grad.addColorStop(0.5, '#0f1738'); grad.addColorStop(0.82, '#1d2249'); grad.addColorStop(0.94, '#3a2c4c'); grad.addColorStop(1, '#5a3a48');
  g.fillStyle = grad; g.fillRect(0, 0, W, HZ);
  g.fillStyle = '#10152e'; g.fillRect(0, HZ, W, HZ);
  /* a warm band hugging the horizon, stronger than before */
  const glow = g.createLinearGradient(0, HZ - 150, 0, HZ);
  glow.addColorStop(0, 'rgba(255,150,100,0)'); glow.addColorStop(0.55, 'rgba(255,140,95,.16)'); glow.addColorStop(1, 'rgba(255,172,100,.5)'); g.fillStyle = glow; g.fillRect(0, HZ - 150, W, 150);
  for (let i = 0; i < 700; i++) { const y = Math.pow(r(), 1.4) * (HZ - 40), a = 0.35 + r() * 0.65; g.fillStyle = 'rgba(' + (200 + r() * 55 | 0) + ',' + (210 + r() * 45 | 0) + ',255,' + a.toFixed(2) + ')'; const s = r() < 0.08 ? 2.2 : 1.2; g.fillRect(r() * W, y, s, s); }

  /* rolling hills: sums of whole-number sine waves, so the dome joins up at the seam */
  const hills = (base, a1, a2, col, seed) => {
    const hr = rng(seed), p1 = hr() * TAU, p2 = hr() * TAU, k1 = 3 + (hr() * 3 | 0), k2 = 9 + (hr() * 6 | 0);
    const top = (x) => HZ - (base + a1 * Math.sin(x / W * TAU * k1 + p1) + a2 * Math.sin(x / W * TAU * k2 + p2));
    g.fillStyle = col; g.beginPath(); g.moveTo(0, HZ + 2);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, top(x));
    g.lineTo(W, HZ + 2); g.closePath(); g.fill();
    return top;
  };
  hills(16, 9, 4, '#101733', 21); /* far hills, behind the city */

  /* the far city: two layers of towers standing on the horizon, with lit windows and a few red beacons */
  [['#161c3b', 0.62, 26], ['#0b1124', 1, 40]].forEach((layer, li) => {
    let x = 0;
    while (x < W) {
      const w = 14 + r() * 34, h = (10 + Math.pow(r(), 1.5) * 52) * layer[1];
      g.fillStyle = layer[0]; g.fillRect(x, HZ - h, w, h + 2);
      if (li) {
        for (let wy = HZ - h + 4; wy < HZ - 3; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 4) if (r() < 0.32) { g.fillStyle = r() < 0.8 ? 'rgba(255,208,132,.85)' : 'rgba(190,215,255,.8)'; g.fillRect(wx, wy, 1.6, 2.2); }
        if (r() < 0.12) { g.fillStyle = 'rgba(255,70,70,.95)'; g.fillRect(x + w / 2 - 1, HZ - h - 4, 2, 2); }
      }
      x += w + 1 + r() * 8;
    }
  });

  /* near hills in front of the city, with a ragged treeline and a few lit cottages */
  const near = hills(10, 8, 3, '#080f1c', 33);
  g.fillStyle = '#060c18';
  for (let x = 0; x < W; x += 3 + r() * 4) {
    const th = 6 + r() * r() * 16, y = near(x) + 2;
    g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 0.5, y - th); g.lineTo(x + 4, y); g.closePath(); g.fill();
  }
  for (let i = 0; i < 9; i++) {
    const x = 120 + i * 220 + r() * 90, y = near(x) + 1;
    g.fillStyle = '#0a1120'; g.fillRect(x - 4, y - 6, 9, 6);
    g.beginPath(); g.moveTo(x - 6, y - 6); g.lineTo(x + 0.5, y - 11); g.lineTo(x + 7, y - 6); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,200,120,.95)'; g.fillRect(x - 2, y - 4, 2, 2); if (r() < 0.6) g.fillRect(x + 2, y - 4, 2, 2);
  }

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

  /* clouds: soft elongated wisps on a second dome, a little in front of the moon's, drifting slowly */
  const cc = document.createElement('canvas'); cc.width = W; cc.height = H;
  const c = cc.getContext('2d'), cr = rng(91);
  const wisp = (x, y, rx, ry, rgb, a) => {
    c.save(); c.translate(x, y); c.scale(rx / ry, 1);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, ry); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, ry, 0, TAU); c.fill(); c.restore();
  };
  for (let i = 0; i < 26; i++) {
    const cx = cr() * W, cy = 250 + cr() * 190, n = 5 + (cr() * 6 | 0), span = 90 + cr() * 190, lit = cr() < 0.4;
    for (let k = 0; k < n; k++) {
      const x = cx + (k / n - 0.5) * span * 2 + (cr() - 0.5) * 30, y = cy + (cr() - 0.5) * 16, rx = 50 + cr() * 80, ry = 9 + cr() * 14, rgb = lit ? '172,186,228' : '92,106,158', a = (0.07 + cr() * 0.1) * (lit ? 1 : 0.9);
      [-W, 0, W].forEach((o) => wisp(x + o, y, rx, ry, rgb, a));
    }
  }
  const ctex = new THREE.CanvasTexture(cc); ctex.generateMipmaps = false; ctex.minFilter = ctex.magFilter = THREE.LinearFilter;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(8900, 40, 20), new THREE.MeshBasicMaterial({ map: ctex, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
  clouds.renderOrder = -0.5; scene.add(clouds);

  /* stars that twinkle: a few dozen bright ones on their own points layer */
  const NS = 90, sp = new Float32Array(NS * 3), sph = new Float32Array(NS), ssz = new Float32Array(NS), sr = rng(5);
  for (let i = 0; i < NS; i++) {
    const az = sr() * TAU, e = (8 + sr() * 77) * Math.PI / 180;
    sp[i * 3] = 8800 * Math.cos(e) * Math.sin(az); sp[i * 3 + 1] = 8800 * Math.sin(e); sp[i * 3 + 2] = 8800 * Math.cos(e) * Math.cos(az);
    sph[i] = sr(); ssz[i] = 2.2 + sr() * 2.6;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('ph', new THREE.BufferAttribute(sph, 1)); sg.setAttribute('sz', new THREE.BufferAttribute(ssz, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, dpr: { value: 1 }, still: { value: reduce ? 1 : 0 } },
    vertexShader: 'attribute float ph; attribute float sz; uniform float t; uniform float dpr; uniform float still; varying float a;' +
      'void main(){ a = mix(0.55 + 0.45 * sin(t * 1.7 + ph * 6.2831), 0.85, still); gl_PointSize = sz * dpr * (0.8 + 0.4 * a); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float a; void main(){ float d = length(gl_PointCoord - 0.5); float g = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(0.82, 0.88, 1.0, g * g * a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; stars.renderOrder = -1.2; scene.add(stars);

  /* a shooting star every so often, somewhere in the sky the visitor is looking at */
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 8;
  const sx = sc.getContext('2d'), sgr = sx.createLinearGradient(0, 0, 256, 0); sgr.addColorStop(0, 'rgba(200,215,255,0)'); sgr.addColorStop(0.85, 'rgba(225,235,255,.75)'); sgr.addColorStop(1, 'rgba(255,255,255,1)');
  sx.fillStyle = sgr; sx.fillRect(0, 2, 256, 4);
  const shoot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 }));
  shoot.scale.set(1000, 8, 1); shoot.visible = false; shoot.renderOrder = -0.4; scene.add(shoot);
  const ss = { next: 7, t0: -1, az: 0, el: 0, daz: 0, del: 0 }, P = new THREE.Vector3(), Q = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4();
  const at = (az, e, out) => out.set(8200 * Math.cos(e) * Math.sin(az), 8200 * Math.sin(e), 8200 * Math.cos(e) * Math.cos(az));
  const DUR = 0.95;

  const ground = new THREE.Mesh(new THREE.CircleGeometry(9300, 64), new THREE.MeshBasicMaterial({ color: 0x141b33 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -61; scene.add(ground);
  scene.fog = new THREE.Fog(0x21203f, 3500, 9000);

  return {
    dome, moon, ground, clouds, stars,
    tick(t, dt, dpr) {
      if (reduce) return;
      clouds.rotation.y += dt * 0.005;
      starMat.uniforms.t.value = t; starMat.uniforms.dpr.value = dpr || 1;
      if (ss.t0 < 0 && t > ss.next) {
        /* start one: in front of the camera (the outside view looks towards azimuth 108), well above the treeline */
        ss.t0 = t; ss.az = (108 + (Math.random() - 0.5) * 80) * Math.PI / 180; ss.el = (28 + Math.random() * 24) * Math.PI / 180;
        ss.daz = (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.12); ss.del = -(0.06 + Math.random() * 0.08);
        shoot.visible = true;
      }
      if (ss.t0 >= 0) {
        const u = (t - ss.t0) / DUR;
        if (u >= 1) { ss.t0 = -1; ss.next = t + 9 + Math.random() * 14; shoot.visible = false; shoot.material.opacity = 0; }
        else {
          at(ss.az + ss.daz * u, ss.el + ss.del * u, P); at(ss.az + ss.daz * (u + 0.02), ss.el + ss.del * (u + 0.02), Q);
          Z.copy(P).normalize().negate(); X.copy(Q).sub(P).normalize(); X.addScaledVector(Z, -X.dot(Z)).normalize(); Y.crossVectors(Z, X);
          M.makeBasis(X, Y, Z); shoot.quaternion.setFromRotationMatrix(M); shoot.position.copy(P);
          shoot.material.opacity = Math.sin(Math.PI * u);
        }
      }
    }
  };
}

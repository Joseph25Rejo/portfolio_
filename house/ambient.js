/* Things that drift outside at night: fireflies over the lawn, a few leaves falling from the trees, and low mist.
   Each moving thing is a vertex shader reading the clock, so the CPU does almost nothing per frame.
   With reduced motion only the mist is built, and it stands still. */
import * as THREE from '../vendor/three.module.min.js';
import { D, FRONT } from './layout.js';

const GY = -60;
const rng = (sd) => { let x = sd >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const dAz = (a) => ((a - FRONT.az + 540) % 360) - 180;

export function buildAmbient(kernel, exterior, opts) {
  const reduce = !!(opts && opts.reduce), scene = kernel.scene, r = rng(2024);
  const uni = { t: { value: 0 }, k: { value: 700 }, dpr: { value: 1 } };

  /* ---- mist: soft patches lying on the lawn, away from the path ---- */
  const mc = document.createElement('canvas'); mc.width = mc.height = 128;
  const mx = mc.getContext('2d'), mg = mx.createRadialGradient(64, 64, 0, 64, 64, 64);
  mg.addColorStop(0, 'rgba(170,185,225,.55)'); mg.addColorStop(0.5, 'rgba(160,175,215,.22)'); mg.addColorStop(1, 'rgba(150,165,210,0)'); mx.fillStyle = mg; mx.fillRect(0, 0, 128, 128);
  const mistMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mc), transparent: true, opacity: 0.2, depthWrite: false });
  const mistGeo = new THREE.PlaneGeometry(1, 1); mistGeo.rotateX(-Math.PI / 2);
  const mist = [];
  for (let i = 0; i < 16; i++) {
    let a, rad; do { a = r() * 360; } while (Math.abs(dAz(a)) < 7);
    rad = 1000 + r() * 1500;
    const m = new THREE.Mesh(mistGeo, mistMat), s = 700 + r() * 800;
    m.scale.set(s, 1, s * (0.6 + r() * 0.4)); m.rotation.y = r() * 3;
    const bx = rad * Math.sin(a * D), bz = rad * Math.cos(a * D), by = GY + 18 + r() * 26;
    m.position.set(bx, by, bz); m.renderOrder = 2; scene.add(m);
    mist.push({ m, bx, bz, by, sp: 0.03 + r() * 0.05, ph: r() * 6.28, amp: 80 + r() * 120 });
  }

  let fire = null, leaves = null;
  if (!reduce) {
    /* ---- fireflies: warm sparks that wander and blink, over the lawn in front of the house ---- */
    const NF = 46, fp = new Float32Array(NF * 3), fph = new Float32Array(NF);
    for (let i = 0; i < NF; i++) {
      const a = FRONT.az + (r() - 0.5) * 150, rad = 850 + r() * 1300;
      fp[i * 3] = rad * Math.sin(a * D); fp[i * 3 + 1] = GY + 30 + r() * 120; fp[i * 3 + 2] = rad * Math.cos(a * D); fph[i] = r();
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('ph', new THREE.BufferAttribute(fph, 1));
    fire = new THREE.Points(fg, new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: 'attribute float ph; uniform float t; uniform float k; uniform float dpr; varying float a;' +
        'void main(){ vec3 p = position + vec3(sin(t*0.55+ph*17.0)*34.0, sin(t*0.8+ph*9.0)*16.0, cos(t*0.47+ph*13.0)*34.0);' +
        ' vec4 mv = modelViewMatrix * vec4(p, 1.0); float b = max(0.0, sin(t*1.15+ph*40.0)); a = b*b*b;' +
        ' gl_PointSize = max(2.5*dpr, 18.0*k/-mv.z) * (0.6+0.4*a); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float a; void main(){ float d = length(gl_PointCoord - 0.5); float g = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(1.0, 0.92, 0.45, g*g*a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    fire.frustumCulled = false; fire.renderOrder = 3; scene.add(fire);

    /* ---- leaves: two or three per tree near the front, falling from the canopy and swaying ---- */
    const trees = (exterior && exterior.trees ? exterior.trees : []).filter((tr) => Math.abs(dAz(tr.a)) < 100), lp = [], lph = [];
    trees.forEach((tr) => { for (let j = 0; j < 3; j++) { lp.push(tr.x + (r() - 0.5) * 220 * tr.s, tr.s * 430, tr.z + (r() - 0.5) * 220 * tr.s); lph.push(r()); } });
    if (lph.length) {
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('ph', new THREE.Float32BufferAttribute(lph, 1));
      leaves = new THREE.Points(lg, new THREE.ShaderMaterial({
        uniforms: uni,
        vertexShader: 'attribute float ph; uniform float t; uniform float k; uniform float dpr; varying float a; varying float ang;' +
          'void main(){ float H = position.y; float f = mod(t*(34.0+ph*20.0) + ph*H, H); vec3 p = position; p.y = ' + GY + '.0 + H - f;' +
          ' p.x += sin(t*0.9+ph*20.0)*42.0; p.z += cos(t*0.7+ph*14.0)*42.0;' +
          ' a = smoothstep(0.0, 60.0, f) * smoothstep(0.0, 50.0, H - f); ang = t*(1.0+ph*2.0) + ph*6.0;' +
          ' vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = max(3.0*dpr, 13.0*k/-mv.z); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying float a; varying float ang; void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(ang), co = cos(ang); c = vec2(co*c.x - s*c.y, s*c.x + co*c.y);' +
          ' if (c.x*c.x/0.2 + c.y*c.y/0.025 > 1.0) discard; gl_FragColor = vec4(0.5, 0.58, 0.3, a*0.9); }',
        transparent: true, depthWrite: false
      }));
      leaves.frustumCulled = false; leaves.renderOrder = 3; scene.add(leaves);
    }
  }

  return {
    tick(t, dt) {
      const cam = kernel.camera, el = kernel.renderer.domElement;
      uni.t.value = t; uni.dpr.value = kernel.renderer.getPixelRatio();
      uni.k.value = el.height / (2 * Math.tan(cam.fov * Math.PI / 360));
      if (reduce) return;
      for (let i = 0; i < mist.length; i++) {
        const o = mist[i], q = t * o.sp + o.ph;
        o.m.position.set(o.bx + Math.sin(q) * o.amp, o.by, o.bz + Math.cos(q * 0.8) * o.amp);
      }
    }
  };
}

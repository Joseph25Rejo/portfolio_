/* The join between the page and the house. The page owns scroll, captions, the floor rail and the room overlays; this
   module owns the canvas. It exposes `render(px, dolly, openK)` and reports door hover and clicks back.
   mountHouse() resolves to a controller, or null when WebGL is missing (the page then shows its poster). */
import * as THREE from '../vendor/three.module.min.js';
import { createKernel, hasWebGL } from './kernel.js';
import { createRail } from './rail.js';
import { buildShell } from './shell.js';
import { buildSky } from './sky.js';
import { createSign } from './sign.js';
import { buildKeyframes, DOORS, DOOR, D, APO } from './layout.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function mountHouse(stage, opts) {
  opts = opts || {};
  if (!hasWebGL()) return null;
  const reduce = !!opts.reduce;
  let lost = false;
  const kernel = createKernel(stage, { onLost: () => { lost = true; if (opts.onLost) opts.onLost(); } });
  kernel.reduce = reduce;
  buildSky(kernel.scene);
  const shell = buildShell(kernel.scene, kernel);
  shell.onChange = kernel.invalidate;
  const rail = createRail(buildKeyframes());
  const sign = createSign(kernel, kernel.scene, { reduce, onQuick: opts.onQuick, resumeHref: opts.resumeHref });
  sign.startHint();

  const canvas = kernel.canvas;
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), tgt = new THREE.Vector3(), ctr = new THREE.Vector3();
  const leafM = new THREE.Matrix4(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3();
  const angle = new Array(8).fill(0); /* door leaf angles we last applied */
  const state = { px: 0, dolly: 0, openK: null, hoverK: null, signOn: true, frontAng: 0, s: 0, lastK: null, shift: 0 };

  const setAng = (k, a) => { if (Math.abs(angle[k] - a) > 1e-4) { angle[k] = a; shell.setDoorAngle(k, a); } };

  /* ---- the camera: the rail, then the dolly toward the door that was chosen ---- */
  function render(px, dolly, openK) {
    state.px = px; state.dolly = dolly; state.openK = openK;
    const r = rail.pose(px, pos, look);
    state.s = r.s;
    const target = openK !== null && openK !== undefined ? openK : (dolly > 0 ? state.lastK : null);
    if (dolly > 0 && target !== null) {
      state.lastK = target;
      const d = DOORS[target], e = ease(Math.min(1, dolly)), t2 = Math.max(0, Math.min(1, dolly - 1)), e2 = 1 - Math.pow(1 - t2, 2);
      /* 0..1: walk up to just in front of the door, square to it, level with its middle. 1..2: step through the doorway into the light */
      tgt.set(d.center[0] - d.out[0] * 190, d.center[1] - 20, d.center[2] - d.out[2] * 190);
      ctr.set(d.center[0], d.center[1] - 10, d.center[2]);
      pos.lerp(tgt, e); look.lerp(ctr, e);
      if (t2 > 0) {
        pos.set(tgt.x + (d.center[0] + d.out[0] * 40 - tgt.x) * e2, tgt.y, tgt.z + (d.center[2] + d.out[2] * 40 - tgt.z) * e2);
        look.set(ctr.x + d.out[0] * 300 * e2, ctr.y, ctr.z + d.out[2] * 300 * e2);
      }
      setAng(target, -1.26 * e);
    } else if (state.lastK !== null) { setAng(state.lastK, state.hoverK === state.lastK ? -0.09 : 0); state.lastK = null; }
    kernel.camera.position.copy(pos); kernel.camera.lookAt(look);
    /* on a tall phone the welcome card sits over the top of the hall: slide the view down so the portrait clears it */
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1, shift = cw / ch < 0.8 ? Math.round(0.15 * ch * sm(1 - Math.abs(px - rail.scrollOf(2)) / 800)) : 0;
    if (shift !== state.shift) { state.shift = shift; if (shift) kernel.camera.setViewOffset(cw, ch, 0, -shift, cw, ch); else kernel.camera.clearViewOffset(); }
    /* the front door swings open as the visitor walks in; the sign hangs on it */
    const fa = 1.5 * sm((r.s - 1) / 0.75);
    if (fa !== state.frontAng) { state.frontAng = fa; shell.setDoorAngle(7, -fa); }
    kernel.invalidate();
    return r;
  }

  /* the sign follows the front door's leaf, every frame the kernel runs */
  kernel.addTick((now, dt) => {
    shell.leafMatrix(7, leafM);
    return sign.tick(now, dt, leafM, state.signOn && state.s < 1.4 && !lost);
  });
  kernel.addTick((now, dt) => shell.hall.tick(now, dt));
  kernel.addTick((now) => shell.chandelier.tick(now));

  /* ---- doors in 3D: which door is under the pointer? ---- */
  const lat = new THREE.Vector3();
  function pick(cx, cy) {
    const b = kernel.canvas.getBoundingClientRect();
    ndc.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    kernel.camera.updateMatrixWorld();
    ray.setFromCamera(ndc, kernel.camera);
    let best = -1, bd = 1e9;
    DOORS.forEach((d) => {
      const nx = d.out[0], nz = d.out[2], den = ray.ray.direction.x * nx + ray.ray.direction.z * nz;
      if (den <= 1e-4) return; /* we look at doors from inside the well, so the ray runs along the door's outward normal */
      const t = ((d.center[0] - ray.ray.origin.x) * nx + (d.center[2] - ray.ray.origin.z) * nz) / den;
      if (t <= 0 || t > bd) return;
      v.copy(ray.ray.direction).multiplyScalar(t).add(ray.ray.origin);
      lat.set(-Math.cos(d.az * D), 0, Math.sin(d.az * D));
      const dl = (v.x - d.center[0]) * lat.x + (v.z - d.center[2]) * lat.z, dy = v.y - d.center[1];
      if (Math.abs(dl) <= DOOR.w / 2 + 6 && Math.abs(dy) <= DOOR.h / 2 + 6) { best = d.k; bd = t; }
    });
    return best;
  }
  const setHover = (k) => {
    if (k === state.hoverK) return;
    if (state.hoverK !== null && state.hoverK !== state.openK) setAng(state.hoverK, 0);
    state.hoverK = k;
    if (k !== null && k !== state.openK) setAng(k, -0.09);
    kernel.canvas.style.cursor = k !== null ? 'pointer' : '';
    if (opts.onHover) opts.onHover(k);
  };
  const onMove = (e) => { if (state.openK !== null || e.pointerType === 'touch') return; const k = pick(e.clientX, e.clientY); setHover(k >= 0 ? k : null); };
  const onLeave = () => { if (state.openK === null) setHover(null); };
  const onClick = (e) => { if (state.openK !== null) return; const k = pick(e.clientX, e.clientY); if (k >= 0 && opts.onDoor) opts.onDoor(k); };
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('click', onClick);

  return {
    kernel, rail, shell, sign, canvas,
    total: rail.total,
    stops: rail.stops,
    doorPx: (k) => rail.scrollOf(rail.stops.findIndex((s) => s.door === k)),
    hearthPx: () => rail.scrollOf(2),
    render,
    /* the room overlay is up: the sign's buttons must not sit over it */
    setSignEnabled(on) { state.signOn = on; kernel.invalidate(); },
    sleep() { kernel.canvas.style.visibility = 'hidden'; },
    dispose() { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('click', onClick); sign.dispose(); kernel.dispose(); }
  };
}

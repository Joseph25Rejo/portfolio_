/* Phase 1 harness: kernel + rail + grey-box house, scroll-driven. `?debug=0` hides the debug view. */
import * as THREE from '../vendor/three.module.min.js';
import { createKernel, hasWebGL } from './kernel.js';
import { createRail } from './rail.js';
import { buildShell } from './shell.js';
import { buildSky } from './sky.js';
import { createDebug } from './debug.js';
import { createSign } from './sign.js';
import { buildKeyframes, DOORS, D } from './layout.js';

const host = document.getElementById('stage');
const note = (t) => { const n = document.getElementById('note'); if (n) { n.textContent = t; n.hidden = !t; } };
if (!hasWebGL()) { note('WebGL is not available here. The finished site shows a still poster and the Quick view instead.'); throw new Error('no webgl'); }

const kernel = createKernel(host, { onLost: () => note('The graphics context was lost. The finished site falls back to the poster and Quick view.') });
buildSky(kernel.scene);
const shell = buildShell(kernel.scene, kernel);
shell.onChange = kernel.invalidate;
const rail = createRail(buildKeyframes());
const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

document.getElementById('track').style.height = 'calc(100dvh + ' + rail.total + 'px)';
const goPx = (px) => window.scrollTo({ top: px, behavior: reduce ? 'auto' : 'smooth' });
const goStop = (i) => goPx(rail.scrollOf(i));

const pos = new THREE.Vector3(), look = new THREE.Vector3();
let cur = (window.scrollY || 0);
const info = { px: 0, total: rail.total, stop: null, stopIndex: -1, look };
/* Quick view is always on screen; in the finished site this opens the Quick view room */
const toast = document.getElementById('toast');
const openQuick = () => { window.dispatchEvent(new CustomEvent('house:quick')); if (toast) { toast.textContent = 'Quick view opens here in the finished site'; toast.hidden = false; clearTimeout(openQuick.t); openQuick.t = setTimeout(() => { toast.hidden = true; }, 2600); } };
const quickBtn = document.getElementById('quick'); if (quickBtn) quickBtn.addEventListener('click', openQuick);
const sign = createSign(kernel, kernel.scene, { reduce, onQuick: openQuick, resumeHref: './assets/e347ca2a9ec4bb8d9925776a0b9444c4.pdf' });
sign.startHint();
const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const leafM = new THREE.Matrix4();
let lastAng = -1;
const debug = /[?&]debug=0/.test(location.search) ? null : createDebug(kernel, rail, goStop);

kernel.addTick((now, dt) => {
  const target = Math.max(0, Math.min(rail.total, window.scrollY || 0));
  cur += (target - cur) * (reduce ? 1 : 1 - Math.exp(-dt * 6.5));
  const moving = Math.abs(target - cur) > 0.2;
  if (!moving) cur = target;
  const r = rail.pose(cur, pos, look);
  kernel.camera.position.copy(pos); kernel.camera.lookAt(look);
  /* the front door opens inward as the visitor leaves the porch; the sign hangs on it and goes with it */
  const ang = 1.5 * sm((r.s - 1) / 0.75);
  if (ang !== lastAng) { lastAng = ang; shell.setDoorAngle(7, -ang); }
  if (target > 12) sign.interacted();
  shell.leafMatrix(7, leafM);
  const signBusy = sign.tick(now, dt, leafM, r.s < 1.4);
  info.px = cur; info.stop = rail.nearestStop(cur, 24); info.stopIndex = info.stop ? rail.stops.indexOf(info.stop) : -1;
  if (debug) debug.update(info);
  return moving || signBusy;
});
kernel.addTick((now, dt) => shell.hall.tick(now, dt));
window.addEventListener('scroll', kernel.invalidate, { passive: true });
if (/#s(\d+)/.test(location.hash)) { cur = rail.scrollOf(+RegExp.$1); window.scrollTo(0, cur); }

/* test hooks: the objective checks in the Phase 1 report run through these */
window.__house = {
  kernel, rail, info, shell, sign,
  snap(px) { cur = px; window.scrollTo(0, px); kernel.invalidate(); },
  /* at each door stop: how far does the camera's line of sight miss the door centre, and how far is it from facing the door square? */
  check() {
    const p = new THREE.Vector3(), l = new THREE.Vector3();
    return DOORS.map((d) => {
      const si = rail.stops.findIndex((s) => s.door === d.k);
      rail.pose(rail.scrollOf(si), p, l);
      const fx = l.x - p.x, fz = l.z - p.z, len = Math.hypot(fx, fz);
      const nx = d.out[0], nz = d.out[2];
      const lateral = Math.abs((d.center[0] - p.x) * nz - (d.center[2] - p.z) * nx);
      const yaw = Math.acos(Math.max(-1, Math.min(1, (fx * nx + fz * nz) / len))) / D;
      return { door: d.num, lateral: +lateral.toFixed(3), yawErr: +yaw.toFixed(3), dist: +Math.hypot(d.center[0] - p.x, d.center[2] - p.z).toFixed(0) };
    });
  },
  goStop
};

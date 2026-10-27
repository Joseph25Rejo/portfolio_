/* The camera rail: scroll distance (px) -> camera position and look-at point.
   Two centripetal Catmull-Rom curves (position, look-at) run through the keyframes, so the camera always passes exactly
   through each stop. Between two stops the progress is eased with a rest at both ends, so the camera settles on every stop. */
import * as THREE from '../vendor/three.module.min.js';

const sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const plateau = (f) => sm((f - 0.16) / 0.68);

export function createRail(kfs) {
  const N = kfs.length;
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const posC = new THREE.CatmullRomCurve3(kfs.map((k) => v3(k.pos)), false, 'centripetal');
  const lookC = new THREE.CatmullRomCurve3(kfs.map((k) => v3(k.look)), false, 'centripetal');
  const stops = [];
  kfs.forEach((k, i) => { if (k.stop) stops.push({ i, id: k.id, label: k.label, door: k.door, px: 0 }); });
  let acc = 0;
  stops.forEach((s, n) => { acc += n ? kfs[s.i].px : 0; s.px = acc; });
  const total = acc;

  const at = (s, p, l) => { const t = Math.max(0, Math.min(1, s / (N - 1))); posC.getPoint(t, p); lookC.getPoint(t, l); };

  return {
    N, stops, total, kfs, posC, lookC,
    /* keyframe-index position for a scroll distance, and which span we are in */
    sAt(px) {
      px = Math.max(0, Math.min(total, px));
      let n = 0; while (n < stops.length - 2 && px > stops[n + 1].px) n++;
      const a = stops[n], b = stops[n + 1], F = b.px > a.px ? (px - a.px) / (b.px - a.px) : 0;
      return { s: a.i + (b.i - a.i) * plateau(F), span: n, F };
    },
    pose(px, p, l) { const r = this.sAt(px); at(r.s, p, l); return r; },
    poseAtKeyframe(i, p, l) { at(i, p, l); },
    nearestStop(px, tol) { let best = null; stops.forEach((s) => { const d = Math.abs(s.px - px); if (d <= tol && (!best || d < best.d)) best = { s, d }; }); return best && best.s; },
    scrollOf(stopIndex) { return stops[stopIndex].px; }
  };
}

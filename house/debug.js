/* Debug view: live stats, a plan map, the stop list, and the rail drawn in the scene. Dev only; never part of the site. */
import * as THREE from '../vendor/three.module.min.js';
import { D, APO, RO, DOORS, FRONT, HEARTH, NF } from './layout.js';

export function createDebug(kernel, rail, goStop) {
  /* the rail in 3D: cyan = camera path, magenta = look-at path, dots = keyframes (white = stops) */
  const railGroup = new THREE.Group(); railGroup.visible = /[?&]rail=1/.test(location.search); kernel.scene.add(railGroup);
  window.addEventListener('keydown', (e) => { if (e.key === 'r') { railGroup.visible = !railGroup.visible; kernel.invalidate(); } });
  const line = (curve, color) => {
    const pts = curve.getPoints(rail.N * 24), g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color })); railGroup.add(l);
  };
  line(rail.posC, 0x39d0ff); line(rail.lookC, 0xff4fd8);
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), rail.N);
  const m = new THREE.Matrix4();
  rail.kfs.forEach((k, i) => { m.makeScale(k.stop ? 1.6 : 0.8, k.stop ? 1.6 : 0.8, k.stop ? 1.6 : 0.8).setPosition(k.pos[0], k.pos[1], k.pos[2]); dots.setMatrixAt(i, m); });
  railGroup.add(dots);

  const css = 'position:fixed;z-index:10;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#e9e4d6;background:rgba(10,12,24,.82);border:1px solid rgba(255,255,255,.14);';
  const hud = document.createElement('pre'); hud.style.cssText = css + 'left:10px;top:10px;margin:0;padding:8px 10px;pointer-events:none;white-space:pre'; document.body.appendChild(hud);

  const map = document.createElement('canvas'); const MS = 200; map.width = map.height = MS * 2; map.style.cssText = css + 'left:10px;bottom:10px;width:' + MS + 'px;height:' + MS + 'px'; document.body.appendChild(map);
  const mc = map.getContext('2d');

  const list = document.createElement('div'); list.style.cssText = css + 'right:10px;top:10px;padding:6px;display:flex;flex-direction:column;gap:3px;max-height:calc(100vh - 20px);overflow:auto';
  rail.stops.forEach((s, i) => {
    const b = document.createElement('button'); b.textContent = String(i).padStart(2, '0') + '  ' + s.label;
    b.style.cssText = 'font:inherit;color:inherit;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);padding:6px 10px;cursor:pointer;text-align:left;min-height:32px';
    b.onclick = () => goStop(i); b.dataset.i = i; list.appendChild(b);
  });
  document.body.appendChild(list);

  const drawMap = (cam, look) => {
    const sc = (MS * 2) / (APO * 2.9), c = MS, X = (p) => c + p[0] * sc, Y = (p) => c - p[2] * sc; /* north (az 0) is up */
    mc.fillStyle = '#0a0c18'; mc.fillRect(0, 0, MS * 2, MS * 2);
    mc.strokeStyle = '#8a7a5a'; mc.lineWidth = 2; mc.beginPath(); mc.arc(c, c, APO * sc, 0, 7); mc.stroke();
    mc.strokeStyle = '#4a3a2a'; mc.beginPath(); mc.arc(c, c, 250 * sc, 0, 7); mc.stroke();
    const dot = (p, col, r, t) => { mc.fillStyle = col; mc.beginPath(); mc.arc(X(p), Y(p), r, 0, 7); mc.fill(); if (t) { mc.fillStyle = '#e9e4d6'; mc.font = '18px monospace'; mc.fillText(t, X(p) + 8, Y(p) + 5); } };
    DOORS.slice(0, 2).forEach((d) => dot(d.center, '#d6b25e', 6, d.k === 0 ? '00,02..' : '01,03..'));
    dot(FRONT.center, '#c0452e', 6, 'front'); dot(HEARTH.center, '#ff8a2a', 7, 'hearth');
    mc.strokeStyle = 'rgba(57,208,255,.5)'; mc.lineWidth = 1.5; mc.beginPath();
    rail.posC.getPoints(rail.N * 24).forEach((p, i) => (i ? mc.lineTo(X(p), Y(p)) : mc.moveTo(X(p), Y(p)))); mc.stroke();
    mc.strokeStyle = '#fff'; mc.lineWidth = 2; mc.beginPath(); mc.moveTo(X(cam), Y(cam)); mc.lineTo(X(look), Y(look)); mc.stroke();
    dot(cam, '#39d0ff', 7);
  };

  return {
    update(info) {
      const st = kernel.stats, r = kernel.renderer.info;
      hud.textContent = 'fps ' + st.fps.toFixed(0) + '  frame ' + st.ms.toFixed(1) + ' ms  rendered ' + st.frames +
        '\ndraw calls ' + st.calls + '  tris ' + st.tris + '  geoms ' + r.memory.geometries + '  tex ' + r.memory.textures +
        '\npixel ratio ' + st.dpr + ' (tier ' + st.lvl + ')' + (st.lost ? '  CONTEXT LOST' : '') +
        '\nscroll ' + info.px.toFixed(0) + ' / ' + info.total + '\n' + (info.stop ? 'AT  ' + info.stop.label : 'between stops');
      Array.prototype.forEach.call(list.children, (b) => { b.style.background = info.stop && +b.dataset.i === info.stopIndex ? 'rgba(214,178,94,.35)' : 'rgba(255,255,255,.06)'; });
      drawMap([kernel.camera.position.x, 0, kernel.camera.position.z], [info.look.x, 0, info.look.z]);
    },
    remove() { [hud, map, list].forEach((e) => e.remove()); }
  };
}

/* The reversible business sign on the front door: a hanging board with two faces.
   Face A (cream) says the site is open and to scroll down; face B (charcoal) offers Quick view and the résumé.
   It is one mesh (one atlas, one draw) and follows the door leaf. A DOM twin of real buttons is projected over it so it
   works with a keyboard, a screen reader and a thumb. The sign never needs per-frame work while it is still. */
import * as THREE from '../vendor/three.module.min.js';

const FWID = 640, FHEI = 448, SW = 120, SH = 84, TOPY = -26; /* face size in px, and the board in world units */
const AA = { w: 1280, h: 448 };
/* where the tappable things sit on face B, as fractions of the face (left, top, width, height) */
const HIT = { quick: [70 / 640, 100 / 448, 500 / 640, 135 / 448], resume: [150 / 640, 320 / 448, 340 / 640, 72 / 448], back: [0, 0, 1, 90 / 448] };

function drawFaces(ctx) {
  const serif = '"Cormorant Garamond",Georgia,serif', sans = '"Instrument Sans","Helvetica Neue",Arial,sans-serif';
  const track = (t, x, y, sp) => { let w = 0; for (const ch of t) w += ctx.measureText(ch).width + sp; w -= sp; let cx = x - w / 2; for (const ch of t) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; } };
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  /* ---- face A ---- */
  let g = ctx.createLinearGradient(0, 0, 0, FHEI); g.addColorStop(0, '#F7F3EA'); g.addColorStop(1, '#E6DECB');
  ctx.fillStyle = g; ctx.fillRect(0, 0, FWID, FHEI);
  ctx.strokeStyle = '#B28F4E'; ctx.lineWidth = 5; ctx.strokeRect(16, 16, FWID - 32, FHEI - 32); ctx.lineWidth = 2; ctx.strokeRect(28, 28, FWID - 56, FHEI - 56);
  ctx.fillStyle = '#7D5F28'; ctx.font = '600 30px ' + sans; track('WELCOME', FWID / 2, 84, 9);
  ctx.fillStyle = '#292925'; ctx.font = '600 176px ' + serif; ctx.textAlign = 'center'; ctx.fillText('Open', FWID / 2, 246);
  ctx.fillStyle = '#3A372F'; ctx.font = '500 34px ' + sans; ctx.fillText('Scroll down to come in', FWID / 2, 312);
  ctx.strokeStyle = '#B28F4E'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  [0, 1].forEach((i) => { ctx.globalAlpha = 1 - i * 0.5; ctx.beginPath(); ctx.moveTo(FWID / 2 - 26, 340 + i * 26); ctx.lineTo(FWID / 2, 366 + i * 26); ctx.lineTo(FWID / 2 + 26, 340 + i * 26); ctx.stroke(); });
  ctx.globalAlpha = 1;
  /* ---- face B ---- */
  ctx.save(); ctx.translate(FWID, 0);
  g = ctx.createLinearGradient(0, 0, 0, FHEI); g.addColorStop(0, '#34342F'); g.addColorStop(1, '#1D1D1A'); ctx.fillStyle = g; ctx.fillRect(0, 0, FWID, FHEI);
  ctx.strokeStyle = '#B28F4E'; ctx.lineWidth = 5; ctx.strokeRect(16, 16, FWID - 32, FHEI - 32); ctx.lineWidth = 2; ctx.strokeRect(28, 28, FWID - 56, FHEI - 56);
  ctx.fillStyle = '#D9B873'; ctx.font = '600 28px ' + sans; ctx.textAlign = 'left'; track('IN A HURRY?', FWID / 2, 78, 8); ctx.textAlign = 'center';
  ctx.fillStyle = '#F4F0E8'; ctx.fillRect(70, 100, 500, 135);
  ctx.fillStyle = '#292925'; ctx.font = '600 62px ' + sans; ctx.fillText('Quick view  →', FWID / 2, 186);
  ctx.fillStyle = 'rgba(244,240,232,.82)'; ctx.font = '500 30px ' + sans; ctx.fillText('The whole story in 30 seconds', FWID / 2, 282);
  ctx.strokeStyle = '#B28F4E'; ctx.lineWidth = 3; ctx.strokeRect(150, 320, 340, 72);
  ctx.fillStyle = '#F4F0E8'; ctx.font = '600 34px ' + sans; ctx.fillText('Résumé  ↓', FWID / 2, 368);
  ctx.restore();
  ctx.fillStyle = '#B28F4E'; ctx.fillRect(AA.w - 10, AA.h - 10, 10, 10); /* brass pixel for edges and chains */
}

export function createSign(kernel, scene, opts) {
  opts = opts || {};
  const reduce = !!opts.reduce;
  const cv = document.createElement('canvas'); cv.width = AA.w; cv.height = AA.h;
  const ctx = cv.getContext('2d'); drawFaces(ctx);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const redraw = () => { drawFaces(ctx); tex.needsUpdate = true; kernel.invalidate(); };
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('600 40px "Cormorant Garamond"'), document.fonts.load('600 30px "Instrument Sans"')]).then(redraw).catch(() => {});

  /* geometry: two faces back to back (front looks outward, -z), four edges, a hook and two chains */
  const pos = [], uv = [], idx = [], z = 1.6, y0 = TOPY - SH, y1 = TOPY, hw = SW / 2;
  const quad = (a, b, c, d, ua, ub, uc, ud) => { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); uv.push(...ua, ...ub, ...uc, ...ud); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  quad([hw, y0, -z], [-hw, y0, -z], [-hw, y1, -z], [hw, y1, -z], [0, 0], [0.5, 0], [0.5, 1], [0, 1]);
  quad([-hw, y0, z], [hw, y0, z], [hw, y1, z], [-hw, y1, z], [0.5, 0], [1, 0], [1, 1], [0.5, 1]);
  const bp = [0.995, 0.01]; /* the brass pixel */
  const flat = (a, b, c, d) => quad(a, b, c, d, bp, bp, bp, bp);
  flat([hw, y0, -z], [hw, y0, z], [hw, y1, z], [hw, y1, -z]); flat([-hw, y0, z], [-hw, y0, -z], [-hw, y1, -z], [-hw, y1, z]);
  flat([-hw, y1, -z], [hw, y1, -z], [hw, y1, z], [-hw, y1, z]); flat([-hw, y0, z], [hw, y0, z], [hw, y0, -z], [-hw, y0, -z]);
  const chain = (x1) => flat([-1, 0, 0], [1, 0, 0], [x1 + 1, y1, 0], [x1 - 1, y1, 0]);
  chain(-hw + 8); chain(hw - 8); flat([-6, 3, -3], [6, 3, -3], [6, 0, 3], [-6, 0, 3]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; scene.add(mesh);

  /* ---- state: the flip is a damped spring; the sway is a small decaying roll ---- */
  const st = { flipped: false, a: 0, v: 0, sway: 0, t: 0, interacted: false };
  const leaf = new THREE.Matrix4(), hook = new THREE.Matrix4().makeTranslation(75, 278, -9), tmp = new THREE.Matrix4(), rot = new THREE.Matrix4(), rz = new THREE.Matrix4();
  const place = () => { rot.makeRotationY(st.a); rz.makeRotationZ(Math.sin(st.t * 5) * st.sway); mesh.matrix.copy(leaf).multiply(hook).multiply(rz).multiply(rot); mesh.matrixWorld.copy(mesh.matrix); };

  /* ---- DOM twin: real buttons over the sign ---- */
  const twin = document.createElement('div'); twin.setAttribute('data-sign-twin', '');
  twin.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:9;display:none';
  const mk = (tag, label, f, fn) => {
    const b = document.createElement(tag); b.setAttribute('aria-label', label);
    b.style.cssText = 'position:absolute;display:block;left:' + (f[0] * 100) + '%;top:' + (f[1] * 100) + '%;width:' + (f[2] * 100) + '%;height:' + (f[3] * 100) + '%;background:transparent;border:0;margin:0;padding:0;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;border-radius:3px';
    b.addEventListener('focus', () => { b.style.boxShadow = '0 0 0 3px #B28F4E'; }); b.addEventListener('blur', () => { b.style.boxShadow = 'none'; });
    if (fn) b.addEventListener('click', fn); twin.appendChild(b); return b;
  };
  const flip = () => { st.interacted = true; setFlipped(!st.flipped); };
  const bFlip = mk('button', 'Turn the sign over', [0, 0, 1, 1], flip);
  const bBack = mk('button', 'Turn the sign back to the scroll prompt', HIT.back, flip);
  const bQuick = mk('button', 'Open the quick view, a 30 second overview', HIT.quick, () => { st.interacted = true; if (opts.onQuick) opts.onQuick(); });
  const bRes = mk('a', 'Download the résumé as a PDF', HIT.resume, null); bRes.href = opts.resumeHref || '#'; bRes.target = '_blank'; bRes.rel = 'noopener'; bRes.setAttribute('download', 'Joseph_Rejo_Mathew_Resume.pdf');
  document.body.appendChild(twin);
  const syncTwin = () => {
    const back = st.flipped;
    bFlip.style.display = back ? 'none' : 'block'; bBack.style.display = back ? 'block' : 'none'; bQuick.style.display = back ? 'block' : 'none'; bRes.style.display = back ? 'block' : 'none';
    bBack.style.zIndex = 1; bQuick.style.zIndex = 2; bRes.style.zIndex = 2;
  };
  syncTwin();

  function setFlipped(f) {
    if (st.flipped === f) return;
    st.flipped = f; st.sway = reduce ? 0 : 0.06; syncTwin();
    if (reduce) { st.a = f ? Math.PI : 0; st.v = 0; }
    kernel.invalidate();
  }

  /* project the board's corners to find where the DOM twin goes */
  const corners = [[hw, y0, 0], [-hw, y0, 0], [-hw, y1, 0], [hw, y1, 0]].map((c) => new THREE.Vector3(c[0], c[1], c[2])), q = new THREE.Vector3();
  let visible = true;
  const project = (show) => {
    if (!show) { if (twin.style.display !== 'none') twin.style.display = 'none'; return; }
    const cam = kernel.camera, host = kernel.canvas.getBoundingClientRect(); let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, ok = true;
    cam.updateMatrixWorld();
    corners.forEach((c) => { q.copy(c).applyMatrix4(mesh.matrix).project(cam); if (q.z > 1 || q.z < -1) ok = false; const x = host.left + (q.x * 0.5 + 0.5) * host.width, y = host.top + (-q.y * 0.5 + 0.5) * host.height; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); });
    const settled = Math.abs((st.flipped ? Math.PI : 0) - st.a) < 0.12;
    if (!ok || !settled || maxx - minx < 24) { twin.style.display = 'none'; return; }
    twin.style.display = 'block';
    twin.style.left = minx + 'px'; twin.style.top = miny + 'px'; twin.style.width = (maxx - minx) + 'px'; twin.style.height = (maxy - miny) + 'px';
  };

  /* the first-visit hint: if nobody touches anything for a few seconds, show the back, then turn it round again */
  let hintTimers = [];
  const cancelHint = () => { hintTimers.forEach(clearTimeout); hintTimers = []; };

  return {
    mesh, state: st, twin,
    /* called every frame: `leafM` is the front door leaf's matrix; `show` is false once the visitor is past the porch */
    tick(now, dt, leafM, show) {
      if (leafM) leaf.copy(leafM);
      st.t += dt;
      let busy = false;
      if (!reduce) {
        const target = st.flipped ? Math.PI : 0;
        st.v += (70 * (target - st.a) - 9.5 * st.v) * dt; st.a += st.v * dt;
        st.sway *= Math.exp(-dt * 1.6);
        if (Math.abs(target - st.a) > 0.002 || Math.abs(st.v) > 0.01) busy = true; else { st.a = target; st.v = 0; }
        if (st.sway > 0.0008) busy = true; else st.sway = 0;
      }
      place(); project(show);
      return busy;
    },
    /* nudge once, near the start, if the visitor has not scrolled or tapped */
    startHint() {
      cancelHint();
      hintTimers.push(setTimeout(() => { if (!st.interacted) { setFlipped(true); hintTimers.push(setTimeout(() => { if (!st.interacted) setFlipped(false); }, 4200)); } }, 5200));
    },
    interacted() { st.interacted = true; cancelHint(); },
    dispose() { cancelHint(); twin.remove(); geo.dispose(); tex.dispose(); }
  };
}

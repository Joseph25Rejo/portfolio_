/* WebGL renderer for the staircase house.
   The CSS scene (index.html) describes every face as an absolutely placed div with a CSS 3D transform and a CSS
   background. This module reads those divs once and rebuilds the same scene in Three.js so a climb is a handful of
   draw calls instead of ~1000 composited layers. Coordinates stay in CSS space (y down); the root group flips y. */
import * as THREE from './three.module.min.js';
import { ANIM, isAnim, isGroup, offsetIn, FIRE_FRAMES, FIRE_COLS } from './hs-gl-props.js';

THREE.ColorManagement.enabled = false; /* pass CSS sRGB values straight through, as the browser does */
const DEG = Math.PI / 180;

/* ---------- small CSS parsing helpers ---------- */
const splitTop = (s) => {
  const out = []; let d = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') d++; else if (ch === ')') d--;
    if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
const parseColor = (str) => {
  str = str.trim();
  if (str === 'transparent') return [0, 0, 0, 0];
  let m = str.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  m = str.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  return null;
};
const COLOR_RE = /^(rgba?\([^)]*\)|#[0-9a-f]{3,8}|transparent)\s*(.*)$/i;
const css = (c) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + c[3] + ')';

/* "rgb(..) 12px 40%" -> { c, pos: [{v, u}] } */
const parseStop = (s) => {
  const m = s.match(COLOR_RE); if (!m) return null;
  const c = parseColor(m[1]); if (!c) return null;
  const pos = [];
  (m[2].match(/-?[\d.]+(px|%)?/g) || []).forEach((t) => pos.push({ v: parseFloat(t), u: /%$/.test(t) ? '%' : 'px' }));
  return { c, pos };
};
/* resolve stop positions to px along a gradient of length L; transparent stops borrow a neighbour's rgb so they fade, not darken */
const resolveStops = (parts, L) => {
  const raw = parts.map(parseStop);
  if (raw.some((r) => !r)) return null;
  const out = [];
  raw.forEach((r) => {
    if (!r.pos.length) out.push({ p: null, c: r.c.slice() });
    else r.pos.forEach((q) => out.push({ p: q.u === '%' ? q.v / 100 * L : q.v, c: r.c.slice() }));
  });
  if (out[0].p === null) out[0].p = 0;
  if (out[out.length - 1].p === null) out[out.length - 1].p = L;
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i].p !== null) continue;
    let j = i + 1; while (out[j].p === null) j++;
    const a = out[i - 1].p, b = out[j].p;
    for (let k = i; k < j; k++) out[k].p = a + (b - a) * (k - i + 1) / (j - i + 1);
  }
  let prev = -Infinity;
  out.forEach((s) => { if (s.p < prev) s.p = prev; prev = s.p; });
  out.forEach((s, i) => {
    if (s.c[3] === 0 && s.c[0] === 0 && s.c[1] === 0 && s.c[2] === 0) {
      const n = (out[i - 1] && out[i - 1].c[3] > 0 ? out[i - 1] : null) || (out[i + 1] && out[i + 1].c[3] > 0 ? out[i + 1] : null);
      if (n) { s.c[0] = n.c[0]; s.c[1] = n.c[1]; s.c[2] = n.c[2]; }
    }
  });
  return out;
};
const addStops = (g, stops, L) => stops.forEach((s) => g.addColorStop(Math.max(0, Math.min(1, s.p / L)), css(s.c)));
const lenPx = (tok, total) => (/%$/.test(tok) ? parseFloat(tok) / 100 * total : parseFloat(tok) || 0);

/* ---------- a CSS gradient layer painted onto a canvas of w x h ---------- */
function paintLayer(ctx, w, h, layer, boxW, boxH) {
  const m = layer.match(/^(repeating-)?(linear|radial|conic)-gradient\((.*)\)$/s);
  if (!m) return false;
  const rep = !!m[1], kind = m[2], args = splitTop(m[3]);
  if (kind === 'linear') {
    let angle = 180, first = args[0];
    const am = first.match(/^(-?[\d.]+)deg$/);
    if (am) { angle = parseFloat(am[1]); args.shift(); }
    else if (/^to\s/.test(first)) { angle = { 'to bottom': 180, 'to top': 0, 'to right': 90, 'to left': 270 }[first] ?? 180; args.shift(); }
    angle = ((angle % 360) + 360) % 360;
    const a = angle * DEG, dx = Math.sin(a), dy = -Math.cos(a);
    const L = Math.abs(w * dx) + Math.abs(h * dy);
    const stops = resolveStops(args, rep ? 1e9 : L);
    if (!stops) return false;
    if (!rep) {
      const cx = w / 2, cy = h / 2;
      const g = ctx.createLinearGradient(cx - dx * L / 2, cy - dy * L / 2, cx + dx * L / 2, cy + dy * L / 2);
      addStops(g, stops, L);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      return true;
    }
    const P = stops[stops.length - 1].p;
    if (!(P > 0)) return false;
    const seg = (x0, y0, x1, y1, rx, ry, rw, rh) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); addStops(g, stops, P); ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh); };
    if (angle === 90) for (let x = 0; x < w; x += P) seg(x, 0, x + P, 0, x, 0, P + 0.5, h);
    else if (angle === 270) for (let x = w; x > 0; x -= P) seg(x, 0, x - P, 0, x - P - 0.5, 0, P + 0.5, h);
    else if (angle === 0) for (let y = h; y > 0; y -= P) seg(0, y, 0, y - P, 0, y - P - 0.5, w, P + 0.5);
    else if (angle === 180) for (let y = 0; y < h; y += P) seg(0, y, 0, y + P, 0, y, w, P + 0.5);
    else return false;
    return true;
  }
  if (kind === 'radial') {
    let circle = false, px = '50%', py = '50%', rxT = null, ryT = null;
    if (!COLOR_RE.test(args[0])) {
      const head = args.shift();
      circle = /circle/.test(head);
      const at = head.match(/at\s+(\S+)\s+(\S+)/); if (at) { px = at[1]; py = at[2]; }
      const sz = head.replace(/at.*/, '').match(/(-?[\d.]+(?:px|%))\s+(-?[\d.]+(?:px|%))/); if (sz) { rxT = sz[1]; ryT = sz[2]; }
    }
    const cx = lenPx(px, w), cy = lenPx(py, h), fx = Math.max(cx, w - cx), fy = Math.max(cy, h - cy);
    let rx, ry;
    if (rxT) { rx = lenPx(rxT, w); ry = lenPx(ryT, h); }
    else if (circle) rx = ry = Math.hypot(fx, fy);
    else { rx = fx * Math.SQRT2; ry = fy * Math.SQRT2; }
    if (!(rx > 0 && ry > 0)) return false;
    const stops = resolveStops(args, rx); if (!stops) return false;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); addStops(g, stops, rx);
    ctx.fillStyle = g; ctx.fillRect(-cx, -cy * rx / ry, w, h * rx / ry);
    ctx.restore();
    return true;
  }
  if (kind === 'conic' && rep) { /* the 2x2 coffee-tile checker: A on the right-top and left-bottom quadrants */
    const cols = args.map(parseStop).filter(Boolean).map((s) => s.c);
    if (cols.length < 2) return false;
    ctx.fillStyle = css(cols[1]); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = css(cols[0]); ctx.fillRect(w / 2, 0, w / 2, h / 2); ctx.fillRect(0, h / 2, w / 2, h / 2);
    return true;
  }
  return false;
}

/* paint every background layer of an element (last layer is the bottom one) */
function paintBackground(ctx, w, h, st, sx) {
  const layers = /^(initial|none)?$/.test(st.backgroundImage) ? [] : splitTop(st.backgroundImage);
  if (!layers.length && st.backgroundColor) { ctx.fillStyle = st.backgroundColor; ctx.fillRect(0, 0, w, h); return true; }
  const sizes = splitTop(st.backgroundSize || ''), poss = splitTop(st.backgroundPosition || '');
  for (let i = layers.length - 1; i >= 0; i--) {
    const sz = (sizes[i % Math.max(1, sizes.length)] || 'auto').split(/\s+/);
    const tiled = sz[0] !== 'auto' && /px$/.test(sz[0]);
    if (!tiled) { if (!paintLayer(ctx, w, h, layers[i])) return false; continue; }
    const tw = parseFloat(sz[0]), th = parseFloat(sz[1] || sz[0]);
    const tile = document.createElement('canvas'); tile.width = Math.max(1, Math.round(tw * sx)); tile.height = Math.max(1, Math.round(th * sx));
    const tctx = tile.getContext('2d'); tctx.scale(sx, sx);
    if (!paintLayer(tctx, tw, th, layers[i])) return false;
    const pos = (poss[i % Math.max(1, poss.length)] || '0px 0px').split(/\s+/);
    ctx.save(); ctx.scale(1 / sx, 1 / sx);
    const pat = ctx.createPattern(tile, 'repeat');
    pat.setTransform(new DOMMatrix().translate(lenPx(pos[0], w * sx) , lenPx(pos[1] || '0px', h * sx)));
    ctx.fillStyle = pat; ctx.fillRect(0, 0, w * sx, h * sx); ctx.restore();
  }
  return true;
}

/* ---------- CSS transform -> Matrix4 (CSS space, y down) ---------- */
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
function trMatrix(tr) {
  const M = new THREE.Matrix4(), t = new THREE.Matrix4();
  (tr || '').replace(/(\w+)\(([^)]*)\)/g, (_, fn, a) => {
    const v = a.split(',').map(parseFloat);
    if (fn === 'translate3d') t.makeTranslation(v[0], v[1], v[2]);
    else if (fn === 'translateZ') t.makeTranslation(0, 0, v[0]);
    else if (fn === 'translateX') t.makeTranslation(v[0], 0, 0);
    else if (fn === 'translateY') t.makeTranslation(0, v[0], 0);
    else if (fn === 'rotateX') t.makeRotationX(v[0] * DEG);
    else if (fn === 'rotateY') t.makeRotationY(v[0] * DEG);
    else if (fn === 'rotateZ' || fn === 'rotate') t.makeRotationZ(v[0] * DEG);
    else return _;
    M.multiply(t); return _;
  });
  return M;
}
/* geometry of one element: box, transform-origin (px) and the matrix that maps its children's frame into its parent's */
function boxOf(el) {
  const s = el.style, w = parseFloat(s.width) || 0, h = parseFloat(s.height) || 0, left = parseFloat(s.left) || 0, top = parseFloat(s.top) || 0;
  const oo = (s.transformOrigin || '').split(/\s+/);
  const ox = oo[0] ? lenPx(oo[0], w) : w / 2, oy = oo[1] ? lenPx(oo[1], h) : h / 2;
  return { w, h, left, top, ox, oy };
}
const frame = (bx, tr) => T(bx.left, bx.top, 0).multiply(T(bx.ox, bx.oy, 0)).multiply(trMatrix(tr)).multiply(T(-bx.ox, -bx.oy, 0));

/* ---------- builders ---------- */
class Bucket { /* merged opaque vertex-coloured geometry */
  constructor() { this.pos = []; this.col = []; this.idx = []; }
  quad(M, rows, w, h, horizontal) {
    /* rows: [{f, c}] gradient samples along y (or x when horizontal), f in 0..1 */
    const v = new THREE.Vector3();
    const push = (x, y, c) => { v.set(x, y, 0).applyMatrix4(M); this.pos.push(v.x, -v.y, v.z); this.col.push(c[0] / 255, c[1] / 255, c[2] / 255); return this.pos.length / 3 - 1; };
    const ids = rows.map((r) => horizontal
      ? [push(-w / 2 + r.f * w, -h / 2, r.c), push(-w / 2 + r.f * w, h / 2, r.c)]   /* [top, bottom] */
      : [push(-w / 2, -h / 2 + r.f * h, r.c), push(w / 2, -h / 2 + r.f * h, r.c)]); /* [left, right] */
    for (let i = 0; i < ids.length - 1; i++) {
      const a = ids[i], b = ids[i + 1];
      if (horizontal) { /* a:[top,bot] at left, b at right */
        this.idx.push(a[1], b[1], b[0], a[1], b[0], a[0]);
      } else { /* a:[left,right] above, b below */
        this.idx.push(b[0], b[1], a[1], b[0], a[1], a[0]);
      }
    }
  }
  poly(M, pts, cols, rowsN) { /* trapezoid tread: pts = [[x,y],...] per row pairs */
    const v = new THREE.Vector3(), base = this.pos.length / 3;
    pts.forEach((p, i) => { v.set(p[0], p[1], 0).applyMatrix4(M); this.pos.push(v.x, -v.y, v.z); const c = cols[i]; this.col.push(c[0] / 255, c[1] / 255, c[2] / 255); });
    for (let r = 0; r < rowsN - 1; r++) { const a = base + r * 2, b = a + 1, c = a + 2, d = a + 3; this.idx.push(c, d, b, c, b, a); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

const quadGeo = (w, h) => {
  const g = new THREE.BufferGeometry(), x = w / 2, y = h / 2;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};


/* gradient stops of a plain two/three-colour linear-gradient face -> rows, or null if it needs a texture */
function simpleRows(bg) {
  const layers = splitTop(bg);
  if (layers.length !== 1) return null;
  const m = layers[0].match(/^linear-gradient\((.*)\)$/s); if (!m) return null;
  const args = splitTop(m[1]); let angle = 180;
  const am = args[0].match(/^(-?[\d.]+)deg$/);
  if (am) { angle = parseFloat(am[1]); args.shift(); } else if (/^to\s/.test(args[0])) return null;
  const stops = resolveStops(args, 1); /* L=1: % -> fraction; px stops fall through to texture */
  if (!stops || args.some((a) => /px/.test(a)) || stops.some((s) => s.c[3] < 1)) return null;
  let rows = stops.map((s) => ({ f: Math.max(0, Math.min(1, s.p)), c: s.c }));
  if (rows[0].f > 0) rows.unshift({ f: 0, c: rows[0].c });
  if (rows[rows.length - 1].f < 1) rows.push({ f: 1, c: rows[rows.length - 1].c });
  if (angle === 180) return { rows, horizontal: false };
  if (angle === 90) return { rows, horizontal: true };
  if (angle === 0) return { rows: rows.map((r) => ({ f: 1 - r.f, c: r.c })).reverse(), horizontal: false };
  return null;
}

/* the SVG trapezoid treads: pull the stops and polygon back out of the data URI */
function wedgeOf(bg) {
  const m = bg.match(/url\("?data:image\/svg\+xml,([^")]+)"?\)/); if (!m) return null;
  let svg; try { svg = decodeURIComponent(m[1]); } catch (e) { return null; }
  const pts = (svg.match(/points="([^"]+)"/) || [])[1]; if (!pts) return null;
  const poly = pts.trim().split(/\s+/).map((p) => p.split(',').map(parseFloat)); /* TL, TR, BR, BL */
  const stops = []; svg.replace(/offset="([\d.]+)" stop-color="([^"]+)"/g, (_, o, c) => { stops.push({ f: parseFloat(o), c: parseColor(c) }); return _; });
  if (poly.length !== 4 || !stops.length) return null;
  return { poly, stops };
}


const bez = (x1, y1, x2, y2) => (t) => { /* CSS cubic-bezier easing */
  if (t <= 0) return 0; if (t >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let u = t;
  for (let i = 0; i < 8; i++) { const x = ((ax * u + bx) * u + cx) * u - t, d = (3 * ax * u + 2 * bx) * u + cx; if (Math.abs(x) < 1e-5 || d === 0) break; u -= x / d; }
  return ((ay * u + by) * u + cy) * u;
};
const EASE_DOOR = bez(.55, 0, .2, 1), EASE_FADE = bez(.25, .1, .25, 1);

/* draw one absolutely placed child (a handle, a hinge, wood grain) into its parent's texture */
function paintBox(ctx, c, W, H, sx) {
  const s = c.style, w = lenPx(s.width || '0', W), h = lenPx(s.height || '0', H);
  ctx.save(); ctx.translate(lenPx(s.left || '0', W), lenPx(s.top || '0', H));
  if (s.borderRadius && s.borderRadius !== '0px') {
    ctx.beginPath();
    if (/%/.test(s.borderRadius)) ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else { const r = s.borderRadius.split(/\s+/).map(parseFloat); ctx.roundRect(0, 0, w, h, r.length === 1 ? r[0] : r); }
    ctx.clip();
  }
  paintBackground(ctx, w, h, s, sx);
  ctx.restore();
}
/* the door plaque: two text spans centred in a flex row */
function paintText(ctx, el, w, h) {
  const spans = Array.from(el.children).filter((c) => !c.style.position && c.textContent.trim());
  if (!spans.length) return;
  const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
  const meas = spans.map((c) => { const cs = getComputedStyle(c); ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; return { c, cs, tw: ctx.measureText(c.textContent).width }; });
  let x = (w - meas.reduce((a, m) => a + m.tw, 0) - gap * (meas.length - 1)) / 2;
  ctx.textBaseline = 'middle';
  meas.forEach((m) => { ctx.font = m.cs.fontWeight + ' ' + m.cs.fontSize + ' ' + m.cs.fontFamily; ctx.fillStyle = m.cs.color; ctx.fillText(m.c.textContent, x, h / 2 + 1); x += m.tw + gap; });
}

export function createGL(stage, rig, opts) {
  opts = opts || {};
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: window.innerWidth >= 700, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const el = renderer.domElement;
  el.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;transition:opacity .7s ease';
  el.setAttribute('aria-hidden', 'true');
  stage.insertBefore(el, stage.firstChild);
  el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (opts.onLost) opts.onLost(); });

  const scene = new THREE.Scene();
  const root = new THREE.Group(); root.matrixAutoUpdate = false; scene.add(root);
  const camera = new THREE.PerspectiveCamera(40, 1, 30, 60000);
  const F = new THREE.Matrix4().makeScale(1, -1, 1);
  const conj = (M) => new THREE.Matrix4().copy(F).multiply(M).multiply(F); /* css-space matrix -> y-up world */
  const groups = {}, aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const track = (cls, obj) => { (groups[cls] = groups[cls] || []).push(obj); };
  const unsupportedList = [];
  let order = 0, texCount = 0;

  /* a face = one div: its box, its matrix in world css space, and what to paint */
  const faceOf = (elm, Mp, extra) => {
    const bx = boxOf(elm), M = Mp.clone().multiply(frame(bx, elm.style.transform)).multiply(T(bx.w / 2, bx.h / 2, 0));
    return Object.assign({ el: elm, w: bx.w, h: bx.h, M, bg: elm.style.backgroundImage, st: elm.style, hidden: elm.style.backfaceVisibility === 'hidden' }, extra || {});
  };

  /* sink: { bucket(double) -> Bucket | undefined, parent: Object3D, track(mesh) } */
  const emit = (f, sink) => {
    const { w, h, M, bg, st } = f;
    if (!(w > 0 && h > 0)) return null;
    const double = !f.hidden;
    if (sink.bucket && !f.image && !f.kids) {
      const plain = !st.borderRadius || st.borderRadius === '0px';
      const solid = /^(initial|none|)$/.test(bg) && st.backgroundColor ? parseColor(st.backgroundColor) : null;
      const rows = plain && (!st.clipPath || st.clipPath === 'none') ? (solid && solid[3] === 1 ? { rows: [{ f: 0, c: solid }, { f: 1, c: solid }], horizontal: false } : simpleRows(bg)) : null;
      if (rows) { sink.bucket(double).quad(M, rows.rows, w, h, rows.horizontal); return null; }
      const wd = wedgeOf(bg);
      if (wd) {
        const pts = [], cols = [];
        wd.stops.forEach((s) => { const fy = s.f, xl = wd.poly[0][0] * (1 - fy) + wd.poly[3][0] * fy, xr = wd.poly[1][0] * (1 - fy) + wd.poly[2][0] * fy; pts.push([(xl / 100 - .5) * w, (fy - .5) * h], [(xr / 100 - .5) * w, (fy - .5) * h]); cols.push(s.c, s.c); });
        sink.bucket(double).poly(M, pts, cols, wd.stops.length);
        return null;
      }
    }
    const sx = Math.min(f.scale || 1, (f.maxDim || 1024) / Math.max(w, h));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * sx)); cv.height = Math.max(1, Math.ceil(h * sx));
    const ctx = cv.getContext('2d'); ctx.scale(sx, sx);
    ctx.save();
    if (st.clipPath && st.clipPath.startsWith('polygon')) {
      const pts = splitTop(st.clipPath.replace(/^polygon\(|\)$/g, '')).map((p) => p.split(/\s+/));
      ctx.beginPath(); pts.forEach((p, i) => { const x = lenPx(p[0], w), y = lenPx(p[1], h); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.clip();
    }
    if (st.borderRadius && st.borderRadius !== '0px') {
      ctx.beginPath();
      if (/%/.test(st.borderRadius)) ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else { const r = st.borderRadius.split(/\s+/).map(parseFloat); ctx.roundRect(0, 0, w, h, r.length === 1 ? r[0] : r); }
      ctx.clip();
    }
    if (!paintBackground(ctx, w, h, st, sx)) { ctx.restore(); unsupportedList.push(bg.slice(0, 40) + ' | ' + (f.el.getAttribute('style') || '').slice(0, 160)); return null; }
    if (f.kids) { Array.from(f.el.children).forEach((c) => { if (c.style.position === 'absolute') paintBox(ctx, c, w, h, sx); }); paintText(ctx, f.el, w, h); }
    if (f.image) ctx.drawImage(f.image, 0, 0, w, h);
    ctx.restore();
    const bottom = splitTop(bg).pop() || '', bm = bottom.match(/\((.*)\)$/s);
    const bstops = bm ? splitTop(bm[1]).map(parseStop).filter(Boolean) : [];
    const opaque = bstops.length > 0 && bstops.every((s) => s.c[3] >= 1) && !st.clipPath.startsWith('polygon') && (!st.borderRadius || st.borderRadius === '0px');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = aniso; tex.premultiplyAlpha = !opaque; /* a fully opaque texture needs no conversion on upload */
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: opaque, side: double ? THREE.DoubleSide : THREE.FrontSide });
    mat.blending = THREE.CustomBlending; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneMinusSrcAlphaFactor; mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; /* the texture is already premultiplied */
    const mesh = new THREE.Mesh(quadGeo(w, h), mat);
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(conj(M)); mesh.renderOrder = opaque ? 1 : 2 + (order++ / 100000);
    sink.parent.add(mesh); if (sink.track) sink.track(mesh); texCount++;
    return mesh;
  };

  const I = new THREE.Matrix4();
  const buckets = {};
  const bucketFor = (cls, double) => { const k = cls + '|' + (double ? 2 : 1); return buckets[k] || (buckets[k] = { cls, double, b: new Bucket() }); };
  const finish = (bk, parent, useCls) => Object.values(bk).forEach((x) => {
    const mesh = new THREE.Mesh(x.b.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: x.double ? THREE.DoubleSide : THREE.FrontSide }));
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; parent.add(mesh); if (useCls) track(x.cls, mesh);
  });

  /* ---------- doors: static frame + recess, a hinged leaf, a light spill that fades in ---------- */
  const doors = [];
  const buildDoor = (g) => {
    const grp = new THREE.Group(); root.add(grp);
    const Mg = frame(boxOf(g), g.style.transform), local = {}, d = { el: g, grp, leaf: null, spill: null };
    const sink = { bucket: (dbl) => (local[dbl ? 2 : 1] || (local[dbl ? 2 : 1] = { double: dbl, b: new Bucket() })).b, parent: grp };
    Array.from(g.children).forEach((c) => {
      if (c.style.transformStyle === 'preserve-3d' && c.children.length) { /* the hinged leaf */
        const bx = boxOf(c), obj = new THREE.Object3D(); obj.matrixAutoUpdate = false; grp.add(obj);
        const leaf = { el: c, obj, bx, angle: 0, from: 0, to: 0, t0: 0 };
        Array.from(c.children).forEach((ch) => emit(faceOf(ch, I, { kids: ch.children.length > 0, scale: 4 }), { parent: obj }));
        leaf.set = (a) => {
          const tr = c.style.transform.replace(/rotateY\([^)]*\)/, 'rotateY(' + a + 'deg)');
          obj.matrix.copy(conj(Mg.clone().multiply(T(bx.left, bx.top, 0)).multiply(T(bx.ox, bx.oy, 0)).multiply(trMatrix(tr)).multiply(T(-bx.ox, -bx.oy, 0))));
        };
        const m0 = c.style.transform.match(/rotateY\(([-\d.]+)deg\)/);
        leaf.angle = leaf.from = leaf.to = m0 ? parseFloat(m0[1]) : 0; leaf.set(leaf.angle);
        d.leaf = leaf; return;
      }
      if (c.style.opacity !== '') { /* the warm light spill on the landing */
        const mesh = emit(faceOf(c, Mg), { parent: grp });
        if (mesh) { const v = parseFloat(c.style.opacity); mesh.material.color.setScalar(v); mesh.material.opacity = v; d.spill = { el: c, mesh, v, from: v, to: v, t0: 0 }; }
        return;
      }
      emit(faceOf(c, Mg, { kids: c.children.length > 0, scale: 4 }), sink);
    });
    finish(local, grp, false);
    doors.push(d);
  };

  Array.from(rig.children).forEach((c) => {
    if (c.id === 'hs-props') return;
    if (c.classList.contains('hs-paint')) {
      emit(faceOf(c, I, { image: opts.paints && opts.paints.get(c), maxDim: 4096 }), { parent: root });
    } else if (!c.children.length) {
      const cls = c.className || '';
      emit(faceOf(c, I), { bucket: (dbl) => bucketFor(cls, dbl).b, parent: root, track: (m) => track(cls, m) });
    } else buildDoor(c);
  });

  /* ---------- props: baked planes + animated fire, flames, glows, sparks, camera-facing people ---------- */
  const anims = [], billboards = [];
  const buildProps = (propsEl, baked) => {
    const mk = (cv, w, h, M, o) => {
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = aniso; tex.premultiplyAlpha = !o.opaque;
      if (o.tex) o.tex(tex);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: !!o.opaque, side: o.double === false ? THREE.FrontSide : THREE.DoubleSide });
      mat.blending = THREE.CustomBlending; mat.blendSrc = THREE.OneFactor; mat.blendSrcAlpha = THREE.OneFactor;
      mat.blendDst = o.additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor; mat.blendDstAlpha = mat.blendDst;
      if (o.sprite) { mat.alphaTest = 0.2; mat.depthWrite = true; } /* camera-facing cut-outs occlude what is behind them */
      const mesh = new THREE.Mesh(quadGeo(w, h), mat);
      mesh.matrixAutoUpdate = false; mesh.matrix.copy(conj(M)); mesh.renderOrder = o.order || 2;
      return mesh;
    };
    const opaqueOf = (el) => {
      const st = el.style, c = parseColor(st.backgroundColor || '');
      if (c && c[3] >= 1) return true;
      const bottom = splitTop(st.backgroundImage || '').pop() || '', bm = bottom.match(/\((.*)\)$/s);
      const stops = bm ? splitTop(bm[1]).map(parseStop).filter(Boolean) : [];
      return stops.length > 0 && stops.every((s) => s.c[3] >= 1);
    };
    const EASE_IO = bez(.42, 0, .58, 1), frac = (x) => x - Math.floor(x);
    const lerpKeys = (keys, f, i) => { /* keys: [[t, v...]], ease-in-out between neighbours */
      for (let k = 0; k < keys.length - 1; k++) if (f <= keys[k + 1][0]) { const a = keys[k], b = keys[k + 1], u = EASE_IO((f - a[0]) / (b[0] - a[0])); return a[i] + (b[i] - a[i]) * u; }
      return keys[keys.length - 1][i];
    };
    const FLAME = [[0, 1, 1, 0], [.2, .9, 1.1, 4], [.45, 1.06, .93, -3], [.7, .95, 1.07, 2], [1, 1, 1, 0]];
    const GLOW = [[0, 1], [.3, .8], [.55, .95], [.8, .74], [1, 1]];
    const tm = (el, prop, dflt) => { const v = parseFloat(el.style[prop]); return isNaN(v) ? dflt : v; };
    let sparkTex = null;

    /* an animated child: `Mbox` is the css matrix of the frame it is positioned in (top-left origin), (ox, oy) its offset in that frame */
    const addAnim = (a, Mbox, ox, oy, parent, cont) => {
      const w = parseFloat(a.style.width) || 0, h = parseFloat(a.style.height) || 0, data = baked.get(a);
      const dur = tm(a, 'animationDuration', NaN), delay = tm(a, 'animationDelay', 0);
      const Mc = Mbox.clone().multiply(T(ox + w / 2, oy + h / 2, 0.6));
      if (a.classList.contains('hs-sp')) {
        if (!sparkTex) { const c = document.createElement('canvas'); c.width = 4; c.height = 32; const x = c.getContext('2d'), g = x.createLinearGradient(0, 32, 0, 0); g.addColorStop(0, '#FF9A2E'); g.addColorStop(1, '#FFF0B8'); x.fillStyle = g; x.fillRect(1, 0, 2, 32); sparkTex = c; }
        const sw = Math.max(w, 2), mesh = mk(sparkTex, sw, h, Mc, { additive: true, order: 4 });
        parent.add(mesh);
        const sx = parseFloat(a.style.getPropertyValue('--sx')) || 0, ry = parseFloat(a.style.getPropertyValue('--ry')) || -70, rot = parseFloat(a.style.getPropertyValue('--rot')) || 0;
        const d = tm(a, 'animationDuration', 2.6) * (/ms/.test(a.style.animationDuration) ? .001 : 1), dl = parseFloat(a.style.animationDelay) || 0;
        const easeOut = bez(0, 0, .58, 1);
        anims.push({ cont, tick(t) {
          const f = frac((t - dl) / d), p = easeOut(f);
          const op = f < .08 ? easeOut(f / .08) : 1 - easeOut((f - .08) / .92);
          mesh.matrix.copy(conj(Mbox.clone().multiply(T(ox + sx * p + w / 2, oy + ry * p + h / 2, 0.8)).multiply(new THREE.Matrix4().makeRotationZ(rot * DEG))));
          mesh.material.color.setScalar(op); mesh.material.opacity = op;
        } });
        return;
      }
      if (!data) return;
      if (a.classList.contains('hs-fire')) {
        const rows = data.fire.rows;
        const mesh = mk(data.fire.atlas, w, h, Mc, { additive: true, order: 5, tex: (t) => { t.repeat.set(1 / FIRE_COLS, 1 / rows); } });
        parent.add(mesh);
        anims.push({ cont, tick(t) { const i = Math.floor(frac(t / 1.75) * FIRE_FRAMES); mesh.material.map.offset.set((i % FIRE_COLS) / FIRE_COLS, 1 - (Math.floor(i / FIRE_COLS) + 1) / rows); } });
        return;
      }
      if (a.classList.contains('hs-fl')) {
        const mesh = mk(data.cv, w, h, Mc, { order: 4 }); parent.add(mesh);
        const d = isNaN(dur) ? 1.1 : dur * (/ms/.test(a.style.animationDuration) ? .001 : 1), ox2 = w / 2, oy2 = h;
        anims.push({ cont, tick(t) {
          const f = frac((t - delay) / d), sx = lerpKeys(FLAME, f, 1), sy = lerpKeys(FLAME, f, 2), sk = lerpKeys(FLAME, f, 3) * DEG;
          const S = new THREE.Matrix4().makeScale(sx, sy, 1), K = new THREE.Matrix4().set(1, Math.tan(sk), 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
          mesh.matrix.copy(conj(Mbox.clone().multiply(T(ox, oy, 0.6)).multiply(T(ox2, oy2, 0)).multiply(S).multiply(K).multiply(T(-ox2, -oy2, 0)).multiply(T(w / 2, h / 2, 0))));
        } });
        return;
      }
      /* glow */
      const mesh = mk(data.cv, w, h, Mc, { order: 3 }); parent.add(mesh);
      anims.push({ cont, tick(t) { const o = lerpKeys(GLOW, frac(t / 2.3), 1); mesh.material.color.setScalar(o); mesh.material.opacity = o; } });
    };

    const walk = (el, Mp, parent, cont) => {
      Array.from(el.children).forEach((c) => {
        const bx = boxOf(c);
        if (isAnim(c)) { addAnim(c, Mp.clone().multiply(frame(bx, c.style.transform)), 0, 0, parent, cont); return; }
        if (isGroup(c)) {
          if (c.classList.contains('hs-pp')) { /* faces the camera: the page rewrites its rotateY every frame */
            const obj = new THREE.Object3D(); obj.matrixAutoUpdate = false; parent.add(obj);
            const bb = { el: c, obj, Mp: Mp.clone(), last: null };
            billboards.push(bb);
            walk(c, I, obj, cont);
            return;
          }
          walk(c, Mp.clone().multiply(frame(bx, c.style.transform)), parent, cont);
          return;
        }
        const data = baked.get(c);
        if (!data) return;
        const Mf = Mp.clone().multiply(frame(bx, c.style.transform)), M = Mf.clone().multiply(T(bx.w / 2, bx.h / 2, 0));
        parent.add(mk(data.cv, bx.w, bx.h, M, { opaque: opaqueOf(c), sprite: parent !== cont, double: c.style.backfaceVisibility !== 'hidden', order: opaqueOf(c) ? 1 : 2 }));
        c.querySelectorAll(ANIM.map((k) => '.' + k).join(',')).forEach((a) => { const o = offsetIn(a, c); addAnim(a, Mf, o.x, o.y, parent, cont); });
      });
    };
    Array.from(propsEl.children).forEach((g) => {
      const cont = new THREE.Object3D(); root.add(cont); track(g.className || '', cont);
      walk({ children: [g] }, I, cont, cont);
    });
  };
  if (opts.props) buildProps(opts.props.el, opts.props.baked);
  const t0 = performance.now(); let lastAnim = 0;

  finish(buckets, root, true);

  const tmp = new THREE.Matrix4(), t2 = new THREE.Matrix4();
  let W = 0, Hh = 0;
  const api = {
    canvas: el, unsupported: unsupportedList,
    get stats() { return { textured: texCount, buckets: Object.keys(buckets).length, doors: doors.length, unsupported: unsupportedList.length }; },
    /* upload textures and compile shaders a few at a time so the page never freezes for one long task */
    async warm(W0, H0) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
      renderer.setSize(W0, H0, false);
      await new Promise((r) => setTimeout(r, 0));
      const texs = []; scene.traverse((o) => { if (o.material && o.material.map) texs.push(o.material.map); });
      let t = performance.now();
      for (const tx of texs) { renderer.initTexture(tx); if (performance.now() - t > 6) { await new Promise((r) => setTimeout(r, 0)); t = performance.now(); } }
      try { await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera))); } catch (e) { /* first render will compile */ } /* parallel shader compile: no main-thread stall */
    },
    setHidden(classes) {
      const hide = new Set(classes);
      Object.keys(groups).forEach((k) => { if (!k) return; const v = !hide.has(k); groups[k].forEach((o) => { o.visible = v; }); });
    },
    /* advance door and light-spill animations toward what React put in the DOM; true while anything moved */
    step(now) {
      let dirty = false;
      billboards.forEach((bb) => {
        const tr = bb.el.style.transform;
        if (tr !== bb.last) { bb.last = tr; bb.obj.matrix.copy(conj(bb.Mp.clone().multiply(frame(boxOf(bb.el), tr)))); dirty = true; }
      });
      if (anims.length && now - lastAnim > 33) {
        lastAnim = now; const t = (now - t0) / 1000; let any = false;
        anims.forEach((a) => { if (a.cont.visible) { a.tick(t); any = true; } });
        if (any) dirty = true;
      }
      doors.forEach((d) => {
        const vis = d.el.style.display !== 'none';
        if (d.grp.visible !== vis) { d.grp.visible = vis; dirty = true; }
        const L = d.leaf;
        if (L) {
          const m = L.el.style.transform.match(/rotateY\(([-\d.]+)deg\)/), target = m ? parseFloat(m[1]) : 0;
          if (target !== L.to) { L.from = L.angle; L.to = target; L.t0 = now; L.fast = /^none/.test(L.el.style.transition || ''); }
          if (L.angle !== L.to) { const k = L.fast ? 1 : Math.min(1, (now - L.t0) / 1150); L.angle = k >= 1 ? L.to : L.from + (L.to - L.from) * EASE_DOOR(k); L.set(L.angle); dirty = true; }
        }
        const S = d.spill;
        if (S) {
          const target = parseFloat(S.el.style.opacity) || 0;
          if (target !== S.to) { S.from = S.v; S.to = target; S.t0 = now; }
          if (S.v !== S.to) { const k = Math.min(1, (now - S.t0) / 1000); S.v = k >= 1 ? S.to : S.from + (S.to - S.from) * EASE_FADE(k); S.mesh.material.color.setScalar(S.v); S.mesh.material.opacity = S.v; dirty = true; }
        }
      });
      return dirty;
    },
    /* c: P (perspective px), pitch/alpha deg, X/h/Z camera translation, W/Hh stage px, frac vertical origin (0..1) */
    render(c) {
      api.last = c;
      if (c.W !== W || c.Hh !== Hh) {
        W = c.W; Hh = c.Hh;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
        renderer.setSize(W, Hh, false);
      }
      tmp.makeTranslation(0, 0, c.P);
      tmp.multiply(t2.makeRotationX(c.pitch * DEG)).multiply(t2.makeRotationY(c.alpha * DEG))
        .multiply(t2.makeTranslation(-c.X, c.h, c.P - c.Z)).multiply(t2.makeTranslation(0, 0, -c.P));
      root.matrix.copy(F).multiply(tmp).multiply(F);
      root.matrixWorldNeedsUpdate = true;
      camera.fov = 2 * Math.atan(Hh / (2 * c.P)) / DEG;
      camera.aspect = W / Hh;
      camera.position.set(0, 0, c.P);
      if (Math.abs(c.frac - 0.5) > 1e-3) camera.setViewOffset(W, Hh, 0, (0.5 - c.frac) * Hh, W, Hh); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
    dispose() { if (el.parentNode) el.parentNode.removeChild(el); renderer.dispose(); }
  };
  return api;
}


/* ---------- props: hearth, fireplace, people, chandelier ----------
   The props are nested CSS planes with a few animated parts. Static planes are baked to textures (the browser paints
   them), the animated parts (fire, flames, glows, sparks) become small sprites that follow the same CSS keyframes. */
export const ANIM = ['hs-fire', 'hs-fl', 'hs-sp', 'hs-gl'];
export const isAnim = (el) => ANIM.some((c) => el.classList.contains(c));
export const isGroup = (el) => el.style.transformStyle === 'preserve-3d' || el.classList.contains('hs-pp') || (!parseFloat(el.style.width) && !parseFloat(el.style.height) && el.children.length > 0);
export const FIRE_FRAMES = 24, FIRE_COLS = 6;

const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const svgImg = (w, h, xml) => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' + xml + '</foreignObject></svg>'));
const blobData = (url) => fetch(url).then((r) => r.blob()).then((b) => new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }));

/* where (px, from the top-left of `plane`) a nested absolutely placed child sits */
export function offsetIn(el, plane) {
  let x = 0, y = 0, n = el;
  while (n && n !== plane) {
    const p = n.parentElement, s = n.style, h = parseFloat(s.height) || 0, ph = parseFloat(p.style.height) || 0;
    x += parseFloat(s.left) || 0;
    y += s.bottom !== '' ? ph - (parseFloat(s.bottom) || 0) - h : (parseFloat(s.top) || 0);
    n = p;
  }
  return { x, y };
}

/* paint one plane (minus its animated children and <img>s) into a canvas */
async function bakePlane(el, w, h, sx) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll(ANIM.map((c) => '.' + c).join(',')).forEach((n) => n.remove());
  const imgs = Array.from(el.querySelectorAll('img')).map((i) => ({ i, left: parseFloat(i.style.left) || 0, w: parseFloat(i.style.width), h: parseFloat(i.style.height), bottom: parseFloat(i.style.bottom) || 0, filter: i.style.filter }));
  clone.querySelectorAll('img').forEach((n) => n.remove());
  clone.style.left = '0px'; clone.style.top = '0px'; clone.style.transform = 'none'; clone.style.bottom = 'auto'; clone.style.opacity = '1'; clone.style.animation = 'none';
  const box = document.createElement('div'); box.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  box.style.cssText = 'position:relative;width:' + w + 'px;height:' + h + 'px;overflow:hidden';
  box.appendChild(clone);
  const img = await svgImg(w, h, new XMLSerializer().serializeToString(box));
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * sx); cv.height = Math.ceil(h * sx);
  const ctx = cv.getContext('2d'); ctx.scale(sx, sx);
  if (img) ctx.drawImage(img, 0, 0, w, h);
  for (const m of imgs) { const pic = await loadImg(m.i.src); if (pic) { ctx.save(); if (m.filter) ctx.filter = m.filter; ctx.drawImage(pic, m.left, h - m.bottom - m.h, m.w, m.h); ctx.restore(); } }
  return cv;
}

/* 24 frames of the real CSS fire (noise tiles, blend modes, filter) laid out in one atlas */
async function bakeFire(el, w, h, sx) {
  const cs = getComputedStyle(el), noise = await blobData('./assets/fire-noise.webp');
  const fw = Math.ceil(w * sx), fh = Math.ceil(h * sx), rows = Math.ceil(FIRE_FRAMES / FIRE_COLS);
  const atlas = document.createElement('canvas'); atlas.width = fw * FIRE_COLS; atlas.height = fh * rows;
  const actx = atlas.getContext('2d');
  const mask = cs.webkitMaskImage && cs.webkitMaskImage !== 'none' ? cs.webkitMaskImage : cs.maskImage;
  const frames = await Promise.all(Array.from({ length: FIRE_FRAMES }, (_, i) => {
    const t = i / FIRE_FRAMES;
    const style = 'position:absolute;left:0;top:0;width:' + w + 'px;height:' + h + 'px;overflow:hidden;background-image:' + cs.backgroundImage.replace(/url\([^)]*fire-noise[^)]*\)/g, 'url(' + noise + ')') +
      ';background-size:' + cs.backgroundSize + ';background-blend-mode:' + cs.backgroundBlendMode + ';background-repeat:' + cs.backgroundRepeat +
      ';background-position:0 ' + (-124 * t) + 'px,0 ' + (-160 * t) + 'px,50% 100%,50% 50%;mix-blend-mode:screen;filter:' + cs.filter + ';-webkit-mask-image:' + mask + ';mask-image:' + mask;
    return svgImg(w, h, '<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:' + w + 'px;height:' + h + 'px;isolation:isolate"><div style="' + style.replace(/"/g, "'") + '"></div></div>');
  }));
  frames.forEach((im, i) => { if (im) actx.drawImage(im, (i % FIRE_COLS) * fw, Math.floor(i / FIRE_COLS) * fh, fw, fh); });
  return { atlas, rows };
}

/* bake everything the props need; returns Map(element -> data) */
export async function bakeProps(propsEl) {
  const out = new Map(), jobs = [];
  const sxFor = (w, h) => Math.min(2, 1024 / Math.max(w, h));
  const walk = (el) => {
    Array.from(el.children).forEach((c) => {
      if (isAnim(c)) { jobs.push(animJob(c)); return; }
      if (isGroup(c)) { walk(c); return; }
      const w = parseFloat(c.style.width), h = parseFloat(c.style.height);
      if (w > 0 && h > 0) {
        jobs.push(bakePlane(c, w, h, sxFor(w, h)).then((cv) => out.set(c, { cv, w, h })));
        c.querySelectorAll(ANIM.map((k) => '.' + k).join(',')).forEach((a) => jobs.push(animJob(a)));
      }
    });
  };
  const animJob = (a) => {
    const w = parseFloat(a.style.width), h = parseFloat(a.style.height);
    if (a.classList.contains('hs-sp')) return Promise.resolve();
    if (a.classList.contains('hs-fire')) return bakeFire(a, w, h, 2).then((r) => out.set(a, { fire: r, w, h }));
    if (a.classList.contains('hs-fl')) { /* flame sprite: an SVG background set by a stylesheet rule */
      const url = (getComputedStyle(a).backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1];
      return loadImg(url).then((im) => { const cv = document.createElement('canvas'); cv.width = Math.ceil(w * 3); cv.height = Math.ceil(h * 3); if (im) cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); out.set(a, { cv, w, h }); });
    }
    return bakePlane(a, w, h, sxFor(w, h)).then((cv) => out.set(a, { cv, w, h })); /* glows */
  };
  walk(propsEl);
  await Promise.all(jobs);
  return out;
}

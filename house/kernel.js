/* Renderer kernel: one WebGL canvas, a render-on-demand loop, and a frame-time governor.
   Nothing here knows about the house. Callers register `tick(now, dt)` functions; a tick returns true while it is still
   animating. When no tick is animating and nothing invalidated the view, the loop stops and the GPU is idle. */
import * as THREE from '../vendor/three.module.min.js';

/* pass authored sRGB values straight through, as the old CSS scene did */
THREE.ColorManagement.enabled = false;

export function hasWebGL() {
  try {
    const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl');
    if (!g) return false;
    const x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext();
    return true;
  } catch (e) { return false; }
}

export function createKernel(host, opts) {
  opts = opts || {};
  const coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  /* the scene is flat-shaded and cheap to fill, so phones can afford 2x; below that, text on the sign and the plaques goes soft */
  const dprMax = Math.min(window.devicePixelRatio || 1, 2);
  /* pixel-ratio ladder the governor steps down through; phones never drop under 1.5, where the picture is still clean enough */
  const levels = [dprMax, Math.min(dprMax, 1.75), Math.min(dprMax, 1.5), coarse ? 1.5 : 1.25, coarse ? 1.5 : 1].filter((v, i, a) => i === 0 || v < a[i - 1]);
  let lvl = 0;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;outline:none';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse || dprMax < 2, powerPreference: 'high-performance', alpha: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x0b0e24, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 5, 20000);

  const stats = { frames: 0, ms: 16.7, fps: 60, lvl: 0, dpr: levels[0], calls: 0, tris: 0, lost: false };
  const ticks = [];
  let lastAmb = 0, raf = 0, dirty = true, inFrame = false, alive = true, lastT = 0, lastRender = 0, slow = 0, lastDrop = 0;

  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(levels[lvl]);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 62 : 48; /* tall phone screens need a wider lens to keep the door in frame */
    camera.updateProjectionMatrix();
    stats.dpr = levels[lvl];
    invalidate();
  };

  /* governor: if rendered frames keep taking >22 ms, step the pixel ratio down one rung (never back up in a session) */
  const govern = (now) => {
    if (lastRender && now > lastRender && now - lastRender < 40) {
      const dt = now - lastRender;
      stats.ms += (dt - stats.ms) * 0.08;
      stats.fps = 1000 / stats.ms;
      if (stats.ms > 22) slow++; else slow = Math.max(0, slow - 2);
      if (slow > 45 && lvl < levels.length - 1 && now - lastDrop > 1500) { lvl++; slow = 0; lastDrop = now; stats.lvl = lvl; stats.ms = 16.7; resize(); }
    }
    lastRender = now;
  };

  const frame = (now) => {
    raf = 0;
    if (!alive || stats.lost) return;
    const dt = Math.min(0.1, (now - (lastT || now)) / 1000); lastT = now;
    let busy = false, ambient = false;
    inFrame = true;
    /* a tick returns true for motion, or 2 for ambient animation (fire), which is capped to 30 fps and never judged by the governor */
    for (let i = 0; i < ticks.length; i++) { const r = ticks[i](now, dt); if (r === 2) ambient = true; else if (r) busy = true; }
    inFrame = false;
    const skip = !busy && !dirty && ambient && now - lastAmb < 32;
    if (skip) { raf = requestAnimationFrame(frame); return; }
    if (busy || dirty || ambient) {
      const ambOnly = ambient && !busy && !dirty;
      if (ambOnly) lastAmb = now;
      dirty = false;
      renderer.render(scene, camera);
      stats.frames++; stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
      if (ambOnly) lastRender = 0; else govern(now);
    } else lastRender = 0;
    if (busy || ambient) raf = requestAnimationFrame(frame); else lastT = 0;
  };
  function invalidate() { dirty = true; if (!raf && !inFrame && alive && !stats.lost) raf = requestAnimationFrame(frame); }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stats.lost = true; if (opts.onLost) opts.onLost(); });
  canvas.addEventListener('webglcontextrestored', () => { stats.lost = false; invalidate(); });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(host); else window.addEventListener('resize', resize);
  resize();

  return {
    THREE, renderer, scene, camera, canvas, stats,
    addTick(fn) { ticks.push(fn); invalidate(); },
    invalidate, govern,
    dispose() { alive = false; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); }); renderer.dispose(); canvas.remove(); }
  };
}

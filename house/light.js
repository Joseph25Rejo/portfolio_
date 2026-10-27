/* Baked lighting. Every static surface is shaded once, on the CPU, into vertex colours; the GPU then draws plain
   unlit triangles. A "light" is a point with a colour, an intensity and a radius. */
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const lights = [];
export const addLight = (p, col, I, R) => lights.push({ p, col, I, R });

/* moonlight direction (from the scene towards the moon): west, 22 degrees up */
export const MOON = [Math.cos(22 * Math.PI / 180), Math.sin(22 * Math.PI / 180), 0];

export const INT = { amb: [0.74, 0.72, 0.78] };
export const extAmb = (n) => { const m = Math.max(0, n[0] * MOON[0] + n[1] * MOON[1] + n[2] * MOON[2]); return { amb: [0.34 + 0.3 * m, 0.38 + 0.32 * m, 0.55 + 0.35 * m] }; };

/* albedo (0..255) lit at point p with normal n -> vertex colour (0..255) */
export function shade(alb, p, n, o) {
  let r = o.amb[0], g = o.amb[1], b = o.amb[2];
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i], dx = l.p[0] - p[0], dy = l.p[1] - p[1], dz = l.p[2] - p[2], d = Math.hypot(dx, dy, dz);
    if (d >= l.R || d < 1e-6) continue;
    let f = 1 - d / l.R; f *= f;
    const k = l.I * f * (0.35 + 0.65 * Math.max(0, (n[0] * dx + n[1] * dy + n[2] * dz) / d));
    r += l.col[0] * k; g += l.col[1] * k; b += l.col[2] * k;
  }
  return [Math.min(255, alb[0] * r), Math.min(255, alb[1] * g), Math.min(255, alb[2] * b)];
}

/* a little deterministic grain so flat colour does not look printed */
export const grain = (p, amt) => 1 + amt * (((Math.sin(p[0] * 12.9898 + p[1] * 78.233 + p[2] * 37.719) * 43758.5453) % 1) - 0.5);

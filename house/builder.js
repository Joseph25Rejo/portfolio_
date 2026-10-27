/* Collects coloured quads into one BufferGeometry. Quads are subdivided so baked lighting is smooth, and a `hint`
   normal fixes the winding, so callers never have to think about which way a face points. */
import * as THREE from '../vendor/three.module.min.js';

export class Builder {
  constructor() { this.p = []; this.c = []; this.i = []; this.v = 0; }

  /* corners a,b,c,d go round the quad; col(p, n, s, t) returns [r,g,b] 0..255 */
  quad(a, b, c, d, col, nu, nv, hint) {
    nu = nu || 1; nv = nv || 1;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-6) { nx = hint[0]; ny = hint[1]; nz = hint[2]; } else { nx /= l; ny /= l; nz /= l; }
    let flip = false;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) { flip = true; nx = -nx; ny = -ny; nz = -nz; }
    const n = [nx, ny, nz], base = this.v;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const s = i / nu, t = j / nv, p = [0, 0, 0];
      for (let k = 0; k < 3; k++) { const lo = a[k] + (b[k] - a[k]) * s, hi = d[k] + (c[k] - d[k]) * s; p[k] = lo + (hi - lo) * t; }
      const rgb = col(p, n, s, t);
      this.p.push(p[0], p[1], p[2]); this.c.push(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
    }
    this.v += (nu + 1) * (nv + 1);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const i0 = base + j * (nu + 1) + i, i1 = i0 + 1, i2 = i0 + nu + 1, i3 = i2 + 1;
      if (flip) this.i.push(i0, i3, i1, i0, i2, i3); else this.i.push(i0, i1, i3, i0, i3, i2);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
  get tris() { return this.i.length / 3; }
}

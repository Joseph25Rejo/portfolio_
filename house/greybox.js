/* Grey-box stand-in for the house: just enough geometry to judge the camera. Phase 2 replaces it with the real shell.
   Everything is instanced or merged: the whole scene is a handful of draw calls. */
import * as THREE from '../vendor/three.module.min.js';
import { D, RISE, FH, NS, DTH, APO, NF, TOP, DOOR, DOORS, FRONT, HEARTH } from './layout.js';

export function buildGreybox(scene) {
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x3a2a1c, 1.5));
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.6); sun.position.set(-600, 1500, 900); scene.add(sun);

  /* street and the floor inside the tower */
  const ground = new THREE.Mesh(new THREE.CircleGeometry(5000, 48), new THREE.MeshLambertMaterial({ color: 0x1a2236 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1; scene.add(ground);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(APO, 48), new THREE.MeshLambertMaterial({ color: 0x5a3c2a }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  /* the tower as wire: 20 verticals and a ring per floor, one draw call */
  const pts = [];
  for (let m = 0; m < 20; m++) { const a = m * 18 * D, x = APO * Math.sin(a), z = APO * Math.cos(a); pts.push(x, 0, z, x, TOP, z); }
  for (let f = 0; f <= NF; f++) for (let i = 0; i < 48; i++) {
    const a0 = i / 48 * Math.PI * 2, a1 = (i + 1) / 48 * Math.PI * 2, y = Math.min(f * FH, TOP);
    pts.push(APO * Math.sin(a0), y, APO * Math.cos(a0), APO * Math.sin(a1), y, APO * Math.cos(a1));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8a7a5a })));

  /* stair treads: one instanced mesh */
  const treads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x6a4a36 }), (NF - 1) * NS);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let k = 0; k < NF - 1; k++) for (let j = 1; j <= NS; j++) {
    const az = (180 * k + 10 + DTH * (j - 1) + DTH / 2) * D;
    q.setFromAxisAngle(up, az); p.set(450 * Math.sin(az), FH * k + RISE * j - 7, 450 * Math.cos(az)); s.set(2 * 450 * Math.sin(DTH / 2 * D) * 1.01, 14, 400);
    treads.setMatrixAt(n++, m.compose(p, q, s));
  }
  scene.add(treads);

  /* doors (gold), the front door (red) and the hearth corner (orange): one instanced mesh */
  const slabs = [].concat(DOORS.map((d) => ({ c: d.center, az: d.az, col: 0xd6b25e, w: DOOR.w, h: DOOR.h, t: 12 })),
    [{ c: FRONT.center, az: FRONT.az, col: 0xc0452e, w: DOOR.w, h: DOOR.h, t: 12 }, { c: HEARTH.center, az: HEARTH.az, col: 0xff8a2a, w: 220, h: 300, t: 40 }]);
  const door = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), slabs.length);
  slabs.forEach((d, i) => {
    q.setFromAxisAngle(up, d.az * D); p.set(d.c[0] * 0.995, d.c[1], d.c[2] * 0.995); s.set(d.w, d.h, d.t);
    door.setMatrixAt(i, m.compose(p, q, s)); door.setColorAt(i, new THREE.Color(d.col));
  });
  scene.add(door);
  return { treads, door };
}

/* The hall: a fireplace on the oak wall with a living fire, a framed portrait above it, a rug, and five people
   gathered in the corner to its right, out of the way of the path. Furniture is baked into the shared mesh; the fire,
   the sparks and the people are three small extra draws. */
import * as THREE from '../vendor/three.module.min.js';
import { addLight, shade, hex, grain, INT } from './light.js';
import { D, APO, HEARTH } from './layout.js';

const AZ = HEARTH.az;
const sinz = (a) => Math.sin(a * D), cosz = (a) => Math.cos(a * D);
/* a point in the hearth frame: lat to the right as seen from inside, y up, d = how far into the room from the wall */
const hf = (lat, y, d) => [(APO - d) * sinz(AZ) - lat * cosz(AZ), y, (APO - d) * cosz(AZ) + lat * sinz(AZ)];

export function hallLights() {
  addLight(hf(0, 50, 60), [1, 0.45, 0.15], 1.3, 170);   /* inside the firebox: brick glows */
  addLight(hf(0, 110, 150), [1, 0.58, 0.26], 0.9, 520); /* the room */
}

const SOFA_D = 190; /* front edge of the seat cushions */
const PEOPLE = [
  /* sprite, lat, d, width, height, seat: two groups on sofas either side of the fire, sat right against the cushions */
  ['stand', -178, 92, 87.5, 255, null],
  ['mug', -276, SOFA_D + 6, 116, 188, 'sofa'],
  ['woman', -128, SOFA_D + 10, 125, 205, 'sofa'], /* one cushion each, side by side without overlapping */
  ['girl', 120, SOFA_D + 8, 109, 200, 'sofa'],
  ['guitar', 232, SOFA_D + 8, 104, 188, 'sofa']
];
const ATLAS = { stand: [0, 240, 700], woman: [240, 355, 580], girl: [595, 311, 570], guitar: [906, 298, 540], mug: [1204, 345, 560] };

export function buildHall(scene, B, H, kernel) {
  const { slab } = H;
  const L = (h, amt) => (p, n) => shade(hex(h).map((v) => v * grain(p, amt === undefined ? 0.06 : amt)), p, n, INT);
  /* a box in the hearth frame: lat l0..l1, y y0..y1, depth d0..d1 (d0 nearer the wall); faces i front, t top, l/r sides, b bottom */
  const sl = (l0, l1, y0, y1, d0, d1, col, faces) => slab(AZ, l0, l1, y0, y1, APO - d1, APO - d0, col, faces || 'itlr');

  /* chimney breast, with the firebox opening cut out of it */
  const plaster = L('#C4B590'), stone = L('#CFC2A8'), oak = L('#6E4A31'), brick = L('#8A4A32', 0.14), soot = L('#2B1A12', 0.1);
  sl(-100, -50, 0, 440, 0, 30, plaster); sl(50, 100, 0, 440, 0, 30, plaster); sl(-50, 50, 98, 440, 0, 30, plaster); sl(-50, 50, 0, 6, 0, 30, plaster);
  /* inside the firebox */
  const sheetBack = (az, l0, l1, y0, y1, d) => {
    const a = hf(l0, y0, d), b = hf(l1, y0, d), c = hf(l1, y1, d), e = hf(l0, y1, d);
    B.quad(a, b, c, e, brick, 6, 6, [-sinz(AZ), 0, -cosz(AZ)]);
  };
  sheetBack(AZ, -50, 50, 6, 98, 8);
  sl(-51, -50, 6, 98, 8, 30, brick, 'r'); sl(50, 51, 6, 98, 8, 30, brick, 'l'); sl(-50, 50, 98, 99, 8, 30, soot, 'b'); sl(-50, 50, 5, 6, 8, 30, L('#3A2417'), 't');
  /* stone surround, mantel shelf and hearth slab */
  sl(-80, -50, 0, 122, 30, 37, stone); sl(50, 80, 0, 122, 30, 37, stone); sl(-80, 80, 98, 122, 30, 37, stone, 'itbtlr');
  sl(-108, 108, 122, 134, 0, 64, oak, 'itblr'); sl(-108, 108, 134, 135, 0, 64, L('#86603F'), 't');
  sl(-112, 112, 0, 7, 30, 96, L('#C6B99C'), 'itlr');
  /* things on the mantel: two candlesticks, a clock, books, a vase */
  const brass = L('#C9A862', 0.03), wax = L('#EEE4C6', 0.03), flame = () => [255, 238, 170];
  [-82, 82].forEach((l) => { sl(l - 4, l + 4, 135, 160, 42, 50, brass); sl(l - 3, l + 3, 160, 186, 43, 49, wax); sl(l - 1.5, l + 1.5, 186, 196, 44, 48, flame); });
  sl(-26, -4, 135, 186, 40, 54, L('#3A2418')); sl(-23, -7, 148, 176, 54, 54.6, L('#F2EBD6', 0.02), 'i');
  sl(-62, -34, 135, 142, 40, 58, L('#6B2A22')); sl(-60, -36, 142, 148, 41, 57, L('#2F4A3A'));
  sl(40, 58, 135, 172, 42, 56, L('#9DB3C9', 0.04));
  /* rug in front of the fire, and the seats */
  sl(-300, 300, 0, 0.5, 66, 330, L('#3E1210'), 't'); sl(-292, 292, 0, 0.7, 74, 322, L('#C2A15A'), 't'); sl(-286, 286, 0, 0.9, 80, 316, L('#7A241E', 0.1), 't'); sl(-270, 270, 0, 1.1, 96, 300, L('#6A1E1A', 0.12), 't');
  /* two sofas, one each side of the fire; the whole piece starts behind the people so it never crosses their legs */
  /* a stuffed block: three stepped layers so the top edges read as rounded, with a dark seam between neighbours */
  const puff = (l0, l1, y0, y1, d0, d1, hexCol, r) => {
    const col = L(hexCol, 0.07);
    sl(l0, l1, y0, y1 - r * 1.6, d0, d1, col);
    sl(l0 + r * 0.45, l1 - r * 0.45, y1 - r * 1.6, y1 - r * 0.6, d0 + r * 0.3, d1 - r * 0.45, col, 'itlr');
    sl(l0 + r, l1 - r, y1 - r * 0.6, y1, d0 + r * 0.7, d1 - r, col, 'itlr');
  };
  const sofa = (l0, l1, c1, c2, c3) => {
    const f = SOFA_D, b = f - 84, AR = 30, w = (l1 - l0 - 2 * AR) / 2, wood = '#3A2414'; /* d grows toward the camera, so the back sits at the smaller d */
    [[l0 + 8, b + 8], [l0 + 8, f - 12], [l1 - 12, b + 8], [l1 - 12, f - 12]].forEach(([l, d]) => sl(l, l + 4, 0, 14, d, d + 4, L(wood, 0.03))); /* legs */
    sl(l0, l1, 14, 32, b, f, L(c1, 0.04), 'itlr');                                    /* frame rail */
    sl(l0 + AR, l1 - AR, 32, 140, b, b + 22, L(c1));                                  /* back frame */
    for (let i = 0; i < 2; i++) {
      const a = l0 + AR + i * w + 1.5, z = a + w - 3;
      puff(a, z, 32, 54, b + 22, f - 2, c2, 3.5);                              /* seat cushion */
      puff(a + 2, z - 2, 54, 136, b + 22, b + 40, c3, 4.5);                             /* back cushion */
    }
    sl(l0 + AR + w - 1.5, l0 + AR + w + 1.5, 32, 50, b + 22, f - 3, L('#1A0E08', 0.02), 'i'); /* the seam */
    [l0, l1 - AR].forEach((a) => { puff(a, a + AR, 14, 100, b, f, c1, 5); sl(a + 4, a + AR - 4, 100, 108, b + 4, f - 4, L(c1, 0.04)); }); /* rolled arms */ /* arms */
  };
  sofa(-384, -30, '#6B2A22', '#8A3B2E', '#A8503C'); sofa(30, 340, '#355744', '#4E7560', '#6A9078');

  /* ---- the portrait over the mantel: one canvas, frame + photo + name plate ---- */
  const FW_ = 896, FH_ = 1216, cv = document.createElement('canvas'); cv.width = FW_; cv.height = FH_;
  const cx = cv.getContext('2d');
  const photo = new Image(); photo.src = './assets/people/joseph.webp';
  const draw = () => {
    cx.clearRect(0, 0, FW_, FH_);
    let g = cx.createLinearGradient(0, 0, FW_, FH_); g.addColorStop(0, '#E9CF8E'); g.addColorStop(0.45, '#B28F4E'); g.addColorStop(1, '#7A5A22');
    cx.fillStyle = g; cx.fillRect(0, 0, FW_, FH_);
    cx.fillStyle = 'rgba(0,0,0,.22)'; cx.fillRect(34, 34, FW_ - 68, FH_ - 68); cx.fillStyle = g; cx.fillRect(46, 46, FW_ - 92, FH_ - 92);
    cx.fillStyle = '#EFE6D2'; cx.fillRect(70, 70, FW_ - 140, 800);
    if (photo.complete && photo.naturalWidth) {
      const bx = 118, by = 118, bw = FW_ - 236, bh = 704, s = Math.max(bw / photo.naturalWidth, bh / photo.naturalHeight), w = photo.naturalWidth * s, h = photo.naturalHeight * s;
      cx.save(); cx.beginPath(); cx.rect(bx, by, bw, bh); cx.clip(); cx.filter = 'sepia(.18) saturate(.92) contrast(.97)'; cx.drawImage(photo, bx + (bw - w) / 2, by, w, h); cx.restore();
      cx.strokeStyle = '#B28F4E'; cx.lineWidth = 4; cx.strokeRect(bx, by, bw, bh);
    }
    g = cx.createLinearGradient(0, 900, 0, 1160); g.addColorStop(0, '#E6CB86'); g.addColorStop(1, '#B28F4E'); cx.fillStyle = g; cx.fillRect(100, 892, FW_ - 200, 252);
    cx.strokeStyle = '#6E521F'; cx.lineWidth = 3; cx.strokeRect(112, 904, FW_ - 224, 228);
    cx.textAlign = 'center'; cx.fillStyle = '#2A1F0C';
    cx.font = '600 82px "Cormorant Garamond",Georgia,serif'; cx.fillText('Joseph Rejo Mathew', FW_ / 2, 998);
    cx.font = '500 40px "Instrument Sans",Arial,sans-serif'; cx.fillText('Full-stack developer · AI & ML', FW_ / 2, 1058);
    cx.font = '500 33px "Instrument Sans",Arial,sans-serif'; cx.fillStyle = '#4A3A1A'; cx.fillText('Next.js · Node.js · Flask · MongoDB', FW_ / 2, 1106);
  };
  draw();
  const ftex = new THREE.CanvasTexture(cv); ftex.anisotropy = 4; ftex.minFilter = THREE.LinearMipmapLinearFilter;
  const redraw = () => { draw(); ftex.needsUpdate = true; kernel.invalidate(); };
  photo.onload = redraw;
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('600 40px "Cormorant Garamond"'), document.fonts.load('500 30px "Instrument Sans"')]).then(redraw).catch(() => {});
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(140, 190), new THREE.MeshBasicMaterial({ map: ftex, color: 0xffe9cf }));
  { const right = new THREE.Vector3(-cosz(AZ), 0, sinz(AZ)), z = new THREE.Vector3(-sinz(AZ), 0, -cosz(AZ)); const m = new THREE.Matrix4().makeBasis(right, new THREE.Vector3(0, 1, 0), z); m.setPosition(...hf(0, 300, 31)); frame.matrixAutoUpdate = false; frame.matrix.copy(m); frame.matrixWorld.copy(m); }
  scene.add(frame);

  /* ---- the fire: flame, wall glow and floor glow in one shader; sparks as Points ---- */
  const U = { uT: { value: 0 } }, pos = [], uvs = [], kind = [], idx = [];
  const add = (a, b, c, d, k) => { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); uvs.push(0, 0, 1, 0, 1, 1, 0, 1); kind.push(k, k, k, k); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  add(hf(-48, 8, 12), hf(48, 8, 12), hf(48, 98, 12), hf(-48, 98, 12), 0);
  add(hf(-170, -30, 29), hf(170, -30, 29), hf(170, 330, 29), hf(-170, 330, 29), 1);
  add(hf(-190, 1.6, 30), hf(190, 1.6, 30), hf(190, 1.6, 300), hf(-190, 1.6, 300), 2);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); fg.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1)); fg.setIndex(idx);
  const fire = new THREE.Mesh(fg, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float aKind; varying vec2 vUv; varying float vK; void main(){ vUv = uv; vK = aKind; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: [
      'uniform float uT; varying vec2 vUv; varying float vK;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
      'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }',
      'float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<4;i++){ s += a*n(p); p *= 2.03; a *= .5; } return s; }',
      'void main(){',
      '  float fl = .86 + .08*sin(uT*7.1) + .06*sin(uT*13.7+1.3);',
      '  if (vK < .5) {',
      '    vec2 p = vUv; float x = p.x - .5;',
      '    float sway = (fbm(vec2(p.y*2.5, uT*.8)) - .5) * .34 * p.y;',
      '    float w = mix(.44, .10, p.y);',
      '    float shape = smoothstep(w, w*.3, abs(x + sway));',
      '    float f = fbm(vec2(p.x*5., p.y*3.2 - uT*2.4));',
      '    float body = shape * (1.18 - p.y*1.1 + (f-.5)*1.0);',
      '    vec3 col = mix(vec3(.85,.14,.02), vec3(1.,.58,.08), smoothstep(.08,.5,body));',
      '    col = mix(col, vec3(1.,.93,.62), smoothstep(.55,1.,body));',
      '    float a = smoothstep(.1,.5,body);',
      '    gl_FragColor = vec4(col*1.5, a);',
      '  } else if (vK < 1.5) {',
      '    float d = length((vUv - vec2(.5,.2)) * vec2(1., 1.25)); float g = smoothstep(.5, 0., d);',
      '    gl_FragColor = vec4(vec3(1.,.5,.2) * g * g * .22 * fl, 1.);',
      '  } else {',
      '    float d = length((vUv - vec2(.5,.0)) * vec2(1., 1.7)); float g = smoothstep(.62, 0., d);',
      '    gl_FragColor = vec4(vec3(1.,.5,.2) * g * g * .4 * fl, 1.);',
      '  }',
      '}'
    ].join('\n')
  }));
  fire.frustumCulled = false; fire.renderOrder = 3; scene.add(fire);

  const NS_ = 36, sp = [], sd = [], sv = []; let q = 5; const rnd = () => (q = (q * 16807) % 2147483647) / 2147483647;
  const tl = [-cosz(AZ), 0, sinz(AZ)];
  for (let i = 0; i < NS_; i++) { const p = hf((rnd() - 0.5) * 80, 14 + rnd() * 24, 14 + rnd() * 10), dl = (rnd() - 0.5) * 70; sp.push(...p); sd.push(rnd()); sv.push(tl[0] * dl, 90 + rnd() * 120, tl[2] * dl); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1)); sg.setAttribute('aVel', new THREE.Float32BufferAttribute(sv, 3));
  const SU = { uT: U.uT, uScale: { value: 400 } };
  const sparks = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: SU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aSeed; attribute vec3 aVel; uniform float uT, uScale; varying float vA; void main(){ float t = fract(uT*.35 + aSeed*7.); vec3 p = position + aVel*t; vA = (1.-t) * smoothstep(0.,.08,t); vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = 3.2 * uScale / -mv.z; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-.5); if (d>.5) discard; gl_FragColor = vec4(vec3(1.,.72,.3), vA*(1.-d*2.)); }'
  }));
  sparks.frustumCulled = false; sparks.renderOrder = 4; scene.add(sparks);

  /* ---- the people: one instanced, y-billboarded mesh over a packed atlas ---- */
  const ac = document.createElement('canvas'); ac.width = 1560; ac.height = 704; const ax = ac.getContext('2d');
  const atex = new THREE.CanvasTexture(ac); atex.anisotropy = 4; atex.minFilter = THREE.LinearMipmapLinearFilter;
  Object.keys(ATLAS).forEach((k) => { const im = new Image(); im.onload = () => { ax.drawImage(im, ATLAS[k][0], 0); atex.needsUpdate = true; kernel.invalidate(); }; im.src = './assets/people/sprite-' + k + '.webp'; });
  const pgeo = new THREE.PlaneGeometry(1, 1); pgeo.translate(0, 0.5, 0);
  const inst = new THREE.InstancedBufferAttribute(new Float32Array(PEOPLE.length * 4), 4);
  const people = new THREE.InstancedMesh(pgeo, new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atex }, uCam: { value: new THREE.Vector3() }, uFl: U.uT, uAx: { value: new THREE.Vector3(-sinz(AZ), 0, -cosz(AZ)) } },
    /* mostly square to the hearth wall, leaning a little toward the camera: a full turn would swing the edges into the sofa */
    vertexShader: 'attribute vec4 aUv; varying vec2 vUv; varying vec3 vC; uniform vec3 uCam, uAx; void main(){ vec3 c = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz; vec3 s = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), 1.); vec3 t = uCam - c; t.y = 0.; t = normalize(mix(uAx, normalize(t), .22)); vec3 r = vec3(t.z, 0., -t.x); vec3 p = c + r*position.x*s.x + vec3(0.,1.,0.)*position.y*s.y; vUv = aUv.xy + uv*aUv.zw; vC = instanceColor; gl_Position = projectionMatrix * viewMatrix * vec4(p,1.); }',
    fragmentShader: 'uniform sampler2D uMap; uniform float uFl; varying vec2 vUv; varying vec3 vC; void main(){ vec4 c = texture2D(uMap, vUv); if (c.a < .5) discard; gl_FragColor = vec4(c.rgb * vC * (1. + .05*sin(uFl*7.1)), 1.); }',
    alphaToCoverage: true
  }), PEOPLE.length);
  people.geometry.setAttribute('aUv', inst); people.frustumCulled = false;
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  PEOPLE.forEach((p, i) => {
    const at = ATLAS[p[0]], world = hf(p[1], 0, p[2]);
    m4.makeScale(p[3], p[4], 1).setPosition(world[0], world[1], world[2]); people.setMatrixAt(i, m4);
    inst.setXYZW(i, at[0] / 1560, 1 - at[2] / 704, at[1] / 1560, at[2] / 704);
    const c = shade([255, 255, 255], [world[0], 110, world[2]], [0, 0, 0], { amb: [0.88, 0.84, 0.86] });
    people.setColorAt(i, col.setRGB(Math.min(1.5, c[0] / 255), Math.min(1.5, c[1] / 255), Math.min(1.5, c[2] / 255)));
  });
  scene.add(people);

  const hp = new THREE.Vector3(...hf(0, 100, 150)), fwd = new THREE.Vector3(), to = new THREE.Vector3();
  return {
    people, fire, sparks, frame,
    /* the fire only animates while the hall is around the camera */
    tick(now, dt) {
      const cam = kernel.camera.position;
      if (cam.y > 650 || cam.distanceTo(hp) > 1300) return false;
      kernel.camera.getWorldDirection(fwd); to.copy(hp).sub(cam).normalize();
      if (fwd.dot(to) < 0.25) return false; /* the hearth is not in front of us: let the GPU sleep */
      U.uT.value = now / 1000;
      people.material.uniforms.uCam.value.copy(cam);
      SU.uScale.value = kernel.renderer.domElement.height / (2 * Math.tan(kernel.camera.fov * Math.PI / 360));
      return 2;
    },
    /* people turn to face the camera, so they must follow it whenever it moves */
    follow() { people.material.uniforms.uCam.value.copy(kernel.camera.position); }
  };
}

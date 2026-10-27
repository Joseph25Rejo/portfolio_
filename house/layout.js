/* Shared layout for the house: one source of truth for where doors, the front door, the hearth and the camera stops are.
   World units are the old CSS px (1 unit ~ 0.7 cm); y is up; az is degrees, position = (r sin az, r cos az). */
export const D = Math.PI / 180;
export const RISE = 27.5, FH = 440, NS = 16, DTH = 10, RI = 250, RO = 650, APO = 655, NF = 7, TOP = 3240;
export const DOOR = { w: 150, h: 300 };
export const EYE = 230;

export const FLOORS = [
  ['00', 'The Entrance'], ['01', 'The Workshop'], ['02', 'The Experience'], ['03', 'The Study'],
  ['04', 'The Library'], ['05', 'The Gallery'], ['06', 'The Final Landing']
];

export const polar = (az, r, y) => [r * Math.sin(az * D), y, r * Math.cos(az * D)];

/* the seven room doors: door k sits on floor k, on the az 0 side for even floors and az 180 for odd */
export const DOORS = FLOORS.map((f, k) => {
  const az = k % 2 ? 180 : 0;
  return { k, num: f[0], title: f[1], az, base: FH * k, center: polar(az, APO, FH * k + DOOR.h / 2), out: [Math.sin(az * D), 0, Math.cos(az * D)] };
});

/* the way in from the street, and the hearth corner (people sit there, out of the path) */
export const FRONT_AZ = 288;
export const FRONT = { az: FRONT_AZ, center: polar(FRONT_AZ, APO, DOOR.h / 2), out: [Math.sin(FRONT_AZ * D), 0, Math.cos(FRONT_AZ * D)] };
export const HEARTH_AZ = 216;
export const HEARTH = { az: HEARTH_AZ, center: polar(HEARTH_AZ, APO, 150) };

const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/* Camera keyframes. `stop` keyframes are rests (the scroll eases in and out of them); the others are passed through.
   `px` is the scroll distance from the previous stop to this one. */
export function buildKeyframes() {
  const kf = [];
  const F = FRONT, side = [Math.cos(FRONT_AZ * D), 0, -Math.sin(FRONT_AZ * D)];
  const at = (id, label, stop, pos, look, px, extra) => kf.push(Object.assign({ id, label, stop, pos, look, px: px || 0 }, extra));

  const eye = (v, y) => [v[0], y, v[2]];
  at('outside', 'Outside', true, eye(add(add(F.center, F.out, 1900), side, 260), 190), add(F.center, [0, 1, 0], 40), 0);
  at('door', 'The front door', true, eye(add(F.center, F.out, 520), 205), add(F.center, [0, 1, 0], 45), 900);
  at('threshold', 'Threshold', false, eye(add(F.center, F.out, -70), 210), add(F.center, F.out, -700), 0);
  at('hall', 'The hearth', true, polar(255, 380, 210), HEARTH.center, 1500);
  at('turn', 'Turn', false, polar(215, 300, 220), polar(300, APO, 150), 0);

  /* door k is the f = 0 point of the climb around the well: camera on the far side, looking across at the door */
  for (let k = 0; k < NF; k++) {
    const last = k === NF - 1;
    for (let q = 0; q < (last ? 1 : 4); q++) {
      const f = q / 4, caz = 180 * (k + 1) + 180 * f, y = FH * (k + f);
      const stop = q === 0;
      at(stop ? 'door' + k : 'climb' + k + '_' + q, stop ? FLOORS[k][0] + ' · ' + FLOORS[k][1] : 'Climb', stop,
        polar(caz, 240, y + EYE), polar(caz - 180, APO, y + DOOR.h / 2), stop ? (k === 0 ? 1000 : 1120) : 0, stop ? { door: k } : null);
    }
  }
  return kf;
}

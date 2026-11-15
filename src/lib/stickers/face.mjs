// The gorilla's face: head shape, glasses, eyes, brows and mouths.

import {
  C,
  LINE,
  at,
  heart,
  lightFrom,
  litEllipse,
  outline,
  sparkle,
  stroke,
} from './draw.mjs';

export const HEAD =
  'M64 8C89 8 105 25 105 47C105 53 104 58 106 63C112 67 114 77 109 87C103 99 86 105 64 105C42 105 25 99 19 87C14 77 16 67 22 63C24 58 23 53 23 47C23 25 39 8 64 8Z';
export const MASK =
  'M64 26C83 26 97 36 97 58C97 82 86 101 64 101C42 101 31 82 31 58C31 36 45 26 64 26Z';
export const EYE_X = [47, 81];
export const EYE_Y = 58;

const BRIDGE = stroke(
  `M60.5 ${EYE_Y - 2}Q64 ${EYE_Y - 5} 67.5 ${EYE_Y - 2}`,
  3.2,
);

// What the eyes sit in. The gorilla wears round glasses; only in bed are they
// off, and then the eyes are plain eye whites.
export const LENSES = {
  round: {
    R: 13.5,
    back: (x) => `<circle cx="${x}" cy="${EYE_Y}" r="13.5" fill="${C.lens}"/>`,
    front: (x) =>
      `<circle cx="${x}" cy="${EYE_Y}" r="13.5" fill="none" ${outline(LINE.frame)}/>` +
      `<path d="M${x - 8} ${EYE_Y - 7}L${x - 3} ${EYE_Y - 11}" stroke="${C.white}" stroke-width="2.4" stroke-linecap="round"/>`,
    bridge: BRIDGE,
  },
  none: {
    R: 11,
    back: (x) =>
      `<circle cx="${x}" cy="${EYE_Y}" r="11" fill="${C.white}" ${outline(LINE.part)}/>`,
    front: () => '',
    bridge: '',
  },
  shades: {
    R: 13.5,
    hidesEyes: true,
    back: (x) => `<circle cx="${x}" cy="${EYE_Y}" r="13.5" fill="${C.dark}"/>`,
    front: (x) =>
      `<circle cx="${x}" cy="${EYE_Y}" r="13.5" fill="none" ${outline(LINE.frame)}/>` +
      `<path d="M${x - 8} ${EYE_Y - 5}L${x - 2} ${EYE_Y - 10}M${x - 8} ${EYE_Y}L${x - 5} ${EYE_Y - 3}" stroke="${C.white}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`,
    bridge: BRIDGE,
  },
  // Light catching the lenses, the know-it-all look.
  glare: {
    R: 13.5,
    hidesEyes: true,
    back: (x) => `<circle cx="${x}" cy="${EYE_Y}" r="13.5" fill="${C.white}"/>`,
    front: (x) =>
      `<path d="M${x - 9} ${EYE_Y + 6}L${x + 4} ${EYE_Y - 10}M${x - 2} ${EYE_Y + 10}L${x + 9} ${EYE_Y - 3}" stroke="${C.glint}" stroke-width="3.6" stroke-linecap="round"/>` +
      `<circle cx="${x}" cy="${EYE_Y}" r="13.5" fill="none" ${outline(LINE.frame)}/>`,
    bridge: BRIDGE,
  },
};

const pupil = (x, y, r = 5.6, light = true) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.line}"/>` +
  (light
    ? `<circle cx="${x - r * 0.32}" cy="${y - r * 0.36}" r="${r * 0.34}" fill="${C.white}"/>`
    : '');

// An eyelid over the upper part of the eye; cut is how far below the centre
// its edge hangs.
function lid(x, y, R, cut) {
  const half = Math.sqrt(R * R - cut * cut);
  return `<path d="M${x - half} ${y + cut}A${R} ${R} 0 ${cut > 0 ? 1 : 0} 1 ${x + half} ${y + cut}Z" fill="${C.skin}" ${outline(LINE.form)}/>`;
}

function spiral(x, y, R, direction) {
  const steps = 40;
  const reach = R - 3.5;
  let d = '';
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const angle = direction * t * 2.4 * 2 * Math.PI;
    const radius = 1 + t * (reach - 1);
    d += `${step ? 'L' : 'M'}${(radius * Math.cos(angle)).toFixed(1)} ${(radius * Math.sin(angle)).toFixed(1)}`;
  }
  return at(x, y, `<g class="spin">${stroke(d, 2.4)}</g>`);
}

const dollar = (x, y, R) =>
  at(
    x,
    y,
    stroke(
      'M3.5 -4.5Q0 -7.5 -3.5 -4.5Q-5 -1.5 0 0Q5 1.5 3.5 4.5Q0 7.5 -3.5 4.5',
      2.8,
      C.green,
    ) + stroke('M0 -9V9', 2.2, C.green),
    ` scale(${R / 13.5})`,
  );

// Each eye is drawn at (x, y); side is -1 for the left eye and 1 for the
// right, [dx, dy] where the pupils look.
export const EYES = {
  open: ({ x, y, dx, dy }) => pupil(x + dx, y + dy),
  wide: ({ x, y, dx, dy }) => pupil(x + dx, y + dy, 3.2, false),
  tiny: ({ x, y, dx, dy }) => pupil(x + dx, y + dy, 1.8, false),
  // The pupil fills most of the eye, whatever the eye is drawn in.
  big: ({ x, y, dx, dy, R }) => {
    const r = +(R * 0.7).toFixed(1);
    return (
      pupil(x + dx, y + dy, r) +
      `<circle cx="${x + dx + r * 0.3}" cy="${y + dy + r * 0.32}" r="${+(r * 0.17).toFixed(1)}" fill="${C.white}"/>`
    );
  },
  happy: ({ x, y }) =>
    stroke(`M${x - 8} ${y + 3}Q${x} ${y - 8} ${x + 8} ${y + 3}`, 4.2),
  joy: ({ x, y, side }) =>
    stroke(
      `M${x + side * 7} ${y - 6}L${x - side * 6} ${y}L${x + side * 7} ${y + 6}`,
      4.2,
    ),
  closed: ({ x, y }) =>
    stroke(`M${x - 8} ${y}Q${x} ${y + 6} ${x + 8} ${y}`, 4.2),
  heart: ({ x, y, R }) => at(x, y, heart(), ` scale(${R / 15})`),
  star: ({ x, y }) => at(x, y, sparkle(10, C.gold)),
  dollar: ({ x, y, R }) => dollar(x, y, R),
  x: ({ x, y }) =>
    stroke(
      `M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}`,
      3.6,
    ),
  spiral: ({ x, y, R, side }) => spiral(x, y, R, side),
  cross: ({ x, y, side }) => pupil(x - side * 5, y + 1),
  derp: ({ x, y, side }) =>
    side < 0 ? pupil(x - 3, y - 4, 3.2, false) : pupil(x + 2, y + 3, 7),
  half: ({ x, y, dx, dy, R }) => pupil(x + dx, y + dy + 4) + lid(x, y, R, 0.5),
  sleepy: ({ x, y, dx, dy, R }) =>
    pupil(x + dx, y + dy + 7, 5.6, false) + lid(x, y, R, 5.5),
  smug: ({ x, y, dx, dy, R }) => pupil(x + dx, y + dy + 3) + lid(x, y, R, 0),
  roll: ({ x, y, R }) => pupil(x, y - R + 6) + lid(x, y, R, -R + 2.2),
};

// Brow heights above the top of the eye: [near the nose, far from it].
const BROWS = {
  neutral: [-9, -10],
  raised: [-14, -16],
  high: [-20, -21],
  flat: [-9, -9],
  sad: [-15, -8],
  worried: [-19, -6],
  angry: [-4, -13],
  fierce: [0, -15],
  low: [-3, -3],
};

export function brows(kind, R) {
  const pair = Array.isArray(kind) ? kind : [kind, kind];
  return EYE_X.map((x, index) => {
    const side = index === 0 ? -1 : 1;
    const [inner, outer] = BROWS[pair[index]];
    const top = EYE_Y - R - 0.5;
    return stroke(
      `M${x - side * 8} ${top + inner}Q${x} ${top + (inner + outer) / 2 - 2} ${x + side * 9} ${top + outer}`,
      5.2,
      C.furDark,
    );
  }).join('');
}

const TONGUE = (path) =>
  `<path d="${path}" fill="${C.tongue}" ${outline(LINE.part)}/>`;

export const MOUTHS = {
  smile: stroke('M52 90Q64 99 76 90'),
  grin:
    `<path d="M49 88Q64 114 79 88Z" fill="${C.mouth}"/>` +
    `<path d="M51 89.5Q64 92 77 89.5L76 94Q64 96.5 52 94Z" fill="${C.white}"/>` +
    `<ellipse cx="64" cy="99.5" rx="7" ry="3.4" fill="${C.tongue}"/>` +
    stroke('M49 88Q64 114 79 88Z', 3),
  big:
    `<path d="M45 86Q64 118 83 86Z" fill="${C.mouth}"/>` +
    `<path d="M47 87.5Q64 90.5 81 87.5L80 93Q64 96 48 93Z" fill="${C.white}"/>` +
    `<ellipse cx="64" cy="101" rx="8.5" ry="4" fill="${C.tongue}"/>` +
    stroke('M45 86Q64 118 83 86Z', 3),
  o: `<ellipse cx="64" cy="94" rx="5.5" ry="7" fill="${C.mouth}" stroke="${C.line}" stroke-width="3"/>`,
  frown: stroke('M52 97Q64 87 76 97'),
  pout: stroke('M58 95Q64 91 70 95'),
  gritted:
    `<rect x="49" y="85" width="30" height="13" rx="4.5" fill="${C.white}" stroke="${C.line}" stroke-width="3"/>` +
    stroke('M57 85V98M64 85V98M71 85V98M49 91.5H79', 2),
  smirk: stroke('M52 95Q61 99 70 95Q74 93 77 88') + stroke('M79 86V91', 2.6),
  flat: stroke('M53 95H75'),
  wavy: stroke('M50 95Q55 90 60 95T70 95T78 95'),
  cat: stroke('M50 91Q57 99 64 91Q71 99 78 91'),
  tongue:
    TONGUE('M64 94Q76 93 75 102Q74 108 67 107Q62 106 63 99Z') +
    stroke('M52 90Q64 99 76 90'),
  blep:
    stroke('M50 90Q64 100 78 90') +
    TONGUE('M56 94Q56 114 64 114Q72 114 72 94Z') +
    stroke('M64 99V108', 2),
  grimace:
    `<path d="M45 90Q64 84 83 90L81 102Q64 106 47 102Z" fill="${C.white}" ${outline(LINE.form)}/>` +
    stroke('M54 87V103M64 86V104M74 87V103M46 96Q64 100 82 96', 1.8),
  open:
    `<path d="M52 88Q64 112 76 88Z" fill="${C.mouth}"/>` +
    `<path d="M57 100Q64 92 71 100Z" fill="${C.tongue}"/>` +
    stroke('M52 88Q64 112 76 88Z', 3),
  scream:
    `<ellipse cx="64" cy="93" rx="11" ry="12" fill="${C.mouth}" stroke="${C.line}" stroke-width="3"/>` +
    `<path d="M55 100Q64 94 73 100Q64 105 55 100Z" fill="${C.tongue}"/>`,
  yawn: `<ellipse cx="64" cy="94" rx="7" ry="9.5" fill="${C.mouth}" stroke="${C.line}" stroke-width="3"/>`,
  wail:
    `<path d="M45 102Q64 80 83 102Z" fill="${C.mouth}"/>` +
    `<path d="M56 102Q64 93 72 102Z" fill="${C.tongue}"/>` +
    stroke('M45 102Q64 80 83 102Z', 3),
  sly:
    `<path d="M44 89Q64 112 84 89Q64 95 44 89Z" fill="${C.white}" ${outline(LINE.form)}/>` +
    stroke('M54 93.5V98M64 95V101M74 93.5V98', 1.8),
  kiss:
    `<path d="M57 95Q64 87 71 95Q64 104 57 95Z" fill="${C.heart}" ${outline(LINE.part)}/>` +
    stroke('M58 95H70', 1.8, C.white),
  drool:
    `<ellipse cx="64" cy="94" rx="5.5" ry="6.5" fill="${C.mouth}" stroke="${C.line}" stroke-width="3"/>` +
    `<path d="M60 99V110Q60 114 64 110V100Z" fill="${C.tear}" opacity=".85"/>`,
  // A grin painted on over a real frown.
  painted:
    `<path d="M44 84Q64 114 84 84Q64 102 44 84Z" fill="${C.heart}" opacity=".9"/>` +
    stroke('M56 96Q64 90 72 96'),
  chew: `<g class="chew">${stroke('M54 94Q59 98 64 94Q69 98 74 94')}</g>`,
};

export function eyesOf(kind, lens, look) {
  const pair = Array.isArray(kind) ? kind : [kind, kind];
  const [dx, dy] = look;
  return EYE_X.map((x, index) =>
    EYES[pair[index]]({
      x,
      y: EYE_Y,
      side: index === 0 ? -1 : 1,
      R: lens.R,
      dx,
      dy,
    }),
  ).join('');
}

// The head is lit from the upper left of the picture. A head that is drawn
// tilted turns its light back by as much, so a gorilla lying on its side is
// still lit from above.

// The muzzle: its shade, with the lit copy laid over it a little higher.
export function muzzle(tilt = 0) {
  const [dx, dy] = lightFrom(tilt, [0, -2]);
  return (
    `<ellipse cx="64" cy="84.6" rx="21" ry="14.6" fill="${C.muzzleShade}"/>` +
    `<ellipse cx="${64 + dx}" cy="${84.6 + dy}" rx="21" ry="14.6" fill="${C.muzzle}"/>` +
    `<ellipse cx="57" cy="79" rx="4.4" ry="2.8" fill="${C.nostril}" transform="rotate(24 57 79)"/>` +
    `<ellipse cx="71" cy="79" rx="4.4" ry="2.8" fill="${C.nostril}" transform="rotate(-24 71 79)"/>` +
    `<ellipse cx="64" cy="72.5" rx="6" ry="1.6" fill="${C.white}" opacity=".5"/>`
  );
}

const ear = (x, side, by) =>
  litEllipse(x, 61, 8, 10.5, C.fur, LINE.form, by, C.furShade) +
  `<ellipse cx="${x - side * 1.2}" cy="61.5" rx="3.4" ry="5.4" fill="${C.skinShade}"/>`;

export function skull(tilt = 0) {
  const [furX, furY] = lightFrom(tilt, [-3.5, -4.5]);
  const [skinX, skinY] = lightFrom(tilt, [-1.5, -3.5]);
  const earLight = lightFrom(tilt, [-1.6, -2]);
  const rim = stroke('M31 43Q33 24 52 16.5', 4.2, C.furLight);
  return (
    ear(19.5, -1, earLight) +
    ear(108.5, 1, earLight) +
    `<clipPath id="head"><path d="${HEAD}"/></clipPath>` +
    `<clipPath id="mask"><path d="${MASK}"/></clipPath>` +
    `<g clip-path="url(#head)"><path d="${HEAD}" fill="${C.furShade}"/>` +
    `<path d="${HEAD}" fill="${C.fur}" transform="translate(${furX} ${furY})"/>` +
    (tilt ? `<g transform="rotate(${-tilt} 64 56)">${rim}</g>` : rim) +
    `</g>` +
    `<g clip-path="url(#mask)"><path d="${MASK}" fill="${C.skinShade}"/>` +
    `<path d="${MASK}" fill="${C.skin}" transform="translate(${skinX} ${skinY})"/>` +
    // The brow ridge throws a soft shadow over the top of the face.
    `<ellipse cx="64" cy="27" rx="38" ry="13" fill="${C.skinShade}" opacity=".5"/>` +
    `</g>` +
    `<path d="${HEAD}" fill="none" ${outline(LINE.form)}/>`
  );
}

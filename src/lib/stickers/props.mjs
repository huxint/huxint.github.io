// What goes around the face: clothes, headgear, hands, props and effects.

import {
  C,
  GLYPHS,
  at,
  heart,
  outline,
  pinned,
  shape,
  sparkle,
  stroke,
  teardrop,
} from './draw.mjs';
import { MASK } from './face.mjs';

const rect = (x, y, width, height, radius, fill = C.skin, line = 3) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" ${outline(line)}/>`;
const circle = (x, y, r, fill, line = 3) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${outline(line)}/>`;
const dot = (x, y, r, fill = C.line) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const delayed = (cls, delay, content) =>
  `<g class="${cls}" style="animation-delay:${delay}s">${content}</g>`;

// ── Clothes ─────────────────────────────────────────────────────────────

const SHOULDERS = 'M10 122C10 108 28 101 50 100H78C100 101 118 108 118 122Z';

export const BODIES = {
  none: '',
  hoodie:
    shape(SHOULDERS, C.slate) +
    stroke('M44 108V119M84 108V119', 2.6, C.string) +
    dot(44, 120.5, 1.8, C.orange) +
    dot(84, 120.5, 1.8, C.orange) +
    stroke(
      'M58 112L53 116L58 120M70 112L75 116L70 120M66 111L62 121',
      2.8,
      C.orange,
    ),
  tee:
    shape(SHOULDERS, C.orange) +
    stroke('M49 100Q64 112 79 100', 3) +
    circle(64, 116, 5, C.paper, 2.4),
  suit:
    shape(SHOULDERS, '#2f3342') +
    shape('M50 100L64 122L78 100Z', C.paper, 2.6) +
    shape('M64 104L60 110L64 122L68 110Z', C.heart, 2.2) +
    stroke('M50 100L58 118M78 100L70 118', 2.4),
  pajama:
    shape(SHOULDERS, '#9db8e8') +
    dot(32, 112, 2.2, C.white) +
    dot(96, 112, 2.2, C.white) +
    dot(48, 118, 2.2, C.white) +
    dot(80, 118, 2.2, C.white) +
    stroke('M50 101Q64 110 78 101', 3),
};

// The colour of an arm: the sleeve, or bare fur under a tee.
export const SLEEVES = {
  none: C.fur,
  hoodie: C.slate,
  tee: C.fur,
  suit: '#2f3342',
  pajama: '#9db8e8',
};

// ── Headgear ────────────────────────────────────────────────────────────
// Each is drawn in front of the head; clown wigs also have a back part.

export const GEAR = {
  headphones: {
    front:
      `<path d="M21 58C16 26 38 8 64 8C90 8 112 26 107 58" fill="none" stroke="${C.line}" stroke-width="10" stroke-linecap="round"/>` +
      `<path d="M21 58C16 26 38 8 64 8C90 8 112 26 107 58" fill="none" stroke="${C.orange}" stroke-width="5" stroke-linecap="round"/>` +
      [8, 103]
        .map(
          (x) =>
            rect(x, 47, 17, 28, 8, C.orange) +
            `<rect x="${x + 4}" y="52" width="9" height="18" rx="4.5" fill="${C.orangeDark}"/>`,
        )
        .join(''),
  },
  cap: {
    front:
      shape('M25 31C23 14 42 6 64 6C86 6 105 14 103 31Z', C.blue) +
      shape('M22 32Q64 22 106 32Q98 41 64 41Q30 41 22 32Z', C.navy) +
      circle(64, 6.5, 3, C.navy, 2.2),
  },
  nightcap: {
    front:
      shape('M25 33C23 14 42 6 64 6C86 6 104 14 103 33Z', C.navy) +
      shape('M84 8C102 4 116 22 113 46L102 43C104 30 97 20 84 22Z', C.navy) +
      circle(111, 48, 7, C.paper, 2.6) +
      shape('M23 29Q64 20 105 29V38Q64 29 23 38Z', C.paper, 2.6) +
      at(60, 15, sparkle(4, C.yellow)),
  },
  hardhat: {
    front:
      shape('M25 31C25 12 42 4 64 4C86 4 103 12 103 31Z', C.yellow) +
      `<rect x="56" y="4" width="16" height="27" fill="${C.gold}"/>` +
      stroke('M56 4V31M72 4V31', 2.6) +
      shape(
        'M17 31H111Q114 31 114 35Q114 39 111 39H17Q14 39 14 35Q14 31 17 31Z',
        C.gold,
      ),
  },
  // A sweatband: snug and striped, with no knot to trail behind.
  headband: {
    front:
      shape('M25 32Q64 21 103 32L105 45Q64 34 23 45Z', C.orange, 2.8) +
      stroke('M26 37Q64 26 102 37', 2.4, C.paper) +
      stroke('M25 41Q64 30 103 41', 2.4, C.paper),
  },
  tophat: {
    front:
      shape('M42 30L44 3H84L86 30Z', '#2a2d38') +
      `<rect x="43.5" y="20" width="41" height="8" fill="${C.gold}"/>` +
      `<ellipse cx="64" cy="31" rx="38" ry="7" fill="#2a2d38" ${outline(3)}/>`,
  },
  clown_wig: {
    back: circle(24, 46, 13, '#f0642f') + circle(104, 46, 13, '#f0642f'),
    front:
      circle(64, 11, 8, '#f0642f') +
      circle(42, 16, 7.5, '#f0642f') +
      circle(86, 16, 7.5, '#f0642f'),
  },
  halo: {
    front:
      `<ellipse cx="64" cy="3" rx="20" ry="5.5" fill="none" stroke="${C.line}" stroke-width="8"/>` +
      `<ellipse cx="64" cy="3" rx="20" ry="5.5" fill="none" stroke="${C.gold}" stroke-width="4"/>`,
  },
};

// ── Hands ───────────────────────────────────────────────────────────────
// A hand is drawn with its wrist at the origin and the fingers pointing up, so
// a pose only says where the wrist is and how far the hand turns. The arm is a
// sleeve that ends at the wrist: in back it rises past the body and head, in
// front it lies across them. Sleeves use currentColor, which art.mjs sets to
// the clothes.

const pill = (x, y, width, height) =>
  rect(x, y, width, height, Math.min(width, height) / 2, C.skin, 2.6);
const crease = (d) => stroke(d, 2, C.skinShade);
const arm = (d) => stroke(d, 13, C.line) + stroke(d, 7.6, 'currentColor');

// Seen from the side: the thumb up, the other fingers curled in a stack.
const thumbsUp = () =>
  pill(-12.5, -27, 12.5, 25) +
  crease('M-9.5 -21.5Q-6 -23.5 -3 -21.5') +
  rect(-6, -10, 20, 28, 8) +
  [-9, -2, 5, 12].map((y) => pill(-16, y, 19, 8)).join('');

// The palm with three fingers curled into it, the index finger left free.
const curled = () =>
  rect(-13, -7, 29, 26, 9) +
  [-3.5, 3, 9.5].map((x) => pill(x, -10.5, 6.5, 15)).join('');

// The index finger up, the thumb folded over the others. Turned on its
// side, it points.
const pointer = (length = 34) =>
  pill(-12.5, -length, 9, length) + curled() + pill(-11, 3, 21, 8);

// The same with the thumb out, an L to rest the chin on.
const chinRest = (length = 30) =>
  pill(-12.5, -length, 9, length) +
  at(-9, 9, pill(-17, -4.5, 19, 9), ' rotate(-14)') +
  curled();

// From the front: four knuckles and the thumb across them.
const fist = () =>
  rect(-14, -7, 29, 25, 9) +
  [-14, -6.7, 0.6, 7.9].map((x) => pill(x, -11, 7.3, 15)).join('') +
  pill(-15, 2, 22, 8.5);

// The index finger and thumb close a ring; three fingers stand up.
const okHand = () =>
  [
    [-1, -6, 22],
    [6, 3, 21],
    [12.5, 12, 17],
  ]
    .map(([x, rotation, length]) =>
      at(x, -2, pill(-3.6, -length, 7.2, length + 4), ` rotate(${rotation})`),
    )
    .join('') +
  rect(-11, -6, 26, 25, 9.5) +
  `<path fill-rule="evenodd" d="M-19 -1a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0ZM-14.2 -1.5a3.6 3.6 0 1 1 7.2 0a3.6 3.6 0 1 1 -7.2 0Z" fill="${C.skin}" ${outline(2.6)}/>`;

// The palm, fingers spread and the thumb out to the left.
const openHand = (spread = 8) =>
  [
    [-9.5, -spread, 14],
    [-3.2, -spread / 3, 17],
    [3.2, spread / 3, 16],
    [9.5, spread, 13],
  ]
    .map(([x, rotation, length]) =>
      at(x, -9, pill(-4, -length, 8, length + 6), ` rotate(${rotation})`),
    )
    .join('') +
  at(-13, 5, pill(-4.5, -12, 9, 14), ' rotate(-52)') +
  rect(-14, -9, 28, 26, 10);

// The fingers held together, the thumb to the left.
const flatHand = () =>
  `<path d="M-8 16V-14Q-8 -22 0 -22Q8 -22 8 -14V16Z" fill="${C.skin}" ${outline(2.6)}/>` +
  crease('M-2.7 -19V-4M2.7 -19V-4') +
  at(-8, 6, pill(-3.5, -12, 7, 15), ' rotate(-20)');

// Palms pressed together, thumbs side by side, sleeves parting below.
const prayHands = () =>
  arm('M-5 12L-18 17') +
  arm('M5 12L18 17') +
  `<path d="M0 -19C-1 -24 -9 -24 -10 -15L-11 4Q-10.5 15 0 15Q10.5 15 11 4L10 -15C9 -24 1 -24 0 -19Z" fill="${C.skin}" ${outline(2.6)}/>` +
  crease('M0 -18V13') +
  pill(-6.5, -3, 6, 16) +
  pill(0.5, -3, 6, 16);

// Two hands curled into a heart around a red one.
const heartHands = () => {
  const half = 'M0 -6C-4 -16 -20 -18 -21 -5C-22 6 -8 13 0 20';
  const pair = (width, color) =>
    stroke(half, width, color) +
    `<g transform="scale(-1 1)">${stroke(half, width, color)}</g>`;
  return (
    pair(13, C.line) +
    pair(8, C.skin) +
    `<path d="M0 -3C-3 -11 -15 -12 -15.5 -4C-16 4 -6 10 0 15C6 10 16 4 15.5 -4C15 -12 3 -11 0 -3Z" fill="${C.heart}"/>` +
    crease(
      'M-12 -14.5L-10 -10M-17 -12L-14 -8.5M12 -14.5L10 -10M17 -12L14 -8.5M0 15V19',
    )
  );
};

// Something held in a fist at the bottom right.
export const hold = (x = 96, y = 108, rotation = 0) =>
  at(x, y, fist(), ` rotate(${rotation})`);

const wrist = (x, y, shape) => at(-x, -y, shape);

const HAND = {
  thumb: wrist(4, 18, thumbsUp()),
  fist: wrist(0.5, 18, fist()),
  ok: wrist(2, 19, okHand()),
  flat: wrist(0, 16, flatHand()),
  open: (spread) => wrist(0, 17, openHand(spread)),
  point: (length) => wrist(1.5, 19, pointer(length)),
  chin: (length) => wrist(1.5, 19, chinRest(length)),
};

// A pose drawn on the right, repeated on the left.
const mirror = (content) =>
  `<g transform="translate(128 0) scale(-1 1)">${content}</g>`;
const both = (content) => content + mirror(content);

// Content that turns about a joint: the group sits on the pivot, so its
// motion needs no transform origin.
const swing = (name, [x, y], content, delay = 0) =>
  at(x, y, delayed(name, delay, at(-x, -y, content)));

export const HANDS = {
  thumb: { front: at(99, 118, delayed('pop', 0, HAND.thumb), ' rotate(6)') },
  // The same hand turned over, hanging from its wrist.
  thumb_down: { front: at(109, 72, HAND.thumb, ' scale(1 -1) rotate(8)') },
  // The forearm swings from the elbow.
  wave: {
    back:
      arm('M104 114Q112 108 109 92') +
      swing('wave', [109, 92], arm('M109 92Q108 78 102 66')),
    front: swing(
      'wave',
      [109, 92],
      at(102, 66, HAND.open(9), ' rotate(8) scale(.92)'),
    ),
  },
  hands_up: {
    back: both(swing('quiver', [104, 112], arm('M104 112Q116 92 115 60'))),
    front: both(
      swing('quiver', [104, 112], at(111, 61, HAND.open(9), ' rotate(10)')),
    ),
  },
  cheer: {
    back: both(delayed('hop', 0, arm('M104 112Q122 84 111 42'))),
    front: both(delayed('hop', 0, at(102, 52, HAND.open(9), ' rotate(16)'))),
  },
  taunt: {
    back: both(arm('M104 112Q118 96 116 70')),
    front:
      at(107, 73, delayed('wiggle', 0, HAND.open(12)), ' rotate(20)') +
      mirror(
        at(107, 73, delayed('wiggle', -0.18, HAND.open(12)), ' rotate(20)'),
      ),
  },
  // Elbows by the waist, forearms out to the sides, palms open.
  shrug: {
    front: both(
      delayed(
        'shrug',
        0,
        arm('M114 120Q112 112 108 102') +
          at(108, 102, HAND.open(10), ' rotate(36) scale(.8)'),
      ),
    ),
  },
  // Hands meet in front of the chest.
  clap: {
    front:
      both(
        at(73.5, 126, delayed('clap', 0, HAND.flat), ' rotate(20) scale(.95)'),
      ) +
      delayed('flash', 0, stroke('M38 106L31 100M90 106L97 100', 3, C.gold)),
  },
  ok: { front: at(100, 111, delayed('pop', 0, HAND.ok), ' rotate(6)') },
  salute: {
    back: arm('M22 112Q6 98 10 76'),
    front: arm('M10 76L16 64') + at(16, 64, HAND.flat, ' rotate(50)'),
  },
  pray: {
    front:
      at(64, 98, delayed('plead', 0, prayHands()), ' scale(1.2)') +
      at(36, 96, sparkle(5, C.gold)) +
      at(92, 94, sparkle(6, C.gold)),
  },
  fist: {
    back: delayed('pump', 0, arm('M24 112Q6 84 20 50')),
    front:
      delayed('pump', 0, at(20, 56, HAND.fist, ' rotate(8)')) +
      stroke('M6 24L1 18M20 18V10M36 22L40 15', 3, C.gold),
  },
  heart_hands: {
    front: at(64, 106, delayed('beat', 0, heartHands()), ' scale(.76)'),
  },
  // The chin on the hand, the index finger along the cheek.
  think: {
    front: at(
      104,
      124,
      delayed('tap', 0, HAND.chin(26)),
      ' rotate(-10) scale(.95)',
    ),
  },
  shush: { front: at(80, 124, HAND.point(18), ' rotate(-8)') },
  poke: {
    front:
      at(34, 117, delayed('tap', 0, HAND.point(22)), ' rotate(74) scale(.72)') +
      mirror(
        at(
          34,
          117,
          delayed('tap', 0, HAND.point(22)),
          ' rotate(74) scale(.72)',
        ),
      ),
  },
  facepalm: {
    front:
      arm('M24 116Q25 100 38 80') +
      at(38, 80, HAND.open(4), ' scale(-1 1) rotate(-22) scale(1.15)'),
  },
  // Pointing out to the left.
  point: {
    front:
      arm('M40 126Q36 112 32 102') +
      at(32, 102, delayed('jab', 0, HAND.point(28)), ' rotate(-36) scale(.8)'),
  },
  finger_up: {
    back: arm('M108 116Q116 104 110 86'),
    front: at(111, 90, delayed('wag', 0, HAND.point()), ' rotate(8)'),
  },
};

// ── Things held, worn near, or happening around the head ────────────────

const badge = (color, text, x = 98, y = 26) => {
  const count = text.length;
  const width = count * 13 + 12;
  const scale = count > 2 ? 0.8 : 1;
  return at(
    x,
    y,
    `<rect x="${-width / 2}" y="-14" width="${width}" height="28" rx="14" fill="${color}" stroke="${C.white}" stroke-width="2.5"/>` +
      [...text]
        .map((glyph, index) =>
          at(
            (index - (count - 1) / 2) * 12 * scale,
            0,
            stroke(GLYPHS[glyph], 3, C.white),
            ` scale(${scale})`,
          ),
        )
        .join(''),
  );
};

const qmark = (x, y, scale, delay) =>
  delayed(
    'float',
    delay,
    at(
      x,
      y,
      pinned('M-4 -6Q-4 -11 0 -11Q5 -11 5 -6Q5 -2 0 0V3', 3.2, C.blue) +
        `<circle cy="8" r="2.4" fill="${C.blue}" stroke="${C.white}" stroke-width="1.6"/>`,
      ` scale(${scale})`,
    ),
  );

const bill = (x, y, rotation, delay) =>
  delayed(
    'float',
    delay,
    at(
      x,
      y,
      rect(-10, -6, 20, 12, 2, '#8fd59d', 2.2) +
        circle(0, 0, 3.2, '#d8f2dc', 1.6),
      ` rotate(${rotation})`,
    ),
  );

const CONFETTI = [
  [38, 16, 20, C.heart, 0],
  [51, 12, -30, C.blue, 1],
  [64, 9, 50, C.green, 0],
  [77, 12, 40, C.yellow, 1],
  [90, 16, -20, C.green, 0],
  [46, 28, 70, C.yellow, 0],
  [83, 27, -60, C.heart, 1],
];

const flame = (x, y, scale, delay) =>
  delayed(
    'flicker',
    delay,
    at(
      x,
      y,
      shape(
        'M0 12C-12 6 -10 -6 -2 -14C-2 -6 6 -6 4 -16C16 -6 14 6 0 12Z',
        C.orange,
        2.4,
      ) +
        `<path d="M0 10C-5 6 -4 0 0 -4C1 0 5 0 4 6C3 9 1 10 0 10Z" fill="${C.yellow}"/>`,
      ` scale(${scale})`,
    ),
  );

// A small cloud of breath or steam.
const PUFF =
  'M-8 4A4.5 4.5 0 0 1 -6 -4A6 6 0 0 1 5 -6A5 5 0 0 1 9 3A3.5 3.5 0 0 1 6 7H-5A3.5 3.5 0 0 1 -8 4Z';
const puff = (x, y, scale = 1) =>
  at(
    x,
    y,
    `<path d="${PUFF}" fill="${C.white}" ${outline(2.2 / scale)}/>`,
    ` scale(${scale})`,
  );

// Stars circle above the head on a flat ellipse. Each gets its own keyframes,
// a third of the way round from the last, so the still picture is a ring too.
const ORBIT = { x: 64, y: 15, across: 30, depth: 7, steps: 16 };
const STARTS = [0.25, 0.25 + 1 / 3, 0.25 + 2 / 3];
const orbitAt = (turn) => {
  const angle = turn * 2 * Math.PI;
  return [
    +(ORBIT.x - ORBIT.across * Math.cos(angle)).toFixed(1),
    +(ORBIT.y + ORBIT.depth * Math.sin(angle)).toFixed(1),
  ];
};

export const BACK_EXTRAS = {
  pillow: rect(-2, 22, 62, 84, 24, C.paper),
};

// Drawn with the head: they tilt and move with it.
export const HEAD_EXTRAS = {
  blush:
    `<ellipse cx="38" cy="82" rx="6" ry="4" fill="${C.blush}" opacity=".7"/>` +
    `<ellipse cx="90" cy="82" rx="6" ry="4" fill="${C.blush}" opacity=".7"/>`,
  flush: `<path d="${MASK}" fill="${C.heart}" opacity=".38"/>`,
  tears_joy:
    at(24, 86, teardrop(), ' rotate(-55) scale(1.1)') +
    at(104, 86, teardrop(), ' rotate(55) scale(1.1)'),
  tears_stream:
    stroke('M45 77Q40 88 43 98', 5.5, C.tear) +
    stroke('M83 77Q88 88 85 98', 5.5, C.tear) +
    `<g class="drop">${at(43, 102, teardrop(), ' scale(.7)')}${at(85, 102, teardrop(), ' scale(.7)')}</g>`,
  tears_fountain:
    ['M38 66Q24 42 10 62', 'M90 66Q104 42 118 62']
      .map((d) => stroke(d, 9, C.tearDark) + stroke(d, 5.4, C.tear))
      .join('') +
    `<g class="drop">${at(10, 70, teardrop(), ' scale(.85)')}${at(118, 70, teardrop(), ' scale(.85)')}</g>`,
  tear:
    stroke('M38 69Q35 77 37 84', 4.6, C.tear) +
    `<g class="drop">${at(37, 88, teardrop(), ' scale(.62)')}</g>`,
  tears_well: [47, 81]
    .map(
      (x) =>
        `<path d="M${x - 9} 61A9.5 9.5 0 0 0 ${x + 9} 61Q${x} 65.5 ${x - 9} 61Z" fill="${C.tear}" opacity=".8"/>` +
        dot(x + 4, 64, 1.3, C.white),
    )
    .join(''),
  sweat: `<g class="drop">${at(98, 38, teardrop(), ' scale(1.2)')}</g>`,
  sweat_many: `<g class="drop">${at(22, 40, teardrop(), ' scale(1)')}${at(106, 36, teardrop(), ' scale(1.1)')}${at(100, 58, teardrop(), ' scale(.8)')}</g>`,
  eyebags: stroke('M38 74Q47 79 56 74M72 74Q81 79 90 74', 2.6, C.skinShade),
  snot: `<g class="breathe">${circle(49, 87, 7, '#cfe9f7', 2.2)}${dot(47, 84.5, 1.6, C.white)}</g>`,
  clown_nose: circle(64, 78, 8.5, C.heart, 2.8) + dot(61.5, 75, 2, C.white),
  crack:
    stroke('M62 10L55 28L68 40L54 56L67 68L56 84L66 98L60 105', 4.4, C.white) +
    stroke('M62 10L55 28L68 40L54 56L67 68L56 84L66 98L60 105', 2.2),
  veins: `<g class="pulse">${at(98, 26, ['M-10 -4Q-4 -4 -4 -10', 'M10 -4Q4 -4 4 -10', 'M-10 4Q-4 4 -4 10', 'M10 4Q4 4 4 10'].map((d) => pinned(d, 3.4, C.heart)).join(''))}</g>`,
  steam:
    delayed('puff', 0, puff(12, 66, 0.8) + puff(2, 54, 1.1)) +
    delayed('puff', -0.5, puff(116, 66, 0.8) + puff(126, 54, 1.1)),
  // A huff of contempt from the nose.
  snort: puff(47, 88, 0.55) + puff(83, 82, 0.5),
  // The soul leaving by the mouth.
  soul:
    `<path d="M77 93C92 90 100 76 102 56C102 50 103 44 104 40A10 10 0 1 1 121 42C119 54 112 60 108 68C100 84 90 92 77 93Z" fill="${C.white}" fill-opacity=".92" ${outline(2.4)}/>` +
    dot(109, 38, 1.6) +
    dot(116, 38.5, 1.6) +
    `<ellipse cx="112.5" cy="44" rx="1.8" ry="2.2" fill="${C.line}"/>`,
};

export const EXTRAS = {
  badge_ac: badge(C.green, 'AC'),
  badge_wa: badge(C.heart, 'WA'),
  badge_tle: badge('#e08a1e', 'TLE'),
  badge_mle: badge('#8a5bd6', 'MLE'),
  badge_lgtm: badge(C.green, 'LGTM', 94, 24),
  hearts:
    delayed('float', 0, at(102, 22, heart(), ' scale(.9)')) +
    delayed('float', -1.2, at(116, 44, heart(C.orange), ' scale(.6)')),
  sparkles:
    delayed('float', 0, at(104, 24, sparkle(8))) +
    delayed('float', -1, at(18, 30, sparkle(6))) +
    delayed('float', -1.8, at(112, 64, sparkle(5))),
  zzz: [
    [90, 40, 0.75, 0],
    [100, 31, 0.95, -0.8],
    [110, 21, 1.15, -1.6],
  ]
    .map(([x, y, scale, delay]) =>
      delayed(
        'float',
        delay,
        at(x, y, pinned('M-5 -5H5L-5 5H5', 2.8, C.blue), ` scale(${scale})`),
      ),
    )
    .join(''),
  question:
    qmark(100, 26, 1.2, 0) +
    qmark(114, 46, 0.8, -1.1) +
    qmark(22, 30, 0.9, -0.6),
  exclaim:
    delayed(
      'pulse',
      0,
      at(100, 28, pinned('M0 -10V3', 4.4, C.heart) + dot(0, 9, 2.6, C.heart)),
    ) +
    delayed(
      'pulse',
      -0.4,
      at(116, 44, pinned('M0 -7V2', 3.4, C.heart) + dot(0, 7, 2, C.heart)),
    ),
  thought:
    circle(90, 34, 2.8, C.white, 2) +
    circle(98, 25, 4, C.white, 2) +
    circle(110, 12, 6.5, C.white, 2),
  stars: STARTS.map((start, index) => {
    const [x, y] = orbitAt(start);
    return `<g class="orbit${index}" transform="translate(${x} ${y})">${sparkle(7, C.yellow)}</g>`;
  }).join(''),
  rain:
    at(
      64,
      22,
      shape(
        'M-26 6A10 10 0 0 1 -18 -8A14 14 0 0 1 8 -10A11 11 0 0 1 28 4A6 6 0 0 1 24 12H-22A8 8 0 0 1 -26 6Z',
        C.grey,
      ),
    ) +
    `<g class="drop">${[-14, 2, 18].map((x) => stroke(`M${64 + x} 38V46`, 3, C.tear)).join('')}</g>`,
  flames:
    flame(44, 29, 0.8, 0) +
    flame(64, 23, 1.05, -0.3) +
    flame(84, 29, 0.8, -0.6),
  money:
    bill(14, 40, -20, 0) + bill(112, 30, 25, -0.8) + bill(104, 78, -15, -1.6),
  confetti: CONFETTI.map(([x, y, rotation, color, big]) =>
    at(
      x,
      y,
      `<rect x="-4" y="-2.5" width="${big ? 9 : 7}" height="5" rx="1.2" fill="${color}" stroke="${C.white}" stroke-width="1.6"/>`,
      ` rotate(${rotation})`,
    ),
  ).join(''),
  blanket:
    shape('M70 34H120Q130 34 130 44V96Q130 106 120 106H70Z', C.blue) +
    shape('M66 32H80V108H66Q62 70 66 32Z', C.paper, 2.6) +
    stroke('M88 56Q108 52 126 58M90 84Q110 80 126 86', 2.6, '#8fb0f5'),
  // Running off to the right: speed lines, dust and sweat left behind.
  dash:
    ['M2 52H22', 'M-2 66H18', 'M4 80H24']
      .map((d, index) =>
        delayed('streak', -index * 0.17, stroke(d, 3.4, C.greyDark)),
      )
      .join('') +
    delayed('puff', 0, puff(18, 98, 1.1)) +
    delayed('puff', -0.6, puff(6, 90, 0.8)) +
    at(24, 34, teardrop(), ' rotate(-70)') +
    at(12, 42, teardrop(), ' rotate(-70) scale(.7)'),
  speech_dots: at(
    94,
    24,
    shape(
      'M-18 -12H18Q26 -12 26 -4V6Q26 14 18 14H-4L-12 22V14H-18Q-26 14 -26 6V-4Q-26 -12 -18 -12Z',
      C.white,
      2.6,
    ) +
      dot(-10, 1, 2.6) +
      dot(0, 1, 2.6) +
      dot(10, 1, 2.6),
  ),
  bulb: at(
    96,
    32,
    `<g class="flicker">${stroke('M0 -26V-21M-17 -16L-13 -13M17 -16L13 -13M-22 0H-18M22 0H18', 3, C.gold)}</g>` +
      shape(
        'M0 -14C-11 -14 -15 -4 -9 4C-6 8 -5 10 -5 13H5C5 10 6 8 9 4C15 -4 11 -14 0 -14Z',
        C.yellow,
        2.8,
      ) +
      rect(-5, 13, 10, 7, 2, C.grey, 2.4) +
      stroke('M-3 3L0 -2L3 3', 2, C.gold),
  ),
  // Held by the handle and swept across the face.
  magnifier: swing(
    'scan',
    [114, 92],
    at(
      82,
      60,
      `<circle r="17" fill="${C.white}" fill-opacity=".28" stroke="${C.line}" stroke-width="9"/>` +
        `<circle r="17" fill="none" stroke="${C.brown}" stroke-width="4.6"/>` +
        stroke('M12 12L32 32', 9) +
        stroke('M12 12L32 32', 5, C.brown),
    ) + hold(114, 92, 45),
  ),
  bug: delayed(
    'wobble',
    0,
    at(
      64,
      23,
      stroke(
        'M-5 -7L-8 -12M5 -7L8 -12M-8 -2H-14M8 -2H14M-7 4L-12 9M7 4L12 9',
        2.2,
      ) +
        `<ellipse cy="2" rx="8.5" ry="9.5" fill="${C.green}" ${outline(2.6)}/>` +
        stroke('M0 -7V11', 2, C.line) +
        dot(-3.5, 1, 1.5) +
        dot(3.5, 5, 1.5) +
        dot(-3.5, 7, 1.2) +
        circle(0, -9, 4.2, C.line, 1),
    ),
  ),
  rocket: at(
    100,
    26,
    `<g class="flicker">${shape('M-5 10Q0 28 5 10Z', C.orange, 2.4)}</g>` +
      shape('M-9 6L-17 17L-8 14Z', C.heart, 2.4) +
      shape('M9 6L17 17L8 14Z', C.heart, 2.4) +
      shape('M0 -22Q10 -10 9 10H-9Q-10 -10 0 -22Z', C.paper, 2.8) +
      circle(0, -4, 4.6, C.blue, 2.2),
    ' rotate(38)',
  ),
  clock: at(
    26,
    26,
    circle(0, 0, 14, C.paper, 2.8) +
      stroke('M0 0V-8M0 0L6 3', 2.8) +
      stroke('M0 -11V-9M11 0H9M0 11V9M-11 0H-9', 2),
  ),
  moon:
    at(
      104,
      24,
      shape('M6 -13A14 14 0 1 0 6 13A11 11 0 1 1 6 -13Z', C.yellow, 2.8),
    ) + delayed('float', 0, at(88, 18, sparkle(4.5))),
  broken_heart: at(
    100,
    26,
    heart() + stroke('M0 -8L-3 -2L2 2L-1 9', 2.2, C.white),
    ' scale(1.4)',
  ),
  laptop:
    rect(29, 96, 70, 25, 5, C.grey) +
    circle(64, 109, 4.5, C.orange, 2) +
    shape('M20 121H108L104 126H24Z', C.greyDark, 2.6),
  mug: [
    delayed('float', 0, stroke('M96 80Q92 74 96 68', 2.8, C.grey)),
    delayed('float', -1, stroke('M104 82Q100 76 104 70', 2.8, C.grey)),
    shape('M108 96H114Q122 96 122 104Q122 112 114 112H108', 'none', 3),
    rect(84, 90, 26, 28, 5, C.orange),
    stroke('M91 100H103', 2.4, C.paper),
    hold(88, 114),
  ].join(''),
  bowl: [
    shape('M32 100Q32 78 64 78Q96 78 96 100Z', C.paper),
    stroke('M80 78L102 54M86 80L108 60', 3.4, C.brown),
    shape('M28 100H100Q100 124 64 124Q28 124 28 100Z', C.orange),
    stroke('M34 107H94', 2.4, C.orangeDark),
  ].join(''),
  bowl_dirt: [
    shape('M32 100Q34 82 64 84Q94 82 96 100Z', '#6a4a35'),
    dot(50, 94, 2.4, '#4b3425'),
    dot(70, 90, 2.4, '#4b3425'),
    dot(82, 96, 2.4, '#4b3425'),
    stroke('M80 84L104 62', 3.6, C.grey),
    shape('M28 100H100Q100 124 64 124Q28 124 28 100Z', C.paper),
    stroke('M34 107H94', 2.4, C.grey),
  ].join(''),
  tea: [
    hold(96, 110),
    shape('M86 76L106 76L103 112Q96 116 89 112Z', C.paper, 2.8),
    `<path d="M87.5 92L104.5 92L103 112Q96 116 89 112Z" fill="#e8b4a0"/>`,
    dot(92, 108, 2.2, '#4b3425'),
    dot(97, 110, 2.2, '#4b3425'),
    dot(100, 105, 2.2, '#4b3425'),
    rect(83, 71, 26, 6, 3, C.orange, 2.4),
    stroke('M98 71L104 52', 4.4, C.orange),
  ].join(''),
  mooncake: [
    hold(94, 112),
    circle(94, 98, 18, '#d7a35f', 3),
    `<circle cx="94" cy="98" r="12" fill="none" stroke="#a8742f" stroke-width="2.4"/>`,
    stroke('M94 89V107M85 98H103M88 92L100 104M100 92L88 104', 2, '#a8742f'),
  ].join(''),
  brick: [
    hold(96, 112, -10),
    at(
      98,
      100,
      rect(-17, -9, 34, 18, 2, '#cf5a43') +
        dot(-8, 0, 2.4, '#a8402c') +
        dot(0, 0, 2.4, '#a8402c') +
        dot(8, 0, 2.4, '#a8402c'),
      ' rotate(-12)',
    ),
  ].join(''),
  melon: [
    hold(96, 114),
    at(
      96,
      94,
      shape('M-21 -6A21 21 0 0 0 21 -6Z', C.green, 2.8) +
        `<path d="M-17 -6A17 17 0 0 0 17 -6Z" fill="${C.paper}"/>` +
        `<path d="M-14.5 -6A14.5 14.5 0 0 0 14.5 -6Z" fill="${C.heart}"/>` +
        dot(-6, 2, 1.7) +
        dot(2, 5, 1.7) +
        dot(7, 0, 1.7),
    ),
  ].join(''),
  book: [
    shape('M20 98L64 104L108 98V120L64 126L20 120Z', C.orange),
    shape('M24 96L62 102V122L24 117Z', C.paper, 2.6),
    shape('M104 96L66 102V122L104 117Z', C.paper, 2.6),
    stroke(
      'M30 104L56 108M30 110L56 114M98 104L72 108M98 110L72 114',
      1.8,
      C.greyDark,
    ),
  ].join(''),
  duck: at(
    98,
    100,
    stroke('M-14 2L-21 -5L-11 -3', 2.6) +
      `<ellipse cy="6" rx="17" ry="12" fill="${C.yellow}" ${outline(2.8)}/>` +
      shape('M-4 4Q4 -1 10 6Q2 10 -4 4Z', C.gold, 2) +
      circle(8, -10, 10, C.yellow, 2.8) +
      shape('M17 -10L27 -8L17 -4Z', C.orange, 2.2) +
      dot(11, -13, 1.9),
  ),
};

// ── Motion ──────────────────────────────────────────────────────────────
// [animation, keyframes, transform-origin]. Only what a sticker uses is
// written into its file, and none of it runs when the visitor asks for less.
// A group drawn around the joint it turns on says 'pivot'.

export const MOTION = {
  blink: [
    '4.8s infinite',
    '0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}',
  ],
  shake: [
    '.45s ease-in-out infinite',
    '0%,100%{transform:rotate(0)}25%{transform:rotate(-2.5deg)}75%{transform:rotate(2.5deg)}',
  ],
  bounce: [
    '.7s ease-in-out infinite',
    '0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}',
  ],
  sway: [
    '2.4s ease-in-out infinite',
    '0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}',
    '50% 100%',
  ],
  wobble: [
    '.9s ease-in-out infinite',
    '0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}',
  ],
  float: [
    '2.4s ease-out infinite',
    '0%{opacity:0;transform:translateY(6px)}25%,75%{opacity:1}100%{opacity:0;transform:translateY(-10px)}',
  ],
  drop: [
    '1.8s ease-in infinite',
    '0%{opacity:0;transform:translateY(-3px)}20%{opacity:1}100%{opacity:0;transform:translateY(10px)}',
  ],
  pulse: [
    '.8s ease-in-out infinite',
    '0%,100%{transform:scale(1)}50%{transform:scale(1.22)}',
  ],
  breathe: [
    '2.2s ease-in-out infinite',
    '0%,100%{transform:scale(.6)}50%{transform:scale(1.1)}',
  ],
  spin: ['2.6s linear infinite', '100%{transform:rotate(360deg)}', 'pivot'],
  flicker: [
    '.6s ease-in-out infinite',
    '0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.12)}',
    '50% 100%',
  ],
  wave: [
    '.7s ease-in-out infinite',
    '0%,100%{transform:rotate(-11deg)}50%{transform:rotate(6deg)}',
    'pivot',
  ],
  clap: [
    '.7s ease-in-out infinite',
    '0%,100%{transform:rotate(0)}50%{transform:rotate(-11deg)}',
    'pivot',
  ],
  flash: ['.7s ease-in-out infinite', '0%,100%{opacity:0}40%,60%{opacity:1}'],
  pop: [
    '1.6s ease-in-out infinite',
    '0%,60%,100%{transform:scale(1)}75%{transform:scale(1.12)}',
    'pivot',
  ],
  quiver: [
    '.2s linear infinite',
    '0%,100%{transform:rotate(-1.4deg)}50%{transform:rotate(1.4deg)}',
    'pivot',
  ],
  hop: [
    '.7s ease-in-out infinite',
    '0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}',
  ],
  pump: [
    '.7s ease-in-out infinite',
    '0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}',
  ],
  wag: [
    '.5s ease-in-out infinite',
    '0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}',
    'pivot',
  ],
  shrug: [
    '1.6s ease-in-out infinite',
    '0%,100%{transform:translateY(0)}35%,60%{transform:translateY(-4px)}',
  ],
  plead: [
    '.6s ease-in-out infinite',
    '0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(2deg)}',
    'pivot',
  ],
  jab: [
    '.45s ease-in-out infinite',
    '0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}',
  ],
  beat: [
    '.9s ease-in-out infinite',
    '0%,100%{transform:scale(1)}50%{transform:scale(1.08)}',
    'pivot',
  ],
  puff: [
    '1.2s ease-out infinite',
    '0%{opacity:0;transform:scale(.4)}30%{opacity:1}100%{opacity:0;transform:scale(1.15)}',
  ],
  tap: [
    '.5s ease-in-out infinite',
    '0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}',
  ],
  wiggle: [
    '.36s ease-in-out infinite',
    '0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}',
    'pivot',
  ],
  chew: [
    '.5s ease-in-out infinite',
    '0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.9)}',
  ],
  munch: [
    '.35s ease-in-out infinite',
    '0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}',
  ],
  streak: [
    '.5s linear infinite',
    '0%{opacity:0;transform:translateX(8px)}30%{opacity:1}100%{opacity:0;transform:translateX(-10px)}',
  ],
  scan: [
    '2.2s ease-in-out infinite',
    '0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}',
    'pivot',
  ],
  ...Object.fromEntries(
    STARTS.map((start, index) => [
      `orbit${index}`,
      [
        '2.6s linear infinite',
        Array.from({ length: ORBIT.steps + 1 }, (_, step) => {
          const [x, y] = orbitAt(start + step / ORBIT.steps);
          return `${+((step * 100) / ORBIT.steps).toFixed(2)}%{transform:translate(${x}px,${y}px)}`;
        }).join(''),
        'pivot',
      ],
    ]),
  ),
};

// Draws a sticker as a 128×128 SVG. The gorilla is assembled from parts that
// each sticker picks for itself: glasses, headgear, clothes, eyes, brows and
// mouth, a tilt, the hands and the props around. Memes also carry a caption.
// One filter over the whole drawing adds the white die-cut border, which keeps
// the outline readable on light and dark pages alike.
//
// What makes the set one set: every sticker is the same gorilla in round
// glasses, lit from the upper left, drawn in the palette and the line weights
// of draw.mjs, and captioned in one typeface.

import { C } from './draw.mjs';
import { CAPTION_GLYPHS } from './glyphs.mjs';
import {
  EYE_X,
  LENSES,
  MOUTHS,
  brows,
  eyesOf,
  muzzle,
  skull,
} from './face.mjs';
import {
  BACK_EXTRAS,
  BODIES,
  EXTRAS,
  GEAR,
  HANDS,
  HEAD_EXTRAS,
  MOTION,
  SKIN_EXTRAS,
  SLEEVES,
} from './props.mjs';

// A group moves about the middle of its own box unless the motion names an
// origin. A 'pivot' group is drawn around the joint it turns on, so it turns
// about its own origin.
const origin = (where = 'center') =>
  where === 'pivot'
    ? 'transform-box:view-box;transform-origin:0 0'
    : `transform-box:fill-box;transform-origin:${where}`;

// Only the animations a sticker uses end up in its file. They stay off for
// visitors who ask for less motion.
function styles(body) {
  const used = Object.keys(MOTION).filter((name) =>
    body.includes(`class="${name}"`),
  );
  if (!used.length) return '';
  const base = used
    .map((name) => `.${name}{${origin(MOTION[name][2])}}`)
    .join('');
  const motion = used
    .map(
      (name) =>
        `.${name}{animation:${name} ${MOTION[name][0]}}@keyframes ${name}{${MOTION[name][1]}}`,
    )
    .join('');
  return `<style>${base}@media(prefers-reduced-motion:no-preference){${motion}}</style>`;
}

// Blurring the alpha and cutting it at a low threshold grows every edge by
// about the same distance with round corners.
const DIE_CUT =
  '<filter id="cut" x="0" y="0" width="128" height="128" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
  '<feGaussianBlur in="SourceAlpha" stdDeviation="3.4" result="far"/>' +
  '<feComponentTransfer in="far" result="rim"><feFuncA type="linear" slope="14"/></feComponentTransfer>' +
  '<feColorMatrix in="rim" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .2 0" result="shadow"/>' +
  '<feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="near"/>' +
  '<feComponentTransfer in="near" result="edge"><feFuncA type="linear" slope="14"/></feComponentTransfer>' +
  `<feFlood flood-color="${C.white}"/>` +
  '<feComposite in2="edge" operator="in" result="border"/>' +
  '<feMerge><feMergeNode in="shadow"/><feMergeNode in="border"/><feMergeNode in="SourceGraphic"/></feMerge>' +
  '</filter>';

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The caption is drawn from glyph outlines (see glyphs.mjs), not set in a
// font, so it has the same weight and width on every system. It is centred
// on its ink, not on its advance widths: a full-width ？ or ！ keeps its ink
// in the left half of its box and would otherwise pull the line off centre.
const CAPTION = { size: 25, width: 108, bottom: 115.5, descent: 96 };

function captionText(text, color = C.white) {
  let advance = 0;
  let left = Infinity;
  let right = 0;
  let descent = CAPTION.descent;
  let d = '';
  for (const character of text) {
    const glyph = CAPTION_GLYPHS[character];
    if (!glyph)
      throw new Error(
        `No outline for “${character}” in the caption “${text}”. Run node scripts/sticker-glyphs.mjs.`,
      );
    const [width, inkLeft, inkRight, below, x, y, path] = glyph;
    if (path) {
      left = Math.min(left, advance + inkLeft);
      right = advance + inkRight;
      descent = Math.max(descent, below);
      d += `M${advance + x} ${y}${path}`;
    }
    advance += width;
  }
  const size = Math.min(CAPTION.size, (CAPTION.width * 1000) / (right - left));
  const scale = size / 1000;
  const x = 64 - ((left + right) / 2) * scale;
  const y = CAPTION.bottom - descent * scale;
  return `<path transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})" d="${d}" fill="${color}" stroke="${C.line}" stroke-width="280" stroke-linejoin="round" paint-order="stroke"/>`;
}

// A shaded shape brings its own clip path. They are gathered into the file's
// <defs>, each one once however often its shape is drawn.
function gatherClips(body) {
  const clips = new Map();
  const drawing = body.replace(
    /<clipPath id="([^"]+)">.*?<\/clipPath>/g,
    (clip, id) => {
      clips.set(id, clip);
      return '';
    },
  );
  return [[...clips.values()].join(''), drawing];
}

function head(sticker) {
  const {
    eyes = 'open',
    look = [0, 0],
    brows: brow = 'neutral',
    mouth = 'smile',
    glasses = 'round',
    gear = [],
    body = 'hoodie',
    tilt = 0,
    pivot = [64, 100],
    squash = [1, 1],
    lift = 0,
    extras = [],
    motion,
    blink,
  } = sticker;
  const lens = LENSES[glasses];
  const worn = [].concat(gear).map((name) => GEAR[name]);
  const eyeMarks = lens.hidesEyes ? '' : eyesOf(eyes, lens, look);
  // An extra that follows the eyes is a function of what they sit in.
  const from = (table) =>
    extras
      .filter((name) => name in table)
      .map((name) =>
        typeof table[name] === 'function' ? table[name](lens) : table[name],
      )
      .join('');
  const face =
    worn.map((part) => part.back ?? '').join('') +
    skull(tilt) +
    brows(brow, lens.R) +
    muzzle(tilt) +
    from(SKIN_EXTRAS) +
    EYE_X.map(lens.back).join('') +
    (blink ? `<g class="blink">${eyeMarks}</g>` : eyeMarks) +
    EYE_X.map(lens.front).join('') +
    lens.bridge +
    MOUTHS[mouth] +
    worn.map((part) => part.front ?? '').join('') +
    from(HEAD_EXTRAS);
  const [px, py] = pivot;
  // Without a body the head fills the frame.
  const zoom =
    body === 'none' ? 'translate(64 64) scale(1.1) translate(-64 -64) ' : '';
  const placed = `<g transform="${zoom}translate(0 ${4 + lift}) translate(${px} ${py}) rotate(${tilt}) scale(${squash[0]} ${squash[1]}) translate(${-px} ${-py})">${face}</g>`;
  return motion ? `<g class="${motion}">${placed}</g>` : placed;
}

export function drawSticker(sticker) {
  const {
    label,
    body = 'hoodie',
    hands = [],
    extras = [],
    caption,
    captionColor,
  } = sticker;
  const poses = hands.map((name) => HANDS[name]);
  const drawing =
    extras
      .filter((name) => name in BACK_EXTRAS)
      .map((name) => BACK_EXTRAS[name])
      .join('') +
    poses.map((pose) => pose.back ?? '').join('') +
    BODIES[body] +
    head(sticker) +
    poses.map((pose) => pose.front ?? '').join('') +
    extras
      .filter((name) => name in EXTRAS)
      .map((name) => EXTRAS[name])
      .join('');
  const fitted = caption
    ? `<g transform="translate(64 6) scale(.78) translate(-64 -4)" color="${SLEEVES[body]}">${drawing}</g>${captionText(caption, captionColor)}`
    : `<g transform="translate(64 64) scale(.9) translate(-64 -64)" color="${SLEEVES[body]}">${drawing}</g>`;
  const [clips, picture] = gatherClips(fitted);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">' +
    // The caption is outlines, so the file says in words what it shows.
    (label ? `<title>${escape(caption ?? label)}</title>` : '') +
    `<defs>${DIE_CUT}${clips}</defs>` +
    styles(picture) +
    `<g filter="url(#cut)">${picture}</g>` +
    '</svg>'
  );
}

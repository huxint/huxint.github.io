// Draws a sticker as a 128×128 SVG. The gorilla is assembled from parts that
// each sticker picks for itself: glasses, headgear, clothes, eyes, brows and
// mouth, a tilt, the hands and the props around. Memes also carry a caption.
// One filter over the whole drawing adds the white die-cut border, which keeps
// the outline readable on light and dark pages alike.

import { C } from './draw.mjs';
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
  SLEEVES,
} from './props.mjs';

const FONT =
  "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC','WenQuanYi Micro Hei',sans-serif";

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

// Wide characters take a full em, Latin letters about 0.62 of it.
function captionText(text, color = C.white) {
  const em = [...text].reduce(
    (total, char) => total + (char.charCodeAt(0) > 127 ? 1 : 0.62),
    0,
  );
  const size = Math.min(25, 108 / em);
  return `<text x="64" y="${/[gjpqy]/.test(text) ? 108 : 113}" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="${size.toFixed(1)}" fill="${color}" stroke="${C.line}" stroke-width="${(size * 0.28).toFixed(1)}" stroke-linejoin="round" paint-order="stroke">${escape(text)}</text>`;
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
  const face =
    worn.map((part) => part.back ?? '').join('') +
    skull +
    brows(brow, lens.R) +
    muzzle +
    EYE_X.map(lens.back).join('') +
    (blink ? `<g class="blink">${eyeMarks}</g>` : eyeMarks) +
    EYE_X.map(lens.front).join('') +
    lens.bridge +
    MOUTHS[mouth] +
    worn.map((part) => part.front ?? '').join('') +
    extras
      .filter((name) => name in HEAD_EXTRAS)
      .map((name) => HEAD_EXTRAS[name])
      .join('');
  const [px, py] = pivot;
  // Without a body the head fills the frame.
  const zoom =
    body === 'none' ? 'translate(64 64) scale(1.1) translate(-64 -64) ' : '';
  const placed = `<g transform="${zoom}translate(0 ${4 + lift}) translate(${px} ${py}) rotate(${tilt}) scale(${squash[0]} ${squash[1]}) translate(${-px} ${-py})">${face}</g>`;
  return motion ? `<g class="${motion}">${placed}</g>` : placed;
}

export function drawSticker(sticker) {
  const {
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
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">' +
    `<defs>${DIE_CUT}</defs>` +
    styles(fitted) +
    `<g filter="url(#cut)">${fitted}</g>` +
    '</svg>'
  );
}

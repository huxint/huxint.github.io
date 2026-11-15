// Shared palette and small SVG helpers for the sticker parts.

// One palette for the whole set. A prop takes its colours from here, so a
// red is the same red on a heart, a badge and a clown's nose.
export const C = {
  line: '#22252d',
  fur: '#5b6070',
  furDark: '#3a3e4b',
  furLight: '#7a8194',
  furShade: '#4a4f5e',
  skin: '#e6bf9b',
  skinShade: '#c99c78',
  nostril: '#9c6f55',
  muzzle: '#f3dcc2',
  muzzleShade: '#dfbd9c',
  slate: '#3a3f4e',
  slateLight: '#555b6d',
  slateDark: '#2b2f3b',
  night: '#2f3342',
  dark: '#1d2029',
  string: '#dfe2ea',
  orange: '#f08040',
  orangeDark: '#c9622a',
  lens: '#f4f8ff',
  glint: '#c4dbf6',
  mouth: '#6b2b2a',
  tongue: '#ec8a78',
  blush: '#ef8f7a',
  tear: '#6cb7e8',
  tearDark: '#3f8fc7',
  bubble: '#cfe9f7',
  heart: '#e5484d',
  green: '#3fae6a',
  mint: '#8fd59d',
  blue: '#5b8def',
  sky: '#9db8e8',
  navy: '#3b4a8c',
  purple: '#8a5bd6',
  yellow: '#f6c945',
  gold: '#f2b632',
  amber: '#e08a1e',
  paper: '#fdfbf4',
  grey: '#b9bec9',
  greyDark: '#8a90a0',
  brown: '#8b5a3c',
  crust: '#d7a35f',
  crustDark: '#a8742f',
  brick: '#cf5a43',
  soil: '#6a4a35',
  cocoa: '#4b3425',
  milkTea: '#e8b4a0',
  white: '#fff',
};

// Tones are worked out in OKLab, where a step of lightness looks the same
// size on every hue, so every lit surface is shaded to the same depth.
const toLinear = (value) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toGamma = (value) =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

function toOklab(hex) {
  const full =
    hex.length === 4
      ? hex.replace(/[0-9a-f]/gi, (digit) => digit + digit)
      : hex;
  const [r, g, b] = [1, 3, 5].map((at) =>
    toLinear(parseInt(full.slice(at, at + 2), 16) / 255),
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function toHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return (
    '#' +
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ]
      .map((channel) =>
        Math.round(255 * Math.min(1, Math.max(0, toGamma(channel))))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

// The same colour, lighter or darker by a step of lightness.
export function tone(hex, step) {
  const [L, a, b] = toOklab(hex);
  return toHex([Math.min(1, Math.max(0, L + step)), a, b]);
}

// The side of a surface turned away from the light, and the edge that
// catches it. Dark colours take a smaller step, as the hand-picked fur and
// skin tones do.
export const shade = (hex) =>
  tone(hex, -Math.min(0.1, 0.04 + 0.07 * toOklab(hex)[0]));
export const light = (hex) => tone(hex, 0.06 + 0.06 * (1 - toOklab(hex)[0]));

// Outline weights. Everything solid is outlined in one of these: the frames
// of the glasses; the head, clothes and large props; hands and what they
// hold; small parts.
export const LINE = { frame: 3.4, form: 3, part: 2.6, small: 2.2 };

export const outline = (width = LINE.form, color = C.line) =>
  `stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;

export const stroke = (d, width = 3.4, color = C.line) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

// A filled shape with the sticker outline.
export const shape = (d, color, width = LINE.form) =>
  `<path d="${d}" fill="${color}" ${outline(width)}/>`;

// Light comes from the upper left on every sticker. A lit surface is its
// shade colour with the true colour laid over it a little up and to the left,
// clipped to the shape, which leaves a crescent of shade along the lower right
// edge. Half of an outline lies inside its shape, so the copy moves further
// than the outline is wide.
export const LIGHT = [-3, -3.5];
export const LIGHT_SMALL = [-2.2, -2.6];

// The same light for a part that is drawn turned: the offset is turned back
// by as much, so the shade stays on the lower right of the picture.
export function lightFrom(rotation, [x, y] = LIGHT) {
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [+(x * cos + y * sin).toFixed(2), +(y * cos - x * sin).toFixed(2)];
}
export const lightOnSmall = (rotation) => lightFrom(rotation, LIGHT_SMALL);

// One clip path per shape; art.mjs moves them into the file's <defs>.
function clipId(element) {
  let hash = 5381;
  for (let at = 0; at < element.length; at += 1)
    hash = ((hash * 33) ^ element.charCodeAt(at)) >>> 0;
  return `c${hash.toString(36)}`;
}

// The element is named without its paint: 'path d="…"', 'circle cx="…" …'.
// A width of 0 leaves the outline to whatever the shape sits in.
export function lit(element, fill, width = LINE.form, by = LIGHT, dark) {
  const id = clipId(element);
  return (
    `<clipPath id="${id}"><${element}/></clipPath>` +
    `<g clip-path="url(#${id})"><${element} fill="${dark ?? shade(fill)}"/>` +
    `<${element} fill="${fill}" transform="translate(${by[0]} ${by[1]})"/></g>` +
    (width ? `<${element} fill="none" ${outline(width)}/>` : '')
  );
}

export const litPath = (d, fill, width, by, dark) =>
  lit(`path d="${d}"`, fill, width, by, dark);
export const litRect = (x, y, width, height, radius, fill, line, by, dark) =>
  lit(
    `rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"`,
    fill,
    line,
    by,
    dark,
  );
export const litCircle = (x, y, r, fill, width, by, dark) =>
  lit(`circle cx="${x}" cy="${y}" r="${r}"`, fill, width, by, dark);
export const litEllipse = (x, y, rx, ry, fill, width, by, dark) =>
  lit(
    `ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"`,
    fill,
    width,
    by,
    dark,
  );

export const at = (x, y, content, extra = '') =>
  `<g transform="translate(${x} ${y})${extra}">${content}</g>`;

// A stroke with a white backing, so a small prop stays readable over the head.
export const pinned = (d, width, color) =>
  stroke(d, width + 4, C.white) + stroke(d, width, color);

export const HEART =
  'M0 8C-12 0 -10 -9 -4.5 -9C-2 -9 0 -7.5 0 -5.5C0 -7.5 2 -9 4.5 -9C10 -9 12 0 0 8Z';
export const TEARDROP =
  'M0 -9C4 -3 7 1 7 4.5A7 7 0 0 1 -7 4.5C-7 1 -4 -3 0 -9Z';

export const heart = (fill = C.heart) =>
  `<path d="${HEART}" fill="${fill}" stroke="${C.white}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="-4.2" cy="-4.2" rx="1.8" ry="1.2" fill="${C.white}" opacity=".7" transform="rotate(-30 -4.2 -4.2)"/>`;

export const teardrop = (fill = C.tear) =>
  `<path d="${TEARDROP}" fill="${fill}"/><ellipse cx="-2.6" cy="3" rx="1.5" ry="2.4" fill="${C.white}" opacity=".7"/>`;

// A four-point sparkle centred on the origin.
export const sparkle = (size = 8, fill = C.yellow) =>
  `<path d="M0 ${-size}Q${size * 0.18} ${-size * 0.18} ${size} 0Q${size * 0.18} ${size * 0.18} 0 ${size}Q${-size * 0.18} ${size * 0.18} ${-size} 0Q${-size * 0.18} ${-size * 0.18} 0 ${-size}Z" fill="${fill}" ${outline(1.6)}/>`;

// Letters drawn as strokes, centred on the origin in a 12×12 box.
export const GLYPHS = {
  A: 'M-5 5L0 -6L5 5M-3 1H3',
  C: 'M5 -3Q1 -7 -3 -4Q-6 0 -3 4Q1 7 5 3',
  E: 'M4 -5H-3V5H4M-3 0H3',
  G: 'M4 -3Q1 -7 -3 -4Q-6 0 -3 4Q1 7 4 3V0H0',
  L: 'M-3 -5V5H4',
  M: 'M-6 5V-5L0 1L6 -5V5',
  R: 'M-3 5V-5H2A3 3 0 0 1 2 1H-3M1 1L4 5',
  T: 'M-5 -5H5M0 -5V5',
  W: 'M-7 -5L-3.5 5L0 -2L3.5 5L7 -5',
  Q: 'M-3 -5H3Q6 -5 6 0Q6 5 3 5H-3Q-6 5 -6 0Q-6 -5 -3 -5ZM2 3L6 7',
};

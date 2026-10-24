// Shared palette and small SVG helpers for the sticker parts.

export const C = {
  line: '#22252d',
  fur: '#5b6070',
  furDark: '#3a3e4b',
  skin: '#e6bf9b',
  skinShade: '#c99c78',
  nostril: '#9c6f55',
  muzzle: '#f3dcc2',
  slate: '#3a3f4e',
  string: '#dfe2ea',
  orange: '#f08040',
  orangeDark: '#c9622a',
  lens: '#f4f8ff',
  mouth: '#6b2b2a',
  tongue: '#ec8a78',
  blush: '#ef8f7a',
  tear: '#6cb7e8',
  tearDark: '#3f8fc7',
  heart: '#e5484d',
  green: '#3fae6a',
  blue: '#5b8def',
  navy: '#3b4a8c',
  yellow: '#f6c945',
  gold: '#f2b632',
  paper: '#fdfbf4',
  grey: '#b9bec9',
  greyDark: '#8a90a0',
  brown: '#8b5a3c',
  white: '#fff',
};

export const outline = (width = 3, color = C.line) =>
  `stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;

export const stroke = (d, width = 3.4, color = C.line) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

// A filled shape with the sticker outline.
export const shape = (d, color, width = 3) =>
  `<path d="${d}" fill="${color}" ${outline(width)}/>`;

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

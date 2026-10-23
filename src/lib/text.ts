const wide = String.raw`\p{Script=Han}\u3000-\u303f\uff00-\uffef`;
const wideBreak = new RegExp(
  String.raw`([${wide}])\s*\n\s*(?=[${wide}])`,
  'gu',
);

// Joins lines into one: a break between two Chinese characters disappears, any
// other run of whitespace becomes a single space.
export function joinLines(text: string): string {
  return text.replace(wideBreak, '$1').replace(/\s+/g, ' ').trim();
}

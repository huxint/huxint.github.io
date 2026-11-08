const han = String.raw`\p{Script=Han}`;
const fullwidth = String.raw`[\u3000-\u303f\uff00-\uffef]`;
const wideBreak = new RegExp(
  String.raw`(?<=${fullwidth})\s*\n\s*|\s*\n\s*(?=${fullwidth})|(?<=${han})\s*\n\s*(?=${han})`,
  'gu',
);

// Joins lines into one. A break disappears between two Chinese characters and
// beside full-width punctuation, which carries its own space; any other run of
// whitespace becomes a single space.
export function joinLines(text: string): string {
  return text.replace(wideBreak, '').replace(/\s+/g, ' ').trim();
}

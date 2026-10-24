import katex from 'katex';
import { Marked, type Token } from 'marked';
import {
  stickerAt,
  stickerAttributes,
  stickerClasses,
} from './stickers/catalog.mjs';

// Post titles and descriptions are one line of Markdown, with $math$ typeset
// by KaTeX under the same strict rules as the article body, and :id: shown as
// the sticker it names.
const markdown = new Marked({
  extensions: [
    {
      name: 'sticker',
      level: 'inline',
      start: (source) => source.indexOf(':'),
      tokenizer(source) {
        const hit = stickerAt(source, 0);
        if (hit)
          return {
            type: 'sticker',
            raw: source.slice(0, hit.end),
            sticker: hit.sticker,
          };
      },
      renderer: ({ sticker }) => {
        const attributes = Object.entries(stickerAttributes(sticker))
          .map(([name, value]) => `${name}="${value}"`)
          .join(' ');
        return `<img class="${stickerClasses(sticker).join(' ')}" ${attributes}>`;
      },
    },
    {
      name: 'math',
      level: 'inline',
      start: (source) => source.indexOf('$'),
      tokenizer(source) {
        const match = /^\$([^$\n]+)\$/.exec(source);
        if (match) return { type: 'math', raw: match[0], text: match[1] };
      },
      renderer: ({ text }) => katex.renderToString(text, { strict: 'error' }),
    },
  ],
});

export function inlineHtml(source: string): string {
  return markdown.parseInline(source, { async: false });
}

// A command becomes the character KaTeX draws for it (\varphi → φ, \to → →).
// Commands that need an argument, such as \sqrt, keep their name.
function commandText(command: string): string {
  try {
    return katex
      .renderToString(command, { output: 'mathml' })
      .replace(/<annotation.*<\/annotation>|<[^>]+>|⁡/gs, '');
  } catch {
    return command.slice(1);
  }
}

function texText(tex: string): string {
  return tex
    .replace(/\\[A-Za-z]+/g, (command, offset: number) => {
      const text = commandText(command);
      // A name such as log needs the space TeX would set after a letter: n log n.
      const spaced =
        /^\p{L}{2,}$/u.test(text) &&
        /[\p{L}\p{N}]/u.test(tex.charAt(offset - 1));
      return spaced ? ` ${text}` : text;
    })
    .replace(/[{}]/g, '');
}

function tokensText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if (token.type === 'math') return texText(token.text);
      if (token.type === 'sticker') return `[${token.sticker.label}]`;
      if ('tokens' in token && token.tokens) return tokensText(token.tokens);
      return 'text' in token ? token.text : '';
    })
    .join('');
}

// The same line as plain text, for <title>, meta tags, RSS and the search index.
export function inlineText(source: string): string {
  return tokensText(markdown.lexer(source)).replace(/\s+/g, ' ').trim();
}

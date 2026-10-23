import { marked, type Token } from 'marked';
import { joinLines } from './text';

function plainText(tokens: Token[], links: boolean): string {
  return tokens
    .map((token): string => {
      if (
        token.type === 'image' ||
        token.type === 'html' ||
        (token.type === 'link' && !links)
      )
        return '';
      if (token.type === 'br') return '\n';
      if ('tokens' in token && token.tokens)
        return plainText(token.tokens, links);
      return 'text' in token ? token.text : '';
    })
    .join('');
}

// The first paragraph with words of its own, skipping badge and link rows.
export function readmeIntroduction(markdown: string): string | undefined {
  for (const token of marked.lexer(markdown)) {
    if (token.type !== 'paragraph') continue;
    if (!/[\p{L}\p{N}]/u.test(plainText(token.tokens!, false))) continue;
    return joinLines(plainText(token.tokens!, true));
  }
}

import katex from 'katex';
import { visit } from 'unist-util-visit';

/*
 * remark-math only sees Markdown text. A raw HTML block (<div>, <table>,
 * <details> written without blank lines) reaches the page untouched, so its
 * $…$ would stay as typed. Render those formulas with the same KaTeX options
 * as the rest of the article; rehype-raw later parses the markup, and
 * rehypeArticle treats it like any other formula.
 */
const SKIPPED = new Set([
  'script',
  'style',
  'code',
  'pre',
  'textarea',
  'kbd',
  'samp',
  'svg',
  'math',
  'template',
]);
const TOKEN = /<!--[\s\S]*?-->|<\/?[A-Za-z][^<>]*>/g;
// $$…$$, \[…\], \(…\), then $…$ with pandoc's rules: no space inside the
// delimiters and no digit after the closing one, so prices stay prices.
export const MATH =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$A-Za-z0-9])\$(?![\s$])((?:\\[\s\S]|[^$\\])+?)(?<![\s\\])\$(?![\d$])/g;
const ENTITIES = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function renderText(text) {
  return text.replace(MATH, (_, block, bracket, paren, inline) => {
    const display = block ?? bracket;
    const source = (display ?? paren ?? inline).replace(
      /&(?:lt|gt|amp|quot|#39|nbsp);/g,
      (entity) => ENTITIES[entity],
    );
    const html = katex.renderToString(source, {
      displayMode: display !== undefined,
      strict: 'error',
      throwOnError: true,
    });
    // The wrapper rehypeArticle gives inline formulas, so they fit narrow columns too.
    return display === undefined
      ? `<span class="math-inline">${html}</span>`
      : html;
  });
}

export function renderHtmlMath(html) {
  let result = '';
  let last = 0;
  let skipped;
  for (const match of html.matchAll(TOKEN)) {
    const text = html.slice(last, match.index);
    result += skipped ? text : renderText(text);
    result += match[0];
    last = match.index + match[0].length;
    const tag = match[0].match(/^<(\/?)([A-Za-z][\w-]*)/);
    if (!tag) continue;
    const name = tag[2].toLowerCase();
    if (skipped) {
      if (tag[1] && name === skipped) skipped = undefined;
    } else if (!tag[1] && SKIPPED.has(name) && !match[0].endsWith('/>')) {
      skipped = name;
    }
  }
  const rest = html.slice(last);
  return result + (skipped ? rest : renderText(rest));
}

export function remarkHtmlMath() {
  return (tree, file) => {
    visit(tree, 'html', (node) => {
      if (!/[$\\]/.test(node.value)) return;
      try {
        node.value = renderHtmlMath(node.value);
      } catch (error) {
        file.fail(`HTML 里的公式有误：${error.message}`, node);
      }
    });
  };
}

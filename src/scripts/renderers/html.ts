import interFont from '@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2?url';
import monoFont from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
import mathMainFont from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?url';
import mathItalicFont from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?url';
import katexScript from 'katex/dist/katex.min.js?url';
import katexStyle from 'katex/dist/katex.min.css?inline';

// name ("KaTeX_Main-Bold") -> url. Frames ask for the faces their formulas use.
const mathFonts = new Map(
  Object.entries(
    import.meta.glob<string>('/node_modules/katex/dist/fonts/*.woff2', {
      query: '?url',
      import: 'default',
      eager: true,
    }),
  ).map(([path, url]) => [path.match(/([^/]+)\.woff2$/)![1], url]),
);
const mathFontData = new Map<string, Promise<ArrayBuffer>>();
// The frame cannot fetch the host's font files, so the faces arrive by message.
const mathStyle = `${katexStyle.replace(/@font-face\{[^}]*\}/g, '')}
  .katex{font-size:1.055em}
  .math-display{display:block;margin:1em 0;overflow-x:auto;overflow-y:hidden;text-align:center}
  .math-display>.katex-display{margin:0}
`;

// The host owns vertical scrolling, so viewport scrollbars must not narrow the measurement.
// Media queries see the frame, which on phones is the viewport less 40px of page margin:
// 680px here is the 720px breakpoint of the article text around it.
const baseStyle = `
  *,*::before,*::after{box-sizing:border-box}
  html{background:transparent;overflow-y:clip}
  body{display:flow-root;margin:0;min-width:0;background:transparent;color:var(--text);font:17px/1.9 var(--font-sans);font-optical-sizing:auto;overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
  b,strong,th{font-weight:600}
  button,input,select,textarea{font:inherit;color:inherit}
  code,pre,kbd,samp{font-family:var(--font-mono);font-variant-ligatures:none}
  math{font-family:KaTeX_Main,var(--font-serif)}
  math mi{font-family:KaTeX_Math;font-style:italic;text-transform:none}
  math mtext{font-family:var(--font-sans)}
  img,svg,canvas{max-width:100%;height:auto}
  :focus-visible{outline:2px solid var(--accent);outline-offset:4px}
  @media(max-width:680px){body{font-size:16px;line-height:1.85}}
`;
const fontSources = [
  {
    family: 'Inter Variable',
    weight: '100 900',
    style: 'normal',
    url: interFont,
  },
  {
    family: 'JetBrains Mono Variable',
    weight: '100 800',
    style: 'normal',
    url: monoFont,
  },
  { family: 'KaTeX_Main', weight: '400', style: 'normal', url: mathMainFont },
  { family: 'KaTeX_Math', weight: '400', style: 'italic', url: mathItalicFont },
];
let fontStyle: Promise<string> | undefined;

function frameFontStyle(): Promise<string> {
  // Opaque sandbox origins cannot reuse the host's font faces or fetch its dev assets.
  return (fontStyle ??= Promise.all(
    fontSources.map(async ({ family, weight, style, url }) => {
      const response = await fetch(url);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      return `@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};font-display:swap;src:url('${dataUrl}') format('woff2')}`;
    }),
  ).then((faces) => faces.join('')));
}

const frames = new Map<MessageEventSource | null, HTMLIFrameElement>();
let themeSnapshot: { theme: string; css: string } | undefined;

// Runs inside the transparent frame, with no references to the host module.
function frameBridge(): void {
  let previousHeight = -1;
  let measurementPending = false;

  function reportHeight(): void {
    measurementPending = false;
    const horizontalScrollbarHeight =
      window.innerHeight - document.documentElement.clientHeight;
    const height =
      Math.ceil(
        Math.max(
          document.body.scrollHeight,
          document.body.getBoundingClientRect().height,
        ),
      ) + horizontalScrollbarHeight;
    if (height === previousHeight) return;
    previousHeight = height;
    parent.postMessage(
      {
        type: 'article-render:height',
        height,
      },
      '*',
    );
  }

  function scheduleHeight(): void {
    if (measurementPending) return;
    measurementPending = true;
    // Animation frames can be suspended for diagrams below the viewport.
    queueMicrotask(reportHeight);
  }

  // Formulas use the article's delimiters: $…$, \(…\), $$…$$ and \[…\].
  // KaTeX is present only when the block's source looks like it has any.
  const katex = (window as any).katex;
  if (katex) {
    const pattern =
      /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$A-Za-z0-9])\$(?![\s$])((?:\\[\s\S]|[^$\\])+?)(?<![\s\\])\$(?![\d$])/g;
    const skipped =
      'script,style,code,pre,textarea,kbd,samp,svg,math,template,.katex,[data-no-math],[contenteditable]';
    // The two faces every formula needs are already in the base style.
    const requestedFonts = new Set(['KaTeX_Main-Regular', 'KaTeX_Math-Italic']);

    const requestFonts = (formula: HTMLElement): void => {
      for (const element of formula.querySelectorAll<HTMLElement>(
        '.katex-html *',
      )) {
        if (!element.firstChild || element.firstChild.nodeType !== 3) continue;
        const style = getComputedStyle(element);
        const family = style.fontFamily.split(',')[0].replace(/["']/g, '');
        if (!family.startsWith('KaTeX_')) continue;
        const variant =
          (Number(style.fontWeight) >= 600 ? 'Bold' : '') +
          (style.fontStyle === 'italic' ? 'Italic' : '');
        const name = `${family}-${variant || 'Regular'}`;
        if (requestedFonts.has(name)) continue;
        requestedFonts.add(name);
        parent.postMessage({ type: 'article-render:font', name }, '*');
      }
    };

    const renderText = (node: Text): void => {
      const text = node.data;
      if (!text.includes('$') && !text.includes('\\')) return;
      if (!node.parentElement || node.parentElement.closest(skipped)) return;
      let fragment: DocumentFragment | undefined;
      let last = 0;
      pattern.lastIndex = 0;
      for (let match; (match = pattern.exec(text));) {
        fragment ??= document.createDocumentFragment();
        const display = match[1] ?? match[2];
        const holder = document.createElement('span');
        holder.className =
          display === undefined ? 'math-inline' : 'math-display';
        katex.render(display ?? match[3] ?? match[4], holder, {
          displayMode: display !== undefined,
          throwOnError: false,
        });
        fragment.append(text.slice(last, match.index), holder);
        last = pattern.lastIndex;
      }
      if (!fragment) return;
      fragment.append(text.slice(last));
      const formulas = [...fragment.children] as HTMLElement[];
      node.replaceWith(fragment);
      // Computed fonts exist only once the formula is in the document.
      formulas.forEach(requestFonts);
    };

    const renderMath = (root: Node): void => {
      if (root.nodeType === 3) return renderText(root as Text);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const texts: Text[] = [];
      while (walker.nextNode()) texts.push(walker.currentNode as Text);
      texts.forEach(renderText);
    };

    renderMath(document.body);
    // Scripts keep writing formulas as readers drag and click.
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') renderMath(record.target);
        else
          record.addedNodes.forEach((node) => {
            if (node.isConnected) renderMath(node);
          });
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  window.addEventListener('message', ({ source, data }) => {
    if (source !== parent) return;
    if (data?.type === 'article-render:font') {
      document.fonts.add(
        new FontFace(data.family, data.buffer, {
          weight: data.weight,
          style: data.style,
        }),
      );
      return;
    }
    if (data?.type !== 'article-render:theme') return;
    if (document.documentElement.dataset.theme === data.theme) return;
    document.documentElement.dataset.theme = data.theme;
    document.getElementById('article-render-theme')!.textContent = data.css;
    window.dispatchEvent(
      new CustomEvent('themechange', { detail: data.theme }),
    );
  });
  void document.fonts.ready.then(() => {
    new ResizeObserver(scheduleHeight).observe(document.body);
    window.addEventListener('resize', scheduleHeight);
    scheduleHeight();
  });
}

const bridgeSource = `(${frameBridge.toString()})();`;

function currentTheme(): { theme: string; css: string } {
  const root = document.documentElement;
  const theme = root.dataset.theme!;
  if (themeSnapshot?.theme === theme) return themeSnapshot;
  const style = getComputedStyle(root);
  const variables = [...style]
    .filter((name) => name.startsWith('--'))
    .map((name) => `${name}:${style.getPropertyValue(name)};`)
    .join('');
  themeSnapshot = {
    theme,
    css: `:root{color-scheme:${theme};${variables}}`,
  };
  return themeSnapshot;
}

function syncTheme(frame: HTMLIFrameElement): void {
  frame.contentWindow!.postMessage(
    { type: 'article-render:theme', ...currentTheme() },
    '*',
  );
}

function sendFont(frame: HTMLIFrameElement, name: string): void {
  const url = mathFonts.get(name);
  if (!url) return;
  let data = mathFontData.get(name);
  if (!data) {
    data = fetch(url).then((response) => response.arrayBuffer());
    mathFontData.set(name, data);
  }
  const [family, variant] = name.split('-');
  void data.then((buffer) =>
    frame.contentWindow?.postMessage(
      {
        type: 'article-render:font',
        family,
        weight: variant.startsWith('Bold') ? 'bold' : 'normal',
        style: variant.endsWith('Italic') ? 'italic' : 'normal',
        buffer,
      },
      '*',
    ),
  );
}

window.addEventListener('message', ({ source, data }) => {
  const frame = frames.get(source);
  if (frame && data?.type === 'article-render:font') {
    if (typeof data.name === 'string') sendFont(frame, data.name);
    return;
  }
  if (
    !frame ||
    data?.type !== 'article-render:height' ||
    typeof data.height !== 'number' ||
    !Number.isFinite(data.height) ||
    data.height < 0
  )
    return;
  frame.style.height = `${data.height}px`;
});
new MutationObserver(() => {
  for (const frame of frames.values()) syncTheme(frame);
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});
window.addEventListener('resize', () => {
  themeSnapshot = undefined;
});

// A dollar sign or a TeX bracket means formulas. Template literals (\${x}) and
// the groups of a regex replacement ($1, $&) are JavaScript's own dollars.
function hasMath(source: string): boolean {
  return /\$|\\[([]|katex/.test(source.replace(/\$(?:[{&\d])/g, ''));
}

let katexSource: Promise<string> | undefined;

// Like the fonts, the script is fetched here: the frame's origin may not load it.
function frameKatex(): Promise<string> {
  return (katexSource ??= fetch(katexScript)
    .then((response) => response.text())
    .then((code) => code.replaceAll('</script', '<\\/script')));
}

function frameDocument(source: string, fonts: string, katex?: string): string {
  const { theme, css } = currentTheme();
  const math = katex !== undefined;
  const style = fonts + baseStyle + (math ? mathStyle : '');
  // Fragments go straight to the browser parser; full documents retain their attributes.
  if (!/<(?:!doctype\b|\/?(?:html|head|body)\b)/i.test(source))
    return `<!doctype html><html lang="${document.documentElement.lang}" data-theme="${theme}"><head><style>${style}</style><style id="article-render-theme">${css}</style>${math ? `<script>${katex}</script>` : ''}${source}<body><script>${bridgeSource}</script></body></html>`;
  const content = new DOMParser().parseFromString(source, 'text/html');
  content.documentElement.lang = document.documentElement.lang;
  content.documentElement.dataset.theme = theme;
  const base = content.createElement('style');
  base.textContent = style;
  const themeStyle = content.createElement('style');
  themeStyle.id = 'article-render-theme';
  themeStyle.textContent = css;
  content.head.prepend(base, themeStyle);
  if (math) {
    const script = content.createElement('script');
    script.textContent = katex;
    themeStyle.after(script);
  }
  const bridge = content.createElement('script');
  bridge.textContent = bridgeSource;
  content.body.append(bridge);
  return `<!doctype html>${content.documentElement.outerHTML}`;
}

export async function render(
  target: HTMLElement,
  source: string,
): Promise<void> {
  const [fonts, katex] = await Promise.all([
    frameFontStyle(),
    hasMath(source) ? frameKatex() : undefined,
  ]);
  const frame = document.createElement('iframe');
  frame.title = target.getAttribute('aria-label')!;
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.height = '1';
  frame.addEventListener('load', () => syncTheme(frame));
  frame.srcdoc = frameDocument(source, fonts, katex);
  target.replaceChildren(frame);
  frames.set(frame.contentWindow!, frame);
}

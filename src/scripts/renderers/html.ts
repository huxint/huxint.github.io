import interFont from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import monoFont from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
import mathMainFont from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?url';
import mathItalicFont from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?url';

// The host owns vertical scrolling, so viewport scrollbars must not narrow the measurement.
const baseStyle = `
  *,*::before,*::after{box-sizing:border-box}
  html{background:transparent;overflow-y:clip}
  body{display:flow-root;margin:0;min-width:0;background:transparent;color:var(--text);font:17px/1.95 var(--font-sans);overflow-wrap:break-word}
  button,input,select,textarea{font:inherit;color:inherit}
  code,pre{font-family:var(--font-mono)}
  math{font-family:KaTeX_Main,var(--font-serif)}
  math mi{font-family:KaTeX_Math;font-style:italic;text-transform:none}
  math mtext{font-family:var(--font-sans)}
  img,svg,canvas{max-width:100%;height:auto}
  :focus-visible{outline:2px solid var(--accent);outline-offset:4px}
  @media(max-width:640px){body{font-size:16px;line-height:1.85}}
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

  window.addEventListener('message', ({ source, data }) => {
    if (source !== parent || data?.type !== 'article-render:theme') return;
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

window.addEventListener('message', ({ source, data }) => {
  const frame = frames.get(source);
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

function frameDocument(source: string, fonts: string): string {
  const { theme, css } = currentTheme();
  // Fragments go straight to the browser parser; full documents retain their attributes.
  if (!/<(?:!doctype\b|\/?(?:html|head|body)\b)/i.test(source))
    return `<!doctype html><html lang="${document.documentElement.lang}" data-theme="${theme}"><head><style>${fonts}${baseStyle}</style><style id="article-render-theme">${css}</style>${source}<body><script>${bridgeSource}</script></body></html>`;
  const content = new DOMParser().parseFromString(source, 'text/html');
  content.documentElement.lang = document.documentElement.lang;
  content.documentElement.dataset.theme = theme;
  const base = content.createElement('style');
  base.textContent = fonts + baseStyle;
  const themeStyle = content.createElement('style');
  themeStyle.id = 'article-render-theme';
  themeStyle.textContent = css;
  content.head.prepend(base, themeStyle);
  const bridge = content.createElement('script');
  bridge.textContent = bridgeSource;
  content.body.append(bridge);
  return `<!doctype html>${content.documentElement.outerHTML}`;
}

export async function render(
  target: HTMLElement,
  source: string,
): Promise<void> {
  const fonts = await frameFontStyle();
  const frame = document.createElement('iframe');
  frame.title = target.getAttribute('aria-label')!;
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.height = '1';
  frame.addEventListener('load', () => syncTheme(frame));
  frame.srcdoc = frameDocument(source, fonts);
  target.replaceChildren(frame);
  frames.set(frame.contentWindow!, frame);
}

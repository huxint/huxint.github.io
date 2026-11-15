/*
 * KaTeX keeps display equations on one line. Instead of putting the whole
 * equation into a horizontal scroller, measure it once fonts have loaded and
 * gently scale it down until it fits the reading column. A too-wide inline
 * expression becomes a centred mini equation for the same reason.
 */
// Copying a selection that holds formulas puts their LaTeX source on the
// clipboard, in $…$ and $$…$$, instead of the scattered glyphs.
import 'katex/contrib/copy-tex';

const proseBlocks = [...document.querySelectorAll<HTMLElement>('.prose')];
const displayMath = [
  ...document.querySelectorAll<HTMLElement>('.prose .katex-display'),
];
const inlineMath = [
  ...document.querySelectorAll<HTMLElement>('.prose .math-inline'),
];
let mathFrame = 0;

function resetMathZoom(katex: HTMLElement): void {
  katex.style.removeProperty('--math-zoom');
}

function zoomToFit(katex: HTMLElement, availableWidth: number): void {
  // Font metrics change in steps at smaller zoom levels, so remeasure each reduction.
  for (let pass = 0; pass < 8; pass += 1) {
    const zoom = parseFloat(getComputedStyle(katex).zoom);
    const width = Math.max(
      katex.scrollWidth * zoom,
      katex.getBoundingClientRect().width,
    );
    if (width <= availableWidth + 0.5) return;
    katex.style.setProperty(
      '--math-zoom',
      ((zoom * (availableWidth - 1)) / width).toFixed(4),
    );
  }
}

function fitMath(): void {
  for (const math of displayMath) {
    const katex = math.querySelector<HTMLElement>(':scope > .katex')!;
    const body = math.querySelector<HTMLElement>('.math-body');
    resetMathZoom(body ?? katex);
    if (body) {
      const html = body.parentElement!;
      const tag = html.querySelector<HTMLElement>(':scope > .tag')!;
      const gap = parseFloat(getComputedStyle(html).columnGap);
      zoomToFit(
        body,
        html.clientWidth - tag.getBoundingClientRect().width - gap,
      );
      continue;
    }
    const style = getComputedStyle(math);
    const availableWidth =
      math.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    zoomToFit(katex, availableWidth);
  }

  for (const math of inlineMath) {
    const katex = math.querySelector<HTMLElement>(':scope > .katex')!;
    math.classList.remove('math-inline-block');
    resetMathZoom(katex);

    let container = math.parentElement!;
    while (getComputedStyle(container).display === 'inline')
      container = container.parentElement!;
    const availableWidth = container.clientWidth;
    const naturalWidth = katex.getBoundingClientRect().width;
    if (naturalWidth <= availableWidth + 0.5) continue;

    math.classList.add('math-inline-block');
    zoomToFit(katex, math.clientWidth);
  }

  mathFrame = 0;
}

function scheduleMathFit(): void {
  if (mathFrame) return;
  mathFrame = requestAnimationFrame(fitMath);
}

if (displayMath.length || inlineMath.length) {
  scheduleMathFit();
  document.fonts.ready.then(scheduleMathFit);
  window.addEventListener('resize', scheduleMathFit, { passive: true });
  window.addEventListener('pageshow', scheduleMathFit);

  const knownWidths = new WeakMap<HTMLElement, number>();
  const observer = new ResizeObserver((entries) => {
    let widthChanged = false;
    for (const entry of entries) {
      const prose = entry.target as HTMLElement;
      if (knownWidths.get(prose) === prose.clientWidth) continue;
      knownWidths.set(prose, prose.clientWidth);
      widthChanged = true;
    }
    if (widthChanged) scheduleMathFit();
  });
  for (const prose of proseBlocks) {
    knownWidths.set(prose, prose.clientWidth);
    observer.observe(prose);
  }
}

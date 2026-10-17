/*
 * KaTeX keeps display equations on one line. Instead of putting the whole
 * equation into a horizontal scroller, measure it once fonts have loaded and
 * gently scale it down until it fits the reading column. A too-wide inline
 * expression becomes a centred mini equation for the same reason.
 */
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
  const naturalWidth = katex.getBoundingClientRect().width;
  if (availableWidth <= 0 || naturalWidth <= availableWidth + 0.5) return;
  katex.style.setProperty(
    '--math-zoom',
    (availableWidth / naturalWidth).toFixed(4),
  );
}

function fitMath(): void {
  for (const math of displayMath) {
    const katex = math.querySelector<HTMLElement>(':scope > .katex');
    if (!katex) continue;
    resetMathZoom(katex);
    const style = getComputedStyle(math);
    const availableWidth =
      math.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    zoomToFit(katex, availableWidth);
  }

  for (const math of inlineMath) {
    const katex = math.querySelector<HTMLElement>(':scope > .katex');
    if (!katex) continue;
    math.classList.remove('math-inline-block');
    resetMathZoom(katex);

    const parent = math.parentElement;
    const availableWidth = parent?.clientWidth ?? math.clientWidth;
    const naturalWidth = katex.getBoundingClientRect().width;
    if (naturalWidth <= availableWidth + 0.5) continue;

    math.classList.add('math-inline-block');
    zoomToFit(katex, math.clientWidth || availableWidth);
  }

  mathFrame = 0;
}

function scheduleMathFit(): void {
  if (mathFrame) return;
  mathFrame = requestAnimationFrame(fitMath);
}

scheduleMathFit();
document.fonts.ready.then(scheduleMathFit);
window.addEventListener('resize', scheduleMathFit, { passive: true });
window.addEventListener('pageshow', scheduleMathFit);

if (proseBlocks.length > 0) {
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

/*
 * Progressive enhancements for long-form posts:
 * - footnotes get an inline hover/focus preview
 * - Mermaid diagrams render ahead of reading and reuse themed SVGs
 */

function setupFootnotePreviews(): void {
  const refs = [
    ...document.querySelectorAll<HTMLAnchorElement>(
      '.prose [data-footnote-ref]',
    ),
  ];

  if (refs.length === 0) return;

  const popover = document.createElement('div');
  popover.className = 'footnote-popover';
  popover.id = 'footnote-popover';
  popover.setAttribute('role', 'tooltip');
  popover.setAttribute('aria-hidden', 'true');

  const label = document.createElement('p');
  label.className = 'footnote-popover-label';
  label.textContent = '注释';

  const content = document.createElement('div');
  content.className = 'footnote-popover-content';
  popover.append(label, content);
  document.body.append(popover);

  let activeRef: HTMLAnchorElement | null = null;
  let hideTimer = 0;
  let shownAt = 0;

  function hide(): void {
    window.clearTimeout(hideTimer);
    activeRef?.removeAttribute('aria-describedby');
    activeRef = null;
    popover.classList.remove('is-visible');
    popover.setAttribute('aria-hidden', 'true');
  }

  function scheduleHide(): void {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, 100);
  }

  function position(ref: HTMLAnchorElement): void {
    const rect = ref.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const gap = 10;
    const margin = 12;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, margin),
      innerWidth - width - margin,
    );
    let top = rect.bottom + gap;
    if (top + height > innerHeight - margin) top = rect.top - height - gap;
    if (top < margin) top = rect.bottom + gap;

    popover.style.left = `${left.toFixed(1)}px`;
    popover.style.top = `${top.toFixed(1)}px`;
  }

  function show(ref: HTMLAnchorElement): void {
    const target = document.getElementById(
      decodeURIComponent(ref.hash.slice(1)),
    )!;

    window.clearTimeout(hideTimer);
    activeRef?.removeAttribute('aria-describedby');
    activeRef = ref;
    ref.setAttribute('aria-describedby', popover.id);

    shownAt = performance.now();
    const clone = target.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone
      .querySelectorAll('.footnote-backref')
      .forEach((node) => node.remove());
    content.replaceChildren(clone);

    popover.classList.add('is-visible');
    popover.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => position(ref));
  }

  for (const ref of refs) {
    ref.addEventListener('pointerenter', () => show(ref));
    ref.addEventListener('pointerleave', scheduleHide);
    ref.addEventListener('focus', () => show(ref));
    ref.addEventListener('blur', scheduleHide);
  }

  popover.addEventListener('pointerenter', () => {
    window.clearTimeout(hideTimer);
  });
  popover.addEventListener('pointerleave', scheduleHide);
  window.addEventListener(
    'scroll',
    () => {
      if (performance.now() - shownAt > 220) hide();
    },
    { passive: true },
  );
  window.addEventListener('resize', hide);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
}

type MermaidBlock = {
  figure: HTMLElement;
  target: HTMLElement;
  source: string;
  svgs: Map<string, string>;
  theme?: string;
};

function setupMermaid(): void {
  const figures = [
    ...document.querySelectorAll<HTMLElement>('.prose .mermaid-figure'),
  ];
  if (figures.length === 0) return;

  const blocks: MermaidBlock[] = figures.map((figure) => ({
    figure,
    target: figure.querySelector<HTMLElement>('.mermaid-canvas')!,
    source: figure
      .querySelector<HTMLElement>('.mermaid-source')!
      .textContent!.trim(),
    svgs: new Map(),
  }));
  const pending = new Set<MermaidBlock>();
  const mermaidPromise = Promise.all([
    import('mermaid'),
    document.fonts.ready,
  ]).then(([module]) => module.default);
  let running = false;
  let rendered = 0;
  let configuredTheme: string | undefined;

  async function renderPending(): Promise<void> {
    if (running) return;
    running = true;
    while (pending.size) {
      const block = pending.values().next().value!;
      pending.delete(block);
      block.figure.classList.add('is-rendering');
      try {
        const mermaid = await mermaidPromise;
        const theme = document.documentElement.dataset.theme!;
        if (block.theme === theme) continue;
        let svg = block.svgs.get(theme);
        if (!svg) {
          if (configuredTheme !== theme) {
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: 'strict',
              theme: theme === 'dark' ? 'dark' : 'neutral',
              fontFamily: getComputedStyle(document.body).fontFamily,
              themeVariables: { fontSize: '14px' },
              flowchart: {
                htmlLabels: true,
                curve: 'basis',
                nodeSpacing: 36,
                rankSpacing: 48,
                padding: 14,
              },
            });
            configuredTheme = theme;
          }
          svg = (await mermaid.render(`mermaid-${++rendered}`, block.source))
            .svg;
          block.svgs.set(theme, svg);
        }
        if (theme !== document.documentElement.dataset.theme) {
          pending.add(block);
          continue;
        }
        block.target.innerHTML = svg;
        block.theme = theme;
        block.figure.classList.add('is-rendered');
        block.figure.classList.remove('has-error');
      } catch {
        block.figure.classList.add('has-error');
        block.target.innerHTML =
          '<p class="mermaid-error">图表暂时无法显示，下面保留了原始源码。</p>';
      } finally {
        block.figure.classList.remove('is-rendering');
      }
    }
    running = false;
  }

  function scheduleRender(): void {
    const theme = document.documentElement.dataset.theme!;
    for (const block of blocks) if (block.theme !== theme) pending.add(block);
    void renderPending();
  }

  new MutationObserver(scheduleRender).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  scheduleRender();
}

setupFootnotePreviews();
setupMermaid();

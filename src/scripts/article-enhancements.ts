/*
 * Progressive enhancements for long-form posts:
 * - footnotes get an inline hover/focus preview
 * - fenced mermaid diagrams render lazily and follow the current theme
 */

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

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
  }));
  const visible = new Set<MermaidBlock>();

  let renderSequence = 0;
  let scheduled = 0;
  let mermaidPromise: Promise<typeof import('mermaid').default> | undefined;

  async function renderAll(): Promise<void> {
    const sequence = ++renderSequence;
    const theme = document.documentElement.dataset.theme!;
    const pending = [...visible].filter((block) => block.theme !== theme);
    if (pending.length === 0) return;

    for (const block of pending) {
      block.figure.classList.add('is-rendering');
      block.figure.classList.remove('has-error');
    }

    try {
      mermaidPromise ??= import('mermaid').then((module) => module.default);
      const mermaid = await mermaidPromise;
      if (sequence !== renderSequence) return;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        fontFamily: cssToken('--font-sans'),
        themeVariables: {
          fontSize: '14px',
          primaryColor: cssToken('--accent-soft'),
          primaryTextColor: cssToken('--text'),
          primaryBorderColor: cssToken('--accent'),
          secondaryColor: cssToken('--surface'),
          tertiaryColor: cssToken('--bg-sunken'),
          lineColor: cssToken('--muted'),
          clusterBkg: cssToken('--bg-sunken'),
          clusterBorder: cssToken('--rule-strong'),
          edgeLabelBackground: cssToken('--bg'),
          textColor: cssToken('--text'),
          mainBkg: cssToken('--accent-soft'),
          nodeBorder: cssToken('--accent'),
        },
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
          nodeSpacing: 36,
          rankSpacing: 48,
          padding: 14,
        },
      });

      for (const [index, block] of pending.entries()) {
        if (sequence !== renderSequence) return;
        try {
          const { svg } = await mermaid.render(
            `mermaid-${index}-${sequence}`,
            block.source,
          );
          if (sequence !== renderSequence) return;
          block.target.innerHTML = svg;
          block.theme = theme;
          block.figure.classList.add('is-rendered');
          block.figure.classList.remove('is-rendering', 'has-error');
        } catch {
          block.figure.classList.remove('is-rendering');
          block.figure.classList.add('has-error');
          block.target.innerHTML =
            '<p class="mermaid-error">图表渲染失败，下面保留了原始源码。</p>';
        }
      }
    } catch {
      for (const block of pending) {
        block.figure.classList.remove('is-rendering');
        block.figure.classList.add('has-error');
        block.target.innerHTML =
          '<p class="mermaid-error">图表加载失败，下面保留了原始源码。</p>';
      }
    }
  }

  function scheduleRender(): void {
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      void renderAll();
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        visible.add(blocks.find((block) => block.figure === entry.target)!);
        observer.unobserve(entry.target);
      }
      scheduleRender();
    },
    { rootMargin: '320px' },
  );
  for (const block of blocks) observer.observe(block.figure);
  new MutationObserver(scheduleRender).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

setupFootnotePreviews();
setupMermaid();

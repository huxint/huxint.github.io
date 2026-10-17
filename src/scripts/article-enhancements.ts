/*
 * Progressive enhancements for long-form posts:
 * - footnotes get an inline hover/focus preview
 * - fenced mermaid diagrams render lazily and follow the current theme
 * - display formulas get a small copy button
 */

function cssToken(name: string, fallback: string): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

function setupFootnotePreviews(): void {
  const refs = [
    ...document.querySelectorAll<HTMLAnchorElement>('.prose sup a[href^="#"]'),
  ].filter((link) => {
    const target = document.getElementById(
      decodeURIComponent(link.hash.slice(1)),
    );
    return Boolean(target?.closest('.footnotes'));
  });

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
    );
    if (!target) return;

    window.clearTimeout(hideTimer);
    activeRef?.removeAttribute('aria-describedby');
    activeRef = ref;
    ref.setAttribute('aria-describedby', popover.id);

    shownAt = performance.now();
    const clone = target.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll(
        '.footnote-backref, a[href^="#user-content-fnref-"], a[href^="#fnref-"]',
      )
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

function setupMathCopyButtons(): void {
  for (const formula of document.querySelectorAll<HTMLElement>(
    '.prose .katex-display',
  )) {
    if (formula.querySelector('.math-copy')) continue;
    const annotation = formula.querySelector<HTMLElement>(
      'annotation[encoding="application/x-tex"]',
    );
    const tex = annotation?.textContent?.trim();
    if (!tex) continue;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'math-copy';
    button.textContent = '复制公式';
    button.setAttribute('aria-label', '复制公式源码');

    button.addEventListener('click', async () => {
      try {
        await copyText(tex);
        button.textContent = '已复制';
        button.dataset.copied = 'true';
        window.setTimeout(() => {
          button.textContent = '复制公式';
          delete button.dataset.copied;
        }, 1400);
      } catch {
        button.textContent = '复制失败';
        window.setTimeout(() => {
          button.textContent = '复制公式';
        }, 1400);
      }
    });

    formula.append(button);
  }
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

type MermaidBlock = {
  figure: HTMLElement;
  target: HTMLElement;
  source: string;
};

function setupMermaid(): void {
  const figures = [
    ...document.querySelectorAll<HTMLElement>('[data-mermaid-figure]'),
  ];
  if (figures.length === 0) return;

  const blocks: MermaidBlock[] = figures.flatMap((figure) => {
    const target = figure.querySelector<HTMLElement>('[data-mermaid-target]');
    const source = figure
      .querySelector<HTMLElement>('[data-mermaid-source]')
      ?.textContent?.trim();
    return target && source ? [{ figure, target, source }] : [];
  });

  if (blocks.length === 0) return;

  let renderSequence = 0;
  let scheduled = 0;
  let mermaidPromise: Promise<typeof import('mermaid').default> | undefined;

  async function renderAll(): Promise<void> {
    const sequence = ++renderSequence;

    for (const block of blocks) {
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
        fontFamily: cssToken('--font-sans', 'sans-serif'),
        themeVariables: {
          primaryColor: cssToken('--surface', '#eee8dd'),
          primaryTextColor: cssToken('--text', '#201d18'),
          primaryBorderColor: cssToken('--accent', '#b85a31'),
          secondaryColor: cssToken('--accent-soft', '#f3e2d5'),
          tertiaryColor: cssToken('--bg-raised', '#fffdfa'),
          lineColor: cssToken('--rule-strong', '#cfc6b7'),
          clusterBkg: cssToken('--bg-sunken', '#f0eadf'),
          clusterBorder: cssToken('--rule-strong', '#cfc6b7'),
          edgeLabelBackground: cssToken('--bg-raised', '#fffdfa'),
          textColor: cssToken('--text', '#201d18'),
          mainBkg: cssToken('--surface', '#eee8dd'),
          nodeBorder: cssToken('--accent', '#b85a31'),
        },
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
        },
      });

      for (const [index, block] of blocks.entries()) {
        if (sequence !== renderSequence) return;
        try {
          const { svg } = await mermaid.render(
            `mermaid-${index}-${sequence}`,
            block.source,
          );
          if (sequence !== renderSequence) return;
          block.target.innerHTML = svg;
          block.target.setAttribute('role', 'img');
          block.target.setAttribute('aria-label', 'Mermaid 图表');
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
      for (const block of blocks) {
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

  void renderAll();
  new MutationObserver(scheduleRender).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

setupFootnotePreviews();
setupMathCopyButtons();
setupMermaid();

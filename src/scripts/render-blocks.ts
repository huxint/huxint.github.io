import { render as renderHtml } from './renderers/html';

const renderers = {
  html: renderHtml,
  excalidraw: async (target: HTMLElement, source: string) => {
    const { render } = await import('./renderers/excalidraw');
    await render(target, source);
  },
};

async function renderFigure(figure: HTMLElement): Promise<void> {
  const language = figure.dataset.renderer as keyof typeof renderers;
  const target = figure.querySelector<HTMLElement>('.render-canvas')!;
  figure.classList.add('is-rendering');
  try {
    await renderers[language](target, figure.dataset.source!);
    figure.classList.add('is-rendered');
  } catch (error) {
    console.error(error);
    const message = document.createElement('p');
    message.className = 'render-error';
    message.setAttribute('role', 'status');
    message.textContent = '图示暂时无法显示。';
    target.replaceChildren(message);
  } finally {
    figure.classList.remove('is-rendering');
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      void renderFigure(entry.target as HTMLElement);
    }
  },
  { rootMargin: '800px 0px' },
);
document
  .querySelectorAll<HTMLElement>('.prose .render-block[data-source]')
  .forEach((figure) => {
    if (figure.dataset.renderer === 'html') void renderFigure(figure);
    else observer.observe(figure);
  });

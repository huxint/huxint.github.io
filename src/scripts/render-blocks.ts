import { renderers } from '../lib/render-blocks.mjs';

document
  .querySelectorAll<HTMLElement>('.prose .render-block')
  .forEach(async (figure) => {
    const language = figure.dataset.renderer as keyof typeof renderers;
    const target = figure.querySelector<HTMLElement>('.render-canvas')!;
    const source = figure.dataset.source!;
    figure.classList.add('is-rendering');

    try {
      const { render } = await renderers[language].load();
      await render(target, source);
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
  });

import { exportScene } from '@excalidraw/utils';

export async function render(
  target: HTMLElement,
  source: string,
): Promise<void> {
  const scene = JSON.parse(source);
  if (!Array.isArray(scene.elements))
    throw new Error('Excalidraw 场景需要包含 elements 数组。');
  const svgs = new Map<string, Promise<SVGSVGElement>>();
  let revision = 0;

  async function updateTheme(): Promise<void> {
    const current = ++revision;
    const theme = document.documentElement.dataset.theme!;
    const pendingSvg =
      svgs.get(theme) ??
      exportScene({
        type: 'svg',
        data: scene,
        config: {
          canvasBackgroundColor: false,
          theme: theme === 'dark' ? 'dark' : 'light',
        },
      });
    svgs.set(theme, pendingSvg);
    const svg = await pendingSvg;
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', target.getAttribute('aria-label')!);
    if (current === revision) target.replaceChildren(svg);
  }

  await updateTheme();
  new MutationObserver(() => void updateTheme()).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] },
  );
}

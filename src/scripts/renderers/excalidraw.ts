import {
  exportToSvg,
  getNonDeletedElements,
  restoreElements,
} from '@excalidraw/excalidraw';

export async function render(
  target: HTMLElement,
  source: string,
): Promise<void> {
  const scene = JSON.parse(source);
  if (!Array.isArray(scene.elements))
    throw new Error('Excalidraw 场景需要包含 elements 数组。');
  const elements = getNonDeletedElements(restoreElements(scene.elements, null));
  const svgs = new Map<string, Promise<SVGSVGElement>>();
  let revision = 0;

  async function updateTheme(): Promise<void> {
    const current = ++revision;
    const theme = document.documentElement.dataset.theme!;
    const pendingSvg =
      svgs.get(theme) ??
      exportToSvg({
        elements,
        files: scene.files ?? null,
        appState: {
          ...scene.appState,
          exportBackground: false,
          exportWithDarkMode: theme === 'dark',
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

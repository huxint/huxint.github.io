export function render(target: HTMLElement, source: string): void {
  const template = document.createElement('template');
  template.innerHTML = source;
  const svg = template.content.firstElementChild;
  if (!(svg instanceof SVGSVGElement))
    throw new Error('请提供完整、有效的 SVG 源码。');

  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', target.getAttribute('aria-label')!);
  svg.setAttribute('part', 'svg');
  // Fragment references and embedded styles stay within this diagram.
  target.attachShadow({ mode: 'open' }).replaceChildren(svg);
}

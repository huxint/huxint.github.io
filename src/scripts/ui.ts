const headers = [
  ...document.querySelectorAll<HTMLElement>('.site-header, .project-header'),
];
let headerFrame = 0;

function updateHeaderState(): void {
  const scrolled = window.scrollY > 8;
  for (const header of headers)
    header.classList.toggle('is-scrolled', scrolled);
  headerFrame = 0;
}

function scheduleHeaderState(): void {
  if (headerFrame) return;
  headerFrame = requestAnimationFrame(updateHeaderState);
}

updateHeaderState();
window.addEventListener('scroll', scheduleHeaderState, { passive: true });

const spotlight = document.querySelector<HTMLElement>('[data-spotlight]');
const finePointer = matchMedia('(pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const spotlightElement = spotlight;
if (spotlightElement && finePointer.matches && !reducedMotion.matches) {
  const spotlightNode: HTMLElement = spotlightElement;
  let targetX = 76;
  let targetY = 32;
  let currentX = targetX;
  let currentY = targetY;
  let spotlightFrame = 0;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  function renderSpotlight(): void {
    currentX += (targetX - currentX) * 0.14;
    currentY += (targetY - currentY) * 0.14;
    spotlightNode.style.setProperty('--spot-x', `${currentX.toFixed(2)}%`);
    spotlightNode.style.setProperty('--spot-y', `${currentY.toFixed(2)}%`);

    if (
      Math.abs(targetX - currentX) < 0.05 &&
      Math.abs(targetY - currentY) < 0.05
    ) {
      spotlightFrame = 0;
      return;
    }
    spotlightFrame = requestAnimationFrame(renderSpotlight);
  }

  function moveSpotlight(event: PointerEvent): void {
    const rect = spotlightNode.getBoundingClientRect();
    targetX = clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 94);
    targetY = clamp(((event.clientY - rect.top) / rect.height) * 100, 4, 96);
    if (!spotlightFrame)
      spotlightFrame = requestAnimationFrame(renderSpotlight);
  }

  spotlightNode.addEventListener('pointermove', moveSpotlight, {
    passive: true,
  });
  spotlightNode.addEventListener(
    'pointerleave',
    () => {
      targetX = 76;
      targetY = 32;
      if (!spotlightFrame)
        spotlightFrame = requestAnimationFrame(renderSpotlight);
    },
    { passive: true },
  );
}

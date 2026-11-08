import { livePlayer } from './live-player';

export interface ViewerImage {
  src: string;
  alt: string;
  caption: string;
  live?: string;
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Lightbox: steps through one set of images, such as the figures of an
// article or the photos of a life record.
const viewer = document.querySelector<HTMLDialogElement>('#image-viewer')!;
const frame = viewer.querySelector<HTMLElement>('.image-viewer-frame')!;
const preview = frame.querySelector('img')!;
const clip = frame.querySelector('video')!;
const liveBadge =
  viewer.querySelector<HTMLButtonElement>('[data-viewer-live]')!;
const meta = viewer.querySelector<HTMLElement>('.image-viewer-meta')!;
const count = viewer.querySelector<HTMLElement>('.image-viewer-count')!;
const caption = viewer.querySelector<HTMLElement>('.image-viewer-caption')!;
const viewerLive = livePlayer(clip, frame, liveBadge);
let images: ViewerImage[] = [];
let index = 0;

function show(next: number) {
  index = (next + images.length) % images.length;
  const image = images[index];
  viewerLive.stop();
  preview.src = image.src;
  preview.alt = image.alt;
  caption.textContent = image.caption;
  count.textContent =
    images.length > 1 ? `${index + 1} / ${images.length}` : '';
  liveBadge.hidden = !image.live;
  if (image.live) {
    clip.src = image.live;
    if (!reducedMotion.matches) viewerLive.play();
  } else clip.removeAttribute('src');
  for (const step of [-1, 1]) {
    const neighbour = images[(index + step + images.length) % images.length];
    if (neighbour !== image) new Image().src = neighbour.src;
  }
}

function step(delta: number) {
  if (images.length < 2) return;
  show(index + delta);
  if (!reducedMotion.matches)
    frame.animate(
      [
        { opacity: 0, transform: `translateX(${delta * 28}px)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    );
}

export function openViewer(items: ViewerImage[], start: number, label = '') {
  images = items;
  viewer.classList.toggle('is-gallery', items.length > 1);
  meta.textContent = label;
  show(start);
  viewer.showModal();
  document.documentElement.classList.add('dialog-open');
}

viewer
  .querySelector('[data-viewer-close]')!
  .addEventListener('click', () => viewer.close());
viewer
  .querySelectorAll<HTMLElement>('[data-viewer-step]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      step(Number(button.dataset.viewerStep)),
    ),
  );
viewer.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target === viewer || target.classList.contains('image-viewer-stage'))
    viewer.close();
});
viewer.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') step(-1);
  else if (event.key === 'ArrowRight') step(1);
});
viewer.addEventListener('close', () => {
  viewerLive.stop();
  document.documentElement.classList.remove('dialog-open');
});

let swipeStart: { x: number; y: number } | undefined;
frame.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'mouse')
    swipeStart = { x: event.clientX, y: event.clientY };
});
frame.addEventListener('pointerup', (event) => {
  if (!swipeStart) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = undefined;
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5)
    step(dx < 0 ? 1 : -1);
});
frame.addEventListener('pointercancel', () => (swipeStart = undefined));

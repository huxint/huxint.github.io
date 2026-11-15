import './article-enhancements';
import './tabs';
import './math';
import { openViewer } from './image-viewer';
import { livePlayer } from './live-player';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function largestSource(image: HTMLImageElement): string {
  // remarkMoment supplies srcset widths in ascending order.
  return image.srcset.split(',').at(-1)!.trim().split(/\s+/)[0] || image.src;
}

document.querySelectorAll<HTMLElement>('.moment').forEach((moment) => {
  const cells = [
    ...moment.querySelectorAll<HTMLElement>('.moment-cell:has(.moment-open)'),
  ];
  const items = cells.map((cell) => {
    const image = cell.querySelector('img')!;
    return {
      src: largestSource(image),
      alt: image.alt,
      caption: image.alt,
      live: cell.querySelector('video')?.getAttribute('src') ?? undefined,
    };
  });
  cells.forEach((cell, position) =>
    cell
      .querySelector('.moment-open')!
      .addEventListener('click', () =>
        openViewer(items, position, moment.dataset.caption ?? ''),
      ),
  );
});

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

document
  .querySelectorAll<HTMLElement>('.moment-cell.is-video')
  .forEach((cell) => {
    const video = cell.querySelector('video')!;
    const duration = cell.querySelector<HTMLElement>('.video-duration')!;
    const showDuration = () => {
      if (Number.isFinite(video.duration))
        duration.textContent = formatDuration(video.duration);
    };
    if (video.readyState >= 1) showDuration();
    else video.addEventListener('loadedmetadata', showDuration, { once: true });
    cell.querySelector('.moment-play')!.addEventListener('click', () => {
      cell.classList.add('is-playing');
      video.play().catch(() => {});
    });
  });

const HOLD_DELAY = 250;

// Inline Live Photos play while hovered with a mouse, or while held on touch.
document.querySelectorAll<HTMLElement>('[data-live-photo]').forEach((cell) => {
  const { play, stop } = livePlayer(
    cell.querySelector('video')!,
    cell,
    cell.querySelector<HTMLButtonElement>('[data-live-toggle]')!,
  );
  let holdTimer: number | undefined;
  let holding = false;
  let swallowClick = false;

  cell.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse' && !reducedMotion.matches) play();
  });
  cell.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') stop();
  });

  cell.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      holding = true;
      play();
    }, HOLD_DELAY);
  });
  const release = () => {
    clearTimeout(holdTimer);
    if (!holding) return;
    holding = false;
    stop();
    // The click that follows a long press must not open the lightbox.
    swallowClick = true;
    window.setTimeout(() => (swallowClick = false), 400);
  };
  cell.addEventListener('pointerup', release);
  cell.addEventListener('pointercancel', release);
  cell.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') release();
  });
  cell.addEventListener('contextmenu', (event) => {
    if (holding) event.preventDefault();
  });
  cell.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
});

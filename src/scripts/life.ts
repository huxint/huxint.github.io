const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Plays a muted clip over its still, as Live Photos do. `host` carries the
// is-loading / is-playing state the styles fade on.
function livePlayer(
  video: HTMLVideoElement,
  host: HTMLElement,
  badge: HTMLButtonElement,
) {
  video.muted = true;
  let session = 0;
  const stop = () => {
    session += 1;
    video.pause();
    if (video.readyState) video.currentTime = 0;
    host.classList.remove('is-loading', 'is-playing');
    badge.setAttribute('aria-pressed', 'false');
  };
  const play = () => {
    const current = ++session;
    host.classList.add('is-loading');
    badge.setAttribute('aria-pressed', 'true');
    if (video.readyState) video.currentTime = 0;
    video.play().catch(() => {
      if (session === current) stop();
    });
  };
  const active = () =>
    host.classList.contains('is-playing') ||
    host.classList.contains('is-loading');
  video.addEventListener('playing', () => {
    host.classList.remove('is-loading');
    host.classList.add('is-playing');
  });
  video.addEventListener('ended', stop);
  video.addEventListener('error', stop);
  badge.addEventListener('click', () => (active() ? stop() : play()));
  return { play, stop };
}

function largestSource(image: HTMLImageElement): string {
  let best: { url: string; width: number } | undefined;
  for (const candidate of image.srcset.split(',')) {
    const [url, descriptor] = candidate.trim().split(/\s+/);
    const width = parseFloat(descriptor ?? '');
    if (url && (!best || width > best.width)) best = { url, width };
  }
  return best?.url ?? image.currentSrc ?? image.src;
}

interface Photo {
  src: string;
  alt: string;
  live?: string;
}

// Lightbox: steps through the photos of one record.
const viewer = document.querySelector<HTMLDialogElement>('#life-viewer')!;
const frame = viewer.querySelector<HTMLElement>('.life-viewer-frame')!;
const preview = frame.querySelector('img')!;
const clip = frame.querySelector('video')!;
const liveBadge =
  viewer.querySelector<HTMLButtonElement>('[data-viewer-live]')!;
const meta = viewer.querySelector<HTMLElement>('.life-viewer-meta')!;
const count = viewer.querySelector<HTMLElement>('.life-viewer-count')!;
const caption = viewer.querySelector<HTMLElement>('.life-viewer-caption')!;
const viewerLive = livePlayer(clip, frame, liveBadge);
let photos: Photo[] = [];
let index = 0;

function show(next: number) {
  index = (next + photos.length) % photos.length;
  const photo = photos[index];
  viewerLive.stop();
  preview.src = photo.src;
  preview.alt = photo.alt;
  caption.textContent = photo.alt;
  count.textContent =
    photos.length > 1 ? `${index + 1} / ${photos.length}` : '';
  liveBadge.hidden = !photo.live;
  if (photo.live) {
    clip.src = photo.live;
    if (!reducedMotion.matches) viewerLive.play();
  } else clip.removeAttribute('src');
  for (const step of [-1, 1]) {
    const neighbour = photos[(index + step + photos.length) % photos.length];
    if (neighbour !== photo) new Image().src = neighbour.src;
  }
}

function step(delta: number) {
  if (photos.length < 2) return;
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

function openViewer(items: Photo[], start: number, label: string) {
  photos = items;
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
  if (target === viewer || target.classList.contains('life-viewer-stage'))
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

document.querySelectorAll<HTMLElement>('.moment').forEach((moment) => {
  const cells = [
    ...moment.querySelectorAll<HTMLElement>('.moment-cell:has(.moment-open)'),
  ];
  const items = cells.map((cell) => {
    const image = cell.querySelector('img')!;
    return {
      src: largestSource(image),
      alt: image.alt,
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

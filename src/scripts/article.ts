const viewer = document.querySelector<HTMLDialogElement>('#image-viewer');
const preview = document.querySelector<HTMLImageElement>('#image-preview');
const caption = document.querySelector<HTMLElement>('#image-caption');

if (viewer && preview && caption) {
  document
    .querySelectorAll<HTMLImageElement>('.prose .article-image img')
    .forEach((image) => {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'image-trigger';
      trigger.setAttribute('aria-label', `放大图片：${image.alt}`);
      image.before(trigger);
      trigger.append(image);
      trigger.addEventListener('click', () => {
        preview.src = image.currentSrc || image.src;
        preview.alt = image.alt;
        caption.textContent =
          image.closest('figure')?.querySelector('figcaption')?.textContent ||
          image.alt;
        viewer.showModal();
        document.documentElement.classList.add('dialog-open');
      });
    });

  viewer
    .querySelector('button')
    ?.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) viewer.close();
  });
  viewer.addEventListener('close', () =>
    document.documentElement.classList.remove('dialog-open'),
  );
}

const tocLinks = [
  ...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'),
];
const sectionIds = [
  ...new Set(tocLinks.map((link) => decodeURIComponent(link.hash.slice(1)))),
];
const sections = sectionIds
  .map((id) => document.getElementById(id))
  .filter((heading) => heading !== null);
const article = document.querySelector<HTMLElement>(
  'article[data-pagefind-body]',
)!;
const progress = document.querySelector<HTMLElement>('.reading-progress span')!;
let pendingFrame = false;

function updateReadingPosition(): void {
  const inset = parseFloat(
    getComputedStyle(document.documentElement).scrollPaddingTop,
  );
  const bounds = article.getBoundingClientRect();
  const distance = Math.max(1, bounds.height - innerHeight + inset);
  const fraction = Math.min(1, Math.max(0, (inset - bounds.top) / distance));
  progress.style.transform = `scaleX(${fraction})`;

  let currentId = sections.at(0)?.id;
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= inset + 16)
      currentId = section.id;
  }
  // A short final section cannot always reach the top of the viewport.
  if (bounds.bottom <= innerHeight) currentId = sections.at(-1)?.id;
  for (const link of tocLinks) {
    if (decodeURIComponent(link.hash.slice(1)) === currentId)
      link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  pendingFrame = false;
}

function scheduleReadingPosition(): void {
  if (pendingFrame) return;
  pendingFrame = true;
  requestAnimationFrame(updateReadingPosition);
}

updateReadingPosition();
window.addEventListener('scroll', scheduleReadingPosition, { passive: true });
window.addEventListener('resize', scheduleReadingPosition);
window.addEventListener('pageshow', scheduleReadingPosition);
new ResizeObserver(scheduleReadingPosition).observe(article);

document
  .querySelectorAll<HTMLAnchorElement>('.mobile-toc a')
  .forEach((link) => {
    link.addEventListener('click', () => {
      const details = link.closest('details');
      if (details) details.open = false;
    });
  });

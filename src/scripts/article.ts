import { openImageViewer } from './image-viewer';
import './article-enhancements';
import './render-blocks';
import './math';

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
      openImageViewer(
        image,
        image.closest('figure')?.querySelector('figcaption')?.textContent ||
          image.alt,
      );
    });
  });

const tocLinks = [
  ...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]'),
];
const sectionIds = [
  ...new Set(tocLinks.map((link) => decodeURIComponent(link.hash.slice(1)))),
];
const sections = sectionIds.map((id) => document.getElementById(id)!);
const article = document.querySelector<HTMLElement>(
  'article[data-pagefind-body]',
)!;
const progress = document.querySelector<HTMLElement>('.reading-progress span')!;
let pendingFrame = false;

function activateToc(currentId: string | undefined): void {
  for (const link of tocLinks) {
    if (decodeURIComponent(link.hash.slice(1)) === currentId)
      link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

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
  activateToc(currentId);
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

// Jump immediately instead of waiting through a smooth-scroll animation, and
// highlight the chosen heading before the next scroll frame.
for (const link of tocLinks) {
  link.addEventListener('click', (event) => {
    const id = decodeURIComponent(link.hash.slice(1));
    const heading = document.getElementById(id)!;

    event.preventDefault();
    const inset = parseFloat(
      getComputedStyle(document.documentElement).scrollPaddingTop,
    );
    window.scrollTo({
      top: heading.getBoundingClientRect().top + scrollY - inset,
      behavior: 'instant',
    });
    history.pushState(null, '', link.hash);
    activateToc(id);
    scheduleReadingPosition();

    const details = link.closest('details');
    if (details) details.open = false;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  });
}

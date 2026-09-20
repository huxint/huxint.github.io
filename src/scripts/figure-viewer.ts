import { openImageViewer } from './image-viewer';

document.querySelectorAll<HTMLElement>('[data-figure]').forEach((figure) => {
  const image = figure.querySelector('img')!;
  const trigger =
    figure.querySelector<HTMLButtonElement>('[data-figure-open]')!;
  const markMissing = () => figure.classList.add('is-missing');
  image.addEventListener('error', markMissing);
  if (image.complete && image.naturalWidth === 0) markMissing();
  trigger.addEventListener('click', () => {
    openImageViewer(
      image,
      figure.querySelector('figcaption')?.textContent || image.alt,
    );
  });
});

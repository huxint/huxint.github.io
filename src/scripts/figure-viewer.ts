const viewer = document.querySelector<HTMLDialogElement>('#image-viewer')!;
const preview = document.querySelector<HTMLImageElement>('#image-preview')!;
const caption = document.querySelector<HTMLElement>('#image-caption')!;

document.querySelectorAll<HTMLElement>('[data-figure]').forEach((figure) => {
  const image = figure.querySelector('img')!;
  const trigger =
    figure.querySelector<HTMLButtonElement>('[data-figure-open]')!;
  const markMissing = () => figure.classList.add('is-missing');
  image.addEventListener('error', markMissing);
  if (image.complete && image.naturalWidth === 0) markMissing();
  trigger.addEventListener('click', () => {
    preview.src = image.currentSrc || image.src;
    preview.alt = image.alt;
    caption.textContent =
      figure.querySelector('figcaption')?.textContent || image.alt;
    viewer.showModal();
    document.documentElement.classList.add('dialog-open');
  });
});

viewer.querySelector('button')?.addEventListener('click', () => viewer.close());
viewer.addEventListener('click', (event) => {
  if (event.target === viewer) viewer.close();
});
viewer.addEventListener('close', () =>
  document.documentElement.classList.remove('dialog-open'),
);

const viewer = document.querySelector<HTMLDialogElement>('#image-viewer')!;
const preview = document.querySelector<HTMLImageElement>('#image-preview')!;
const caption = document.querySelector<HTMLElement>('#image-caption')!;

viewer.querySelector('button')!.addEventListener('click', () => viewer.close());
viewer.addEventListener('click', (event) => {
  if (event.target === viewer) viewer.close();
});
viewer.addEventListener('close', () =>
  document.documentElement.classList.remove('dialog-open'),
);

document.querySelectorAll<HTMLElement>('.article-image').forEach((figure) => {
  const image = figure.querySelector('img')!;
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
      figure.querySelector('figcaption')?.textContent || image.alt;
    viewer.showModal();
    document.documentElement.classList.add('dialog-open');
  });
});

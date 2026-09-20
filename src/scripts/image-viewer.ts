const viewer = document.querySelector<HTMLDialogElement>('#image-viewer');
const preview = document.querySelector<HTMLImageElement>('#image-preview');
const caption = document.querySelector<HTMLElement>('#image-caption');

if (viewer && preview && caption) {
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

export function openImageViewer(
  image: HTMLImageElement,
  captionText: string,
): void {
  if (!viewer || !preview || !caption) return;
  preview.src = image.currentSrc || image.src;
  preview.alt = image.alt;
  caption.textContent = captionText;
  viewer.showModal();
  document.documentElement.classList.add('dialog-open');
}

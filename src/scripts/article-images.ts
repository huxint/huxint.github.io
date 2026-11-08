import { openViewer, type ViewerImage } from './image-viewer';

// Every figure opens in the viewer, which then steps through all of them.
const figures = [...document.querySelectorAll<HTMLElement>('.article-image')];

function viewerImage(figure: HTMLElement): ViewerImage {
  const image = figure.querySelector('img')!;
  return {
    src: image.currentSrc || image.src,
    alt: image.alt,
    caption: figure.querySelector('figcaption')?.textContent || image.alt,
  };
}

figures.forEach((figure, position) => {
  const image = figure.querySelector('img')!;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'image-trigger';
  trigger.setAttribute('aria-label', `放大图片：${image.alt}`);
  image.before(trigger);
  trigger.append(image);
  trigger.addEventListener('click', () =>
    openViewer(figures.map(viewerImage), position),
  );
});

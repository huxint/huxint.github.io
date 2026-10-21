import DOMPurify from 'dompurify';
import { marked } from 'marked';

async function readmeIntroduction(url: string) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) return;
  const fragment = DOMPurify.sanitize(
    marked.parse(await response.text(), { async: false }),
    { USE_PROFILES: { html: true }, RETURN_DOM_FRAGMENT: true },
  );
  const paragraph = Array.from(fragment.querySelectorAll('p')).find((item) => {
    const text = item.cloneNode(true) as HTMLParagraphElement;
    text.querySelectorAll('a, img').forEach((node) => node.remove());
    return /[\p{L}\p{N}]/u.test(text.textContent!);
  });
  return paragraph?.textContent?.trim().replace(/\s+/g, ' ');
}

document
  .querySelectorAll<HTMLElement>('[data-project-description]')
  .forEach(async (element) => {
    try {
      const description = await readmeIntroduction(element.dataset.readmeUrl!);
      if (description) {
        element.textContent = description;
        element.hidden = false;
      }
    } catch {
      // The repository and README links remain available if GitHub is unreachable.
    }
  });

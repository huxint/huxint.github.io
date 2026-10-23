import { readmeIntroduction } from '../lib/readme';

// The build already filled in each introduction; refresh it from the README the
// repository has now.
document
  .querySelectorAll<HTMLElement>('[data-readme-url]')
  .forEach(async (element) => {
    try {
      const response = await fetch(element.dataset.readmeUrl!, {
        cache: 'no-cache',
      });
      if (!response.ok) return;
      const introduction = readmeIntroduction(await response.text());
      if (!introduction) return;
      element.textContent = introduction;
      element.hidden = false;
    } catch {
      // GitHub is unreachable: keep the introduction from the build.
    }
  });

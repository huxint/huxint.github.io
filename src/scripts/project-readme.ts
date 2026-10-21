import DOMPurify from 'dompurify';
import GithubSlugger from 'github-slugger';
import { marked } from 'marked';

const root = document.querySelector<HTMLElement>('[data-project-readme]')!;
const body = root.querySelector<HTMLElement>('[data-readme-body]')!;
const status = root.querySelector<HTMLElement>('[data-readme-status]')!;
const error = root.querySelector<HTMLElement>('[data-readme-error]')!;
const retry = root.querySelector<HTMLButtonElement>('[data-readme-retry]')!;
const repository = root.dataset.repository!;
const readmeUrl = root.dataset.readmeUrl!;

function render(markdown: string) {
  const fragment = DOMPurify.sanitize(
    marked.parse(markdown, { async: false }),
    {
      USE_PROFILES: { html: true },
      RETURN_DOM_FRAGMENT: true,
    },
  );
  const slugger = new GithubSlugger();
  fragment.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    heading.id ||= slugger.slug(heading.textContent!);
    if (heading.tagName === 'H1') {
      const subheading = document.createElement('h2');
      subheading.id = heading.id;
      subheading.append(...heading.childNodes);
      heading.replaceWith(subheading);
    }
  });
  fragment.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const href = link.getAttribute('href')!;
    if (href.startsWith('#')) return;
    link.href = new URL(href, `${repository}/blob/HEAD/`).href;
  });
  fragment
    .querySelectorAll<HTMLElement>(
      'img[src], video[src], audio[src], source[src]',
    )
    .forEach((media) => {
      media.setAttribute(
        'src',
        new URL(media.getAttribute('src')!, readmeUrl).href,
      );
    });
  fragment.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    image.loading = 'lazy';
  });
  fragment.querySelectorAll('table').forEach((table) => {
    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', '表格，可横向滚动');
    table.replaceWith(scroll);
    scroll.append(table);
  });
  body.replaceChildren(fragment);
  if (location.hash) {
    document
      .getElementById(decodeURIComponent(location.hash.slice(1)))
      ?.scrollIntoView();
  }
}

async function loadReadme() {
  root.setAttribute('aria-busy', 'true');
  status.hidden = false;
  error.hidden = true;
  try {
    const response = await fetch(readmeUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`README: ${response.status}`);
    render(await response.text());
  } catch {
    error.hidden = false;
  } finally {
    status.hidden = true;
    root.setAttribute('aria-busy', 'false');
  }
}

retry.addEventListener('click', loadReadme);
void loadReadme();

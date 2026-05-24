(() => {
  'use strict';

  const ready = (fn) =>
    document.readyState !== 'loading'
      ? fn()
      : document.addEventListener('DOMContentLoaded', fn);

  async function injectIncludes(root = document) {
    const nodes = root.querySelectorAll('[data-include]');
    await Promise.all(
      [...nodes].map(async (el) => {
        const url = el.getAttribute('data-include');
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(res.status);
          el.innerHTML = await res.text();
        } catch (err) {
          console.warn('[main] failed to include', url, err);
        }
      })
    );
  }

  async function injectIcons(root = document) {
    const nodes = root.querySelectorAll('svg[data-icon]');
    await Promise.all(
      [...nodes].map(async (el) => {
        const name = el.getAttribute('data-icon');
        const klass = el.getAttribute('class') || '';
        try {
          const res = await fetch(`/assets/icons/${name}.svg`, { cache: 'force-cache' });
          if (!res.ok) throw new Error(res.status);
          const markup = await res.text();
          const wrap = document.createElement('div');
          wrap.innerHTML = markup.trim();
          const svg = wrap.firstElementChild;
          if (!svg || svg.tagName.toLowerCase() !== 'svg') return;
          if (klass) svg.setAttribute('class', klass);
          svg.setAttribute('data-icon', name);
          el.replaceWith(svg);
        } catch (err) {
          console.warn('[main] failed to load icon', name, err);
        }
      })
    );
  }

  function markCurrentNav() {
    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    const key = (() => {
      if (path === '/' || path === '') return 'home';
      if (path.startsWith('/blog')) return 'blog';
      if (path.startsWith('/posts/')) return 'blog';
      if (path.startsWith('/projects')) return 'projects';
      if (path.startsWith('/about')) return 'about';
      return null;
    })();
    if (!key) return;
    document
      .querySelectorAll(`[data-nav="${key}"]`)
      .forEach((el) => el.setAttribute('aria-current', 'page'));
  }

  ready(async () => {
    await injectIncludes();
    await injectIcons();
    markCurrentNav();
    document.dispatchEvent(new CustomEvent('site:ready'));
  });

  window.__site = { injectIncludes, injectIcons };
})();

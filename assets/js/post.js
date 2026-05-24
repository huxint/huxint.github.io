(() => {
  'use strict';

  function initProgressBar() {
    const bar = document.getElementById('reading-progress');
    if (!bar) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h = document.documentElement;
        const scrollable = h.scrollHeight - h.clientHeight;
        const pct = scrollable > 0 ? (h.scrollTop || window.scrollY) / scrollable : 0;
        bar.style.width = `${Math.min(100, Math.max(0, pct * 100))}%`;
        ticking = false;
      });
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[　\s]+/g, '-')
      .replace(/[^\p{L}\p{N}_-]+/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function initToc() {
    const article = document.getElementById('post-content');
    const list = document.getElementById('post-toc-list');
    const toc = document.getElementById('post-toc');
    const toggle = document.getElementById('post-toc-toggle');
    if (!article || !list || !toc) return;

    const headings = [...article.querySelectorAll('h2, h3')];
    if (!headings.length) {
      toc.hidden = true;
      if (toggle) toggle.hidden = true;
      return;
    }
    const used = new Set();
    headings.forEach((h) => {
      if (!h.id) {
        let base = slugify(h.textContent) || 'section';
        let id = base;
        let i = 2;
        while (used.has(id) || document.getElementById(id)) {
          id = `${base}-${i++}`;
        }
        used.add(id);
        h.id = id;
      }
    });

    list.innerHTML = headings.map((h) => `
      <a class="post-toc__item post-toc__item--${h.tagName.toLowerCase()}" href="#${h.id}" data-toc-id="${h.id}">${h.textContent}</a>
    `).join('');

    const links = new Map(
      [...list.querySelectorAll('[data-toc-id]')].map((a) => [a.dataset.tocId, a])
    );
    const setActive = (id) => {
      links.forEach((a) => a.classList.remove('is-active'));
      const a = links.get(id);
      if (a) {
        a.classList.add('is-active');
        a.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };
    if (typeof IntersectionObserver === 'function') {
      const visible = new Map();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        });
        if (visible.size) {
          const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0][0];
          setActive(best);
        }
      }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] });
      headings.forEach((h) => io.observe(h));
    }

    const isMobileMode = () => window.matchMedia('(max-width: 1023px)').matches;
    const closedDefault = () => {
      if (isMobileMode()) {
        toc.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      } else {
        toc.hidden = false;
      }
    };
    closedDefault();
    window.addEventListener('resize', closedDefault);

    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = !toc.hidden;
        toc.hidden = open;
        toggle.setAttribute('aria-expanded', String(!open));
      });
    }
    list.addEventListener('click', () => {
      if (isMobileMode()) {
        toc.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initGiscusTheming() {
    const script = document.querySelector('script[src*="giscus.app/client.js"]');
    if (!script) return;
    if (script.getAttribute('data-disabled') === 'true') {
      const fb = document.getElementById('comments-fallback');
      if (fb) fb.innerHTML = '评论暂未配置，欢迎在 <a href="https://github.com/huxint">GitHub</a> 上 ping 我 ✦';
      return;
    }

    const fb = document.getElementById('comments-fallback');
    const timeout = setTimeout(() => {
      if (fb && fb.parentNode) {
        fb.innerHTML = '评论暂不可用，欢迎在 <a href="https://github.com/huxint">GitHub</a> 上 ping 我 ✦';
      }
    }, 4000);
    const iframeObserver = new MutationObserver(() => {
      const iframe = document.querySelector('iframe.giscus-frame');
      if (iframe) {
        clearTimeout(timeout);
        if (fb && fb.parentNode) fb.parentNode.removeChild(fb);
        iframeObserver.disconnect();
      }
    });
    iframeObserver.observe(document.body, { childList: true, subtree: true });

    const themeOf = () => {
      const explicit = document.documentElement.dataset.theme;
      if (explicit === 'light' || explicit === 'dark') return explicit;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };
    const post = (theme) => {
      const iframe = document.querySelector('iframe.giscus-frame');
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { giscus: { setConfig: { theme } } },
        'https://giscus.app'
      );
    };
    document.addEventListener('site:themechange', () => post(themeOf()));
  }

  function init() {
    initProgressBar();
    initToc();
    initGiscusTheming();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

(() => {
  'use strict';

  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch {}

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

  const THEME_KEY = 'theme';

  function readStoredTheme() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  }

  function applyTheme(theme) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  function nextTheme(current, prefersDark) {
    const effective =
      current === 'system' ? (prefersDark ? 'dark' : 'light') : current;
    return effective === 'dark' ? 'light' : 'dark';
  }

  function runMaskTransition(originX, originY) {
    if (!document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      return null;
    }
    const mask = document.createElement('div');
    mask.className = 'theme-mask';
    const radius = Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY)
    );
    mask.style.background = `radial-gradient(circle at ${originX}px ${originY}px, var(--bg) 0, var(--bg) 0)`;
    mask.style.transition = 'background 500ms ease';
    document.body.appendChild(mask);
    requestAnimationFrame(() => {
      mask.style.background = `radial-gradient(circle at ${originX}px ${originY}px, var(--bg) ${radius}px, transparent ${radius}px)`;
    });
    setTimeout(() => mask.remove(), 520);
    return mask;
  }

  function initThemeToggle() {
    applyTheme(readStoredTheme());
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    document.body.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.theme-toggle');
      if (!btn) return;
      const stored = readStoredTheme();
      const target = nextTheme(stored, mql.matches);
      const rect = btn.getBoundingClientRect();
      runMaskTransition(rect.left + rect.width / 2, rect.top + rect.height / 2);
      try { localStorage.setItem(THEME_KEY, target); } catch {}
      applyTheme(target);
      document.dispatchEvent(new CustomEvent('site:themechange', { detail: { theme: target } }));
    });

    mql.addEventListener('change', () => {
      if (readStoredTheme() === 'system') {
        document.dispatchEvent(new CustomEvent('site:themechange', { detail: { theme: 'system' } }));
      }
    });
  }

  function initMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    if (!drawer) return;
    const open = () => {
      drawer.hidden = false;
      requestAnimationFrame(() => drawer.classList.add('is-open'));
      document.body.classList.add('no-scroll');
      const trigger = document.querySelector('.hamburger');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      drawer.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      const trigger = document.querySelector('.hamburger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      setTimeout(() => { drawer.hidden = true; }, 200);
    };

    document.body.addEventListener('click', (ev) => {
      if (ev.target.closest('.hamburger')) { open(); return; }
      if (ev.target.closest('.mobile-drawer__close')) { close(); return; }
      if (ev.target.closest('.mobile-drawer__link')) { close(); return; }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !drawer.hidden) close();
    });
  }

  const QR_MAP = {
    wechat: { img: '/assets/images/wechat-qr.png', caption: '微信扫一扫，加我好友' },
    qq:     { img: '/assets/images/qq-qr.png',     caption: 'QQ 扫一扫' },
  };

  function initQrModal() {
    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    const img = modal.querySelector('#qr-modal-img');
    const cap = modal.querySelector('#qr-modal-caption');
    let lastTrigger = null;

    const open = (trigger) => {
      const key = trigger.dataset.qr;
      const data = QR_MAP[key];
      if (!data) return;
      img.src = data.img;
      img.alt = data.caption;
      cap.textContent = data.caption;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => modal.classList.add('is-open'));
      document.body.classList.add('no-scroll');
      lastTrigger = trigger;
    };
    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      setTimeout(() => { modal.hidden = true; }, 200);
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    };

    document.body.addEventListener('click', (ev) => {
      const trigger = ev.target.closest('[data-qr]');
      if (trigger) { open(trigger); return; }
      if (ev.target.closest('[data-modal-close]')) { close(); return; }
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.hidden) close();
    });
  }

  ready(async () => {
    await injectIncludes();
    await injectIcons();
    markCurrentNav();
    initThemeToggle();
    initMobileDrawer();
    initQrModal();
    document.dispatchEvent(new CustomEvent('site:ready'));
  });

  window.__site = { injectIncludes, injectIcons };
})();

(() => {
  'use strict';

  const USER = 'huxint';
  const ENDPOINT = `https://api.github.com/users/${USER}/repos?per_page=100&sort=updated&type=public`;
  const CACHE_KEY = `gh:repos:${USER}`;
  const CACHE_TTL = 1000 * 60 * 30; // 30 min

  const LANG_COLOR = {
    'JavaScript': '#F0DB4F',
    'TypeScript': '#3178C6',
    'Python':     '#3572A5',
    'Rust':       '#DEA584',
    'Go':         '#00ADD8',
    'C++':        '#F34B7D',
    'C':          '#555555',
    'Java':       '#B07219',
    'HTML':       '#E34C26',
    'CSS':        '#563D7C',
    'Shell':      '#89E051',
    'Vue':        '#41B883',
    'Lua':        '#000080',
    'Zig':        '#EC915C',
    'Ruby':       '#701516',
    'Swift':      '#F05138',
    'Kotlin':     '#A97BFF',
    'Dart':       '#00B4AB',
    'PHP':        '#4F5D95',
    'Markdown':   '#083FA1',
  };

  const FEATURED = new Set(['huxint.github.io']);

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - obj.t > CACHE_TTL) return null;
      return obj.v;
    } catch { return null; }
  }
  function writeCache(v) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), v })); } catch {}
  }

  function fmtNum(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 86400000;
    if (diff < 1) return 'today';
    if (diff < 7) return `${Math.floor(diff)}d ago`;
    if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
    if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
    return `${Math.floor(diff / 365)}y ago`;
  }

  function render(mount, repos, filter) {
    let list = repos.slice();
    if (filter === 'starred') {
      list = list.filter((r) => r.stargazers_count > 0).sort((a, b) => b.stargazers_count - a.stargazers_count);
    } else if (filter === 'recent') {
      list = list.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
    } else {
      list = list.sort((a, b) => {
        const fa = FEATURED.has(a.name) ? 1 : 0;
        const fb = FEATURED.has(b.name) ? 1 : 0;
        if (fa !== fb) return fb - fa;
        const sa = a.stargazers_count || 0;
        const sb = b.stargazers_count || 0;
        if (sa !== sb) return sb - sa;
        return new Date(b.pushed_at) - new Date(a.pushed_at);
      });
    }

    if (!list.length) {
      mount.innerHTML = '<p class="proj-empty">空空如也 ✦</p>';
      return;
    }

    mount.innerHTML = list.map((r, i) => {
      const langColor = LANG_COLOR[r.language] || 'var(--text-faint)';
      const isFeatured = FEATURED.has(r.name);
      const description = r.description || '—';
      return `
        <a class="proj-card" href="${r.html_url}" target="_blank" rel="noopener noreferrer">
          <div class="proj-card__top">
            <span class="proj-card__no">${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}</span>
            ${isFeatured ? '<span class="proj-card__featured">★ featured</span>' : ''}
          </div>
          <div>
            <h3 class="proj-card__name">
              ${r.name}
              <span class="proj-card__name__arrow" aria-hidden="true">↗</span>
            </h3>
            <p class="proj-card__desc">${description}</p>
          </div>
          <div class="proj-card__foot">
            <div class="proj-card__stats">
              ${r.language ? `
                <span class="proj-card__lang">
                  <span class="proj-card__lang__dot" style="background:${langColor}"></span>
                  ${r.language}
                </span>` : ''}
              <span class="proj-card__stat">★ <strong>${fmtNum(r.stargazers_count)}</strong></span>
              ${r.forks_count > 0 ? `<span class="proj-card__stat">⑂ <strong>${fmtNum(r.forks_count)}</strong></span>` : ''}
            </div>
            <span>${fmtDate(r.pushed_at)}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  async function fetchRepos() {
    const cached = readCache();
    if (cached) return cached;
    const res = await fetch(ENDPOINT, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const cleaned = json
      .filter((r) => !r.fork && !r.private && !r.archived)
      .map((r) => ({
        name: r.name,
        html_url: r.html_url,
        description: r.description,
        language: r.language,
        stargazers_count: r.stargazers_count,
        forks_count: r.forks_count,
        pushed_at: r.pushed_at,
        updated_at: r.updated_at,
      }));
    writeCache(cleaned);
    return cleaned;
  }

  async function loadLocal() {
    try {
      const res = await fetch('/data/projects.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      return arr.map((p) => ({
        name: p.name,
        html_url: p.url,
        description: p.description,
        language: p.language,
        stargazers_count: p.stars || 0,
        forks_count: 0,
        pushed_at: null,
      }));
    } catch { return null; }
  }

  async function init() {
    const mount = document.getElementById('projects-grid');
    const counter = document.getElementById('proj-count');
    const filterEl = document.getElementById('proj-filter');
    if (!mount) return;

    let repos;
    try {
      repos = await fetchRepos();
    } catch (err) {
      console.warn('[projects] github API failed, falling back to local', err);
      repos = await loadLocal();
      if (!repos) {
        mount.innerHTML = '<p class="proj-empty">暂时拉不到项目列表 — <a href="https://github.com/' + USER + '" target="_blank" rel="noopener" style="color: var(--sienna);">直接看 GitHub ↗</a></p>';
        if (counter) counter.textContent = 'offline';
        return;
      }
    }

    let current = 'all';
    render(mount, repos, current);
    if (counter) counter.textContent = `${repos.length} repos · live from github`;

    if (filterEl) {
      filterEl.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button[data-filter]');
        if (!btn) return;
        current = btn.dataset.filter;
        filterEl.querySelectorAll('button').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        render(mount, repos, current);
      });
    }
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

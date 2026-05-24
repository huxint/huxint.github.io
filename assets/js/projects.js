(() => {
  'use strict';

  async function init() {
    const mount = document.getElementById('projects-grid');
    if (!mount) return;
    let projects;
    try {
      const res = await fetch('/data/projects.json', { cache: 'no-cache' });
      projects = await res.json();
    } catch (err) {
      console.warn(err);
      mount.innerHTML = '<p style="color: var(--text-faint);">暂时拉不到项目列表 ✦</p>';
      return;
    }
    if (!projects.length) {
      mount.innerHTML = '<p style="color: var(--text-faint);">还没添加项目 ✦</p>';
      return;
    }

    const sorted = projects.slice().sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.stars || 0) - (a.stars || 0);
    });

    mount.innerHTML = sorted.map((p) => `
      <a class="card" data-color="${p.color}" href="${p.url}" target="_blank" rel="noopener noreferrer">
        <h3 class="card__title">${p.name}</h3>
        <p class="card__body">${p.description}</p>
        <div class="card__tags">
          <span class="pill pill--${p.color}">${p.language}</span>
          <span class="pill">★ ${p.stars}</span>
          ${p.featured ? '<span class="pill pill--yellow">featured</span>' : ''}
        </div>
      </a>
    `).join('');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

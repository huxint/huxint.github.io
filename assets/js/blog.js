(() => {
  'use strict';

  async function init() {
    const mount = document.getElementById('blog-list');
    if (!mount) return;
    let posts;
    try {
      const res = await fetch('/data/posts.json', { cache: 'no-cache' });
      posts = await res.json();
    } catch (err) {
      console.warn(err);
      mount.innerHTML = '<p style="color: var(--text-faint);">暂时拉不到文章列表 ✦</p>';
      return;
    }
    if (!posts.length) {
      mount.innerHTML = '<p style="color: var(--text-faint);">还没有文章，敬请期待 ✦</p>';
      return;
    }
    const sorted = posts.slice().sort((a, b) => b.date.localeCompare(a.date));
    const groups = {};
    sorted.forEach((p) => {
      const year = p.date.slice(0, 4);
      (groups[year] = groups[year] || []).push(p);
    });

    mount.innerHTML = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((year) => `
        <section class="year-group">
          <h2 class="year-group__year">${year}</h2>
          <div class="entry-list">
            ${groups[year].map((p) => `
              <a class="entry" href="/posts/${p.slug}.html">
                <div class="entry__date">${p.date}</div>
                <div>
                  <div class="entry__title">${p.title}</div>
                  <div class="entry__summary">${p.summary}</div>
                  <div class="entry__meta">
                    ${p.tags.map((t) => `<span class="pill pill--${p.color}">${t}</span>`).join('')}
                    <span class="entry__reading">· ${p.readingTime} 分钟</span>
                  </div>
                </div>
              </a>
            `).join('')}
          </div>
        </section>
      `).join('');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

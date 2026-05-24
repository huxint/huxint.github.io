(() => {
  'use strict';

  const TAG_COLOR = ['sienna', 'sage', 'gold', 'plum', 'indigo'];

  async function init() {
    const mount = document.getElementById('blog-list');
    const counter = document.getElementById('post-count');
    if (!mount) return;
    let posts;
    try {
      const res = await fetch('/data/posts.json', { cache: 'no-cache' });
      posts = await res.json();
    } catch (err) {
      console.warn(err);
      mount.innerHTML = '<p class="proj-empty">暂时拉不到文章列表 ✦</p>';
      if (counter) counter.textContent = 'offline';
      return;
    }
    if (!posts.length) {
      mount.innerHTML = '<p class="proj-empty">还没有文章，敬请期待 ✦</p>';
      if (counter) counter.textContent = '0 entries';
      return;
    }
    const sorted = posts.slice().sort((a, b) => b.date.localeCompare(a.date));
    if (counter) counter.textContent = `${sorted.length} entries · since 2026`;

    const groups = {};
    sorted.forEach((p) => {
      const year = p.date.slice(0, 4);
      (groups[year] = groups[year] || []).push(p);
    });

    let counter2 = 0;
    mount.innerHTML = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((year) => `
        <section class="archive__year">
          <div class="archive__year__label">${year}</div>
          <div class="archive__list">
            ${groups[year].map((p) => {
              const idx = counter2++;
              const date = p.date.slice(5);
              return `
                <a class="archive__item" href="/posts/${p.slug}.html">
                  <span class="archive__item__date">${date}</span>
                  <div>
                    <div class="archive__item__title">${p.title}</div>
                    <div class="archive__item__summary">${p.summary}</div>
                    <div class="archive__item__tags">
                      ${p.tags.map((t, ti) => `<span class="tag tag--${TAG_COLOR[(idx + ti) % 5]}">${t}</span>`).join('')}
                    </div>
                  </div>
                  <span class="archive__item__read">${p.readingTime} min →</span>
                </a>
              `;
            }).join('')}
          </div>
        </section>
      `).join('');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

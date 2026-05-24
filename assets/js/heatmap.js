(() => {
  'use strict';

  const API_PRIMARY  = 'https://github-contributions-api.deno.dev/huxint.json';
  const API_FALLBACK = 'https://github-contributions.vercel.app/api/v1/huxint';
  const USER = 'huxint';

  function flatten(data) {
    if (!data) return [];
    const c = data.contributions;
    if (Array.isArray(c)) {
      // Could be flat array of day objects, or array of week arrays (deno API).
      if (c.length && Array.isArray(c[0])) {
        return c.flat();
      }
      return c;
    }
    if (c && typeof c === 'object') {
      return Object.keys(c).flatMap((y) => Array.isArray(c[y]) ? c[y] : []);
    }
    return [];
  }

  function normalize(items) {
    return items
      .map((it) => {
        const date = it.date;
        const count = it.contributionCount ?? it.count ?? 0;
        let level = it.level;
        if (typeof level !== 'number') {
          if (count === 0) level = 0;
          else if (count < 3) level = 1;
          else if (count < 6) level = 2;
          else if (count < 10) level = 3;
          else level = 4;
        }
        return { date, count, level };
      })
      .filter((it) => it.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function buildGrid(items) {
    if (!items.length) return { weeks: [], total: 0 };
    const lastDate = new Date(items[items.length - 1].date);
    const days = 53 * 7;
    const start = new Date(lastDate);
    start.setDate(start.getDate() - days + 1);
    while (start.getDay() !== 0) {
      start.setDate(start.getDate() - 1);
    }
    const byDate = new Map(items.map((d) => [d.date, d]));
    const weeks = [];
    let cur = new Date(start);
    for (let w = 0; w < 53; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const iso = cur.toISOString().slice(0, 10);
        const entry = byDate.get(iso);
        col.push({
          date: iso,
          count: entry ? entry.count : 0,
          level: entry ? entry.level : 0,
        });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(col);
    }
    let total = 0;
    items.forEach((it) => { total += (it.count || 0); });
    return { weeks, total };
  }

  function render(target, weeks) {
    const cellSize = 14;
    const gap = 4;
    const w = weeks.length * (cellSize + gap);
    const h = 7 * (cellSize + gap);
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'GitHub 贡献热力图');

    weeks.forEach((col, wi) => {
      col.forEach((cell, di) => {
        const rect = document.createElementNS(svgNs, 'rect');
        rect.setAttribute('x', String(wi * (cellSize + gap)));
        rect.setAttribute('y', String(di * (cellSize + gap)));
        rect.setAttribute('width', String(cellSize));
        rect.setAttribute('height', String(cellSize));
        rect.setAttribute('rx', '4');
        rect.setAttribute('class', 'heatmap-cell');
        rect.setAttribute('data-level', String(cell.level));
        const title = document.createElementNS(svgNs, 'title');
        title.textContent = `${cell.date} · ${cell.count} 次提交`;
        rect.appendChild(title);
        svg.appendChild(rect);
      });
    });

    target.innerHTML = '';
    target.appendChild(svg);
  }

  async function tryFetch(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function init() {
    const grid = document.getElementById('heatmap-grid');
    const meta = document.getElementById('heatmap-meta');
    const legend = document.getElementById('heatmap-legend');
    const fallback = document.getElementById('heatmap-fallback');
    if (!grid) return;

    let data;
    try {
      data = await tryFetch(API_PRIMARY);
    } catch (err1) {
      console.warn('[heatmap] primary failed', err1);
      try {
        data = await tryFetch(API_FALLBACK);
      } catch (err2) {
        console.warn('[heatmap] fallback failed', err2);
        if (fallback) {
          fallback.innerHTML =
            '暂时拉不到 GitHub 贡献数据 ✦ ' +
            `<a href="https://github.com/${USER}" target="_blank" rel="noopener">直接看 GitHub →</a>`;
        }
        return;
      }
    }

    const items = normalize(flatten(data));
    if (!items.length) {
      if (fallback) fallback.textContent = '暂时还没有公开贡献数据 ✦';
      return;
    }
    const { weeks, total } = buildGrid(items);
    render(grid, weeks);
    if (meta) meta.textContent = `过去一年 ${total} 次贡献`;
    if (legend) legend.hidden = false;
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

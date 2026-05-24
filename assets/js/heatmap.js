(() => {
  'use strict';

  const USER = 'huxint';
  const API_PRIMARY  = `https://github-contributions-api.deno.dev/${USER}.json`;
  const API_FALLBACK = `https://github-contributions.vercel.app/api/v1/${USER}`;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const flatten = (data) => {
    if (!data) return [];
    const c = data.contributions;
    if (Array.isArray(c)) {
      if (c.length && Array.isArray(c[0])) return c.flat();
      return c;
    }
    if (c && typeof c === 'object') {
      return Object.keys(c).flatMap((y) => Array.isArray(c[y]) ? c[y] : []);
    }
    return [];
  };

  const normalize = (items) =>
    items.map((it) => {
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

  const buildGrid = (items) => {
    if (!items.length) return { weeks: [], total: 0 };
    const lastDate = new Date(items[items.length - 1].date);
    const days = 53 * 7;
    const start = new Date(lastDate);
    start.setDate(start.getDate() - days + 1);
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

    const byDate = new Map(items.map((d) => [d.date, d]));
    const weeks = [];
    const cur = new Date(start);
    for (let w = 0; w < 53; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const iso = cur.toISOString().slice(0, 10);
        const entry = byDate.get(iso);
        col.push({
          date: iso,
          dow: d,
          count: entry ? entry.count : 0,
          level: entry ? entry.level : 0,
        });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(col);
    }
    const total = items.reduce((s, it) => s + (it.count || 0), 0);
    return { weeks, total };
  };

  const computeStreak = (items) => {
    let current = 0;
    let longest = 0;
    let run = 0;
    items.forEach((it) => {
      if (it.count > 0) { run++; longest = Math.max(longest, run); }
      else run = 0;
    });
    // current streak counts back from the last day
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].count > 0) current++;
      else break;
    }
    return { current, longest };
  };

  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const WEEKDAYS = ['', 'M', '', 'W', '', 'F', ''];

  const render = (mount, weeks, hover) => {
    const W = 1060;
    const H = 200;
    const padL = 24;
    const padR = 4;
    const padT = 24;
    const padB = 32;
    const gridW = W - padL - padR;
    const gridH = H - padT - padB;

    const cellW = gridW / weeks.length;
    const cellH = gridH / 7;
    const barW = Math.max(3, cellW - 2.5);
    // bar height grows by level: level 0 = small, level 4 = full
    const heightFor = (lvl) => {
      const base = Math.max(2, cellH * 0.18);
      const max = cellH - 2;
      return base + ((max - base) * (lvl / 4));
    };

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'GitHub 贡献声谱');
    svg.style.width = '100%';
    svg.style.height = 'auto';

    // baseline rules per row
    for (let d = 0; d < 7; d++) {
      const y = padT + d * cellH + cellH - 1;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', padL);
      line.setAttribute('y1', y);
      line.setAttribute('x2', W - padR);
      line.setAttribute('y2', y);
      line.setAttribute('class', 'codescape__baseline');
      svg.appendChild(line);
    }

    // weekday labels
    WEEKDAYS.forEach((label, d) => {
      if (!label) return;
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', 0);
      t.setAttribute('y', padT + d * cellH + cellH * 0.7);
      t.setAttribute('class', 'codescape__weekday');
      t.textContent = label;
      svg.appendChild(t);
    });

    // month labels
    let lastMonth = -1;
    weeks.forEach((col, wi) => {
      const first = col[0];
      if (!first) return;
      const month = new Date(first.date).getMonth();
      if (month !== lastMonth) {
        lastMonth = month;
        const t = document.createElementNS(SVG_NS, 'text');
        const x = padL + wi * cellW;
        t.setAttribute('x', x);
        t.setAttribute('y', 14);
        t.setAttribute('class', 'codescape__month');
        t.textContent = MONTHS[month];
        svg.appendChild(t);
      }
    });

    weeks.forEach((col, wi) => {
      col.forEach((cell) => {
        const cx = padL + wi * cellW + (cellW - barW) / 2;
        const bh = heightFor(cell.level);
        const baseY = padT + cell.dow * cellH + cellH - 1;
        const by = baseY - bh;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', cx);
        rect.setAttribute('y', by);
        rect.setAttribute('width', barW);
        rect.setAttribute('height', bh);
        rect.setAttribute('rx', '1.5');
        rect.setAttribute('class', 'codescape__bar');
        rect.setAttribute('data-level', String(cell.level));
        rect.setAttribute('data-date', cell.date);
        rect.setAttribute('data-count', String(cell.count));

        rect.addEventListener('mouseenter', (ev) => showHover(ev, cell, hover, mount));
        rect.addEventListener('mouseleave', () => hover.classList.remove('is-on'));
        rect.addEventListener('focus',      (ev) => showHover(ev, cell, hover, mount));
        rect.addEventListener('blur',       () => hover.classList.remove('is-on'));

        svg.appendChild(rect);
      });
    });

    mount.innerHTML = '';
    mount.appendChild(svg);
  };

  const showHover = (ev, cell, hover, mount) => {
    const rect = ev.target.getBoundingClientRect();
    const wrap = mount.getBoundingClientRect();
    hover.style.left = `${rect.left - wrap.left + rect.width / 2}px`;
    hover.style.top = `${rect.top - wrap.top}px`;
    const niceDate = new Date(cell.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
    hover.textContent = cell.count > 0
      ? `${niceDate} · ${cell.count} commits`
      : `${niceDate} · 休息日 ✦`;
    hover.classList.add('is-on');
  };

  async function tryFetch(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function init() {
    const mount    = document.getElementById('codescape');
    const fallback = document.getElementById('contrib-fallback');
    const totalEl  = document.getElementById('contrib-total');
    const streakEl = document.getElementById('contrib-streak');
    const legend   = document.getElementById('contrib-legend');
    if (!mount) return;

    // hover element
    const hover = document.createElement('div');
    hover.className = 'contrib__hover';
    mount.parentElement.appendChild(hover);
    mount.parentElement.style.position = 'relative';

    let data;
    try {
      data = await tryFetch(API_PRIMARY);
    } catch (err1) {
      console.warn('[codescape] primary failed', err1);
      try {
        data = await tryFetch(API_FALLBACK);
      } catch (err2) {
        console.warn('[codescape] fallback failed', err2);
        if (fallback) {
          fallback.innerHTML =
            '暂时抓不到 GitHub 贡献数据 — <a href="https://github.com/' + USER + '" target="_blank" rel="noopener">直接看 GitHub →</a>';
        }
        if (totalEl) totalEl.innerHTML = '<em>—</em>';
        if (streakEl) streakEl.textContent = 'offline';
        return;
      }
    }

    const items = normalize(flatten(data));
    if (!items.length) {
      if (fallback) fallback.textContent = '暂时还没有公开贡献数据 ✦';
      return;
    }
    const { weeks, total } = buildGrid(items);
    const { current, longest } = computeStreak(items);
    render(mount, weeks, hover);
    if (totalEl)  totalEl.innerHTML  = `<em>${total}</em> commits / year`;
    if (streakEl) streakEl.textContent = `streak · current ${current}d · longest ${longest}d`;
    if (legend)   legend.hidden = false;
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

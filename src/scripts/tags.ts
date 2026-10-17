const atlas = document.querySelector<HTMLElement>('[data-tag-atlas]');
const filter = document.querySelector<HTMLInputElement>('[data-tag-filter]');
const status = document.querySelector<HTMLElement>('[data-tag-status]');
const empty = document.querySelector<HTMLElement>('[data-tag-empty]');
const clear = document.querySelector<HTMLButtonElement>('[data-tag-clear]');
const shuffle = document.querySelector<HTMLButtonElement>('[data-tag-shuffle]');
const cards = [
  ...document.querySelectorAll<HTMLAnchorElement>('[data-tag-card]'),
];
const finePointer = matchMedia('(pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
}

function visibleCards(): HTMLAnchorElement[] {
  return cards.filter((card) => !card.hidden);
}

function updateFilterStatus(query: string, count: number): void {
  if (!status) return;
  status.textContent = query
    ? count > 0
      ? `找到 ${count} 个主题。`
      : '没有匹配的主题。'
    : `共 ${cards.length} 个主题，按文章数排列。`;
}

function applyFilter(): void {
  if (!filter) return;
  const query = normalize(filter.value);
  let shown = 0;

  for (const card of cards) {
    const haystack = normalize(
      `${card.dataset.tagName ?? ''} ${card.dataset.tagSearch ?? ''}`,
    );
    const matches = !query || haystack.includes(query);
    card.hidden = !matches;
    if (matches) shown += 1;
  }

  if (empty) empty.hidden = shown > 0;
  if (shuffle && !shuffle.dataset.busy) shuffle.disabled = shown === 0;
  updateFilterStatus(query, shown);
}

function clearFilter(): void {
  if (!filter) return;
  filter.value = '';
  applyFilter();
  filter.focus();
}

filter?.addEventListener('input', applyFilter);
clear?.addEventListener('click', clearFilter);

filter?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && filter.value) {
    event.preventDefault();
    clearFilter();
  }
});

document.addEventListener('keydown', (event) => {
  if (
    event.key !== '/' ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    !filter
  )
    return;
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
    return;
  event.preventDefault();
  filter.focus();
  filter.select();
});

if (atlas && finePointer.matches) {
  for (const card of cards) {
    card.addEventListener(
      'pointermove',
      (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', `${x.toFixed(2)}%`);
        card.style.setProperty('--my', `${y.toFixed(2)}%`);
      },
      { passive: true },
    );
  }
}

shuffle?.addEventListener('click', () => {
  const candidates = visibleCards();
  if (candidates.length === 0) return;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (!pick) return;

  for (const card of cards) card.classList.remove('is-picked');
  pick.classList.add('is-picked');
  pick.scrollIntoView({
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
    block: 'center',
  });
  updateFilterStatus(normalize(filter?.value ?? ''), candidates.length);
  if (status)
    status.textContent = `这次抽到「${pick.dataset.tagName ?? '这个主题'}」，正在打开…`;

  shuffle.dataset.busy = 'true';
  shuffle.disabled = true;
  window.setTimeout(
    () => {
      window.location.href = pick.href;
    },
    reducedMotion.matches ? 0 : 520,
  );
});

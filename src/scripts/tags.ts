const filter = document.querySelector<HTMLInputElement>('[data-tag-filter]');
const status = document.querySelector<HTMLElement>('[data-tag-status]');
const empty = document.querySelector<HTMLElement>('[data-tag-empty]');
const clear = document.querySelector<HTMLButtonElement>('[data-tag-clear]');
const items = [...document.querySelectorAll<HTMLElement>('[data-tag-item]')];

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
}

function updateStatus(query: string, count: number): void {
  if (!status) return;
  if (query) {
    status.textContent =
      count > 0 ? `找到 ${count} 个标签。` : '没有匹配的标签。';
    return;
  }
  status.textContent = `共 ${items.length} 个标签，按文章数排列。`;
}

function applyFilter(): void {
  if (!filter) return;
  const query = normalize(filter.value);
  let shown = 0;

  for (const item of items) {
    const haystack = normalize(
      `${item.dataset.tagName ?? ''} ${item.dataset.tagSearch ?? ''}`,
    );
    const matches = !query || haystack.includes(query);
    item.hidden = !matches;
    if (matches) shown += 1;
  }

  if (empty) empty.hidden = shown > 0;
  updateStatus(query, shown);
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

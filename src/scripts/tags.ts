function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
}

function setupTagFilter(): void {
  const filter = document.querySelector<HTMLInputElement>('[data-tag-filter]');
  if (!filter) return;
  const status = document.querySelector<HTMLElement>('[data-tag-status]')!;
  const empty = document.querySelector<HTMLElement>('[data-tag-empty]')!;
  const clear = document.querySelector<HTMLButtonElement>('[data-tag-clear]')!;
  const items = [
    ...document.querySelectorAll<HTMLElement>('[data-tag-item]'),
  ].map((element) => ({
    element,
    text: normalize(element.dataset.tagSearch!),
  }));

  function applyFilter(): void {
    const query = normalize(filter!.value);
    let shown = 0;
    for (const item of items) {
      item.element.hidden = !item.text.includes(query);
      if (!item.element.hidden) shown += 1;
    }
    empty.hidden = shown > 0;
    status.textContent = query
      ? shown > 0
        ? `找到 ${shown} 个标签。`
        : '没有匹配的标签。'
      : `共 ${items.length} 个标签，按文章数排列。`;
  }

  function clearFilter(): void {
    filter!.value = '';
    applyFilter();
    filter!.focus();
  }

  filter.addEventListener('input', applyFilter);
  clear.addEventListener('click', clearFilter);
  filter.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filter.value) clearFilter();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey)
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
}

setupTagFilter();

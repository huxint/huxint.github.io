const status = document.querySelector<HTMLElement>('[data-sticker-status]')!;

document
  .querySelectorAll<HTMLButtonElement>('[data-sticker-code]')
  .forEach((card) => {
    const code = card.dataset.stickerCode!;
    const label = card.querySelector('code')!;
    let timer: number | undefined;
    card.addEventListener('click', async () => {
      let message = '已复制';
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        // No permission, or a page served without HTTPS.
        message = '复制失败';
      }
      status.textContent = `${message} ${code}`;
      label.textContent = message;
      card.classList.add('is-copied');
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        label.textContent = code;
        card.classList.remove('is-copied');
      }, 1200);
    });
  });

// The filter matches a sticker's name, its caption, its :id: and its group.
const filter = document.querySelector<HTMLInputElement>(
  '[data-sticker-filter]',
)!;
const count = document.querySelector<HTMLElement>('[data-sticker-count]')!;
const empty = document.querySelector<HTMLElement>('[data-sticker-empty]')!;
const total = count.textContent!;
const normalize = (value: string) =>
  value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
const sections = [
  ...document.querySelectorAll<HTMLElement>('[data-sticker-group]'),
].map((section) => ({
  section,
  items: [...section.querySelectorAll<HTMLElement>('[data-sticker-item]')].map(
    (element) => ({ element, text: normalize(element.dataset.stickerSearch!) }),
  ),
}));

function applyFilter(): void {
  const query = normalize(filter.value).replaceAll(':', '');
  let shown = 0;
  for (const { section, items } of sections) {
    let visible = 0;
    for (const item of items) {
      item.element.hidden = !item.text.includes(query);
      if (!item.element.hidden) visible += 1;
    }
    section.hidden = visible === 0;
    shown += visible;
  }
  empty.hidden = shown > 0;
  count.textContent = query ? `找到 ${shown} 个。` : total;
}

filter.addEventListener('input', applyFilter);
filter.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !filter.value) return;
  filter.value = '';
  applyFilter();
});
// A reload can bring the old query back with the page.
applyFilter();

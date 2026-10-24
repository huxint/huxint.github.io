const status = document.querySelector<HTMLElement>('[data-sticker-status]')!;

document
  .querySelectorAll<HTMLButtonElement>('[data-sticker-code]')
  .forEach((card) => {
    const code = card.dataset.stickerCode!;
    const label = card.querySelector('code')!;
    let timer: number | undefined;
    card.addEventListener('click', async () => {
      await navigator.clipboard.writeText(code);
      status.textContent = `已复制 ${code}`;
      label.textContent = '已复制';
      card.classList.add('is-copied');
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        label.textContent = code;
        card.classList.remove('is-copied');
      }, 1200);
    });
  });

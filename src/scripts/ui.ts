const header = document.querySelector<HTMLElement>('.site-header')!;
let headerFrame = 0;

function updateHeaderState(): void {
  header.classList.toggle('is-scrolled', window.scrollY > 8);
  headerFrame = 0;
}

function scheduleHeaderState(): void {
  if (headerFrame) return;
  headerFrame = requestAnimationFrame(updateHeaderState);
}

updateHeaderState();
window.addEventListener('scroll', scheduleHeaderState, { passive: true });

// "/" goes to the page's own filter when it has one and to search otherwise;
// Ctrl+K or ⌘K always means search.
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.isComposing) return;
  const command =
    (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
  const search = command && event.key.toLowerCase() === 'k';
  const slash =
    event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
  if (!search && !(slash && !isTyping(event.target))) return;
  // A dialog on top keeps the keys to itself.
  if (document.querySelector('dialog[open]')) return;

  const field = document.querySelector<HTMLInputElement>(
    '[data-shortcut-focus]',
  );
  const onSearch = location.pathname === '/search/';
  if (field && !field.disabled && (slash || onSearch)) {
    event.preventDefault();
    field.focus();
    field.select();
  } else if (!onSearch) {
    event.preventDefault();
    location.assign('/search/');
  }
});

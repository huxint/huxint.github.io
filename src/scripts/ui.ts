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

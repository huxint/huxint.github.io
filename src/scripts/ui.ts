const headers = [
  ...document.querySelectorAll<HTMLElement>('.site-header, .project-header'),
];
let headerFrame = 0;

function updateHeaderState(): void {
  const scrolled = window.scrollY > 8;
  for (const header of headers)
    header.classList.toggle('is-scrolled', scrolled);
  headerFrame = 0;
}

function scheduleHeaderState(): void {
  if (headerFrame) return;
  headerFrame = requestAnimationFrame(updateHeaderState);
}

updateHeaderState();
window.addEventListener('scroll', scheduleHeaderState, { passive: true });

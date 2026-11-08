// Plays a muted clip over its still, as Live Photos do. `host` carries the
// is-loading / is-playing state the styles fade on.
export function livePlayer(
  video: HTMLVideoElement,
  host: HTMLElement,
  badge: HTMLButtonElement,
) {
  video.muted = true;
  let session = 0;
  const stop = () => {
    session += 1;
    video.pause();
    if (video.readyState) video.currentTime = 0;
    host.classList.remove('is-loading', 'is-playing');
    badge.setAttribute('aria-pressed', 'false');
  };
  const play = () => {
    const current = ++session;
    host.classList.add('is-loading');
    badge.setAttribute('aria-pressed', 'true');
    if (video.readyState) video.currentTime = 0;
    video.play().catch(() => {
      if (session === current) stop();
    });
  };
  const active = () =>
    host.classList.contains('is-playing') ||
    host.classList.contains('is-loading');
  video.addEventListener('playing', () => {
    host.classList.remove('is-loading');
    host.classList.add('is-playing');
  });
  video.addEventListener('ended', stop);
  video.addEventListener('error', stop);
  badge.addEventListener('click', () => (active() ? stop() : play()));
  return { play, stop };
}

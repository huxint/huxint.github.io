const themeButton = document.querySelector<HTMLButtonElement>(
  '[data-theme-toggle]',
);
const systemTheme = matchMedia('(prefers-color-scheme: dark)');

function storedTheme(): string | null {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}

const themeColor = document.querySelector<HTMLMetaElement>(
  'meta[name="theme-color"]',
);

function applyTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
  if (themeColor) themeColor.content = theme === 'dark' ? '#161619' : '#f6f2ea';
  const label = `切换到${theme === 'dark' ? '浅' : '深'}色模式`;
  themeButton?.setAttribute('aria-label', label);
  themeButton?.setAttribute('title', label);
}

applyTheme(document.documentElement.dataset.theme!);

themeButton?.addEventListener('click', () => {
  const theme =
    document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', theme);
  } catch {}
  applyTheme(theme);
});

systemTheme.addEventListener('change', ({ matches }) => {
  if (!['light', 'dark'].includes(storedTheme() ?? ''))
    applyTheme(matches ? 'dark' : 'light');
});

window.addEventListener('storage', ({ key }) => {
  if (key !== 'theme') return;
  const preference = storedTheme();
  applyTheme(
    preference === 'light' || preference === 'dark'
      ? preference
      : systemTheme.matches
        ? 'dark'
        : 'light',
  );
});

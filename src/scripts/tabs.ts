/*
 * Tab groups written as consecutive `> [!TAB] 名字` quotes. Choosing a label
 * switches every group on the page that has the same label, and the choice is
 * remembered, so a reader who picks Python keeps seeing Python.
 */
const STORAGE_KEY = 'tabs';
const groups = [...document.querySelectorAll<HTMLElement>('.prose .tabs')];

function tabsOf(group: HTMLElement): HTMLButtonElement[] {
  return [
    ...group.querySelectorAll<HTMLButtonElement>(
      ':scope > .tabs-list > [role="tab"]',
    ),
  ];
}

function select(group: HTMLElement, chosen: HTMLButtonElement): void {
  for (const tab of tabsOf(group)) {
    const selected = tab === chosen;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')!)!.hidden =
      !selected;
  }
}

function label(tab: HTMLElement): string {
  return tab.textContent!.trim();
}

function choose(name: string, origin?: HTMLElement): void {
  // Keep the clicked tab where it is while groups above it change height.
  const top = origin?.getBoundingClientRect().top;
  for (const group of groups) {
    const match = tabsOf(group).find((tab) => label(tab) === name);
    if (match) select(group, match);
  }
  if (origin && top !== undefined)
    scrollBy({
      top: origin.getBoundingClientRect().top - top,
      behavior: 'instant',
    });
  // Formulas and diagrams inside a panel were measured while it was hidden.
  dispatchEvent(new Event('resize'));
}

function remembered(): string[] {
  try {
    const names = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(names) ? names : [];
  } catch {
    return [];
  }
}

function remember(name: string): void {
  const names = [name, ...remembered().filter((other) => other !== name)];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names.slice(0, 12)));
  } catch {
    // Private windows may refuse storage; the choice then lasts for this page.
  }
}

for (const group of groups) {
  const tabs = tabsOf(group);
  for (const tab of tabs)
    document.getElementById(tab.getAttribute('aria-controls')!)!.dataset.label =
      label(tab);
  group.addEventListener('click', (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '[role="tab"]',
    );
    if (!tab || tab.parentElement!.parentElement !== group) return;
    choose(label(tab), tab);
    remember(label(tab));
  });
  group
    .querySelector(':scope > .tabs-list')!
    .addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key;
      const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        key === 'ArrowRight'
          ? (current + 1) % tabs.length
          : key === 'ArrowLeft'
            ? (current - 1 + tabs.length) % tabs.length
            : key === 'Home'
              ? 0
              : key === 'End'
                ? tabs.length - 1
                : -1;
      if (current < 0 || next < 0) return;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    });
}

// Oldest first, so the most recent choice wins where two apply to one group.
if (groups.length) for (const name of remembered().reverse()) choose(name);

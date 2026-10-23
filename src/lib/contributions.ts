interface ContributionDay {
  date: string;
  level: number;
  count: number;
}

// GitHub serves the profile calendar as an HTML fragment: one cell per day
// carrying its date and colour level, and a tooltip per cell with the count.
function parseCalendar(html: string): ContributionDay[] {
  const counts = new Map(
    [
      ...html.matchAll(
        /<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([\d,]+|No) contributions?/g,
      ),
    ].map(([, id, count]) => [
      id,
      count === 'No' ? 0 : Number(count.replaceAll(',', '')),
    ]),
  );
  return [...html.matchAll(/<td\b[^>]*\bdata-date="[^>]*>/g)]
    .map(([cell]) => {
      const attribute = (name: string) =>
        cell.match(new RegExp(`\\b${name}="([^"]*)"`))![1];
      return {
        date: attribute('data-date'),
        level: Number(attribute('data-level')),
        count: counts.get(attribute('id')) ?? 0,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

// Weeks run in columns from Sunday to Saturday, like the calendar on GitHub.
export async function getContributionCalendar(user: string) {
  let days: ContributionDay[];
  try {
    const response = await fetch(
      `https://github.com/users/${user}/contributions`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) return;
    days = parseCalendar(await response.text());
  } catch {
    // Offline builds leave the calendar out.
    return;
  }
  if (!days.length) return;

  const offset = new Date(days[0].date).getUTCDay();
  const weekOf = (index: number) => Math.floor((offset + index) / 7);
  const weeks = weekOf(days.length - 1) + 1;
  return {
    days,
    offset,
    weeks,
    months: days.flatMap(({ date }, index) =>
      date.endsWith('-01') && weekOf(index) < weeks - 2
        ? [{ week: weekOf(index), label: `${Number(date.slice(5, 7))}月` }]
        : [],
    ),
    total: days.reduce((sum, { count }) => sum + count, 0),
  };
}

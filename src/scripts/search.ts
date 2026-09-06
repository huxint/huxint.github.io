interface ResultContent {
  url: string;
  meta: { title: string };
  excerpt: string;
}
interface SearchResult {
  data(): Promise<ResultContent>;
}
interface SearchIndex {
  search(query: string): Promise<{ results: SearchResult[] }>;
}

const form = document.querySelector<HTMLFormElement>('.search-form')!;
const input = document.querySelector<HTMLInputElement>('#search-input')!;
const searchStatus = document.querySelector<HTMLElement>('.search-status')!;
const list = document.querySelector<HTMLOListElement>('.search-results')!;
const moreButton = document.querySelector<HTMLButtonElement>('.more-results')!;
const indexPath = '/pagefind/pagefind.js';
let indexPromise: Promise<SearchIndex> | undefined;
let requestId = 0;
let debounceTimer: ReturnType<typeof setTimeout>;
let composing = false;
let results: SearchResult[] = [];
let renderedCount = 0;

function renderResult(result: ResultContent): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'search-result';
  const heading = document.createElement('h2');
  const link = document.createElement('a');
  link.href = result.url;
  link.textContent = result.meta.title;
  heading.append(link);
  const excerpt = document.createElement('p');
  excerpt.innerHTML = result.excerpt;
  item.append(heading, excerpt);
  return item;
}

async function showMore(id: number): Promise<void> {
  moreButton.disabled = true;
  const batch = await Promise.all(
    results
      .slice(renderedCount, renderedCount + 10)
      .map((result) => result.data()),
  );
  if (id !== requestId) return;
  list.append(...batch.map(renderResult));
  renderedCount += batch.length;
  moreButton.hidden = renderedCount >= results.length;
  moreButton.disabled = false;
}

function clearResults(): void {
  list.replaceChildren();
  moreButton.hidden = true;
  moreButton.disabled = false;
  results = [];
  renderedCount = 0;
}

async function search(): Promise<void> {
  const query = input.value.trim();
  const id = ++requestId;
  const url = new URL(location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);
  clearResults();

  if (!query) {
    searchStatus.textContent = '输入关键词开始搜索。';
    return;
  }

  searchStatus.textContent = '正在查找…';
  try {
    indexPromise ??= import(
      /* @vite-ignore */ indexPath
    ) as Promise<SearchIndex>;
    const index = await indexPromise;
    const response = await index.search(query);
    if (id !== requestId) return;
    results = response.results;
    await showMore(id);
    if (id !== requestId) return;
    searchStatus.textContent = results.length
      ? `找到 ${results.length} 篇文章`
      : `没有找到与「${query}」相关的文章，试试更短的关键词。`;
  } catch {
    if (id !== requestId) return;
    indexPromise = undefined;
    searchStatus.textContent =
      '搜索暂时不可用，请刷新页面重试，或按标签浏览文章。';
  }
}

function scheduleSearch(): void {
  clearTimeout(debounceTimer);
  // Invalidate responses as soon as the input changes, including during IME composition.
  requestId++;
  clearResults();
  if (composing) {
    searchStatus.textContent = '输入完成后开始搜索。';
    return;
  }
  if (!input.value.trim()) {
    void search();
    return;
  }
  searchStatus.textContent = '正在查找…';
  debounceTimer = setTimeout(() => void search(), 180);
}

input.addEventListener('compositionstart', () => {
  composing = true;
  scheduleSearch();
});
input.addEventListener('compositionend', () => {
  composing = false;
  scheduleSearch();
});
input.addEventListener('input', scheduleSearch);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(debounceTimer);
  if (!composing) void search();
});
moreButton.addEventListener('click', () => {
  const id = requestId;
  void showMore(id).catch(() => {
    if (id !== requestId) return;
    searchStatus.textContent = '加载结果失败，请重试。';
    moreButton.disabled = false;
  });
});

input.value = new URL(location.href).searchParams.get('q') ?? '';
if (input.value.trim()) void search();

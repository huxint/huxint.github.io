import { expect, test, type Route } from '@playwright/test';

test('搜索只返回文章，清空关键词后重置结果和地址', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '搜索文章', exact: true }).click();
  const input = page.getByRole('searchbox');
  await expect(page.getByRole('status')).toHaveText('输入关键词开始搜索。');

  // The fixture article and the project page both contain this keyword.
  await input.fill('Orangutan');
  await expect(page.getByRole('status')).toHaveText('找到 1 篇文章');
  await expect(page.locator('.search-results a')).toHaveCount(1);
  await expect(page.locator('.search-results a')).toHaveAttribute(
    'href',
    '/posts/reader/',
  );

  await input.fill('');
  await expect(page.locator('.search-results li')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('输入关键词开始搜索。');
  await expect(page).toHaveURL('/search/');
});

test('输入法组词期间不显示已过期的搜索响应', async ({ page }) => {
  await page.clock.install();
  await page.route('**/pagefind/pagefind.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export async function search() {
      const response = await fetch('/search-response.json');
      const result = await response.json();
      return { results: [{ data: async () => result }] };
    }`,
    }),
  );
  let holdResponse!: (route: Route) => void;
  const pendingResponse = new Promise<Route>((resolve) => {
    holdResponse = resolve;
  });
  await page.route('**/search-response.json', holdResponse);
  await page.goto('/search/?q=initial');
  const response = await pendingResponse;

  const input = page.getByRole('searchbox');
  await input.dispatchEvent('compositionstart');
  await input.fill('新');
  const delivered = page.waitForResponse('**/search-response.json');
  await response.fulfill({
    json: {
      url: '/posts/search-result/',
      meta: { title: '已过期的结果' },
      excerpt: '用于验证搜索响应顺序的示例数据',
    },
  });
  await (await delivered).finished();

  await expect(page.locator('.search-results li')).toHaveCount(0);
  await expect(input).toHaveValue('新');
});

test('搜索索引加载失败时显示错误状态', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.abort());
  await page.goto('/search/?q=example');
  await expect(page.getByRole('status')).toContainText('搜索暂时不可用');
  await expect(page.getByRole('status')).not.toContainText('没有找到');
});

test('没有匹配结果时显示空状态', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'export async function search() { return { results: [] }; }',
    }),
  );
  await page.goto('/search/?q=example');
  await expect(page.getByRole('status')).toContainText('没有找到');
  await expect(page.locator('.search-results li')).toHaveCount(0);
});

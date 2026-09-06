import { expect, test, type Route } from '@playwright/test';

test('输入法正在组词时，较慢的旧搜索响应不会显示过期结果', async ({ page }) => {
  await page.clock.install();
  await page.route('**/pagefind/pagefind.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export async function search() {
      const response = await fetch('/search-response.json');
      const article = await response.json();
      return { results: [{ data: async () => article }] };
    }`,
    }),
  );
  let holdResponse!: (route: Route) => void;
  const pendingResponse = new Promise<Route>((resolve) => {
    holdResponse = resolve;
  });
  await page.route('**/search-response.json', holdResponse);
  await page.goto('/search/?q=注意力');
  const response = await pendingResponse;

  const input = page.getByRole('searchbox');
  await input.dispatchEvent('compositionstart');
  await input.fill('素');
  const delivered = page.waitForResponse('**/search-response.json');
  await response.fulfill({
    json: {
      url: '/posts/transformer/',
      meta: { title: 'Transformer：理解 Attention Is All You Need' },
      excerpt: '注意力机制',
    },
  });
  await (await delivered).finished();
  await page.clock.runFor(1000);

  await expect(page.locator('.search-results li')).toHaveCount(0);
  await expect(input).toHaveValue('素');
});

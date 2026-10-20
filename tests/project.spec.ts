import { expect, test } from '@playwright/test';

test('项目页可以直接打开，并且有自己的标题与页内导航', async ({ page }) => {
  await page.goto('/projects/orangutan/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orangutan');
  await expect(
    page.getByRole('navigation', { name: '页内导航' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主导航' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'GitHub 仓库' })).toHaveAttribute(
    'href',
    'https://github.com/huxint/orangutan',
  );
});

test('项目页可被索引，站点地图收录它且元数据不标为文章', async ({ page }) => {
  const sitemap = await page.request.get('/sitemap-0.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain(
    'https://huxint.github.io/projects/orangutan/',
  );

  await page.goto('/projects/orangutan/');
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).toHaveCount(0);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    'content',
    'website',
  );
  const structuredData = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(structuredData.join('\n')).not.toContain('BlogPosting');
});

import { expect, test } from '@playwright/test';

test('主导航可以打开各个站点页面', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  for (const [name, path] of [
    ['关于', '/about/'],
    ['文章', '/'],
  ]) {
    await navigation.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      navigation.getByRole('link', { name, exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  }
});

test('文章列表链接可以打开对应的阅读页面', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('.post-title a').first();
  const title = (await link.innerText()).trim();
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^\/posts\/.+\/$/);

  await link.click();

  await expect(page).toHaveURL(href!);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.locator('.prose')).toBeVisible();
});

test('主题选择覆盖系统偏好并跨页面保留', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '关于', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('搜索能找到当前文章，并能清空结果', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('.post-title a').first();
  const title = (await link.innerText()).trim();
  const href = await link.getAttribute('href');
  await page.getByRole('link', { name: '搜索文章', exact: true }).click();
  const input = page.getByRole('searchbox');
  await expect(page.getByRole('status')).toHaveText('输入关键词开始搜索。');

  await input.fill(title);
  await expect(
    page
      .locator('.search-results')
      .getByRole('link', { name: title, exact: true }),
  ).toHaveAttribute('href', href!);

  await input.fill('');
  await expect(page.locator('.search-results li')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('输入关键词开始搜索。');
  await expect(page).toHaveURL('/search/');
});

test('手机视口下首页没有横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
});

test('不存在的地址返回 404 并提供返回入口', async ({ page }) => {
  const response = await page.goto('/__missing-page-for-site-test__/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '页面未找到',
  );
  await page.getByRole('link', { name: '← 返回文章列表', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.post-title a').first()).toBeVisible();
});

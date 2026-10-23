import { expect, test } from '@playwright/test';

test('主导航可以打开各个站点页面', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  for (const [name, path] of [
    ['生活', '/life/'],
    ['项目', '/projects/'],
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

test('手机视口下页面没有横向溢出', async ({ page }) => {
  await page.route(
    'https://raw.githubusercontent.com/huxint/**/HEAD/README.md',
    (route) =>
      route.fulfill({
        contentType: 'text/plain',
        body: '# 项目说明\n\n项目的 README 正文。\n\n| 能力 | 说明 |\n| --- | --- |\n| 任务 | 并行执行 |',
      }),
  );
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of [
    '/',
    '/life/',
    '/tags/',
    '/about/',
    '/projects/',
    '/projects/orangutan-agent/',
    '/projects/nexus/',
  ]) {
    await page.goto(path);
    if (path.startsWith('/projects/') && path !== '/projects/')
      await expect(page.locator('[data-project-readme]')).toHaveAttribute(
        'aria-busy',
        'false',
      );
    await page.evaluate(() => document.fonts.ready);
    const dimensions = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.page, path).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
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

test('标签页可以筛选标签并进入标签详情', async ({ page }) => {
  await page.goto('/tags/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('标签');

  const search = page.getByRole('searchbox');
  await search.fill('FixtureTag');
  await expect(page.getByRole('status')).toHaveText('找到 1 个标签。');
  await expect(page.locator('[data-tag-item]:visible')).toHaveCount(1);

  await page.locator('[data-tag-item]:visible').click();
  await expect(page).toHaveURL('/tags/FixtureTag/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'FixtureTag',
  );
  await expect(
    page.getByRole('navigation', { name: '相邻主题' }),
  ).toBeVisible();
});

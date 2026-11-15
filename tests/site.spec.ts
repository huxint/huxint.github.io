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
  await expect(page.locator('main img.sticker')).toHaveAttribute(
    'src',
    '/stickers/confused.svg',
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

test('文章末尾链接到前后两篇', async ({ page }) => {
  await page.goto('/posts/reader/');
  const pager = page.getByRole('navigation', { name: '前后文章' });
  await expect(pager.getByRole('link')).toHaveCount(1);
  const newer = pager.getByRole('link', { name: /较新/ });
  await expect(newer).toContainText('Sticker Fixture');
  await expect(newer.locator('img.sticker')).toHaveAttribute('alt', '笑哭');
  await newer.click();

  await expect(page).toHaveURL('/posts/stickers/');
  const older = page
    .getByRole('navigation', { name: '前后文章' })
    .getByRole('link', { name: /较早/ });
  await expect(older).toContainText('Fixture Reader');
  await expect(older).toHaveAttribute('rel', 'next');
});

test('斜杠键聚焦本页的筛选框，没有时打开搜索', async ({ page }) => {
  await page.goto('/tags/');
  await page.keyboard.press('/');
  const filter = page.getByRole('searchbox');
  await expect(filter).toBeFocused();
  // While typing, the key is a character.
  await page.keyboard.type('a/b');
  await expect(filter).toHaveValue('a/b');
  await expect(page).toHaveURL('/tags/');

  await page.goto('/about/');
  await page.keyboard.press('/');
  await expect(page).toHaveURL('/search/');
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('Ctrl+K 在任何页面打开搜索', async ({ page }) => {
  await page.goto('/tags/');
  await page.getByRole('searchbox').focus();
  await page.keyboard.press('Control+k');
  await expect(page).toHaveURL('/search/');
  await page.getByRole('link', { name: '关于', exact: true }).focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('主题色跟随当前主题', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(themeColor).toHaveAttribute('content', '#f6f2ea');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await expect(themeColor).toHaveAttribute('content', '#161619');
  await page.reload();
  await expect(themeColor).toHaveAttribute('content', '#161619');
});

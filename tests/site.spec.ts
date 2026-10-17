import { expect, test } from '@playwright/test';

test('主导航可以打开各个站点页面', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  for (const [name, path] of [
    ['生活', '/life/'],
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

test('手机视口下页面没有横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/', '/life/', '/tags/']) {
    await page.goto(path);
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

test('窄屏文章里的公式自适应阅读栏，不出现横向滚动条', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of [
    '/posts/transformer/',
    '/posts/p1253/',
    '/posts/sparse-table/',
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);

    const displayFormula = page.locator('.katex-display').first();
    await expect(displayFormula, path).toBeVisible();

    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [
              ...document.querySelectorAll<HTMLElement>(
                '.katex-display, .math-inline',
              ),
            ]
              .filter((formula) =>
                formula.classList.contains('katex-display')
                  ? formula.scrollWidth > formula.clientWidth + 1
                  : ['auto', 'scroll'].includes(
                      getComputedStyle(formula).overflowX,
                    ),
              )
              .map((formula) => formula.textContent?.slice(0, 40)),
          ),
        { message: path },
      )
      .toEqual([]);

    const dimensions = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.page, path).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});

test('标签页可以筛选标签并进入标签详情', async ({ page }) => {
  await page.goto('/tags/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('标签');

  const search = page.getByRole('searchbox');
  await search.fill('数论');
  await expect(page.getByRole('status')).toHaveText('找到 1 个标签。');
  await expect(page.locator('[data-tag-item]:visible')).toHaveCount(1);

  await page.locator('[data-tag-item]:visible').click();
  await expect(page).toHaveURL(/\/tags\/.+\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('数论');
  await expect(
    page.getByRole('navigation', { name: '相邻主题' }),
  ).toBeVisible();
});

test('文章正文支持提示框、行内强调、脚注预览和 Mermaid', async ({ page }) => {
  await page.goto('/posts/cpp-memory/');
  await page.evaluate(() => document.fonts.ready);

  await expect(page.locator('.prose .callout')).toHaveCount(3);
  await expect(page.locator('.prose mark').first()).toBeVisible();
  await expect(page.locator('.prose u').first()).toBeVisible();

  const callout = page.locator('.prose .callout').first();
  await expect(callout.locator('.callout-symbol')).toHaveCount(1);
  const calloutColors = await page
    .locator('.callout-title')
    .evaluateAll((titles) =>
      titles.map((title) => getComputedStyle(title).color),
    );
  expect(new Set(calloutColors).size).toBe(3);

  const diagram = page.locator('.mermaid-figure').first();
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram).toBeVisible();
  await expect(diagram.locator('svg')).toBeVisible({ timeout: 15000 });
  expect(await diagram.locator('.node').count()).toBeGreaterThan(0);

  const footnote = page.locator('.prose sup a').first();
  await footnote.scrollIntoViewIfNeeded();
  await footnote.hover();
  await expect(page.locator('.footnote-popover')).toHaveClass(/is-visible/);
});

test('文章目录点击后立即定位并高亮目标', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/posts/meituan-exam/');
  await page.evaluate(() => document.fonts.ready);

  const toc = page.locator('.toc-sidebar');
  await toc.getByRole('link', { name: '代码', exact: true }).click();

  await expect(toc.locator('[aria-current="location"]')).toHaveText('代码');
  await expect
    .poll(async () =>
      page.locator('#代码').evaluate((heading) => {
        const top = heading.getBoundingClientRect().top;
        return top >= 0 && top <= 160;
      }),
    )
    .toBe(true);
});

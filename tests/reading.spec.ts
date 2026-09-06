import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const transformerTitle = 'Transformer：理解 Attention Is All You Need';
const millerTitle = '米勒–拉宾素性测试：从原理到 64 位实现';

test('公式在禁用 JavaScript 时仍有可读的排版和 MathML', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL + '/posts/transformer/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    transformerTitle,
  );
  await expect(
    page.locator('.katex-display .katex-html').first(),
  ).toBeVisible();
  await expect(page.locator('.katex-display math').first()).toHaveAttribute(
    'display',
    'block',
  );
  await expect(page.locator('.katex-display annotation').first()).toContainText(
    'p(y',
  );
  await context.close();
});

test('手机上的长公式在自身区域滚动，正文保持在视口内', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/posts/transformer/');
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    formulas: [...document.querySelectorAll<HTMLElement>('.katex-display')].map(
      (formula) => ({
        width: formula.clientWidth,
        content: formula.scrollWidth,
        overflow: getComputedStyle(formula).overflowX,
      }),
    ),
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  const wideFormula = dimensions.formulas.find(
    (formula) => formula.content > formula.width + 20,
  );
  expect(
    wideFormula,
    'The article includes a formula wider than a phone screen.',
  ).toBeDefined();
  expect(wideFormula?.overflow).toBe('auto');
  await expect(page.locator('.mobile-toc')).toBeVisible();
});

test('代码复制保留完整程序和尖括号', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/posts/miller-rabin/');
  await page.evaluate(() => navigator.clipboard.writeText(''));
  const article = readFileSync(
    'src/content/posts/miller-rabin/index.md',
    'utf8',
  );
  const source = article.match(
    /~~~cpp title="miller-rabin\.cpp"\n([\s\S]*?)\n~~~/,
  )![1];
  await page.locator('.expressive-code .copy button').click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(source);
});

test('中文全文搜索随关键词变化更新，并能清空结果', async ({ page }) => {
  await page.goto('/search/');
  const input = page.getByRole('searchbox');
  await input.fill('注意力');
  await expect(page.locator('.search-results a')).toHaveText([
    transformerTitle,
  ]);
  await expect(page.locator('.search-results a')).toHaveAttribute(
    'href',
    '/posts/transformer/',
  );
  await input.fill('素数');
  await expect(page.locator('.search-results a')).toHaveText([millerTitle]);
  await input.fill('并不存在的关键词xyz');
  await expect(page.getByRole('status')).toContainText('没有找到');
  await expect(page.locator('.search-results li')).toHaveCount(0);
  await input.fill('');
  await expect(page.getByRole('status')).toHaveText('输入关键词开始搜索。');
  await expect(page).toHaveURL('/search/');
});

test('搜索索引加载失败时显示错误，而非无结果', async ({ page }) => {
  await page.route('**/pagefind/pagefind.js', (route) => route.abort());
  await page.goto('/search/?q=注意力');
  await expect(page.getByRole('status')).toContainText('搜索暂时不可用');
  await expect(page.getByRole('status')).not.toContainText('没有找到');
});

test('手动主题选择覆盖系统偏好并跨页面保留', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('link', { name: '项目', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('图片可用键盘放大，Escape 关闭后焦点回到原图', async ({ page }) => {
  await page.goto('/posts/transformer/');
  const trigger = page.getByRole('button', { name: /^放大图片/ }).first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '图片预览' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveJSProperty('complete', true);
  await expect(dialog.locator('img')).toHaveAttribute('alt', /编码器与解码器/);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('草稿不会出现在发布页面或 RSS 中，直接访问也不可用', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.locator('.post-list')).not.toContainText(
    'Markdown 排版样例',
  );
  const feed = await request.get('/rss.xml');
  expect(feed.ok()).toBe(true);
  expect(await feed.text()).not.toContain('writing-sample');
  const draft = await request.get('/posts/writing-sample/');
  expect(draft.status()).toBe(404);
});

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/posts/reader/');
});

test('目录点击后定位并高亮目标', async ({ page }) => {
  await page.evaluate(() => document.fonts.ready);
  const toc = page.locator('.toc-sidebar');
  await toc.getByRole('link', { name: 'Target section', exact: true }).click();

  await expect(toc.locator('[aria-current="location"]')).toHaveText(
    'Target section',
  );
  await expect
    .poll(() =>
      page.locator('#target-section').evaluate((heading) => {
        const top = heading.getBoundingClientRect().top;
        return top >= 0 && top <= 160;
      }),
    )
    .toBe(true);
});

test('公式自适应桌面和窄屏，编号与正文保持间距', async ({ page }) => {
  const shortInline = page.locator('.prose u .math-inline');
  const wideInline = page.locator('.prose p > .math-inline');
  await expect(shortInline).toHaveCount(1);
  await expect(wideInline).toHaveCount(1);
  await expect(page.locator('.katex-display')).toHaveCount(2);

  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await expect(shortInline).not.toHaveClass(/math-inline-block/);
    if (width <= 390) {
      await expect(wideInline).toHaveClass(/math-inline-block/);
    }
    await expect
      .poll(() =>
        page
          .locator('.katex-display, .math-inline')
          .evaluateAll((formulas) =>
            formulas
              .filter(
                (formula) => formula.scrollWidth > formula.clientWidth + 1,
              )
              .map((formula) => formula.textContent),
          ),
      )
      .toEqual([]);

    const formula = page.locator('.math-numbered');
    await expect(formula.locator('.tag')).toHaveText('(1)');
    await expect
      .poll(() =>
        formula.evaluate((element) => {
          const body = element
            .querySelector('.math-body')!
            .getBoundingClientRect();
          const tag = element.querySelector('.tag')!.getBoundingClientRect();
          const frame = element.getBoundingClientRect();
          return (
            body.right + 12 <= tag.left &&
            body.left >= frame.left - 1 &&
            tag.right <= frame.right + 1
          );
        }),
      )
      .toBe(true);

    const dimensions = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
});

test('diff 合并重复上下文并标记真正改动的代码', async ({ page }) => {
  const diff = page.locator('.expressive-code pre[data-language="diff"]');
  await expect(diff.locator('.ec-line:not(.ins):not(.del) .code')).toHaveText([
    'const keep = true;',
    'const name = "same";',
  ]);
  await expect(diff.locator('.ec-line.del .code')).toHaveText(
    'const answer = 1;',
  );
  await expect(diff.locator('.ec-line.ins .code')).toHaveText([
    'const answer = 2;',
    'const added = true;',
  ]);
  await expect(diff.locator('.ec-line.del .code')).toHaveCSS(
    'text-decoration-line',
    'line-through',
  );
  await expect(diff.locator('.ec-line.del .diff-word')).toHaveText('1');
  await expect(
    diff.locator('.ec-line.ins').first().locator('.diff-word'),
  ).toHaveText('2');
});

test('Mermaid 渲染图表并隐藏源码', async ({ page }) => {
  const diagram = page.locator('.mermaid-figure');
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram.locator('svg')).toBeVisible({ timeout: 15000 });
  await expect(diagram.locator('.node')).toHaveCount(2);
  await expect(diagram.locator('.mermaid-source')).toBeHidden();
});

test('SVG 绘图块显示可访问的图示', async ({ page }) => {
  const figure = page.locator('.render-block[data-renderer="svg"]');
  await figure.scrollIntoViewIfNeeded();
  await expect(figure.getByRole('img', { name: 'Fixture SVG' })).toBeVisible();
});

test('提示块显示各自类型的标签', async ({ page }) => {
  const titles = page.locator('.prose .callout-title');
  await expect(titles).toHaveText(['说明', '建议', '重点', '警告', '注意']);
});

test('行内标记渲染高亮与下划线', async ({ page }) => {
  await expect(page.locator('.prose mark')).toHaveText('Highlighted text');
  const underline = page
    .locator('.prose u')
    .filter({ hasText: 'underlined text' });
  await expect(underline).toHaveText('underlined text');
  await expect(underline).toHaveCSS('text-decoration-line', 'underline');
});

test('脚注提供内容预览和返回正文的链接', async ({ page }) => {
  const footnote = page.locator('.prose [data-footnote-ref]');
  await footnote.scrollIntoViewIfNeeded();
  await footnote.hover();
  const preview = page.getByRole('tooltip');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Fixture footnote content.');
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();

  await page.getByRole('link', { name: '返回正文', exact: true }).click();
  await expect(page).toHaveURL(/#user-content-fnref-fixture$/);
});

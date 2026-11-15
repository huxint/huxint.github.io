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
  const wideInline = page.locator('.prose > p > .math-inline');
  await expect(shortInline).toHaveCount(1);
  await expect(wideInline).toHaveCount(1);
  await expect(page.locator('.katex-display:not(.html-math *)')).toHaveCount(2);

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

test('文章图片在查看器里放大，可以切到下一张', async ({ page }) => {
  await page.getByRole('button', { name: '放大图片：Fixture figure' }).click();

  const viewer = page.locator('#image-viewer');
  const caption = viewer.locator('.image-viewer-caption');
  await expect(viewer).toBeVisible();
  await expect(caption).toHaveText('Fixture caption');
  await expect(viewer.locator('.image-viewer-count')).toHaveText('1 / 2');

  await page.keyboard.press('ArrowRight');
  await expect(caption).toHaveText('Second figure');
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('提示块显示各自类型的标签', async ({ page }) => {
  const titles = page.locator('.prose .callout-title');
  await expect(titles).toHaveText([
    '说明',
    '建议',
    '重点',
    '警告',
    '注意',
    /^定理Folded/,
  ]);
});

test('带标题的提示块可以折叠', async ({ page }) => {
  const fold = page.locator('.prose details.callout');
  await expect(fold.locator('.callout-name .katex')).toHaveCount(1);
  await expect(fold.getByText('Folded body.')).toBeHidden();
  await fold.locator('summary').click();
  await expect(fold.getByText('Folded body.')).toBeVisible();
});

test('同名标签页联动并记住选择', async ({ page }) => {
  const groups = page.locator('.prose .tabs');
  await expect(groups).toHaveCount(2);
  await expect(page.getByText('Alpha panel.')).toBeVisible();
  await expect(page.getByText('Second beta.')).toBeVisible();
  await groups.first().getByRole('tab', { name: 'Beta' }).click();
  await expect(page.getByText('Alpha panel.')).toBeHidden();
  await expect(groups.first().locator('.tabs-panel .katex')).toBeVisible();
  await groups.first().getByRole('tab', { name: 'Beta' }).press('ArrowLeft');
  await expect(page.getByText('Second alpha.')).toBeVisible();
  await expect(page.getByText('Second beta.')).toBeHidden();
  await page.reload();
  await expect(page.getByText('Alpha panel.')).toBeVisible();
  await expect(page.getByText('Second alpha.')).toBeVisible();
});

test('HTML 里的公式和正文公式一样渲染', async ({ page }) => {
  const block = page.locator('.prose .html-math');
  await expect(block.locator('.math-inline')).toHaveCount(1);
  await expect(block.locator('.katex-display')).toHaveCount(1);
  await expect(block.locator('p')).toContainText('costs $5 and $n$ stays.');

  const frame = page
    .locator('.render-block', { hasText: 'Fixture math frame' })
    .frameLocator('iframe');
  await expect(frame.locator('#static .math-inline .katex')).toHaveCount(2);
  await expect(frame.locator('#dynamic .math-display .katex')).toHaveCount(1);
  await expect(frame.locator('code')).toHaveText('$raw$');
  await expect
    .poll(() =>
      frame
        .locator('body')
        .evaluate(() =>
          [...document.fonts].some(
            (font) => font.family === 'KaTeX_Size2' && font.status === 'loaded',
          ),
        ),
    )
    .toBe(true);
});

test('行内标记渲染高亮与下划线', async ({ page }) => {
  await expect(page.locator('.prose mark')).toHaveText('Highlighted text');
  const underline = page
    .locator('.prose u')
    .filter({ hasText: 'underlined text' });
  await expect(underline).toHaveText('underlined text');
  await expect(underline).toHaveCSS('text-decoration-line', 'underline');
  await expect(
    page.getByText('C++ drafts and C++20 keep their pluses.'),
  ).toBeVisible();
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

test('没有公式的 HTML 块不加载公式脚本', async ({ page }) => {
  const frame = (title: string) =>
    page.locator('.render-block', { hasText: title }).locator('iframe');
  // A regex replacement and a template literal use dollars of their own.
  const plain = frame('Fixture plain frame');
  await expect(plain.contentFrame().locator('#plain')).toHaveText(
    'value key costs',
  );
  const size = (target: typeof plain) =>
    target.evaluate((element) => (element as HTMLIFrameElement).srcdoc.length);
  expect(await size(frame('Fixture math frame'))).toBeGreaterThan(
    (await size(plain)) + 200_000,
  );
});

test('标题悬停时出现指向自己的链接', async ({ page }) => {
  const heading = page.locator('.prose h2#target-section');
  const anchor = heading.locator('.heading-anchor');
  await expect(anchor).toHaveAttribute('href', '#target-section');
  await expect(anchor).toHaveCSS('opacity', '0');
  await heading.hover();
  await expect(anchor).toHaveCSS('opacity', '1');
  // The link is a pointer aid; it stays out of the heading's name.
  await expect(anchor).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.footnotes .heading-anchor')).toHaveCount(0);
});

test.describe('复制', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('复制带公式的文字得到 LaTeX 源码', async ({ page }) => {
    await page
      .locator('.prose p', { hasText: 'An underlined formula' })
      .evaluate((paragraph) => {
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        const selection = getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      });
    await page.keyboard.press('ControlOrMeta+C');
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('An underlined formula: $a^2+b^2=c^2$.');
  });
});

import { expect, test } from '@playwright/test';

test('生活页列出记录，日期链接打开单条页面', async ({ page }) => {
  await page.goto('/life/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('生活');
  const link = page.locator('.moment .moment-aside a').first();
  test.skip((await link.count()) === 0, '没有生活记录');
  const href = await link.getAttribute('href');
  expect(href).toMatch(/^\/life\/.+\/$/);

  await link.click();

  await expect(page).toHaveURL(href!);
  await expect(page.locator('.moment')).toHaveCount(1);
  await expect(page.getByRole('link', { name: '← 所有记录' })).toBeVisible();
});

test('正文里的图片段落变成媒体行，点击后在灯箱里放大', async ({ page }) => {
  await page.goto('/life/');
  const trigger = page.locator('.moment-cell.is-image .moment-open').first();
  test.skip((await trigger.count()) === 0, '没有照片');
  const image = trigger.locator('img');
  await expect(image).toHaveAttribute('srcset', /\d+w/);
  const largest = await image.evaluate(
    (element: HTMLImageElement) =>
      element.srcset
        .split(',')
        .map((candidate) => candidate.trim().split(/\s+/))
        .sort(
          (left, right) => parseFloat(right[1]) - parseFloat(left[1]),
        )[0][0],
  );

  await trigger.click();

  const viewer = page.locator('#life-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('.life-viewer-frame img')).toHaveAttribute(
    'src',
    largest,
  );
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('实况悬停时播放、离开后停止，角标按钮可以切换', async ({ page }) => {
  await page.goto('/life/');
  const live = page.locator('[data-live-photo]').first();
  test.skip((await live.count()) === 0, '没有实况');
  const video = live.locator('video');
  const paused = () =>
    video.evaluate((element: HTMLVideoElement) => element.paused);

  await live.hover();
  await expect(live).toHaveClass(/is-playing/);
  await expect.poll(paused).toBe(false);

  await page.mouse.move(0, 0);
  await expect(live).not.toHaveClass(/is-playing/);
  await expect.poll(paused).toBe(true);

  const badge = live.locator('[data-live-toggle]');
  await badge.focus();
  await page.keyboard.press('Enter');
  await expect(live).toHaveClass(/is-playing/);
  await expect(badge).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(live).not.toHaveClass(/is-playing/);
  await expect(badge).toHaveAttribute('aria-pressed', 'false');
});

test('触屏长按播放实况，松开后停止且不会打开灯箱', async ({ page }) => {
  await page.goto('/life/');
  const live = page.locator('[data-live-photo]').first();
  test.skip((await live.count()) === 0, '没有实况');
  const touch = { pointerType: 'touch', isPrimary: true };

  await live.dispatchEvent('pointerdown', touch);
  await expect(live).toHaveClass(/is-playing/);

  await live.dispatchEvent('pointerup', touch);
  await live.locator('.moment-open').dispatchEvent('click');
  await expect(live).not.toHaveClass(/is-playing/);
  await expect(page.locator('#life-viewer')).toBeHidden();
});

test('视频先显示封面，点击后播放并出现播放器', async ({ page }) => {
  await page.goto('/life/');
  const cell = page.locator('.moment-cell.is-video').first();
  test.skip((await cell.count()) === 0, '没有视频');
  const video = cell.locator('video');
  await expect(video).toHaveAttribute(
    'src',
    /^\/life\/[^/]+\/.+\.(?:mp4|webm|mov)$/,
  );
  const response = await page.request.get((await video.getAttribute('src'))!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^video\//);
  await expect(video).not.toBeInViewport();
  await expect(cell.locator('.video-duration')).toHaveText(/^\d+:\d{2}$/);

  await cell.getByRole('button', { name: '播放视频' }).click();

  await expect(cell).toHaveClass(/is-playing/);
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.paused))
    .toBe(false);
});

test('手机视口下生活页没有横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/life/');
  await page.evaluate(() => document.fonts.ready);
  const dimensions = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('公式在桌面和窄屏下完整显示，编号与正文保持间距', async ({ page }) => {
  await page.goto('/posts/writing-sample/');
  await expect(page.locator('.prose u .katex annotation')).toHaveText(
    'a^2+b^2=c^2',
  );
  await expect(page.locator('.prose u').first()).toHaveCSS(
    'text-decoration-line',
    'underline',
  );
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.prose u .math-inline')).not.toHaveClass(
      /math-inline-block/,
    );
    await expect
      .poll(
        () =>
          page.locator('.katex-display').evaluateAll((formulas) =>
            formulas
              .filter(
                (formula) => formula.scrollWidth > formula.clientWidth + 1,
              )
              .map((formula) => ({
                source: formula.querySelector('annotation')!.textContent,
                available: formula.clientWidth,
                actual: formula.scrollWidth,
              })),
          ),
        { message: `${width}px 视口下所有公式均应放在正文宽度内` },
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
  }
});

test('写作样例的 diff 区分上下文和行内改动，Mermaid 直接显示图表', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/posts/writing-sample/');
  const stylesheet = await page
    .locator('.expressive-code link[rel="stylesheet"]')
    .first()
    .getAttribute('href');
  expect((await page.request.get(stylesheet!)).ok()).toBe(true);
  const figure = page.locator('.render-block[data-renderer="svg"]');
  await figure.scrollIntoViewIfNeeded();
  await expect(figure.locator('svg')).toBeVisible();
  const diff = page.locator('.expressive-code pre[data-language="diff"]');
  await expect(diff.locator('.ec-line:not(.ins):not(.del)')).toHaveCount(2);
  await expect(diff.locator('.ec-line.del')).toHaveCount(1);
  await expect(diff.locator('.ec-line.ins')).toHaveCount(2);
  await expect(diff.locator('.ec-line.del .code')).toHaveCSS(
    'text-decoration-line',
    'line-through',
  );
  expect(await diff.locator('.diff-word').count()).toBeGreaterThan(0);

  const diagram = page.locator('.mermaid-figure');
  await diagram.scrollIntoViewIfNeeded();
  await expect(diagram.locator('svg')).toBeVisible({ timeout: 15000 });
  await expect(diagram.locator('.mermaid-source')).toBeHidden();
  const backref = page.getByRole('link', { name: '返回正文', exact: true });
  await expect(backref.locator('svg')).toHaveCount(1);
  await backref.click();
  await expect(page).toHaveURL(/#user-content-fnref-note$/);
  expect(errors).toEqual([]);
});

test('文章正文支持提示框、行内强调、脚注预览和 Mermaid', async ({ page }) => {
  await page.goto('/posts/writing-sample/');
  await page.evaluate(() => document.fonts.ready);

  await expect(page.locator('.prose .callout')).toHaveCount(5);
  await expect(page.locator('.prose mark').first()).toBeVisible();
  await expect(page.locator('.prose u').first()).toBeVisible();

  const callout = page.locator('.prose .callout').first();
  await expect(callout.locator('.callout-symbol')).toHaveCount(1);
  const calloutColors = await page
    .locator('.callout-title')
    .evaluateAll((titles) =>
      titles.map((title) => getComputedStyle(title).color),
    );
  expect(new Set(calloutColors).size).toBe(5);

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

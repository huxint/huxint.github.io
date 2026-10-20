import { expect, test } from '@playwright/test';

test('生活页只显示短预览，点击记录打开完整图文', async ({ page }) => {
  await page.goto('/life/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('生活');
  const link = page.getByRole('link', { name: '2020.01.01 的记录' });
  await expect(link).toHaveAttribute('href', '/life/media/');
  await expect(link.locator('img')).toHaveCount(3);
  await expect(link).toContainText('2 张照片，1 段视频');
  await expect(page.locator('.moment-text, .moment-cell, video')).toHaveCount(
    0,
  );
  await expect(link).not.toContainText(
    'After the video, the record continues.',
  );

  await link.click();

  await expect(page).toHaveURL('/life/media/');
  await expect(page.locator('.moment')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '2020.01.01',
  );
  await expect(page.locator('.moment-text')).toContainText(
    'After the video, the record continues.',
  );
  await expect(page.getByRole('link', { name: '← 所有记录' })).toBeVisible();
});

test('文字、照片、实况和同段视频按写作顺序穿插', async ({ page }) => {
  await page.goto('/life/media/');
  const content = await page.locator('.moment-text').evaluate((element) =>
    [...element.children].map((child) => {
      if (child.tagName === 'P') return child.textContent?.trim();
      return (
        child.querySelector('video[controls]')?.getAttribute('aria-label') ??
        child.querySelector('img')?.alt
      );
    }),
  );
  expect(content).toEqual([
    'A record with a still, a Live Photo, and a video.',
    'Fixture photo',
    'Between the photo and the Live Photo.',
    'Fixture Live Photo',
    'Before the video.',
    'Fixture video',
    'After the video, the record continues.',
  ]);
});

test('正文里的图片段落变成媒体行，点击后在灯箱里放大', async ({ page }) => {
  await page.goto('/life/media/');
  const trigger = page.locator('.moment-cell.is-image .moment-open');
  await expect(trigger).toBeVisible();
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
  await page.goto('/life/media/');
  const live = page.locator('[data-live-photo]');
  await expect(live).toHaveCount(1);
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
  await page.goto('/life/media/');
  const live = page.locator('[data-live-photo]');
  await expect(live).toHaveCount(1);
  const touch = { pointerType: 'touch', isPrimary: true };

  await live.dispatchEvent('pointerdown', touch);
  await expect(live).toHaveClass(/is-playing/);

  await live.dispatchEvent('pointerup', touch);
  await live.locator('.moment-open').dispatchEvent('click');
  await expect(live).not.toHaveClass(/is-playing/);
  await expect(page.locator('#life-viewer')).toBeHidden();
});

test('视频先显示封面，点击后播放并出现播放器', async ({ page }) => {
  await page.goto('/life/media/');
  const cell = page.locator('.moment-cell.is-video');
  await expect(cell).toHaveCount(1);
  const video = cell.locator('video');
  await expect(video).toHaveAttribute('src', '/life/media/clip.webm');
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

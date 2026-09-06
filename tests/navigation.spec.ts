import { expect, test } from '@playwright/test';

test('长文章底部的返回链接把页面滚动到页首', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/posts/transformer/');
  const backToTop = page.getByRole('link', { name: '回到顶部 ↑' });
  await backToTop.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);

  await backToTop.click();

  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
});

test('目录跳转将标题定位到固定导航下方', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/posts/transformer/');
  await page
    .getByRole('navigation', { name: '文章目录' })
    .getByRole('link', { name: '缩放点积注意力', exact: true })
    .click();

  const heading = page.getByRole('heading', {
    name: '缩放点积注意力',
    exact: true,
  });
  await expect
    .poll(() =>
      heading.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThan(130);
  const headerBottom = await page
    .locator('.site-header')
    .evaluate((element) => element.getBoundingClientRect().bottom);
  expect((await heading.boundingBox())!.y).toBeGreaterThan(headerBottom);
});

test('读到文章末尾时，目录标记最后一节', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/posts/transformer/');
  await page.getByRole('link', { name: '回到顶部 ↑' }).scrollIntoViewIfNeeded();

  await expect(
    page
      .getByRole('navigation', { name: '文章目录' })
      .getByRole('link', { name: '参考资料', exact: true }),
  ).toHaveAttribute('aria-current', 'location');
});

test('阅读进度随文章滚动，并在回到页首时归零', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/posts/transformer/');
  const progress = page.locator('.reading-progress span');
  const fraction = () =>
    progress.evaluate(
      (element) =>
        element.getBoundingClientRect().width /
        element.parentElement!.getBoundingClientRect().width,
    );
  await expect(progress).toBeAttached();
  await expect.poll(fraction).toBe(0);

  await page.getByRole('link', { name: '回到顶部 ↑' }).scrollIntoViewIfNeeded();
  await expect.poll(fraction).toBe(1);
  await page.getByRole('link', { name: '回到顶部 ↑' }).click();

  await expect.poll(fraction).toBe(0);
});

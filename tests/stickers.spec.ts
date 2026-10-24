import { chromium, expect, test } from '@playwright/test';
import sharp, { type OutputInfo } from 'sharp';
import { stickers } from '../src/lib/stickers/catalog.mjs';

// The die-cut border fades out well inside the frame, so an opaque pixel on
// the outermost ring means something was cut off there.
function touchesFrame({
  data,
  info,
}: {
  data: Buffer;
  info: OutputInfo;
}): boolean {
  const { width, height, channels } = info;
  const opaque = (x: number, y: number) =>
    data[(y * width + x) * channels + 3] > 128;
  for (let at = 0; at < width; at += 1)
    if (
      opaque(at, 0) ||
      opaque(at, height - 1) ||
      opaque(0, at) ||
      opaque(width - 1, at)
    )
      return true;
  return false;
}

test.describe('正文', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/posts/stickers/');
  });

  test('行内贴纸跟随文字，独占一行的放大', async ({ page, request }) => {
    const inline = page.locator('.prose p:first-of-type img.sticker');
    await expect(inline).toHaveCount(4);
    await expect(inline.first()).toHaveAttribute('alt', '微笑');
    await expect(inline.first()).toHaveAttribute('title', ':smile:');
    await expect(page.locator('.prose mark img.sticker')).toHaveAttribute(
      'alt',
      '喜欢',
    );
    await expect(
      inline.locator('xpath=self::*[contains(@class,"is-large")]'),
    ).toHaveCount(0);

    const rows = page.locator('.prose p.sticker-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('img.sticker.is-large')).toHaveCount(2);
    await expect(rows.nth(1).locator('img.sticker.is-large')).toHaveCount(1);
    await expect(page.locator('.prose figure.article-image')).toHaveCount(0);

    const size = await inline
      .first()
      .evaluate((image) => image.getBoundingClientRect().height);
    const font = await inline
      .first()
      .evaluate((image) => parseFloat(getComputedStyle(image).fontSize));
    expect(size).toBeCloseTo(Math.max(font * 1.5, 38), 0);

    const response = await request.get(
      (await inline.first().getAttribute('src'))!,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
    await expect
      .poll(() =>
        page
          .locator('.prose img.sticker')
          .evaluateAll((images) =>
            images.every(
              (image) => (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
  });

  test('不在表里的名字、时间、代码里的写法保持原样', async ({ page }) => {
    const prose = page.locator('.prose');
    await expect(prose).toContainText('12:30:45');
    await expect(prose).toContainText('std::cout');
    await expect(prose).toContainText(':nope:');
    await expect(prose.locator('p code')).toHaveText(':smile:');
    await expect(prose.locator('pre')).toContainText(':smile:');
    await expect(prose.locator('p code img, pre img')).toHaveCount(0);

    const meme = prose
      .locator('p', { hasText: 'A meme' })
      .locator('img.sticker');
    await expect(meme).toHaveClass(/has-caption/);
    await expect(meme).toHaveAttribute('alt', '笑死');
    expect(
      await meme.evaluate((image) => image.getBoundingClientRect().height),
    ).toBeGreaterThan(60);

    const stray = prose.locator('p', { hasText: 'A stray' });
    await expect(stray).toContainText('A stray :foo');
    await expect(stray.locator('img.sticker')).toHaveAttribute('alt', '大笑');
  });
});

test('标题和描述里的贴纸会渲染，标签页标题、RSS 和搜索里退化为文字', async ({
  page,
  request,
}) => {
  await page.goto('/posts/stickers/');
  await expect(page.locator('h1 img.sticker')).toHaveAttribute('alt', '笑哭');
  await expect(page.locator('.post-description img.sticker')).toHaveAttribute(
    'alt',
    '点赞',
  );
  await expect(page).toHaveTitle(/^Sticker Fixture \[笑哭\] · /);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Titles and descriptions show [点赞] too.',
  );

  await page.goto('/');
  await expect(
    page.locator('.post-title a img.sticker[alt="笑哭"]'),
  ).toBeVisible();

  const rss = await (await request.get('/rss.xml')).text();
  expect(rss).toContain('Sticker Fixture [笑哭]');
  expect(rss).not.toContain(':laugh_cry:');
});

test('生活记录里的贴纸同样生效，预览摘要里写成文字', async ({ page }) => {
  await page.goto('/life/note/');
  const text = page.locator('.moment-text');
  await expect(text.locator('img.sticker')).toHaveCount(2);
  await expect(text.locator('p.sticker-row img.is-large')).toHaveAttribute(
    'alt',
    '哭泣',
  );
  await expect(page.locator('.moment-cell')).toHaveCount(0);

  await page.goto('/life/');
  const preview = page.getByRole('link', { name: '2020.01.02 的记录' });
  await expect(preview).toContainText('A note with a sticker [笑哭]');
});

test.describe('目录页', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('列出全部贴纸，点击复制写法', async ({ page }) => {
    await page.goto('/stickers/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('表情');
    await expect(page.locator('.sticker-card')).toHaveCount(stickers.length);

    const card = page.locator('[data-sticker-code=":love:"]');
    await card.click();
    await expect(card).toContainText('已复制');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      ':love:',
    );
    await expect(card.locator('code')).toHaveText(':love:');
  });
});

test.describe('动画', () => {
  test('独立打开时，减少动态效果的偏好会关掉动画', async ({ browser }) => {
    const animations = async (reducedMotion: 'reduce' | 'no-preference') => {
      const context = await browser.newContext({ reducedMotion });
      const page = await context.newPage();
      await page.goto('/stickers/angry.svg');
      const count = await page.evaluate(() => document.getAnimations().length);
      await context.close();
      return count;
    };
    expect(await animations('reduce')).toBe(0);
    expect(await animations('no-preference')).toBeGreaterThan(0);
  });

  test('任何动画阶段，贴纸都不会被画面边缘裁掉', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 128, height: 128 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const cropped: string[] = [];
    for (const { id } of stickers) {
      await page.goto(`/stickers/${id}.svg`);
      for (const phase of [0, 0.25, 0.5, 0.75]) {
        await page.evaluate((phase) => {
          for (const animation of document.getAnimations()) {
            const { delay = 0, duration = 0 } = animation.effect!.getTiming();
            animation.pause();
            animation.currentTime = delay + phase * Number(duration);
          }
        }, phase);
        const image = await sharp(
          await page.screenshot({ omitBackground: true }),
        )
          .raw()
          .toBuffer({ resolveWithObject: true });
        if (touchesFrame(image)) cropped.push(`${id}@${phase}`);
      }
    }
    await context.close();
    expect(cropped).toEqual([]);
  });

  // The page's own emulation does not reach SVG inside <img>, so this one
  // starts a browser whose system preference is set.
  test('作为图片显示时，系统偏好同样让贴纸静止', async ({ baseURL }) => {
    const settled = async (args: string[]) => {
      const browser = await chromium.launch({ args });
      const page = await browser.newPage();
      await page.goto(`${baseURL}/stickers/`);
      const art = page.locator('[data-sticker-code=":angry:"] img');
      await expect
        .poll(() =>
          art.evaluate((image) => (image as HTMLImageElement).complete),
        )
        .toBe(true);
      await page.mouse.move(0, 0);
      const first = await art.screenshot();
      await page.waitForTimeout(160);
      const second = await art.screenshot();
      await browser.close();
      return first.equals(second);
    };
    expect(await settled(['--force-prefers-reduced-motion'])).toBe(true);
    expect(await settled([])).toBe(false);
  });
});

import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

test('减少动态效果时头像保持静止，方向键仍可旋转并复位', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  const canvas = page.getByRole('img', {
    name: '拿着笔记本的 3D 银背猩猩',
    exact: true,
  });
  await expect(canvas).toBeVisible();
  await canvas.focus();
  const initialView = await canvas.screenshot();

  await page.clock.runFor(2400);
  expect(
    (await canvas.screenshot()).equals(initialView),
    '减少动态效果应停止自动动画',
  ).toBe(true);
  await canvas.press('ArrowRight');
  expect(
    (await canvas.screenshot()).equals(initialView),
    '方向键应改变实际渲染的视角',
  ).toBe(false);
  await canvas.press('Home');
  expect(
    (await canvas.screenshot()).equals(initialView),
    'Home 键应恢复初始视角',
  ).toBe(true);
});

test('拖动头像会改变实际渲染的视角', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.getByRole('img', {
    name: '拿着笔记本的 3D 银背猩猩',
    exact: true,
  });
  await expect(canvas).toBeVisible();
  const initialView = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;

  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 70,
    bounds.y + bounds.height / 2,
    { steps: 6 },
  );
  await page.mouse.up();

  expect(
    (await canvas.screenshot()).equals(initialView),
    '拖动应旋转模型，不能只移动一个静态画面',
  ).toBe(false);
});

test('暂停按钮停止动画，播放按钮恢复动画', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/');
  const canvas = page.getByRole('img', {
    name: '拿着笔记本的 3D 银背猩猩',
    exact: true,
  });
  await page.getByRole('button', { name: '暂停猩猩动画' }).click();
  const pausedView = await canvas.screenshot();

  await page.clock.runFor(2400);
  expect(
    (await canvas.screenshot()).equals(pausedView),
    '暂停后不应继续渲染动画',
  ).toBe(true);
  await page.getByRole('button', { name: '播放猩猩动画' }).click();
  await page.clock.runFor(1100);
  expect(
    (await canvas.screenshot()).equals(pausedView),
    '播放后应恢复动态画面',
  ).toBe(false);
});

for (const failure of ['WebGL 不可用', '3D 模块加载失败']) {
  test(`${failure}时显示本地静态头像，文章仍可阅读`, async ({ page }) => {
    if (failure === 'WebGL 不可用') {
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type,
          ...args
        ) {
          if (
            type === 'webgl' ||
            type === 'webgl2' ||
            type === 'experimental-webgl'
          )
            return null;
          return getContext.call(this, type, ...args);
        } as typeof getContext;
      });
    } else {
      await page.route('**/gorilla-scene.*.js', (route) => route.abort());
    }
    await page.goto('/');
    await expect(page.locator('gorilla-avatar')).toHaveAttribute(
      'data-state',
      'fallback',
    );
    const poster = page.getByRole('img', {
      name: '拿着笔记本的银背猩猩',
      exact: true,
    });
    await expect(poster).toBeVisible();
    await expect
      .poll(() =>
        poster.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBe(640);
    await expect(page.getByRole('button', { name: '打个招呼' })).toBeHidden();

    await page
      .getByRole('link', {
        name: 'Transformer：理解 Attention Is All You Need',
        exact: true,
      })
      .click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Transformer：理解 Attention Is All You Need',
    );
    await expect(page.locator('.prose')).toBeVisible();
  });
}

test('禁用 JavaScript 时仍显示完整头像和文章入口', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto('/');
  const poster = page.getByRole('img', {
    name: '拿着笔记本的银背猩猩',
    exact: true,
  });
  await expect(poster).toBeVisible();
  await expect
    .poll(() =>
      poster.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(640);

  await page
    .getByRole('link', {
      name: '米勒–拉宾素性测试：从原理到 64 位实现',
      exact: true,
    })
    .click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '米勒–拉宾素性测试：从原理到 64 位实现',
  );
  await context.close();
});

test('显卡上下文丢失时显示静态头像，恢复后可继续查看 3D', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.getByRole('img', {
    name: '拿着笔记本的 3D 银背猩猩',
    exact: true,
  });
  await expect(canvas).toBeVisible();
  const initialView = await canvas.screenshot();

  const graphics = await canvas.evaluateHandle((element: HTMLCanvasElement) =>
    element.getContext('webgl2')!.getExtension('WEBGL_lose_context')!,
  );
  await graphics.evaluate((extension) => extension.loseContext());
  await expect(
    page.getByRole('img', { name: '拿着笔记本的银背猩猩', exact: true }),
  ).toBeVisible();
  await expect(canvas).toBeHidden();
  await graphics.evaluate((extension) => extension.restoreContext());

  await expect(canvas).toBeVisible();
  expect(
    (await canvas.screenshot()).equals(initialView),
    '恢复后应重新绘制完整模型',
  ).toBe(true);
  await graphics.dispose();
});

test('头像重新挂载后仍显示完整模型并能旋转', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const avatar = page.locator('gorilla-avatar');
  const canvas = avatar.locator('canvas');
  await expect(canvas).toBeVisible();
  const initialView = await canvas.screenshot();

  await avatar.evaluate((element) => {
    const parent = element.parentElement!;
    element.remove();
    parent.append(element);
  });

  await expect(avatar).toHaveAttribute('data-state', 'ready');
  await expect(canvas).toBeVisible();
  expect(
    (await canvas.screenshot()).equals(initialView),
    '重新挂载应恢复完整模型',
  ).toBe(true);
  await canvas.press('ArrowRight');
  expect(
    (await canvas.screenshot()).equals(initialView),
    '重新挂载后仍应可以操作模型',
  ).toBe(false);
});

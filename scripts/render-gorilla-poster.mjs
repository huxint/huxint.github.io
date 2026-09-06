import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const url = process.argv[2] ?? 'http://127.0.0.1:4321/';
const output = fileURLToPath(
  new URL('../public/images/gorilla-portrait.webp', import.meta.url),
);
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  await page.goto(url);
  await page.addStyleTag({
    content: `
    body { background: transparent !important; }
    body > * { visibility: hidden; }
    gorilla-avatar { position: fixed; top: 0; left: 0; width: 640px !important; max-width: none !important; visibility: visible; }
    .gorilla-stage { width: 640px !important; height: 640px !important; }
    .gorilla-backdrop, .gorilla-greeting { visibility: hidden !important; }
  `,
  });
  await expect(page.locator('gorilla-avatar')).toHaveAttribute(
    'data-state',
    'ready',
  );
  const canvas = page.locator('.gorilla-canvas');
  await expect(canvas).toHaveJSProperty('width', 640);
  await expect(canvas).toHaveJSProperty('height', 640);
  await canvas.press('Home');
  await canvas.blur();
  const portrait = await canvas.screenshot({ omitBackground: true });
  await sharp(portrait)
    .resize(640, 640)
    .webp({ lossless: true })
    .toFile(output);
  process.stdout.write(`Rendered 640 × 640 portrait: ${output}\n`);
} finally {
  await browser.close();
}

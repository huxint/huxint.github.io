// Bakes the static fallback images from the live 3D scene so the poster, the
// about-page avatar and the share image always match the current model.
// Usage: pnpm dev (or preview), then `node scripts/render-gorilla.mjs`.
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const base = process.env.GORILLA_BASE_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(base);
await page.waitForSelector('gorilla-avatar[data-state="ready"] canvas', {
  timeout: 30000,
});
// Pause the idle animation so the bake is deterministic, then let it settle.
await page.locator('[data-gorilla-motion]').click();
// The CSS backdrop sits behind the transparent canvas; hide it so the bake
// stays transparent and the page keeps drawing the circle itself.
await page.evaluate(() => {
  for (const element of document.querySelectorAll('.gorilla-backdrop'))
    element.style.display = 'none';
});
await page.waitForTimeout(600);

const png = await page
  .locator('gorilla-avatar canvas')
  .screenshot({ omitBackground: true });
await browser.close();

const { width, height } = await sharp(png).metadata();
await sharp(png)
  .resize(640, 640, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 92 })
  .toFile('public/images/gorilla-portrait.webp');

// The about-page avatar and share image reuse the same character, cropped to
// the head so the face stays readable at small sizes.
const cropSize = Math.round(height * 0.62);
await sharp(png)
  .extract({
    left: Math.round(width * 0.5 - cropSize / 2),
    top: Math.round(height * 0.02),
    width: cropSize,
    height: cropSize,
  })
  .resize(640, 640)
  .webp({ quality: 92 })
  .toFile('public/images/gorilla.webp');
console.log('wrote public/images/gorilla-portrait.webp and gorilla.webp');

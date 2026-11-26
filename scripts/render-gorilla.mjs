// Bakes the static fallback images from the live 3D scene so the poster, the
// about-page avatar and the share image always match the current model.
// Usage: pnpm dev (or preview), then `node scripts/render-gorilla.mjs`.
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const base = process.env.GORILLA_BASE_URL ?? 'http://127.0.0.1:4321';
const browser = await chromium.launch();
let png;
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await page.goto(base);
  const canvas = page.locator('[data-gorilla][data-state="ready"] canvas');
  await canvas.waitFor();
  // Render above the final resolution to keep the small facial details crisp.
  await page.addStyleTag({
    content: `
    .gorilla-stage { width: 640px !important; }
    html, body { background: transparent !important; }
  `,
  });
  await page.waitForFunction(
    () => document.querySelector('[data-gorilla] canvas').width === 1280,
  );
  png = await canvas.screenshot({ omitBackground: true });
} finally {
  await browser.close();
}

const { width, height } = await sharp(png).metadata();
await sharp(png)
  .resize(640, 640, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 92 })
  .toFile('public/images/gorilla-portrait.webp');

// Leave the ears and a little shoulder in the portrait crop.
const cropSize = Math.round(height * 0.67);
const head = await sharp(png)
  .extract({
    left: Math.round(width * 0.5 - cropSize / 2),
    top: Math.round(height * 0.065),
    width: cropSize,
    height: cropSize,
  })
  .resize(640, 640)
  .png()
  .toBuffer();
await sharp(head).webp({ quality: 92 }).toFile('public/images/gorilla.webp');
// Link previews are shown on whatever background the platform uses, so they
// get the page's own colour baked in.
await sharp(head)
  .flatten({ background: '#f6f2ea' })
  .webp({ quality: 92 })
  .toFile('public/images/gorilla-share.webp');
console.log('wrote gorilla-portrait.webp, gorilla.webp and gorilla-share.webp');

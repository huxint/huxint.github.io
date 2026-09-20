import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

test('项目页可以直接打开，并且有自己的标题与页内导航', async ({ page }) => {
  await page.goto('/projects/orangutan/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orangutan');
  await expect(
    page.getByRole('navigation', { name: '页内导航' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: '主导航' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'GitHub 仓库' })).toHaveAttribute(
    'href',
    'https://github.com/huxint/orangutan',
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Orangutan');
});

test('博客页面没有通向项目页的链接，站点地图包含项目页', async () => {
  const dist = 'dist';
  const blogPages = htmlFiles(dist).filter(
    (file) => !file.includes(`${join(dist, 'projects')}`),
  );
  expect(blogPages.length).toBeGreaterThan(0);
  for (const file of blogPages) {
    expect(readFileSync(file, 'utf8'), file).not.toContain('/projects/');
  }
  const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
  expect(sitemap).toContain('https://huxint.github.io/projects/orangutan/');
  const project = readFileSync(
    join(dist, 'projects', 'orangutan', 'index.html'),
    'utf8',
  );
  expect(project).not.toContain('noindex');
  expect(project).not.toContain('BlogPosting');
});

test('搜索索引只包含文章', async ({ page }) => {
  await page.goto('/');
  const title = (
    await page.locator('.post-title a').first().innerText()
  ).trim();
  await page.getByRole('link', { name: '搜索文章', exact: true }).click();
  const input = page.getByRole('searchbox');
  await input.fill(title);
  await expect(
    page.locator('.search-results a[href^="/posts/"]').first(),
  ).toBeVisible();
  await input.fill('Orangutan');
  await expect(page.getByRole('status')).toHaveText(/找到/);
  await expect(
    page.locator('.search-results a[href^="/projects/"]'),
  ).toHaveCount(0);
});

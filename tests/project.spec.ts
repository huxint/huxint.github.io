import { expect, test } from '@playwright/test';

const readmeUrl =
  'https://raw.githubusercontent.com/huxint/orangutan-agent/HEAD/README.md';
const readme = `# Orangutan

README 中的项目介绍。

[功能](#功能) · [接口文档](docs/api.md#会话) · [GitHub](https://github.com/huxint/orangutan-agent)

![架构](docs/architecture.svg)

<p><img src="docs/desktop.svg" alt="桌面" width="640"></p>

## 功能

| 能力 | 说明 |
| --- | --- |
| 记忆 | 保留对话 |

\`\`\`cpp
int main() { return 0; }
\`\`\`

<script>window.__readmeExecuted = true</script>
<img src="docs/safe.svg" onerror="window.__readmeExecuted = true" alt="安全图片">
<a href="javascript:window.__readmeExecuted=true">危险链接</a>
`;

test.beforeEach(async ({ page }) => {
  await page.route('https://raw.githubusercontent.com/huxint/**', (route) => {
    if (route.request().url().endsWith('README.md'))
      return route.fulfill({ contentType: 'text/plain', body: readme });
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#ddd"/></svg>',
    });
  });
});

test('项目从仓库列表生成，并沿用博客导航', async ({ page }) => {
  await page.goto('/projects/');
  await page
    .getByRole('heading', { name: 'orangutan-agent' })
    .getByRole('link')
    .click();
  await expect(page).toHaveURL('/projects/orangutan-agent/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'orangutan-agent',
  );
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '项目', exact: true }),
  ).toHaveAttribute('aria-current', 'location');
  await expect(
    page.getByRole('link', { name: 'huxint/orangutan-agent', exact: true }),
  ).toHaveAttribute('href', 'https://github.com/huxint/orangutan-agent');
});

test('README 支持 Markdown、HTML 图片、相对链接和安全的目录锚点', async ({
  page,
}) => {
  await page.goto('/projects/orangutan-agent/');
  const article = page.locator('[data-readme-body]');
  await expect(
    article.getByRole('heading', { name: 'Orangutan', exact: true }),
  ).toBeVisible();
  await expect(article.getByRole('link', { name: '接口文档' })).toHaveAttribute(
    'href',
    'https://github.com/huxint/orangutan-agent/blob/HEAD/docs/api.md#%E4%BC%9A%E8%AF%9D',
  );
  await expect(article.getByRole('img', { name: '架构' })).toHaveAttribute(
    'src',
    'https://raw.githubusercontent.com/huxint/orangutan-agent/HEAD/docs/architecture.svg',
  );
  await expect(
    article.getByRole('img', { name: '桌面', exact: true }),
  ).toHaveAttribute(
    'src',
    'https://raw.githubusercontent.com/huxint/orangutan-agent/HEAD/docs/desktop.svg',
  );
  await expect(article.getByRole('table')).toBeVisible();
  await expect(article.locator('pre code')).toHaveText(
    'int main() { return 0; }\n',
  );
  await expect(
    article.locator('script, [onerror], a[href^="javascript:"]'),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, '__readmeExecuted')),
  ).toBeUndefined();
  await article.getByRole('link', { name: '功能', exact: true }).click();
  await expect(
    article.getByRole('heading', { name: '功能', exact: true }),
  ).toHaveAttribute('id', '功能');
  await expect(page).toHaveURL(/#%E5%8A%9F%E8%83%BD$/);
});

test('重新打开时读取仓库当前的 README，无需重新构建博客', async ({ page }) => {
  let version = 1;
  await page.route(readmeUrl, (route) =>
    route.fulfill({
      contentType: 'text/plain',
      body: `# 当前项目\n\n仓库版本 ${version}`,
    }),
  );
  await page.goto('/projects/orangutan-agent/');
  await expect(page.locator('[data-readme-body]')).toContainText('仓库版本 1');
  version = 2;
  await page.reload();
  await expect(page.locator('[data-readme-body]')).toContainText('仓库版本 2');
});

test('读取失败后可以重试，并提供仓库原文入口', async ({ page }) => {
  await page.route(readmeUrl, (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/projects/orangutan-agent/');
  await expect(page.getByText('README 暂时无法读取。')).toBeVisible();
  await expect(
    page.getByRole('link', { name: '在 GitHub 阅读' }),
  ).toHaveAttribute('href', 'https://github.com/huxint/orangutan-agent#readme');
  await page.route(readmeUrl, (route) =>
    route.fulfill({ contentType: 'text/plain', body: readme }),
  );
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('[data-readme-body]')).toContainText(
    'README 中的项目介绍。',
  );
  await expect(page.getByText('README 暂时无法读取。')).toBeHidden();
});

test('项目收录到站点地图，旧链接跳转到正确仓库', async ({ page }) => {
  const sitemap = await page.request.get('/sitemap-0.xml');
  expect(await sitemap.text()).toContain(
    'https://huxint.github.io/projects/orangutan-agent/',
  );
  await page.goto('/projects/orangutan/');
  await expect(page).toHaveURL('/projects/orangutan-agent/');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    'content',
    'website',
  );
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).toHaveCount(0);
});

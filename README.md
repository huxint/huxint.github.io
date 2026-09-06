# huxint 的博客

[huxint.github.io](https://huxint.github.io/) 的源码。使用 Astro 静态生成，文章以 Markdown 维护，KaTeX 渲染数学公式，Expressive Code / Shiki 处理代码高亮，Pagefind 提供中文全文搜索。

## 本地开发

需要 Node.js 24 和 pnpm 11。项目在 `package.json` 中固定 pnpm 版本。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

访问终端显示的地址，默认是 `http://localhost:4321`。开发预览包含草稿，修改 Markdown 后会自动更新。

搜索索引在构建时生成。检查搜索和实际发布内容时，使用：

```bash
pnpm build
pnpm preview
```

产物位于 `dist/`，包含文章、图片、字体和搜索索引，可部署到静态服务器。

## 写文章

每篇文章放在 `src/content/posts/<slug>/index.md`，图片与 Markdown 放在同一目录。目录名决定文章地址，例如 `transformer/index.md` 对应 `/posts/transformer/`。

```yaml
---
title: '文章标题'
description: '用于列表、搜索结果和 RSS 的摘要。'
pubDate: 2026-09-06
tags: ['算法']
draft: true
---
```

`updatedDate` 是可选的更新日期。设为 `draft: true` 的文章只出现在开发预览中；正式构建会从页面、标签和 RSS 中排除它。文章列表、目录和阅读时长自动生成。

可以参考 [排版样例](src/content/posts/writing-sample/index.md) 和两篇正式文章：

- [Transformer 论文精读](src/content/posts/transformer/index.md)
- [米勒–拉宾素性测试](src/content/posts/miller-rabin/index.md)

### 公式、代码和图片

行内公式使用 `$E=mc^2$`，独立公式用单独成行的 `$$` 包围。支持 KaTeX 的矩阵、分段函数、多行对齐与 `\tag{}` 等语法；无效公式会在构建时报告。

代码块指定语言后自动高亮。`title` 设置文件名，`{2}` 强调第二行：

````markdown
```cpp title="example.cpp" {2}
int square(int value) {
    return value * value;
}
```
````

图片使用标准 Markdown 语法，标题会转成图注：

```markdown
![图片内容的文字说明](./diagram.png '显示在图片下方的图注')
```

本地 PNG、JPEG、WebP 和 SVG 图片由构建管线处理，输出尺寸信息。独立段落中的图片支持点击放大，以及 Enter / Escape 键盘操作。正文也支持表格、脚注、任务列表和引用。

## 配置

- [站点信息](src/data/site.ts)：名称、简介、邮箱与 GitHub 链接。
- [项目列表](src/data/projects.ts)：手动维护项目名称、简介、标签和仓库地址。
- [Astro 配置](astro.config.mjs)：站点 URL、Markdown 渲染与代码主题。
- [全局样式](src/styles/global.css) 与 [正文样式](src/styles/prose.css)：配色、布局和文章排版。

修改域名时，同时更新 `astro.config.mjs` 的 `site` 和 `public/robots.txt` 中的 Sitemap 地址。

## 验证

```bash
pnpm check
pnpm test:articles
pnpm exec playwright install chromium
pnpm test
```

`test:articles` 需要支持 C++20 和 `__uint128_t` 的 GCC。它直接提取文章中的 C++ 程序编译运行，与 `0…50000` 的筛法结果及大整数边界样例比较。

`pnpm test` 先构建站点，再通过 Chromium 检查公式、手机溢出、代码复制、中文搜索、主题持久化、图片键盘操作和草稿隔离。`pnpm format` 整理源码格式，文章 Markdown 保持作者排版。

## 部署

[GitHub Actions](.github/workflows/pages.yml) 在推送和 Pull Request 时执行检查、文章程序验证与浏览器测试。`main` 分支检查通过后，把 `dist/` 部署到 GitHub Pages。

仓库 Settings → Pages → Source 需要设置为 **GitHub Actions**。

## 许可

仓库未设置开源许可证。

# huxint 的博客

[huxint.github.io](https://huxint.github.io/) 的源码：Astro + Markdown，公式用 KaTeX，搜索用 Pagefind。

## 跑起来

需要 Node 22+ 和 pnpm：

```bash
pnpm install
pnpm dev
```

## 写文章

`src/content/posts/<目录名>/index.md`，目录名就是文章地址。

```yaml
---
title: '标题'
description: '摘要，给列表、搜索和 RSS 用'
pubDate: 2026-09-06
tags: ['算法']
---
```

标 `draft: true` 的文章只在本地预览里出现。行内公式 `$…$`，独立公式 `$$…$$`。

推送到 `main` 会自动构建并发布到 GitHub Pages。

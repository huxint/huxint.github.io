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

`==高亮==`、`++下划线++` 和 `~~删除线~~` 可以和公式、链接混用。提示用 `> [!NOTE]`、`TIP`、`IMPORTANT`、`WARNING` 或 `CAUTION`；围栏代码块支持 `diff` 和 `mermaid`。完整示例在本地的 `/posts/writing-sample/`。

Markdown 交由页面按需渲染，内容集合不再缓存完整 HTML。修改渲染插件后，重启本地开发服务即可。

## 写生活

`src/content/life/<目录名>/index.md`，媒体文件放在同一目录。

```yaml
---
date: 2026-09-22T20:30:00+08:00
location: 深圳
---
今天的随手记录。

![照片说明](./photo.jpg) ![实况照片](./live.jpg)

![一段视频](./clip.mp4)
```

同一段里的照片会排成媒体行。`live.jpg` 旁边放同名的 `live.mp4` 就是实况照片；`clip.jpg` 会用作 `clip.mp4` 的封面。

实况的 MOV 转成网页能放的 MP4：

```bash
ffmpeg -i IMG_0001.MOV -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart -an IMG_0001.mp4
```

推送到 `main` 会自动构建并发布到 GitHub Pages。

修改猩猩模型后，先启动本地预览，再用 `pnpm render:gorilla` 更新头像和分享图片。预览不在默认端口时，用 `GORILLA_BASE_URL` 指定地址。

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

`==高亮==`、`++下划线++` 和 `~~删除线~~` 可以和公式、链接混用。提示用 `> [!NOTE]`、`TIP`、`IMPORTANT`、`WARNING` 或 `CAUTION`；围栏代码块支持 `diff` 和 `mermaid`。提示类型后面可以接标题（`> [!THEOREM] 费马小定理`），再加 `-` 或 `+` 就能折叠；另有 `DEFINITION`、`THEOREM`、`LEMMA`、`PROOF`、`EXAMPLE`。连续的 `> [!TAB] 名字` 合成一组标签页。完整示例在本地的 `/posts/writing-sample/`。

HTML 里的公式和正文一样渲染：直接写在 Markdown 里的 HTML 块在构建时排版，`render html` 里的 `$…$`、`$$…$$`、`\(…\)`、`\[…\]`（包括脚本后来写进去的）在块内用同一份 KaTeX 排版。不想当公式的地方放进 `<code>` 或加 `data-no-math`。选中带公式的文字再复制，得到的是 LaTeX 源码。图注（`title="…"`）里也可以写公式。`render html` 里的 `\htmlClass{类名}{…}` 给公式的一部分套上块内的类，让某一项和图上对应的元素同色。

文章里的二到四级标题在悬停时露出指向自己的 `#` 链接；文章末尾链接到前后两篇。

技术文章的图示直接内嵌在 Markdown：`render svg` 写矢量图，`render html` 写局部演示（样式和脚本也放在块内），`mermaid` 写关系图。`render html` 的块会裁掉越出边缘的内容：上下留了焦点环的位置，贴着左右边缘的控件，焦点环自动画在元素内侧。不另存图片或演示的 HTML、JS、CSS 附件。生活照片和视频仍放在对应记录目录。

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

同一段里的照片会排成媒体行。`live.jpg` 旁边放同名的 `live.mp4` 就是实况照片；`clip.jpg` 会用作 `clip.mp4` 的封面。提示块、标签页、公式和表情在生活记录里同样可用。

实况的 MOV 转成网页能放的 MP4：

```bash
ffmpeg -i IMG_0001.MOV -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart -an IMG_0001.mp4
```

## 表情

正文、标题、摘要和生活记录里写 `:名字:` 就是一张贴纸，全部写法在 `/stickers/`，可以按名字、文案或写法筛选，点一下复制。

贴纸在构建时由 `src/lib/stickers/` 里的部件画成 SVG：`catalog.mjs` 列出每张贴纸用哪些部件，`draw.mjs` 是整套共用的色板、线宽和光照。新增贴纸只需在 `catalog.mjs` 加一项。梗图的文案用字形轮廓画出，不依赖读者系统的字体；新增或修改文案后运行一次：

```bash
node scripts/sticker-glyphs.mjs [NotoSansCJK-Black.ttc 的路径]
```

它从思源黑体（Noto Sans CJK SC Black，SIL OFL 1.1）取出用到的字，写进 `src/lib/stickers/glyphs.mjs`。文案里有尚未取出的字时，构建会报错并提示这条命令。

## 样式

全站的字号、字重、行高和圆角都是 `src/styles/global.css` 开头的变量（`--text-*`、`--weight-*`、`--leading-*`、`--radius-*`），页面只引用，不另写数值。正文和标题同用一套无衬线字体；想让标题换一种字体，只改 `--font-display`。

键盘：`/` 聚焦当前页的筛选框，没有筛选框的页面打开搜索；`Ctrl+K` 或 `⌘K` 在任何页面打开搜索。

## 测试和发布

```bash
pnpm check   # 类型检查
pnpm test    # 用 tests/fixtures 里的内容构建一份站点，再跑 Playwright
```

推送到 `main` 会自动构建并发布到 GitHub Pages。

修改猩猩模型后，先启动本地预览，再用 `pnpm render:gorilla` 更新头像和分享图片。预览不在默认端口时，用 `GORILLA_BASE_URL` 指定地址。

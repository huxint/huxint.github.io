# 个人博客设计文档

- **作者**：huxint
- **日期**：2026-05-23
- **状态**：待审阅

## 1. 目标与范围

从零搭建一个个人博客，部署到 GitHub Pages，纯静态 HTML/CSS/JS，无构建步骤。

**目标**：
- 简洁现代、有 "Q 萌" 个人色彩但不花哨
- 支持明暗双主题（默认跟随系统）
- 响应式（桌面 / 平板 / 手机）
- 流畅但克制的动画
- 内嵌 SVG 图标
- 显示 huxint 的 GitHub 贡献热力图
- 支持代码高亮、文章评论、文章页 TOC 侧边栏

**非目标**（明确不做）：
- 站内搜索、RSS、多语言、Newsletter、Analytics
- 任何 SSG 框架或 npm 构建链
- 实时拉取 GitHub star 数（手维护）
- 评论数据自托管（用 Giscus 替代）

---

## 2. 技术栈

| 层 | 选择 | 备注 |
|---|---|---|
| 语言 | HTML5 + CSS3 + 原生 JS | 无框架，无构建 |
| 字体 | Nunito（标题/正文）+ JetBrains Mono（代码） | Google Fonts，含系统 fallback |
| 中文 fallback | PingFang SC / 微软雅黑 / 思源黑体 | CSS 字体栈最后追加 |
| 代码高亮 | Prism.js（CDN） | 主题色覆盖成马卡龙四色 |
| 评论 | Giscus（GitHub Discussions） | 需要仓库开启 Discussions |
| 贡献热力图 | 第三方 API（候选）：`github-contributions-api.deno.dev/v1/huxint.json` | 备选 `github-contributions.vercel.app`。实现时先用 curl 验证可用性 |
| 部署 | GitHub Pages + Actions | 用户站 `huxint.github.io` 或项目站 |
| 浏览器目标 | Chrome/Edge/Firefox/Safari 最新两个版本 | 不兼容 IE |

---

## 3. 项目结构

```
blog/
├── index.html                    # 首页
├── blog.html                     # 博客列表
├── projects.html                 # 项目展示
├── about.html                    # 关于我
├── 404.html                      # 找不到页面
├── posts/
│   └── 2026-05-23-hello-world.html  # 示例文章
├── partials/
│   ├── header.html               # 共享导航
│   └── footer.html               # 共享页脚
├── data/
│   ├── posts.json                # 文章元数据索引
│   └── projects.json             # 项目元数据索引
├── assets/
│   ├── css/
│   │   ├── tokens.css            # 设计 token（颜色、字号、间距、明暗主题变量）
│   │   ├── base.css              # reset + 全局
│   │   ├── components.css        # 卡片/按钮/导航/标签
│   │   └── prose.css             # 文章正文排版
│   ├── js/
│   │   ├── main.js               # 主题、移动菜单、partials/icon 注入、QR modal
│   │   ├── heatmap.js            # GitHub 贡献热力图
│   │   ├── blog.js               # 列表页（读 posts.json）
│   │   ├── projects.js           # 项目页（读 projects.json）
│   │   └── post.js               # 文章页（TOC、scrollspy、进度条、Prism、Giscus）
│   ├── icons/                    # SVG 图标
│   │   ├── github.svg
│   │   ├── moon.svg
│   │   ├── sun.svg
│   │   ├── menu.svg
│   │   ├── close.svg
│   │   ├── wechat.svg
│   │   ├── qq.svg
│   │   └── sparkle.svg           # ✦ 装饰
│   └── images/
│       ├── wechat-qr.png         # 微信二维码
│       └── qq-qr.png             # QQ 二维码
├── .github/workflows/pages.yml   # GitHub Pages 部署
├── CNAME                         # 自定义域名（可选）
├── .gitignore
└── README.md
```

---

## 4. 视觉系统

### 4.1 配色（CSS 变量）

**明色（默认）**：
```css
--bg:          #FFFBF5;   /* 米白底 */
--bg-elevated: #FAF6EE;   /* 次底 */
--border:      #F5EFE5;
--text:        #1F2937;   /* 主文 */
--text-muted:  #6B7280;   /* 次文 */
--text-faint:  #9CA3AF;   /* 弱文 */
--accent-yellow: #FBBF24;
--accent-pink:   #F472B6;
--accent-blue:   #60A5FA;
--accent-purple: #A78BFA;
```

**暗色**：
```css
--bg:          #0F172A;   /* 深夜蓝 */
--bg-elevated: #1E293B;
--border:      #1E293B;
--text:        #F1F5F9;
--text-muted:  #94A3B8;
--text-faint:  #64748B;
--accent-yellow: #FCD34D;
--accent-pink:   #F9A8D4;
--accent-blue:   #93C5FD;
--accent-purple: #C4B5FD;
```

**马卡龙色用法约束**：只出现在 ①logo 渐变 ②文章/项目卡片色条 ③标签 ④hover/active 高亮。正文、按钮主色仍是中性深灰，避免"彩虹页面"。

### 4.2 字体

- **标题**：Nunito 800，紧凑字距 `-0.02em`
- **正文**：Nunito 400，行高 `1.75`
- **代码**：JetBrains Mono 400
- **中文 fallback**：`'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif`
- `font-display: swap`

### 4.3 节奏

- **间距栅格**：8px 基准（`--space-1: 4px` 到 `--space-12: 96px`）
- **圆角**：组件 14px，按钮 10px，pill 标签 99px
- **边框**：1px 实线 `var(--border)`
- **阴影**：极少。卡片默认无阴影；hover 时 `0 4px 12px rgba(0,0,0,0.04)`

### 4.4 Logo

44×44 圆角方块，4 色对角渐变：
```css
background: linear-gradient(135deg, #FBBF24 0%, #F472B6 40%, #60A5FA 75%, #A78BFA 100%);
```
正中白色 'H'。hover 时开始旋转动画（8s 一圈），离开时回到初始角度。

---

## 5. 页面规格

### 5.1 首页 `index.html`

布局（自上而下）：
1. **共享 Header**
2. **Hero**：渐变 logo + 大字"嗨，我是 huxint ✦" + 一句话简介（占位文本）+ 4 个技术栈 pill（C++ / Rust / Python / Go） + 社交链接行
3. **GitHub 贡献热力图**：53 周 × 7 天 grid，cell 颜色按 contribution count 分 5 档（用 `--accent-blue` 渐变）。下方显示总贡献数和 streak
4. **最新文章**：从 `posts.json` 取前 3 篇，渲染成卡片网格（卡片左色条按 `color` 字段）
5. **CTA**：按钮"看全部文章 →"跳 `/blog.html`
6. **共享 Footer**

### 5.2 博客列表 `blog.html`

1. 共享 Header
2. 页面标题 `所有文章 ✦` + 简短说明
3. 文章列表，按年份分组（h2 = 年份），每条显示：日期 + 标题 + 摘要 + tag pills + 阅读时长
4. 共享 Footer

数据源：`data/posts.json`，前端 sort by date desc，按 year groupBy。

### 5.3 文章详情 `posts/<slug>.html`

布局（桌面端 ≥ 1024px 两栏）：
1. 共享 Header
2. 顶部阅读进度细线（fixed，渐变四色）
3. 文章元信息：标题（大）+ 日期 + 阅读时长 + tag pills
4. 主区两栏：正文最大 720px + 右侧粘性 TOC 200px，整体在 viewport 居中，超宽屏左右等距留白
5. 正文按 `prose.css` 排版
6. 上一篇 / 下一篇导航卡片
7. Giscus 评论
8. 共享 Footer

平板（768-1023px）/手机（< 768px）：TOC 折叠为顶部抽屉，按钮在标题旁；正文撑满，左右内边距 24px / 16px。

### 5.4 项目展示 `projects.html`

1. 共享 Header
2. 标题 `开源项目 ✦`
3. 卡片网格：每张卡片包含项目名 + 描述 + 语言 pill + star 数 + GitHub 链接，左侧色条按 `color` 字段
4. 共享 Footer

featured 项目可置顶。

### 5.5 关于我 `about.html`

1. 共享 Header
2. 大头像（占位）+ 自我介绍（占位文本）
3. 技术栈展示（pill 网格按熟练度分组）
4. 联系方式：GitHub / 微信 QR / QQ QR
5. 共享 Footer

### 5.6 404 `404.html`

居中：404 大字 + ✦ 装饰 + "找不到这一页"文案 + 返回首页按钮。

---

## 6. 共享组件

### 6.1 Header（`partials/header.html`）

```
[ Logo H ] huxint    首页 · 博客 · 项目 · 关于    [🌓]
```
- 粘性，滚动时 `backdrop-filter: blur(12px)` 半透明
- 当前页用 ✦ 标记（不是下划线）
- 移动端 < 768px：右侧 4 个链接折叠为汉堡 → 全屏抽屉

### 6.2 Footer（`partials/footer.html`）

```
© 2026 huxint  ·  GitHub · 微信 · QQ · ✦  ·  v0.1
```
- 微信/QQ 点击触发 QR modal
- ✦ 可点击，hover 跳动一下（彩蛋）

### 6.3 QR Modal

居中弹窗，半透明遮罩，点遮罩或按 Esc 关闭。内部 240×240 QR 图片 + 文字提示。

---

## 7. 交互细节

| 交互 | 实现 |
|---|---|
| 主题切换 | localStorage `theme: 'light' \| 'dark' \| 'system'`，初始读 `prefers-color-scheme`。切换时圆形 mask 从按钮位置扩散，500ms ease |
| 移动菜单 | < 768px 显示汉堡按钮，点击切换全屏抽屉，链接错落淡入（每个延迟 50ms） |
| TOC scrollspy | IntersectionObserver 监听文章 h2/h3，命中的目录项前加 ✦ 标记，并平滑滚动到可视区 |
| 阅读进度条 | `window.scrollY / (scrollHeight - innerHeight)` 设置顶部 fixed 3px div 的 width，渐变色 |
| 热力图 | fetch API，渲染 SVG 53×7 grid。失败时显示降级文案 |
| 代码高亮 | Prism.js + 自定义 CSS 覆盖关键字色（用马卡龙四色） |
| Giscus | 文章末尾官方 `<script>`，theme 参数跟随站点（监听主题变化时 postMessage 更新 iframe） |
| Logo 旋转 | 默认 `animation-play-state: paused`，hover 时 running |
| 卡片 hover | `transform: translateY(-3px)`，spring 缓动 `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| 导航 hover | 链接下方显示 ✦ 圆点 |

---

## 8. 数据 schema

### 8.1 `data/posts.json`

```json
[
  {
    "slug": "2026-05-23-hello-world",
    "title": "Hello, World ✦",
    "date": "2026-05-23",
    "summary": "博客的第一篇文章，聊聊为什么从零自己写。",
    "tags": ["杂谈", "Meta"],
    "readingTime": 4,
    "color": "pink"
  }
]
```

字段：
- `slug` (string)：对应 `posts/<slug>.html`
- `title` (string)：文章标题
- `date` (ISO string)：发布日期
- `summary` (string)：列表页摘要，1-2 句
- `tags` (string[])：标签
- `readingTime` (int)：阅读时长（分钟），手填
- `color` (enum)：`yellow|pink|blue|purple`，决定卡片左色条

### 8.2 `data/projects.json`

```json
[
  {
    "name": "free-code",
    "description": "一个用来折腾的小工具",
    "url": "https://github.com/huxint/free-code",
    "language": "Go",
    "stars": 12,
    "color": "blue",
    "featured": true
  }
]
```

---

## 9. 共享片段注入机制

每个 HTML 页面在 `<body>` 顶部和底部有占位：
```html
<header data-include="/partials/header.html"></header>
...
<footer data-include="/partials/footer.html"></footer>
```

`main.js` 在 DOMContentLoaded 时扫描所有 `[data-include]`，fetch 内容后 `innerHTML` 注入，然后再 init 主题/菜单/icon 等逻辑。

**SVG 图标**类似：HTML 写 `<svg data-icon="github" class="icon"></svg>`，`main.js` fetch `/assets/icons/github.svg` 并替换该元素。最终图标作为内联 SVG 存在于 DOM 中（满足"内嵌 SVG"诉求），可通过 `currentColor` 跟随主题。源文件分离仅是为了维护方便。

---

## 10. 部署

### 10.1 GitHub Pages workflow

`.github/workflows/pages.yml`：
```yaml
name: Deploy
on:
  push: { branches: [main] }
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: '.' }
      - uses: actions/deploy-pages@v4
```

仓库 Settings → Pages → Source 选 "GitHub Actions"。

### 10.2 仓库选择

推荐用户站：`huxint.github.io`（仓库名）→ 部署到 `https://huxint.github.io/`，根路径，链接最干净。

如果用项目站 `blog`，所有内部链接需要前缀 `/blog/`，或者全部用相对路径。

---

## 11. 降级与边界

| 场景 | 行为 |
|---|---|
| 热力图 API 失败 / 超时 | 显示 `"暂时拉不到 GitHub 贡献数据 ✦"` 占位 + GitHub profile 链接 |
| Giscus 加载超时（3s） | 显示 `"评论暂不可用，欢迎在 GitHub 上 ping 我"` + GitHub 链接 |
| Prism CDN 失败 | 代码块仍然可读（明文 monospace），不阻塞页面 |
| 主题 JS 失败 | 默认明色，CSS 不依赖 JS 也能展示 |
| 完全无 JS | HTML 静态结构 + CSS 完整可读；动态部分（热力图、评论、TOC scrollspy、partials 注入）失效，但核心内容仍然能读到 |

注：partials 注入依赖 JS。如果完全无 JS 也要可读，可在每个 HTML 文件里直接保留一份 inline 的极简 header（仅站名 + 4 个链接）和 footer 作为 noscript fallback —— **本期实现包含此 fallback**。

---

## 12. 性能目标

- 首屏 < 1s（无 build，HTML 直发）
- 总自有 JS < 50KB（不含 Prism / Giscus）
- 字体 `font-display: swap`，避免 FOIT
- 图标 lazy fetch，不阻塞渲染
- 图片 `loading="lazy"`

---

## 13. 示例内容

写 **1 篇**示例文章 `posts/2026-05-23-hello-world.html`，标题 `Hello, World ✦`，内容覆盖：

- h1 / h2 / h3 标题层级
- 段落（中英混排）
- 加粗 / 斜体 / 行内代码 / 链接
- 有序 / 无序列表
- 代码块（一段 Rust，一段 JS）
- blockquote
- 表格
- 图片（用 placeholder）

用来验证整套 `prose.css` 的排版。

`data/posts.json` 同步加一条记录。

`data/projects.json` 预填 2-3 个示例项目（可以是 huxint 已有的 GitHub 仓库）。

---

## 14. 开发与验证

由于无构建步骤，本地预览只需：
```bash
python -m http.server 8000
# 或
npx serve .
```

**手动验证清单**（实现完成后）：
- [ ] 桌面/平板/手机三档断点（1280 / 768 / 375）布局正常
- [ ] 明暗主题切换 + 跟随系统切换都生效
- [ ] 5 个主页面都能正常打开
- [ ] 示例文章页 TOC scrollspy、进度条工作
- [ ] 代码高亮可见
- [ ] 微信/QQ QR modal 可弹出
- [ ] 热力图能拉到数据
- [ ] Giscus 出现在文章底部
- [ ] 部署到 GitHub Pages 后线上可访问
- [ ] Lighthouse 桌面端性能 ≥ 90

---

## 15. 后续可扩展（不在本期范围）

- 站内搜索（lunr.js 客户端）
- RSS feed（手写或加 build 脚本）
- 文章封面图
- 文章浏览量统计
- 标签筛选页
- Analytics（Umami / Plausible）
- 自动生成 posts.json 的 build 脚本（扫 posts 目录）


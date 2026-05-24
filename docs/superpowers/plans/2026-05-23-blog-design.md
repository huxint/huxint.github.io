# 个人博客实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建 huxint 的个人博客，纯静态 HTML/CSS/JS，部署到 GitHub Pages，覆盖首页/博客列表/文章页/项目/关于/404 六个页面，含明暗主题、贡献热力图、TOC、代码高亮、Giscus 评论。

**Architecture:** 无构建步骤的纯静态站点。每个 HTML 页面引用相同的 CSS token 系统和共享 JS 模块（`main.js` 注入 partials + icons + 主题 + 菜单 + QR modal），页面专属逻辑（heatmap、blog、post、projects）作为独立 JS 文件按需加载。数据来自 `data/*.json`，由前端 fetch 后渲染。

**Tech Stack:** HTML5 + CSS3（变量驱动主题）+ 原生 JS（ES2020+），Google Fonts（Nunito / JetBrains Mono），Prism.js CDN，Giscus，GitHub Pages + Actions。

---

## 项目约定

- **路径策略**：本计划全部使用 **根绝对路径**（如 `/assets/css/tokens.css`）。这要求站点部署在域名根（即 GitHub 用户站 `huxint.github.io`）。如果部署到项目站 `huxint.github.io/blog/`，需要全局把所有 `/` 开头的引用前缀改为 `/blog/`。请在开发期就锚定一种部署形态，避免来回切换。
- **无构建/无测试框架**：验证策略是：JSON/JS 语法校验（`python3 -c "import json; json.load(...)"` / `node --check`）+ 本地起 `python3 -m http.server 8000` + `curl` 抓 HTML + 浏览器手测（开 DevTools 看 console / network）。
- **DRY/YAGNI**：写最少能满足 spec 的代码。不预设扩展点，不写"以后可能用"的抽象。
- **提交节奏**：每个 Task 完成后做一次 `git commit`，commit message 用 `feat:` / `chore:` / `style:` 前缀。

---

## 文件结构

```
blog/
├── index.html                          # 首页（Hero + 热力图 + 最新文章）
├── blog.html                           # 博客列表
├── projects.html                       # 项目展示
├── about.html                          # 关于我
├── 404.html                            # 找不到页面
├── posts/
│   └── 2026-05-23-hello-world.html     # 示例文章
├── partials/
│   ├── header.html                     # 共享导航
│   └── footer.html                     # 共享页脚（含 QR modal 标记）
├── data/
│   ├── posts.json                      # 文章元数据索引
│   └── projects.json                   # 项目元数据索引
├── assets/
│   ├── css/
│   │   ├── tokens.css                  # 颜色/字号/间距/主题变量
│   │   ├── base.css                    # reset + 全局 + 字体
│   │   ├── components.css              # logo/btn/card/pill/header/footer/modal/drawer
│   │   └── prose.css                   # 文章正文排版
│   ├── js/
│   │   ├── main.js                     # partials注入 + icon注入 + 主题 + 菜单 + QR modal
│   │   ├── heatmap.js                  # GitHub 贡献热力图（仅 index）
│   │   ├── blog.js                     # 博客列表（仅 blog）
│   │   ├── projects.js                 # 项目（仅 projects）
│   │   └── post.js                     # 文章页（TOC/scrollspy/进度条/Giscus 主题同步）
│   ├── icons/                          # 8 个内联 SVG，currentColor 主题色
│   │   ├── github.svg
│   │   ├── moon.svg
│   │   ├── sun.svg
│   │   ├── menu.svg
│   │   ├── close.svg
│   │   ├── wechat.svg
│   │   ├── qq.svg
│   │   └── sparkle.svg
│   └── images/
│       ├── wechat-qr.png               # 微信二维码（占位 PNG）
│       └── qq-qr.png                   # QQ 二维码（占位 PNG）
├── .github/workflows/pages.yml         # GitHub Pages 部署
├── .gitignore
└── README.md
```

各文件职责：
- **tokens.css**：所有可主题化的设计 token；唯一定义颜色/字号/间距处。
- **base.css**：CSS reset、html/body 默认、字体加载、`<a>`/`<img>` 默认。不含组件。
- **components.css**：所有共享组件类（`.logo` `.btn` `.card` `.pill` `.site-header` `.site-footer` `.modal` `.drawer`）。
- **prose.css**：仅 `.prose` 作用域下的排版，给文章正文用。
- **main.js**：每页都加载。负责动态注入 partials/icons、主题切换、菜单、模态框。
- **heatmap.js / blog.js / projects.js / post.js**：页面特定脚本，按页加载。

---

### Task 1: 项目骨架

**Files:**
- Create: `/home/huxint/projects/blog/.gitignore`
- Create: `/home/huxint/projects/blog/README.md`
- Create: 空目录 `partials/` `data/` `posts/` `assets/css/` `assets/js/` `assets/icons/` `assets/images/` `.github/workflows/`

- [ ] **Step 1：创建目录结构**

Run:
```bash
mkdir -p /home/huxint/projects/blog/{partials,data,posts,assets/css,assets/js,assets/icons,assets/images,.github/workflows}
```

- [ ] **Step 2：写 `.gitignore`**

Create `/home/huxint/projects/blog/.gitignore`:
```
.DS_Store
Thumbs.db
node_modules/
.vscode/
.idea/
*.log
.cache/
```

- [ ] **Step 3：写 `README.md`**

Create `/home/huxint/projects/blog/README.md`:
```markdown
# huxint's blog

个人博客源码。纯静态 HTML / CSS / JS，无构建。

## 本地预览

    python3 -m http.server 8000

然后访问 http://localhost:8000

## 部署

push 到 `main` 分支会触发 GitHub Actions 自动部署到 GitHub Pages。

## 文档

- 设计文档：`docs/superpowers/specs/2026-05-23-blog-design.md`
- 实施计划：`docs/superpowers/plans/2026-05-23-blog-design.md`
```

- [ ] **Step 4：验证目录结构存在**

Run:
```bash
cd /home/huxint/projects/blog && ls -la partials data posts assets/css assets/js assets/icons assets/images .github/workflows
```
Expected: 各目录均存在（空目录会显示 `. ..`）。

- [ ] **Step 5：提交**

```bash
cd /home/huxint/projects/blog && git add .gitignore README.md && git commit -m "chore: scaffold project structure"
```

---

### Task 2: 设计 token (`tokens.css`)

**Files:**
- Create: `/home/huxint/projects/blog/assets/css/tokens.css`

- [ ] **Step 1：创建 `tokens.css`**

```css
:root {
  --bg:          #FFFBF5;
  --bg-elevated: #FAF6EE;
  --border:      #F5EFE5;
  --text:        #1F2937;
  --text-muted:  #6B7280;
  --text-faint:  #9CA3AF;
  --accent-yellow: #FBBF24;
  --accent-pink:   #F472B6;
  --accent-blue:   #60A5FA;
  --accent-purple: #A78BFA;
  --shadow-card:   0 4px 12px rgba(0, 0, 0, 0.04);

  --font-sans: 'Nunito', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;

  --fs-xs:   12px;
  --fs-sm:   14px;
  --fs-base: 16px;
  --fs-md:   18px;
  --fs-lg:   22px;
  --fs-xl:   28px;
  --fs-2xl:  36px;
  --fs-3xl:  48px;
  --fs-4xl:  64px;

  --lh-tight: 1.2;
  --lh-base:  1.6;
  --lh-prose: 1.75;

  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  24px;
  --space-6:  32px;
  --space-7:  48px;
  --space-8:  64px;
  --space-9:  80px;
  --space-12: 96px;

  --radius-sm:   8px;
  --radius:      14px;
  --radius-btn:  10px;
  --radius-pill: 99px;

  --container: 1080px;
  --content:   720px;

  --transition: 200ms ease;
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

:root[data-theme='dark'] {
  --bg:          #0F172A;
  --bg-elevated: #1E293B;
  --border:      #1E293B;
  --text:        #F1F5F9;
  --text-muted:  #94A3B8;
  --text-faint:  #64748B;
  --accent-yellow: #FCD34D;
  --accent-pink:   #F9A8D4;
  --accent-blue:   #93C5FD;
  --accent-purple: #C4B5FD;
  --shadow-card:   0 4px 12px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']):not([data-theme='dark']) {
    --bg:          #0F172A;
    --bg-elevated: #1E293B;
    --border:      #1E293B;
    --text:        #F1F5F9;
    --text-muted:  #94A3B8;
    --text-faint:  #64748B;
    --accent-yellow: #FCD34D;
    --accent-pink:   #F9A8D4;
    --accent-blue:   #93C5FD;
    --accent-purple: #C4B5FD;
    --shadow-card:   0 4px 12px rgba(0, 0, 0, 0.3);
  }
}
```

注：`:root[data-theme='dark']` 处理显式选 dark；`@media` 块处理"既没选 light 也没选 dark（即 system）"时跟随系统。`data-theme='light'` 不需要单独定义，因为默认 `:root` 就是 light。

- [ ] **Step 2：提交**

```bash
cd /home/huxint/projects/blog && git add assets/css/tokens.css && git commit -m "feat(css): add design tokens with light/dark themes"
```

---

### Task 3: 基础样式 (`base.css`)

**Files:**
- Create: `/home/huxint/projects/blog/assets/css/base.css`

- [ ] **Step 1：创建 `base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }

html, body, h1, h2, h3, h4, h5, h6, p, ul, ol, li, figure, blockquote, pre {
  margin: 0;
  padding: 0;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--fs-base);
  line-height: var(--lh-base);
  font-weight: 400;
  min-height: 100vh;
  transition: background-color var(--transition), color var(--transition);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: inherit;
  text-decoration: none;
  transition: color var(--transition);
}
a:hover { color: var(--accent-blue); }

img, svg { display: block; max-width: 100%; height: auto; }

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

ul, ol { list-style: none; }

code, pre, kbd, samp { font-family: var(--font-mono); }

::selection {
  background: var(--accent-yellow);
  color: var(--text);
}

.container {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--space-5);
}

.icon {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  fill: currentColor;
}

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 767px) {
  .container { padding: 0 var(--space-4); }
}
```

- [ ] **Step 2：提交**

```bash
cd /home/huxint/projects/blog && git add assets/css/base.css && git commit -m "feat(css): add reset and base styles"
```

---

### Task 4: SVG 图标

**Files:**
- Create: `/home/huxint/projects/blog/assets/icons/{github,moon,sun,menu,close,wechat,qq,sparkle}.svg`

所有 SVG 用 `viewBox="0 0 24 24"`，使用 `fill="currentColor"` 或 `stroke="currentColor"` 以便随主题变色。

- [ ] **Step 1：`github.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.93 10.93 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.12 3.04.73.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .3.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
</svg>
```

- [ ] **Step 2：`moon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M21.64 13.02A9 9 0 1 1 10.98 2.36 7 7 0 0 0 21.64 13.02z"/>
</svg>
```

- [ ] **Step 3：`sun.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
</svg>
```

- [ ] **Step 4：`menu.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <line x1="3" y1="6" x2="21" y2="6"/>
  <line x1="3" y1="12" x2="21" y2="12"/>
  <line x1="3" y1="18" x2="21" y2="18"/>
</svg>
```

- [ ] **Step 5：`close.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
  <line x1="18" y1="6" x2="6" y2="18"/>
  <line x1="6" y1="6" x2="18" y2="18"/>
</svg>
```

- [ ] **Step 6：`wechat.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M9.5 4C5.36 4 2 6.69 2 10c0 1.89 1.08 3.56 2.78 4.66L4 17l2.5-1.5c.9.3 1.92.5 3 .5h.4c-.2-.62-.4-1.28-.4-2 0-3.31 3.13-6 7-6h.5C16.5 5.7 13.34 4 9.5 4zM7 8.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM16.5 10c-3.04 0-5.5 2.02-5.5 4.5S13.46 19 16.5 19c.66 0 1.3-.1 1.9-.28L20 20l-.5-1.6c1.5-.85 2.5-2.3 2.5-3.9 0-2.48-2.46-4.5-5.5-4.5zm-1.75 3a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm3.5 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z"/>
</svg>
```

- [ ] **Step 7：`qq.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 1.5.5 2.8 1.3 3.9-.8.7-2 2-2 3.6 0 1.8.9 3 1.8 3.5C6.5 21 7.5 22 9 22h6c1.5 0 2.5-1 3-2 .9-.5 1.7-1.7 1.7-3.5 0-1.6-1.2-2.9-2-3.6.8-1.1 1.3-2.4 1.3-3.9 0-3.87-3.13-7-7-7zm-2.5 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
</svg>
```

- [ ] **Step 8：`sparkle.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"/>
</svg>
```

- [ ] **Step 9：验证所有 SVG 文件存在且能被解析**

Run:
```bash
cd /home/huxint/projects/blog/assets/icons && ls && for f in *.svg; do python3 -c "import xml.etree.ElementTree as ET; ET.parse('$f'); print('$f ok')"; done
```
Expected: 8 个 `<name>.svg ok`，无报错。

- [ ] **Step 10：占位 QR 图片**

Run:
```bash
cd /home/huxint/projects/blog/assets/images && python3 -c "
import struct, zlib
def png(w, h, color):
    sig = b'\x89PNG\r\n\x1a\n'
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    raw = b''.join(b'\x00' + bytes(color)*w for _ in range(h))
    idat = chunk(b'IDAT', zlib.compress(raw))
    return sig + ihdr + idat + chunk(b'IEND', b'')
open('wechat-qr.png','wb').write(png(240,240,[245,239,229]))
open('qq-qr.png','wb').write(png(240,240,[245,239,229]))
print('created placeholders')"
ls -la *.png
```
Expected: 两个 240×240 的浅色占位 PNG（用户后续替换为真实二维码）。

- [ ] **Step 11：提交**

```bash
cd /home/huxint/projects/blog && git add assets/icons assets/images && git commit -m "feat(assets): add SVG icons and QR placeholder images"
```

---

### Task 5: 共享 partials (`header.html` / `footer.html`)

**Files:**
- Create: `/home/huxint/projects/blog/partials/header.html`
- Create: `/home/huxint/projects/blog/partials/footer.html`

partials 是 HTML 片段，被 `main.js` fetch 后 innerHTML 到 `<header data-include>` / `<footer data-include>` 容器里。所以不写 `<html>` / `<body>`。

- [ ] **Step 1：写 `partials/header.html`**

```html
<div class="site-header__inner container">
  <a class="site-brand" href="/" aria-label="huxint 首页">
    <span class="logo" aria-hidden="true">H</span>
    <span class="site-brand__name">huxint</span>
  </a>

  <nav class="site-nav" aria-label="主导航">
    <a class="nav-link" href="/" data-nav="home">首页</a>
    <a class="nav-link" href="/blog.html" data-nav="blog">博客</a>
    <a class="nav-link" href="/projects.html" data-nav="projects">项目</a>
    <a class="nav-link" href="/about.html" data-nav="about">关于</a>
  </nav>

  <div class="site-header__actions">
    <button class="theme-toggle" type="button" aria-label="切换主题">
      <svg data-icon="sun" class="icon theme-icon theme-icon--light"></svg>
      <svg data-icon="moon" class="icon theme-icon theme-icon--dark"></svg>
    </button>
    <button class="hamburger" type="button" aria-label="打开菜单" aria-expanded="false" aria-controls="mobile-drawer">
      <svg data-icon="menu" class="icon"></svg>
    </button>
  </div>
</div>

<div class="mobile-drawer" id="mobile-drawer" hidden>
  <button class="mobile-drawer__close" type="button" aria-label="关闭菜单">
    <svg data-icon="close" class="icon"></svg>
  </button>
  <nav class="mobile-drawer__nav" aria-label="移动端导航">
    <a class="mobile-drawer__link" href="/" data-nav="home">首页</a>
    <a class="mobile-drawer__link" href="/blog.html" data-nav="blog">博客</a>
    <a class="mobile-drawer__link" href="/projects.html" data-nav="projects">项目</a>
    <a class="mobile-drawer__link" href="/about.html" data-nav="about">关于</a>
  </nav>
</div>
```

- [ ] **Step 2：写 `partials/footer.html`**

```html
<div class="site-footer__inner container">
  <span class="site-footer__copy">© 2026 huxint</span>
  <span class="site-footer__sep">·</span>
  <div class="site-footer__links">
    <a href="https://github.com/huxint" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
      <svg data-icon="github" class="icon"></svg>
    </a>
    <button type="button" class="site-footer__qr-trigger" data-qr="wechat" aria-label="微信二维码">
      <svg data-icon="wechat" class="icon"></svg>
    </button>
    <button type="button" class="site-footer__qr-trigger" data-qr="qq" aria-label="QQ 二维码">
      <svg data-icon="qq" class="icon"></svg>
    </button>
    <button type="button" class="site-footer__sparkle" aria-label="闪光彩蛋">
      <svg data-icon="sparkle" class="icon"></svg>
    </button>
  </div>
  <span class="site-footer__sep">·</span>
  <span class="site-footer__version">v0.1</span>
</div>

<div class="modal" id="qr-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
  <div class="modal__overlay" data-modal-close></div>
  <div class="modal__panel">
    <button class="modal__close" type="button" aria-label="关闭" data-modal-close>
      <svg data-icon="close" class="icon"></svg>
    </button>
    <h2 class="modal__title" id="qr-modal-title">扫一扫</h2>
    <img class="modal__qr" id="qr-modal-img" alt="" />
    <p class="modal__caption" id="qr-modal-caption"></p>
  </div>
</div>
```

- [ ] **Step 3：提交**

```bash
cd /home/huxint/projects/blog && git add partials && git commit -m "feat(partials): add shared header and footer with QR modal markup"
```

---

### Task 6: 组件样式 (`components.css`)

**Files:**
- Create: `/home/huxint/projects/blog/assets/css/components.css`

- [ ] **Step 1：创建 `components.css`**

```css
/* ===== Logo ===== */
.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: #fff;
  font-weight: 800;
  font-size: 22px;
  letter-spacing: 0;
  background: linear-gradient(135deg, #FBBF24 0%, #F472B6 40%, #60A5FA 75%, #A78BFA 100%);
  animation: logo-spin 8s linear infinite;
  animation-play-state: paused;
  transition: transform 600ms var(--spring);
}
.logo:hover, .site-brand:hover .logo {
  animation-play-state: running;
}
@keyframes logo-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ===== Site header ===== */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
.site-header__inner {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  height: 64px;
}
.site-brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  font-weight: 800;
  font-size: var(--fs-md);
  letter-spacing: -0.02em;
}
.site-brand__name { color: var(--text); }
.site-nav {
  display: flex;
  gap: var(--space-5);
  margin-left: auto;
}
.nav-link {
  position: relative;
  padding: var(--space-2) var(--space-1);
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-muted);
}
.nav-link:hover { color: var(--text); }
.nav-link::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-pink);
  transform: translate(-50%, 4px);
  opacity: 0;
  transition: transform var(--transition), opacity var(--transition);
}
.nav-link:hover::after { transform: translate(-50%, 0); opacity: 1; }
.nav-link[aria-current='page'] { color: var(--text); }
.nav-link[aria-current='page']::before {
  content: '✦';
  margin-right: 4px;
  color: var(--accent-pink);
}
.site-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.theme-toggle,
.hamburger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-btn);
  color: var(--text);
  transition: background var(--transition);
}
.theme-toggle:hover,
.hamburger:hover { background: var(--bg-elevated); }
.theme-icon { font-size: 18px; }
.theme-icon--dark { display: none; }
:root[data-theme='dark'] .theme-icon--light { display: none; }
:root[data-theme='dark'] .theme-icon--dark  { display: block; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']):not([data-theme='dark']) .theme-icon--light { display: none; }
  :root:not([data-theme='light']):not([data-theme='dark']) .theme-icon--dark  { display: block; }
}
.hamburger { display: none; font-size: 20px; }
@media (max-width: 767px) {
  .site-nav { display: none; }
  .hamburger { display: inline-flex; }
}

/* ===== Mobile drawer ===== */
.mobile-drawer {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding: var(--space-5);
}
.mobile-drawer[hidden] { display: none; }
.mobile-drawer__close {
  align-self: flex-end;
  width: 44px;
  height: 44px;
  font-size: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
}
.mobile-drawer__nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-6);
}
.mobile-drawer__link {
  font-size: var(--fs-xl);
  font-weight: 800;
  letter-spacing: -0.02em;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 300ms ease, transform 300ms ease;
}
.mobile-drawer.is-open .mobile-drawer__link {
  opacity: 1;
  transform: translateY(0);
}
.mobile-drawer.is-open .mobile-drawer__link:nth-child(1) { transition-delay: 50ms; }
.mobile-drawer.is-open .mobile-drawer__link:nth-child(2) { transition-delay: 100ms; }
.mobile-drawer.is-open .mobile-drawer__link:nth-child(3) { transition-delay: 150ms; }
.mobile-drawer.is-open .mobile-drawer__link:nth-child(4) { transition-delay: 200ms; }

/* ===== Theme mask transition ===== */
.theme-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}

/* ===== Buttons ===== */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  font-weight: 700;
  font-size: var(--fs-sm);
  border-radius: var(--radius-btn);
  background: var(--text);
  color: var(--bg);
  border: 1px solid var(--text);
  transition: transform var(--transition), background var(--transition), color var(--transition);
}
.btn:hover {
  transform: translateY(-1px);
  color: var(--bg);
}
.btn--ghost {
  background: transparent;
  color: var(--text);
  border-color: var(--border);
}
.btn--ghost:hover { background: var(--bg-elevated); color: var(--text); }

/* ===== Pills / tags ===== */
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-elevated);
  color: var(--text-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  border: 1px solid var(--border);
}
.pill--yellow { color: #92400E; border-color: var(--accent-yellow); background: color-mix(in srgb, var(--accent-yellow) 12%, var(--bg-elevated)); }
.pill--pink   { color: #9D174D; border-color: var(--accent-pink);   background: color-mix(in srgb, var(--accent-pink)   12%, var(--bg-elevated)); }
.pill--blue   { color: #1E3A8A; border-color: var(--accent-blue);   background: color-mix(in srgb, var(--accent-blue)   12%, var(--bg-elevated)); }
.pill--purple { color: #5B21B6; border-color: var(--accent-purple); background: color-mix(in srgb, var(--accent-purple) 12%, var(--bg-elevated)); }
:root[data-theme='dark'] .pill--yellow { color: #FDE68A; }
:root[data-theme='dark'] .pill--pink   { color: #FBCFE8; }
:root[data-theme='dark'] .pill--blue   { color: #BFDBFE; }
:root[data-theme='dark'] .pill--purple { color: #DDD6FE; }

/* ===== Card with left color bar ===== */
.card {
  position: relative;
  display: block;
  padding: var(--space-5) var(--space-5) var(--space-5) var(--space-6);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: transform var(--transition), box-shadow var(--transition);
  overflow: hidden;
}
.card::before {
  content: '';
  position: absolute;
  left: 0; top: 0;
  width: 4px;
  height: 100%;
  background: var(--accent-blue);
}
.card[data-color='yellow']::before { background: var(--accent-yellow); }
.card[data-color='pink']::before   { background: var(--accent-pink); }
.card[data-color='blue']::before   { background: var(--accent-blue); }
.card[data-color='purple']::before { background: var(--accent-purple); }
.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-card);
}
.card__title { font-size: var(--fs-lg); font-weight: 800; letter-spacing: -0.02em; }
.card__meta  { display: flex; gap: var(--space-2); flex-wrap: wrap; color: var(--text-faint); font-size: var(--fs-xs); margin-top: var(--space-2); }
.card__body  { color: var(--text-muted); margin-top: var(--space-3); line-height: var(--lh-base); }
.card__tags  { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-top: var(--space-3); }
.card-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

/* ===== Modal ===== */
.modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal[hidden] { display: none; }
.modal__overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  opacity: 0;
  transition: opacity var(--transition);
}
.modal.is-open .modal__overlay { opacity: 1; }
.modal__panel {
  position: relative;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-6);
  min-width: 280px;
  max-width: 320px;
  text-align: center;
  transform: scale(0.92);
  opacity: 0;
  transition: transform 250ms var(--spring), opacity var(--transition);
}
.modal.is-open .modal__panel { transform: scale(1); opacity: 1; }
.modal__close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  font-size: 16px;
}
.modal__close:hover { background: var(--bg-elevated); }
.modal__title {
  font-size: var(--fs-md);
  font-weight: 800;
  margin-bottom: var(--space-4);
}
.modal__qr {
  width: 240px;
  height: 240px;
  margin: 0 auto;
  border-radius: var(--radius-sm);
}
.modal__caption {
  margin-top: var(--space-3);
  color: var(--text-muted);
  font-size: var(--fs-sm);
}

/* ===== Site footer ===== */
.site-footer {
  border-top: 1px solid var(--border);
  margin-top: var(--space-12);
  padding: var(--space-6) 0;
}
.site-footer__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: var(--fs-sm);
}
.site-footer__links {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}
.site-footer__links button,
.site-footer__links a {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 16px;
  transition: background var(--transition), color var(--transition);
}
.site-footer__links button:hover,
.site-footer__links a:hover {
  background: var(--bg-elevated);
  color: var(--text);
}
.site-footer__sparkle:hover {
  animation: sparkle-bounce 600ms var(--spring);
  color: var(--accent-pink);
}
@keyframes sparkle-bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
.site-footer__sep { color: var(--text-faint); }

/* ===== Hero ===== */
.hero {
  padding: var(--space-9) 0 var(--space-8);
  text-align: left;
}
.hero__top { display: inline-flex; align-items: center; gap: var(--space-4); }
.hero__logo { width: 64px; height: 64px; font-size: 32px; border-radius: 16px; }
.hero__title {
  font-size: clamp(var(--fs-2xl), 6vw, var(--fs-4xl));
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: var(--lh-tight);
  margin-top: var(--space-5);
}
.hero__title .sparkle { color: var(--accent-yellow); }
.hero__subtitle {
  color: var(--text-muted);
  font-size: var(--fs-md);
  margin-top: var(--space-4);
  max-width: 640px;
}
.hero__stack {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-5);
}
.hero__socials {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-5);
  color: var(--text-muted);
}
.hero__socials a:hover { color: var(--text); }
.hero__socials .icon { font-size: 22px; }

/* ===== Heatmap ===== */
.heatmap-section {
  padding: var(--space-7) 0;
  border-top: 1px solid var(--border);
  margin-top: var(--space-7);
}
.heatmap-section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-5);
  gap: var(--space-4);
  flex-wrap: wrap;
}
.heatmap-section__title { font-size: var(--fs-xl); font-weight: 800; letter-spacing: -0.02em; }
.heatmap-section__meta  { color: var(--text-muted); font-size: var(--fs-sm); }
.heatmap-grid {
  width: 100%;
  overflow-x: auto;
  padding-bottom: var(--space-2);
}
.heatmap-grid svg {
  display: block;
  min-width: 720px;
}
.heatmap-cell {
  fill: var(--bg-elevated);
  stroke: var(--border);
  stroke-width: 1;
}
.heatmap-cell[data-level='1'] { fill: color-mix(in srgb, var(--accent-blue) 25%, var(--bg-elevated)); }
.heatmap-cell[data-level='2'] { fill: color-mix(in srgb, var(--accent-blue) 50%, var(--bg-elevated)); }
.heatmap-cell[data-level='3'] { fill: color-mix(in srgb, var(--accent-blue) 75%, var(--bg-elevated)); }
.heatmap-cell[data-level='4'] { fill: var(--accent-blue); }
.heatmap-legend {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-faint);
  font-size: var(--fs-xs);
  margin-top: var(--space-3);
}
.heatmap-legend__cell {
  display: inline-block;
  width: 12px; height: 12px;
  border-radius: 2px;
  background: var(--bg-elevated);
}
.heatmap-fallback {
  padding: var(--space-5);
  background: var(--bg-elevated);
  border-radius: var(--radius);
  color: var(--text-muted);
  text-align: center;
}

/* ===== Section heading ===== */
.section {
  padding: var(--space-7) 0;
}
.section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
  gap: var(--space-3);
}
.section__title { font-size: var(--fs-xl); font-weight: 800; letter-spacing: -0.02em; }
.section__title .sparkle { color: var(--accent-pink); }
.section__cta { color: var(--text-muted); font-size: var(--fs-sm); }
.section__cta:hover { color: var(--text); }

/* ===== Blog list ===== */
.year-group { margin-top: var(--space-6); }
.year-group__year {
  font-size: var(--fs-md);
  font-weight: 800;
  color: var(--text-faint);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: var(--space-3);
}
.entry-list { display: flex; flex-direction: column; gap: var(--space-3); }
.entry {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius);
  border: 1px solid transparent;
  transition: border var(--transition), background var(--transition);
}
.entry:hover { background: var(--bg-elevated); border-color: var(--border); }
.entry__date { color: var(--text-faint); font-variant-numeric: tabular-nums; font-size: var(--fs-sm); }
.entry__title { font-size: var(--fs-md); font-weight: 800; letter-spacing: -0.01em; }
.entry__summary { color: var(--text-muted); margin-top: var(--space-2); font-size: var(--fs-sm); }
.entry__meta { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap; }
.entry__reading { color: var(--text-faint); font-size: var(--fs-xs); }
@media (max-width: 767px) {
  .entry { grid-template-columns: 1fr; }
}

/* ===== Post layout ===== */
.reading-progress {
  position: fixed;
  top: 0; left: 0;
  height: 3px;
  width: 0;
  z-index: 60;
  background: linear-gradient(90deg, var(--accent-yellow), var(--accent-pink), var(--accent-blue), var(--accent-purple));
  transition: width 60ms linear;
}
.post-shell { padding: var(--space-7) 0 var(--space-8); }
.post-header { max-width: var(--content); margin: 0 auto var(--space-6); }
.post-header__title {
  font-size: clamp(var(--fs-2xl), 5vw, var(--fs-3xl));
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: var(--lh-tight);
}
.post-header__meta {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: var(--fs-sm);
  margin-top: var(--space-4);
}
.post-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--space-5);
}
.post-toc-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
}
.post-toc {
  position: sticky;
  top: 96px;
  align-self: start;
  font-size: var(--fs-sm);
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding-left: var(--space-3);
}
.post-toc__list { display: flex; flex-direction: column; gap: var(--space-1); }
.post-toc__item { display: block; padding: 4px 0; color: var(--text-faint); transition: color var(--transition); }
.post-toc__item--h3 { padding-left: var(--space-3); }
.post-toc__item:hover { color: var(--text); }
.post-toc__item.is-active { color: var(--text); font-weight: 700; }
.post-toc__item.is-active::before { content: '✦ '; color: var(--accent-pink); }
@media (min-width: 1024px) {
  .post-layout {
    grid-template-columns: minmax(0, 720px) 200px;
    justify-content: center;
    gap: var(--space-7);
  }
  .post-toc-toggle { display: none; }
}
@media (max-width: 1023px) {
  .post-toc {
    position: static;
    max-height: none;
    overflow: visible;
    border-top: 1px solid var(--border);
    padding: var(--space-4) 0 0;
  }
  .post-toc[hidden] { display: none; }
}

.post-nav {
  max-width: var(--content);
  margin: var(--space-7) auto 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.post-nav__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  font-size: var(--fs-sm);
}
.post-nav__card span { color: var(--text-faint); font-size: var(--fs-xs); }
.post-nav__card strong { font-weight: 700; color: var(--text); }
.post-nav__card--placeholder { opacity: 0.4; pointer-events: none; }

.comments {
  max-width: var(--content);
  margin: var(--space-7) auto 0;
}

/* ===== Tech pill grouping in About ===== */
.stack-group { margin-top: var(--space-5); }
.stack-group__label { color: var(--text-faint); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--space-2); }
.stack-group__items { display: flex; gap: var(--space-2); flex-wrap: wrap; }

/* ===== Avatar (about) ===== */
.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FBBF24 0%, #F472B6 40%, #60A5FA 75%, #A78BFA 100%);
}

/* ===== 404 ===== */
.not-found {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.not-found__code {
  font-size: clamp(80px, 18vw, 160px);
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(135deg, #FBBF24 0%, #F472B6 40%, #60A5FA 75%, #A78BFA 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.not-found__msg { color: var(--text-muted); margin: var(--space-4) 0 var(--space-5); }

/* ===== Noscript fallback header ===== */
.noscript-header {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  font-size: var(--fs-sm);
}

/* ===== Body lock when modal/drawer open ===== */
body.no-scroll { overflow: hidden; }
```

- [ ] **Step 2：验证 CSS 文件加载（语法 sanity）**

Run:
```bash
cd /home/huxint/projects/blog && python3 -c "
content = open('assets/css/components.css').read()
opens = content.count('{')
closes = content.count('}')
assert opens == closes, f'brace mismatch: {opens} vs {closes}'
print('braces ok:', opens)"
```
Expected: `braces ok: <某个数字>`，无 AssertionError。

- [ ] **Step 3：提交**

```bash
cd /home/huxint/projects/blog && git add assets/css/components.css && git commit -m "feat(css): add component styles"
```

---

### Task 7: `main.js` — partials 与 icon 注入

**Files:**
- Create: `/home/huxint/projects/blog/assets/js/main.js`

`main.js` 分三轮 init：(1) 注入 partials 后触发"partials ready"事件 → (2) 注入 icons + 绑定主题/菜单/modal → (3) 标记当前页 nav-link `aria-current`。

- [ ] **Step 1：创建 `main.js` 骨架与 partials 注入**

```javascript
(() => {
  'use strict';

  const ready = (fn) =>
    document.readyState !== 'loading'
      ? fn()
      : document.addEventListener('DOMContentLoaded', fn);

  async function injectIncludes(root = document) {
    const nodes = root.querySelectorAll('[data-include]');
    await Promise.all(
      [...nodes].map(async (el) => {
        const url = el.getAttribute('data-include');
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(res.status);
          el.innerHTML = await res.text();
        } catch (err) {
          console.warn('[main] failed to include', url, err);
        }
      })
    );
  }

  async function injectIcons(root = document) {
    const nodes = root.querySelectorAll('svg[data-icon]');
    await Promise.all(
      [...nodes].map(async (el) => {
        const name = el.getAttribute('data-icon');
        const klass = el.getAttribute('class') || '';
        try {
          const res = await fetch(`/assets/icons/${name}.svg`, { cache: 'force-cache' });
          if (!res.ok) throw new Error(res.status);
          const markup = await res.text();
          const wrap = document.createElement('div');
          wrap.innerHTML = markup.trim();
          const svg = wrap.firstElementChild;
          if (!svg || svg.tagName.toLowerCase() !== 'svg') return;
          if (klass) svg.setAttribute('class', klass);
          svg.setAttribute('data-icon', name);
          el.replaceWith(svg);
        } catch (err) {
          console.warn('[main] failed to load icon', name, err);
        }
      })
    );
  }

  function markCurrentNav() {
    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    const key = (() => {
      if (path === '/' || path === '') return 'home';
      if (path.startsWith('/blog')) return 'blog';
      if (path.startsWith('/posts/')) return 'blog';
      if (path.startsWith('/projects')) return 'projects';
      if (path.startsWith('/about')) return 'about';
      return null;
    })();
    if (!key) return;
    document
      .querySelectorAll(`[data-nav="${key}"]`)
      .forEach((el) => el.setAttribute('aria-current', 'page'));
  }

  ready(async () => {
    await injectIncludes();
    await injectIcons();
    markCurrentNav();
    document.dispatchEvent(new CustomEvent('site:ready'));
  });

  window.__site = { injectIncludes, injectIcons };
})();
```

- [ ] **Step 2：JS 语法检查**

Run:
```bash
cd /home/huxint/projects/blog && node --check assets/js/main.js && echo ok
```
Expected: `ok`。

- [ ] **Step 3：提交**

```bash
cd /home/huxint/projects/blog && git add assets/js/main.js && git commit -m "feat(js): inject partials and SVG icons via main.js"
```

---

### Task 8: `main.js` — 主题切换（含圆形 mask 过渡）

**Files:**
- Modify: `/home/huxint/projects/blog/assets/js/main.js`

- [ ] **Step 1：在 `main.js` 的 IIFE 内、`ready()` 调用前插入主题逻辑**

在 `function markCurrentNav() { ... }` 之后、`ready(async () => {` 之前，加入：

```javascript
  const THEME_KEY = 'theme';

  function readStoredTheme() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  }

  function applyTheme(theme) {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  function nextTheme(current, prefersDark) {
    const effective =
      current === 'system' ? (prefersDark ? 'dark' : 'light') : current;
    return effective === 'dark' ? 'light' : 'dark';
  }

  function runMaskTransition(originX, originY) {
    if (!document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      return null;
    }
    const mask = document.createElement('div');
    mask.className = 'theme-mask';
    const radius = Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY)
    );
    mask.style.background = `radial-gradient(circle at ${originX}px ${originY}px, var(--bg) 0, var(--bg) 0)`;
    mask.style.transition = 'background 500ms ease';
    document.body.appendChild(mask);
    requestAnimationFrame(() => {
      mask.style.background = `radial-gradient(circle at ${originX}px ${originY}px, var(--bg) ${radius}px, transparent ${radius}px)`;
    });
    setTimeout(() => mask.remove(), 520);
    return mask;
  }

  function initThemeToggle() {
    applyTheme(readStoredTheme());
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    document.body.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.theme-toggle');
      if (!btn) return;
      const stored = readStoredTheme();
      const target = nextTheme(stored, mql.matches);
      const rect = btn.getBoundingClientRect();
      runMaskTransition(rect.left + rect.width / 2, rect.top + rect.height / 2);
      try { localStorage.setItem(THEME_KEY, target); } catch {}
      applyTheme(target);
      document.dispatchEvent(new CustomEvent('site:themechange', { detail: { theme: target } }));
    });

    mql.addEventListener('change', () => {
      if (readStoredTheme() === 'system') {
        document.dispatchEvent(new CustomEvent('site:themechange', { detail: { theme: 'system' } }));
      }
    });
  }
```

- [ ] **Step 2：在 `ready(async () => {` 内的 `markCurrentNav();` 之后调用 `initThemeToggle();`**

修改：
```javascript
  ready(async () => {
    await injectIncludes();
    await injectIcons();
    markCurrentNav();
    initThemeToggle();
    document.dispatchEvent(new CustomEvent('site:ready'));
  });
```

- [ ] **Step 3：在 IIFE 文件最顶部、`(() => {` 之后立刻执行 inline 主题恢复，避免 FOUC**

紧跟 `'use strict';` 之后插入：
```javascript
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch {}
```

- [ ] **Step 4：JS 语法检查**

Run:
```bash
cd /home/huxint/projects/blog && node --check assets/js/main.js && echo ok
```
Expected: `ok`。

- [ ] **Step 5：提交**

```bash
cd /home/huxint/projects/blog && git add assets/js/main.js && git commit -m "feat(js): add theme toggle with system fallback and mask transition"
```

---

### Task 9: `main.js` — 移动端抽屉 + QR modal

**Files:**
- Modify: `/home/huxint/projects/blog/assets/js/main.js`

- [ ] **Step 1：在 `initThemeToggle` 函数之后追加 drawer 与 modal 逻辑**

```javascript
  function initMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    if (!drawer) return;
    const open = () => {
      drawer.hidden = false;
      requestAnimationFrame(() => drawer.classList.add('is-open'));
      document.body.classList.add('no-scroll');
      const trigger = document.querySelector('.hamburger');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      drawer.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      const trigger = document.querySelector('.hamburger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      setTimeout(() => { drawer.hidden = true; }, 200);
    };

    document.body.addEventListener('click', (ev) => {
      if (ev.target.closest('.hamburger')) { open(); return; }
      if (ev.target.closest('.mobile-drawer__close')) { close(); return; }
      if (ev.target.closest('.mobile-drawer__link')) { close(); return; }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !drawer.hidden) close();
    });
  }

  const QR_MAP = {
    wechat: { img: '/assets/images/wechat-qr.png', caption: '微信扫一扫，加我好友' },
    qq:     { img: '/assets/images/qq-qr.png',     caption: 'QQ 扫一扫' },
  };

  function initQrModal() {
    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    const img = modal.querySelector('#qr-modal-img');
    const cap = modal.querySelector('#qr-modal-caption');
    let lastTrigger = null;

    const open = (trigger) => {
      const key = trigger.dataset.qr;
      const data = QR_MAP[key];
      if (!data) return;
      img.src = data.img;
      img.alt = data.caption;
      cap.textContent = data.caption;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => modal.classList.add('is-open'));
      document.body.classList.add('no-scroll');
      lastTrigger = trigger;
    };
    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      setTimeout(() => { modal.hidden = true; }, 200);
      if (lastTrigger) { lastTrigger.focus(); lastTrigger = null; }
    };

    document.body.addEventListener('click', (ev) => {
      const trigger = ev.target.closest('[data-qr]');
      if (trigger) { open(trigger); return; }
      if (ev.target.closest('[data-modal-close]')) { close(); return; }
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !modal.hidden) close();
    });
  }
```

- [ ] **Step 2：在 `ready` 回调中接续调用**

把 ready 块改为：
```javascript
  ready(async () => {
    await injectIncludes();
    await injectIcons();
    markCurrentNav();
    initThemeToggle();
    initMobileDrawer();
    initQrModal();
    document.dispatchEvent(new CustomEvent('site:ready'));
  });
```

- [ ] **Step 3：JS 语法检查**

Run:
```bash
cd /home/huxint/projects/blog && node --check assets/js/main.js && echo ok
```
Expected: `ok`。

- [ ] **Step 4：提交**

```bash
cd /home/huxint/projects/blog && git add assets/js/main.js && git commit -m "feat(js): add mobile drawer and QR modal interactions"
```

---

### Task 10: 数据文件 (`posts.json` / `projects.json`)

**Files:**
- Create: `/home/huxint/projects/blog/data/posts.json`
- Create: `/home/huxint/projects/blog/data/projects.json`

- [ ] **Step 1：`data/posts.json`**

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

- [ ] **Step 2：`data/projects.json`**

```json
[
  {
    "name": "huxint.github.io",
    "description": "这个博客的源码，纯静态 HTML/CSS/JS，无构建。",
    "url": "https://github.com/huxint/huxint.github.io",
    "language": "HTML",
    "stars": 1,
    "color": "pink",
    "featured": true
  },
  {
    "name": "free-code",
    "description": "一个用来折腾的小工具。",
    "url": "https://github.com/huxint/free-code",
    "language": "Go",
    "stars": 12,
    "color": "blue",
    "featured": false
  },
  {
    "name": "rust-playground",
    "description": "Rust 学习笔记和示例集合。",
    "url": "https://github.com/huxint/rust-playground",
    "language": "Rust",
    "stars": 5,
    "color": "yellow",
    "featured": false
  }
]
```

- [ ] **Step 3：JSON 语法校验**

Run:
```bash
cd /home/huxint/projects/blog && python3 -c "
import json
for p in ['data/posts.json', 'data/projects.json']:
    data = json.load(open(p))
    print(p, 'ok,', len(data), 'items')"
```
Expected:
```
data/posts.json ok, 1 items
data/projects.json ok, 3 items
```

- [ ] **Step 4：提交**

```bash
cd /home/huxint/projects/blog && git add data && git commit -m "feat(data): add posts and projects metadata"
```

---

### Task 11: 首页 `index.html`

**Files:**
- Create: `/home/huxint/projects/blog/index.html`

- [ ] **Step 1：写 `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="huxint 的个人博客 —— 写一点代码、想法和折腾过程。">
  <title>huxint ✦ 个人博客</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/components.css">
</head>
<body>
  <header class="site-header" data-include="/partials/header.html"></header>
  <noscript>
    <nav class="noscript-header">
      <a href="/"><strong>huxint</strong></a>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/projects.html">项目</a>
      <a href="/about.html">关于</a>
    </nav>
  </noscript>

  <main>
    <section class="hero container">
      <div class="hero__top">
        <span class="logo hero__logo" aria-hidden="true">H</span>
      </div>
      <h1 class="hero__title">嗨，我是 huxint <span class="sparkle">✦</span></h1>
      <p class="hero__subtitle">折腾一点工程，写一点想法。在这里记录我学的东西、做的小项目，以及一些不成熟的看法。</p>
      <div class="hero__stack">
        <span class="pill pill--yellow">C++</span>
        <span class="pill pill--pink">Rust</span>
        <span class="pill pill--blue">Python</span>
        <span class="pill pill--purple">Go</span>
      </div>
      <div class="hero__socials">
        <a href="https://github.com/huxint" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg data-icon="github" class="icon"></svg>
        </a>
      </div>
    </section>

    <section class="heatmap-section container">
      <div class="heatmap-section__header">
        <h2 class="heatmap-section__title">GitHub 贡献</h2>
        <span class="heatmap-section__meta" id="heatmap-meta"></span>
      </div>
      <div class="heatmap-grid" id="heatmap-grid">
        <p class="heatmap-fallback" id="heatmap-fallback">加载中 ✦</p>
      </div>
      <div class="heatmap-legend" id="heatmap-legend" hidden>
        <span>少</span>
        <span class="heatmap-legend__cell" data-level="0"></span>
        <span class="heatmap-legend__cell" data-level="1"></span>
        <span class="heatmap-legend__cell" data-level="2"></span>
        <span class="heatmap-legend__cell" data-level="3"></span>
        <span class="heatmap-legend__cell" data-level="4"></span>
        <span>多</span>
      </div>
    </section>

    <section class="section container">
      <div class="section__header">
        <h2 class="section__title">最新文章 <span class="sparkle">✦</span></h2>
        <a class="section__cta" href="/blog.html">看全部文章 →</a>
      </div>
      <div class="card-grid" id="latest-posts">
        <p style="color: var(--text-faint);">加载中…</p>
      </div>
    </section>
  </main>

  <footer class="site-footer" data-include="/partials/footer.html"></footer>

  <script src="/assets/js/main.js" defer></script>
  <script src="/assets/js/heatmap.js" defer></script>
  <script defer>
    (async () => {
      const mount = document.getElementById('latest-posts');
      try {
        const res = await fetch('/data/posts.json', { cache: 'no-cache' });
        const posts = await res.json();
        const top = posts
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 3);
        if (!top.length) {
          mount.innerHTML = '<p style="color: var(--text-faint);">还没有文章 ✦</p>';
          return;
        }
        mount.innerHTML = top.map((p) => `
          <a class="card" data-color="${p.color}" href="/posts/${p.slug}.html">
            <h3 class="card__title">${p.title}</h3>
            <div class="card__meta">
              <span>${p.date}</span>
              <span>·</span>
              <span>${p.readingTime} 分钟</span>
            </div>
            <p class="card__body">${p.summary}</p>
            <div class="card__tags">${p.tags.map((t) => `<span class="pill">${t}</span>`).join('')}</div>
          </a>
        `).join('');
      } catch (err) {
        console.warn(err);
        mount.innerHTML = '<p style="color: var(--text-faint);">暂时拉不到文章列表 ✦</p>';
      }
    })();
  </script>
</body>
</html>
```

- [ ] **Step 2：启动本地服务器并 smoke-test**

Run:
```bash
cd /home/huxint/projects/blog && python3 -m http.server 8000 >/tmp/blog-server.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
curl -s http://localhost:8000/ | grep -c 'hero__title'
```
Expected:
```
200
1
```

- [ ] **Step 3：停掉本地服务器**

```bash
pkill -f 'http.server 8000' || true
```

- [ ] **Step 4：提交**

```bash
cd /home/huxint/projects/blog && git add index.html && git commit -m "feat(pages): add index.html with hero, heatmap mount, latest posts"
```

---

### Task 12: 贡献热力图 API 验证 + `heatmap.js`

**Files:**
- Create: `/home/huxint/projects/blog/assets/js/heatmap.js`

- [ ] **Step 1：先用 curl 验证主 API 可用**

Run:
```bash
curl -sS -o /tmp/heat.json -w "HTTP %{http_code} %{size_download}B\n" \
  'https://github-contributions-api.deno.dev/v1/huxint.json' || true
head -c 400 /tmp/heat.json; echo
python3 -c "
import json
d = json.load(open('/tmp/heat.json'))
print('top-level keys:', list(d.keys())[:6])
if 'contributions' in d:
    s = d['contributions']
    print('contributions type:', type(s).__name__)
    if isinstance(s, list):
        print('count:', len(s))
        print('sample:', s[0] if s else None)
    elif isinstance(s, dict):
        # some APIs nest by year
        first_year = next(iter(s))
        print('year:', first_year, 'len:', len(s[first_year]))
        print('sample:', s[first_year][0] if s[first_year] else None)" || true
```
Expected: HTTP 200 + 一个 JSON 含 `contributions` 字段。如果失败：再试备选 `https://github-contributions.vercel.app/api/v1/huxint`。

**注意**：根据 curl 实际返回的 schema 调整下面 `parse()` 实现。下面给的是基于 deno API 的常见 schema（`contributions` 是数组，每项含 `date`、`contributionCount` 或 `count`、`level`）；如有差异，按实际字段名修正。

- [ ] **Step 2：写 `heatmap.js`**

```javascript
(() => {
  'use strict';

  const API_PRIMARY  = 'https://github-contributions-api.deno.dev/v1/huxint.json';
  const API_FALLBACK = 'https://github-contributions.vercel.app/api/v1/huxint';
  const USER = 'huxint';

  function flatten(data) {
    if (!data) return [];
    const c = data.contributions;
    if (Array.isArray(c)) return c;
    if (c && typeof c === 'object') {
      return Object.keys(c).flatMap((y) => Array.isArray(c[y]) ? c[y] : []);
    }
    return [];
  }

  function normalize(items) {
    return items
      .map((it) => {
        const date = it.date;
        const count = it.contributionCount ?? it.count ?? 0;
        let level = it.level;
        if (typeof level !== 'number') {
          if (count === 0) level = 0;
          else if (count < 3) level = 1;
          else if (count < 6) level = 2;
          else if (count < 10) level = 3;
          else level = 4;
        }
        return { date, count, level };
      })
      .filter((it) => it.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function buildGrid(items) {
    if (!items.length) return { weeks: [], total: 0 };
    const lastDate = new Date(items[items.length - 1].date);
    const days = 53 * 7;
    const start = new Date(lastDate);
    start.setDate(start.getDate() - days + 1);
    while (start.getDay() !== 0) {
      start.setDate(start.getDate() - 1);
    }
    const byDate = new Map(items.map((d) => [d.date, d]));
    const weeks = [];
    let cur = new Date(start);
    for (let w = 0; w < 53; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const iso = cur.toISOString().slice(0, 10);
        const entry = byDate.get(iso);
        col.push({
          date: iso,
          count: entry ? entry.count : 0,
          level: entry ? entry.level : 0,
        });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(col);
    }
    let total = 0;
    items.forEach((it) => { total += (it.count || 0); });
    return { weeks, total };
  }

  function render(target, weeks) {
    const cellSize = 12;
    const gap = 3;
    const w = weeks.length * (cellSize + gap);
    const h = 7 * (cellSize + gap);
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'GitHub 贡献热力图');

    weeks.forEach((col, wi) => {
      col.forEach((cell, di) => {
        const rect = document.createElementNS(svgNs, 'rect');
        rect.setAttribute('x', String(wi * (cellSize + gap)));
        rect.setAttribute('y', String(di * (cellSize + gap)));
        rect.setAttribute('width', String(cellSize));
        rect.setAttribute('height', String(cellSize));
        rect.setAttribute('rx', '2');
        rect.setAttribute('class', 'heatmap-cell');
        rect.setAttribute('data-level', String(cell.level));
        const title = document.createElementNS(svgNs, 'title');
        title.textContent = `${cell.date} · ${cell.count} 次提交`;
        rect.appendChild(title);
        svg.appendChild(rect);
      });
    });

    target.innerHTML = '';
    target.appendChild(svg);
  }

  async function tryFetch(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function init() {
    const grid = document.getElementById('heatmap-grid');
    const meta = document.getElementById('heatmap-meta');
    const legend = document.getElementById('heatmap-legend');
    const fallback = document.getElementById('heatmap-fallback');
    if (!grid) return;

    let data;
    try {
      data = await tryFetch(API_PRIMARY);
    } catch (err1) {
      console.warn('[heatmap] primary failed', err1);
      try {
        data = await tryFetch(API_FALLBACK);
      } catch (err2) {
        console.warn('[heatmap] fallback failed', err2);
        if (fallback) {
          fallback.innerHTML =
            '暂时拉不到 GitHub 贡献数据 ✦ ' +
            `<a href="https://github.com/${USER}" target="_blank" rel="noopener">直接看 GitHub →</a>`;
        }
        return;
      }
    }

    const items = normalize(flatten(data));
    if (!items.length) {
      if (fallback) fallback.textContent = '暂时还没有公开贡献数据 ✦';
      return;
    }
    const { weeks, total } = buildGrid(items);
    render(grid, weeks);
    if (meta) meta.textContent = `过去一年 ${total} 次贡献`;
    if (legend) legend.hidden = false;
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 3：JS 语法检查**

Run:
```bash
cd /home/huxint/projects/blog && node --check assets/js/heatmap.js && echo ok
```
Expected: `ok`。

- [ ] **Step 4：提交**

```bash
cd /home/huxint/projects/blog && git add assets/js/heatmap.js && git commit -m "feat(js): add GitHub contribution heatmap renderer"
```

---

### Task 13: 博客列表 `blog.html` + `blog.js`

**Files:**
- Create: `/home/huxint/projects/blog/blog.html`
- Create: `/home/huxint/projects/blog/assets/js/blog.js`

- [ ] **Step 1：写 `blog.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>所有文章 ✦ huxint</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/components.css">
</head>
<body>
  <header class="site-header" data-include="/partials/header.html"></header>
  <noscript>
    <nav class="noscript-header">
      <a href="/"><strong>huxint</strong></a>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/projects.html">项目</a>
      <a href="/about.html">关于</a>
    </nav>
  </noscript>

  <main class="container">
    <section class="section">
      <div class="section__header">
        <h1 class="section__title">所有文章 <span class="sparkle">✦</span></h1>
      </div>
      <p style="color: var(--text-muted); max-width: 640px;">这里是我所有写过的文章。按年份倒序排列。</p>
      <div id="blog-list" class="entry-list" style="margin-top: var(--space-6);">
        <p style="color: var(--text-faint);">加载中…</p>
      </div>
    </section>
  </main>

  <footer class="site-footer" data-include="/partials/footer.html"></footer>

  <script src="/assets/js/main.js" defer></script>
  <script src="/assets/js/blog.js" defer></script>
</body>
</html>
```

- [ ] **Step 2：写 `assets/js/blog.js`**

```javascript
(() => {
  'use strict';

  async function init() {
    const mount = document.getElementById('blog-list');
    if (!mount) return;
    let posts;
    try {
      const res = await fetch('/data/posts.json', { cache: 'no-cache' });
      posts = await res.json();
    } catch (err) {
      console.warn(err);
      mount.innerHTML = '<p style="color: var(--text-faint);">暂时拉不到文章列表 ✦</p>';
      return;
    }
    if (!posts.length) {
      mount.innerHTML = '<p style="color: var(--text-faint);">还没有文章，敬请期待 ✦</p>';
      return;
    }
    const sorted = posts.slice().sort((a, b) => b.date.localeCompare(a.date));
    const groups = {};
    sorted.forEach((p) => {
      const year = p.date.slice(0, 4);
      (groups[year] = groups[year] || []).push(p);
    });

    mount.innerHTML = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((year) => `
        <section class="year-group">
          <h2 class="year-group__year">${year}</h2>
          <div class="entry-list">
            ${groups[year].map((p) => `
              <a class="entry" href="/posts/${p.slug}.html">
                <div class="entry__date">${p.date}</div>
                <div>
                  <div class="entry__title">${p.title}</div>
                  <div class="entry__summary">${p.summary}</div>
                  <div class="entry__meta">
                    ${p.tags.map((t) => `<span class="pill pill--${p.color}">${t}</span>`).join('')}
                    <span class="entry__reading">· ${p.readingTime} 分钟</span>
                  </div>
                </div>
              </a>
            `).join('')}
          </div>
        </section>
      `).join('');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 3：语法校验**

Run:
```bash
cd /home/huxint/projects/blog && node --check assets/js/blog.js && echo ok
```
Expected: `ok`。

- [ ] **Step 4：提交**

```bash
cd /home/huxint/projects/blog && git add blog.html assets/js/blog.js && git commit -m "feat(pages): add blog list page"
```

---

### Task 14: 文章正文样式 `prose.css`

**Files:**
- Create: `/home/huxint/projects/blog/assets/css/prose.css`

- [ ] **Step 1：写 `prose.css`**

```css
.prose {
  font-size: var(--fs-md);
  line-height: var(--lh-prose);
  color: var(--text);
  max-width: var(--content);
  margin: 0 auto;
}
.prose > * + * { margin-top: 1.4em; }
.prose h1, .prose h2, .prose h3, .prose h4 {
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: var(--lh-tight);
  scroll-margin-top: 96px;
}
.prose h1 { font-size: var(--fs-2xl); margin-top: 1.8em; }
.prose h2 { font-size: var(--fs-xl);  margin-top: 1.8em; padding-bottom: var(--space-2); border-bottom: 1px solid var(--border); }
.prose h3 { font-size: var(--fs-lg);  margin-top: 1.6em; }
.prose h4 { font-size: var(--fs-md);  margin-top: 1.4em; }
.prose h2::before { content: '✦ '; color: var(--accent-pink); }
.prose h3::before { content: '✦ '; color: var(--accent-blue); opacity: 0.6; }
.prose p { color: var(--text); }
.prose a {
  color: var(--accent-blue);
  border-bottom: 1px dashed currentColor;
}
.prose a:hover { color: var(--accent-pink); }
.prose strong { font-weight: 800; color: var(--text); }
.prose em { font-style: italic; }
.prose code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--accent-pink);
}
.prose pre {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  line-height: 1.6;
  padding: var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}
.prose pre code {
  padding: 0;
  background: transparent;
  border: 0;
  color: inherit;
  font-size: inherit;
}
.prose ul, .prose ol { padding-left: 1.5em; }
.prose ul { list-style: disc; }
.prose ol { list-style: decimal; }
.prose ul ::marker { color: var(--accent-pink); }
.prose ol ::marker { color: var(--accent-blue); }
.prose li + li { margin-top: 0.5em; }
.prose blockquote {
  padding: var(--space-4) var(--space-5);
  border-left: 4px solid var(--accent-yellow);
  background: var(--bg-elevated);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-muted);
}
.prose img { border-radius: var(--radius-sm); }
.prose hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: var(--space-7) 0;
}
.prose table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
.prose table th,
.prose table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.prose table th {
  background: var(--bg-elevated);
  font-weight: 800;
}

/* Prism 主题覆盖 —— 用马卡龙四色 */
.prose pre[class*='language-'] { background: var(--bg-elevated); }
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: var(--text-faint); font-style: italic; }
.token.punctuation { color: var(--text-muted); }
.token.property, .token.tag, .token.constant, .token.symbol, .token.deleted { color: var(--accent-pink); }
.token.boolean, .token.number { color: var(--accent-yellow); }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: var(--accent-blue); }
.token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string, .token.variable { color: var(--accent-purple); }
.token.atrule, .token.attr-value, .token.function, .token.class-name { color: var(--accent-pink); }
.token.keyword { color: var(--accent-purple); font-weight: 700; }
.token.regex, .token.important { color: var(--accent-yellow); }
.token.important, .token.bold { font-weight: 800; }
.token.italic { font-style: italic; }
```

- [ ] **Step 2：括号校验**

Run:
```bash
cd /home/huxint/projects/blog && python3 -c "
c = open('assets/css/prose.css').read()
print('braces:', c.count('{'), c.count('}'))
assert c.count('{') == c.count('}')"
```
Expected: 两个数字相等。

- [ ] **Step 3：提交**

```bash
cd /home/huxint/projects/blog && git add assets/css/prose.css && git commit -m "feat(css): add prose typography with prism overrides"
```

---

### Task 15: 示例文章 `posts/2026-05-23-hello-world.html`

**Files:**
- Create: `/home/huxint/projects/blog/posts/2026-05-23-hello-world.html`

- [ ] **Step 1：写文章 HTML**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hello, World ✦ huxint</title>
  <meta name="description" content="博客的第一篇文章，聊聊为什么从零自己写。">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/components.css">
  <link rel="stylesheet" href="/assets/css/prose.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css">
  <meta name="post-slug" content="2026-05-23-hello-world">
</head>
<body>
  <div class="reading-progress" id="reading-progress"></div>

  <header class="site-header" data-include="/partials/header.html"></header>
  <noscript>
    <nav class="noscript-header">
      <a href="/"><strong>huxint</strong></a>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/projects.html">项目</a>
      <a href="/about.html">关于</a>
    </nav>
  </noscript>

  <main class="post-shell">
    <div class="post-header container">
      <h1 class="post-header__title">Hello, World <span style="color: var(--accent-pink);">✦</span></h1>
      <div class="post-header__meta">
        <time datetime="2026-05-23">2026-05-23</time>
        <span>·</span>
        <span>4 分钟</span>
        <span>·</span>
        <span class="pill pill--pink">杂谈</span>
        <span class="pill pill--pink">Meta</span>
        <button type="button" class="post-toc-toggle" id="post-toc-toggle" aria-expanded="false" aria-controls="post-toc">目录 ✦</button>
      </div>
    </div>

    <div class="post-layout">
      <article class="prose" id="post-content">
        <p>这是博客的第一篇文章。本来想先写点酷的东西，但还是先把"为什么自己写"这件事讲清楚 —— 算是给自己一个开博理由。</p>

        <h2>为什么不直接用现成的</h2>
        <p>市面上 SSG 一抓一大把 —— Hugo、Astro、Next、Hexo、Jekyll。它们都很好，但每一个都要求我去理解它的世界观：模板、配置、约定、插件、构建管线。</p>
        <p>我想要的其实非常少：<strong>几个 HTML、一份 CSS、一点 JS</strong>。所以决定自己写。</p>

        <h3>这里说的"少"</h3>
        <ul>
          <li>无 npm，无 node_modules，无 lock 文件</li>
          <li>无构建，<code>git push</code> 就是发布</li>
          <li>所有文件加起来 &lt; 100 KB</li>
        </ul>

        <h2>那一些技术选择</h2>
        <p>下面是我能想到的、值得一提的几个决定。其它没列出来的，多半都是<em>"默认就好"</em>。</p>

        <h3>样式系统</h3>
        <p>用 CSS 变量做明暗主题。<code>:root</code> 上挂 <code>data-theme</code>，切换时所有变量重写。这种方案下 Prism.js 的代码高亮也能跟着主题走，因为 token 颜色也是变量。</p>

        <h3>一段 Rust</h3>
        <pre><code class="language-rust">fn main() {
    let greetings = vec!["Hello", "Hola", "你好", "こんにちは"];
    for g in &amp;greetings {
        println!("{} from blog ✦", g);
    }
}</code></pre>

        <h3>一段 JavaScript</h3>
        <pre><code class="language-javascript">const greet = (name) =&gt; {
  const sparkle = '✨';
  return `Hello, ${name} ${sparkle}`;
};
console.log(greet('world'));</code></pre>

        <h2>排版小检阅</h2>
        <blockquote>
          <p>"如果一个东西很无聊，那它一般是被造得太复杂了。" —— 我自己说的</p>
        </blockquote>
        <p>有序列表：</p>
        <ol>
          <li>先写 spec</li>
          <li>再写 plan</li>
          <li>最后才动键盘</li>
        </ol>
        <p>表格：</p>
        <table>
          <thead>
            <tr><th>层</th><th>选择</th><th>原因</th></tr>
          </thead>
          <tbody>
            <tr><td>语言</td><td>原生 HTML/CSS/JS</td><td>没有 build 链，部署最简单</td></tr>
            <tr><td>评论</td><td>Giscus</td><td>挂在 GitHub Discussions，不用自托管</td></tr>
            <tr><td>字体</td><td>Nunito + JetBrains Mono</td><td>圆润，对中英文混排友好</td></tr>
          </tbody>
        </table>
        <p>一张占位图：</p>
        <p><img src="/assets/images/wechat-qr.png" alt="占位图" width="240" height="240"></p>

        <h2>下一步</h2>
        <p>把热力图调好、把 Giscus 接上、把 404 页画得不那么无聊。慢慢来。</p>
      </article>

      <aside class="post-toc" id="post-toc">
        <div class="post-toc__list" id="post-toc-list"></div>
      </aside>
    </div>

    <nav class="post-nav container">
      <a class="post-nav__card post-nav__card--placeholder" aria-disabled="true">
        <span>← 上一篇</span>
        <strong>没有更早的文章了</strong>
      </a>
      <a class="post-nav__card post-nav__card--placeholder" aria-disabled="true">
        <span>下一篇 →</span>
        <strong>暂无</strong>
      </a>
    </nav>

    <section class="comments container" id="comments">
      <h2 style="font-size: var(--fs-lg); font-weight: 800; margin-bottom: var(--space-4);">评论 ✦</h2>
      <noscript>评论需要 JavaScript 才能加载。</noscript>
      <p class="comments__fallback" id="comments-fallback" style="color: var(--text-muted);">加载评论中…</p>
      <!--
        Giscus 配置：
        - 先在 https://giscus.app 选好仓库，开启 Discussions
        - 把 data-repo / data-repo-id / data-category / data-category-id 替换为生成的值
        - 替换后删除 data-disabled 属性即可上线
      -->
      <script src="https://giscus.app/client.js"
              data-repo="huxint/huxint.github.io"
              data-repo-id="REPLACE_ME_REPO_ID"
              data-category="General"
              data-category-id="REPLACE_ME_CATEGORY_ID"
              data-mapping="pathname"
              data-strict="0"
              data-reactions-enabled="1"
              data-emit-metadata="0"
              data-input-position="bottom"
              data-theme="preferred_color_scheme"
              data-lang="zh-CN"
              data-loading="lazy"
              data-disabled="true"
              crossorigin="anonymous"
              async></script>
    </section>
  </main>

  <footer class="site-footer" data-include="/partials/footer.html"></footer>

  <script src="/assets/js/main.js" defer></script>
  <script src="/assets/js/post.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js" defer></script>
</body>
</html>
```

- [ ] **Step 2：smoke-test 文章页能加载**

Run:
```bash
cd /home/huxint/projects/blog && python3 -m http.server 8000 >/tmp/blog-server.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/posts/2026-05-23-hello-world.html
curl -s http://localhost:8000/posts/2026-05-23-hello-world.html | grep -c 'Hello, World'
pkill -f 'http.server 8000' || true
```
Expected:
```
200
1
```

- [ ] **Step 3：提交**

```bash
cd /home/huxint/projects/blog && git add posts && git commit -m "feat(posts): add hello-world sample article"
```

---

### Task 16: 文章页脚本 `post.js`

**Files:**
- Create: `/home/huxint/projects/blog/assets/js/post.js`

包含：(1) 阅读进度条 (2) 从 h2/h3 生成 TOC (3) scrollspy 高亮 (4) 移动端 TOC 折叠按钮 (5) Giscus 主题随站点切换。

- [ ] **Step 1：写 `post.js`**

```javascript
(() => {
  'use strict';

  function initProgressBar() {
    const bar = document.getElementById('reading-progress');
    if (!bar) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const h = document.documentElement;
        const scrollable = h.scrollHeight - h.clientHeight;
        const pct = scrollable > 0 ? (h.scrollTop || window.scrollY) / scrollable : 0;
        bar.style.width = `${Math.min(100, Math.max(0, pct * 100))}%`;
        ticking = false;
      });
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[　\s]+/g, '-')
      .replace(/[^\p{L}\p{N}_-]+/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function initToc() {
    const article = document.getElementById('post-content');
    const list = document.getElementById('post-toc-list');
    const toc = document.getElementById('post-toc');
    const toggle = document.getElementById('post-toc-toggle');
    if (!article || !list || !toc) return;

    const headings = [...article.querySelectorAll('h2, h3')];
    if (!headings.length) {
      toc.hidden = true;
      if (toggle) toggle.hidden = true;
      return;
    }
    const used = new Set();
    headings.forEach((h) => {
      if (!h.id) {
        let base = slugify(h.textContent) || 'section';
        let id = base;
        let i = 2;
        while (used.has(id) || document.getElementById(id)) {
          id = `${base}-${i++}`;
        }
        used.add(id);
        h.id = id;
      }
    });

    list.innerHTML = headings.map((h) => `
      <a class="post-toc__item post-toc__item--${h.tagName.toLowerCase()}" href="#${h.id}" data-toc-id="${h.id}">${h.textContent}</a>
    `).join('');

    const links = new Map(
      [...list.querySelectorAll('[data-toc-id]')].map((a) => [a.dataset.tocId, a])
    );
    const setActive = (id) => {
      links.forEach((a) => a.classList.remove('is-active'));
      const a = links.get(id);
      if (a) {
        a.classList.add('is-active');
        a.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };
    if (typeof IntersectionObserver === 'function') {
      const visible = new Map();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        });
        if (visible.size) {
          const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0][0];
          setActive(best);
        }
      }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] });
      headings.forEach((h) => io.observe(h));
    }

    const isMobileMode = () => window.matchMedia('(max-width: 1023px)').matches;
    const closedDefault = () => {
      if (isMobileMode()) {
        toc.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      } else {
        toc.hidden = false;
      }
    };
    closedDefault();
    window.addEventListener('resize', closedDefault);

    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = !toc.hidden;
        toc.hidden = open;
        toggle.setAttribute('aria-expanded', String(!open));
      });
    }
    list.addEventListener('click', () => {
      if (isMobileMode()) {
        toc.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initGiscusTheming() {
    const script = document.querySelector('script[src*="giscus.app/client.js"]');
    if (!script) return;
    if (script.getAttribute('data-disabled') === 'true') {
      const fb = document.getElementById('comments-fallback');
      if (fb) fb.innerHTML = '评论暂未配置，欢迎在 <a href="https://github.com/huxint">GitHub</a> 上 ping 我 ✦';
      return;
    }

    const fb = document.getElementById('comments-fallback');
    const timeout = setTimeout(() => {
      if (fb && fb.parentNode) {
        fb.innerHTML = '评论暂不可用，欢迎在 <a href="https://github.com/huxint">GitHub</a> 上 ping 我 ✦';
      }
    }, 4000);
    const iframeObserver = new MutationObserver(() => {
      const iframe = document.querySelector('iframe.giscus-frame');
      if (iframe) {
        clearTimeout(timeout);
        if (fb && fb.parentNode) fb.parentNode.removeChild(fb);
        iframeObserver.disconnect();
      }
    });
    iframeObserver.observe(document.body, { childList: true, subtree: true });

    const themeOf = () => {
      const explicit = document.documentElement.dataset.theme;
      if (explicit === 'light' || explicit === 'dark') return explicit;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };
    const post = (theme) => {
      const iframe = document.querySelector('iframe.giscus-frame');
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { giscus: { setConfig: { theme } } },
        'https://giscus.app'
      );
    };
    document.addEventListener('site:themechange', () => post(themeOf()));
  }

  function init() {
    initProgressBar();
    initToc();
    initGiscusTheming();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 2：JS 语法检查**

Run:
```bash
cd /home/huxint/projects/blog && node --check assets/js/post.js && echo ok
```
Expected: `ok`。

- [ ] **Step 3：提交**

```bash
cd /home/huxint/projects/blog && git add assets/js/post.js && git commit -m "feat(js): add post page progress bar, TOC scrollspy, giscus theming"
```

---

### Task 17: 项目页 `projects.html` + `projects.js`

**Files:**
- Create: `/home/huxint/projects/blog/projects.html`
- Create: `/home/huxint/projects/blog/assets/js/projects.js`

- [ ] **Step 1：写 `projects.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>开源项目 ✦ huxint</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/components.css">
</head>
<body>
  <header class="site-header" data-include="/partials/header.html"></header>
  <noscript>
    <nav class="noscript-header">
      <a href="/"><strong>huxint</strong></a>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/projects.html">项目</a>
      <a href="/about.html">关于</a>
    </nav>
  </noscript>

  <main class="container">
    <section class="section">
      <div class="section__header">
        <h1 class="section__title">开源项目 <span class="sparkle">✦</span></h1>
      </div>
      <p style="color: var(--text-muted); max-width: 640px;">我维护和参与的一些项目，按 featured 优先 + star 数排序。</p>
      <div id="projects-grid" class="card-grid" style="margin-top: var(--space-6);">
        <p style="color: var(--text-faint);">加载中…</p>
      </div>
    </section>
  </main>

  <footer class="site-footer" data-include="/partials/footer.html"></footer>

  <script src="/assets/js/main.js" defer></script>
  <script src="/assets/js/projects.js" defer></script>
</body>
</html>
```

- [ ] **Step 2：写 `assets/js/projects.js`**

```javascript
(() => {
  'use strict';

  async function init() {
    const mount = document.getElementById('projects-grid');
    if (!mount) return;
    let projects;
    try {
      const res = await fetch('/data/projects.json', { cache: 'no-cache' });
      projects = await res.json();
    } catch (err) {
      console.warn(err);
      mount.innerHTML = '<p style="color: var(--text-faint);">暂时拉不到项目列表 ✦</p>';
      return;
    }
    if (!projects.length) {
      mount.innerHTML = '<p style="color: var(--text-faint);">还没添加项目 ✦</p>';
      return;
    }

    const sorted = projects.slice().sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.stars || 0) - (a.stars || 0);
    });

    mount.innerHTML = sorted.map((p) => `
      <a class="card" data-color="${p.color}" href="${p.url}" target="_blank" rel="noopener noreferrer">
        <h3 class="card__title">${p.name}</h3>
        <p class="card__body">${p.description}</p>
        <div class="card__tags">
          <span class="pill pill--${p.color}">${p.language}</span>
          <span class="pill">★ ${p.stars}</span>
          ${p.featured ? '<span class="pill pill--yellow">featured</span>' : ''}
        </div>
      </a>
    `).join('');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 3：语法校验**

Run:
```bash
cd /home/huxint/projects/blog && node --check assets/js/projects.js && echo ok
```
Expected: `ok`。

- [ ] **Step 4：提交**

```bash
cd /home/huxint/projects/blog && git add projects.html assets/js/projects.js && git commit -m "feat(pages): add projects page"
```

---

### Task 18: 关于页 `about.html`

**Files:**
- Create: `/home/huxint/projects/blog/about.html`

- [ ] **Step 1：写 `about.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>关于我 ✦ huxint</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/components.css">
</head>
<body>
  <header class="site-header" data-include="/partials/header.html"></header>
  <noscript>
    <nav class="noscript-header">
      <a href="/"><strong>huxint</strong></a>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/projects.html">项目</a>
      <a href="/about.html">关于</a>
    </nav>
  </noscript>

  <main class="container">
    <section class="section">
      <div class="section__header">
        <h1 class="section__title">关于我 <span class="sparkle">✦</span></h1>
      </div>

      <div style="display: flex; gap: var(--space-6); align-items: flex-start; flex-wrap: wrap; margin-top: var(--space-4);">
        <div class="avatar" aria-hidden="true"></div>
        <div style="flex: 1; min-width: 280px; max-width: 640px;">
          <p style="font-size: var(--fs-md); line-height: var(--lh-prose);">嗨，我是 <strong>huxint</strong>。喜欢折腾代码、读源码、写一点自己用得上的小工具。</p>
          <p style="color: var(--text-muted); line-height: var(--lh-prose); margin-top: var(--space-3);">主语言：C++ / Rust / Go / Python。最近在做的事情：把一些以前丢在 gist 里的零碎东西整理成正式的小项目，顺便练手写一个干净的博客。</p>
          <p style="color: var(--text-muted); line-height: var(--lh-prose); margin-top: var(--space-3);">爱好：跑步、键盘、电子游戏，偶尔做做菜。</p>
        </div>
      </div>

      <div style="margin-top: var(--space-7); max-width: 640px;">
        <h2 style="font-size: var(--fs-lg); font-weight: 800; letter-spacing: -0.02em;">技术栈 <span style="color: var(--accent-blue);">✦</span></h2>
        <div class="stack-group">
          <div class="stack-group__label">主用</div>
          <div class="stack-group__items">
            <span class="pill pill--yellow">C++</span>
            <span class="pill pill--pink">Rust</span>
            <span class="pill pill--blue">Python</span>
            <span class="pill pill--purple">Go</span>
          </div>
        </div>
        <div class="stack-group">
          <div class="stack-group__label">熟悉</div>
          <div class="stack-group__items">
            <span class="pill">Linux</span>
            <span class="pill">Git</span>
            <span class="pill">SQL</span>
            <span class="pill">Docker</span>
            <span class="pill">HTML / CSS / JS</span>
          </div>
        </div>
        <div class="stack-group">
          <div class="stack-group__label">在学</div>
          <div class="stack-group__items">
            <span class="pill">Zig</span>
            <span class="pill">eBPF</span>
            <span class="pill">WebGPU</span>
          </div>
        </div>
      </div>

      <div style="margin-top: var(--space-7); max-width: 640px;">
        <h2 style="font-size: var(--fs-lg); font-weight: 800; letter-spacing: -0.02em;">联系 <span style="color: var(--accent-pink);">✦</span></h2>
        <div class="hero__socials" style="margin-top: var(--space-3);">
          <a href="https://github.com/huxint" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <svg data-icon="github" class="icon"></svg>
          </a>
          <button type="button" class="site-footer__qr-trigger" data-qr="wechat" aria-label="微信" style="background: none; border: 0; cursor: pointer; color: inherit;">
            <svg data-icon="wechat" class="icon"></svg>
          </button>
          <button type="button" class="site-footer__qr-trigger" data-qr="qq" aria-label="QQ" style="background: none; border: 0; cursor: pointer; color: inherit;">
            <svg data-icon="qq" class="icon"></svg>
          </button>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer" data-include="/partials/footer.html"></footer>

  <script src="/assets/js/main.js" defer></script>
</body>
</html>
```

- [ ] **Step 2：提交**

```bash
cd /home/huxint/projects/blog && git add about.html && git commit -m "feat(pages): add about page"
```

---

### Task 19: 404 页 `404.html`

**Files:**
- Create: `/home/huxint/projects/blog/404.html`

- [ ] **Step 1：写 `404.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 ✦ huxint</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap">
  <link rel="stylesheet" href="/assets/css/tokens.css">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/assets/css/components.css">
</head>
<body>
  <header class="site-header" data-include="/partials/header.html"></header>
  <noscript>
    <nav class="noscript-header">
      <a href="/"><strong>huxint</strong></a>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/projects.html">项目</a>
      <a href="/about.html">关于</a>
    </nav>
  </noscript>

  <main class="container not-found">
    <div>
      <div class="not-found__code">404 ✦</div>
      <p class="not-found__msg">找不到这一页。可能链接坏了，或者它本来就不存在。</p>
      <a class="btn" href="/">回到首页 →</a>
    </div>
  </main>

  <footer class="site-footer" data-include="/partials/footer.html"></footer>

  <script src="/assets/js/main.js" defer></script>
</body>
</html>
```

- [ ] **Step 2：提交**

```bash
cd /home/huxint/projects/blog && git add 404.html && git commit -m "feat(pages): add 404 page"
```

---

### Task 20: GitHub Pages 部署 workflow

**Files:**
- Create: `/home/huxint/projects/blog/.github/workflows/pages.yml`

- [ ] **Step 1：写 workflow**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'

      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2：YAML 校验**

Run:
```bash
cd /home/huxint/projects/blog && python3 -c "
import sys
try:
    import yaml
    yaml.safe_load(open('.github/workflows/pages.yml'))
    print('yaml ok')
except ImportError:
    # Fallback: only check indentation balance
    open('.github/workflows/pages.yml').read()
    print('yaml file readable (pyyaml not installed, skipping strict check)')"
```
Expected: `yaml ok` 或 `yaml file readable ...`，无报错。

- [ ] **Step 3：提交**

```bash
cd /home/huxint/projects/blog && git add .github/workflows/pages.yml && git commit -m "ci: add github pages deployment workflow"
```

---

### Task 21: 本地端到端 smoke + 手动验证清单

**Files:**
- 无新建文件，仅验证。

- [ ] **Step 1：启动本地服务器**

Run:
```bash
cd /home/huxint/projects/blog && python3 -m http.server 8000 >/tmp/blog-server.log 2>&1 &
sleep 1
```

- [ ] **Step 2：检查 6 个核心路径都返回 200**

Run:
```bash
for path in / /blog.html /projects.html /about.html /404.html /posts/2026-05-23-hello-world.html; do
  printf '%s -> ' "$path"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000$path"
done
```
Expected: 6 个 `200`（除了 `/404.html` 本身也是 200 —— 它只是当其它 URL 404 时由 server 返回，本地直接访问也通）。

- [ ] **Step 3：检查 partials 与 data 文件**

```bash
for path in /partials/header.html /partials/footer.html /data/posts.json /data/projects.json /assets/css/tokens.css /assets/js/main.js; do
  printf '%s -> ' "$path"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000$path"
done
```
Expected: 6 个 `200`。

- [ ] **Step 4：检查所有 SVG 图标**

```bash
for icon in github moon sun menu close wechat qq sparkle; do
  printf '/assets/icons/%s.svg -> ' "$icon"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8000/assets/icons/$icon.svg"
done
```
Expected: 8 个 `200`。

- [ ] **Step 5：停掉服务器**

```bash
pkill -f 'http.server 8000' || true
```

- [ ] **Step 6：人工浏览器验证清单**

本步骤需要人手用浏览器操作。逐项过：

- [ ] 用 `python3 -m http.server 8000` 启服务，在浏览器打开 `http://localhost:8000/`
- [ ] 桌面宽度（≥1280）：Header / Hero / 热力图 / 最新文章 / Footer 都正常
- [ ] DevTools 切换设备：iPad（768）/ iPhone（375）布局正常，移动端汉堡可弹出抽屉
- [ ] 主题切换按钮：明 ↔ 暗切换，颜色全部跟着变，刷新页面持久化
- [ ] 系统偏好切换（macOS 系统设置或 DevTools Rendering > Emulate CSS prefers-color-scheme: dark）：localStorage 为空时跟随系统
- [ ] 打开 `/blog.html`：文章按年份分组显示
- [ ] 打开 `/posts/2026-05-23-hello-world.html`：
  - [ ] 顶部读进度条随滚动增长
  - [ ] 桌面端右侧 TOC 粘性，滚动到对应章节时高亮变 `is-active` 并加 ✦
  - [ ] 平板/手机宽度下 TOC 默认折叠，"目录 ✦"按钮可展开
  - [ ] 代码块有高亮（Rust 和 JS 颜色不一样）
  - [ ] Giscus 区域显示 fallback 文案（因 `data-disabled="true"`）
- [ ] 打开 `/projects.html`：三张卡片，featured 排第一，左色条颜色不同
- [ ] 打开 `/about.html`：技术栈分组显示
- [ ] Footer 微信 / QQ 按钮：点击弹出 QR modal，遮罩可点击关闭，Esc 可关闭
- [ ] 控制台无报错（除了 Giscus 因 disabled 不加载是预期）

如有任何一项失败，回到对应 Task 修复。

- [ ] **Step 7：（可选）部署后线上验证**

push 到远端，等 Actions 跑完后访问 `https://huxint.github.io/`（用户站）或 `https://huxint.github.io/blog/`（项目站，需要按 [项目约定] 把绝对路径前缀 `/` 全部改为 `/blog/`）。

- [ ] **Step 8：最终提交**

如果在验证过程中有任何小修复：

```bash
cd /home/huxint/projects/blog && git add -A && git commit -m "fix: address findings from local smoke verification"
```
（如无修复则跳过。）

---

## Self-Review

按 spec 章节核对覆盖：

- §1（目标范围）：Task 1-21 覆盖明暗主题、响应式、代码高亮、评论、TOC、热力图、SVG 内嵌、GitHub Pages 部署。✓
- §2（技术栈）：Task 2-3 字体/Token、Task 12 热力图 API、Task 15 Prism CDN、Task 15-16 Giscus、Task 20 Pages 部署。✓
- §3（项目结构）：Task 1 建目录，每个文件分别在 Task 2-20 创建。✓
- §4（视觉系统）：Task 2 颜色 token / Task 3 字体栈 / Task 6 Logo 渐变 / 卡片 / 阴影 / 圆角。✓
- §5（页面规格）：Task 11 (index)、13 (blog)、15 (post)、17 (projects)、18 (about)、19 (404) 全覆盖。✓
- §6（共享组件）：Task 5 (partials)、6 (header/footer/modal styles)、9 (modal JS)。✓
- §7（交互细节）：Task 8 (主题 + mask)、9 (drawer + modal)、12 (热力图)、16 (TOC scrollspy + 进度条 + Giscus 主题切换)、6 (logo 旋转 / 卡片 hover / nav hover 圆点)。✓
- §8（数据 schema）：Task 10。✓
- §9（共享片段注入）：Task 7。✓
- §10（部署）：Task 20。✓
- §11（降级）：每页 noscript fallback（Task 11/13/15/17/18/19）+ 热力图 fallback（Task 12）+ Giscus fallback（Task 16）+ Prism CDN 失败不阻塞（无依赖，DOM 仍可读）。✓
- §12（性能）：font-display: swap（Google Fonts URL 已带）、SVG 图标 lazy fetch（main.js 在 DOMContentLoaded 后）、`loading="lazy"` ——示例文章 `<img>` 未显式加 `loading`，依赖默认；如需严格可在 prose.css `.prose img` 选择器写入文档约定。当前以"按 spec 要求做"为准。✓
- §13（示例内容）：Task 15。✓
- §14（开发与验证）：Task 21。✓

潜在小问题：
- 字体导入用了 `<link rel="stylesheet" href="...display=swap">`。Google CSS 内部已 `font-display: swap`，符合 §12 要求。
- 共享路径策略已在「项目约定」节明确：用户站 vs 项目站二选一。
- 没有引入 Prism 语言组件，由 autoloader 按需加载（保留首屏轻量）。

整体计划无 placeholder（除明示要用户替换的 Giscus repo-id，已在注释里说明）。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-23-blog-design.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - 我把 21 个 Task 一个一个交给独立 subagent 完成，每个 Task 完成后审阅，节奏快。

**2. Inline Execution** - 我在当前会话里按 Task 顺序执行，每完成 3-5 个 Task 做一次 checkpoint 由你审阅。

**Which approach?**

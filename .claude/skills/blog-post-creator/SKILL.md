---
name: blog-post-creator
description: Publish a new article to the local static blog 🚀 — handles content polishing (kills AI-flavored cliches, preserves the author's natural voice), picks content-appropriate visual modules (hero overline, lead, pullquote, callout, flow-compare, post-figure, post-timeline), writes the HTML, updates data/posts.json, fixes prev/next nav, copies images from external paths, and spins up a local server to verify. Use this skill whenever the user wants to publish a post, write up something for the blog, turn raw notes / random thoughts into a blog post, optimize draft content for publishing, or says things like "发布一篇帖子" / "把这个写成博客" / "publish this" / "整理成博客发出来" / "帮我写一篇关于 X 的帖子" — even if they hand over messy draft content (often with image paths, often in Chinese) without explicitly mentioning a blog.
---

# 📝 Blog Post Creator

Turn a raw piece of writing into a publishable article on a hand-written static blog. The blog has **no SSG** — it's literally HTML + CSS + JS — so publishing means writing one HTML file, adding one JSON entry, and fixing two nav links.

## 📂 Project layout

The blog lives in the current working directory (the project root). Key files:

```
./
├── posts/<slug>.html             ← the article itself
├── data/posts.json               ← article index (home + blog list both read this)
├── assets/
│   ├── css/tokens.css            ← colors, fonts, spacing tokens
│   ├── css/base.css              ← reset / base
│   ├── css/components.css        ← header / footer / post layout
│   ├── css/prose.css             ← article prose (h2/h3 auto-prefixed with § and ›)
│   └── images/<name>.<ext>       ← image assets
├── partials/header.html          ← shared header
├── partials/footer.html          ← shared footer
├── blog.html                     ← post list page
└── index.html                    ← home page
```

## 🪪 Naming conventions

- **slug**: `YYYY-MM-DD-kebab-case-topic`
- **filename**: `posts/<slug>.html`
- **title**: subtitle (if any) separated by `·`; wrap a keyword in `<em>` for sienna-italic emphasis
- **tags**: 1-3 of them, from the palette: `sienna` / `sage` / `gold` / `plum` / `indigo`

## 🎙️ Voice preservation

Read the existing posts (especially the most recent one) to learn the author's voice before you touch the draft. **Match what's already there** — sentence rhythm, code-switching, exclamations, sarcasm markers — without inventing new mannerisms.

Iron rule ⚔️: don't change the author's facts, opinions, or judgments. Polishing means fixing typos, broken pacing, and clunky word order — not softening views, balancing takes, or making prose "more objective." If the author wrote something opinionated, the opinion stays.

You **are** allowed to:
- Fix typos, clunky word order, dropped beats
- Split long paragraphs
- Promote a sharp one-liner into `<p class="pullquote">`
- Wrap short emotional words in `<em>` so they show up sienna

### 🚫 AI-flavor cliches — kill on sight

These read as machine-generated even when the underlying content isn't. Strip them in any language:

| Cliché pattern | Why it dies |
|---|---|
| 「让我们一起探索 / 一起来看看 ...」/ "Let's dive into ..." | Assistant tone |
| 「在 X 这个时代 / 大背景下 ...」/ "In today's ... landscape" | Empty opener |
| 「综上所述 / 总而言之」/ "In conclusion, ..." | Wrap-up filler |
| 「毋庸置疑 / 不可否认」/ "It's undeniable that ..." | Stock filler |
| 「这不仅 ... 更 ...」/ "Not just X, but Y" parallels | Forced rhetoric |
| 「随着 X 的发展，Y 也变得越来越 ...」/ "As X evolves, Y becomes ..." | Template opener |
| Paragraphs repeatedly starting with 「其实」「事实上」「值得一提的是」 | Crutch words |
| Every paragraph studded with emoji | Forced flavoring |
| Forced 「一是 ... 二是 ... 三是」 enumeration | Template-ese |
| Endings that inflate to「时代意义」/「我们应该 ...」/ "we should all ..." | Phony uplift |

## 🎨 Visual modules — pick by content

Custom module CSS goes **inline in the article HTML's `<style>` block** — never pollute the global CSS. Use only the modules that match the content; a short post might use zero.

### Built-in (no CSS needed)

Already provided by `prose.css`:

- `<h2>` auto-gets a `§` prefix — don't write the `§` yourself
- `<h3>` auto-gets a `› ` prefix
- `<hr>` renders as `✦ ✦ ✦`
- `<em>` → sienna italic (use for emphasis and emotional words)
- inline `<code>` → sienna on a tinted background
- `<pre><code class="language-xxx">` → Prism syntax highlighting (autoloader)
- `<ul>` items prefixed with `◇`
- `<blockquote>` → left sienna bar
- `<table>` → mono header

### Opt-in modules

Each has a recommended trigger; don't enable all of them at once.

#### 1️⃣ Hero keyword strip `.hero-extra`
**Use when**: long essay with a "thread" running through it. Row of mono keywords above `.post-header__meta`, separated by `·`.

#### 2️⃣ Lead paragraph `<p class="lead">`
**Use when**: long essays. Large display type with a divider below.

#### 3️⃣ Pullquote `<p class="pullquote">`
**Use when**: punchy one-liners worth screenshotting. Centered, top/bottom rules, italic.

#### 4️⃣ Inline figure `.post-figure`
**Use when**: screenshots, embedded images. `<figure>` + `<img>` + `<figcaption>`.

#### 5️⃣ Callout `.callout-musing`
**Use when**: the author stops to muse, or surfaces a quiet thought. Soft plum-tinted background.

#### 6️⃣ Comparison cards `.flow-compare`
**Use when**: before/after, A vs B, then/now. Two side-by-side cards.

#### 7️⃣ Bottom timeline `.post-timeline + .timeline-list`
**Use when**: a retrospective post that walks chronologically. `<dl>` structure.

### 🎯 Design tokens

Defined in `assets/css/tokens.css`. Reference via `var(--xxx)`:

| Token | Purpose |
|---|---|
| `--sienna` / `--sage` / `--gold` / `--plum` / `--indigo` | Accent palette |
| `--bg`, `--bg-elevated`, `--bg-deep` | Three-layer backgrounds |
| `--text`, `--text-muted`, `--text-faint` | Three-layer text |
| `--font-display` / `--font-sans` / `--font-mono` | Fonts |
| `--space-1` … `--space-12` | Spacing scale |
| `--radius`, `--radius-lg` | Corners |

## 🦴 HTML skeleton

Use an existing post in `posts/` as a copy-target. **Critical**: `prose.css` MUST load AFTER `prism.min.css` — otherwise Prism's default theme wins the cascade and our token colors get clobbered.

Minimum stylesheet order in `<head>`:

```html
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/components.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css">
<link rel="stylesheet" href="/assets/css/prose.css">
```

Required body structure:

```html
<div class="reading-progress" id="reading-progress"></div>
<header class="site-header" data-include="/partials/header.html"></header>
<!-- noscript fallback nav -->

<main class="post-shell">
  <div class="post-header container">
    <div class="post-header__kicker">№{NUM} · {KICKER}</div>
    <h1 class="post-header__title">{TITLE_WITH_EM}</h1>
    <div class="post-header__meta">
      <time datetime="{ISO}">{HUMAN_DATE}</time>
      <span>·</span><span>{READ_MIN} min read</span>
      <span>·</span>
      <!-- tags: <span class="tag tag--sienna">...</span> -->
      <button type="button" class="post-toc-toggle" id="post-toc-toggle" aria-expanded="false" aria-controls="post-toc">⌬ 目录</button>
    </div>
  </div>

  <div class="post-layout">
    <article class="prose" id="post-content">{BODY}</article>
    <aside class="post-toc" id="post-toc"><div class="post-toc__list" id="post-toc-list"></div></aside>
  </div>

  <nav class="post-nav container"><!-- prev / next cards --></nav>
  <section class="comments container" id="comments"><!-- giscus block --></section>
</main>

<footer class="site-footer" data-include="/partials/footer.html"></footer>

<script src="/assets/js/main.js" defer></script>
<script src="/assets/js/post.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js" defer></script>
```

## 🛠️ Workflow

### 1. 📖 Receive & understand
- Read the user's raw content end-to-end
- Classify: tech retrospective? essay? project debrief? tool review?
- Mark candidate spots: pullquote-worthy lines, A/B comparisons, timelines, musings
- For Windows paths (`E:\...`), convert to WSL mount `/mnt/e/...`, Read the image first, then decide where it belongs (rarely at the top — usually next to the relevant paragraph)

### 2. 🪪 Slug + metadata
- `slug = YYYY-MM-DD-<kebab-topic>` using today's date
- Title — no AI-tone openers like 「探索」「浅谈」「深度解析」
- Summary ≤ 60 chars Chinese (or equivalent)
- Reading time ≈ 250 Chinese chars/min
- 1-3 tags with palette colors

### 3. ✂️ Polish the prose
- Sweep against the AI-flavor checklist
- Split long blocks
- Wrap emotional short words in `<em>`
- Promote standout one-liners to `<p class="pullquote">`
- **Iron rule**: facts, opinions, judgments — all preserved

### 4. 🌐 Fact-check the timeline
If the post references dated events (product launches, model releases, news), verify the dates with a web search before publishing. Don't ship anachronisms — they undermine the rest of the post. Common landmines: confusing model variant names (Sonnet vs Opus), placing a release in the wrong month, claiming two events were "next day" when they were the same day.

### 5. 🖼️ Handle images
- `cp` external-path images into `./assets/images/<descriptive-name>.<ext>`
- Use a descriptive filename, not the original numeric blob

### 6. 🧩 Pick modules + write per-article CSS
- Only enable modules that match the content
- All custom CSS lives in the head `<style>` block
- Use `kebab-case` class names that won't collide with global ones

### 7. 🏗️ Write the HTML
- Start from an existing post as a copy-target
- Use `<h2>` for sections (the `§` prefix is automatic — don't write it)
- Keep each section short and rhythmic — no walls of text

### 8. 🗂️ Update posts.json
- New entry at the **top** of the array (home/list sort date desc)
- Fields: `slug` / `title` / `date` / `summary` / `tags` / `readingTime` / `color`

### 9. 🔗 Update prev/next nav
- New post's 上一篇 points to the previously-latest post
- Previously-latest post's 下一篇 gets pointed at this new post
- First-ever post: both cards use `.post-nav__card--placeholder`

### 10. 🧪 Verify locally
```bash
python3 -m http.server 8765 --bind 127.0.0.1 > /tmp/blog-server.log 2>&1 &
sleep 1
# Smoke test critical paths
for path in /posts/<slug>.html /data/posts.json /blog.html; do
  curl -s -o /dev/null -w "%{http_code}  $path\n" "http://127.0.0.1:8765${path}"
done
```

- If a headless browser is available, spot-check DOM structure via `browser_evaluate`
- ⚠️ Some sandboxed headless browsers don't load local CSS/JS — `cssLoaded: []` and `bodyH: 20` can be a sandbox quirk, not a real bug

### 11. 🧹 Clean up
- `pkill -f "python3 -m http.server 8765"`
- Close any opened headless browser
- Briefly report what files changed and what design decisions were made

## ⚠️ Failure modes

- 🙅 Softening the author's takes into "objective measured analysis"
- 🙅 Inserting filler like 「在 X 时代」「展望未来」 / "in the era of X"
- 🙅 Forcing every section into a parallel structure
- 🙅 Putting the image at the very top as a hero — it usually belongs next to the relevant paragraph
- 🙅 Loading `prose.css` BEFORE `prism.min.css` — Prism's defaults will win the cascade
- 🙅 Forgetting to update `posts.json` — the new post won't appear on home/list
- 🙅 Forgetting to update prev/next nav — the previously-latest post's 下一篇 will dangle
- 🙅 Sprinkling emoji into every paragraph of the prose
- 🙅 Loading every opt-in module into a short post — visual noise
- 🙅 Leaving placeholder text or stubs anywhere

## 💬 Comments / giscus

If `giscus` is in `data-disabled="true"` state with placeholder repo-id, leave it as is — the author will wire it up themselves.

## 🛣️ Paths

Always use absolute paths or paths relative to the project root — never rely on `cwd` mid-workflow.

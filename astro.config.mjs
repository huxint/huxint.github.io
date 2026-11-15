import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import expressiveCode, { pluginFramesTexts } from 'astro-expressive-code';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeArticle } from './src/lib/rehype-article.mjs';
import { remarkMoment } from './src/lib/remark-moment.mjs';
import { remarkStickers } from './src/lib/remark-stickers.mjs';
import { remarkArticleExtras } from './src/lib/remark-article-extras.mjs';
import { remarkHtmlMath } from './src/lib/remark-html-math.mjs';
import { lifeMedia } from './src/integrations/life-media.mjs';
import { pluginDiffDetails } from './src/lib/expressive-diff.mjs';

pluginFramesTexts.addLocale('zh', {
  terminalWindowFallbackTitle: '终端',
  copyButtonTooltip: '复制代码',
  copyButtonCopied: '已复制',
});

export default defineConfig({
  site: 'https://huxint.github.io',
  trailingSlash: 'always',
  redirects: {
    '/tags/C%2B%2B/': '/tags/C++/',
    '/projects/orangutan/': '/projects/orangutan-agent/',
  },
  vite: {
    plugins: [
      {
        name: 'excalidraw-font-assets',
        apply: 'build',
        transform(code, id) {
          if (!id.includes('/@excalidraw/utils/')) return;
          // The exporter embeds every font. Keep them as assets loaded on demand.
          return code.replace(
            /"data:font\/woff2;base64,([^"]+)"/g,
            (_, data) => {
              const file = this.emitFile({
                type: 'asset',
                name: 'excalidraw.woff2',
                source: Buffer.from(data, 'base64'),
              });
              return `import.meta.ROLLUP_FILE_URL_${file}`;
            },
          );
        },
      },
    ],
    optimizeDeps: {
      include: ['mermaid', '@excalidraw/utils'],
    },
    build: {
      // Astro can inline scripts before Vite resolves their dynamic-import preload markers.
      assetsInlineLimit: (filePath) =>
        filePath.endsWith('.js') ? false : undefined,
    },
  },
  integrations: [
    sitemap({ filter: (url) => !url.endsWith('/search/') }),
    lifeMedia(),
    expressiveCode({
      plugins: [pluginDiffDetails()],
      defaultLocale: 'zh',
      getBlockLocale: () => 'zh',
      themes: ['github-light', 'github-dark'],
      useDarkModeMediaQuery: false,
      themeCssSelector: (theme) => `[data-theme="${theme.type}"]`,
      styleOverrides: {
        borderRadius: 'var(--radius-md)',
        borderColor: 'var(--rule)',
        codeBackground: 'var(--bg-sunken)',
        codeFontFamily: 'var(--font-mono)',
        codeFontSize: 'var(--text-sm)',
        codeLineHeight: '1.75',
        uiFontFamily: 'var(--font-sans)',
        uiFontSize: 'var(--text-xs)',
        frames: {
          frameBoxShadowCssValue: 'none',
          editorActiveTabBackground: 'transparent',
          editorActiveTabForeground: 'var(--muted)',
          editorActiveTabIndicatorHeight: '0px',
          editorTabBarBackground: 'transparent',
          editorTabBarBorderColor: 'var(--rule)',
          editorTabBarBorderBottomColor: 'var(--rule)',
          terminalBackground: 'var(--bg-sunken)',
          terminalTitlebarBackground: 'transparent',
          terminalTitlebarForeground: 'var(--muted)',
          terminalTitlebarBorderBottomColor: 'var(--rule)',
          inlineButtonBackground: 'var(--surface)',
          inlineButtonBorder: 'var(--rule-strong)',
          inlineButtonForeground: 'var(--muted)',
          tooltipSuccessBackground: 'var(--text)',
          tooltipSuccessForeground: 'var(--bg)',
        },
      },
    }),
  ],
  markdown: {
    processor: unified({
      remarkRehype: { footnoteLabel: '注释', footnoteBackLabel: '返回正文' },
      remarkPlugins: [
        remarkMath,
        remarkHtmlMath,
        remarkArticleExtras,
        remarkStickers,
        remarkMoment,
      ],
      rehypePlugins: [[rehypeKatex, { strict: 'error' }], rehypeArticle],
    }),
  },
});

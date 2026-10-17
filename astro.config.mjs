import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import expressiveCode, { pluginFramesTexts } from 'astro-expressive-code';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeArticle } from './src/lib/rehype-article.mjs';
import { remarkMoment } from './src/lib/remark-moment.mjs';
import { remarkArticleExtras } from './src/lib/remark-article-extras.mjs';
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
  vite: {
    optimizeDeps: {
      include: ['mermaid'],
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
        borderRadius: '8px',
        borderColor: 'var(--rule)',
        codeBackground: 'var(--bg-sunken)',
        codeFontFamily: 'var(--font-mono)',
        codeFontSize: '0.83rem',
        codeLineHeight: '1.75',
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
        },
      },
    }),
  ],
  markdown: {
    processor: unified({
      remarkRehype: { footnoteLabel: '注释', footnoteBackLabel: '返回正文' },
      remarkPlugins: [remarkMath, remarkArticleExtras, remarkMoment],
      rehypePlugins: [[rehypeKatex, { strict: 'error' }], rehypeArticle],
    }),
  },
});

import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import expressiveCode, { pluginFramesTexts } from 'astro-expressive-code';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeArticle } from './src/lib/rehype-article.mjs';

pluginFramesTexts.addLocale('zh', {
  terminalWindowFallbackTitle: '终端',
  copyButtonTooltip: '复制代码',
  copyButtonCopied: '已复制',
});

export default defineConfig({
  site: 'https://huxint.github.io',
  trailingSlash: 'always',
  vite: {
    build: {
      // Astro can inline scripts before Vite resolves their dynamic-import preload markers.
      assetsInlineLimit: (filePath) =>
        filePath.endsWith('.js') ? false : undefined,
    },
  },
  integrations: [
    sitemap({ filter: (url) => !url.endsWith('/search/') }),
    expressiveCode({
      defaultLocale: 'zh',
      getBlockLocale: () => 'zh',
      themes: ['github-light', 'github-dark'],
      useDarkModeMediaQuery: false,
      themeCssSelector: (theme) => `[data-theme="${theme.type}"]`,
      styleOverrides: {
        borderRadius: '0.6rem',
        codeFontFamily: 'var(--font-mono)',
        codeFontSize: '0.83rem',
        codeLineHeight: '1.75',
      },
    }),
  ],
  markdown: {
    processor: unified({
      remarkRehype: { footnoteLabel: '注释', footnoteBackLabel: '返回正文' },
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, { strict: 'error' }], rehypeArticle],
    }),
  },
});

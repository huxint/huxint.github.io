import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.BLOG_TEST_PORT ?? 4321);
const devPort = port + 1;

export default defineConfig({
  testDir: './tests',
  outputDir: join(tmpdir(), 'huxint-blog-test-results'),
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: 'site',
      testIgnore: /life\.spec\.ts$/,
      use: { baseURL: `http://127.0.0.1:${port}` },
    },
    // Life records in the repo are drafts, which only the dev server renders.
    {
      name: 'life',
      testMatch: /life\.spec\.ts$/,
      use: { baseURL: `http://127.0.0.1:${devPort}` },
    },
  ],
  webServer: [
    {
      // Keep Astro attached so Playwright owns the server's lifetime in agent environments.
      env: { ASTRO_PREVIEW_BACKGROUND: '1' },
      command: `pnpm preview --host 127.0.0.1 --port ${port}`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      env: { ASTRO_DEV_BACKGROUND: '1' },
      command: `pnpm dev --host 127.0.0.1 --port ${devPort} --ignore-lock`,
      url: `http://127.0.0.1:${devPort}/life/`,
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});

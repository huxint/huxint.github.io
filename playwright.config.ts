import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.BLOG_TEST_PORT ?? 4321);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:' + port,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    // Keep Astro attached so Playwright owns the server's lifetime in agent environments.
    env: { ASTRO_PREVIEW_BACKGROUND: '1' },
    command: 'pnpm preview --host 127.0.0.1 --port ' + port,
    url: 'http://127.0.0.1:' + port,
    reuseExistingServer: false,
    timeout: 30000,
  },
});

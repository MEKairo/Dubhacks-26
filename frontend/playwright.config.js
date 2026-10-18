import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', channel: 'chrome', headless: true,
    viewport: { width: 1280, height: 900 } },
  webServer: {
    command: (process.platform === 'win32' ? 'npm.cmd' : 'npm') + ' run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174', reuseExistingServer: !process.env.CI,
  },
});

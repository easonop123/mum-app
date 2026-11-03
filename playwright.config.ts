import { defineConfig, devices } from '@playwright/test';

// Only Chromium is installed in this environment. The "iPhone-sized" project
// emulates an iPhone viewport/touch in Chromium; it is NOT Safari/WebKit.
// Real iPhone checks are in docs/MANUAL-TEST-CHECKLIST.md.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
    locale: 'en-NZ',
    timezoneId: 'Pacific/Auckland',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'iphone-13-size (chromium)',
      use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' },
    },
    {
      name: 'small-320 (chromium)',
      use: { browserName: 'chromium', viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
});

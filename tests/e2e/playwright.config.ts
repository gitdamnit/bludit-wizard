import { defineConfig } from '@playwright/test';

const PORT = process.env.BW_PORT || '8081';
const MOCK = process.env.BW_MOCK_URL || 'http://localhost:8090';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['json', { outputFile: '../../reports/raw/playwright.json' }]
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {}
  },
  metadata: { mock: MOCK }
});

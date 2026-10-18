/*
 * Capture the Bludit directory submission screenshots from a running instance.
 *
 * Usage (from tests/e2e):
 *   BW_PORT=8081 node capture-screenshot.mjs
 *
 * Produces:
 *   ../../submission/items/bludit-wizard/screenshot.png   (800x600, Wizard UI)
 *   ../../submission/bludit-wizard-settings.png           (800x600, settings)
 */
import { chromium } from '@playwright/test';

const PORT = process.env.BW_PORT || '8081';
const BASE = process.env.BW_BASE_URL || `http://localhost:${PORT}`;
const USER = process.env.BW_ADMIN_USER || 'admin';
const PASS = process.env.BW_ADMIN_PASS || 'demo123';

const WIZARD = '../../submission/items/bludit-wizard/screenshot.png';
const SETTINGS = '../../submission/bludit-wizard-settings.png';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.goto(`${BASE}/admin/login`);
await page.fill('input[name="username"]', USER);
await page.fill('input[name="password"]', PASS);
await page.click('button[type="submit"], input[type="submit"]');
await page.waitForURL(/\/admin\//);

await page.goto(`${BASE}/admin/plugin/pluginwizard`);
await page.waitForSelector('.bw-hero');
await page.waitForTimeout(500);
await page.screenshot({ path: WIZARD });
console.log('wrote', WIZARD);

await page.goto(`${BASE}/admin/configure-plugin/pluginWizard`);
await page.waitForSelector('#wizard-model');
await page.waitForTimeout(300);
await page.screenshot({ path: SETTINGS });
console.log('wrote', SETTINGS);

await browser.close();

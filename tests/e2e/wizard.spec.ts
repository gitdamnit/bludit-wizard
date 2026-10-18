import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * End-to-end UI tests for Bludit Wizard v1.1.0.
 *
 * Covers the twelve-task menu, full-width workspace, task guidance/action
 * labels, context isolation, result types, read-only audits, safe Markdown,
 * responsive layout, focus management, and the absence of deletion.
 */

const ADMIN_USER = process.env.BW_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.BW_ADMIN_PASS || 'demo123';
const WIZ_KEY = process.env.BW_WIZARD_KEY || 'WizardTestKey2026RC1';
const MOCK = process.env.BW_MOCK_URL || 'http://localhost:8090';

const TASKS = [
  ['create_page', 'Create a new page', 'Generate Draft', 'none'],
  ['create_outline', 'Create an outline', 'Generate Outline', 'none'],
  ['article_ideas', 'Generate article ideas', 'Generate Ideas', 'none'],
  ['improve_page', 'Improve an existing page', 'Review Improvements', 'required'],
  ['rewrite_tone', 'Rewrite tone or style', 'Rewrite Content', 'required'],
  ['adjust_length', 'Expand or shorten content', 'Adjust Length', 'required'],
  ['proofread', 'Proofread content', 'Proofread Page', 'required'],
  ['seo_audit', 'SEO + clarity audit', 'Analyze Page', 'required'],
  ['seo_metadata', 'Generate SEO metadata', 'Generate Metadata', 'required'],
  ['internal_links', 'Suggest internal links', 'Find Link Opportunities', 'required'],
  ['freshness_audit', 'Audit content freshness', 'Check Content Freshness', 'required'],
  ['ask_wizard', 'Ask Wizard', 'Ask Wizard', 'optional']
] as const;

let sequence = 0;
function uniqueSlug(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function proposal(slug: string): string {
  return JSON.stringify({ title: 'AI Title', slug, description: 'AI description', type: 'draft', content: 'AI generated content.' });
}

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[name="username"]', ADMIN_USER);
  await page.fill('input[name="password"]', ADMIN_PASS);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(/\/admin\/(dashboard|plugin)/);
}

async function setMock(request: APIRequestContext, content: string, status = 200) {
  await request.post(`${MOCK}/__config`, { data: { content, status, raw: null } });
}

async function lastPayload(request: APIRequestContext): Promise<any> {
  const state = await (await request.get(`${MOCK}/__state`)).json();
  const last = (state.requests || []).slice(-1)[0];
  if (!last) { return null; }
  const messages = last.body.messages || [];
  try { return JSON.parse(messages[messages.length - 1].content); } catch { return null; }
}

async function seedPage(request: APIRequestContext, slug: string, contentStr: string, type = 'draft') {
  const res = await request.post('/api/wizard/pages', {
    headers: { Authorization: `Bearer ${WIZ_KEY}`, 'Content-Type': 'application/json' },
    data: { title: `Seed ${slug}`, content: contentStr, type, slug }
  });
  expect(res.status()).toBe(201);
}

async function openWizard(page: Page) {
  await login(page);
  await page.goto('/admin/plugin/pluginwizard');
  await expect(page.locator('#bw-task')).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('full-width workspace: hero, subtitle, no sidebar cards, no deletion', async ({ page }) => {
  await openWizard(page);
  await expect(page.locator('.bw-hero h1')).toHaveText('What do you want to do?');
  expect(await page.locator('.bw-hero h1').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(248, 250, 252)');
  await expect(page.getByText('Your intelligent Bludit publishing companion.')).toBeVisible();
  await expect(page.locator('.bw-side')).toHaveCount(0);
  await expect(page.getByText('Site intelligence')).toHaveCount(0);
  await expect(page.getByText('AI configuration')).toHaveCount(0);
  await expect(page.getByText('Safety model')).toHaveCount(0);
  await expect(page.locator('#bw-delete')).toHaveCount(0);
  await expect(page.getByText('Delete selected page')).toHaveCount(0);
});

test('twelve tasks in four categories with exact labels, actions and guidance', async ({ page }) => {
  await openWizard(page);
  const options = page.locator('#bw-task option');
  await expect(options).toHaveCount(12);
  const groups = page.locator('#bw-task optgroup');
  await expect(groups).toHaveCount(4);
  const labels = await groups.evaluateAll((els) => els.map((e) => (e as HTMLOptGroupElement).label));
  expect(labels).toEqual(['Write & Create', 'Edit & Improve', 'SEO & Quality', 'General']);

  for (const [value, label, action, pageMode] of TASKS) {
    await page.selectOption('#bw-task', value);
    await expect(page.locator('#bw-run')).toHaveText(action);
    await expect(page.locator('#bw-guidance')).not.toBeEmpty();
    const visible = await page.locator('#bw-page-wrap').isVisible();
    expect(visible).toBe(pageMode !== 'none');
    if (pageMode === 'optional') {
      await expect(page.locator('#bw-page')).toHaveValue('');
      await expect(page.locator('#bw-page-none')).toHaveText(/No page/);
    }
  }
});

test('task-specific controls appear for tone and length tasks', async ({ page }) => {
  await openWizard(page);
  await page.selectOption('#bw-task', 'rewrite_tone');
  await expect(page.locator('#bw-tone-wrap')).toBeVisible();
  await page.selectOption('#bw-task', 'adjust_length');
  await expect(page.locator('#bw-length-wrap')).toBeVisible();
  await expect(page.locator('#bw-tone-wrap')).toBeHidden();
});

test('create page: Generate Draft shows a proposal and writes only on Apply', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-draft');
  await setMock(request, proposal(slug));
  await openWizard(page);
  await page.selectOption('#bw-task', 'create_page');
  await page.fill('#bw-prompt', 'Write about tea.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-review')).toBeVisible();
  await expect(page.locator('#bw-original-col')).toBeHidden();
  await expect(page.locator('#bw-title')).toHaveValue('AI Title');
  await page.click('#bw-save');
  await expect(page.locator('#bw-result-body')).toContainText(/created and verified/i);
});

test('improve: read-only original beside editable proposed, two columns, applies as draft', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-improve');
  await seedPage(request, slug, 'Original unicorn body.');
  await setMock(request, proposal(slug));
  await openWizard(page);
  await page.selectOption('#bw-task', 'improve_page');
  await page.selectOption('#bw-page', slug);
  await page.fill('#bw-prompt', 'Improve it.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-original-col')).toBeVisible();
  await expect(page.locator('#bw-original-content')).toContainText('Original unicorn body.');
  await expect(page.locator('#bw-original-col input, #bw-original-col textarea, #bw-original-col select')).toHaveCount(0);
  await expect(page.locator('#bw-content')).toBeEditable();
  const cols = await page.locator('.bw-review-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns);
  expect(cols.split(' ').filter(Boolean).length).toBe(2);
  page.on('dialog', (d) => d.accept());
  await page.click('#bw-save');
  await expect(page.locator('#bw-result-body')).toContainText(/updated and verified/i);
});

test('context isolation: switching task clears page/results (outline cannot inherit Unicorns)', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-unicorns');
  await seedPage(request, slug, 'Unicorns body must not leak.');
  await setMock(request, proposal(slug));
  await openWizard(page);
  await page.selectOption('#bw-task', 'improve_page');
  await page.selectOption('#bw-page', slug);
  await page.fill('#bw-prompt', 'Improve unicorns.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-review')).toBeVisible();

  await setMock(request, '# Mermaids outline\n\n- point one\n');
  await page.selectOption('#bw-task', 'create_outline');
  await expect(page.locator('#bw-page')).toHaveValue('');
  await expect(page.locator('#bw-review')).toBeHidden();
  await page.fill('#bw-prompt', 'Outline mermaids.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-result')).toBeVisible();
  await expect(page.locator('#bw-review')).toBeHidden();

  const payload = await lastPayload(request);
  expect(payload['Selected page']).toBeNull();
  expect(JSON.stringify(payload)).not.toContain('Unicorns body must not leak');
});

test('SEO audit is read-only: no review/apply', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-audit');
  await seedPage(request, slug, 'Audit body.');
  await setMock(request, '# Audit\n\n- Finding one\n- Finding two\n');
  await openWizard(page);
  await page.selectOption('#bw-task', 'seo_audit');
  await page.selectOption('#bw-page', slug);
  await page.click('#bw-run');
  await expect(page.locator('#bw-result')).toBeVisible();
  await expect(page.locator('#bw-review')).toBeHidden();
  await expect(page.locator('#bw-result-body')).toContainText('Finding one');
});

test('internal links: valid targets shown, invented targets rejected, no apply', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-links');
  await seedPage(request, slug, 'Link source body.');
  await setMock(request, JSON.stringify({ links: [
    { source_text: 'related reading', target: slug, reason: 'same topic' },
    { source_text: 'nowhere', target: 'missing-key-xyz', reason: 'does not exist' }
  ] }));
  await openWizard(page);
  await page.selectOption('#bw-task', 'internal_links');
  await page.selectOption('#bw-page', slug);
  await page.click('#bw-run');
  await expect(page.locator('#bw-audit')).toBeVisible();
  await expect(page.locator('.bw-link-item')).toHaveCount(2);
  await expect(page.locator('.bw-link-invalid')).toContainText('page not found');
  await expect(page.locator('#bw-review')).toBeHidden();
});

test('Ask Wizard: page optional, defaults to no page', async ({ page, request }) => {
  await setMock(request, 'Bludit is a flat-file CMS.');
  await openWizard(page);
  await page.selectOption('#bw-task', 'ask_wizard');
  await expect(page.locator('#bw-page')).toHaveValue('');
  await page.fill('#bw-prompt', 'What is Bludit?');
  await page.click('#bw-run');
  await expect(page.locator('#bw-result-body')).toContainText('flat-file CMS');
  const payload = await lastPayload(request);
  expect(payload['Selected page']).toBeNull();
});

test('discard suggestion never writes', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-discard');
  await seedPage(request, slug, 'Untouched body.');
  await setMock(request, proposal(slug));
  await openWizard(page);
  await page.selectOption('#bw-task', 'improve_page');
  await page.selectOption('#bw-page', slug);
  await page.fill('#bw-prompt', 'Improve.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-review')).toBeVisible();
  page.on('dialog', (d) => d.accept());
  await page.click('#bw-discard');
  await expect(page.locator('#bw-review')).toBeHidden();
  await expect(page.locator('#bw-result-body')).toContainText(/discarded/i);
  const res = await request.get(`/api/wizard/pages/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${WIZ_KEY}` } });
  expect((await res.json()).page.content).toBe('Untouched body.');
});

test('generated HTML is not executed (safe Markdown)', async ({ page, request }) => {
  await setMock(request, 'Hello <img src=x onerror="window.__bwXss=1"> world');
  await openWizard(page);
  await page.selectOption('#bw-task', 'create_outline');
  await page.fill('#bw-prompt', 'Safety test.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-result-body')).toContainText('Hello');
  await expect(page.locator('#bw-result-body img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__bwXss)).toBeUndefined();
});

test('result receives focus after completion', async ({ page, request }) => {
  await setMock(request, '# Focus test\n\nBody.');
  await openWizard(page);
  await page.selectOption('#bw-task', 'create_outline');
  await page.fill('#bw-prompt', 'Focus.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-result-body')).toBeVisible();
  await expect.poll(async () => {
    return page.evaluate(() => {
      const active = document.activeElement;
      return active ? !!active.closest('#bw-result, #bw-review, #bw-audit') : false;
    });
  }).toBe(true);
});

test('narrow viewport stacks the review and does not overflow horizontally', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-mobile');
  await seedPage(request, slug, 'Mobile body '.repeat(40));
  await setMock(request, proposal(slug));
  await openWizard(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.selectOption('#bw-task', 'improve_page');
  await page.selectOption('#bw-page', slug);
  await page.fill('#bw-prompt', 'Improve.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-review')).toBeVisible();
  const cols = await page.locator('.bw-review-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns);
  expect(cols.split(' ').filter(Boolean).length).toBe(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('provider failure surfaces an error without a proposal', async ({ page, request }) => {
  await setMock(request, 'x', 500);
  await openWizard(page);
  await page.selectOption('#bw-task', 'create_page');
  await page.fill('#bw-prompt', 'Fail.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-result')).toBeVisible();
  await expect(page.locator('#bw-result-body')).not.toBeEmpty();
  await expect(page.locator('#bw-review')).toBeHidden();
});

/* ------------------------------------------------------------------ */
/* v1.1.0 regression coverage                                     */
/* ------------------------------------------------------------------ */

const LEGACY_JS = readFileSync(fileURLToPath(new URL('./fixtures/legacy-wizard-1.0.3.js', import.meta.url)), 'utf8');

test('server renders the dispatch fallback, page selector and first action label', async ({ page }) => {
  await openWizard(page);
  await expect(page.locator('#bw-ai-form input[name="action"]')).toHaveValue('ai');
  await expect(page.locator('#bw-run')).toHaveText('Generate Draft');
  // The default task is create_page, so initialized JS hides the selector.
  await expect(page.locator('#bw-page-wrap')).toBeHidden();

  // The CSS/JS URLs carry the release version.
  const jsSrc = await page.locator('script[src*="wizard.js"]').getAttribute('src');
  const cssHref = await page.locator('link[href*="wizard.css"]').getAttribute('href');
  expect(jsSrc).toContain('?v=1.1.0');
  expect(cssHref).toContain('?v=1.1.0');
});

test('workspace initializes without plugin JavaScript errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') { errors.push(message.text()); }
  });
  await openWizard(page);
  await page.waitForTimeout(300);
  // The Bludit dashboard template has an unrelated inline-script warning;
  // only the Wizard client is asserted here.
  expect(errors.filter((text) => /wizard\.js/i.test(text))).toEqual([]);
});

test('workspace fails safely without JavaScript', async ({ browser, request }) => {
  const slug = uniqueSlug('e2e-nojs');
  await seedPage(request, slug, 'Content for the no-JavaScript test.');

  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await login(page);
  await page.goto('/admin/plugin/pluginwizard');

  // Server-rendered state must remain usable and informative.
  await expect(page.locator('#bw-task')).toBeVisible();
  await expect(page.locator('#bw-run')).toHaveText('Generate Draft');
  await expect(page.locator('#bw-page-wrap')).toBeVisible();
  await expect(page.locator('.bw-noscript')).toBeVisible();

  await page.selectOption('#bw-task', 'improve_page');
  await page.selectOption('#bw-page', slug);
  await page.fill('#bw-prompt', 'Improve this page.');
  await page.click('#bw-run');
  await page.waitForLoadState('domcontentloaded');

  await expect(page.locator('.bw-admin-notice')).toBeVisible();
  await expect(page.locator('.bw-admin-notice')).toContainText(/did not finish loading/i);
  await expect(page.locator('body')).not.toContainText('Unknown action.');
  await context.close();
});

test('workspace fails safely when wizard.js is blocked', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-blocked');
  await seedPage(request, slug, 'Content for the blocked-script test.');
  await page.route('**/wizard.js*', (route) => route.abort());
  await openWizard(page);

  await expect(page.locator('#bw-run')).toHaveText('Generate Draft');
  await expect(page.locator('#bw-page-wrap')).toBeVisible();

  await page.selectOption('#bw-task', 'improve_page');
  await page.selectOption('#bw-page', slug);
  await page.fill('#bw-prompt', 'Improve this page.');
  await page.click('#bw-run');
  await page.waitForLoadState('domcontentloaded');

  await expect(page.locator('.bw-admin-notice')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Unknown action.');
});

test('older JavaScript on newer markup fails safely', async ({ page, request }) => {
  const slug = uniqueSlug('e2e-legacy');
  await seedPage(request, slug, 'Content for the mixed-version test.');
  await page.route('**/wizard.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: LEGACY_JS }));
  await openWizard(page);

  // The server-rendered fallback is visible because the old script died.
  await expect(page.locator('#bw-run')).toHaveText('Generate Draft');
  await expect(page.locator('#bw-page-wrap')).toBeVisible();

  await page.selectOption('#bw-task', 'improve_page');
  await page.selectOption('#bw-page', slug);
  await page.fill('#bw-prompt', 'Improve this page.');
  await page.click('#bw-run');
  await page.waitForLoadState('domcontentloaded');

  await expect(page.locator('.bw-admin-notice')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Unknown action.');
});

test('missing BW_CONFIG surfaces an initialization error', async ({ page }) => {
  await page.route('**/admin/plugin/pluginwizard*', async (route) => {
    if (route.request().method() !== 'GET') { return route.continue(); }
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace('window.BW_CONFIG=', 'window.BW_CONFIG_DISABLED=');
    await route.fulfill({ response, body });
  });
  await login(page);
  await page.goto('/admin/plugin/pluginwizard');

  await expect(page.locator('#bw-result')).toBeVisible();
  await expect(page.locator('#bw-result')).toContainText(/configuration did not load|not available/i);
  await expect(page.locator('#bw-run')).toBeDisabled();
});

test('an unknown task configuration disables the action instead of failing silently', async ({ page }) => {
  await openWizard(page);
  await page.evaluate(() => {
    const task = document.getElementById('bw-task') as HTMLSelectElement;
    task.value = 'not_a_task';
    task.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('#bw-result')).toContainText(/not available/i);
  await expect(page.locator('#bw-run')).toBeDisabled();
});

test('changing the selected page discards the previous proposal', async ({ page, request }) => {
  const first = uniqueSlug('e2e-page-a');
  const second = uniqueSlug('e2e-page-b');
  await seedPage(request, first, 'First page content.');
  await seedPage(request, second, 'Second page content.');
  await setMock(request, proposal(first));
  await openWizard(page);
  await page.selectOption('#bw-task', 'improve_page');
  await page.selectOption('#bw-page', first);
  await page.fill('#bw-prompt', 'Improve.');
  await page.click('#bw-run');
  await expect(page.locator('#bw-review')).toBeVisible();

  await page.selectOption('#bw-page', second);
  await expect(page.locator('#bw-review')).toBeHidden();
  await expect(page.locator('#bw-result')).toBeHidden();
});

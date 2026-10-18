import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/*
 * UI tests for the provider validation / model discovery settings experience.
 *
 * The provider is the deterministic mock. These tests exercise the real
 * settings page served by Bludit, including the searchable model dropdown and
 * the staged diagnostics (URL / connection / authentication / catalog).
 */

const MOCK = process.env.BW_MOCK_URL || 'http://localhost:8090';
const ADMIN_USER = process.env.BW_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.BW_ADMIN_PASS || 'demo123';
const MOCK_BASE = 'http://127.0.0.1/mockai/v1';

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[name="username"]', ADMIN_USER);
  await page.fill('input[name="password"]', ADMIN_PASS);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(/\/admin\/(dashboard|plugin|configure-plugin)/);
}

async function openSettings(page: Page) {
  await login(page);
  await page.goto('/admin/configure-plugin/pluginWizard');
  await expect(page.locator('#wizard-model')).toBeVisible();
}

async function mockConfig(request: APIRequestContext, patch: Record<string, unknown>) {
  await request.post(`${MOCK}/__config`, { data: patch });
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('settings page renders presets, the model combobox and the actions', async ({ page }) => {
  await openSettings(page);

  const options = page.locator('#wizard-provider option');
  await expect(options).toHaveCount(5);
  const values = await options.evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(values).toEqual(expect.arrayContaining(['openai', 'openrouter', 'llmgateway', 'ollama', 'compatible']));

  await expect(page.locator('#wizard-model')).toBeVisible();
  await expect(page.locator('#bw-refresh-models')).toBeVisible();
  await expect(page.locator('#bw-test-model')).toBeVisible();
});

test('safety toggles default off and saved keys are not prefilled', async ({ page }) => {
  await openSettings(page);
  await expect(page.locator('#wizard-allow-api-delete')).toHaveCount(0);
  await expect(page.locator('#wizard-allow-private-providers')).toBeVisible();
  await expect(page.locator('#wizard-allow-private-providers')).not.toBeChecked();
  expect(await page.inputValue('#wizard-api-key')).toBe('');
  expect(await page.inputValue('#wizard-gpt-api-key')).toBe('');
  await expect(page.locator('#bw-generate-gpt-key')).toBeVisible();
});

test('Generate fills a random GPT Action key', async ({ page }) => {
  await openSettings(page);
  await page.click('#bw-generate-gpt-key');
  const value = await page.inputValue('#wizard-gpt-api-key');
  expect(value.length).toBeGreaterThanOrEqual(32);
  expect(value).toMatch(/^[0-9a-f]+$/);
});

test('choosing a preset fills the base URL without touching the model', async ({ page }) => {
  await openSettings(page);
  const modelBefore = await page.inputValue('#wizard-model');

  await page.selectOption('#wizard-provider', 'openrouter');
  await expect(page.locator('#wizard-base-url')).toHaveValue(/openrouter\.ai/);

  await page.selectOption('#wizard-provider', 'llmgateway');
  await expect(page.locator('#wizard-base-url')).toHaveValue(/llmgateway\.io/);

  // The model field is untouched by preset changes.
  expect(await page.inputValue('#wizard-model')).toBe(modelBefore);
});

test('Refresh models populates a searchable dropdown and shows metadata filters', async ({ page, request }) => {
  await mockConfig(request, { catalog: 'openrouter' });
  await openSettings(page);
  await page.fill('#wizard-base-url', MOCK_BASE);
  await page.click('#bw-refresh-models');

  await expect(page.locator('#bw-model-status')).toContainText('3 model(s) retrieved');
  await expect(page.locator('#bw-filter-free-wrap')).toBeVisible();
  await expect(page.locator('#bw-filter-tools-wrap')).toBeVisible();

  // Focus opens the menu, which lists provider-supplied models.
  await page.click('#wizard-model');
  await expect(page.locator('.bw-model-item').filter({ hasText: 'meta-llama/llama-3.1-8b-instruct:free' })).toBeVisible();

  // Typing narrows the list.
  await page.fill('#wizard-model', 'gpt');
  const items = page.locator('.bw-model-item');
  await expect(items.filter({ hasText: 'openai/gpt-4o' })).toBeVisible();
  await expect(items.filter({ hasText: 'mistral' })).toHaveCount(0);

  // Selecting an item sets the model id (manual entry remains possible).
  await items.filter({ hasText: 'openai/gpt-4o' }).first().click();
  await expect(page.locator('#wizard-model')).toHaveValue('openai/gpt-4o');
});

test('free-only filter narrows the list when pricing metadata is available', async ({ page, request }) => {
  await mockConfig(request, { catalog: 'openrouter' });
  await openSettings(page);
  await page.fill('#wizard-base-url', MOCK_BASE);
  await page.click('#bw-refresh-models');
  await expect(page.locator('#bw-model-status')).toContainText('3 model(s) retrieved');

  await page.check('#bw-filter-free');
  await page.click('#wizard-model');
  const items = page.locator('.bw-model-item');
  await expect(items.filter({ hasText: ':free' })).toBeVisible();
  await expect(items.filter({ hasText: 'openai/gpt-4o' })).toHaveCount(0);
});

test('filters stay hidden when the catalog has no reliable metadata', async ({ page, request }) => {
  await mockConfig(request, { models: { status: 200, body: { data: [{ id: 'plain-model' }] } } });
  await openSettings(page);
  await page.fill('#wizard-base-url', MOCK_BASE);
  await page.click('#bw-refresh-models');

  await expect(page.locator('#bw-model-status')).toContainText('1 model(s) retrieved');
  await expect(page.locator('#bw-filter-free-wrap')).toBeHidden();
  await expect(page.locator('#bw-filter-tools-wrap')).toBeHidden();

  await page.click('#wizard-model');
  await expect(page.locator('.bw-model-item').filter({ hasText: 'plain-model' })).toBeVisible();
});

test('a failed discovery reports stages and keeps the saved model', async ({ page, request }) => {
  await mockConfig(request, { models: { status: 500, body: { error: { message: 'boom' } } } });
  await openSettings(page);
  const modelBefore = await page.inputValue('#wizard-model');
  expect(modelBefore.length).toBeGreaterThan(0);

  await page.fill('#wizard-base-url', MOCK_BASE);
  await page.click('#bw-refresh-models');

  await expect(page.locator('#bw-model-status')).toContainText('not retrieved');
  await expect(page.locator('#bw-model-status')).toContainText('reachable');
  // The model field is unchanged.
  expect(await page.inputValue('#wizard-model')).toBe(modelBefore);
});

test('Test model reports inference separately from authentication', async ({ page, request }) => {
  await openSettings(page);
  await page.fill('#wizard-base-url', MOCK_BASE);
  await page.fill('#wizard-model', 'gpt-4o-mini');
  await page.click('#bw-test-model');

  await expect(page.locator('#bw-model-status')).toContainText('Authentication');
  await expect(page.locator('#bw-model-status')).toContainText('Inference');
  await expect(page.locator('#bw-model-status')).toContainText('model replied');

  // Authentication failure is distinct from inference failure.
  await mockConfig(request, { status: 401 });
  await page.click('#bw-test-model');
  await expect(page.locator('#bw-model-status')).toContainText('rejected');
});

/*
 * The settings page is an approved baseline (see DECISION_LOG D-0053).
 * These checks guard its controls, persistence and Save/Cancel behaviour so a
 * workspace repair cannot regress the configuration interface.
 */
test('approved settings controls are all present and unchanged', async ({ page }) => {
  await openSettings(page);

  const controls = [
    '#wizard-provider', '#wizard-base-url', '#wizard-model', '#bw-refresh-models',
    '#bw-test-model', '#bw-model-menu', '#bw-filter-free', '#bw-filter-tools',
    '#wizard-api-key', '#wizard-gpt-api-key', '#bw-generate-gpt-key',
    '#wizard-temperature', '#wizard-max-tokens', '#wizard-system-prompt',
    '#wizard-allow-private-providers'
  ];
  for (const selector of controls) {
    await expect(page.locator(selector)).toHaveCount(1);
  }

  // Bludit's own Save/Cancel controls are still attached to the form.
  await expect(page.locator('#jsform button[type="submit"][name="save"]')).toBeVisible();
  await expect(page.locator('#jsform a.btn-secondary')).toHaveAttribute('href', /\/admin\/plugins/);

  // The workspace repair must not rename the shared stylesheet or settings JS.
  const css = await page.locator('link[href*="wizard.css"]').getAttribute('href');
  const js = await page.locator('script[src*="settings.js"]').getAttribute('src');
  expect(css).toContain('/bl-plugins/wizard/css/wizard.css');
  expect(js).toContain('/bl-plugins/wizard/js/settings.js');
});

test('settings persist on Save and Cancel leaves settings untouched', async ({ page }) => {
  await openSettings(page);
  const original = await page.inputValue('#wizard-temperature');

  await page.fill('#wizard-temperature', '0.7');
  await page.fill('#wizard-model', 'persisted-model');
  await page.click('#jsform button[type="submit"][name="save"]');
  await page.waitForLoadState('domcontentloaded');

  await page.goto('/admin/configure-plugin/pluginWizard');
  await expect(page.locator('#wizard-temperature')).toHaveValue('0.7');
  await expect(page.locator('#wizard-model')).toHaveValue('persisted-model');

  // Cancel is a link back to the plugin list and does not persist edits.
  await page.fill('#wizard-temperature', '1.9');
  await page.click('#jsform a.btn-secondary');
  await expect(page).toHaveURL(/\/admin\/plugins/);

  await page.goto('/admin/configure-plugin/pluginWizard');
  await expect(page.locator('#wizard-temperature')).toHaveValue('0.7');

  // Restore the seeded values for any later test run.
  await page.fill('#wizard-temperature', original);
  await page.fill('#wizard-model', 'mock-model');
  await page.click('#jsform button[type="submit"][name="save"]');
});

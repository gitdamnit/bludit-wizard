#!/usr/bin/env node
/*
 * Bludit Wizard automated test runner (HTTP API + security + static + PHP lint).
 *
 * No third-party dependencies: uses Node's global fetch and child_process.
 * Browser/UI coverage lives in tests/e2e (Playwright).
 *
 * Usage:
 *   node tests/runner.mjs                 # all targets found in testenv/.state
 *   node tests/runner.mjs --target community
 *   node tests/runner.mjs --json out.json
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const STATE_DIR = join(REPO, 'testenv', '.state');
const PLUGIN_SRC = join(REPO, 'wizard');
const CONTAINER_PLUGIN = '/var/www/html/bl-plugins/wizard';

const argv = process.argv.slice(2);
const argVal = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const onlyTarget = argVal('--target');
const jsonOut = argVal('--json') || join(REPO, 'reports', 'raw', 'results.json');

const results = [];
function record(category, target, name, status, expected, actual, note) {
  results.push({ category, target, name, status, expected, actual, note: note || '' });
  const icon = status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : 'SKIP';
  const tail = status === 'pass' ? '' : `  (expected: ${expected} | actual: ${actual})`;
  console.log(`  ${icon} [${category}/${target}] ${name}${tail}`);
}
const pass = (...a) => record(a[0], a[1], a[2], 'pass', a[3] ?? '', a[4] ?? '', a[5]);
const fail = (cat, target, name, expected, actual, note) => record(cat, target, name, 'fail', expected, actual, note);
const skip = (cat, target, name, note) => record(cat, target, name, 'skip', '', '', note);

async function http(method, url, opts = {}) {
  const res = await fetch(url, { method, redirect: 'manual', ...opts });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, headers: res.headers, setCookie, text, json };
}
const auth = (key) => ({ Authorization: `Bearer ${key}` });
const jsonBody = (obj) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

function check(cat, target, name, condition, expected, actual, note) {
  if (condition) pass(cat, target, name, expected, actual, note);
  else fail(cat, target, name, expected, actual, note);
}

function loadStates() {
  const out = {};
  if (!existsSync(STATE_DIR)) return out;
  for (const f of readdirSync(STATE_DIR)) {
    if (!f.endsWith('.env')) continue;
    const obj = {};
    for (const line of readFileSync(join(STATE_DIR, f), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) obj[m[1]] = m[2];
    }
    obj.TARGET = f.replace(/\.env$/, '');
    out[obj.TARGET] = obj;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Static / source checks                                              */
/* ------------------------------------------------------------------ */
function staticChecks() {
  const T = 'static';
  const plugin = readFileSync(join(PLUGIN_SRC, 'plugin.php'), 'utf8');
  let meta = {};
  try { meta = JSON.parse(readFileSync(join(PLUGIN_SRC, 'metadata.json'), 'utf8')); } catch { /* */ }
  let lang = {};
  try { lang = JSON.parse(readFileSync(join(PLUGIN_SRC, 'languages', 'en.json'), 'utf8')); } catch { /* */ }
  const changelog = readFileSync(join(PLUGIN_SRC, 'CHANGELOG.md'), 'utf8');
  const js = readFileSync(join(PLUGIN_SRC, 'js', 'wizard.js'), 'utf8');
  const settingsJs = existsSync(join(PLUGIN_SRC, 'js', 'settings.js')) ? readFileSync(join(PLUGIN_SRC, 'js', 'settings.js'), 'utf8') : '';
  const policy = existsSync(join(PLUGIN_SRC, 'lib', 'netpolicy.php')) ? readFileSync(join(PLUGIN_SRC, 'lib', 'netpolicy.php'), 'utf8') : '';

  check(T, '-', 'plugin.php defines class pluginWizard extends Plugin',
    /class\s+pluginWizard\s+extends\s+Plugin/.test(plugin), 'class present', 'class present');
  check(T, '-', 'plugin declares required hooks',
    ['form', 'beforeAll', 'adminController', 'adminSidebar', 'adminView'].every((m) => new RegExp(`function\\s+${m}\\s*\\(`).test(plugin)),
    'form, beforeAll, adminController, adminSidebar, adminView', 'checked');
  check(T, '-', 'metadata.version is semver',
    /^\d+\.\d+\.\d+$/.test(String(meta.version)), 'x.y.z', String(meta.version));
  check(T, '-', 'metadata.compatible covers 3.22',
    String(meta.compatible || '').includes('3.22'), 'contains 3.22', String(meta.compatible));
  check(T, '-', 'metadata.license is GPL-3.0-only', String(meta.license) === 'GPL-3.0-only', 'GPL-3.0-only', String(meta.license));
  const licenseText = readFileSync(join(PLUGIN_SRC, 'LICENSE'), 'utf8');
  check(T, '-', 'LICENSE contains the official GPL version 3 text',
    licenseText.includes('GNU GENERAL PUBLIC LICENSE') && licenseText.includes('Version 3, 29 June 2007')
      && licenseText.includes('END OF TERMS AND CONDITIONS'), 'GPLv3 text', 'checked');
  check(T, '-', 'metadata.author is not placeholder',
    !!meta.author && !/^(openai|author|_author_)$/i.test(meta.author), 'real author', String(meta.author));
  check(T, '-', 'metadata has releaseDate/website/notes',
    !!(meta.releaseDate && meta.website && meta.notes), 'present', 'checked');
  check(T, '-', 'language file has plugin-data name+description',
    !!(lang['plugin-data']?.name && lang['plugin-data']?.description), 'name+description', 'checked');
  check(T, '-', 'CHANGELOG documents current version',
    changelog.includes(String(meta.version)), `entry for ${meta.version}`, 'checked');
  check(T, '-', 'admin sidebar uses class-name route (not directoryName)',
    /strtolower\(\s*get_class\(\s*\$this\s*\)\s*\)/.test(plugin) && !/directoryName\(\)\s*;/m.test(plugin.match(/function adminSidebar[\s\S]*?\n\s*\}/)?.[0] || 'x'),
    'strtolower(get_class($this))', 'checked');
  check(T, '-', 'sidebar/AJAX/redirect target plugin/pluginwizard',
    (plugin.match(/plugin\/pluginwizard/g) || []).length >= 2 && !/plugin\/wizard['"?]/i.test(plugin.replace(/plugin\/pluginwizard/g, '')),
    '>=2 plugin/pluginwizard, no plugin/wizard', 'checked');
  check(T, '-', 'GPT API base path is /api/wizard',
    plugin.includes("'/api/wizard'"), '/api/wizard', 'checked');
  check(T, '-', 'API uses constant-time key comparison',
    /hash_equals\s*\(/.test(plugin), 'hash_equals', 'checked');
  check(T, '-', 'JS preview gates write behind Apply control',
    /bw-save/.test(js) && /Apply this change/.test(js), 'apply control present', 'checked');
  check(T, '-', 'no obvious hardcoded secret in source',
    !/(sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]{20,}["'])/i.test(plugin),
    'no secret literal', 'checked');

  // 1.0.5 provider validation + model discovery.
  check(T, '-', 'declares provider discovery/inference methods',
    ['providerPresets', 'handleDiscoverModels', 'discoverModels', 'handleTestModel', 'testModel', 'parseModelList', 'validateProviderUrl', 'requireAdministrator', 'httpJson']
      .every((m) => new RegExp(`function\\s+${m}\\s*\\(`).test(plugin)),
    'all present', 'checked');
  check(T, '-', 'registers discover_models and test_model actions',
    plugin.includes("'discover_models'") && plugin.includes("'test_model'"), 'both actions', 'checked');
  check(T, '-', 'ships presets for OpenAI, OpenRouter and LLM Gateway',
    ['openai', 'openrouter', 'llmgateway', 'ollama', 'compatible'].every((k) => new RegExp(`'${k}'\\s*=>`).test(plugin)),
    'five presets', 'checked');
  check(T, '-', 'discovery uses GET /models with Bearer auth',
    /\/models'/.test(plugin) && /Authorization: Bearer/.test(plugin), '/models + Bearer', 'checked');
  check(T, '-', 'settings.js renders provider data with textContent (no innerHTML injection)',
    settingsJs.includes('textContent') && !/\.innerHTML\s*=/.test(settingsJs), 'textContent only', 'checked');
  check(T, '-', 'plugin writes no error_log/var_dump output (no catalog in logs)',
    !/error_log\s*\(/.test(plugin) && !/var_dump\s*\(/.test(plugin) && !/print_r\s*\(/.test(plugin),
    'no logging of payloads', 'checked');

  // 1.0.5/1.0.6 hardening.
  check(T, '-', 'private-network providers default to off',
    /'allowPrivateProviders'\s*=>\s*false/.test(plugin), 'false by default', 'checked');
  check(T, '-', 'declares the private-provider capability helper',
    /function\s+isPrivateProviderAllowed\s*\(/.test(plugin), 'helper present', 'checked');
  // 1.0.6-rc2: all Wizard page-deletion capability is gone.
  check(T, '-', 'Wizard exposes no page-deletion capability',
    !/function\s+gptDeletePage\s*\(/.test(plugin)
      && !/function\s+deletePage\s*\(/.test(plugin)
      && !/function\s+isApiDeleteAllowed\s*\(/.test(plugin)
      && !/'allowApiDelete'\s*=>/.test(plugin)
      && !/id="bw-delete"/.test(plugin)
      && !/Delete selected page/.test(plugin),
    'no delete method/button/setting', 'checked');
  check(T, '-', 'DELETE requests are refused as unsupported',
    /deletion_not_supported/.test(plugin) && /405/.test(plugin), '405 deletion_not_supported', 'checked');
  check(T, '-', 'save_page enforces a review revision (stale-edit protection)',
    /baseRevision/.test(plugin) && /stale_page/.test(plugin) && /409/.test(plugin),
    'baseRevision + 409', 'checked');
  check(T, '-', 'AI response includes the original page snapshot',
    /pageReviewSnapshot/.test(plugin) && /'original'/.test(plugin), 'original snapshot', 'checked');

  // 1.1.0 twelve-task menu.
  const taskKeys = ['create_page', 'create_outline', 'article_ideas', 'improve_page', 'rewrite_tone',
    'adjust_length', 'proofread', 'seo_audit', 'seo_metadata', 'internal_links', 'freshness_audit', 'ask_wizard'];
  const taskActions = ['Generate Draft', 'Generate Outline', 'Generate Ideas', 'Review Improvements',
    'Rewrite Content', 'Adjust Length', 'Proofread Page', 'Analyze Page', 'Generate Metadata',
    'Find Link Opportunities', 'Check Content Freshness', 'Ask Wizard'];
  check(T, '-', 'declares exactly the twelve approved tasks',
    taskKeys.every((k) => new RegExp(`'${k}'\\s*=>`).test(plugin)), '12 task keys', 'checked');
  check(T, '-', 'uses the approved contextual action labels',
    taskActions.every((a) => plugin.includes(a)), '12 action labels', 'checked');
  check(T, '-', 'provides task-specific guidance',
    (plugin.match(/'guidance'\s*=>/g) || []).length >= 12, '>=12 guidance strings', 'checked');
  check(T, '-', 'defines the six reusable result types',
    ['page_draft', 'page_revision', 'structured_audit', 'metadata_proposal', 'text_generation', 'conversational']
      .every((r) => plugin.includes(r)), 'all result types', 'checked');
  check(T, '-', 'analysis tasks are read-only (no apply)',
    /'seo_audit'[\s\S]{0,500}'editable'\s*=>\s*false/.test(plugin)
      && /'internal_links'[\s\S]{0,500}'editable'\s*=>\s*false/.test(plugin)
      && /'freshness_audit'[\s\S]{0,500}'editable'\s*=>\s*false/.test(plugin),
    'audits non-editable', 'checked');
  check(T, '-', 'internal-link targets are validated server-side',
    /parseJsonResult/.test(plugin) && /\$pages->exists\(\$target\)/.test(plugin), 'target validation', 'checked');
  check(T, '-', 'dashboard is a single full-width workspace (no sidebar cards)',
    !/Site intelligence/.test(plugin) && !/AI configuration/.test(plugin) && !/bw-side/.test(plugin),
    'no sidebar cards', 'checked');
  check(T, '-', 'saved secrets are never echoed into the settings form',
    /id="wizard-api-key"[^']*value=""/.test(plugin) && /id="wizard-gpt-api-key"[^']*value=""/.test(plugin)
      && !/\$apiKey\s*=\s*htmlspecialchars/.test(plugin) && !/\$wizardApiKey\s*=\s*htmlspecialchars/.test(plugin),
    'empty values only', 'checked');
  check(T, '-', 'overrides post() to preserve blank secrets',
    /public function post\(\)/.test(plugin) && /preserve/.test(plugin), 'post override', 'checked');
  check(T, '-', 'private provider hosts require explicit opt-in',
    /isPrivateProviderAllowed\(\)/.test(plugin) && /Allow private-network provider hosts/.test(plugin),
    'opt-in required', 'checked');
  check(T, '-', 'metadata hostnames are blocked',
    /metadata\.google\.internal/.test(policy), 'denylist present', 'checked');
  check(T, '-', 'provider hostnames are resolved and pinned (DNS-rebinding mitigation)',
    /function\s+prepareHostPinning\s*\(/.test(plugin) && /function\s+resolveHostIps\s*\(/.test(plugin)
      && /CURLOPT_RESOLVE/.test(plugin),
    'resolve + pin', 'checked');

  // 1.0.6 SSRF hardening.
  check(T, '-', 'network policy lives in a dependency-free library',
    /class\s+BluditWizardNetPolicy/.test(policy) && /screenIps\s*\(/.test(policy) && /resolveEntries\s*\(/.test(policy),
    'policy library present', 'checked');
  check(T, '-', 'alternate IPv4 encodings are normalised (decimal/octal/hex/short)',
    /normalizeNumericHost\s*\(/.test(policy) && /hexdec/.test(policy) && /octdec/.test(policy),
    'numeric normalisation', 'checked');
  check(T, '-', 'IPv4-mapped IPv6, NAT64, 6to4 and Teredo are blocked',
    /::ffff:/.test(policy) && /64:ff9b::\/96/.test(policy) && /2002::\/16/.test(policy) && /2001::\/32/.test(policy),
    'mapping/tunnel blocks', 'checked');
  check(T, '-', 'cloud metadata addresses are blocked even with private access',
    /fd00:ec2::254/.test(policy) && /169\.254\.169\.254/.test(policy),
    'metadata denylist', 'checked');
  check(T, '-', 'hostname pinning fails closed when CURLOPT_RESOLVE is unavailable',
    /CURLOPT_RESOLVE is missing/.test(plugin) && /Refusing to send the request/.test(plugin),
    'fail-closed pinning', 'checked');
  check(T, '-', 'bounded DNS resolver uses a stream_select deadline',
    /function\s+resolveHost\s*\(/.test(policy) && /stream_select\s*\(/.test(policy) && /parseDnsAnswers/.test(policy),
    'bounded resolver', 'checked');
  check(T, '-', 'transport verifies the connected peer address',
    /CURLINFO_PRIMARY_IP/.test(plugin) && /possible DNS rebinding/.test(plugin),
    'peer verification', 'checked');

  // 1.1.0 regression repair (DECISION_LOG D-0051/D-0052).
  check(T, '-', 'workspace form keeps a server-recognised dispatch action',
    /<input type="hidden" name="action" value="ai">/.test(plugin), 'hidden action=ai', 'checked');
  check(T, '-', 'page selector is server-rendered visible (not hidden by default)',
    /id="bw-page-wrap">/.test(plugin) && !/id="bw-page-wrap" hidden/.test(plugin),
    'visible wrapper', 'checked');
  check(T, '-', 'native (non-AJAX) posts fail safely instead of running tasks',
    /function\s+isAjaxAdminRequest\s*\(/.test(plugin) && /adminNotice/.test(plugin)
      && /X-Requested-With/.test(js),
    'AJAX guard + notice', 'checked');
  check(T, '-', 'plugin assets carry a cache-busting version',
    /const\s+ASSET_VERSION\s*=/.test(plugin) && /function\s+assetUrl\s*\(/.test(plugin)
      && /assetUrl\('js\/wizard\.js'\)/.test(plugin) && /assetUrl\('css\/wizard\.css'\)/.test(plugin)
      && /assetUrl\('js\/settings\.js'\)/.test(plugin),
    'versioned assets', 'checked');
  check(T, '-', 'initial action label comes from the task definitions',
    /defaultAction/.test(plugin) && /id="bw-run" type="submit">' \. htmlspecialchars\(\$defaultAction/.test(plugin),
    'server-rendered label', 'checked');
  check(T, '-', 'wizard.js surfaces initialization failures',
    /showInitFailure/.test(js) && /could not initialize/.test(js)
      && /X-Requested-With/.test(js) && /XMLHttpRequest/.test(js),
    'init failure path', 'checked');
}

/* ------------------------------------------------------------------ */
/* PHP static analysis (inside a PHP CLI container)                    */
/* ------------------------------------------------------------------ */
function phpStatic() {
  const T = 'php-static';
  let out = '';
  try {
    out = execFileSync('docker', ['run', '--rm',
      '-v', `${PLUGIN_SRC}:/w:ro`,
      '-v', join(REPO, 'tests', 'php') + ':/t:ro',
      'php:8.2-cli', 'php', '/t/static_analysis.php', '/w/plugin.php'
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // Non-zero exit still prints JSON on stdout.
    out = (e.stdout || '') + (e.stderr || '');
  }
  let rep = null;
  try { rep = JSON.parse(out.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch { /* */ }
  if (!rep) { fail('php-static', T, 'static analysis produced JSON', 'JSON', out.slice(0, 120)); return; }
  check('php-static', T, 'no shell/dynamic-code/unsafe-deserialise functions',
    (rep.hard_failures || []).length === 0, 'none', (rep.hard_failures || []).join(',') || 'none');
  check('php-static', T, 'uses htmlspecialchars for output escaping', rep.uses_htmlspecialchars === true, 'true', String(rep.uses_htmlspecialchars));
  check('php-static', T, 'uses constant-time hash_equals for the API key', rep.uses_hash_equals === true, 'true', String(rep.uses_hash_equals));
  check('php-static', T, 'uses Bludit core page API (no direct file writes)', rep.uses_core_page_api === true, 'true', String(rep.uses_core_page_api));
  check('php-static', T, 'declares beforeAll and adminController hooks',
    rep.declares_beforeAll === true && rep.declares_adminController === true, 'both', `${rep.declares_beforeAll}/${rep.declares_adminController}`);
  check('php-static', T, 'does not redeclare the broken isValidCsrf check',
    rep.redeclares_isValidCsrf === false, 'false', String(rep.redeclares_isValidCsrf));
}

/* ------------------------------------------------------------------ */
/* Network-policy unit suite (dependency-free PHP)                     */
/* ------------------------------------------------------------------ */
function netpolicyUnitTests() {
  const T = 'netpolicy';
  let out = '';
  try {
    out = execFileSync('docker', ['run', '--rm', '-v', `${REPO}:/w:ro`,
      'php:8.2-cli', 'php', '/w/tests/php/netpolicy_test.php'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const m = out.match(/PASS (\d+)\s+FAIL (\d+)/);
  const p = m ? Number(m[1]) : -1;
  const f = m ? Number(m[2]) : -1;
  check('netpolicy', T, 'network-policy unit suite runs', p >= 0, 'PASS/FAIL summary', m ? m[0] : out.slice(0, 120));
  check('netpolicy', T, 'network-policy unit suite passes', p > 0 && f === 0, 'fail=0', `${p} pass / ${f} fail`);
}

/* ------------------------------------------------------------------ */
/* PHP lint (inside the isolated container)                            */
/* ------------------------------------------------------------------ */
function phpLint(service) {
  const T = service;
  try {
    const out = execFileSync('docker', ['compose', '-f', join(REPO, 'testenv', 'compose.yaml'), 'exec', '-T', service,
      'php', '-l', `${CONTAINER_PLUGIN}/plugin.php`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    check('php-lint', T, 'plugin.php has no syntax errors',
      /No syntax errors detected/.test(out), 'No syntax errors detected', out.trim().split('\n').pop());
  } catch (e) {
    fail('php-lint', T, 'plugin.php has no syntax errors', 'No syntax errors detected', (e.stderr || e.stdout || String(e)).trim());
  }
  try {
    const script = `foreach (array('plugin.php','js/wizard.js','languages/en.json','metadata.json') as $f) { echo $f."\\n"; }`;
    execFileSync('docker', ['compose', '-f', join(REPO, 'testenv', 'compose.yaml'), 'exec', '-T', service,
      'php', '-r', `echo json_decode(file_get_contents('${CONTAINER_PLUGIN}/metadata.json'),true)['version'];`], { stdio: ['ignore', 'pipe', 'pipe'] });
    pass('php-lint', T, 'metadata.json parses as JSON (container php)', 'valid JSON', 'valid JSON');
  } catch (e) {
    fail('php-lint', T, 'metadata.json parses as JSON (container php)', 'valid JSON', (e.stderr || String(e)).trim());
  }
}

/* ------------------------------------------------------------------ */
/* API contract tests                                                  */
/* ------------------------------------------------------------------ */
async function apiTests(st) {
  const T = st.TARGET;
  const base = st.BASE_URL || `http://localhost:${st.PORT}`;
  const key = st.WIZARD_API_KEY;
  const api = `${base}/api/wizard`;

  const noKey = await http('GET', `${api}/site`);
  check('api', T, 'GET /site without key -> 401', noKey.status === 401, 401, noKey.status);
  const wrong = await http('GET', `${api}/site`, { headers: auth('wrong-key') });
  check('api', T, 'GET /site wrong key -> 401', wrong.status === 401, 401, wrong.status);
  const nonBearer = await http('GET', `${api}/site`, { headers: { Authorization: key } });
  check('api', T, 'GET /site key without Bearer prefix -> 401', nonBearer.status === 401, 401, nonBearer.status);
  const alt = await http('GET', `${api}/site`, { headers: { 'X-Bludit-Wizard-Key': key } });
  check('api', T, 'GET /site accepts X-Bludit-Wizard-Key fallback', alt.status === 200, 200, alt.status);

  const site = await http('GET', `${api}/site`, { headers: auth(key) });
  check('api', T, 'GET /site with key -> 200 ok:true', site.status === 200 && site.json?.ok === true, '200 {ok:true}', `${site.status} ${site.text.slice(0, 60)}`);
  check('api', T, 'GET /site reports totalPages', typeof site.json?.site?.totalPages === 'number', 'number', String(site.json?.site?.totalPages));

  const list = await http('GET', `${api}/pages`, { headers: auth(key) });
  check('api', T, 'GET /pages -> 200 array', list.status === 200 && Array.isArray(list.json?.pages), 'array', `${list.status}`);
  check('api', T, 'GET /pages count matches array length',
    list.json?.count === list.json?.pages?.length, 'equal', `${list.json?.count}/${list.json?.pages?.length}`);

  const trailing = await http('GET', `${api}/site/`, { headers: auth(key) });
  check('api', T, 'GET /site/ (trailing slash) -> 200', trailing.status === 200, 200, trailing.status);

  // Create
  const title = `Runner Page ${Date.now()}`;
  const created = await http('POST', `${api}/pages`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content: 'runner body', type: 'draft', description: 'runner', slug: 'api-runner-page' }) });
  check('api', T, 'POST /pages valid -> 201 created+verified',
    created.status === 201 && created.json?.ok === true && created.json?.page?.key,
    '201 with page.key', `${created.status} ${created.text.slice(0, 80)}`);
  const newKey = created.json?.page?.key;

  if (newKey) {
    const got = await http('GET', `${api}/pages/${encodeURIComponent(newKey)}`, { headers: auth(key) });
    check('api', T, 'GET created page -> 200 with content',
      got.status === 200 && got.json?.page?.content === 'runner body', '200 content match', `${got.status}`);

    const putNoConfirm = await http('PUT', `${api}/pages/${encodeURIComponent(newKey)}`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'x', content: 'y' }) });
    check('api', T, 'PUT without confirm -> 400', putNoConfirm.status === 400, 400, putNoConfirm.status);

    const putConfirmZero = await http('PUT', `${api}/pages/${encodeURIComponent(newKey)}`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: '0', title: 'x', content: 'y' }) });
    check('api', T, 'PUT confirm:"0" (falsy) -> 400', putConfirmZero.status === 400, 400, putConfirmZero.status);

    const put = await http('PUT', `${api}/pages/${encodeURIComponent(newKey)}`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true, title: 'Runner Updated', content: 'updated body' }) });
    check('api', T, 'PUT with confirm -> 200 updated+verified',
      put.status === 200 && put.json?.ok === true, '200', `${put.status}`);
    const afterPut = await http('GET', `${api}/pages/${encodeURIComponent(newKey)}`, { headers: auth(key) });
    check('api', T, 'PUT persisted new content',
      afterPut.json?.page?.content === 'updated body', 'updated body', String(afterPut.json?.page?.content));

    // Page deletion is not part of Bludit Wizard (1.0.6-rc2): DELETE is
    // refused and must never change the site.
    const del = await http('DELETE', `${api}/pages/${encodeURIComponent(newKey)}`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) });
    check('api', T, 'DELETE is not supported -> 405 deletion_not_supported',
      del.status === 405 && del.json?.code === 'deletion_not_supported', '405', `${del.status} ${del.text.slice(0, 70)}`);
    const survived = await http('GET', `${api}/pages/${encodeURIComponent(newKey)}`, { headers: auth(key) });
    check('api', T, 'refused DELETE leaves the page in place', survived.status === 200, 200, survived.status);
  } else {
    skip('api', T, 'create/update lifecycle (no key returned)');
  }

  // Type coercion + validation
  const badType = await http('POST', `${api}/pages`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `TypeCoerce ${Date.now()}`, content: 'c', type: 'nonsense', slug: 'api-typecoerce-page' }) });
  check('api', T, 'POST invalid type coerced to draft (still 201)',
    badType.status === 201 && badType.json?.page?.type === 'draft', 'draft', `${badType.status} ${badType.json?.page?.type}`);

  const missing = await http('POST', `${api}/pages`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'only title' }) });
  check('api', T, 'POST missing content -> 400', missing.status === 400, 400, missing.status);
  const badJson = await http('POST', `${api}/pages`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: '{not json' });
  check('api', T, 'POST invalid JSON -> 400', badJson.status === 400, 400, badJson.status);

  const notFound = await http('GET', `${api}/pages/definitely-missing-xyz`, { headers: auth(key) });
  check('api', T, 'GET missing page -> 404', notFound.status === 404, 404, notFound.status);

  const unknown = await http('GET', `${api}/nope`, { headers: auth(key) });
  check('api', T, 'unknown endpoint -> 404', unknown.status === 404, 404, unknown.status);

  const patch = await http('PATCH', `${api}/pages`, { headers: auth(key) });
  check('api', T, 'PATCH method -> 405', patch.status === 405, 405, patch.status);

  const ct = (await http('GET', `${api}/site`, { headers: auth(key) })).headers.get('content-type') || '';
  check('api', T, 'responses are application/json', ct.includes('application/json'), 'application/json', ct);

}

/* ------------------------------------------------------------------ */
/* Security tests                                                      */
/* ------------------------------------------------------------------ */
async function securityTests(st) {
  const T = st.TARGET;
  const base = st.BASE_URL || `http://localhost:${st.PORT}`;
  const key = st.WIZARD_API_KEY;
  const api = `${base}/api/wizard`;

  // 1. Unauthenticated write must not change state.
  const before = await http('GET', `${api}/pages`, { headers: auth(key) });
  const countBefore = before.json?.count;
  const anon = await http('POST', `${api}/pages`, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'anon-injected', content: 'x' }) });
  const after = await http('GET', `${api}/pages`, { headers: auth(key) });
  check('security', T, 'unauthenticated create rejected -> 401', anon.status === 401, 401, anon.status);
  check('security', T, 'unauthenticated create has no side effect', after.json?.count === countBefore, countBefore, after.json?.count);

  // 2. Path traversal in page key must not read files.
  const trav = await http('GET', `${api}/pages/..%2f..%2f..%2f..%2fetc%2fpasswd`, { headers: auth(key) });
  check('security', T, 'path traversal key does not leak file contents',
    !/root:.*:0:0:/.test(trav.text), 'no /etc/passwd content', `status ${trav.status}`);

  // 3. Stored XSS in page title is escaped in the admin UI.
  const xssTitle = `XSS <img src=x onerror=alert(1)> ${Date.now()}`;
  const xss = await http('POST', `${api}/pages`, { headers: { ...auth(key), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: xssTitle, content: 'xss body' }) });
  const xssKey = xss.json?.page?.key;

  // 4. API response must not echo the wizard key or LLM key.
  const siteResp = await http('GET', `${api}/site`, { headers: auth(key) });
  check('security', T, 'API does not echo wizard API key', !siteResp.text.includes(key), 'key absent', 'checked');

  // 5. No permissive CORS on API.
  const cors = siteResp.headers.get('access-control-allow-origin');
  check('security', T, 'API does not send Access-Control-Allow-Origin: *', cors !== '*', 'absent or restricted', String(cors));

  // 6. Admin area requires authentication.
  const adminWizard = await http('GET', `${base}/admin/plugin/pluginwizard`);
  check('security', T, 'admin wizard page requires login (no BW_CONFIG for anon)',
    !adminWizard.text.includes('window.BW_CONFIG'), 'no BW_CONFIG', 'checked');

  // 7. Admin AJAX POST without CSRF is rejected.
  const noCsrf = await http('POST', `${base}/admin/plugin/pluginwizard`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'action=ai&task=ask_wizard&prompt=hi' });
  check('security', T, 'admin AJAX POST without CSRF rejected',
    noCsrf.status !== 200 && noCsrf.json?.ok !== true, 'not 200 ok', `${noCsrf.status} ${noCsrf.text.slice(0, 60)}`);

}

/* ------------------------------------------------------------------ */
/* Admin-authenticated checks (login + CSRF token, then AJAX)          */
/* ------------------------------------------------------------------ */
function cookieJar() {
  let cookie = '';
  return {
    header: () => cookie,
    absorb: (res) => {
      for (const c of (res.setCookie || [])) { cookie = c.split(';')[0]; }
    }
  };
}

async function adminTests(st) {
  const T = st.TARGET;
  const base = st.BASE_URL || `http://localhost:${st.PORT}`;
  const jar = cookieJar();
  const get = async (url, headers = {}) => {
    const h = { ...headers };
    if (jar.header()) h.Cookie = jar.header();
    const r = await http('GET', url, { headers: h });
    jar.absorb(r);
    return r;
  };
  const post = async (url, body, headers = {}) => {
    const h = {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Simulates the workspace fetch client. Native-form fallback tests
      // deliberately omit this header.
      'X-Requested-With': 'XMLHttpRequest',
      ...headers
    };
    if (jar.header()) h.Cookie = jar.header();
    const r = await http('POST', url, { headers: h, body });
    jar.absorb(r);
    return r;
  };

  const login = await get(`${base}/admin/login`);
  const loginToken = (login.text.match(/name="tokenCSRF" value="([^"]+)"/) || [])[1];
  check('admin', T, 'login page exposes CSRF token', !!loginToken, 'token', loginToken ? 'present' : 'missing');

  const doLogin = await post(`${base}/admin/login`, `tokenCSRF=${encodeURIComponent(loginToken || '')}&username=${st.ADMIN_USER}&password=${st.ADMIN_PASS}`);
  check('admin', T, 'admin login succeeds (redirect to dashboard)',
    (doLogin.status === 301 || doLogin.status === 302) && String(doLogin.headers.get('location') || '').includes('dashboard'),
    'redirect -> dashboard', `${doLogin.status} ${doLogin.headers.get('location')}`);

  const wizard = await get(`${base}/admin/plugin/pluginwizard`);
  check('admin', T, 'wizard admin route /admin/plugin/pluginwizard renders',
    wizard.status === 200 && wizard.text.includes('window.BW_CONFIG'), '200 + BW_CONFIG', String(wizard.status));
  const wizToken = (wizard.text.match(/"token":"([^"]+)"/) || [])[1];

  // Balanced forms (D3).
  const openForms = (wizard.text.match(/<form\b/g) || []).length;
  const closeForms = (wizard.text.match(/<\/form>/g) || []).length;
  check('admin', T, 'wizard page has balanced <form>/</form> tags',
    openForms === closeForms, `${openForms} open`, `${closeForms} close`);

  // --- v1.1.0 regression coverage ---------------------------------
  check('admin', T, 'workspace form carries the dispatch action',
    /<input type="hidden" name="action" value="ai">/.test(wizard.text), 'hidden action=ai', 'checked');
  check('admin', T, 'page selector is rendered visible before JavaScript runs',
    /id="bw-page-wrap">/.test(wizard.text) && !/id="bw-page-wrap" hidden/.test(wizard.text),
    'not hidden', 'checked');
  check('admin', T, 'initial button uses the first task action',
    /id="bw-run" type="submit">Generate Draft</.test(wizard.text), 'Generate Draft', 'checked');
  check('admin', T, 'page selector is populated from Bludit pages',
    /id="bw-page" name="pageKey">/.test(wizard.text) && (wizard.text.match(/<option value="[^"]+">/g) || []).length >= 1,
    'options present', 'checked');

  const scriptSrc = (wizard.text.match(/<script src="([^"]*wizard\.js[^"]*)"/) || [])[1] || '';
  const styleHref = (wizard.text.match(/<link rel="stylesheet" href="([^"]*wizard\.css[^"]*)"/) || [])[1] || '';
  check('admin', T, 'wizard.js URL is cache-busted',
    /\?v=1\.1\.0$/.test(scriptSrc), '?v=1.1.0', scriptSrc || 'missing');
  check('admin', T, 'wizard.css URL is cache-busted',
    /\?v=1\.1\.0$/.test(styleHref), '?v=1.1.0', styleHref || 'missing');

  const jsRes = scriptSrc ? await http('GET', `${base}${scriptSrc}`) : { status: 0, text: '' };
  const cssRes = styleHref ? await http('GET', `${base}${styleHref}`) : { status: 0, text: '' };
  check('admin', T, 'served wizard.js is the v1.1.0 client',
    jsRes.status === 200 && jsRes.text.includes('showInitFailure') && jsRes.text.includes('X-Requested-With'),
    '200 + rc2 markers', `${jsRes.status}`);
  check('admin', T, 'served wizard.css is present',
    cssRes.status === 200 && cssRes.text.includes('.bw-shell'), '200 + .bw-shell', `${cssRes.status}`);

  // A browser-native POST (JavaScript never initialized) must not run the
  // task, must not return raw JSON, and must not write anything.
  const nativePost = async (body) => {
    const h = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (jar.header()) h.Cookie = jar.header();
    const r = await http('POST', `${base}/admin/plugin/pluginwizard`, { headers: h, body });
    jar.absorb(r);
    return r;
  };

  await http('POST', 'http://localhost:8090/__reset');
  const nativeAi = await nativePost(
    `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=ai&task=create_page&prompt=native-form-test`);
  const nativeState = await (await http('GET', 'http://localhost:8090/__state')).json;
  check('admin', T, 'native form POST shows a recovery message (not raw Unknown action)',
    nativeAi.status === 200 && nativeAi.text.includes('did not finish loading')
      && !nativeAi.text.includes('"error":"Unknown action."'),
    '200 + notice', `${nativeAi.status} ${nativeAi.text.slice(0, 60)}`);
  check('admin', T, 'native form POST does not call the AI provider',
    (nativeState?.requests || []).length === 0, '0 provider calls', `${(nativeState?.requests || []).length}`);

  const nativeSave = await nativePost(
    `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=save_page&pageKey=&title=Native&content=x`);
  check('admin', T, 'native save_page POST is refused with a visible message',
    nativeSave.status === 200 && nativeSave.text.includes('Nothing was saved'),
    '200 + Nothing was saved', `${nativeSave.status}`);

  const unknown = await post(`${base}/admin/plugin/pluginwizard`,
    `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=evil`,
    { 'Content-Type': 'application/x-www-form-urlencoded' });
  check('admin', T, 'unknown actions are still rejected',
    unknown.status === 400 && unknown.json?.error === 'Unknown action.',
    '400 Unknown action', `${unknown.status}`);

  const noAction = await post(`${base}/admin/plugin/pluginwizard`,
    `tokenCSRF=${encodeURIComponent(wizToken || '')}`);
  check('admin', T, 'a POST with neither action nor task is rejected',
    noAction.status === 400 && noAction.json?.error === 'Unknown action.',
    '400 Unknown action', `${noAction.status}`);

  // AJAX AI with a valid CSRF token (D1).
  await http('POST', 'http://localhost:8090/__reset');
  const ai = await post(`${base}/admin/plugin/pluginwizard`,
    `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=ai&task=create_page&prompt=Create%20a%20page%20about%20tea`,
    { 'Content-Type': 'application/x-www-form-urlencoded' });
  check('admin', T, 'admin AJAX action=ai with valid CSRF -> 200 ok',
    ai.status === 200 && ai.json?.ok === true, '200 {ok:true}', `${ai.status} ${ai.text.slice(0, 90)}`);

  // Provider contract: inspect what the plugin actually sent upstream.
  const mockState = await (await http('GET', 'http://localhost:8090/__state')).json;
  const upstream = (mockState?.requests || []).slice(-1)[0];
  check('provider', T, 'AI call is sent to {baseUrl}/chat/completions',
    !!upstream && /\/chat\/completions$/.test(upstream.url), '*/chat/completions', upstream ? upstream.url : 'none');
  check('provider', T, 'AI request carries model, temperature and max_tokens',
    !!upstream && typeof upstream.body?.model === 'string' && upstream.body.model.length > 0
      && typeof upstream.body?.temperature === 'number' && Number.isInteger(upstream.body?.max_tokens),
    'model + numeric temperature + int max_tokens',
    upstream ? `${upstream.body?.model} / ${upstream.body?.temperature} / ${upstream.body?.max_tokens}` : 'none');
  check('provider', T, 'AI request uses system+user messages',
    !!upstream && Array.isArray(upstream.body?.messages)
      && upstream.body.messages.some((m) => m.role === 'system') && upstream.body.messages.some((m) => m.role === 'user'),
    'system + user', upstream ? upstream.body.messages.map((m) => m.role).join(',') : 'none');
  check('provider', T, 'LLM key is sent to the provider as Bearer',
    !!upstream && String(upstream.headers?.authorization || '') === `Bearer ${st.LLM_API_KEY}`,
    `Bearer ${st.LLM_API_KEY || '<llm key>'}`, upstream ? String(upstream.headers?.authorization) : 'none');

  // Save/apply via admin AJAX.
  const save = await post(`${base}/admin/plugin/pluginwizard`,
    `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=save_page&pageKey=&title=Admin%20UI%20Page&slug=admin-ui-page&description=d&type=draft&content=admin%20content`,
    { 'Content-Type': 'application/x-www-form-urlencoded' });
  check('admin', T, 'admin AJAX save_page (create) -> 200 ok',
    save.status === 200 && save.json?.ok === true, '200 {ok:true}', `${save.status} ${save.text.slice(0, 90)}`);
  const adminKey = save.json?.page?.key;

  check('admin', T, 'admin page exposes no deletion control',
    !wizard.text.includes('bw-delete') && !wizard.text.includes('Delete selected page'),
    'no delete control', 'checked');

  if (adminKey) {
    // Wizard deletion is refused for everyone.
    const del = await post(`${base}/admin/plugin/pluginwizard`,
      `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=delete_page&pageKey=${encodeURIComponent(adminKey)}`,
      { 'Content-Type': 'application/x-www-form-urlencoded' });
    check('admin', T, 'admin AJAX delete_page is refused -> 403',
      del.status === 403 && del.json?.code === 'deletion_not_supported', '403 deletion_not_supported', `${del.status}`);
    const still = await http('GET', `${base}/api/wizard/pages/${encodeURIComponent(adminKey)}`,
      { headers: { Authorization: `Bearer ${st.WIZARD_API_KEY}` } });
    check('admin', T, 'refused admin delete leaves the page in place', still.status === 200, '200', String(still.status));

    // Original/proposed snapshot + stale-edit protection.
    await http('POST', 'http://localhost:8090/__reset');
    let ai = await post(`${base}/admin/plugin/pluginwizard`,
      `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=ai&task=improve_page&pageKey=${encodeURIComponent(adminKey)}&prompt=improve`,
      { 'Content-Type': 'application/x-www-form-urlencoded' });
    const rev1 = ai.json?.original?.revision;
    check('admin', T, 'AI response includes the read-only original snapshot',
      ai.status === 200 && !!ai.json?.original && ai.json.original.key === adminKey
        && typeof rev1 === 'string' && rev1.length === 64,
      'original + revision', `${ai.status} rev=${rev1 ? 'yes' : 'no'}`);
    check('admin', T, 'original snapshot carries the saved content',
      String(ai.json?.original?.content || '').includes('admin content'), 'content present', 'checked');

    const apply1 = await post(`${base}/admin/plugin/pluginwizard`,
      `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=save_page&pageKey=${encodeURIComponent(adminKey)}&baseRevision=${encodeURIComponent(rev1 || '')}&title=Admin%20UI%20Page&slug=admin-ui-page&description=d&type=draft&content=admin%20content%20v2`,
      { 'Content-Type': 'application/x-www-form-urlencoded' });
    check('admin', T, 'apply with the reviewed revision succeeds',
      apply1.status === 200 && apply1.json?.ok === true, '200', String(apply1.status));

    const stale = await post(`${base}/admin/plugin/pluginwizard`,
      `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=save_page&pageKey=${encodeURIComponent(adminKey)}&baseRevision=${encodeURIComponent(rev1 || '')}&title=Admin%20UI%20Page&slug=admin-ui-page&description=d&type=draft&content=admin%20content%20v3`,
      { 'Content-Type': 'application/x-www-form-urlencoded' });
    check('admin', T, 'stale revision is refused -> 409 stale_page',
      stale.status === 409 && stale.json?.code === 'stale_page', '409 stale_page', `${stale.status}`);
    const afterStale = await http('GET', `${base}/api/wizard/pages/${encodeURIComponent(adminKey)}`,
      { headers: { Authorization: `Bearer ${st.WIZARD_API_KEY}` } });
    check('admin', T, 'stale write did not change the page',
      String(afterStale.json?.page?.content || '') === 'admin content v2', 'admin content v2', String(afterStale.json?.page?.content));

    const noRev = await post(`${base}/admin/plugin/pluginwizard`,
      `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=save_page&pageKey=${encodeURIComponent(adminKey)}&title=x&slug=admin-ui-page&description=d&type=draft&content=y`,
      { 'Content-Type': 'application/x-www-form-urlencoded' });
    check('admin', T, 'missing revision is refused -> 409',
      noRev.status === 409 && noRev.json?.code === 'stale_page', '409', String(noRev.status));

    ai = await post(`${base}/admin/plugin/pluginwizard`,
      `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=ai&task=improve_page&pageKey=${encodeURIComponent(adminKey)}&prompt=improve`,
      { 'Content-Type': 'application/x-www-form-urlencoded' });
    const rev2 = ai.json?.original?.revision;
    const keepType = await post(`${base}/admin/plugin/pluginwizard`,
      `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=save_page&pageKey=${encodeURIComponent(adminKey)}&baseRevision=${encodeURIComponent(rev2 || '')}&title=Admin%20UI%20Page&slug=admin-ui-page&description=d&type=&content=admin%20content%20v4`,
      { 'Content-Type': 'application/x-www-form-urlencoded' });
    check('admin', T, 'missing status preserves the page type (draft stays draft)',
      keepType.status === 200 && keepType.json?.page?.type === 'draft',
      'draft', `${keepType.status} ${keepType.json?.page?.type}`);
  }

  // Provider error surfaced.
  await http('POST', 'http://localhost:8090/__config', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 500 }) });
  const aiErr = await post(`${base}/admin/plugin/pluginwizard`,
    `tokenCSRF=${encodeURIComponent(wizToken || '')}&action=ai&task=ask_wizard&prompt=hi`,
    { 'Content-Type': 'application/x-www-form-urlencoded' });
  check('admin', T, 'provider error is surfaced as JSON 500 (not CSRF/crash)',
    aiErr.status === 500 && aiErr.json?.ok === false && !/csrf/i.test(String(aiErr.json?.error)),
    '500 {ok:false, error: provider}', `${aiErr.status} ${aiErr.text.slice(0, 80)}`);
  await http('POST', 'http://localhost:8090/__reset');

  // Settings page renders and does not leak keys into the wizard page.
  const cfg = await get(`${base}/admin/configure-plugin/pluginWizard`);
  check('admin', T, 'plugin settings route /admin/configure-plugin/pluginWizard renders',
    cfg.status === 200 && cfg.text.includes('name="wizardApiKey"'), '200 form', String(cfg.status));
  check('admin', T, 'wizard page does not contain the LLM API key',
    !wizard.text.includes(st.LLM_API_KEY || '\u0000'), 'key absent', 'checked');

  // -------------------------------------------------------------------
  // Provider validation + model discovery (1.0.5)
  // -------------------------------------------------------------------
  const mock = (path, obj) => http('POST', `http://localhost:8090/${path}`,
    obj === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
  const providerPost = (action, params) => {
    const body = new URLSearchParams(Object.assign({ tokenCSRF: wizToken || '', action }, params)).toString();
    return post(`${base}/admin/plugin/pluginwizard`, body, { 'Content-Type': 'application/x-www-form-urlencoded' });
  };
  const saveSettings = (params) => post(`${base}/admin/configure-plugin/pluginWizard`,
    new URLSearchParams(Object.assign({ tokenCSRF: wizToken || '' }, params)).toString(),
    { 'Content-Type': 'application/x-www-form-urlencoded' });
  const modelValueOf = (html) => (html.match(/id="wizard-model"[^>]*value="([^"]*)"/) || [])[1];
  const BASE = 'http://127.0.0.1/mockai/v1';
  const apiHeaders = { Authorization: `Bearer ${st.WIZARD_API_KEY}`, 'Content-Type': 'application/json' };

  await mock('__reset');
  let r = await providerPost('discover_models', { baseUrl: BASE });
  check('discovery', T, 'discovers an OpenAI-style catalog (data[].id)',
    r.status === 200 && r.json?.ok === true && r.json?.stages?.catalog?.retrieved === true && r.json?.stages?.catalog?.count === 3,
    'ok, 3 models', `${r.status} count=${r.json?.stages?.catalog?.count}`);
  check('discovery', T, 'url validity, reachability and authentication are distinct',
    r.json?.stages?.url?.valid === true && r.json?.stages?.network?.reachable === true
      && r.json?.stages?.network?.status === 200 && r.json?.stages?.auth?.ok === true,
    'all stages true', JSON.stringify(r.json?.stages));
  check('discovery', T, 'discovery response never echoes the API key',
    !r.text.includes(st.LLM_API_KEY || '\u0000'), 'key absent', 'checked');

  await mock('__config', { catalog: 'openrouter' });
  r = await providerPost('discover_models', { baseUrl: BASE });
  const freeModel = (r.json?.models || []).find((m) => m.free === true);
  const toolsModel = (r.json?.models || []).find((m) => m.tools === true);
  check('discovery', T, 'OpenRouter catalog exposes pricing + tool metadata',
    r.json?.filters?.hasPricing === true && r.json?.filters?.hasTools === true && !!freeModel && !!toolsModel,
    'hasPricing+hasTools+free+tools', JSON.stringify(r.json?.filters));

  await mock('__config', { catalog: 'llmgateway' });
  r = await providerPost('discover_models', { baseUrl: BASE });
  check('discovery', T, 'LLM Gateway catalog parsed (cost, no tool metadata)',
    r.json?.ok === true && r.json?.filters?.hasPricing === true && r.json?.filters?.hasTools === false,
    'pricing yes, tools no', JSON.stringify(r.json?.filters));

  await mock('__config', { models: { status: 200, body: { data: [{ id: 'plain-model' }] } } });
  r = await providerPost('discover_models', { baseUrl: BASE });
  check('discovery', T, 'missing pricing/capability metadata -> filters unavailable',
    r.json?.filters?.hasPricing === false && r.json?.filters?.hasTools === false,
    'both false', JSON.stringify(r.json?.filters));

  await mock('__config', { models: { status: 200, body: { data: [] } } });
  r = await providerPost('discover_models', { baseUrl: BASE });
  check('discovery', T, 'empty catalog is "retrieved" with 0 models',
    r.json?.ok === true && r.json?.stages?.catalog?.retrieved === true && r.json?.stages?.catalog?.count === 0,
    'retrieved 0', String(r.json?.stages?.catalog?.count));

  await mock('__config', { models: { status: 401, body: { error: { message: 'Invalid API key' } } } });
  r = await providerPost('discover_models', { baseUrl: BASE });
  check('discovery', T, 'HTTP 401 -> reachable but authentication failed, no catalog',
    r.json?.ok === false && r.json?.stages?.network?.reachable === true && r.json?.stages?.network?.status === 401
      && r.json?.stages?.auth?.ok === false && r.json?.stages?.catalog?.retrieved === false,
    'reachable + auth.false + catalog.false', JSON.stringify(r.json?.stages));

  await mock('__config', { models: { status: 500, body: { error: { message: 'boom' } } } });
  r = await providerPost('discover_models', { baseUrl: BASE });
  check('discovery', T, 'HTTP 500 -> reachable, auth unknown, no catalog',
    r.json?.ok === false && r.json?.stages?.network?.status === 500 && r.json?.stages?.auth?.ok === null
      && r.json?.stages?.catalog?.retrieved === false,
    'reachable + auth.null + catalog.false', JSON.stringify(r.json?.stages));

  await mock('__config', { models: { status: 200, raw: '<html>not json</html>' } });
  r = await providerPost('discover_models', { baseUrl: BASE });
  check('discovery', T, 'malformed /models body -> clear error, no crash',
    r.status === 200 && r.json?.ok === false && r.json?.stages?.catalog?.format === 'invalid-json',
    'ok:false invalid-json', String(r.json?.stages?.catalog?.format));

  await mock('__reset');

  // URL shapes that are always refused, regardless of settings.
  const alwaysBlocked = [
    ['file:///etc/passwd', 'non-http scheme'],
    ['http://169.254.169.254/v1', 'metadata IP (link-local)'],
    ['http://metadata.google.internal/v1', 'metadata hostname'],
    ['http://api.example.com/v1', 'public http requires https'],
    ['https://user:pass@api.openai.com/v1', 'embedded credentials']
  ];
  for (const [u, why] of alwaysBlocked) {
    const rr = await providerPost('discover_models', { baseUrl: u });
    check('discovery', T, `blocked URL (${why})`,
      rr.json?.ok === false && rr.json?.stages?.url?.valid === false && rr.json?.stages?.network?.reachable === false,
      'url invalid, no network',
      JSON.stringify({ valid: rr.json?.stages?.url?.valid, reason: rr.json?.stages?.url?.reason }));
  }

  // Private/internal hosts are denied by default (F-12).
  const privateHosts = [
    ['http://192.168.1.5/v1', 'RFC1918 192.168/16'],
    ['http://10.0.0.5/v1', 'RFC1918 10/8'],
    ['http://172.16.5.5/v1', 'RFC1918 172.16/12'],
    ['http://mockai:8090/v1', 'single-label intranet name']
  ];
  for (const [u, why] of privateHosts) {
    const rr = await providerPost('discover_models', { baseUrl: u });
    check('discovery', T, `private host denied by default (${why})`,
      rr.json?.ok === false && rr.json?.stages?.url?.valid === false && rr.json?.stages?.network?.reachable === false,
      'url invalid, no network', JSON.stringify(rr.json?.stages?.url?.reason));
  }

  // Loopback remains allowed by default (local Ollama).
  const lp = await providerPost('discover_models', { baseUrl: 'http://127.0.0.1:1/v1' });
  check('discovery', T, 'loopback http allowed by default; unreachable is distinct from invalid',
    lp.json?.stages?.url?.valid === true && lp.json?.stages?.network?.reachable === false,
    'url valid, not reachable', JSON.stringify(lp.json?.stages?.network));
  const lh = await providerPost('discover_models', { baseUrl: 'http://localhost:1/v1' });
  check('discovery', T, 'localhost name allowed by default',
    lh.json?.stages?.url?.valid === true, 'url valid', JSON.stringify(lh.json?.stages?.url));

  // The mock is reachable over loopback (default-allowed) — the shipped default.
  const loopbackMock = await providerPost('discover_models', { baseUrl: BASE });
  check('discovery', T, 'discovery works under the default policy via loopback',
    loopbackMock.json?.ok === true && loopbackMock.json?.stages?.catalog?.retrieved === true,
    'catalog via loopback', JSON.stringify(loopbackMock.json?.stages?.catalog));

  // Explicit opt-in enables a trusted internal host, and can be turned back off.
  await saveSettings({ allowPrivateProviders: 'true' });
  const privOn = await providerPost('discover_models', { baseUrl: 'http://mockai:8090/v1' });
  check('discovery', T, 'opt-in allows a trusted private provider host',
    privOn.json?.stages?.url?.valid === true && privOn.json?.ok === true,
    'url valid + catalog', JSON.stringify(privOn.json?.stages?.url));
  await saveSettings({ allowPrivateProviders: 'false' });
  const privOff = await providerPost('discover_models', { baseUrl: 'http://mockai:8090/v1' });
  check('discovery', T, 'disabling the opt-in blocks the private host again',
    privOff.json?.stages?.url?.valid === false, 'url invalid', JSON.stringify(privOff.json?.stages?.url));

  // DNS-resolution mitigation: a public-looking name that resolves to a private
  // address is refused *before* any connection is opened.
  const rebind = await providerPost('discover_models', { baseUrl: 'https://evil.example.com/v1' });
  check('discovery', T, 'DNS: public name resolving to a private address is refused',
    rebind.json?.stages?.url?.valid === true && rebind.json?.stages?.network?.reachable === false
      && /private\/internal/i.test(String(rebind.json?.stages?.network?.error)),
    'url valid, refused on private resolution', JSON.stringify(rebind.json?.stages?.network));
  const unresolvable = await providerPost('discover_models', { baseUrl: 'https://no-such-host.invalid/v1' });
  check('discovery', T, 'DNS: unresolvable host is a clear network error, not a crash',
    unresolvable.json?.stages?.url?.valid === true && unresolvable.json?.stages?.network?.reachable === false
      && /resolve/i.test(String(unresolvable.json?.stages?.network?.error)),
    'resolve error', JSON.stringify(unresolvable.json?.stages?.network));
  // With the opt-in the resolution is permitted, so the failure is no longer the
  // private refusal — proving the DNS check is what blocked it.
  await saveSettings({ allowPrivateProviders: 'true' });
  const rebindOn = await providerPost('discover_models', { baseUrl: 'https://evil.example.com/v1' });
  check('discovery', T, 'DNS: opt-in lets resolution proceed (no longer the private refusal)',
    rebindOn.json?.stages?.network?.reachable === false
      && !/private\/internal/i.test(String(rebindOn.json?.stages?.network?.error)),
    'not refused as private', JSON.stringify(rebindOn.json?.stages?.network));
  await saveSettings({ allowPrivateProviders: 'false' });

  // --- Alternate-encoding and reserved-destination bypass tests (1.0.6) ---
  const encodingBypasses = [
    ['http://167772161/v1', 'decimal-encoded 10.0.0.1'],
    ['http://0x0a000001/v1', 'hex-encoded 10.0.0.1'],
    ['http://[::ffff:10.0.0.1]/v1', 'IPv4-mapped IPv6 10.0.0.1'],
    ['https://[::ffff:169.254.169.254]/v1', 'IPv4-mapped metadata'],
    ['https://[64:ff9b::a00:1]/v1', 'NAT64-embedded address'],
    ['https://[2002:0a00:0001::]/v1', '6to4-embedded address'],
    ['https://metadata.google.internal/v1', 'metadata hostname'],
    ['http://169.254.169.254/v1', 'metadata IP']
  ];
  for (const [u, why] of encodingBypasses) {
    const rr = await providerPost('discover_models', { baseUrl: u });
    check('discovery', T, `blocked bypass (${why})`,
      rr.json?.ok === false && rr.json?.stages?.url?.valid === false && rr.json?.stages?.network?.reachable === false,
      'url invalid, no network', JSON.stringify(rr.json?.stages?.url?.reason));
  }

  // Metadata and reserved destinations must stay blocked even when the
  // administrator enables private-network access.
  await saveSettings({ allowPrivateProviders: 'true' });
  for (const [u, why] of [
    ['http://169.254.169.254/v1', 'metadata IP with opt-in on'],
    ['https://metadata.google.internal/v1', 'metadata hostname with opt-in on'],
    ['https://[fd00:ec2::254]/v1', 'AWS IPv6 metadata with opt-in on'],
    ['https://[64:ff9b::a00:1]/v1', 'NAT64 with opt-in on']
  ]) {
    const rr = await providerPost('discover_models', { baseUrl: u });
    check('discovery', T, `still blocked with opt-in (${why})`,
      rr.json?.ok === false && rr.json?.stages?.url?.valid === false, 'url invalid', JSON.stringify(rr.json?.stages?.url?.reason));
  }
  await saveSettings({ allowPrivateProviders: 'false' });

  // A numeric loopback encoding is normalised (not a bypass): loopback is allowed.
  const numLoop = await providerPost('discover_models', { baseUrl: 'http://2130706433:1/v1' });
  check('discovery', T, 'numeric loopback host is normalised and allowed (not a bypass)',
    numLoop.json?.stages?.url?.valid === true, 'url valid', JSON.stringify(numLoop.json?.stages?.url));

  // --- Bounded DNS: a black-hole resolver must not hang the request (1.0.6) ---
  const container = `bwtest-${T}-1`;
  try {
    execFileSync('docker', ['exec', container, 'bash', '-lc', 'cp /etc/resolv.conf /tmp/resolv.conf.bw'], { stdio: 'ignore' });
    execFileSync('docker', ['exec', container, 'bash', '-lc', 'printf "nameserver 192.0.2.1\\n" > /etc/resolv.conf'], { stdio: 'ignore' });
    const t0 = Date.now();
    const probe = await providerPost('discover_models', { baseUrl: 'https://timeout-probe.test/v1' });
    const elapsed = Date.now() - t0;
    check('discovery', T, 'DNS timeout: request is bounded and fails closed',
      probe.json?.ok === false && probe.json?.stages?.network?.reachable === false
        && /time budget|resolve/i.test(String(probe.json?.stages?.network?.error)) && elapsed < 12000,
      'bounded (<12s) + resolve error', `${elapsed}ms :: ${probe.json?.stages?.network?.error}`);
  } finally {
    execFileSync('docker', ['exec', container, 'bash', '-lc', 'cp /tmp/resolv.conf.bw /etc/resolv.conf'], { stdio: 'ignore' });
  }

  // Cache surfaces on the settings page; the saved model must survive a failure.
  await mock('__config', { catalog: 'openrouter' });
  await providerPost('discover_models', { baseUrl: BASE });
  const settingsPage = await get(`${base}/admin/configure-plugin/pluginWizard`);
  const cfgMatch = settingsPage.text.match(/window\.BW_SETTINGS=(\{.*?\});<\/script>/s);
  let embedded = null;
  try { embedded = cfgMatch ? JSON.parse(cfgMatch[1]) : null; } catch { /* ignore */ }
  check('discovery', T, 'settings page embeds the cached catalog + filter flags',
    !!embedded && embedded.catalog.count === 3 && embedded.catalog.hasPricing === true,
    'count 3, hasPricing true', embedded ? JSON.stringify(embedded.catalog) : 'no BW_SETTINGS');
  check('discovery', T, 'settings page offers all presets',
    !!embedded && ['openai', 'openrouter', 'llmgateway', 'ollama', 'compatible'].every((k) => k in embedded.presets),
    'openai/openrouter/llmgateway/ollama/compatible',
    embedded ? Object.keys(embedded.presets).join(',') : 'none');

  const modelBefore = modelValueOf(settingsPage.text);
  await mock('__config', { models: { status: 500 } });
  await providerPost('discover_models', { baseUrl: BASE });
  const afterFail = await get(`${base}/admin/configure-plugin/pluginWizard`);
  check('discovery', T, 'failed discovery does not clear the saved model',
    modelValueOf(afterFail.text) === modelBefore && (modelBefore || '').length > 0,
    `preserved "${modelBefore}"`, `"${modelValueOf(afterFail.text)}"`);

  // -------------------------------------------------------------------
  // Security: API deletion gate, saved-key handling
  // -------------------------------------------------------------------
  check('security', T, 'settings page never echoes saved API keys',
    !afterFail.text.includes(st.LLM_API_KEY || '\u0000') && !afterFail.text.includes(st.WIZARD_API_KEY || '\u0001'),
    'keys absent', 'checked');
  check('security', T, 'saved keys are rendered as empty password fields',
    /id="wizard-api-key"[^>]*value=""/.test(afterFail.text) && /id="wizard-gpt-api-key"[^>]*value=""/.test(afterFail.text),
    'empty values', 'checked');

  // Bludit Wizard has no page-deletion operation (1.0.6-rc2).
  const delSlug = `no-delete-${Date.now()}`;
  const delCreate = await http('POST', `${base}/api/wizard/pages`,
    { headers: apiHeaders, body: JSON.stringify({ title: 'No-Delete Page', content: 'x', type: 'draft', slug: delSlug }) });
  const delKey = delCreate.json?.page?.key;
  check('security', T, 'created a page for the no-deletion test', !!delKey, 'key', String(delKey));
  if (delKey) {
    const delDenied = await http('DELETE', `${base}/api/wizard/pages/${encodeURIComponent(delKey)}`,
      { headers: apiHeaders, body: JSON.stringify({ confirm: true }) });
    check('security', T, 'API deletion is unavailable -> 405',
      delDenied.status === 405 && delDenied.json?.code === 'deletion_not_supported', '405', `${delDenied.status}`);
    const stillThere = await http('GET', `${base}/api/wizard/pages/${encodeURIComponent(delKey)}`, { headers: apiHeaders });
    check('security', T, 'refused API deletion leaves the page in place', stillThere.status === 200, '200', String(stillThere.status));
  }
  check('security', T, 'Wizard settings expose no deletion toggle',
    !afterFail.text.includes('allowApiDelete') && !/Allow the GPT Action API to delete pages/i.test(afterFail.text),
    'no deletion setting', 'checked');

  // Blank key submission must not wipe stored secrets.
  const blankSave = await saveSettings({ apiKey: '', wizardApiKey: '' });
  check('security', T, 'blank settings submission is accepted', blankSave.status === 301 || blankSave.status === 302 || blankSave.status === 200,
    'accepted', String(blankSave.status));
  const siteAfterBlank = await http('GET', `${base}/api/wizard/site`, { headers: { Authorization: `Bearer ${st.WIZARD_API_KEY}` } });
  check('security', T, 'blank submission keeps the stored GPT Action key', siteAfterBlank.status === 200, '200', String(siteAfterBlank.status));
  await mock('__reset');
  const discAfterBlank = await providerPost('discover_models', { baseUrl: BASE });
  check('security', T, 'blank submission keeps the stored LLM key (discovery still authenticates)',
    discAfterBlank.json?.stages?.auth?.ok === true, 'auth ok', JSON.stringify(discAfterBlank.json?.stages?.auth));

  // --- test_model (low-cost inference) ---
  await mock('__reset');
  let t = await providerPost('test_model', { baseUrl: BASE, model: 'gpt-4o-mini' });
  check('provider-test', T, 'test_model reports successful inference',
    t.json?.ok === true && t.json?.stages?.inference?.ok === true && t.json?.stages?.auth?.ok === true,
    'inference ok', JSON.stringify(t.json?.stages?.inference));
  const mockState2 = await (await http('GET', 'http://localhost:8090/__state')).json;
  const lastChat = (mockState2?.requests || []).filter((x) => /\/chat\/completions$/.test(x.url)).slice(-1)[0];
  check('provider-test', T, 'test_model sends a minimal, authenticated request',
    !!lastChat && lastChat.body?.max_tokens === 1 && lastChat.body?.model === 'gpt-4o-mini'
      && String(lastChat.headers?.authorization) === `Bearer ${st.LLM_API_KEY}`,
    'max_tokens=1 + model + bearer',
    lastChat ? `${lastChat.body?.model}/${lastChat.body?.max_tokens}` : 'none');

  await mock('__config', { status: 401 });
  t = await providerPost('test_model', { baseUrl: BASE, model: 'x' });
  check('provider-test', T, 'test_model 401 -> auth failed, inference not exercised',
    t.json?.ok === false && t.json?.stages?.auth?.ok === false && t.json?.stages?.inference?.ok === false,
    'auth false + inference false', JSON.stringify(t.json?.stages?.auth));

  await mock('__config', { status: 500 });
  t = await providerPost('test_model', { baseUrl: BASE, model: 'x' });
  check('provider-test', T, 'test_model 500 -> reachable, inference failed (distinct from auth)',
    t.json?.ok === false && t.json?.stages?.network?.reachable === true && t.json?.stages?.inference?.ok === false
      && /HTTP 500/.test(String(t.json?.error)),
    'reachable + inference false', String(t.json?.error));

  t = await providerPost('test_model', { baseUrl: 'http://169.254.169.254/v1', model: 'x' });
  check('provider-test', T, 'test_model applies the same URL policy',
    t.json?.ok === false && t.json?.stages?.url?.valid === false, 'url invalid', JSON.stringify(t.json?.stages?.url));
  await mock('__reset');
}

/* ------------------------------------------------------------------ */
/* Administrator authorization for provider operations                 */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* v1.1.0: twelve-task contract, context isolation, result types       */
/* ------------------------------------------------------------------ */
async function taskTests(st) {
  const T = st.TARGET;
  const base = st.BASE_URL || `http://localhost:${st.PORT}`;
  const jar = cookieJar();
  const call = async (method, url, body, headers = {}) => {
    const h = { ...headers };
    if (jar.header()) { h.Cookie = jar.header(); }
    const r = await http(method, url, { headers: h, body });
    jar.absorb(r);
    return r;
  };
  const get = (url) => call('GET', url);
  const postForm = (url, body) => call('POST', url, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest'
  });

  const loginPage = await get(`${base}/admin/login`);
  const loginToken = (loginPage.text.match(/name="tokenCSRF" value="([^"]+)"/) || [])[1];
  await postForm(`${base}/admin/login`,
    `tokenCSRF=${encodeURIComponent(loginToken || '')}&username=${st.ADMIN_USER}&password=${st.ADMIN_PASS}`);
  const wizard = await get(`${base}/admin/plugin/pluginwizard`);
  const token = (wizard.text.match(/"token":"([^"]+)"/) || [])[1];

  const ai = (params) => postForm(`${base}/admin/plugin/pluginwizard`,
    new URLSearchParams(Object.assign({ tokenCSRF: token || '', action: 'ai' }, params)).toString());
  const mock = (obj) => http('POST', 'http://localhost:8090/__config',
    { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
  const apiHeaders = { Authorization: `Bearer ${st.WIZARD_API_KEY}`, 'Content-Type': 'application/json' };

  // Fixtures: two pages so we can prove page-specific context.
  const slug = `task-fixture-${Date.now()}`;
  const otherSlug = `task-other-${Date.now()}`;
  await http('POST', `${base}/api/wizard/pages`, { headers: apiHeaders, body: JSON.stringify({ title: 'Unicorns fixture', content: 'Unicorns body for context tests.', type: 'draft', slug }) });
  await http('POST', `${base}/api/wizard/pages`, { headers: apiHeaders, body: JSON.stringify({ title: 'Mermaids fixture', content: 'Mermaids body for context tests.', type: 'draft', slug: otherSlug }) });

  const jsonPage = JSON.stringify({ title: 'AI Title', slug: 'ai-title', description: 'AI description', type: 'draft', content: 'AI generated content.' });
  const markdown = '# Result heading\n\n- first point\n- second point\n';
  const metadataJson = JSON.stringify({ title: 'Meta title', description: 'Meta description', slug: 'meta-slug' });
  const linksJson = JSON.stringify({ links: [
    { source_text: 'unicorn reference', target: slug, reason: 'related page' },
    { source_text: 'broken reference', target: 'missing-key-xyz', reason: 'does not exist' }
  ] });

  const cases = [
    ['create_page', { prompt: 'Write about tea' }, jsonPage, 'page_draft'],
    ['create_outline', { prompt: 'Outline a tea article' }, markdown, 'text_generation'],
    ['article_ideas', { prompt: 'Ideas about tea' }, markdown, 'text_generation'],
    ['improve_page', { pageKey: slug, prompt: 'Improve it' }, jsonPage, 'page_revision'],
    ['rewrite_tone', { pageKey: slug, tone: 'formal', prompt: '' }, jsonPage, 'page_revision'],
    ['adjust_length', { pageKey: slug, lengthMode: 'shorten', prompt: '' }, jsonPage, 'page_revision'],
    ['proofread', { pageKey: slug, prompt: '' }, jsonPage, 'page_revision'],
    ['seo_audit', { pageKey: slug, prompt: '' }, markdown, 'structured_audit'],
    ['seo_metadata', { pageKey: slug, prompt: '' }, metadataJson, 'metadata_proposal'],
    ['internal_links', { pageKey: slug, prompt: '' }, linksJson, 'structured_audit'],
    ['freshness_audit', { pageKey: slug, prompt: '' }, markdown, 'structured_audit'],
    ['ask_wizard', { prompt: 'How do I publish?' }, markdown, 'conversational']
  ];

  for (const [task, params, content, expected] of cases) {
    await mock({ content, status: 200, raw: null });
    const r = await ai(Object.assign({ task, prompt: '' }, params));
    check('tasks', T, `${task}: result type ${expected}`,
      r.status === 200 && r.json?.ok === true && r.json?.resultType === expected,
      expected, `${r.status} ${r.json?.resultType} ${r.text.slice(0, 50)}`);
    const editable = ['page_draft', 'page_revision', 'metadata_proposal'].includes(expected);
    check('tasks', T, `${task}: editable=${editable}`,
      r.json?.editable === editable, String(editable), String(r.json?.editable));
    if (params.pageKey) {
      check('tasks', T, `${task}: original snapshot present`,
        !!r.json?.original && r.json.original.key === params.pageKey, params.pageKey, JSON.stringify(r.json?.original?.key));
    } else {
      check('tasks', T, `${task}: no page inherited`,
        r.json?.original === null, 'null', JSON.stringify(r.json?.original));
    }
  }

  // Internal links: validated server-side against the real page index.
  await mock({ content: linksJson, status: 200, raw: null });
  const links = await ai({ task: 'internal_links', pageKey: slug, prompt: '' });
  check('tasks', T, 'internal_links: valid target accepted',
    links.json?.data?.links?.[0]?.valid === true && String(links.json.data.links[0].url).startsWith('http'),
    'valid + url', JSON.stringify(links.json?.data?.links?.[0]));
  check('tasks', T, 'internal_links: invented target rejected',
    links.json?.data?.links?.[1]?.valid === false && links.json.data.links[1].url === '',
    'invalid', JSON.stringify(links.json?.data?.links?.[1]));

  // Invalid model output for internal_links is a clean error, not a crash.
  await mock({ content: 'not json at all', status: 200, raw: null });
  const badLinks = await ai({ task: 'internal_links', pageKey: slug, prompt: '' });
  check('tasks', T, 'internal_links: malformed model output -> 502 error',
    badLinks.status === 502 && badLinks.json?.ok === false, '502', String(badLinks.status));

  // Required-page enforcement.
  for (const task of ['improve_page', 'rewrite_tone', 'adjust_length', 'proofread', 'seo_audit', 'seo_metadata', 'internal_links', 'freshness_audit']) {
    const r = await ai({ task, prompt: 'x' });
    check('tasks', T, `${task}: requires a page -> 400`, r.status === 400, '400', String(r.status));
  }

  // Task-specific required inputs.
  const noPrompt = await ai({ task: 'create_page', prompt: '' });
  check('tasks', T, 'create_page: empty instruction -> 400', noPrompt.status === 400, '400', String(noPrompt.status));
  const noTone = await ai({ task: 'rewrite_tone', pageKey: slug, tone: '', prompt: '' });
  check('tasks', T, 'rewrite_tone: missing tone -> 400', noTone.status === 400, '400', String(noTone.status));
  const noMode = await ai({ task: 'adjust_length', pageKey: slug, prompt: '' });
  check('tasks', T, 'adjust_length: missing mode -> 400', noMode.status === 400, '400', String(noMode.status));
  await mock({ content: markdown, status: 200, raw: null });
  const auditNoPrompt = await ai({ task: 'seo_audit', pageKey: slug, prompt: '' });
  check('tasks', T, 'seo_audit: works without an instruction', auditNoPrompt.status === 200, '200', String(auditNoPrompt.status));

  // Context isolation: no-page tasks must not send the selected page upstream.
  await mock({ content: jsonPage, status: 200, raw: null });
  await ai({ task: 'create_page', pageKey: slug, prompt: 'Write about mermaids' });
  let state = await (await http('GET', 'http://localhost:8090/__state')).json;
  let last = (state.requests || []).slice(-1)[0];
  let payload = last ? JSON.parse(last.body.messages[last.body.messages.length - 1].content) : null;
  check('tasks', T, 'create_page: selected page is not sent upstream',
    payload && payload['Selected page'] === null && JSON.stringify(payload['Site context']).indexOf('Unicorns body') === -1,
    'no page context', JSON.stringify(payload && payload['Selected page']));

  await mock({ content: markdown, status: 200, raw: null });
  await ai({ task: 'create_outline', pageKey: slug, prompt: 'Outline mermaids' });
  state = await (await http('GET', 'http://localhost:8090/__state')).json;
  last = (state.requests || []).slice(-1)[0];
  payload = last ? JSON.parse(last.body.messages[last.body.messages.length - 1].content) : null;
  check('tasks', T, 'create_outline: does not inherit a previously selected page',
    payload && payload['Selected page'] === null && JSON.stringify(payload['Site context']).indexOf('Unicorns body') === -1,
    'no page context', JSON.stringify(payload && payload['Selected page']));

  // Ask Wizard: optional page. Without a page, no page content is sent.
  await mock({ content: markdown, status: 200, raw: null });
  await ai({ task: 'ask_wizard', prompt: 'What is Bludit?' });
  state = await (await http('GET', 'http://localhost:8090/__state')).json;
  last = (state.requests || []).slice(-1)[0];
  payload = last ? JSON.parse(last.body.messages[last.body.messages.length - 1].content) : null;
  check('tasks', T, 'ask_wizard: no page selected -> no page content sent',
    payload && payload['Selected page'] === null, 'null', JSON.stringify(payload && payload['Selected page']));

  const askWithPage = await ai({ task: 'ask_wizard', pageKey: otherSlug, prompt: 'Summarise this page' });
  check('tasks', T, 'ask_wizard: explicit page includes its snapshot',
    askWithPage.json?.original?.key === otherSlug && String(askWithPage.json?.original?.content || '').includes('Mermaids body'),
    otherSlug, JSON.stringify(askWithPage.json?.original?.key));

  // Provider failure surfaces cleanly for a task.
  await mock({ status: 500 });
  const failed = await ai({ task: 'create_outline', prompt: 'x' });
  check('tasks', T, 'task provider failure -> 500 JSON error',
    failed.status === 500 && failed.json?.ok === false, '500', String(failed.status));
  await http('POST', 'http://localhost:8090/__reset');
}

async function editorAuthorizationTests(st) {
  const T = st.TARGET;
  if (!st.EDITOR_USER) {
    return;
  }
  const base = st.BASE_URL || `http://localhost:${st.PORT}`;
  const jar = cookieJar();
  const call = async (method, url, body, headers = {}) => {
    const h = { ...headers };
    if (jar.header()) h.Cookie = jar.header();
    const r = await http(method, url, { headers: h, body });
    jar.absorb(r);
    return r;
  };
  const get = (url) => call('GET', url);
  const postForm = (url, body) => call('POST', url, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Requested-With': 'XMLHttpRequest'
  });

  const loginPage = await get(`${base}/admin/login`);
  const loginToken = (loginPage.text.match(/name="tokenCSRF" value="([^"]+)"/) || [])[1];
  const doLogin = await postForm(`${base}/admin/login`,
    `tokenCSRF=${encodeURIComponent(loginToken || '')}&username=${st.EDITOR_USER}&password=${st.EDITOR_PASS}`);
  check('provider-security', T, 'editor (non-admin) can log in',
    (doLogin.status === 301 || doLogin.status === 302) && String(doLogin.headers.get('location') || '').includes('dashboard'),
    'redirect -> dashboard', `${doLogin.status} ${doLogin.headers.get('location')}`);

  const wizard = await get(`${base}/admin/plugin/pluginwizard`);
  const etok = (wizard.text.match(/"token":"([^"]+)"/) || [])[1];
  const d = await postForm(`${base}/admin/plugin/pluginwizard`,
    `tokenCSRF=${encodeURIComponent(etok || '')}&action=discover_models&baseUrl=${encodeURIComponent('http://127.0.0.1/mockai/v1')}`);
  check('provider-security', T, 'editor is denied provider discovery (403)',
    d.status === 403 && d.json?.ok === false, '403', `${d.status} ${d.text.slice(0, 60)}`);

  const tm = await postForm(`${base}/admin/plugin/pluginwizard`,
    `tokenCSRF=${encodeURIComponent(etok || '')}&action=test_model&model=x`);
  check('provider-security', T, 'editor is denied model test (403)',
    tm.status === 403, '403', String(tm.status));

  const dn = await postForm(`${base}/admin/plugin/pluginwizard`,
    `tokenCSRF=${encodeURIComponent(etok || '')}&action=delete_page&pageKey=whatever`);
  check('provider-security', T, 'editor cannot delete pages through Wizard (not supported)',
    dn.status === 403 && dn.json?.code === 'deletion_not_supported', '403 deletion_not_supported', String(dn.status));

  const anon = await http('POST', `${base}/admin/plugin/pluginwizard`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'action=delete_page&pageKey=whatever' });
  check('provider-security', T, 'anonymous native deletion is not accepted',
    anon.status !== 200, 'not 200', String(anon.status));

  const settings = await get(`${base}/admin/configure-plugin/pluginWizard`);
  check('provider-security', T, 'editor cannot open the plugin settings page',
    !/window\.BW_SETTINGS/.test(settings.text), 'no settings bootstrap', 'checked');
}

/* ------------------------------------------------------------------ */
/* Not-configured (503) behavior                                       */
/* ------------------------------------------------------------------ */
async function noKeyTests(st) {
  const T = st.TARGET;
  const base = st.BASE_URL || `http://localhost:${st.PORT}`;
  const r = await http('GET', `${base}/api/wizard/site`);
  check('api', T, 'unconfigured key -> 503 not configured',
    r.status === 503 && r.json?.ok === false, '503 {ok:false}', `${r.status}`);
}

/* ------------------------------------------------------------------ */
/* Subdirectory compatibility                                          */
/* ------------------------------------------------------------------ */
async function subdirTests(st) {
  const T = st.TARGET;
  const base = st.BASE_URL || `http://localhost:${st.PORT}`;
  const r = await http('GET', `${base}/api/wizard/site`, { headers: auth(st.WIZARD_API_KEY) });
  check('subdir', T, 'GPT Action API reachable under subdirectory install',
    r.status === 200 && r.json?.ok === true, '200 {ok:true}', `${r.status} ${r.text.slice(0, 80)}`);
}

/* ------------------------------------------------------------------ */
async function main() {
  console.log('Bludit Wizard test runner');
  console.log('=========================');
  const states = loadStates();
  const targets = Object.values(states).filter((s) => !onlyTarget || s.TARGET === onlyTarget);
  if (targets.length === 0) {
    console.error('No targets found in testenv/.state. Run testenv/provision.sh first.');
    process.exit(2);
  }

  console.log('\n[static]');
  staticChecks();

  console.log('\n[php-static]');
  phpStatic();

  console.log('\n[netpolicy]');
  netpolicyUnitTests();

  console.log('\n[php-lint]');
  const lintTargets = new Set(targets.map((t) => t.TARGET === 'pro' ? 'pro' : (t.TARGET.startsWith('community') || t.TARGET === 'subdir' || t.TARGET === 'nokey') ? 'community' : t.TARGET));
  for (const svc of lintTargets) phpLint(svc);

  for (const st of targets) {
    if (st.TARGET === 'nokey') {
      console.log(`\n[api/${st.TARGET}] (unconfigured)`);
      await noKeyTests(st);
      continue;
    }
    if (st.TARGET === 'subdir') {
      console.log(`\n[subdir/${st.TARGET}]`);
      await subdirTests(st);
      continue;
    }
    console.log(`\n[api/${st.TARGET}]`);
    await apiTests(st);
    console.log(`\n[security/${st.TARGET}]`);
    await securityTests(st);
    console.log(`\n[admin/${st.TARGET}]`);
    await adminTests(st);
    console.log(`\n[tasks/${st.TARGET}]`);
    await taskTests(st);
    console.log(`\n[provider-security/${st.TARGET}]`);
    await editorAuthorizationTests(st);
  }

  const summary = { pass: 0, fail: 0, skip: 0 };
  for (const r of results) summary[r.status]++;
  console.log('\n=========================');
  console.log(`TOTAL ${results.length}  PASS ${summary.pass}  FAIL ${summary.fail}  SKIP ${summary.skip}`);
  if (summary.fail) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => x.status === 'fail')) {
      console.log(`  - [${r.category}/${r.target}] ${r.name} :: expected ${r.expected} | actual ${r.actual}`);
    }
  }

  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2));
  console.log(`\nJSON written to ${jsonOut}`);
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(3); });

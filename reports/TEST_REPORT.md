# Bludit Wizard — Test Report

**Product:** Bludit Wizard plugin — `1.0.4-rc1` baseline, `1.0.4-rc2` after fixes
**Platforms:** Bludit Community 3.22.0 and Bludit Pro 3.22.0 (build 20260510)
**Date:** 2026-10-15
**Author:** automated review harness in this repository

---

## 1. Scope, method and an honest note on "live" vs "simulated"

| Aspect | Status in this report |
|--------|-----------------------|
| Bludit core | **Live installation.** Real Bludit 3.22.0 release code running in isolated Docker containers. Routing, sessions, CSRF, the page API and the admin theme are the genuine upstream code. |
| Plugin | **Live installation.** The real `wizard/` source is installed under `bl-plugins/wizard/` and activated; every request is served by real PHP 8.2 via Apache. |
| Browser | **Live.** Playwright 1.64.1 driving headless Chromium against the running site. |
| AI provider | **Simulated.** A local mock speaking the OpenAI chat-completions protocol. No request leaves the machine. AI *output* is therefore not a real model result, but the plugin↔provider contract is exercised for real. |
| Production site | **Not touched.** No request was made to any live domain; no credentials were read. |
| Load / performance | **Not tested.** |

Everything labelled **[auto]** below is reproducible with `tests/run-all.sh`.

**These are isolated-installation results. They are strong evidence but they are
not a substitute for an operator pass on a disposable real host** (see
`COMPATIBILITY_MATRIX.md` §"Not tested").

## 2. Environments

| Service | Bludit | URL | Purpose |
|---------|--------|-----|---------|
| `community` | Community 3.22.0 | http://localhost:8081 | primary target |
| `pro` | Pro 3.22.0 (20260510) | http://localhost:8082 | Pro compatibility |
| `subdir` | Community 3.22.0 | http://localhost:8083/blog | subdirectory-install API |
| `nokey` | Community 3.22.0 | http://localhost:8084 | "not configured" gate |
| `mockai` | — | http://localhost:8090 | deterministic AI provider |

PHP 8.2.34, Apache 2.4.68, Chromium 156. Bludit stores content in flat files, so
no database server is involved.

Test fixtures (not secrets): admin `admin`/`demo123`; GPT Action key
`WizardTestKey2026RC1`; mock LLM key `mockLlmKey`.

## 3. How to run

```bash
testenv/fetch-upstream.sh
docker compose -f testenv/compose.yaml up -d --build
tests/run-all.sh <label>            # runs everything, writes reports/raw/*
```

Individual suites: `node tests/runner.mjs`, `tests/e2e/run.sh community`.

## 4. Results summary

| Suite | Baseline (rc1) | After fixes (rc2) |
|-------|---------------:|------------------:|
| Static / PHP static / PHP lint / API / security / admin / provider / subdir | **94 / 103 pass (9 fail)** | **119 / 119 pass (0 fail)** |
| Playwright UI | **3 / 6 pass (3 fail)** | **6 / 6 pass (0 fail)** |

Raw evidence: `reports/raw/results-baseline.json`,
`reports/raw/results-after-fix.json`, `reports/raw/playwright-*.json`.

### 4.1 By category (HTTP/static suite)

| Category | Baseline pass/fail | After-fix pass/fail |
|----------|-------------------:|--------------------:|
| static (source assertions) | 15 / 0 | 15 / 0 |
| php-static (PHP-run static analysis) | — | 6 / 0 |
| php-lint (container `php -l`, JSON parse) | 4 / 0 | 4 / 0 |
| api (`/api/wizard` contract) | 51 / 0 | 51 / 0 |
| security | 14 / 0 | 14 / 0 |
| admin (login, CSRF, AJAX, settings) | 10 / 8 | 20 / 0 |
| provider (payload sent to AI) | — | 8 / 0 |
| subdir (API under `/blog`) | 0 / 1 | 1 / 0 |

### 4.2 Playwright UI

| Test | Baseline | After |
|------|----------|-------|
| Sidebar link + wizard route render | pass | pass |
| Settings form renders | pass | pass |
| Preview-before-write shows editable proposal, writes nothing | **fail** | pass |
| Apply writes and verifies | **fail** | pass |
| Improve existing page then delete | **fail** | pass |
| Provider failure reported, nothing written | pass | pass |

## 5. Defects found and fixed (rc2)

Full detail in `SECURITY_FINDINGS.md`; decisions in `DECISION_LOG.md`.

| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| D1 | Critical (functional) | Native admin writes always failed: `403 Invalid CSRF token`. Bludit removes `$_POST['tokenCSRF']` after its own validation, so the plugin's duplicate check could never pass. | **Fixed** |
| D2 | Medium | GPT Action API returned Bludit's 404 page for subdirectory installs; the advertised base URL was unreachable. | **Fixed** |
| D3 | Low | Wizard admin page emitted unbalanced `<form>` markup (1 open, 2 close). | **Fixed** |

### D1 evidence (before → after)

```
before: POST /admin/plugin/pluginwizard  action=ai        -> 403 {"ok":false,"error":"Invalid CSRF token."}
        browser #bw-result-text                            -> "Error: Invalid CSRF token."
after:  POST /admin/plugin/pluginwizard  action=ai        -> 200 {"ok":true,...}
        browser preview + Apply + Delete                   -> pass
```

### D2 evidence

```
before: GET http://localhost:8083/blog/api/wizard/site    -> 404 (Bludit "Page not found")
after:  GET http://localhost:8083/blog/api/wizard/site    -> 200 {"ok":true,...}
```

## 6. Verified behaviour (both before and after, where noted)

- Admin sidebar link and route `/admin/plugin/pluginwizard` — the rc1 route fix is correct.
- Settings route `/admin/configure-plugin/pluginWizard`.
- API auth: 401 without/with-wrong key, 401 without `Bearer`, 200 with key, `X-Bludit-Wizard-Key` fallback, 503 when unconfigured.
- Full create / read / update / delete lifecycle with `confirm` gates and read-back verification.
- Error contract: 400 (bad JSON, missing fields, no confirm), 404 (missing page, unknown route), 405 (bad method).
- Security: unauthenticated writes rejected with no side effect, path traversal blocked, no `Access-Control-Allow-Origin: *`, keys not echoed by the API, admin page requires login.
- Provider contract: request goes to `{baseUrl}/chat/completions`, carries `model`, numeric `temperature`, integer `max_tokens`, `system`+`user` messages, and `Authorization: Bearer <llm key>`.
- Preview-before-write: "Run Wizard" persists nothing; content is written only on **Apply**.

## 7. Coverage against requirements

`PRODUCT_REQUIREMENTS.md` maps each requirement to a test. All **[auto]** rows
pass on rc2. Remaining **[manual]** items are operational (on a disposable real
host) and are listed in the submission checklist.

## 8. Limitations

- AI output is from a mock; real-provider latency, cost, refusals and content quality are out of scope.
- Only Chromium was exercised. Firefox/WebKit were not.
- Only PHP 8.2 was tested.
- No load, concurrency, or long-running stability testing.
- The delete-after-approval and admin-impersonation behaviours are covered functionally but their *policy* is an owner decision (see `SECURITY_FINDINGS.md` F-04/F-05).
- One unexplained `bludit.png` (the upstream Bludit logo) appeared at the workspace root during a test run; it was set aside and is not tracked.

---

# Update — 1.0.5: Provider validation and model discovery

**Branch:** `feature/provider-validation-model-discovery` (from `1.0.4-rc2`).
**Date:** 2026-10-15.

## Method

The isolated environments, real Bludit cores and the mock provider from the
previous run were reused. The mock (`testenv/mockai/server.js`) gained a
configurable `GET .../models` endpoint with four catalog shapes
(OpenAI-style, OpenRouter-style with pricing/tool metadata, LLM-Gateway-style
with cost metadata, and metadata-free), plus malformed/error/401 responses. The
active provider remains a **simulation**; the Bludit installation and browser are
real.

## Results

| Suite | Result |
|-------|--------|
| `tests/runner.mjs` (all categories, Community + Pro) | **181 / 181 pass** |
| Playwright UI (`settings.spec.ts` + `wizard.spec.ts`, Community) | **13 / 13 pass** |

By category: static 21, php-static 6, php-lint 4, api 51, security 14, admin 20,
**discovery 38**, provider 8, **provider-test 10**, **provider-security 8**,
subdir 1.

Evidence: `reports/raw/results-feature-1.0.5.json`,
`reports/raw/playwright-feature-1.0.5.json`.

## Behaviour verified

- **Discovery** of an OpenAI-style catalog (`data[].id`) over `GET /models` with a
  Bearer token; catalog cached and offered as a searchable dropdown.
- **OpenRouter** catalog parsed with pricing → a `:free` model is flagged free,
  and tool support read from `supported_parameters`; both filters then appear.
- **LLM Gateway** catalog parsed from `cost` metadata (pricing yes, tools no).
- **Metadata-free** catalog → both filters stay hidden.
- **Empty** catalog → reported as retrieved with 0 models (not an error).
- **401** → URL valid, reachable, authentication **failed**, no catalog — four
  distinct facts, not one "failure".
- **500**, **malformed JSON** and **unreachable** each produce distinct,
  non-crashing, key-free responses.
- **URL policy**: `file://`, `169.254.169.254`, public `http://` and credentialed
  URLs are refused before any network call; loopback `http://` is allowed but an
  unreachable loopback is distinguished from an invalid URL; an intranet
  hostname (Ollama-style) is allowed.
- **test_model** sends a minimal (`max_tokens: 1`) authenticated request and
  reports inference separately from authentication.
- **Saved model preserved** across successful and failed discovery (HTTP and UI).
- **Administrator authorization**: a real Bludit `editor` account is denied with
  HTTP 403 and cannot open the settings page.
- **Secret hygiene**: discovery responses never contain the API key.
- **UI**: presets fill the base URL without touching the model; the dropdown
  searches and narrows; free-only filtering works; clicking a model sets the id;
  the status area shows the stages.

## Community and Pro

All HTTP/security/admin/discovery/provider tests ran against **Bludit Community
3.22.0** and **Bludit Pro 3.22.0** (build 20260510). The UI suite ran against
Community. See `COMPATIBILITY_MATRIX.md`.

## Limitations specific to 1.0.5

- The mock is not a real OpenAI/OpenRouter/LLM Gateway account; response *shapes*
  are realistic and representative but live pricing/ratelimit quirks are not
  exercised.
- Very large live catalogs (OpenRouter has hundreds of models) are capped in the
  UI at 300 rendered rows and 4 MB at the transport; the cap itself was not
  exercised against a live multi-MB response.
- The free/tools filters depend entirely on provider metadata; when a provider
  omits it the filters are intentionally hidden (tested).
- SSRF posture deliberately allows private-network HTTP for self-hosted gateways
  (see `SECURITY_FINDINGS.md` F-12); this is a documented trade-off, not a bug.

---

# Update — 1.0.5-rc1: security hardening and release packaging

**Branch:** `release/1.0.5-rc1`. **Date:** 2026-10-15.

## Results

| Suite | Result |
|-------|--------|
| `tests/runner.mjs` (Community + Pro) | **229 / 229 pass** |
| Playwright UI (`settings.spec.ts` + `wizard.spec.ts`) | **15 / 15 pass** |
| Packaged ZIP (`scripts/verify-release-zip.sh`) | **PASS** — lint + install + API 401/200 |

Evidence: `reports/raw/results-1.0.5-rc1.json`,
`reports/raw/playwright-1.0.5-rc1.json`.

## Verified behaviour added in this pass

- **API deletion is off by default.** With a valid key and `confirm: true`,
  `DELETE /api/wizard/pages/{key}` returns `403` and the page is verifiably still
  present. After an administrator enables the setting, the same call returns
  `200` "deleted and verified"; the setting can be turned back off. A static test
  asserts the shipped default is falsy.
- **Native deletion is administrator-only.** An editor session is refused with
  `403`; an anonymous request is not accepted; the administrator path still works
  (create → delete → verified).
- **SSRF default-deny.** Private hosts (`192.168.*`, `10.*`, `172.16.*`) and
  single-label intranet names are refused by default with no network call.
  Loopback (`127.0.0.1`, `localhost`) is allowed. `file://`, metadata IPs,
  metadata hostnames, credentialed URLs and public `http://` are refused. After
  the `allowPrivateProviders` opt-in, a trusted intranet host is allowed
  (discovery succeeds); disabling it blocks the host again.
- **Discovery works under the shipped default** via the loopback mock (the test
  image exposes the mock to the container over loopback).
- **Saved keys are not echoed.** The settings page contains neither stored key
  value; both key fields render empty. Submitting the form with blank keys keeps
  the GPT Action key (API still authenticates) and the LLM key (discovery still
  authenticates). A **Generate** button fills a random GPT key (32 bytes hex).
- **Settings page styling.** The settings form now loads the plugin stylesheet,
  so the model picker, status lines, filters and safety toggles render correctly.
- **Admin UI contrast.** The Wizard hero heading was dark-on-dark in the Bludit
  admin theme; it is now white (found while capturing the submission screenshot).

## Packaging

`scripts/build-release.sh 1.0.5-rc1` produces
`dist/bludit-wizard-1.0.5-rc1.zip` containing a single top-level `wizard/`
directory with `plugin.php`, `metadata.json`, `README.md`, `CHANGELOG.md`,
`LICENSE`, `languages/`, `js/`, `css/` (0644/0755, no tests or tooling).
`scripts/verify-release-zip.sh` extracts that archive, lints `plugin.php`,
installs it into a throwaway Bludit container and smoke-tests the API.

## Limitations specific to rc1

- The provider remains a mock; live provider quirks are not exercised.
- The URL policy does not DNS-resolve hostnames, so a public name resolving to an
  internal address is not caught (documented in F-12).
- Only PHP 8.2 and Chromium were tested.

---

# Update — 1.0.5 stable: DNS mitigation and release finalization

**Branch:** `release/1.0.5`. **Date:** 2026-10-15.

## Results

| Suite | Result |
|-------|--------|
| `tests/runner.mjs` (Community + Pro) | **236 / 236 pass** |
| Playwright UI | **15 / 15 pass** |
| `scripts/verify-release-zip.sh` | **PASS on Community and Pro** (lint, install, API 401/200, delete-off 403) |
| Submission metadata vs `bludit/plugins-repository` templates | **exact key match** |
| `dist/bludit-wizard-1.0.5.zip` | built; SHA-256 `e70dc8946c45db13664a07afa516246390c2d818cb9f4b157cb76ffdbbd02550` |

## SSRF hostname/DNS mitigation (F-12 residual closed)

The provider host is now resolved before connecting and every resolved address is
checked against the policy; the request is pinned to the verified addresses with
`CURLOPT_RESOLVE`. New tests:

| Test | Result |
|------|--------|
| Public-looking name resolving to a private address (`evil.example.com`) refused by default | PASS |
| Opt-in lets resolution proceed (failure is no longer the private refusal) | PASS |
| Unresolvable host (`.invalid`) → clear network error, no crash | PASS |
| Loopback discovery still works under the shipped default | PASS |
| Static: resolve-and-pin code present | PASS |

## Release artifacts

- `dist/bludit-wizard-1.0.5.zip` — single top-level `wizard/`, 13 files, 31,879 bytes.
- `dist/bludit-wizard-1.0.5.zip.sha256`.
- Public docs: `wizard/README.md`, `wizard/CHANGELOG.md`, `docs/INSTALLATION.md`,
  `docs/RELEASE_NOTES_1.0.5.md`, `docs/GITHUB_RELEASE.md`.

## Licensing

`wizard/LICENSE` is MIT, "Copyright (c) 2026 Evan Zellner";
`wizard/metadata.json` `author = "Evan Zellner"`; README and release notes carry
the same attribution.

## Limitations

- Provider behaviour is validated against live LLM Gateway (Hostinger) and a mock;
  other providers are covered by wire-format tests only.
- DNS resolution is blocking with no explicit PHP-level timeout.
- Only PHP 8.2 and Chromium were tested.

---

# Update — 1.0.6-rc1: SSRF hardening (DNS timeout, fail-closed pinning, private networks)

**Branch:** `security/1.0.6-ssrf-hardening`. **Artifact:**
`dist/bludit-wizard-1.0.6-rc1.zip` (SHA-256 `17ef578ffd9b417d15431202d5c7e3c5a0ec2279698c9d87c435234ac0abbcba`).
The validated `1.0.5` packages are untouched.

## Results

| Suite | Result |
|-------|--------|
| `tests/php/netpolicy_test.php` (dependency-free policy unit suite) | **98 / 98 pass** |
| `tests/runner.mjs` — Community + Pro (static, php-static, php-lint, netpolicy, api, security, admin, discovery, provider, provider-test, provider-security, subdir) | **273 / 273 pass** |
| Playwright UI | **15 / 15 pass** |
| `scripts/verify-release-zip.sh` (fresh Community + Pro installs) | **PASS** (401 / 200 / delete-off 403) |

By category (HTTP suite): static 37, php-static 6, php-lint 4, netpolicy 2,
api 51, security 34, admin 20, discovery 88, provider 8, provider-test 10,
provider-security 12, subdir 1.

*(During this run the Pro image was found to be stale after an interrupted
build; it was rebuilt — `plugin.php` byte size 77353 — and the suite re-run. That
was a test-environment issue, not a product defect.)*

## What was exercised

- **Bounded DNS** — black-hole resolver swap: request bounded (<12 s), fails
  closed, reports a resolve/time-budget error; resolver restored afterwards.
- **Alternate encodings** — decimal `167772161`, hex `0x0a000001` refused.
- **IPv4-mapped IPv6** — `::ffff:10.0.0.1` refused; `::ffff:169.254.169.254` refused.
- **Tunnels** — NAT64 `64:ff9b::` and 6to4 `2002::` refused.
- **Metadata always blocked** — `169.254.169.254`, `metadata.google.internal`,
  `fd00:ec2::254` and NAT64 all refused **with the private-network opt-in on**.
- **Loopback preserved** — `127.0.0.1`, `localhost`, numeric loopback allowed;
  the mock provider is reached over loopback under the default policy; opt-in
  enables then disables a trusted intranet host.
- **Provider-regression** — OpenAI/OpenRouter/LLM-Gateway catalog shapes and the
  chat-completions contract pass through the mock; public HTTPS URL validation
  passes in unit tests.

## Limitations (honest)

- Real LLM Gateway/OpenRouter connectivity was previously verified live on
  Hostinger for 1.0.5; the 1.0.6 changes were validated with the deterministic
  mock and unit tests, not re-run against a live provider.
- The DNS client is minimal (no EDNS/TCP fallback); truncation fails closed.
- Only PHP 8.2 and Chromium were tested.

---

# Update — 1.0.6-rc2: interface and review-workflow refinements

**Branch:** `release/1.0.6-rc2`. **Commit:** `b9a8dc3`.
**Artifact:** `dist/bludit-wizard-1.0.6-rc2.zip`
(SHA-256 `3279d3c9531f3c8c4d300aba8d0481e11e471d6a4a10de4dd016cf03cc830b29`).

## Results (actual)

| Suite | Result |
|-------|--------|
| `tests/runner.mjs` — Community + Pro | **289 / 289 pass** |
| Playwright UI | **18 / 18 pass** |
| Network-policy unit (`tests/php/netpolicy_test.php`) | **98 / 98 pass** |
| RC2 ZIP install (fresh Community + Pro) | **PASS** (401 / 200 / DELETE 405) |

By category (HTTP suite): static 39, php-static 6, php-lint 4, netpolicy 2,
api 49, security 32, admin 38, discovery 88, provider 8, provider-test 10,
provider-security 12, subdir 1.

## RC2 behaviour exercised

- **Deletion removed:** no `#bw-delete`/“Delete selected page” in the UI; admin
  `delete_page` → 403 `deletion_not_supported`; API `DELETE` → 405
  `deletion_not_supported`; the page survives both. Settings expose no deletion
  toggle. Static checks confirm no delete method/handler remains.
- **Original/proposed:** AI response carries the saved page snapshot + revision;
  the Original panel is read-only (no form controls); Proposed is editable;
  desktop two columns, ≤900 px stacks to one.
- **Stale edits:** apply with the reviewed revision succeeds; reusing it → 409
  `stale_page` and the page is unchanged; a missing revision → 409.
- **Status preservation:** submitting no valid status keeps the page type
  (a draft stays a draft).
- **Discard:** hides the proposal, shows a “discarded / not changed” message, and
  the page content is unchanged (no DELETE request).
- **Heading:** computed colour is `rgb(248, 250, 252)`; subtitle present.
- **Analysis-only:** an outline task shows the result without the review/Apply
  panel.
- **Security regression:** the full F-17/F-18/F-19 suites remain green.

## Limitations

- Hostinger RC2 acceptance has **not** been run; steps are in
  `docs/HOSTINGER_ACCEPTANCE_RC2.md`.
- Live provider testing was for the 1.0.5 feature set; RC2 uses the deterministic
  mock.
- Only PHP 8.2 and Chromium were tested.

---

# Update — 1.1.0 RC1: twelve tasks and the full-width content workspace

**Branch:** `feature/1.1.0-rc1`. **Artifact:** `dist/bludit-wizard-1.1.0-rc1.zip`
(SHA-256 `88c078027f5407b6ecfeba5c27936d2974a282723c7e07f44ba06dabd5bca4d6`).

## Results (actual)

| Suite | Result |
|-------|--------|
| `tests/runner.mjs` — Community + Pro | **408 / 408 pass** |
| Playwright UI | **23 / 23 pass** |
| Network-policy unit | **98 / 98 pass** |
| RC1 ZIP install (fresh Community + Pro) | **PASS** (401 / 200 / DELETE 405) |

Task coverage: **112** task-contract checks (twelve tasks × result type, editability,
page requirement, plus isolation, validation and error cases).

By category: static 46, php-static 6, php-lint 4, netpolicy 2, api 49, security 32,
admin 38, tasks 112, discovery 88, provider 8, provider-test 10,
provider-security 12, subdir 1.

## Behaviour exercised

- **Twelve tasks** exist with the fixed names, four categories and the approved
  contextual action labels; switching task updates guidance, action, page control
  and task-specific options (tone; expand/shorten).
- **Result types:** page draft, page revision, metadata proposal, text generation,
  structured audit and conversational. Only the three proposal types are
  editable; audits have no Apply.
- **Context isolation:** `create_page` and `create_outline` send no selected page
  even when a page key is posted; previously selected page content is absent from
  the upstream payload; switching task clears the page select.
- **Read-only audits:** SEO + clarity, internal links and freshness return no
  review/apply.
- **Internal links:** a real target is marked valid with a URL; an invented target
  is rejected; malformed model output returns a clean 502.
- **Ask Wizard:** defaults to no page and sends no page content; an explicit page
  selection includes its snapshot.
- **Safe Markdown:** generated `<img onerror=…>` is rendered as text, not executed.
- **Responsive:** review stacks at 390 px and the document does not overflow
  horizontally.
- **Focus:** after a result, focus moves into the result region.
- **Deletion:** still absent in UI, admin action and API (405).
- **Security regression:** F-17/F-18/F-19 suites unchanged and green; stale
  revisions still refused (409); drafts preserved.

## Limitations

- Hostinger RC1 acceptance has **not** been run; steps are in
  `docs/HOSTINGER_ACCEPTANCE_1.1.0_RC1.md`.
- The provider is the deterministic mock; live LLM Gateway was last validated for
  1.0.5.
- Only PHP 8.2 and Chromium were tested. Markdown rendering is intentionally a
  safe subset (headings, lists, code blocks, paragraphs); other Markdown syntax
  is shown as text.

---

# Update — v1.1.0 RC2 regression repair

**Date:** 2026-10-17
**Branch:** `feature/1.1.0-rc1` (RC2 work continued on the same feature branch;
RC1 is preserved in Git history at `171c997`).

## What was repaired

RC1 passed its source-based suites but failed on the maintainer's deployment:
every task returned `{"ok":false,"error":"Unknown action."}`, the existing-page
selector never appeared, and the button stayed "Run Wizard". The RC1 form had
lost the hidden `action=ai` field, so dispatch depended entirely on JavaScript;
the deployment was serving older client assets than the RC1 markup.

RC2 restores the server-recognised dispatch action, renders the page selector and
first action label server-side, fails safely on missing/blocked/stale JavaScript,
version-busts every asset and verifies the installed ZIP's admin UI. The approved
settings page is unchanged.

## Results (actual)

| Suite | Result |
|-------|--------|
| `tests/runner.mjs` — Community + Pro | **440 / 440 pass** |
| Playwright UI — Community | **33 / 33 pass** |
| Playwright UI — Pro | **33 / 33 pass** |
| Network-policy unit | **98 / 98 pass** |
| `scripts/verify-release-zip.sh dist/bludit-wizard-1.1.0-rc2.zip` | **PASS** (Community + Pro) |
| Playwright smoke against the installed Community ZIP | **3 / 3 pass** |

Raw evidence: `reports/raw/results-1.1.0-rc2.json`,
`reports/raw/playwright-1.1.0-rc2.json`,
`reports/raw/playwright-1.1.0-rc2-pro.json`.

By category (HTTP suite): static 52, php-static 6, php-lint 4, netpolicy 2,
api 49, security 32, admin 64, tasks 112, discovery 88, provider 8,
provider-test 10, provider-security 12, subdir 1.

## New regression coverage

- **Rendered workspace:** hidden `action=ai`, visible page selector, initial
  "Generate Draft" label, populated page options, versioned JS/CSS URLs, served
  `wizard.js` markers (HTTP + Playwright).
- **Native form POST:** shows the recovery notice, returns HTTP 200 HTML, never
  raw `Unknown action`, and makes **zero** provider calls (HTTP).
- **Native `save_page` POST:** refused with "Nothing was saved" (HTTP).
- **Unknown action / no action and no task:** still `400 Unknown action.` (HTTP).
- **No JavaScript:** page selector visible, `<noscript>` warning, submission
  shows the recovery notice (Playwright, `javaScriptEnabled: false`).
- **Blocked `wizard.js`:** same safe outcome (Playwright route abort).
- **Legacy 1.0.x JavaScript against RC2 markup:** throws, then the native POST
  fails safely (Playwright fixture, `tests/e2e/fixtures/legacy-wizard-1.0.3.js`).
- **Missing `BW_CONFIG`:** "Wizard unavailable", action disabled (Playwright).
- **Unknown task value:** visible error, action disabled (Playwright).
- **Page switch:** discards the previous proposal and review state (Playwright).
- **Console:** the workspace initializes without `wizard.js` errors (Playwright).
- **Settings protected baseline:** all approved controls present, Save persists,
  Cancel does not, secrets remain blank (Playwright).
- **Installed ZIP:** manifest hashes, served JS hash, workspace markers, native
  and AJAX posts on Community and Pro; focused browser smoke against the ZIP.

## Limitations

- Hostinger RC2 acceptance has **not** been run; steps are in
  `docs/HOSTINGER_ACCEPTANCE_1.1.0_RC2.md`.
- The provider is the deterministic mock; live LLM Gateway was last validated for
  1.0.5.
- Only PHP 8.2 and Chromium were tested.

---

# v1.1.0 stable release validation

**Date:** 2026-10-18
**Artifact:** `dist/bludit-wizard-1.1.0.zip`
**SHA-256:** `51bfcb43c41412f30d9e68c7e99c54bc0a29213527ec9c32c53d92cc97632491`
**License:** GPL-3.0-only

The stable release carries the maintainer-accepted RC2 runtime behavior with
release metadata, GPL-3.0-only licensing, updated documentation and
`?v=1.1.0` asset URLs. No frontend or backend workflow was redesigned.

## Results (actual)

| Suite | Result |
|-------|--------|
| `tests/runner.mjs` — Community + Pro | **441 / 441 pass** |
| Playwright UI — Community | **33 / 33 pass** |
| Playwright UI — Pro | **33 / 33 pass** |
| Network-policy unit | **98 / 98 pass** |
| `scripts/verify-release-zip.sh dist/bludit-wizard-1.1.0.zip` | **PASS** (Community + Pro; installed-ZIP browser smoke 3/3) |

Raw evidence: `reports/raw/results-1.1.0.json`,
`reports/raw/playwright-1.1.0.json`,
`reports/raw/playwright-1.1.0-pro.json`.

Static checks include: `metadata.license` is `GPL-3.0-only`; `LICENSE` contains
the official GNU GPL version 3 text; asset URLs end in `?v=1.1.0`; the workspace
form keeps `action=ai`; unknown actions are rejected; the native-form recovery
path makes no provider calls.

## Package verification

- ZIP: single top-level `wizard/`, 16 files, 63,988 bytes.
- Generated `wizard/assets.json` matches all six tracked runtime files.
- The verifier installs the ZIP into fresh Community and Pro containers,
  confirms the served `wizard.js` hash, exercises native and AJAX posts, and runs
  a Playwright smoke against the installed Community ZIP.
- The RC2 archive (`dist/bludit-wizard-1.1.0-rc2.zip`) is preserved and was not
  overwritten.

## Limitations

- Bludit directory acceptance is external; a submitted PR is not an accepted
  listing.
- Live OpenAI, Ollama and third-party provider acceptance was not performed for
  this release. OpenRouter and LLM Gateway were maintainer-verified on RC2.
- Only PHP 8.2 and Chromium/Firefox (screenshots) were used locally.

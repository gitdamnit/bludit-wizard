# Bludit Wizard — Compatibility Matrix

**Plugin version:** `1.0.4-rc2` (baseline `1.0.4-rc1`)
**Date:** 2026-10-15

A "✅" row means the npm/Node HTTP suite (`tests/runner.mjs`) and/or the Playwright
UI suite passed for that combination in the isolated environment. "⚠️" means not
verified here but expected to work. "❌" means not supported.

## Tested here (live installation, simulated AI)

| Component | Version / configuration | Environment | Result | What ran |
|-----------|-------------------------|-------------|:------:|----------|
| Bludit Community | 3.22.0 (GitHub release `3.22.0`, core commit `c573a99`) | `community:8081` | ✅ | full HTTP + security + admin + Playwright |
| Bludit Pro | 3.22.0 build 20260510 (commit `d5612ed`) | `pro:8082` | ✅ | full HTTP + security + admin |
| Install location | domain root (`/`) | community, pro | ✅ | API, admin routing |
| Install location | subdirectory (`/blog`) | `subdir:8083` | ✅ (after F-02 fix) | API base path |
| GPT Action key | not configured | `nokey:8084` | ✅ | returns `503`, refuses to serve |
| PHP | 8.2.34 (`php:8.2-apache`) | all | ✅ | lint + runtime |
| Web server | Apache 2.4.68 with `.htaccess`/`mod_rewrite` | all | ✅ | pretty URLs + API routing |
| Browser | Chromium 156 (Playwright 1.64.1, headless) | community | ✅ | admin UI, preview-before-write |
| AI provider | OpenAI-compatible (mock) | all | ✅ | request contract (payload, auth) |
| Content store | Bludit flat-file (`bl-content`) | all | ✅ | create/read/update/delete |

Baseline (rc1) had the same matrix **except** `subdir` (❌ 404) and all admin
writes (❌ 403) — see `TEST_REPORT.md`.

### Added in 1.0.5 — provider validation & model discovery

| Component | Version / configuration | Environment | Result | What ran |
|-----------|-------------------------|-------------|:------:|----------|
| Model discovery (`GET /models`) | OpenAI-style catalog (mock) | community, pro | ✅ | runner discovery suite |
| Model discovery | OpenRouter-style (pricing + tools, mock) | community, pro | ✅ | discovery suite |
| Model discovery | LLM-Gateway-style (cost, mock) | community, pro | ✅ | discovery suite |
| Model discovery | metadata-free / empty / malformed / 401 / 500 (mock) | community, pro | ✅ | discovery suite |
| URL policy / SSRF | file, metadata IP, public http, credentials, loopback, intranet | community, pro | ✅ | blocked-URL tests |
| Model test (`POST /chat/completions`, max_tokens 1) | mock | community, pro | ✅ | provider-test suite |
| Administrator authorization | Bludit `editor` user | community, pro | ✅ | provider-security suite |
| Settings UI (presets, dropdown, filters, test) | Chromium 156 | community | ✅ | Playwright `settings.spec.ts` |

The feature uses only standard PHP (cURL, `parse_url`, `filter_var`) and vanilla
JavaScript, so it inherits the same platform expectations as the rest of the
plugin (PHP 8+, cURL). The AI-call path now shares the same URL policy and
transport as discovery.


## Expected to work, not verified here

| Combination | Why not verified | Note |
|-------------|------------------|------|
| PHP 8.3 / 8.4 | only 8.2 used | Bludit 3.22 itself targets PHP 8+; plugin uses no version-specific syntax |
| Apache **without** `.htaccess` (`AllowOverride None`) | not configured | API depends on Bludit's rewrite; would need `FallbackResource`/nginx config |
| Nginx | not configured | requires Bludit's nginx rewrite rules |
| Windows / IIS | not applicable on this host | Bludit supports them; untested |
| Mozilla Firefox / Apple WebKit | not run | UI uses standard DOM + `CSS.escape` (supported) |
| Ollama (real) | mocked only | plugin posts OpenAI-shaped requests, which Ollama's `/v1` accepts |
| Other OpenAI-compatible endpoints (LM Studio, vLLM, Azure-style) | mocked only | same wire format |
| Multilingual admin (non-English) | default language used | language file is a single `en.json` with plugin name/description |

## Explicitly out of scope / not supported here

| Item | Note |
|------|------|
| Bludit 4.x | `metadata.json` declares `"compatible": "3.22"`; 4.x not tested |
| Bludit ≤ 3.21 | not tested; the plugin uses core APIs present in 3.22 |
| Databases (MySQL/MariaDB/Postgres) | Bludit core is flat-file; plugin stores settings in `db.php` |
| Multi-site / multi-user author attribution for AI content | see F-05; content is attributed to a chosen admin |
| Performance, load, concurrency | not tested |
| Real LLM output quality / cost | simulated provider only |

## Compatibility-relevant plugin facts

- Declared compatibility: `metadata.json → "compatible": "3.22"`; Bludit compares
  major.minor, so this matches any `3.22.x`.
- Admin route is derived from the **class name** (`pluginwizard`), which is
  independent of the directory name.
- The API works at any install depth as of rc2.
- Requirements: PHP 8+, PHP cURL (for AI calls), `mbstring`/`json`/`gd`/`dom`/
  `session` (Bludit core requirements).
- Bludit recommends editing `RewriteBase` for subdirectory installs; the `subdir`
  environment does exactly that, matching real deployments.

## How to extend this matrix

Add a service in `testenv/compose.yaml` (e.g. a `php:8.3-apache` build or an
nginx-based one), provision it with `testenv/provision.sh`, then run
`node tests/runner.mjs --target <name>`. Playwright targets are selected with
`tests/e2e/run.sh <target>`.

### Added in 1.0.5-rc1 — security hardening

| Component | Configuration | Environment | Result | What ran |
|-----------|---------------|-------------|:------:|----------|
| API deletion gate | default (off) | community, pro | ✅ | 403 + page persists |
| API deletion gate | opt-in enabled | community, pro | ✅ | 200 deleted + verified |
| Native deletion | administrator | community, pro | ✅ | create/delete verified |
| Native deletion | editor / anonymous | community, pro | ✅ | 403 / not accepted |
| Provider URL policy | loopback (default) | community, pro | ✅ | discovery works |
| Provider URL policy | private host (default) | community, pro | ✅ | refused, no network |
| Provider URL policy | private host (opt-in) | community, pro | ✅ | allowed then re-blocked |
| Saved-key handling | settings page | community, pro | ✅ | keys not echoed; blank keeps them |
| Packaged ZIP | `dist/bludit-wizard-1.0.5-rc1.zip` | throwaway container | ✅ | lint + install + API smoke test |

The default policy is exercised because the test image exposes the mock provider
to the container over loopback (Apache reverse proxy), while private/intranet
hosts stay denied.

### Added in 1.0.5 (final) — DNS resolution protection

| Component | Configuration | Environment | Result | What ran |
|-----------|---------------|-------------|:------:|----------|
| Provider URL policy | loopback (default) | community, pro | ✅ | discovery works |
| Provider URL policy | private host (default) | community, pro | ✅ | refused, no network |
| Provider URL policy | private host (opt-in) | community, pro | ✅ | allowed then re-blocked |
| Provider URL policy | public name → private address (`evil.example.com`) | community, pro | ✅ | refused before connecting |
| Provider URL policy | unresolvable host (`.invalid`) | community, pro | ✅ | clear network error |
| Release ZIP | `dist/bludit-wizard-1.0.5.zip` | throwaway Community + Pro containers | ✅ | lint, install, API 401/200, delete-off 403 |

The default policy is exercised because the test image exposes the mock provider
to the container over loopback; a public-looking alias that resolves to a private
address simulates DNS rebinding.

### Added in 1.0.6-rc1 — SSRF hardening

| Component | Configuration | Environment | Result | What ran |
|-----------|---------------|-------------|:------:|----------|
| Bounded DNS | black-hole resolver (`192.0.2.1`) | community, pro | ✅ | bounded, fail-closed (unit + resolv.conf swap) |
| Pinning fail-closed | `CURLOPT_RESOLVE` unavailable | unit | ✅ | request refused |
| Peer verification | connected address mismatch | code + static | ✅ | response discarded |
| Alternate encodings | decimal / hex / octal / short IPv4 | community, pro | ✅ | refused |
| IPv4-mapped IPv6 | `::ffff:10.0.0.1`, `::ffff:169.254.169.254` | community, pro | ✅ | refused |
| NAT64 / 6to4 / Teredo | `64:ff9b::`, `2002::`, `2001::` | community, pro | ✅ | refused |
| Metadata with opt-in ON | `169.254.169.254`, `*.google.internal`, `fd00:ec2::254` | community, pro | ✅ | still refused |
| Loopback (default) | `127.0.0.1`, `localhost`, numeric | community, pro | ✅ | allowed; mock reachable |
| Private opt-in | intranet host, enabled then disabled | community, pro | ✅ | allowed then blocked |
| Release ZIP | `dist/bludit-wizard-1.0.6-rc1.zip` | fresh Community + Pro | ✅ | lint, install, API 401/200, delete-off 403 |

### Added in 1.0.6-rc2 — interface and review workflow

| Component | Configuration | Environment | Result | What ran |
|-----------|---------------|-------------|:------:|----------|
| Heading contrast | computed `#F8FAFC` on dark hero | community | ✅ | Playwright |
| Original panel | read-only, saved page data | community | ✅ | Playwright |
| Proposed panel | editable | community | ✅ | Playwright |
| Two-column / stacked | desktop and ≤900 px | community | ✅ | Playwright |
| Discard suggestion | no write, no DELETE | community | ✅ | Playwright + API check |
| Deletion absent | UI / admin / API | community, pro | ✅ | static + admin + API + Playwright |
| Stale revision | 409 `stale_page` | community, pro | ✅ | admin AJAX |
| Status preservation | draft stays draft | community, pro | ✅ | admin AJAX + Playwright |
| RC2 ZIP install | fresh Community + Pro | containers | ✅ | lint + install + API |

### Added in 1.1.0 RC1 — twelve tasks and full-width workspace

| Component | Configuration | Environment | Result | What ran |
|-----------|---------------|-------------|:------:|----------|
| Twelve tasks | four categories, fixed labels/actions | community, pro | ✅ | 112 task checks |
| Task guidance/options | per-task guidance, tone, length | community | ✅ | Playwright |
| Page draft / revision | review + apply | community, pro | ✅ | tasks + admin AJAX |
| Metadata proposal | title/description/slug only | community, pro | ✅ | tasks suite |
| Structured audits | SEO, links, freshness — read-only | community, pro | ✅ | tasks + Playwright |
| Internal-link validation | real vs invented targets | community, pro | ✅ | tasks + Playwright |
| Context isolation | task/page switch clears state | community, pro | ✅ | tasks + Playwright |
| Safe Markdown | injected HTML inert | community | ✅ | Playwright |
| Responsive / focus | 390 px stack, no overflow, focus move | community | ✅ | Playwright |
| RC1 ZIP install | fresh Community + Pro | containers | ✅ | lint + install + API |

### Released in 1.1.0 — stable public release

| Component | Configuration | Environment | Result | What ran |
|-----------|---------------|-------------|:------:|----------|
| Twelve tasks and workspace | accepted RC2 runtime | Community 3.22.0, Pro 3.22.0 | ✅ | 441 HTTP checks, 33 Playwright per edition |
| GPL-3.0-only licensing | LICENSE + metadata | source + ZIP | ✅ | static license/text checks |
| Asset versioning | `?v=1.1.0` | Community, Pro | ✅ | rendered-HTML, Playwright |
| Installed stable ZIP | `dist/bludit-wizard-1.1.0.zip` | fresh Community + Pro | ✅ | manifest, admin UI, native/AJAX dispatch, 3/3 browser smoke |
| GitHub release | tag `v1.1.0` | github.com/gitdamnit/bludit-wizard | ✅ | source, tag, release, asset download and SHA-256 |
| Bludit directory | PR #489 | bludit/plugins-repository | ⬜ | submitted; acceptance pending |

# Product Requirements

## Project Identity

- **Name:** Bludit Wizard
- **Subtitle:** Your intelligent Bludit publishing companion.
- **Repository:** https://github.com/gitdamnit/bludit-wizard (published with v1.1.0)
- **Licence:** GPL-3.0-only — Copyright © 2026 Evan Zellner
- **Maintainer:** Evan Zellner — [@gitdamnit](https://github.com/gitdamnit)
- **Current release:** 1.1.0 (stable public release)

Bludit Wizard is the native Bludit plugin. It is distinct from **Bludit Wizard
MCP** (a separate, independently developed service) and from the historical
**Bludit Wizard Custom GPT** (preserved in `docs/history/CUSTOM_GPT_LEGACY.md`).

## Purpose

Bludit Wizard helps a Bludit site owner plan, draft, improve and analyse content
with an OpenAI-compatible AI provider while keeping a human in control of every
write. It validates the provider, discovers live models, shows the original page
beside a proposed revision, and refuses stale or unreviewed writes. It is a
content creation, improvement, analysis and publishing assistant — it is not a
page-deletion interface, and it does not require the MCP service.

## Intended Users

Bludit administrators and editors who want AI assistance with writing and
analysis but are not willing to trade away review control, credential safety or
the ability to keep drafts unpublished. They already know how to install a
Bludit plugin and configure an API endpoint.

## Functional Requirements

| ID | Requirement | Acceptance signal |
|----|-------------|-------------------|
| FR-1 | Admin dashboard integrates with Bludit (sidebar link, plugin route, settings form). | `tests/runner.mjs` admin tests; Playwright sidebar test |
| FR-2 | Provider presets, live model discovery, searchable selection, manual model entry. | discovery suite; Playwright settings spec |
| FR-3 | Preview-before-write with an editable **Proposed** panel beside a read-only **Original** panel. | Playwright review tests; admin AJAX tests |
| FR-4 | Explicit **Apply this change** required; discarded suggestions never write. | Playwright apply/discard tests |
| FR-5 | Stale edits refused (page re-read; revision compared; `409 stale_page`). | admin AJAX stale tests |
| FR-6 | Publication status preserved; drafts are not accidentally published. | status-preservation tests |
| FR-7 | **No page-deletion capability** anywhere in Wizard (UI, JS, admin action, API). | deletion-absence tests (all suites) |
| FR-8 | Bearer-key Custom GPT API (site/pages read, create, update) with post-write verification. | API suite |
| FR-9 | Provider validation reports URL validity, reachability, authentication, catalog and inference separately. | discovery + provider suites |
| FR-10 | SSRF hardening: bounded DNS, fail-closed pinned connections, metadata/encoding protections. | netpolicy unit suite + discovery suite |
| FR-11 | Secrets never echoed; blank fields preserve stored keys; CSRF enforced. | security suite + static checks |
| FR-12 | Twelve tasks in four categories with fixed names and contextual action labels. | tasks suite + Playwright |
| FR-13 | Full-width content workspace (no permanent sidebar; no Site intelligence / AI configuration / Safety model cards). | static + Playwright |
| FR-14 | Six reusable result types; audits are read-only with no Apply. | tasks suite + static |
| FR-15 | Strict context isolation on task/page change (no page/instruction leakage). | tasks suite + Playwright isolation test |
| FR-16 | Task-specific guidance, labels, placeholders and options. | static + Playwright |

Detailed, historical requirement sections are retained below under
**Detailed Requirements (retained)**.

## Nonfunctional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Security | Bounded DNS (4 s budget), fail-closed pinning with peer verification, metadata always blocked, TLS verification on, redirects off, CSRF via Bludit core |
| NFR-2 | Compatibility | Bludit Community 3.22.0 and Bludit Pro 3.22.0; root and subdirectory installs |
| NFR-3 | Runtime | PHP 8.0+ with cURL; no Composer dependencies |
| NFR-4 | Accessibility / responsiveness | Keyboard-usable review form; two-column desktop, stacked ≤900 px; heading contrast ≥ 4.5:1 |
| NFR-5 | Data safety | No secret or model catalog in logs; no silent overwrite; stale writes refused |
| NFR-6 | Packaging | Single top-level `wizard/` directory; no test/tooling files |

## Scope and Exclusions

**In scope for 1.1.0 RC1:** the native plugin, the full-width content workspace,
the twelve AI-assisted tasks, task-specific guidance and contextual actions,
original-vs-proposed review, discard, stale-edit protection, read-only audits,
metadata proposals, the Custom GPT API (read/create/update), and the 1.0.6 SSRF
hardening.

**Explicitly out of scope:** page deletion (removed permanently and not restored);
the MCP service; the historical Custom GPT (preserved, not maintained here);
Bludit core changes; multi-user author attribution for AI-created content;
unsupported Bludit metadata fields; fabricated SEO rankings, volumes, backlinks or
crawl data.

## Technical Constraints

- PHP 8.0+; cURL extension; Bludit 3.22.x plugin API (`Plugin` base class,
  `form()`, `adminController()`, `adminView()`, `beforeAll()`).
- Bludit may install in a subdirectory; the API must work under `HTML_PATH_ROOT`.
- Bludit instantiates every class declared during plugin discovery, so helper
  classes must be loaded lazily (`wizard/lib/netpolicy.php`).
- No external runtime dependency; network access only to the configured provider.
- The installed directory name `wizard/`, plugin class `pluginWizard`, and API
  path `/api/wizard` must not change.
- The plugin is licensed **GPL-3.0-only** (SPDX); `LICENSE` contains the official
  GNU GPL version 3 text, and `metadata.json` uses the same identifier.

## Acceptance Criteria

1. The full harness is green on Bludit Community and Pro: `tests/runner.mjs`,
   the network-policy unit suite, and Playwright.
2. No Wizard deletion capability exists, and `DELETE /api/wizard/pages/{key}`
   returns `405` without changing the site.
3. A stale revision cannot be written; a missing revision is refused.
4. The original panel is read-only and shows saved page data; the proposed panel
   is editable.
5. The packaged ZIP installs on fresh Community and Pro instances and serves the
   API; the SHA-256 is recorded.
6. The packaged ZIP's admin workspace is exercised in a browser: twelve tasks,
   correct initial and per-task action labels, visible page selectors, working
   AJAX dispatch and no initialization errors.
7. A missing, blocked or stale `wizard.js` never produces a raw
   `{"error":"Unknown action."}` response and never runs a task or saves content
   from a native form POST; the operator sees an actionable message instead.
8. The page selector and the first task's action label are present in the
   server-rendered HTML, before JavaScript runs.
9. Plugin assets carry a release version and the ZIP ships `assets.json`; the
   verifier compares the served JavaScript hash with the packaged file.
10. The approved settings page is unchanged: provider presets, Base URL, model
    and discovery, filters, Refresh/Test, both keys, temperature, max tokens,
    system prompt, private-network toggle and Save/Cancel all remain present and
    functional.
11. The stable ZIP is published on GitHub with a verified SHA-256 and the
    official Bludit directory metadata uses GPL-3.0-only.
12. Docs, decisions and status are consistent (ProDoc Guard `validate`/`check`).

## Release Objectives

- **1.1.0 stable (current):** publish the maintainer-accepted RC2 implementation
  under GPL-3.0-only, with the stable installation ZIP, GitHub release and
  official Bludit directory submission. No runtime behavior changes.
- **1.1.0 RC2 (superseded):** repair the RC1 release-blocking regression without
  rewriting the workspace: restore a server-recognised dispatch fallback, make
  the page selector and first action label server-rendered, fail safely on
  missing/stale JavaScript, version all assets, and verify the installed ZIP's
  admin UI. The settings page remains a protected, unchanged baseline.
- **1.1.0 RC1 (superseded):** the twelve-task workspace was functionally correct
  in source but failed on the maintainer's deployment because the form lost its
  dispatch action and the deployed client assets were older than the markup.
  Preserved as historical evidence, not as a shippable artifact.
- **Post-1.1.0:** pending owner direction; no additional features are authorised
  by this release.

## v1.1.0 RC2 Regression Requirements

| # | Requirement | Verification |
|---|-------------|--------------|
| RR1 | The workspace form always carries a server-recognised `action=ai` field. | [auto] static + rendered-HTML check |
| RR2 | A POST carrying `task` but no `action` is treated as an AI request (CSRF/task validation still apply). | [auto] HTTP test |
| RR3 | Unknown or malicious actions are still rejected with `400 Unknown action.` | [auto] HTTP test |
| RR4 | A browser-native POST (no `X-Requested-With`) never runs the provider or saves content; it renders an actionable notice. | [auto] HTTP + Playwright |
| RR5 | The page-selector wrapper is not `hidden` in server-rendered HTML. | [auto] rendered-HTML + Playwright |
| RR6 | The first task's contextual action label is server-rendered ("Generate Draft"). | [auto] rendered-HTML + Playwright |
| RR7 | All plugin asset URLs carry `?v=1.1.0` (CSS, wizard.js, settings.js). | [auto] rendered-HTML + Playwright |
| RR8 | The build produces `wizard/assets.json` and the verifier matches every hash. | [auto] `scripts/verify-release-zip.sh` |
| RR9 | Missing, blocked, stale and unknown-config JavaScript states fail visibly and safely. | [auto] Playwright (4 scenarios) |
| RR10 | The approved settings page controls, persistence, presets, discovery, model test, secrets and Save/Cancel are unchanged. | [auto] Playwright settings suite |
| RR11 | The installed ZIP (not the source checkout) passes the UI smoke on Community. | [auto] `scripts/verify-release-zip.sh` |

## v1.1.0 Task Menu (implemented)

Twelve tasks total: **five existing and seven new**, implemented in 1.1.0 RC1.

### Category A — WRITE & CREATE

| # | Task | Status | Primary action | Behaviour |
|---|------|--------|----------------|-----------|
| 1 | Create a new page | EXISTING | **Generate Draft** | Generate a proposed new Bludit page from the user's instructions; review and edit before explicitly creating it. |
| 2 | Create an outline | EXISTING | **Generate Outline** | Generate a structured outline without creating or modifying a page. |
| 3 | Generate article ideas | NEW FOR v1.1.0 | **Generate Ideas** | Suggest article topics from instructions and site context; never create pages automatically. |

### Category B — EDIT & IMPROVE

| # | Task | Status | Primary action | Behaviour |
|---|------|--------|----------------|-----------|
| 4 | Improve an existing page | EXISTING | **Review Improvements** | Select a page, analyse it, generate an editable proposed revision, and show the original/proposed comparison. Do not write until explicitly approved. |
| 5 | Rewrite tone or style | NEW FOR v1.1.0 | **Rewrite Content** | Rewrite selected content in the requested tone/style while preserving factual meaning; present for review. |
| 6 | Expand or shorten content | NEW FOR v1.1.0 | **Adjust Length** | Expand or condense to the user's instructions without inventing unsupported facts; present for review. |
| 7 | Proofread content | NEW FOR v1.1.0 | **Proofread Page** | Correct grammar, punctuation, spelling and clarity while preserving the author's meaning and voice; present for review. |

### Category C — SEO & QUALITY

| # | Task | Status | Primary action | Behaviour |
|---|------|--------|----------------|-----------|
| 8 | SEO + clarity audit | EXISTING | **Analyze Page** | Analyse content for SEO, clarity, structure and readability; provide recommendations without modifying the page. |
| 9 | Generate SEO metadata | NEW FOR v1.1.0 | **Generate Metadata** | Suggest SEO titles, descriptions and metadata supported by Bludit; never claim unsupported fields; present before applying. |
| 10 | Suggest internal links | NEW FOR v1.1.0 | **Find Link Opportunities** | Analyse available pages and recommend internal links; verify targets exist; do not insert automatically. |
| 11 | Audit content freshness | NEW FOR v1.1.0 | **Check Content Freshness** | Identify content that may need updating from dates, content and user context; distinguish potentially outdated information from verified inaccuracies. |

### Category D — GENERAL

| # | Task | Status | Primary action | Behaviour |
|---|------|--------|----------------|-----------|
| 12 | Ask Wizard | EXISTING | **Ask Wizard** | Answer a freeform question about writing, publishing or supported site capabilities; do not modify the site unless the user explicitly selects and approves an applicable write workflow. |

### v1.1.0 task-menu UX requirements

1. Present the twelve tasks under their four designated categories.
2. Preserve a simple, understandable task-selection interface.
3. Use the exact contextual primary action labels above.
4. Show only fields relevant to the selected task.
5. For editing tasks, include existing-page selection.
6. For creation tasks, show creation-specific instructions.
7. For audit tasks, present findings and recommendations.
8. For proposal-based edits, provide original/proposed comparison.
9. For all write-capable tasks, require explicit approval.
10. No task may silently overwrite or delete published content.
11. Do not automatically create unsupported Bludit metadata fields.
12. Maintain responsive and accessible design.
13. Preserve the user's control over publication status.
14. Do not introduce a Wizard page-deletion task.

## Detailed Requirements (retained)

**Artefact under test:** Bludit Wizard plugin. Baseline is release candidate
`1.0.4-rc1` (`wizard/`, extracted from `bludit-wizard-1.0.4-rc1.zip`); the current
development branch adds provider validation and model discovery as `1.0.5`.
**Target platform:** Bludit 3.22.x (Community and Pro).
**Status:** release branch `release/1.0.5`; **stable 1.0.5** assets prepared and
verified, awaiting owner authorization to publish. Not deployed or submitted.

This document records what the plugin must do, and how each requirement is
verified by the automated suite in `tests/`.

Legend for verification: **[auto]** covered by `tests/runner.mjs` and/or
`tests/e2e`; **[manual]** requires operator judgement.

### 1. Admin integration

| # | Requirement | Verification |
|---|-------------|--------------|
| R1.1 | The plugin is listed and activates under **Admin → Settings → Plugins**. | [auto] plugin DB presence + settings route test |
| R1.2 | A **Wizard** entry appears in the Bludit admin sidebar. | [auto] `admin sideBar` links to `/admin/plugin/pluginwizard` |
| R1.3 | The sidebar link opens the Wizard admin page. | [auto] UI test navigates via the sidebar |
| R1.4 | The admin page must be reachable at the Bludit plugin route derived from the plugin **class name** (`plugin/pluginwizard`), not the directory name. | [auto] route test on Community + Pro |
| R1.5 | The plugin settings form renders provider, base URL, model, LLM API key, GPT Action API key, temperature, max tokens, system prompt. | [auto] settings route test (UI) |
| R1.6 | Settings persist through Bludit's standard plugin mechanism. | [manual] Bludit core behaviour; seed inspected |

### 2. Authentication and authorisation

| # | Requirement | Verification |
|---|-------------|--------------|
| R2.1 | Every admin write action is protected by a valid admin session. | [auto] unauthenticated admin page has no config |
| R2.2 | Every admin write action is protected by CSRF validation. | [auto] AJAX without token is rejected |
| R2.3 | A logged-in administrator with a valid CSRF token can run the Wizard and apply changes. | [auto] admin AJAX tests + UI tests |
| R2.4 | The GPT Action API requires a bearer secret and never serves without one configured. | [auto] 401 / 503 tests |
| R2.5 | The GPT Action key is compared in constant time. | [auto] static check (`hash_equals`) |
| R2.6 | The LLM provider key and the GPT Action key are independent secrets. | [auto] settings form + static check |

### 3. GPT Action (Custom GPT) API

Base path: `/api/wizard` (installation-relative).

| # | Endpoint | Requirement | Verification |
|---|----------|-------------|--------------|
| R3.1 | `GET /site` | Returns site identity and page count. | [auto] |
| R3.2 | `GET /pages` | Returns up to 200 page summaries. | [auto] |
| R3.3 | `GET /pages/{key}` | Returns one page incl. raw content, 404 when missing. | [auto] |
| R3.4 | `POST /pages` | Creates a page, returns 201, verifies by read-back. | [auto] |
| R3.5 | `PUT /pages/{key}` | Requires `confirm`, updates, verifies. | [auto] |
| R3.6 | `DELETE /pages/{key}` | Requires `confirm`, deletes, verifies. | [auto] |
| R3.7 | Invalid JSON → 400; missing fields → 400; unknown route → 404; bad method → 405. | [auto] |
| R3.8 | API must work when Bludit is installed in a subdirectory. | [auto] subdir target |
| R3.9 | Responses are `application/json` and must not leak secrets. | [auto] |

### 4. Native AI provider configuration

| # | Requirement | Verification |
|---|-------------|--------------|
| R4.1 | Supports OpenAI, Ollama, and generic OpenAI-compatible endpoints. | [auto] request is OpenAI chat-completions shaped |
| R4.2 | Requests go to `{baseUrl}/chat/completions` with bearer auth when a key is set. | [auto] mock provider inspects headers/body |
| R4.3 | Model, temperature and max tokens are sent from settings. | [auto] mock provider asserts payload |
| R4.4 | Provider errors are surfaced to the operator, not swallowed. | [auto] admin AJAX + UI error test |
| R4.5 | The provider key is never written into the Wizard admin page. | [auto] secret-exposure test |

### 5. Preview-before-write safety model

| # | Requirement | Verification |
|---|-------------|--------------|
| R5.1 | "Run Wizard" only produces a proposal; it must not persist content. | [auto] UI test asserts page absent after run |
| R5.2 | The proposal is editable before writing. | [auto] apply panel populated |
| R5.3 | Content is written only when the operator presses **Apply this change**. | [auto] UI test |
| R5.4 | Existing pages require confirmation before overwrite/delete. | [auto] UI dialog handling + API `confirm` |
| R5.5 | After a write the plugin reads the page back to verify. | [auto] "verified" responses |

### 6. Content operations

| # | Requirement | Verification |
|---|-------------|--------------|
| R6.1 | Create/edit/delete use Bludit core functions, not direct file writes. | [auto] static check (`createPage`/`editPage`/`deletePage`) |
| R6.2 | Allowed page types are `published, draft, static, sticky, scheduled`; others fall back safely. | [auto] type coercion test |
| R6.3 | Deleted pages are verifiably gone. | [auto] |

### 7. Security and privacy

| # | Requirement | Verification |
|---|-------------|--------------|
| R7.1 | Page keys cannot traverse the filesystem. | [auto] traversal test |
| R7.2 | Stored content cannot inject script into the admin page. | [auto] escaping review + XSS test |
| R7.3 | The API sets no permissive CORS header. | [auto] |
| R7.4 | Admin impersonation used for API creation must be request-scoped and must not leak to other users. | [auto]/[manual] code review |
| R7.5 | Sending page/site context to a third-party AI endpoint is disclosed. | [manual] README |

### 8. Packaging and Bludit directory submission

| # | Requirement | Verification |
|---|-------------|--------------|
| R8.1 | Plugin folder contains `plugin.php`, `metadata.json`, `languages/`, assets. | [auto] static |
| R8.2 | `metadata.json` has author, version, releaseDate, license, compatible, notes. | [auto] |
| R8.3 | No hardcoded secrets. | [auto] |
| R8.4 | Bludit repository needs an author file and an item folder with `metadata.json` + `screenshot.png`. | [manual] checklist |

### 9. Provider validation and model discovery (1.0.5)

| # | Requirement | Verification |
|---|-------------|--------------|
| R9.1 | Server-side `GET {base_url}/models` discovery with Bearer auth where supported. | [auto] discovery suite, Community + Pro |
| R9.2 | Parse OpenAI-style catalogs (`data[].id`) plus optional names, pricing and capabilities. | [auto] OpenAI/OpenRouter/LLM-Gateway catalog tests |
| R9.3 | Presets for OpenAI, OpenRouter, LLM Gateway and Ollama, plus a custom provider. | [auto] static + UI test |
| R9.4 | A searchable model dropdown populated from the real API response. | [auto] Playwright settings spec |
| R9.5 | Manual model-ID entry preserved as a fallback. | [auto] UI test (preset change leaves the model) |
| R9.6 | A "Refresh models" action and an optional low-cost "Test model" action. | [auto] runner + UI |
| R9.7 | URL validity, reachability, authentication, catalog retrieval and inference are reported separately and never conflated. | [auto] staged-diagnostics tests |
| R9.8 | Free-model and tool-support filters appear only when reliable metadata exists. | [auto] UI + parser tests |
| R9.9 | Discovery never clears or changes the saved model. | [auto] runner + UI |
| R9.10 | Only a successfully retrieved catalog is cached (guarded PHP file in the plugin workspace). | [auto] cache-surfacing test |
| R9.11 | Actions require an administrator; CSRF is enforced; API keys are never echoed or logged. | [auto] provider-security suite |
| R9.12 | URL policy: http/https only, HTTPS required for public hosts, link-local/metadata/credentialed URLs blocked, no redirects, timeouts, size cap. | [auto] blocked-URL tests |
| R9.13 | The AI call path applies the same URL policy and transport. | [auto] existing AI tests + code review |
| R9.14 | Works on Bludit Community and Pro. | [auto] both targets |

### 10. Security hardening for publication (1.0.5-rc1)

| # | Requirement | Verification |
|---|-------------|--------------|
| R10.1 | AI/API page deletion is disabled by default; the native administrator delete is retained and requires an administrator role. | [auto] API 403 default, opt-in works, editor denied, static default check |
| R10.2 | Private/internal provider hosts are denied by default; loopback (Ollama) always allowed; explicit opt-in for trusted LAN hosts; metadata hostnames blocked. | [auto] blocked/loopback/opt-in tests |
| R10.3 | Saved API keys are never echoed into the settings page; blank submissions keep the stored value. | [auto] non-echo + preservation tests |
| R10.4 | Provider actions remain administrator-only and CSRF-protected. | [auto] provider-security suite |
| R10.5 | Model catalogs are cached only on success, in a guard-protected file, and never logged. | [auto] cache tests, static check |
| R10.6 | Provider-supplied strings are rendered safely (textContent, JSON_HEX escaping). | [auto] static + UI |

### 11. Release packaging and Bludit directory submission (1.0.5-rc1)

| # | Requirement | Verification |
|---|-------------|--------------|
| R11.1 | A distribution ZIP with a single top-level `wizard/` directory and only shippable files. | [auto] `scripts/build-release.sh`, archive listing |
| R11.2 | The packaged archive installs on a clean Bludit and serves the API. | [auto] `scripts/verify-release-zip.sh` |
| R11.3 | Repository author record, item metadata, 800×600 screenshot and submission instructions are staged. | [manual] `submission/` review |
| R11.4 | No publish, merge, deploy or pull request without owner approval. | [manual] |

### 12. SSRF hostname/DNS resolution protection (1.0.5 final)

| # | Requirement | Verification |
|---|-------------|--------------|
| R12.1 | Provider hostnames are resolved and every resolved address is checked (link-local/metadata/unspecified refused; private/internal refused unless the opt-in is set). | [auto] DNS stage tests |
| R12.2 | The connection is pinned to the verified addresses (`CURLOPT_RESOLVE`) so the resolver cannot be re-queried mid-flight (DNS rebinding). | [auto] static check + code |
| R12.3 | A public-looking name that resolves to a private address is refused before connecting. | [auto] `evil.example.com` test |
| R12.4 | An unresolvable host produces a clear network error, not a crash. | [auto] `.invalid` test |
| R12.5 | Supported providers keep working: public HTTPS endpoints, IP literals and loopback (Ollama). | [auto] loopback discovery + full suite |

### 13. Stable release finalization (1.0.5)

| # | Requirement | Verification |
|---|-------------|--------------|
| R13.1 | Version is finalized as `1.0.5` across plugin metadata, changelog and submission files. | [auto] static + validation |
| R13.2 | MIT license with attribution to Evan Zellner. | [manual] LICENSE + metadata |
| R13.3 | Final distribution ZIP with a single top-level `wizard/` directory. | [auto] `scripts/build-release.sh` |
| R13.4 | The ZIP installs and serves the API on Bludit Community **and** Pro. | [auto] `scripts/verify-release-zip.sh` |
| R13.5 | SHA-256 checksum published alongside the ZIP. | [auto] `dist/*.sha256` |
| R13.6 | Public README, changelog, installation guide and release notes. | [manual] `docs/` review |
| R13.7 | Repository item/author metadata matches the official templates exactly. | [auto] template key comparison |
| R13.8 | No publish/deploy/PR without owner authorization. | [manual] |

### 14. Naming, history and public positioning

| # | Requirement | Verification |
|---|-------------|--------------|
| R14.1 | The product/release name is **Bludit Wizard**; "PHP" is not used as a product name. | [auto] repo-wide naming scan |
| R14.2 | The three implementations are named distinctly (Plugin, MCP, Custom GPT). | [manual] docs review |
| R14.3 | The original Custom GPT is preserved as permanent history with authentic, credential-free assets. | [auto] asset scan + [manual] review |
| R14.4 | The plugin is not presented as requiring the MCP service or the Custom GPT. | [manual] docs review |
| R14.5 | Credit to Evan Zellner / @gitdamnit is present. | [auto] grep |

### 15. SSRF hardening: DNS timeout, fail-closed pinning, private-network (1.0.6)

| # | Requirement | Verification |
|---|-------------|--------------|
| R15.1 | Hostname resolution is bounded by an explicit wall-clock deadline (not PHP's blocking resolver). | [auto] unit: black-hole resolver bounded; integration: resolv.conf swap |
| R15.2 | A failed or timed-out lookup fails closed (request refused). | [auto] unit + integration |
| R15.3 | Hostname requests fail closed when `CURLOPT_RESOLVE` is unavailable (no unpinned fallback). | [auto] unit (`resolveEntries` with pinning unavailable) + static |
| R15.4 | Every resolved address is screened; mixed public/private answers are refused. | [auto] unit |
| R15.5 | The connected peer address is verified against the verified set. | [auto] static + code |
| R15.6 | Alternate IPv4 encodings, IPv4-mapped IPv6, NAT64, 6to4 and Teredo are refused. | [auto] unit + integration |
| R15.7 | Cloud metadata (IP and hostname, IPv4 and IPv6) is refused even with private-network access enabled. | [auto] unit + integration |
| R15.8 | Loopback (local Ollama) keeps working by default; LAN access requires an explicit, persisted administrator opt-in. | [auto] unit + integration |
| R15.9 | TLS verification stays on and redirects stay disabled. | [auto] static |

### Non-goals

- The plugin does not replace Bludit's own authentication or security controls.
- Deletion available to the AI is a **policy decision** owned by the operator
  (see `DECISION_LOG.md`); the code supports it, so it must be configured
  deliberately.

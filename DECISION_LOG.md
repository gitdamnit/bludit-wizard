# Decision Log

## How to Use This Log

This is the authoritative record of decisions that are expensive to reverse.
New records are appended under **Decisions** with a four-digit id (`D-NNNN`) and
the fields `Date`, `Status`, `Context`, `Alternatives Considered`, `Decision`,
`Rationale` and `Consequences`. Past records are never edited or deleted; a
changed decision is recorded as a new, superseding entry.

Records written before this log adopted the ProDoc Guard schema use free-form
prose and keep their original three-digit ids. They are preserved verbatim under
**Historical Decision Records (retained)** and are intentionally not re-parsed.

## Decisions

### D-0038 — Bludit Wizard must not delete pages

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The dashboard exposed a "Delete selected page" button that really deleted pages, and the plugin also exposed `DELETE /api/wizard/pages/{key}` gated by an opt-in setting. Live testing confirmed the button deleted content. The product is a writing/analysis assistant, not a deletion interface.
- **Alternatives Considered:** (a) Keep deletion behind the existing opt-in; (b) keep only the API deletion; (c) remove deletion entirely and direct users to Bludit's native Content screen.
- **Decision:** Remove every Wizard deletion capability: the button, its JavaScript handler, the `delete_page` admin action, the `DELETE` API route, and the `allowApiDelete` setting. `DELETE` now returns `405 deletion_not_supported` and never changes the site. Bludit's native Content-screen deletion is unchanged.
- **Rationale:** A publishing companion should not be able to destroy content, and an opt-in flag still left a destructive path reachable by external integrations. Removing it eliminates the risk class entirely.
- **Consequences:** Owners delete pages via Bludit itself. Tests assert deletion is absent everywhere; leftover test pages are tolerated instead of cleaned up via the plugin.

### D-0039 — Original/proposed comparison is part of 1.0.6

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The Wizard showed an editable proposal but not the page it would replace, making review weak for existing content.
- **Alternatives Considered:** (a) Defer comparison to v1.1.0; (b) show a single editable form pre-filled with the original; (c) two panels: read-only original and editable proposed.
- **Decision:** For editing tasks, show a read-only **Original** panel (title, slug, description, status, content) beside an editable **Proposed** panel under "Review proposed changes". Desktop uses two columns; narrow screens stack. Raw JSON is an optional technical-details view.
- **Rationale:** Reviewers need to see both states to judge a change; two panels keep the original un-editable and the proposal explicit.
- **Consequences:** The AI response now carries an `original` snapshot; the client renders both panels. Creation tasks show only the proposal.

### D-0040 — Stale edits are refused, not merged

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** A page could change between generating a proposal and pressing Apply, and the write would silently overwrite the newer version.
- **Alternatives Considered:** (a) Last-write-wins; (b) three-way merge; (c) refuse the write when the saved page differs from the reviewed revision.
- **Decision:** The AI response includes a stable page revision. Apply submits `baseRevision`; the server re-reads the page immediately before writing and refuses (`409 stale_page`) if it differs. A missing revision is also refused. Publication status is preserved when no valid type is submitted.
- **Rationale:** Refusal is simple and safe; merging is out of scope and risky. Explicit re-review is the correct operator behaviour.
- **Consequences:** Operators re-run the task after a conflict. The revision is a digest of title, slug, description, type and raw content.

### D-0041 — "Discard suggestion" is client-side only

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Operators need a way to abandon a proposal without touching the page.
- **Alternatives Considered:** (a) A server-side "discard" endpoint; (b) reuse the removed delete action; (c) clear the proposal locally.
- **Decision:** Discard clears the proposal in the browser, confirms first if the proposed fields were edited, and never contacts the server. The primary actions are now **Apply this change** and **Discard suggestion**.
- **Rationale:** Discarding a suggestion is a UI concern, not a data operation; a server call (especially a delete) would add risk for no benefit.
- **Consequences:** No discard endpoint exists to secure. Tests assert the page is unchanged after discarding.

### D-0042 — Product name and subtitle

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Public copy needs a consistent identity.
- **Alternatives Considered:** (a) Keep only "Native AI-assisted content management"; (b) adopt a new product name; (c) keep "Bludit Wizard" and add an approved subtitle.
- **Decision:** The product name is exactly **Bludit Wizard**; the approved subtitle is **Your intelligent Bludit publishing companion.** The installed `wizard/` directory, plugin class, API paths and repository are not renamed.
- **Rationale:** Stability for existing installs and the submission, with clearer public positioning.
- **Consequences:** Dashboard hero, README and release documentation carry the subtitle.

### D-0043 — The v1.1.0 task menu is documentation-only in RC2

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** An expanded task menu was approved but must not be built during the RC2 stabilisation.
- **Alternatives Considered:** (a) Implement the new tasks now; (b) defer the whole menu; (c) record the exact specification now and implement in v1.1.0.
- **Decision:** Record the exact twelve-task menu (five existing + seven new), four categories, status, contextual action labels and behaviour in `PRODUCT_REQUIREMENTS.md`; implement none of it in RC2.
- **Rationale:** Freezing the specification prevents scope drift while keeping RC2 a stabilisation release.
- **Consequences:** `v1.1.0` is the next feature release. The twelve tasks are total tasks, not twelve additions.

### D-0044 — Contextual action labels replace "Run Wizard" in v1.1.0

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** A single generic "Run Wizard" label does not describe what each task does.
- **Alternatives Considered:** (a) Keep "Run Wizard" for all tasks; (b) use per-task labels as specified.
- **Decision:** In v1.1.0 each task uses its approved primary action label (`Generate Draft`, `Generate Outline`, `Generate Ideas`, `Review Improvements`, `Rewrite Content`, `Adjust Length`, `Proofread Page`, `Analyze Page`, `Generate Metadata`, `Find Link Opportunities`, `Check Content Freshness`, `Ask Wizard`). RC2 keeps "Run Wizard".
- **Rationale:** Contextual labels make the action unambiguous and improve safety.
- **Consequences:** The v1.1.0 UI maps each task to its label; no extra tasks or labels may be invented.

### D-0045 — Implement all twelve tasks in v1.1.0 RC1

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The twelve-task menu was approved and previously documented as v1.1.0 scope; this release implements it rather than continuing 1.0.6 patch releases.
- **Alternatives Considered:** (a) Keep only the five original tasks; (b) implement a subset; (c) implement all twelve now.
- **Decision:** Implement all twelve tasks with the fixed names, four categories and contextual action labels; advance the version to 1.1.0 RC1.
- **Rationale:** The specification is frozen and the tasks share one request/result pipeline, so implementing them together avoids repeated UI churn.
- **Consequences:** The task registry is the single source of truth for labels, guidance, page requirements and result types; tests enumerate exactly twelve tasks.

### D-0046 — Full-width content workspace replaces the sidebar

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** The dashboard had a permanent right sidebar with Site intelligence, AI configuration and Safety model cards, which competed with the content workflow.
- **Alternatives Considered:** (a) Keep the sidebar; (b) collapse it behind a toggle; (c) remove it and use a single full-width workspace.
- **Decision:** Remove the three cards and the permanent sidebar; use one full-width task workspace. Configuration stays in the plugin settings. The dark hero, readable heading and an accurate page count remain.
- **Rationale:** Content is the product; the workspace should dominate the screen.
- **Consequences:** No sidebar markup; the comparison panels use the full width and stack responsively.

### D-0047 — Contextual primary action labels

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** A generic "Run Wizard" button does not describe what a task does.
- **Alternatives Considered:** (a) Keep one generic label; (b) use the approved per-task labels.
- **Decision:** Each task uses its approved action label (Generate Draft, Generate Outline, Generate Ideas, Review Improvements, Rewrite Content, Adjust Length, Proofread Page, Analyze Page, Generate Metadata, Find Link Opportunities, Check Content Freshness, Ask Wizard).
- **Rationale:** The action is unambiguous and safer to operate.
- **Consequences:** The server sends the labels and the client applies them; tests assert all twelve.

### D-0048 — Task-specific guidance and fields

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Users should not need external documentation to understand a task.
- **Alternatives Considered:** (a) One shared instruction; (b) per-task guidance and fields.
- **Decision:** Show a concise explanation under the task selector and use task-specific labels, placeholders and options (tone; expand/shorten with optional notes).
- **Rationale:** Task-appropriate prompts reduce mistakes and improve output.
- **Consequences:** Guidance is part of the task registry and is verified by tests.

### D-0049 — Six reusable result types; audits are read-only

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Twelve tasks would otherwise produce twelve presentation systems, and analysis tasks were being treated like edits.
- **Alternatives Considered:** (a) Per-task rendering; (b) a small set of shared result types.
- **Decision:** Use six types: page draft, page revision, structured audit, metadata proposal, text generation and conversational response. SEO + clarity, internal links and freshness are structured audits with **no Apply action**; internal-link targets are validated server-side.
- **Rationale:** Shared types keep behaviour consistent and make "analysis is not a proposal" explicit.
- **Consequences:** Only page draft/revision/metadata proposals can be applied; audits never write.

### D-0050 — Ask Wizard page context is optional

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** Ask Wizard previously shared the page selector and could inherit a previous selection.
- **Alternatives Considered:** (a) Always require a page; (b) always omit page context; (c) optional page, defaulting to none.
- **Decision:** Ask Wizard defaults to "No page — general question"; page content is sent only when a page is explicitly selected.
- **Rationale:** General questions should not leak page content or prior context.
- **Consequences:** Tests assert no page content is sent by default and that an explicit selection is included.

### D-0051 — Strict context isolation between tasks

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** A reported scenario had an outline about mermaids reference a previously selected Unicorns page.
- **Alternatives Considered:** (a) Keep selections across task switches; (b) reset state on task/page change.
- **Decision:** Changing task clears the page selection, instruction, options and any previous result/proposal; changing page clears the proposal; the server ignores page keys for tasks that take no page and sends page content only for the selected page.
- **Rationale:** Context leakage produces incorrect output and unsafe confusion about what will be written.
- **Consequences:** Tests switch among all tasks and assert the upstream payload contains no inherited page.

### D-0052 — Deletion stays excluded; write and network safety preserved

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** v1.1.0 adds many tasks; none may reintroduce destructive or unsafe behaviour.
- **Alternatives Considered:** (a) Allow deletion for some tasks; (b) keep it out entirely.
- **Decision:** No task deletes pages and no delete endpoint/helper is restored. Every write requires explicit approval and a matching revision; CSRF, authorization, escaping and the F-17/F-18/F-19 network hardening remain.
- **Rationale:** Deletion is Bludit's Content-screen responsibility, and the existing safety guarantees are mandatory.
- **Consequences:** Deletion-absence and security suites remain part of the gate.

### D-0053 — Version advances to 1.1.0 RC1

- **Date:** 2026-10-16
- **Status:** Accepted
- **Context:** This is a substantial feature release, not another 1.0.6 patch.
- **Alternatives Considered:** (a) 1.0.6 RC3; (b) 1.1.0 RC1.
- **Decision:** Version metadata and the package are `1.1.0` / `bludit-wizard-1.1.0-rc1.zip`.
- **Rationale:** Semantic versioning should reflect the twelve-task feature set.
- **Consequences:** Prior 1.0.x packages remain untouched; upgrade preserves saved settings.

### D-0054 — RC1 dispatch regression is a release blocker; restore the native action

- **Date:** 2026-10-17
- **Status:** Accepted
- **Context:** v1.1.0 RC1 removed the hidden `action=ai` field that RC2 rendered. Dispatch became dependent on JavaScript. On the maintainer's installation the page rendered twelve tasks but every submission posted natively without `action`, so `adminController()` returned `{"ok":false,"error":"Unknown action."}`.
- **Alternatives Considered:** (a) Ask the maintainer to reinstall RC1 and hard-refresh again; (b) restore the hidden action and add a safe non-AJAX fallback; (c) implement full server-rendered no-JavaScript task execution.
- **Decision:** Restore `<input type="hidden" name="action" value="ai">`. Treat a POST that carries `task` but no `action` as an AI request (CSRF and task validation still apply). The workspace fetch client sends `X-Requested-With: XMLHttpRequest`; a native POST (no header) never runs a task or saves and instead renders the workspace with an actionable recovery notice.
- **Rationale:** A missing or stale script must not turn a valid task into an unexplained raw JSON error, and a native POST must never write content. Full no-JS task execution is outside the approved scope.
- **Consequences:** Unknown/malicious actions are still rejected, writes still require the review flow, and the failure mode is a visible message. Covered by new HTTP and Playwright tests.

### D-0055 — Page selection and the initial action label are server-rendered

- **Date:** 2026-10-17
- **Status:** Accepted
- **Context:** RC1 rendered `#bw-page-wrap` with `hidden` and the button as "Run Wizard"; both depended on `applyTaskUi()` running.
- **Alternatives Considered:** (a) Keep the JS-only reveal; (b) render the selector visible and the first task's action label server-side, then let JavaScript refine task-specific visibility.
- **Decision:** Remove `hidden` from the page wrapper in PHP, render the first task's contextual action label ("Generate Draft"), and keep JavaScript responsible only for switching visibility/labels. Add a `<noscript>` warning.
- **Rationale:** The page remains understandable and safe when initialization fails; the working design is preserved rather than rewritten.
- **Consequences:** A required-page task always exposes its selector; the initial button is never generically "Run Wizard".

### D-0056 — Every plugin asset is versioned; the ZIP ships an asset manifest

- **Date:** 2026-10-17
- **Status:** Accepted
- **Context:** RC1/RC2 emitted unversioned `wizard.js`/`wizard.css`/`settings.js` URLs. The Hostinger CDN serves static files with `Cache-Control: public, max-age=604800`, so an old script could survive an upgrade and break the DOM contract.
- **Alternatives Considered:** (a) Rely on operators to purge caches; (b) append a version query to every asset; (c) add a separate build pipeline.
- **Decision:** Append `?v=<ASSET_VERSION>` to the shared CSS, `wizard.js` and `settings.js` (constant `ASSET_VERSION = 1.1.0-rc2`). The build script generates `wizard/assets.json` with SHA-256 hashes of the shipped runtime files; the release verifier checks it and compares the served JS hash.
- **Rationale:** The URL changes when the release changes, so a browser or CDN cannot silently execute an incompatible script. The manifest makes a partial deployment detectable.
- **Consequences:** Asset URLs are stable within a release and change between releases. No new infrastructure is required.

### D-0057 — The settings page is a protected baseline in RC2

- **Date:** 2026-10-17
- **Status:** Accepted
- **Context:** The maintainer approved the settings page as-is. The regression is confined to the Wizard workspace.
- **Alternatives Considered:** (a) Refactor settings while touching shared assets; (b) leave settings markup, styles and `settings.js` untouched and only version their URLs.
- **Decision:** Do not redesign, reorganise or restyle settings. `wizard/js/settings.js` and settings-specific markup/styles are unchanged; only the asset URL version query differs. Settings regression tests cover controls, presets, discovery, model test, secret handling, persistence and Save/Cancel.
- **Rationale:** A working, approved subsystem must not be collateral damage of a workspace repair.
- **Consequences:** Any future settings change needs its own decision record and evidence.

### D-0058 — Release verification must exercise the installed ZIP and degraded JavaScript

- **Date:** 2026-10-17
- **Status:** Accepted
- **Context:** RC1 passed 408 HTTP checks and 23 UI tests while the deployed page failed, because tests injected `action=ai` manually and ran against matching working-tree assets.
- **Alternatives Considered:** (a) Keep API-only ZIP verification; (b) install the ZIP, open the admin workspace in a browser, and test no-JS/blocked/stale-script paths.
- **Decision:** `scripts/verify-release-zip.sh` now checks the manifest, logs in, verifies the rendered workspace and served JS hash, exercises native and AJAX posts on Community and Pro, and runs a Playwright smoke against the installed ZIP. Playwright adds no-JS, blocked-script, legacy-script and missing-config tests.
- **Rationale:** The gate must reproduce the production failure mode, not only the happy path.
- **Consequences:** Release verification is slower but tests the artifact operators actually install.

### D-0059 — License changes to GPL-3.0-only

- **Date:** 2026-10-18
- **Status:** Accepted
- **Context:** The maintainer selected **GNU General Public License version 3.0 only** for the public release. Earlier releases used MIT (D-008 and the 1.0.5 finalization records); those records remain historical.
- **Alternatives Considered:** (a) Keep MIT; (b) GPL-3.0-or-later; (c) GPL-3.0-only.
- **Decision:** License Bludit Wizard under `GPL-3.0-only`. Replace `LICENSE` with the verbatim official GNU GPL version 3 text, update `metadata.json` to `GPL-3.0-only`, update README/headers/release and directory metadata, and use the same identifier in the Bludit submission.
- **Rationale:** GPLv3 matches the Bludit ecosystem and guarantees downstream freedom; "only" avoids ambiguity about future license versions.
- **Consequences:** The stable artifact and all future distributions are GPL-3.0-only. Historical MIT release notes remain as history, not as the current license. All runtime code is original work by the maintainer; no third-party code is bundled, so no incompatible dependency blocks the change.

### D-0060 — v1.1.0 is the stable public release

- **Date:** 2026-10-18
- **Status:** Accepted
- **Context:** RC2 passed the maintainer's live acceptance testing: all twelve tasks, page selection, settings, OpenRouter and LLM Gateway discovery/testing.
- **Alternatives Considered:** (a) Another release candidate; (b) stable v1.1.0.
- **Decision:** Release v1.1.0 stable from the accepted RC2 implementation with only release metadata, licensing, documentation and asset-version changes. Publish GitHub source, tag `v1.1.0`, attach the installation ZIP, and submit directory metadata with GPL-3.0-only.
- **Rationale:** The runtime is already accepted; further code changes would add risk without user value.
- **Consequences:** The stable artifact must pass the existing gate, including installed-ZIP verification. A directory PR is a submission, not acceptance; the plugin must not be described as officially listed until the listing is visible.

## Historical Decision Records (retained)

Chronological record of decisions made while testing and preparing
Bludit Wizard `1.0.4-rc1` for submission to the Bludit plugin repository.
Nothing here authorises a publish, merge, deployment or pull request.

---

### D-001 — Work only on a copy; never touch production

**Decision.** All testing happens against Bludit 3.22.0 installed in throwaway
Docker containers. The live site, its credentials, and every other project on
this machine are left untouched. The original release ZIPs are treated as
immutable evidence.

**Rationale.** The brief forbids modifying the live website, credentials or any
other project.

---

### D-002 — Baseline first, in git

**Decision.** Initialise a git repository in `Bludit-Wizard/`, extract the RC1
plugin into `wizard/`, and commit it as an immutable baseline before any edit.
Fixes are made on an isolated branch (`fix/1.0.4-rc2`).

**Rationale.** "Establish a baseline before changing anything"; fixes must be
reviewable and separable from the as-shipped release candidate.

---

### D-003 — Isolated environments via Docker Compose

**Decision.** Use one PHP 8.2 + Apache image built from two upstream cores
selected at build time:

| Service | Core | Port | Purpose |
|---------|------|------|---------|
| `community` | Bludit Community 3.22.0 | 8081 | primary target |
| `pro` | Bludit Pro 3.22.0 (build 20260510) | 8082 | Pro compatibility |
| `subdir` | Community served from `/blog` | 8083 | subdirectory install |
| `nokey` | Community, no GPT Action key | 8084 | "not configured" gate |
| `mockai` | Node mock OpenAI provider | 8090 | deterministic AI |

**Rationale.** "Test Bludit Community and Pro 3.22.0 using isolated
environments". The upstream cores are vendored under `testenv/upstream/`
(git-ignored) and fetched by `testenv/fetch-upstream.sh`.

**Note.** The test image raises `error_reporting` to `E_ALL` in its *copy* of the
Bludit core so PHP notices/warnings are captured in the log. `display_errors`
stays off, so JSON responses are unaffected. This is test instrumentation only.

---

### D-004 — Deterministic AI provider instead of a real LLM

**Decision.** All AI calls go to a local mock that speaks the OpenAI
chat-completions protocol. It records every request (so tests can assert the
payload) and can be configured to return success or an error.

**Rationale.** Tests must be reproducible, hermetic, cheap and must never send
site content to a third-party provider. Live AI is therefore out of scope for
automation and is clearly distinguished from simulated results.

---

### D-005 — Install Bludit non-interactively

**Decision.** Install each environment with Bludit's built-in `install.php?demo=true`
(admin / `demo123`), then seed the plugin database directly with a known GPT
Action key.

**Rationale.** Deterministic, scriptable, and avoids inventing credentials for a
real user. The seeded values are obvious test fixtures, not secrets.

---

### D-006 — Test through HTTP and the real browser

**Decision.** Prefer black-box verification: HTTP (Node `fetch`) for the API and
security surface, and Playwright against headless Chromium for the admin UI,
including the preview-before-write flow.

**Rationale.** The defects of interest (CSRF handling, routing, subdirectory
base path) only appear at runtime. Static analysis alone would have missed them.

---

### D-007 — Confirmed defect: admin AJAX is always rejected (CSRF)

**Status: confirmed, fixed on the fix branch.**

Bludit's core rule `bl-kernel/boot/rules/99.security.php` validates the CSRF
token for every admin POST and then **unsets** `$_POST['tokenCSRF']` before the
plugin controller runs. `pluginWizard::isValidCsrf()` re-reads that
already-unset key, so `adminController()` always returned
`403 {"error":"Invalid CSRF token."}` — breaking *Run Wizard*, *Apply*, and
*Delete selected page* in the native UI. Verified in HTTP tests and in the
browser (the JS shows `Error: Invalid CSRF token.`).

Fix: rely on Bludit's core CSRF enforcement (which already guards the route) and
remove the plugin's duplicate check.

---

### D-008 — Confirmed defect: GPT Action API fails in subdirectory installs

**Status: confirmed, fixed on the fix branch.**

`beforeAll()` matched the request path against `/api/wizard` literally. For a
Bludit install in a subdirectory the path is `/blog/api/wizard/...`, so the
plugin never matched and the advertised base URL (`site.url . '/api/wizard'`)
returned Bludit's 404 page.

Fix: strip `HTML_PATH_ROOT` from the request path before matching.

---

### D-009 — Confirmed defect: unbalanced form markup in the admin page

**Status: confirmed, fixed on the fix branch.**

`adminView()` emitted a stray `</form>` (1 opening tag, 2 closing tags), which
is invalid HTML. Removed.

---

### D-010 — Deletion policy is flagged, not unilaterally changed

**Decision.** The AI-facing `DELETE /api/wizard/pages/{key}` endpoint and the
`Delete selected page` control remain in the code. The review file already notes
that omitting DELETE from a Custom GPT schema does **not** disable the server
behaviour. Removing the capability is a product/policy decision for the owner.

**Consequence.** Recorded as a security finding and a submission-checklist item
("decide and document whether AI may delete content"). No change made.

---

### D-011 — No publishing, merging, deploying or submitting without authorisation

**Decision.** This work stops at a tested, documented branch and a local release
candidate. No push to `bludit/plugins-repository`, no deployment, no PR.

**Rationale.** Explicitly required by the brief.

---

### D-012 — New feature on its own branch, RC preserved

**Decision.** Provider validation and model discovery (version `1.0.5`) were
developed on `feature/provider-validation-model-discovery`, branched from the
`1.0.4-rc2` fixes. `master` (the as-shipped RC1 source) and `fix/1.0.4-rc2` are
untouched.

**Rationale.** "Preserve the existing release candidate in a separate branch or
worktree." The RC remains reproducible and reviewable.

---

### D-013 — Reuse the existing HTTP client; add one shared transport

**Decision.** `callProvider()` was refactored onto a single private transport
(`httpJson()`) shared with discovery and the model test. The existing
OpenAI-compatible behaviour, timeouts and payloads are preserved.

**Rationale.** Inspecting the existing client first (requirement 1) showed one
hand-rolled cURL block; sharing it avoids two divergent clients and lets the AI
path inherit the new URL policy. Covered by the pre-existing AI tests, which
still pass.

---

### D-014 — Staged diagnostics, never conflated

**Decision.** Discovery and the model test return a `stages` object with
separate `url`, `network`, `auth`, `catalog` and `inference` results. "Valid
URL", "reachable", "authenticated", "catalog retrieved" and "inference works"
are distinct fields.

**Rationale.** Requirement 9. A 401 proves the URL works but the key does not; a
200 with no `data` proves auth works but the catalog shape is wrong; a `200 /models`
says nothing about whether chat completions succeed.

---

### D-015 — SSRF policy allows self-hosted HTTP, blocks metadata

**Decision.** The URL policy requires HTTPS for public hosts but allows HTTP for
loopback, private-range addresses and single-label intranet names (so Ollama and
other self-hosted gateways work). Link-local/metadata/unspecified addresses
(`169.254.0.0/16`, `fe80::/10`, `0.0.0.0`, `::`), credentialed URLs, non-http(s)
schemes, query strings and fragments are refused. Redirects are disabled;
connect/total timeouts and a response-size cap apply.

**Rationale.** A blanket "HTTPS-only, no private ranges" rule would break the
plugin's documented local-Ollama use case. The remaining risk (an administrator
pointing the plugin at another internal service) requires administrator rights
and explicit configuration, and is recorded in `SECURITY_FINDINGS.md` as F-12.

---

### D-016 — Only successful catalogs are cached; discovery never writes settings

**Decision.** A retrieved catalog is cached as `models.php` (guarded by
`defined('BLUDIT') or die(...)`) under the plugin workspace and embedded only on
the admin settings page. Discovery and the model test never call the settings
save path.

**Rationale.** Requirement 12 ("never clear an existing configured model") and
requirement 13 (no catalogs/keys in logs). Keeping the cache out of `dbFields`
means a failed or partial discovery cannot overwrite saved configuration, and a
huge catalog never bloats the plugin database.

---

### D-017 — Administrator-only provider operations

**Decision.** `discover_models` and `test_model` call `requireAdministrator()`
and return HTTP 403 for any non-admin (including Bludit "editor" users). The
existing Wizard content actions (`ai`, `save_page`, `delete_page`) are unchanged.

**Rationale.** Requirement 11. The plugin admin route is reachable by any
logged-in user, so an explicit role check is required for key-touching actions.
Verified with a real `editor` account.

---

### D-018 — Model names from the provider are treated as untrusted

**Decision.** The dropdown renders provider data with `textContent` only, and the
settings bootstrap JSON is emitted with `JSON_HEX_TAG|AMP|APOS|QUOT`. The
client only transmits the API key when the field differs from the stored value.

**Rationale.** A hostile or compromised provider could return markup in a model
name; requirement 11 (protect keys, safe handling).


---

### D-019 — AI page deletion is off by default; native deletion is administrator-only

**Status: implemented (1.0.5-rc1).**

**Decision.** The GPT-facing `DELETE /api/wizard/pages/{key}` route is refused
(`403`) unless an administrator enables the new `allowApiDelete` setting. The
guard is enforced in both the route dispatch and `gptDeletePage()` (defence in
depth). The native Wizard **Delete selected page** button is retained, but the
`delete_page` controller action now calls `requireAdministrator()`, so a
non-admin (editor) session cannot delete.

**Rationale.** Requirement 2. The previous `confirm=true` gate still allowed an
AI holding the bearer key to delete content; making it opt-in (F-04) removes the
publication-blocking risk while preserving the administrator's confirmed delete.
`allowApiDelete` defaults to `false`, asserted by a static test.

**Consequence.** Owners who want the Custom GPT to delete pages must opt in
explicitly; the README and settings text say so. Editors can still author but
not delete.

---

### D-020 — Private provider hosts require an explicit opt-in; loopback stays allowed

**Status: implemented (1.0.5-rc1).**

**Decision.** `validateProviderUrl()` now denies private/internal hosts
(RFC1918, CGNAT, unique-local, single-label intranet names) by default. Loopback
(`127.0.0.0/8`, `::1`, `localhost`) is always permitted, which keeps a local
Ollama working with no configuration. A trusted LAN provider requires the new
`allowPrivateProviders` setting (default `false`). Cloud metadata hostnames
(`metadata.google.internal`, `instance-data`, `metadata.azure.com`) are always
blocked, in addition to the existing link-local/unspecified address blocks,
credential/query/fragment rejection, disabled redirects, timeouts and size cap.

**Rationale.** Requirement 3 and F-12. The previous policy allowed any private
range or single-label host over HTTP, which is broader than needed: the stated,
legitimate case is loopback (Ollama). Default-deny plus an explicit opt-in keeps
that working without permitting arbitrary internal-network access.

**Verification.** The mock provider is exposed to the test container over
loopback through an Apache reverse proxy, so the *shipped default* policy is
exercised end to end (discovery works via loopback); a separate test proves
private hosts are denied by default and only allowed after the opt-in.

---

### D-021 — Saved secrets are never echoed; blank submissions preserve them

**Status: implemented (1.0.5-rc1).**

**Decision.** The settings form renders the LLM key and GPT Action key as empty
password fields (placeholders only). A `post()` override keeps the stored value
when a key field is submitted blank. A client-side **Generate** button fills a
random GPT Action key so the operator can create one without a server round-trip.

**Rationale.** Requirement 4 and F-06/F-13. Echoing secrets into the page source
is the main exposure; not echoing removes it. Preserving-on-blank avoids the
common failure where saving the form with an empty field wipes working keys. The
trade-off (the GPT key cannot be re-read after saving) is documented and
mitigated by the Generate button.

---

### D-022 — Release work happens on `release/1.0.5-rc1`; RC branches preserved

**Status: done.**

**Decision.** The hardening and packaging work is on branch
`release/1.0.5-rc1`, branched from `feature/provider-validation-model-discovery`.
`master` (as-shipped 1.0.4-rc1) and `fix/1.0.4-rc2` are untouched.

**Rationale.** Requirement: preserve the 1.0.4-rc2 RC and the v1.0.5 feature
branch while preparing the packaged candidate.

---

### D-023 — Package and verify the ZIP from a clean staging directory

**Status: done.**

**Decision.** `scripts/build-release.sh` stages only the shippable plugin files
(`plugin.php`, `metadata.json`, `README.md`, `CHANGELOG.md`, `LICENSE`,
`languages/`, `js/`, `css/`) under a single top-level `wizard/` directory, sets
0644/0755 permissions, and zips to `dist/bludit-wizard-1.0.5-rc1.zip`.
`scripts/verify-release-zip.sh` extracts that archive, lints `plugin.php`, drops
it into a throwaway Bludit container and smoke-tests the API.

**Rationale.** Requirement 5. Tests, Docker files, git metadata and node_modules
must not ship. Verifying the archive (not the working tree) proves the artifact.

---

### D-024 — Submission assets are staged, not submitted

**Status: staged for owner review.**

**Decision.** `submission/` contains the repository author record
(`authors/evan-zellner.json`), the repository item metadata
(`items/bludit-wizard/metadata.json`), an 800×600 `screenshot.png` captured from
the running plugin, a supplementary settings screenshot, and
`SUBMISSION_INSTRUCTIONS.md`. The `download_url`/`information_url`/`email` fields
are placeholders for the owner to confirm.

**Rationale.** Requirement 7. No pull request is opened; the procedure and
placeholders are documented for the owner.

---

### D-025 — Resolve and pin provider hostnames (DNS-rebinding mitigation)

**Status: implemented and tested (1.0.5 final).**

**Context.** The earlier SSRF policy classified the *hostname string* but never
resolved it, so a public-looking name that resolved to an internal address (or a
DNS rebinding/TOCTOU between validation and connection) could still reach an
internal service. This was F-12's documented residual.

**Decision.** Before any provider request, the host is resolved
(`gethostbynamel` for IPv4, `dns_get_record`/`DNS_AAAA` for IPv6) and every
resolved address is checked against the same policy: link-local, metadata,
unspecified and blocked addresses are refused; private/internal addresses are
refused unless `allowPrivateProviders` is enabled; loopback is always allowed.
The request is then **pinned** with `CURLOPT_RESOLVE` to the verified addresses,
so the resolver is not consulted again mid-flight. Applied uniformly to model
discovery, the model test and the AI call path (one shared transport).

**Compatibility.** Public HTTPS providers (OpenAI, OpenRouter, LLM Gateway) and
IP-literal/loopback endpoints are unaffected. A LAN provider still works with the
opt-in.

**Verification.** `discovery` suite: `evil.example.com` (a public-looking alias of
the mock that resolves to a private container address) is refused with a private
message by default; enabling the opt-in changes the failure to a connection/TLS
error (proving the DNS check was the blocker); an unresolvable `.invalid` host
returns a clear "could not resolve" network error; loopback discovery still
succeeds. Static check asserts the resolve-and-pin code is present.

**Residual risk (documented, accepted).** The resolver call is blocking and has
no explicit PHP-level timeout (bounded by the OS resolver); a name that changes
between the resolve and the pinned connect is neutralized by pinning; if the PHP
cURL build lacks `CURLOPT_RESOLVE` the check still runs but the pin is skipped.

---

### D-026 — Version finalized as 1.0.5; changelog consolidated

**Status: done.** `wizard/metadata.json` = `1.0.5` with stable notes; the separate
`1.0.5-rc1` and `1.0.5` changelog sections were merged into one
`## 1.0.5 - 2026-10-15` entry. `plugin.php` user-agent is `BluditWizard/1.0.5`.

---

### D-027 — Public documentation set

**Status: done.** `wizard/README.md` (ships in the plugin) rewritten as a public
README; `docs/INSTALLATION.md` (setup + troubleshooting),
`docs/RELEASE_NOTES_1.0.5.md` and `docs/GITHUB_RELEASE.md` (title, body, tag,
asset, checksum) added. No interface changes.

---

### D-028 — Submission metadata validated against the official templates

**Status: done.** `submission/items/bludit-wizard/metadata.json` and
`submission/authors/evan-zellner.json` were compared key-by-key with
`bludit/plugins-repository` `templates/item.json` and `templates/author.json`:
**no missing or extra keys**, and no `_PLACEHOLDER_` tokens remain. Version
updated to `1.0.5`; `download_url` points at the stable ZIP filename.

---

### D-029 — Remaining owner placeholders

**Status: tracked.** The submission is valid JSON but these values require owner
input before publishing (see the publication checklist): hosting the release ZIP
(`download_url`), the `information_url`, the author `email`, the optional
`demo_url`, and confirmation of the public `author_username` (`evan-zellner`) and
the free price (`price_usd: 0`).

---

### D-030 — Product naming standard

**Status: applied.** The official product and release name is **Bludit Wizard**.
"PHP" is an implementation language and is **not** part of the product name. The
three distinct implementations are named consistently:

- **Bludit Wizard** — the product / release name.
- **Bludit Wizard Plugin** — the native Bludit plugin published to the directory.
- **Bludit Wizard MCP** — the separate universal MCP integration (independent).
- **Bludit Wizard Custom GPT** — the original ChatGPT integration (historical).

Existing source directories, Git branches, package identifiers and filenames were
left unchanged; this was a documentation/terminology pass only. References such
as `plugin.php` were not renamed.

---

### D-031 — GitHub handle credited

**Status: applied.** `submission/authors/evan-zellner.json` now carries
`"github": "https://github.com/gitdamnit"` (matching the repository's author-file
convention of a full URL). The README, release notes and historical showcase
credit **Evan Zellner — @gitdamnit**.

---

### D-032 — The Custom GPT is preserved as permanent history

**Status: done.** `docs/history/CUSTOM_GPT_LEGACY.md` documents the origin story,
the original capabilities, the OpenAPI Actions architecture and bearer
authentication, the review-before-write workflow, the evolution into the native
plugin and the separate MCP effort, and what survives today.

Authentic assets are preserved in `docs/history/assets/`:
`gpt-action-openapi-20261013-222016.yaml` (schema v1, includes delete),
`gpt-action-openapi-20261013-223049.yaml` (schema v2, delete removed), and a
cropped preview image `bludit-wizard-gpt-preview.png`.

Both schemas were scanned for credentials and contain none (only `bearerAuth` and
the `bearerFormat: GPTActionAPIKey` placeholder). The original session
**screenshots were deliberately not copied** into the repository because they
include personal browser context and an old disposable host domain; they are
referenced by archive path and filename instead, and the missing standalone
artwork/instructions files are marked missing rather than recreated.

The narrative avoids claiming a world-first (it describes what the author
personally found) and does not state that the MCP has replaced the Custom GPT.

---

### D-033 — Compatibility confirmed; release recommendation

**Status: owner decision recorded.** Bludit **Community 3.22.0** and Bludit
**Pro 3.22.0** are both confirmed working (automated suites run against both; the
packaged ZIP installs and serves the API on both). Live acceptance testing was
performed on **Hostinger running Bludit Pro** against **LLM Gateway**. Community
compatibility is **not** an outstanding blocker.

**Recommendation:** ship **Bludit Wizard 1.0.5 stable.** No open
publication-blocking security issue remains; the residual risks (blocking DNS
lookup without an explicit PHP timeout; a cURL build lacking `CURLOPT_RESOLVE`)
are documented and do not block release. Publishing still requires the owner to
host the ZIP, fill the metadata placeholders, and explicitly authorize the
release/PR.

---

### D-034 — Bounded DNS resolution (Issue 1)

**Status: implemented and tested.**

**Root cause.** Hostname resolution used PHP's `gethostbynamel()` / `dns_get_record()`,
which are blocking and have no per-call timeout. A slow or unresponsive resolver
could hang the administrator request. PHP has no supported mechanism to
interrupt those calls, so increasing `default_socket_timeout` would not help.

**Decision.** Replaced them with a small dependency-free UDP DNS client
(`BluditWizardNetPolicy::resolveHost`/`dnsQuery`) that enforces a wall-clock
deadline via `stream_select()`, shared across nameservers and the A/AAAA
queries. Nameservers are read from `/etc/resolv.conf`. The budget defaults to
4 s and can be tuned with the optional `BLUDIT_WIZARD_DNS_TIMEOUT` constant.
A lookup that times out (or returns nothing) fails closed; the request is
refused rather than sent to an unverified address.

**Residual.** The lookup itself is now bounded, but the client is a minimal
implementation: it does not retry over TCP on truncation and does not implement
EDNS. A resolver that never answers is bounded by the budget; a resolver that
answers with a truncated response may yield no addresses (fails closed).

---

### D-035 — Fail-closed connection pinning and peer verification (Issue 2)

**Status: implemented and tested.**

**Root cause.** When `CURLOPT_RESOLVE` was unavailable the previous code still
sent the request unpinned, and it only screened the addresses PHP happened to
return — the connection itself was never verified.

**Decision.**
- Hostname requests now **fail closed** when `CURLOPT_RESOLVE` is not defined:
  the request is refused with a clear message instead of falling back.
- Every resolved address is screened by the policy before the request.
- The request is pinned to the verified addresses.
- The transport additionally verifies the address it actually connected to
  (`CURLINFO_PRIMARY_IP`) and discards the response on a mismatch.
- IP literal hosts (including numeric encodings) are re-screened and their peer
  address verified too, so they cannot dodge the check.

TLS certificate and hostname verification remain enabled and redirects remain
disabled.

**Residual.** Very old cURL builds without `CURLOPT_RESOLVE` cannot use
hostname providers at all (by design). IP-literal and loopback providers still
work, since they need no pinning.

---

### D-036 — Private-network opt-in hardened (Issue 3)

**Status: implemented and tested.**

**Root cause.** Private-network access was an opt-in, but the policy could be
dodged through alternate IPv4 encodings, IPv4-mapped IPv6, NAT64/6to4/Teredo,
and could still reach cloud metadata endpoints when the opt-in was enabled.

**Decision.**
- Alternate IPv4 encodings (decimal, octal, hexadecimal, short forms) are
  normalised before classification, and the URL is rewritten to the canonical
  literal so the connection target equals the screened address.
- IPv4-mapped IPv6 (`::ffff:`) is unwrapped to IPv4; NAT64 (`64:ff9b::/96`,
  `64:ff9b:1::/48`), 6to4 (`2002::/16`), Teredo (`2001::/32`), documentation,
  multicast, reserved and unspecified ranges are refused.
- Cloud metadata (hostnames and addresses, including AWS IPv6 `fd00:ec2::254`,
  ECS `169.254.170.2`, Alibaba `100.100.100.200`, Oracle `192.0.0.192`) is
  **always refused, even when private-network access is enabled**.
- Loopback (127.0.0.0/8, ::1, localhost) remains allowed by default so local
  Ollama keeps working; a trusted LAN provider still requires the explicit
  administrator opt-in, which persists across requests.

**Residual (accepted, documented).** With the opt-in enabled an administrator can
reach private services on the configured host; that is the intended behaviour and
is surfaced in the settings help text. Enabling it is an informed decision.

---

### D-037 — Hardening isolated on its own branch and artifact

**Status: done.** Work is on `security/1.0.6-ssrf-hardening`. The validated
`dist/bludit-wizard-1.0.5.zip` (SHA-256 `e70dc894…`) and
`dist/bludit-wizard-1.0.5-rc1.zip` are untouched. The hardened build is
`1.0.6-rc1` (`dist/bludit-wizard-1.0.6-rc1.zip`) so the earlier tested package is
never misrepresented as containing these changes.

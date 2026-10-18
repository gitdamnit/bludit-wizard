# Changelog

All notable changes to **Bludit Wizard** are documented here.
Format inspired by *Keep a Changelog*; versions follow Semantic Versioning.

## 1.1.0 - 2026-10-18 (stable release)

### Added
- **Twelve guided tasks** in four categories:
  - Write & Create: Create a New Page (Generate Draft), Create an Outline
    (Generate Outline), Generate Article Ideas (Generate Ideas).
  - Edit & Improve: Improve an Existing Page (Review Improvements), Rewrite Tone
    or Style (Rewrite Content), Expand or Shorten Content (Adjust Length),
    Proofread Content (Proofread Page).
  - SEO & Quality: SEO + Clarity Audit (Analyze Page), Generate SEO Metadata
    (Generate Metadata), Suggest Internal Links (Find Link Opportunities), Audit
    Content Freshness (Check Content Freshness).
  - Ask Wizard: contextual questions with optional page selection.
- Contextual task guidance, prompts, placeholders and task-specific controls.
- Existing-page selection for every task that needs it.
- Full-width content workspace with original/proposed comparison.
- Read-only audits for SEO/clarity, internal links and content freshness.
- Internal-link target validation against the real page index.
- Optional free-model and tool-support filters in model discovery.
- `assets.json` in release packages for deployment hash verification.

### Changed
- Every plugin asset URL is versioned (`?v=1.1.0`).
- Release verification now exercises the installed ZIP's admin workspace and
  degraded-JavaScript paths.
- **License changed to GPL-3.0-only.** `LICENSE` contains the official GNU GPL
  version 3 text and `metadata.json` uses the same identifier.

### Fixed
- Restored server-recognised form dispatch so a missing, blocked or cached
  script cannot produce a raw `{"ok":false,"error":"Unknown action."}` response.
- Native form posts fail safely with an actionable notice and never run a task
  or save content.
- Page selector and first task action label are server-rendered.
- Initialization failures are visible and disable the action.
- Asset cache-busting prevents an old client script from running against newer
  markup.

### Preserved
- Approved settings interface, including provider presets, Base URL, model
  discovery, filters, Refresh/Test, both API keys, temperature, max tokens,
  system prompt, private-network toggle and Save/Cancel.
- Human approval before writes, stale-edit protection, CSRF/authorization and
  SSRF hardening.
- No page-deletion capability.

## 1.1.0-rc2 - 2026-10-17 (release candidate, not yet published)

### Fixed
- **Restored the server-recognised form dispatch.** The workspace form again
  includes `action=ai`, and a POST carrying `task` without `action` is treated as
  an AI request (CSRF and task validation unchanged). A JavaScript failure can no
  longer produce a raw `{"ok":false,"error":"Unknown action."}` response.
- **Native form posts fail safely.** A browser form POST without
  `X-Requested-With: XMLHttpRequest` never runs a task or saves content; the page
  is re-rendered with an actionable recovery notice. This covers missing,
  blocked, stale and broken JavaScript.
- **Page selector is server-rendered visible.** It is no longer `hidden` in the
  HTML; JavaScript hides it only for tasks that take no page.
- **Initial action label is server-rendered.** The primary button starts as
  "Generate Draft" (the first task) instead of the generic "Run Wizard".
- **Initialization failures are visible.** Missing configuration, unknown tasks
  and initialization exceptions show "Wizard unavailable" and disable the
  action instead of failing silently.

### Changed
- Every plugin asset URL now carries `?v=1.1.0-rc2` (shared CSS, `wizard.js`,
  `settings.js`), matching Bludit's own `?version=` convention.
- Release ZIPs include a generated `wizard/assets.json` manifest with SHA-256
  hashes of the shipped runtime files.
- `scripts/verify-release-zip.sh` now verifies the manifest, logs in, checks the
  rendered workspace and served JavaScript hash, exercises native and AJAX
  posts on Community and Pro, and runs a Playwright smoke against the installed
  ZIP.

### Preserved
- The settings page (provider presets, Base URL, model discovery, filters,
  Refresh/Test, both API keys, temperature, max tokens, system prompt,
  private-network toggle, Save/Cancel) is unchanged; `js/settings.js` and
  settings-specific markup/styles are untouched.
- Twelve tasks, categories, contextual labels, original/proposed review,
  stale-edit protection, read-only audits, internal-link validation, safe
  Markdown, CSRF/authorization, SSRF hardening and the absence of page deletion.

## 1.1.0-rc1 - 2026-10-16 (release candidate, not yet published)

### Added
- **Twelve AI-assisted tasks** in four categories: Write & Create (Create a
  new page · Create an outline · Generate article ideas), Edit & Improve
  (Improve an existing page · Rewrite tone or style · Expand or shorten content ·
  Proofread content), SEO & Quality (SEO + clarity audit · Generate SEO
  metadata · Suggest internal links · Audit content freshness) and General
  (Ask Wizard).
- **Contextual primary actions** per task (Generate Draft, Generate Outline,
  Generate Ideas, Review Improvements, Rewrite Content, Adjust Length,
  Proofread Page, Analyze Page, Generate Metadata, Find Link Opportunities,
  Check Content Freshness, Ask Wizard).
- **Task-specific guidance** shown beneath the task selector, with task-specific
  field labels, placeholders and options (tone, expand/shorten).
- **Full-width content workspace**: the Site intelligence, AI configuration and
  Safety model cards and the permanent right sidebar are removed; the workspace
  is a single column that uses the available width.
- **Six reusable result types**: page draft, page revision, structured audit,
  metadata proposal, text generation and conversational response.
- **Read-only audits** (SEO + clarity, internal links, freshness) with structured
  findings and no Apply action.
- **Server-side internal-link validation** against the real page index.
- **Safe Markdown rendering** using DOM text nodes only.
- **Ask Wizard** with optional page context, defaulting to no page.

### Changed
- Context isolation: changing task or page clears the page selection, the
  instruction and any previous result/proposal, so context cannot leak between
  tasks (for example, an outline cannot inherit a previously selected page).
- The SEO + clarity audit now returns a report instead of a replacement
  title/description, and never modifies the page.
- Generation results move focus to the result region without trapping focus.

### Security
- Page deletion remains removed; all editing tasks keep revision-checked,
  explicitly approved writes.
- The 1.0.6 network hardening (F-17 bounded DNS, F-18 pinned connections,
  F-19 metadata/private-network protections) is unchanged.

## 1.0.6-rc2 - 2026-10-16 (release candidate, not yet published)

### Added
- **Original vs Proposed review.** Editing tasks now show the saved page
  read-only ("Original") beside an editable proposal ("Proposed"), under a
  "Review proposed changes" heading. Desktop uses two columns; narrow screens
  stack. Raw JSON is available only as an optional technical details view.
- **Discard suggestion.** Discards the current proposal locally, with a
  confirmation if the proposed fields were edited. It never contacts the server
  and never changes the page.

### Changed
- Dashboard subtitle: "Your intelligent Bludit publishing companion."
- Improved heading contrast on the dark hero (`#F8FAFC`).

### Removed
- **All Wizard page-deletion capability.** The "Delete selected page" button,
  its JavaScript handler, the `delete_page` admin action and the
  `DELETE /api/wizard/pages/{key}` route are gone. A DELETE request is refused
  with `405` and never deletes. Bludit's native Content-screen deletion is
  unchanged.
- The `allowApiDelete` setting and its toggle.

### Security
- **Stale-edit protection.** Every edit carries the revision the reviewer saw;
  the server re-reads the page immediately before writing and refuses the write
  (`409 stale_page`) if it changed. Publication status is preserved (a missing
  or invalid status keeps the page's existing type).
- The F-17/F-18/F-19 network hardening is unchanged.

## 1.0.6-rc1 - 2026-10-15 (security hardening, not yet published)

### Security
- **Bounded DNS resolution.** Provider hostnames are resolved with an explicit
  UDP DNS client that enforces a wall-clock deadline (`stream_select`) instead of
  PHP's blocking `gethostbynamel`/`dns_get_record`, which have no per-call
  timeout. An unresponsive resolver can no longer hang an administrator request;
  a failed or timed-out lookup fails closed.
- **Fail-closed connection pinning.** When hostname pinning (`CURLOPT_RESOLVE`)
  is unavailable, the request is refused rather than sent unpinned. Resolved
  addresses are screened and the connection is bound to the verified addresses;
  the address actually connected to (`CURLINFO_PRIMARY_IP`) is verified and a
  mismatch is discarded.
- **Alternate-encoding and mapping bypasses closed.** Decimal, octal,
  hexadecimal and short IPv4 encodings are normalised before classification;
  IPv4-mapped IPv6 is unwrapped; NAT64, 6to4, Teredo, documentation, multicast,
  reserved and unspecified ranges are refused.
- **Cloud metadata is always blocked** (`169.254.169.254`, `169.254.170.2`,
  `100.100.100.200`, `192.0.0.192`, `fd00:ec2::254`, metadata hostnames), even
  when private-network provider access is enabled.
- Redirects remain disabled; connect/total timeouts and the response-size cap
  are unchanged.

### Changed
- The network policy (address classification, URL validation, DNS client,
  pinning decisions) now lives in `lib/netpolicy.php` as a dependency-free,
  unit-tested component. No functional change for supported providers: public
  HTTPS endpoints and loopback (local Ollama) continue to work; private-network
  access remains an explicit administrator opt-in.

## 1.0.5 - 2026-10-15

### Added
- Provider validation and live model discovery. The settings page retrieves
  `GET {base_url}/models` with Bearer authentication and populates a searchable
  model picker from the provider's real catalog.
- Provider presets: OpenAI, OpenRouter, LLM Gateway, Ollama (local) and a
  configurable custom OpenAI-compatible provider.
- Parsing of OpenAI-style catalogs (`data[].id`), including optional display
  names, OpenRouter-style pricing and tool metadata, and generic
  `cost`/`capabilities` shapes. Free-model and tool-support filters appear only
  when the provider returns reliable metadata.
- A "Refresh models" action and a low-cost "Test model" action. URL validity,
  reachability, authentication, catalog retrieval and inference are reported as
  separate stages and are never treated as equivalent.
- A client-side **Generate** button that creates a GPT Action key.

### Security
- AI/API page deletion is disabled by default (`allowApiDelete`); the native
  administrator **Delete selected page** button is retained and now requires an
  administrator role.
- Private/internal provider hosts are denied by default; loopback
  (`127.0.0.1`, `localhost`) is always allowed; a trusted LAN provider requires
  the `allowPrivateProviders` opt-in.
- Provider hostnames are resolved and the connection is pinned to the verified
  addresses (DNS-rebinding protection); cloud metadata hostnames and
  link-local, metadata and unspecified addresses are refused.
- Saved API keys are never echoed back into the settings page; blank submissions
  keep the stored value.
- Provider actions are administrator-only and rely on Bludit's core CSRF
  enforcement; HTTPS is required for public hosts; redirects are disabled;
  connect/total timeouts and a response-size cap apply.
- API keys and model catalogs are never written to logs.

### Changed
- The AI request path shares a single transport with discovery and the model
  test, so they apply the same URL policy, timeouts and size cap.
- Cached catalogs are stored in the plugin workspace as a guard-protected file
  and are only embedded on the admin settings page.

### Fixed
- The settings page did not load the plugin stylesheet, leaving the model picker
  and status output unstyled.
- The Wizard hero heading rendered dark-on-dark in the Bludit admin theme.
- Native admin write actions no longer fail with `403 Invalid CSRF token`.
- The GPT Action API no longer returns Bludit's 404 page when Bludit is
  installed in a subdirectory.
- Removed a stray `</form>` tag from the Wizard admin page markup.

## 1.0.4 - 2026-10-15
- Fixed the sidebar admin route to `plugin/pluginwizard`, matching Bludit's
  plugin class route, and the in-page AJAX target and post-action redirect.
- Fixed native admin write actions returning `403 Invalid CSRF token`: Bludit
  removes `tokenCSRF` from `$_POST` after its own validation, so the plugin now
  relies on Bludit's core CSRF enforcement.
- Fixed the GPT Action API returning Bludit's 404 page for subdirectory installs
  (`HTML_PATH_ROOT` is now stripped before matching).
- Removed a stray `</form>` tag. Corrected author, website and copyright
  attribution.

## 1.0.3 - 2026-08-20
- Fixed Custom GPT page creation by temporarily supplying an enabled
  administrator identity to Bludit's core `createPage()` routine, restoring the
  previous session username immediately afterwards.

## 1.0.2 - 2026-08-20
- Added the secure Custom GPT Action API at `/api/wizard`.
- Added a separate GPT Action API key setting.
- Added site/page read, create, update and delete endpoints.
- Added confirmation requirements for updates and deletes.
- Added post-write verification.

## 1.0.1 - 2026-08-20
- Fixed the missing `form()` hook so Bludit renders the plugin settings under
  Settings → Plugins.
- Settings are persisted by Bludit's normal plugin settings mechanism.
- Simplified the Wizard admin sidebar configuration card to link to the real
  plugin settings page.
- Kept the AI endpoint configurable; no invalid model name is hard-coded.

## 1.0.0 - 2026-08-20
- Initial native Bludit Wizard plugin.
- AI task interface.
- OpenAI / Ollama / OpenAI-compatible provider support.
- Site intelligence context.
- Create/update/delete with post-action verification.
- Editable review/apply workflow.

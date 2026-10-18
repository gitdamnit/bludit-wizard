# Bludit Wizard 1.1.0 RC2 — release notes

**Status:** release candidate, not published. Artifact
`dist/bludit-wizard-1.1.0-rc2.zip`.

RC2 repairs the release-blocking regression in RC1. RC1's twelve-task workspace
was correct in source but failed on a real installation: every task returned
`{"ok":false,"error":"Unknown action."}`, the existing-page selector never
appeared, and the primary button stayed "Run Wizard".

## Fixed

- **Server-recognised dispatch restored.** The form again carries `action=ai`.
  A POST with a `task` but no `action` is also treated as an AI request; CSRF and
  task validation are unchanged.
- **Safe failure when JavaScript does not initialize.** A browser-native POST
  (no `X-Requested-With`) never runs a task or saves content. The workspace is
  re-rendered with a recovery notice instead of raw JSON.
- **Page selector rendered visible** in HTML; JavaScript only hides it for tasks
  that take no page.
- **Initial action label rendered server-side** ("Generate Draft"), not the
  generic "Run Wizard".
- **Initialization failures are visible**: missing configuration, unknown tasks
  and exceptions show "Wizard unavailable" and disable the action.

## Changed

- All plugin asset URLs carry `?v=1.1.0-rc2` (shared CSS, `wizard.js`,
  `settings.js`).
- Release ZIPs include `wizard/assets.json` with SHA-256 hashes for deployment
  verification.
- Release verification installs the ZIP, checks the admin workspace and served
  JavaScript hash on Community and Pro, and runs a browser smoke against the
  installed ZIP.

## Unchanged (protected)

- The approved settings page: provider presets, Base URL, model discovery,
  filters, Refresh/Test, both keys, temperature, max tokens, system prompt,
  private-network toggle, Save/Cancel. `js/settings.js` is untouched.
- Twelve tasks and categories, contextual labels, original/proposed review,
  stale-edit protection, read-only audits, internal-link validation, safe
  Markdown, CSRF/authorization, SSRF hardening and the absence of page deletion.

## Upgrade

Replace the **whole** `bl-plugins/wizard/` directory, keep
`bl-content/databases/plugins/wizard/` and `bl-content/workspaces/wizard/`, purge
site/CDN caches and hard-refresh. See `docs/HOSTINGER_ACCEPTANCE_1.1.0_RC2.md`.

# Hostinger Acceptance Test — Bludit Wizard v1.1.0 RC2

Manual validation for the maintainer's disposable **Bludit Pro** site.
Upload only with explicit authorization; this document does not authorize a
deployment.

Artifact: `dist/bludit-wizard-1.1.0-rc2.zip`
SHA-256: record it from `sha256sum` before uploading.

RC2 exists because RC1's workspace failed on a real installation: every task
returned `{"ok":false,"error":"Unknown action."}`, the page selector stayed
hidden and the button stayed "Run Wizard". RC2 restores a server-recognised
dispatch action, renders the selector and first action label server-side, and
versions every asset.

## Before upgrading

1. Back up `bl-plugins/wizard/` and `bl-content/` (or take a Hostinger snapshot).
2. Note the current provider settings and model; they must survive.

## Upgrade (complete replacement — do not merge folders)

1. Delete the contents of `bl-plugins/wizard/` **or** replace the whole
   directory. Do not upload only `plugin.php`: RC1-style partial uploads are the
   failure this release fixes.
2. Extract the RC2 ZIP so the path is `bl-plugins/wizard/plugin.php`.
3. Confirm these files exist:
   - `bl-plugins/wizard/js/wizard.js`
   - `bl-plugins/wizard/js/settings.js`
   - `bl-plugins/wizard/css/wizard.css`
   - `bl-plugins/wizard/lib/netpolicy.php`
   - `bl-plugins/wizard/assets.json`
4. Keep `bl-content/databases/plugins/wizard/db.php` and
   `bl-content/workspaces/wizard/` so settings, keys and the model cache persist.
5. Purge the Hostinger/CDN cache for `/bl-plugins/wizard/` (or the whole site),
   then hard-refresh (`Ctrl/Cmd+Shift+R`).

## Verify what the browser actually loads

Open the site with DevTools → Network, load **Wizard**, and check:

1. `wizard.js?v=1.1.0-rc2` returns **200**, not an old unversioned URL.
2. Console shows no `TypeError` from `wizard.js` and no `Unknown action`.
3. `/bl-plugins/wizard/assets.json` is reachable and its `sha256` for
   `js/wizard.js` matches the served file:

   ```bash
   curl -s https://YOUR-SITE/bl-plugins/wizard/assets.json | python3 -m json.tool
   curl -s https://YOUR-SITE/bl-plugins/wizard/js/wizard.js | sha256sum
   ```

4. `metadata.json` reports version `1.1.0` and the plugin screen shows 1.1.0.

## Acceptance checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Open the plugin dashboard | Workspace loads, no PHP error |
| 2 | Initial button | **Generate Draft** (not "Run Wizard") |
| 3 | Select **Rewrite tone or style** | Page selector appears |
| 4 | Page list | Matches Bludit's real pages with readable titles |
| 5 | Select a disposable test page | Selection is retained |
| 6 | Primary button | **Rewrite Content** |
| 7 | Run the task with a tone | Reaches the AI handler and returns a proposal |
| 8 | Select **SEO + clarity audit** | Selector visible, button **Analyze Page** |
| 9 | Run the audit | Read-only findings; no Apply; page unchanged |
| 10 | Create a new page | Generate Draft proposal; nothing written until **Apply this change** |
| 11 | Apply on a disposable draft | Saved and verified; stale edits refused |
| 12 | Any task with JavaScript blocked/stale | Visible recovery notice, never raw `Unknown action` |
| 13 | Browser console | No plugin initialization errors |
| 14 | Settings page | Unchanged: presets, Base URL, model/discovery, filters, Refresh/Test, keys, temperature, max tokens, system prompt, private-network toggle, Save/Cancel |

## If something fails

- Capture: the loaded `wizard.js` URL, its response status/size, the browser
  console error, and the Network response body for the failing POST.
- Confirm `assets.json` is present and the served JS hash matches.
- If the notice says the interface did not finish loading, the browser is still
  running old or missing JavaScript — purge the cache and re-check the URL
  includes `?v=1.1.0-rc2`.

Do not publish, tag or submit anything without explicit owner authorization.

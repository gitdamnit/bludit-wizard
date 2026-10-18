# Bludit Plugin Repository — Submission Instructions

Everything needed for the first official submission of **Bludit Wizard 1.0.5**
is staged under `submission/`. Nothing has been pushed, published or submitted.

> **Do not open a pull request until the owner approves.** This document is the
> procedure, not an action taken.

## Files produced

| Path | Purpose |
|------|---------|
| `dist/bludit-wizard-1.0.5.zip` | The plugin download (single top-level `wizard/` directory) |
| `submission/items/bludit-wizard/metadata.json` | Repository **item** metadata (website format) |
| `submission/items/bludit-wizard/screenshot.png` | 800×600 plugin screenshot (required) |
| `submission/authors/evan-zellner.json` | Repository **author** record |
| `submission/bludit-wizard-settings.png` | Supplementary settings screenshot (not required) |

Note there are **two different `metadata.json` files**:
- `wizard/metadata.json` — read by Bludit itself (author, version, compatible).
- `submission/items/bludit-wizard/metadata.json` — read by plugins.bludit.com.

## Before submitting — fill the placeholders

`submission/items/bludit-wizard/metadata.json` contains values the owner must
confirm:

| Field | Current value | Action |
|-------|---------------|--------|
| `download_url` | `https://ihopeitoffendsyou.com/downloads/bludit-wizard-1.0.5.zip` | Host the ZIP at a stable URL and update this |
| `information_url` | `https://ihopeitoffendsyou.com/bludit-wizard` | Confirm or change |
| `demo_url` | `""` | Optional |
| `price_usd` | `0` (free) | Set a price if it should be paid |
| `version` / `release_date` | `1.0.5` / `2026-10-15` | Confirm final label |

`submission/authors/evan-zellner.json` — `email` is empty; set a public contact
address (the repository template allows an empty field, but a contact is
recommended).

## Procedure (for the owner, when approved)

The repository is <https://github.com/bludit/plugins-repository>. Read its
`README.md` first; it is the source of truth.

1. **Fork** `bludit/plugins-repository` and clone your fork.
2. Create the author file:
   - copy `submission/authors/evan-zellner.json` to `authors/evan-zellner.json`
     in the fork (filename = lowercase username without spaces).
3. Create the item folder:
   - copy `submission/items/bludit-wizard/` to `items/bludit-wizard/`
     (folder name lowercase, no spaces), containing `metadata.json` and
     `screenshot.png`.
4. Verify JSON validity:
   ```bash
   python3 -m json.tool authors/evan-zellner.json >/dev/null
   python3 -m json.tool items/bludit-wizard/metadata.json >/dev/null
   ```
5. Confirm the screenshot is exactly 800×600 and matches the plugin UI.
6. Commit with a clear message and push to the fork.
7. Open a pull request against `bludit/plugins-repository` describing the plugin
   and linking the `download_url`.

## Do not submit yet

Blocking items are tracked in `reports/BLUDIT_SUBMISSION_CHECKLIST.md`. At
minimum: host the download, confirm the author/URL values, and complete an
operator pass on a disposable real host (the automated results are from isolated
containers).

## Verifying the ZIP before hosting

```bash
scripts/build-release.sh 1.0.5          # rebuild from wizard/
scripts/verify-release-zip.sh               # extract, lint, install, smoke-test
```

`verify-release-zip.sh` starts a throwaway Bludit container, installs the
packaged plugin, and checks the API responds (401 without a key, 200 with one).

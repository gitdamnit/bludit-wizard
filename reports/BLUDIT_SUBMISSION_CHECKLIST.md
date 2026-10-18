# Bludit Directory — Submission Checklist

Preparation for `https://github.com/bludit/plugins-repository` (published at
`https://plugins.bludit.com`).

> **Do not push, merge, deploy or open a pull request without explicit
> authorisation.** This checklist is preparation only.

There are **two different `metadata.json` formats** in play — do not confuse them:

- **Plugin metadata** — `wizard/metadata.json`, read by Bludit itself (author,
  version, compatible).
- **Repository item metadata** — `items/<name>/metadata.json` in the repository,
  used by the plugins website (author_username, price_usd, download_url, …).

## Prepared assets (1.0.5)

| Asset | Path |
|-------|------|
| Distribution ZIP | `dist/bludit-wizard-1.0.6-rc1.zip` (hardened RC; `dist/bludit-wizard-1.0.5.zip` preserved) |
| SHA-256 checksum | `dist/bludit-wizard-1.0.6-rc1.zip.sha256` (`17ef578f…c0abbcba`) |
| Repository item metadata | `submission/items/bludit-wizard/metadata.json` |
| 800×600 screenshot | `submission/items/bludit-wizard/screenshot.png` |
| Author record | `submission/authors/evan-zellner.json` |
| Submission procedure | `submission/SUBMISSION_INSTRUCTIONS.md` |
| GitHub release text | `docs/GITHUB_RELEASE.md` |
| Installation guide | `docs/INSTALLATION.md` |
| Release notes | `docs/RELEASE_NOTES_1.0.5.md` |
| Custom GPT history | `docs/history/CUSTOM_GPT_LEGACY.md` (+ `assets/` schemas & preview) |
| RC1 retained for rollback | `dist/bludit-wizard-1.0.5-rc1.zip` |

### Placeholders requiring owner input

| Field | Current value | Owner action |
|-------|---------------|--------------|
| `download_url` | `https://ihopeitoffendsyou.com/downloads/bludit-wizard-1.0.5.zip` | **Host the ZIP** at a stable public URL and correct this |
| `information_url` | `https://ihopeitoffendsyou.com/bludit-wizard` | Confirm |
| `email` (author) | `""` | Provide a public contact |
| `demo_url` | `""` | Optional |
| `author_username` | `evan-zellner` | Confirm the public username |
| `price_usd` | `0` | Confirm free (or set a price) |


---

## A. Plugin package (what gets downloaded)

| # | Requirement | Status | Notes |
|---|-------------|:------:|-------|
| A1 | Top-level directory named after the plugin (`wizard/`) containing the plugin | ✅ | `wizard/` |
| A2 | `plugin.php` defining `class pluginWizard extends Plugin` | ✅ | passes `php -l` |
| A3 | `metadata.json` with `author`, `version`, `releaseDate`, `license`, `compatible`, `notes` | ✅ | version `1.0.4`, compatible `3.22` |
| A4 | `languages/en.json` with `plugin-data.name` / `description` | ✅ | |
| A5 | `README.md`, `CHANGELOG.md`, `LICENSE` | ✅ | MIT |
| A6 | No hardcoded secrets / credentials | ✅ | static test |
| A7 | No installation of compiled binaries or vendor dumps | ✅ | plain PHP/JS/CSS |
| A8 | Works on a clean Bludit 3.22.0 install | ✅ | isolated Community + Pro |
| A9 | Author attribution correct and owned by the submitter | ⚠️ | **Owner must confirm** `metadata.json` author/website/email before submitting |
| A10 | Version/release date final (rc labels removed) | ⚠️ | rc2 is a candidate; bump/tag before publishing |
| A11 | Produces a distributable ZIP with `wizard/` at the top level | ⚠️ | build step; see below |

**Build the distributable** (no credentials, no live site):

```bash
cd wizard/..  &&  zip -r bludit-wizard-1.0.4.zip wizard \
  -x '*/node_modules/*' -x '*.DS_Store'
```

## B. Repository "author" record

| # | Requirement | Status | Notes |
|---|-------------|:------:|-------|
| B1 | Create `authors/<username>.json` (lowercase, no spaces) from `templates/author.json` | ⬜ | choose the public username |
| B2 | Fill `name`, `email`, `website`, and any social fields | ⬜ | must match the plugin author |
| B3 | Filename uses only lowercase letters/digits/hyphens | ⬜ | e.g. `evan-zellner.json` |

## C. Repository "item" record

| # | Requirement | Status | Notes |
|---|-------------|:------:|-------|
| C1 | Create `items/<plugin-name>/` (lowercase, no spaces) | ⬜ | e.g. `items/bludit-wizard/` |
| C2 | Add `items/bludit-wizard/metadata.json` from `templates/item.json` | ⬜ | |
| C3 | `name`, `version`, `author_username`, `release_date`, `license` | ⬜ | match the plugin |
| C4 | `price_usd`: `0` for free (or the price; `-1` for external/variable) | ⬜ | owner decides free vs paid |
| C5 | `download_url` pointing at the hosted ZIP | ⬜ | needs stable hosting |
| C6 | `demo_url` / `information_url` (optional but recommended) | ⬜ | |
| C7 | `description` + `features` (and translations as desired) | ⬜ | |
| C8 | `screenshot.png` next to `metadata.json`, recommended **800×600** | ⬜ | **must be the plugin UI, not the Bludit logo** |

> The upstream Bludit logo (`bludit.png`) that surfaced during testing is **not**
> a valid screenshot.

## D. Plugin-specific release decisions (owner)

| # | Item | Status | Reference |
|---|------|:------:|-----------|
| D1 | Decide and document the **AI deletion policy** (keep / remove / separate key) | ⬜ | SECURITY_FINDINGS F-04 |
| D2 | Document administrator impersonation for AI-created content | ⬜ | F-05 |
| D3 | Confirm the disclaimer that page/site context is sent to the configured AI endpoint | ✅ | README |
| D4 | Decide whether to hide secrets in the settings form | ✅ | done in 1.0.5-rc1 (F-06) |
| D5 | Consider API hardening headers / rate limiting | ⬜ | F-07, F-08 |
| D6 | Confirm licensing (MIT) and that all code is the submitter's to license | ⚠️ | owner/legal |
| D7 | Sign off the SSRF posture: private hosts opt-in, loopback always allowed | ⬜ | F-12 / D-020 |
| D8 | Confirm `1.0.5` version label and changelog before publishing | ⬜ | metadata.json |
| D9 | Decide the AI deletion policy (now off by default, opt-in available) | ⬜ | F-04 / D-019 |

## E. Verification before submitting

| # | Item | Status |
|---|------|:------:|
| E1 | Automated suite green: `tests/run-all.sh` → 236/236 (HTTP) + 15/15 (UI) | ✅ |
| E1b | Release ZIP builds and installs on Community **and** Pro: `scripts/build-release.sh`, `scripts/verify-release-zip.sh` | ✅ |
| E1c | Submission metadata key-match vs official templates | ✅ |
| E2 | Operator pass on a **disposable real host** (not just containers) | ⬜ |
| E3 | Sidebar link, Run Wizard, Apply, Delete verified by hand | ⬜ |
| E4 | Custom GPT read/list/get/create/update against a **test** site | ⬜ |
| E5 | Subdirectory install (if targeting one) verified | ⬜ |
| E6 | Backup of the production plugin/site taken before any real deploy | ⬜ |
| E7 | Explicit approval to publish | ⬜ |

## E2. Release recommendation

**Recommend shipping Bludit Wizard 1.0.5 stable.** No publication-blocking
security issue remains: API deletion is off by default, native deletion is
administrator-only, private providers are off by default (loopback allowed),
provider hostnames are resolved and pinned, secrets are never echoed, and CSRF is
enforced by Bludit core. Community and Pro are both confirmed; the live
Hostinger/LLM Gateway acceptance test passed. Remaining residual risks are
documented (blocking DNS lookup with no explicit PHP timeout; a cURL build
lacking `CURLOPT_RESOLVE`) and are non-blocking. Credit: Evan Zellner /
[@gitdamnit](https://github.com/gitdamnit).

## F. Hard stop conditions
- Do **not** modify the live website, its credentials, or other projects.
- Do **not** submit a ZIP that contains `.git`, `node_modules`, test fixtures,
  or seeded key files.
- Do **not** open a pull request to `bludit/plugins-repository` until E7 is met.

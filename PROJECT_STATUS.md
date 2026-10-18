# Project Status

## Current Phase

In Progress

## Repository State

<!-- Machine-maintained by `prodoc update`. Do not hand-edit. -->
<!-- prodoc:observed:start -->
<!-- Observed from Git metadata only, by `prodoc update`. This block is not evidence that the implementation or its tests are correct; record that under `## Verification Evidence`. -->
- **Observed branch:** public-main
- **Observed commit:** 88023947ecdea297f94b3deb9756a75c1d0105f2
- **Observed working tree:** dirty
- **Observed at:** 2026-10-18T03:25:27Z
<!-- prodoc:observed:end -->

## Verification Evidence

- **Verification:** commit `5849325` — stable v1.1.0 gate: 441/441 HTTP/API/security/task checks, 33/33 Playwright on Community and Pro, 98/98 network-policy assertions, installed-ZIP verification on Community + Pro (3/3 browser smoke); artifact SHA-256 `51bfcb43c41412f30d9e68c7e99c54bc0a29213527ec9c32c53d92cc97632491` — evidence `reports/raw/results-1.1.0.json`, `reports/raw/playwright-1.1.0.json`, `reports/raw/playwright-1.1.0-pro.json`, `dist/bludit-wizard-1.1.0.zip`
- **Verification:** commit `71f2c2c` — RC2 runtime repair: 440/440 HTTP/API/security/task checks, 33/33 Playwright on Community and Pro, 98/98 network-policy assertions — evidence `reports/raw/results-1.1.0-rc2.json`, `reports/raw/playwright-1.1.0-rc2.json`, `reports/raw/playwright-1.1.0-rc2-pro.json`
- **Maintainer acceptance (reported 2026-10-18, not re-run by the release operator):** all twelve tasks, page selection, contextual actions, settings, OpenRouter and LLM Gateway model discovery/testing, free-model filtering and provider testing passed live testing on a disposable Hostinger Bludit installation.
- **Verification:** commit `171c997` — RC1 was rejected after the deployment regression (form dispatch removed; stale client assets). Historical evidence preserved: `reports/raw/results-1.1.0-rc1.json`, `docs/HOSTINGER_ACCEPTANCE_1.1.0_RC1.md`.

## Completed Work

- [Tested] Stable v1.1.0 runtime preserves the accepted RC2 behavior, settings page and twelve tasks — `reports/raw/results-1.1.0.json`, `dist/bludit-wizard-1.1.0.zip`
- [Tested] GPL-3.0-only applied to LICENSE, plugin metadata, README, headers and directory metadata — `wizard/LICENSE`, `wizard/metadata.json`, `tests/runner.mjs`
- [Tested] Public README lists all twelve tasks in four categories, provider compatibility, safety and troubleshooting — `README.md`, `wizard/README.md`
- [Tested] Stable ZIP built and verified (manifest, served JS hash, native/AJAX dispatch, Community + Pro, installed-ZIP browser smoke) — `dist/bludit-wizard-1.1.0.zip`, `scripts/verify-release-zip.sh`
- [Tested] Release notes, installation guide, changelog and submission metadata updated for 1.1.0 — `docs/RELEASE_NOTES_1.1.0.md`, `wizard/CHANGELOG.md`, `submission/items/bludit-wizard/metadata.json`
- [Published] GitHub repository, tag `v1.1.0` and release with the installation ZIP — `https://github.com/gitdamnit/bludit-wizard/releases/tag/v1.1.0`
- [Implemented] Official Bludit plugins-repository PR opened — `https://github.com/bludit/plugins-repository/pull/489` (acceptance pending)
- [Removed] Wizard page-deletion capability remains absent — `tests/runner.mjs`

## Tests

| Suite | Command | Result | Evidence |
|-------|---------|--------|----------|
| HTTP/API/security/task harness | `tests/run-all.sh 1.1.0` | Pass (441) | `reports/raw/results-1.1.0.json` |
| Playwright UI (Community) | `tests/e2e/run.sh community` | Pass (33) | `reports/raw/playwright-1.1.0.json` |
| Playwright UI (Pro) | `tests/e2e/run.sh pro` | Pass (33) | `reports/raw/playwright-1.1.0-pro.json` |
| Network-policy unit | `php tests/php/netpolicy_test.php` | Pass (98) | `reports/TEST_REPORT.md` |
| Stable ZIP + admin UI | `scripts/verify-release-zip.sh dist/bludit-wizard-1.1.0.zip` | Pass (Community + Pro) | `dist/bludit-wizard-1.1.0.zip` |
| Maintainer live acceptance | manual (reported) | Pass | maintainer report, 2026-10-18 |
| Hostinger RC2 acceptance | manual | Pass (reported) | `docs/HOSTINGER_ACCEPTANCE_1.1.0_RC2.md` |

## Known Defects

- **RC1 (historical, fixed in RC2/1.1.0):** the workspace form lost its hidden
  `action=ai` field; a JavaScript or stale-asset failure produced
  `{"ok":false,"error":"Unknown action."}` and left the page selector hidden and
  the button generic. RC1 must not be deployed.
- No release-blocking defect is known in the stable v1.1.0 runtime. Accepted
  residual risks: the DNS client is minimal (no EDNS/TCP fallback; truncation
  fails closed); enabling the private-network opt-in intentionally allows
  trusted internal providers; cURL builds without `CURLOPT_RESOLVE` cannot use
  hostname providers (by design); Markdown rendering is a deliberately safe
  subset.

## Blockers

- Bludit directory acceptance is external. PR #489 is submitted but **not
  accepted**; the plugin must not be described as officially listed until the
  listing is visible in the directory.

## Next Actions

1. Monitor Bludit PR #489 and respond to maintainer feedback.
2. If the directory requires metadata changes, update the fork branch and the
   staged files under `submission/`.
3. Do not publish a new release or change the license without owner approval.

## Release Status

**1.1.0 stable published on GitHub; Bludit directory PR submitted.**

- **Artifact:** `dist/bludit-wizard-1.1.0.zip` — 16 files, 63,988 bytes,
  SHA-256 `51bfcb43c41412f30d9e68c7e99c54bc0a29213527ec9c32c53d92cc97632491`
- **Repository:** https://github.com/gitdamnit/bludit-wizard (default branch
  `main`, release commit `8802394`)
- **Tag:** https://github.com/gitdamnit/bludit-wizard/releases/tag/v1.1.0
- **Release:** https://github.com/gitdamnit/bludit-wizard/releases/tag/v1.1.0
- **Download:** https://github.com/gitdamnit/bludit-wizard/releases/download/v1.1.0/bludit-wizard-1.1.0.zip
  (downloaded and re-hashed after publication; matches)
- **Bludit directory:** PR https://github.com/bludit/plugins-repository/pull/489
  — OPEN, not accepted
- **License:** GPL-3.0-only
- The RC2 archive (`dist/bludit-wizard-1.1.0-rc2.zip`) and all prior packages are
  preserved. RC1 remains historical evidence and must not be deployed.

## Project History and Detail (retained)

_Last updated: 2026-10-18_

### Where we are

| Item | State |
|------|-------|
| Repository | `Bludit-Wizard` (git) |
| Baseline | `master` — as-shipped `1.0.4-rc1` (`017681f`) |
| RC2 fixes | `fix/1.0.4-rc2` (`115d273`) — preserved |
| Feature branch | `feature/provider-validation-model-discovery` — preserved |
| RC1 branch | `release/1.0.5-rc1` (`2407c73`) — preserved |
| Stable branch | `release/1.0.5` — preserved (`dist/bludit-wizard-1.0.5.zip`) |
| **Current branch** | **`public-main` / `feature/1.1.0-rc1`** |
| Product | **Bludit Wizard 1.1.0 (stable public release)** |
| Release ZIP | `dist/bludit-wizard-1.1.0.zip` (+ `.sha256`) |
| Submission assets | `submission/` (author, item metadata, screenshot, instructions) |
| Public docs | `wizard/README.md`, `wizard/CHANGELOG.md`, `docs/INSTALLATION.md`, `docs/RELEASE_NOTES_1.0.5.md`, `docs/GITHUB_RELEASE.md` |
| Project history | `docs/history/CUSTOM_GPT_LEGACY.md` + preserved OpenAPI schemas and GPT preview |
| Overall result | **Published on GitHub; Bludit directory PR #489 open (acceptance pending)** |

### Verification results (1.1.0-rc2 regression repair)

| Check | Result |
|-------|--------|
| `tests/runner.mjs` — Community + Pro | **440 / 440 pass** |
| Playwright UI — Community / Pro | **33 / 33**, **33 / 33** |
| Network-policy unit suite | **98 / 98 pass** |
| RC2 ZIP install + admin UI (Community + Pro) | **PASS** |
| Playwright smoke against installed Community ZIP | **3 / 3 pass** |

Evidence: `reports/raw/results-1.1.0-rc2.json`,
`reports/raw/playwright-1.1.0-rc2.json`,
`reports/raw/playwright-1.1.0-rc2-pro.json`, `reports/TEST_REPORT.md`.

### Verification results (1.0.6-rc1 hardening)

| Check | Result |
|-------|--------|
| Network-policy unit suite (`tests/php/netpolicy_test.php`) | **98 / 98 pass** |
| `tests/runner.mjs` — Community + Pro | **273 / 273 pass** |
| Playwright UI | **15 / 15 pass** |
| Hardened ZIP install on Community + Pro | **PASS** (401/200/delete-off 403) |

By category (HTTP suite): static 37, php-static 6, php-lint 4, netpolicy 2,
api 51, security 34, admin 20, discovery 88, provider 8, provider-test 10,
provider-security 12, subdir 1.
Evidence: `reports/raw/results-1.0.6-rc1.json`, `reports/raw/playwright-1.0.6-rc1.json`.

### The three prior residual risks

| ID | Topic | Status |
|----|-------|--------|
| F-17 | DNS resolution had no timeout | **FIXED** — bounded UDP resolver (4 s budget), fails closed |
| F-18 | Pinning skipped when `CURLOPT_RESOLVE` unavailable | **FIXED** — fail closed + peer-address verification |
| F-19 | Private-network opt-in bypass / metadata reachable | **FIXED** — encodings normalised, mapped/NAT64/6to4/Teredo blocked, metadata always refused |

Details in `reports/SECURITY_FINDINGS.md`; decisions D-034…D-037.

### Verification results (1.0.5 stable — preserved for reference)

| Check | Result |
|-------|--------|
| `tests/runner.mjs` — Community + Pro | 236 / 236 pass |
| Playwright UI | 15 / 15 pass |
| ZIP install on Community / Pro | PASS (401/200/403) |
| Submission metadata vs official templates | exact key match |
| Live Hostinger acceptance (Bludit Pro 3.22.0, LLM Gateway) | PASS (298 models, inference, Ask the Wizard) |

### Hardened release artifact (1.0.6-rc1)

- `dist/bludit-wizard-1.0.6-rc1.zip` — 38,902 bytes, single top-level `wizard/`
  directory, 15 files (adds `lib/netpolicy.php`).
- SHA-256: `17ef578ffd9b417d15431202d5c7e3c5a0ec2279698c9d87c435234ac0abbcba`
- Checksum file: `dist/bludit-wizard-1.0.6-rc1.zip.sha256`
- The 1.0.5 packages (`dist/bludit-wizard-1.0.5.zip`, `…1.0.5-rc1.zip`) are
  **untouched**.

### What 1.0.6-rc1 adds (SSRF hardening)

- Bounded DNS resolution with an explicit deadline; lookup failures fail closed.
- Fail-closed connection pinning (no unpinned fallback) plus connected-peer
  verification.
- Alternate-encoding / IPv4-mapped IPv6 / NAT64 / 6to4 / Teredo bypasses closed;
  cloud metadata always refused, even with private-network access enabled.
- Loopback (local Ollama) preserved; private-network access remains an explicit
  administrator opt-in.
- Policy extracted to `lib/netpolicy.php` (dependency-free, unit-tested).

### What 1.0.5 contains

- Provider validation and live model discovery (searchable picker, presets,
  staged diagnostics, filters) — from the 1.0.5 feature work.
- Security hardening: AI deletion off by default; private providers off by
  default (loopback allowed); **DNS resolve-and-pin** mitigation; saved keys never
  echoed; admin-only provider actions.
- Carried fixes: CSRF handling, subdirectory API path, admin markup, hero
  contrast, settings stylesheet.

### Product naming and history

- Official product/release name: **Bludit Wizard** ("PHP" is an implementation
  detail, never part of the name). Implementations are named **Bludit Wizard
  Plugin**, **Bludit Wizard MCP** and **Bludit Wizard Custom GPT**.
- The original **Bludit Wizard Custom GPT** — the working integration that started
  the project — is preserved permanently in
  [`docs/history/CUSTOM_GPT_LEGACY.md`](docs/history/CUSTOM_GPT_LEGACY.md) with
  authentic OpenAPI schemas and a preview image.
- The plugin is independent of the MCP service and does not require it.
- Credit: Evan Zellner — [@gitdamnit](https://github.com/gitdamnit).

### Release recommendation

The three residual SSRF risks from the 1.0.5 security report are now **fixed and
independently tested** (F-17, F-18, F-19 in `reports/SECURITY_FINDINGS.md`).
**Recommend proceeding to final release validation with the hardened build
(`dist/bludit-wizard-1.0.6-rc1.zip`) rather than the untouched
`1.0.5` package**, so the published artifact includes the DNS, pinning and
private-network hardening. Community and Pro are confirmed; the live Hostinger /
LLM Gateway acceptance for 1.0.5 remains valid for the provider feature set.
Remaining accepted residual risks are documented and non-blocking:
an intentionally-permitted private-network opt-in, a minimal DNS client (no
EDNS/TCP fallback; truncation fails closed), and cURL builds lacking
`CURLOPT_RESOLVE` being unable to use hostname providers (by design).

The `1.0.5` packages are kept intact for rollback/comparison and are **not**
claimed to contain these changes.

### Remaining owner actions (publication checklist)
1. **Review the three fixes** and confirm the 1.0.6 (or re-tagged 1.0.5) numbering.
2. **Host the ZIP** and set `download_url` in
   `submission/items/bludit-wizard/metadata.json` (and the version field).
3. Provide the **author `email`** and confirm `information_url` / optional `demo_url`.
4. Confirm the public **`author_username`** and that the plugin is **free** (`price_usd: 0`).
5. Optional: create the GitHub release using `docs/GITHUB_RELEASE.md` (update the
   tag/asset/checksum for the hardened build).
6. Open the pull request to `bludit/plugins-repository` using
   `submission/SUBMISSION_INSTRUCTIONS.md`.
7. **Explicit authorization** for any publish/deploy/PR.

### Guardrails honoured

- No production, MCP, Cloudflare or other-project changes; no real API keys or
  live settings touched.
- No publish, push, release, PR or deploy.
- All prior branches and commits preserved.
- AI deletion remains disabled by default; private-network providers remain
  disabled by default except loopback.

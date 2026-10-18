# Bludit Wizard — Security Findings

**Build under test:** `1.0.4-rc1` (baseline) and `1.0.4-rc2` (after fixes)
**Method:** isolated Bludit 3.22.0 installs + HTTP/browser testing + source review
**Date:** 2026-10-15

Severity uses a simple scale: **Critical / High / Medium / Low / Info**.
"Fixed" means the change is on branch `fix/1.0.4-rc2` and covered by a passing
test. "Open" means an owner decision or a follow-up is required.

---

## F-01 — Duplicate CSRF check made every admin write unusable — **Critical** — FIXED

**What.** `pluginWizard::adminController()` validated `$_POST['tokenCSRF']`
itself. Bludit's core rule `bl-kernel/boot/rules/99.security.php` validates the
token for every admin POST and then **unsets** it before the plugin controller
runs. The plugin's `isValidCsrf()` therefore always saw an empty token and
returned `403 Invalid CSRF token`. As a side effect, the plugin's intended
defence-in-depth never actually ran.

**Impact.** Complete functional failure of the native admin feature: *Run
Wizard*, *Apply this change* and *Delete selected page* were inoperable. The
AI-assisted workflow could not be used at all.

**Evidence.**
```
POST /admin/plugin/pluginwizard (valid session + valid token, action=ai)
  before -> 403 {"ok":false,"error":"Invalid CSRF token."}
browser  -> #bw-result-text = "Error: Invalid CSRF token."
```
Source: `admin.php` includes `99.security.php` (which `unset($_POST['tokenCSRF'])`)
before dispatching to `$plugin->adminController()`.

**Resolution.** Removed the duplicate check. Bludit's core rule already enforces
CSRF for the route and redirects to login on failure, so protection is intact.
Covered by `admin AJAX action=ai/save_page/delete_page` tests and three Playwright
tests.

**Residual risk.** None identified. CSRF is still enforced by Bludit core for all
admin POSTs; a test confirms a token-less POST is rejected.

---

## F-02 — GPT Action API unreachable in subdirectory installs — **Medium** — FIXED

**What.** `beforeAll()` compared the request path literally against `/api/wizard`.
For a site installed at `/blog`, the path is `/blog/api/wizard/...`, which never
matched, so the request fell through to Bludit and returned the theme 404 page.
The base URL advertised on the settings page (`site->url() . '/api/wizard'`)
therefore pointed at a 404.

**Impact.** The documented Custom GPT integration silently fails on any
subdirectory installation (a common deployment).

**Evidence.**
```
GET http://localhost:8083/blog/api/wizard/site
  before -> 404 (Bludit "Page not found")
  after  -> 200 {"ok":true,...}
```

**Resolution.** `beforeAll()` now strips `HTML_PATH_ROOT` from the path before
matching. Covered by the `subdir` target test.

**Residual risk.** The literal `/api/wizard` match is unchanged for root installs
(regression test: the trailing-slash and root cases still pass).

---

## F-03 — Unbalanced form markup on the admin page — **Low** — FIXED

**What.** `adminView()` emitted a stray `</form>` (1 `<form>`, 2 `</form>`).

**Impact.** Invalid HTML; harmless in current browsers but sloppy and
potentially confusing for assistive tech or future refactors.

**Resolution.** Removed the stray tag. Covered by the `balanced <form>` test and
the Playwright render test.

---

## F-04 — The AI-facing API could delete pages — **Medium** — FIXED (1.0.5-rc1)

**What.** `DELETE /api/wizard/pages/{key}` deleted any page once the caller held
the GPT Action key and passed `confirm: true`. Removing DELETE from a Custom GPT
schema does **not** disable the server action.

**Impact.** A GPT with the key could irreversibly remove content.

**Evidence (before).** `POST (create) -> 201`, then `DELETE {confirm:true} -> 200
"Page deleted and verified."`

**Resolution (1.0.5-rc1).** Deletion via the API is now disabled by default
(`allowApiDelete=false`). The route returns `403` even with a valid key and
`confirm=true`, and `gptDeletePage()` re-checks the flag (defence in depth). The
native administrator **Delete selected page** button is retained and the
`delete_page` action now requires an administrator role. Owners can opt in
explicitly in the plugin settings. Verified by: default `403` + page persists;
opt-in `200` verified; editor `403`; static assertion that the default is falsy.

---

## F-05 — Administrator impersonation for API-created pages — **Medium** — OPEN (accepted)

**What.** Bludit's `createPage()` reads the author from the session. Because a
GPT Action request has no browser session, `createPageAsAdministrator()` picks the
first *enabled* admin account, sets it in the session for the duration of the
call, then restores the previous value.

**Impact.** Any holder of the GPT Action key can create content attributed to a
real administrator. The impersonation is request-scoped and restored in a
`finally` block, and the route is key-protected, so exposure requires the key.

**Evidence.** Working create test; source review of `createPageAsAdministrator()`.

**Recommendation.** Document the behaviour; consider a dedicated non-login
"wizard service" user, and/or log these creations to the Bludit syslog (they
currently are logged by core `createPage()` under the impersonated admin).

---

## F-06 — LLM and GPT Action keys stored in plaintext — **Low** — MITIGATED (1.0.5-rc1)

**What.** Both keys live in
`bl-content/databases/plugins/wizard/db.php` (a PHP file with the standard
`defined('BLUDIT') or die(...)` guard). Encryption at rest is not provided by
Bludit's plugin model.

**Evidence.**
- Direct HTTP access to the plugin DB returns 404 (Bludit blocks
  `bl-content/databases/...` via rewrite); even if the rewrite were disabled the
  PHP guard stops output.
- Test `wizard page does not contain the LLM API key` passes.

**Impact (after).** The keys remain on disk (unavoidable for a working secret),
but they are no longer exposed through the web UI.

**Mitigation (1.0.5-rc1).** The settings form now renders both key fields empty
(placeholders only) and a `post()` override keeps the stored value when a field
is submitted blank, so keys are never echoed back into the page and cannot be
wiped by an incidental save. A client-side **Generate** button creates a GPT key.

**Remaining recommendation.** Keep `bl-content` non-world-readable, encrypt
backups, and rotate keys if the server is compromised.

---

## F-07 — No rate limiting or lockout on the GPT Action key — **Low** — OPEN

**What.** The API compares the bearer key with `hash_equals()` (constant time)
but imposes no attempt limit or lockout.

**Impact.** Online guessing is impractical for a long random key, but a
short/weak key would not be throttled.

**Recommendation.** Document "use a long random key"; optionally add lightweight
throttling. The README already instructs a long random secret.

---

## F-08 — API responses lack standard hardening headers — **Info** — OPEN

**What.** Responses set `Content-Type` (and `WWW-Authenticate: Bearer` on 401)
but no `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, or HSTS.

**Impact.** Low for a JSON API, but `no-store` is good hygiene for authenticated
responses.

**Recommendation.** Optional: add `X-Content-Type-Options: nosniff` and
`Cache-Control: no-store` in `json()`.

---

## F-09 — The "Provider" selector is cosmetic — **Info** — OPEN

**What.** `provider` is stored but not used in `callProvider()`; the endpoint is
always `{baseUrl}/chat/completions`. Selecting "Ollama" does not change the base
URL or auth.

**Impact.** UX/confusion only. Correct behaviour requires the operator to set the
base URL manually.

**Recommendation.** Have the selector populate a default base URL via JS, or
document clearly (partly documented).

---

## F-10 — Page/site context is sent to the configured AI endpoint — **Info** — ACCEPTED (disclosed)

**What.** `handleAi()` sends site metadata and up to 80 pages of content
(truncated) to whatever `baseUrl` is configured.

**Impact.** Data egress to a third-party provider. This is inherent to the
feature and is disclosed in the plugin README.

**Recommendation.** Keep the disclosure; never point the plugin at an endpoint you
do not trust, and prefer a local/Ollama endpoint for sensitive content.

---

## F-11 — `Authorization` may be stripped by some hosts — **Info** — MITIGATED

**What.** Some shared hosts do not pass the `Authorization` header to PHP.
Handled by accepting `X-Bludit-Wizard-Key` as a fallback; tested and passing.

**Recommendation.** Documented. Owners on affected hosts can use the fallback
header in the GPT Action definition.

---

## 1.0.5 provider-validation & model-discovery findings

### F-12 — SSRF policy permitted private/intranet HTTP hosts — **Medium** — FIXED (1.0.5-rc1)

**What (before).** `validateProviderUrl()` required HTTPS for public hosts but
permitted `http://` for any loopback, RFC1918/private address or single-label
intranet host (for example `http://127.0.0.1:11434` for Ollama, but also
`http://10.0.0.5`, `http://192.168.1.50`, `http://something-internal`).

**Impact.** An administrator (or a coerced administrator) could make the server
issue requests to arbitrary internal services.

**Resolution (1.0.5-rc1).** Private/internal hosts (RFC1918, CGNAT, unique-local,
single-label intranet names) are now **denied by default**. Loopback
(`127.0.0.0/8`, `::1`, `localhost`) is always allowed, preserving local Ollama
with no configuration. A trusted LAN provider requires the new
`allowPrivateProviders` opt-in. Cloud metadata hostnames are always blocked, in
addition to link-local/unspecified addresses, credentialed/query/fragment URLs,
disabled redirects, timeouts and the response-size cap.

**Evidence.** `discovery` tests: private hosts denied by default (`192.168.*`,
`10.*`, `172.16.*`, single-label name); loopback allowed; discovery succeeding
over loopback under the shipped default; opt-in allows then blocks a trusted
intranet host. Static check that the default is falsy.

**Residual (accepted, D-020/D-025).** With the opt-in enabled, a private host is
allowed as before. As of 1.0.5 final the hostname **is** resolved and the
connection is pinned to the verified addresses, so a public name that resolves to
an internal address is refused before connecting and DNS rebinding is
neutralized. Remaining limitations: the resolver call is blocking with no
explicit PHP-level timeout (bounded by the OS resolver), and if the PHP cURL
build lacks `CURLOPT_RESOLVE` the address check still runs but the pin is
skipped.

### F-13 — API key is sent from the browser to the admin endpoint when entered — **Low** — ACCEPTED

**What.** When the administrator types a key and clicks **Refresh models** or
**Test model**, that (unsaved) key is posted to the admin AJAX endpoint so it can
be tested before saving. With the 1.0.5-rc1 change the fields start empty, so the
key is transmitted only when one was actually entered; otherwise the server uses
the saved key. The endpoint is administrator-only, CSRF-protected (Bludit core)
and should be served over HTTPS in production.

**Evidence.** Code review of `currentKeyOverride()`; the key never appears in any
response (discovery secret-hygiene test); settings-page non-echo test.

**Recommendation.** Accepted. A stricter option is to never send the key and
require save-before-test.

### F-14 — Model catalog cached under `bl-content/workspaces` — **Low (accepted)** — OPEN

**What.** A successfully retrieved catalog is cached as
`bl-content/workspaces/wizard/models.php`. The file begins with
`defined('BLUDIT') or die(...)`, so even if served directly (rewrite disabled) it
cannot output its contents; it contains model ids/names/pricing and no secrets.

**Evidence.** `writeModelsCache()`/`readModelsCache()`; cache-surfacing test.

**Recommendation.** Accepted; standard Bludit guidance to keep `bl-content`
non-world-readable still applies.

### F-15 — "Test model" performs a real, billable provider request — **Info** — ACCEPTED

**What.** `test_model` sends one chat completion with `max_tokens: 1`. It is
initiated only by an explicit administrator click.

**Evidence.** `provider-test` verifies `max_tokens === 1` and the request payload.

**Recommendation.** Keep; the cost is negligible and the action is explicit.

### F-16 — Provider-supplied model names are untrusted input — **Info** — MITIGATED

**What.** Model ids/names come from the provider. The settings bootstrap JSON is
emitted with `JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT` and the
dropdown renders every value with `textContent` (never `innerHTML`).

**Evidence.** Static check ("settings.js renders provider data with textContent");
UI tests render a catalog containing `meta-llama/...`.

## Positive controls observed

- Constant-time key comparison (`hash_equals`).
- Bearer required; no key configured → `503` and the API refuses to serve.
- Admin area requires a session; the wizard page is not rendered to anonymous users.
- CSRF enforced by Bludit core for all admin POSTs (a token-less POST is rejected).
- Path traversal in the page key does not read files.
- No permissive CORS header.
- Writes are gated behind explicit `confirm` (API) and an **Apply** click (UI).
- Every mutation is read back and verified before reporting success.

### Added by 1.0.5-rc1

- AI/API page deletion is off by default; the route refuses with 403 and never
  mutates state unless an administrator opts in.
- Native deletion is administrator-only; a non-admin editor gets 403.
- Private/internal provider hosts are denied unless explicitly opted in; loopback
  is always allowed; metadata hostnames are always blocked.
- Saved API keys are never rendered into the settings page and are preserved
  across blank submissions.
- One shared HTTP transport applies the URL policy, timeouts and size cap to
  discovery, the model test and the AI call path.

---

## Release security assessment (Bludit Wizard 1.0.5)

**Recommendation: ship 1.0.5 stable.** No publication-blocking security issue
remains open. Status of the previously open items:

| ID | Topic | Status |
|----|-------|--------|
| F-01 | Admin CSRF handling | Fixed (1.0.4) |
| F-02 | Subdirectory API path | Fixed (1.0.4) |
| F-03 | Admin markup | Fixed (1.0.4) |
| F-04 | AI/API page deletion | **Fixed (1.0.5)** — off by default; native delete admin-only |
| F-05 | Impersonation for API-created pages | Accepted, documented |
| F-06 | Keys stored in plaintext | Mitigated (1.0.5) — never echoed, blank-preserved |
| F-07 | No API rate limiting | Accepted |
| F-08 | Missing hardening headers | Accepted (info) |
| F-09 | Provider selector semantics | Accepted (info) |
| F-10 | Context egress to provider | Accepted, disclosed |
| F-11 | `Authorization` stripped by some hosts | Mitigated (fallback header) |
| F-12 | SSRF private-host / DNS resolution | **Fixed (1.0.5)** — default-deny + resolve-and-pin |
| F-13 | Key sent to admin endpoint when entered | Accepted |
| F-14 | Catalog cache location | Accepted (guarded, no secrets) |
| F-15 | Test-model provider request | Accepted (explicit, minimal) |
| F-16 | Untrusted provider strings | Mitigated (textContent + JSON_HEX) |

### Residual risks requiring owner acknowledgement

1. **Blocking DNS lookup.** Hostname resolution uses PHP's resolver with no
   explicit PHP-level timeout (bounded by the OS resolver). A slow resolver can
   delay a discovery/test/ingest request; connect/total timeouts still cap the
   subsequent HTTP request.
2. **Pin unavailable on very old cURL.** If the PHP cURL build lacks
   `CURLOPT_RESOLVE`, the resolved-address check still runs but the connection is
   not pinned (small TOCTOU window). Modern PHP 8 cURL builds provide it.
3. **Opt-in private networks.** With `allowPrivateProviders` enabled, a private
   host is reachable by administrator choice; loopback is always allowed.

None of these block release. See `DECISION_LOG.md` D-025 and D-033.

---

# 1.0.6 SSRF hardening — the three prior residual risks

Branch `security/1.0.6-ssrf-hardening`. Artifact `dist/bludit-wizard-1.0.6-rc1.zip`.
Policy logic now lives in `wizard/lib/netpolicy.php` (dependency-free, unit-tested).

## F-17 — DNS resolution had no timeout — **FIXED**

**Root cause.** Hostname resolution used PHP's `gethostbynamel()` and
`dns_get_record()`. Both are blocking, have no per-call timeout, and cannot be
interrupted from userland; raising `default_socket_timeout` does not affect them.
A slow or black-holed resolver could hang an administrator request.

**Code changes.**
- New bounded UDP DNS client (`BluditWizardNetPolicy::resolveHost` / `dnsQuery`)
  with a `stream_select()` wall-clock deadline shared across nameservers and the
  A/AAAA queries. Nameservers are read from `/etc/resolv.conf`; the budget
  defaults to 4 s and is tunable via the optional `BLUDIT_WIZARD_DNS_TIMEOUT`
  constant.
- Timeout or empty answer ⇒ fail closed (`resolveHostIps` returns an error and
  the request is refused).
- The blocking functions are no longer used anywhere.

**Regression tests.**
- Unit (`tests/php/netpolicy_test.php`): synthetic DNS responses parse correctly
  (A, AAAA, multiple records, transaction-id mismatch, truncation, name
  encoding); a black-hole resolver (`192.0.2.1`) returns no answers **and is
  bounded** (<2.5 s for a 1.0 s budget, <3.0 s via `resolveHost`).
- Integration (runner `discovery`): the container's `/etc/resolv.conf` is
  swapped to a black-hole nameserver, a discovery is attempted, and the request
  is asserted to be bounded (<12 s), to fail closed, and to report a
  resolve/time-budget error; the resolver configuration is restored afterwards.

**Actual results.** PASS — unit suite 98/98; integration `DNS timeout: request is
bounded and fails closed` PASS (community + pro).

**Residual.** The client is minimal (no TCP retry on truncation, no EDNS). A
truncated answer yields no addresses and fails closed. Documented.

**Status: FIXED** (bounded and fail-closed; residual documented).

## F-18 — Pinning was skipped when `CURLOPT_RESOLVE` was unavailable — **FIXED**

**Root cause.** `prepareHostPinning()` only added `CURLOPT_RESOLVE` entries when
the constant was defined; if it was missing the request proceeded **unpinned**,
and the connection's actual peer address was never checked — so hostname string
validation was standing in for connection-level enforcement.

**Code changes.**
- Hostname requests now **fail closed** when `CURLOPT_RESOLVE` is undefined
  (`prepareHostPinning` returns an explicit refusal; no unpinned fallback).
- Every resolved address is screened by the policy before the request; mixed
  answers containing any refused address abort the request.
- The request is pinned to the verified addresses, and `httpJson()` verifies the
  address actually connected to (`CURLINFO_PRIMARY_IP`) against the verified set,
  discarding the response on mismatch.
- IP-literal hosts (including numeric encodings) are re-screened and their peer
  address verified too.
- TLS peer/host verification stays on; redirects stay disabled.

**Regression tests.**
- Unit: `resolveEntries()` with pinning unavailable ⇒ `ok=false`; metadata and
  empty address lists ⇒ refuse; IPv4/IPv6 entry formatting.
- Static: fail-closed message present; `CURLINFO_PRIMARY_IP` peer check present.
- Integration: `evil.example.com` (public-looking alias resolving to a private
  container address) is refused before connecting; the same request is not
  refused as private once the opt-in is on.

**Actual results.** PASS (unit + static + integration on community + pro).

**Residual.** cURL builds genuinely lacking `CURLOPT_RESOLVE` cannot use
hostname providers at all (by design); IP-literal and loopback providers still
work.

**Status: FIXED.**

## F-19 — Private-network opt-in could be bypassed / reach metadata — **FIXED**

**Root cause.** Private access was an opt-in, but classification operated on the
host string: alternate IPv4 encodings (decimal/octal/hex/short), IPv4-mapped
IPv6, and NAT64/6to4/Teredo could dodge it, and with the opt-in enabled cloud
metadata addresses became reachable.

**Code changes (`wizard/lib/netpolicy.php`).**
- Alternate IPv4 encodings are normalised before classification, and
  `validateProviderUrl` rewrites the URL to the canonical literal so the
  connection target equals the screened address.
- IPv4-mapped IPv6 is unwrapped to IPv4; NAT64 (`64:ff9b::/96`,
  `64:ff9b:1::/48`), 6to4 (`2002::/16`), Teredo (`2001::/32`), documentation,
  multicast, reserved, unspecified and link-local ranges are refused.
- Cloud metadata (hostnames and addresses, IPv4 + IPv6: `169.254.169.254`,
  `169.254.170.2`, `100.100.100.200`, `192.0.0.192`, `fd00:ec2::254`) is
  **always refused, even when private-network access is enabled**.
- Loopback stays allowed by default (local Ollama); a LAN provider still
  requires the explicit, persisted administrator opt-in.

**Regression tests.**
- Unit: classification of IPv4/IPv6 ranges; numeric-encoding normalisation;
  mapped/NAT64/6to4/Teredo/doc/multicast blocked; metadata refused with the
  opt-in enabled; mixed public+metadata refused even with the opt-in.
- Integration: decimal/hex/mapped/metadata/NAT64/6to4 bypass attempts refused;
  metadata stayed refused with the opt-in on; a numeric loopback host is
  normalised and allowed; the opt-in enables a trusted intranet host and can be
  disabled again.

**Actual results.** PASS (unit + integration on community + pro).

**Residual (accepted).** Enabling the opt-in deliberately permits connections to
trusted private services; this is documented in the settings help text and is an
informed administrator decision.

**Status: FIXED** (opt-in remains for self-hosted providers; reserved
destinations are always blocked).

---

## 1.0.6-rc2 security note

- **F-04 superseded and closed.** Page deletion was previously disabled by
  default with an opt-in. In 1.0.6-rc2 **all** Wizard deletion capability was
  removed: the dashboard button, its JavaScript handler, the `delete_page` admin
  action, the `DELETE /api/wizard/pages/{key}` route and the `allowApiDelete`
  setting. Admin and API deletion attempts are refused (`403`/`405`,
  `deletion_not_supported`) and never change the site. Bludit's native Content
  deletion is unchanged.
- **F-17/F-18/F-19 unchanged.** Bounded DNS, fail-closed pinned connections with
  peer verification, and private-network/metadata protections are untouched; the
  98-assertion policy suite and the discovery suite remain green.
- **Stale-edit protection added.** Updates require the revision the reviewer saw;
  the server re-reads the page and refuses (`409`) on any change. This prevents
  silent overwrite of newer content.
- **No new secrets exposure.** Keys remain un-echoed and blank-preserved; the
  review UI renders provider-supplied text with `textContent`.

---

## 1.1.0 RC1 security note

- **No deletion restored.** The dashboard has no delete control; the admin
  `delete_page` action is refused (403) and `DELETE /api/wizard/pages/{key}` is
  refused (405). No delete helper exists.
- **Audits are read-only.** SEO + clarity, internal links and freshness return
  text/structure only; the client shows no Apply for those result types.
- **Internal-link targets are validated server-side** against the real page
  index; invented targets are marked invalid and never rendered as links.
- **Generated HTML is not trusted.** Results are rendered with DOM text nodes;
  a test injects an `<img onerror>` payload and confirms it is inert.
- **Write safety preserved.** Revisions are re-checked immediately before writing
  (409 on conflict); missing revisions are refused; publication status is
  preserved; CSRF, authorization and validation are unchanged.
- **Network hardening preserved.** F-17 (bounded DNS), F-18 (fail-closed pinning
  and peer verification) and F-19 (metadata/private-network protections) are
  untouched; every task uses the same provider/transport layer.
- **Context isolation** prevents one task's page content from appearing in
  another task's upstream request, reducing accidental disclosure.

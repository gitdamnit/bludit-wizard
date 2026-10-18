# Bludit Wizard 1.0.5 — Release Notes

**Release date:** 2026-10-15
**Artifact:** `bludit-wizard-1.0.5.zip`
**License:** MIT · **Author:** Evan Zellner — [@gitdamnit](https://github.com/gitdamnit)
**Compatible with:** Bludit 3.22.x (Community and Pro)

Bludit Wizard is a native AI assistant for the Bludit admin area. It drafts,
improves and audits content with any OpenAI-compatible provider, shows every
change for review before writing, and exposes a bearer-key API for a Custom GPT.

## Highlights

### Live provider validation and model discovery
- The settings page retrieves `GET {base_url}/models` with bearer
  authentication and fills a **searchable model picker** from the real catalog.
- Presets for **OpenAI**, **OpenRouter**, **LLM Gateway** and **Ollama (local)**,
  plus any custom OpenAI-compatible endpoint.
- **Refresh models** and a low-cost **Test model** action.
- URL validity, reachability, authentication, catalog retrieval and inference
  are reported as **separate stages** and never conflated.
- Discovery never changes your saved model; manual entry always works.
- Free-model and tool-support filters appear only when the provider returns
  reliable metadata.

### Security
- **AI page deletion is off by default.** `DELETE /api/wizard/pages/{key}`
  returns `403` unless an administrator explicitly enables it. The native
  **Delete selected page** button remains and requires an administrator role.
- **Private-network providers are off by default.** Loopback
  (`127.0.0.1`, `localhost`) always works; a LAN provider requires an opt-in.
- **DNS-rebinding protection:** provider hostnames are resolved and the
  connection is pinned to the verified addresses; a public name that resolves to
  an internal address is refused.
- Saved API keys are **never echoed** into the settings page; blank submissions
  keep the stored value.
- HTTPS required for public hosts; link-local, metadata, unspecified and
  credentialed URLs refused; redirects disabled; timeouts and a response-size
  cap; API keys and catalogs never logged.

## Acceptance testing

Validated on a live **Bludit Pro 3.22.0** installation against **LLM Gateway**:

- Real authentication and **298 models** retrieved.
- Model discovery, search and selection working; the saved model was preserved.
- **Test model** inference succeeded; **Ask the Wizard** returned real content.
- No browser console or network errors; saved credentials preserved.

Automated: **229/229** HTTP checks and **15/15** Playwright tests on Bludit
Community 3.22.0 and Pro 3.22.0. The packaged archive installs and serves the
API on both editions.

## Compatibility and requirements

- Bludit 3.22.x, PHP 8.0+, PHP cURL.
- Any provider implementing the OpenAI `/chat/completions` and `/models` shape.

## Upgrade notes

Drop-in upgrade: replace `/bl-plugins/wizard/`. Settings and keys are stored in
`bl-content/` and are preserved. Two new settings default to the safe value
(AI deletion off, private providers off).

## Install

See `docs/INSTALLATION.md`, or: unzip into `bl-plugins/wizard/`, then
**Settings → Plugins → Activate**.

## Full changelog

See `CHANGELOG.md`.

## Project history

Bludit Wizard started as the **Bludit Wizard Custom GPT** — a working ChatGPT
integration that managed a Bludit site through authenticated GPT Actions. It grew
into this native plugin, while a separate **Bludit Wizard MCP** service pursues
the broader multi-client effort. The Custom GPT is preserved as project history
and is **not** required by, or bundled with, this plugin, which runs
independently. Credit: Evan Zellner — [@gitdamnit](https://github.com/gitdamnit).


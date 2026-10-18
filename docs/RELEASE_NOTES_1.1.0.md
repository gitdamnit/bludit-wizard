# Bludit Wizard v1.1.0

**Stable release.** AI-assisted writing, editing, SEO analysis and content
management for Bludit CMS, with twelve guided tasks and human-reviewed changes.

## Highlights

- **Twelve guided workflows** across four categories:
  - **Write & Create:** Create a New Page, Create an Outline, Generate Article
    Ideas.
  - **Edit & Improve:** Improve an Existing Page, Rewrite Tone or Style, Expand
    or Shorten Content, Proofread Content.
  - **SEO & Quality:** SEO + Clarity Audit, Generate SEO Metadata, Suggest
    Internal Links, Audit Content Freshness.
  - **Ask Wizard:** contextual questions with optional page selection.
- **Task-specific interface:** contextual guidance, instructions, page
  selection and primary action labels.
- **Full-width workspace** with original/proposed comparison.
- **Human-reviewed changes:** nothing is saved until you press **Apply this
  change**; SEO, link and freshness audits are read-only.
- **Configurable OpenAI-compatible providers**, with searchable model discovery,
  free-model and tool-support filters where metadata is available, and model
  testing.
- **Safer startup and upgrades:** server-rendered page selection and action
  labels, versioned assets, and a clear recovery message if the interface
  cannot initialize. A stale or blocked script never produces a raw unknown
  action error.

## Providers

Live acceptance testing covered **OpenRouter** and **LLM Gateway** for provider
configuration, model discovery, model selection, model testing, free-model
filtering and task execution.

OpenAI is supported through its OpenAI-compatible API. Ollama and other
OpenAI-compatible services may work when they are reachable from the Bludit
server and support the required requests. Private-network providers require an
explicit administrator opt-in; an unauthenticated Ollama instance should not be
exposed to the public internet.

Bludit Wizard supports configurable OpenAI-compatible AI providers, including
OpenAI, OpenRouter, LLM Gateway, and compatible Ollama deployments. OpenRouter
and LLM Gateway model discovery, filtering, and connection testing have been
verified in live use. Other providers and models may work depending on API
compatibility, authentication, capabilities, and network accessibility.

## Requirements

- Bludit 3.22.x (tested with Community and Pro 3.22.0)
- PHP 8.0+ with `curl`, `mbstring` and `json`
- An OpenAI-compatible provider endpoint and API key

## Installation

1. Download `bludit-wizard-1.1.0.zip` below.
2. Extract the single `wizard/` directory into `bl-plugins/`.
3. Activate **Bludit Wizard** under **Settings → Plugins**.
4. Configure the provider and model under **Settings → Plugins → Bludit
   Wizard**.
5. Open **Wizard** in the admin sidebar.

**Upgrading:** replace the entire `bl-plugins/wizard/` directory, keep
`bl-content/databases/plugins/wizard/` and `bl-content/workspaces/wizard/`, then
purge site/CDN caches and hard-refresh.

## Safety

- No content is written without explicit approval.
- Audit tasks never modify pages.
- Stale edits are refused.
- Saved API keys are never echoed back into the admin page.
- Provider URLs are validated and SSRF-restricted; cloud metadata endpoints are
  always refused.
- There is no page-deletion action.

## License

GPL-3.0-only. Copyright © 2026 Evan Zellner.

## Checksum

```
SHA256 (bludit-wizard-1.1.0.zip) = 51bfcb43c41412f30d9e68c7e99c54bc0a29213527ec9c32c53d92cc97632491
```

# Bludit Wizard

Native AI-assisted writing, editing, SEO analysis and content management for
Bludit CMS. Twelve guided tasks with human-reviewed changes.

- **Version:** 1.1.0
- **License:** GPL-3.0-only
- **Requires:** Bludit 3.22.x, PHP 8.0+
- **Project:** https://github.com/gitdamnit/bludit-wizard

Bludit Wizard is a native Bludit plugin. It connects your admin area to a
configurable OpenAI-compatible AI provider and guides you through focused
workflows. Generated content is always shown for review; nothing is written to a
page until you explicitly approve it. Analysis tasks never modify content.

Screenshots: https://github.com/gitdamnit/bludit-wizard#screenshots

## Features

### Write & Create

1. **Create a New Page** — Generate a complete new page or article draft from
   instructions you supply. Review it before saving or publishing.
   **Action: Generate Draft.**
2. **Create an Outline** — Generate a structured outline for an article, blog
   post or other content. **Action: Generate Outline.**
3. **Generate Article Ideas** — Brainstorm content topics, article concepts and
   writing directions. **Action: Generate Ideas.**

### Edit & Improve

These tasks require an existing Bludit page.

4. **Improve an Existing Page** — Analyze content and propose improvements to
   quality, organization and clarity. **Action: Review Improvements.**
5. **Rewrite Tone or Style** — Rewrite a page in the requested voice, tone or
   style. **Action: Rewrite Content.**
6. **Expand or Shorten Content** — Adjust the length of a page while retaining
   its intended meaning. **Action: Adjust Length.**
7. **Proofread Content** — Correct grammar, spelling, punctuation, wording and
   clarity problems. **Action: Proofread Page.**

### SEO & Quality

These tasks require an existing Bludit page.

8. **SEO + Clarity Audit** — Analyze search optimization, readability, clarity
   and content organization. **Action: Analyze Page.**
9. **Generate SEO Metadata** — Suggest SEO titles, descriptions and supported
   metadata. **Action: Generate Metadata.**
10. **Suggest Internal Links** — Identify internal-link opportunities from other
    relevant pages on the site; targets are checked against the page index.
    **Action: Find Link Opportunities.**
11. **Audit Content Freshness** — Review outdated information, items needing
    verification and update opportunities. **Action: Check Content Freshness.**

### Ask Wizard

12. **Ask Wizard** — Ask questions about writing, the site or supported Bludit
    functionality. Optionally include an existing page for context. It never
    modifies content. **Action: Ask Wizard.**

Other capabilities: task-specific instructions and controls, searchable model
discovery, free-model and tool-support filters where the provider supplies
metadata, connection/model testing, original/proposed comparison, read-only
audits, Markdown copying and SSRF-aware provider requests.

## Installation

1. Extract the release ZIP. It contains a single `wizard/` directory.
2. Upload it to `bl-plugins/` so the path is `bl-plugins/wizard/plugin.php`.
3. Activate **Bludit Wizard** under **Settings → Plugins**.
4. Open **Settings → Plugins → Bludit Wizard**.
5. Choose a provider preset or enter an OpenAI-compatible Base URL.
6. Enter the model id, or use **Refresh Models** and select one.
7. Enter the LLM API key and save.
8. Use **Test Model** to verify the endpoint, authentication and inference.
9. Open **Wizard** in the admin sidebar and choose a task.

### Upgrading

Replace the **whole** `bl-plugins/wizard/` directory. Do not copy only
`plugin.php`; the JavaScript, CSS, `lib/netpolicy.php` and `assets.json` must
come from the same release. Settings and keys live in
`bl-content/databases/plugins/wizard/db.php` and are preserved.

Purge site/CDN caches and hard-refresh after upgrading. Asset URLs carry
`?v=1.1.0`, so the browser requests the current files instead of a cached old
script.

## Supported AI providers

Bludit Wizard supports configurable OpenAI-compatible providers, including
OpenAI, OpenRouter, LLM Gateway and compatible Ollama deployments. OpenRouter and
LLM Gateway model discovery, filtering and connection testing have been verified
in live use. Other providers and models may work depending on API compatibility,
authentication, capabilities and network accessibility.

- **OpenRouter / LLM Gateway:** provider configuration, model discovery,
  selection, testing, free-model filtering and task execution verified live.
- **OpenAI:** compatible through its OpenAI-compatible API; live acceptance was
  performed with OpenRouter and LLM Gateway.
- **Ollama:** must be reachable from the server running Bludit. A remote host
  cannot usually reach `localhost` on your computer. Private-network providers
  require an explicit administrator opt-in, and an unauthenticated Ollama
  instance should never be exposed publicly.
- **Other services:** compatibility by API design, not individually verified
  support.

A model returned by a provider is not a guarantee that it supports every task or
parameter. **Test Model** checks URL validity, reachability, authentication and
a minimal inference request; it does not prove every task works with that model.

## Human approval and safety

- No generated content is written until **Apply this change** is pressed.
- SEO, internal-link and freshness audits are read-only.
- Proposals are pinned to the page revision; stale edits are refused.
- Saved API keys are never echoed back into the admin page.
- Provider URLs are validated; private/restricted destinations are blocked by
  default, and cloud metadata endpoints are always refused.
- CSRF validation, administrator authorization, escaped output and safe Markdown
  rendering are enforced.
- There is no page-deletion action. Use Bludit's Content screen.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| No models after Refresh Models | Check Base URL, key and network. Some providers do not expose `/models`; enter the model id manually. |
| A model fails tasks | It may not support the required request shape, context length or parameters. |
| Authentication failure | Re-enter the LLM API key; blank submissions keep the stored key. |
| Incorrect Base URL | Use the OpenAI-compatible base URL ending in `/v1`. |
| “The Wizard interface did not finish loading” | Purge caches, confirm `wizard.js?v=1.1.0` returns 200, reload. |
| Page selector missing | Upload the complete release, including `js/` and `assets.json`. |
| Old interface after upgrade | Replace the whole `wizard/` directory, purge caches, hard-refresh. |

Verify a deployment with `/bl-plugins/wizard/assets.json`: compare its
`js/wizard.js` SHA-256 with the served file.

## License

GPL-3.0-only. See [LICENSE](LICENSE). Copyright © 2026 Evan Zellner
([@gitdamnit](https://github.com/gitdamnit)).

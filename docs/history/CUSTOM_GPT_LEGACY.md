# Bludit Wizard Custom GPT — Legacy Showcase

> **This is a permanent historical record, not a deprecated-feature notice.**
> The Custom GPT was a working integration and the origin of the whole Bludit
> Wizard project. It is preserved here because of what it proved and what it led
> to — not because it is obsolete.

**Author / creator:** Evan Zellner
**GitHub:** [@gitdamnit](https://github.com/gitdamnit)
**Original domain it managed:** `ihopeitoffendsyou.com` (a Bludit site)

---

## 1. Why this exists — the origin story

Bludit Wizard did not start as "another generic AI chatbot." It started with
frustration.

I was tired of WordPress. WordPress has no shortage of AI connectors, Custom
GPTs and integrations, and I tried a number of them — most were disappointing:
too generic, too indirect, or built around the WordPress way of doing things
rather than around what I actually wanted to do.

Meanwhile, I preferred Bludit. It is lightweight, fast, file-based and pleasant
to manage. So I went looking for the same kind of AI integration for Bludit that
I had been chasing on WordPress.

At the time I was doing this, **I could not find an equivalent AI integration for
Bludit**, and I could not find a Bludit MCP implementation either. That is a
statement about my own search at that moment, not a claim that nothing existed
anywhere in the world.

Rather than go back to WordPress or settle for tools that did not fit, I built
my own. That first build was the **Bludit Wizard Custom GPT**: a ChatGPT GPT with
authenticated Actions that talked directly to my Bludit website.

Everything else grew out of that.

---

## 2. Three related but distinct implementations

| # | Name | What it is | Status |
|---|------|-----------|--------|
| 1 | **Bludit Wizard Custom GPT** | The original ChatGPT integration using GPT Actions to read, create and edit Bludit content. | Working historical integration; preserved here |
| 2 | **Bludit Wizard Plugin** | An independent native Bludit plugin with AI provider configuration, model discovery and content management. | Current, actively released (`1.0.5`) |
| 3 | **Bludit Wizard MCP** | A separately developed universal MCP service intended to serve multiple external AI clients. | Under independent development |

The Custom GPT is **not** a prerequisite for the plugin, and the plugin does
**not** require the MCP service. The MCP has **not** replaced the Custom GPT —
they are parallel efforts. The native plugin is the one being published to the
Bludit directory.

---

## 3. How the Custom GPT was built

It was assembled in the ChatGPT GPT builder:

- **Name:** Bludit Wizard
- **Avatar:** the project's skull mark (see the preserved preview below).
- **Description:** "Custom GPT assistant for managing ihopeitoffendsyou.com
  through Bludit."
- **Starter prompts:** *Create a new blog post*, *Audit my site's SEO*,
  *Want to brainstorm?*
- **Capabilities enabled:** Web Search, Image Generation, Code Interpreter &
  Data Analysis.
- **Actions:** an **OpenAPI 3.1** schema describing the Bludit Wizard API,
  authenticated with a **Bearer token** (the GPT Action API key), pointed at the
  site's `/api/wizard` endpoint.
- **Instructions:** a long, deliberately strict system prompt covering editorial
  standards, a review-before-write workflow, and safe Bludit operations.

### Authentication

Bearer-token authentication. The GPT Action sent
`Authorization: Bearer <GPT Action API key>`; the site validated it and refused
unauthorized requests. The GPT Action key was a separate secret, not the LLM
provider key.

### Action surface (OpenAPI)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/site` | Site information |
| `GET`  | `/pages` | List pages |
| `GET`  | `/pages/{key}` | Get one page (for review) |
| `POST` | `/pages` | Create a page |
| `PUT`  | `/pages/{key}` | Update a page — requires `confirm: true` |
| `DELETE` | `/pages/{key}` | Present in the first schema; **removed** from the later schema (see below) |

The final OpenAPI schema (`gpt-action-openapi-20261013-223049.yaml`) intentionally
**drops the delete operation**, and the GPT instructions state plainly:

> "Permanent deletion is intentionally not available through the current Bludit
> Wizard Action. Do not pretend that you can delete a page."

That early safety instinct is the direct ancestor of today's plugin default:
**AI/API page deletion is off by default.**

---

## 4. Original capabilities

- **Site-aware reading.** Retrieve site information and the list of pages so the
  GPT understood what it was working with.
- **Page retrieval for review.** Fetch a specific page before proposing any
  change.
- **Draft and page creation.** Create new content on request, defaulting to a
  draft when status was unclear.
- **Content editing.** Update title, content, description, type, slug and tags.
- **Review and approval before writing.** The workflow it enforced:

  > "Before updating any existing page: locate the correct page → call getPage
  > and read the existing content → review title, content and structure →
  > explain the specific change → obtain explicit approval → only then call
  > updatePage with confirm=true → read the page back to verify."

- **No silent overwrites.** "Discussion of a possible change is not permission to
  perform the change."

This is the same safety model the native plugin ships today: *preview first,
apply deliberately, verify after.*

---

## 5. What survives

- The **bearer-authenticated API** lives on in the native plugin at
  `/api/wizard`, with the same core routes and the same `confirm: true` guard for
  updates.
- The **review-before-write discipline** is now a first-class feature: the Wizard
  shows editable output and only writes on **Apply this change**, then reads the
  page back to verify.
- **No AI deletion by default** — a decision the original instructions already
  reflected, now enforced in code.
- The **OpenAPI schema itself** is preserved in this folder as authentic history.

When the ChatGPT GPT platform changed (with migration of GPTs toward "plugins"),
the Custom GPT's role shifted, but the integration it proved — an AI client
managing a Bludit site safely through an authenticated API — is exactly what the
native plugin and the MCP continue.

---

## 6. Preserved assets

Stored in [`assets/`](assets/):

| File | What it is | Provenance |
|------|-----------|------------|
| [`gpt-action-openapi-20261013-222016.yaml`](assets/gpt-action-openapi-20261013-222016.yaml) | Authentic OpenAPI 3.1 schema (includes the delete operation) | Session archive `2026-10-13_finish-bludit-gpt-setup.zip` |
| [`gpt-action-openapi-20261013-223049.yaml`](assets/gpt-action-openapi-20261013-223049.yaml) | Authentic OpenAPI 3.1 schema (delete removed) | Same archive |
| [`bludit-wizard-gpt-preview.png`](assets/bludit-wizard-gpt-preview.png) | The GPT's name, avatar, tagline and starter prompts | Cropped from session screenshot `img-001.png` (chat interface and browser chrome excluded) |

Both schemas were scanned for credentials and contain none — only the
`bearerAuth` scheme and the `bearerFormat: GPTActionAPIKey` placeholder. The
schema `servers` URL points at a disposable Hostinger test host used at the time,
which is no longer the production site.

### Referenced but not copied

The original session archive also contains screenshots. They are **not copied
into this repository** because they include personal browser context and an old
disposable host domain, and this project does not archive unsanitized UI or
private browsing information. They remain in the original archive:

| Archive file | Contents |
|--------------|----------|
| `2026-10-13_finish-bludit-gpt-setup.zip → images/img-001.png` | GPT builder: actions, capabilities, preview |
| `… /images/img-002.png`–`img-007.png` | Additional setup/instruction screenshots |
| `… /files/001-Pasted text(20261013-222016).txt` | OpenAPI schema v1 (preserved above) |
| `… /files/002-Pasted text(20261013-223049).txt` | OpenAPI schema v2 (preserved above) |
| `2026-08-20_bludit-wizard-creation.zip → images/img-001.png`–`img-005.png` | Early plugin creation screenshots |
| `2026-08-20_bludit-wizard-creation.zip → files/001-…1.0.0, 003-…1.0.1, 004-…1.0.2.zip` | Earliest plugin builds |

### Missing assets (expected filenames)

These were not available in the archives and are marked missing rather than
recreated:

| Expected file | Status |
|---------------|--------|
| `bludit-wizard-gpt-avatar.<png/svg>` (original source artwork) | Missing — only the in-screenshot avatar survives |
| `gpt-instructions-consolidated.txt` (standalone file) | Missing — the consolidated instructions exist only inside the session journal `2026-10-13_finish-bludit-gpt-setup.md` |
| Any schema version after `…223049` | Not found |

---

## 7. Timeline

| Date | Milestone |
|------|-----------|
| — | WordPress fatigue; search for a Bludit AI integration turns up nothing suitable |
| 2026-08-20 | **Bludit Wizard Custom GPT** working; earliest plugin builds (1.0.0–1.0.2) |
| 2026-08-21 | Plugin 1.0.3 (administrator-session fix for GPT-created pages) |
| 2026-10-13 | GPT setup finalised; OpenAPI schema v2 removes the delete operation |
| 2026-10-15 | **Bludit Wizard Plugin 1.0.5** — provider validation, model discovery, security hardening |
| ongoing | **Bludit Wizard MCP** continues the universal-integration effort |

---

*Credit: Evan Zellner — GitHub [@gitdamnit](https://github.com/gitdamnit). The
Custom GPT was a working integration that helped establish the foundation for
Bludit Wizard.*

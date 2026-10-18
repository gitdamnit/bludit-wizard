# Installing Bludit Wizard

This guide covers installing and configuring **Bludit Wizard 1.1.0** on a
Bludit 3.22.x site (Community or Pro).

## 1. Requirements

| Requirement | Notes |
|-------------|-------|
| Bludit | 3.22.x |
| PHP | 8.0 or newer |
| PHP extensions | `curl`, plus Bludit's own: `mbstring`, `json`, `gd`, `dom`, `session` |
| Provider | An OpenAI-compatible endpoint (OpenAI, OpenRouter, LLM Gateway, Ollama, or your own) |

The plugin makes outbound HTTPS requests to the provider you configure. If your
host blocks outbound HTTPS, the AI features will report a connection error.

## 2. Install the files

1. Download `bludit-wizard-1.1.0.zip` from the
   [v1.1.0 release](https://github.com/gitdamnit/bludit-wizard/releases/tag/v1.1.0).
2. Unzip it. The archive contains a single top-level directory, `wizard/`.
3. Copy that directory into your Bludit plugin folder so the path is:

   ```
   <bludit-root>/bl-plugins/wizard/plugin.php
   ```

   You can use SFTP, your hosting File Manager, or SSH:
   ```bash
   unzip bludit-wizard-1.1.0.zip -d /path/to/bludit/bl-plugins/
   ```

4. Ensure the files are readable by the web server (directories `755`, files
   `644`). Do **not** make them world-writable.

## 3. Activate

1. Sign in to Bludit as an administrator.
2. Go to **Settings → Plugins**.
3. Find **Bludit Wizard** and click **Activate**.
4. A **Wizard** entry appears in the admin sidebar.

## 4. Configure the provider

Open **Settings → Plugins → Bludit Wizard → Settings**.

### OpenAI

| Field | Value |
|-------|-------|
| Provider preset | `OpenAI` |
| Base URL | `https://api.openai.com/v1` |
| Model | e.g. `gpt-4o-mini` (or click **Refresh models** and pick) |
| LLM API key | your OpenAI key |

### OpenRouter

| Field | Value |
|-------|-------|
| Provider preset | `OpenRouter` |
| Base URL | `https://openrouter.ai/api/v1` |
| Model | click **Refresh models**, then search/select |
| LLM API key | your OpenRouter key |

### LLM Gateway

| Field | Value |
|-------|-------|
| Provider preset | `LLM Gateway` |
| Base URL | `https://api.llmgateway.io/v1` |
| Model | click **Refresh models**, then search/select |
| LLM API key | your LLM Gateway key |

### Ollama (local or LAN)

| Field | Value |
|-------|-------|
| Provider preset | `Ollama (local)` |
| Base URL | `http://127.0.0.1:11434/v1` (local) |
| LLM API key | leave blank |
| Allow private-network provider hosts | enable **only** if Ollama runs on another machine on your LAN |

Loopback addresses (`127.0.0.1`, `localhost`) always work. A provider on a
private network (for example `192.168.1.50`) requires the opt-in above.

### Verify the configuration

1. Click **Refresh models**. The status panel should show: URL valid →
   connection reachable → authenticated → catalog retrieved.
2. Search the picker and select a model (or type one).
3. Click **Test model**. You should see "model replied".
4. Save the settings.

## 5. Use the Wizard

1. Click **Wizard** in the admin sidebar.
2. Choose a task — *Create a new page*, *Improve an existing page*, *SEO +
   clarity audit*, *Create an outline*, or *Ask the Wizard*.
3. Enter an instruction and click **Run Wizard**.
4. Review the result. For content tasks, the **Apply this change** panel lets
   you edit title, slug, description, status and content before saving.
5. Press **Apply this change** to write. The plugin reads the page back and
   confirms.

## 6. Connect a Custom GPT (optional)

1. In the plugin settings, click **Generate** next to **GPT Action API key**.
   **Copy the value before saving** — it is never shown again.
2. Save the settings.
3. In your Custom GPT's Action, set the base URL to
   `https://YOUR-DOMAIN/api/wizard` and the authentication to
   **API Key → Bearer** with that key. Do not reuse your LLM provider key.
4. If your site is installed in a subdirectory, the base URL is
   `https://YOUR-DOMAIN/subdir/api/wizard`.

## 7. Upgrading

Replace the **whole** `/bl-plugins/wizard/` directory with the new version.
Do not copy only `plugin.php`: the client assets, `lib/netpolicy.php` and
`assets.json` must come from the same release. Your settings live in
`bl-content/databases/plugins/wizard/db.php` and are not affected.

Asset URLs carry a release version (for example `wizard.js?v=1.1.0`), so an
upgraded site requests the new files even if a CDN cached the old ones. After
uploading, purge any site/CDN cache and hard-refresh once.

To confirm what a host is actually serving, fetch:

```text
https://YOUR-DOMAIN/bl-plugins/wizard/assets.json
```

and compare its `sha256` for `js/wizard.js` with the served file. The release
verifier does this automatically for the packaged ZIP.

## 8. Uninstalling

Deactivate the plugin under **Settings → Plugins**, then delete
`/bl-plugins/wizard/`. To remove stored settings as well, delete
`bl-content/databases/plugins/wizard/` and
`bl-content/workspaces/wizard/`.

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| "Invalid CSRF token" / writes do nothing | A stale browser session. Log out and back in; ensure cookies are allowed. |
| "The Wizard interface did not finish loading" | The browser is running missing, blocked or stale JavaScript. Purge the site/CDN cache, confirm `wizard.js?v=…` loads with HTTP 200, and reload. |
| Button says "Wizard unavailable" | The workspace configuration did not load. Confirm the complete `wizard/` directory (including `js/`) was uploaded and reload. |
| API returns `503` | No **GPT Action API key** is set. Generate one and save. |
| API returns Bludit's 404 page | Bludit is in a subdirectory or `mod_rewrite` is off. Check pretty-URL settings; the API lives at `…/api/wizard` under your Bludit base path. |
| "Could not resolve the provider host" | DNS problem on the server, or a typo in the Base URL. |
| "resolves to a private/internal address" | The host is on a private network. For a trusted LAN provider, enable **Allow private-network provider hosts**. |
| "HTTPS is required for public provider hosts" | Use `https://` for a public provider. |
| "Provider rejected the API key" | Wrong or expired key, or the key has no access to `/models`. |
| "The provider returned HTTP …" | The provider accepted the connection but refused the request; the message is shown in the status panel. |
| Test model fails but discovery works | The selected model id is not available to your key. Pick another model. |

## 10. Security recommendations

- Serve the admin area over HTTPS.
- Use a long random **GPT Action API key**; rotate it if it leaks.
- Keep AI page deletion disabled unless you specifically need it.
- Only point the plugin at an AI endpoint you trust — page and site context is
  sent to it.
- Keep Bludit and the plugin up to date.

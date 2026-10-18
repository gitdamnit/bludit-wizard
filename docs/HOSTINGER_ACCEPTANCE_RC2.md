# Hostinger Acceptance Test — Bludit Wizard v1.0.6 RC2

Manual validation steps for the maintainer's disposable **Bludit Pro** site on
Hostinger. **Do not run these automatically and do not deploy from this
repository.** Upload only if you decide to test RC2.

Artifact: `dist/bludit-wizard-1.0.6-rc2.zip`
Prerequisite: a backup of the current plugin directory (`bl-plugins/wizard/`) and
of `bl-content/`.

## Upgrade

1. Back up `bl-plugins/wizard/` and `bl-content/` (or take a Hostinger snapshot).
2. Replace `bl-plugins/wizard/` with the `wizard/` directory from the RC2 ZIP
   (keep the same folder name and path: `bl-plugins/wizard/plugin.php`).
3. Keep `bl-content/databases/plugins/wizard/db.php` and
   `bl-content/workspaces/wizard/` — they hold your saved provider settings,
   keys and model cache.
4. Reload the admin area and log in.

## Checks

1. **Plugin activation and dashboard loading** — Settings → Plugins shows
   *Bludit Wizard* 1.0.6; opening **Wizard** loads without a PHP error.
2. **Heading contrast** — "What do you want to do?" is clearly readable
   (near-white) on the dark hero, on desktop and at a narrow window width.
3. **Product identity** — the hero shows the subtitle
   "Your intelligent Bludit publishing companion."
4. **Page selector** — *Improve an existing page* / *SEO + clarity audit* reveal
   the page selector; drafts and published pages are listed.
5. **Original/Proposed** — after **Run Wizard** on an existing page, a
   **Review proposed changes** section shows a read-only **Original** panel
   (title, slug, description, status, content) and an editable **Proposed**
   panel side by side; narrow the window and confirm they stack.
6. **Editable proposals** — edit a proposed field; the change is kept in the
   form (nothing is written yet).
7. **Discard Suggestion** — press **Discard suggestion**. The proposal
   disappears, the page is untouched, and you see a "discarded / not changed"
   message. No network DELETE request is made.
8. **Apply / read-back** — press **Apply this change** and confirm the success
   message with the verified page snapshot.
9. **No deletion controls** — confirm there is **no** "Delete selected page"
   button anywhere, and no deletion option in the plugin settings. Deleting
   pages is done from Bludit's own **Content** screen.
10. **LLM Gateway discovery** — Settings → *Refresh models*: URL valid →
    reachable → authenticated → catalog retrieved. Search and select a model.
11. **Provider Test Model** — *Test model* reports `model replied`.
12. **Ask Wizard** — a freeform question returns a response; no Apply panel is
    shown for analysis-only tasks.
13. **Draft/publication status** — edit a **draft** page and apply; it remains a
    draft (not published). Confirm the original status is preserved when the
    status field is left unchanged.
14. **Credentials preserved** — the saved LLM and GPT Action keys still work;
    the settings key fields remain blank with a "saved — leave blank to keep"
    placeholder. Do not re-enter keys unless rotating them.
15. **Safe error handling** — temporarily enter a bad model id and use *Test
    model*: a clear provider error is shown, the page is not modified, and no
    stack trace or secret is displayed.

## Stale-edit check (recommended)

1. Open the Wizard, select a page, and run *Improve*.
2. In another tab, edit and save that same page (or use the API `PUT`).
3. Return to the Wizard tab and press **Apply this change**.
4. Expected: the write is refused with a "page changed… nothing was saved"
   message (HTTP 409). Re-run the task to review the current version.

## After testing

- If RC2 is rejected, restore the backed-up `bl-plugins/wizard/` directory.
- Report: version shown, each check above (pass/fail), any console/network
  errors, and whether the saved provider configuration was preserved.
- Do **not** publish, tag or submit anything based on this test without the
  owner's explicit authorization.

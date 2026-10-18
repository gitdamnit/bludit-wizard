# Hostinger Acceptance Test — Bludit Wizard v1.1.0 RC1

Manual validation for the maintainer's disposable **Bludit Pro** site.
**Do not deploy automatically.** Upload only if you choose to test RC1.

Artifact: `dist/bludit-wizard-1.1.0-rc1.zip`

## Before upgrading

1. Back up `bl-plugins/wizard/` and `bl-content/` (or take a Hostinger snapshot).
2. Note your current provider settings and model (they must survive).

## Upgrade

1. Replace `bl-plugins/wizard/` with the `wizard/` directory from the RC1 ZIP
   (path stays `bl-plugins/wizard/plugin.php`).
2. Keep `bl-content/databases/plugins/wizard/db.php` and
   `bl-content/workspaces/wizard/` so settings, keys and the model cache persist.
3. If the browser shows an old layout, hard-refresh (Ctrl/Cmd+Shift+R) so the new
   CSS/JS is loaded.

## Checks

1. **Activation and saved settings** — Plugins shows *Bludit Wizard* 1.1.0;
   opening **Wizard** loads without error; your provider, Base URL, model and
   keys are unchanged. Key fields stay blank with a "saved" placeholder.
2. **Provider and models** — *Refresh models* reports URL valid → reachable →
   authenticated → catalog retrieved; search and select a model.
3. **Full-width workspace** — the dashboard is a single full-width column; there
   is no right sidebar and no Site intelligence / AI configuration / Safety model
   card. The dark hero and readable heading are intact.
4. **Twelve tasks and four categories** — the selector shows Write & Create,
   Edit & Improve, SEO & Quality and General with exactly twelve tasks.
5. **Guidance and action labels** — for each task, the explanation under the
   selector changes, the primary button reads its contextual label (Generate
   Draft, Generate Outline, Generate Ideas, Review Improvements, Rewrite Content,
   Adjust Length, Proofread Page, Analyze Page, Generate Metadata, Find Link
   Opportunities, Check Content Freshness, Ask Wizard), and the page selector
   appears only where required/optional.
6. **Task-specific fields** — *Rewrite tone or style* shows a tone field;
   *Expand or shorten content* shows Expand/Shorten and optional length notes.
7. **Create a new page** — **Generate Draft** produces an editable proposal; the
   original panel is absent; nothing is created until **Apply this change**.
8. **Original/proposed review** — an edit task shows the saved page read-only
   beside the editable proposal; on desktop they sit side by side, and narrow the
   window to confirm they stack.
9. **Read-only audits** — *Analyze Page*, *Find Link Opportunities* and *Check
   Content Freshness* return findings with **no** Apply button and do not change
   the page. Internal-link suggestions mark any target that does not exist.
10. **Context isolation** — select a page for an edit task, run it, then switch to
    *Create an outline* or *Create a new page*: the page selection resets and the
    outline does not reference the previous page.
11. **Ask Wizard** — defaults to "No page — general question"; selecting a page
    explicitly includes its content; without a page, no page content is sent.
12. **Long-form content** — open a long article, run *Improve* or *Proofread*;
    the review panels scroll and remain readable, with no horizontal overflow.
13. **Responsive layout** — check a narrow desktop window, a tablet width and a
    phone width; the comparison stacks and nothing is clipped.
14. **Stale-edit rejection** — open a proposal, edit and save the same page in
    another tab, then press Apply: the write is refused with "page changed …
    nothing was saved" (409). Re-run to review the current version.
15. **Draft preservation** — edit a draft and apply; it remains a draft.
16. **No Wizard deletion** — there is no delete button or endpoint in the Wizard.
    Use Bludit's Content screen for deletion.
17. **Refresh/cache** — reload after updating; if the old UI appears, hard-refresh
    and confirm the new assets load (check the browser console for errors).

## After testing

- If RC1 is rejected, restore the backed-up plugin directory.
- Report: version, each check pass/fail, any console/network errors, and whether
  saved settings/keys survived.
- Do not publish, tag or submit anything without explicit owner authorization.

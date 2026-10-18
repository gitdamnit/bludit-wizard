/*
 * Bludit Wizard — full-width content workspace (v1.1.0).
 * Copyright (C) 2026 Evan Zellner. Licensed under GPL-3.0-only; see LICENSE.
 *
 * - Twelve tasks with fixed labels, categories and contextual action buttons.
 * - Strict context isolation: switching task or page discards any proposal.
 * - Result types: page draft/revision (review+apply), metadata proposal
 *   (review+apply), text generation, structured audit, conversational.
 * - Safe Markdown rendering (DOM text nodes only; no innerHTML).
 * - Writes require explicit approval and a matching revision.
 * - There is no page-deletion action.
 */
(function () {
    'use strict';

    var cfg = window.BW_CONFIG || {};
    var tasks = cfg.tasks || {};
    var TYPES = ['draft', 'published', 'static', 'sticky', 'scheduled'];
    var EDITABLE = ['page_draft', 'page_revision', 'metadata_proposal'];

    function el(id) { return document.getElementById(id); }

    var form = el('bw-ai-form');
    var taskEl = el('bw-task');
    var guidance = el('bw-guidance');
    var pageWrap = el('bw-page-wrap');
    var pageEl = el('bw-page');
    var pageNone = el('bw-page-none');
    var pageHint = el('bw-page-hint');
    var toneWrap = el('bw-tone-wrap');
    var toneEl = el('bw-tone');
    var lengthWrap = el('bw-length-wrap');
    var lengthMode = el('bw-length-mode');
    var lengthNotes = el('bw-length-notes');
    var promptEl = el('bw-prompt');
    var promptLabel = el('bw-prompt-label');
    var run = el('bw-run');

    var result = el('bw-result');
    var resultTitle = el('bw-result-title');
    var resultBody = el('bw-result-body');
    var resultTech = el('bw-result-technical');
    var resultJson = el('bw-result-json');
    var copyButton = el('bw-copy');

    var audit = el('bw-audit');
    var auditBody = el('bw-audit-body');
    var auditHeading = el('bw-audit-heading');

    var review = el('bw-review');
    var reviewHeading = el('bw-review-heading');
    var originalCol = el('bw-original-col');
    var contentWrap = el('bw-content-wrap');
    var metadataNote = el('bw-metadata-note');
    var reviewTech = el('bw-review-technical');
    var reviewJson = el('bw-review-json');
    var saveButton = el('bw-save');
    var discardButton = el('bw-discard');

    var baseRevision = '';
    var initialProposal = null;
    var lastMarkdown = '';

    function def() { return taskEl ? (tasks[taskEl.value] || null) : null; }

    function setText(node, text) { if (node) { node.textContent = text == null ? '' : String(text); } }

    function setField(id, value) { var n = el(id); if (n) { n.value = value == null ? '' : String(value); } }
    function field(id) { var n = el(id); return n ? n.value : ''; }

    function fields() {
        return {
            title: field('bw-title'),
            slug: field('bw-slug'),
            description: field('bw-description'),
            type: field('bw-type'),
            content: field('bw-content')
        };
    }

    function resetOutputs() {
        baseRevision = '';
        initialProposal = null;
        lastMarkdown = '';
        if (result) { result.hidden = true; }
        if (audit) { audit.hidden = true; }
        if (review) { review.hidden = true; }
        if (resultBody) { resultBody.textContent = ''; }
        if (resultJson) { resultJson.textContent = ''; }
        if (resultTech) { resultTech.hidden = true; }
        if (auditBody) { auditBody.textContent = ''; }
        if (reviewJson) { reviewJson.textContent = ''; }
        if (reviewTech) { reviewTech.hidden = true; }
        if (originalCol) { originalCol.hidden = true; }
        ['bw-title', 'bw-slug', 'bw-description', 'bw-content'].forEach(function (id) { setField(id, ''); });
        setField('bw-type', 'draft');
        ['bw-original-title', 'bw-original-slug', 'bw-original-description', 'bw-original-type', 'bw-original-content']
            .forEach(function (id) { setText(el(id), ''); });
    }

    function clearPage() {
        if (pageEl) { pageEl.value = ''; }
    }

    function applyTaskUi() {
        var d = def();
        if (!d) {
            showInitFailure('This task is not available. The Wizard configuration did not load correctly, so nothing can be run. Reload the page; if the problem continues, deploy the complete wizard/ directory.');
            return;
        }
        setText(guidance, d.guidance);
        if (run) { run.textContent = d.action; run.disabled = false; }
        if (promptLabel) { promptLabel.textContent = d.promptLabel; }
        if (promptEl) { promptEl.placeholder = d.placeholder || ''; }

        var showPage = d.page === 'required' || d.page === 'optional';
        if (pageWrap) { pageWrap.hidden = !showPage; }
        if (pageNone) {
            pageNone.textContent = (d.page === 'required') ? '— Select a page —' : '— No page — general question —';
        }
        setText(pageHint, d.page === 'required'
            ? 'This task requires an existing page.'
            : (d.page === 'optional' ? 'Optional: include one page’s content as context.' : ''));

        if (toneWrap) { toneWrap.hidden = (d.options || []).indexOf('tone') === -1; }
        if (lengthWrap) { lengthWrap.hidden = (d.options || []).indexOf('length') === -1; }
    }

    function onTaskChange() {
        // Context isolation: nothing from the previous task may survive.
        clearPage();
        if (promptEl) { promptEl.value = ''; }
        if (toneEl) { toneEl.value = ''; }
        if (lengthMode) { lengthMode.value = 'expand'; }
        if (lengthNotes) { lengthNotes.value = ''; }
        resetOutputs();
        applyTaskUi();
    }

    function onPageChange() {
        // A proposal generated for one page must never be applied to another.
        resetOutputs();
    }

    /* ---------------- safe Markdown rendering ---------------- */

    function inlineText(text) {
        return String(text)
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');
    }

    function renderMarkdown(container, text) {
        if (!container) { return; }
        container.textContent = '';
        var lines = String(text == null ? '' : text).replace(/\r\n/g, '\n').split('\n');
        var paragraph = [];
        var list = null;
        var i = 0;

        function flushParagraph() {
            if (!paragraph.length) { return; }
            var p = document.createElement('p');
            p.textContent = inlineText(paragraph.join(' '));
            container.appendChild(p);
            paragraph = [];
        }
        function closeList() { list = null; }
        function openList(tag) {
            if (!list || list.tagName !== tag) {
                list = document.createElement(tag);
                container.appendChild(list);
            }
            return list;
        }

        while (i < lines.length) {
            var line = lines[i];
            var trimmed = line.trim();

            if (trimmed.indexOf('```') === 0) {
                flushParagraph(); closeList();
                var code = [];
                i += 1;
                while (i < lines.length && lines[i].trim().indexOf('```') !== 0) { code.push(lines[i]); i += 1; }
                i += 1;
                var pre = document.createElement('pre');
                var codeEl = document.createElement('code');
                codeEl.textContent = code.join('\n');
                pre.appendChild(codeEl);
                container.appendChild(pre);
                continue;
            }

            var heading = line.match(/^(#{1,6})\s+(.*)$/);
            if (heading) {
                flushParagraph(); closeList();
                var h = document.createElement('h4');
                h.textContent = inlineText(heading[2]);
                container.appendChild(h);
                i += 1; continue;
            }

            var bullet = line.match(/^\s*[-*+]\s+(.*)$/);
            if (bullet) {
                flushParagraph();
                var ul = openList('UL');
                var li = document.createElement('li');
                li.textContent = inlineText(bullet[1]);
                ul.appendChild(li);
                i += 1; continue;
            }

            var ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
            if (ordered) {
                flushParagraph();
                var ol = openList('OL');
                var oli = document.createElement('li');
                oli.textContent = inlineText(ordered[1]);
                ol.appendChild(oli);
                i += 1; continue;
            }

            if (trimmed === '') {
                flushParagraph(); closeList(); i += 1; continue;
            }

            paragraph.push(trimmed);
            i += 1;
        }

        flushParagraph();
    }

    function focusSoon(node) {
        if (!node) { return; }
        try { node.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { node.scrollIntoView(); }
        window.setTimeout(function () {
            try { node.focus({ preventScroll: true }); } catch (e) { try { node.focus(); } catch (e2) {} }
        }, 60);
    }

    /* ---------------- result views ---------------- */

    function showText(title, text, raw) {
        resetOutputs();
        lastMarkdown = String(text || '');
        setText(resultTitle, title);
        renderMarkdown(resultBody, lastMarkdown);
        if (raw && raw !== lastMarkdown) {
            setText(resultJson, raw);
            resultTech.hidden = false;
        }
        result.hidden = false;
        focusSoon(resultBody);
    }

    function showOriginal(original) {
        if (!originalCol) { return; }
        if (!original) { originalCol.hidden = true; return; }
        setText(el('bw-original-title'), original.title);
        setText(el('bw-original-slug'), original.slug);
        setText(el('bw-original-description'), original.description);
        setText(el('bw-original-type'), original.type);
        setText(el('bw-original-content'), original.content);
        originalCol.hidden = false;
    }

    function showReview(resultType, parsed, original, raw) {
        resetOutputs();
        var originalType = (original && TYPES.indexOf(original.type) !== -1) ? original.type : '';
        var isMetadata = (resultType === 'metadata_proposal');

        if (isMetadata) {
            setField('bw-title', parsed.title || (original ? original.title : ''));
            setField('bw-slug', parsed.slug || (original ? original.slug : ''));
            setField('bw-description', parsed.description || (original ? original.description : ''));
            setField('bw-type', originalType || 'draft');
            setField('bw-content', original ? original.content : '');
            if (contentWrap) { contentWrap.hidden = true; }
            if (metadataNote) { metadataNote.hidden = false; }
        } else {
            setField('bw-title', parsed.title || (original ? original.title : ''));
            setField('bw-slug', parsed.slug || parsed.suggested_slug || (original ? original.slug : ''));
            setField('bw-description', parsed.description || (original ? original.description : ''));
            var proposedType = (parsed.type && TYPES.indexOf(parsed.type) !== -1) ? parsed.type : (originalType || 'draft');
            setField('bw-type', proposedType);
            setField('bw-content', parsed.content || (original ? original.content : ''));
            if (contentWrap) { contentWrap.hidden = false; }
            if (metadataNote) { metadataNote.hidden = true; }
        }

        showOriginal(original || null);
        baseRevision = (original && original.revision) ? original.revision : '';
        initialProposal = JSON.stringify(fields());
        if (raw) { setText(reviewJson, raw); reviewTech.hidden = false; }
        review.hidden = false;
        result.hidden = true;
        audit.hidden = true;
        focusSoon(reviewHeading);
    }

    function showLinkAudit(links) {
        resetOutputs();
        if (!auditBody) { return; }
        var list = document.createElement('div');
        list.className = 'bw-link-list';
        (links || []).forEach(function (link) {
            var card = document.createElement('div');
            card.className = 'bw-link-item' + (link.valid ? '' : ' bw-link-invalid');
            var source = document.createElement('p');
            source.className = 'bw-link-source';
            source.textContent = '“' + String(link.source_text || '') + '”';
            var target = document.createElement('p');
            target.className = 'bw-link-target';
            target.textContent = link.valid
                ? ('→ ' + link.target + ' — ' + (link.url || ''))
                : ('→ ' + link.target + ' (page not found — suggestion rejected)');
            var reason = document.createElement('p');
            reason.className = 'bw-link-reason';
            reason.textContent = String(link.reason || '');
            card.appendChild(source);
            card.appendChild(target);
            card.appendChild(reason);
            list.appendChild(card);
        });
        if (!links || links.length === 0) {
            var empty = document.createElement('p');
            empty.textContent = 'No internal link opportunities were suggested.';
            list.appendChild(empty);
        }
        auditBody.appendChild(list);
        audit.hidden = false;
        result.hidden = true;
        review.hidden = true;
        focusSoon(auditHeading);
    }

    function showError(message) {
        resetOutputs();
        setText(resultTitle, 'Error');
        var p = document.createElement('p');
        p.className = 'bw-error';
        p.textContent = String(message || 'The request failed.');
        resultBody.appendChild(p);
        result.hidden = false;
        focusSoon(resultBody);
    }

    function showInitFailure(message) {
        var text = String(message || 'The Wizard interface could not initialize.');
        if (result && resultBody && resultTitle) {
            result.hidden = false;
            setText(resultTitle, 'Wizard unavailable');
            resultBody.textContent = '';
            var p = document.createElement('p');
            p.className = 'bw-error';
            p.textContent = text;
            resultBody.appendChild(p);
        } else if (form && form.parentNode) {
            var alert = document.createElement('div');
            alert.className = 'alert alert-warning bw-init-error';
            alert.setAttribute('role', 'alert');
            alert.textContent = text;
            form.parentNode.insertBefore(alert, form);
        }
        if (run) {
            run.disabled = true;
            run.textContent = 'Wizard unavailable';
        }
    }

    /* ---------------- requests ---------------- */

    function postForm(params) {
        return fetch(cfg.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                // Distinguishes the fetch client from a browser-native form
                // POST. The PHP controller uses it to fail safely when the
                // JavaScript did not initialize. See DECISION_LOG D-0051.
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: params.toString(),
            credentials: 'same-origin'
        });
    }

    async function parseResponse(response) {
        var text = await response.text();
        try { return { json: JSON.parse(text), status: response.status }; }
        catch (e) { throw new Error(text || 'Empty server response.'); }
    }

    function parseJsonLoose(text) {
        var cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        try { return JSON.parse(cleaned); } catch (e) { return null; }
    }

    async function onSubmit(event) {
        event.preventDefault();
        var d = def();
        if (!d) {
            showInitFailure('This task is not available. The Wizard configuration did not load correctly, so nothing was run. Reload the page; if the problem continues, deploy the complete wizard/ directory.');
            return;
        }
        if (!cfg.endpoint || !cfg.token) {
            showInitFailure('The Wizard configuration did not load, so nothing was run. Reload the page; if the problem continues, deploy the complete wizard/ directory.');
            return;
        }

        if (d.promptRequired && promptEl && promptEl.value.trim() === '') {
            showError('Please enter an instruction.');
            promptEl.focus();
            return;
        }
        if (d.page === 'required' && (!pageEl || pageEl.value === '')) {
            showError('Select a page for this task.');
            if (pageEl) { pageEl.focus(); }
            return;
        }
        if ((d.options || []).indexOf('tone') !== -1 && (!toneEl || toneEl.value.trim() === '')) {
            showError('Choose a target tone or style.');
            if (toneEl) { toneEl.focus(); }
            return;
        }

        if (run) {
            run.disabled = true;
            run.textContent = 'Working…';
        }
        resetOutputs();

        var body = new URLSearchParams();
        body.set('tokenCSRF', cfg.token);
        body.set('action', 'ai');
        body.set('task', taskEl.value);
        body.set('pageKey', (d.page === 'none') ? '' : (pageEl ? pageEl.value : ''));
        body.set('prompt', promptEl ? promptEl.value : '');
        if ((d.options || []).indexOf('tone') !== -1) { body.set('tone', toneEl ? toneEl.value : ''); }
        if ((d.options || []).indexOf('length') !== -1) {
            body.set('lengthMode', lengthMode ? lengthMode.value : '');
            body.set('lengthNotes', lengthNotes ? lengthNotes.value : '');
        }

        try {
            var response = await postForm(body);
            var parsedResponse = await parseResponse(response);
            var json = parsedResponse.json;
            if (!json.ok) { throw new Error(json.error || 'The Wizard request failed.'); }

            var raw = String(json.result == null ? '' : json.result);
            var original = json.original || null;
            var resultType = json.resultType;

            if (resultType === 'structured_audit' && json.data && json.data.links) {
                showLinkAudit(json.data.links);
            } else if (EDITABLE.indexOf(resultType) !== -1) {
                var parsed = parseJsonLoose(raw);
                if (parsed && (parsed.content || parsed.title)) {
                    showReview(resultType, parsed, original, raw);
                } else {
                    showText('Result', raw, raw);
                }
            } else if (resultType === 'structured_audit') {
                showText('Audit result', raw, raw);
            } else if (resultType === 'conversational') {
                showText('Wizard response', raw, raw);
            } else {
                showText('Generated content', raw, raw);
            }
        } catch (error) {
            showError(error.message || String(error));
        } finally {
            if (run) {
                run.disabled = false;
                run.textContent = d.action;
            }
        }
    }

    async function onSave() {
        var d = def();
        if (!d || EDITABLE.indexOf(d.result) === -1) { return; }

        var isExisting = baseRevision !== '';
        if (isExisting && !window.confirm('Apply these changes to the selected page?')) { return; }

        saveButton.disabled = true;
        saveButton.textContent = 'Applying…';

        var body = new URLSearchParams();
        body.set('tokenCSRF', cfg.token);
        body.set('action', 'save_page');
        body.set('pageKey', isExisting && pageEl ? pageEl.value : '');
        body.set('title', field('bw-title'));
        body.set('slug', field('bw-slug'));
        body.set('description', field('bw-description'));
        body.set('type', field('bw-type'));
        body.set('content', field('bw-content'));
        if (isExisting) { body.set('baseRevision', baseRevision); }

        try {
            var response = await postForm(body);
            var parsedResponse = await parseResponse(response);
            var json = parsedResponse.json;
            if (parsedResponse.status === 409 || json.code === 'stale_page') {
                showError((json.error || 'This page changed while you were reviewing it.') + ' Nothing was saved.');
                return;
            }
            if (!json.ok) { throw new Error(json.error || 'Save failed.'); }

            review.hidden = true;
            baseRevision = '';
            initialProposal = null;
            showText('Saved', (json.message || 'Saved.') + '\n\n' + JSON.stringify(json.page, null, 2), '');
        } catch (error) {
            showError(error.message || String(error));
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Apply this change';
        }
    }

    function onDiscard() {
        var dirty = initialProposal && JSON.stringify(fields()) !== initialProposal;
        if (dirty && !window.confirm('Discard this suggestion? Your unsaved edits will be lost. The Bludit page will not be changed.')) {
            return;
        }
        resetOutputs();
        showText('Discarded', 'Suggestion discarded. The Bludit page was not changed.', '');
    }

    async function onCopy() {
        try { await navigator.clipboard.writeText(lastMarkdown || ''); } catch (e) {}
    }

    function init() {
        // The script may be cached and requested on a page that no longer has
        // this form; do nothing there.

        if (!form || !taskEl) { return; }

        form.addEventListener('submit', onSubmit);
        if (saveButton) { saveButton.addEventListener('click', onSave); }
        if (discardButton) { discardButton.addEventListener('click', onDiscard); }
        if (copyButton) { copyButton.addEventListener('click', onCopy); }
        taskEl.addEventListener('change', onTaskChange);
        if (pageEl) { pageEl.addEventListener('change', onPageChange); }

        // Initial state.
        resetOutputs();
        applyTaskUi();
        if (!cfg.endpoint || !cfg.token) {
            showInitFailure('The Wizard configuration did not load, so nothing can be run. Reload the page; if the problem continues, deploy the complete wizard/ directory.');
        }
    }

    try {
        init();
    } catch (error) {
        showInitFailure('The Wizard interface could not initialize: ' +
            (error && error.message ? error.message : String(error)) +
            '. Reload the page; if the problem continues, deploy the complete wizard/ directory.');
    }
})();

/* Bludit Wizard — provider settings: model discovery, search and test.
 * Copyright (C) 2026 Evan Zellner. Licensed under GPL-3.0-only; see LICENSE.
 *
 * Progressive enhancement: with JavaScript disabled the model field is still a
 * plain text input and the saved settings are unchanged.
 *
 * Model data comes from the provider, so every value is inserted with
 * textContent (never innerHTML) to avoid injecting provider-supplied markup.
 */
(function () {
    'use strict';

    var cfg = window.BW_SETTINGS || {};
    if (!cfg.endpoint) {
        return;
    }

    var endpoint = cfg.endpoint;
    var token = cfg.token || '';
    var presets = cfg.presets || {};
    var catalog = cfg.catalog || {};

    var models = Array.isArray(catalog.models) ? catalog.models.slice() : [];
    var filters = {
        hasPricing: !!catalog.hasPricing,
        hasTools: !!catalog.hasTools
    };

    var providerEl = document.getElementById('wizard-provider');
    var baseUrlEl = document.getElementById('wizard-base-url');
    var modelEl = document.getElementById('wizard-model');
    var apiKeyEl = document.getElementById('wizard-api-key');
    var menuEl = document.getElementById('bw-model-menu');
    var statusEl = document.getElementById('bw-model-status');
    var refreshBtn = document.getElementById('bw-refresh-models');
    var testBtn = document.getElementById('bw-test-model');
    var freeWrap = document.getElementById('bw-filter-free-wrap');
    var freeEl = document.getElementById('bw-filter-free');
    var toolsWrap = document.getElementById('bw-filter-tools-wrap');
    var toolsEl = document.getElementById('bw-filter-tools');

    if (!modelEl || !menuEl || !statusEl) {
        return;
    }

    var MAX_ITEMS = 300;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined && text !== null) { node.textContent = String(text); }
        return node;
    }

    function clear(node) {
        while (node.firstChild) { node.removeChild(node.firstChild); }
    }

    function showFilters() {
        if (freeWrap) { freeWrap.hidden = !filters.hasPricing; }
        if (toolsWrap) { toolsWrap.hidden = !filters.hasTools; }
        if (!filters.hasPricing && freeEl) { freeEl.checked = false; }
        if (!filters.hasTools && toolsEl) { toolsEl.checked = false; }
    }

    function filteredModels(query) {
        var q = String(query || '').trim().toLowerCase();
        var onlyFree = !!(freeEl && freeEl.checked && filters.hasPricing);
        var onlyTools = !!(toolsEl && toolsEl.checked && filters.hasTools);
        return models.filter(function (m) {
            if (onlyFree && m.free !== true) { return false; }
            if (onlyTools && m.tools !== true) { return false; }
            if (q && String(m.id).toLowerCase().indexOf(q) === -1 && String(m.name).toLowerCase().indexOf(q) === -1) {
                return false;
            }
            return true;
        });
    }

    function renderMenu(query) {
        clear(menuEl);
        var list = filteredModels(query);
        if (!models.length) {
            menuEl.hidden = true;
            return;
        }
        if (!list.length) {
            menuEl.appendChild(el('div', 'bw-model-empty', 'No models match the current search or filters.'));
            menuEl.hidden = false;
            return;
        }

        var shown = list.slice(0, MAX_ITEMS);
        shown.forEach(function (m) {
            var item = el('div', 'bw-model-item');
            item.setAttribute('role', 'option');
            item.appendChild(el('span', 'bw-model-id', m.id));
            if (m.name && m.name !== m.id) {
                item.appendChild(el('span', 'bw-model-name', m.name));
            }
            if (m.free === true) { item.appendChild(el('span', 'bw-badge bw-badge-free', 'free')); }
            if (m.tools === true) { item.appendChild(el('span', 'bw-badge bw-badge-tools', 'tools')); }
            if (m.context) { item.appendChild(el('span', 'bw-badge bw-badge-ctx', (m.context / 1000) + 'k')); }
            item.addEventListener('mousedown', function (event) {
                event.preventDefault();
                modelEl.value = m.id;
                menuEl.hidden = true;
            });
            menuEl.appendChild(item);
        });
        if (list.length > MAX_ITEMS) {
            menuEl.appendChild(el('div', 'bw-model-empty', '+' + (list.length - MAX_ITEMS) + ' more — keep typing to narrow the list.'));
        }
        menuEl.hidden = false;
    }

    // --- status rendering -------------------------------------------------
    function line(label, value, state) {
        var row = el('div', 'bw-status-line' + (state ? ' bw-status-' + state : ''));
        row.appendChild(el('span', 'bw-status-label', label));
        row.appendChild(el('span', 'bw-status-value', value));
        return row;
    }

    function renderDiscovery(json) {
        clear(statusEl);
        var s = json.stages || {};
        statusEl.appendChild(line('URL', s.url && s.url.valid
            ? ('valid' + (s.url.https ? ' (https)' : ' (http, local)'))
            : ('invalid — ' + ((s.url && s.url.reason) || 'unknown reason')),
            s.url && s.url.valid ? 'ok' : 'bad'));
        statusEl.appendChild(line('Connection', s.network && s.network.reachable
            ? ('reachable (HTTP ' + s.network.status + ')')
            : ('not reachable — ' + ((s.network && s.network.error) || 'no response')),
            s.network && s.network.reachable ? 'ok' : 'bad'));
        var authText;
        if (!s.auth || s.auth.attempted !== true) {
            authText = 'not attempted (no key configured)';
        } else {
            authText = s.auth.ok === true ? 'authenticated' : (s.auth.ok === false ? 'rejected' : 'not confirmed');
        }
        statusEl.appendChild(line('Authentication', authText,
            s.auth && s.auth.ok === true ? 'ok' : (s.auth && s.auth.ok === false ? 'bad' : 'warn')));
        statusEl.appendChild(line('Catalog', s.catalog && s.catalog.retrieved
            ? (s.catalog.count + ' model(s) retrieved (' + s.catalog.format + ')')
            : ('not retrieved — ' + ((s.catalog && s.catalog.error) || json.error || 'unknown')),
            s.catalog && s.catalog.retrieved ? 'ok' : 'bad'));
        if (json.error && !(s.catalog && s.catalog.retrieved)) {
            statusEl.appendChild(line('Result', json.error, 'bad'));
        } else {
            statusEl.appendChild(line('Result', 'model list updated; saved model unchanged', 'ok'));
        }
    }

    function renderTest(json) {
        clear(statusEl);
        var s = json.stages || {};
        statusEl.appendChild(line('URL', s.url && s.url.valid ? 'valid' : ('invalid — ' + ((s.url && s.url.reason) || '')),
            s.url && s.url.valid ? 'ok' : 'bad'));
        statusEl.appendChild(line('Connection', s.network && s.network.reachable
            ? ('reachable (HTTP ' + s.network.status + ')') : 'not reachable',
            s.network && s.network.reachable ? 'ok' : 'bad'));
        var authText = (!s.auth || s.auth.attempted !== true)
            ? 'not attempted (no key configured)'
            : (s.auth.ok === true ? 'authenticated' : (s.auth.ok === false ? 'rejected' : 'not confirmed'));
        statusEl.appendChild(line('Authentication', authText,
            s.auth && s.auth.ok === true ? 'ok' : (s.auth && s.auth.ok === false ? 'bad' : 'warn')));
        var inf = s.inference || {};
        statusEl.appendChild(line('Inference',
            inf.ok === true ? ('model replied (' + (inf.model || '') + ')') : ('failed — ' + (inf.error || json.error || 'unknown')),
            inf.ok === true ? 'ok' : 'bad'));
    }

    function setBusy(button, busy, label) {
        if (!button) { return; }
        button.disabled = busy;
        if (busy) {
            button.dataset.label = button.textContent;
            button.textContent = label || 'Working…';
        } else if (button.dataset.label) {
            button.textContent = button.dataset.label;
        }
    }

    function post(params) {
        var body = new URLSearchParams(params);
        return fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString(),
            credentials: 'same-origin'
        }).then(function (response) {
            return response.text().then(function (text) {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error(text || 'The server returned an unexpected response.');
                }
            });
        });
    }

    function currentKeyOverride() {
        // Only transmit the key when it differs from the stored value, to limit
        // how often the secret leaves the browser.
        if (!apiKeyEl) { return ''; }
        return (apiKeyEl.value && apiKeyEl.value !== apiKeyEl.defaultValue) ? apiKeyEl.value : '';
    }

    // --- events -----------------------------------------------------------
    if (providerEl) {
        providerEl.addEventListener('change', function () {
            var preset = presets[providerEl.value];
            if (typeof preset === 'string' && preset !== '' && baseUrlEl) {
                baseUrlEl.value = preset;
            }
        });
    }

    modelEl.addEventListener('focus', function () { renderMenu(''); });
    modelEl.addEventListener('input', function () { renderMenu(modelEl.value); });
    modelEl.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { menuEl.hidden = true; }
    });
    document.addEventListener('click', function (event) {
        if (event.target !== modelEl && !menuEl.contains(event.target)) { menuEl.hidden = true; }
    });

    if (freeEl) { freeEl.addEventListener('change', function () { renderMenu(''); }); }
    if (toolsEl) { toolsEl.addEventListener('change', function () { renderMenu(''); }); }

    var generateBtn = document.getElementById('bw-generate-gpt-key');
    if (generateBtn) {
        generateBtn.addEventListener('click', function () {
            var keyField = document.getElementById('wizard-gpt-api-key');
            if (!keyField) { return; }
            var bytes = new Uint8Array(32);
            (window.crypto || window.msCrypto).getRandomValues(bytes);
            var hex = '';
            for (var i = 0; i < bytes.length; i++) {
                hex += ('0' + bytes[i].toString(16)).slice(-2);
            }
            keyField.value = hex;
            keyField.focus();
            keyField.select();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            setBusy(refreshBtn, true, 'Refreshing…');
            clear(statusEl);
            statusEl.appendChild(line('Status', 'Validating URL and contacting the provider…', 'warn'));
            post({
                tokenCSRF: token,
                action: 'discover_models',
                baseUrl: baseUrlEl ? baseUrlEl.value : '',
                apiKey: currentKeyOverride()
            }).then(function (json) {
                renderDiscovery(json);
                if (json.stages && json.stages.catalog && json.stages.catalog.retrieved) {
                    models = Array.isArray(json.models) ? json.models : [];
                    filters.hasPricing = !!(json.filters && json.filters.hasPricing);
                    filters.hasTools = !!(json.filters && json.filters.hasTools);
                    showFilters();
                }
            }).catch(function (error) {
                clear(statusEl);
                statusEl.appendChild(line('Error', error.message || String(error), 'bad'));
            }).finally(function () {
                setBusy(refreshBtn, false);
            });
        });
    }

    if (testBtn) {
        testBtn.addEventListener('click', function () {
            setBusy(testBtn, true, 'Testing…');
            clear(statusEl);
            statusEl.appendChild(line('Status', 'Sending a minimal request to the selected model…', 'warn'));
            post({
                tokenCSRF: token,
                action: 'test_model',
                baseUrl: baseUrlEl ? baseUrlEl.value : '',
                model: modelEl.value,
                apiKey: currentKeyOverride()
            }).then(function (json) {
                renderTest(json);
            }).catch(function (error) {
                clear(statusEl);
                statusEl.appendChild(line('Error', error.message || String(error), 'bad'));
            }).finally(function () {
                setBusy(testBtn, false);
            });
        });
    }

    // --- init -------------------------------------------------------------
    showFilters();
    if (models.length) {
        statusEl.textContent = '';
        statusEl.appendChild(line('Catalog', models.length + ' cached model(s) available — focus the field to search.', 'ok'));
    }
})();

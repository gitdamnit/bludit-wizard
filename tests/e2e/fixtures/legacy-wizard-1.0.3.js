/*
 * Regression fixture: the pre-1.0.6 client contract.
 *
 * This is a deliberately small stand-in for the 1.0.x wizard.js that the live
 * deployment was still serving. It looks up elements that no longer exist in
 * the v1.1.0 workspace and throws before it can attach the form listener.
 *
 * Used by the mixed-version test: newer markup + older JavaScript must fail
 * visibly and safely, never with a raw "Unknown action." response.
 */
(function () {
    'use strict';

    var form = document.getElementById('bw-ai-form');
    var operation = document.getElementById('bw-operation');
    var pageWrap = document.getElementById('bw-page-wrap');
    var resultText = document.getElementById('bw-result-text');

    function syncPageVisibility() {
        var needsPage = ['improve', 'seo'].indexOf(operation.value) !== -1;
        pageWrap.style.display = needsPage ? 'block' : 'none';
    }

    // Throws: #bw-operation does not exist in the v1.1.0 workspace.
    operation.addEventListener('change', function () {
        syncPageVisibility();
        resultText.textContent = '';
    });

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        // Never reached in the fixture; kept to mirror the old contract.
        resultText.textContent = 'legacy client';
    });

    syncPageVisibility();
})();

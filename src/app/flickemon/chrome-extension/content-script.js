/**
 * Flickemon Chrome Extension Content Script
 * ──────────────────────────────────────────
 * Injected into FlickPlayer pages. Detects the Angular app and enables
 * the Flickemon widget. This script communicates with the Angular app
 * via custom DOM events.
 *
 * Handoff Note: The main game logic lives inside the Angular app.
 * This content script only bridges the extension with the app.
 */

(function () {
    'use strict';

    // Check if we're on a FlickPlayer page
    const isFlickPlayer = document.querySelector('app-root') !== null;
    if (!isFlickPlayer) {
        return;
    }

    console.log('[Flickemon Extension] FlickPlayer detected. Extension active.');

    // Dispatch event to notify Angular app that the extension is loaded
    document.dispatchEvent(new CustomEvent('flickemon-extension-loaded', {
        detail: {version: '1.0.0'},
    }));

    // Listen for game state sync requests from the Angular app
    document.addEventListener('flickemon-sync-request', function (event) {
        // Forward to chrome.storage.local for cross-tab persistence
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const detail = (event as CustomEvent).detail;
            chrome.storage.local.set({flickemonState: detail}, function () {
                console.log('[Flickemon Extension] Game state synced to extension storage.');
            });
        }
    });
})();

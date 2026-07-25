/**
 * Content Script Entry Point (Chrome Extension)
 * ──────────────────────────────────────────────
 * Boots engines, injects UI into Flick course page DOM, and hooks video playback.
 */

(function () {
    'use strict';

    console.log('[Flickémon Extension] Loading content script...');

    async function initExtension() {
        // Initialize engines
        if (window.flickemonPomodoroEngine) await window.flickemonPomodoroEngine.init();
        if (window.flickemonEngine) await window.flickemonEngine.init();

        // Create extension container root
        const rootContainer = document.createElement('div');
        rootContainer.className = 'flickemon-ext-root';

        // Instantiate UIs
        const pomodoroUI = new window.FlickemonPomodoroUI(window.flickemonPomodoroEngine);
        const flickemonUI = new window.FlickemonUI(window.flickemonEngine);

        // Inject elements into DOM
        function injectUI() {
            // Inject Pomodoro & Flickemon Widgets below video / side container
            const containerTarget = document.querySelector('ion-col[size="12"]') || document.querySelector('.scroll-area') || document.body;
            if (containerTarget && !containerTarget.querySelector('.flickemon-widget-card')) {
                const widgetWrapper = document.createElement('div');
                widgetWrapper.className = 'flickemon-widgets-wrapper';
                widgetWrapper.appendChild(pomodoroUI.render());
                widgetWrapper.appendChild(flickemonUI.renderWidget());
                containerTarget.appendChild(widgetWrapper);
            }
        }

        injectUI();
        const observer = new MutationObserver(() => injectUI());
        observer.observe(document.body, { childList: true, subtree: true });

        // Hook Video progress
        let lastVideoTime = 0;
        function hookVideoPlayer() {
            const video = document.querySelector('video');
            if (!video || video.dataset.flickemonHooked) return;
            video.dataset.flickemonHooked = 'true';

            video.addEventListener('timeupdate', () => {
                if (video.paused || video.seeking) {
                    lastVideoTime = video.currentTime;
                    return;
                }

                const delta = video.currentTime - lastVideoTime;
                if (delta > 0 && delta < 10) {
                    // Check if pomodoro is on break — if so, pause battle damage!
                    const isBreak = window.flickemonPomodoroEngine &&
                        window.flickemonPomodoroEngine.currentPhase.key !== 'study' &&
                        window.flickemonPomodoroEngine.timerState === 'running';

                    if (!isBreak && window.flickemonEngine) {
                        window.flickemonEngine.onVideoProgress(delta);
                    }
                }
                lastVideoTime = video.currentTime;
            });
        }

        setInterval(hookVideoPlayer, 1000);
        console.log('[Flickémon Extension] Fully initialized and hooked to page.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExtension);
    } else {
        initExtension();
    }
})();

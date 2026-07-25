/**
 * Theme Engine (Chrome Extension)
 * ────────────────────────────────
 * Manages theme modes: 'light' | 'dark' | 'pink' | 'device'
 * Persists preferences in chrome.storage.local and applies CSS classes to extension root.
 */

class ThemeEngine {
    constructor() {
        this.STORAGE_KEY = 'flickemon_ext_theme';
        this.currentTheme = 'device';
        this.listeners = [];
        this.systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

        this.systemDarkQuery.addEventListener('change', () => {
            if (this.currentTheme === 'device') {
                this.applyTheme();
                this.notify();
            }
        });
    }

    async init() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const data = await chrome.storage.local.get([this.STORAGE_KEY]);
            if (data && data[this.STORAGE_KEY]) {
                this.currentTheme = data[this.STORAGE_KEY];
            }
        }
        this.applyTheme();
    }

    getEffectiveTheme() {
        if (this.currentTheme === 'device') {
            return this.systemDarkQuery.matches ? 'dark' : 'light';
        }
        return this.currentTheme;
    }

    setTheme(mode) {
        this.currentTheme = mode;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [this.STORAGE_KEY]: mode });
        }
        this.applyTheme();
        this.notify();
    }

    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.currentTheme, this.getEffectiveTheme());
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify() {
        const effective = this.getEffectiveTheme();
        this.listeners.forEach(cb => cb(this.currentTheme, effective));
    }

    applyTheme() {
        const effective = this.getEffectiveTheme();
        const root = document.querySelector('.flickemon-ext-root') || document.documentElement;

        root.classList.toggle('dark-theme', effective === 'dark');
        root.classList.toggle('pink-theme', effective === 'pink');
    }
}

window.flickemonThemeEngine = new ThemeEngine();

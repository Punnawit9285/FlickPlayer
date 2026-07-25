/**
 * Theme UI Component (Chrome Extension)
 * ──────────────────────────────────────
 * Injects a theme dropdown in the toolbar area.
 * Allows picking Light ☀️, Dark 🌙, Pink 💗, or Device Default 📱.
 */

class ThemeUI {
    constructor(themeEngine) {
        this.themeEngine = themeEngine;
        this.isOpen = false;
        this.container = null;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flickemon-theme-dropdown-wrapper';

        wrapper.innerHTML = `
            <button class="flickemon-theme-btn" title="Change Theme">
                <span class="theme-icon">📱</span>
            </button>
            <div class="flickemon-theme-popover" style="display: none;">
                <div class="theme-option" data-mode="light"><span>☀️</span> Light theme</div>
                <div class="theme-option" data-mode="dark"><span>🌙</span> Dark theme</div>
                <div class="theme-option" data-mode="pink"><span>💗</span> Pink theme</div>
                <div class="theme-option" data-mode="device"><span>📱</span> Device default</div>
            </div>
        `;

        const btn = wrapper.querySelector('.flickemon-theme-btn');
        const popover = wrapper.querySelector('.flickemon-theme-popover');
        const iconSpan = wrapper.querySelector('.theme-icon');

        const icons = {
            light: '☀️',
            dark: '🌙',
            pink: '💗',
            device: '📱',
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen = !this.isOpen;
            popover.style.display = this.isOpen ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
            this.isOpen = false;
            popover.style.display = 'none';
        });

        wrapper.querySelectorAll('.theme-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const mode = opt.getAttribute('data-mode');
                this.themeEngine.setTheme(mode);
                this.isOpen = false;
                popover.style.display = 'none';
            });
        });

        this.themeEngine.subscribe((mode) => {
            iconSpan.textContent = icons[mode] || '📱';
            wrapper.querySelectorAll('.theme-option').forEach(opt => {
                const optMode = opt.getAttribute('data-mode');
                opt.classList.toggle('active', optMode === mode);
            });
        });

        this.container = wrapper;
        return wrapper;
    }
}

window.FlickemonThemeUI = ThemeUI;

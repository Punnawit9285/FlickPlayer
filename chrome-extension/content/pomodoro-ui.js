/**
 * Pomodoro UI Component (Chrome Extension)
 * ─────────────────────────────────────────
 * Renders the Pomodoro timer card widget matching the FlickPlayer aesthetic.
 */

class PomodoroUI {
    constructor(pomodoroEngine) {
        this.engine = pomodoroEngine;
        this.container = null;
        this.showSettings = false;
    }

    render() {
        const card = document.createElement('div');
        card.className = 'flickemon-card pomodoro-card';

        card.innerHTML = `
            <div class="pomodoro-header">
                <div class="header-left">
                    <span class="pomodoro-icon">⏱️</span>
                    <span class="header-title">Pomodoro Timer</span>
                </div>
                <div class="header-actions">
                    <button class="icon-btn settings-toggle-btn" title="Timer Settings">⚙️</button>
                    <button class="icon-btn collapse-toggle-btn" title="Collapse">▼</button>
                </div>
            </div>
            <div class="pomodoro-body">
                <div class="phase-badge">Study</div>
                <div class="timer-display">25:00</div>
                <div class="progress-bar-track">
                    <div class="progress-bar-fill" style="width: 100%;"></div>
                </div>
                <div class="controls-row">
                    <button class="pomo-btn primary-btn start-btn">Start</button>
                    <button class="pomo-btn secondary-btn pause-btn" style="display:none;">Pause</button>
                    <button class="pomo-btn secondary-btn resume-btn" style="display:none;">Resume</button>
                    <button class="pomo-btn danger-btn reset-btn">Reset</button>
                    <button class="pomo-btn tertiary-btn skip-btn">Skip ⏭️</button>
                </div>
                <div class="settings-panel" style="display: none;">
                    <h4>Custom Durations (mins)</h4>
                    <div class="duration-inputs">
                        <label>Study: <input type="number" class="study-input" min="1" max="120" value="25"></label>
                        <label>Break: <input type="number" class="break-input" min="1" max="60" value="5"></label>
                        <label>Long Break: <input type="number" class="long-break-input" min="1" max="60" value="20"></label>
                    </div>
                    <button class="pomo-btn save-settings-btn">Save Settings</button>
                </div>
            </div>
        `;

        const phaseBadge = card.querySelector('.phase-badge');
        const timerDisplay = card.querySelector('.timer-display');
        const progressFill = card.querySelector('.progress-bar-fill');
        const startBtn = card.querySelector('.start-btn');
        const pauseBtn = card.querySelector('.pause-btn');
        const resumeBtn = card.querySelector('.resume-btn');
        const resetBtn = card.querySelector('.reset-btn');
        const skipBtn = card.querySelector('.skip-btn');
        const settingsToggleBtn = card.querySelector('.settings-toggle-btn');
        const collapseToggleBtn = card.querySelector('.collapse-toggle-btn');
        const settingsPanel = card.querySelector('.settings-panel');
        const pomoBody = card.querySelector('.pomodoro-body');
        const saveSettingsBtn = card.querySelector('.save-settings-btn');

        const studyInput = card.querySelector('.study-input');
        const breakInput = card.querySelector('.break-input');
        const longBreakInput = card.querySelector('.long-break-input');

        startBtn.addEventListener('click', () => this.engine.start());
        pauseBtn.addEventListener('click', () => this.engine.pause());
        resumeBtn.addEventListener('click', () => this.engine.resume());
        resetBtn.addEventListener('click', () => this.engine.reset());
        skipBtn.addEventListener('click', () => this.engine.skipPhase());

        let isCollapsed = false;
        collapseToggleBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            pomoBody.style.display = isCollapsed ? 'none' : 'block';
            collapseToggleBtn.textContent = isCollapsed ? '▲' : '▼';
        });

        settingsToggleBtn.addEventListener('click', () => {
            this.showSettings = !this.showSettings;
            settingsPanel.style.display = this.showSettings ? 'block' : 'none';
        });

        saveSettingsBtn.addEventListener('click', () => {
            this.engine.updateDurations({
                studyMinutes: parseInt(studyInput.value, 10) || 25,
                breakMinutes: parseInt(breakInput.value, 10) || 5,
                longBreakMinutes: parseInt(longBreakInput.value, 10) || 20,
            });
            this.showSettings = false;
            settingsPanel.style.display = 'none';
        });

        this.engine.subscribe((state) => {
            phaseBadge.textContent = `${state.currentPhase.label} (${state.completedSessions} completed)`;
            timerDisplay.textContent = state.formattedTime;

            const total = (state.durations[state.currentPhase.durationKey] || 25) * 60;
            const pct = Math.round((state.timeRemaining / total) * 100);
            progressFill.style.width = `${pct}%`;

            if (state.timerState === 'running') {
                startBtn.style.display = 'none';
                pauseBtn.style.display = 'inline-block';
                resumeBtn.style.display = 'none';
            } else if (state.timerState === 'paused') {
                startBtn.style.display = 'none';
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'inline-block';
            } else {
                startBtn.style.display = 'inline-block';
                pauseBtn.style.display = 'none';
                resumeBtn.style.display = 'none';
            }

            studyInput.value = state.durations.studyMinutes;
            breakInput.value = state.durations.breakMinutes;
            longBreakInput.value = state.durations.longBreakMinutes;
        });

        this.container = card;
        return card;
    }
}

window.FlickemonPomodoroUI = PomodoroUI;

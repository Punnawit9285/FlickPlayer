/**
 * Pomodoro Engine (Chrome Extension)
 * ──────────────────────────────────
 * Port of PomodoroService.
 * Manages Study (25m), Break (5m), and Long Break (20m) timer phases.
 * Triggers audio chiming and desktop notifications on phase transitions.
 */

const POMODORO_PHASES = [
    {
        key: 'study',
        label: 'Study',
        durationKey: 'studyMinutes',
        startMessage: 'Study session started! Focus on learning.',
        endMessage: 'Study session completed! Great job.',
    },
    {
        key: 'break',
        label: 'Break',
        durationKey: 'breakMinutes',
        startMessage: 'Break started! Take a short rest.',
        endMessage: 'Break finished! Time to get back to studying.',
    },
    {
        key: 'longBreak',
        label: 'Long Break',
        durationKey: 'longBreakMinutes',
        startMessage: 'Long break started! Enjoy a well-deserved rest.',
        endMessage: 'Long break finished! Ready for the next cycle.',
    },
];

const DEFAULT_DURATIONS = {
    studyMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 20,
};

class PomodoroEngine {
    constructor() {
        this.STORAGE_KEY = 'pomodoro_ext_prefs';
        this.durations = { ...DEFAULT_DURATIONS };
        this.sessionsBeforeLongBreak = 4;

        this.timerState = 'idle'; // 'idle' | 'running' | 'paused'
        this.currentPhase = POMODORO_PHASES[0];
        this.timeRemaining = DEFAULT_DURATIONS.studyMinutes * 60;
        this.completedSessions = 0;
        this.studySessionsInCycle = 0;

        this.listeners = [];
        this.tickInterval = null;
        this.audioContext = null;
    }

    async init() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const data = await chrome.storage.local.get([this.STORAGE_KEY]);
            if (data && data[this.STORAGE_KEY]) {
                const prefs = data[this.STORAGE_KEY];
                if (prefs.durations) {
                    this.durations = { ...this.durations, ...prefs.durations };
                }
                if (prefs.sessionsBeforeLongBreak) {
                    this.sessionsBeforeLongBreak = prefs.sessionsBeforeLongBreak;
                }
            }
        }
        this.resetToPhase(this.getStudyPhase());
    }

    subscribe(callback) {
        this.listeners.push(callback);
        this.notify();
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify() {
        const state = {
            timerState: this.timerState,
            currentPhase: this.currentPhase,
            timeRemaining: this.timeRemaining,
            formattedTime: this.formatTime(this.timeRemaining),
            completedSessions: this.completedSessions,
            durations: { ...this.durations },
            isPomodoroBreak: this.currentPhase.key !== 'study' && this.timerState === 'running',
        };
        this.listeners.forEach(cb => cb(state));
    }

    getStudyPhase() { return POMODORO_PHASES.find(p => p.key === 'study'); }
    getBreakPhase() { return POMODORO_PHASES.find(p => p.key === 'break'); }
    getLongBreakPhase() { return POMODORO_PHASES.find(p => p.key === 'longBreak'); }

    getCurrentPhaseDuration() {
        return (this.durations[this.currentPhase.durationKey] || 25) * 60;
    }

    resetToPhase(phase) {
        this.currentPhase = phase;
        this.timeRemaining = this.getCurrentPhaseDuration();
        this.notify();
    }

    start() {
        if (this.timerState === 'running') return;
        if (this.timerState === 'idle') {
            this.timeRemaining = this.getCurrentPhaseDuration();
            this.notifyPhase(this.currentPhase, true);
        }
        this.timerState = 'running';
        this.startTicking();
        this.notify();
    }

    pause() {
        if (this.timerState !== 'running') return;
        this.timerState = 'paused';
        this.stopTicking();
        this.notify();
    }

    resume() {
        if (this.timerState !== 'paused') return;
        this.timerState = 'running';
        this.startTicking();
        this.notify();
    }

    reset() {
        this.stopTicking();
        this.timerState = 'idle';
        this.studySessionsInCycle = 0;
        this.completedSessions = 0;
        this.resetToPhase(this.getStudyPhase());
    }

    skipPhase() {
        this.stopTicking();
        this.advancePhase();
        if (this.timerState === 'running') {
            this.startTicking();
        }
    }

    updateDurations(newDurations) {
        this.durations = { ...this.durations, ...newDurations };
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                [this.STORAGE_KEY]: {
                    durations: this.durations,
                    sessionsBeforeLongBreak: this.sessionsBeforeLongBreak,
                }
            });
        }
        if (this.timerState === 'idle') {
            this.timeRemaining = this.getCurrentPhaseDuration();
        }
        this.notify();
    }

    startTicking() {
        this.stopTicking();
        this.tickInterval = setInterval(() => {
            this.timeRemaining--;
            if (this.timeRemaining <= 0) {
                this.timeRemaining = 0;
                this.playNotificationSound();
                this.advancePhase();
            } else {
                this.notify();
            }
        }, 1000);
    }

    stopTicking() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }

    advancePhase() {
        if (this.currentPhase.key === 'study') {
            this.studySessionsInCycle++;
            this.completedSessions++;
            if (this.studySessionsInCycle >= this.sessionsBeforeLongBreak) {
                this.studySessionsInCycle = 0;
                this.resetToPhase(this.getLongBreakPhase());
            } else {
                this.resetToPhase(this.getBreakPhase());
            }
        } else {
            this.resetToPhase(this.getStudyPhase());
        }
        this.notifyPhase(this.currentPhase, true);
    }

    notifyPhase(phase, isStart) {
        const title = `Pomodoro: ${phase.label}`;
        const body = isStart ? phase.startMessage : phase.endMessage;

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, { body, requireInteraction: false });
            } catch (e) {}
        }
    }

    playNotificationSound() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const now = this.audioContext.currentTime;
            const osc1 = this.audioContext.createOscillator();
            const osc2 = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now); // D5
            osc2.frequency.setValueAtTime(880.00, now + 0.15); // A5

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.audioContext.destination);

            osc1.start(now);
            osc1.stop(now + 0.15);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.6);
        } catch (e) {}
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

window.flickemonPomodoroEngine = new PomodoroEngine();

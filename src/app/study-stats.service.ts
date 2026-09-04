import {inject, Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {AuthService} from './auth.service';

/** Aggregated activity for a single calendar day (local time). */
export interface StudyDay {
    seconds: number;
    videoIds: number[];
    pomodoros: number;
}

/** Activity keyed by local date (YYYY-MM-DD). */
export interface StudyDayMap {
    [date: string]: StudyDay;
}

export interface StudyStats {
    daysStudied: number;
    daysInRange: number;
    totalSeconds: number;
    averageSeconds: number;
    currentStreak: number;
    longestStreak: number;
    busiestDate: string | null;
    busiestSeconds: number;
    pomodoros: number;
    videos: number;
}

export interface HeatmapRange {
    key: string;
    label: string;
    months: number | null;
}

export const HEATMAP_RANGES: HeatmapRange[] = [
    {key: '3m', label: '3 months', months: 3},
    {key: '6m', label: '6 months', months: 6},
    {key: '1y', label: 'Year', months: 12},
    {key: 'all', label: 'All time', months: null},
];

export const DEFAULT_HEATMAP_RANGE = '1y';

export function toDateKey(date: Date): string {
    return date.getFullYear()
        + '-' + String(date.getMonth() + 1).padStart(2, '0')
        + '-' + String(date.getDate()).padStart(2, '0');
}

export function fromDateKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number): Date {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + amount);
    return result;
}

/** Number of calendar days from `from` to `to`, inclusive. */
export function daysBetween(from: Date, to: Date): number {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    return Math.round((end - start) / 86400000) + 1;
}

function emptyDay(): StudyDay {
    return {seconds: 0, videoIds: [], pomodoros: 0};
}

/**
 * Summarise activity between two date keys (both inclusive).
 * Streaks are measured inside the window, so they follow the selected range.
 */
export function computeStudyStats(days: StudyDayMap, startKey: string, endKey: string): StudyStats {
    const studied = Object.keys(days)
        .filter(key => key >= startKey && key <= endKey && days[key].seconds > 0)
        .sort();

    const stats: StudyStats = {
        daysStudied: studied.length,
        daysInRange: daysBetween(fromDateKey(startKey), fromDateKey(endKey)),
        totalSeconds: 0,
        averageSeconds: 0,
        currentStreak: 0,
        longestStreak: 0,
        busiestDate: null,
        busiestSeconds: 0,
        pomodoros: 0,
        videos: 0,
    };

    const watchedVideos = new Set<number>();
    let run = 0;
    let previous: string | null = null;
    for (const key of studied) {
        const day = days[key];
        stats.totalSeconds += day.seconds;
        stats.pomodoros += day.pomodoros;
        day.videoIds.forEach(id => watchedVideos.add(id));
        if (day.seconds > stats.busiestSeconds) {
            stats.busiestSeconds = day.seconds;
            stats.busiestDate = key;
        }
        run = (previous && toDateKey(addDays(fromDateKey(previous), 1)) === key) ? run + 1 : 1;
        stats.longestStreak = Math.max(stats.longestStreak, run);
        previous = key;
    }

    stats.videos = watchedVideos.size;
    stats.averageSeconds = studied.length ? Math.round(stats.totalSeconds / studied.length) : 0;

    // The streak may start today or yesterday — a day without study only breaks it once it is over.
    let cursor = fromDateKey(endKey);
    if (!studied.includes(endKey)) {
        cursor = addDays(cursor, -1);
    }
    while (days[toDateKey(cursor)]?.seconds > 0 && toDateKey(cursor) >= startKey) {
        stats.currentStreak++;
        cursor = addDays(cursor, -1);
    }

    return stats;
}

/**
 * Tracks how much time the user spends studying each day and keeps it in local storage.
 *
 * Video playback and the Pomodoro timer both report activity as they run. Time is credited
 * from the wall clock gap between reports, so two sources running at once are counted once.
 */
@Injectable({
    providedIn: 'root',
})
export class StudyStatsService {
    private readonly STORAGE_KEY_PREFIX = 'studyStats_';
    private readonly GUEST_ID = 'guest';
    /** Gaps longer than this mean the user stopped studying, so nothing is credited. */
    private readonly IDLE_GAP_MS = 10000;
    private readonly SAVE_INTERVAL_MS = 10000;
    private readonly RETENTION_DAYS = 1100;

    private currentUserId = this.GUEST_ID;
    private days: StudyDayMap = {};
    private lastActiveAt = 0;
    private lastSavedAt = 0;

    private readonly activitySubject = new BehaviorSubject<StudyDayMap>({});
    readonly activity$: Observable<StudyDayMap> = this.activitySubject.asObservable();

    constructor() {
        this.days = this.load(this.currentUserId);
        this.activitySubject.next(this.days);

        inject(AuthService).user.subscribe(user => {
            if (user?.uid) {
                this.loadForUser(user.uid);
            } else if (this.currentUserId !== this.GUEST_ID) {
                this.clearForUser();
            }
        });

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.save();
                }
            });
            window.addEventListener('pagehide', () => this.save());
        }
    }

    /**
     * Switch to a signed-in user, merging anything recorded before authentication resolved.
     */
    loadForUser(uid: string): void {
        if (this.currentUserId === uid) {
            return;
        }
        const pending = this.currentUserId === this.GUEST_ID ? this.days : {};
        this.save();
        this.currentUserId = uid;
        this.days = this.load(uid);
        for (const key of Object.keys(pending)) {
            const target = this.days[key] ?? emptyDay();
            target.seconds += pending[key].seconds;
            target.pomodoros += pending[key].pomodoros;
            target.videoIds = [...new Set([...target.videoIds, ...pending[key].videoIds])];
            this.days[key] = target;
        }
        if (Object.keys(pending).length) {
            this.remove(this.GUEST_ID);
            this.save(true);
        }
        this.activitySubject.next(this.days);
    }

    /** Detach the signed-in user's history (call on sign out). */
    clearForUser(): void {
        this.save();
        this.currentUserId = this.GUEST_ID;
        this.days = this.load(this.GUEST_ID);
        this.lastActiveAt = 0;
        this.activitySubject.next(this.days);
    }

    /** Report that a video is still playing. Called repeatedly while playback runs. */
    recordVideoProgress(videoId: number | null): void {
        const today = this.credit();
        if (videoId != null && !today.videoIds.includes(videoId)) {
            today.videoIds.push(videoId);
            this.publish(true);
        }
    }

    /** Report that a Pomodoro study phase is running. Called once per second. */
    recordFocusTick(): void {
        this.credit();
    }

    /** Report a finished Pomodoro study phase. */
    recordFocusSession(): void {
        const today = this.credit();
        today.pomodoros++;
        this.publish(true);
    }

    getDays(): StudyDayMap {
        return this.days;
    }

    /** Earliest day with any recorded activity. */
    getFirstActiveDate(): Date | null {
        const keys = Object.keys(this.days).filter(key => this.days[key].seconds > 0).sort();
        return keys.length ? fromDateKey(keys[0]) : null;
    }

    private credit(): StudyDay {
        const now = Date.now();
        const elapsed = now - this.lastActiveAt;
        this.lastActiveAt = now;

        const key = toDateKey(new Date(now));
        const today = this.days[key] ?? emptyDay();
        this.days[key] = today;

        if (elapsed > 0 && elapsed <= this.IDLE_GAP_MS) {
            today.seconds += elapsed / 1000;
            if (now - this.lastSavedAt > this.SAVE_INTERVAL_MS) {
                this.publish(true);
            }
        }
        return today;
    }

    private publish(persist: boolean): void {
        if (persist) {
            this.save(true);
        }
        this.activitySubject.next({...this.days});
    }

    private load(uid: string): StudyDayMap {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY_PREFIX + uid);
            if (!raw) {
                return {};
            }
            const parsed = JSON.parse(raw);
            const days: StudyDayMap = {};
            for (const key of Object.keys(parsed?.days ?? {})) {
                const day = parsed.days[key];
                days[key] = {
                    seconds: Number(day?.seconds) || 0,
                    videoIds: Array.isArray(day?.videoIds) ? day.videoIds : [],
                    pomodoros: Number(day?.pomodoros) || 0,
                };
            }
            return days;
        } catch {
            return {};
        }
    }

    private save(force = false): void {
        if (!force && !Object.keys(this.days).length) {
            return;
        }
        this.lastSavedAt = Date.now();
        const oldest = toDateKey(addDays(new Date(), -this.RETENTION_DAYS));
        const days: StudyDayMap = {};
        for (const key of Object.keys(this.days)) {
            if (key >= oldest) {
                days[key] = {...this.days[key], seconds: Math.round(this.days[key].seconds)};
            }
        }
        try {
            localStorage.setItem(this.STORAGE_KEY_PREFIX + this.currentUserId, JSON.stringify({version: 1, days}));
        } catch {
            // Storage may be full or disabled — activity for this session is still kept in memory.
        }
    }

    private remove(uid: string): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY_PREFIX + uid);
        } catch {
            // Ignore
        }
    }
}

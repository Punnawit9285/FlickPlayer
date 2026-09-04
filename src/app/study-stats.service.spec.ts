import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';

import {AuthService} from './auth.service';
import {addDays, computeStudyStats, StudyDayMap, StudyStatsService, toDateKey} from './study-stats.service';

function daysFrom(offsets: number[], seconds = 600): StudyDayMap {
    const map: StudyDayMap = {};
    for (const offset of offsets) {
        map[toDateKey(addDays(new Date(), offset))] = {seconds, videoIds: [], pomodoros: 0};
    }
    return map;
}

describe('StudyStatsService', () => {
    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({
            providers: [{provide: AuthService, useValue: {user: of(null)}}],
        });
    });

    it('should be created', () => {
        expect(TestBed.inject(StudyStatsService)).toBeTruthy();
    });

    it('should record a watched video against today', () => {
        const service = TestBed.inject(StudyStatsService);
        service.recordVideoProgress(42);
        const today = service.getDays()[toDateKey(new Date())];
        expect(today.videoIds).toEqual([42]);
    });
});

describe('computeStudyStats', () => {
    const today = toDateKey(new Date());
    const start = toDateKey(addDays(new Date(), -29));

    it('should count a streak that ends today', () => {
        const stats = computeStudyStats(daysFrom([0, -1, -2, -5]), start, today);
        expect(stats.currentStreak).toBe(3);
        expect(stats.longestStreak).toBe(3);
        expect(stats.daysStudied).toBe(4);
    });

    it('should keep the streak alive on a day that has not been studied yet', () => {
        const stats = computeStudyStats(daysFrom([-1, -2]), start, today);
        expect(stats.currentStreak).toBe(2);
    });

    it('should break the streak after a missed day', () => {
        const stats = computeStudyStats(daysFrom([-2, -3]), start, today);
        expect(stats.currentStreak).toBe(0);
        expect(stats.longestStreak).toBe(2);
    });

    it('should total and average only the days studied', () => {
        const stats = computeStudyStats(daysFrom([0, -1], 900), start, today);
        expect(stats.totalSeconds).toBe(1800);
        expect(stats.averageSeconds).toBe(900);
        expect(stats.daysInRange).toBe(30);
    });

    it('should ignore days outside the window', () => {
        const stats = computeStudyStats(daysFrom([0, -40]), start, today);
        expect(stats.daysStudied).toBe(1);
    });
});

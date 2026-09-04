import {contrastRatio, parseColor} from './color';
import {buildThemeVariables} from './palette';
import {
    BASE_SCHEMES,
    DEFAULT_BACKGROUND,
    MIN_MUTED_CONTRAST,
    MIN_SERIES_CONTRAST,
    MIN_TEXT_CONTRAST,
    SERIES_COUNT,
    THEME_PRESETS,
} from './theme-presets';
import {ColorScheme, SEMANTIC_ROLES, ThemeSeed} from './theme.model';

const SCHEMES: ColorScheme[] = ['light', 'dark'];

function ratio(first: string, second: string): number {
    return contrastRatio(parseColor(first), parseColor(second));
}

function build(seed: ThemeSeed, scheme: ColorScheme, background = DEFAULT_BACKGROUND) {
    return buildThemeVariables(seed, scheme, background);
}

describe('buildThemeVariables', () => {
    it('should leave the base palette untouched for the default theme', () => {
        for (const scheme of SCHEMES) {
            const variables = build(THEME_PRESETS[0].seed, scheme);
            const base = BASE_SCHEMES[scheme];
            expect(variables['--ion-background-color']).toBe(base.background);
            expect(variables['--ion-text-color']).toBe(base.text);
            for (const role of SEMANTIC_ROLES) {
                expect(variables[`--ion-color-${role}`]).toBe(base.roles[role]);
            }
        }
    });

    it('should derive Ionic shade, tint and contrast the same way Ionic does', () => {
        const variables = build(THEME_PRESETS[0].seed, 'light');
        expect(variables['--ion-color-primary-shade']).toBe('#3171e0');
        expect(variables['--ion-color-primary-tint']).toBe('#4c8dff');
        expect(variables['--ion-color-primary-contrast']).toBe('#ffffff');
        expect(variables['--ion-color-warning-contrast']).toBe('#000000');
    });

    it('should keep body text readable in every preset and mode', () => {
        for (const preset of THEME_PRESETS) {
            for (const scheme of SCHEMES) {
                const variables = build(preset.seed, scheme);
                const contrast = ratio(variables['--ion-text-color'], variables['--ion-background-color']);
                expect(contrast).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
            }
        }
    });

    it('should keep secondary text readable on every surface', () => {
        const surfaces = [
            '--ion-background-color', '--ion-card-background',
            '--ion-item-background', '--ion-toolbar-background', '--flick-surface-muted',
        ];
        for (const preset of THEME_PRESETS) {
            for (const scheme of SCHEMES) {
                const variables = build(preset.seed, scheme);
                for (const surface of surfaces) {
                    expect(ratio(variables['--flick-muted-text'], variables[surface]))
                        .toBeGreaterThanOrEqual(MIN_MUTED_CONTRAST - 0.01);
                }
            }
        }
    });

    it('should label every group colour legibly', () => {
        for (const preset of THEME_PRESETS) {
            for (const scheme of SCHEMES) {
                const variables = build(preset.seed, scheme);
                for (let index = 0; index < SERIES_COUNT; index++) {
                    expect(ratio(variables[`--flick-series-${index}`], variables['--flick-on-series']))
                        .toBeGreaterThanOrEqual(MIN_SERIES_CONTRAST - 0.01);
                }
            }
        }
    });

    it('should stay readable when a background colour fights the chosen mode', () => {
        const seed: ThemeSeed = {accent: '#e91e90', companion: null, tertiary: null, surfaceTint: null, intensity: 1};
        const variables = build(seed, 'light', {...DEFAULT_BACKGROUND, color: '#101820'});
        expect(variables['--ion-background-color']).toBe('#101820');
        expect(ratio(variables['--ion-text-color'], '#101820')).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
        expect(variables['--ion-card-background']).not.toBe('#ffffff');
        expect(ratio(variables['--ion-text-color'], variables['--ion-card-background']))
            .toBeGreaterThanOrEqual(MIN_MUTED_CONTRAST);
    });

    it('should give the heatmap a ramp that ends at the accent', () => {
        const variables = build(THEME_PRESETS[2].seed, 'light');
        const levels = [0, 1, 2, 3, 4].map(level => variables[`--flick-heat-${level}`]);
        expect(new Set(levels).size).toBe(levels.length);
        expect(levels[4]).toBe(variables['--flick-accent']);
    });
});

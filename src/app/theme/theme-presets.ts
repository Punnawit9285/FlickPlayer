import {
    BackgroundFitOption,
    BaseScheme,
    SurfaceSteps,
    ColorScheme,
    IntensityOption,
    SchemeOption,
    SemanticRole,
    ThemeBackground,
    ThemePreset,
    ThemeSettings,
} from './theme.model';

/**
 * Neutral starting palettes. With intensity 0 a theme renders exactly these,
 * which keeps the default appearance identical to the untouched app.
 */
export const BASE_SCHEMES: Record<ColorScheme, BaseScheme> = {
    light: {
        background: '#ffffff',
        text: '#000000',
        roles: {
            primary: '#3880ff',
            secondary: '#3dc2ff',
            tertiary: '#5260ff',
            success: '#2dd36f',
            warning: '#ffc409',
            danger: '#eb445a',
            dark: '#222428',
            medium: '#92949c',
            light: '#f4f5f8',
        },
    },
    dark: {
        background: '#121212',
        text: '#ffffff',
        roles: {
            primary: '#428cff',
            secondary: '#50c8ff',
            tertiary: '#6a64ff',
            success: '#2fdf75',
            warning: '#ffd534',
            danger: '#ff4961',
            dark: '#f4f5f8',
            medium: '#989aa2',
            light: '#222428',
        },
    },
};

/**
 * Surfaces are placed relative to whatever the page background ends up being, so a light or
 * dark background always keeps cards, items and toolbars separated from it.
 */
export const SURFACE_STEPS: Record<ColorScheme, SurfaceSteps> = {
    light: {card: 0, item: 0, toolbar: 0},
    dark: {card: 0.05, item: 0.033, toolbar: 0},
};

/** How far each surface is blended towards the accent at full intensity. */
export const ACCENT_WEIGHTS: Record<string, number> = {
    background: 0.06,
    item: 0.1,
    card: 0.1,
    toolbar: 0.22,
    text: 0.3,
};

/**
 * Roles that carry the chosen colour directly. The rest keep their own meaning and are
 * only blended towards the accent by the theme intensity.
 */
export const ACCENT_ROLES: SemanticRole[] = ['primary', 'secondary', 'tertiary'];

export const ROLE_WEIGHTS: Record<SemanticRole, number> = {
    primary: 1,
    secondary: 1,
    tertiary: 1,
    success: 0.18,
    warning: 0.18,
    danger: 0.18,
    dark: 0.15,
    medium: 0.2,
    light: 0.15,
};

/** Ionic's own derivation of the shade and tint variants of a colour. */
export const SHADE_AMOUNT = 0.12;
export const TINT_AMOUNT = 0.1;
/** Above this relative luminance a colour takes black text rather than white. */
export const CONTRAST_LUMINANCE_THRESHOLD = 0.5;

/** Hue offsets used to derive the companion colours when a theme supplies only an accent. */
export const COMPANION_HUE_OFFSET = -18;
export const TERTIARY_HUE_OFFSET = 18;

/** Minimum contrast ratio body text must keep against the page background. */
export const MIN_TEXT_CONTRAST = 7;
/** Minimum contrast ratio accent-coloured text must keep against the page background. */
export const MIN_ACCENT_CONTRAST = 4.5;
/** Minimum contrast the accent roles keep against the page, so buttons stay visible. */
export const MIN_ACCENT_ROLE_CONTRAST = 3.5;
/** Minimum contrast for secondary text such as captions and labels. */
export const MIN_MUTED_CONTRAST = 4.5;
/** How far secondary text is faded towards the page before contrast is enforced. */
export const MUTED_TEXT_WEIGHT = 0.55;
/** Contrast each group colour keeps against the label drawn on it. */
export const MIN_SERIES_CONTRAST = 4.5;

export const COLOR_STEPS = [
    50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950,
];

/** Distinct colours generated for labelled groups such as course years. */
export const SERIES_COUNT = 8;
export const SERIES_SATURATION: Record<ColorScheme, number> = {light: 0.55, dark: 0.5};
export const SERIES_LIGHTNESS: Record<ColorScheme, number> = {light: 0.42, dark: 0.48};

/** How far the informational tag is blended into the page behind it. */
export const TAG_SURFACE_WEIGHT = 0.12;

export const HEATMAP_LEVEL_WEIGHTS = [0.28, 0.5, 0.74, 1];
export const HEATMAP_EMPTY_WEIGHT = 0.08;
/** Contrast the heatmap's strongest level keeps against the page, so it stays visible. */
export const MIN_HEATMAP_CONTRAST = 2.5;

export const FACULTY_ACCENT = '#0f6b3f';
export const UNIVERSITY_ACCENT = '#e91e90';

export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'default',
        name: 'Default',
        description: 'The standard look, in light or dark.',
        seed: {accent: null, companion: null, tertiary: null, surfaceTint: null, intensity: 0},
    },
    {
        id: 'faculty',
        name: 'Faculty',
        description: 'Deep green drawn from the faculty colour.',
        seed: {accent: FACULTY_ACCENT, companion: null, tertiary: null, surfaceTint: null, intensity: 1},
    },
    {
        id: 'university',
        name: 'University',
        description: 'The university pink.',
        seed: {accent: UNIVERSITY_ACCENT, companion: null, tertiary: null, surfaceTint: null, intensity: 1},
    },
    {
        id: 'faculty-university',
        name: 'Faculty & University',
        description: 'Green on a soft pink page.',
        seed: {
            accent: FACULTY_ACCENT,
            companion: UNIVERSITY_ACCENT,
            tertiary: null,
            surfaceTint: UNIVERSITY_ACCENT,
            intensity: 1,
        },
    },
];

export const CUSTOM_PRESET_ID = 'custom';
export const DEFAULT_PRESET_ID = THEME_PRESETS[0].id;

/** Curated accents for the custom picker, chosen to stay legible at any intensity. */
export const ACCENT_SWATCHES: string[] = [
    '#3880ff', '#0f6b3f', '#e91e90', '#0f766e', '#7c3aed',
    '#b45309', '#be123c', '#0369a1', '#4d7c0f', '#475569',
];

export const INTENSITY_OPTIONS: IntensityOption[] = [
    {value: 0.2, label: 'Subtle'},
    {value: 0.6, label: 'Balanced'},
    {value: 1, label: 'Bold'},
];

export const SCHEME_OPTIONS: SchemeOption[] = [
    {value: 'light', label: 'Light', icon: 'sunny-outline'},
    {value: 'dark', label: 'Dark', icon: 'moon-outline'},
    {value: 'system', label: 'System', icon: 'phone-portrait-outline'},
];

export const BACKGROUND_FIT_OPTIONS: BackgroundFitOption[] = [
    {value: 'cover', label: 'Fill'},
    {value: 'contain', label: 'Fit'},
    {value: 'tile', label: 'Tile'},
];

export const DEFAULT_BACKGROUND: ThemeBackground = {
    color: null,
    imageId: null,
    imageOpacity: 0.35,
    imageBlur: 2,
    imageFit: 'cover',
};

export function defaultThemeSettings(): ThemeSettings {
    return {
        presetId: DEFAULT_PRESET_ID,
        seed: {...THEME_PRESETS[0].seed},
        scheme: 'system',
        background: {...DEFAULT_BACKGROUND},
        updatedAt: 0,
    };
}

export function findPreset(id: string): ThemePreset | undefined {
    return THEME_PRESETS.find(preset => preset.id === id);
}

export type ColorScheme = 'light' | 'dark';
export type SchemePreference = ColorScheme | 'system';
export type BackgroundFit = 'cover' | 'contain' | 'tile';

export const SEMANTIC_ROLES = [
    'primary', 'secondary', 'tertiary', 'success', 'warning', 'danger', 'dark', 'medium', 'light',
] as const;

export type SemanticRole = typeof SEMANTIC_ROLES[number];

/**
 * The few values a theme is described by. Everything else in the palette is derived,
 * so a theme never has to enumerate colours for individual features.
 */
export interface ThemeSeed {
    /** Main colour. When null the scheme's own neutral palette is used unchanged. */
    accent: string | null;
    /** Second colour; derived from the accent's hue when null. */
    companion: string | null;
    /** Third colour; derived from the companion's hue when null. */
    tertiary: string | null;
    /** Colour blended into backgrounds and surfaces; falls back to the accent. */
    surfaceTint: string | null;
    /** How strongly the surface tint colours the page. 0 keeps the neutral base palette. */
    intensity: number;
}

export interface ThemeBackground {
    color: string | null;
    imageId: string | null;
    imageOpacity: number;
    imageBlur: number;
    imageFit: BackgroundFit;
}

export interface ThemeSettings {
    presetId: string;
    seed: ThemeSeed;
    scheme: SchemePreference;
    background: ThemeBackground;
    updatedAt: number;
}

export interface ThemePreset {
    id: string;
    name: string;
    description: string;
    seed: ThemeSeed;
}

export interface IntensityOption {
    value: number;
    label: string;
}

export interface SchemeOption {
    value: SchemePreference;
    label: string;
    icon: string;
}

export interface BackgroundFitOption {
    value: BackgroundFit;
    label: string;
}

/** Neutral palette each theme starts from; the accent is blended into it by intensity. */
export interface BaseScheme {
    background: string;
    text: string;
    roles: Record<SemanticRole, string>;
}

/** How far each surface sits from the page background, towards the text colour. */
export interface SurfaceSteps {
    card: number;
    item: number;
    toolbar: number;
}

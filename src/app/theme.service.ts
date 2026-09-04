import {DestroyRef, inject, Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {distinctUntilChanged, map} from 'rxjs/operators';
import {doc, Firestore, onSnapshot, setDoc, Unsubscribe} from '@angular/fire/firestore';
import {ulid} from 'ulid';
import {AuthService} from './auth.service';
import {isValidColor} from './theme/color';
import {buildThemeVariables, CssVariables} from './theme/palette';
import {
    BACKGROUND_FIT_OPTIONS,
    CUSTOM_PRESET_ID,
    DEFAULT_BACKGROUND,
    DEFAULT_PRESET_ID,
    defaultThemeSettings,
    findPreset,
    INTENSITY_OPTIONS,
    SCHEME_OPTIONS,
    THEME_PRESETS,
} from './theme/theme-presets';
import {BackgroundImageStore, prepareBackgroundImage} from './theme/background-store';
import {
    BackgroundFit,
    ColorScheme,
    SchemePreference,
    ThemeSeed,
    ThemeSettings,
} from './theme/theme.model';

/** Mirrors the last applied palette so index.html can paint it before Angular boots. */
export const APPLIED_THEME_KEY = 'flickThemeApplied';
export const THEME_STORAGE_KEY_PREFIX = 'flickTheme_';
export const THEME_SYNC_COLLECTION = 'userThemes';
export const BACKGROUND_IMAGE_CLASS = 'flick-has-background-image';
const GUEST_ID = 'guest';

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function sanitizeColor(value: unknown): string | null {
    return typeof value === 'string' && isValidColor(value) ? value : null;
}

function sanitizeSeed(raw: unknown): ThemeSeed {
    const seed = (raw ?? {}) as Partial<ThemeSeed>;
    return {
        accent: sanitizeColor(seed.accent),
        companion: sanitizeColor(seed.companion),
        tertiary: sanitizeColor(seed.tertiary),
        surfaceTint: sanitizeColor(seed.surfaceTint),
        intensity: clamp(Number(seed.intensity) || 0, 0, 1),
    };
}

/** Accept only values this build understands, so stored or synced data can never break rendering. */
export function sanitizeSettings(raw: unknown): ThemeSettings {
    const fallback = defaultThemeSettings();
    const value = (raw ?? {}) as Partial<ThemeSettings>;
    const background = (value.background ?? {}) as Partial<ThemeSettings['background']>;
    const presetId = typeof value.presetId === 'string'
        && (value.presetId === CUSTOM_PRESET_ID || !!findPreset(value.presetId))
        ? value.presetId
        : fallback.presetId;
    const scheme = SCHEME_OPTIONS.some(option => option.value === value.scheme)
        ? value.scheme as SchemePreference
        : fallback.scheme;
    const imageFit = BACKGROUND_FIT_OPTIONS.some(option => option.value === background.imageFit)
        ? background.imageFit as BackgroundFit
        : DEFAULT_BACKGROUND.imageFit;
    const preset = findPreset(presetId);

    return {
        presetId,
        seed: presetId === CUSTOM_PRESET_ID ? sanitizeSeed(value.seed) : {...preset.seed},
        scheme,
        background: {
            color: sanitizeColor(background.color),
            imageId: typeof background.imageId === 'string' ? background.imageId : null,
            imageOpacity: clamp(Number(background.imageOpacity ?? DEFAULT_BACKGROUND.imageOpacity), 0, 1),
            imageBlur: clamp(Number(background.imageBlur ?? DEFAULT_BACKGROUND.imageBlur), 0, 20),
            imageFit,
        },
        updatedAt: Number(value.updatedAt) || 0,
    };
}

@Injectable({
    providedIn: 'root',
})
export class ThemeService {
    private firestore = inject(Firestore);
    private imageStore = new BackgroundImageStore();

    readonly presets = THEME_PRESETS;
    readonly intensityOptions = INTENSITY_OPTIONS;
    readonly schemeOptions = SCHEME_OPTIONS;
    readonly backgroundFitOptions = BACKGROUND_FIT_OPTIONS;

    private readonly settingsSubject = new BehaviorSubject<ThemeSettings>(defaultThemeSettings());
    private readonly schemeSubject = new BehaviorSubject<ColorScheme>('light');
    private readonly imageUrlSubject = new BehaviorSubject<string | null>(null);

    readonly settings$: Observable<ThemeSettings> = this.settingsSubject.asObservable();
    readonly scheme$: Observable<ColorScheme> = this.schemeSubject.asObservable();
    readonly backgroundImageUrl$: Observable<string | null> = this.imageUrlSubject.asObservable();
    readonly presetId$: Observable<string> = this.settings$.pipe(
        map(settings => settings.presetId),
        distinctUntilChanged(),
    );

    private userId = GUEST_ID;
    private objectUrl: string | null = null;
    private remoteSubscription: Unsubscribe | null = null;
    private darkQuery: MediaQueryList | null = null;

    constructor() {
        const destroyRef = inject(DestroyRef);
        this.darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
        const onSystemChange = () => this.apply(this.settingsSubject.value, false);
        this.darkQuery?.addEventListener('change', onSystemChange);
        destroyRef.onDestroy(() => {
            this.darkQuery?.removeEventListener('change', onSystemChange);
            this.stopRemoteSync();
            this.releaseObjectUrl();
        });

        this.apply(this.readLocal(GUEST_ID), false);

        inject(AuthService).user.subscribe(user => {
            if (user?.uid) {
                this.attachUser(user.uid);
            } else if (this.userId !== GUEST_ID) {
                this.detachUser();
            }
        });
    }

    get settings(): ThemeSettings {
        return this.settingsSubject.value;
    }

    get scheme(): ColorScheme {
        return this.schemeSubject.value;
    }

    selectPreset(presetId: string): void {
        const preset = findPreset(presetId);
        if (preset) {
            this.update({presetId: preset.id, seed: {...preset.seed}});
        }
    }

    setAccent(accent: string): void {
        if (!isValidColor(accent)) {
            return;
        }
        const current = this.settings;
        const intensity = current.presetId === CUSTOM_PRESET_ID
            ? current.seed.intensity
            : INTENSITY_OPTIONS[1].value;
        this.update({
            presetId: CUSTOM_PRESET_ID,
            seed: {accent, companion: null, tertiary: null, surfaceTint: null, intensity},
        });
    }

    setIntensity(intensity: number): void {
        const current = this.settings;
        const seed = {...current.seed, intensity: clamp(intensity, 0, 1)};
        this.update(current.presetId === CUSTOM_PRESET_ID
            ? {seed}
            : {presetId: CUSTOM_PRESET_ID, seed: {...seed, accent: seed.accent ?? this.resolvedAccent()}});
    }

    setScheme(scheme: SchemePreference): void {
        this.update({scheme});
    }

    setBackgroundColor(color: string | null): void {
        if (color !== null && !isValidColor(color)) {
            return;
        }
        this.update({background: {...this.settings.background, color}});
    }

    setBackgroundFit(imageFit: BackgroundFit): void {
        this.update({background: {...this.settings.background, imageFit}});
    }

    setBackgroundOpacity(imageOpacity: number): void {
        this.update({background: {...this.settings.background, imageOpacity: clamp(imageOpacity, 0, 1)}});
    }

    setBackgroundBlur(imageBlur: number): void {
        this.update({background: {...this.settings.background, imageBlur: clamp(imageBlur, 0, 20)}});
    }

    /** Store an uploaded picture on this device and use it as the page background. */
    async setBackgroundImage(file: File): Promise<void> {
        const image = await prepareBackgroundImage(file);
        const imageId = ulid();
        await this.imageStore.save(imageId, image);
        await this.imageStore.prune(imageId);
        this.update({background: {...this.settings.background, imageId}});
    }

    async clearBackgroundImage(): Promise<void> {
        const {imageId} = this.settings.background;
        if (imageId) {
            await this.imageStore.remove(imageId);
        }
        this.update({background: {...this.settings.background, imageId: null}});
    }

    reset(): void {
        const defaults = defaultThemeSettings();
        this.update({
            presetId: defaults.presetId,
            seed: {...defaults.seed},
            scheme: defaults.scheme,
            background: {...defaults.background},
        });
    }

    /** Palette for a seed without applying it, used to preview a theme in the picker. */
    preview(seed: ThemeSeed): CssVariables {
        return buildThemeVariables(seed, this.scheme, DEFAULT_BACKGROUND);
    }

    private resolvedAccent(): string {
        return this.preview(this.settings.seed)['--ion-color-primary'];
    }

    private update(change: Partial<ThemeSettings>): void {
        const next: ThemeSettings = {...this.settings, ...change, updatedAt: Date.now()};
        this.apply(next, true);
    }

    private apply(settings: ThemeSettings, persist: boolean): void {
        const scheme = this.resolveScheme(settings.scheme);
        const variables = buildThemeVariables(settings.seed, scheme, settings.background);

        const root = document.documentElement;
        root.setAttribute('data-theme', scheme);
        for (const [name, value] of Object.entries(variables)) {
            root.style.setProperty(name, value);
        }

        this.updateBrowserThemeColor(variables['--ion-toolbar-background']);
        this.schemeSubject.next(scheme);
        this.settingsSubject.next(settings);
        this.writeAppliedMirror(scheme, variables);
        void this.applyBackgroundImage(settings.background.imageId);

        if (persist) {
            this.writeLocal(settings);
            this.writeRemote(settings);
        }
    }

    private resolveScheme(preference: SchemePreference): ColorScheme {
        if (preference === 'system') {
            return this.darkQuery?.matches ? 'dark' : 'light';
        }
        return preference;
    }

    private async applyBackgroundImage(imageId: string | null): Promise<void> {
        const image = imageId ? await this.imageStore.load(imageId) : null;
        this.releaseObjectUrl();
        if (image) {
            this.objectUrl = URL.createObjectURL(image);
        }
        const root = document.documentElement;
        root.style.setProperty('--flick-background-image', this.objectUrl ? `url("${this.objectUrl}")` : 'none');
        document.body.classList.toggle(BACKGROUND_IMAGE_CLASS, !!this.objectUrl);
        this.imageUrlSubject.next(this.objectUrl);
    }

    /** Keep the browser chrome (address bar, task switcher) in step with the theme. */
    private updateBrowserThemeColor(color: string): void {
        const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (meta) {
            meta.content = color;
        }
    }

    private releaseObjectUrl(): void {
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }
    }

    private attachUser(uid: string): void {
        if (this.userId === uid) {
            return;
        }
        const guestSettings = this.userId === GUEST_ID ? this.settings : null;
        this.userId = uid;
        const stored = this.readLocal(uid);
        const adoptGuest = guestSettings && guestSettings.updatedAt > stored.updatedAt;
        const settings = adoptGuest ? guestSettings : stored;
        this.apply(settings, adoptGuest);
        this.startRemoteSync(uid);
    }

    private detachUser(): void {
        this.stopRemoteSync();
        this.userId = GUEST_ID;
        this.apply(this.readLocal(GUEST_ID), false);
    }

    private startRemoteSync(uid: string): void {
        this.stopRemoteSync();
        try {
            this.remoteSubscription = onSnapshot(
                doc(this.firestore, THEME_SYNC_COLLECTION, uid),
                snapshot => {
                    const remote = snapshot.data();
                    if (!remote) {
                        return;
                    }
                    const settings = sanitizeSettings(remote);
                    if (settings.updatedAt > this.settings.updatedAt) {
                        this.apply(settings, false);
                        this.writeLocal(settings);
                    }
                },
                () => this.stopRemoteSync(),
            );
        } catch {
            this.remoteSubscription = null;
        }
    }

    private stopRemoteSync(): void {
        this.remoteSubscription?.();
        this.remoteSubscription = null;
    }

    private writeRemote(settings: ThemeSettings): void {
        if (this.userId === GUEST_ID) {
            return;
        }
        setDoc(doc(this.firestore, THEME_SYNC_COLLECTION, this.userId), settings, {merge: true})
            .catch(() => this.stopRemoteSync());
    }

    private storageKey(uid: string): string {
        return THEME_STORAGE_KEY_PREFIX + uid;
    }

    private readLocal(uid: string): ThemeSettings {
        try {
            const raw = localStorage.getItem(this.storageKey(uid));
            return sanitizeSettings(raw ? JSON.parse(raw) : null);
        } catch {
            return defaultThemeSettings();
        }
    }

    private writeLocal(settings: ThemeSettings): void {
        try {
            localStorage.setItem(this.storageKey(this.userId), JSON.stringify(settings));
        } catch {
            // Storage may be unavailable; the theme still applies for this session.
        }
    }

    private writeAppliedMirror(scheme: ColorScheme, variables: CssVariables): void {
        try {
            localStorage.setItem(APPLIED_THEME_KEY, JSON.stringify({scheme, variables}));
        } catch {
            // Without the mirror the first paint falls back to the default palette.
        }
    }
}

export {DEFAULT_PRESET_ID, CUSTOM_PRESET_ID};

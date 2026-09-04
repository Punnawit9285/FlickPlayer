import {Component, ElementRef, inject, ViewChild} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonRange,
    IonSegment,
    IonSegmentButton,
    IonText,
    IonTitle,
    IonToolbar,
    ModalController,
} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {close, colorPaletteOutline, imageOutline, moonOutline, phonePortraitOutline, sunnyOutline} from 'ionicons/icons';
import {OWN_COLOR_TEMPLATE_ID, ThemeService} from '../theme.service';
import {ACCENT_SWATCHES, findTemplate} from '../theme/theme-presets';
import {BackgroundFit, SchemePreference, ThemeSettings} from '../theme/theme.model';

function detailValue<T>(event: Event): T | undefined {
    return (event as CustomEvent<{value?: T}>).detail?.value;
}

@Component({
    selector: 'app-theme-editor',
    templateUrl: './theme-editor.component.html',
    styleUrls: ['./theme-editor.component.scss'],
    imports: [
        IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
        IonSegment, IonSegmentButton, IonLabel, IonItem, IonRange, IonText, AsyncPipe,
    ],
})
export class ThemeEditorComponent {
    protected themeService = inject(ThemeService);
    private modalCtrl = inject(ModalController);

    @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;

    protected readonly accentSwatches = ACCENT_SWATCHES;
    protected readonly settings$ = this.themeService.settings$;
    protected readonly backgroundImageUrl$ = this.themeService.backgroundImageUrl$;
    protected imageError: string | null = null;

    constructor() {
        addIcons({close, colorPaletteOutline, imageOutline, sunnyOutline, moonOutline, phonePortraitOutline});
    }

    close(): void {
        this.modalCtrl.dismiss();
    }

    selectTemplate(templateId: string): void {
        this.themeService.selectTemplate(templateId);
    }

    selectAccent(accent: string): void {
        this.themeService.setAccent(accent);
    }

    reset(): void {
        this.imageError = null;
        this.themeService.resetCustom();
    }

    /** Colours of a template as it would look right now, used for the preview chips. */
    previewStyle(templateId: string): Record<string, string> {
        const template = findTemplate(templateId);
        if (!template) {
            return {};
        }
        const variables = this.themeService.preview(template.seed);
        return {
            '--preview-primary': variables['--ion-color-primary'],
            '--preview-secondary': variables['--ion-color-secondary'],
            '--preview-background': variables['--ion-background-color'],
        };
    }

    isAccent(settings: ThemeSettings, swatch: string): boolean {
        return settings.custom.templateId === OWN_COLOR_TEMPLATE_ID
            && settings.custom.seed.accent?.toLowerCase() === swatch.toLowerCase();
    }

    accentValue(settings: ThemeSettings): string {
        return settings.custom.seed.accent
            ?? this.themeService.preview(settings.custom.seed)['--ion-color-primary'];
    }

    backgroundValue(settings: ThemeSettings): string {
        return settings.custom.background.color
            ?? this.themeService.preview(settings.custom.seed)['--ion-background-color'];
    }

    intensityValue(settings: ThemeSettings): number {
        const options = this.themeService.intensityOptions;
        const intensity = settings.custom.seed.intensity;
        return options.reduce((closest, option) =>
            Math.abs(option.value - intensity) < Math.abs(closest - intensity) ? option.value : closest,
            options[0].value);
    }

    onSchemeChange(event: Event): void {
        const value = detailValue<SchemePreference>(event);
        if (value) {
            this.themeService.setCustomScheme(value);
        }
    }

    onIntensityChange(event: Event): void {
        const value = detailValue<number>(event);
        if (typeof value === 'number') {
            this.themeService.setIntensity(value);
        }
    }

    onFitChange(event: Event): void {
        const value = detailValue<BackgroundFit>(event);
        if (value) {
            this.themeService.setBackgroundFit(value);
        }
    }

    onOpacityChange(event: Event): void {
        const value = detailValue<number>(event);
        if (typeof value === 'number') {
            this.themeService.setBackgroundOpacity(value);
        }
    }

    onBlurChange(event: Event): void {
        const value = detailValue<number>(event);
        if (typeof value === 'number') {
            this.themeService.setBackgroundBlur(value);
        }
    }

    onAccentInput(event: Event): void {
        this.themeService.setAccent((event.target as HTMLInputElement).value);
    }

    onBackgroundColorInput(event: Event): void {
        this.themeService.setBackgroundColor((event.target as HTMLInputElement).value);
    }

    clearBackgroundColor(): void {
        this.themeService.setBackgroundColor(null);
    }

    pickImage(): void {
        this.imageError = null;
        this.fileInput?.nativeElement.click();
    }

    async onImageSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) {
            return;
        }
        try {
            await this.themeService.setBackgroundImage(file);
        } catch {
            this.imageError = 'That picture could not be used. Please try another one.';
        }
    }

    async removeImage(): Promise<void> {
        this.imageError = null;
        await this.themeService.clearBackgroundImage();
    }
}

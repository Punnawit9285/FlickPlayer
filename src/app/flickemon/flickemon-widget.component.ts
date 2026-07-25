/**
 * FlickemonWidgetComponent — Compact HUD on course page.
 * Displays active partner on the left and ongoing wild opponent battle with real-time HP bar on the right.
 * Features PopoverController for 3-dots options dropdown (Game Hub, Settings, Hide Flickémon) with overflow clipping.
 */

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import {
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonProgressBar,
    ModalController,
    PopoverController,
} from '@ionic/angular/standalone';
import { FlickemonService, OwnedPokemon, WildOpponent } from './flickemon.service';
import { PokemonSpecies, getSpriteUrl } from './flickemon.config';
import { FlickemonModalComponent } from './flickemon-modal.component';
import { FlickemonStarterComponent } from './flickemon-starter.component';
import { FlickemonSettingsModalComponent } from './flickemon-settings-modal.component';
import { addIcons } from 'ionicons';
import {
    gameController,
    sparkles,
    close,
    trophy,
    ellipsisVertical,
    chevronDown,
    chevronUp,
    cog,
    eyeOff,
    eye,
} from 'ionicons/icons';
import { Subscription } from 'rxjs';

/** Popover component for 3-dots options menu */
@Component({
    selector: 'app-flickemon-options-popover',
    template: `
        <ion-list lines="none" class="flickemon-options-list">
            <ion-item button (click)="selectOption('gameHub')">
                <ion-icon name="game-controller" slot="start" color="primary"></ion-icon>
                <ion-label>Game Hub</ion-label>
            </ion-item>
            <ion-item button (click)="selectOption('settings')">
                <ion-icon name="cog" slot="start" color="medium"></ion-icon>
                <ion-label>Settings</ion-label>
            </ion-item>
        </ion-list>
    `,
    styles: [`
        .flickemon-options-list {
            padding: 0.25rem 0;
            margin: 0;
            background: var(--ion-card-background, var(--ion-background-color, #fff));
        }

        ion-item {
            --padding-start: 0.85rem;
            --padding-end: 0.85rem;
            --min-height: 44px;
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--ion-text-color);
        }
    `],
    imports: [IonList, IonItem, IonIcon, IonLabel],
})
export class FlickemonOptionsPopoverComponent {
    private popoverCtrl = inject(PopoverController);

    constructor() {
        addIcons({ gameController, cog, eyeOff });
    }

    selectOption(action: string): void {
        this.popoverCtrl.dismiss({ action });
    }
}

@Component({
    selector: 'app-flickemon-widget',
    template: `
        @if (!flickemonService.hasStarted()) {
            <!-- Not started: Show start card matching Pomodoro timer shape -->
            <ion-card class="flickemon-card start-card">
                <ion-card-header class="flickemon-header" (click)="openStarterModal()" button>
                    <ion-card-title class="flickemon-title">
                        <div class="title-left">
                            <ion-icon name="game-controller" class="title-icon"></ion-icon>
                            <span>Flickémon</span>
                        </div>
                        <span class="start-badge">Start Game</span>
                    </ion-card-title>
                </ion-card-header>
            </ion-card>
        } @else if (activePokemon && activeSpecies) {
            <!-- Active game: Card matching Pomodoro Timer size, shape & header -->
            <ion-card class="flickemon-card">
                <!-- Card Header with Title, 3-dots Menu & Collapse Toggle -->
                <ion-card-header class="flickemon-header" (click)="toggleCollapse()" button>
                    <ion-card-title class="flickemon-title">
                        <div class="title-left">
                            <ion-icon name="game-controller" class="title-icon"></ion-icon>
                            <span>Flickémon</span>
                        </div>
                        <div class="header-actions" (click)="$event.stopPropagation()">
                            <!-- 3-Dots Options Trigger -->
                            <button class="menu-trigger-btn" (click)="openOptionsPopover($event)" title="Options">
                                <ion-icon name="ellipsis-vertical"></ion-icon>
                            </button>
                            <!-- Collapse Toggle -->
                            <ion-icon
                                [name]="isCollapsed ? 'chevron-down' : 'chevron-up'"
                                class="collapse-icon"
                                (click)="toggleCollapse($event)"
                            ></ion-icon>
                        </div>
                    </ion-card-title>
                </ion-card-header>

                @if (!isCollapsed) {
                    <ion-card-content class="flickemon-content" (click)="openGameHub()">
                        <div class="hud-flex-row">
                            <!-- Active Partner Section (Left) -->
                            <div class="active-partner-box">
                                <img
                                    [src]="flickemonService.getSprite(activeSpecies.id)"
                                    [alt]="activeSpecies.name"
                                    class="widget-sprite"
                                    [class.bounce]="justGainedExp"
                                />
                                <div class="widget-info">
                                    <div class="widget-name-row">
                                        <span class="widget-name">{{ activeSpecies.name }}</span>
                                        <span class="widget-level">Lv.{{ activePokemon.level }}</span>
                                    </div>
                                    <ion-progress-bar
                                        [value]="expProgress.percent / 100"
                                        color="primary"
                                        class="widget-exp-bar"
                                    ></ion-progress-bar>
                                    <span class="widget-exp-text">EXP {{ expProgress.current }}/{{ expProgress.needed }}</span>
                                </div>
                            </div>

                            <!-- Always Displayed Wild Opponent Section (Right) -->
                            @if (wildOpponent) {
                                <div class="encounter-inline-box">
                                    <div class="vs-badge">VS</div>
                                    <img
                                        [src]="flickemonService.getSprite(wildOpponent.wildSpecies.id)"
                                        [alt]="wildOpponent.wildSpecies.name"
                                        class="wild-sprite"
                                        [class.hit]="justGainedExp"
                                    />
                                    <div class="wild-info">
                                        <div class="wild-name-row">
                                            <span class="wild-name">{{ wildOpponent.wildSpecies.name }}</span>
                                            <span class="wild-level">Lv.{{ wildOpponent.wildLevel }}</span>
                                        </div>
                                        <ion-progress-bar
                                            [value]="wildOpponent.currentHp / wildOpponent.maxHp"
                                            color="danger"
                                            class="wild-hp-bar"
                                        ></ion-progress-bar>
                                        <div
                                            class="result-badge"
                                            [class.captured]="wildOpponent.status === 'captured'"
                                            [class.escaped]="wildOpponent.status === 'escaped'"
                                            [class.resting]="wildOpponent.status === 'break'"
                                        >
                                            @if (wildOpponent.status === 'fighting') {
                                                ⚔️ Fighting... (HP {{ wildOpponent.currentHp }}/{{ wildOpponent.maxHp }})
                                            } @else if (wildOpponent.status === 'break') {
                                                ☕ Resting... (Pomodoro Break)
                                            } @else if (wildOpponent.status === 'captured') {
                                                🏆 Captured! (+{{ wildOpponent.expGained }} EXP)
                                            } @else {
                                                💨 Escaped! Level too high (+{{ wildOpponent.expGained }} EXP)
                                            }
                                        </div>
                                    </div>
                                </div>
                            }
                        </div>
                    </ion-card-content>
                }
            </ion-card>

            <!-- Evolution Animation Overlay -->
            @if (evolutionAnim) {
                <div class="evolution-overlay">
                    <div class="evolution-content">
                        <ion-icon name="sparkles" class="evo-sparkle"></ion-icon>
                        <h2 class="evo-title">Evolution!</h2>
                        <div class="evo-sprites">
                            <img [src]="flickemonService.getSprite(evolutionAnim.from.id)" [alt]="evolutionAnim.from.name" class="evo-from"/>
                            <span class="evo-arrow">→</span>
                            <img [src]="flickemonService.getSprite(evolutionAnim.to.id)" [alt]="evolutionAnim.to.name" class="evo-to"/>
                        </div>
                        <p class="evo-message">{{ evolutionAnim.from.name }} evolved into {{ evolutionAnim.to.name }}!</p>
                    </div>
                </div>
            }
        }
    `,
    styles: [`
        :host {
            display: block;
        }

        .unhide-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            margin-top: 0.75rem;
            background: var(--ion-color-light, rgba(0, 0, 0, 0.05));
            border: 1px dashed var(--ion-color-medium);
            border-radius: 0.5rem;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--ion-color-medium);
            cursor: pointer;
        }

        .unhide-icon {
            font-size: 1.1rem;
            color: var(--ion-color-primary);
        }

        .flickemon-card {
            margin: 0.75rem 0 0 0;
            border-radius: 0.75rem;
            overflow: hidden;
            position: relative;
            box-shadow: var(--flick-welcome-card-shadow, 0 4px 16px rgba(0, 0, 0, 0.08));
        }

        .flickemon-header {
            cursor: pointer;
            padding: 0.75rem 1rem;
        }

        .flickemon-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 1rem;
            font-weight: 600;
        }

        .title-left {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .title-icon {
            font-size: 1.2rem;
            color: var(--ion-color-primary);
        }

        .start-badge {
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--ion-color-primary);
            background: rgba(56, 128, 255, 0.1);
            padding: 0.2rem 0.5rem;
            border-radius: 0.35rem;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 0.35rem;
            position: relative;
        }

        .menu-trigger-btn {
            background: transparent;
            border: none;
            outline: none;
            box-shadow: none;
            color: var(--ion-color-medium, #888);
            font-size: 1.1rem;
            padding: 0.2rem;
            border-radius: 0.35rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            transition: background 0.2s ease, color 0.2s ease;
        }

        .menu-trigger-btn:hover {
            background: var(--ion-color-light, rgba(0, 0, 0, 0.05));
            color: var(--ion-text-color);
        }

        .collapse-icon {
            font-size: 1.2rem;
            color: var(--ion-color-medium);
            cursor: pointer;
        }

        .flickemon-content {
            padding: 0 1rem 1rem 1rem;
            cursor: pointer;
        }

        .hud-flex-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .active-partner-box {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex: 1;
            min-width: 220px;
        }

        .widget-sprite {
            width: 48px;
            height: 48px;
            image-rendering: pixelated;
            flex-shrink: 0;
            transition: transform 0.2s ease;
        }

        .widget-sprite.bounce {
            animation: pokeBounce 0.4s ease;
        }

        @keyframes pokeBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
        }

        .widget-info {
            flex: 1;
            min-width: 0;
        }

        .widget-name-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.15rem;
        }

        .widget-name {
            font-weight: 700;
            font-size: 0.95rem;
            color: var(--ion-text-color);
        }

        .widget-level {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--ion-color-medium);
        }

        .widget-exp-bar {
            --progress-background: var(--ion-color-light);
            border-radius: 4px;
            height: 6px;
        }

        .widget-exp-text {
            font-size: 0.65rem;
            color: var(--ion-color-medium);
        }

        /* Inline Wild Opponent Display */
        .encounter-inline-box {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            background: var(--ion-color-light, rgba(255, 255, 255, 0.05));
            border-radius: 10px;
            padding: 0.5rem 0.75rem;
            border: 1.5px solid var(--ion-color-primary, #3b82f6);
            flex: 1;
            min-width: 250px;
            animation: slideInRight 0.35s ease;
        }

        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }

        .vs-badge {
            font-size: 0.75rem;
            font-weight: 800;
            color: #d97706;
            background: #fef3c7;
            border: 1px solid #fde68a;
            padding: 0.15rem 0.4rem;
            border-radius: 0.35rem;
            flex-shrink: 0;
        }

        .wild-sprite {
            width: 44px;
            height: 44px;
            image-rendering: pixelated;
            transition: transform 0.2s ease;
        }

        .wild-sprite.hit {
            animation: hitFlash 0.3s ease;
        }

        @keyframes hitFlash {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(2) drop-shadow(0 0 4px red); }
        }

        .wild-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
        }

        .wild-name-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.15rem;
        }

        .wild-name {
            font-weight: 700;
            font-size: 0.85rem;
            color: var(--ion-text-color);
        }

        .wild-level {
            font-size: 0.75rem;
            color: var(--ion-color-medium);
        }

        .wild-hp-bar {
            --progress-background: var(--ion-color-light);
            --buffer-background: var(--ion-color-light);
            border-radius: 4px;
            height: 6px;
            margin-bottom: 0.15rem;
        }

        .result-badge {
            font-size: 0.7rem;
            font-weight: 600;
            color: var(--ion-color-danger);
        }

        .result-badge.captured {
            color: var(--ion-color-success);
            font-weight: 700;
        }

        .result-badge.escaped {
            color: var(--ion-color-warning);
            font-weight: 700;
        }

        .result-badge.resting {
            color: var(--ion-color-tertiary, #7044ff);
            font-weight: 700;
        }

        /* Evolution Overlay */
        .evolution-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0, 0, 0, 0.75);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .evolution-content {
            text-align: center;
            color: #fff;
        }

        .evo-sparkle {
            font-size: 3rem;
            color: #FFD700;
            animation: sparkleRotate 2s ease-in-out infinite;
        }

        @keyframes sparkleRotate {
            0%, 100% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.3); }
        }

        .evo-title {
            font-size: 2rem;
            font-weight: 800;
            margin: 0.5rem 0;
        }

        .evo-sprites {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1.5rem;
            margin: 1rem 0;
        }

        .evo-from, .evo-to {
            width: 96px;
            height: 96px;
            image-rendering: pixelated;
        }

        .evo-to {
            animation: evoPulse 0.8s ease infinite alternate;
        }

        @keyframes evoPulse {
            from { transform: scale(1); filter: brightness(1); }
            to { transform: scale(1.1); filter: brightness(1.3); }
        }

        .evo-arrow {
            font-size: 2rem;
            font-weight: bold;
            color: #FFD700;
        }

        .evo-message {
            font-size: 1rem;
            color: rgba(255, 255, 255, 0.9);
        }
    `],
    imports: [
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardContent,
        IonIcon,
        IonProgressBar,
    ],
})
export class FlickemonWidgetComponent implements OnInit, OnDestroy {
    flickemonService = inject(FlickemonService);
    private modalCtrl = inject(ModalController);
    private popoverCtrl = inject(PopoverController);

    activePokemon: OwnedPokemon | null = null;
    activeSpecies: PokemonSpecies | null = null;
    expProgress = { current: 0, needed: 0, percent: 0 };
    justGainedExp = false;
    isCollapsed = false;
    isWidgetHidden = false;

    wildOpponent: WildOpponent | null = null;
    evolutionAnim: { from: PokemonSpecies; to: PokemonSpecies } | null = null;

    private stateSub: Subscription | null = null;
    private wildSub: Subscription | null = null;
    private evolutionSub: Subscription | null = null;
    private evolutionTimer: any = null;

    constructor() {
        addIcons({
            gameController,
            sparkles,
            close,
            trophy,
            ellipsisVertical,
            chevronDown,
            chevronUp,
            cog,
            eyeOff,
            eye,
        });
    }

    ngOnInit(): void {
        this.stateSub = this.flickemonService.gameState$.subscribe(state => {
            this.isWidgetHidden = state.isHidden ?? false;
            this.refreshState();
        });

        this.wildSub = this.flickemonService.wildOpponent$.subscribe(opponent => {
            this.wildOpponent = opponent;
            this.justGainedExp = true;
            setTimeout(() => {
                this.justGainedExp = false;
            }, 300);
        });

        this.evolutionSub = this.flickemonService.evolution$.subscribe(evo => {
            this.showEvolution(evo);
        });
    }

    ngOnDestroy(): void {
        this.stateSub?.unsubscribe();
        this.wildSub?.unsubscribe();
        this.evolutionSub?.unsubscribe();
        if (this.evolutionTimer) clearTimeout(this.evolutionTimer);
    }

    private refreshState(): void {
        this.activePokemon = this.flickemonService.getActivePokemon();
        if (this.activePokemon) {
            this.activeSpecies = this.flickemonService.getSpeciesForPokemon(this.activePokemon) ?? null;
            this.expProgress = this.flickemonService.getExpProgress(this.activePokemon);
        }
    }

    toggleCollapse(event?: Event): void {
        if (event) {
            event.stopPropagation();
        }
        this.isCollapsed = !this.isCollapsed;
    }

    unhideWidget(): void {
        this.flickemonService.toggleHide(false);
    }

    async openOptionsPopover(event: Event): Promise<void> {
        event.stopPropagation();
        const popover = await this.popoverCtrl.create({
            component: FlickemonOptionsPopoverComponent,
            event,
            side: 'start',
            alignment: 'start',
            translucent: true,
            showBackdrop: false,
        });
        await popover.present();
        const { data } = await popover.onDidDismiss();
        if (data?.action === 'gameHub') {
            await this.openGameHub();
        } else if (data?.action === 'settings') {
            await this.openSettingsModal();
        } else if (data?.action === 'hide') {
            await this.flickemonService.toggleHide(true);
        }
    }

    private showEvolution(evo: { from: PokemonSpecies; to: PokemonSpecies }): void {
        this.evolutionAnim = evo;
        if (this.evolutionTimer) clearTimeout(this.evolutionTimer);
        this.evolutionTimer = setTimeout(() => {
            this.evolutionAnim = null;
            this.refreshState();
        }, 5000);
    }

    async openStarterModal(): Promise<void> {
        const modal = await this.modalCtrl.create({
            component: FlickemonStarterComponent,
        });
        await modal.present();
        await modal.onDidDismiss();
        this.refreshState();
    }

    async openGameHub(): Promise<void> {
        const modal = await this.modalCtrl.create({
            component: FlickemonModalComponent,
            cssClass: 'flickemon-modal',
        });
        await modal.present();
        await modal.onDidDismiss();
        this.refreshState();
    }

    async openSettingsModal(): Promise<void> {
        const modal = await this.modalCtrl.create({
            component: FlickemonSettingsModalComponent,
            cssClass: 'flickemon-modal',
        });
        await modal.present();
        await modal.onDidDismiss();
        this.refreshState();
    }
}

/**
 * FlickemonWidgetComponent — Compact HUD on course page.
 * Displays active partner on the left and ongoing wild opponent battle with real-time HP bar on the right.
 * Opens the full Game Hub modal on click.
 */

import {Component, inject, OnDestroy, OnInit} from '@angular/core';
import {
    IonCard,
    IonCardContent,
    IonIcon,
    IonProgressBar,
    ModalController,
} from '@ionic/angular/standalone';
import {FlickemonService, OwnedPokemon, EncounterResult, WildOpponent} from './flickemon.service';
import {PokemonSpecies} from './flickemon.config';
import {FlickemonModalComponent} from './flickemon-modal.component';
import {FlickemonStarterComponent} from './flickemon-starter.component';
import {AsyncPipe} from '@angular/common';
import {addIcons} from 'ionicons';
import {gameController, sparkles, close, trophy} from 'ionicons/icons';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-flickemon-widget',
    template: `
        @if (!flickemonService.hasStarted()) {
            <!-- Not started: Show start button -->
            <ion-card class="widget-card start-card" button (click)="openStarterModal()">
                <ion-card-content class="widget-start">
                    <ion-icon name="game-controller" class="start-icon"></ion-icon>
                    <span class="start-text">Start Flickémon!</span>
                </ion-card-content>
            </ion-card>
        } @else if (activePokemon && activeSpecies) {
            <!-- Active game: Show Pokémon HUD -->
            <ion-card class="widget-card" button (click)="openGameHub()">
                <ion-card-content class="widget-content">
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
                                <div class="result-badge" [class.captured]="wildOpponent.status === 'captured'" [class.escaped]="wildOpponent.status === 'escaped'">
                                    @if (wildOpponent.status === 'fighting') {
                                        ⚔️ Fighting... (HP {{ wildOpponent.currentHp }}/{{ wildOpponent.maxHp }})
                                    } @else if (wildOpponent.status === 'captured') {
                                        🏆 Captured! (+{{ wildOpponent.expGained }} EXP)
                                    } @else {
                                        💨 Escaped! Level too high (+{{ wildOpponent.expGained }} EXP)
                                    }
                                </div>
                            </div>
                        </div>
                    }
                </ion-card-content>
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

        .widget-card {
            margin: 0.5rem 0;
            border-radius: 0.75rem;
            overflow: hidden;
        }

        .start-card {
            cursor: pointer;
        }

        .widget-start {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
        }

        .start-icon {
            font-size: 1.5rem;
            color: var(--ion-color-primary);
        }

        .start-text {
            font-size: 1rem;
            font-weight: 700;
            color: var(--ion-text-color);
        }

        .widget-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.5rem 0.75rem;
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
            gap: 0.5rem;
            background: var(--ion-color-light, rgba(255, 255, 255, 0.05));
            border-radius: 0.5rem;
            padding: 0.35rem 0.75rem;
            border: 1px solid var(--ion-color-primary-tint, rgba(56, 128, 255, 0.3));
            flex: 1;
            min-width: 240px;
            animation: slideInRight 0.35s ease;
        }

        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }

        .vs-badge {
            font-size: 0.7rem;
            font-weight: 800;
            color: var(--ion-color-warning);
            background: rgba(255, 196, 9, 0.15);
            padding: 0.15rem 0.4rem;
            border-radius: 0.35rem;
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
        IonCardContent,
        IonIcon,
        IonProgressBar,
    ],
})
export class FlickemonWidgetComponent implements OnInit, OnDestroy {
    flickemonService = inject(FlickemonService);
    private modalCtrl = inject(ModalController);

    activePokemon: OwnedPokemon | null = null;
    activeSpecies: PokemonSpecies | null = null;
    expProgress = {current: 0, needed: 0, percent: 0};
    justGainedExp = false;

    wildOpponent: WildOpponent | null = null;
    evolutionAnim: {from: PokemonSpecies; to: PokemonSpecies} | null = null;

    private stateSub: Subscription | null = null;
    private wildSub: Subscription | null = null;
    private evolutionSub: Subscription | null = null;
    private evolutionTimer: any = null;

    constructor() {
        addIcons({gameController, sparkles, close, trophy});
    }

    ngOnInit(): void {
        this.stateSub = this.flickemonService.gameState$.subscribe(() => {
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

    private showEvolution(evo: {from: PokemonSpecies; to: PokemonSpecies}): void {
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
}

/**
 * FlickemonStarterComponent — First-time starter Pokémon selection modal.
 * Dynamically renders starters across Gen 1-7 with region & game titles.
 */

import {Component, inject, OnInit} from '@angular/core';
import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardTitle,
    IonCol,
    IonGrid,
    IonRow,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    ModalController,
} from '@ionic/angular/standalone';
import {FlickemonService} from './flickemon.service';
import {PokemonSpecies, getSpriteUrl} from './flickemon.config';

export interface GenInfo {
    gen: number;
    label: string;
    region: string;
    games: string;
}

export const GEN_INFO_LIST: Record<string, GenInfo> = {
    '1': {gen: 1, label: 'Gen 1', region: 'Kanto', games: 'Red & Blue'},
    '2': {gen: 2, label: 'Gen 2', region: 'Johto', games: 'Gold, Silver, Crystal'},
    '3': {gen: 3, label: 'Gen 3', region: 'Hoenn', games: 'Ruby, Sapphire, Emerald'},
    '4': {gen: 4, label: 'Gen 4', region: 'Sinnoh', games: 'Diamond, Pearl, Platinum'},
    '5': {gen: 5, label: 'Gen 5', region: 'Unova', games: 'Black & White'},
    '6': {gen: 6, label: 'Gen 6', region: 'Kalos', games: 'X & Y'},
    '7': {gen: 7, label: 'Gen 7', region: 'Alola', games: 'Sun & Moon'},
    'special': {gen: 0, label: 'Special', region: 'Special Starters', games: "Yellow & Let's Go, Pikachu! / Eevee!"},
};

@Component({
    selector: 'app-flickemon-starter',
    template: `
        <div class="starter-backdrop">
            <div class="starter-container">
                <h1 class="starter-title">Choose Your Partner!</h1>
                <p class="starter-subtitle">Select a Pokémon to begin your Flickémon journey</p>

                <ion-segment [value]="selectedGen" (ionChange)="onGenChange($event)" class="gen-segment" scrollable="true">
                    <ion-segment-button value="1"><ion-label>Gen 1</ion-label></ion-segment-button>
                    <ion-segment-button value="2"><ion-label>Gen 2</ion-label></ion-segment-button>
                    <ion-segment-button value="3"><ion-label>Gen 3</ion-label></ion-segment-button>
                    <ion-segment-button value="4"><ion-label>Gen 4</ion-label></ion-segment-button>
                    <ion-segment-button value="5"><ion-label>Gen 5</ion-label></ion-segment-button>
                    <ion-segment-button value="6"><ion-label>Gen 6</ion-label></ion-segment-button>
                    <ion-segment-button value="7"><ion-label>Gen 7</ion-label></ion-segment-button>
                    <ion-segment-button value="special"><ion-label>Special ⭐</ion-label></ion-segment-button>
                </ion-segment>

                @if (currentGenInfo) {
                    <div class="gen-info-banner">
                        <span class="region-title">📍 {{ currentGenInfo.region }} Region</span>
                        <span class="games-subtitle">🎮 Pokémon {{ currentGenInfo.games }}</span>
                    </div>
                }

                <div class="starter-scroll-area">
                    <ion-grid>
                        <ion-row class="ion-justify-content-center">
                            @for (starter of filteredStarters; track starter.id) {
                                <ion-col size="6" size-sm="4" size-md="3" class="starter-col">
                                    <ion-card
                                        class="starter-card"
                                        [class.selected]="selectedId === starter.id"
                                        (click)="selectStarter(starter)"
                                        button
                                    >
                                        <ion-card-content class="starter-card-content">
                                            <img
                                                [src]="getSprite(starter.id)"
                                                [alt]="starter.name"
                                                class="starter-sprite"
                                            />
                                            <ion-card-title class="starter-name">{{ starter.name }}</ion-card-title>
                                            <div class="starter-types">
                                                @for (type of starter.types; track type) {
                                                    <span class="type-badge" [attr.data-type]="type">{{ type }}</span>
                                                }
                                            </div>
                                            <div class="starter-stats">
                                                <span>HP {{ starter.baseStats.hp }}</span>
                                                <span>ATK {{ starter.baseStats.attack }}</span>
                                                <span>DEF {{ starter.baseStats.defense }}</span>
                                                <span>SPD {{ starter.baseStats.speed }}</span>
                                            </div>
                                        </ion-card-content>
                                    </ion-card>
                                </ion-col>
                            }
                        </ion-row>
                    </ion-grid>
                </div>

                @if (selectedId) {
                    <ion-button expand="block" class="confirm-btn" (click)="confirm()">
                        I Choose You! ({{ getSelectedName() }})
                    </ion-button>
                }
            </div>
        </div>
    `,
    styles: [`
        .starter-backdrop {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100%;
            padding: 1rem;
            background: var(--ion-background-color);
        }

        .starter-container {
            text-align: center;
            max-width: 720px;
            width: 100%;
            display: flex;
            flex-direction: column;
            max-height: 90vh;
        }

        .starter-title {
            font-size: 1.75rem;
            font-weight: 800;
            color: var(--ion-text-color);
            margin: 0 0 0.25rem 0;
        }

        .starter-subtitle {
            font-size: 0.9rem;
            color: var(--ion-color-medium);
            margin: 0 0 0.75rem 0;
        }

        .gen-segment {
            margin-bottom: 0.5rem;
        }

        .gen-info-banner {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.15rem;
            padding: 0.4rem 0.75rem;
            background: var(--ion-color-light);
            border-radius: 0.5rem;
            margin-bottom: 0.75rem;
        }

        .region-title {
            font-weight: 700;
            font-size: 0.95rem;
            color: var(--ion-color-primary);
        }

        .games-subtitle {
            font-size: 0.8rem;
            color: var(--ion-color-medium-shade);
            font-weight: 500;
        }

        .starter-scroll-area {
            overflow-y: auto;
            max-height: 50vh;
            padding-right: 0.25rem;
        }

        .starter-col {
            display: flex;
            justify-content: center;
        }

        .starter-card {
            width: 100%;
            max-width: 150px;
            border-radius: 0.75rem;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            border: 2px solid transparent;
            margin: 0.25rem 0;
        }

        .starter-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .starter-card.selected {
            border-color: var(--ion-color-primary);
            box-shadow: 0 0 0 3px var(--ion-color-primary-rgb, 56, 128, 255);
        }

        .starter-card-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0.5rem;
        }

        .starter-sprite {
            width: 72px;
            height: 72px;
            image-rendering: pixelated;
        }

        .starter-name {
            font-size: 0.9rem;
            font-weight: 700;
            margin: 0.35rem 0 0.2rem 0;
        }

        .starter-types {
            display: flex;
            gap: 0.2rem;
            margin-bottom: 0.35rem;
        }

        .type-badge {
            font-size: 0.65rem;
            padding: 0.1rem 0.4rem;
            border-radius: 0.75rem;
            color: #fff;
            font-weight: 600;
            text-transform: capitalize;
            background: var(--ion-color-medium);
        }

        .type-badge[data-type="fire"] { background: #F08030; }
        .type-badge[data-type="water"] { background: #6890F0; }
        .type-badge[data-type="grass"] { background: #78C850; }
        .type-badge[data-type="electric"] { background: #F8D030; color: #333; }
        .type-badge[data-type="poison"] { background: #A040A0; }
        .type-badge[data-type="flying"] { background: #A890F0; }
        .type-badge[data-type="bug"] { background: #A8B820; }
        .type-badge[data-type="normal"] { background: #A8A878; }
        .type-badge[data-type="psychic"] { background: #F85888; }
        .type-badge[data-type="fighting"] { background: #C03028; }
        .type-badge[data-type="rock"] { background: #B8A038; }
        .type-badge[data-type="ground"] { background: #E0C068; color: #333; }
        .type-badge[data-type="ghost"] { background: #705898; }
        .type-badge[data-type="dragon"] { background: #7038F8; }
        .type-badge[data-type="ice"] { background: #98D8D8; color: #333; }
        .type-badge[data-type="dark"] { background: #705848; }
        .type-badge[data-type="steel"] { background: #B8B8D0; color: #333; }
        .type-badge[data-type="fairy"] { background: #EE99AC; }

        .starter-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.1rem 0.4rem;
            font-size: 0.65rem;
            color: var(--ion-color-medium);
        }

        .confirm-btn {
            margin-top: 1rem;
            --border-radius: 2rem;
            font-weight: 700;
            font-size: 1rem;
        }
    `],
    imports: [
        IonGrid,
        IonRow,
        IonCol,
        IonCard,
        IonCardContent,
        IonCardTitle,
        IonButton,
        IonSegment,
        IonSegmentButton,
        IonLabel,
    ],
})
export class FlickemonStarterComponent implements OnInit {
    private flickemonService = inject(FlickemonService);
    private modalCtrl = inject(ModalController);

    allStarters: PokemonSpecies[] = this.flickemonService.getStarterOptions();
    filteredStarters: PokemonSpecies[] = [];
    selectedId: number | null = null;
    selectedGen = '1';
    currentGenInfo: GenInfo = GEN_INFO_LIST['1'];

    ngOnInit(): void {
        this.updateFilter('1');
    }

    getSprite(id: number): string {
        return getSpriteUrl(id);
    }

    onGenChange(event: any): void {
        const genKey = event.detail.value;
        this.selectedGen = genKey;
        this.updateFilter(genKey);
    }

    private updateFilter(genKey: string): void {
        this.currentGenInfo = GEN_INFO_LIST[genKey];
        if (genKey === 'special') {
            this.filteredStarters = this.allStarters.filter(s => s.id === 25 || s.id === 133);
        } else if (genKey === '1') {
            this.filteredStarters = this.allStarters.filter(s => s.generation === 1 && s.id !== 25 && s.id !== 133);
        } else {
            const genNum = parseInt(genKey, 10);
            this.filteredStarters = this.allStarters.filter(s => s.generation === genNum);
        }
    }

    selectStarter(starter: PokemonSpecies): void {
        this.selectedId = starter.id;
    }

    getSelectedName(): string {
        return this.allStarters.find(s => s.id === this.selectedId)?.name ?? '';
    }

    async confirm(): Promise<void> {
        if (this.selectedId) {
            await this.flickemonService.selectStarter(this.selectedId);
            await this.modalCtrl.dismiss({selected: this.selectedId});
        }
    }
}

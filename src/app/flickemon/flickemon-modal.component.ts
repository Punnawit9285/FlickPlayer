/**
 * FlickemonModalComponent — Full Game Hub Dashboard.
 * Tabs: My Partner | Party | Pokédex | Stats
 */

import {Component, inject, OnInit} from '@angular/core';
import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCol,
    IonGrid,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonProgressBar,
    IonRow,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    IonContent,
    IonButtons,
    ModalController,
} from '@ionic/angular/standalone';
import {FlickemonService, OwnedPokemon, PokedexEntry} from './flickemon.service';
import {PokemonSpecies, getSpriteUrl, POKEMON_REGISTRY} from './flickemon.config';
import {addIcons} from 'ionicons';
import {close, checkmarkCircle, helpCircle, star} from 'ionicons/icons';

/** Tab definitions — data-driven, not hard-coded */
interface TabDef {
    key: string;
    label: string;
}

const TABS: TabDef[] = [
    {key: 'partner', label: 'My Partner'},
    {key: 'party', label: 'Party'},
    {key: 'pokedex', label: 'Pokédex'},
    {key: 'stats', label: 'Stats'},
];

@Component({
    selector: 'app-flickemon-modal',
    template: `
        <ion-header>
            <ion-toolbar>
                <ion-title>Flickémon</ion-title>
                <ion-buttons slot="end">
                    <ion-button (click)="dismiss()">
                        <ion-icon name="close" slot="icon-only"></ion-icon>
                    </ion-button>
                </ion-buttons>
            </ion-toolbar>
            <ion-toolbar>
                <ion-segment [value]="activeTab" (ionChange)="onTabChange($event)">
                    @for (tab of tabs; track tab.key) {
                        <ion-segment-button [value]="tab.key">
                            {{ tab.label }}
                        </ion-segment-button>
                    }
                </ion-segment>
            </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
            <!-- My Partner Tab -->
            @if (activeTab === 'partner' && activePokemon && activeSpecies) {
                <div class="partner-section">
                    <img [src]="getSprite(activeSpecies.id)" [alt]="activeSpecies.name" class="partner-sprite"/>
                    <h2 class="partner-name">{{ activeSpecies.name }}</h2>
                    <div class="partner-types">
                        @for (type of activeSpecies.types; track type) {
                            <span class="type-badge" [attr.data-type]="type">{{ type }}</span>
                        }
                    </div>
                    <p class="partner-level">Level {{ activePokemon.level }}</p>
                    <ion-progress-bar [value]="expProgress.percent / 100" color="primary" class="partner-exp-bar"></ion-progress-bar>
                    <p class="partner-exp-text">EXP {{ expProgress.current }} / {{ expProgress.needed }}</p>

                    <div class="stats-grid">
                        <div class="stat-item"><span class="stat-label">HP</span><span class="stat-value">{{ activeSpecies.baseStats.hp }}</span></div>
                        <div class="stat-item"><span class="stat-label">Attack</span><span class="stat-value">{{ activeSpecies.baseStats.attack }}</span></div>
                        <div class="stat-item"><span class="stat-label">Defense</span><span class="stat-value">{{ activeSpecies.baseStats.defense }}</span></div>
                        <div class="stat-item"><span class="stat-label">Speed</span><span class="stat-value">{{ activeSpecies.baseStats.speed }}</span></div>
                    </div>
                </div>
            }

            <!-- Party Tab -->
            @if (activeTab === 'party') {
                <ion-list>
                    @for (pokemon of party; track pokemon.instanceId) {
                        <ion-item [class.active-party]="pokemon.instanceId === activePokemon?.instanceId">
                            <img [src]="getSprite(pokemon.speciesId)" [alt]="getSpeciesName(pokemon.speciesId)" class="party-sprite" slot="start"/>
                            <ion-label>
                                <h3>{{ getSpeciesName(pokemon.speciesId) }}</h3>
                                <p>Lv. {{ pokemon.level }}</p>
                            </ion-label>
                            @if (pokemon.instanceId !== activePokemon?.instanceId) {
                                <ion-button fill="outline" size="small" slot="end" (click)="setActive(pokemon.instanceId)">
                                    Set Active
                                </ion-button>
                            } @else {
                                <ion-icon name="star" color="warning" slot="end"></ion-icon>
                            }
                        </ion-item>
                    }
                </ion-list>
                @if (party.length === 0) {
                    <p class="empty-text">No Pokémon in your party yet. Choose a starter!</p>
                }
            }

            <!-- Pokédex Tab -->
            @if (activeTab === 'pokedex') {
                <ion-grid>
                    <ion-row>
                        @for (species of allSpecies; track species.id) {
                            <ion-col size="3" size-md="2">
                                <div class="pokedex-entry" [class.caught]="isCaught(species.id)" [class.seen]="isSeen(species.id)">
                                    @if (isSeen(species.id)) {
                                        <img [src]="getSprite(species.id)" [alt]="species.name" class="pokedex-sprite" [class.silhouette]="!isCaught(species.id)"/>
                                    } @else {
                                        <div class="pokedex-unknown">?</div>
                                    }
                                    <span class="pokedex-num">#{{ species.id }}</span>
                                    @if (isCaught(species.id)) {
                                        <span class="pokedex-name">{{ species.name }}</span>
                                    }
                                </div>
                            </ion-col>
                        }
                    </ion-row>
                </ion-grid>
                <p class="pokedex-count">Caught: {{ caughtCount }} / {{ allSpecies.length }}</p>
            }

            <!-- Stats Tab -->
            @if (activeTab === 'stats') {
                <ion-list>
                    <ion-item>
                        <ion-label>
                            <h3>Total Watch Time</h3>
                            <p>{{ totalWatchHours }} hours</p>
                        </ion-label>
                    </ion-item>
                    <ion-item>
                        <ion-label>
                            <h3>Pokémon Caught</h3>
                            <p>{{ caughtCount }} / {{ allSpecies.length }}</p>
                        </ion-label>
                    </ion-item>
                    <ion-item>
                        <ion-label>
                            <h3>Party Size</h3>
                            <p>{{ party.length }}</p>
                        </ion-label>
                    </ion-item>
                </ion-list>

                <div class="ion-padding-top">
                    <ion-button expand="block" color="danger" fill="outline" (click)="resetProgress()">
                        Reset Game Progress (Test Starter Selection)
                    </ion-button>
                </div>
            }
        </ion-content>
    `,
    styles: [`
        .partner-section {
            text-align: center;
            padding: 1rem 0;
        }

        .partner-sprite {
            width: 128px;
            height: 128px;
            image-rendering: pixelated;
        }

        .partner-name {
            font-size: 1.5rem;
            font-weight: 800;
            margin: 0.5rem 0 0.25rem;
        }

        .partner-types {
            display: flex;
            justify-content: center;
            gap: 0.25rem;
            margin-bottom: 0.5rem;
        }

        .type-badge {
            font-size: 0.7rem;
            padding: 0.15rem 0.5rem;
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

        .partner-level {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--ion-color-medium);
            margin: 0.25rem 0;
        }

        .partner-exp-bar {
            max-width: 300px;
            margin: 0.5rem auto;
        }

        .partner-exp-text {
            font-size: 0.8rem;
            color: var(--ion-color-medium);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
            max-width: 280px;
            margin: 1rem auto;
        }

        .stat-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0.75rem;
            border-radius: 0.5rem;
            background: var(--ion-color-light);
        }

        .stat-label {
            font-size: 0.8rem;
            color: var(--ion-color-medium);
        }

        .stat-value {
            font-size: 0.85rem;
            font-weight: 700;
        }

        /* Party */
        .party-sprite {
            width: 40px;
            height: 40px;
            image-rendering: pixelated;
        }

        .active-party {
            --background: var(--ion-color-primary-tint);
        }

        /* Pokédex */
        .pokedex-entry {
            text-align: center;
            padding: 0.5rem 0;
        }

        .pokedex-sprite {
            width: 48px;
            height: 48px;
            image-rendering: pixelated;
        }

        .pokedex-sprite.silhouette {
            filter: brightness(0);
        }

        .pokedex-unknown {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--ion-color-light-shade);
            margin: 0 auto;
        }

        .pokedex-num {
            display: block;
            font-size: 0.65rem;
            color: var(--ion-color-medium);
        }

        .pokedex-name {
            display: block;
            font-size: 0.65rem;
            font-weight: 600;
            color: var(--ion-text-color);
        }

        .pokedex-count {
            text-align: center;
            font-size: 0.85rem;
            color: var(--ion-color-medium);
            margin-top: 1rem;
        }

        .empty-text {
            text-align: center;
            color: var(--ion-color-medium);
            margin-top: 2rem;
        }
    `],
    imports: [
        IonHeader,
        IonToolbar,
        IonTitle,
        IonButtons,
        IonButton,
        IonIcon,
        IonContent,
        IonSegment,
        IonSegmentButton,
        IonProgressBar,
        IonGrid,
        IonRow,
        IonCol,
        IonList,
        IonItem,
        IonLabel,
    ],
})
export class FlickemonModalComponent implements OnInit {
    private flickemonService = inject(FlickemonService);
    private modalCtrl = inject(ModalController);

    tabs = TABS;
    activeTab = 'partner';

    activePokemon: OwnedPokemon | null = null;
    activeSpecies: PokemonSpecies | null = null;
    expProgress = {current: 0, needed: 0, percent: 0};
    party: OwnedPokemon[] = [];
    pokedex: PokedexEntry[] = [];
    allSpecies = POKEMON_REGISTRY;
    caughtCount = 0;
    totalWatchHours = '0.0';

    constructor() {
        addIcons({close, checkmarkCircle, helpCircle, star});
    }

    ngOnInit(): void {
        this.refresh();
    }

    private refresh(): void {
        this.activePokemon = this.flickemonService.getActivePokemon();
        if (this.activePokemon) {
            this.activeSpecies = this.flickemonService.getSpeciesForPokemon(this.activePokemon) ?? null;
            this.expProgress = this.flickemonService.getExpProgress(this.activePokemon);
        }
        this.party = this.flickemonService.getParty();
        this.pokedex = this.flickemonService.getPokedex();
        this.caughtCount = this.pokedex.filter(e => e.caught).length;

        this.flickemonService.gameState$.subscribe(state => {
            this.totalWatchHours = (state.totalMinutesWatched / 60).toFixed(1);
        });
    }

    getSprite(id: number): string {
        return getSpriteUrl(id);
    }

    getSpeciesName(id: number): string {
        return POKEMON_REGISTRY.find(s => s.id === id)?.name ?? 'Unknown';
    }

    isCaught(speciesId: number): boolean {
        return this.pokedex.some(e => e.speciesId === speciesId && e.caught);
    }

    isSeen(speciesId: number): boolean {
        return this.pokedex.some(e => e.speciesId === speciesId && e.seen);
    }

    onTabChange(event: any): void {
        this.activeTab = event.detail.value;
    }

    async setActive(instanceId: string): Promise<void> {
        await this.flickemonService.switchActivePokemon(instanceId);
        this.refresh();
    }

    async resetProgress(): Promise<void> {
        await this.flickemonService.resetGameState();
        this.dismiss();
    }

    dismiss(): void {
        this.modalCtrl.dismiss();
    }
}

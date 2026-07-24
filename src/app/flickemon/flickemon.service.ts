/**
 * FlickemonService — Core Game Engine
 * ────────────────────────────────────
 * Manages: Active Pokémon, Party, Pokédex, EXP from video playback,
 * ongoing wild opponent battles with HP bars, auto-capture, evolution, and cloud persistence.
 */

import {inject, Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {
    PokemonSpecies,
    POKEMON_REGISTRY,
    ENCOUNTER_STAGE_WEIGHTS,
    EXP_PER_MINUTE,
    BATTLE_WIN_EXP_BONUS,
    MAX_LEVEL,
    expForLevel,
    levelFromExp,
    getSpeciesById,
    getSpeciesByStage,
    canEvolveAt,
    getSpriteUrl,
    STARTER_OPTIONS,
    calculateRealMaxHp,
} from './flickemon.config';
import {Firestore, doc, setDoc, getDoc} from '@angular/fire/firestore';
import {AuthService} from '../auth.service';

// ─────────────────────────── Game State Interfaces ───────────────────────────

/** A single owned Pokémon instance */
export interface OwnedPokemon {
    /** Unique instance ID (UUID) */
    instanceId: string;
    /** Species ID from POKEMON_REGISTRY */
    speciesId: number;
    /** Current level */
    level: number;
    /** Total accumulated EXP */
    totalExp: number;
}

/** Pokédex entry */
export interface PokedexEntry {
    speciesId: number;
    caught: boolean;
    seen: boolean;
}

/** Active Wild Opponent Battle State */
export interface WildOpponent {
    wildSpecies: PokemonSpecies;
    wildLevel: number;
    maxHp: number;
    currentHp: number;
    status: 'fighting' | 'captured' | 'escaped';
    fightDurationSeconds: number;
    expGained?: number;
}

/** Wild encounter result */
export interface EncounterResult {
    wildSpecies: PokemonSpecies;
    wildLevel: number;
    won: boolean;
    captured: boolean;
    expGained: number;
    evolved: boolean;
    evolvedInto?: PokemonSpecies;
}

/** Full game save state */
export interface FlickemonGameState {
    hasStarted: boolean;
    activeInstanceId: string | null;
    party: OwnedPokemon[];
    pokedex: PokedexEntry[];
    totalMinutesWatched: number;
    lastSyncedAt: number;
}

// ─────────────────────────── Service ───────────────────────────

@Injectable({
    providedIn: 'root',
})
export class FlickemonService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);

    private readonly STORAGE_KEY_PREFIX = 'flickemon_';
    private currentUserId: string | null = null;

    /** Game state */
    private gameState: FlickemonGameState = this.createEmptyState();

    /** Active Wild Opponent being battled while studying */
    private wildOpponent: WildOpponent | null = null;
    private wildOpponentSubject = new BehaviorSubject<WildOpponent | null>(null);
    wildOpponent$: Observable<WildOpponent | null> = this.wildOpponentSubject.asObservable();

    /** Observables */
    private gameStateSubject = new BehaviorSubject<FlickemonGameState>(this.gameState);
    gameState$: Observable<FlickemonGameState> = this.gameStateSubject.asObservable();

    private encounterSubject = new Subject<EncounterResult>();
    encounter$: Observable<EncounterResult> = this.encounterSubject.asObservable();

    private evolutionSubject = new Subject<{from: PokemonSpecies; to: PokemonSpecies}>();
    evolution$: Observable<{from: PokemonSpecies; to: PokemonSpecies}> = this.evolutionSubject.asObservable();

    private respawnTimer: any = null;

    constructor() {
        // Listen for auth changes
        this.authService.user.subscribe(user => {
            if (user) {
                this.currentUserId = user.uid;
                this.loadGameState();
            } else {
                this.currentUserId = null;
                this.gameState = this.createEmptyState();
                this.emitState();
            }
        });
    }

    // ─────────────────────────── Public API ───────────────────────────

    hasStarted(): boolean {
        return this.gameState.hasStarted;
    }

    async resetGameState(): Promise<void> {
        this.gameState = this.createEmptyState();
        this.wildOpponent = null;
        this.wildOpponentSubject.next(null);

        if (this.currentUserId) {
            localStorage.removeItem(this.STORAGE_KEY_PREFIX + this.currentUserId);
        } else {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
        }

        if (this.currentUserId) {
            try {
                const docRef = doc(this.firestore, `users/${this.currentUserId}/flickemon/state`);
                await setDoc(docRef, this.createEmptyState());
            } catch {
                // Ignore
            }
        }

        this.emitState();
    }

    getStarterOptions(): PokemonSpecies[] {
        return STARTER_OPTIONS
            .map(id => getSpeciesById(id))
            .filter((s): s is PokemonSpecies => !!s);
    }

    async selectStarter(speciesId: number): Promise<void> {
        const species = getSpeciesById(speciesId);
        if (!species) {
            return;
        }

        const starter: OwnedPokemon = {
            instanceId: this.generateId(),
            speciesId: species.id,
            level: 5,
            totalExp: expForLevel(5),
        };

        this.gameState.hasStarted = true;
        this.gameState.party.push(starter);
        this.gameState.activeInstanceId = starter.instanceId;
        this.updatePokedex(species.id, true);

        // Spawn first wild opponent immediately!
        this.spawnWildOpponent();

        await this.saveGameState();
    }

    getActivePokemon(): OwnedPokemon | null {
        if (!this.gameState.activeInstanceId) {
            return null;
        }
        return this.gameState.party.find(p => p.instanceId === this.gameState.activeInstanceId) ?? null;
    }

    getSpeciesForPokemon(pokemon: OwnedPokemon): PokemonSpecies | undefined {
        return getSpeciesById(pokemon.speciesId);
    }

    async switchActivePokemon(instanceId: string): Promise<void> {
        const target = this.gameState.party.find(p => p.instanceId === instanceId);
        if (target) {
            this.gameState.activeInstanceId = instanceId;
            await this.saveGameState();
        }
    }

    getParty(): OwnedPokemon[] {
        return [...this.gameState.party];
    }

    getPokedex(): PokedexEntry[] {
        return [...this.gameState.pokedex];
    }

    getSprite(speciesId: number): string {
        return getSpriteUrl(speciesId);
    }

    getExpProgress(pokemon: OwnedPokemon): {current: number; needed: number; percent: number} {
        const currentLevelExp = expForLevel(pokemon.level);
        const nextLevelExp = expForLevel(pokemon.level + 1);
        const current = pokemon.totalExp - currentLevelExp;
        const needed = nextLevelExp - currentLevelExp;
        const percent = Math.min(100, Math.round((current / needed) * 100));
        return {current, needed, percent};
    }

    /**
     * Record video watch time and process attack damage on wild opponent + EXP.
     * Call this from CoursePage's video timeupdate event.
     * @param secondsWatched - Seconds of video watched since last call
     */
    async onVideoProgress(secondsWatched: number): Promise<void> {
        const active = this.getActivePokemon();
        if (!this.gameState.hasStarted || !active) {
            return;
        }

        // Always ensure a wild opponent is present!
        if (!this.wildOpponent) {
            this.spawnWildOpponent();
        }

        // Add study EXP to active partner
        const expGained = Math.round((secondsWatched / 60) * EXP_PER_MINUTE);
        if (expGained > 0) {
            this.addExpToActive(expGained);
        }

        // Secretly attack opponent while studying (takes ~2.5 mins / 150s of study to defeat)
        if (this.wildOpponent && this.wildOpponent.status === 'fighting') {
            this.wildOpponent.fightDurationSeconds += secondsWatched;

            // Check if wild opponent level is much higher (wildLevel >= active.level + 4) -> Runs away after 90s of fighting!
            const levelDiff = this.wildOpponent.wildLevel - active.level;
            if (levelDiff >= 4 && this.wildOpponent.fightDurationSeconds >= 90) {
                // Wild opponent runs away!
                this.wildOpponent.status = 'escaped';
                const partialExp = Math.round(this.wildOpponent.wildLevel * 10);
                this.wildOpponent.expGained = partialExp;
                this.addExpToActive(partialExp);

                this.encounterSubject.next({
                    wildSpecies: this.wildOpponent.wildSpecies,
                    wildLevel: this.wildOpponent.wildLevel,
                    won: false,
                    captured: false,
                    expGained: partialExp,
                    evolved: false,
                });

                if (this.respawnTimer) clearTimeout(this.respawnTimer);
                this.respawnTimer = setTimeout(() => {
                    this.spawnWildOpponent();
                }, 3000);

                this.wildOpponentSubject.next({...this.wildOpponent});
                await this.saveGameState();
                return;
            }

            // Secret damage calculation: Defeats wild opponent over ~150 seconds (2.5 mins) of study time
            const TARGET_BATTLE_SECONDS = 150;
            const damagePerSec = this.wildOpponent.maxHp / TARGET_BATTLE_SECONDS;
            this.wildHpAcc -= secondsWatched * damagePerSec;
            this.wildOpponent.currentHp = Math.max(0, Math.ceil(this.wildHpAcc));

            if (this.wildOpponent.currentHp === 0) {
                // Opponent Defeated & Captured!
                this.wildOpponent.status = 'captured';
                const winExp = Math.round(this.wildOpponent.wildLevel * BATTLE_WIN_EXP_BONUS);
                this.wildOpponent.expGained = winExp;

                // Add to party if not already owned
                if (!this.gameState.party.some(p => p.speciesId === this.wildOpponent!.wildSpecies.id)) {
                    this.gameState.party.push({
                        instanceId: this.generateId(),
                        speciesId: this.wildOpponent.wildSpecies.id,
                        level: this.wildOpponent.wildLevel,
                        totalExp: expForLevel(this.wildOpponent.wildLevel),
                    });
                }
                this.updatePokedex(this.wildOpponent.wildSpecies.id, true);

                // Award bonus EXP & check evolution
                const evoResult = this.addExpToActive(winExp);

                // Emit encounter celebration event
                this.encounterSubject.next({
                    wildSpecies: this.wildOpponent.wildSpecies,
                    wildLevel: this.wildOpponent.wildLevel,
                    won: true,
                    captured: true,
                    expGained: winExp,
                    evolved: !!evoResult,
                    evolvedInto: evoResult ?? undefined,
                });

                // Spawn next opponent after 3 seconds of victory
                if (this.respawnTimer) clearTimeout(this.respawnTimer);
                this.respawnTimer = setTimeout(() => {
                    this.spawnWildOpponent();
                }, 3000);
            }

            this.wildOpponentSubject.next({...this.wildOpponent});
        }

        // Update total minutes
        this.gameState.totalMinutesWatched += secondsWatched / 60;

        await this.saveGameState();
    }

    private wildHpAcc = 0;

    /** Spawn a new wild opponent for the player to fight while studying */
    spawnWildOpponent(): void {
        const active = this.getActivePokemon();
        const activeLevel = active ? active.level : 5;

        const wildSpecies = this.rollWildPokemon();
        const wildLevel = this.rollWildLevel(activeLevel);

        // Authentic Pokémon Max HP formula: Math.floor(((2 * baseHp) * level) / 100) + level + 10
        const maxHp = calculateRealMaxHp(wildSpecies.baseStats.hp, wildLevel);
        this.wildHpAcc = maxHp;

        this.wildOpponent = {
            wildSpecies,
            wildLevel,
            maxHp,
            currentHp: maxHp,
            status: 'fighting',
            fightDurationSeconds: 0,
        };

        this.updatePokedex(wildSpecies.id, false);
        this.wildOpponentSubject.next({...this.wildOpponent});
    }

    async syncFromPlayHistory(totalMinutesFromServer: number): Promise<void> {
        if (!this.gameState.hasStarted) {
            return;
        }

        const unaccountedMinutes = totalMinutesFromServer - this.gameState.totalMinutesWatched;
        if (unaccountedMinutes > 1) {
            const expToAdd = Math.round(unaccountedMinutes * EXP_PER_MINUTE);
            this.addExpToActive(expToAdd);
            this.gameState.totalMinutesWatched = totalMinutesFromServer;
            await this.saveGameState();
        }
    }

    // ─────────────────────────── Battle & Encounters ───────────────────────────

    private rollWildPokemon(): PokemonSpecies {
        const roll = Math.random();
        let cumulative = 0;
        let selectedStage: 1 | 2 | 3 = 1;

        for (const entry of ENCOUNTER_STAGE_WEIGHTS) {
            cumulative += entry.weight;
            if (roll <= cumulative) {
                selectedStage = entry.stage;
                break;
            }
        }

        const candidates = getSpeciesByStage(selectedStage);
        if (candidates.length === 0) {
            const fallback = getSpeciesByStage(1);
            return fallback[Math.floor(Math.random() * fallback.length)];
        }

        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    private rollWildLevel(playerLevel: number): number {
        const variance = Math.floor(playerLevel * 0.3) + 2;
        const minLevel = Math.max(1, playerLevel - variance);
        const maxLevel = Math.min(MAX_LEVEL, playerLevel + variance);
        return Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
    }

    // ─────────────────────────── EXP & Evolution ───────────────────────────

    private addExpToActive(exp: number): PokemonSpecies | null {
        const active = this.getActivePokemon();
        if (!active || active.level >= MAX_LEVEL) {
            return null;
        }

        active.totalExp += exp;
        const newLevel = Math.min(MAX_LEVEL, levelFromExp(active.totalExp));

        if (newLevel > active.level) {
            active.level = newLevel;
        }

        const evolution = canEvolveAt(active.speciesId, active.level);
        if (evolution) {
            const fromSpecies = getSpeciesById(active.speciesId);
            const toSpecies = getSpeciesById(evolution.toId);
            if (fromSpecies && toSpecies) {
                active.speciesId = evolution.toId;
                this.updatePokedex(evolution.toId, true);
                this.evolutionSubject.next({from: fromSpecies, to: toSpecies});
                return toSpecies;
            }
        }

        this.emitState();
        return null;
    }

    private updatePokedex(speciesId: number, caught: boolean): void {
        const existing = this.gameState.pokedex.find(e => e.speciesId === speciesId);
        if (existing) {
            if (caught) {
                existing.caught = true;
            }
            existing.seen = true;
        } else {
            this.gameState.pokedex.push({speciesId, caught, seen: true});
        }
    }

    // ─────────────────────────── Persistence ───────────────────────────

    private async loadGameState(): Promise<void> {
        if (!this.currentUserId) {
            return;
        }

        try {
            const docRef = doc(this.firestore, `users/${this.currentUserId}/flickemon/state`);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                this.gameState = snapshot.data() as FlickemonGameState;
                this.emitState();
                if (this.gameState.hasStarted && !this.wildOpponent) {
                    this.spawnWildOpponent();
                }
                this.saveToLocalStorage();
                return;
            }
        } catch {
            // Fallback
        }

        this.loadFromLocalStorage();
        if (this.gameState.hasStarted && !this.wildOpponent) {
            this.spawnWildOpponent();
        }
        this.emitState();
    }

    private async saveGameState(): Promise<void> {
        this.gameState.lastSyncedAt = Date.now();
        this.emitState();
        this.saveToLocalStorage();

        if (this.currentUserId) {
            try {
                const docRef = doc(this.firestore, `users/${this.currentUserId}/flickemon/state`);
                await setDoc(docRef, this.gameState);
            } catch {
                // Backup
            }
        }
    }

    private saveToLocalStorage(): void {
        if (this.currentUserId) {
            localStorage.setItem(
                this.STORAGE_KEY_PREFIX + this.currentUserId,
                JSON.stringify(this.gameState),
            );
        }
    }

    private loadFromLocalStorage(): void {
        if (this.currentUserId) {
            try {
                const raw = localStorage.getItem(this.STORAGE_KEY_PREFIX + this.currentUserId);
                if (raw) {
                    this.gameState = JSON.parse(raw) as FlickemonGameState;
                }
            } catch {
                // Ignore
            }
        }
    }

    private createEmptyState(): FlickemonGameState {
        return {
            hasStarted: false,
            activeInstanceId: null,
            party: [],
            pokedex: [],
            totalMinutesWatched: 0,
            lastSyncedAt: 0,
        };
    }

    private emitState(): void {
        this.gameStateSubject.next({...this.gameState});
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
}

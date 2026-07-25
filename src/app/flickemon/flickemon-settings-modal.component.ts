/**
 * FlickemonSettingsModalComponent — Dedicated Settings & Admin Portal Modal.
 * Passcode for Admin Portal: 9285
 */

import { Component, inject, OnInit } from '@angular/core';
import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToolbar,
    IonContent,
    IonButtons,
    IonBadge,
    ModalController,
    AlertController,
    IonSegment,
    IonSegmentButton,
} from '@ionic/angular/standalone';
import { FlickemonService, PlayerSummary } from './flickemon.service';
import { addIcons } from 'ionicons';
import { close, lockClosed, key, refresh, shieldCheckmark, trash, skull } from 'ionicons/icons';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-flickemon-settings-modal',
    template: `
        <ion-header>
            <ion-toolbar>
                <ion-title>Flickémon Settings </ion-title>
                <ion-buttons slot="end">
                    <ion-button (click)="dismiss()">
                        <ion-icon name="close" slot="icon-only"></ion-icon>
                    </ion-button>
                </ion-buttons>
            </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding">
            <!-- General Settings Section -->
            <ion-card class="settings-card">
                <ion-card-header>
                    <ion-card-title>⚙️ General Options</ion-card-title>
                </ion-card-header>
                <ion-card-content>
                    <ion-list lines="full">
                        <ion-item button (click)="confirmResetSelf()">
                            <ion-icon name="refresh" slot="start" color="danger"></ion-icon>
                            <ion-label color="danger">
                                <h3>Reset My Game Progress</h3>
                                <p>Restart starter selection and reset party to 0</p>
                            </ion-label>
                        </ion-item>
                    </ion-list>
                </ion-card-content>
            </ion-card>

            <!-- Admin Portal Section -->
            <ion-card class="settings-card admin-card">
                <ion-card-header>
                    <ion-card-title class="admin-title">
                        <div class="title-with-icon">
                            <ion-icon name="shield-checkmark" color="warning"></ion-icon>
                            <span>Admin Monitoring Portal</span>
                        </div>
                        @if (isAdminUnlocked) {
                            <ion-badge color="success">UNLOCKED</ion-badge>
                        }
                    </ion-card-title>
                </ion-card-header>

                <ion-card-content>
                    @if (!isAdminUnlocked) {
                        <div class="passcode-box">
                            <p class="passcode-label">Enter Admin Passcode to monitor players:</p>
                            <div class="passcode-input-row">
                                <ion-input
                                    type="password"
                                    placeholder="Enter passcode"
                                    [(ngModel)]="passcodeInput"
                                    (keyup.enter)="unlockAdmin()"
                                    class="passcode-input"
                                ></ion-input>
                                <ion-button color="warning" (click)="unlockAdmin()">
                                    <ion-icon name="key" slot="start"></ion-icon> Unlock
                                </ion-button>
                            </div>
                            @if (passcodeError) {
                                <p class="error-text">Incorrect passcode. Try again.</p>
                            }
                        </div>
                    } @else {
                        <div class="admin-panel">
                            <div class="admin-header-row">
                                <h3>Admin Tools & Player Monitor</h3>
                                <ion-button size="small" fill="outline" color="medium" (click)="lockAdmin()">
                                    <ion-icon name="lock-closed" slot="start"></ion-icon> Lock
                                </ion-button>
                            </div>

                            <!-- Local Testing Tools -->
                            <div class="admin-testing-section" style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(var(--ion-color-warning-rgb), 0.08); border-radius: 8px;">
                                <h4 style="color: var(--ion-color-warning-shade); margin: 0 0 0.75rem 0; font-weight: 700;">⚡ Local Game Testing Tools</h4>
                                
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; align-items: center;">
                                    <ion-button color="danger" size="small" (click)="instantKill()">
                                        <ion-icon name="skull" slot="start"></ion-icon> Instant Kill Opponent
                                    </ion-button>
                                </div>

                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; flex-wrap: wrap;">
                                    <span style="font-size: 0.85rem; font-weight: 600;">Damage Speed:</span>
                                    <ion-segment [value]="currentDamageMultiplier.toString()" (ionChange)="setDamageMultiplier($event)" style="max-width: 220px;">
                                        <ion-segment-button value="1"><ion-label>1x</ion-label></ion-segment-button>
                                        <ion-segment-button value="10"><ion-label>10x</ion-label></ion-segment-button>
                                        <ion-segment-button value="100"><ion-label>100x</ion-label></ion-segment-button>
                                    </ion-segment>
                                </div>

                                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                                    <span style="font-size: 0.85rem; font-weight: 600;">Set Level:</span>
                                    <ion-input type="number" min="1" max="100" [(ngModel)]="targetLevel" placeholder="Level" style="max-width: 100px; --padding-start: 8px; border: 1px solid var(--ion-color-medium); border-radius: 4px;"></ion-input>
                                    <ion-button color="primary" size="small" (click)="setPartnerLevel()">Set Level</ion-button>
                                </div>
                            </div>

                            <h3 style="margin-bottom: 0.5rem;">Student Player Monitor (UID Tracking)</h3>
                            <ion-list lines="full">
                                @for (player of playersList; track player.uid) {
                                    <ion-item>
                                        <ion-label>
                                            <div class="player-name-row">
                                                <strong>{{ player.displayName }}</strong>
                                                <span class="player-uid">UID: {{ player.uid }}</span>
                                            </div>
                                            <p>Partner: {{ player.activePokemonName }} (Lv.{{ player.activePokemonLevel }})</p>
                                            <p>Party: {{ player.partyCount }} • Caught: {{ player.caughtCount }} • Watched: {{ (player.totalMinutesWatched).toFixed(1) }}m</p>
                                        </ion-label>
                                        <ion-button color="danger" fill="outline" size="small" slot="end" (click)="resetTargetPlayer(player)">
                                            <ion-icon name="trash" slot="icon-only"></ion-icon>
                                        </ion-button>
                                    </ion-item>
                                }
                                @if (playersList.length === 0) {
                                    <p class="empty-text">No active players found in Firestore.</p>
                                }
                            </ion-list>
                        </div>
                    }
                </ion-card-content>
            </ion-card>
        </ion-content>
    `,
    styles: [`
        .settings-card {
            margin: 0 0 1rem 0;
            border-radius: 0.75rem;
        }

        .admin-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .title-with-icon {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .passcode-box {
            padding: 0.5rem 0;
        }

        .passcode-label {
            font-size: 0.85rem;
            color: var(--ion-color-medium);
            margin-bottom: 0.5rem;
        }

        .passcode-input-row {
            display: flex;
            gap: 0.5rem;
        }

        .passcode-input {
            --background: var(--ion-color-light);
            --padding-start: 0.75rem;
            border-radius: 0.5rem;
            font-weight: bold;
        }

        .error-text {
            color: var(--ion-color-danger);
            font-size: 0.8rem;
            margin-top: 0.5rem;
        }

        .admin-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.75rem;
        }

        .admin-header-row h3 {
            font-size: 0.95rem;
            font-weight: 700;
            margin: 0;
        }

        .player-name-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
        }

        .player-uid {
            font-size: 0.7rem;
            font-family: monospace;
            color: var(--ion-color-medium);
        }

        .empty-text {
            text-align: center;
            color: var(--ion-color-medium);
            margin: 1rem 0;
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
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardContent,
        IonList,
        IonItem,
        IonLabel,
        IonInput,
        IonBadge,
        IonSegment,
        IonSegmentButton,
        FormsModule,
    ],
})
export class FlickemonSettingsModalComponent implements OnInit {
    private flickemonService = inject(FlickemonService);
    private modalCtrl = inject(ModalController);
    private alertCtrl = inject(AlertController);

    passcodeInput = '';
    isAdminUnlocked = false;
    passcodeError = false;

    playersList: PlayerSummary[] = [];
    isHidden = false;
    targetLevel: number = 5;

    constructor() {
        addIcons({ close, lockClosed, key, refresh, shieldCheckmark, trash, skull });
    }

    get currentDamageMultiplier(): number {
        return this.flickemonService.adminGetDamageMultiplier();
    }

    instantKill(): void {
        this.flickemonService.adminInstantKillOpponent();
    }

    setDamageMultiplier(ev: any): void {
        const val = parseInt(ev.detail.value, 10);
        if (val) {
            this.flickemonService.adminSetDamageMultiplier(val);
        }
    }

    setPartnerLevel(): void {
        if (this.targetLevel && this.targetLevel >= 1 && this.targetLevel <= 100) {
            this.flickemonService.adminSetPokemonLevel(this.targetLevel);
        }
    }

    ngOnInit(): void { }

    async confirmResetSelf(): Promise<void> {
        const alert = await this.alertCtrl.create({
            header: 'Reset Game Progress',
            message: 'Are you sure you want to reset your Flickémon progress? This will reset your starter, party, and Pokédex.',
            buttons: [
                { text: 'Cancel', role: 'cancel' },
                {
                    text: 'Reset Progress',
                    role: 'destructive',
                    handler: async () => {
                        await this.flickemonService.resetGameState();
                        this.modalCtrl.dismiss({ reset: true });
                    },
                },
            ],
        });
        await alert.present();
    }

    async unlockAdmin(): Promise<void> {
        if (this.passcodeInput.trim() === '9285') {
            this.isAdminUnlocked = true;
            this.passcodeError = false;
            await this.loadAllPlayersData();
        } else {
            this.passcodeError = true;
        }
    }

    private async loadAllPlayersData(): Promise<void> {
        this.playersList = await this.flickemonService.getAllPlayersData();
    }

    lockAdmin(): void {
        this.isAdminUnlocked = false;
        this.playersList = [];
    }

    async resetTargetPlayer(player: PlayerSummary): Promise<void> {
        const alert = await this.alertCtrl.create({
            header: 'Reset Player Progress',
            message: `Are you sure you want to reset game progress for player "${player.displayName}" (UID: ${player.uid})?`,
            buttons: [
                { text: 'Cancel', role: 'cancel' },
                {
                    text: 'Reset Player',
                    role: 'destructive',
                    handler: async () => {
                        await this.flickemonService.resetPlayerProgressByUid(player.uid);
                        await this.loadAllPlayersData();
                    },
                },
            ],
        });
        await alert.present();
    }

    dismiss(): void {
        this.modalCtrl.dismiss();
    }
}

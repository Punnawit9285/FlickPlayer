import {Component, inject} from '@angular/core';
import {IonButton, IonIcon, ModalController} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {colorPaletteOutline} from 'ionicons/icons';
import {ThemeEditorComponent} from './theme-editor.component';

@Component({
    selector: 'app-theme-button',
    templateUrl: './theme-button.component.html',
    styleUrls: ['./theme-button.component.scss'],
    imports: [IonButton, IonIcon],
})
export class ThemeButtonComponent {
    private modalCtrl = inject(ModalController);

    constructor() {
        addIcons({colorPaletteOutline});
    }

    async openEditor(): Promise<void> {
        const modal = await this.modalCtrl.create({
            component: ThemeEditorComponent,
            breakpoints: [0, 0.9],
            initialBreakpoint: 0.9,
        });
        await modal.present();
    }
}

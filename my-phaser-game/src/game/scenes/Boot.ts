// ============================================================
//  Boot.ts  –  Escena de arranque (sin assets pesados en Fase 1)
// ============================================================

import { Scene } from 'phaser';

export class Boot extends Scene {

    constructor() {
        super('Boot');
    }

    preload(): void {
        // En Fase 1 no cargamos assets de imagen externos.
        // Cuando añadas audio/sprites, cárgalos en Preloader.
    }

    create(): void {
        this.scene.start('Preloader');
    }
}

// ============================================================
//  main.ts  –  Configuración del juego y bootstrap de Phaser
// ============================================================

import { Boot }      from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu }  from './scenes/MainMenu';
import { GameScene } from './scenes/GameScene';
import { GameOver }  from './scenes/GameOver';
import { AUTO, Game, Scale } from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width:  1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#04040f',

    // Física arcade con gravedad global baja (cada body gestiona la suya)
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug:   false,    // ← cambiar a true para ver hitboxes
        },
    },

    scale: {
        mode:        Scale.FIT,
        autoCenter:  Scale.CENTER_BOTH,
    },

    scene: [
        Boot,
        Preloader,
        MainMenu,
        GameScene,
        GameOver,
    ],
};

const StartGame = (parent: string): Game => {
    return new Game({ ...config, parent });
};

export default StartGame;

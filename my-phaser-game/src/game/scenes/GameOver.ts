// ============================================================
//  GameOver.ts  –  Pantalla de derrota
// ============================================================

import { Scene } from 'phaser';

export class GameOver extends Scene {

    constructor() {
        super('GameOver');
    }

    create(): void {
        const W = this.scale.width;
        const H = this.scale.height;

        // Fondo negro/rojo oscuro
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x000000, 0x000000, 0x1a0000, 0x1a0000, 1);
        bg.fillRect(0, 0, W, H);

        // Cruz / símbolo de muerte
        const sym = this.add.graphics();
        sym.lineStyle(3, 0x660000, 0.6);
        sym.strokeRect(W / 2 - 40, H / 2 - 100, 80, 80);
        sym.lineStyle(1, 0x990000, 0.4);
        sym.beginPath();
        sym.moveTo(W / 2, H / 2 - 130);
        sym.lineTo(W / 2, H / 2 - 10);
        sym.strokePath();

        // Título
        const title = this.add.text(W / 2, H / 2 - 20, 'HAS CAÍDO', {
            fontSize: '64px',
            color: '#cc2233',
            fontFamily: 'Georgia, serif',
            stroke: '#000000',
            strokeThickness: 8,
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: title,
            alpha: 1,
            y: H / 2 - 30,
            duration: 1000,
            ease: 'Power2',
        });

        // Subtítulo
        const sub = this.add.text(W / 2, H / 2 + 50, 'La oscuridad te consume', {
            fontSize: '22px',
            color: '#882233',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
        }).setOrigin(0.5).setAlpha(0);

        this.time.delayedCall(800, () => {
            this.tweens.add({ targets: sub, alpha: 1, duration: 800 });
        });

        // Opciones
        this.time.delayedCall(1600, () => {
            const retryText = this.add.text(W / 2, H / 2 + 120, '[ ENTER / R ] – Volver a intentar', {
                fontSize: '20px',
                color: '#aa6688',
                fontFamily: 'monospace',
            }).setOrigin(0.5);

            this.add.text(W / 2, H / 2 + 158, '[ M ] – Menú principal', {
                fontSize: '18px',
                color: '#775566',
                fontFamily: 'monospace',
            }).setOrigin(0.5);

            // Pulsación para reiniciar
            this.tweens.add({
                targets: retryText,
                alpha: { from: 0.4, to: 1 },
                duration: 800,
                yoyo: true,
                repeat: -1,
            });

            const kb = this.input.keyboard!;
            kb.once('keydown-R',     () => this.restartGame());
            kb.once('keydown-ENTER', () => this.restartGame());
            kb.once('keydown-M',     () => this.scene.start('MainMenu'));

            // También click
            this.input.once('pointerdown', () => this.restartGame());
        });
    }

    private restartGame(): void {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene');
        });
    }
}

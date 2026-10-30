// ============================================================
//  PlayerController.ts  –  Gestión de input (Fase 1 + Fase 2)
//  Movimiento, combate con espadas y controles elementales:
//    1 / 2 : seleccionar slot
//    Q     : alternar entre slots
//    E     : activar habilidad elemental
//    F     : abrir selector de elementos (manejado en GameScene)
// ============================================================

import * as Phaser from 'phaser';
import { Player } from './Player';
import { ElementSystem } from '../elements/ElementSystem';

export interface InputKeys {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key;
    attackLight: Phaser.Input.Keyboard.Key;
    attackHeavy: Phaser.Input.Keyboard.Key;
    slot1: Phaser.Input.Keyboard.Key;   // tecla 1
    slot2: Phaser.Input.Keyboard.Key;   // tecla 2
    toggleSlot: Phaser.Input.Keyboard.Key;   // Q
    activate: Phaser.Input.Keyboard.Key;   // E
    selector: Phaser.Input.Keyboard.Key;   // F
}

export class PlayerController {
    private player: Player;
    private elements: ElementSystem;
    private keys: InputKeys;

    // Estado de salto
    private jumpWasDown = false;
    private jumpBuffer = 0;

    // Estado de carga eléctrica
    private chargeHeld = false;

    // Callback para abrir el selector (manejado en GameScene)
    public onOpenSelector?: (slot: 0 | 1) => void;

    // Aire equipado (sincronizado desde GameScene vía ElementSystem)
    get airEquipped(): boolean { return this.elements.airEquipped; }

    public isGliding = false;

    constructor(scene: Phaser.Scene, player: Player, elements: ElementSystem) {
        this.player = player;
        this.elements = elements;

        const kb = scene.input.keyboard!;
        this.keys = {
            left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            attackLight: kb.addKey(Phaser.Input.Keyboard.KeyCodes.J),
            attackHeavy: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
            slot1: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            slot2: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            toggleSlot: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
            activate: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            selector: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
        };
    }

    update(time: number, _delta: number): void {
        const p = this.player;
        const keys = this.keys;
        if (p.isDead) return;

        // ── Movimiento horizontal ─────────────────────────────────
        if (keys.left.isDown && !keys.right.isDown) {
            p.moveLeft(false);
        } else if (keys.right.isDown && !keys.left.isDown) {
            p.moveRight(false);
        } else {
            p.stopHorizontal();
        }

        // ── Salto + coyote time + buffer ──────────────────────────
        const jumpDown = keys.jump.isDown;

        if (jumpDown && !this.jumpWasDown) {
            this.jumpBuffer = time + 80;
        }

        if (!this.jumpWasDown && jumpDown) {
            p.tryJump(this.airEquipped);
        } else if (time < this.jumpBuffer && p.onGround) {
            p.tryJump(this.airEquipped);
            this.jumpBuffer = 0;
        }

        // ── Planeo con Aire ────────────────────────────────────────
        if (jumpDown && !p.onGround && this.airEquipped) {
            p.applyGlide();
            this.isGliding = true;
        } else {
            this.isGliding = false;
        }

        this.jumpWasDown = jumpDown;

        // ── Ataque ligero J (mantener = carga eléctrica) ──────────
        const lightDown = keys.attackLight.isDown;

        if (lightDown && !this.chargeHeld) {
            p.beginCharge();
            this.chargeHeld = true;
        }

        if (!lightDown && this.chargeHeld) {
            if (p.attackSystem.chargeReady) {
                p.releaseCharge();
            } else {
                p.attackSystem.cancelCharge();
                p.lightAttack();
            }
            this.chargeHeld = false;
        }

        // ── Ataque fuerte K (onda de sangre) ──────────────────────
        if (Phaser.Input.Keyboard.JustDown(keys.attackHeavy)) {
            p.heavyAttack();
        }

        // ── Teclas elementales ────────────────────────────────────

        // Seleccionar slot 1
        if (Phaser.Input.Keyboard.JustDown(keys.slot1)) {
            this.elements.selectSlot(0);
        }

        // Seleccionar slot 2
        if (Phaser.Input.Keyboard.JustDown(keys.slot2)) {
            this.elements.selectSlot(1);
        }

        // Alternar slot (Q)
        if (Phaser.Input.Keyboard.JustDown(keys.toggleSlot)) {
            this.elements.toggleSlot();
        }

        // Activar habilidad elemental (E)
        if (Phaser.Input.Keyboard.JustDown(keys.activate)) {
            this.elements.activate(p.x, p.y, p.facingRight);
        }

        // Abrir selector de elementos (F) — delega a GameScene
        if (Phaser.Input.Keyboard.JustDown(keys.selector)) {
            this.onOpenSelector?.(this.elements.activeIndex);
        }
    }

    destroy(): void {
        // Las teclas se limpian con la escena
    }
}

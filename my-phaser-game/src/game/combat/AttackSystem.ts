// ============================================================
//  AttackSystem.ts  –  Gestión de hitboxes de ataque
//  Crea, gestiona y destruye hitboxes de las espadas.
// ============================================================

import * as Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';

/** Tipos de ataque disponibles */
export type AttackType = 'light' | 'heavy' | 'charge';

export interface HitInfo {
    damage: number;
    knockbackX: number;
    knockbackY: number;
    stunDuration?: number;
}

export class AttackSystem {
    private scene: Phaser.Scene;
    // Grupo de hitboxes activos
    public hitboxGroup: Phaser.Physics.Arcade.StaticGroup;

    // Cooldowns (timestamps en ms)
    private lightCooldownUntil = 0;
    private heavyCooldownUntil = 0;

    // Estado de carga eléctrica
    private chargeStartTime = -1;
    private isCharging = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.hitboxGroup = scene.physics.add.staticGroup();
    }

    // ── Getters de estado ─────────────────────────────────────

    get canLightAttack(): boolean {
        return this.scene.time.now >= this.lightCooldownUntil;
    }

    get canHeavyAttack(): boolean {
        return this.scene.time.now >= this.heavyCooldownUntil;
    }

    get charging(): boolean { return this.isCharging; }

    get chargeProgress(): number {
        if (!this.isCharging || this.chargeStartTime < 0) return 0;
        const elapsed = this.scene.time.now - this.chargeStartTime;
        return Math.min(elapsed / GAME_CONFIG.ELECTRIC_SWORD.CHARGE_TIME, 1);
    }

    get chargeReady(): boolean {
        return this.isCharging &&
            this.scene.time.now - this.chargeStartTime >= GAME_CONFIG.ELECTRIC_SWORD.CHARGE_TIME;
    }

    // ── Ataque ligero (J) – ambas espadas cuerpo a cuerpo ────

    /**
     * Lanza un hitbox de ataque ligero frente al jugador.
     * @returns HitInfo si puede atacar, null si en cooldown
     */
    lightAttack(x: number, y: number, facingRight: boolean): HitInfo | null {
        if (!this.canLightAttack) return null;

        this.lightCooldownUntil = this.scene.time.now + GAME_CONFIG.ELECTRIC_SWORD.LIGHT_COOLDOWN;

        const offsetX = facingRight ? 40 : -40;
        this.spawnHitbox(
            x + offsetX, y,
            60, 44,
            GAME_CONFIG.ELECTRIC_SWORD.LIGHT_DURATION,
            0xffdd00, 0.6
        );

        this.createSlashEffect(x, y, facingRight, 0xffdd44);

        return {
            damage: GAME_CONFIG.ELECTRIC_SWORD.LIGHT_DAMAGE + GAME_CONFIG.BLOOD_SWORD.LIGHT_DAMAGE,
            knockbackX: GAME_CONFIG.ELECTRIC_SWORD.KNOCKBACK_X,
            knockbackY: GAME_CONFIG.ELECTRIC_SWORD.KNOCKBACK_Y,
        };
    }

    // ── Ataque fuerte (K) – onda de sangre ───────────────────

    heavyAttack(x: number, y: number, facingRight: boolean): HitInfo | null {
        if (!this.canHeavyAttack) return null;

        this.heavyCooldownUntil = this.scene.time.now + GAME_CONFIG.BLOOD_SWORD.HEAVY_COOLDOWN;

        // Spawneamos la onda como un objeto que se mueve
        this.spawnBloodWave(x, y, facingRight);

        return {
            damage: GAME_CONFIG.BLOOD_SWORD.HEAVY_DAMAGE,
            knockbackX: GAME_CONFIG.BLOOD_SWORD.KNOCKBACK_X,
            knockbackY: GAME_CONFIG.BLOOD_SWORD.KNOCKBACK_Y,
        };
    }

    // ── Inicio y fin de carga eléctrica ──────────────────────

    beginCharge(): void {
        if (!this.isCharging) {
            this.isCharging = true;
            this.chargeStartTime = this.scene.time.now;
        }
    }

    /** Cancela la carga sin disparar (si el tiempo no fue suficiente) */
    cancelCharge(): void {
        this.isCharging = false;
        this.chargeStartTime = -1;
    }

    releaseCharge(x: number, y: number, _facingRight: boolean): HitInfo | null {
        if (!this.isCharging) return null;

        const wasReady = this.chargeReady;
        this.isCharging = false;
        this.chargeStartTime = -1;

        if (!wasReady) return null; // No estaba cargado: no dispara

        this.lightCooldownUntil = this.scene.time.now + GAME_CONFIG.ELECTRIC_SWORD.LIGHT_COOLDOWN;

        // Arco eléctrico en área
        this.spawnElectricBurst(x, y);

        return {
            damage: GAME_CONFIG.ELECTRIC_SWORD.CHARGE_DAMAGE,
            knockbackX: GAME_CONFIG.ELECTRIC_SWORD.KNOCKBACK_X * 1.5,
            knockbackY: GAME_CONFIG.ELECTRIC_SWORD.KNOCKBACK_Y * 2,
            stunDuration: GAME_CONFIG.ELECTRIC_SWORD.CHARGE_STUN_DURATION,
        };
    }

    // ── Hitboxes privados ─────────────────────────────────────

    private spawnHitbox(
        x: number, y: number,
        w: number, h: number,
        duration: number,
        color: number,
        alpha: number
    ): Phaser.GameObjects.Rectangle {
        const rect = this.scene.add.rectangle(x, y, w, h, color, alpha);
        this.scene.physics.add.existing(rect, true);
        (rect as any).hitInfo = true; // marcador

        this.hitboxGroup.add(rect);

        this.scene.time.delayedCall(duration, () => {
            this.hitboxGroup.remove(rect, true, true);
        });

        return rect;
    }

    private spawnBloodWave(startX: number, startY: number, facingRight: boolean): void {
        const cfg = GAME_CONFIG.BLOOD_SWORD;
        const dir = facingRight ? 1 : -1;
        const wave = this.scene.add.rectangle(startX + dir * 30, startY, 40, 24, 0xcc1111, 0.85);
        this.scene.physics.add.existing(wave, false);
        const body = (wave.body as Phaser.Physics.Arcade.Body);
        body.setVelocityX(cfg.WAVE_SPEED * dir);
        body.setAllowGravity(false);

        // Efecto visual: trail de partículas
        this.createBloodTrail(wave, facingRight);

        // Colisión con enemigos – se registra en GameScene
        (wave as any).isBloodWave = true;
        (wave as any).damage = cfg.HEAVY_DAMAGE;
        (wave as any).knockbackX = cfg.KNOCKBACK_X;
        (wave as any).knockbackY = cfg.KNOCKBACK_Y;
        (wave as any).facingRight = facingRight;

        const originX = startX;
        const ticker = this.scene.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                const traveled = Math.abs(wave.x - originX);
                if (traveled >= cfg.WAVE_RANGE || !wave.active) {
                    ticker.destroy();
                    wave.destroy();
                }
            }
        });

        // Que la GameScene pueda detectar colisiones
        this.hitboxGroup.add(wave);
        (wave as any).isMovingHitbox = true;

        this.scene.time.delayedCall(cfg.HEAVY_DURATION * 3, () => {
            ticker.destroy();
            if (wave.active) {
                this.hitboxGroup.remove(wave, true, true);
            }
        });
    }

    private spawnElectricBurst(cx: number, cy: number): void {
        const r = GAME_CONFIG.ELECTRIC_SWORD.CHARGE_RADIUS;
        const burst = this.scene.add.circle(cx, cy, r, 0xffffaa, 0.5);
        this.scene.physics.add.existing(burst, true);
        (burst as any).isElectricBurst = true;
        (burst as any).damage = GAME_CONFIG.ELECTRIC_SWORD.CHARGE_DAMAGE;
        (burst as any).stunDuration = GAME_CONFIG.ELECTRIC_SWORD.CHARGE_STUN_DURATION;

        this.hitboxGroup.add(burst);

        // Animación de destello
        this.scene.tweens.add({
            targets: burst,
            alpha: { from: 0.7, to: 0 },
            scaleX: { from: 1, to: 1.6 },
            scaleY: { from: 1, to: 1.6 },
            duration: 350,
            ease: 'Power2',
            onComplete: () => {
                this.hitboxGroup.remove(burst, true, true);
            }
        });

        // Efectos de arcos eléctricos decorativos
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const ex = cx + Math.cos(angle) * r * 0.7;
            const ey = cy + Math.sin(angle) * r * 0.7;
            const spark = this.scene.add.circle(ex, ey, 6, 0xffffff, 0.9);
            this.scene.tweens.add({
                targets: spark,
                x: cx + Math.cos(angle) * r * 1.2,
                y: cy + Math.sin(angle) * r * 1.2,
                alpha: 0,
                duration: 280,
                ease: 'Power1',
                onComplete: () => spark.destroy()
            });
        }
    }

    private createSlashEffect(x: number, y: number, facingRight: boolean, color: number): void {
        const dir = facingRight ? 1 : -1;
        for (let i = 0; i < 6; i++) {
            const spark = this.scene.add.rectangle(
                x + dir * (20 + i * 8),
                y + Phaser.Math.Between(-14, 14),
                Phaser.Math.Between(6, 16),
                4,
                color, 0.85
            );
            this.scene.tweens.add({
                targets: spark,
                x: spark.x + dir * Phaser.Math.Between(20, 50),
                y: spark.y + Phaser.Math.Between(-20, 20),
                alpha: 0,
                duration: Phaser.Math.Between(120, 240),
                ease: 'Power1',
                onComplete: () => spark.destroy()
            });
        }
    }

    private createBloodTrail(wave: Phaser.GameObjects.Rectangle, facingRight: boolean): void {
        const dir = facingRight ? -1 : 1;
        const ticker = this.scene.time.addEvent({
            delay: 40,
            loop: true,
            callback: () => {
                if (!wave.active) { ticker.destroy(); return; }
                const drop = this.scene.add.circle(
                    wave.x + dir * 10,
                    wave.y + Phaser.Math.Between(-8, 8),
                    Phaser.Math.Between(3, 7),
                    0xaa0000, 0.8
                );
                this.scene.tweens.add({
                    targets: drop,
                    y: drop.y + 20,
                    alpha: 0,
                    duration: 280,
                    onComplete: () => drop.destroy()
                });
            }
        });
    }

    destroy(): void {
        this.hitboxGroup.clear(true, true);
    }
}

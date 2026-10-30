// ============================================================
//  HUD.ts  –  Interfaz de usuario (Fase 1 + Fase 2)
//  Barra de vida, carga eléctrica, panel elemental con
//  2 slots, iconos, cooldowns animados y escudo de agua.
// ============================================================

import Phaser from 'phaser';
import { Player } from '../player/Player';
import { ElementSystem, ElementId } from '../elements/ElementSystem';

// ── Metadatos visuales de cada elemento ──────────────────────

interface ElemMeta { color: number; icon: string; label: string; cdColor: number; }
const ELEM_META: Record<ElementId, ElemMeta> = {
    earth: { color: 0xA0742A, icon: '⛰', label: 'TIERRA', cdColor: 0x7a5a1a },
    air:   { color: 0x88ccff, icon: '💨', label: 'AIRE',   cdColor: 0x4488aa },
    water: { color: 0x2277cc, icon: '💧', label: 'AGUA',   cdColor: 0x114466 },
    fire:  { color: 0xff5500, icon: '🔥', label: 'FUEGO',  cdColor: 0xaa2200 },
    none:  { color: 0x333344, icon: '—',  label: '—',      cdColor: 0x222233 },
};

// ── Clase de un slot elemental del HUD ───────────────────────

class SlotWidget {
    private bg:      Phaser.GameObjects.Rectangle;
    private border:  Phaser.GameObjects.Rectangle;
    private iconTxt: Phaser.GameObjects.Text;
    private nameTxt: Phaser.GameObjects.Text;
    private cdMask:  Phaser.GameObjects.Rectangle;   // máscara de cooldown
    private cdTxt:   Phaser.GameObjects.Text;        // "2.4s"
    private activeDot: Phaser.GameObjects.Arc;       // punto activo

    private readonly W = 70;
    private readonly H = 64;

    constructor(
        scene: Phaser.Scene,
        cx: number, cy: number,
        container: Phaser.GameObjects.Container
    ) {
        this.bg = scene.add.rectangle(cx, cy, this.W, this.H, 0x0d0d22, 0.85)
            .setStrokeStyle(0, 0x000000);

        this.border = scene.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0)
            .setStrokeStyle(2, 0x444455);

        this.iconTxt = scene.add.text(cx, cy - 10, '—', {
            fontSize: '24px', align: 'center'
        }).setOrigin(0.5);

        this.nameTxt = scene.add.text(cx, cy + 16, '—', {
            fontSize: '9px', color: '#888899', fontFamily: 'monospace', align: 'center'
        }).setOrigin(0.5);

        // Máscara de cooldown (sube desde abajo para indicar recarga)
        this.cdMask = scene.add.rectangle(cx, cy + this.H / 2, this.W, 0, 0x000000, 0.6)
            .setOrigin(0.5, 1);

        this.cdTxt = scene.add.text(cx, cy, '', {
            fontSize: '11px', color: '#ffffff', fontFamily: 'monospace',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        this.activeDot = scene.add.circle(cx + this.W / 2 - 6, cy - this.H / 2 + 6, 4, 0xffffff, 0);

        container.add([
            this.bg, this.border, this.cdMask,
            this.iconTxt, this.nameTxt, this.cdTxt, this.activeDot
        ]);
    }

    update(
        id: ElementId,
        cdProgress: number,   // 0..1, 1 = listo
        isActive: boolean,
        isAir: boolean
    ): void {
        const meta = ELEM_META[id];

        // Icono y texto
        this.iconTxt.setText(meta.icon);
        this.nameTxt.setText(meta.label);
        this.nameTxt.setColor(isActive ? '#ffffff' : '#888899');

        // Borde del slot
        if (isActive) {
            this.border.setStrokeStyle(2, meta.color);
            this.bg.setFillStyle(0x111133, 0.9);
        } else {
            this.border.setStrokeStyle(1, 0x333344);
            this.bg.setFillStyle(0x0d0d22, 0.7);
        }

        // Punto activo
        this.activeDot.setAlpha(isActive ? 0.9 : 0);
        this.activeDot.setFillStyle(meta.color);

        // Cooldown
        if (isAir || id === 'none') {
            this.cdMask.height = 0;
            this.cdTxt.setText(isAir ? 'PASIVO' : '');
            this.cdTxt.setFontSize('9px');
        } else if (cdProgress >= 1) {
            this.cdMask.height = 0;
            this.cdTxt.setText('');
        } else {
            const maskH = this.H * (1 - cdProgress);
            this.cdMask.setSize(this.W, maskH);
            // Texto de tiempo restante: estimado visual
            const pct = Math.round((1 - cdProgress) * 100);
            this.cdTxt.setText(`${pct}%`);
            this.cdTxt.setFontSize('13px');
        }
    }

    setX(x: number): void {
        const dx = x - this.bg.x;
        [this.bg, this.border, this.iconTxt, this.nameTxt,
         this.cdMask, this.cdTxt, this.activeDot].forEach(o => { o.x += dx; });
        this.cdMask.x += dx;
    }
}

// ── HUD principal ─────────────────────────────────────────────

export class HUD {
    private scene:    Phaser.Scene;
    private player:   Player;
    private elements: ElementSystem;
    private container: Phaser.GameObjects.Container;

    // ── Barra de vida ─────────────────────────────────────────
    private healthBg:   Phaser.GameObjects.Rectangle;
    private healthBar:  Phaser.GameObjects.Rectangle;
    private healthText: Phaser.GameObjects.Text;

    // ── Barra de carga eléctrica ──────────────────────────────
    private chargeBar:  Phaser.GameObjects.Rectangle;

    // ── Info de estado ────────────────────────────────────────
    private attackInfo: Phaser.GameObjects.Text;

    // ── Panel elemental ───────────────────────────────────────
    private slot0Widget!: SlotWidget;
    private slot1Widget!: SlotWidget;
    private activeArrow:  Phaser.GameObjects.Text;
    private shieldBar:    Phaser.GameObjects.Rectangle;
    private shieldBg:     Phaser.GameObjects.Rectangle;
    private shieldLabel:  Phaser.GameObjects.Text;
    private elemPanel:    Phaser.GameObjects.Container;

    // ── Hints de control ──────────────────────────────────────
    private controlsHint: Phaser.GameObjects.Text;

    // Constantes de layout
    private readonly BAR_W = 200;
    private readonly BAR_H = 16;
    private readonly PAD_X = 20;
    private readonly PAD_Y = 16;

    constructor(scene: Phaser.Scene, player: Player, elements: ElementSystem) {
        this.scene    = scene;
        this.player   = player;
        this.elements = elements;

        this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

        this.buildHealthBar();
        this.buildChargeBar();
        this.buildAttackInfo();
        this.buildElementPanel();
        this.buildControlsHint();
    }

    // ── Construcción del HUD ──────────────────────────────────

    private buildHealthBar(): void {
        const x = this.PAD_X;
        const y = this.PAD_Y;

        const frame = this.scene.add.rectangle(
            x + this.BAR_W / 2, y + this.BAR_H / 2,
            this.BAR_W + 4, this.BAR_H + 4,
            0x000000, 0.7
        ).setStrokeStyle(1, 0x555555);

        this.healthBg = this.scene.add.rectangle(
            x + this.BAR_W / 2, y + this.BAR_H / 2,
            this.BAR_W, this.BAR_H,
            0x550000
        );

        this.healthBar = this.scene.add.rectangle(
            x + this.BAR_W / 2, y + this.BAR_H / 2,
            this.BAR_W, this.BAR_H,
            0xcc2244
        );

        const icon = this.scene.add.text(x - 4, y - 2, '♥', {
            fontSize: '18px', color: '#ff4466'
        }).setOrigin(1, 0);

        this.healthText = this.scene.add.text(
            x + this.BAR_W / 2, y + this.BAR_H / 2,
            '100 / 100',
            { fontSize: '11px', color: '#ffffff', fontFamily: 'monospace' }
        ).setOrigin(0.5, 0.5);

        this.container.add([frame, this.healthBg, this.healthBar, icon, this.healthText]);
    }

    private buildChargeBar(): void {
        const x = this.PAD_X;
        const y = this.PAD_Y + this.BAR_H + 10;

        const label = this.scene.add.text(x - 4, y - 2, '⚡', {
            fontSize: '14px', color: '#ffdd00'
        }).setOrigin(1, 0);

        const bg = this.scene.add.rectangle(
            x + this.BAR_W / 2, y + 8,
            this.BAR_W, 10, 0x222200
        ).setStrokeStyle(1, 0x555500);

        this.chargeBar = this.scene.add.rectangle(
            x, y + 8, 0, 10, 0xffee00
        ).setOrigin(0, 0.5);

        this.container.add([label, bg, this.chargeBar]);
    }

    private buildAttackInfo(): void {
        this.attackInfo = this.scene.add.text(
            this.PAD_X, this.PAD_Y + this.BAR_H * 2 + 24, '',
            { fontSize: '13px', color: '#ffcc44', fontFamily: 'monospace' }
        );
        this.container.add(this.attackInfo);
    }

    private buildElementPanel(): void {
        const W   = this.scene.scale.width;
        const H   = this.scene.scale.height;

        // Panel en esquina inferior derecha
        const panelCX = W - 100;
        const panelCY = H - 90;
        const slotGap = 80;

        this.elemPanel = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(100);

        // Fondo del panel
        const panelBg = this.scene.add.rectangle(panelCX, panelCY, 190, 110, 0x05050f, 0.8)
            .setStrokeStyle(1, 0x332255);
        this.elemPanel.add(panelBg);

        // Etiqueta
        const lbl = this.scene.add.text(panelCX, panelCY - 46, 'ELEMENTOS  (Q: alternar  E: activar  F: cambiar)', {
            fontSize: '9px', color: '#556677', fontFamily: 'monospace', align: 'center'
        }).setOrigin(0.5);
        this.elemPanel.add(lbl);

        // Dos slots
        const s0x = panelCX - slotGap / 2;
        const s1x = panelCX + slotGap / 2;
        const sy  = panelCY + 2;

        this.slot0Widget = new SlotWidget(this.scene, s0x, sy, this.elemPanel);
        this.slot1Widget = new SlotWidget(this.scene, s1x, sy, this.elemPanel);

        // Flechas de slot activo
        this.activeArrow = this.scene.add.text(s0x, panelCY + 38, '▲', {
            fontSize: '12px', color: '#ffffff', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.elemPanel.add(this.activeArrow);

        // Números de slot
        const lbl0 = this.scene.add.text(s0x - 28, sy, '1', {
            fontSize: '11px', color: '#444455', fontFamily: 'monospace'
        }).setOrigin(0, 0.5);
        const lbl1 = this.scene.add.text(s1x - 28, sy, '2', {
            fontSize: '11px', color: '#444455', fontFamily: 'monospace'
        }).setOrigin(0, 0.5);
        this.elemPanel.add([lbl0, lbl1]);

        // Barra de escudo de agua (oculta por defecto)
        this.shieldBg = this.scene.add.rectangle(panelCX, panelCY + 52, 160, 8, 0x113355)
            .setStrokeStyle(1, 0x2266aa).setAlpha(0);
        this.shieldBar = this.scene.add.rectangle(panelCX - 80, panelCY + 52, 0, 8, 0x44aaff)
            .setOrigin(0, 0.5).setAlpha(0);
        this.shieldLabel = this.scene.add.text(panelCX, panelCY + 52, '🛡 Escudo activo', {
            fontSize: '9px', color: '#88ccff', fontFamily: 'monospace'
        }).setOrigin(0.5).setAlpha(0);

        this.elemPanel.add([this.shieldBg, this.shieldBar, this.shieldLabel]);

        // Añadir panel a la escena (independiente del container principal)
        // para facilitar el ScrollFactor 0
        this.elemPanel.setScrollFactor(0).setDepth(100);
    }

    private buildControlsHint(): void {
        const hints = [
            'A/D: Mover   SPACE: Saltar (2× con AIRE)',
            'J: Ataque (mantener=carga ⚡)   K: Onda de sangre',
            '1/2: Slot elemental   Q: Alternar   E: Activar habilidad   F: Cambiar elementos',
        ].join('\n');

        this.controlsHint = this.scene.add.text(
            this.scene.scale.width / 2,
            this.scene.scale.height - 58,
            hints,
            {
                fontSize: '11px', color: '#888899', fontFamily: 'monospace',
                align: 'center', backgroundColor: '#00000090',
                padding: { x: 10, y: 6 }
            }
        ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

        this.scene.time.delayedCall(10000, () => {
            this.scene.tweens.add({ targets: this.controlsHint, alpha: 0, duration: 1500 });
        });
    }

    // ── Update ────────────────────────────────────────────────

    update(): void {
        this.updateHealthBar();
        this.updateChargeBar();
        this.updateElementPanel();
    }

    private updateHealthBar(): void {
        const p   = this.player;
        const pct = p.health / p.maxHealth;

        this.healthBar.width = Math.max(0, this.BAR_W * pct);
        this.healthBar.x     = this.PAD_X + this.healthBar.width / 2;
        this.healthText.setText(`${p.health} / ${p.maxHealth}`);

        if (pct > 0.6)      this.healthBar.setFillStyle(0xcc2244);
        else if (pct > 0.3) this.healthBar.setFillStyle(0xdd6600);
        else                this.healthBar.setFillStyle(0xff1111);
    }

    private updateChargeBar(): void {
        const chargePct = this.player.attackSystem.chargeProgress;
        this.chargeBar.width = this.BAR_W * chargePct;
        this.chargeBar.setFillStyle(chargePct >= 1 ? 0xffffff : 0xffee00);

        let stateStr = '';
        if (this.player.playerState === 'charge') {
            stateStr = chargePct >= 1 ? '⚡ ¡CARGA LISTA! (suelta J)' : `⚡ Cargando... ${Math.round(chargePct * 100)}%`;
        }
        this.attackInfo.setText(stateStr);
    }

    private updateElementPanel(): void {
        const es = this.elements;
        const ai = es.activeIndex;

        // Actualizar slot 0
        this.slot0Widget.update(
            es.slot0.id,
            es.cooldownProgress(0),
            ai === 0,
            es.slot0.id === 'air'
        );

        // Actualizar slot 1
        this.slot1Widget.update(
            es.slot1.id,
            es.cooldownProgress(1),
            ai === 1,
            es.slot1.id === 'air'
        );

        // Mover flecha al slot activo
        const W   = this.scene.scale.width;
        const panelCX = W - 100;
        const slotGap = 80;
        const targetX = ai === 0 ? panelCX - slotGap / 2 : panelCX + slotGap / 2;
        this.activeArrow.x = targetX;

        // Escudo de agua
        const shieldOn = es.isWaterShieldActive;
        const shieldAlpha = shieldOn ? 1 : 0;
        this.shieldBg.setAlpha(shieldAlpha);
        this.shieldBar.setAlpha(shieldAlpha);
        this.shieldLabel.setAlpha(shieldAlpha);
    }

    destroy(): void {
        this.container.destroy(true);
        this.elemPanel.destroy(true);
        this.controlsHint.destroy();
    }
}

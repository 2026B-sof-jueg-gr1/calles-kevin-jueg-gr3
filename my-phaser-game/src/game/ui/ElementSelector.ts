// ============================================================
//  ElementSelector.ts  –  Selector rápido de elementos (tecla F)
//  Muestra los 4 elementos y permite cambiar la combinación
//  sin pausar el juego.
// ============================================================

import Phaser from 'phaser';
import { ElementSystem, ElementId } from '../elements/ElementSystem';

interface ElementVisual {
    id:      ElementId;
    color:   number;
    icon:    string;
    label:   string;
}

const ELEMENT_VISUALS: Record<ElementId, ElementVisual> = {
    earth: { id: 'earth', color: 0x8B6914, icon: '⛰',  label: 'TIERRA' },
    air:   { id: 'air',   color: 0xaaddff, icon: '💨',  label: 'AIRE'   },
    water: { id: 'water', color: 0x2277cc, icon: '💧',  label: 'AGUA'   },
    fire:  { id: 'fire',  color: 0xff4400, icon: '🔥',  label: 'FUEGO'  },
    none:  { id: 'none',  color: 0x333333, icon: '—',   label: '—'      },
};

export class ElementSelector {
    private scene:    Phaser.Scene;
    private system:   ElementSystem;
    private visible   = false;
    private container: Phaser.GameObjects.Container | null = null;

    // Cuál slot está siendo modificado en el selector
    private editingSlot: 0 | 1 = 0;

    constructor(scene: Phaser.Scene, system: ElementSystem) {
        this.scene  = scene;
        this.system = system;
    }

    get isOpen(): boolean { return this.visible; }

    toggle(editSlot?: 0 | 1): void {
        if (this.visible) {
            this.close();
        } else {
            this.open(editSlot ?? this.system.activeIndex);
        }
    }

    open(editSlot: 0 | 1): void {
        if (this.visible) return;
        this.visible   = true;
        this.editingSlot = editSlot;
        this.build();
    }

    close(): void {
        if (!this.visible) return;
        this.visible = false;
        this.container?.destroy(true);
        this.container = null;
    }

    private build(): void {
        const W   = this.scene.scale.width;
        const H   = this.scene.scale.height;
        const cx  = W / 2;
        const cy  = H / 2;

        const elements = this.system.getAllElements();
        const cols = 2;
        const cardW = 140, cardH = 90, gap = 16;

        const totalW = cols * cardW + (cols - 1) * gap;
        const totalH = Math.ceil(elements.length / cols) * cardH + Math.ceil(elements.length / cols - 1) * gap;

        const items: Phaser.GameObjects.GameObject[] = [];

        // Fondo semitransparente
        const overlay = this.scene.add.rectangle(cx, cy, W, H, 0x000000, 0.55)
            .setScrollFactor(0).setDepth(199);
        items.push(overlay);

        // Panel principal
        const panelW = totalW + 60;
        const panelH = totalH + 120;
        const panel  = this.scene.add.rectangle(cx, cy, panelW, panelH, 0x0d0d22, 0.96)
            .setStrokeStyle(1, 0x5533aa)
            .setScrollFactor(0).setDepth(200);
        items.push(panel);

        // Título
        const slotLabel = this.editingSlot === 0 ? 'Slot 1' : 'Slot 2';
        const title = this.scene.add.text(cx, cy - panelH / 2 + 24,
            `Equipar en ${slotLabel}  (F para cerrar)`,
            { fontSize: '16px', color: '#cc99ff', fontFamily: 'monospace', align: 'center' }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        items.push(title);

        // Slots actuales
        const slotY = cy - panelH / 2 + 50;
        [0, 1].forEach(si => {
            const sx  = cx - 50 + si * 100;
            const sid = si === 0 ? this.system.slot0.id : this.system.slot1.id;
            const vis = ELEMENT_VISUALS[sid];
            const active = si === this.editingSlot;

            const bg = this.scene.add.rectangle(sx, slotY, 80, 30,
                active ? 0x3311aa : 0x1a1a33
            ).setStrokeStyle(active ? 2 : 1, active ? 0xaa88ff : 0x444466)
             .setScrollFactor(0).setDepth(201);

            const txt = this.scene.add.text(sx, slotY, `${vis.icon} ${vis.label}`,
                { fontSize: '12px', color: active ? '#ffffff' : '#888899', fontFamily: 'monospace' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(202);

            items.push(bg, txt);
        });

        // Tarjetas de elementos
        const startX = cx - totalW / 2 + cardW / 2;
        const startY = cy - totalH / 2 + cardH / 2 + 30;

        elements.forEach((eid, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const ex  = startX + col * (cardW + gap);
            const ey  = startY + row * (cardH + gap);

            const vis        = ELEMENT_VISUALS[eid];
            const isEquipped = this.system.slot0.id === eid || this.system.slot1.id === eid;
            const isActive   = this.editingSlot === 0
                ? this.system.slot0.id === eid
                : this.system.slot1.id === eid;

            const cardBg = this.scene.add.rectangle(ex, ey, cardW, cardH,
                isActive   ? vis.color & 0xffffff : 0x1a1230
            ).setAlpha(isActive ? 0.8 : 0.6)
             .setStrokeStyle(2, isEquipped ? vis.color : 0x444455)
             .setScrollFactor(0).setDepth(201);

            const iconTxt = this.scene.add.text(ex, ey - 16, vis.icon,
                { fontSize: '28px' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(202);

            const labelTxt = this.scene.add.text(ex, ey + 18, vis.label,
                { fontSize: '13px', color: isActive ? '#ffffff' : '#aaaacc', fontFamily: 'monospace' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(202);

            const hint = this.scene.add.text(ex, ey + 34, isActive ? '✓ Equipado' : (isEquipped ? '⊙ Otro slot' : ''),
                { fontSize: '10px', color: isActive ? '#aaff88' : '#aaaaaa', fontFamily: 'monospace' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(202);

            // Interactividad
            cardBg.setInteractive({ useHandCursor: true });
            cardBg.on('pointerover', () => {
                cardBg.setFillStyle((vis.color & 0xffffff) | 0x111100);
                cardBg.setAlpha(0.85);
            });
            cardBg.on('pointerout',  () => {
                cardBg.setFillStyle(isActive ? vis.color & 0xffffff : 0x1a1230);
                cardBg.setAlpha(isActive ? 0.8 : 0.6);
            });
            cardBg.on('pointerdown', () => this.selectElement(eid));

            items.push(cardBg, iconTxt, labelTxt, hint);
        });

        // Hints de teclado (1-4)
        const keyHint = this.scene.add.text(cx, cy + panelH / 2 - 20,
            'Haz clic en un elemento para equiparlo',
            { fontSize: '12px', color: '#666688', fontFamily: 'monospace' }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        items.push(keyHint);

        this.container = this.scene.add.container(0, 0, items)
            .setScrollFactor(0).setDepth(199);
    }

    private selectElement(id: ElementId): void {
        this.system.selectSlot(this.editingSlot);
        this.system.equipElement(id);
        this.close();
        this.build(); // re-renderizar brevemente para confirmar
        this.scene.time.delayedCall(300, () => this.close());
    }

    destroy(): void {
        this.close();
    }
}

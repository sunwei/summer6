// This file draws the Minecraft-style hotbar shown at the bottom of the screen.
import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ITEMS } from '../constants.js';

const SLOT_ITEMS = [
  ITEMS.CRYSTAL_ZHUQUE,
  ITEMS.CRYSTAL_HUANGLONG,
  ITEMS.CRYSTAL_BAIHU,
  ITEMS.CRYSTAL_XUANWU,
  ITEMS.CRYSTAL_QINGLONG,
  ITEMS.SKILL_TAIJI,
  ITEMS.SKILL_YIJINJING,
  ITEMS.TAIJI_SWORD,
  ITEMS.CHAN_STAFF,
  ITEMS.XUANWU_BLADE,
];

// Keyboard key shown in the bottom-right corner of each slot
const SLOT_KEY_LABELS = {
  [ITEMS.CRYSTAL_ZHUQUE]:    'Z',
  [ITEMS.CRYSTAL_HUANGLONG]: 'C',   // 黄龙震地
  [ITEMS.CRYSTAL_BAIHU]:     '',
  [ITEMS.CRYSTAL_XUANWU]:    'X',  // 玄武护体（X键激活）
  [ITEMS.CRYSTAL_QINGLONG]:  '',
  [ITEMS.SKILL_TAIJI]:       '',   // 随J键自动触发八卦弹，无独立热键
  [ITEMS.SKILL_YIJINJING]:   'V',   // 易筋经爆发
  [ITEMS.TAIJI_SWORD]:       '⚔',  // 装备自动生效
  [ITEMS.CHAN_STAFF]:         '🦯', // 禅杖
  [ITEMS.XUANWU_BLADE]:      '🗡️', // 玄武战刀
};

const ITEM_TEXTURES = {
  [ITEMS.CRYSTAL_ZHUQUE]: 'crystal_yellow',
  [ITEMS.CRYSTAL_HUANGLONG]: 'crystal_yellow',
  [ITEMS.CRYSTAL_BAIHU]: 'crystal_yellow',
  [ITEMS.CRYSTAL_XUANWU]: 'crystal_yellow',
  [ITEMS.CRYSTAL_QINGLONG]: 'crystal_yellow',
  [ITEMS.SKILL_TAIJI]: 'skill_taiji_icon',
  [ITEMS.SKILL_YIJINJING]: 'skill_yijin_icon',
  [ITEMS.TAIJI_SWORD]: 'taiji_sword',
  [ITEMS.CHAN_STAFF]: 'chan_staff',
  [ITEMS.XUANWU_BLADE]: 'xuanwu_blade',
};

const ITEM_TINTS = {
  [ITEMS.CRYSTAL_ZHUQUE]: 0xff7b54,
  [ITEMS.CRYSTAL_HUANGLONG]: 0xffd700,
  [ITEMS.CRYSTAL_BAIHU]: 0xf0f6ff,
  [ITEMS.CRYSTAL_XUANWU]: 0x7ef7c6,
  [ITEMS.CRYSTAL_QINGLONG]: 0x66d9ff,
  [ITEMS.SKILL_TAIJI]: 0xffd700,
  [ITEMS.SKILL_YIJINJING]: 0xff9f43,
  [ITEMS.TAIJI_SWORD]: 0xd8f0ff,
  [ITEMS.CHAN_STAFF]: 0xdaa520,
  [ITEMS.XUANWU_BLADE]: 0x7ef7c6,
};

export class HotbarUI {
  constructor(scene, inventoryState) {
    this.scene = scene;
    this.inventoryState = { ...inventoryState };
    this.slots = [];
    this.root = this.scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);

    this.createSlots();
    this.update(this.inventoryState);
  }

  createSlots() {
    const barWidth = 10 * 48;
    const startX = GAME_WIDTH / 2 - barWidth / 2 + 24;
    const y = GAME_HEIGHT - 50; // sits in the 80px HUD zone below game viewport

    SLOT_ITEMS.forEach((itemKey, index) => {
      const x = startX + index * 48;
      const bg = this.scene.add.image(x, y, 'hotbar_slot').setScrollFactor(0);
      const icon = this.scene.add.image(x, y - 1, ITEM_TEXTURES[itemKey] || 'particle').setScrollFactor(0);
      const cooldownBg = this.scene.add.rectangle(x, y + 16, 36, 3, 0x0f1720, 1).setScrollFactor(0);
      const cooldown = this.scene.add.rectangle(x - 18, y + 16, 36, 3, 0x4caf50, 1).setOrigin(0, 0.5).setScrollFactor(0);

      // Key badge in bottom-right corner of slot (replaces the old slot number)
      const keyLabel = SLOT_KEY_LABELS[itemKey] || '';
      const keyBadge = this.scene.add
        .text(x + 14, y + 13, keyLabel, {
          fontSize: '9px',
          fontStyle: 'bold',
          color: '#ffe066',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0);

      // Minecraft-style cooldown overlay: dark blue rect anchored at bottom, drains top-to-bottom.
      const cdOverlay = this.scene.add
        .rectangle(x, y + 17, 36, 36, 0x0027bb, 0.72)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setVisible(false);

      if (itemKey) {
        icon.setTint(ITEM_TINTS[itemKey] || 0xffffff);
      }

      if (itemKey && itemKey.startsWith('crystal')) {
        icon.setScale(0.95);
      }

      this.root.add([bg, icon, cooldownBg, cooldown, keyBadge, cdOverlay]);
      this.slots.push({ itemKey, bg, icon, cooldown, keyBadge, cdOverlay });
    });
  }

  update(inventoryState) {
    this.inventoryState = { ...inventoryState };

    this.slots.forEach((slot) => {
      if (!slot.itemKey) {
        slot.icon.setVisible(false);
        slot.cooldown.setAlpha(0.3);
        return;
      }

      const collected = !!this.inventoryState[slot.itemKey];
      slot.icon.setVisible(true);
      slot.icon.setAlpha(collected ? 1 : 0.2);
      slot.icon.setScale(collected ? 1 : 0.95);
      slot.cooldown.width = 36;
      slot.cooldown.setAlpha(collected ? 1 : 0.35);
      // Dim key badge until skill is acquired
      slot.keyBadge.setAlpha(collected ? 1 : 0.35);
    });
  }

  /** No-op — slot selection is no longer used. Kept for call-site compatibility. */
  setActiveSlot() {}

  /**
   * Trigger the Minecraft-style cooldown overlay for the given item slot.
   * The dark overlay covers the icon and drains away (top-to-bottom) over `duration` ms.
   */
  startCooldown(itemKey, duration) {
    const slotIdx = SLOT_ITEMS.indexOf(itemKey);
    if (slotIdx === -1) return;
    const { cdOverlay } = this.slots[slotIdx];

    // Kill any running cooldown tween on this slot before starting a new one
    this.scene.tweens.killTweensOf(cdOverlay);
    cdOverlay.scaleY = 1;
    cdOverlay.setVisible(true);

    this.scene.tweens.add({
      targets: cdOverlay,
      scaleY: 0,
      duration,
      ease: 'Linear',
      onComplete: () => cdOverlay.setVisible(false),
    });
  }

  flashSlot(index) {
    const slot = this.slots[index - 1];

    if (!slot) {
      return;
    }

    this.scene.tweens.add({
      targets: [slot.bg, slot.icon],
      scale: '+=0.12',
      alpha: { from: 0.4, to: 1 },
      duration: 180,
      yoyo: true,
      repeat: 2,
    });
  }
}

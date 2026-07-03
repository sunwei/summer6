// This file draws the heads-up display: HP bar, location, hint text, and hotbar.
import * as Phaser from 'phaser';
import { COLORS, GAME_WIDTH, SCENES, ITEMS } from '../constants.js';
import { HotbarUI } from '../ui/HotbarUI.js';
import { skillSystem } from '../systems/SkillSystem.js';
import { bus, EVENTS } from '../events.js';
import { music } from '../systems/MusicSystem.js';

export class HUDScene extends Phaser.Scene {
  constructor() {
    super(SCENES.HUD);
  }

  create() {
    this.currentHint = '';
    this.healthValue = 100;
    this.maxHealthValue = 100;
    this.wisdomValue = 0;
    this.currentAttack = 10;

    this.hotbar = new HotbarUI(this, skillSystem.getInventory());

    this.hpPanel = this.add.rectangle(18, 18, 214, 28, 0x000000, 0.38).setOrigin(0, 0).setScrollFactor(0);
    this.hpPanel.setStrokeStyle(1, 0xffffff, 0.16);

    this.hpLabel = this.add
      .text(28, 31, '❤ 小北', {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    this.hpBarBg = this.add.rectangle(108, 31, 108, 12, 0x3b1f26, 1).setOrigin(0, 0.5).setScrollFactor(0);
    this.hpBarFill = this.add.rectangle(108, 31, 108, 12, COLORS.HP_BAR, 1).setOrigin(0, 0.5).setScrollFactor(0);

    // Wisdom panel — shown below HP bar
    this.wisdomPanel = this.add.rectangle(18, 50, 214, 22, 0x000000, 0.38).setOrigin(0, 0).setScrollFactor(0);
    this.wisdomPanel.setStrokeStyle(1, 0xffd700, 0.25);

    this.wisdomLabel = this.add
      .text(26, 61, '📖', { fontSize: '14px', color: '#ffd700' })
      .setOrigin(0, 0.5)
      .setScrollFactor(0);

    this.wisdomBarBg = this.add.rectangle(48, 61, 124, 9, 0x2a1f00, 1).setOrigin(0, 0.5).setScrollFactor(0);
    this.wisdomBarFill = this.add.rectangle(48, 61, 0, 9, 0xffd700, 1).setOrigin(0, 0.5).setScrollFactor(0);

    this.attackText = this.add
      .text(200, 61, '⚔10', {
        fontSize: '12px',
        color: '#aaddff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0);

    this.locationText = this.add
      .text(GAME_WIDTH / 2, 30, '🏔️ 武当山', {
        fontSize: '24px',
        color: '#fff1a6',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.hintText = this.add
      .text(GAME_WIDTH - 20, 24, '', {
        fontSize: '16px',
        color: '#d8e6ff',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0);

    this.bannerBg = this.add.rectangle(GAME_WIDTH / 2, 84, 360, 40, 0x10131d, 0.92).setScrollFactor(0).setVisible(false);
    this.bannerBg.setStrokeStyle(2, COLORS.UI_BORDER, 1);
    this.bannerText = this.add
      .text(GAME_WIDTH / 2, 84, '', {
        fontSize: '24px',
        color: '#fff1a6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false);

    // Mute button — top-right corner
    this._muteBtn = this.add
      .text(GAME_WIDTH - 10, 8, '🔊', { fontSize: '20px' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(999);

    this._muteBtn.on('pointerdown', () => {
      music.toggleMute();
      this._muteBtn.setText(music.isMuted() ? '🔇' : '🔊');
    });

    this.onItemCollected = ({ itemKey, inventory }) => {
      this.hotbar.update(inventory);

      if (itemKey === ITEMS.SKILL_TAIJI) {
        this.hotbar.flashSlot(6);
        this.showBanner('✨ 太极拳 已解锁！');
      }
    };

    this.onPlayerHurt = ({ hp, maxHp, wisdom, attack }) => {
      this.setHealth(hp, maxHp);
      if (wisdom !== undefined) {
        this.setWisdom(wisdom, attack);
      }
    };

    this.onSkillCooldown = ({ itemKey, duration }) => {
      this.hotbar.startCooldown(itemKey, duration);
    };

    bus.on(EVENTS.ITEM_COLLECTED, this.onItemCollected);
    bus.on(EVENTS.PLAYER_HURT, this.onPlayerHurt);
    bus.on(EVENTS.SKILL_COOLDOWN, this.onSkillCooldown);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EVENTS.ITEM_COLLECTED, this.onItemCollected);
      bus.off(EVENTS.PLAYER_HURT, this.onPlayerHurt);
      bus.off(EVENTS.SKILL_COOLDOWN, this.onSkillCooldown);
    });
  }

  setActiveSlot(index) {
    this.hotbar.setActiveSlot(index);
  }

  setLocation(text) {
    this.locationText.setText(text);
  }

  setHint(text) {
    if (text === this.currentHint) {
      return;
    }

    this.currentHint = text;
    this.hintText.setText(text);
  }

  setHealth(hp, maxHp = 100) {
    this.healthValue = hp;
    this.maxHealthValue = maxHp;
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    this.hpBarFill.width = 108 * ratio;
  }

  setWisdom(wisdom, attack) {
    this.wisdomValue = wisdom || 0;
    if (attack !== undefined) this.currentAttack = attack;
    const ratio = Math.min(this.wisdomValue / 100, 1);
    this.wisdomBarFill.width = 124 * ratio;
    this.attackText.setText(`⚔${this.currentAttack}`);
    // Gold bar turns brighter as wisdom grows
    const brightness = Math.floor(0x99 + ratio * 0x66);
    this.wisdomBarFill.setFillStyle(Phaser.Display.Color.GetColor(brightness, Math.floor(brightness * 0.85), 0));
  }

  showBanner(text) {
    this.bannerBg.setVisible(true).setAlpha(0);
    this.bannerText.setVisible(true).setAlpha(0).setText(text);

    this.tweens.add({
      targets: [this.bannerBg, this.bannerText],
      alpha: { from: 0, to: 1 },
      duration: 180,
      yoyo: true,
      hold: 1200,
      onComplete: () => {
        this.bannerBg.setVisible(false);
        this.bannerText.setVisible(false);
      },
    });
  }
}

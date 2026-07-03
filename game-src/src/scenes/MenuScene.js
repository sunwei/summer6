// This file draws the main menu with stars, mountains, clouds, and the start button.
import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, SCENES } from '../constants.js';
import { skillSystem } from '../systems/SkillSystem.js';
import { music } from '../systems/MusicSystem.js';
import { sfx } from '../systems/SoundFX.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MENU);
  }

  create() {
    this.cameras.main.setBackgroundColor('#050814');
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050814, 1);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.65, GAME_WIDTH, GAME_HEIGHT * 0.7, COLORS.SKY_BOT, 0.45);

    this.createStars();
    this.createMountains();
    this.createClouds();
    this.createTitle();
    this.createCrystalRow();
    this.createStartButton();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 28, '爸爸 + 小北 · 2026暑假', {
        fontSize: '16px',
        color: '#7f8c9a',
      })
      .setOrigin(0.5);

    // Start menu BGM (unlocks AudioContext on first pointer interaction)
    this.input.once('pointerdown', () => {
      music.unlock();
      music.play('menu');
      sfx.unlock();
    });
  }

  createStars() {
    for (let i = 0; i < 50; i += 1) {
      const star = this.add.circle(
        Phaser.Math.Between(10, GAME_WIDTH - 10),
        Phaser.Math.Between(10, GAME_HEIGHT / 2),
        Phaser.Math.Between(1, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.35, 1),
      );

      this.tweens.add({
        targets: star,
        alpha: { from: 0.2, to: 1 },
        duration: Phaser.Math.Between(800, 1800),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500),
      });
    }
  }

  createMountains() {
    const far = this.add.graphics();
    far.fillStyle(COLORS.MOUNTAIN_FAR, 1);
    far.beginPath();
    far.moveTo(0, 400);
    far.lineTo(110, 280);
    far.lineTo(220, 390);
    far.lineTo(360, 230);
    far.lineTo(500, 380);
    far.lineTo(650, 250);
    far.lineTo(790, 390);
    far.lineTo(960, 260);
    far.lineTo(960, 540);
    far.lineTo(0, 540);
    far.closePath();
    far.fillPath();

    const mid = this.add.graphics();
    mid.fillStyle(COLORS.MOUNTAIN_MID, 1);
    mid.beginPath();
    mid.moveTo(0, 460);
    mid.lineTo(150, 330);
    mid.lineTo(260, 430);
    mid.lineTo(430, 280);
    mid.lineTo(560, 440);
    mid.lineTo(720, 310);
    mid.lineTo(840, 430);
    mid.lineTo(960, 350);
    mid.lineTo(960, 540);
    mid.lineTo(0, 540);
    mid.closePath();
    mid.fillPath();
  }

  createClouds() {
    const makeCloud = (x, y, alpha, duration) => {
      const cloud = this.add.container(x, y, [
        this.add.ellipse(-22, 4, 44, 26, 0xffffff, alpha),
        this.add.ellipse(0, 0, 54, 30, 0xffffff, alpha),
        this.add.ellipse(24, 6, 40, 24, 0xffffff, alpha),
      ]);

      this.tweens.add({
        targets: cloud,
        x: GAME_WIDTH + 120,
        duration,
        repeat: -1,
        delay: Phaser.Math.Between(0, 10000),
        onRepeat: () => {
          cloud.x = -140;
          cloud.y = Phaser.Math.Between(50, 180);
        },
      });
    };

    makeCloud(-100, 90, 0.18, 36000);
    makeCloud(-180, 140, 0.12, 42000);
    makeCloud(-250, 60, 0.14, 50000);
  }

  createTitle() {
    const glow = this.add
      .text(GAME_WIDTH / 2, 112, '小北寻龙记', {
        fontSize: '64px',
        color: '#ffd56b',
        fontStyle: 'bold',
        stroke: '#4b3200',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.72, to: 1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(GAME_WIDTH / 2, 168, "XiaoBei's Dragon Quest", {
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  createCrystalRow() {
    const collected = skillSystem.getInventory();
    const startX = GAME_WIDTH / 2 - 128;

    for (let i = 0; i < 5; i += 1) {
      const slot = this.add.image(startX + i * 64, 242, 'hotbar_slot').setScale(0.9);
      const crystal = this.add.image(startX + i * 64, 242, 'crystal_yellow').setScale(0.95);
      crystal.setTint([0xff7b54, 0xffd700, 0xf4f6ff, 0x7ef7c6, 0x66d9ff][i]);
      crystal.setAlpha(i === 0 || Object.values(collected).slice(i, i + 1)[0] ? 1 : 0.2);

      if (i === 0) {
        this.tweens.add({
          targets: [slot, crystal],
          alpha: { from: 0.65, to: 1 },
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  createStartButton() {
    const button = this.add.image(GAME_WIDTH / 2, 340, 'btn_normal').setInteractive({ useHandCursor: true });
    const text = this.add
      .text(button.x, button.y, '▶ 开始旅程', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    button.on('pointerover', () => {
      button.setTexture('btn_hover');
      button.setScale(1.03);
    });

    button.on('pointerout', () => {
      button.setTexture('btn_normal');
      button.setScale(1);
    });

    button.on('pointerdown', () => {
      if (this.scene.isActive(SCENES.HUD)) {
        this.scene.stop(SCENES.HUD);
      }
      this.scene.start(SCENES.WUDANG);
    });

    this.tweens.add({
      targets: text,
      alpha: { from: 0.75, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }
}

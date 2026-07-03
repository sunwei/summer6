// This file generates every texture in code so the game needs no external images.
import * as Phaser from 'phaser';
import { COLORS, SCENES } from '../constants.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  create() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Helper: draw a single pixel-art rectangle.
    const rect = (color, x, y, width, height, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillRect(x, y, width, height);
    };

    const createPlayerTexture = (key, pose = 'idle') => {
      g.clear();
      rect(0x2a1a14, 10, 4, 12, 4);
      rect(COLORS.PLAYER_SKIN, 10, 8, 12, 10);
      rect(0x000000, 12, 11, 2, 2);
      rect(0x000000, 18, 11, 2, 2);
      rect(0xd35400, 13, 15, 6, 1);
      rect(0xb03a2e, 21, 18, 7, 10);
      rect(COLORS.PLAYER_SHIRT, 9, 18, 14, 14);
      rect(0xc0392b, 11, 20, 10, 4);
      rect(COLORS.PLAYER_SKIN, 5, pose === 'jump' ? 15 : 19, 4, 10);
      rect(COLORS.PLAYER_SKIN, 23, pose === 'attack' ? 17 : pose === 'jump' ? 15 : 19, pose === 'attack' ? 12 : 4, 10);
      rect(COLORS.PLAYER_PANTS, 9, 32, 14, 6);

      if (pose === 'run1') {
        rect(COLORS.PLAYER_PANTS, 9, 38, 6, 10);
        rect(COLORS.PLAYER_PANTS, 17, 36, 6, 12);
      } else if (pose === 'run2') {
        rect(COLORS.PLAYER_PANTS, 9, 36, 6, 12);
        rect(COLORS.PLAYER_PANTS, 17, 38, 6, 10);
      } else {
        rect(COLORS.PLAYER_PANTS, 9, 36, 6, 12);
        rect(COLORS.PLAYER_PANTS, 17, 36, 6, 12);
      }

      rect(0x111111, 9, 46, 6, 2);
      rect(0x111111, 17, 46, 6, 2);
      g.generateTexture(key, pose === 'attack' ? 48 : 32, 48);
    };

    createPlayerTexture('player_idle', 'idle');
    createPlayerTexture('player_run_1', 'run1');
    createPlayerTexture('player_run_2', 'run2');
    createPlayerTexture('player_jump', 'jump');
    createPlayerTexture('player_attack', 'attack');

    g.clear();
    rect(COLORS.PLATFORM_TOP, 0, 0, 32, 4);
    rect(0x6ea54f, 0, 4, 32, 2);
    rect(COLORS.PLATFORM_BODY, 0, 6, 32, 26);
    rect(0x5a341c, 4, 10, 4, 4);
    rect(0x7c4f2d, 16, 14, 5, 3);
    rect(0x4b2a17, 24, 20, 3, 5);
    rect(0x8a5a37, 10, 24, 3, 3);
    g.generateTexture('tile_platform', 32, 32);

    g.clear();
    rect(0x6c788a, 0, 0, 32, 32);
    rect(0x5b6574, 0, 10, 32, 2);
    rect(0x5b6574, 0, 22, 32, 2);
    rect(0x7c8798, 10, 0, 2, 10);
    rect(0x7c8798, 22, 10, 2, 12);
    rect(0x7c8798, 14, 22, 2, 10);
    g.generateTexture('tile_wall', 32, 32);

    g.clear();
    rect(0x42516d, 10, 6, 12, 10);
    rect(0x97a8ff, 8, 10, 16, 24, 0.88);
    rect(0xcfd9ff, 12, 6, 8, 8, 0.95);
    rect(0x6f7eff, 6, 18, 20, 16, 0.55);
    rect(0xeaf2ff, 14, 12, 4, 4, 0.7);
    g.generateTexture('enemy_spirit', 32, 48);

    g.clear();
    rect(0xffffff, 10, 8, 12, 12);
    rect(0xe8e8e8, 8, 20, 16, 20);
    rect(0xd4af37, 10, 4, 12, 4);
    rect(0xaaaaaa, 10, 16, 12, 6);
    rect(0xffffff, 12, 22, 8, 12);
    rect(0xe0e0e0, 8, 40, 16, 20);
    rect(0xc8c8c8, 12, 48, 8, 8);
    g.generateTexture('npc_taoist', 32, 64);

    g.clear();
    rect(0xfff4b0, 10, 0, 4, 4);
    rect(0xffd700, 6, 4, 12, 4);
    rect(0xf4c542, 2, 8, 20, 8);
    rect(0xffe48b, 6, 16, 12, 4);
    rect(0xfff2a8, 10, 20, 4, 4);
    rect(0xffffff, 12, 2, 2, 2);
    g.generateTexture('crystal_yellow', 24, 24);

    g.clear();
    rect(0xc8a87a, 2, 14, 24, 12);
    rect(0xffd27a, 4, 10, 20, 6);
    rect(0x8b4513, 6, 8, 4, 4);
    rect(0x8b4513, 14, 8, 4, 4);
    rect(0xa0522d, 10, 6, 8, 4);
    rect(0xffeaa0, 3, 22, 22, 2);
    g.generateTexture('food_ganmian', 28, 28);

    g.clear();
    rect(0xf5c518, 2, 2, 24, 24);
    rect(0xe8a800, 4, 4, 20, 20);
    rect(0xd4891a, 6, 10, 16, 4);
    rect(0xd4891a, 6, 16, 16, 2);
    rect(0xfff3a0, 2, 2, 24, 2);
    g.generateTexture('food_doupi', 28, 28);

    g.clear();
    rect(0x8b3a1a, 3, 12, 22, 13);
    rect(0xc4621e, 4, 8, 20, 6);
    rect(0xf5e6d0, 7, 9, 5, 4);
    rect(0xf5e6d0, 14, 9, 5, 4);
    rect(0x6b2a14, 3, 22, 22, 2);
    g.generateTexture('food_lotus', 28, 28);

    g.clear();
    rect(0xffd700, 0, 0, 32, 32);
    rect(0x101820, 6, 6, 20, 20);
    rect(0xffd700, 8, 6, 8, 8);
    rect(0xffffff, 16, 10, 6, 6);
    rect(0xffd700, 12, 18, 8, 6);
    g.generateTexture('skill_taiji_icon', 32, 32);

    g.clear();
    rect(0xff9f43, 6, 8, 18, 14);
    rect(0xffc078, 8, 6, 6, 8);
    rect(0xffc078, 14, 4, 6, 8);
    rect(0xffc078, 20, 8, 4, 10);
    rect(0xb3541e, 10, 20, 12, 6);
    g.generateTexture('skill_yijin_icon', 32, 32);

    // 八卦元气弹 — 太极图 (black/white yin-yang) orb, fired by Taiji punch (20×20 px)
    // Construction: 1) black full circle  2) white right-half  3) white upper lobe
    //               4) black lower lobe   5) black eye in yang  6) white eye in yin
    g.clear();
    g.lineStyle(1, 0x8888ff, 1);
    g.strokeCircle(10, 10, 9);
    g.fillStyle(0x111111, 1);
    g.fillCircle(10, 10, 9);
    g.fillStyle(0xffffff, 1);
    g.slice(10, 10, 9, -Math.PI / 2, Math.PI / 2, false);
    g.fillPath();
    g.fillCircle(10, 6, 4);
    g.fillStyle(0x111111, 1);
    g.fillCircle(10, 14, 4);
    g.fillCircle(10, 6, 1);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(10, 14, 1);
    g.generateTexture('bagua_orb', 20, 20);

    g.clear();
    g.fillStyle(COLORS.UI_BG, 1);
    g.fillRoundedRect(0, 0, 44, 44, 6);
    g.lineStyle(2, COLORS.UI_BORDER, 0.9);
    g.strokeRoundedRect(1, 1, 42, 42, 6);
    g.generateTexture('hotbar_slot', 44, 44);

    g.clear();
    g.fillStyle(0x232946, 1);
    g.fillRoundedRect(0, 0, 44, 44, 6);
    g.fillStyle(0xffffff, 0.08);
    g.fillRoundedRect(4, 4, 36, 36, 6);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeRoundedRect(1, 1, 42, 42, 6);
    g.generateTexture('hotbar_slot_active', 44, 44);

    g.clear();
    g.fillStyle(0xf0c64d, 0.9);
    g.fillRoundedRect(12, 10, 24, 60, 8);
    g.fillStyle(0xffef9f, 0.55);
    g.fillRoundedRect(16, 16, 16, 48, 8);
    g.lineStyle(3, 0xffd700, 1);
    g.strokeRoundedRect(10, 8, 28, 64, 8);
    g.generateTexture('portal_frame', 48, 80);

    g.clear();
    rect(0xffffff, 0, 0, 4, 4);
    g.generateTexture('particle', 4, 4);

    g.clear();
    g.fillStyle(0x111827, 1);
    g.fillRoundedRect(0, 0, 200, 50, 10);
    g.lineStyle(2, COLORS.UI_BORDER, 0.9);
    g.strokeRoundedRect(1, 1, 198, 48, 10);
    g.generateTexture('btn_normal', 200, 50);

    g.clear();
    g.fillStyle(0x1f2a44, 1);
    g.fillRoundedRect(0, 0, 200, 50, 10);
    g.fillStyle(0xffffff, 0.08);
    g.fillRoundedRect(8, 8, 184, 16, 8);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeRoundedRect(1, 1, 198, 48, 10);
    g.generateTexture('btn_hover', 200, 50);

    // Quiz scroll / book icon (28×28)
    g.clear();
    rect(0xf5deb3, 2, 2, 24, 24);
    rect(0xc8a87a, 2, 2, 24, 3);
    rect(0xc8a87a, 2, 23, 24, 3);
    rect(0x4a2c0a, 4, 7, 20, 2);
    rect(0x4a2c0a, 4, 11, 16, 2);
    rect(0x4a2c0a, 4, 15, 18, 2);
    rect(0xffd700, 11, 0, 6, 4);
    rect(0xffd700, 11, 24, 6, 4);
    g.generateTexture('quiz_scroll', 28, 28);

    this.scene.start(SCENES.MENU);
  }
}

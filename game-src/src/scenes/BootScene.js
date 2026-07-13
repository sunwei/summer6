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

    // 守金将军 — 明朝大将军，守护武当金顶的 BOSS（32×48）
    g.clear();
    // 头盔
    rect(0x5a3e0a, 6, 2, 20, 4);    // 头盔顶
    rect(0xb8820c, 4, 5, 24, 5);    // 金色盔带
    rect(0xdaa520, 6, 4, 20, 3);    // 金色高光
    // 面部
    rect(0xc8906a, 8, 10, 16, 9);   // 皮肤
    rect(0x3d1a00, 10, 13, 3, 2);   // 左眼（凶狠）
    rect(0x3d1a00, 19, 13, 3, 2);   // 右眼
    rect(0x8b0000, 12, 18, 8, 2);   // 胡须/口
    // 铠甲身体（深灰铁甲配金边）
    rect(0x2c2c2c, 4, 19, 24, 16);  // 主甲
    rect(0x464646, 6, 21, 20, 12);  // 甲面高光
    rect(0xdaa520, 4, 19, 24, 3);   // 上金边
    rect(0xdaa520, 4, 33, 24, 2);   // 下金边
    rect(0xdaa520, 15, 21, 2, 12);  // 中央金线
    // 手臂铠甲
    rect(0x2c2c2c, 0, 19, 4, 16);   // 左臂甲
    rect(0x2c2c2c, 28, 19, 4, 16);  // 右臂甲
    rect(0xdaa520, 0, 23, 4, 2);    // 左臂金带
    rect(0xdaa520, 28, 23, 4, 2);   // 右臂金带
    // 长剑（右手持）
    rect(0xb8b8c8, 30, 8, 2, 18);   // 剑刃
    rect(0xdaa520, 26, 24, 8, 2);   // 剑护手
    // 腿部铁甲
    rect(0x2c2c2c, 6, 35, 8, 13);   // 左腿
    rect(0x2c2c2c, 18, 35, 8, 13);  // 右腿
    // 战靴
    rect(0x1a1a1a, 4, 44, 10, 4);   // 左靴
    rect(0x1a1a1a, 18, 44, 10, 4);  // 右靴
    g.generateTexture('boss_general', 32, 48);

    // 太极八卦剑 — 武当金顶宝剑（20×28 拾取物）
    g.clear();
    // 剑刃（冰蓝透明感）
    rect(0xd8e8f8, 8, 2, 4, 17);    // 剑身
    rect(0xffffff, 9, 2, 2, 15);    // 剑脊高光
    rect(0x4488cc, 9, 6, 2, 4);     // 太极图纹（蓝）
    rect(0x224488, 9, 12, 2, 2);    // 太极图纹（深）
    // 护手（金色十字）
    rect(0xdaa520, 2, 19, 16, 3);   // 横护手
    rect(0xffd700, 4, 18, 12, 2);   // 护手高光
    // 剑柄（深木色）
    rect(0x5a3010, 8, 22, 4, 4);    // 柄体
    rect(0x7a5020, 9, 23, 2, 2);    // 柄高光
    // 剑鐔（金色）
    rect(0xdaa520, 7, 26, 6, 2);    // 剑鐔
    g.generateTexture('taiji_sword', 20, 28);

    // 嵩山石板平台（灰色石质）
    g.clear();
    rect(0x888080, 0, 0, 32, 6);   // 石板面
    rect(0x706870, 0, 4, 32, 2);   // 缝隙
    rect(0x5e5860, 0, 6, 32, 26);  // 石体
    rect(0x6a6468, 10, 6, 2, 26);  // 纵向裂缝
    rect(0x7a7478, 0, 0, 16, 2);   // 左高光
    rect(0x7a7478, 16, 0, 16, 2);  // 右高光
    g.generateTexture('tile_stone', 32, 32);

    // 少林武僧（敌人，棕色僧袍，32×48）
    g.clear();
    rect(0xd4a574, 10, 4, 12, 10);  // 皮肤/面部
    rect(0x3a2a1a, 10, 0, 12, 6);   // 剃度头顶
    rect(0x3d1a00, 12, 8, 2, 2);    // 左眼
    rect(0x3d1a00, 18, 8, 2, 2);    // 右眼
    rect(0xd4a574, 14, 11, 4, 2);   // 嘴
    rect(0x7c4c1e, 6, 14, 20, 18);  // 棕色僧袍身体
    rect(0x9a6030, 8, 16, 16, 8);   // 僧袍高光
    rect(0xcc9040, 6, 30, 20, 2);   // 黄色腰带
    rect(0xd4a574, 2, 16, 4, 10);   // 左臂（裸露）
    rect(0xd4a574, 26, 16, 4, 10);  // 右臂（裸露）
    rect(0x7c4c1e, 6, 32, 8, 12);   // 左腿
    rect(0x7c4c1e, 18, 32, 8, 12);  // 右腿
    rect(0x2c1a00, 4, 42, 10, 4);   // 左草鞋
    rect(0x2c1a00, 18, 42, 10, 4);  // 右草鞋
    g.generateTexture('monk_enemy', 32, 48);

    // 铁头僧王（BOSS，橙色袍，铁头带，32×48）
    g.clear();
    rect(0xd4a574, 8, 4, 16, 12);   // 面部
    rect(0x4a3010, 6, 0, 20, 6);    // 头顶（光头）
    rect(0xb87020, 4, 2, 24, 4);    // 铁质头带（金黄）
    rect(0xffd700, 6, 3, 20, 2);    // 头带高光
    rect(0x3d1a00, 10, 9, 3, 2);    // 左眼（凶狠）
    rect(0x3d1a00, 19, 9, 3, 2);    // 右眼
    rect(0x8b0000, 12, 13, 8, 2);   // 怒口
    rect(0xcc6010, 4, 16, 24, 18);  // 橙色袍身
    rect(0xdd7020, 6, 18, 20, 6);   // 袍面高光
    rect(0xffd700, 4, 32, 24, 2);   // 黄金腰带
    rect(0xcc6010, 0, 16, 4, 16);   // 左臂
    rect(0xcc6010, 28, 16, 4, 16);  // 右臂
    rect(0xd4a574, 0, 26, 4, 6);    // 左拳
    rect(0xd4a574, 28, 26, 4, 6);   // 右拳
    rect(0xcc6010, 6, 34, 8, 14);   // 左腿
    rect(0xcc6010, 18, 34, 8, 14);  // 右腿
    rect(0x8b6914, 30, 8, 3, 26);   // 铁棍（右侧持）
    rect(0xdaa520, 28, 8, 6, 3);    // 棍顶环
    g.generateTexture('monk_boss', 32, 48);

    // 少林方丈 NPC（橙黄僧袍，光头戒疤，32×64）
    g.clear();
    rect(0xd4a574, 10, 8, 12, 10);  // 面部
    rect(0x4a3010, 10, 4, 12, 6);   // 光头
    rect(0x2c1800, 11, 5, 2, 2);    // 戒疤点1
    rect(0x2c1800, 14, 5, 2, 2);    // 戒疤点2
    rect(0x2c1800, 17, 5, 2, 2);    // 戒疤点3
    rect(0x3d1a00, 12, 12, 2, 1);   // 左眼（慈悲）
    rect(0x3d1a00, 18, 12, 2, 1);   // 右眼
    rect(0xd4a574, 13, 14, 6, 2);   // 微笑嘴
    rect(0xcc9010, 8, 18, 16, 18);  // 橙黄僧袍上身
    rect(0xaa7808, 6, 20, 20, 4);   // 袍面高光
    rect(0xcc9010, 4, 18, 4, 16);   // 左臂
    rect(0xcc9010, 24, 18, 4, 16);  // 右臂
    rect(0xcc9010, 8, 36, 16, 16);  // 下摆
    rect(0x3d2000, 6, 50, 10, 6);   // 左草鞋
    rect(0x3d2000, 16, 50, 10, 6);  // 右草鞋
    rect(0xffd700, 13, 22, 6, 14);  // 佛珠垂挂
    rect(0x5a3000, 2, 14, 3, 40);   // 禅杖
    rect(0xdaa520, 0, 12, 6, 4);    // 杖顶
    g.generateTexture('npc_abbot', 32, 56);

    // 素包子食物（白色馒头，28×28）
    g.clear();
    rect(0xf0f0f0, 4, 8, 20, 14);  // 圆包体
    rect(0xffffff, 6, 6, 16, 8);   // 顶部高光
    rect(0xe0e0e0, 4, 20, 20, 4);  // 底部阴影
    rect(0xf5f5f5, 8, 8, 12, 4);   // 中间折叠纹
    rect(0xffd700, 11, 14, 6, 2);  // 内馅提示
    g.generateTexture('food_mantou', 28, 28);

    // 嵩山豆腐食物（奶白方块，28×28）
    g.clear();
    rect(0xfffff0, 2, 6, 24, 16);  // 豆腐主体
    rect(0xffffff, 4, 6, 20, 4);   // 顶面
    rect(0xe8e8d8, 2, 20, 24, 4);  // 底部阴影
    rect(0xffffcc, 6, 10, 16, 8);  // 内部纹理
    rect(0x228b22, 8, 10, 4, 3);   // 小葱
    rect(0xd4691e, 14, 10, 4, 3);  // 辣椒红
    g.generateTexture('food_tofu', 28, 28);

    this.scene.start(SCENES.MENU);
  }
}

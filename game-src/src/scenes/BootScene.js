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

    // 少林禅杖 — 嵩山供杖台拾取物（木质杖身 + 双层金环 + 杖首宝珠，20×32）
    g.clear();
    rect(0x5a3010, 8, 2, 4, 26);    // 木质杖身
    rect(0x7a5020, 9, 3, 2, 24);    // 杖身高光
    rect(0xffd700, 5, 7, 10, 3);    // 上金环
    rect(0xffd700, 5, 15, 10, 3);   // 下金环
    rect(0xfff2a8, 6, 8, 8, 1);     // 上环高光
    rect(0xdaa520, 5, 0, 10, 4);    // 杖首底座
    rect(0xfff2a8, 8, 0, 4, 3);     // 杖首宝珠高光
    rect(0xdaa520, 6, 28, 8, 3);    // 杖底石墩
    g.generateTexture('chan_staff', 20, 32);

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

    // 禅杖僧王（BOSS，橙色袍，手持双环禅杖，32×48）
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
    // 禅杖（右侧持，木质杖身 + 双层金环 + 杖首宝珠）
    rect(0x5a3010, 29, 6, 3, 30);   // 木质杖身
    rect(0xffd700, 27, 8, 7, 2);    // 上金环
    rect(0xffd700, 27, 14, 7, 2);   // 下金环
    rect(0xdaa520, 27, 3, 7, 4);    // 杖首底座
    rect(0xfff2a8, 29, 2, 3, 3);    // 杖首宝珠高光
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

    // 华山花岗岩平台（浅灰白，五峰通用石阶）
    g.clear();
    rect(0xc4ccd4, 0, 0, 32, 6);   // 花岗岩顶面
    rect(0xa8b2ba, 0, 4, 32, 2);   // 缝隙
    rect(0x8a949c, 0, 6, 32, 26);  // 岩体
    rect(0x9aa4ac, 12, 6, 2, 26);  // 纵向裂纹
    rect(0xd8e0e6, 0, 0, 14, 2);   // 左高光
    rect(0xd8e0e6, 18, 0, 14, 2);  // 右高光
    g.generateTexture('tile_granite', 32, 32);

    // 华山剑客（敌人，灰蓝劲装+短剑，32×48）
    g.clear();
    rect(0xd4a574, 10, 4, 12, 10);  // 面部
    rect(0x2a2a2a, 8, 0, 16, 6);    // 束发头顶
    rect(0x3d1a00, 12, 8, 2, 2);    // 左眼
    rect(0x3d1a00, 18, 8, 2, 2);    // 右眼
    rect(0xd4a574, 14, 11, 4, 2);   // 嘴
    rect(0x5a6a7a, 6, 14, 20, 18);  // 灰蓝劲装身体
    rect(0x748494, 8, 16, 16, 8);   // 衣服高光
    rect(0xdedede, 6, 30, 20, 2);   // 白色腰带
    rect(0xd4a574, 2, 16, 4, 10);   // 左臂
    rect(0xd4a574, 26, 16, 4, 10);  // 右臂（持剑）
    rect(0xb8b8c8, 28, 6, 2, 16);   // 剑刃
    rect(0x5a3010, 27, 22, 4, 3);   // 剑柄
    rect(0x5a6a7a, 6, 32, 8, 12);   // 左腿
    rect(0x5a6a7a, 18, 32, 8, 12);  // 右腿
    rect(0x1a1a1a, 4, 42, 10, 4);   // 左靴
    rect(0x1a1a1a, 18, 42, 10, 4);  // 右靴
    g.generateTexture('swordsman_enemy', 32, 48);

    // 白虎剑仙（BOSS，白袍虎纹+长剑，32×48）
    g.clear();
    rect(0xd4a574, 8, 4, 16, 12);   // 面部
    rect(0xf0f0f0, 5, 0, 22, 6);    // 白发/道冠
    rect(0xdedede, 4, 2, 24, 4);    // 银色头带
    rect(0xffffff, 6, 3, 20, 2);    // 头带高光
    rect(0x3d1a00, 10, 9, 3, 2);    // 左眼
    rect(0x3d1a00, 19, 9, 3, 2);    // 右眼
    rect(0xffffff, 9, 13, 14, 3);   // 白须
    rect(0xeaeaea, 4, 16, 24, 18);  // 白袍身
    rect(0xf8f8f8, 6, 18, 20, 6);   // 袍面高光
    rect(0x2c2c2c, 4, 24, 24, 4);   // 虎纹黑条1
    rect(0x2c2c2c, 4, 30, 24, 3);   // 虎纹黑条2
    rect(0xeaeaea, 0, 16, 4, 16);   // 左臂
    rect(0xeaeaea, 28, 16, 4, 16);  // 右臂
    rect(0xd4a574, 0, 26, 4, 6);    // 左拳
    rect(0xd4a574, 28, 26, 4, 6);   // 右拳
    rect(0xeaeaea, 6, 34, 8, 14);   // 左腿
    rect(0xeaeaea, 18, 34, 8, 14);  // 右腿
    rect(0xdfe6ec, 30, 4, 2, 26);   // 长剑剑刃
    rect(0xffffff, 30, 4, 1, 20);   // 剑脊高光
    rect(0xdaa520, 27, 26, 7, 3);   // 剑护手
    rect(0x5a3010, 28, 29, 4, 4);   // 剑柄
    g.generateTexture('huashan_boss', 32, 48);

    // 华山剑圣 NPC（白袍长须，32×64）
    g.clear();
    rect(0xd4a574, 10, 8, 12, 10);  // 面部
    rect(0xf0f0f0, 9, 3, 14, 7);    // 白发束顶
    rect(0xffffff, 8, 4, 16, 3);    // 道冠高光
    rect(0x3d1a00, 12, 12, 2, 1);   // 左眼
    rect(0x3d1a00, 18, 12, 2, 1);   // 右眼
    rect(0xf5f5f5, 10, 15, 12, 8);  // 长白须
    rect(0xeaeaea, 8, 18, 16, 18);  // 白袍上身
    rect(0xd8d8d8, 6, 20, 20, 4);   // 袍面高光
    rect(0xeaeaea, 4, 18, 4, 16);   // 左臂
    rect(0xeaeaea, 24, 18, 4, 16);  // 右臂
    rect(0xeaeaea, 8, 36, 16, 16);  // 下摆
    rect(0x3d2000, 6, 50, 10, 6);   // 左鞋
    rect(0x3d2000, 16, 50, 10, 6);  // 右鞋
    rect(0x5a3000, 2, 10, 3, 46);   // 长剑鞘/杖
    rect(0xdaa520, 0, 8, 6, 4);     // 杖顶金饰
    g.generateTexture('npc_swordsage', 32, 64);

    // 白虎晶 — 西岳华山气运碎片（银白虎纹晶体，24×24）
    g.clear();
    rect(0xf5f5f5, 10, 0, 4, 4);
    rect(0xe8e8e8, 6, 4, 12, 4);
    rect(0xd0d8dc, 2, 8, 20, 8);
    rect(0xf0f0f0, 6, 16, 12, 4);
    rect(0xfafafa, 10, 20, 4, 4);
    rect(0x9aa4ac, 4, 10, 16, 2);   // 虎纹条纹
    rect(0xffffff, 12, 2, 2, 2);
    g.generateTexture('crystal_baihu', 24, 24);

    // 火晶柿子食物（华山特产，28×28）
    g.clear();
    rect(0xff6a1a, 3, 8, 22, 16);   // 柿子主体
    rect(0xff8c42, 5, 10, 12, 6);   // 高光
    rect(0x2e8b30, 10, 4, 8, 5);    // 绿色蒂
    rect(0x1e5e20, 12, 3, 4, 3);    // 蒂心
    rect(0xcc4a00, 3, 20, 22, 4);   // 底部阴影
    g.generateTexture('food_shizi', 28, 28);

    // ── 恒山相关资源 ─────────────────────────────────────────────

    // 恒山玄武石平台（深灰带墨绿纹，北岳沧桑感）
    g.clear();
    rect(0x3a4250, 0, 0, 32, 6);    // 玄武石顶面（深蓝灰）
    rect(0x2e3540, 0, 4, 32, 2);    // 缝隙（更深）
    rect(0x252c38, 0, 6, 32, 26);   // 岩体
    rect(0x1a7a5a, 14, 6, 2, 26);   // 墨绿纵纹（玄武气息）
    rect(0x4a5a6a, 0, 0, 14, 2);    // 左高光
    rect(0x4a5a6a, 18, 0, 14, 2);   // 右高光
    g.generateTexture('tile_hengshan', 32, 32);

    // 恒山武者（敌人，深蓝劲装+短刀，32×48）
    g.clear();
    rect(0xd4a574, 10, 4, 12, 10);  // 面部
    rect(0x1a2a3a, 8, 0, 16, 6);    // 发髻（深蓝黑）
    rect(0x3d1a00, 12, 8, 2, 2);    // 左眼
    rect(0x3d1a00, 18, 8, 2, 2);    // 右眼
    rect(0xd4a574, 14, 11, 4, 2);   // 嘴
    rect(0x2a3a4a, 6, 14, 20, 18);  // 深蓝劲装身体
    rect(0x3a4a5a, 8, 16, 16, 8);   // 衣服高光
    rect(0x1a7a5a, 6, 30, 20, 2);   // 玄武绿腰带
    rect(0xd4a574, 2, 16, 4, 10);   // 左臂
    rect(0xd4a574, 26, 16, 4, 10);  // 右臂（持刀）
    rect(0x90a0b0, 28, 8, 3, 14);   // 短刀刃（玄武寒光）
    rect(0x1a2a3a, 27, 22, 4, 3);   // 刀柄
    rect(0x2a3a4a, 6, 32, 8, 12);   // 左腿
    rect(0x2a3a4a, 18, 32, 8, 12);  // 右腿
    rect(0x0a0a14, 4, 42, 10, 4);   // 左靴
    rect(0x0a0a14, 18, 42, 10, 4);  // 右靴
    g.generateTexture('hengshan_enemy', 32, 48);

    // 灭绝师太（BOSS，灰白尼姑袍+宝剑，霸气外露，32×48）
    g.clear();
    rect(0xd4a574, 8, 4, 16, 12);   // 面部（年长威严）
    rect(0xf0f0e8, 5, 0, 22, 6);    // 尼姑白色头帕
    rect(0xc8c8c0, 4, 2, 24, 4);    // 头帕暗边
    rect(0xffffff, 6, 3, 20, 2);    // 头帕高光
    rect(0x3d1a00, 10, 9, 3, 2);    // 左眼（凌厉）
    rect(0x3d1a00, 19, 9, 3, 2);    // 右眼
    rect(0xd4a574, 13, 13, 6, 1);   // 严肃嘴线
    rect(0x3d1a00, 10, 14, 12, 2);   // 严肃胡须/皱纹
    rect(0x7a7878, 4, 16, 24, 18);  // 灰色尼袍身
    rect(0x909090, 6, 18, 20, 6);   // 袍面高光
    rect(0x505050, 4, 24, 24, 4);   // 袍子横纹
    rect(0x7a7878, 0, 16, 4, 16);   // 左臂
    rect(0x7a7878, 28, 16, 4, 16);  // 右臂
    rect(0xd4a574, 0, 26, 4, 6);    // 左拳
    rect(0xd4a574, 28, 26, 4, 6);   // 右拳
    rect(0x7a7878, 6, 34, 8, 14);   // 左腿
    rect(0x7a7878, 18, 34, 8, 14);  // 右腿
    // 峨眉派倚天剑（左侧持，特征性长剑）
    rect(0xc8d8e8, 1, 2, 2, 28);    // 剑刃（冷光）
    rect(0xffffff, 1, 2, 1, 22);    // 剑脊高光
    rect(0x6a4020, 0, 6, 5, 1);     // 短护手
    rect(0xdaa520, -1, 28, 7, 3);   // 剑柄（金色）
    g.generateTexture('hengshan_boss', 32, 48);

    // 恒山道长 NPC（深蓝道袍，银发，手持拂尘，32×64）
    g.clear();
    rect(0xd4a574, 10, 8, 12, 10);  // 面部
    rect(0xe8e8e0, 9, 3, 14, 7);    // 银发束顶
    rect(0xffffff, 8, 4, 16, 3);    // 发带高光
    rect(0x3d1a00, 12, 12, 2, 1);   // 左眼
    rect(0x3d1a00, 18, 12, 2, 1);   // 右眼
    rect(0xe8e8d0, 10, 15, 12, 8);  // 白须
    rect(0x1a2a4a, 8, 18, 16, 18);  // 深蓝道袍上身
    rect(0x2a3a5a, 6, 20, 20, 4);   // 袍面高光
    rect(0x1a7a5a, 8, 33, 16, 4);   // 玄武绿腰带
    rect(0x1a2a4a, 4, 18, 4, 16);   // 左臂
    rect(0x1a2a4a, 24, 18, 4, 16);  // 右臂
    rect(0x1a2a4a, 8, 36, 16, 16);  // 下摆
    rect(0x0a0a14, 6, 50, 10, 6);   // 左鞋
    rect(0x0a0a14, 16, 50, 10, 6);  // 右鞋
    // 拂尘（右侧持）
    rect(0x5a3000, 25, 8, 3, 34);   // 柄
    rect(0xdedede, 23, 6, 7, 4);    // 拂尘毛（白色）
    rect(0xe8e8e8, 24, 8, 5, 6);    // 拂尘毛下垂
    g.generateTexture('npc_hengshan', 32, 64);

    // 金币（小型拾取物，16×16）
    g.clear();
    g.fillStyle(0xffd700, 1);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0xffec80, 1);
    g.fillCircle(6, 6, 3);
    g.fillStyle(0xdaa520, 1);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0xffd700, 1);
    g.fillCircle(7, 7, 5);
    g.fillStyle(0xfff0a0, 1);
    g.fillRect(6, 5, 2, 6);
    g.fillRect(4, 7, 8, 2);
    g.generateTexture('coin', 16, 16);

    // 排队游客（简单人形，20×32）
    g.clear();
    rect(0xffcc88, 7, 0, 6, 6);     // 头
    rect(0x4488cc, 5, 6, 10, 12);   // 蓝色上衣（游客形象）
    rect(0x3366aa, 5, 18, 4, 10);   // 左腿（深蓝裤）
    rect(0x3366aa, 11, 18, 4, 10);  // 右腿
    rect(0x222222, 4, 27, 5, 3);    // 左鞋
    rect(0x222222, 11, 27, 5, 3);   // 右鞋
    rect(0xffcc88, 1, 7, 4, 8);     // 左臂
    rect(0xffcc88, 15, 7, 4, 8);    // 右臂
    g.generateTexture('queue_person', 20, 32);

    // 最高海拔石碑（恒山地标，32×48）
    g.clear();
    rect(0x8a8070, 6, 4, 20, 40);   // 碑体
    rect(0xa09080, 6, 4, 20, 6);    // 碑顶（稍亮）
    rect(0x6a6060, 4, 42, 24, 6);   // 碑座
    rect(0xf0e8d0, 8, 8, 16, 2);    // 标题行
    rect(0xf0e8d0, 8, 12, 16, 1);   // 文字行1
    rect(0xf0e8d0, 8, 15, 12, 1);   // 文字行2
    rect(0xf0e8d0, 8, 18, 14, 1);   // 文字行3
    rect(0xffd700, 10, 22, 12, 8);  // 金色海拔数字区
    rect(0xffffff, 11, 23, 10, 6);  // 数字背景
    rect(0xcc4400, 12, 24, 8, 4);   // 红色海拔标注
    g.generateTexture('stele_hengshan', 32, 48);

    // 恒山豆腐（北岳特产，28×28）
    g.clear();
    rect(0xfffff2, 2, 4, 24, 18);   // 豆腐主体（类似嵩山但颜色更白）
    rect(0xffffff, 4, 4, 20, 5);    // 顶面
    rect(0xe8e8de, 2, 20, 24, 4);   // 底部阴影
    rect(0xffffee, 6, 8, 16, 10);   // 内部纹理
    rect(0x1a7a5a, 9, 9, 3, 3);     // 玄武绿（葱花）
    rect(0x3a6a9a, 14, 10, 3, 2);   // 蓝色（恒山特色）
    rect(0xcc2200, 8, 14, 4, 2);    // 红辣椒
    g.generateTexture('food_hengshan_tofu', 28, 28);

    // 手把羊肉（恒山/北方特色，28×28）
    g.clear();
    rect(0x8b3a1a, 4, 8, 20, 14);   // 羊肉主体
    rect(0xc4621e, 6, 6, 16, 6);    // 上层（烤色）
    rect(0xf5e0c0, 8, 7, 5, 4);     // 骨头端1
    rect(0xf5e0c0, 16, 7, 5, 4);    // 骨头端2
    rect(0x5a2000, 4, 20, 20, 2);   // 底部深色
    rect(0xdaa520, 10, 14, 8, 2);   // 金黄油脂
    g.generateTexture('food_mutton', 28, 28);

    // 玄武战刀（拾取物，冷钢刀身，20×28）
    g.clear();
    // 刀身（冷光玄武蓝）
    rect(0x90a8c0, 7, 2, 6, 18);    // 刀身
    rect(0xd0e8f0, 8, 2, 3, 16);    // 刀脊高光
    rect(0x26c6da, 8, 6, 2, 4);     // 玄武纹（青）
    rect(0x1a4a6a, 8, 12, 2, 2);    // 玄武纹（深）
    // 刀背（厚重）
    rect(0x5a7888, 7, 2, 2, 18);    // 刀背厚边
    // 护手（铁质乌黑）
    rect(0x2a2a3a, 2, 20, 16, 3);   // 横护手
    rect(0x1a7a5a, 4, 19, 12, 2);   // 护手玄武绿边
    // 刀柄（深木色缠绳）
    rect(0x3a2010, 7, 23, 6, 3);    // 柄体
    rect(0x1a7a5a, 8, 24, 4, 1);    // 绑绳纹（玄武绿）
    // 刀镡（圆形）
    rect(0x2a3a4a, 6, 26, 8, 2);    // 刀镡
    g.generateTexture('xuanwu_blade', 20, 28);

    this.scene.start(SCENES.MENU);
  }
}

// This file draws the main menu with stars, mountains, clouds, and the start button.
import * as Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, SCENES, ITEMS } from '../constants.js';
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
    this.createRouteMap();
    this.createCrystalRow();
    this.createStartButton();
    this.createDevPanel();

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

    // Crystal tints: past/collected = brownish, future = original colour
    const normalTints = [0xff7b54, 0xffd700, 0xf4f6ff, 0x7ef7c6, 0x66d9ff];
    const doneTint = 0x8b7355;   // 褐色 = already passed
    const crystalKeys = [
      ITEMS.CRYSTAL_ZHUQUE,
      ITEMS.CRYSTAL_HUANGLONG,
      ITEMS.CRYSTAL_BAIHU,
      ITEMS.CRYSTAL_XUANWU,
      ITEMS.CRYSTAL_QINGLONG,
    ];

    for (let i = 0; i < 5; i += 1) {
      const slot = this.add.image(startX + i * 64, 242, 'hotbar_slot').setScale(0.9);
      const crystal = this.add.image(startX + i * 64, 242, 'crystal_yellow').setScale(0.95);
      const isDone = !!collected[crystalKeys[i]];
      crystal.setTint(isDone ? doneTint : normalTints[i]);
      crystal.setAlpha(isDone ? 0.72 : 0.2);

      if (isDone) {
        // 已获得：打褐色 + ✓ 标记
        this.add.text(startX + i * 64, 222, '✓', {
          fontSize: '11px', color: '#b8916a', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
      } else {
        // 未获得：弱发光动画
        this.tweens.add({ targets: [slot, crystal], alpha: { from: 0.12, to: 0.28 }, duration: 1200, yoyo: true, repeat: -1 });
      }
    }
  }

  createRouteMap() {
    const collected = skillSystem.getInventory();
    const cy = 298;

    // 路程节点：山名 + 完成条件
    const stages = [
      { label: '南岳\n衡山', done: true,                              color: 0x8b7355 },
      { label: '武当山',    done: !!collected[ITEMS.TAIJI_SWORD],    color: 0xffd700 },
      { label: '中岳\n嵩山',done: !!collected[ITEMS.SONGSHAN_COMPLETE], color: 0xff9900 },
      { label: '东岳\n泰山', done: false,                            color: 0x66d9ff },
      { label: '西岳\n华山', done: !!collected[ITEMS.HUASHAN_COMPLETE], color: 0xf0f6ff },
      { label: '北岳\n恒山', done: false,                            color: 0x7ef7c6 },
    ];

    const spacing = 140;
    const startX = GAME_WIDTH / 2 - (stages.length - 1) * spacing / 2;

    stages.forEach((s, i) => {
      const x = startX + i * spacing;
      const col = s.done ? s.color : 0x3a3a4a;

      // 连线
      if (i < stages.length - 1) {
        const lineColor = s.done ? 0x776655 : 0x2a2a3a;
        this.add.rectangle(x + spacing / 2, cy, spacing - 14, 2, lineColor, 0.8);
      }
      // 节点圆
      const dot = this.add.circle(x, cy, 9, col, s.done ? 0.95 : 0.35);
      if (s.done) {
        this.add.text(x, cy, '✓', { fontSize: '10px', color: '#ffffff', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);
      }
      // 名称
      this.add.text(x, cy + 18, s.label, {
        fontSize: '13px', color: s.done ? '#c8a87a' : '#555566', align: 'center',
      }).setOrigin(0.5, 0);

      // 当前目的地发光
      if (!s.done && (i === 0 || stages[i - 1].done)) {
        this.tweens.add({ targets: dot, scale: { from: 1, to: 1.4 }, alpha: { from: 0.35, to: 0.9 }, duration: 900, yoyo: true, repeat: -1 });
      }
    });
  }

  createStartButton() {
    const collected = skillSystem.getInventory();
    const hasSword  = !!collected[ITEMS.TAIJI_SWORD];
    const songDone  = !!collected[ITEMS.SONGSHAN_COMPLETE];
    const huaDone   = !!collected[ITEMS.HUASHAN_COMPLETE];

    const label = huaDone ? '▶ 继续旅程 (更多关卡开发中…)'
                : songDone ? '▶ 前往华山'
                : hasSword ? '▶ 前往嵩山'
                : '▶ 开始旅程';

    const button = this.add.image(GAME_WIDTH / 2, 360, 'btn_normal').setInteractive({ useHandCursor: true });
    const text = this.add
      .text(button.x, button.y, label, {
        fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);

    button.on('pointerover', () => { button.setTexture('btn_hover'); button.setScale(1.03); });
    button.on('pointerout',  () => { button.setTexture('btn_normal'); button.setScale(1); });

    button.on('pointerdown', () => {
      if (this.scene.isActive(SCENES.HUD)) this.scene.stop(SCENES.HUD);
      if (huaDone) {
        // 更多关卡开发中 — 回到菜单或显示提示
        this.showComingSoon();
      } else if (songDone) {
        this.scene.start(SCENES.HUASHAN);
      } else if (hasSword) {
        this.scene.start(SCENES.SONGSHAN);
      } else {
        this.scene.start(SCENES.WUDANG);
      }
    });

    this.tweens.add({ targets: text, alpha: { from: 0.75, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
  }

  showComingSoon() {
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(990);
    const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🗺️ 更多关卡即将推出…\n敬请期待！', {
      fontSize: '36px', color: '#ffd700', fontStyle: 'bold', align: 'center',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(991);
    this.input.once('pointerdown', () => { bg.destroy(); msg.destroy(); });
  }

  // ──────────────────────────────────────────────────────────
  //  🛠 开发模式：跳过前置流程，直接进入指定关卡测试
  //  （自动补发该关卡所需的前置道具/技能，避免缺装备导致测试受限）
  // ──────────────────────────────────────────────────────────

  createDevPanel() {
    const panelX = 10;
    let panelY = 8;

    const title = this.add.text(panelX, panelY, '🛠 开发测试模式', {
      fontSize: '13px', color: '#ffaa00', backgroundColor: '#00000099', padding: { x: 6, y: 3 },
    }).setDepth(999);
    panelY += title.height + 4;

    const jumps = [
      {
        label: '▶ 武当山（第一关）',
        scene: SCENES.WUDANG,
        unlock: [],
      },
      {
        label: '▶ 嵩山（第二关）',
        scene: SCENES.SONGSHAN,
        unlock: [ITEMS.TAIJI_SWORD, ITEMS.SKILL_TAIJI, ITEMS.CRYSTAL_HUANGLONG],
      },
      {
        label: '▶ 华山（第三关）',
        scene: SCENES.HUASHAN,
        unlock: [
          ITEMS.TAIJI_SWORD, ITEMS.SKILL_TAIJI, ITEMS.CRYSTAL_HUANGLONG,
          ITEMS.CHAN_STAFF, ITEMS.SKILL_YIJINJING, ITEMS.SONGSHAN_COMPLETE,
        ],
      },
    ];

    jumps.forEach((jump) => {
      const btn = this.add.text(panelX, panelY, jump.label, {
        fontSize: '14px', color: '#8fd9ff', backgroundColor: '#00000088', padding: { x: 6, y: 3 },
      }).setDepth(999).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setStyle({ color: '#ffffff', backgroundColor: '#1a3a55' }));
      btn.on('pointerout',  () => btn.setStyle({ color: '#8fd9ff', backgroundColor: '#00000088' }));
      btn.on('pointerdown', (pointer, x, y, event) => {
        event.stopPropagation();
        jump.unlock.forEach((key) => skillSystem.collect(key));
        if (this.scene.isActive(SCENES.HUD)) this.scene.stop(SCENES.HUD);
        this.scene.start(jump.scene);
      });

      panelY += btn.height + 4;
    });
  }
}

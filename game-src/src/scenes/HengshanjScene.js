// 恒山关卡：山门 → 石阶云路 → 悬空寺 → 天峰岭 → 北岳极顶（战灭绝师太）→ 排队拍照 → 传送门
// 特色机制：金币系统（小兵1-2枚，BOSS250枚）+ 排队拍照（每人20秒，可花1000金币插队）
import * as Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, ITEMS, SCENES } from '../constants.js';
import { Player } from '../entities/Player.js';
import { NPC } from '../entities/NPC.js';
import { skillSystem } from '../systems/SkillSystem.js';
import { QuizUI } from '../ui/QuizUI.js';
import { DialogueBox } from '../ui/DialogueBox.js';
import { bus, EVENTS } from '../events.js';
import { music } from '../systems/MusicSystem.js';
import { sfx } from '../systems/SoundFX.js';

const HENGSHAN_QUIZZES = [
  { q: '北岳恒山位于中国哪个省份？',          choices: ['山西省', '河北省', '山东省', '河南省'],              correct: 0 },
  { q: '恒山是中国五岳中的哪岳？',            choices: ['北岳', '南岳', '东岳', '西岳'],                    correct: 0 },
  { q: '恒山最著名的建筑奇迹是什么？',        choices: ['悬空寺', '少林寺', '武当金顶', '华山论剑台'],        correct: 0 },
  { q: '悬空寺建造于哪个朝代？',              choices: ['北魏', '唐朝', '宋朝', '明朝'],                    correct: 0 },
  { q: '恒山主峰天峰岭海拔约多少米？',        choices: ['2017米', '1500米', '2500米', '3000米'],             correct: 0 },
];

// 排队等待时间（秒），每位游客
const QUEUE_WAIT_SECONDS = 20;
// 排队人数
const QUEUE_TOTAL_PERSONS = 5;
// 插队费用
const QUEUE_SKIP_COST = 1000;

export class HengshanjScene extends Phaser.Scene {
  constructor() {
    super(SCENES.HENGSHAN);
  }

  create() {
    this.portalActive = false;
    this.levelFinished = false;
    this.bossDefeated = false;
    this.bossEncounterShown = false;
    this.bossHPBarVisible = false;
    this.boss = null;
    this.bossLabel = null;
    this.bossArenaWall = null;
    this.awaitingCrystalPickup = false;
    this._musicTheme = 'hengshan';

    // 排队系统状态
    this.queueActive = false;
    this.queueFinished = false;
    this.queuePersonsLeft = QUEUE_TOTAL_PERSONS;  // 前方还有几人
    this.queueCurrentTimer = 0;                    // 当前等待的倒计时（ms）
    this.queueStarted = false;                     // 玩家是否已开始排队
    this.queueNpcs = [];                           // 排队人物（可视化）
    this.queueTimerText = null;
    this.queueSkipBtn = null;
    this.queuePanel = null;

    if (this.scene.isActive(SCENES.HUD)) this.scene.stop(SCENES.HUD);
    this.scene.launch(SCENES.HUD);
    this.hud = this.scene.get(SCENES.HUD);

    music.play('hengshan');

    this.physics.world.setBounds(0, -2000, 5500, 2560);
    const PLAY_H = GAME_HEIGHT - 80;
    this.cameras.main.setViewport(0, 0, GAME_WIDTH, PLAY_H);
    this.cameras.main.setBounds(0, -600, 5500, 1200); // 全程恒定，覆盖地面到山顶

    this.createBackground();
    this.createPlatforms();
    this.createDecorations();
    this.createSummitZone();
    this.createParticles();

    this.player = new Player(this, 80, 390);
    this.player.syncSkills(skillSystem.getInventory());
    this.physics.add.collider(this.player, this.platforms);

    this.respawnPoint = { x: 80, y: 390 };

    this.cameras.main.startFollow(this.player, true, 0.08, 0.10);
    this.cameras.main.setFollowOffset(0, 138);  // 玩家保持在视口 80% 处（地面感）
    this.cameras.main.setDeadzone(8, 320);   // 跳跃死区：单次跳跃(±160px)内摄像机静止，避免窗口跟着抖动

    this.createEnemies();
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyOverlap, null, this);

    this.foodDrops = this.physics.add.group();
    this.physics.add.collider(this.foodDrops, this.platforms);
    this.physics.add.overlap(this.player, this.foodDrops, this.collectFood, null, this);

    this.coinDrops = this.physics.add.group();
    this.physics.add.collider(this.coinDrops, this.platforms);
    this.physics.add.overlap(this.player, this.coinDrops, this.collectCoin, null, this);

    this.playerBullets = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.playerBullets, this.enemies, this.handleBulletHit, null, this);

    if (this.enemyProjectiles) {
      this.physics.add.overlap(this.player, this.enemyProjectiles, this.handleEnemyProjectileHit, null, this);
    }

    this.createEnergyOrbs();
    this.physics.add.overlap(this.player, this.energyOrbs, this.collectOrb, null, this);

    this.createNpcAndPortal();
    this.quizUI = new QuizUI(this);
    this.createQuizItems();
    this.showControlsReminder();

    this.mapDialogue = new DialogueBox(this);

    this.onItemCollected = ({ inventory }) => { this.player.syncSkills(inventory); };

    this.onCrystalSkill = ({ type, x, y, dir, range, height, damage }) => {
      if (type === 'zhuque') {
        this.zhuqueBlast(x, y, range);
        this.showLevelBanner('🔥 朱雀烈焰！');
        this.enemies.getChildren().forEach((e) => {
          if (!e.active) return;
          if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < range) this.damageEnemy(e, damage);
        });
      } else if (type === 'huanglong') {
        this.huanglongStrike(x, y, dir, range, height, damage);
        this.showLevelBanner('🐉 黄龙震地！');
      } else if (type === 'yijinjing') {
        this.yijinjingBlast(x, y, dir, range, damage);
        this.showLevelBanner('💪 易筋经爆发！');
      } else if (type === 'baihu') {
        this.baihuStrike(x, y, dir, range, height, damage);
        this.showLevelBanner('🐯 白虎裂空！');
      }
    };

    bus.on(EVENTS.ITEM_COLLECTED, this.onItemCollected);
    bus.on(EVENTS.CRYSTAL_SKILL, this.onCrystalSkill);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EVENTS.ITEM_COLLECTED, this.onItemCollected);
      bus.off(EVENTS.CRYSTAL_SKILL, this.onCrystalSkill);
      this.quizUI?.destroy();
      this.destroyQueueUI();
    });

    if (skillSystem.getInventory()[ITEMS.XUANWU_BLADE]) {
      this.npc.setCompleted(true);
    }

    this.bossDefeated = !!skillSystem.getInventory()[ITEMS.HENGSHAN_COMPLETE];
    if (this.bossDefeated) {
      this.activatePortal(false);
    } else {
      this.createBoss();
    }
  }

  // ──────────────────────────────────────────────────────────
  //  背景（北岳苍茫群山，深蓝暮色）
  // ──────────────────────────────────────────────────────────

  createBackground() {
    // 天空渐变
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.22, GAME_WIDTH, GAME_HEIGHT * 0.44, 0x0d1428, 1).setScrollFactor(0);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.70, GAME_WIDTH, GAME_HEIGHT * 0.60, 0x141e30, 1).setScrollFactor(0);

    // 远景山脉（暗蓝绿调）
    const far = this.add.graphics().setScrollFactor(0.08);
    far.fillStyle(0x1a2a3a, 1);
    far.beginPath();
    far.moveTo(-100, 540); far.lineTo(80, 280); far.lineTo(220, 390); far.lineTo(420, 210);
    far.lineTo(600, 360); far.lineTo(820, 230); far.lineTo(1060, 410); far.lineTo(1300, 190);
    far.lineTo(1580, 380); far.lineTo(1860, 210); far.lineTo(2120, 400); far.lineTo(2420, 200);
    far.lineTo(2760, 380); far.lineTo(3080, 160); far.lineTo(3420, 350); far.lineTo(3780, 180);
    far.lineTo(4120, 370); far.lineTo(4500, 170); far.lineTo(4860, 340); far.lineTo(5200, 150);
    far.lineTo(5600, 320); far.lineTo(5900, 540); far.closePath(); far.fillPath();

    // 中景山脉（带玄武深青）
    const mid = this.add.graphics().setScrollFactor(0.25);
    mid.fillStyle(0x1e3040, 1);
    mid.beginPath();
    mid.moveTo(-60, 540); mid.lineTo(100, 340); mid.lineTo(240, 450); mid.lineTo(420, 300);
    mid.lineTo(580, 450); mid.lineTo(800, 310); mid.lineTo(1020, 460); mid.lineTo(1280, 320);
    mid.lineTo(1540, 460); mid.lineTo(1800, 300); mid.lineTo(2080, 460); mid.lineTo(2360, 320);
    mid.lineTo(2640, 460); mid.lineTo(2920, 300); mid.lineTo(3200, 470); mid.lineTo(3500, 290);
    mid.lineTo(3800, 460); mid.lineTo(4100, 280); mid.lineTo(4450, 450); mid.lineTo(4800, 230);
    mid.lineTo(5100, 400); mid.lineTo(5500, 250); mid.lineTo(5900, 430); mid.closePath(); mid.fillPath();

    // 北岳玄武星光
    const starGlow = this.add.rectangle(480, 110, 900, 180, 0x1a7a5a, 0.07).setScrollFactor(0.12);
    this.tweens.add({ targets: starGlow, alpha: { from: 0.04, to: 0.14 }, duration: 3000, yoyo: true, repeat: -1 });

    // 近景杉林
    const near = this.add.graphics().setScrollFactor(0.55);
    near.fillStyle(0x0d1620, 1);
    for (let x = -40; x < 5600; x += 56) {
      near.fillTriangle(x, 540, x + 20, 440 - (x % 3) * 14, x + 40, 540);
      near.fillTriangle(x + 14, 540, x + 36, 424 - (x % 5) * 12, x + 58, 540);
    }

    // 飘渺云雾（北岳神秘感）
    for (let i = 0; i < 12; i++) {
      const cloud = this.add.container(Phaser.Math.Between(-100, 5400), Phaser.Math.Between(60, 200), [
        this.add.ellipse(-20, 4, 48, 26, 0x2a4060, 0.20),
        this.add.ellipse(0, 0, 58, 32, 0x2a4060, 0.20),
        this.add.ellipse(24, 6, 44, 22, 0x2a4060, 0.20),
      ]);
      cloud.setScrollFactor(0.14);
      this.tweens.add({ targets: cloud, x: cloud.x + Phaser.Math.Between(120, 250), duration: Phaser.Math.Between(12000, 22000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  平台（恒山石阶，四段：山门→石阶云路→悬空寺→天峰岭顶）
  // ──────────────────────────────────────────────────────────

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();

    const addPlatform = (x, y, width) => {
      const tileCount = Math.ceil(width / 32);
      for (let i = 0; i < tileCount; i++) {
        this.platforms.create(x + i * 32 + 16, y, 'tile_hengshan');
      }
    };

    // ── 山门入口 (x 0~1000) ──
    addPlatform(0, 440, 1000);
    addPlatform(240, 360, 120);
    addPlatform(500, 300, 120);
    addPlatform(760, 240, 120);

    // ── 石阶云路 (x 1000~2400，持续攀升) ──
    addPlatform(1000, 440, 200);
    addPlatform(1280, 380, 100);
    addPlatform(1440, 330, 100);
    addPlatform(1600, 280, 100);
    addPlatform(1760, 230, 100);
    addPlatform(1920, 190, 100);
    addPlatform(2080, 160, 320);

    // ── 悬空寺区域 (x 2400~3600，高低错落，气势磅礴) ──
    addPlatform(2400, 400, 160);
    addPlatform(2620, 340, 100);
    addPlatform(2800, 280, 120);
    addPlatform(2960, 220, 120);
    addPlatform(3120, 280, 100);
    addPlatform(3280, 340, 100);
    addPlatform(3440, 400, 160);

    // ── 天峰岭登顶石阶 (x 3600~4600) ──
    addPlatform(3600, 400, 200);
    addPlatform(3870, 340, 100);
    addPlatform(4060, 280, 100);
    addPlatform(4230, 220, 100);
    addPlatform(4400, 180, 100);
    addPlatform(4560, 160, 100);

    // ── 北岳极顶主台地 (x 4700~5500) ──
    addPlatform(4700, 160, 800);
  }

  // ──────────────────────────────────────────────────────────
  //  装饰（恒山指引牌 + 悬空寺结构 + 石碑区）
  // ──────────────────────────────────────────────────────────

  createDecorations() {
    const peakSign = (x, y, text, color = '#7ef7c6') => {
      const sign = this.add.text(x, y, text, {
        fontSize: '20px', color, stroke: '#000000', strokeThickness: 4,
        backgroundColor: '#00000099', padding: { x: 10, y: 5 },
      }).setOrigin(0.5);
      this.tweens.add({ targets: sign, alpha: { from: 0.6, to: 1.0 }, duration: 1400, yoyo: true, repeat: -1 });
      return sign;
    };

    peakSign(100, 408, '🏔️ 北岳恒山 · 山门');
    peakSign(1050, 408, '🌫️ 石阶云路');
    peakSign(2430, 368, '🏯 悬空寺');
    peakSign(3630, 368, '⛰️ 天峰岭');
    peakSign(4730, 128, '🌟 北岳极顶 · 最高处');

    // 悬空寺模拟建筑（核心视觉）
    const xuankong = this.add.graphics();
    // 横梁
    xuankong.fillStyle(0x5a3010, 1);
    xuankong.fillRect(2780, 252, 140, 8);   // 主横梁
    xuankong.fillRect(2800, 206, 100, 8);   // 上横梁
    // 支撑柱（从山壁斜插入）
    xuankong.fillStyle(0x7a5020, 1);
    xuankong.fillRect(2790, 210, 6, 50);
    xuankong.fillRect(2860, 210, 6, 50);
    xuankong.fillRect(2900, 210, 6, 50);
    // 建筑主体
    xuankong.fillStyle(0x4a3010, 1);
    xuankong.fillRect(2785, 216, 120, 36);
    // 屋顶
    xuankong.fillStyle(0x8b3030, 1);
    xuankong.fillTriangle(2780, 216, 2910, 216, 2845, 188);
    // 窗格
    xuankong.fillStyle(0xffd080, 0.45);
    xuankong.fillRect(2795, 224, 20, 14);
    xuankong.fillRect(2830, 224, 20, 14);
    xuankong.fillRect(2865, 224, 20, 14);

    // 石刻（山壁题字）
    this.add.text(2780, 188, '北岳恒山·悬空寺', {
      fontSize: '11px', color: '#d0c0a0', align: 'center', lineSpacing: 1,
    }).setOrigin(0.5);

    // 山壁玄武岩纹（深蓝黑石纹）
    const wall = this.add.graphics().setDepth(-1);
    wall.fillStyle(0x0d1628, 1);
    wall.fillRect(2750, 160, 200, 100);
    wall.fillStyle(0x1a2a3a, 0.7);
    wall.fillRect(2760, 170, 180, 40);

    // 恒山石灯（深蓝调）
    const lanternX = [360, 900, 1650, 2700, 3900, 4800];
    lanternX.forEach((lx) => {
      const rope = this.add.rectangle(lx, 300, 2, 24, 0x1a2a3a, 1);
      const lantern = this.add.circle(lx, 320, 8, 0x7ef7c6, 0.82);
      const glow = this.add.circle(lx, 320, 18, 0x26c6da, 0.12);
      this.tweens.add({ targets: [lantern, glow, rope], y: '+=4', duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  北岳极顶区域（BOSS 区 + 最高海拔石碑 + 排队区）
  // ──────────────────────────────────────────────────────────

  createSummitZone() {
    // 北岳庙（主殿建筑轮廓）
    const temple = this.add.graphics();
    temple.fillStyle(0x252c38, 1);
    temple.fillRect(5200, 108, 12, 52); temple.fillRect(5280, 108, 12, 52);  // 柱
    temple.fillStyle(0x8b3030, 1);
    temple.fillTriangle(5188, 108, 5304, 108, 5246, 72);                      // 屋顶
    temple.fillStyle(0x3a4050, 1);
    temple.fillRect(5192, 100, 110, 12);                                       // 匾额
    this.add.text(5247, 106, '北岳庙', {
      fontSize: '10px', color: '#ffd700', align: 'center',
    }).setOrigin(0.5);

    // 最高海拔石碑（排队打卡地标）
    this.add.image(4980, 116, 'stele_hengshan').setDepth(10);
    this.add.text(4980, 72, '最高处·2017米', {
      fontSize: '14px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(11);

    // 玄武气息粒子（绿蓝光点）
    for (let i = 0; i < 20; i++) {
      const sp = this.add.circle(Phaser.Math.Between(4700, 5450), Phaser.Math.Between(50, 155), Phaser.Math.Between(1, 2), 0x1a7a5a, Phaser.Math.FloatBetween(0.2, 0.55));
      this.tweens.add({ targets: sp, alpha: { from: 0.1, to: 0.7 }, y: sp.y - Phaser.Math.Between(4, 10), duration: Phaser.Math.Between(900, 2100), yoyo: true, repeat: -1 });
    }

    // 供台（战后生成玄武刀）
    const altar = this.add.graphics();
    altar.fillStyle(0x2a3a4a, 1);
    altar.fillRect(5100, 148, 36, 28);
    altar.fillStyle(0x1a7a5a, 1);
    altar.fillRect(5096, 144, 44, 8);
    altar.fillStyle(0x26c6da, 0.22);
    altar.fillRect(5098, 146, 40, 4);
  }

  // ──────────────────────────────────────────────────────────
  //  粒子特效
  // ──────────────────────────────────────────────────────────

  createParticles() {
    for (let i = 0; i < 28; i++) {
      const sp = this.add.circle(Phaser.Math.Between(0, 3600), Phaser.Math.Between(60, 420), Phaser.Math.Between(1, 2), 0x26c6da, Phaser.Math.FloatBetween(0.15, 0.50));
      sp.setScrollFactor(0.3);
      this.tweens.add({ targets: sp, alpha: { from: 0.1, to: 0.6 }, y: sp.y - Phaser.Math.Between(5, 10), duration: Phaser.Math.Between(1000, 2200), yoyo: true, repeat: -1 });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  普通敌人（恒山武者，最多3个同屏）
  // ──────────────────────────────────────────────────────────

  createEnemies() {
    this.enemies = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group({ allowGravity: false });
    this.maxActiveEnemies = 3;
    this.lastSpawnTime = 0;

    this.enemySpawnPool = [
      // ── 山门 (x 200~800) ──
      { x: 280,  y: 400, minX: 240,  maxX: 350,  type: 'melee',  spawned: false },
      { x: 560,  y: 260, minX: 510,  maxX: 610,  type: 'ranged', spawned: false },
      { x: 800,  y: 200, minX: 760,  maxX: 870,  type: 'heavy',  spawned: false },
      // ── 石阶云路 (x 1100~2300) ──
      { x: 1340, y: 400, minX: 1280, maxX: 1420, type: 'ranged', spawned: false },
      { x: 1640, y: 240, minX: 1600, maxX: 1700, type: 'melee',  spawned: false },
      { x: 1960, y: 150, minX: 1920, maxX: 2020, type: 'heavy',  spawned: false },
      { x: 2130, y: 120, minX: 2080, maxX: 2360, type: 'melee',  spawned: false },
      // ── 悬空寺 (x 2450~3400) ──
      { x: 2470, y: 360, minX: 2420, maxX: 2540, type: 'melee',  spawned: false },
      { x: 2840, y: 240, minX: 2810, maxX: 2880, type: 'ranged', spawned: false },
      { x: 3150, y: 240, minX: 3120, maxX: 3200, type: 'heavy',  spawned: false },
      { x: 3470, y: 360, minX: 3440, maxX: 3560, type: 'melee',  spawned: false },
      // ── 天峰岭 (x 3700~4600) ──
      { x: 3720, y: 360, minX: 3660, maxX: 3790, type: 'heavy',  spawned: false },
      { x: 3940, y: 300, minX: 3880, maxX: 3980, type: 'ranged', spawned: false },
      { x: 4110, y: 240, minX: 4070, maxX: 4170, type: 'melee',  spawned: false },
      { x: 4460, y: 140, minX: 4410, maxX: 4540, type: 'heavy',  spawned: false },
      { x: 4610, y: 120, minX: 4570, maxX: 4680, type: 'ranged', spawned: false },
      // ── 极顶守卫 (x 4750~5100) ──
      { x: 4800, y: 120, minX: 4760, maxX: 4880, type: 'heavy',  spawned: false },
      { x: 5020, y: 120, minX: 4980, maxX: 5100, type: 'melee',  spawned: false },
    ];
  }

  spawnEnemyFromData(data) {
    const flash = this.add.circle(data.x, data.y, 20, 0x26c6da, 0.50).setDepth(49);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2.4, duration: 320, onComplete: () => flash.destroy() });

    const e = this.enemies.create(data.x, data.y, 'hengshan_enemy');
    e.body.setSize(18, 34); e.body.setOffset(7, 10);
    e.setCollideWorldBounds(true);
    e.patrolMinX = data.minX; e.patrolMaxX = data.maxX;
    e.patrolDirection = 1;

    if (data.type === 'heavy') {
      e.hp = 55; e.patrolSpeed = 72; e.contactDamage = 20; e.isHeavy = true;
      e.setTint(0x26c6da); e.setScale(1.15); e.setVelocityX(72);
    } else if (data.type === 'ranged') {
      e.hp = 32; e.patrolSpeed = 42; e.contactDamage = 9; e.isRanged = true;
      e.lastShootTime = 0; e.shootInterval = 2600;
      e.setTint(0x7ef7c6); e.setVelocityX(42);
    } else {
      e.hp = 42; e.patrolSpeed = 60; e.contactDamage = 12; e.setVelocityX(60);
    }
    return e;
  }

  updateEnemySpawns() {
    if (this.bossDefeated || this.levelFinished) return;
    const now = this.time.now;
    if (now - this.lastSpawnTime < 1200) return;

    const activeCount = this.enemies.getChildren().filter(e => e.active && !e.isBoss).length;
    if (activeCount >= this.maxActiveEnemies) return;

    const next = this.enemySpawnPool.find(s =>
      !s.spawned &&
      s.x >= this.player.x - 180 &&
      s.x <= this.player.x + 520
    );

    if (next) {
      next.spawned = true;
      this.lastSpawnTime = now;
      this.spawnEnemyFromData(next);
    }
  }

  // ──────────────────────────────────────────────────────────
  //  灭绝师太 BOSS（三阶段）
  // ──────────────────────────────────────────────────────────

  createBoss() {
    const boss = this.enemies.create(5250, 100, 'hengshan_boss');
    boss.body.setSize(22, 38); boss.body.setOffset(5, 8);
    boss.setCollideWorldBounds(true);
    boss.patrolMinX = 4720; boss.patrolMaxX = 5450;
    boss.patrolDirection = -1;
    boss.maxHp = 700; boss.hp = 700;
    boss.isBoss = true;
    boss.phase = 1; boss.contactDamage = 26;
    boss.patrolSpeed = 80;
    boss.lastChargeTime = 0; boss.lastProjectileTime = 0;
    boss.lastJumpTime = 0; boss.lastRoarTime = 0;
    boss.isCharging = false;
    boss.isJumping = false;
    boss.jumpLanding = false;
    boss.setVelocityX(-80);
    this.boss = boss;

    this.bossLabel = this.add.text(5250, 46, '⚔️ 灭绝师太', {
      fontSize: '18px', color: '#e0e0e0', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200);

    this.createBossHPBar();

    // 竞技场左侧封路墙
    this.bossArenaWall = this.physics.add.staticImage(4700, 200, 'tile_hengshan');
    this.bossArenaWall.setVisible(false);
    this.bossArenaWall.body.setSize(20, 600);
    this.bossArenaWall.body.enable = false;
    this.physics.add.collider(this.player, this.bossArenaWall);
  }

  createBossHPBar() {
    const cx = GAME_WIDTH / 2, barW = 280, barY = 56;
    this.bossHPBG = this.add.rectangle(cx, barY, barW + 6, 22, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(955).setStrokeStyle(2, 0x7ef7c6, 1).setVisible(false).setAlpha(0);
    this.bossHPFill = this.add.rectangle(cx - barW / 2, barY, barW, 14, 0x7a7a90, 1)
      .setScrollFactor(0).setDepth(956).setOrigin(0, 0.5).setVisible(false).setAlpha(0);
    this.bossHPName = this.add.text(cx, barY - 15, '⚔️ 灭绝师太  第一阶段', {
      fontSize: '13px', color: '#e0e0e0', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(957).setVisible(false).setAlpha(0);
    this.bossHPPercent = this.add.text(cx + barW / 2 + 6, barY, '100%', {
      fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(957).setVisible(false).setAlpha(0);
  }

  showBossHPBar() {
    if (this.bossHPBarVisible) return;
    this.bossHPBarVisible = true;
    [this.bossHPBG, this.bossHPFill, this.bossHPName, this.bossHPPercent].forEach((el) => {
      if (!el) return;
      el.setVisible(true);
      this.tweens.add({ targets: el, alpha: 1, duration: 450 });
    });
  }

  updateBossHPBar() {
    if (!this.boss || !this.boss.active || !this.bossHPFill) return;
    const barW = 280;
    const ratio = Math.max(0, this.boss.hp / this.boss.maxHp);
    this.bossHPFill.width = barW * ratio;
    if (this.bossHPPercent) this.bossHPPercent.setText(Math.ceil(ratio * 100) + '%');
    const cols = { 1: 0x7a7a90, 2: 0x9966cc, 3: 0xcc0044 };
    this.bossHPFill.setFillStyle(cols[this.boss.phase] || 0x7a7a90, 1);
  }

  destroyBossHPBar() {
    [this.bossHPBG, this.bossHPFill, this.bossHPName, this.bossHPPercent].forEach((el) => { if (el) el.destroy(); });
    this.bossHPBG = this.bossHPFill = this.bossHPName = this.bossHPPercent = null;
  }

  lockBossArena() {
    if (this.bossArenaWall) { this.bossArenaWall.body.enable = true; this.bossArenaWall.refreshBody(); }
    const flash = this.add.rectangle(4702, 200, 16, 320, 0x26c6da, 0.82).setDepth(300);
    this.tweens.add({ targets: flash, alpha: 0, scaleY: 1.6, duration: 700, onComplete: () => flash.destroy() });
    const msg = this.add.text(5080, 82, '⚔️ 灭绝师太！退路已封！', {
      fontSize: '16px', color: '#e0e0e0', stroke: '#000', strokeThickness: 3, backgroundColor: '#00000099', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(305);
    this.tweens.add({ targets: msg, alpha: 0, y: msg.y - 28, duration: 1400, delay: 200, onComplete: () => msg.destroy() });
  }

  updateBossPhase() {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    const hpRatio = boss.hp / boss.maxHp;
    const newPhase = hpRatio > 0.6 ? 1 : hpRatio > 0.3 ? 2 : 3;
    if (newPhase !== boss.phase) { boss.phase = newPhase; this.onBossPhaseChange(boss, newPhase); }

    const now = this.time.now;

    const jumpInterval = boss.phase === 3 ? 2600 : boss.phase === 2 ? 4000 : 5800;
    if (!boss.isCharging && !boss.isJumping && now - boss.lastJumpTime > jumpInterval) {
      boss.lastJumpTime = now;
      this.bossJumpAttack(boss);
    }

    if (boss.phase >= 2 && !boss.isCharging && !boss.isJumping) {
      const interval = boss.phase === 3 ? 1800 : 3000;
      if (now - boss.lastChargeTime > interval) { boss.lastChargeTime = now; this.bossCharge(boss); }
    }

    // 倚天剑气 AOE（第二/三阶段）
    if (boss.phase >= 2 && !boss.isCharging && !boss.isJumping) {
      const shootInterval = boss.phase === 3 ? 2200 : 3600;
      if (now - boss.lastProjectileTime > shootInterval) {
        boss.lastProjectileTime = now;
        this.bossSwordAura(boss);
      }
    }

    // 第三阶段：剑雨爆发
    if (boss.phase === 3 && !boss.isCharging && !boss.isJumping && now - boss.lastRoarTime > 4000) {
      boss.lastRoarTime = now;
      this.bossSwordRain(boss);
    }
  }

  onBossPhaseChange(boss, phase) {
    if (phase === 2) {
      boss.patrolSpeed = 120; boss.contactDamage = 36; boss.setTint(0x9966cc);
      if (this.bossHPName) this.bossHPName.setText('⚔️ 灭绝师太  ⚡ 第二阶段·剑气暴涨').setStyle({ color: '#cc88ff' });
      if (this.bossHPBG) this.bossHPBG.setStrokeStyle(2, 0x9966cc, 1);
      this.showLevelBanner('⚡ 灭绝师太·剑气大涨！');
      this.burstParticles(boss.x, boss.y, 18, 0x9966cc);
      this.cameras.main.shake(300, 0.009); this.cameras.main.flash(180, 255, 255, 255, true);
    } else if (phase === 3) {
      boss.patrolSpeed = 160; boss.contactDamage = 50; boss.setTint(0xcc0044);
      if (this.bossHPName) this.bossHPName.setText('⚔️ 灭绝师太  💀 狂怒·剑雨').setStyle({ color: '#ff4488' });
      if (this.bossHPBG) this.bossHPBG.setStrokeStyle(2, 0xcc0044, 1);
      this.showLevelBanner('💀 灭绝师太·剑雨漫天！极度危险！');
      this.burstParticles(boss.x, boss.y, 28, 0xcc0044);
      this.cameras.main.shake(500, 0.018); this.cameras.main.flash(280, 255, 255, 255, true);
    }
  }

  bossCharge(boss) {
    if (!boss || !boss.active || !this.player) return;
    boss.isCharging = true;
    const dir = this.player.x > boss.x ? 1 : -1;
    const spd = boss.phase === 3 ? 380 : 260;
    boss.setVelocityX(dir * spd); boss.setFlipX(dir < 0);
    const warn = this.add.text(boss.x, boss.y - 62, '⚔️ 一剑封喉！', {
      fontSize: '17px', color: '#e0e0e0', stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 500, onComplete: () => warn.destroy() });
    this.time.delayedCall(600, () => { if (boss && boss.active) boss.isCharging = false; });
  }

  bossJumpAttack(boss) {
    if (!boss || !boss.active || boss.isJumping || boss.isCharging) return;
    if (!boss.body.blocked.down) return;
    boss.isJumping = true;
    boss.jumpLanding = false;
    const dir = this.player.x > boss.x ? 1 : -1;
    const jumpXSpeed = boss.phase === 3 ? 250 : boss.phase === 2 ? 190 : 140;
    boss.setVelocityY(-480);
    boss.setVelocityX(dir * jumpXSpeed);
    boss.setFlipX(dir < 0);
    const warn = this.add.text(boss.x, boss.y - 72, '⬆ 飞身剑斩！', {
      fontSize: '18px', color: '#c8d8e8', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 500, onComplete: () => warn.destroy() });
    this.time.delayedCall(280, () => { if (boss && boss.active) boss.jumpLanding = true; });
  }

  bossLandingImpact(boss) {
    this.cameras.main.shake(260, 0.012);
    this.burstParticles(boss.x, boss.y + 14, 18, 0x9966cc);
    const ring = this.add.circle(boss.x, boss.y + 14, 8, 0x9966cc, 0)
      .setStrokeStyle(3, 0xe0e0e0, 0.9).setDepth(52);
    this.tweens.add({ targets: ring, scaleX: 8, scaleY: 4, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
    if (dist < 100) {
      if (this.player.isGuarding()) {
        this.player.flashGuardSuccess();
      } else {
        this.player.hurt(boss.phase >= 3 ? 28 : 22, boss.x);
        this.showLevelBanner('💥 飞身剑斩重击！');
      }
    }
    boss.setVelocityX(0);
  }

  // 倚天剑气（第二/三阶段，横扫投射物）
  bossSwordAura(boss) {
    if (!boss || !boss.active || !this.player) return;
    const dir = this.player.x > boss.x ? 1 : -1;
    const count = boss.phase === 3 ? 3 : 1;

    for (let i = 0; i < count; i++) {
      const yOffset = (i - Math.floor(count / 2)) * 20;
      this.time.delayedCall(i * 120, () => {
        if (!boss || !boss.active) return;
        const proj = this.physics.add.image(boss.x + dir * 18, boss.y - 10 + yOffset, 'bagua_orb');
        proj.setTint(0xc8d8e8);
        proj.setScale(1.1);
        proj.damage = boss.phase === 3 ? 16 : 13;
        proj.body.setAllowGravity(false);
        proj.body.setVelocity(dir * 240, 0);
        if (this.enemyProjectiles) this.enemyProjectiles.add(proj);
        this.tweens.add({ targets: proj, angle: dir > 0 ? 360 : -360, duration: 500, repeat: -1 });
        this.time.delayedCall(2000, () => { if (proj && proj.active) proj.destroy(); });
      });
    }

    const warn = this.add.text(boss.x, boss.y - 30, '✦', {
      fontSize: '16px', color: '#c8d8e8',
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 18, duration: 400, onComplete: () => warn.destroy() });
  }

  // 剑雨（第三阶段AOE）
  bossSwordRain(boss) {
    if (!boss || !boss.active || !this.player) return;
    const rainW = 220;

    const warn = this.add.text(boss.x, boss.y - 68, '💀 剑雨漫天！', {
      fontSize: '18px', color: '#ff4488', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 26, duration: 580, onComplete: () => warn.destroy() });

    // 红色剑气漫天特效
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 60, () => {
        if (!boss || !boss.active) return;
        const rx = boss.x + Phaser.Math.Between(-rainW / 2, rainW / 2);
        const ry = boss.y - Phaser.Math.Between(30, 80);
        const shard = this.add.rectangle(rx, ry, 4, 22, 0xcc0044, 0.88).setDepth(53).setRotation(Phaser.Math.FloatBetween(-0.4, 0.4));
        this.tweens.add({ targets: shard, y: ry + 120, alpha: 0, duration: 400, ease: 'Quad.easeIn', onComplete: () => shard.destroy() });
      });
    }

    this.cameras.main.shake(260, 0.01);

    this.time.delayedCall(160, () => {
      if (!boss.active) return;
      const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
      if (dist < rainW) {
        if (this.player.isGuarding()) {
          this.player.flashGuardSuccess();
        } else {
          this.player.hurt(22, boss.x);
          this.showLevelBanner('💀 剑雨命中！');
        }
      }
    });
  }

  enemyShootProjectile(enemy) {
    if (!enemy || !enemy.active || !this.player) return;
    const dir = this.player.x > enemy.x ? 1 : -1;
    const proj = this.physics.add.image(enemy.x + dir * 18, enemy.y - 10, 'bagua_orb');
    proj.setTint(0x26c6da);
    proj.setScale(0.85);
    proj.damage = 11;
    proj.body.setAllowGravity(false);
    proj.body.setVelocity(dir * 200, 0);
    if (this.enemyProjectiles) this.enemyProjectiles.add(proj);
    this.tweens.add({ targets: proj, angle: dir > 0 ? 360 : -360, duration: 500, repeat: -1 });

    const warn = this.add.text(enemy.x, enemy.y - 30, '✦', {
      fontSize: '13px', color: '#26c6da',
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 14, duration: 380, onComplete: () => warn.destroy() });

    this.time.delayedCall(2200, () => { if (proj && proj.active) proj.destroy(); });
  }

  handleEnemyProjectileHit(player, proj) {
    if (!proj.active) return;
    this.burstParticles(proj.x, proj.y, 8, 0x26c6da);
    proj.destroy();
    if (player.isGuarding()) {
      player.flashGuardSuccess();
    } else {
      player.hurt(proj.damage || 11, proj.x);
    }
  }

  respawnBoss() {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    boss.setPosition(5250, 100); boss.setVelocity(0, 0);
    boss.isCharging = false;
    boss.isJumping = false;
    boss.jumpLanding = false;
    boss.patrolDirection = -1;
    boss.setVelocityX(-boss.patrolSpeed);
    if (boss.phase === 3) boss.setTint(0xcc0044);
    else if (boss.phase === 2) boss.setTint(0x9966cc);
    else boss.clearTint();
  }

  // ──────────────────────────────────────────────────────────
  //  BOSS 击败 → 金币掉落 → 排队机制触发
  // ──────────────────────────────────────────────────────────

  onBossDefeated(boss) {
    this.burstParticles(boss.x, boss.y, 35, 0xffffff);
    this.burstParticles(boss.x, boss.y, 20, 0x9966cc);
    this.burstParticles(boss.x, boss.y, 10, 0xcc0044);
    this.cameras.main.shake(450, 0.014);
    boss.destroy();
    this.bossDefeated = true;
    this.boss = null;
    if (this.bossLabel) { this.bossLabel.destroy(); this.bossLabel = null; }
    this.destroyBossHPBar();
    if (this.bossArenaWall) this.bossArenaWall.body.enable = false;

    // BOSS掉落一枚价值250的大金币
    this.dropBossCoin(boss.x || 5250, (boss.y || 120) - 20, 250);
    skillSystem.collect(ITEMS.HENGSHAN_COMPLETE);

    this.showLevelBanner('⚔️ 灭绝师太已败！获得大金币 ×250！');
    this.time.delayedCall(1400, () => this.startQueueEvent());
  }

  // ──────────────────────────────────────────────────────────
  //  金币系统
  // ──────────────────────────────────────────────────────────

  // 掉落 amount 枚普通金币（每枚价值1，用于小兵）
  dropCoins(x, y, amount) {
    for (let i = 0; i < amount; i++) {
      const coin = this.coinDrops.create(
        x + Phaser.Math.Between(-20, 20), y, 'coin'
      );
      coin.setScale(0.9);
      coin.setBounce(0.5);
      coin.body.setAllowGravity(true);
      coin.setVelocityX(Phaser.Math.Between(-80, 80));
      coin.setVelocityY(Phaser.Math.Between(-160, -60));
      coin._value = 1;
      // 6秒后自动销毁未拾取的金币
      this.time.delayedCall(6000, () => { if (coin && coin.active) coin.destroy(); });
    }
  }

  // 掉落一枚 BOSS 大金币（显示更大，标注面值）
  dropBossCoin(x, y, value) {
    const coin = this.coinDrops.create(x, y, 'coin');
    coin.setScale(2.0);          // 大金币是普通尺寸的2倍
    coin.setBounce(0.55);
    coin.body.setAllowGravity(true);
    coin.setVelocityX(Phaser.Math.Between(-40, 40));
    coin.setVelocityY(-200);
    coin._value = value;

    // 金币上方显示面值标签
    const label = this.add.text(x, y - 28, `💰×${value}`, {
      fontSize: '16px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000099', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(60);
    // 标签跟随金币（在update中太重，用tween模拟漂浮）
    this.tweens.add({
      targets: label,
      y: label.y - 12,
      alpha: { from: 1, to: 0.7 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    // 光晕
    const glow = this.add.circle(x, y, 22, 0xffd700, 0.25).setDepth(59);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.1, to: 0.5 },
      scale: { from: 0.9, to: 1.4 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // 覆盖 collectCoin 拾取后同步销毁标签和光晕
    coin._onCollect = () => {
      label.destroy();
      glow.destroy();
    };

    // 30秒后自动销毁未拾取的大金币
    this.time.delayedCall(30000, () => {
      if (coin && coin.active) { coin.destroy(); label.destroy(); glow.destroy(); }
    });
  }

  collectCoin(_player, coin) {
    if (!coin.active) return;
    const value = coin._value || 1;
    if (coin._onCollect) coin._onCollect();
    coin.destroy();
    sfx.play('collect');
    skillSystem.addCoins(value);
    // 飘字
    const txt = this.add.text(this.player.x, this.player.y - 36, `+${value}🪙`, {
      fontSize: '14px', color: '#ffd700', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 22, duration: 700, onComplete: () => txt.destroy() });
  }

  // ──────────────────────────────────────────────────────────
  //  排队机制（打卡拍照最高海拔石碑）
  // ──────────────────────────────────────────────────────────

  startQueueEvent() {
    this.queueActive = true;
    this.queuePersonsLeft = QUEUE_TOTAL_PERSONS;
    this.queueCurrentTimer = QUEUE_WAIT_SECONDS * 1000;
    this.queueFinished = false;
    this.queueStarted = false;

    // 生成排队人群（依次站在石碑前）
    const baseX = 4870;
    const baseY = 124;
    this.queueNpcs = [];
    for (let i = 0; i < QUEUE_TOTAL_PERSONS; i++) {
      const qpX = baseX - i * 26;
      const qp = this.add.image(qpX, baseY, 'queue_person').setDepth(12).setScale(1.0);
      this.queueNpcs.push(qp);
    }

    // 排队提示横幅
    this.queueBanner = this.add.text(4980, 50, `📸 石碑打卡排队 · 前方 ${QUEUE_TOTAL_PERSONS} 人`, {
      fontSize: '16px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(200);

    this.showLevelBanner('📸 打卡需排队！每人20秒，1000金币可插队！');
  }

  // 玩家进入排队区域时触发（在update中检测）
  activateQueueForPlayer() {
    if (this.queueStarted || !this.queueActive || this.queueFinished) return;
    this.queueStarted = true;

    // 创建排队倒计时UI（HUD区域）
    this.queuePanel = this.add.rectangle(GAME_WIDTH / 2, 470, 450, 60, 0x0a1020, 0.92)
      .setScrollFactor(0).setDepth(970).setStrokeStyle(2, 0x26c6da, 1);

    this.queueTimerText = this.add.text(GAME_WIDTH / 2, 460, '', {
      fontSize: '18px', color: '#7ef7c6', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(971);

    this.queueSkipBtn = this.add.text(GAME_WIDTH / 2, 484, `💰 花 ${QUEUE_SKIP_COST} 金币插队（按 F 键）`, {
      fontSize: '14px', color: '#ffd700', stroke: '#000000', strokeThickness: 2,
      backgroundColor: '#1a1000aa', padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(971).setInteractive({ useHandCursor: true });

    this.queueSkipBtn.on('pointerdown', () => this.trySkipQueue());

    this.updateQueueUI();
  }

  updateQueueUI() {
    if (!this.queueTimerText) return;
    const secs = Math.ceil(this.queueCurrentTimer / 1000);
    this.queueTimerText.setText(
      `⏳ 排队中：前方 ${this.queuePersonsLeft} 人 · 当前等待 ${secs}s`
    );
    // 更新插队按钮颜色（金币够就显示绿，不够显示红）
    if (this.queueSkipBtn) {
      const canAfford = skillSystem.getCoins() >= QUEUE_SKIP_COST;
      this.queueSkipBtn.setStyle({ color: canAfford ? '#ffd700' : '#ff6666' });
    }
  }

  // 插队（花1000金币）
  trySkipQueue() {
    if (!this.queueActive || !this.queueStarted || this.queueFinished) return;
    if (skillSystem.spendCoins(QUEUE_SKIP_COST)) {
      this.showLevelBanner(`💰 花费 ${QUEUE_SKIP_COST} 金币插队成功！`);
      // 立即清空队伍，完成排队
      this.queuePersonsLeft = 0;
      this.queueCurrentTimer = 0;
      this.completeQueue();
    } else {
      this.showLevelBanner(`❌ 金币不足！需要 ${QUEUE_SKIP_COST} 金币，当前 ${skillSystem.getCoins()} 枚`);
      // 按钮抖动
      if (this.queueSkipBtn) {
        this.tweens.add({ targets: this.queueSkipBtn, x: { from: GAME_WIDTH / 2 - 4, to: GAME_WIDTH / 2 + 4 }, duration: 60, repeat: 3, yoyo: true });
      }
    }
  }

  // 排队完成，领取奖励
  completeQueue() {
    if (this.queueFinished) return;
    this.queueFinished = true;
    this.queueActive = false;

    // 移除所有排队人物
    this.queueNpcs.forEach(qp => {
      if (qp && qp.active) {
        this.tweens.add({ targets: qp, alpha: 0, x: qp.x + 60, duration: 600, onComplete: () => qp.destroy() });
      }
    });
    this.queueNpcs = [];
    if (this.queueBanner) { this.tweens.add({ targets: this.queueBanner, alpha: 0, duration: 500, onComplete: () => this.queueBanner?.destroy() }); }

    this.destroyQueueUI();
    this.showLevelBanner('📸 打卡成功！获得恒山气运晶石 + 玄武战刀！');

    // 生成奖励拾取物
    this.time.delayedCall(800, () => this.spawnQueueReward());
  }

  // 奖励生成（恒山气运晶石 + 玄武战刀）
  spawnQueueReward() {
    this.awaitingCrystalPickup = true;

    // 玄武战刀（5118, 108）
    const bladeX = 5118, bladeY = 108;
    const blade = this.physics.add.staticImage(bladeX, bladeY, 'xuanwu_blade').setDepth(10);
    this.tweens.add({ targets: blade, y: bladeY - 12, angle: 360, duration: 1800, repeat: -1, ease: 'Sine.easeInOut' });

    const bladeGlow = this.add.circle(bladeX, bladeY, 22, 0x26c6da, 0.20).setDepth(9);
    this.tweens.add({ targets: bladeGlow, alpha: { from: 0.08, to: 0.50 }, scale: { from: 0.9, to: 1.4 }, duration: 700, yoyo: true, repeat: -1 });

    const bladeHint = this.add.text(bladeX, bladeY - 42, '🗡️ 玄武战刀', {
      fontSize: '18px', color: '#7ef7c6', stroke: '#000000', strokeThickness: 3, backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: bladeHint, y: '+=5', duration: 900, yoyo: true, repeat: -1 });

    // 恒山气运晶石（5080, 108）
    const crystalX = 5060, crystalY = 108;
    const crystal = this.physics.add.staticImage(crystalX, crystalY, 'crystal_yellow').setDepth(10).setTint(0x7ef7c6);
    this.tweens.add({ targets: crystal, y: crystalY - 10, angle: -360, duration: 1600, repeat: -1, ease: 'Sine.easeInOut' });

    const crystalGlow = this.add.circle(crystalX, crystalY, 20, 0x1a7a5a, 0.18).setDepth(9);
    this.tweens.add({ targets: crystalGlow, alpha: { from: 0.06, to: 0.45 }, scale: { from: 0.9, to: 1.3 }, duration: 800, yoyo: true, repeat: -1 });

    const crystalHint = this.add.text(crystalX, crystalY - 38, '💎 恒山气运晶石', {
      fontSize: '16px', color: '#7ef7c6', stroke: '#000000', strokeThickness: 3, backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: crystalHint, y: '+=5', duration: 1000, yoyo: true, repeat: -1 });

    // 收集逻辑（先拿刀，再拿晶石，顺序不强制）
    let bladeCollected = false;
    let crystalCollected = false;

    const checkAllCollected = () => {
      if (bladeCollected && crystalCollected) {
        this.awaitingCrystalPickup = false;
        this.time.delayedCall(600, () => this.showVictoryDialogue());
      }
    };

    this.physics.add.overlap(this.player, blade, () => {
      if (!blade.active || bladeCollected) return;
      bladeCollected = true;
      blade.destroy(); bladeGlow.destroy(); bladeHint.destroy();
      if (skillSystem.collect(ITEMS.XUANWU_BLADE)) {
        this.showLevelBanner('🗡️ 玄武战刀已获得！Q切换武器！');
      }
      checkAllCollected();
    });

    this.physics.add.overlap(this.player, crystal, () => {
      if (!crystal.active || crystalCollected) return;
      crystalCollected = true;
      crystal.destroy(); crystalGlow.destroy(); crystalHint.destroy();
      this.showLevelBanner('💎 恒山气运晶石已获得！五岳气运聚齐！');
      this.burstParticles(this.player.x, this.player.y - 24, 16, 0x1a7a5a);
      checkAllCollected();
    });
  }

  destroyQueueUI() {
    if (this.queueTimerText) { this.queueTimerText.destroy(); this.queueTimerText = null; }
    if (this.queueSkipBtn) { this.queueSkipBtn.destroy(); this.queueSkipBtn = null; }
    if (this.queuePanel) { this.queuePanel.destroy(); this.queuePanel = null; }
  }

  showVictoryDialogue() {
    const lines = [
      '旁白：「灭绝师太败于北岳之巅，恒山气运碎片终于到手！」',
      '旁白：「五岳之气运——朱雀、黄龙、白虎、玄武，已聚四方！」',
      '道长：「恭喜小北，五岳气运归一，蛟龙之秘即将揭晓！」',
      '道长：「持此玄武战刀与五方气运，穿越传送门，找寻蛟龙真身！」',
      '✅ 恒山通关！前往传送门，踏上最终旅程！',
    ];
    this.player.isTalking = true;
    this.mapDialogue.start(lines, () => {
      this.player.isTalking = false;
      this.activatePortal(true);
    });
  }

  // ──────────────────────────────────────────────────────────
  //  能量球
  // ──────────────────────────────────────────────────────────

  createEnergyOrbs() {
    this.energyOrbs = this.physics.add.group({ allowGravity: false, immovable: true });
    const positions = [
      [560, 250], [800, 190], [1600, 240], [1920, 150],
      [2640, 290], [3000, 240], [3800, 300], [4250, 190], [4580, 120],
    ];
    positions.forEach(([x, y]) => {
      const orb = this.energyOrbs.create(x, y, 'crystal_yellow');
      orb.setScale(0.5); orb.setTint(0xa8f0e0);
      orb.body.setAllowGravity(false); orb.body.moves = false;
      this.tweens.add({ targets: orb, y: y - 8, angle: 360, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  NPC 与传送门
  // ──────────────────────────────────────────────────────────

  createNpcAndPortal() {
    const dialogues = [
      '道长：「小北，北岳恒山，以玄武之力著称，天地阴阳之极汇聚于此。」',
      '道长：「你已集太极、少林、白虎三道，如今踏上北岳，可得玄武之道的最后一层。」',
      '道长：「玄武护体（X键）已是你的盾，然真正的玄武之力，在于攻守合一——玄武战刀。」',
      '道长：「极顶有灭绝师太镇守气运碎片，其倚天剑法剑气化虹，切记护体反击！」',
      '道长：「胜后，莫忘北岳最有趣的传统——到最高处的石碑前拍照留念，需要排队哟！」',
      '✅ 玄武道义已领悟！前进，直上天峰岭！',
    ];

    this.npc = new NPC(this, 700, 390, 'npc_hengshan', dialogues, () => {
      this.respawnPoint = { x: 680, y: 380 };
      this.showCheckpointBeacon(680, 380);
    }, '道长');

    this.portalGlow = this.add.ellipse(5430, 106, 40, 76, COLORS.TEAL, 0.18).setVisible(false);
    this.portal = this.physics.add.staticImage(5430, 106, 'portal_frame');
    this.portal.setAlpha(0.35);

    this.physics.add.overlap(this.player, this.portal, () => {
      if (this.portalActive) this.finishLevel();
    });
  }

  // ──────────────────────────────────────────────────────────
  //  答题卷
  // ──────────────────────────────────────────────────────────

  createQuizItems() {
    this.quizItems = this.physics.add.staticGroup();
    const positions = [[380, 408], [900, 200], [1800, 240], [3000, 240], [4300, 190]];

    positions.forEach(([x, y], i) => {
      const scroll = this.quizItems.create(x, y, 'quiz_scroll');
      scroll.quizIndex = i % HENGSHAN_QUIZZES.length;
      scroll.setTint(0x7ef7c6);
      this.tweens.add({ targets: scroll, y: y - 10, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      const glow = this.add.circle(x, y, 18, 0x26c6da, 0.15);
      this.tweens.add({ targets: glow, alpha: { from: 0.05, to: 0.30 }, scaleX: { from: 0.8, to: 1.2 }, scaleY: { from: 0.8, to: 1.2 }, duration: 900, yoyo: true, repeat: -1 });

      const hint = this.add.text(x, y - 30, '📜 答题', { fontSize: '13px', color: '#7ef7c6', backgroundColor: '#00000066', padding: { x: 4, y: 2 } }).setOrigin(0.5).setVisible(false);
      scroll._hint = hint; scroll._glow = glow;
      scroll.once('destroy', () => { hint.destroy(); glow.destroy(); });
    });

    this.physics.add.overlap(this.player, this.quizItems, (player, scroll) => {
      if (this.quizUI.isOpen || scroll._used) return;
      scroll._hint.setVisible(false); scroll._used = true; scroll.destroy();
      player.isTalking = true;
      const qData = HENGSHAN_QUIZZES[scroll.quizIndex];
      this.quizUI.open(qData.q, qData.choices, qData.correct, (correct) => {
        player.isTalking = false;
        if (correct) { this.player.addWisdomBuff(20); this.showLevelBanner('📖 智慧+20 → 攻击提升！'); this.burstParticles(this.player.x, this.player.y - 24, 12, 0x26c6da); }
        else { this.showLevelBanner('💭 学习是旅途的一部分！'); }
      });
    }, null, this);
  }

  showControlsReminder() {
    const reminder = this.add.text(GAME_WIDTH / 2, 76,
      '← → 移动  |  ↑/空格 跳跃  |  J 攻击  |  Q 切换武器  |  Z朱雀 C黄龙 N白虎 X护体  |  F 交谈',
      { fontSize: '15px', color: '#ffffff', backgroundColor: '#00000099', padding: { x: 10, y: 5 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(900);
    this.tweens.add({ targets: reminder, alpha: 0, delay: 3500, duration: 1000, onComplete: () => reminder.destroy() });
  }

  // ──────────────────────────────────────────────────────────
  //  传送门激活
  // ──────────────────────────────────────────────────────────

  activatePortal(showBanner) {
    if (this.portalActive) return;
    this.portalActive = true;
    this.portal.setAlpha(1);
    this.portalGlow.setVisible(true);
    this.tweens.add({ targets: [this.portal, this.portalGlow], scaleY: { from: 0.95, to: 1.05 }, scaleX: { from: 0.95, to: 1.03 }, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    if (showBanner) this.showLevelBanner('✨ 传送门已开启！');
  }

  showLevelBanner(text) {
    const bg = this.add.rectangle(GAME_WIDTH / 2, 112, 400, 38, 0x0d1117, 0.92).setScrollFactor(0).setDepth(950);
    bg.setStrokeStyle(2, COLORS.TEAL, 1);
    const label = this.add.text(GAME_WIDTH / 2, 112, text, { fontSize: '22px', color: '#a8f0e0', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(951);
    this.tweens.add({ targets: [bg, label], alpha: 0, delay: 1800, duration: 500, onComplete: () => { bg.destroy(); label.destroy(); } });
  }

  // ──────────────────────────────────────────────────────────
  //  战斗回调
  // ──────────────────────────────────────────────────────────

  handlePlayerEnemyOverlap(player, enemy) {
    if (!enemy.active || this.levelFinished) return;
    if (player.isGuarding()) {
      if (enemy.isBoss && enemy.isCharging) enemy.isCharging = false;
      enemy.patrolDirection *= -1;
      enemy.setVelocityX(enemy.patrolDirection * 100);
      this.burstParticles(enemy.x, enemy.y, 8, 0x26c6da);
      return;
    }
    const damage = enemy.contactDamage || (enemy.isBoss ? 26 : 12);
    player.hurt(damage, enemy.x);
  }

  handleBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    // BOSS必须在竞技场内才能被伤到
    if (enemy.isBoss && this.player.x < 4700) return;
    this.burstParticles(bullet.x, bullet.y, 8, 0x26c6da);
    bullet.destroy();
    this.damageEnemy(enemy, bullet.damage || 8);
  }

  collectOrb(_player, orb) {
    if (!orb.active) return;
    orb.destroy(); this.player.heal(15); sfx.play('collect');
    this.burstParticles(this.player.x, this.player.y - 18, 6, 0xa8f0e0);
  }

  collectFood(_player, drop) {
    if (!drop.active) return;
    const data = drop.foodData;
    this.tweens.killTweensOf(drop); drop.destroy(); sfx.play('collect');
    this.burstParticles(this.player.x, this.player.y - 20, 6, 0x26c6da);
    const hpGain = data.hp || 20;
    this.player.heal(hpGain);
    this.showLevelBanner(`🍖 ${data.label} → 恢复${hpGain}气血`);
  }

  damageEnemy(enemy, damage = 10) {
    if (!enemy || !enemy.active) return;
    if (enemy.isBoss && this.player.x < 4700) return;
    enemy.hp = typeof enemy.hp === 'number' ? enemy.hp : (enemy.isBoss ? 700 : 42);
    // BOSS 单次最大受伤 25
    if (enemy.isBoss) damage = Math.min(damage, 25);
    enemy.hp -= damage;
    if (enemy.hp > 0) {
      sfx.play('enemy_hit');
      this.burstParticles(enemy.x, enemy.y, 6, enemy.isBoss ? 0x9966cc : 0x7ef7c6);
      if (enemy.isBoss) this.updateBossHPBar();
      return;
    }
    this.defeatEnemy(enemy);
  }

  defeatEnemy(enemy) {
    if (!enemy || !enemy.active) return;
    if (enemy.isBoss) { this.onBossDefeated(enemy); return; }

    // 小兵掉落1-2枚金币
    const coinValue = Phaser.Math.Between(1, 2);
    this.dropCoins(enemy.x, enemy.y - 10, coinValue);

    this.burstParticles(enemy.x, enemy.y, 10, 0x26c6da);
    if (Math.random() < 0.28) {
      const foods = [
        { key: 'food_hengshan_tofu', hp: 22, label: '恒山豆腐' },
        { key: 'food_mutton', hp: 28, label: '手把羊肉' },
        { key: 'food_ganmian', hp: 20, label: '热干面' },
      ];
      const food = foods[Math.floor(Math.random() * foods.length)];
      const drop = this.foodDrops.create(enemy.x, enemy.y - 16, food.key);
      drop.foodData = food; drop.setScale(0.85); drop.setBounce(0.4);
      drop.setVelocityY(-120); drop.setVelocityX(Phaser.Math.Between(-60, 60));
      this.tweens.add({ targets: drop, alpha: { from: 1, to: 0.6 }, duration: 400, yoyo: true, repeat: -1 });
    }
    enemy.destroy();
  }

  // ──────────────────────────────────────────────────────────
  //  技能特效（与其他场景保持一致）
  // ──────────────────────────────────────────────────────────

  zhuqueBlast(x, y, range) {
    const ring = this.add.circle(x, y, 6, 0xff4400, 0).setStrokeStyle(3, 0xff6600, 0.9).setDepth(50);
    this.tweens.add({ targets: ring, scaleX: range / 6, scaleY: range / 6, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const core = this.add.circle(x, y, 12, 0xffee44, 0.9).setDepth(51);
    this.tweens.add({ targets: core, scale: 1.8, alpha: 0, duration: 160, ease: 'Sine.easeOut', onComplete: () => core.destroy() });
    for (let i = 0; i < 14; i++) {
      const bit = this.add.image(x, y, 'particle').setTint(i < 8 ? 0xff4400 : 0xffaa00).setAlpha(0.95).setDepth(50);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(20, range);
      this.tweens.add({ targets: bit, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0, duration: Phaser.Math.Between(280, 500), onComplete: () => bit.destroy() });
    }
  }

  huanglongStrike(x, y, dir, range, height, damage) {
    const cx = x + dir * range * 0.5;
    const wave = this.add.rectangle(cx, y - 6, range, height, 0xffd700, 0.32).setDepth(52).setStrokeStyle(3, 0xffa500, 0.88);
    this.tweens.add({ targets: wave, alpha: 0, scaleX: 1.5, scaleY: 1.6, duration: 400, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
    for (let i = 0; i < 12; i++) {
      const bit = this.add.circle(x + dir * Phaser.Math.Between(10, range), y + Phaser.Math.Between(-height * 0.4, height * 0.4), Phaser.Math.Between(3, 8), 0xffd700, 0.85).setDepth(53);
      this.tweens.add({ targets: bit, alpha: 0, x: bit.x + dir * Phaser.Math.Between(20, 60), duration: Phaser.Math.Between(200, 420), onComplete: () => bit.destroy() });
    }
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;
      const inZone = dir > 0 ? enemy.x >= x && enemy.x <= x + range && Math.abs(enemy.y - y) < height * 0.6
                              : enemy.x <= x && enemy.x >= x - range && Math.abs(enemy.y - y) < height * 0.6;
      if (inZone) this.damageEnemy(enemy, damage);
    });
  }

  yijinjingBlast(x, y, dir, range, damage) {
    const wave = this.add.rectangle(x + dir * range * 0.5, y - 10, range, 44, 0xff9f43, 0.45).setDepth(52).setStrokeStyle(2, 0xffd700, 0.85);
    this.tweens.add({ targets: wave, alpha: 0, scaleX: 1.7, duration: 320, onComplete: () => wave.destroy() });
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;
      const inZone = dir > 0 ? enemy.x >= x && enemy.x <= x + range && Math.abs(enemy.y - y) < 50
                              : enemy.x <= x && enemy.x >= x - range && Math.abs(enemy.y - y) < 50;
      if (inZone) { this.damageEnemy(enemy, damage); enemy.setVelocityX(dir * 220); }
    });
  }

  baihuStrike(x, y, dir, range, height, damage) {
    const cx = x + dir * range * 0.5;
    const claw = this.add.rectangle(cx, y - 6, range, height, 0xdedede, 0.3).setDepth(52).setStrokeStyle(3, 0xffffff, 0.85);
    this.tweens.add({ targets: claw, alpha: 0, scaleX: 1.4, scaleY: 1.5, duration: 340, ease: 'Cubic.easeOut', onComplete: () => claw.destroy() });
    for (let i = 0; i < 3; i++) {
      const offsetY = (i - 1) * 14;
      const slash = this.add.rectangle(cx, y - 6 + offsetY, range * 0.9, 6, 0xffffff, 0.8).setDepth(53).setRotation(dir > 0 ? 0.12 : -0.12);
      this.tweens.add({ targets: slash, alpha: 0, scaleX: 1.3, duration: 260, onComplete: () => slash.destroy() });
    }
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;
      const inZone = dir > 0 ? enemy.x >= x && enemy.x <= x + range && Math.abs(enemy.y - y) < height * 0.6
                              : enemy.x <= x && enemy.x >= x - range && Math.abs(enemy.y - y) < height * 0.6;
      if (inZone) { this.damageEnemy(enemy, damage); enemy.setVelocityX(dir * 200); }
    });
  }

  burstParticles(x, y, count, tint) {
    for (let i = 0; i < count; i++) {
      const bit = this.add.image(x, y, 'particle').setTint(tint).setAlpha(0.9);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(10, 34);
      this.tweens.add({ targets: bit, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0, duration: Phaser.Math.Between(180, 360), onComplete: () => bit.destroy() });
    }
  }

  showCheckpointBeacon(x, y) {
    this.time.delayedCall(400, () => {
      this.showLevelBanner('⛳ 新重生点已设置！死亡后在此处复活');
    });
    const beam = this.add.rectangle(x, y - 60, 10, 120, 0x26c6da, 0.55).setDepth(48);
    this.tweens.add({ targets: beam, alpha: 0, scaleY: 0.2, y: y - 100, duration: 1800, ease: 'Sine.easeIn', onComplete: () => beam.destroy() });
    const ring = this.add.circle(x, y, 8, 0x26c6da, 0).setStrokeStyle(3, 0x7ef7c6, 0.9).setDepth(48);
    this.tweens.add({ targets: ring, scaleX: 6, scaleY: 6, alpha: 0, duration: 1200, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const dot = this.add.circle(x, y - 2, 5, 0x66ffcc, 0.9).setDepth(48);
    const dotLabel = this.add.text(x, y - 18, '⛳', { fontSize: '14px' }).setOrigin(0.5).setDepth(49);
    this.tweens.add({ targets: [dot, dotLabel], alpha: { from: 1, to: 0.3 }, duration: 900, yoyo: true, repeat: -1 });
  }

  // ──────────────────────────────────────────────────────────
  //  复活 / 完关
  // ──────────────────────────────────────────────────────────

  respawnPlayer() {
    this.player.hp = this.player.maxHp;
    this.player.invulnerableUntil = this.time.now + 800;
    this.player.setPosition(this.respawnPoint.x, this.respawnPoint.y);
    this.player.setVelocity(0, 0);
    bus.emit(EVENTS.PLAYER_HURT, { hp: this.player.hp, maxHp: this.player.maxHp, wisdom: this.player.wisdomBonus, attack: this.player.getCurrentAttack() });
    const msg = this.respawnPoint.x > 200
      ? '💫 玄武气运恢复，在道长处重生！'
      : '💨 气运受损，回到山门！';
    this.showLevelBanner(msg);
  }

  finishLevel() {
    if (this.levelFinished) return;
    this.levelFinished = true;
    bus.emit(EVENTS.LEVEL_COMPLETE, { next: '泰山' });

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setScrollFactor(0).setDepth(980);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🌟 恒山通关！前往东岳泰山…', {
      fontSize: '28px', color: '#a8f0e0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(981);

    this.player.setVelocity(0, 0); this.player.isTalking = true;

    this.time.delayedCall(2000, () => {
      music.stop();
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.TAISHAN);
      overlay.destroy(); text.destroy();
    });
  }

  // ──────────────────────────────────────────────────────────
  //  每帧更新
  // ──────────────────────────────────────────────────────────

  update() {
    this.player.update();
    const nearNpc = this.npc.update(this.player);

    this.updateEnemySpawns();

    // 排队系统：检测玩家是否进入排队区域
    if (this.queueActive && !this.queueStarted && this.player.x > 4780 && this.player.y < 180) {
      this.activateQueueForPlayer();
    }

    // 排队计时 & 推进队伍
    if (this.queueStarted && !this.queueFinished && this.queuePersonsLeft > 0) {
      const delta = this.game.loop.delta;
      this.queueCurrentTimer -= delta;
      this.updateQueueUI();

      // 当前那人的时间到了
      if (this.queueCurrentTimer <= 0) {
        this.queuePersonsLeft--;
        this.queueCurrentTimer = QUEUE_WAIT_SECONDS * 1000;

        // 移走队头人物（最靠近碑的那位）
        if (this.queueNpcs.length > 0) {
          const head = this.queueNpcs.shift();
          if (head && head.active) {
            this.tweens.add({
              targets: head, alpha: 0, x: head.x + 80,
              duration: 500, onComplete: () => head.destroy(),
            });
          }
        }

        if (this.queuePersonsLeft <= 0) {
          // 轮到玩家了！
          this.time.delayedCall(300, () => this.completeQueue());
        } else {
          this.showLevelBanner(`⏳ 前进一步！还剩 ${this.queuePersonsLeft} 人`);
          this.updateQueueUI();
        }
      }
    }

    // F键插队（兼容键盘操作）
    if (this.queueStarted && !this.queueFinished && this.player.keys?.interact
        && Phaser.Input.Keyboard.JustDown(this.player.keys.interact)
        && this.player.x > 4780 && this.player.y < 180) {
      if (!nearNpc || this.npc.complete) {
        this.trySkipQueue();
      }
    }

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;

      // BOSS 位置安全限制
      if (enemy.isBoss) {
        if (enemy.x < enemy.patrolMinX) {
          enemy.x = enemy.patrolMinX;
          if (enemy.body.velocity.x < 0) enemy.setVelocityX(0);
        } else if (enemy.x > enemy.patrolMaxX) {
          enemy.x = enemy.patrolMaxX;
          if (enemy.body.velocity.x > 0) enemy.setVelocityX(0);
        }
      }

      if (enemy.isBoss && (enemy.isCharging || enemy.isJumping)) return;

      if (enemy.isBoss && !enemy.isCharging && !enemy.isJumping) {
        const dx = this.player.x - enemy.x;
        if (Math.abs(dx) > 20) enemy.patrolDirection = dx > 0 ? 1 : -1;
      }

      if (enemy.isRanged) {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const now = this.time.now;
        if (dist < 100) {
          const rd = enemy.x < this.player.x ? -1 : 1;
          enemy.setVelocityX(rd * enemy.patrolSpeed);
          enemy.setFlipX(rd < 0);
          return;
        }
        if (dist < 420 && now - enemy.lastShootTime > enemy.shootInterval) {
          enemy.lastShootTime = now;
          this.enemyShootProjectile(enemy);
        }
      }

      if (enemy.x <= enemy.patrolMinX) enemy.patrolDirection = 1;
      else if (enemy.x >= enemy.patrolMaxX) enemy.patrolDirection = -1;
      const spd = enemy.patrolSpeed || 60;
      enemy.setVelocityX(enemy.patrolDirection * spd);
      enemy.setFlipX(enemy.patrolDirection < 0);
    });

    // BOSS 着地冲击
    if (this.boss && this.boss.active && this.boss.isJumping) {
      if (this.boss.jumpLanding && this.boss.body.blocked.down) {
        this.boss.isJumping = false;
        this.boss.jumpLanding = false;
        this.bossLandingImpact(this.boss);
      }
    }

    // BOSS 标签跟随
    if (this.boss && this.boss.active && this.bossLabel) {
      this.bossLabel.setPosition(this.boss.x, this.boss.y - 54);
    }

    // 进入BOSS区域
    if (this.boss && this.boss.active && !this.bossEncounterShown && this.player.x >= 4700) {
      this.bossEncounterShown = true;
      this.showLevelBanner('⚔️ 灭绝师太登场！集中精力！');
      this.showBossHPBar();
      this.lockBossArena();
    }

    if (this.boss && this.boss.active) {
      this.updateBossPhase();
      this.updateBossHPBar();
    }

    // 答题提示
    if (this.quizItems) {
      this.quizItems.getChildren().forEach((scroll) => {
        if (scroll._hint && !scroll._used) {
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, scroll.x, scroll.y);
          if (dist > 50) scroll._hint.setVisible(false);
        }
      });
    }

    // 坠落检测
    if (this.player.y > 490) this.respawnPlayer();
    if (this.boss && this.boss.active && this.boss.y > 490) this.respawnBoss();

    // 背景音乐切换（有敌人时切战斗，无敌人时切恒山主题）
    if (!this.levelFinished) {
      const enemyNearby = this.enemies.getChildren().some((e) => e.active && Math.abs(e.x - this.player.x) < 280);
      const wantTheme = enemyNearby ? 'battle' : 'hengshan';
      if (wantTheme !== this._musicTheme) { this._musicTheme = wantTheme; music.play(wantTheme); }
    }

    // HUD 更新
    if (this.hud && this.hud.scene.isActive()) {
      this.hud.setLocation('🏔️ 恒山');
      this.hud.setHealth(this.player.hp, this.player.maxHp);
      this.hud.setWisdom(this.player.wisdomBonus, this.player.getCurrentAttack());

      if (this.quizUI && this.quizUI.isOpen) {
        this.hud.setHint('1-4 / A-D 作答');
      } else if (this.player.isTalking) {
        this.hud.setHint('F：继续对话');
      } else if (nearNpc && !this.npc.complete) {
        this.hud.setHint('靠近道长，按 F 交谈');
      } else if (this.queueStarted && !this.queueFinished) {
        const canAfford = skillSystem.getCoins() >= QUEUE_SKIP_COST;
        this.hud.setHint(canAfford
          ? `⏳ 排队中 · F键/点击按钮 花 ${QUEUE_SKIP_COST}🪙 插队`
          : `⏳ 排队中 · 当前金币：${skillSystem.getCoins()}🪙（还差 ${QUEUE_SKIP_COST - skillSystem.getCoins()} 枚）`);
      } else if (this.boss && this.boss.active && Math.abs(this.player.x - this.boss.x) < 500) {
        const ph = this.boss.phase;
        const hint = ph === 3 ? '💀 剑雨！躲开·X护体·J玄武刀·攻击'
                   : ph === 2 ? '⚡ 第二阶段！避剑气·X护体·J攻击'
                   : '⚔️ 灭绝师太！J攻击 · X护体 · Q切武器';
        this.hud.setHint(hint);
      } else if (this.portalActive && Math.abs(this.player.x - this.portal.x) < 100) {
        this.hud.setHint('走进传送门，五岳旅程完成！');
      } else if (this.awaitingCrystalPickup) {
        this.hud.setHint('🗡️ 前往供台，拾取玄武战刀和恒山气运晶石！');
      } else if (this.queueActive && !this.queueStarted) {
        this.hud.setHint('📸 向前走到排队区，等待拍照！');
      } else if (this.npc.complete && !this.bossDefeated) {
        this.hud.setHint('→ 登上天峰岭，挑战灭绝师太！');
      } else if (this.player.skills[ITEMS.XUANWU_BLADE]) {
        const wLabel = this.player.activeWeapon === 'sword' ? '⚔️太极剑'
                     : this.player.activeWeapon === 'staff' ? '🦯少林禅杖'
                     : this.player.activeWeapon === 'blade' ? '🗡️玄武战刀'
                     : '☯八卦掌';
        this.hud.setHint(`${wLabel} · Q切换 | J攻击 | X护体 | Z/C/N/V 技能`);
      } else {
        this.hud.setHint('J 攻击  |  继续前行');
      }
    }
  }
}







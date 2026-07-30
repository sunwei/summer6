// 嵩山关卡：少林寺 → 习易筋经 → 迎战禅杖僧王 → 开启传送门
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

const SONGSHAN_QUIZZES = [
  { q: '嵩山位于中国哪个省份？',    choices: ['河南省', '湖北省', '山东省', '陕西省'], correct: 0 },
  { q: '少林寺建于哪个朝代？',      choices: ['北魏', '唐朝', '宋朝', '明朝'],        correct: 0 },
  { q: '易筋经相传由谁传承？',      choices: ['达摩祖师', '慧能禅师', '玄奘法师', '鉴真和尚'], correct: 0 },
  { q: '嵩山是中国五岳中的哪岳？',  choices: ['中岳', '东岳', '西岳', '北岳'],        correct: 0 },
  { q: '嵩山少林武术的核心理念是？', choices: ['禅武合一', '飞檐走壁', '隐身遁形', '以力服人'], correct: 0 },
];

export class SongshanScene extends Phaser.Scene {
  constructor() {
    super(SCENES.SONGSHAN);
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
    this.awaitingStaffPickup = false;
    this._musicTheme = 'songshan';

    if (this.scene.isActive(SCENES.HUD)) this.scene.stop(SCENES.HUD);
    this.scene.launch(SCENES.HUD);
    this.hud = this.scene.get(SCENES.HUD);

    music.play('songshan');

    this.physics.world.setBounds(0, -2000, 5200, 2560);
    const PLAY_H = GAME_HEIGHT - 80;
    this.cameras.main.setViewport(0, 0, GAME_WIDTH, PLAY_H);
    this.cameras.main.setBounds(0, -600, 5200, 1200); // 全程恒定，覆盖地面到山顶

    this.createBackground();
    this.createPlatforms();
    this.createDecorations();
    this.createInnerSanctum();
    this.createParticles();

    this.player = new Player(this, 80, 390);
    this.player.syncSkills(skillSystem.getInventory());
    this.physics.add.collider(this.player, this.platforms);

    // 重生点初始在山门口，与方丈对话后更新
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

    this.playerBullets = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.playerBullets, this.enemies, this.handleBulletHit, null, this);

    // 敌方弹幕与玩家碰撞
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
      }
    };

    bus.on(EVENTS.ITEM_COLLECTED, this.onItemCollected);
    bus.on(EVENTS.CRYSTAL_SKILL, this.onCrystalSkill);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EVENTS.ITEM_COLLECTED, this.onItemCollected);
      bus.off(EVENTS.CRYSTAL_SKILL, this.onCrystalSkill);
      this.quizUI?.destroy();
    });

    if (skillSystem.getInventory()[ITEMS.SKILL_YIJINJING]) {
      this.npc.setCompleted(true);
    }

    this.bossDefeated = !!skillSystem.getInventory()[ITEMS.SONGSHAN_COMPLETE];
    if (this.bossDefeated) {
      this.activatePortal(false);
    } else {
      this.createBoss();
    }
  }

  // ──────────────────────────────────────────────────────────
  //  背景
  // ──────────────────────────────────────────────────────────

  createBackground() {
    // 白天石灰岩山峦背景
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, GAME_WIDTH, GAME_HEIGHT * 0.56, 0x1c2840, 1).setScrollFactor(0);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.75, GAME_WIDTH, GAME_HEIGHT * 0.5, 0x283050, 1).setScrollFactor(0);

    const far = this.add.graphics().setScrollFactor(0.1);
    far.fillStyle(0x2a3040, 1);
    far.beginPath();
    far.moveTo(-100, 540); far.lineTo(80, 280); far.lineTo(220, 400); far.lineTo(430, 200);
    far.lineTo(620, 380); far.lineTo(850, 240); far.lineTo(1100, 400); far.lineTo(1350, 210);
    far.lineTo(1600, 380); far.lineTo(1850, 230); far.lineTo(2100, 400); far.lineTo(2400, 180);
    far.lineTo(2700, 340); far.lineTo(3000, 160); far.lineTo(3400, 300); far.lineTo(3800, 150);
    far.lineTo(4200, 290); far.lineTo(4400, 540); far.closePath(); far.fillPath();

    const mid = this.add.graphics().setScrollFactor(0.3);
    mid.fillStyle(0x3a4055, 1);
    mid.beginPath();
    mid.moveTo(-60, 540); mid.lineTo(100, 320); mid.lineTo(240, 440); mid.lineTo(470, 280);
    mid.lineTo(660, 440); mid.lineTo(900, 290); mid.lineTo(1130, 460); mid.lineTo(1380, 300);
    mid.lineTo(1600, 460); mid.lineTo(1860, 300); mid.lineTo(2120, 460); mid.lineTo(2400, 290);
    mid.lineTo(2680, 460); mid.lineTo(2960, 310); mid.lineTo(3200, 480); mid.lineTo(3500, 300);
    mid.lineTo(3800, 460); far.lineTo(4200, 310); far.lineTo(4400, 540); far.closePath(); mid.fillPath();

    // 远景少林寺轮廓
    mid.fillStyle(0x252d40, 1);
    mid.fillRect(2400, 300, 14, 80); mid.fillRect(2490, 300, 14, 80);
    mid.fillTriangle(2380, 310, 2524, 310, 2452, 272);

    // 近景树木（扩展至5400覆盖新Boss区域）
    const near = this.add.graphics().setScrollFactor(0.6);
    near.fillStyle(0x14281a, 1);
    for (let x = -50; x < 5400; x += 65) {
      near.fillTriangle(x, 540, x + 24, 430 - (x % 3) * 18, x + 48, 540);
      near.fillTriangle(x + 18, 540, x + 44, 415 - (x % 4) * 16, x + 70, 540);
    }

    // 云
    for (let i = 0; i < 8; i++) {
      const cloud = this.add.container(Phaser.Math.Between(-100, 4200), Phaser.Math.Between(50, 160), [
        this.add.ellipse(-22, 4, 48, 26, 0xffffff, 0.14),
        this.add.ellipse(0, 0, 58, 32, 0xffffff, 0.14),
        this.add.ellipse(26, 6, 44, 24, 0xffffff, 0.14),
      ]);
      cloud.setScrollFactor(0.15);
      this.tweens.add({ targets: cloud, x: cloud.x + Phaser.Math.Between(120, 260), duration: Phaser.Math.Between(12000, 20000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  平台（石板）
  // ──────────────────────────────────────────────────────────

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();

    const addPlatform = (x, y, width) => {
      const tileCount = Math.ceil(width / 32);
      for (let i = 0; i < tileCount; i++) {
        this.platforms.create(x + i * 32 + 16, y, 'tile_stone');
      }
    };

    // 地面
    addPlatform(0, 440, 1600);
    addPlatform(1800, 440, 2400);

    // 跳跃平台
    addPlatform(300, 350, 150);
    addPlatform(600, 280, 120);
    addPlatform(900, 220, 100);
    addPlatform(1150, 310, 180);
    addPlatform(1400, 250, 120);
    addPlatform(1900, 350, 150);
    addPlatform(2100, 290, 180);

    // 爬升踏板
    addPlatform(2380, 360, 64);
    addPlatform(2460, 328, 64);
    addPlatform(2540, 296, 64);
    addPlatform(2620, 264, 64);
    addPlatform(2700, 232, 64);
    addPlatform(2750, 200, 140);
    addPlatform(2920, 238, 140);

    // 通往内殿的石阶
    addPlatform(3200, 400, 96);
    addPlatform(3360, 360, 96);
    addPlatform(3520, 320, 96);
    addPlatform(3680, 280, 96);
    addPlatform(3840, 240, 96);
    addPlatform(4000, 200, 96);

    // 内殿主台地（扩展至1000px，撑满整屏作战区域）
    addPlatform(4060, 165, 1000);
  }

  // ──────────────────────────────────────────────────────────
  //  装饰
  // ──────────────────────────────────────────────────────────

  createDecorations() {
    // 少林寺入口石门
    const gate = this.add.graphics();
    gate.fillStyle(0x6a6060, 1);
    gate.fillRect(2090, 200, 12, 90); gate.fillRect(2158, 200, 12, 90);
    gate.fillStyle(0x888080, 1);
    gate.fillRect(2082, 194, 88, 12);
    gate.fillStyle(0xa08880, 1);
    gate.fillRect(2084, 196, 84, 6);
    gate.fillStyle(0xffd700, 0.5);
    gate.fillRect(2116, 200, 8, 86);

    // 石牌匾
    this.add.text(2160, 180, '少林寺', {
      fontSize: '18px', color: '#ffd700', stroke: '#3a2000', strokeThickness: 4,
      backgroundColor: '#00000066', padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    // 练功场地标记
    const trainSign = this.add.text(1200, 278, '🥊 练功场', {
      fontSize: '16px', color: '#c8a870', backgroundColor: '#00000066', padding: { x: 6, y: 3 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: trainSign, alpha: { from: 0.6, to: 1.0 }, duration: 1400, yoyo: true, repeat: -1 });

    // 通往内殿指引
    const innerSign = this.add.text(3100, 374, '⬆ 内殿', {
      fontSize: '20px', color: '#ffd700', stroke: '#000', strokeThickness: 4,
      backgroundColor: '#00000099', padding: { x: 10, y: 5 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: innerSign, alpha: { from: 0.55, to: 1.0 }, duration: 1200, yoyo: true, repeat: -1 });

    // 石灯笼
    const lanternX = [340, 660, 1200, 2180, 2980];
    lanternX.forEach((lx) => {
      const rope = this.add.rectangle(lx, 295, 2, 26, 0x4a3020, 1);
      const lantern = this.add.circle(lx, 315, 8, 0xff9900, 0.88);
      const glow = this.add.circle(lx, 315, 18, 0xff9900, 0.14);
      this.tweens.add({ targets: [lantern, glow, rope], y: '+=4', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  内殿建筑（Boss 区域）
  // ──────────────────────────────────────────────────────────

  createInnerSanctum() {
    // 内殿大门
    const gate = this.add.graphics();
    gate.fillStyle(0x5a4a30, 1);
    gate.fillRect(4046, 52, 14, 113); gate.fillRect(4098, 52, 14, 113);
    gate.fillStyle(0xcc8800, 1);
    gate.fillRect(4040, 44, 80, 14);
    gate.fillStyle(0xffd700, 0.6);
    gate.fillRect(4042, 46, 76, 8);

    // 大殿主体
    const hall = this.add.graphics();
    hall.fillStyle(0x5a4020, 1);
    hall.fillRect(4300, 112, 14, 53); hall.fillRect(4380, 112, 14, 53);
    hall.fillStyle(0xcc8800, 1);
    hall.fillRect(4288, 104, 106, 12);
    hall.fillStyle(0x8e2a2a, 1);
    hall.fillTriangle(4276, 112, 4408, 112, 4342, 72);

    // 香炉
    const incense = this.add.graphics();
    incense.fillStyle(0x8b6914, 1);
    incense.fillEllipse(4240, 158, 28, 12);
    incense.fillRect(4228, 134, 24, 26);
    incense.fillStyle(0xdaa520, 1);
    incense.fillRect(4226, 132, 28, 6);

    // 供杖台（战后生成少林禅杖，位于大殿右侧）
    const altar = this.add.graphics();
    altar.fillStyle(0x5e5860, 1);
    altar.fillRect(4454, 148, 36, 30);
    altar.fillStyle(0x8b6914, 1);
    altar.fillRect(4450, 144, 44, 8);
    altar.fillStyle(0xffd700, 0.22);
    altar.fillRect(4452, 146, 40, 4);

    // 香烟粒子
    for (let i = 0; i < 6; i++) {
      const smoke = this.add.circle(4236 + Phaser.Math.Between(-6, 6), 120 + i * 12, 3, 0xdddddd, 0.4).setDepth(9);
      this.tweens.add({ targets: smoke, y: smoke.y - 30, alpha: 0, duration: 1200 + i * 200, repeat: -1, delay: i * 200 });
    }

    // 金色粒子光点
    for (let i = 0; i < 18; i++) {
      const sp = this.add.circle(Phaser.Math.Between(4060, 4680), Phaser.Math.Between(50, 162), Phaser.Math.Between(1, 2), 0xffd700, Phaser.Math.FloatBetween(0.25, 0.65));
      this.tweens.add({ targets: sp, alpha: { from: 0.1, to: 0.8 }, y: sp.y - Phaser.Math.Between(5, 12), duration: Phaser.Math.Between(800, 2000), yoyo: true, repeat: -1 });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  粒子
  // ──────────────────────────────────────────────────────────

  createParticles() {
    for (let i = 0; i < 30; i++) {
      const sp = this.add.circle(Phaser.Math.Between(0, 3200), Phaser.Math.Between(60, 440), Phaser.Math.Between(1, 2), 0xffd700, Phaser.Math.FloatBetween(0.2, 0.6));
      sp.setScrollFactor(0.35);
      this.tweens.add({ targets: sp, alpha: { from: 0.15, to: 0.75 }, y: sp.y - Phaser.Math.Between(5, 11), duration: Phaser.Math.Between(1000, 2200), yoyo: true, repeat: -1 });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  普通敌人（少林武僧，动态生成池，最多3个同屏）
  // ──────────────────────────────────────────────────────────

  createEnemies() {
    this.enemies = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group({ allowGravity: false });
    this.maxActiveEnemies = 3;
    this.lastSpawnTime = 0;

    // 18个小怪出生点，随玩家推进动态激活
    // type: 'melee'=标准近攻  'heavy'=重装近攻(红)  'ranged'=远攻投掷(蓝)
    this.enemySpawnPool = [
      // ── 区域1：山脚 (x 300~750) ──
      { x: 380,  y: 400, minX: 330,  maxX: 450,  type: 'melee',  spawned: false },
      { x: 540,  y: 400, minX: 480,  maxX: 600,  type: 'ranged', spawned: false },
      { x: 700,  y: 400, minX: 640,  maxX: 760,  type: 'heavy',  spawned: false },
      // ── 区域2：跳台区 (x 900~1500) ──
      { x: 920,  y: 180, minX: 900,  maxX: 1000, type: 'melee',  spawned: false },
      { x: 1180, y: 270, minX: 1150, maxX: 1280, type: 'ranged', spawned: false },
      { x: 1420, y: 210, minX: 1400, maxX: 1510, type: 'heavy',  spawned: false },
      // ── 区域3：第二地面段 (x 1800~2300) ──
      { x: 1870, y: 400, minX: 1820, maxX: 1950, type: 'ranged', spawned: false },
      { x: 1970, y: 310, minX: 1900, maxX: 2040, type: 'melee',  spawned: false },
      { x: 2160, y: 250, minX: 2100, maxX: 2280, type: 'heavy',  spawned: false },
      // ── 区域4：爬升踏台 (x 2300~2850) ──
      { x: 2360, y: 400, minX: 2300, maxX: 2440, type: 'melee',  spawned: false },
      { x: 2660, y: 200, minX: 2640, maxX: 2760, type: 'ranged', spawned: false },
      { x: 2850, y: 200, minX: 2810, maxX: 2940, type: 'heavy',  spawned: false },
      // ── 区域5：内殿通道前 (x 2950~3200) ──
      { x: 2980, y: 400, minX: 2940, maxX: 3060, type: 'melee',  spawned: false },
      { x: 3070, y: 400, minX: 3020, maxX: 3130, type: 'ranged', spawned: false },
      { x: 3160, y: 400, minX: 3110, maxX: 3200, type: 'heavy',  spawned: false },
      // ── 区域6：石阶守卫 (x 3200~4060) ──
      { x: 3290, y: 360, minX: 3200, maxX: 3360, type: 'heavy',  spawned: false },
      { x: 3590, y: 280, minX: 3520, maxX: 3660, type: 'ranged', spawned: false },
      { x: 3890, y: 200, minX: 3840, maxX: 3940, type: 'melee',  spawned: false },
    ];
  }

  // 根据出生点数据生成一个武僧
  spawnEnemyFromData(data) {
    const flash = this.add.circle(data.x, data.y, 20, 0xffddaa, 0.55).setDepth(49);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2.6, duration: 340, onComplete: () => flash.destroy() });

    const e = this.enemies.create(data.x, data.y, 'monk_enemy');
    e.body.setSize(18, 34); e.body.setOffset(7, 10);
    e.setCollideWorldBounds(true);
    e.patrolMinX = data.minX; e.patrolMaxX = data.maxX;
    e.patrolDirection = 1;

    if (data.type === 'heavy') {
      e.hp = 50; e.patrolSpeed = 72; e.contactDamage = 18; e.isHeavy = true;
      e.setTint(0xff3300); e.setScale(1.18); e.setVelocityX(72);
    } else if (data.type === 'ranged') {
      e.hp = 30; e.patrolSpeed = 42; e.contactDamage = 8; e.isRanged = true;
      e.lastShootTime = 0; e.shootInterval = 2800;
      e.setTint(0x0099ff); e.setVelocityX(42);
    } else {
      e.hp = 40; e.patrolSpeed = 60; e.contactDamage = 10; e.setVelocityX(60);
    }
    return e;
  }

  // 动态生成逻辑（每帧调用，维持最多3个同屏）
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
  //  禅杖僧王 BOSS（三阶段）
  // ──────────────────────────────────────────────────────────

  createBoss() {
    const boss = this.enemies.create(4560, 100, 'monk_boss');
    boss.body.setSize(22, 38); boss.body.setOffset(5, 8);
    boss.setCollideWorldBounds(true);
    boss.patrolMinX = 4090; boss.patrolMaxX = 5030;
    boss.patrolDirection = -1;
    boss.maxHp = 600; boss.hp = 600;
    boss.isBoss = true;
    boss.phase = 1; boss.contactDamage = 22;
    boss.patrolSpeed = 80;
    boss.lastChargeTime = 0; boss.lastProjectileTime = 0;
    boss.lastJumpTime = 0;
    boss.lastSweepTime = 0;
    boss.isCharging = false;
    boss.isJumping = false;
    boss.jumpLanding = false;
    boss.setVelocityX(-80);
    this.boss = boss;

    this.bossLabel = this.add.text(4560, 46, '🦯 禅杖僧王', {
      fontSize: '18px', color: '#ff9900', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200);

    this.createBossHPBar();

    // 竞技场左侧封路墙（内殿入口处）
    this.bossArenaWall = this.physics.add.staticImage(4050, 260, 'tile_stone');
    this.bossArenaWall.setVisible(false);
    this.bossArenaWall.body.setSize(20, 600);
    this.bossArenaWall.body.enable = false;
    this.physics.add.collider(this.player, this.bossArenaWall);
  }

  createBossHPBar() {
    const cx = GAME_WIDTH / 2, barW = 280, barY = 56;
    this.bossHPBG = this.add.rectangle(cx, barY, barW + 6, 22, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(955).setStrokeStyle(2, 0xff9900, 1).setVisible(false).setAlpha(0);
    this.bossHPFill = this.add.rectangle(cx - barW / 2, barY, barW, 14, 0xff6600, 1)
      .setScrollFactor(0).setDepth(956).setOrigin(0, 0.5).setVisible(false).setAlpha(0);
    this.bossHPName = this.add.text(cx, barY - 15, '🦯 禅杖僧王  第一阶段', {
      fontSize: '13px', color: '#ff9900', stroke: '#000000', strokeThickness: 3,
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
    const cols = { 1: 0xff6600, 2: 0xff3300, 3: 0xcc0000 };
    this.bossHPFill.setFillStyle(cols[this.boss.phase] || 0xff6600, 1);
  }

  destroyBossHPBar() {
    [this.bossHPBG, this.bossHPFill, this.bossHPName, this.bossHPPercent].forEach((el) => { if (el) el.destroy(); });
    this.bossHPBG = this.bossHPFill = this.bossHPName = this.bossHPPercent = null;
  }

  lockBossArena() {
    if (this.bossArenaWall) { this.bossArenaWall.body.enable = true; this.bossArenaWall.refreshBody(); }
    const flash = this.add.rectangle(4052, 160, 16, 320, 0xff9900, 0.85).setDepth(300);
    this.tweens.add({ targets: flash, alpha: 0, scaleY: 1.6, duration: 700, onComplete: () => flash.destroy() });
    const msg = this.add.text(4200, 96, '⚠️ 禅杖僧王！退路已封！', {
      fontSize: '16px', color: '#ff9900', stroke: '#000', strokeThickness: 3, backgroundColor: '#00000099', padding: { x: 6, y: 3 },
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

    // 跳跃攻击（全阶段）
    const jumpInterval = boss.phase === 3 ? 2800 : boss.phase === 2 ? 4200 : 6000;
    if (!boss.isCharging && !boss.isJumping && now - boss.lastJumpTime > jumpInterval) {
      boss.lastJumpTime = now;
      this.bossJumpAttack(boss);
    }

    if (boss.phase >= 2 && !boss.isCharging && !boss.isJumping) {
      const interval = boss.phase === 3 ? 2000 : 3200;
      if (now - boss.lastChargeTime > interval) { boss.lastChargeTime = now; this.bossCharge(boss); }
    }
    if (boss.phase === 3 && now - boss.lastProjectileTime > 2400) {
      boss.lastProjectileTime = now; this.bossThrowStaff(boss);
    }

    // 禅杖横扫（全阶段，近距离时触发的招牌禅杖技能）
    const sweepInterval = boss.phase === 3 ? 2600 : boss.phase === 2 ? 3400 : 4200;
    if (!boss.isCharging && !boss.isJumping && now - boss.lastSweepTime > sweepInterval) {
      const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
      if (dist < 140) {
        boss.lastSweepTime = now;
        this.bossStaffSweep(boss);
      }
    }
  }

  onBossPhaseChange(boss, phase) {
    if (phase === 2) {
      boss.patrolSpeed = 125; boss.contactDamage = 32; boss.setTint(0xff6600);
      if (this.bossHPName) this.bossHPName.setText('🦯 禅杖僧王  ⚡ 第二阶段').setStyle({ color: '#ff6600' });
      if (this.bossHPBG) this.bossHPBG.setStrokeStyle(2, 0xff6600, 1);
      this.showLevelBanner('⚡ 禅杖僧王·怒气大发！');
      this.burstParticles(boss.x, boss.y, 18, 0xff6600);
      this.cameras.main.shake(300, 0.009); this.cameras.main.flash(180, 255, 110, 0, true);
    } else if (phase === 3) {
      boss.patrolSpeed = 165; boss.contactDamage = 45; boss.setTint(0xdd1100);
      if (this.bossHPName) this.bossHPName.setText('🦯 禅杖僧王  💀 狂怒').setStyle({ color: '#ff4444' });
      if (this.bossHPBG) this.bossHPBG.setStrokeStyle(2, 0xdd1100, 1);
      this.showLevelBanner('💀 禅杖僧王·狂怒之力！极度危险！');
      this.burstParticles(boss.x, boss.y, 28, 0xdd1100);
      this.cameras.main.shake(500, 0.018); this.cameras.main.flash(280, 255, 0, 0, true);
    }
  }

  // 禅杖横扫（近距离宽幅横扫，全阶段，命中造成伤害+击退）
  bossStaffSweep(boss) {
    if (!boss || !boss.active || !this.player) return;
    const dir = this.player.x > boss.x ? 1 : -1;
    boss.setFlipX(dir < 0);
    const range = 100;
    const cx = boss.x + dir * range * 0.55;
    const cy = boss.y - 8;

    // 禅杖横扫特效（金环挥动弧光）
    const sweep = this.add.rectangle(cx, cy, range, 28, 0xdaa520, 0.5)
      .setDepth(53).setStrokeStyle(2, 0xffe066, 0.9).setRotation(dir > 0 ? 0.18 : -0.18);
    this.tweens.add({ targets: sweep, alpha: 0, scaleX: 1.5, duration: 260, ease: 'Quad.easeOut', onComplete: () => sweep.destroy() });
    const glow = this.add.circle(boss.x + dir * 16, cy, 10, 0xffe066, 0.55).setDepth(54);
    this.tweens.add({ targets: glow, alpha: 0, scale: 2.3, duration: 240, onComplete: () => glow.destroy() });

    const warn = this.add.text(boss.x, boss.y - 62, '🦯 禅杖横扫！', {
      fontSize: '17px', color: '#daa520', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 520, onComplete: () => warn.destroy() });

    const dmg = boss.phase === 3 ? 28 : boss.phase === 2 ? 20 : 15;
    const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
    if (dist < range) {
      if (this.player.isGuarding()) {
        this.player.flashGuardSuccess();
      } else {
        this.player.hurt(dmg, boss.x);
        this.player.setVelocityX(dir * 170);
        this.showLevelBanner('🦯 禅杖横扫击中！');
      }
    }
  }

  // BOSS 跳跃攻击（全阶段）
  bossJumpAttack(boss) {
    if (!boss || !boss.active || boss.isJumping || boss.isCharging) return;
    if (!boss.body.blocked.down) return;
    boss.isJumping = true;
    boss.jumpLanding = false;
    const dir = this.player.x > boss.x ? 1 : -1;
    const jumpXSpeed = boss.phase === 3 ? 260 : boss.phase === 2 ? 200 : 145;
    boss.setVelocityY(-480);
    boss.setVelocityX(dir * jumpXSpeed);
    boss.setFlipX(dir < 0);
    const warn = this.add.text(boss.x, boss.y - 72, '⬆ 跳击！', {
      fontSize: '18px', color: '#ffaa00', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 500, onComplete: () => warn.destroy() });
    this.time.delayedCall(300, () => { if (boss && boss.active) boss.jumpLanding = true; });
  }

  // BOSS 落地冲击
  bossLandingImpact(boss) {
    this.cameras.main.shake(260, 0.011);
    this.burstParticles(boss.x, boss.y + 14, 18, 0xff9900);
    const ring = this.add.circle(boss.x, boss.y + 14, 8, 0xff6600, 0)
      .setStrokeStyle(3, 0xff8800, 0.9).setDepth(52);
    this.tweens.add({ targets: ring, scaleX: 8, scaleY: 4, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
    if (dist < 95) {
      if (this.player.isGuarding()) {
        this.player.flashGuardSuccess();
      } else {
        this.player.hurt(boss.phase >= 3 ? 26 : 20, boss.x);
        this.showLevelBanner('💥 禅杖砸地重击！');
      }
    }
    boss.setVelocityX(0);
  }

  // 敌方弹幕射击（远攻武僧）
  enemyShootProjectile(enemy) {
    if (!enemy || !enemy.active || !this.player) return;
    const dir = this.player.x > enemy.x ? 1 : -1;
    const proj = this.physics.add.image(enemy.x + dir * 18, enemy.y - 10, 'bagua_orb');
    proj.setTint(0x00aaff);
    proj.setScale(0.85);
    proj.damage = 12;
    proj.body.setAllowGravity(false);
    proj.body.setVelocity(dir * 210, 0);
    if (this.enemyProjectiles) this.enemyProjectiles.add(proj);
    this.tweens.add({ targets: proj, angle: dir > 0 ? 360 : -360, duration: 500, repeat: -1 });
    const warn = this.add.text(enemy.x, enemy.y - 30, '⚡', {
      fontSize: '14px', color: '#0099ff',
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 14, duration: 380, onComplete: () => warn.destroy() });
    this.time.delayedCall(2200, () => { if (proj && proj.active) proj.destroy(); });
  }

  // 敌方弹幕命中玩家
  handleEnemyProjectileHit(player, proj) {
    if (!proj.active) return;
    this.burstParticles(proj.x, proj.y, 8, 0x00aaff);
    proj.destroy();
    if (player.isGuarding()) {
      player.flashGuardSuccess();
    } else {
      player.hurt(proj.damage || 12, proj.x);
    }
  }

  bossCharge(boss) {
    if (!boss || !boss.active || !this.player) return;
    boss.isCharging = true;
    const dir = this.player.x > boss.x ? 1 : -1;
    const spd = boss.phase === 3 ? 360 : 260;
    boss.setVelocityX(dir * spd); boss.setFlipX(dir < 0);
    const warn = this.add.text(boss.x, boss.y - 62, '💢 冲击！', {
      fontSize: '17px', color: '#ff2200', stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 500, onComplete: () => warn.destroy() });
    this.time.delayedCall(620, () => { if (boss && boss.active) boss.isCharging = false; });
  }

  // 禅杖投掷（第三阶段远程技能，甩杖旋转飞击）
  bossThrowStaff(boss) {
    if (!boss || !boss.active || !this.player) return;
    const angle = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
    const spd = 300;
    const proj = this.physics.add.image(boss.x, boss.y - 12, 'bagua_orb');
    proj.setTint(0xcc6600); proj.setScale(0.85);
    proj.body.setAllowGravity(false);
    proj.body.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
    this.tweens.add({ targets: proj, angle: 360, duration: 450, repeat: -1 });

    const glow = this.add.circle(boss.x, boss.y - 12, 10, 0xcc6600, 0.38).setDepth(48);
    this.tweens.add({ targets: glow, alpha: { from: 0.2, to: 0.6 }, scale: { from: 0.8, to: 1.4 }, duration: 300, yoyo: true, repeat: -1 });

    this.physics.add.overlap(this.player, proj, () => {
      if (!proj.active) return;
      this.burstParticles(proj.x, proj.y, 10, 0xcc6600);
      glow.destroy(); proj.destroy();
      if (this.player.isGuarding()) this.player.flashGuardSuccess();
      else this.player.hurt(28, boss.x);
    });
    this.time.delayedCall(3000, () => { if (proj.active) proj.destroy(); if (glow.active) glow.destroy(); });
  }

  respawnBoss() {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    boss.setPosition(4560, 100); boss.setVelocity(0, 0);
    boss.isCharging = false;
    boss.isJumping = false;
    boss.jumpLanding = false;
    boss.patrolDirection = -1;
    boss.setVelocityX(-boss.patrolSpeed);
    if (boss.phase === 3) boss.setTint(0xdd1100);
    else if (boss.phase === 2) boss.setTint(0xff6600);
    else boss.clearTint();
  }

  // ──────────────────────────────────────────────────────────
  //  Boss 击败
  // ──────────────────────────────────────────────────────────

  onBossDefeated(boss) {
    this.burstParticles(boss.x, boss.y, 30, 0xffd700);
    this.burstParticles(boss.x, boss.y, 18, 0xff6600);
    this.burstParticles(boss.x, boss.y, 10, 0xdd1100);
    this.cameras.main.shake(400, 0.012);
    boss.destroy();
    this.bossDefeated = true;
    this.boss = null;
    if (this.bossLabel) { this.bossLabel.destroy(); this.bossLabel = null; }
    this.destroyBossHPBar();
    if (this.bossArenaWall) this.bossArenaWall.body.enable = false;
    skillSystem.collect(ITEMS.SONGSHAN_COMPLETE);
    this.showLevelBanner('🦯 禅杖僧王已败！');
    this.time.delayedCall(1200, () => this.spawnStaffPickup());
  }

  // 供杖台生成少林禅杖（战后拾取物，位于大殿供杖台上方）
  spawnStaffPickup() {
    this.awaitingStaffPickup = true;
    const sx = 4472, sy = 108;
    const staff = this.physics.add.staticImage(sx, sy, 'chan_staff');
    staff.setDepth(10);
    this.tweens.add({ targets: staff, y: sy - 12, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const glow = this.add.circle(sx, sy, 24, 0xdaa520, 0.2).setDepth(9);
    this.tweens.add({ targets: glow, alpha: { from: 0.08, to: 0.45 }, scale: { from: 0.9, to: 1.3 }, duration: 750, yoyo: true, repeat: -1 });

    const hint = this.add.text(sx, sy - 40, '🦯 少林禅杖', { fontSize: '18px', color: '#daa520', stroke: '#000000', strokeThickness: 3, backgroundColor: '#00000088', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: hint, y: '+=5', duration: 900, yoyo: true, repeat: -1 });

    this.physics.add.overlap(this.player, staff, () => {
      if (!staff.active) return;
      staff.destroy(); glow.destroy(); hint.destroy();
      this.awaitingStaffPickup = false;
      if (skillSystem.collect(ITEMS.CHAN_STAFF)) {
        this.showLevelBanner('🦯 少林禅杖已获得！新技能：禅杖旋风扫！');
        this.time.delayedCall(700, () => this.showVictoryDialogue());
      } else {
        this.showVictoryDialogue();
      }
    });
  }

  showVictoryDialogue() {
    const lines = [
      '旁白：「禅杖僧王一败涂地，少林禅武之力流转于身…」',
      '旁白：「少林禅杖到手，长杖挥洒，可发禅杖旋风扫敌！」',
      '旁白：「嵩山气运碎片现身，五岳之路越来越近！」',
      '地图：「传送门已开启，前往下一座圣山吧！」',
      '✅ 嵩山完成！前往传送门继续旅程。',
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
      [630, 220], [900, 170], [1500, 200], [1960, 310],
      [2380, 325], [2920, 400], [3420, 325], [3730, 248],
    ];
    positions.forEach(([x, y]) => {
      const orb = this.energyOrbs.create(x, y, 'crystal_yellow');
      orb.setScale(0.5); orb.setTint(0xfff09a);
      orb.body.setAllowGravity(false); orb.body.moves = false;
      this.tweens.add({ targets: orb, y: y - 8, angle: 360, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  NPC 与传送门
  // ──────────────────────────────────────────────────────────

  createNpcAndPortal() {
    const dialogues = [
      '方丈：「阿弥陀佛，小北施主，少林有缘人，老衲等候已久。」',
      '方丈：「汝持太极八卦剑，气运可期，尚需少林内劲相助。」',
      '方丈：「少林秘传易筋经——运功时（V键），爆劲前冲可震退敌群！」',
      '方丈：「汝的黄龙晶（C键）亦可震地伤敌，龙威赫赫！」',
      '方丈：「然则寺中禅杖僧王据守内殿，其禅杖攻守兼备，非真功不能胜。」',
      '方丈：「记住：禅定者制心，武者制身，二者合一则无敌！」',
      '✅ 习得易筋经！前进，迎战禅杖僧王！',
    ];

    this.npc = new NPC(this, 2900, 240, 'npc_abbot', dialogues, () => {
      if (skillSystem.collect(ITEMS.SKILL_YIJINJING)) {
        this.showLevelBanner('💪 易筋经已习得！→ 前往内殿');
      }
      // 与方丈对话完毕，设置新重生点
      this.respawnPoint = { x: 2820, y: 390 };
      this.showCheckpointBeacon(2820, 390);
    }, '方丈');

    this.portalGlow = this.add.ellipse(5080, 106, 40, 76, COLORS.TEAL, 0.18).setVisible(false);
    this.portal = this.physics.add.staticImage(5080, 106, 'portal_frame');
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
    const positions = [[450, 408], [980, 408], [1600, 408], [2060, 260], [2720, 408]];

    positions.forEach(([x, y], i) => {
      const scroll = this.quizItems.create(x, y, 'quiz_scroll');
      scroll.quizIndex = i % SONGSHAN_QUIZZES.length;
      scroll.setTint(0xffd700);
      this.tweens.add({ targets: scroll, y: y - 10, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      const glow = this.add.circle(x, y, 18, 0xffd700, 0.15);
      this.tweens.add({ targets: glow, alpha: { from: 0.05, to: 0.3 }, scaleX: { from: 0.8, to: 1.2 }, scaleY: { from: 0.8, to: 1.2 }, duration: 900, yoyo: true, repeat: -1 });

      const hint = this.add.text(x, y - 30, '📜 答题', { fontSize: '13px', color: '#ffd700', backgroundColor: '#00000066', padding: { x: 4, y: 2 } }).setOrigin(0.5).setVisible(false);
      scroll._hint = hint; scroll._glow = glow;
      scroll.once('destroy', () => { hint.destroy(); glow.destroy(); });
    });

    this.physics.add.overlap(this.player, this.quizItems, (player, scroll) => {
      if (this.quizUI.isOpen || scroll._used) return;
      scroll._hint.setVisible(false); scroll._used = true; scroll.destroy();
      player.isTalking = true;
      const qData = SONGSHAN_QUIZZES[scroll.quizIndex];
      this.quizUI.open(qData.q, qData.choices, qData.correct, (correct) => {
        player.isTalking = false;
        if (correct) { this.player.addWisdomBuff(20); this.showLevelBanner('📖 智慧+20 → 攻击提升！'); this.burstParticles(this.player.x, this.player.y - 24, 12, 0xffd700); }
        else { this.showLevelBanner('💭 学习是旅途的一部分！'); }
      });
    }, null, this);
  }

  showControlsReminder() {
    const reminder = this.add.text(GAME_WIDTH / 2, 76,
      '← → 移动  |  ↑/空格 跳跃  |  J 剑击  |  Z 朱雀  |  C 黄龙  |  V 易筋经  |  X 护体  |  F 交谈',
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
    const bg = this.add.rectangle(GAME_WIDTH / 2, 112, 380, 38, 0x0d1117, 0.92).setScrollFactor(0).setDepth(950);
    bg.setStrokeStyle(2, COLORS.GOLD, 1);
    const label = this.add.text(GAME_WIDTH / 2, 112, text, { fontSize: '23px', color: '#fff3b0', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(951);
    this.tweens.add({ targets: [bg, label], alpha: 0, delay: 1500, duration: 500, onComplete: () => { bg.destroy(); label.destroy(); } });
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
      this.burstParticles(enemy.x, enemy.y, 8, 0x4de8ff);
      return;
    }
    const damage = enemy.contactDamage || (enemy.isBoss ? 22 : 10);
    player.hurt(damage, enemy.x);
  }

  handleBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    // 禁止从内殿外/山下远程狙击BOSS：必须实时站在竞技场内，攻击才生效
    if (enemy.isBoss && this.player.x < 4080) return;
    this.burstParticles(bullet.x, bullet.y, 8, 0x4488ff);
    bullet.destroy();
    this.damageEnemy(enemy, bullet.damage || 8);
  }

  collectOrb(_player, orb) {
    if (!orb.active) return;
    orb.destroy(); this.player.heal(15); sfx.play('collect');
    this.burstParticles(this.player.x, this.player.y - 18, 6, 0xfff0a8);
  }

  collectFood(_player, drop) {
    if (!drop.active) return;
    const data = drop.foodData;
    this.tweens.killTweensOf(drop); drop.destroy(); sfx.play('collect');
    this.burstParticles(this.player.x, this.player.y - 20, 6, 0xffd700);
    const hpGain = data.hp || 20;
    this.player.heal(hpGain);
    this.showLevelBanner(`🍱 ${data.label} → 恢复${hpGain}气血`);
  }

  damageEnemy(enemy, damage = 10) {
    if (!enemy || !enemy.active) return;
    // 统一安全阀：无论拳脚/剑气/杖法/技能AOE，玩家必须实时站在竞技场内才能伤到BOSS，
    // 防止在场外/山下对BOSS挂机输出（BOSS无法主动下山追击，必须公平对等）。
    if (enemy.isBoss && this.player.x < 4080) return;
    enemy.hp = typeof enemy.hp === 'number' ? enemy.hp : (enemy.isBoss ? 600 : 40);
    // BOSS 单次最大受伤 25，确保需要 24+ 下才能击败
    if (enemy.isBoss) damage = Math.min(damage, 25);
    enemy.hp -= damage;
    if (enemy.hp > 0) {
      sfx.play('enemy_hit');
      this.burstParticles(enemy.x, enemy.y, 6, enemy.isBoss ? 0xff6600 : 0xffd27a);
      if (enemy.isBoss) this.updateBossHPBar();
      return;
    }
    this.defeatEnemy(enemy);
  }

  defeatEnemy(enemy) {
    if (!enemy || !enemy.active) return;
    if (enemy.isBoss) { this.onBossDefeated(enemy); return; }
    this.burstParticles(enemy.x, enemy.y, 10, 0xffddaa);
    if (Math.random() < 0.3) {
      const foods = [
        { key: 'food_mantou', hp: 18, label: '素包子' },
        { key: 'food_tofu', hp: 22, label: '嵩山豆腐' },
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
  //  技能特效
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

  burstParticles(x, y, count, tint) {
    for (let i = 0; i < count; i++) {
      const bit = this.add.image(x, y, 'particle').setTint(tint).setAlpha(0.9);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(10, 34);
      this.tweens.add({ targets: bit, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0, duration: Phaser.Math.Between(180, 360), onComplete: () => bit.destroy() });
    }
  }

  // 在重生点位置显示光标信标
  showCheckpointBeacon(x, y) {
    // 通知横幅（延迟避免与习得技能横幅重叠）
    this.time.delayedCall(400, () => {
      this.showLevelBanner('⛳ 新重生点已设置！死亡后在此处复活');
    });
    // 金色光柱
    const beam = this.add.rectangle(x, y - 60, 10, 120, 0xffd700, 0.55).setDepth(48);
    this.tweens.add({ targets: beam, alpha: 0, scaleY: 0.2, y: y - 100, duration: 1800, ease: 'Sine.easeIn', onComplete: () => beam.destroy() });
    // 扩散光环
    const ring = this.add.circle(x, y, 8, 0xffd700, 0).setStrokeStyle(3, 0xffe066, 0.9).setDepth(48);
    this.tweens.add({ targets: ring, scaleX: 6, scaleY: 6, alpha: 0, duration: 1200, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    // 常驻小标记（绿色圆点+旗帜图标提示此处可复活）
    const dot = this.add.circle(x, y - 2, 5, 0x66ff88, 0.9).setDepth(48);
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
    const msg = this.respawnPoint.x > 100
      ? '💫 气运恢复，在方丈处重生！'
      : '💨 气运受损，回到山门！';
    this.showLevelBanner(msg);
  }

  finishLevel() {
    if (this.levelFinished) return;
    this.levelFinished = true;
    bus.emit(EVENTS.LEVEL_COMPLETE, { next: '华山' });

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setScrollFactor(0).setDepth(980);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🗺️ 嵩山通关！西岳华山，五峰险途在前！', {
      fontSize: '30px', color: '#fff1a6', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(981);

    this.player.setVelocity(0, 0); this.player.isTalking = true;

    this.time.delayedCall(1800, () => {
      music.stop();
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.HUASHAN);
      overlay.destroy(); text.destroy();
    });
  }

  // ──────────────────────────────────────────────────────────
  //  每帧更新
  // ──────────────────────────────────────────────────────────

  update() {
    this.player.update();
    const nearNpc = this.npc.update(this.player);

    // 动态生成小怪（最多3个同屏）
    this.updateEnemySpawns();

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;

      // 安全防护：无论冲锋/跳跃与否，BOSS 水平位置始终限制在竞技场范围内，
      // 防止攻击动作把它甩出台地边缘、掉入石阶间的空隙无限坠落重生。
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

      // BOSS 主动追击玩家
      if (enemy.isBoss && !enemy.isCharging && !enemy.isJumping) {
        const dx = this.player.x - enemy.x;
        if (Math.abs(dx) > 20) enemy.patrolDirection = dx > 0 ? 1 : -1;
      }

      // 远攻武僧 AI
      if (enemy.isRanged) {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const now = this.time.now;
        if (dist < 100) {
          const rd = enemy.x < this.player.x ? -1 : 1;
          enemy.setVelocityX(rd * enemy.patrolSpeed);
          enemy.setFlipX(rd < 0);
          return;
        }
        if (dist < 400 && now - enemy.lastShootTime > enemy.shootInterval) {
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

    // BOSS 跳跃落地检测
    if (this.boss && this.boss.active && this.boss.isJumping) {
      if (this.boss.jumpLanding && this.boss.body.blocked.down) {
        this.boss.isJumping = false;
        this.boss.jumpLanding = false;
        this.bossLandingImpact(this.boss);
      }
    }

    if (this.boss && this.boss.active && this.bossLabel) {
      this.bossLabel.setPosition(this.boss.x, this.boss.y - 52);
    }

    if (this.boss && this.boss.active && !this.bossEncounterShown && this.player.x >= 4080) {
      this.bossEncounterShown = true;
      this.showLevelBanner('🦯 禅杖僧王登场！集中精力！');
      this.showBossHPBar();
      this.lockBossArena();
    }

    if (this.boss && this.boss.active) {
      this.updateBossPhase();
      this.updateBossHPBar();
    }

    if (this.quizItems) {
      this.quizItems.getChildren().forEach((scroll) => {
        if (scroll._hint && !scroll._used) {
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, scroll.x, scroll.y);
          if (dist > 50) scroll._hint.setVisible(false);
        }
      });
    }

    if (this.player.y > 490) this.respawnPlayer();
    if (this.boss && this.boss.active && this.boss.y > 490) this.respawnBoss();

    if (!this.levelFinished) {
      const enemyNearby = this.enemies.getChildren().some((e) => e.active && Math.abs(e.x - this.player.x) < 280);
      const wantTheme = enemyNearby ? 'battle' : 'songshan';
      if (wantTheme !== this._musicTheme) { this._musicTheme = wantTheme; music.play(wantTheme); }
    }

    if (this.hud && this.hud.scene.isActive()) {
      this.hud.setLocation('🏯 嵩山·少林寺');
      this.hud.setHealth(this.player.hp, this.player.maxHp);
      this.hud.setWisdom(this.player.wisdomBonus, this.player.getCurrentAttack());

      if (this.quizUI && this.quizUI.isOpen) {
        this.hud.setHint('1-4 / A-D 作答');
      } else if (this.player.isTalking) {
        this.hud.setHint('F：继续对话');
      } else if (nearNpc && !this.npc.complete) {
        this.hud.setHint('靠近方丈，按 F 交谈');
      } else if (this.boss && this.boss.active && Math.abs(this.player.x - this.boss.x) < 450) {
        const ph = this.boss.phase;
        const hint = ph === 3 ? '💀 狂怒！躲禅杖横扫·X护体·C黄龙·J剑击'
                   : ph === 2 ? '⚡ 第二阶段！警惕冲锋与横扫·X护体·J剑击'
                   : '🦯 禅杖僧王！J 剑击 · C 黄龙震地 · X 护体';
        this.hud.setHint(hint);
      } else if (this.portalActive && Math.abs(this.player.x - this.portal.x) < 100) {
        this.hud.setHint('走进传送门，继续旅程！');
      } else if (this.awaitingStaffPickup) {
        this.hud.setHint('🦯 前往供杖台，拾取少林禅杖！');
      } else if (this.npc.complete && !this.bossDefeated) {
        this.hud.setHint('→ 登上石阶，前往少林内殿');
      } else if (this.quizItems && this.quizItems.getChildren().some((s) => !s._used && Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y) < 60)) {
        this.hud.setHint('📜 触碰答题卷获得智慧');
      } else if (this.player.skills[ITEMS.SKILL_YIJINJING]) {
        const wLabel = this.player.activeWeapon === 'sword' ? '⚔️太极剑' : this.player.activeWeapon === 'staff' ? '🦯少林禅杖' : '☯八卦掌';
        this.hud.setHint(`${wLabel} · Q切换 | J剑/杖/拳 | C黄龙 | V易筋经 | X护体`);
      } else {
        this.hud.setHint('J 攻击武僧  |  继续前进');
      }
    }
  }
}



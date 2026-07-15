// 华山关卡：东峰(朝阳) → 南峰(落雁) → 西峰(莲花，习白虎裂空) → 北峰(云台) → 中峰(玉女，战白虎剑仙) → 开启传送门
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

const HUASHAN_QUIZZES = [
  { q: '华山位于中国哪个省份？',        choices: ['陕西省', '山西省', '河南省', '甘肃省'], correct: 0 },
  { q: '华山是中国五岳中的哪岳？',      choices: ['西岳', '东岳', '南岳', '北岳'],        correct: 0 },
  { q: '华山五峰中最高的是哪一峰？',    choices: ['南峰', '东峰', '西峰', '北峰'],        correct: 0 },
  { q: '华山以何种地貌著称？',          choices: ['花岗岩险峰', '喀斯特溶洞', '丹霞地貌', '火山熔岩'], correct: 0 },
  { q: '相传"华山论剑"出自哪部小说？', choices: ['射雕英雄传', '天龙八部', '笑傲江湖', '倚天屠龙记'], correct: 0 },
];

export class HuashanScene extends Phaser.Scene {
  constructor() {
    super(SCENES.HUASHAN);
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
    this._musicTheme = 'huashan';

    if (this.scene.isActive(SCENES.HUD)) this.scene.stop(SCENES.HUD);
    this.scene.launch(SCENES.HUD);
    this.hud = this.scene.get(SCENES.HUD);

    music.play('huashan');

    this.physics.world.setBounds(0, 0, 6200, 520);
    const PLAY_H = GAME_HEIGHT - 80;
    this.cameras.main.setViewport(0, 0, GAME_WIDTH, PLAY_H);
    this.cameras.main.setBounds(0, 0, 6200, PLAY_H);

    this.createBackground();
    this.createPlatforms();
    this.createDecorations();
    this.createSummitZone();
    this.createParticles();

    this.player = new Player(this, 80, 390);
    this.player.syncSkills(skillSystem.getInventory());
    this.physics.add.collider(this.player, this.platforms);

    // 重生点初始在东峰入口，与剑圣对话后更新
    this.respawnPoint = { x: 80, y: 390 };

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.createEnemies();
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyOverlap, null, this);

    this.foodDrops = this.physics.add.group();
    this.physics.add.collider(this.foodDrops, this.platforms);
    this.physics.add.overlap(this.player, this.foodDrops, this.collectFood, null, this);

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
    });

    if (skillSystem.getInventory()[ITEMS.CRYSTAL_BAIHU]) {
      this.npc.setCompleted(true);
    }

    this.bossDefeated = !!skillSystem.getInventory()[ITEMS.HUASHAN_COMPLETE];
    if (this.bossDefeated) {
      this.activatePortal(false);
    } else {
      this.createBoss();
    }
  }

  // ──────────────────────────────────────────────────────────
  //  背景（晨曦花岗岩群峰）
  // ──────────────────────────────────────────────────────────

  createBackground() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.26, GAME_WIDTH, GAME_HEIGHT * 0.52, 0x2a2440, 1).setScrollFactor(0);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.75, GAME_WIDTH, GAME_HEIGHT * 0.5, 0x3a3050, 1).setScrollFactor(0);

    const far = this.add.graphics().setScrollFactor(0.1);
    far.fillStyle(0x4a4258, 1);
    far.beginPath();
    far.moveTo(-100, 540); far.lineTo(100, 250); far.lineTo(260, 400); far.lineTo(480, 190);
    far.lineTo(700, 380); far.lineTo(960, 210); far.lineTo(1220, 390); far.lineTo(1480, 180);
    far.lineTo(1740, 380); far.lineTo(2000, 200); far.lineTo(2280, 390); far.lineTo(2560, 220);
    far.lineTo(2860, 400); far.lineTo(3200, 180); far.lineTo(3600, 340); far.lineTo(4000, 200);
    far.lineTo(4400, 380); far.lineTo(4800, 220); far.lineTo(5200, 380); far.lineTo(5600, 150);
    far.lineTo(6000, 300); far.lineTo(6300, 540); far.closePath(); far.fillPath();

    const mid = this.add.graphics().setScrollFactor(0.3);
    mid.fillStyle(0x625a78, 1);
    mid.beginPath();
    mid.moveTo(-60, 540); mid.lineTo(120, 320); mid.lineTo(260, 440); mid.lineTo(480, 280);
    mid.lineTo(660, 440); mid.lineTo(900, 290); mid.lineTo(1130, 460); mid.lineTo(1380, 300);
    mid.lineTo(1600, 460); mid.lineTo(1860, 300); mid.lineTo(2120, 460); mid.lineTo(2400, 290);
    mid.lineTo(2680, 460); mid.lineTo(2960, 310); mid.lineTo(3200, 480); mid.lineTo(3500, 300);
    mid.lineTo(3800, 460); mid.lineTo(4100, 300); mid.lineTo(4400, 460); mid.lineTo(4700, 280);
    mid.lineTo(5000, 460); mid.lineTo(5300, 260); mid.lineTo(5600, 460); mid.lineTo(5900, 200);
    mid.lineTo(6300, 400); mid.closePath(); mid.fillPath();

    // 晨曦色带（东峰朝阳意象，随景深轻淡）
    const dawn = this.add.rectangle(700, 120, 1400, 200, 0xff8a5c, 0.10).setScrollFactor(0.15);
    this.tweens.add({ targets: dawn, alpha: { from: 0.06, to: 0.16 }, duration: 2600, yoyo: true, repeat: -1 });

    // 近景松林（扩展至6300px覆盖全部五峰）
    const near = this.add.graphics().setScrollFactor(0.6);
    near.fillStyle(0x232038, 1);
    for (let x = -50; x < 6300; x += 68) {
      near.fillTriangle(x, 540, x + 25, 430 - (x % 3) * 18, x + 50, 540);
      near.fillTriangle(x + 19, 540, x + 46, 412 - (x % 4) * 16, x + 73, 540);
    }

    for (let i = 0; i < 10; i++) {
      const cloud = this.add.container(Phaser.Math.Between(-100, 6200), Phaser.Math.Between(50, 170), [
        this.add.ellipse(-24, 4, 50, 27, 0xffffff, 0.16),
        this.add.ellipse(0, 0, 60, 33, 0xffffff, 0.16),
        this.add.ellipse(27, 6, 46, 24, 0xffffff, 0.16),
      ]);
      cloud.setScrollFactor(0.15);
      this.tweens.add({ targets: cloud, x: cloud.x + Phaser.Math.Between(130, 270), duration: Phaser.Math.Between(11000, 18000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  平台（花岗岩石阶，贯穿五峰）
  // ──────────────────────────────────────────────────────────

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();

    const addPlatform = (x, y, width) => {
      const tileCount = Math.ceil(width / 32);
      for (let i = 0; i < tileCount; i++) {
        this.platforms.create(x + i * 32 + 16, y, 'tile_granite');
      }
    };

    // ── 东峰·朝阳峰 (x 0~1200) ──
    addPlatform(0, 440, 1200);
    addPlatform(300, 340, 150);
    addPlatform(600, 270, 120);
    addPlatform(850, 200, 120);
    addPlatform(1050, 300, 120);

    // ── 南峰·落雁峰 (x 1200~2400，五峰最高，需持续攀升) ──
    addPlatform(1200, 440, 260);
    addPlatform(1550, 380, 110);
    addPlatform(1700, 330, 110);
    addPlatform(1850, 280, 110);
    addPlatform(2000, 230, 110);
    addPlatform(2150, 190, 220);

    // ── 西峰·莲花峰 (x 2400~3600，剑圣所在，习白虎裂空) ──
    addPlatform(2400, 400, 520);
    addPlatform(2950, 320, 120);
    addPlatform(3150, 260, 120);
    addPlatform(3350, 320, 120);

    // ── 北峰·云台峰 (x 3600~4800，云雾跳台) ──
    addPlatform(3600, 400, 200);
    addPlatform(3850, 340, 110);
    addPlatform(4050, 280, 110);
    addPlatform(4250, 220, 110);
    addPlatform(4450, 280, 110);
    addPlatform(4650, 340, 110);

    // ── 通往中峰·玉女峰的石阶 ──
    addPlatform(4850, 400, 90);
    addPlatform(5000, 360, 90);
    addPlatform(5150, 320, 90);
    addPlatform(5300, 280, 90);
    addPlatform(5450, 240, 90);
    addPlatform(5600, 200, 90);

    // 中峰主台地（x=5700~6200）
    addPlatform(5700, 165, 500);
  }

  // ──────────────────────────────────────────────────────────
  //  装饰（五峰指引牌 + 长空栈道）
  // ──────────────────────────────────────────────────────────

  createDecorations() {
    const peakSign = (x, y, text, color = '#ffd700') => {
      const sign = this.add.text(x, y, text, {
        fontSize: '22px', color, stroke: '#000000', strokeThickness: 4,
        backgroundColor: '#00000099', padding: { x: 10, y: 5 },
      }).setOrigin(0.5);
      this.tweens.add({ targets: sign, alpha: { from: 0.6, to: 1.0 }, duration: 1300, yoyo: true, repeat: -1 });
      return sign;
    };

    peakSign(120, 408, '🌄 东峰 · 朝阳峰');
    peakSign(1230, 408, '🪿 南峰 · 落雁峰（华山最高）');
    peakSign(2430, 368, '🌸 西峰 · 莲花峰');
    peakSign(3630, 368, '☁️ 北峰 · 云台峰');
    peakSign(4880, 368, '👧 中峰 · 玉女峰');

    // 长空栈道（西峰悬崖木栈道，纯装饰）
    const plank = this.add.graphics();
    plank.fillStyle(0x5a4020, 1);
    for (let x = 2820; x < 2940; x += 18) {
      plank.fillRect(x, 388, 14, 6);
    }
    plank.fillStyle(0x8b6914, 1);
    plank.fillRect(2818, 384, 126, 3);

    // 华山论剑石碑（西峰）
    const stele = this.add.graphics();
    stele.fillStyle(0x6a6468, 1);
    stele.fillRect(3060, 220, 20, 40);
    stele.fillStyle(0x8a848a, 1);
    stele.fillRect(3058, 216, 24, 6);
    this.add.text(3070, 236, '论\n剑', {
      fontSize: '10px', color: '#dedede', align: 'center', lineSpacing: 2,
    }).setOrigin(0.5);

    // 石灯笼
    const lanternX = [340, 1650, 2650, 3950, 5050];
    lanternX.forEach((lx) => {
      const rope = this.add.rectangle(lx, 295, 2, 26, 0x4a3020, 1);
      const lantern = this.add.circle(lx, 315, 8, 0xffcc66, 0.88);
      const glow = this.add.circle(lx, 315, 18, 0xffcc66, 0.14);
      this.tweens.add({ targets: [lantern, glow, rope], y: '+=4', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  中峰台地（Boss 区域）
  // ──────────────────────────────────────────────────────────

  createSummitZone() {
    // 玉女祠（中峰主殿）
    const shrine = this.add.graphics();
    shrine.fillStyle(0x5a4a5a, 1);
    shrine.fillRect(5940, 108, 14, 57); shrine.fillRect(6020, 108, 14, 57);
    shrine.fillStyle(0xcc8899, 1);
    shrine.fillRect(5928, 100, 118, 12);
    shrine.fillStyle(0x8e2a4a, 1);
    shrine.fillTriangle(5916, 108, 6060, 108, 5988, 68);

    // 供晶台（战后生成白虎晶）
    const altar = this.add.graphics();
    altar.fillStyle(0x8a8490, 1);
    altar.fillRect(5794, 148, 36, 30);
    altar.fillStyle(0xdedede, 1);
    altar.fillRect(5790, 144, 44, 8);
    altar.fillStyle(0xffffff, 0.22);
    altar.fillRect(5792, 146, 40, 4);

    // 香烟/云雾粒子
    for (let i = 0; i < 6; i++) {
      const smoke = this.add.circle(5988 + Phaser.Math.Between(-6, 6), 120 + i * 12, 3, 0xffffff, 0.35).setDepth(9);
      this.tweens.add({ targets: smoke, y: smoke.y - 30, alpha: 0, duration: 1200 + i * 200, repeat: -1, delay: i * 200 });
    }

    // 银白粒子光点
    for (let i = 0; i < 18; i++) {
      const sp = this.add.circle(Phaser.Math.Between(5700, 6180), Phaser.Math.Between(50, 160), Phaser.Math.Between(1, 2), 0xffffff, Phaser.Math.FloatBetween(0.25, 0.6));
      this.tweens.add({ targets: sp, alpha: { from: 0.1, to: 0.75 }, y: sp.y - Phaser.Math.Between(5, 12), duration: Phaser.Math.Between(800, 2000), yoyo: true, repeat: -1 });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  粒子
  // ──────────────────────────────────────────────────────────

  createParticles() {
    for (let i = 0; i < 32; i++) {
      const sp = this.add.circle(Phaser.Math.Between(0, 4000), Phaser.Math.Between(60, 440), Phaser.Math.Between(1, 2), 0xffe8cc, Phaser.Math.FloatBetween(0.2, 0.55));
      sp.setScrollFactor(0.35);
      this.tweens.add({ targets: sp, alpha: { from: 0.15, to: 0.7 }, y: sp.y - Phaser.Math.Between(5, 11), duration: Phaser.Math.Between(1000, 2200), yoyo: true, repeat: -1 });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  普通敌人（华山剑客，动态生成池，最多3个同屏）
  // ──────────────────────────────────────────────────────────

  createEnemies() {
    this.enemies = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group({ allowGravity: false });
    this.maxActiveEnemies = 3;
    this.lastSpawnTime = 0;

    // type: 'melee'=近攻  'heavy'=重装(红)  'ranged'=远攻投掷(蓝)
    // 注：每个出生点的 y 必须比其所在平台中心高出 40px 以上（即落在平台顶面之上留出
    // 安全下落间隙），否则敌人会直接卡进平台砖块内部，被物理引擎从下方弹出坠落消失。
    this.enemySpawnPool = [
      // ── 东峰 (x 300~1050) ──
      { x: 380,  y: 400, minX: 330,  maxX: 450,  type: 'melee',  spawned: false },
      { x: 640,  y: 230, minX: 600,  maxX: 710,  type: 'ranged', spawned: false },
      { x: 900,  y: 160, minX: 850,  maxX: 960,  type: 'heavy',  spawned: false },
      // ── 南峰 (x 1250~2350) ──
      { x: 1320, y: 400, minX: 1260, maxX: 1440, type: 'ranged', spawned: false },
      { x: 1600, y: 340, minX: 1560, maxX: 1650, type: 'melee',  spawned: false },
      { x: 1900, y: 240, minX: 1860, maxX: 1940, type: 'heavy',  spawned: false },
      { x: 2200, y: 150, minX: 2160, maxX: 2350, type: 'melee',  spawned: false },
      // ── 西峰 (x 2450~2900，NPC 前方留出安全区) ──
      { x: 2500, y: 360, minX: 2450, maxX: 2600, type: 'melee',  spawned: false },
      { x: 3000, y: 280, minX: 2960, maxX: 3060, type: 'ranged', spawned: false },
      { x: 3380, y: 280, minX: 3360, maxX: 3460, type: 'heavy',  spawned: false },
      // ── 北峰 (x 3650~4700，云台跳跃) ──
      { x: 3700, y: 360, minX: 3650, maxX: 3780, type: 'melee',  spawned: false },
      { x: 3900, y: 300, minX: 3860, maxX: 3950, type: 'ranged', spawned: false },
      { x: 4100, y: 240, minX: 4060, maxX: 4240, type: 'heavy',  spawned: false },
      { x: 4480, y: 240, minX: 4460, maxX: 4550, type: 'melee',  spawned: false },
      { x: 4680, y: 300, minX: 4660, maxX: 4750, type: 'ranged', spawned: false },
      // ── 中峰石阶守卫 (x 4850~5700) ──
      { x: 4900, y: 360, minX: 4850, maxX: 4980, type: 'heavy',  spawned: false },
      { x: 5200, y: 280, minX: 5150, maxX: 5280, type: 'ranged', spawned: false },
      { x: 5500, y: 200, minX: 5450, maxX: 5560, type: 'melee',  spawned: false },
    ];
  }

  spawnEnemyFromData(data) {
    const flash = this.add.circle(data.x, data.y, 20, 0xdedede, 0.55).setDepth(49);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2.6, duration: 340, onComplete: () => flash.destroy() });

    const e = this.enemies.create(data.x, data.y, 'swordsman_enemy');
    e.body.setSize(18, 34); e.body.setOffset(7, 10);
    e.setCollideWorldBounds(true);
    e.patrolMinX = data.minX; e.patrolMaxX = data.maxX;
    e.patrolDirection = 1;

    if (data.type === 'heavy') {
      e.hp = 50; e.patrolSpeed = 74; e.contactDamage = 18; e.isHeavy = true;
      e.setTint(0xff3300); e.setScale(1.18); e.setVelocityX(74);
    } else if (data.type === 'ranged') {
      e.hp = 30; e.patrolSpeed = 44; e.contactDamage = 8; e.isRanged = true;
      e.lastShootTime = 0; e.shootInterval = 2800;
      e.setTint(0x33bbff); e.setVelocityX(44);
    } else {
      e.hp = 40; e.patrolSpeed = 62; e.contactDamage = 10; e.setVelocityX(62);
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
  //  白虎剑仙 BOSS（三阶段）
  // ──────────────────────────────────────────────────────────

  createBoss() {
    const boss = this.enemies.create(5960, 100, 'huashan_boss');
    boss.body.setSize(22, 38); boss.body.setOffset(5, 8);
    boss.setCollideWorldBounds(true);
    boss.patrolMinX = 5720; boss.patrolMaxX = 6150;
    boss.patrolDirection = -1;
    boss.maxHp = 650; boss.hp = 650;
    boss.isBoss = true;
    boss.phase = 1; boss.contactDamage = 24;
    boss.patrolSpeed = 85;
    boss.lastChargeTime = 0; boss.lastProjectileTime = 0;
    boss.lastJumpTime = 0; boss.lastRoarTime = 0;
    boss.isCharging = false;
    boss.isJumping = false;
    boss.jumpLanding = false;
    boss.setVelocityX(-85);
    this.boss = boss;

    this.bossLabel = this.add.text(5960, 46, '🐯 白虎剑仙', {
      fontSize: '18px', color: '#dedede', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200);

    this.createBossHPBar();

    // 竞技场左侧封路墙（中峰台地入口）
    this.bossArenaWall = this.physics.add.staticImage(5688, 260, 'tile_granite');
    this.bossArenaWall.setVisible(false);
    this.bossArenaWall.body.setSize(20, 600);
    this.bossArenaWall.body.enable = false;
    this.physics.add.collider(this.player, this.bossArenaWall);
  }

  createBossHPBar() {
    const cx = GAME_WIDTH / 2, barW = 280, barY = 56;
    this.bossHPBG = this.add.rectangle(cx, barY, barW + 6, 22, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(955).setStrokeStyle(2, 0xdedede, 1).setVisible(false).setAlpha(0);
    this.bossHPFill = this.add.rectangle(cx - barW / 2, barY, barW, 14, 0xb0b8c0, 1)
      .setScrollFactor(0).setDepth(956).setOrigin(0, 0.5).setVisible(false).setAlpha(0);
    this.bossHPName = this.add.text(cx, barY - 15, '🐯 白虎剑仙  第一阶段', {
      fontSize: '13px', color: '#dedede', stroke: '#000000', strokeThickness: 3,
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
    const cols = { 1: 0xb0b8c0, 2: 0xdd8899, 3: 0xcc0033 };
    this.bossHPFill.setFillStyle(cols[this.boss.phase] || 0xb0b8c0, 1);
  }

  destroyBossHPBar() {
    [this.bossHPBG, this.bossHPFill, this.bossHPName, this.bossHPPercent].forEach((el) => { if (el) el.destroy(); });
    this.bossHPBG = this.bossHPFill = this.bossHPName = this.bossHPPercent = null;
  }

  lockBossArena() {
    if (this.bossArenaWall) { this.bossArenaWall.body.enable = true; this.bossArenaWall.refreshBody(); }
    const flash = this.add.rectangle(5690, 160, 16, 320, 0xdedede, 0.85).setDepth(300);
    this.tweens.add({ targets: flash, alpha: 0, scaleY: 1.6, duration: 700, onComplete: () => flash.destroy() });
    const msg = this.add.text(5840, 96, '⚠️ 白虎剑仙！退路已封！', {
      fontSize: '16px', color: '#dedede', stroke: '#000', strokeThickness: 3, backgroundColor: '#00000099', padding: { x: 6, y: 3 },
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

    const jumpInterval = boss.phase === 3 ? 2800 : boss.phase === 2 ? 4200 : 6000;
    if (!boss.isCharging && !boss.isJumping && now - boss.lastJumpTime > jumpInterval) {
      boss.lastJumpTime = now;
      this.bossJumpAttack(boss);
    }

    if (boss.phase >= 2 && !boss.isCharging && !boss.isJumping) {
      const interval = boss.phase === 3 ? 2000 : 3200;
      if (now - boss.lastChargeTime > interval) { boss.lastChargeTime = now; this.bossCharge(boss); }
    }

    // 白虎咆哮（第三阶段，原地AOE冲击波，无需瞄准）
    if (boss.phase === 3 && !boss.isCharging && !boss.isJumping && now - boss.lastRoarTime > 3400) {
      boss.lastRoarTime = now;
      this.bossTigerRoar(boss);
    }
  }

  onBossPhaseChange(boss, phase) {
    if (phase === 2) {
      boss.patrolSpeed = 128; boss.contactDamage = 33; boss.setTint(0xdd8899);
      if (this.bossHPName) this.bossHPName.setText('🐯 白虎剑仙  ⚡ 第二阶段').setStyle({ color: '#dd8899' });
      if (this.bossHPBG) this.bossHPBG.setStrokeStyle(2, 0xdd8899, 1);
      this.showLevelBanner('⚡ 白虎剑仙·剑气暴涨！');
      this.burstParticles(boss.x, boss.y, 18, 0xdedede);
      this.cameras.main.shake(300, 0.009); this.cameras.main.flash(180, 255, 255, 255, true);
    } else if (phase === 3) {
      boss.patrolSpeed = 168; boss.contactDamage = 46; boss.setTint(0xcc0033);
      if (this.bossHPName) this.bossHPName.setText('🐯 白虎剑仙  💀 狂啸').setStyle({ color: '#ff4466' });
      if (this.bossHPBG) this.bossHPBG.setStrokeStyle(2, 0xcc0033, 1);
      this.showLevelBanner('💀 白虎剑仙·虎啸山崩！极度危险！');
      this.burstParticles(boss.x, boss.y, 28, 0xcc0033);
      this.cameras.main.shake(500, 0.018); this.cameras.main.flash(280, 255, 255, 255, true);
    }
  }

  bossCharge(boss) {
    if (!boss || !boss.active || !this.player) return;
    boss.isCharging = true;
    const dir = this.player.x > boss.x ? 1 : -1;
    const spd = boss.phase === 3 ? 360 : 260;
    boss.setVelocityX(dir * spd); boss.setFlipX(dir < 0);
    const warn = this.add.text(boss.x, boss.y - 62, '⚔️ 剑气冲！', {
      fontSize: '17px', color: '#dedede', stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 500, onComplete: () => warn.destroy() });
    this.time.delayedCall(620, () => { if (boss && boss.active) boss.isCharging = false; });
  }

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
    const warn = this.add.text(boss.x, boss.y - 72, '⬆ 飞身斩！', {
      fontSize: '18px', color: '#ffdd66', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 500, onComplete: () => warn.destroy() });
    this.time.delayedCall(300, () => { if (boss && boss.active) boss.jumpLanding = true; });
  }

  bossLandingImpact(boss) {
    this.cameras.main.shake(260, 0.011);
    this.burstParticles(boss.x, boss.y + 14, 18, 0xdedede);
    const ring = this.add.circle(boss.x, boss.y + 14, 8, 0xb0b8c0, 0)
      .setStrokeStyle(3, 0xdedede, 0.9).setDepth(52);
    this.tweens.add({ targets: ring, scaleX: 8, scaleY: 4, alpha: 0, duration: 400, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
    if (dist < 95) {
      if (this.player.isGuarding()) {
        this.player.flashGuardSuccess();
      } else {
        this.player.hurt(boss.phase >= 3 ? 26 : 20, boss.x);
        this.showLevelBanner('💥 飞身斩重击！');
      }
    }
    boss.setVelocityX(0);
  }

  // 白虎咆哮（第三阶段，原地环形冲击波，全方位判定）
  bossTigerRoar(boss) {
    if (!boss || !boss.active || !this.player) return;
    const radius = 160;

    const warn = this.add.text(boss.x, boss.y - 62, '🐯 虎啸山崩！', {
      fontSize: '18px', color: '#ff4466', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 24, duration: 560, onComplete: () => warn.destroy() });

    const ring = this.add.circle(boss.x, boss.y, 10, 0xcc0033, 0).setStrokeStyle(4, 0xffffff, 0.9).setDepth(53);
    this.tweens.add({ targets: ring, scale: radius / 10, alpha: 0, duration: 460, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const ring2 = this.add.circle(boss.x, boss.y, 6, 0xcc0033, 0).setStrokeStyle(2, 0xdedede, 0.7).setDepth(53);
    this.tweens.add({ targets: ring2, scale: radius / 6 * 1.3, alpha: 0, duration: 620, ease: 'Cubic.easeOut', onComplete: () => ring2.destroy() });

    this.cameras.main.shake(300, 0.01);

    this.time.delayedCall(150, () => {
      if (!boss.active) return;
      const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
      if (dist < radius) {
        if (this.player.isGuarding()) {
          this.player.flashGuardSuccess();
        } else {
          this.player.hurt(24, boss.x);
          this.showLevelBanner('🐯 虎啸命中！');
        }
      }
    });
  }

  enemyShootProjectile(enemy) {
    if (!enemy || !enemy.active || !this.player) return;
    const dir = this.player.x > enemy.x ? 1 : -1;
    const proj = this.physics.add.image(enemy.x + dir * 18, enemy.y - 10, 'bagua_orb');
    proj.setTint(0x33bbff);
    proj.setScale(0.85);
    proj.damage = 12;
    proj.body.setAllowGravity(false);
    proj.body.setVelocity(dir * 210, 0);
    if (this.enemyProjectiles) this.enemyProjectiles.add(proj);
    this.tweens.add({ targets: proj, angle: dir > 0 ? 360 : -360, duration: 500, repeat: -1 });

    const warn = this.add.text(enemy.x, enemy.y - 30, '⚡', {
      fontSize: '14px', color: '#33bbff',
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 14, duration: 380, onComplete: () => warn.destroy() });

    this.time.delayedCall(2200, () => { if (proj && proj.active) proj.destroy(); });
  }

  handleEnemyProjectileHit(player, proj) {
    if (!proj.active) return;
    this.burstParticles(proj.x, proj.y, 8, 0x33bbff);
    proj.destroy();
    if (player.isGuarding()) {
      player.flashGuardSuccess();
    } else {
      player.hurt(proj.damage || 12, proj.x);
    }
  }

  respawnBoss() {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    boss.setPosition(5960, 100); boss.setVelocity(0, 0);
    boss.isCharging = false;
    boss.isJumping = false;
    boss.jumpLanding = false;
    boss.patrolDirection = -1;
    boss.setVelocityX(-boss.patrolSpeed);
    if (boss.phase === 3) boss.setTint(0xcc0033);
    else if (boss.phase === 2) boss.setTint(0xdd8899);
    else boss.clearTint();
  }

  // ──────────────────────────────────────────────────────────
  //  Boss 击败
  // ──────────────────────────────────────────────────────────

  onBossDefeated(boss) {
    this.burstParticles(boss.x, boss.y, 30, 0xffffff);
    this.burstParticles(boss.x, boss.y, 18, 0xdedede);
    this.burstParticles(boss.x, boss.y, 10, 0xcc0033);
    this.cameras.main.shake(400, 0.012);
    boss.destroy();
    this.bossDefeated = true;
    this.boss = null;
    if (this.bossLabel) { this.bossLabel.destroy(); this.bossLabel = null; }
    this.destroyBossHPBar();
    if (this.bossArenaWall) this.bossArenaWall.body.enable = false;
    skillSystem.collect(ITEMS.HUASHAN_COMPLETE);
    this.showLevelBanner('🐯 白虎剑仙已败！');
    this.time.delayedCall(1200, () => this.spawnCrystalPickup());
  }

  // 供晶台生成白虎晶（战后拾取物，位于玉女祠供晶台上方）
  spawnCrystalPickup() {
    this.awaitingCrystalPickup = true;
    const sx = 5812, sy = 108;
    const crystal = this.physics.add.staticImage(sx, sy, 'crystal_baihu');
    crystal.setDepth(10);
    this.tweens.add({ targets: crystal, y: sy - 12, angle: 360, duration: 1600, repeat: -1, ease: 'Sine.easeInOut' });

    const glow = this.add.circle(sx, sy, 24, 0xdedede, 0.2).setDepth(9);
    this.tweens.add({ targets: glow, alpha: { from: 0.08, to: 0.45 }, scale: { from: 0.9, to: 1.3 }, duration: 750, yoyo: true, repeat: -1 });

    const hint = this.add.text(sx, sy - 40, '🐯 白虎晶', { fontSize: '18px', color: '#dedede', stroke: '#000000', strokeThickness: 3, backgroundColor: '#00000088', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: hint, y: '+=5', duration: 900, yoyo: true, repeat: -1 });

    this.physics.add.overlap(this.player, crystal, () => {
      if (!crystal.active) return;
      crystal.destroy(); glow.destroy(); hint.destroy();
      this.awaitingCrystalPickup = false;
      if (skillSystem.collect(ITEMS.CRYSTAL_BAIHU)) {
        this.showLevelBanner('🐯 白虎晶已获得！气运更盛！');
      }
      this.time.delayedCall(700, () => this.showVictoryDialogue());
    });
  }

  showVictoryDialogue() {
    const lines = [
      '旁白：「白虎剑仙一败涂地，西岳气运碎片终于集齐！」',
      '旁白：「五岳之中，已收东岳、南岳、中岳、西岳气运……」',
      '地图：「唯余北岳恒山，五岳归一，蛟龙之秘可解！」',
      '✅ 华山完成！前往传送门继续旅程。',
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
      [640, 220], [900, 150], [1650, 330], [2000, 180],
      [2600, 350], [3150, 210], [3850, 290], [4250, 170], [4650, 290],
      [5150, 270], [5450, 190],
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
      '剑圣：「小北，西峰莲花之上，老朽已候多时。」',
      '剑圣：「你携太极剑与少林禅杖，气运已成，然独缺西岳白虎之力。」',
      '剑圣：「白虎晶蛰伏于你体内已久——运功时（N键），可发白虎裂空，扑袭强敌！」',
      '剑圣：「中峰玉女祠中，白虎剑仙镇守气运碎片，剑法通神，不可小觑。」',
      '剑圣：「记住：华山之险，在峰不在剑；心定则剑随，气盛则势成！」',
      '✅ 白虎裂空已习得！前进，直上中峰！',
    ];

    this.npc = new NPC(this, 2650, 360, 'npc_swordsage', dialogues, () => {
      if (skillSystem.collect(ITEMS.CRYSTAL_BAIHU)) {
        this.showLevelBanner('🐯 白虎裂空已解锁！→ 直上中峰');
      }
      // 与剑圣对话完毕，设置新重生点
      // 西峰地面平台中心 y=400（顶面 y=384），比东/南峰地面（y=440）高出40px，
      // 重生点须相应抬高，否则玩家会摔入地面砖块内部被弹出坠落。
      this.respawnPoint = { x: 2560, y: 350 };
      this.showCheckpointBeacon(2560, 350);
    }, '剑圣');

    this.portalGlow = this.add.ellipse(6120, 106, 40, 76, COLORS.TEAL, 0.18).setVisible(false);
    this.portal = this.physics.add.staticImage(6120, 106, 'portal_frame');
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
    const positions = [[450, 408], [1000, 408], [1750, 408], [2900, 380], [4400, 250]];

    positions.forEach(([x, y], i) => {
      const scroll = this.quizItems.create(x, y, 'quiz_scroll');
      scroll.quizIndex = i % HUASHAN_QUIZZES.length;
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
      const qData = HUASHAN_QUIZZES[scroll.quizIndex];
      this.quizUI.open(qData.q, qData.choices, qData.correct, (correct) => {
        player.isTalking = false;
        if (correct) { this.player.addWisdomBuff(20); this.showLevelBanner('📖 智慧+20 → 攻击提升！'); this.burstParticles(this.player.x, this.player.y - 24, 12, 0xffd700); }
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
    const damage = enemy.contactDamage || (enemy.isBoss ? 24 : 10);
    player.hurt(damage, enemy.x);
  }

  handleBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    // 禁止从中峰台地外/山下远程狙击BOSS：必须实时站在竞技场内，攻击才生效
    if (enemy.isBoss && this.player.x < 5700) return;
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
    this.showLevelBanner(`🍑 ${data.label} → 恢复${hpGain}气血`);
  }

  damageEnemy(enemy, damage = 10) {
    if (!enemy || !enemy.active) return;
    // 统一安全阀：无论拳脚/剑气/白虎裂空/技能AOE，玩家必须实时站在竞技场内才能伤到BOSS，
    // 防止在场外/山下对BOSS挂机输出（BOSS无法主动下山追击，必须公平对等）。
    if (enemy.isBoss && this.player.x < 5700) return;
    enemy.hp = typeof enemy.hp === 'number' ? enemy.hp : (enemy.isBoss ? 650 : 40);
    // BOSS 单次最大受伤 25，确保需要较多次攻击才能击败
    if (enemy.isBoss) damage = Math.min(damage, 25);
    enemy.hp -= damage;
    if (enemy.hp > 0) {
      sfx.play('enemy_hit');
      this.burstParticles(enemy.x, enemy.y, 6, enemy.isBoss ? 0xdedede : 0xffd27a);
      if (enemy.isBoss) this.updateBossHPBar();
      return;
    }
    this.defeatEnemy(enemy);
  }

  defeatEnemy(enemy) {
    if (!enemy || !enemy.active) return;
    if (enemy.isBoss) { this.onBossDefeated(enemy); return; }
    this.burstParticles(enemy.x, enemy.y, 10, 0xdedede);
    if (Math.random() < 0.3) {
      const foods = [
        { key: 'food_shizi', hp: 22, label: '火晶柿子' },
        { key: 'food_ganmian', hp: 20, label: '热干面' },
        { key: 'food_lotus', hp: 30, label: '莲藕排骨汤' },
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

  // 白虎裂空特效 + 伤害（N键，扑击式直线突进）
  baihuStrike(x, y, dir, range, height, damage) {
    const cx = x + dir * range * 0.5;
    const claw = this.add.rectangle(cx, y - 6, range, height, 0xdedede, 0.3).setDepth(52).setStrokeStyle(3, 0xffffff, 0.85);
    this.tweens.add({ targets: claw, alpha: 0, scaleX: 1.4, scaleY: 1.5, duration: 340, ease: 'Cubic.easeOut', onComplete: () => claw.destroy() });
    // 三道虎爪痕
    for (let i = 0; i < 3; i++) {
      const offsetY = (i - 1) * 14;
      const slash = this.add.rectangle(cx, y - 6 + offsetY, range * 0.9, 6, 0xffffff, 0.8)
        .setDepth(53).setRotation(dir > 0 ? 0.12 : -0.12);
      this.tweens.add({ targets: slash, alpha: 0, scaleX: 1.3, duration: 260, onComplete: () => slash.destroy() });
    }
    for (let i = 0; i < 10; i++) {
      const bit = this.add.circle(x + dir * Phaser.Math.Between(10, range), y + Phaser.Math.Between(-height * 0.4, height * 0.4), Phaser.Math.Between(3, 7), 0xdedede, 0.85).setDepth(53);
      this.tweens.add({ targets: bit, alpha: 0, x: bit.x + dir * Phaser.Math.Between(20, 60), duration: Phaser.Math.Between(200, 400), onComplete: () => bit.destroy() });
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
    const beam = this.add.rectangle(x, y - 60, 10, 120, 0xffd700, 0.55).setDepth(48);
    this.tweens.add({ targets: beam, alpha: 0, scaleY: 0.2, y: y - 100, duration: 1800, ease: 'Sine.easeIn', onComplete: () => beam.destroy() });
    const ring = this.add.circle(x, y, 8, 0xffd700, 0).setStrokeStyle(3, 0xffe066, 0.9).setDepth(48);
    this.tweens.add({ targets: ring, scaleX: 6, scaleY: 6, alpha: 0, duration: 1200, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
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
      ? '💫 气运恢复，在剑圣处重生！'
      : '💨 气运受损，回到东峰！';
    this.showLevelBanner(msg);
  }

  finishLevel() {
    if (this.levelFinished) return;
    this.levelFinished = true;
    bus.emit(EVENTS.LEVEL_COMPLETE, { next: '恒山' });

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setScrollFactor(0).setDepth(980);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🗺️ 华山通关！北岳恒山，敬请期待！', {
      fontSize: '30px', color: '#fff1a6', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(981);

    this.player.setVelocity(0, 0); this.player.isTalking = true;

    this.time.delayedCall(1800, () => {
      music.stop();
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.MENU);
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

    if (this.boss && this.boss.active && !this.bossEncounterShown && this.player.x >= 5700) {
      this.bossEncounterShown = true;
      this.showLevelBanner('🐯 白虎剑仙登场！集中精力！');
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
      const wantTheme = enemyNearby ? 'battle' : 'huashan';
      if (wantTheme !== this._musicTheme) { this._musicTheme = wantTheme; music.play(wantTheme); }
    }

    if (this.hud && this.hud.scene.isActive()) {
      this.hud.setLocation('⛰️ 华山');
      this.hud.setHealth(this.player.hp, this.player.maxHp);
      this.hud.setWisdom(this.player.wisdomBonus, this.player.getCurrentAttack());

      if (this.quizUI && this.quizUI.isOpen) {
        this.hud.setHint('1-4 / A-D 作答');
      } else if (this.player.isTalking) {
        this.hud.setHint('F：继续对话');
      } else if (nearNpc && !this.npc.complete) {
        this.hud.setHint('靠近剑圣，按 F 交谈');
      } else if (this.boss && this.boss.active && Math.abs(this.player.x - this.boss.x) < 450) {
        const ph = this.boss.phase;
        const hint = ph === 3 ? '💀 狂啸！躲虎啸·X护体·N白虎·J攻击'
                   : ph === 2 ? '⚡ 第二阶段！警惕冲锋·X护体·J攻击'
                   : '🐯 白虎剑仙！J 攻击 · N 白虎裂空 · X 护体';
        this.hud.setHint(hint);
      } else if (this.portalActive && Math.abs(this.player.x - this.portal.x) < 100) {
        this.hud.setHint('走进传送门，继续旅程！');
      } else if (this.awaitingCrystalPickup) {
        this.hud.setHint('🐯 前往供晶台，拾取白虎晶！');
      } else if (this.npc.complete && !this.bossDefeated) {
        this.hud.setHint('→ 翻越云台，直上中峰');
      } else if (this.quizItems && this.quizItems.getChildren().some((s) => !s._used && Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y) < 60)) {
        this.hud.setHint('📜 触碰答题卷获得智慧');
      } else if (this.player.skills[ITEMS.CRYSTAL_BAIHU]) {
        const wLabel = this.player.activeWeapon === 'sword' ? '⚔️太极剑' : this.player.activeWeapon === 'staff' ? '🦯少林禅杖' : '☯八卦掌';
        this.hud.setHint(`${wLabel} · Q切换 | J攻击 | N白虎裂空 | X护体`);
      } else {
        this.hud.setHint('J 攻击剑客  |  继续前进');
      }
    }
  }
}



// 武当山关卡：山脚战斗 → 见张三丰习太极拳 → 武当金顶战大将军 → 得太极八卦剑 → 开启传送门
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

const WUDANG_QUIZZES = [
  {
    q: '武当山位于中国哪个省份？',
    choices: ['湖北省', '湖南省', '四川省', '陕西省'],
    correct: 0,
  },
  {
    q: '武当山最高峰叫什么名字？',
    choices: ['天柱峰', '莲花峰', '华顶峰', '主峰'],
    correct: 0,
  },
  {
    q: '武当太极拳相传由谁创立？',
    choices: ['张三丰', '岳飞', '霍元甲', '达摩'],
    correct: 0,
  },
  {
    q: '武汉热干面最重要的调料是什么？',
    choices: ['芝麻酱', '花生酱', '豆瓣酱', '辣椒酱'],
    correct: 0,
  },
  {
    q: '武当山是哪个朝代大规模扩建的？',
    choices: ['明朝', '唐朝', '宋朝', '清朝'],
    correct: 0,
  },
];

export class WudangScene extends Phaser.Scene {
  constructor() {
    super(SCENES.WUDANG);
  }

  create() {
    this.portalActive = false;
    this.levelFinished = false;
    this.bossDefeated = false;
    this.bossEncounterShown = false;
    this.boss = null;
    this.bossLabel = null;
    this._musicTheme = 'wudang';

    if (this.scene.isActive(SCENES.HUD)) {
      this.scene.stop(SCENES.HUD);
    }
    this.scene.launch(SCENES.HUD);
    this.hud = this.scene.get(SCENES.HUD);

    music.play('wudang');

    // 扩展世界至 4800px 以容纳武当金顶区域
    this.physics.world.setBounds(0, 0, 4800, 520);
    const PLAY_H = GAME_HEIGHT - 80;
    this.cameras.main.setViewport(0, 0, GAME_WIDTH, PLAY_H);
    this.cameras.main.setBounds(0, 0, 4800, PLAY_H);

    this.createBackground();
    this.createPlatforms();
    this.createDecorations();
    this.createGoldenSummit();
    this.createParticles();

    this.player = new Player(this, 80, 390);
    this.player.syncSkills(skillSystem.getInventory());
    this.physics.add.collider(this.player, this.platforms);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.createEnemies();
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyOverlap, null, this);

    this.foodDrops = this.physics.add.group();
    this.physics.add.collider(this.foodDrops, this.platforms);
    this.physics.add.overlap(this.player, this.foodDrops, this.collectFood, null, this);

    this.playerBullets = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.playerBullets, this.enemies, this.handleBulletHit, null, this);

    this.createEnergyOrbs();
    this.physics.add.overlap(this.player, this.energyOrbs, this.collectOrb, null, this);

    this.createNpcAndPortal();
    this.quizUI = new QuizUI(this);
    this.createQuizItems();
    this.showControlsReminder();

    // 地图对话框（BOSS战后展示五岳线索）
    this.mapDialogue = new DialogueBox(this);

    this.onItemCollected = ({ inventory }) => {
      this.player.syncSkills(inventory);
    };

    this.onCrystalSkill = ({ x, y, range, damage }) => {
      this.zhuqueBlast(x, y, range);
      this.showLevelBanner('🔥 朱雀烈焰！');
      this.enemies.getChildren().forEach((enemy) => {
        if (!enemy.active) return;
        const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
        if (dist < range) {
          this.damageEnemy(enemy, damage);
        }
      });
    };

    bus.on(EVENTS.ITEM_COLLECTED, this.onItemCollected);
    bus.on(EVENTS.CRYSTAL_SKILL, this.onCrystalSkill);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off(EVENTS.ITEM_COLLECTED, this.onItemCollected);
      bus.off(EVENTS.CRYSTAL_SKILL, this.onCrystalSkill);
      this.quizUI?.destroy();
    });

    // 检查本次会话进度
    if (skillSystem.getInventory()[ITEMS.SKILL_TAIJI]) {
      this.npc.setCompleted(true);
    }

    // 若已拿到太极八卦剑，跳过BOSS直接激活传送门
    this.bossDefeated = skillSystem.getInventory()[ITEMS.TAIJI_SWORD];
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
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.25, GAME_WIDTH, GAME_HEIGHT * 0.5, COLORS.SKY_TOP, 1).setScrollFactor(0);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.75, GAME_WIDTH, GAME_HEIGHT * 0.5, COLORS.SKY_BOT, 1).setScrollFactor(0);

    const far = this.add.graphics().setScrollFactor(0.1);
    far.fillStyle(COLORS.MOUNTAIN_FAR, 1);
    far.beginPath();
    far.moveTo(-200, 540);
    far.lineTo(100, 260); far.lineTo(280, 420); far.lineTo(520, 230);
    far.lineTo(760, 420); far.lineTo(1020, 250); far.lineTo(1260, 430);
    far.lineTo(1520, 260); far.lineTo(1780, 420); far.lineTo(2040, 230);
    far.lineTo(2300, 430); far.lineTo(2560, 260); far.lineTo(2820, 420);
    far.lineTo(3200, 200); far.lineTo(3600, 310); far.lineTo(4000, 170); // 金顶山峰
    far.lineTo(4400, 320); far.lineTo(4800, 210); far.lineTo(5000, 540);
    far.closePath();
    far.fillPath();

    const mid = this.add.graphics().setScrollFactor(0.3);
    mid.fillStyle(COLORS.MOUNTAIN_MID, 1);
    mid.beginPath();
    mid.moveTo(-100, 540);
    mid.lineTo(120, 320); mid.lineTo(260, 460); mid.lineTo(480, 290);
    mid.lineTo(660, 450); mid.lineTo(900, 280); mid.lineTo(1120, 470);
    mid.lineTo(1370, 300); mid.lineTo(1600, 470); mid.lineTo(1830, 290);
    mid.lineTo(2060, 470); mid.lineTo(2320, 300); mid.lineTo(2580, 470);
    mid.lineTo(2820, 320); mid.lineTo(3200, 520);
    mid.lineTo(3500, 380); mid.lineTo(3800, 520);
    mid.lineTo(4100, 270); // 金顶山脊
    mid.lineTo(4400, 480); mid.lineTo(4800, 330); mid.lineTo(5000, 520);
    mid.closePath();
    mid.fillPath();

    mid.fillStyle(0x1d2438, 1);
    mid.fillRect(520, 330, 22, 70);
    mid.fillTriangle(500, 340, 562, 340, 531, 312);
    mid.fillTriangle(506, 318, 556, 318, 531, 294);
    mid.fillRect(2060, 340, 20, 64);
    mid.fillTriangle(2040, 350, 2100, 350, 2070, 324);

    // 近景树木延伸至 4800px 覆盖金顶区域
    const near = this.add.graphics().setScrollFactor(0.6);
    near.fillStyle(0x17351e, 1);
    for (let x = -50; x < 5000; x += 70) {
      near.fillTriangle(x, 540, x + 26, 430 - (x % 3) * 20, x + 52, 540);
      near.fillTriangle(x + 20, 540, x + 48, 410 - (x % 4) * 18, x + 76, 540);
    }

    for (let i = 0; i < 10; i += 1) {
      const cloud = this.add.container(Phaser.Math.Between(-100, 4800), Phaser.Math.Between(60, 180), [
        this.add.ellipse(-24, 4, 50, 28, 0xffffff, 0.16),
        this.add.ellipse(0, 0, 60, 34, 0xffffff, 0.16),
        this.add.ellipse(28, 6, 46, 24, 0xffffff, 0.16),
      ]);
      cloud.setScrollFactor(0.15);
      this.tweens.add({
        targets: cloud,
        x: cloud.x + Phaser.Math.Between(140, 280),
        duration: Phaser.Math.Between(10000, 17000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  平台
  // ──────────────────────────────────────────────────────────

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();

    const addPlatform = (x, y, width) => {
      const tileCount = Math.ceil(width / 32);
      for (let i = 0; i < tileCount; i += 1) {
        this.platforms.create(x + i * 32 + 16, y, 'tile_platform');
      }
    };

    // 山脚地面（含断崖）
    addPlatform(0, 440, 1600);
    addPlatform(1800, 440, 1400);

    // 中段跳跃平台
    addPlatform(300, 340, 150);
    addPlatform(600, 270, 120);
    addPlatform(850, 200, 120);
    addPlatform(1100, 290, 180);
    addPlatform(1350, 230, 120);
    addPlatform(1900, 340, 150);
    addPlatform(2100, 260, 200);
    addPlatform(2300, 360, 64);
    addPlatform(2380, 328, 64);
    addPlatform(2460, 296, 64);
    addPlatform(2540, 264, 64);
    addPlatform(2620, 232, 64);
    addPlatform(2640, 200, 160);
    addPlatform(2820, 160, 140);
    addPlatform(2980, 200, 140);

    // 通往武当金顶的石阶
    addPlatform(3250, 400, 96);   // 第一阶
    addPlatform(3400, 360, 96);   // 第二阶
    addPlatform(3550, 320, 96);   // 第三阶
    addPlatform(3700, 280, 96);   // 第四阶
    addPlatform(3850, 240, 96);   // 第五阶
    addPlatform(4000, 200, 96);   // 第六阶

    // 武当金顶主台地（x=4100~4820）
    addPlatform(4100, 160, 720);
  }

  // ──────────────────────────────────────────────────────────
  //  装饰
  // ──────────────────────────────────────────────────────────

  createDecorations() {
    // 道观（中段）
    const temple = this.add.graphics();
    temple.fillStyle(0x6b4226, 1);
    temple.fillRect(2140, 182, 10, 78);
    temple.fillRect(2210, 182, 10, 78);
    temple.fillStyle(0x8e2a2a, 1);
    temple.fillTriangle(2120, 190, 2238, 190, 2179, 160);
    temple.fillStyle(0xd4b26a, 1);
    temple.fillRect(2164, 208, 24, 22);

    // 张三丰神祠
    const shrine = this.add.graphics();
    shrine.fillStyle(0x6b4226, 1);
    shrine.fillRect(2860, 342, 10, 64);
    shrine.fillRect(2926, 342, 10, 64);
    shrine.fillStyle(0xa83232, 1);
    shrine.fillTriangle(2840, 352, 2956, 352, 2898, 324);

    const lanternPositions = [2870, 2920, 2970];
    lanternPositions.forEach((x) => {
      const rope = this.add.rectangle(x, 312, 2, 26, 0x5a3a14, 1);
      const lantern = this.add.circle(x, 332, 8, 0xff9f43, 0.9);
      const glow = this.add.circle(x, 332, 18, 0xff9f43, 0.15);
      this.tweens.add({
        targets: [lantern, glow, rope],
        y: '+=4',
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // 通往金顶的指引牌
    const sign = this.add.text(3130, 362, '↗ 武当金顶', {
      fontSize: '22px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 4,
      backgroundColor: '#00000099',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: sign, alpha: { from: 0.6, to: 1.0 }, duration: 1300, yoyo: true, repeat: -1 });
  }

  // ──────────────────────────────────────────────────────────
  //  武当金顶台地建筑与特效
  // ──────────────────────────────────────────────────────────

  createGoldenSummit() {
    // 金顶大门（台地入口 x≈4100）
    const gate = this.add.graphics();
    gate.fillStyle(0x8b6914, 1);
    gate.fillRect(4086, 44, 14, 116);    // 左柱
    gate.fillRect(4118, 44, 14, 116);    // 右柱
    gate.fillStyle(0xdaa520, 1);
    gate.fillRect(4080, 36, 66, 14);     // 横梁
    gate.fillRect(4082, 48, 62, 6);      // 次梁
    gate.fillStyle(0xffd700, 0.5);
    gate.fillRect(4088, 46, 10, 114);    // 左柱高光
    gate.fillRect(4120, 46, 8, 114);     // 右柱高光

    // 金顶宝殿（x≈4360）
    const hall = this.add.graphics();
    hall.fillStyle(0x6b4226, 1);
    hall.fillRect(4340, 108, 14, 52);
    hall.fillRect(4404, 108, 14, 52);
    hall.fillStyle(0xdaa520, 1);
    hall.fillRect(4330, 100, 94, 12);
    hall.fillStyle(0x8e2a2a, 1);
    hall.fillTriangle(4320, 108, 4432, 108, 4376, 74);

    // 供剑石台（x≈4250，战后生成太极八卦剑）
    const altar = this.add.graphics();
    altar.fillStyle(0x7a6614, 1);
    altar.fillRect(4234, 128, 36, 32);
    altar.fillStyle(0xdaa520, 1);
    altar.fillRect(4230, 124, 44, 10);
    altar.fillStyle(0xffd700, 0.22);
    altar.fillRect(4232, 126, 40, 6);

    // 金顶台地金色粒子
    for (let i = 0; i < 24; i++) {
      const spark = this.add.circle(
        Phaser.Math.Between(4100, 4820),
        Phaser.Math.Between(50, 158),
        Phaser.Math.Between(1, 2),
        COLORS.GOLD,
        Phaser.Math.FloatBetween(0.3, 0.7),
      );
      this.tweens.add({
        targets: spark,
        alpha: { from: 0.1, to: 0.85 },
        y: spark.y - Phaser.Math.Between(6, 14),
        duration: Phaser.Math.Between(800, 2000),
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  粒子光点
  // ──────────────────────────────────────────────────────────

  createParticles() {
    for (let i = 0; i < 36; i += 1) {
      const sparkle = this.add.circle(
        Phaser.Math.Between(0, 3200),
        Phaser.Math.Between(60, 460),
        Phaser.Math.Between(1, 2),
        COLORS.GOLD,
        Phaser.Math.FloatBetween(0.25, 0.7),
      );
      sparkle.setScrollFactor(0.35);
      this.tweens.add({
        targets: sparkle,
        alpha: { from: 0.2, to: 0.8 },
        y: sparkle.y - Phaser.Math.Between(6, 12),
        duration: Phaser.Math.Between(1000, 2200),
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  普通敌人
  // ──────────────────────────────────────────────────────────

  createEnemies() {
    this.enemies = this.physics.add.group();

    const spawnEnemy = (x, y, patrolMinX, patrolMaxX) => {
      const enemy = this.enemies.create(x, y, 'enemy_spirit');
      enemy.body.setSize(18, 34);
      enemy.body.setOffset(7, 10);
      enemy.setCollideWorldBounds(true);
      enemy.patrolMinX = patrolMinX;
      enemy.patrolMaxX = patrolMaxX;
      enemy.patrolDirection = 1;
      enemy.hp = 20;           // 需2拳打死
      enemy.patrolSpeed = 55;
      enemy.setVelocityX(55);
      return enemy;
    };

    // 山脚/中段
    spawnEnemy(360, 300, 300, 430);
    spawnEnemy(1180, 250, 1080, 1240);
    spawnEnemy(2190, 210, 2100, 2280);

    // 金顶石阶守卫
    spawnEnemy(3290, 350, 3250, 3340);   // 第一阶
    spawnEnemy(3590, 270, 3550, 3640);   // 第三阶
    spawnEnemy(3890, 190, 3850, 3940);   // 第五阶
  }

  // ──────────────────────────────────────────────────────────
  //  守金将军 BOSS
  // ──────────────────────────────────────────────────────────

  createBoss() {
    const boss = this.enemies.create(4400, 100, 'boss_general');
    boss.body.setSize(22, 38);
    boss.body.setOffset(5, 8);
    boss.setCollideWorldBounds(true);
    boss.patrolMinX = 4120;
    boss.patrolMaxX = 4760;
    boss.patrolDirection = -1;
    boss.hp = 80;
    boss.isBoss = true;
    boss.patrolSpeed = 70;
    boss.setVelocityX(-70);
    this.boss = boss;

    this.bossLabel = this.add.text(4400, 46, '👑 守金将军', {
      fontSize: '18px',
      color: '#ff8844',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200);
  }

  // ──────────────────────────────────────────────────────────
  //  能量球
  // ──────────────────────────────────────────────────────────

  createEnergyOrbs() {
    this.energyOrbs = this.physics.add.group({ allowGravity: false, immovable: true });

    const orbPositions = [
      [640, 220], [870, 150], [1500, 180], [1940, 300],
      [2330, 320], [2880, 370],
      [3450, 320], // 石阶中段
      [3750, 240], // 石阶高段
    ];

    orbPositions.forEach(([x, y]) => {
      const orb = this.energyOrbs.create(x, y, 'crystal_yellow');
      orb.setScale(0.5);
      orb.setTint(0xfff09a);
      orb.body.setAllowGravity(false);
      orb.body.moves = false;
      this.tweens.add({
        targets: orb,
        y: y - 8,
        angle: 360,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  NPC 与传送门
  // ──────────────────────────────────────────────────────────

  createNpcAndPortal() {
    // 张三丰只传授太极八卦拳，指引前往金顶寻剑
    const dialogues = [
      '真人：「小北，老夫等候多时。」',
      '真人：「蛟龙夺你气运，你需习得太极八卦拳，以拳御敌。」',
      '真人：「出拳之时（J键），太极八卦弹可伤敌于远处，刚柔并济。」',
      '真人：「武当金顶之上，藏有传世秘宝——太极八卦剑。」',
      '真人：「然守剑者乃建金顶年代之大将军，武艺超群，非有真功不可过。」',
      '真人：「前往金顶，取剑归来，方能踏上五岳之路！」',
      '✅ 习得太极八卦拳！继续前行，前往武当金顶。',
    ];

    this.npc = new NPC(this, 2900, 400, 'npc_taoist', dialogues, () => {
      if (skillSystem.collect(ITEMS.SKILL_TAIJI)) {
        this.showLevelBanner('✨ 太极八卦拳已解锁！→ 前往武当金顶');
        // 传送门不在此开启，须击败守金将军
      }
    });

    // 传送门位于金顶末端（x=4680）
    this.portalGlow = this.add.ellipse(4680, 104, 40, 76, COLORS.TEAL, 0.18).setVisible(false);
    this.portal = this.physics.add.staticImage(4680, 104, 'portal_frame');
    this.portal.setAlpha(0.35);

    this.physics.add.overlap(this.player, this.portal, () => {
      if (this.portalActive) {
        this.finishLevel();
      }
    });
  }

  // ──────────────────────────────────────────────────────────
  //  答题卷
  // ──────────────────────────────────────────────────────────

  createQuizItems() {
    this.quizItems = this.physics.add.staticGroup();

    const positions = [
      [450, 408], [950, 408], [1600, 408], [2050, 228], [2700, 408],
    ];

    positions.forEach(([x, y], i) => {
      const scroll = this.quizItems.create(x, y, 'quiz_scroll');
      scroll.quizIndex = i % WUDANG_QUIZZES.length;
      scroll.setTint(0xffd700);
      this.tweens.add({ targets: scroll, y: y - 10, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      const glow = this.add.circle(x, y, 18, 0xffd700, 0.15);
      this.tweens.add({ targets: glow, alpha: { from: 0.05, to: 0.3 }, scaleX: { from: 0.8, to: 1.2 }, scaleY: { from: 0.8, to: 1.2 }, duration: 900, yoyo: true, repeat: -1 });

      const hint = this.add.text(x, y - 30, '📜 答题', { fontSize: '13px', color: '#ffd700', backgroundColor: '#00000066', padding: { x: 4, y: 2 } }).setOrigin(0.5).setVisible(false);
      scroll._hint = hint;
      scroll._glow = glow;
      scroll.once('destroy', () => { hint.destroy(); glow.destroy(); });
    });

    this.physics.add.overlap(this.player, this.quizItems, (player, scroll) => {
      if (this.quizUI.isOpen || scroll._used) return;
      scroll._hint.setVisible(false);
      scroll._used = true;
      scroll.destroy();
      player.isTalking = true;

      const qData = WUDANG_QUIZZES[scroll.quizIndex];
      this.quizUI.open(qData.q, qData.choices, qData.correct, (correct) => {
        player.isTalking = false;
        if (correct) {
          this.player.addWisdomBuff(20);
          this.showLevelBanner('📖 智慧+20 → 攻击提升！');
          this.burstParticles(this.player.x, this.player.y - 24, 12, 0xffd700);
        } else {
          this.showLevelBanner('💭 学习是旅途的一部分！');
        }
      });
    }, null, this);
  }

  showControlsReminder() {
    const reminder = this.add
      .text(GAME_WIDTH / 2, 76, '← → 移动  |  ↑/空格 跳跃  |  J 太极拳  |  Z 朱雀  |  X 玄武护体  |  F 交谈', {
        fontSize: '17px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(900);

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

    this.tweens.add({
      targets: [this.portal, this.portalGlow],
      scaleY: { from: 0.95, to: 1.05 },
      scaleX: { from: 0.95, to: 1.03 },
      alpha: { from: 0.55, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    if (showBanner) this.showLevelBanner('✨ 传送门已开启！');
  }

  // ──────────────────────────────────────────────────────────
  //  通知横幅
  // ──────────────────────────────────────────────────────────

  showLevelBanner(text) {
    const bg = this.add.rectangle(GAME_WIDTH / 2, 112, 380, 38, 0x0d1117, 0.92).setScrollFactor(0).setDepth(950);
    bg.setStrokeStyle(2, COLORS.GOLD, 1);
    const label = this.add.text(GAME_WIDTH / 2, 112, text, { fontSize: '23px', color: '#fff3b0', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(951);
    this.tweens.add({ targets: [bg, label], alpha: 0, delay: 1500, duration: 500, onComplete: () => { bg.destroy(); label.destroy(); } });
  }

  // ──────────────────────────────────────────────────────────
  //  BOSS 战逻辑
  // ──────────────────────────────────────────────────────────

  onBossDefeated(boss) {
    this.burstParticles(boss.x, boss.y, 26, 0xffd700);
    this.burstParticles(boss.x, boss.y, 14, 0xff8844);
    boss.destroy();
    this.bossDefeated = true;
    this.boss = null;

    if (this.bossLabel) { this.bossLabel.destroy(); this.bossLabel = null; }

    this.showLevelBanner('⚔️ 守金将军已败！');
    this.time.delayedCall(1200, () => this.spawnSwordPickup());
  }

  spawnSwordPickup() {
    const sx = 4256, sy = 100;
    const sword = this.physics.add.staticImage(sx, sy, 'taiji_sword');
    sword.setDepth(10);
    this.tweens.add({ targets: sword, y: sy - 12, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const glow = this.add.circle(sx, sy, 24, COLORS.GOLD, 0.2).setDepth(9);
    this.tweens.add({ targets: glow, alpha: { from: 0.08, to: 0.45 }, scale: { from: 0.9, to: 1.3 }, duration: 750, yoyo: true, repeat: -1 });

    const hint = this.add.text(sx, sy - 38, '⚔️ 太极八卦剑', { fontSize: '18px', color: '#ffd700', stroke: '#000000', strokeThickness: 3, backgroundColor: '#00000088', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: hint, y: '+=5', duration: 900, yoyo: true, repeat: -1 });

    this.physics.add.overlap(this.player, sword, () => {
      if (!sword.active) return;
      sword.destroy(); glow.destroy(); hint.destroy();
      if (skillSystem.collect(ITEMS.TAIJI_SWORD)) {
        this.showLevelBanner('⚔️ 太极八卦剑 已获得！');
        this.time.delayedCall(700, () => this.showMapDialogue());
      }
    });
  }

  showMapDialogue() {
    const lines = [
      '旁白：「太极八卦剑！千年灵兵，终于重见天日！」',
      '旁白：「剑鞘之中，藏有一张残旧的地图……」',
      '地图：「五岳之上，气运碎片各有守护——」',
      '地图：「东岳泰山 · 西岳华山 · 北岳恒山 · 中岳嵩山」',
      '地图：「集齐五岳气运，可开启蛟龙世界的通道！」',
      '✅ 传送门已开启！前往五岳，收集气运碎片！',
    ];
    this.player.isTalking = true;
    this.mapDialogue.start(lines, () => {
      this.player.isTalking = false;
      this.activatePortal(true);
    });
  }

  // ──────────────────────────────────────────────────────────
  //  战斗回调
  // ──────────────────────────────────────────────────────────

  handlePlayerEnemyOverlap(player, enemy) {
    if (!enemy.active || this.levelFinished) return;

    if (player.isGuarding()) {
      enemy.patrolDirection *= -1;
      enemy.setVelocityX(enemy.patrolDirection * 100);
      this.burstParticles(enemy.x, enemy.y, 8, 0x4de8ff); // 玄武护体弹开色
      return;
    }

    const damage = enemy.isBoss ? 20 : 10;
    player.hurt(damage, enemy.x);
  }

  handleBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    this.burstParticles(bullet.x, bullet.y, 8, 0x4488ff);
    const dmg = bullet.damage || 8;
    bullet.destroy();
    this.damageEnemy(enemy, dmg);
  }

  collectOrb(_player, orb) {
    if (!orb.active) return;
    orb.destroy();
    this.player.heal(15);
    sfx.play('collect');
    this.burstParticles(this.player.x, this.player.y - 18, 6, 0xfff0a8);
  }

  collectFood(_player, drop) {
    if (!drop.active) return;
    const data = drop.foodData;
    this.tweens.killTweensOf(drop);
    drop.destroy();
    sfx.play('collect');
    this.burstParticles(this.player.x, this.player.y - 20, 6, 0xffd700);
    const hpGain = data.hp || (data.atk ? data.atk * 2 : 20);
    this.player.heal(hpGain);
    this.showLevelBanner(`🍜 ${data.label} → 恢复${hpGain}气血`);
  }

  damageEnemy(enemy, damage = 10) {
    if (!enemy || !enemy.active) return;
    enemy.hp = typeof enemy.hp === 'number' ? enemy.hp : 20;
    enemy.hp -= damage;

    if (enemy.hp > 0) {
      sfx.play('enemy_hit');
      this.burstParticles(enemy.x, enemy.y, 6, enemy.isBoss ? 0xff8844 : 0xffd27a);
      return;
    }

    this.defeatEnemy(enemy);
  }

  defeatEnemy(enemy) {
    if (!enemy || !enemy.active) return;

    // BOSS 专属处理
    if (enemy.isBoss) {
      this.onBossDefeated(enemy);
      return;
    }

    this.burstParticles(enemy.x, enemy.y, 10, 0xaad8ff);

    if (Math.random() < 0.3) {
      const foods = [
        { key: 'food_ganmian', hp: 20, label: '热干面' },
        { key: 'food_doupi', hp: 15, label: '豆皮' },
        { key: 'food_lotus', hp: 30, label: '莲藕排骨汤' },
      ];
      const food = foods[Math.floor(Math.random() * foods.length)];
      const drop = this.foodDrops.create(enemy.x, enemy.y - 16, food.key);
      drop.foodData = food;
      drop.setScale(0.85);
      drop.setBounce(0.4);
      drop.setVelocityY(-120);
      drop.setVelocityX(Phaser.Math.Between(-60, 60));
      this.tweens.add({ targets: drop, alpha: { from: 1, to: 0.6 }, duration: 400, yoyo: true, repeat: -1 });
    }

    enemy.destroy();
  }

  // ──────────────────────────────────────────────────────────
  //  朱雀烈焰特效
  // ──────────────────────────────────────────────────────────

  zhuqueBlast(x, y, range) {
    const ring = this.add.circle(x, y, 6, 0xff4400, 0).setStrokeStyle(3, 0xff6600, 0.9).setDepth(50);
    this.tweens.add({ targets: ring, scaleX: range / 6, scaleY: range / 6, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

    const fireball = this.add.circle(x, y, 8, 0xff3300, 0.75).setDepth(49);
    this.tweens.add({ targets: fireball, scaleX: (range * 0.55) / 8, scaleY: (range * 0.55) / 8, alpha: 0, duration: 280, ease: 'Cubic.easeOut', onComplete: () => fireball.destroy() });

    const core = this.add.circle(x, y, 12, 0xffee44, 0.9).setDepth(51);
    this.tweens.add({ targets: core, scale: 1.8, alpha: 0, duration: 160, ease: 'Sine.easeOut', onComplete: () => core.destroy() });

    const particleCount = Math.round(16 + (range / 150) * 12);
    for (let i = 0; i < particleCount; i++) {
      const bit = this.add.image(x, y, 'particle').setTint(i < particleCount * 0.6 ? 0xff4400 : 0xffaa00).setAlpha(0.95).setDepth(50);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(20, range);
      this.tweens.add({ targets: bit, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0, scale: { from: 1.2, to: 0.4 }, duration: Phaser.Math.Between(280, 500), ease: 'Quad.easeOut', onComplete: () => bit.destroy() });
    }
  }

  burstParticles(x, y, count, tint) {
    for (let i = 0; i < count; i += 1) {
      const bit = this.add.image(x, y, 'particle').setTint(tint).setAlpha(0.9);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(10, 34);
      this.tweens.add({ targets: bit, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, alpha: 0, duration: Phaser.Math.Between(180, 360), onComplete: () => bit.destroy() });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  复活 / 完关
  // ──────────────────────────────────────────────────────────

  respawnPlayer() {
    this.player.hp = this.player.maxHp;
    this.player.invulnerableUntil = this.time.now + 800;
    this.player.setPosition(80, 390);
    this.player.setVelocity(0, 0);
    bus.emit(EVENTS.PLAYER_HURT, { hp: this.player.hp, maxHp: this.player.maxHp, wisdom: this.player.wisdomBonus, attack: this.player.getCurrentAttack() });
    this.showLevelBanner('💨 气运受损，回到山脚！');
  }

  finishLevel() {
    if (this.levelFinished) return;
    this.levelFinished = true;
    bus.emit(EVENTS.LEVEL_COMPLETE, { next: '五岳' });

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45).setScrollFactor(0).setDepth(980);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🗺️ 前往五岳，收集气运碎片！', {
      fontSize: '34px', color: '#fff1a6', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(981);

    this.player.setVelocity(0, 0);
    this.player.isTalking = true;

    this.time.delayedCall(1800, () => {
      music.stop();
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.MENU);
      overlay.destroy();
      text.destroy();
    });
  }

  // ──────────────────────────────────────────────────────────
  //  每帧更新
  // ──────────────────────────────────────────────────────────

  update() {
    this.player.update();

    const nearNpc = this.npc.update(this.player);

    // 所有敌人（含BOSS）巡逻
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;

      if (enemy.x <= enemy.patrolMinX) enemy.patrolDirection = 1;
      else if (enemy.x >= enemy.patrolMaxX) enemy.patrolDirection = -1;

      const speed = enemy.patrolSpeed || 55;
      enemy.setVelocityX(enemy.patrolDirection * speed);
      enemy.setFlipX(enemy.patrolDirection < 0);
    });

    // BOSS 标签跟随
    if (this.boss && this.boss.active && this.bossLabel) {
      this.bossLabel.setPosition(this.boss.x, this.boss.y - 52);
    }

    // 首次接近BOSS触发提示
    if (this.boss && this.boss.active && !this.bossEncounterShown && Math.abs(this.player.x - this.boss.x) < 500) {
      this.bossEncounterShown = true;
      this.showLevelBanner('⚔️ 守金将军登场！集中精力！');
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

    // 动态音乐
    if (!this.levelFinished) {
      const enemyNearby = this.enemies.getChildren().some(
        (e) => e.active && Math.abs(e.x - this.player.x) < 280
      );
      const wantTheme = enemyNearby ? 'battle' : 'wudang';
      if (wantTheme !== this._musicTheme) {
        this._musicTheme = wantTheme;
        music.play(wantTheme);
      }
    }

    // HUD 提示
    if (this.hud && this.hud.scene.isActive()) {
      this.hud.setLocation('🏔️ 武当山');
      this.hud.setHealth(this.player.hp, this.player.maxHp);
      this.hud.setWisdom(this.player.wisdomBonus, this.player.getCurrentAttack());

      if (this.quizUI && this.quizUI.isOpen) {
        this.hud.setHint('1-4 / A-D 作答');
      } else if (this.player.isTalking) {
        this.hud.setHint('F：继续对话');
      } else if (nearNpc && !this.npc.complete) {
        this.hud.setHint('靠近真人，按 F 交谈');
      } else if (this.boss && this.boss.active && Math.abs(this.player.x - this.boss.x) < 450) {
        this.hud.setHint('⚔️ 守金将军！  J 连打 · X 玄武护体');
      } else if (this.portalActive && Math.abs(this.player.x - this.portal.x) < 100) {
        this.hud.setHint('走进传送门，前往五岳！');
      } else if (this.npc.complete && !this.bossDefeated) {
        this.hud.setHint('→ 登上石阶，前往武当金顶');
      } else if (this.quizItems && this.quizItems.getChildren().some((s) => !s._used && Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y) < 60)) {
        this.hud.setHint('📜 触碰答题卷获得智慧');
      } else if (this.player.skills[ITEMS.SKILL_TAIJI]) {
        this.hud.setHint('J 太极八卦弹  |  X 玄武护体  |  Z 朱雀');
      } else {
        this.hud.setHint('J 攻击灵体  |  跳过断崖继续前进');
      }
    }
  }
}

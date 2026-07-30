// 泰山关卡（第五关·终章）：岱宗坊 → 一天门 → 中天门（缆车/18盘石阶）→ 南天门 → 天街 → 玉皇顶（战天煞将）→ 五岳归一
// 特色机制：
//   • 18盘天梯：1000级石阶，可花1000金币坐缆车直达南天门
//   • 三位智者：每位对话完毕赠200金币
//   • 青龙晶：击败BOSS后获得，永久提升气血上限+30
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

const TAISHAN_QUIZZES = [
  { q: '泰山位于中国哪个省份？',          choices: ['山东省', '山西省', '河南省', '河北省'],      correct: 0 },
  { q: '泰山是五岳中的哪岳？',            choices: ['东岳', '西岳', '南岳', '北岳'],            correct: 0 },
  { q: '泰山18盘共有多少级台阶？',        choices: ['1633级', '999级', '1000级', '800级'],       correct: 0 },
  { q: '泰山无字碑据传为哪位皇帝所立？',  choices: ['武则天', '秦始皇', '汉武帝', '唐太宗'],     correct: 0 },
  { q: '"登泰山而小天下"出自哪部典籍？', choices: ['孟子', '论语', '庄子', '老子'],              correct: 0 },
];

// 缆车费用
const CABLE_CAR_COST = 1000;
// 每位智者赠金币数
const SAGE_COIN_REWARD = 200;

// 18盘参数
const PAN_COUNT   = 18;   // 共18盘
const PAN_START_X = 2240; // 起点x（中天门右侧）
const PAN_START_Y = 218;  // 起点y
const PAN_WIDTH   = 200;  // 每盘横向宽度
const PAN_RISE    = 7;    // 每盘升高（px）
const STEPS_PER_PAN = 4;  // 每盘台阶数

export class TaishanScene extends Phaser.Scene {
  constructor() {
    super(SCENES.TAISHAN);
  }

  create() {
    this.portalActive     = false;
    this.levelFinished    = false;
    this.bossDefeated     = false;
    this.bossEncounterShown = false;
    this.bossHPBarVisible = false;
    this.boss             = null;
    this.bossLabel        = null;
    this.bossArenaWall    = null;
    this.awaitingCrystalPickup = false;
    this._musicTheme      = 'taishan';

    // 缆车状态
    this.cableCarShown   = false;   // 缆车UI是否已弹出
    this.cableCarUsed    = false;   // 是否已选择缆车
    this.cableCarPanel   = null;
    this._gKeyJustDown   = false;   // G键状态（每帧用完重置）

    if (this.scene.isActive(SCENES.HUD)) this.scene.stop(SCENES.HUD);
    this.scene.launch(SCENES.HUD);
    this.hud = this.scene.get(SCENES.HUD);

    music.play('taishan');

    // 世界：6800px 宽
    this.physics.world.setBounds(0, -2000, 6800, 2560);
    const PLAY_H = GAME_HEIGHT - 80;
    this.cameras.main.setViewport(0, 0, GAME_WIDTH, PLAY_H);
    this.cameras.main.setBounds(0, -600, 6800, 1200); // 全程恒定，覆盖地面到山顶

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

    this.enemyProjectiles = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.player, this.enemyProjectiles, this.handleEnemyProjectileHit, null, this);

    this.createEnergyOrbs();
    this.physics.add.overlap(this.player, this.energyOrbs, this.collectOrb, null, this);

    this.createSages();
    this.createNpcAndPortal();
    this.quizUI = new QuizUI(this);
    this.createQuizItems();
    this.showControlsReminder();

    this.mapDialogue = new DialogueBox(this);

    // G键注册（缆车）
    this.input.keyboard.on('keydown-G', () => { this._gKeyJustDown = true; });

    this.onItemCollected = ({ inventory }) => { this.player.syncSkills(inventory); };
    this.onCrystalSkill = ({ type, x, y, dir, range, height, damage }) => {
      if (type === 'zhuque') {
        this.zhuqueBlast(x, y, range);
        this.showLevelBanner('🔥 朱雀烈焰！');
        this.enemies.getChildren().forEach(e => {
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
      this.destroyCableCarPanel();
    });

    this.bossDefeated = !!skillSystem.getInventory()[ITEMS.TAISHAN_COMPLETE];
    if (this.bossDefeated) {
      this.activatePortal(false);
    } else {
      this.createBoss();
    }
  }

  // ──────────────────────────────────────────────────────────
  //  背景（泰山旭日，磅礴晨曦）
  // ──────────────────────────────────────────────────────────

  createBackground() {
    // 晨曦天空渐变
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, GAME_WIDTH, GAME_HEIGHT * 0.4, 0x1a1830, 1).setScrollFactor(0);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.65, GAME_WIDTH, GAME_HEIGHT * 0.7, 0x2a1c28, 1).setScrollFactor(0);

    // 远山剪影
    const far = this.add.graphics().setScrollFactor(0.07);
    far.fillStyle(0x2a1c30, 1);
    far.beginPath();
    far.moveTo(-100, 540);
    [80,320,220,500,190,700,220,940,180,1180,230,1450,190,1720,250,2000,170,2300,260,2600,180,
     2900,240,3200,160,3500,250,3800,170,4100,230,4400,150,4700,240,5000,120,5300,220,5600,140,
     5900,200,6200,130,6500,200,6900,540].reduce((px, v, i) => {
      if (i % 2 === 0) { far.lineTo(v, 540); } else { far.lineTo(px, v); }
      return v;
    }, 0);
    far.closePath(); far.fillPath();

    // 泰山中景（暖灰调）
    const mid = this.add.graphics().setScrollFactor(0.22);
    mid.fillStyle(0x3a2838, 1);
    mid.beginPath();
    mid.moveTo(-60, 540);
    [0,360,180,450,320,300,500,450,660,310,840,460,1040,300,1240,460,
     1480,310,1720,460,1960,290,2200,460,2460,280,2720,460,2980,270,
     3240,460,3500,260,3760,450,4020,250,4300,460,4600,230,4900,450,
     5200,210,5500,430,5800,190,6100,420,6400,180,6800,380,6800,540].reduce((acc, v, i) => {
      if (i % 2 === 0) return v;
      mid.lineTo(acc, v); return acc;
    }, -60);
    mid.closePath(); mid.fillPath();

    // 泰山日出光晕（东方）
    const sunrise = this.add.graphics().setScrollFactor(0.12);
    sunrise.fillStyle(0xff8c42, 0.08);
    sunrise.fillCircle(320, 90, 140);
    sunrise.fillStyle(0xffd700, 0.05);
    sunrise.fillCircle(320, 90, 220);
    this.tweens.add({ targets: sunrise, alpha: { from: 0.4, to: 1.0 }, duration: 3500, yoyo: true, repeat: -1 });

    // 泰山松林
    const near = this.add.graphics().setScrollFactor(0.5);
    near.fillStyle(0x110e18, 1);
    for (let x = -50; x < 6900; x += 52) {
      near.fillTriangle(x, 540, x + 18, 448 - (x % 4) * 12, x + 36, 540);
      near.fillTriangle(x + 16, 540, x + 38, 432 - (x % 3) * 10, x + 60, 540);
    }

    // 云海（泰山特色）
    for (let i = 0; i < 14; i++) {
      const cloud = this.add.container(Phaser.Math.Between(-100, 6700), Phaser.Math.Between(60, 220), [
        this.add.ellipse(-22, 4, 52, 28, 0xfff8f0, 0.18),
        this.add.ellipse(0, 0, 64, 34, 0xfff8f0, 0.18),
        this.add.ellipse(26, 6, 48, 26, 0xfff8f0, 0.18),
      ]);
      cloud.setScrollFactor(0.12);
      this.tweens.add({ targets: cloud, x: cloud.x + Phaser.Math.Between(140, 280), duration: Phaser.Math.Between(14000, 24000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  平台（三段：岱宗坊→中天门，18盘，南天门→玉皇顶）
  // ──────────────────────────────────────────────────────────

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();

    const addPlatform = (x, y, width) => {
      const count = Math.ceil(width / 32);
      for (let i = 0; i < count; i++) {
        this.platforms.create(x + i * 32 + 16, y, 'tile_taishan');
      }
    };

    // ── 岱宗坊·入口（x 0~900）──
    addPlatform(0, 440, 900);
    addPlatform(200, 380, 130);
    addPlatform(440, 320, 130);
    addPlatform(680, 260, 130);
    addPlatform(860, 210, 180);

    // ── 一天门到中天门（x 900~2200）──
    addPlatform(900, 440, 220);
    addPlatform(1180, 400, 110);
    addPlatform(1360, 360, 110);
    addPlatform(1560, 320, 110);
    addPlatform(1740, 280, 110);
    addPlatform(1920, 240, 110);
    addPlatform(2080, 218, 180);   // 中天门大平台

    // ── 18盘石阶（程序化生成，共18盘×4步＝72台阶）──
    for (let p = 0; p < PAN_COUNT; p++) {
      for (let s = 0; s < STEPS_PER_PAN; s++) {
        const stepW  = PAN_WIDTH / STEPS_PER_PAN;
        const sx     = PAN_START_X + p * PAN_WIDTH + s * stepW;
        const sy     = Math.round(PAN_START_Y - p * PAN_RISE - (s / STEPS_PER_PAN) * PAN_RISE);
        addPlatform(sx, sy, stepW + 6);
      }
    }

    // 18盘终点x = PAN_START_X + PAN_COUNT * PAN_WIDTH = 2240 + 18*200 = 5840
    // 终点y = PAN_START_Y - PAN_COUNT * PAN_RISE = 218 - 18*7 = 218-126 = 92

    // ── 南天门（x 5840~6200，y=92）──
    addPlatform(5840, 92, 380);

    // ── 天街（x 6200~6450，y=72）──
    addPlatform(6200, 72, 260);

    // ── 玉皇顶主台地（x 6450~6800，y=60）──
    addPlatform(6450, 60, 360);
  }

  // ──────────────────────────────────────────────────────────
  //  装饰（牌坊·18盘标牌·南天门城楼·无字碑）
  // ──────────────────────────────────────────────────────────

  createDecorations() {
    const sign = (x, y, text, color = '#ffd700') => {
      const t = this.add.text(x, y, text, {
        fontSize: '19px', color, stroke: '#000000', strokeThickness: 4,
        backgroundColor: '#00000099', padding: { x: 10, y: 5 },
      }).setOrigin(0.5);
      this.tweens.add({ targets: t, alpha: { from: 0.6, to: 1.0 }, duration: 1400, yoyo: true, repeat: -1 });
      return t;
    };

    sign(100,  408, '🏔️ 泰山 · 岱宗坊');
    sign(960,  408, '⛩️ 一天门');
    sign(2100, 186, '🌥️ 中天门·缆车站', '#66d9ff');
    sign(5900,  60, '🚪 南天门', '#ffd700');
    sign(6230,  40, '🏮 天街');
    sign(6500,  28, '🌟 玉皇顶·极顶', '#ff8800');

    // 18盘标牌
    const panSign = this.add.text(PAN_START_X + 200, PAN_START_Y - 30, '⬆ 18盘天梯 · 1000级石阶', {
      fontSize: '17px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: panSign, alpha: { from: 0.5, to: 1.0 }, duration: 1000, yoyo: true, repeat: -1 });

    // 每3盘标一个编号
    for (let p = 0; p < PAN_COUNT; p += 3) {
      const px = PAN_START_X + p * PAN_WIDTH + PAN_WIDTH / 2;
      const py = Math.round(PAN_START_Y - p * PAN_RISE) - 20;
      this.add.text(px, py, `第${p + 1}盘`, {
        fontSize: '12px', color: '#c8c0b0', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
    }

    // 岱宗坊牌坊（入口石坊）
    const pailou = this.add.graphics();
    pailou.fillStyle(0x9a8a78, 1);
    pailou.fillRect(60, 396, 14, 44);    // 左柱
    pailou.fillRect(160, 396, 14, 44);   // 右柱
    pailou.fillStyle(0x8b3030, 1);
    pailou.fillTriangle(52, 400, 182, 400, 117, 370);  // 屋顶
    pailou.fillStyle(0x9a8a78, 1);
    pailou.fillRect(54, 394, 130, 8);    // 横梁
    this.add.text(117, 390, '岱宗坊', { fontSize: '11px', color: '#ffd700', align: 'center' }).setOrigin(0.5);

    // 缆车站标志（中天门）
    this.cableCarSignX = 2070;
    this.cableCarSignY = 178;
    const carSign = this.add.graphics();
    carSign.fillStyle(0x224466, 0.85);
    carSign.fillRoundedRect(this.cableCarSignX - 80, this.cableCarSignY - 16, 160, 32, 6);
    carSign.lineStyle(2, 0x66aadd, 1);
    carSign.strokeRoundedRect(this.cableCarSignX - 80, this.cableCarSignY - 16, 160, 32, 6);
    this.add.text(this.cableCarSignX, this.cableCarSignY, '🚡 缆车站  按 G 键乘车', {
      fontSize: '13px', color: '#88ddff', align: 'center',
    }).setOrigin(0.5);
    this.tweens.add({ targets: carSign, alpha: { from: 0.7, to: 1.0 }, duration: 800, yoyo: true, repeat: -1 });

    // 南天门城楼
    const south = this.add.graphics();
    south.fillStyle(0x8b3030, 1);
    south.fillRect(5840, 48, 16, 44);   // 左塔柱
    south.fillRect(5980, 48, 16, 44);   // 右塔柱
    south.fillStyle(0x6a1010, 1);
    south.fillTriangle(5830, 52, 6006, 52, 5918, 10);  // 城楼屋顶
    south.fillStyle(0x9a2020, 1);
    south.fillRect(5832, 44, 174, 10);  // 横檐
    this.add.text(5918, 30, '南天门', { fontSize: '13px', color: '#ffd700', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5);

    // 无字碑（天街处）
    this.add.image(6310, 36, 'stele_wuzi').setDepth(10);
    this.add.text(6310, -8, '无字碑', { fontSize: '12px', color: '#d0c8a0', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(11);

    // 泰山石灯
    [340, 960, 2000, 5910, 6250, 6540].forEach(lx => {
      const rope = this.add.rectangle(lx, 290, 2, 24, 0x5a4a38, 1);
      const lantern = this.add.circle(lx, 310, 8, 0xff9944, 0.85);
      const glow = this.add.circle(lx, 310, 18, 0xff8800, 0.14);
      this.tweens.add({ targets: [lantern, glow, rope], y: '+=4', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  玉皇顶（BOSS区 + 供晶台）
  // ──────────────────────────────────────────────────────────

  createSummitZone() {
    // 玉皇庙
    const temple = this.add.graphics();
    temple.fillStyle(0x3a2828, 1);
    temple.fillRect(6580, 16, 12, 44); temple.fillRect(6680, 16, 12, 44);
    temple.fillStyle(0x8b2020, 1);
    temple.fillTriangle(6568, 16, 6704, 16, 6636, -18);
    temple.fillStyle(0x4a3030, 1);
    temple.fillRect(6572, 8, 116, 12);
    this.add.text(6636, 14, '玉皇庙', { fontSize: '10px', color: '#ffd700', align: 'center' }).setOrigin(0.5);

    // 供晶台（青龙晶台）
    const altar = this.add.graphics();
    altar.fillStyle(0x224433, 1);
    altar.fillRect(6480, 40, 36, 28);
    altar.fillStyle(0x44aa66, 1);
    altar.fillRect(6476, 36, 44, 8);
    altar.fillStyle(0x00dd88, 0.22);
    altar.fillRect(6478, 38, 40, 4);

    // 泰山日出粒子（金橙光点）
    for (let i = 0; i < 22; i++) {
      const sp = this.add.circle(
        Phaser.Math.Between(6450, 6800), Phaser.Math.Between(10, 55),
        Phaser.Math.Between(1, 2), 0xff9944, Phaser.Math.FloatBetween(0.2, 0.6)
      );
      this.tweens.add({ targets: sp, alpha: { from: 0.08, to: 0.7 }, y: sp.y - Phaser.Math.Between(4, 10), duration: Phaser.Math.Between(800, 2100), yoyo: true, repeat: -1 });
    }
  }

  createParticles() {
    for (let i = 0; i < 30; i++) {
      const sp = this.add.circle(
        Phaser.Math.Between(0, 4500), Phaser.Math.Between(60, 430),
        Phaser.Math.Between(1, 2), 0xffcc88, Phaser.Math.FloatBetween(0.15, 0.5)
      );
      sp.setScrollFactor(0.3);
      this.tweens.add({ targets: sp, alpha: { from: 0.1, to: 0.6 }, y: sp.y - Phaser.Math.Between(4, 10), duration: Phaser.Math.Between(1000, 2200), yoyo: true, repeat: -1 });
    }
  }

  // ──────────────────────────────────────────────────────────
  //  三位智者（对话完毕各赠200金币）
  // ──────────────────────────────────────────────────────────

  createSages() {
    this.sages = [];

    const sageData = [
      {
        x: 680, y: 214, name: '泰山学者',
        dialogues: [
          '学者：「小北，欢迎来到东岳泰山，五岳之首，天下第一山！」',
          '学者：「古人云：登泰山而小天下。此山之高，不在海拔，在气象！」',
          '学者：「前路有18盘天梯，共1633级石阶，历代帝王封禅之路。」',
          '学者：「中天门有缆车，可省腿力；但亲攀18盘，方知泰山真味。」',
          `学者：「这200金币，是对你求知精神的奖励！」`,
          '✅ 获得200金币！',
        ],
        coinReward: SAGE_COIN_REWARD,
        key: 'sage0',
      },
      {
        x: 2020, y: 178, name: '中天门智者',
        dialogues: [
          '智者：「中天门！你已走完三分之一，前方便是18盘天梯。」',
          '智者：「18盘，是泰山最险、最美的一段。古石阶凿于明代，苔痕斑斑。」',
          '智者：「若你金币充足，可在此乘缆车飞越18盘，直抵南天门。」',
          '智者：「若要徒步，请做好准备——每一步都是与天地的对话。」',
          `智者：「赠你200金币，愿你做出属于自己的选择！」`,
          '✅ 获得200金币！',
        ],
        coinReward: SAGE_COIN_REWARD,
        key: 'sage1',
      },
      {
        x: 5890, y: 52, name: '南天门仙人',
        dialogues: [
          '仙人：「南天门！无论你如何上来，能到此处，已是勇者！」',
          '仙人：「前方天街，乃古代帝王祭天前沐浴更衣之所，气象万千。」',
          '仙人：「玉皇顶上，镇守天煞将虎视眈眈，其天戟快若惊雷。」',
          '仙人：「你集五岳气运，四方灵晶在手，此战必胜！」',
          `仙人：「收下200金币，踏上最后的征程！」`,
          '✅ 获得200金币！',
        ],
        coinReward: SAGE_COIN_REWARD,
        key: 'sage2',
      },
    ];

    sageData.forEach(data => {
      const sageNpc = new NPC(this, data.x, data.y, 'npc_sage', data.dialogues, () => {
        // 发放金币
        skillSystem.addCoins(data.coinReward);
        const txt = this.add.text(data.x, data.y - 60, `+${data.coinReward}🪙`, {
          fontSize: '20px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
          fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(500);
        this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 36, duration: 1200, onComplete: () => txt.destroy() });
        this.showLevelBanner(`💰 ${data.name} 赠予 ${data.coinReward} 金币！`);
        this.burstParticles(data.x, data.y - 20, 12, 0xffd700);
      }, data.name);

      this.sages.push(sageNpc);
    });
  }

  // ──────────────────────────────────────────────────────────
  //  缆车系统
  // ──────────────────────────────────────────────────────────

  showCableCarPanel() {
    if (this.cableCarShown) return;
    this.cableCarShown = true;
    this.player.isTalking = true;

    const cx = GAME_WIDTH / 2;
    const cy = 310;
    const bg = this.add.rectangle(cx, cy, 560, 130, 0x08111e, 0.94)
      .setScrollFactor(0).setDepth(975).setStrokeStyle(2, 0x66aadd, 1);

    const title = this.add.text(cx, cy - 46, '🚡 中天门缆车站  ·  前方 18 盘天梯', {
      fontSize: '18px', color: '#88ddff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(976);

    const coins = skillSystem.getCoins();
    const canAfford = coins >= CABLE_CAR_COST;

    const opt1Color = canAfford ? '#ffd700' : '#ff6666';
    const opt1Text = canAfford
      ? `[1] 💰 坐缆车（花费 ${CABLE_CAR_COST} 金币，直达南天门）`
      : `[1] 💰 坐缆车（需 ${CABLE_CAR_COST} 金币，当前 ${coins} 枚，不足）`;

    const btn1 = this.add.text(cx, cy - 12, opt1Text, {
      fontSize: '15px', color: opt1Color, stroke: '#000000', strokeThickness: 2,
      backgroundColor: canAfford ? '#1a2200aa' : '#220000aa', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(976).setInteractive({ useHandCursor: canAfford });

    const btn2 = this.add.text(cx, cy + 26, '[2] 🥾 徒步攀登18盘（免费，约1000级石阶）', {
      fontSize: '15px', color: '#a8f0a0', stroke: '#000000', strokeThickness: 2,
      backgroundColor: '#00220011', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(976).setInteractive({ useHandCursor: true });

    const hint = this.add.text(cx, cy + 54, '按 1 / 2 选择，或点击选项', {
      fontSize: '13px', color: '#888888',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(976);

    this.cableCarPanel = { bg, title, btn1, btn2, hint };

    const onKey1 = () => { if (canAfford) this.boardCableCar(); };
    const onKey2 = () => this.walkThe18Pan();

    this.input.keyboard.once('keydown-ONE', onKey1);
    this.input.keyboard.once('keydown-TWO', onKey2);
    btn1.on('pointerdown', onKey1);
    btn2.on('pointerdown', onKey2);
  }

  destroyCableCarPanel() {
    if (!this.cableCarPanel) return;
    Object.values(this.cableCarPanel).forEach(obj => { if (obj && obj.destroy) obj.destroy(); });
    this.cableCarPanel = null;
  }

  boardCableCar() {
    if (!skillSystem.spendCoins(CABLE_CAR_COST)) {
      this.showLevelBanner(`❌ 金币不足 ${CABLE_CAR_COST}！`);
      this.walkThe18Pan();
      return;
    }
    this.cableCarUsed = true;
    this.destroyCableCarPanel();

    // 黑屏淡出
    const fade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setScrollFactor(0).setDepth(990);
    this.tweens.add({
      targets: fade, alpha: 1, duration: 600, ease: 'Linear',
      onComplete: () => {
        // 传送到南天门平台（18盘终点右侧）
        const destX = 5870;
        const destY = 56;
        this.player.setPosition(destX, destY);
        this.player.setVelocity(0, 0);
        this.cameras.main.centerOn(destX, destY);

        const msg = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🚡 缆车到达南天门！\n一览众山小！', {
          fontSize: '28px', color: '#88ddff', fontStyle: 'bold', align: 'center',
          stroke: '#000000', strokeThickness: 5,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(991);

        // 淡入
        this.tweens.add({
          targets: fade, alpha: 0, delay: 1000, duration: 700,
          onComplete: () => { fade.destroy(); msg.destroy(); this.player.isTalking = false; },
        });
        this.tweens.add({ targets: msg, alpha: 0, delay: 1200, duration: 600, onComplete: () => msg.destroy() });

        // 更新重生点
        this.respawnPoint = { x: destX, y: destY };
        this.showCheckpointBeacon(destX, destY);
        this.showLevelBanner(`💰 花费 ${CABLE_CAR_COST} 金币坐缆车，直达南天门！`);
      },
    });
  }

  walkThe18Pan() {
    this.destroyCableCarPanel();
    this.player.isTalking = false;
    this.showLevelBanner('🥾 徒步攀登18盘！脚踏实地，步步为赢！');
    // 设置中天门重生点
    this.respawnPoint = { x: 2060, y: 180 };
    this.showCheckpointBeacon(2060, 180);
  }

  // ──────────────────────────────────────────────────────────
  //  敌人
  // ──────────────────────────────────────────────────────────

  createEnemies() {
    this.enemies = this.physics.add.group();
    this.maxActiveEnemies = 3;
    this.lastSpawnTime = 0;

    this.enemySpawnPool = [
      // 岱宗坊
      { x: 240,  y: 340, minX: 200,  maxX: 320,  type: 'melee',  spawned: false },
      { x: 490,  y: 280, minX: 450,  maxX: 560,  type: 'ranged', spawned: false },
      { x: 730,  y: 220, minX: 690,  maxX: 790,  type: 'heavy',  spawned: false },
      // 一天门到中天门
      { x: 1000, y: 400, minX: 940,  maxX: 1100, type: 'ranged', spawned: false },
      { x: 1380, y: 320, minX: 1340, maxX: 1440, type: 'melee',  spawned: false },
      { x: 1600, y: 280, minX: 1560, maxX: 1660, type: 'heavy',  spawned: false },
      { x: 1960, y: 200, minX: 1920, maxX: 2020, type: 'melee',  spawned: false },
      // 18盘石阶（中段敌人）
      { x: 2900, y: PAN_START_Y - 4 * PAN_RISE - 20, minX: 2860, maxX: 2980, type: 'melee', spawned: false },
      { x: 3480, y: PAN_START_Y - 7 * PAN_RISE - 20, minX: 3440, maxX: 3560, type: 'ranged', spawned: false },
      { x: 4060, y: PAN_START_Y - 10 * PAN_RISE - 20, minX: 4020, maxX: 4140, type: 'heavy', spawned: false },
      { x: 4640, y: PAN_START_Y - 13 * PAN_RISE - 20, minX: 4600, maxX: 4720, type: 'melee', spawned: false },
      { x: 5220, y: PAN_START_Y - 16 * PAN_RISE - 20, minX: 5180, maxX: 5300, type: 'ranged', spawned: false },
      // 南天门到玉皇顶
      { x: 5950, y: 52,  minX: 5860, maxX: 5980,  type: 'heavy',  spawned: false },
      { x: 6250, y: 32,  minX: 6210, maxX: 6360,  type: 'melee',  spawned: false },
      { x: 6520, y: 20,  minX: 6460, maxX: 6600,  type: 'ranged', spawned: false },
    ];
  }

  spawnEnemyFromData(data) {
    const flash = this.add.circle(data.x, data.y, 20, 0xff8800, 0.5).setDepth(49);
    this.tweens.add({ targets: flash, alpha: 0, scale: 2.4, duration: 320, onComplete: () => flash.destroy() });

    const e = this.enemies.create(data.x, data.y, 'taishan_enemy');
    e.body.setSize(18, 34); e.body.setOffset(7, 10);
    e.setCollideWorldBounds(true);
    e.patrolMinX = data.minX; e.patrolMaxX = data.maxX;
    e.patrolDirection = 1;

    if (data.type === 'heavy') {
      e.hp = 58; e.patrolSpeed = 70; e.contactDamage = 22; e.isHeavy = true;
      e.setTint(0xff6600); e.setScale(1.15); e.setVelocityX(70);
    } else if (data.type === 'ranged') {
      e.hp = 34; e.patrolSpeed = 40; e.contactDamage = 10; e.isRanged = true;
      e.lastShootTime = 0; e.shootInterval = 2600;
      e.setTint(0xffaa44); e.setVelocityX(40);
    } else {
      e.hp = 44; e.patrolSpeed = 58; e.contactDamage = 13; e.setVelocityX(58);
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
      !s.spawned && s.x >= this.player.x - 200 && s.x <= this.player.x + 540
    );
    if (next) {
      next.spawned = true;
      this.lastSpawnTime = now;
      this.spawnEnemyFromData(next);
    }
  }

  // ──────────────────────────────────────────────────────────
  //  天煞将 BOSS（三阶段）
  // ──────────────────────────────────────────────────────────

  createBoss() {
    const boss = this.enemies.create(6640, 10, 'taishan_boss');
    boss.body.setSize(22, 38); boss.body.setOffset(5, 8);
    boss.setCollideWorldBounds(true);
    boss.patrolMinX = 6460; boss.patrolMaxX = 6790;
    boss.patrolDirection = -1;
    boss.maxHp = 750; boss.hp = 750;
    boss.isBoss = true;
    boss.phase = 1; boss.contactDamage = 28;
    boss.patrolSpeed = 82;
    boss.lastChargeTime = 0; boss.lastJumpTime = 0;
    boss.lastProjectileTime = 0; boss.lastAoeTime = 0;
    boss.isCharging = false; boss.isJumping = false; boss.jumpLanding = false;
    boss.setVelocityX(-82);
    this.boss = boss;

    this.bossLabel = this.add.text(6640, -8, '⚡ 天煞将', {
      fontSize: '18px', color: '#ffcc44', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200);

    this.createBossHPBar();

    this.bossArenaWall = this.physics.add.staticImage(6448, 80, 'tile_taishan');
    this.bossArenaWall.setVisible(false);
    this.bossArenaWall.body.setSize(20, 600);
    this.bossArenaWall.body.enable = false;
    this.physics.add.collider(this.player, this.bossArenaWall);
  }

  createBossHPBar() {
    const cx = GAME_WIDTH / 2, barW = 280, barY = 56;
    this.bossHPBG = this.add.rectangle(cx, barY, barW + 6, 22, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(955).setStrokeStyle(2, 0xffcc44, 1).setVisible(false).setAlpha(0);
    this.bossHPFill = this.add.rectangle(cx - barW / 2, barY, barW, 14, 0xcc8822, 1)
      .setScrollFactor(0).setDepth(956).setOrigin(0, 0.5).setVisible(false).setAlpha(0);
    this.bossHPName = this.add.text(cx, barY - 15, '⚡ 天煞将  第一阶段', {
      fontSize: '13px', color: '#ffcc44', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(957).setVisible(false).setAlpha(0);
    this.bossHPPercent = this.add.text(cx + barW / 2 + 6, barY, '100%', {
      fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(957).setVisible(false).setAlpha(0);
  }

  showBossHPBar() {
    if (this.bossHPBarVisible) return;
    this.bossHPBarVisible = true;
    [this.bossHPBG, this.bossHPFill, this.bossHPName, this.bossHPPercent].forEach(el => {
      if (!el) return;
      el.setVisible(true);
      this.tweens.add({ targets: el, alpha: 1, duration: 450 });
    });
  }

  updateBossHPBar() {
    if (!this.boss || !this.boss.active || !this.bossHPFill) return;
    const ratio = Math.max(0, this.boss.hp / this.boss.maxHp);
    this.bossHPFill.width = 280 * ratio;
    if (this.bossHPPercent) this.bossHPPercent.setText(Math.ceil(ratio * 100) + '%');
    const cols = { 1: 0xcc8822, 2: 0xff6600, 3: 0xff0000 };
    this.bossHPFill.setFillStyle(cols[this.boss.phase] || 0xcc8822, 1);
  }

  destroyBossHPBar() {
    [this.bossHPBG, this.bossHPFill, this.bossHPName, this.bossHPPercent].forEach(el => { if (el) el.destroy(); });
    this.bossHPBG = this.bossHPFill = this.bossHPName = this.bossHPPercent = null;
  }

  lockBossArena() {
    if (this.bossArenaWall) { this.bossArenaWall.body.enable = true; this.bossArenaWall.refreshBody(); }
    const flash = this.add.rectangle(6450, 50, 16, 140, 0xffcc44, 0.82).setDepth(300);
    this.tweens.add({ targets: flash, alpha: 0, scaleY: 1.6, duration: 700, onComplete: () => flash.destroy() });
    const msg = this.add.text(6620, -2, '⚡ 天煞将！退路已封！', {
      fontSize: '16px', color: '#ffcc44', stroke: '#000', strokeThickness: 3,
      backgroundColor: '#00000099', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(305);
    this.tweens.add({ targets: msg, alpha: 0, y: msg.y - 28, duration: 1400, delay: 200, onComplete: () => msg.destroy() });
  }

  updateBossPhase() {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    const ratio = boss.hp / boss.maxHp;
    const newPhase = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3;
    if (newPhase !== boss.phase) { boss.phase = newPhase; this.onBossPhaseChange(boss, newPhase); }

    const now = this.time.now;

    // 跳跃攻击
    const jumpCd = boss.phase === 3 ? 2500 : boss.phase === 2 ? 3800 : 5500;
    if (!boss.isCharging && !boss.isJumping && now - boss.lastJumpTime > jumpCd) {
      boss.lastJumpTime = now; this.bossJumpAttack(boss);
    }
    // 冲锋（第二/三阶段）
    if (boss.phase >= 2 && !boss.isCharging && !boss.isJumping) {
      const cd = boss.phase === 3 ? 1600 : 2800;
      if (now - boss.lastChargeTime > cd) { boss.lastChargeTime = now; this.bossCharge(boss); }
    }
    // 天戟投射（第二/三阶段）
    if (boss.phase >= 2 && now - boss.lastProjectileTime > (boss.phase === 3 ? 1800 : 3200)) {
      boss.lastProjectileTime = now; this.bossThrowSpear(boss);
    }
    // 雷霆AOE（第三阶段）
    if (boss.phase === 3 && now - boss.lastAoeTime > 3800) {
      boss.lastAoeTime = now; this.bossThunderAoe(boss);
    }
  }

  onBossPhaseChange(boss, phase) {
    if (phase === 2) {
      boss.patrolSpeed = 124; boss.contactDamage = 38; boss.setTint(0xff6600);
      if (this.bossHPName) this.bossHPName.setText('⚡ 天煞将  ⚡ 第二阶段·烈焰').setStyle({ color: '#ff8844' });
      if (this.bossHPBG)   this.bossHPBG.setStrokeStyle(2, 0xff6600, 1);
      this.showLevelBanner('⚡ 天煞将·烈焰暴涨！');
      this.burstParticles(boss.x, boss.y, 20, 0xff6600);
      this.cameras.main.shake(300, 0.009); this.cameras.main.flash(180, 255, 200, 100, true);
    } else if (phase === 3) {
      boss.patrolSpeed = 165; boss.contactDamage = 52; boss.setTint(0xff0000);
      if (this.bossHPName) this.bossHPName.setText('⚡ 天煞将  💀 雷霆狂怒').setStyle({ color: '#ff4422' });
      if (this.bossHPBG)   this.bossHPBG.setStrokeStyle(2, 0xff0000, 1);
      this.showLevelBanner('💀 天煞将·雷霆震天！极度危险！');
      this.burstParticles(boss.x, boss.y, 30, 0xff0000);
      this.cameras.main.shake(500, 0.018); this.cameras.main.flash(280, 255, 160, 80, true);
    }
  }

  bossCharge(boss) {
    if (!boss || !boss.active || !this.player) return;
    boss.isCharging = true;
    const dir = this.player.x > boss.x ? 1 : -1;
    const spd = boss.phase === 3 ? 400 : 270;
    boss.setVelocityX(dir * spd); boss.setFlipX(dir < 0);
    const warn = this.add.text(boss.x, boss.y - 58, '⚡ 天戟突刺！', {
      fontSize: '17px', color: '#ffcc44', stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 500, onComplete: () => warn.destroy() });
    this.time.delayedCall(580, () => { if (boss && boss.active) boss.isCharging = false; });
  }

  bossJumpAttack(boss) {
    if (!boss || !boss.active || boss.isJumping || boss.isCharging) return;
    if (!boss.body.blocked.down) return;
    boss.isJumping = true; boss.jumpLanding = false;
    const dir = this.player.x > boss.x ? 1 : -1;
    boss.setVelocityY(-480);
    boss.setVelocityX(dir * (boss.phase === 3 ? 260 : boss.phase === 2 ? 200 : 145));
    boss.setFlipX(dir < 0);
    const warn = this.add.text(boss.x, boss.y - 68, '⬆ 天降神罚！', {
      fontSize: '18px', color: '#ffcc44', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 22, duration: 500, onComplete: () => warn.destroy() });
    this.time.delayedCall(280, () => { if (boss && boss.active) boss.jumpLanding = true; });
  }

  bossLandingImpact(boss) {
    this.cameras.main.shake(260, 0.012);
    this.burstParticles(boss.x, boss.y + 14, 18, 0xff8800);
    const ring = this.add.circle(boss.x, boss.y + 14, 8, 0xff6600, 0).setStrokeStyle(3, 0xffcc44, 0.9).setDepth(52);
    this.tweens.add({ targets: ring, scaleX: 8, scaleY: 4, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const dist = Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y);
    if (dist < 100) {
      if (this.player.isGuarding()) { this.player.flashGuardSuccess(); }
      else { this.player.hurt(boss.phase >= 3 ? 30 : 24, boss.x); this.showLevelBanner('💥 天降神罚命中！'); }
    }
    boss.setVelocityX(0);
  }

  bossThrowSpear(boss) {
    if (!boss || !boss.active || !this.player) return;
    const dir = this.player.x > boss.x ? 1 : -1;
    const count = boss.phase === 3 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 150, () => {
        if (!boss || !boss.active) return;
        const proj = this.physics.add.image(boss.x + dir * 20, boss.y - 8 + i * 16, 'bagua_orb');
        proj.setTint(0xffcc44); proj.setScale(1.2);
        proj.damage = boss.phase === 3 ? 18 : 14;
        proj.body.setAllowGravity(false);
        proj.body.setVelocity(dir * 260, 0);
        this.enemyProjectiles.add(proj);
        this.tweens.add({ targets: proj, angle: dir > 0 ? 720 : -720, duration: 600, repeat: -1 });
        this.time.delayedCall(2000, () => { if (proj && proj.active) proj.destroy(); });
      });
    }
    const warn = this.add.text(boss.x, boss.y - 32, '⚡', { fontSize: '18px', color: '#ffcc44' }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 18, duration: 400, onComplete: () => warn.destroy() });
  }

  bossThunderAoe(boss) {
    if (!boss || !boss.active || !this.player) return;
    const r = 180;
    const warn = this.add.text(boss.x, boss.y - 68, '⚡ 雷霆震天！', {
      fontSize: '18px', color: '#ff4422', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(205);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 24, duration: 580, onComplete: () => warn.destroy() });

    const ring = this.add.circle(boss.x, boss.y, 8, 0xff4422, 0).setStrokeStyle(4, 0xffcc44, 0.9).setDepth(53);
    this.tweens.add({ targets: ring, scale: r / 8, alpha: 0, duration: 460, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });

    // 8道落雷
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 50, () => {
        if (!boss || !boss.active) return;
        const bx = boss.x + Phaser.Math.Between(-r, r);
        const bolt = this.add.rectangle(bx, boss.y - 60, 4, 120, 0xffcc44, 0.9).setDepth(54);
        this.tweens.add({ targets: bolt, alpha: 0, scaleY: 0.1, duration: 300, onComplete: () => bolt.destroy() });
      });
    }
    this.cameras.main.shake(300, 0.012);
    this.time.delayedCall(160, () => {
      if (!boss.active) return;
      if (Phaser.Math.Distance.Between(boss.x, boss.y, this.player.x, this.player.y) < r) {
        if (this.player.isGuarding()) { this.player.flashGuardSuccess(); }
        else { this.player.hurt(26, boss.x); this.showLevelBanner('⚡ 雷霆命中！'); }
      }
    });
  }

  enemyShootProjectile(enemy) {
    if (!enemy || !enemy.active || !this.player) return;
    const dir = this.player.x > enemy.x ? 1 : -1;
    const proj = this.physics.add.image(enemy.x + dir * 18, enemy.y - 10, 'bagua_orb');
    proj.setTint(0xffaa44); proj.setScale(0.85); proj.damage = 12;
    proj.body.setAllowGravity(false);
    proj.body.setVelocity(dir * 210, 0);
    this.enemyProjectiles.add(proj);
    this.tweens.add({ targets: proj, angle: dir > 0 ? 360 : -360, duration: 500, repeat: -1 });
    const warn = this.add.text(enemy.x, enemy.y - 30, '✦', { fontSize: '14px', color: '#ffaa44' }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: warn, alpha: 0, y: warn.y - 14, duration: 380, onComplete: () => warn.destroy() });
    this.time.delayedCall(2200, () => { if (proj && proj.active) proj.destroy(); });
  }

  handleEnemyProjectileHit(player, proj) {
    if (!proj.active) return;
    this.burstParticles(proj.x, proj.y, 8, 0xffaa44);
    proj.destroy();
    if (player.isGuarding()) { player.flashGuardSuccess(); }
    else { player.hurt(proj.damage || 12, proj.x); }
  }

  respawnBoss() {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    boss.setPosition(6640, 10); boss.setVelocity(0, 0);
    boss.isCharging = boss.isJumping = boss.jumpLanding = false;
    boss.patrolDirection = -1;
    boss.setVelocityX(-boss.patrolSpeed);
    if (boss.phase === 3) boss.setTint(0xff0000);
    else if (boss.phase === 2) boss.setTint(0xff6600);
    else boss.clearTint();
  }

  // ──────────────────────────────────────────────────────────
  //  BOSS击败 → 掉落大金币 + 青龙晶
  // ──────────────────────────────────────────────────────────

  onBossDefeated(boss) {
    this.burstParticles(boss.x, boss.y, 40, 0xffcc44);
    this.burstParticles(boss.x, boss.y, 20, 0xff6600);
    this.cameras.main.shake(500, 0.016);
    boss.destroy();
    this.bossDefeated = true;
    this.boss = null;
    if (this.bossLabel) { this.bossLabel.destroy(); this.bossLabel = null; }
    this.destroyBossHPBar();
    if (this.bossArenaWall) this.bossArenaWall.body.enable = false;
    skillSystem.collect(ITEMS.TAISHAN_COMPLETE);

    // 掉落250金币（一枚大金币）
    this.dropBossCoin(boss.x || 6640, (boss.y || 20) - 10, 250);

    this.showLevelBanner('⚡ 天煞将已败！青龙气运即将显现！');
    this.time.delayedCall(1200, () => this.spawnQingLongCrystal());
  }

  spawnQingLongCrystal() {
    this.awaitingCrystalPickup = true;
    const sx = 6498, sy = 20;

    const crystal = this.physics.add.staticImage(sx, sy, 'crystal_qinglong_item').setDepth(10);
    this.tweens.add({ targets: crystal, y: sy - 12, angle: 360, duration: 1600, repeat: -1, ease: 'Sine.easeInOut' });

    const glow = this.add.circle(sx, sy, 26, 0x44cc88, 0.22).setDepth(9);
    this.tweens.add({ targets: glow, alpha: { from: 0.08, to: 0.55 }, scale: { from: 0.9, to: 1.4 }, duration: 750, yoyo: true, repeat: -1 });

    const hint = this.add.text(sx, sy - 42, '🐉 青龙晶', {
      fontSize: '18px', color: '#66ffaa', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(11);
    this.tweens.add({ targets: hint, y: '+=5', duration: 900, yoyo: true, repeat: -1 });

    this.physics.add.overlap(this.player, crystal, () => {
      if (!crystal.active) return;
      crystal.destroy(); glow.destroy(); hint.destroy();
      this.awaitingCrystalPickup = false;

      if (skillSystem.collect(ITEMS.CRYSTAL_QINGLONG)) {
        // 永久提升气血上限 +30
        this.player.maxHp += 30;
        this.player.hp = Math.min(this.player.hp + 30, this.player.maxHp);
        bus.emit(EVENTS.PLAYER_HURT, {
          hp: this.player.hp, maxHp: this.player.maxHp,
          wisdom: this.player.wisdomBonus, attack: this.player.getCurrentAttack(),
        });
        this.showLevelBanner('🐉 青龙晶已获得！气血上限永久+30！五岳气运圆满！');
        this.burstParticles(this.player.x, this.player.y - 24, 20, 0x44cc88);
        this.cameras.main.flash(400, 80, 220, 130, true);
      }
      this.time.delayedCall(800, () => this.showVictoryDialogue());
    });
  }

  showVictoryDialogue() {
    const lines = [
      '旁白：「天煞将倒于泰山之巅，东岳气运碎片入手！」',
      '旁白：「五岳气运——朱雀、黄龙、白虎、玄武、青龙——五方灵晶已全部集齐！」',
      '智者之声：「小北，你登遍五岳，气运归一，蛟龙将从沉睡中觉醒！」',
      '智者之声：「以青龙之力为引，穿越传送门，踏上最终的归途！」',
      '✅ 五岳归一！小北寻龙记——第一章完结！前往传送门！',
    ];
    this.player.isTalking = true;
    this.mapDialogue.start(lines, () => {
      this.player.isTalking = false;
      this.activatePortal(true);
    });
  }

  // ──────────────────────────────────────────────────────────
  //  金币系统
  // ──────────────────────────────────────────────────────────

  dropCoins(x, y, amount) {
    for (let i = 0; i < amount; i++) {
      const coin = this.coinDrops.create(x + Phaser.Math.Between(-18, 18), y, 'coin');
      coin.setScale(0.9); coin.setBounce(0.5);
      coin.body.setAllowGravity(true);
      coin.setVelocityX(Phaser.Math.Between(-80, 80));
      coin.setVelocityY(Phaser.Math.Between(-160, -60));
      coin._value = 1;
      this.time.delayedCall(6000, () => { if (coin && coin.active) coin.destroy(); });
    }
  }

  dropBossCoin(x, y, value) {
    const coin = this.coinDrops.create(x, y, 'coin');
    coin.setScale(2.0); coin.setBounce(0.55);
    coin.body.setAllowGravity(true);
    coin.setVelocityX(Phaser.Math.Between(-40, 40));
    coin.setVelocityY(-200);
    coin._value = value;

    const label = this.add.text(x, y - 28, `💰×${value}`, {
      fontSize: '16px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000099', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: label, y: label.y - 12, alpha: { from: 1, to: 0.7 }, duration: 900, yoyo: true, repeat: -1 });

    const glow = this.add.circle(x, y, 22, 0xffd700, 0.25).setDepth(59);
    this.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.5 }, scale: { from: 0.9, to: 1.4 }, duration: 600, yoyo: true, repeat: -1 });

    coin._onCollect = () => { label.destroy(); glow.destroy(); };
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
    const txt = this.add.text(this.player.x, this.player.y - 36, `+${value}🪙`, {
      fontSize: '14px', color: '#ffd700', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(500);
    this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 22, duration: 700, onComplete: () => txt.destroy() });
  }

  // ──────────────────────────────────────────────────────────
  //  能量球
  // ──────────────────────────────────────────────────────────

  createEnergyOrbs() {
    this.energyOrbs = this.physics.add.group({ allowGravity: false, immovable: true });
    // 分布在入口、中天门前、18盘中间、南天门、玉皇顶
    const positions = [
      [480, 270], [740, 220], [1580, 280],
      // 18盘中段每3盘一个能量球
      ...Array.from({ length: 6 }, (_, i) => {
        const p = 2 + i * 3;
        return [
          PAN_START_X + p * PAN_WIDTH + PAN_WIDTH / 2,
          PAN_START_Y - p * PAN_RISE - 30,
        ];
      }),
      [5900, 52], [6240, 32],
    ];
    positions.forEach(([x, y]) => {
      const orb = this.energyOrbs.create(x, y, 'crystal_yellow');
      orb.setScale(0.5); orb.setTint(0xffeeaa);
      orb.body.setAllowGravity(false); orb.body.moves = false;
      this.tweens.add({ targets: orb, y: y - 8, angle: 360, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  主NPC（泰山道士，告知总览）与传送门
  // ──────────────────────────────────────────────────────────

  createNpcAndPortal() {
    const dialogues = [
      '泰山道士：「小北！欢迎登临东岳泰山，五岳之首，天下第一山！」',
      '泰山道士：「此行目标：攀上玉皇顶，击败镇守极顶的天煞将，取回青龙气运碎片。」',
      '泰山道士：「途中有三位智者，皆藏有泰山秘闻，与他们交谈，各得200金币！」',
      '泰山道士：「中天门之后是18盘天梯，1000余级！可徒步，亦可花1000金币坐缆车。」',
      '泰山道士：「集五岳之运，青龙晶将圆满五方气运。此战，乃小北寻龙记第一章的终结！」',
      '✅ 出发！登顶泰山，气运归一！',
    ];

    this.npc = new NPC(this, 100, 390, 'npc_hengshan', dialogues, () => {
      this.respawnPoint = { x: 100, y: 390 };
    }, '泰山道士');

    this.portalGlow = this.add.ellipse(6770, 8, 40, 76, COLORS.TEAL, 0.18).setVisible(false);
    this.portal = this.physics.add.staticImage(6770, 8, 'portal_frame');
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
    // 入口·18盘几处·南天门
    const positions = [
      [350, 408], [900, 400],
      [PAN_START_X + 3 * PAN_WIDTH, PAN_START_Y - 3 * PAN_RISE - 20],
      [PAN_START_X + 9 * PAN_WIDTH, PAN_START_Y - 9 * PAN_RISE - 20],
      [6000, 52],
    ];

    positions.forEach(([x, y], i) => {
      const scroll = this.quizItems.create(x, y, 'quiz_scroll');
      scroll.quizIndex = i % TAISHAN_QUIZZES.length;
      scroll.setTint(0xffcc44);
      this.tweens.add({ targets: scroll, y: y - 10, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      const glow = this.add.circle(x, y, 18, 0xffcc44, 0.15);
      this.tweens.add({ targets: glow, alpha: { from: 0.05, to: 0.30 }, scaleX: { from: 0.8, to: 1.2 }, scaleY: { from: 0.8, to: 1.2 }, duration: 900, yoyo: true, repeat: -1 });

      const hint = this.add.text(x, y - 30, '📜 答题', { fontSize: '13px', color: '#ffcc44', backgroundColor: '#00000066', padding: { x: 4, y: 2 } }).setOrigin(0.5).setVisible(false);
      scroll._hint = hint; scroll._glow = glow;
      scroll.once('destroy', () => { hint.destroy(); glow.destroy(); });
    });

    this.physics.add.overlap(this.player, this.quizItems, (player, scroll) => {
      if (this.quizUI.isOpen || scroll._used) return;
      scroll._hint.setVisible(false); scroll._used = true; scroll.destroy();
      player.isTalking = true;
      const qData = TAISHAN_QUIZZES[scroll.quizIndex];
      this.quizUI.open(qData.q, qData.choices, qData.correct, (correct) => {
        player.isTalking = false;
        if (correct) { this.player.addWisdomBuff(20); this.showLevelBanner('📖 智慧+20！'); this.burstParticles(this.player.x, this.player.y - 24, 12, 0xffcc44); }
        else { this.showLevelBanner('💭 学习是旅途的一部分！'); }
      });
    }, null, this);
  }

  showControlsReminder() {
    const reminder = this.add.text(GAME_WIDTH / 2, 76,
      '← → 移动  |  ↑/空格 跳跃  |  J 攻击  |  Q 切换武器  |  Z/C/N/V/X 技能  |  F 交谈  |  中天门按 G 坐缆车',
      { fontSize: '14px', color: '#ffffff', backgroundColor: '#00000099', padding: { x: 10, y: 5 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(900);
    this.tweens.add({ targets: reminder, alpha: 0, delay: 4000, duration: 1000, onComplete: () => reminder.destroy() });
  }

  // ──────────────────────────────────────────────────────────
  //  传送门
  // ──────────────────────────────────────────────────────────

  activatePortal(showBanner) {
    if (this.portalActive) return;
    this.portalActive = true;
    this.portal.setAlpha(1);
    this.portalGlow.setVisible(true);
    this.tweens.add({ targets: [this.portal, this.portalGlow], scaleY: { from: 0.95, to: 1.05 }, scaleX: { from: 0.95, to: 1.03 }, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    if (showBanner) this.showLevelBanner('✨ 传送门已开启！五岳归一！');
  }

  showLevelBanner(text) {
    const bg = this.add.rectangle(GAME_WIDTH / 2, 112, 440, 38, 0x0d1117, 0.92).setScrollFactor(0).setDepth(950);
    bg.setStrokeStyle(2, 0xffcc44, 1);
    const label = this.add.text(GAME_WIDTH / 2, 112, text, { fontSize: '22px', color: '#fff3b0', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(951);
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
      this.burstParticles(enemy.x, enemy.y, 8, 0xffcc44);
      return;
    }
    player.hurt(enemy.contactDamage || (enemy.isBoss ? 28 : 13), enemy.x);
  }

  handleBulletHit(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    if (enemy.isBoss && this.player.x < 6450) return;
    this.burstParticles(bullet.x, bullet.y, 8, 0xffcc44);
    bullet.destroy();
    this.damageEnemy(enemy, bullet.damage || 8);
  }

  collectOrb(_player, orb) {
    if (!orb.active) return;
    orb.destroy(); this.player.heal(15); sfx.play('collect');
    this.burstParticles(this.player.x, this.player.y - 18, 6, 0xffeeaa);
  }

  collectFood(_player, drop) {
    if (!drop.active) return;
    const data = drop.foodData;
    this.tweens.killTweensOf(drop); drop.destroy(); sfx.play('collect');
    this.burstParticles(this.player.x, this.player.y - 20, 6, 0xffcc44);
    this.player.heal(data.hp || 20);
    this.showLevelBanner(`🥞 ${data.label} → 恢复${data.hp || 20}气血`);
  }

  damageEnemy(enemy, damage = 10) {
    if (!enemy || !enemy.active) return;
    if (enemy.isBoss && this.player.x < 6450) return;
    enemy.hp = typeof enemy.hp === 'number' ? enemy.hp : (enemy.isBoss ? 750 : 44);
    if (enemy.isBoss) damage = Math.min(damage, 25);
    enemy.hp -= damage;
    if (enemy.hp > 0) {
      sfx.play('enemy_hit');
      this.burstParticles(enemy.x, enemy.y, 6, enemy.isBoss ? 0xff8800 : 0xffcc44);
      if (enemy.isBoss) this.updateBossHPBar();
      return;
    }
    this.defeatEnemy(enemy);
  }

  defeatEnemy(enemy) {
    if (!enemy || !enemy.active) return;
    if (enemy.isBoss) { this.onBossDefeated(enemy); return; }

    // 小兵掉落1-2金币
    this.dropCoins(enemy.x, enemy.y - 10, Phaser.Math.Between(1, 2));

    this.burstParticles(enemy.x, enemy.y, 10, 0xffcc44);
    if (Math.random() < 0.28) {
      const foods = [
        { key: 'food_jianbing', hp: 22, label: '泰山煎饼' },
        { key: 'food_taishan_tofu', hp: 25, label: '泰山豆腐' },
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
    this.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      const inZone = dir > 0 ? enemy.x >= x && enemy.x <= x + range && Math.abs(enemy.y - y) < height * 0.6
                              : enemy.x <= x && enemy.x >= x - range && Math.abs(enemy.y - y) < height * 0.6;
      if (inZone) this.damageEnemy(enemy, damage);
    });
  }

  yijinjingBlast(x, y, dir, range, damage) {
    const wave = this.add.rectangle(x + dir * range * 0.5, y - 10, range, 44, 0xff9f43, 0.45).setDepth(52).setStrokeStyle(2, 0xffd700, 0.85);
    this.tweens.add({ targets: wave, alpha: 0, scaleX: 1.7, duration: 320, onComplete: () => wave.destroy() });
    this.enemies.getChildren().forEach(enemy => {
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
    this.enemies.getChildren().forEach(enemy => {
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
    this.time.delayedCall(400, () => { this.showLevelBanner('⛳ 新重生点已设置！'); });
    const beam = this.add.rectangle(x, y - 60, 10, 120, 0xffcc44, 0.55).setDepth(48);
    this.tweens.add({ targets: beam, alpha: 0, scaleY: 0.2, y: y - 100, duration: 1800, ease: 'Sine.easeIn', onComplete: () => beam.destroy() });
    const ring = this.add.circle(x, y, 8, 0xffcc44, 0).setStrokeStyle(3, 0xffe066, 0.9).setDepth(48);
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
    this.showLevelBanner('💫 泰山气运恢复，从重生点出发！');
  }

  finishLevel() {
    if (this.levelFinished) return;
    this.levelFinished = true;
    bus.emit(EVENTS.LEVEL_COMPLETE, { next: '五岳归一' });

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setScrollFactor(0).setDepth(980);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
      '🌟 五岳归一！\n小北寻龙记 · 第一章 · 完结',
      { fontSize: '32px', color: '#fff3b0', fontStyle: 'bold', align: 'center', stroke: '#000000', strokeThickness: 6 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(981);

    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90,
      '朱雀·黄龙·白虎·玄武·青龙  五方气运圆满',
      { fontSize: '18px', color: '#ffcc44', stroke: '#000000', strokeThickness: 3 }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(981);

    this.player.setVelocity(0, 0); this.player.isTalking = true;

    // 彩色粒子庆祝
    const colors = [0xff4400, 0xffd700, 0xffffff, 0x26c6da, 0x44cc88];
    for (let i = 0; i < 40; i++) {
      this.time.delayedCall(i * 80, () => {
        const cx = Phaser.Math.Between(100, GAME_WIDTH - 100);
        const cy = Phaser.Math.Between(50, GAME_HEIGHT - 50);
        this.burstParticles(cx, cy, 8, colors[i % colors.length]);
      });
    }

    this.time.delayedCall(3500, () => {
      music.stop();
      this.scene.stop(SCENES.HUD);
      this.scene.start(SCENES.MENU);
      overlay.destroy(); text.destroy(); sub.destroy();
    });
  }

  // ──────────────────────────────────────────────────────────
  //  每帧更新
  // ──────────────────────────────────────────────────────────

  update() {
    this.player.update();

    // 更新所有智者NPC
    let nearSage = false;
    this.sages.forEach(sage => {
      const near = sage.update(this.player);
      if (near) nearSage = true;
    });

    const nearNpc = this.npc.update(this.player);

    this.updateEnemySpawns();

    // ── 缆车触发：进入中天门区域，未坐过，未显示过 ──
    if (!this.cableCarShown && !this.cableCarUsed
        && this.player.x > 2040 && this.player.x < 2250
        && !this.player.isTalking) {
      this.showCableCarPanel();
    }

    // G键：在缆车区域再次触发（在create中注册一次）
    if (this._gKeyJustDown
        && this.player.x > 1900 && this.player.x < 2400
        && !this.cableCarUsed && !this.player.isTalking) {
      if (!this.cableCarShown) this.showCableCarPanel();
    }
    this._gKeyJustDown = false;

    // 敌人AI
    this.enemies.getChildren().forEach(enemy => {
      if (!enemy.active) return;
      if (enemy.isBoss) {
        if (enemy.x < enemy.patrolMinX) { enemy.x = enemy.patrolMinX; if (enemy.body.velocity.x < 0) enemy.setVelocityX(0); }
        else if (enemy.x > enemy.patrolMaxX) { enemy.x = enemy.patrolMaxX; if (enemy.body.velocity.x > 0) enemy.setVelocityX(0); }
      }
      if (enemy.isBoss && (enemy.isCharging || enemy.isJumping)) return;
      if (enemy.isBoss) {
        const dx = this.player.x - enemy.x;
        if (Math.abs(dx) > 20) enemy.patrolDirection = dx > 0 ? 1 : -1;
      }
      if (enemy.isRanged) {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const now = this.time.now;
        if (dist < 100) {
          const rd = enemy.x < this.player.x ? -1 : 1;
          enemy.setVelocityX(rd * enemy.patrolSpeed); enemy.setFlipX(rd < 0); return;
        }
        if (dist < 430 && now - enemy.lastShootTime > enemy.shootInterval) {
          enemy.lastShootTime = now; this.enemyShootProjectile(enemy);
        }
      }
      if (enemy.x <= enemy.patrolMinX) enemy.patrolDirection = 1;
      else if (enemy.x >= enemy.patrolMaxX) enemy.patrolDirection = -1;
      enemy.setVelocityX(enemy.patrolDirection * (enemy.patrolSpeed || 60));
      enemy.setFlipX(enemy.patrolDirection < 0);
    });

    // BOSS着地冲击
    if (this.boss && this.boss.active && this.boss.isJumping) {
      if (this.boss.jumpLanding && this.boss.body.blocked.down) {
        this.boss.isJumping = false; this.boss.jumpLanding = false;
        this.bossLandingImpact(this.boss);
      }
    }
    if (this.boss && this.boss.active && this.bossLabel) {
      this.bossLabel.setPosition(this.boss.x, this.boss.y - 54);
    }

    // 进入BOSS区
    if (this.boss && this.boss.active && !this.bossEncounterShown && this.player.x >= 6450) {
      this.bossEncounterShown = true;
      this.showLevelBanner('⚡ 天煞将登场！五岳气运最终决战！');
      this.showBossHPBar();
      this.lockBossArena();
    }
    if (this.boss && this.boss.active) { this.updateBossPhase(); this.updateBossHPBar(); }

    // 答题提示
    if (this.quizItems) {
      this.quizItems.getChildren().forEach(scroll => {
        if (scroll._hint && !scroll._used) {
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, scroll.x, scroll.y);
          scroll._hint.setVisible(dist <= 50);
        }
      });
    }

    // 坠落检测
    if (this.player.y > 490) this.respawnPlayer();
    if (this.boss && this.boss.active && this.boss.y > 490) this.respawnBoss();

    // 音乐切换
    if (!this.levelFinished) {
      const enemyNearby = this.enemies.getChildren().some(e => e.active && Math.abs(e.x - this.player.x) < 280);
      const want = enemyNearby ? 'battle' : 'taishan';
      if (want !== this._musicTheme) { this._musicTheme = want; music.play(want); }
    }

    // HUD
    if (this.hud && this.hud.scene.isActive()) {
      this.hud.setLocation('🏔️ 泰山');
      this.hud.setHealth(this.player.hp, this.player.maxHp);
      this.hud.setWisdom(this.player.wisdomBonus, this.player.getCurrentAttack());

      if (this.quizUI && this.quizUI.isOpen) {
        this.hud.setHint('1-4 / A-D 作答');
      } else if (this.player.isTalking) {
        this.hud.setHint('F：继续对话');
      } else if (nearSage) {
        this.hud.setHint('💰 靠近智者，按 F 交谈，得 200 金币！');
      } else if (nearNpc && !this.npc.complete) {
        this.hud.setHint('靠近道士，按 F 交谈');
      } else if (this.cableCarPanel && !this.player.isTalking) {
        this.hud.setHint('[1] 坐缆车1000🪙 | [2] 徒步18盘（免费）');
      } else if (this.player.x > 1900 && this.player.x < 2400 && !this.cableCarUsed) {
        const coins = skillSystem.getCoins();
        this.hud.setHint(`🚡 缆车站：G键 | 当前金币：${coins}🪙`);
      } else if (this.boss && this.boss.active && Math.abs(this.player.x - this.boss.x) < 500) {
        const ph = this.boss.phase;
        const hint = ph === 3 ? '💀 雷霆！躲落雷·X护体·J/N/C攻击'
                   : ph === 2 ? '⚡ 第二阶段！避戟气·X护体·J攻击'
                   : '⚡ 天煞将！J攻击·X护体·Z/C/N技能';
        this.hud.setHint(hint);
      } else if (this.portalActive && Math.abs(this.player.x - this.portal.x) < 100) {
        this.hud.setHint('走进传送门，五岳旅程圆满！🌟');
      } else if (this.awaitingCrystalPickup) {
        this.hud.setHint('🐉 前往供台，拾取青龙晶！');
      } else if (
        this.player.x > PAN_START_X && this.player.x < PAN_START_X + PAN_COUNT * PAN_WIDTH
      ) {
        const panNum = Math.min(PAN_COUNT, Math.floor((this.player.x - PAN_START_X) / PAN_WIDTH) + 1);
        this.hud.setHint(`⬆ 第${panNum}盘  ·  继续攀登！`);
      } else {
        this.hud.setHint('J 攻击  |  继续前行  |  寻找智者获取金币');
      }
    }
  }
}







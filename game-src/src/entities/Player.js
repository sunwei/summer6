// This file defines XiaoBei: movement, jumping, attacking, skill use, and hotbar selection.
import * as Phaser from 'phaser';
import { PLAYER_SPEED, JUMP_VELOCITY, ITEMS } from '../constants.js';
import { bus, EVENTS } from '../events.js';
import { weaponSystem, WEAPONS } from '../systems/WeaponSystem.js';
import { sfx } from '../systems/SoundFX.js';

const PLAYER_STATES = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  JUMPING: 'JUMPING',
  FALLING: 'FALLING',
  ATTACKING: 'ATTACKING',
  TALKING: 'TALKING',
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_idle');

    this.scene = scene;
    this.speed = PLAYER_SPEED;
    this.jumpVelocity = JUMP_VELOCITY;
    this.hp = 100;
    this.maxHp = 100;
    this.attackBonus = 0;
    this.wisdomBonus = 0;
    this.skills = {};
    this.isAttacking = false;
    this.isTalking = false;
    this.facingRight = true;
    this.state = PLAYER_STATES.IDLE;
    this.nextAttackTime = 0;
    this.invulnerableUntil = 0;
    this.shieldActiveUntil = 0;
    this.shieldCooldownUntil = 0;
    this.huanglongCooldown = 0;   // 黄龙震地冷却
    this.baihuCooldown = 0;       // 白虎裂空冷却
    this.yijinjingCooldown = 0;   // 易筋经冷却
    this.yijinjingCharging = false;      // 正在蓄力中
    this.yijinjingChargeStart = 0;       // 开始蓄力的时间戳
    this.yijinjingActive = false;        // buff生效中
    this.yijinjingActiveUntil = 0;       // buff到期时间
    this.attackMultiplier = 1;           // 攻击力倍率（易筋经激活时=2）
    this._yijinjingChargeVisual = null;  // 蓄力光圈
    this._yijinjingAura = null;          // buff激活时的金色光环
    this.lastTrailTime = 0;
    this.skillCooldown = 0;
    this.guardRing = null;
    this.activeWeapon = 'palm';
    this.swordCharging = false;       // J长按蓄力中
    this.swordChargeStart = 0;
    this.swordSpinFired = false;
    this.swordSpinCooldown = 0;       // 旋转斩冷却到期时间
    this._swordChargeVisual = null;
    this.staffCharging = false;       // J长按蓄力中（禅杖模式）
    this.staffChargeStart = 0;
    this.staffSpinFired = false;
    this.staffSpinCooldown = 0;       // 禅杖旋风扫冷却到期时间
    this._staffChargeVisual = null;
    this.bladeCharging = false;       // J长按蓄力中（玄武战刀模式）
    this.bladeChargeStart = 0;
    this.bladeSlamFired = false;
    this.bladeSlamCooldown = 0;       // 玄武盾斩冷却到期时间
    this._bladeChargeVisual = null;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setSize(18, 42);
    this.body.setOffset(7, 6);

    this.createAnimations();
    this.createControls();

    bus.emit(EVENTS.PLAYER_HURT, { hp: this.hp, maxHp: this.maxHp, wisdom: this.wisdomBonus, attack: this.getCurrentAttack() });
  }

  createAnimations() {
    if (!this.scene.anims.exists('player_run')) {
      this.scene.anims.create({
        key: 'player_run',
        frames: [{ key: 'player_run_1' }, { key: 'player_run_2' }],
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  createControls() {
    this.keys = this.scene.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.W,
      altLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      altRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      altUp: Phaser.Input.Keyboard.KeyCodes.UP,
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      attack: Phaser.Input.Keyboard.KeyCodes.J,
      skill_zhuque: Phaser.Input.Keyboard.KeyCodes.Z,
      skill_xuanwu: Phaser.Input.Keyboard.KeyCodes.X,
      skill_huanglong: Phaser.Input.Keyboard.KeyCodes.C,  // 黄龙震地
      skill_yijinjing: Phaser.Input.Keyboard.KeyCodes.V,  // 易筋经爆发
      skill_baihu: Phaser.Input.Keyboard.KeyCodes.N,      // 白虎裂空
      weaponSwitch: Phaser.Input.Keyboard.KeyCodes.Q,     // 切换武器
      interact: Phaser.Input.Keyboard.KeyCodes.F,
      interactAlt: Phaser.Input.Keyboard.KeyCodes.E,
      backpack: Phaser.Input.Keyboard.KeyCodes.B,
    });
  }

  syncSkills(inventoryState) {
    this.skills[ITEMS.CRYSTAL_ZHUQUE]    = !!inventoryState[ITEMS.CRYSTAL_ZHUQUE];
    this.skills[ITEMS.CRYSTAL_XUANWU]    = !!inventoryState[ITEMS.CRYSTAL_XUANWU];
    this.skills[ITEMS.CRYSTAL_HUANGLONG] = !!inventoryState[ITEMS.CRYSTAL_HUANGLONG];
    this.skills[ITEMS.CRYSTAL_BAIHU]     = !!inventoryState[ITEMS.CRYSTAL_BAIHU];
    this.skills[ITEMS.SKILL_TAIJI]       = !!inventoryState[ITEMS.SKILL_TAIJI];
    this.skills[ITEMS.SKILL_YIJINJING]   = !!inventoryState[ITEMS.SKILL_YIJINJING];
    this.skills[ITEMS.TAIJI_SWORD]       = !!inventoryState[ITEMS.TAIJI_SWORD];
    this.skills[ITEMS.CHAN_STAFF]        = !!inventoryState[ITEMS.CHAN_STAFF];
    this.skills[ITEMS.XUANWU_BLADE]     = !!inventoryState[ITEMS.XUANWU_BLADE];
    // 若当前所持武器已不再解锁，重置为拳模式
    if (this.activeWeapon === 'sword' && !this.skills[ITEMS.TAIJI_SWORD]) this.activeWeapon = 'palm';
    if (this.activeWeapon === 'staff' && !this.skills[ITEMS.CHAN_STAFF]) this.activeWeapon = 'palm';
    if (this.activeWeapon === 'blade' && !this.skills[ITEMS.XUANWU_BLADE]) this.activeWeapon = 'palm';
  }

  isGuarding() {
    return this.scene.time.now < this.shieldActiveUntil;
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.backpack)) {
      console.log('open backpack');
    }

    if (this.guardRing) {
      this.guardRing.setPosition(this.x, this.y - 6);
      this.guardRing.setVisible(this.isGuarding());
    }

    // 易筋经 buff 光环跟随玩家
    if (this._yijinjingAura && this._yijinjingAura.active) {
      this._yijinjingAura.setPosition(this.x, this.y - 8);
    }
    // 太极旋斩蓄力光圈跟随（在 updateSwordCharge 里更新）
    if (this._swordChargeVisual && this._swordChargeVisual.active) {
      this._swordChargeVisual.setPosition(this.x, this.y - 6);
    }
    // 禅杖旋风蓄力光圈跟随（在 updateStaffCharge 里更新）
    if (this._staffChargeVisual && this._staffChargeVisual.active) {
      this._staffChargeVisual.setPosition(this.x, this.y - 6);
    }
    // 玄武刀蓄力光圈跟随（在 updateBladeCharge 里更新）
    if (this._bladeChargeVisual && this._bladeChargeVisual.active) {
      this._bladeChargeVisual.setPosition(this.x, this.y - 6);
    }

    if (this.isTalking) {
      this.state = PLAYER_STATES.TALKING;
      this.anims.stop();
      this.setVelocityX(0);
      this.setTexture('player_idle');
      return;
    }

    // J key — 攻击
    // 剑模式：短按=普通斩，长按1秒（冷却完毕）=太极旋斩
    // 禅杖模式：短按=普通挥杖，长按1秒（冷却完毕）=禅杖旋风扫
    // 刀模式：短按=刀斩，长按1秒（冷却完毕）=玄武盾斩
    // 拳模式：短按=拳击+元气弹
    {
      const now = this.scene.time.now;
      const attackJustDown = Phaser.Input.Keyboard.JustDown(this.keys.attack);
      const attackJustUp   = Phaser.Input.Keyboard.JustUp(this.keys.attack);
      const useSwordMode   = this.activeWeapon === 'sword' && this.skills[ITEMS.TAIJI_SWORD];
      const useStaffMode   = this.activeWeapon === 'staff' && this.skills[ITEMS.CHAN_STAFF];
      const useBladeMode   = this.activeWeapon === 'blade' && this.skills[ITEMS.XUANWU_BLADE];

      if (useSwordMode) {
        // 开始蓄力
        if (attackJustDown && !this.swordCharging && !this.isAttacking) {
          this.swordCharging = true;
          this.swordSpinFired = false;
          this.swordChargeStart = now;
          if (now >= this.swordSpinCooldown) this.startSwordCharge();
        }

        if (this.swordCharging) {
          const elapsed = now - this.swordChargeStart;
          const canSpin = now >= this.swordSpinCooldown;
          if (canSpin) this.updateSwordCharge(Math.min(elapsed / 1000, 1.0));

          if (attackJustUp) {
            // 短按松开 → 普通剑斩
            this.swordCharging = false;
            if (canSpin) this.cancelSwordCharge();
            this.basicAttack();
          } else if (canSpin && elapsed >= 1000 && !this.swordSpinFired) {
            // 满1秒 → 太极旋斩
            this.swordSpinFired = true;
            this.swordCharging = false;
            this.cancelSwordCharge();
            this.activateSwordSpin();
          }
        }
      } else if (useStaffMode) {
        // 开始蓄力
        if (attackJustDown && !this.staffCharging && !this.isAttacking) {
          this.staffCharging = true;
          this.staffSpinFired = false;
          this.staffChargeStart = now;
          if (now >= this.staffSpinCooldown) this.startStaffCharge();
        }

        if (this.staffCharging) {
          const elapsed = now - this.staffChargeStart;
          const canWhirl = now >= this.staffSpinCooldown;
          if (canWhirl) this.updateStaffCharge(Math.min(elapsed / 1000, 1.0));

          if (attackJustUp) {
            // 短按松开 → 普通挥杖
            this.staffCharging = false;
            if (canWhirl) this.cancelStaffCharge();
            this.basicAttack();
          } else if (canWhirl && elapsed >= 1000 && !this.staffSpinFired) {
            // 满1秒 → 禅杖旋风扫
            this.staffSpinFired = true;
            this.staffCharging = false;
            this.cancelStaffCharge();
            this.activateStaffWhirl();
          }
        }
      } else if (useBladeMode) {
        // 开始蓄力
        if (attackJustDown && !this.bladeCharging && !this.isAttacking) {
          this.bladeCharging = true;
          this.bladeSlamFired = false;
          this.bladeChargeStart = now;
          if (now >= this.bladeSlamCooldown) this.startBladeCharge();
        }

        if (this.bladeCharging) {
          const elapsed = now - this.bladeChargeStart;
          const canSlam = now >= this.bladeSlamCooldown;
          if (canSlam) this.updateBladeCharge(Math.min(elapsed / 1000, 1.0));

          if (attackJustUp) {
            // 短按松开 → 普通刀斩
            this.bladeCharging = false;
            if (canSlam) this.cancelBladeCharge();
            this.basicAttack();
          } else if (canSlam && elapsed >= 1000 && !this.bladeSlamFired) {
            // 满1秒 → 玄武盾斩
            this.bladeSlamFired = true;
            this.bladeCharging = false;
            this.cancelBladeCharge();
            this.activateBladeSlam();
          }
        }
      } else {
        // 拳模式
        if (attackJustDown) this.basicAttack();
      }
    }

    // Q key — 武器切换（依次循环：拳 → 剑（若持有）→ 禅杖（若持有）→ 刀（若持有）→ 拳）
    if ((this.skills[ITEMS.TAIJI_SWORD] || this.skills[ITEMS.CHAN_STAFF] || this.skills[ITEMS.XUANWU_BLADE]) && Phaser.Input.Keyboard.JustDown(this.keys.weaponSwitch)) {
      this.cycleWeapon();
    }

    // Z key — 朱雀烈炎
    if (this.skills[ITEMS.CRYSTAL_ZHUQUE] && Phaser.Input.Keyboard.JustDown(this.keys.skill_zhuque)) {
      this.activateCrystalSkill('zhuque');
    }

    // X key — 玄武护体
    if (this.skills[ITEMS.CRYSTAL_XUANWU] && Phaser.Input.Keyboard.JustDown(this.keys.skill_xuanwu)) {
      this.useXuanwuShield();
    }

    // C key — 黄龙震地
    if (this.skills[ITEMS.CRYSTAL_HUANGLONG] && Phaser.Input.Keyboard.JustDown(this.keys.skill_huanglong)) {
      this.activateHuanglongStrike();
    }

    // N key — 白虎裂空
    if (this.skills[ITEMS.CRYSTAL_BAIHU] && Phaser.Input.Keyboard.JustDown(this.keys.skill_baihu)) {
      this.activateBaihuStrike();
    }

    // V key — 易筋经（长按1秒蓄力，松手前取消，满1秒自动激活，攻击力x2持续6秒）
    if (this.skills[ITEMS.SKILL_YIJINJING]) {
      const now = this.scene.time.now;
      const vDown = this.keys.skill_yijinjing.isDown;

      // 触发蓄力：未蓄力、未激活、冷却完毕、非对话
      if (vDown && !this.isTalking && !this.yijinjingCharging && !this.yijinjingActive
          && now >= this.yijinjingCooldown) {
        this.yijinjingCharging = true;
        this.yijinjingChargeStart = now;
        this.startYijinjingCharge();
      }

      if (this.yijinjingCharging) {
        const elapsed = now - this.yijinjingChargeStart;
        const progress = Math.min(elapsed / 1000, 1.0);
        this.updateYijinjingCharge(progress);

        if (!vDown) {
          // 松手未满1秒 → 取消
          this.cancelYijinjingCharge();
        } else if (elapsed >= 1000) {
          // 蓄力满1秒 → 激活
          this.activateYijinjing();
        }
      }
    }

    if (!this.isAttacking) {
      // 蓄力中也可移动（swordCharging / yijinjingCharging 均不设 isAttacking）
      this.handleMovement();
    }

    this.updateStateAndAnimation();
    this.leaveTrailWhenRunning();
  }

  handleMovement() {
    const moveLeft = this.keys.left.isDown || this.keys.altLeft.isDown;
    const moveRight = this.keys.right.isDown || this.keys.altRight.isDown;
    const wantsJump =
      Phaser.Input.Keyboard.JustDown(this.keys.jump) ||
      Phaser.Input.Keyboard.JustDown(this.keys.up) ||
      Phaser.Input.Keyboard.JustDown(this.keys.altUp);
    const onGround = this.body.blocked.down || this.body.touching.down;

    if (moveLeft === moveRight) {
      this.setVelocityX(0);
    } else if (moveLeft) {
      this.setVelocityX(-this.speed);
      this.setFlipX(true);
      this.facingRight = false;
    } else if (moveRight) {
      this.setVelocityX(this.speed);
      this.setFlipX(false);
      this.facingRight = true;
    }

    if (wantsJump && onGround) {
      this.setVelocityY(this.jumpVelocity);
      sfx.play('jump');
    }
  }

  updateStateAndAnimation() {
    if (this.isAttacking) {
      this.state = PLAYER_STATES.ATTACKING;
      this.anims.stop();
      this.setTexture('player_attack');
      return;
    }

    if (!this.body.blocked.down && this.body.velocity.y < 0) {
      this.state = PLAYER_STATES.JUMPING;
      this.anims.stop();
      this.setTexture('player_jump');
      return;
    }

    if (!this.body.blocked.down && this.body.velocity.y >= 0) {
      this.state = PLAYER_STATES.FALLING;
      this.anims.stop();
      this.setTexture('player_jump');
      return;
    }

    if (Math.abs(this.body.velocity.x) > 4) {
      this.state = PLAYER_STATES.RUNNING;
      this.play('player_run', true);
      return;
    }

    this.state = PLAYER_STATES.IDLE;
    this.anims.stop();
    this.setTexture('player_idle');
  }

  basicAttack() {
    if (this.isAttacking || this.scene.time.now < this.nextAttackTime || this.isTalking) {
      return;
    }

    this.isAttacking = true;
    this.nextAttackTime = this.scene.time.now + 280;
    this.anims.stop();
    // 剑/禅杖模式短按时保留移动惯性（蓄力中松开不停步）
    if (!this.swordCharging && !this.staffCharging) this.setVelocityX(0);
    this.setTexture('player_attack');
    sfx.play('attack');

    // 根据当前武器模式选择伤害/范围
    const useSword = this.activeWeapon === 'sword' && this.skills[ITEMS.TAIJI_SWORD];
    const useStaff = this.activeWeapon === 'staff' && this.skills[ITEMS.CHAN_STAFF];
    const useBlade = this.activeWeapon === 'blade' && this.skills[ITEMS.XUANWU_BLADE];
    const weaponKey = useSword ? WEAPONS.TAIJI_SWORD : useStaff ? WEAPONS.CHAN_STAFF : useBlade ? WEAPONS.XUANWU_BLADE : WEAPONS.MELEE;
    const ms = weaponSystem.calc(weaponKey, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
    const finalDamage = Math.round(ms.damage * this.attackMultiplier);
    const hitboxX = this.x + (this.facingRight ? ms.range : -ms.range);
    const hitbox = this.scene.add.zone(hitboxX, this.y - 4, ms.range * 2, ms.height);
    this.scene.physics.add.existing(hitbox);
    hitbox.body.setAllowGravity(false);
    hitbox.body.moves = false;

    if (this.scene.enemies) {
      this.scene.physics.world.overlap(hitbox, this.scene.enemies, (_zone, enemy) => {
        if (this.scene.damageEnemy) {
          this.scene.damageEnemy(enemy, finalDamage);
          return;
        }
        this.scene.defeatEnemy(enemy);
      });
    }

    // 太极剑：金色斩击特效 / 禅杖：金环挥杖特效 / 玄武刀：暗蓝刀斩特效
    if (useSword) {
      this.showSwordSlash();
    } else if (useStaff) {
      this.showStaffSwing();
    } else if (useBlade) {
      this.showBladeSlash();
    }

    this.scene.time.delayedCall(100, () => hitbox.destroy());
    this.scene.time.delayedCall(200, () => { this.isAttacking = false; });

    // 八卦拳模式下且已习得太极拳才发射元气弹
    if (!useSword && !useStaff && !useBlade && this.skills[ITEMS.SKILL_TAIJI]) {
      this.shootBaguaOrb();
    }
  }

  // 依次循环武器：拳 → 剑（若持有）→ 禅杖（若持有）→ 刀（若持有）→ 拳
  cycleWeapon() {
    const order = ['palm'];
    if (this.skills[ITEMS.TAIJI_SWORD]) order.push('sword');
    if (this.skills[ITEMS.CHAN_STAFF]) order.push('staff');
    if (this.skills[ITEMS.XUANWU_BLADE]) order.push('blade');
    const idx = order.indexOf(this.activeWeapon);
    this.activeWeapon = order[(idx + 1) % order.length];
    this.showWeaponNotice();
  }

  // 武器切换提示
  showWeaponNotice() {
    const scene = this.scene;
    const label = this.activeWeapon === 'sword' ? '⚔️ 太极剑'
                : this.activeWeapon === 'staff' ? '🦯 少林禅杖'
                : this.activeWeapon === 'blade' ? '🗡️ 玄武战刀'
                : '☯ 太极八卦掌';
    const color = this.activeWeapon === 'sword' ? '#ffd700'
                : this.activeWeapon === 'staff' ? '#daa520'
                : this.activeWeapon === 'blade' ? '#7ef7c6'
                : '#88eeff';
    const notice = scene.add.text(this.x, this.y - 52, label, {
      fontSize: '18px', color, stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(500);
    scene.tweens.add({
      targets: notice, alpha: 0, y: notice.y - 22,
      duration: 900, onComplete: () => notice.destroy(),
    });
  }

  // ── 太极旋斩（剑模式长按1秒）──────────────────────────────

  // 开始蓄力：生成光圈
  startSwordCharge() {
    if (this._swordChargeVisual) this._swordChargeVisual.destroy();
    const scene = this.scene;
    const container = scene.add.container(this.x, this.y - 6);
    container.setDepth(this.depth + 1);
    this._swordChargeOuter = scene.add.circle(0, 0, 8, 0xffd700, 0).setStrokeStyle(3, 0xffd700, 0.85);
    this._swordChargeInner = scene.add.circle(0, 0, 4, 0xffffff, 0.3);
    container.add([this._swordChargeInner, this._swordChargeOuter]);
    this._swordChargeVisual = container;
  }

  // 每帧更新蓄力光圈（progress: 0~1）
  updateSwordCharge(progress) {
    if (!this._swordChargeVisual || !this._swordChargeVisual.active) return;
    const r = 8 + progress * 30;
    this._swordChargeOuter.setRadius(r).setAlpha(0.5 + progress * 0.5);
    this._swordChargeInner.setRadius(3 + progress * 9).setAlpha(progress * 0.75);
    if (progress >= 0.85) {
      this._swordChargeVisual.setAlpha(0.55 + Math.sin(Date.now() * 0.024) * 0.45);
    }
  }

  // 取消蓄力（松手 / 受击）
  cancelSwordCharge() {
    this.swordCharging = false;
    if (this._swordChargeVisual) {
      const cv = this._swordChargeVisual;
      this._swordChargeVisual = null;
      this.scene.tweens.add({
        targets: cv, alpha: 0, duration: 160,
        onComplete: () => { if (cv && cv.active) cv.destroy(); },
      });
    }
  }

  // 太极旋斩（长按1秒后触发）
  activateSwordSpin() {
    if (this.isAttacking || this.isTalking) return;
    this.isAttacking = true;
    this.swordSpinCooldown = this.scene.time.now + 3000;
    this.setTexture('player_attack');
    sfx.play('attack');

    const scene = this.scene;
    const spinRadius = 80;
    const spinDamage = Math.round(70 * this.attackMultiplier); // 旋转斩伤害（x2，可叠加易筋经buff）

    // 提示文字
    const notice = scene.add.text(this.x, this.y - 62, '⚔️ 太极旋斩！', {
      fontSize: '17px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(500);
    scene.tweens.add({ targets: notice, alpha: 0, y: notice.y - 28, duration: 900, onComplete: () => notice.destroy() });

    // 扩散冲击环
    const ring1 = scene.add.circle(this.x, this.y - 8, 8, 0xffd700, 0)
      .setStrokeStyle(4, 0xffd700, 0.95).setDepth(this.depth + 2);
    scene.tweens.add({ targets: ring1, scale: { from: 0.6, to: spinRadius / 8 * 1.1 }, alpha: 0, duration: 480, ease: 'Quad.easeOut', onComplete: () => ring1.destroy() });

    const ring2 = scene.add.circle(this.x, this.y - 8, 6, 0xffffff, 0)
      .setStrokeStyle(2, 0xffd700, 0.7).setDepth(this.depth + 2);
    scene.tweens.add({ targets: ring2, scale: { from: 1, to: spinRadius / 6 * 1.4 }, alpha: 0, duration: 620, ease: 'Cubic.easeOut', onComplete: () => ring2.destroy() });

    // 8道旋转剑气
    const slashCount = 8;
    for (let i = 0; i < slashCount; i++) {
      const angle = (i / slashCount) * Math.PI * 2;
      const delay = (i / slashCount) * 350;
      scene.time.delayedCall(delay, () => {
        if (!this.active) return;
        const sx = this.x + Math.cos(angle) * spinRadius * 0.55;
        const sy = (this.y - 8) + Math.sin(angle) * spinRadius * 0.45;
        const slash = scene.add.rectangle(sx, sy, 40, 7, 0xffd700, 0.92)
          .setDepth(this.depth + 3).setRotation(angle);
        const glow = scene.add.rectangle(sx, sy, 52, 12, 0xffffff, 0.35)
          .setDepth(this.depth + 2).setRotation(angle);
        scene.tweens.add({ targets: [slash, glow], alpha: 0, scaleX: 2.2, scaleY: 0.3, duration: 230, ease: 'Quad.easeOut', onComplete: () => { slash.destroy(); glow.destroy(); } });
      });
    }

    // 判断伤害（100ms后，覆盖整个旋转范围）
    scene.time.delayedCall(100, () => {
      if (!scene || !scene.enemies) return;
      scene.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
        if (dist <= spinRadius + 16) {
          if (scene.damageEnemy) scene.damageEnemy(enemy, spinDamage);
        }
      });
    });

    // 轻微震屏
    scene.cameras.main.shake(140, 0.006);

    // 结束攻击状态
    scene.time.delayedCall(520, () => { this.isAttacking = false; });
  }

  // 太极八卦剑斩击光效
  showSwordSlash() {
    const scene = this.scene;
    const dir = this.facingRight ? 1 : -1;
    const sx = this.x + dir * 38;
    const sy = this.y - 10;

    const slash = scene.add.rectangle(sx, sy, 66, 54, 0xffd700, 0.55)
      .setDepth(this.depth + 1).setRotation(dir > 0 ? -0.28 : 0.28);
    scene.tweens.add({ targets: slash, alpha: 0, scaleX: 1.7, scaleY: 1.4, duration: 140, ease: 'Quad.easeOut', onComplete: () => slash.destroy() });

    const streak = scene.add.rectangle(sx - dir * 8, sy + 4, 52, 5, 0xffffff, 0.92)
      .setDepth(this.depth + 2).setRotation(dir > 0 ? -0.48 : 0.48);
    scene.tweens.add({ targets: streak, alpha: 0, scaleX: 1.6, duration: 100, onComplete: () => streak.destroy() });
  }

  // ── 禅杖旋风扫（禅杖模式长按1秒）──────────────────────────────

  // 开始蓄力：生成光圈
  startStaffCharge() {
    if (this._staffChargeVisual) this._staffChargeVisual.destroy();
    const scene = this.scene;
    const container = scene.add.container(this.x, this.y - 6);
    container.setDepth(this.depth + 1);
    this._staffChargeOuter = scene.add.circle(0, 0, 8, 0xdaa520, 0).setStrokeStyle(3, 0xdaa520, 0.85);
    this._staffChargeInner = scene.add.circle(0, 0, 4, 0xffe066, 0.3);
    container.add([this._staffChargeInner, this._staffChargeOuter]);
    this._staffChargeVisual = container;
  }

  // 每帧更新蓄力光圈（progress: 0~1）
  updateStaffCharge(progress) {
    if (!this._staffChargeVisual || !this._staffChargeVisual.active) return;
    const r = 8 + progress * 34;
    this._staffChargeOuter.setRadius(r).setAlpha(0.5 + progress * 0.5);
    this._staffChargeInner.setRadius(3 + progress * 10).setAlpha(progress * 0.75);
    if (progress >= 0.85) {
      this._staffChargeVisual.setAlpha(0.55 + Math.sin(Date.now() * 0.024) * 0.45);
    }
  }

  // 取消蓄力（松手 / 受击）
  cancelStaffCharge() {
    this.staffCharging = false;
    if (this._staffChargeVisual) {
      const cv = this._staffChargeVisual;
      this._staffChargeVisual = null;
      this.scene.tweens.add({
        targets: cv, alpha: 0, duration: 160,
        onComplete: () => { if (cv && cv.active) cv.destroy(); },
      });
    }
  }

  // 禅杖旋风扫（长按1秒后触发，范围比太极旋斩更广）
  activateStaffWhirl() {
    if (this.isAttacking || this.isTalking) return;
    this.isAttacking = true;
    this.staffSpinCooldown = this.scene.time.now + 3200;
    this.setTexture('player_attack');
    sfx.play('attack');

    const scene = this.scene;
    const whirlRadius = 96; // 禅杖较长，旋风范围优于太极旋斩
    const whirlDamage = Math.round(60 * this.attackMultiplier); // 单次范围伤害略低于旋斩，但覆盖更广

    // 提示文字
    const notice = scene.add.text(this.x, this.y - 62, '🦯 禅杖旋风扫！', {
      fontSize: '17px', color: '#daa520', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(500);
    scene.tweens.add({ targets: notice, alpha: 0, y: notice.y - 28, duration: 900, onComplete: () => notice.destroy() });

    // 扩散冲击环
    const ring1 = scene.add.circle(this.x, this.y - 8, 8, 0xdaa520, 0)
      .setStrokeStyle(4, 0xdaa520, 0.95).setDepth(this.depth + 2);
    scene.tweens.add({ targets: ring1, scale: { from: 0.6, to: whirlRadius / 8 * 1.1 }, alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => ring1.destroy() });

    const ring2 = scene.add.circle(this.x, this.y - 8, 6, 0xffe066, 0)
      .setStrokeStyle(2, 0xdaa520, 0.7).setDepth(this.depth + 2);
    scene.tweens.add({ targets: ring2, scale: { from: 1, to: whirlRadius / 6 * 1.4 }, alpha: 0, duration: 660, ease: 'Cubic.easeOut', onComplete: () => ring2.destroy() });

    // 10道旋转杖影（比太极旋斩多两道，呼应禅杖更长的覆盖范围）
    const slashCount = 10;
    for (let i = 0; i < slashCount; i++) {
      const angle = (i / slashCount) * Math.PI * 2;
      const delay = (i / slashCount) * 380;
      scene.time.delayedCall(delay, () => {
        if (!this.active) return;
        const sx = this.x + Math.cos(angle) * whirlRadius * 0.55;
        const sy = (this.y - 8) + Math.sin(angle) * whirlRadius * 0.45;
        const slash = scene.add.rectangle(sx, sy, 44, 7, 0xdaa520, 0.92)
          .setDepth(this.depth + 3).setRotation(angle);
        const glow = scene.add.rectangle(sx, sy, 56, 12, 0xffe066, 0.35)
          .setDepth(this.depth + 2).setRotation(angle);
        scene.tweens.add({ targets: [slash, glow], alpha: 0, scaleX: 2.2, scaleY: 0.3, duration: 240, ease: 'Quad.easeOut', onComplete: () => { slash.destroy(); glow.destroy(); } });
      });
    }

    // 判断伤害（110ms后，覆盖整个旋风范围）
    scene.time.delayedCall(110, () => {
      if (!scene || !scene.enemies) return;
      scene.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
        if (dist <= whirlRadius + 18) {
          if (scene.damageEnemy) scene.damageEnemy(enemy, whirlDamage);
        }
      });
    });

    // 轻微震屏
    scene.cameras.main.shake(150, 0.007);

    // 结束攻击状态
    scene.time.delayedCall(540, () => { this.isAttacking = false; });
  }

  // 少林禅杖挥击光效（普通攻击）
  showStaffSwing() {
    const scene = this.scene;
    const dir = this.facingRight ? 1 : -1;
    const sx = this.x + dir * 40;
    const sy = this.y - 8;

    const swing = scene.add.rectangle(sx, sy, 70, 50, 0xdaa520, 0.5)
      .setDepth(this.depth + 1).setRotation(dir > 0 ? -0.24 : 0.24);
    scene.tweens.add({ targets: swing, alpha: 0, scaleX: 1.6, scaleY: 1.3, duration: 150, ease: 'Quad.easeOut', onComplete: () => swing.destroy() });

    const streak = scene.add.rectangle(sx - dir * 6, sy + 4, 54, 5, 0xffe066, 0.9)
      .setDepth(this.depth + 2).setRotation(dir > 0 ? -0.42 : 0.42);
    scene.tweens.add({ targets: streak, alpha: 0, scaleX: 1.5, duration: 110, onComplete: () => streak.destroy() });
  }

  // ── 玄武战刀（刀模式蓄力 / 普通刀斩 / 玄武盾斩）──────────────

  // 玄武刀普通斩击光效
  showBladeSlash() {
    const scene = this.scene;
    const dir = this.facingRight ? 1 : -1;
    const sx = this.x + dir * 42;
    const sy = this.y - 8;

    const slash = scene.add.rectangle(sx, sy, 74, 56, 0x26c6da, 0.52)
      .setDepth(this.depth + 1).setRotation(dir > 0 ? -0.22 : 0.22);
    scene.tweens.add({ targets: slash, alpha: 0, scaleX: 1.7, scaleY: 1.4, duration: 145, ease: 'Quad.easeOut', onComplete: () => slash.destroy() });

    const streak1 = scene.add.rectangle(sx - dir * 7, sy + 3, 58, 5, 0x00e5ff, 0.92)
      .setDepth(this.depth + 2).setRotation(dir > 0 ? -0.44 : 0.44);
    scene.tweens.add({ targets: streak1, alpha: 0, scaleX: 1.6, duration: 105, onComplete: () => streak1.destroy() });

    const streak2 = scene.add.rectangle(sx - dir * 4, sy + 12, 46, 3, 0x00e5ff, 0.65)
      .setDepth(this.depth + 2).setRotation(dir > 0 ? -0.5 : 0.5);
    scene.tweens.add({ targets: streak2, alpha: 0, scaleX: 1.4, duration: 95, onComplete: () => streak2.destroy() });
  }

  // 开始玄武刀蓄力光圈
  startBladeCharge() {
    if (this._bladeChargeVisual) this._bladeChargeVisual.destroy();
    const scene = this.scene;
    const container = scene.add.container(this.x, this.y - 6);
    container.setDepth(this.depth + 1);
    this._bladeChargeOuter = scene.add.circle(0, 0, 8, 0x26c6da, 0).setStrokeStyle(3, 0x00e5ff, 0.85);
    this._bladeChargeInner = scene.add.circle(0, 0, 4, 0xb2ebf2, 0.3);
    container.add([this._bladeChargeInner, this._bladeChargeOuter]);
    this._bladeChargeVisual = container;
  }

  // 每帧更新玄武刀蓄力光圈（progress: 0~1）
  updateBladeCharge(progress) {
    if (!this._bladeChargeVisual || !this._bladeChargeVisual.active) return;
    const r = 8 + progress * 30;
    this._bladeChargeOuter.setRadius(r).setAlpha(0.5 + progress * 0.5);
    this._bladeChargeInner.setRadius(3 + progress * 9).setAlpha(progress * 0.75);
    if (progress >= 0.85) {
      this._bladeChargeVisual.setAlpha(0.55 + Math.sin(Date.now() * 0.024) * 0.45);
    }
  }

  // 取消玄武刀蓄力
  cancelBladeCharge() {
    this.bladeCharging = false;
    if (this._bladeChargeVisual) {
      const cv = this._bladeChargeVisual;
      this._bladeChargeVisual = null;
      this.scene.tweens.add({
        targets: cv, alpha: 0, duration: 160,
        onComplete: () => { if (cv && cv.active) cv.destroy(); },
      });
    }
  }

  // 玄武盾斩（长按1秒后触发，前向重型冲击波）
  activateBladeSlam() {
    if (this.isAttacking || this.isTalking) return;
    this.isAttacking = true;
    this.bladeSlamCooldown = this.scene.time.now + 3200;
    this.setTexture('player_attack');
    sfx.play('attack');

    const scene = this.scene;
    const dir = this.facingRight ? 1 : -1;
    const slamRange = 100;
    const slamDamage = Math.round(80 * this.attackMultiplier);

    // 提示文字
    const notice = scene.add.text(this.x, this.y - 62, '🗡️ 玄武盾斩！', {
      fontSize: '17px', color: '#7ef7c6', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(500);
    scene.tweens.add({ targets: notice, alpha: 0, y: notice.y - 28, duration: 900, onComplete: () => notice.destroy() });

    // 龟甲护盾扩散环（暗蓝/青色）
    const ring1 = scene.add.circle(this.x, this.y - 8, 8, 0x26c6da, 0)
      .setStrokeStyle(5, 0x00e5ff, 0.92).setDepth(this.depth + 2);
    scene.tweens.add({ targets: ring1, scale: { from: 0.5, to: slamRange / 8 * 1.2 }, alpha: 0, duration: 460, ease: 'Quad.easeOut', onComplete: () => ring1.destroy() });

    const ring2 = scene.add.circle(this.x, this.y - 8, 5, 0xb2ebf2, 0)
      .setStrokeStyle(2, 0x26c6da, 0.7).setDepth(this.depth + 2);
    scene.tweens.add({ targets: ring2, scale: { from: 1, to: slamRange / 5 * 1.5 }, alpha: 0, duration: 580, ease: 'Cubic.easeOut', onComplete: () => ring2.destroy() });

    // 8道玄武刀气（前向扇形，深蓝色调）
    for (let i = 0; i < 8; i++) {
      const spread = (i / 7) * 0.9 - 0.45;
      const angle = spread;
      const delay = i * 36;
      scene.time.delayedCall(delay, () => {
        if (!this.active) return;
        const sx = this.x + dir * (slamRange * 0.5 + i * 4);
        const sy = this.y - 8 + Math.sin(angle) * slamRange * 0.4;
        const slash = scene.add.rectangle(sx, sy, 48, 8, 0x26c6da, 0.9)
          .setDepth(this.depth + 3).setRotation(dir > 0 ? angle : Math.PI + angle);
        const glow = scene.add.rectangle(sx, sy, 60, 14, 0x00e5ff, 0.32)
          .setDepth(this.depth + 2).setRotation(dir > 0 ? angle : Math.PI + angle);
        scene.tweens.add({ targets: [slash, glow], alpha: 0, scaleX: 2.3, scaleY: 0.25, duration: 220, ease: 'Quad.easeOut', onComplete: () => { slash.destroy(); glow.destroy(); } });
      });
    }

    // 判断伤害（前方扇形范围）
    scene.time.delayedCall(80, () => {
      if (!scene || !scene.enemies) return;
      scene.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const inDir = dir > 0 ? dx > 0 : dx < 0;
        if (dist <= slamRange + 14 && inDir) {
          if (scene.damageEnemy) scene.damageEnemy(enemy, slamDamage);
          // 击退
          enemy.setVelocityX(dir * 280);
        }
      });
    });

    // 震屏
    scene.cameras.main.shake(160, 0.009);

    // 结束攻击状态
    scene.time.delayedCall(540, () => { this.isAttacking = false; });
  }
  shootBaguaOrb() {
    const scene = this.scene;
    const dir = this.facingRight ? 1 : -1;
    const os = weaponSystem.calc(WEAPONS.BAGUA_ORB, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
    const orb = scene.physics.add.image(this.x + dir * 24, this.y - 12, 'bagua_orb');
    orb.setDepth(this.depth + 1);
    orb.setScale(os.scale);
    orb.damage = Math.round(os.damage * this.attackMultiplier);
    sfx.play('bagua_shoot');
    if (scene.playerBullets) scene.playerBullets.add(orb);
    orb.body.setAllowGravity(false);
    orb.body.setVelocity(dir * os.speed, 0);
    scene.tweens.add({ targets: orb, angle: dir > 0 ? 720 : -720, duration: 600, repeat: -1 });
    scene.time.delayedCall(os.durationMs, () => { if (orb.active) orb.destroy(); });
  }

  // 玄武护体（X键）
  useXuanwuShield() {
    if (!this.skills[ITEMS.CRYSTAL_XUANWU]) return;
    if (this.scene.time.now < this.shieldCooldownUntil) return;
    const gs = weaponSystem.calc(WEAPONS.XUANWU_GUARD, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
    this.shieldActiveUntil = this.scene.time.now + gs.durationMs;
    const cdMs = gs.cooldownMs;
    this.shieldCooldownUntil = this.scene.time.now + cdMs;
    bus.emit(EVENTS.SKILL_COOLDOWN, { itemKey: ITEMS.CRYSTAL_XUANWU, duration: cdMs });
    sfx.play('taiji_guard');
    this.showGuardRing(gs.radius, gs.durationMs);
  }

  // 朱雀烈焰（Z键）
  activateCrystalSkill(type) {
    if (this.skillCooldown > this.scene.time.now) return;
    if (type === 'zhuque') {
      const zs = weaponSystem.calc(WEAPONS.ZHUQUE, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
      this.skillCooldown = this.scene.time.now + zs.cooldownMs;
      bus.emit(EVENTS.SKILL_COOLDOWN, { itemKey: ITEMS.CRYSTAL_ZHUQUE, duration: zs.cooldownMs });
      bus.emit(EVENTS.CRYSTAL_SKILL, {
        type: 'zhuque', x: this.x, y: this.y, range: zs.range,
        damage: Math.round(zs.damage * this.attackMultiplier),
      });
      sfx.play('skill_zhuque');
    }
  }

  // 玄武护体光环
  showGuardRing(radius = 28, durationMs = 700) {
    if (this.guardRing) { this.guardRing.destroy(); this.guardRing = null; }
    const scene = this.scene;
    const container = scene.add.container(this.x, this.y - 6);
    container.setDepth(this.depth + 1);
    this.guardRing = container;

    const outerRing = scene.add.circle(0, 0, radius, 0x26c6da, 0.10);
    outerRing.setStrokeStyle(3, 0x00e5ff, 1.0);
    const midRing = scene.add.circle(0, 0, Math.round(radius * 0.72), 0x4dd0e1, 0.08);
    midRing.setStrokeStyle(1.5, 0x26c6da, 0.70);
    const innerGlow = scene.add.circle(0, 0, Math.round(radius * 0.44), 0xb2ebf2, 0.20);
    container.add([innerGlow, midRing, outerRing]);

    const burst = scene.add.circle(this.x, this.y - 6, radius * 0.35, 0x26c6da, 0.55);
    burst.setStrokeStyle(2, 0xb2ebf2, 1.0);
    burst.setDepth(this.depth + 2);
    scene.tweens.add({ targets: burst, scale: { from: 0.3, to: 2.4 }, alpha: 0, duration: 360, ease: 'Cubic.easeOut', onComplete: () => burst.destroy() });

    const pulseTween = scene.tweens.add({ targets: container, scaleX: { from: 1.00, to: 1.10 }, scaleY: { from: 0.92, to: 1.06 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    scene.time.delayedCall(durationMs, () => {
      pulseTween.stop();
      if (container.active) {
        scene.tweens.add({ targets: container, alpha: 0, scale: 1.3, duration: 200, ease: 'Quad.easeOut', onComplete: () => { container.destroy(); if (this.guardRing === container) this.guardRing = null; } });
      }
    });
  }

  // 黄龙震地（C键）
  activateHuanglongStrike() {
    if (this.scene.time.now < this.huanglongCooldown) return;
    const hs = weaponSystem.calc(WEAPONS.HUANGLONG_STRIKE, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
    this.huanglongCooldown = this.scene.time.now + hs.cooldownMs;
    bus.emit(EVENTS.SKILL_COOLDOWN, { itemKey: ITEMS.CRYSTAL_HUANGLONG, duration: hs.cooldownMs });
    bus.emit(EVENTS.CRYSTAL_SKILL, {
      type: 'huanglong',
      x: this.x, y: this.y,
      dir: this.facingRight ? 1 : -1,
      range: hs.range, height: hs.height,
      damage: Math.round(hs.damage * this.attackMultiplier),
    });
    sfx.play('attack');
  }

  // 白虎裂空（N键，华山白虎晶技能）
  activateBaihuStrike() {
    if (this.scene.time.now < this.baihuCooldown) return;
    const bs = weaponSystem.calc(WEAPONS.BAIHU_STRIKE, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
    this.baihuCooldown = this.scene.time.now + bs.cooldownMs;
    bus.emit(EVENTS.SKILL_COOLDOWN, { itemKey: ITEMS.CRYSTAL_BAIHU, duration: bs.cooldownMs });
    bus.emit(EVENTS.CRYSTAL_SKILL, {
      type: 'baihu',
      x: this.x, y: this.y,
      dir: this.facingRight ? 1 : -1,
      range: bs.range, height: bs.height,
      damage: Math.round(bs.damage * this.attackMultiplier),
    });
    sfx.play('attack');
  }

  // 易筋经——长按1秒激活，全攻击x2持续6秒
  activateYijinjing() {
    this.yijinjingCharging = false;
    // 清理蓄力光圈
    if (this._yijinjingChargeVisual) {
      this._yijinjingChargeVisual.destroy();
      this._yijinjingChargeVisual = null;
    }

    const scene = this.scene;
    const now = scene.time.now;

    const ys = weaponSystem.calc(WEAPONS.YIJINJING, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
    this.yijinjingCooldown = now + ys.cooldownMs;
    bus.emit(EVENTS.SKILL_COOLDOWN, { itemKey: ITEMS.SKILL_YIJINJING, duration: ys.cooldownMs });

    // 激活 x2 攻击力 buff（持续6秒）
    const buffDuration = 6000;
    this.yijinjingActive = true;
    this.yijinjingActiveUntil = now + buffDuration;
    this.attackMultiplier = 2;

    sfx.play('attack');

    // 激活爆发特效
    const burst = scene.add.circle(this.x, this.y - 8, 10, 0xff9f43, 0.85).setDepth(this.depth + 2);
    scene.tweens.add({ targets: burst, scale: { from: 0.4, to: 5.5 }, alpha: 0, duration: 550, ease: 'Cubic.easeOut', onComplete: () => burst.destroy() });
    const ring = scene.add.circle(this.x, this.y - 8, 10, 0xff9f43, 0)
      .setStrokeStyle(4, 0xffd700, 1).setDepth(this.depth + 2);
    scene.tweens.add({ targets: ring, scale: { from: 0.8, to: 6.5 }, alpha: 0, duration: 680, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });

    // 激活提示文字
    const notice = scene.add.text(this.x, this.y - 58, '💪 易筋经爆发！攻击力x2！', {
      fontSize: '17px', color: '#ffd700', stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#00000088', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(500);
    scene.tweens.add({ targets: notice, alpha: 0, y: notice.y - 30, duration: 1200, onComplete: () => notice.destroy() });

    // 持续期间的金色光环
    const aura = scene.add.circle(this.x, this.y - 8, 28, 0xff9f43, 0.15)
      .setStrokeStyle(2, 0xffd700, 0.9).setDepth(this.depth);
    this._yijinjingAura = aura;
    const auraTween = scene.tweens.add({
      targets: aura, scale: { from: 1.0, to: 1.22 }, alpha: { from: 0.55, to: 0.85 },
      duration: 380, yoyo: true, repeat: -1,
    });

    // 更新 HUD 显示（攻击力翻倍）
    bus.emit(EVENTS.PLAYER_HURT, { hp: this.hp, maxHp: this.maxHp, wisdom: this.wisdomBonus, attack: this.getCurrentAttack() });

    // buff 到期
    scene.time.delayedCall(buffDuration, () => {
      this.yijinjingActive = false;
      this.attackMultiplier = 1;
      auraTween.stop();
      if (aura && aura.active) aura.destroy();
      if (this._yijinjingAura === aura) this._yijinjingAura = null;

      if (this.active) {
        const endMsg = scene.add.text(this.x, this.y - 48, '易筋经效果结束', {
          fontSize: '14px', color: '#ff9f43', stroke: '#000000', strokeThickness: 2,
          backgroundColor: '#00000066', padding: { x: 5, y: 2 },
        }).setOrigin(0.5).setDepth(500);
        scene.tweens.add({ targets: endMsg, alpha: 0, y: endMsg.y - 20, duration: 900, onComplete: () => endMsg.destroy() });
      }
      bus.emit(EVENTS.PLAYER_HURT, { hp: this.hp, maxHp: this.maxHp, wisdom: this.wisdomBonus, attack: this.getCurrentAttack() });
    });
  }

  // 开始蓄力：创建蓄力光圈
  startYijinjingCharge() {
    if (this._yijinjingChargeVisual) this._yijinjingChargeVisual.destroy();
    const scene = this.scene;
    const container = scene.add.container(this.x, this.y - 6);
    container.setDepth(this.depth + 1);
    this._chargeOuter = scene.add.circle(0, 0, 10, 0xff9f43, 0).setStrokeStyle(3, 0xffd700, 0.9);
    this._chargeInner = scene.add.circle(0, 0, 6, 0xffee44, 0.45);
    container.add([this._chargeInner, this._chargeOuter]);
    this._yijinjingChargeVisual = container;
  }

  // 每帧更新蓄力光圈大小（progress: 0~1）
  updateYijinjingCharge(progress) {
    if (!this._yijinjingChargeVisual) return;
    this._yijinjingChargeVisual.setPosition(this.x, this.y - 6);
    const r = 10 + progress * 30; // 10→40 px
    this._chargeOuter.setRadius(r);
    this._chargeOuter.setAlpha(0.5 + progress * 0.5);
    this._chargeInner.setRadius(4 + progress * 10);
    this._chargeInner.setAlpha(progress * 0.8);

    // 即将蓄满时闪烁
    if (progress >= 0.85) {
      this._yijinjingChargeVisual.setAlpha(0.6 + Math.sin(Date.now() * 0.02) * 0.4);
    }
  }

  // 取消蓄力（松手未满1秒）
  cancelYijinjingCharge() {
    this.yijinjingCharging = false;
    if (this._yijinjingChargeVisual) {
      const cv = this._yijinjingChargeVisual;
      this._yijinjingChargeVisual = null;
      this.scene.tweens.add({
        targets: cv, alpha: 0, duration: 200,
        onComplete: () => { if (cv.active) cv.destroy(); },
      });
    }
  }

  leaveTrailWhenRunning() {
    const now = this.scene.time.now;
    const onGround = this.body.blocked.down || this.body.touching.down;

    if (!onGround || Math.abs(this.body.velocity.x) < 80 || now - this.lastTrailTime < 90) {
      return;
    }

    this.lastTrailTime = now;

    const ghost = this.scene.add.image(this.x, this.y, this.texture.key).setAlpha(0.2).setFlipX(this.flipX);
    ghost.setTint(0xaad8ff);
    ghost.setDepth(this.depth - 1);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      y: ghost.y + 4,
      x: ghost.x + (this.facingRight ? -6 : 6),
      duration: 240,
      onComplete: () => ghost.destroy(),
    });
  }

  hurt(amount, sourceX = this.x) {
    const now = this.scene.time.now;

    if (now < this.invulnerableUntil) {
      return false;
    }

    if (this.isGuarding()) {
      this.flashGuardSuccess();
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.invulnerableUntil = now + 900;
    this.setTint(0xff6666);
    this.setVelocity(sourceX < this.x ? 180 : -180, -220);
    sfx.play('player_hurt');

    // 受击打断易筋经蓄力 & 太极旋斩/禅杖旋风蓄力
    if (this.yijinjingCharging) {
      this.cancelYijinjingCharge();
    }
    if (this.swordCharging) {
      this.cancelSwordCharge();
    }
    if (this.staffCharging) {
      this.cancelStaffCharge();
    }

    bus.emit(EVENTS.PLAYER_HURT, { hp: this.hp, maxHp: this.maxHp, wisdom: this.wisdomBonus, attack: this.getCurrentAttack() });
    this.scene.time.delayedCall(140, () => this.clearTint());

    if (this.hp <= 0 && this.scene.respawnPlayer) {
      this.scene.respawnPlayer();
    }

    return true;
  }

  heal(amount) {
    this.hp = Phaser.Math.Clamp(this.hp + amount, 0, this.maxHp);
    bus.emit(EVENTS.PLAYER_HURT, { hp: this.hp, maxHp: this.maxHp, wisdom: this.wisdomBonus, attack: this.getCurrentAttack() });
  }

  addFoodBuff(atk, label) {
    this.attackBonus += atk;
    bus.emit(EVENTS.PLAYER_HURT, { hp: this.hp, maxHp: this.maxHp, wisdom: this.wisdomBonus, attack: this.getCurrentAttack() });
  }

  addWisdomBuff(points) {
    this.wisdomBonus += points;
    bus.emit(EVENTS.PLAYER_HURT, { hp: this.hp, maxHp: this.maxHp, wisdom: this.wisdomBonus, attack: this.getCurrentAttack() });
  }

  getCurrentAttack() {
    const base = weaponSystem.calc(WEAPONS.MELEE, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus }).damage;
    return Math.round(base * this.attackMultiplier);
  }

  flashGuardSuccess() {
    sfx.play('guard_block');
    const flash = this.scene.add.circle(this.x, this.y - 4, 20, 0xb2ebf2, 0.35).setStrokeStyle(2, 0x00e5ff, 1);

    this.scene.tweens.add({
      targets: flash,
      scale: { from: 0.8, to: 1.8 },
      alpha: 0,
      duration: 220,
      onComplete: () => flash.destroy(),
    });
  }
}

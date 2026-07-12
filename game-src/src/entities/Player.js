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
    this.shieldActiveUntil = 0;    // 玄武护体激活结束时间
    this.shieldCooldownUntil = 0;  // 玄武护体冷却结束时间
    this.lastTrailTime = 0;
    this.skillCooldown = 0;
    this.guardRing = null;

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
      skill_xuanwu: Phaser.Input.Keyboard.KeyCodes.X,   // 玄武护体（替代原K键太极护体）
      interact: Phaser.Input.Keyboard.KeyCodes.F,
      interactAlt: Phaser.Input.Keyboard.KeyCodes.E,
      backpack: Phaser.Input.Keyboard.KeyCodes.B,
    });
  }

  syncSkills(inventoryState) {
    this.skills[ITEMS.CRYSTAL_ZHUQUE] = !!inventoryState[ITEMS.CRYSTAL_ZHUQUE];
    this.skills[ITEMS.CRYSTAL_XUANWU] = !!inventoryState[ITEMS.CRYSTAL_XUANWU];
    this.skills[ITEMS.SKILL_TAIJI] = !!inventoryState[ITEMS.SKILL_TAIJI];
    this.skills[ITEMS.SKILL_YIJINJING] = !!inventoryState[ITEMS.SKILL_YIJINJING];
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

    if (this.isTalking) {
      this.state = PLAYER_STATES.TALKING;
      this.anims.stop();
      this.setVelocityX(0);
      this.setTexture('player_idle');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.attack)) {
      this.basicAttack();
    }

    // Z key — 朱雀烈炎 (fire AOE crystal skill)
    if (this.skills[ITEMS.CRYSTAL_ZHUQUE] && Phaser.Input.Keyboard.JustDown(this.keys.skill_zhuque)) {
      this.activateCrystalSkill('zhuque');
    }

    // X key — 玄武护体 (xuanwu shield, from Hengshan crystal)
    if (this.skills[ITEMS.CRYSTAL_XUANWU] && Phaser.Input.Keyboard.JustDown(this.keys.skill_xuanwu)) {
      this.useXuanwuShield();
    }

    if (!this.isAttacking) {
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
    this.nextAttackTime = this.scene.time.now + 260;
    this.anims.stop();
    this.setVelocityX(0);
    this.setTexture('player_attack');
    sfx.play('attack');

    // Melee hitbox size and damage are driven by WeaponSystem — wisdom expands hit range
    const ms = weaponSystem.calc(WEAPONS.MELEE, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
    const hitboxX = this.x + (this.facingRight ? ms.range : -ms.range);
    const hitbox = this.scene.add.zone(hitboxX, this.y - 4, ms.range * 2, ms.height);
    this.scene.physics.add.existing(hitbox);
    hitbox.body.setAllowGravity(false);
    hitbox.body.moves = false;

    if (this.scene.enemies) {
      this.scene.physics.world.overlap(hitbox, this.scene.enemies, (_zone, enemy) => {
        if (this.scene.damageEnemy) {
          this.scene.damageEnemy(enemy, ms.damage);
          return;
        }

        this.scene.defeatEnemy(enemy);
      });
    }

    this.scene.time.delayedCall(100, () => hitbox.destroy());
    this.scene.time.delayedCall(180, () => {
      this.isAttacking = false;
    });

    if (this.skills[ITEMS.SKILL_TAIJI]) {
      this.shootBaguaOrb();
    }
  }

  shootBaguaOrb() {
    const scene = this.scene;
    const dir = this.facingRight ? 1 : -1;

    // All orb properties are driven by WeaponSystem — grows faster and larger with wisdom
    const os = weaponSystem.calc(WEAPONS.BAGUA_ORB, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });

    const orb = scene.physics.add.image(this.x + dir * 24, this.y - 12, 'bagua_orb');
    orb.setDepth(this.depth + 1);
    orb.setScale(os.scale);
    orb.damage = os.damage;
    sfx.play('bagua_shoot');

    // Add to group FIRST, then override body settings so group defaults don't revert them
    if (scene.playerBullets) scene.playerBullets.add(orb);
    orb.body.setAllowGravity(false);
    orb.body.setVelocity(dir * os.speed, 0);

    // Fast spinning yin-yang effect
    scene.tweens.add({
      targets: orb,
      angle: dir > 0 ? 720 : -720,
      duration: 600,
      repeat: -1,
    });

    scene.time.delayedCall(os.durationMs, () => {
      if (orb.active) orb.destroy();
    });
  }

  useXuanwuShield() {
    if (!this.skills[ITEMS.CRYSTAL_XUANWU]) return;
    if (this.scene.time.now < this.shieldCooldownUntil) return;

    // Guard radius and duration — fixed by story system (2s duration, 4s cooldown)
    const gs = weaponSystem.calc(WEAPONS.XUANWU_GUARD, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
    this.shieldActiveUntil = this.scene.time.now + gs.durationMs;
    const cdMs = gs.cooldownMs;
    this.shieldCooldownUntil = this.scene.time.now + cdMs;
    bus.emit(EVENTS.SKILL_COOLDOWN, { itemKey: ITEMS.CRYSTAL_XUANWU, duration: cdMs });
    sfx.play('taiji_guard');
    this.showGuardRing(gs.radius, gs.durationMs);
  }

  activateCrystalSkill(type) {
    if (this.skillCooldown > this.scene.time.now) {
      return;
    }

    if (type === 'zhuque') {
      // AOE range and cooldown both scale with wisdom via WeaponSystem
      const zs = weaponSystem.calc(WEAPONS.ZHUQUE, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus });
      this.skillCooldown = this.scene.time.now + zs.cooldownMs;
      bus.emit(EVENTS.SKILL_COOLDOWN, { itemKey: ITEMS.CRYSTAL_ZHUQUE, duration: zs.cooldownMs });
      bus.emit(EVENTS.CRYSTAL_SKILL, { type: 'zhuque', x: this.x, y: this.y, range: zs.range, damage: zs.damage });
      sfx.play('skill_zhuque');
    }
  }

  showGuardRing(radius = 28, durationMs = 700) {
    // Destroy any lingering guard visual
    if (this.guardRing) {
      this.guardRing.destroy();
      this.guardRing = null;
    }

    const scene = this.scene;

    // Container tracks player position via update()
    const container = scene.add.container(this.x, this.y - 6);
    container.setDepth(this.depth + 1);
    this.guardRing = container;

    // ── Three-layer xuanwu tortoise-shell dome (dark teal) ───────────────
    // Outer shell: dark teal rim
    const outerRing = scene.add.circle(0, 0, radius, 0x26c6da, 0.10);
    outerRing.setStrokeStyle(3, 0x00e5ff, 1.0);

    // Middle layer: softer teal glow
    const midRing = scene.add.circle(0, 0, Math.round(radius * 0.72), 0x4dd0e1, 0.08);
    midRing.setStrokeStyle(1.5, 0x26c6da, 0.70);

    // Inner core: white-blue shimmer (energy centre)
    const innerGlow = scene.add.circle(0, 0, Math.round(radius * 0.44), 0xb2ebf2, 0.20);

    container.add([innerGlow, midRing, outerRing]);

    // ── Activation burst (world-space ripple, teal) ──────────────────────
    const burst = scene.add.circle(this.x, this.y - 6, radius * 0.35, 0x26c6da, 0.55);
    burst.setStrokeStyle(2, 0xb2ebf2, 1.0);
    burst.setDepth(this.depth + 2);
    scene.tweens.add({
      targets: burst,
      scale: { from: 0.3, to: 2.4 },
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    });

    // ── Continuous pulsing shimmer while guard is active ──────────────────
    const pulseTween = scene.tweens.add({
      targets: container,
      scaleX: { from: 1.00, to: 1.10 },
      scaleY: { from: 0.92, to: 1.06 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Auto-expire: fade out when guard window closes ────────────────────
    scene.time.delayedCall(durationMs, () => {
      pulseTween.stop();
      if (container.active) {
        scene.tweens.add({
          targets: container,
          alpha: 0,
          scale: 1.3,
          duration: 200,
          ease: 'Quad.easeOut',
          onComplete: () => {
            container.destroy();
            if (this.guardRing === container) this.guardRing = null;
          },
        });
      }
    });
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
    return weaponSystem.calc(WEAPONS.MELEE, { attackBonus: this.attackBonus, wisdomBonus: this.wisdomBonus }).damage;
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

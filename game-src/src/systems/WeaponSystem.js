// WeaponSystem — single source of truth for all weapon and skill stats.
//
// HOW IT WORKS:
//   Each weapon definition contains 'base*' starting values and optional
//   '*PerWisdom' scaling rates.  Call weaponSystem.calc(WEAPONS.X, player)
//   to get fully-computed stats for the player's current wisdom/attack level.
//
// HOW TO ADD A NEW WEAPON (e.g. for a future mountain level):
//   1. Add a new entry below in DEFS with base* and optional scaling keys.
//   2. Add the key name to WEAPONS (auto-generated from DEFS keys).
//   3. Call weaponSystem.calc(WEAPONS.NEW_WEAPON, player) in Player.js.
//
// SCALING RULES:
//   - 'damage' scales with (attackBonus + wisdomBonus) combined.
//   - All other stats (range, speed, radius, …) scale with wisdomBonus only.
//   - '*Max' / '*Min' clamp computed values so skills never become absurd.

const DEFS = {
  // ────────────────────── 普通近战拳击 ──────────────────────
  MELEE: {
    baseDamage: 10,
    baseRange: 28,        // hitbox half-width in px
    baseHeight: 24,       // hitbox height in px
    // Wisdom improves precision → bigger hit zone
    rangePerWisdom: 0.3,
    rangeMax: 64,
  },

  // ──────────── 八卦元气弹（J键，习得太极后触发）────────────
  BAGUA_ORB: {
    baseDamage: 8,
    baseSpeed: 440,        // horizontal px/s
    baseScale: 1.0,        // fixed size — orb does not grow with wisdom
    baseDurationMs: 1500,  // ms before auto-destroy (orb travels further at high wisdom)
    speedPerWisdom: 2,
    // Note: no scalePerWisdom — the yin-yang symbol stays the same visual size always
    durationMsPerWisdom: 5,
    durationMsMax: 2500,
  },

  // ─────────────── 朱雀晶片烈焰（Z键，AOE爆炸）───────────────
  ZHUQUE: {
    baseDamage: 30,
    baseRange: 75,         // AOE blast radius in px
    baseCooldownMs: 4000,  // 固定4秒冷却（故事系统规定）
    rangePerWisdom: 0.75,  // range grows to 150px max at full wisdom
    rangeMax: 150,
    cooldownMsPerWisdom: 0,   // 冷却时间固定，不随智慧变化
    cooldownMsMin: 4000,
  },

  // ──────────── 玄武护体（X键，衡山气运碎片护盾）────────────
  // 替代原太极护体；从南岳衡山获得，持续2秒，冷却4秒
  XUANWU_GUARD: {
    baseRadius: 34,
    baseDurationMs: 2000,   // 持续2秒（固定）
    baseCooldownMs: 4000,   // 冷却4秒（固定）
    radiusPerWisdom: 0.3,
    radiusMax: 60,
    durationMsPerWisdom: 0,  // 持续时间固定
    durationMsMax: 2000,
    cooldownMsPerWisdom: 0,  // 冷却时间固定
    cooldownMsMin: 4000,
  },

  // ────── 易筋经爆发（少林寺关卡解锁后，预留接口）──────────
  YIJINJING: {
    baseDamage: 20,
    baseRange: 80,          // forward shockwave range
    baseCooldownMs: 4000,
    rangePerWisdom: 1.0,
    rangeMax: 200,
    cooldownMsPerWisdom: -15,
    cooldownMsMin: 1500,
  },

  // ─────────────── 太极八卦剑斩击（装备后强化J键攻击）──────────
  TAIJI_SWORD: {
    baseDamage: 55,         // 一击必杀小怪（小怪HP=20~25）
    baseRange: 56,          // 更宽的斩击范围
    baseHeight: 56,
    rangePerWisdom: 0.5,
    rangeMax: 110,
  },

  // ─────────────── 黄龙震地（C键，嵩山黄龙晶技能）──────────────
  HUANGLONG_STRIKE: {
    baseDamage: 45,
    baseRange: 150,         // 前方纵深
    baseHeight: 68,         // 波及高度
    baseCooldownMs: 5000,
    rangePerWisdom: 1.5,
    rangeMax: 280,
    cooldownMsPerWisdom: 0,
    cooldownMsMin: 5000,
  },
};

// Auto-derive string constants so callers do: weaponSystem.calc(WEAPONS.MELEE, …)
export const WEAPONS = Object.freeze(
  Object.fromEntries(Object.keys(DEFS).map((k) => [k, k]))
);

export class WeaponSystem {
  /**
   * Compute effective weapon/skill stats given the player's current bonuses.
   *
   * @param {string} weaponKey  - one of WEAPONS.*
   * @param {{ attackBonus?: number, wisdomBonus?: number }} bonuses
   * @returns {object} fully-calculated stats object (damage, range, speed, …)
   */
  calc(weaponKey, { attackBonus = 0, wisdomBonus = 0 } = {}) {
    const def = DEFS[weaponKey];
    if (!def) {
      console.warn(`WeaponSystem: unknown key "${weaponKey}"`);
      return {};
    }

    const total = attackBonus + wisdomBonus;
    const dmgMult = 1 + total / 100;
    const result = {};

    for (const [key, baseVal] of Object.entries(def)) {
      if (!key.startsWith('base')) continue;

      // Strip 'base' prefix: 'baseDamage' → 'damage', 'baseCooldownMs' → 'cooldownMs'
      const prop = key.charAt(4).toLowerCase() + key.slice(5);
      let computed;

      if (prop === 'damage') {
        // Damage benefits from BOTH physical and mental training
        computed = Math.max(1, Math.round(baseVal * dmgMult));
      } else {
        // All other stats scale with wisdom only, respecting min/max caps
        const perWisdom = def[`${prop}PerWisdom`] ?? 0;
        const maxVal = def[`${prop}Max`] ?? Infinity;
        const minVal = def[`${prop}Min`] ?? -Infinity;
        const raw = baseVal + wisdomBonus * perWisdom;
        computed = Math.min(maxVal, Math.max(minVal, raw));

        // Round spatial (px) and temporal (ms) values to integers
        if (
          ['range', 'height', 'radius', 'speed'].includes(prop) ||
          prop.endsWith('Ms')
        ) {
          computed = Math.round(computed);
        }
      }

      result[prop] = computed;
    }

    return result;
  }
}

export const weaponSystem = new WeaponSystem();

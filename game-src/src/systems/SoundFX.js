/**
 * SoundFX — Procedural interactive sound effects using Web Audio API.
 *
 * Usage:
 *   import { sfx } from './SoundFX.js';
 *   sfx.play('jump');        // player jumps
 *   sfx.play('collect');     // pick up food / coin
 *   sfx.play('attack');      // punch
 *   sfx.play('bagua_shoot'); // Bagua orb fired
 *   sfx.play('skill_zhuque'); // 朱雀烈焰
 *   sfx.play('quiz_open');   // quiz dialog appears
 *   sfx.play('quiz_correct');// correct answer
 *   sfx.play('quiz_wrong');  // wrong answer
 *   sfx.play('enemy_hit');   // enemy damaged
 *   sfx.play('player_hurt'); // player takes damage
 *   sfx.play('level_done');  // level portal cleared
 */

class SoundFX {
  constructor() {
    this._ctx    = null;
    this._muted  = false;
    this._volume = 0.45; // master SFX level
  }

  // ── Public API ────────────────────────────────────────────────────────

  /** Call once on first user gesture to unlock AudioContext (iOS/Safari). */
  unlock() {
    this._ensure();
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  play(name) {
    if (this._muted) return;
    this._ensure();
    if (this._ctx.state === 'suspended') this._ctx.resume();
    const fn = SoundFX._SOUNDS[name];
    if (fn) fn(this);
  }

  setMute(muted) { this._muted = muted; }
  isMuted()      { return this._muted; }
  toggleMute()   { this._muted = !this._muted; }

  // ── Private ───────────────────────────────────────────────────────────

  _ensure() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  /**
   * Play a single tone with optional frequency sweep.
   * @param {number} freq        Target frequency (Hz)
   * @param {number} duration    Duration in seconds
   * @param {string} type        OscillatorType ('sine'|'square'|'sawtooth'|'triangle')
   * @param {number} vol         Gain level (0–1, multiplied by master _volume)
   * @param {number} [fromFreq]  Starting frequency for a linear sweep
   * @param {number} [delay]     Start delay in seconds (default 0)
   */
  _tone(freq, duration, type = 'sine', vol = 0.3, fromFreq = null, delay = 0) {
    const ctx = this._ctx;
    const start = ctx.currentTime + delay + 0.005;
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq ?? freq, start);
    if (fromFreq !== null) {
      osc.frequency.linearRampToValueAtTime(freq, start + duration * 0.85);
    }

    const peak = vol * this._volume;
    const atk  = Math.min(0.010, duration * 0.08);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + atk);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }
}

// ── Sound library (static — no per-instance state needed) ─────────────────
SoundFX._SOUNDS = {

  // ── 跳跃：快速升调扫频 ─────────────────────────────────────────────────
  jump(s) {
    s._tone(480, 0.10, 'sine', 0.38, 200);
  },

  // ── 捡起食物/金币：清脆双音叮响 ───────────────────────────────────────
  collect(s) {
    s._tone(659, 0.10, 'sine', 0.42);           // E5
    s._tone(880, 0.14, 'sine', 0.32, null, 0.07); // A5
  },

  // ── 普通攻击：短促拳击音 ───────────────────────────────────────────────
  attack(s) {
    s._tone(90, 0.06, 'sawtooth', 0.55, 160);
  },

  // ── 八卦元气弹射出：神秘飞啸 ──────────────────────────────────────────
  bagua_shoot(s) {
    s._tone(300, 0.14, 'sine', 0.28, 880);        // descending whoosh
    s._tone(392, 0.18, 'triangle', 0.22, null, 0.05); // G4 resonance
  },

  // ── 朱雀烈焰技能：火爆序列 ────────────────────────────────────────────
  skill_zhuque(s) {
    s._tone(120, 0.07, 'sawtooth', 0.50, 80);
    s._tone(280, 0.09, 'sawtooth', 0.42, 160, 0.06);
    s._tone(500, 0.14, 'square',   0.30, 320, 0.13);
  },

  // ── 答题面板出现：钟声提示 ────────────────────────────────────────────
  quiz_open(s) {
    s._tone(523, 0.35, 'sine', 0.30);            // C5 bell
    s._tone(659, 0.28, 'sine', 0.20, null, 0.15); // E5 echo
  },

  // ── 答对：上行五声音阶小片段 ──────────────────────────────────────────
  quiz_correct(s) {
    s._tone(523, 0.11, 'sine', 0.40);                // C5
    s._tone(659, 0.11, 'sine', 0.38, null, 0.10);    // E5
    s._tone(784, 0.18, 'sine', 0.38, null, 0.20);    // G5
  },

  // ── 答错：下行悲调 ────────────────────────────────────────────────────
  quiz_wrong(s) {
    s._tone(330, 0.14, 'triangle', 0.36);              // E4
    s._tone(220, 0.22, 'triangle', 0.30, null, 0.12);  // A3 (minor drop)
  },

  // ── 敌人受击：短促击打声 ──────────────────────────────────────────────
  enemy_hit(s) {
    s._tone(140, 0.05, 'square', 0.48, 210);
  },

  // ── 玩家受伤：下滑嗡音 ───────────────────────────────────────────────
  player_hurt(s) {
    s._tone(100, 0.20, 'sawtooth', 0.42, 320);
  },

  // ── 关卡完成：五音短凯歌 ──────────────────────────────────────────────
  level_done(s) {
    const notes = [261, 329, 392, 523, 659];
    notes.forEach((f, i) => s._tone(f, 0.17, 'square', 0.32, null, i * 0.11));
  },

  // ── 太极护体激活：深沉共鸣金钟声 ─────────────────────────────────────
  taiji_guard(s) {
    s._tone(196, 0.70, 'sine', 0.50, 160);            // deep gong thud
    s._tone(392, 0.45, 'sine', 0.28, null, 0.06);     // octave shimmer
    s._tone(588, 0.30, 'sine', 0.14, null, 0.14);     // 3rd harmonic ring
  },

  // ── 护体格挡成功：金钟被击，清脆回响 ─────────────────────────────────
  guard_block(s) {
    s._tone(880, 0.07, 'triangle', 0.60, 660);        // sharp metallic impact
    s._tone(440, 0.45, 'sine',     0.32, null, 0.05); // resonance ring
  },
};

export const sfx = new SoundFX();

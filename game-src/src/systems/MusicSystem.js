/**
 * MusicSystem — Procedural 8-bit BGM using Web Audio API.
 * No audio files needed. Replace themes with Suno-generated files later.
 *
 * Usage:
 *   import { music } from './MusicSystem.js';
 *   music.play('menu');   // start a theme
 *   music.play('wudang'); // switch theme
 *   music.stop();         // silence
 *   music.setMute(true);  // toggle mute
 */

// Chinese pentatonic scale (宫商角徵羽) frequencies in Hz
const N = {
  C2: 65.41,  G2: 98.00,  A2: 110.00,
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00, A3: 220.00,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  R:  0, // rest
};

const THEMES = {
  // ── 主菜单：史诗豪迈，英雄即将踏上寻龙之旅 ──────────────────────────
  menu: {
    bpm: 88,
    type: 'square',
    melody: [
      {n:N.C4,d:0.5},{n:N.E4,d:0.5},{n:N.G4,d:0.5},{n:N.A4,d:0.5},
      {n:N.C5,d:1.0},{n:N.A4,d:0.5},{n:N.G4,d:0.5},
      {n:N.E4,d:0.5},{n:N.D4,d:0.5},{n:N.C4,d:1.0},{n:N.R,d:0.5},
      {n:N.G4,d:0.5},{n:N.A4,d:0.5},{n:N.C5,d:0.5},{n:N.D5,d:0.5},
      {n:N.E5,d:1.0},{n:N.D5,d:0.5},{n:N.C5,d:0.5},
      {n:N.A4,d:0.5},{n:N.G4,d:0.5},{n:N.E4,d:1.5},{n:N.R,d:0.5},
    ],
    bass: [
      {n:N.C3,d:1},{n:N.G3,d:1},{n:N.A3,d:1},{n:N.G3,d:1},
      {n:N.C3,d:1},{n:N.E3,d:1},{n:N.G3,d:2},
    ],
    melodyVol: 0.13,
    bassVol:   0.08,
  },

  // ── 武当山：道家仙境，古琴箫声，飘渺宁静 ─────────────────────────────
  wudang: {
    bpm: 58,
    type: 'sine',
    melody: [
      {n:N.G4,d:1.5},{n:N.A4,d:0.5},{n:N.C5,d:2.0},
      {n:N.A4,d:1.0},{n:N.G4,d:0.5},{n:N.E4,d:0.5},
      {n:N.D4,d:1.0},{n:N.E4,d:1.0},{n:N.G4,d:2.0},
      {n:N.R, d:0.5},{n:N.A4,d:0.5},{n:N.G4,d:0.5},{n:N.E4,d:0.5},
      {n:N.D4,d:2.0},{n:N.C4,d:2.0},
    ],
    bass: [
      {n:N.G3,d:2},{n:N.A3,d:2},
      {n:N.E3,d:2},{n:N.D3,d:2},
      {n:N.G3,d:4},
    ],
    melodyVol: 0.10,
    bassVol:   0.07,
  },

  // ── 战斗：急促锣鼓，气运交锋 ──────────────────────────────────────────
  battle: {
    bpm: 115,
    type: 'sawtooth',
    melody: [
      {n:N.G4,d:0.25},{n:N.G4,d:0.25},{n:N.A4,d:0.5},
      {n:N.G4,d:0.25},{n:N.E4,d:0.25},{n:N.D4,d:0.5},
      {n:N.G4,d:0.25},{n:N.G4,d:0.25},{n:N.A4,d:0.25},{n:N.C5,d:0.25},
      {n:N.A4,d:0.5},{n:N.G4,d:0.5},
      {n:N.E4,d:0.25},{n:N.D4,d:0.25},{n:N.C4,d:0.5},
      {n:N.D4,d:0.25},{n:N.E4,d:0.25},{n:N.G4,d:1.0},
    ],
    bass: [
      {n:N.G3,d:0.5},{n:N.R,d:0.25},{n:N.G3,d:0.25},
      {n:N.A3,d:0.5},{n:N.R,d:0.25},{n:N.A3,d:0.25},
      {n:N.G3,d:0.5},{n:N.R,d:0.25},{n:N.G3,d:0.25},
      {n:N.E3,d:0.5},{n:N.R,d:0.5},
    ],
    melodyVol: 0.12,
    bassVol:   0.08,
  },

  // ── BOSS 蛟龙：暗黑史诗，龙吟回荡 ────────────────────────────────────
  boss: {
    bpm: 100,
    type: 'sawtooth',
    melody: [
      {n:N.D4,d:0.25},{n:N.R,d:0.25},{n:N.D4,d:0.25},{n:N.R,d:0.25},
      {n:N.A3,d:0.75},{n:N.R,d:0.25},
      {n:N.C4,d:0.25},{n:N.R,d:0.25},{n:N.C4,d:0.25},{n:N.D4,d:0.25},
      {n:N.E4,d:0.75},{n:N.R,d:0.25},
      {n:N.G4,d:0.5},{n:N.A4,d:0.5},{n:N.G4,d:0.25},{n:N.E4,d:0.25},
      {n:N.D4,d:1.0},{n:N.R,d:0.5},
      {n:N.C5,d:0.25},{n:N.A4,d:0.25},{n:N.G4,d:0.25},{n:N.E4,d:0.25},
      {n:N.D4,d:2.0},
    ],
    bass: [
      {n:N.D3,d:0.5},{n:N.A3,d:0.5},{n:N.C3,d:0.5},{n:N.G3,d:0.5},
      {n:N.D3,d:0.5},{n:N.A2,d:0.5},{n:N.G2,d:1.0},
      {n:N.D3,d:0.5},{n:N.A3,d:0.5},{n:N.C3,d:0.5},{n:N.G3,d:0.5},
      {n:N.D3,d:2.0},
    ],
    melodyVol: 0.13,
    bassVol:   0.09,
  },

  // ── 嵩山：禅武少林，沉雄浑厚 ────────────────────────────────────────
  songshan: {
    bpm: 72,
    type: 'triangle',
    melody: [
      {n:N.D4,d:0.5},{n:N.E4,d:0.5},{n:N.G4,d:1.0},
      {n:N.A4,d:0.5},{n:N.G4,d:0.5},{n:N.E4,d:1.0},
      {n:N.D4,d:0.5},{n:N.E4,d:0.5},{n:N.G4,d:0.5},{n:N.A4,d:0.5},
      {n:N.C5,d:1.0},{n:N.A4,d:0.5},{n:N.G4,d:0.5},
      {n:N.E4,d:1.5},{n:N.D4,d:0.5},{n:N.R,d:1.0},
      {n:N.G4,d:0.5},{n:N.A4,d:0.5},{n:N.G4,d:0.5},{n:N.E4,d:0.5},
      {n:N.D4,d:1.0},{n:N.C4,d:2.0},
    ],
    bass: [
      {n:N.D3,d:1},{n:N.G3,d:1},
      {n:N.A3,d:1},{n:N.G3,d:1},
      {n:N.D3,d:2},{n:N.E3,d:2},
      {n:N.G3,d:2},{n:N.D3,d:2},
    ],
    melodyVol: 0.11,
    bassVol:   0.08,
  },

  // ── 华山：险峰剑气，明快高亢 ────────────────────────────────────────
  huashan: {
    bpm: 92,
    type: 'square',
    melody: [
      {n:N.E4,d:0.5},{n:N.G4,d:0.5},{n:N.A4,d:1.0},
      {n:N.C5,d:0.5},{n:N.A4,d:0.5},{n:N.G4,d:1.0},
      {n:N.E4,d:0.5},{n:N.G4,d:0.5},{n:N.A4,d:0.5},{n:N.C5,d:0.5},
      {n:N.D5,d:1.0},{n:N.C5,d:0.5},{n:N.A4,d:0.5},
      {n:N.G4,d:1.5},{n:N.E4,d:0.5},{n:N.R,d:1.0},
    ],
    bass: [
      {n:N.A2,d:1},{n:N.E3,d:1},
      {n:N.C3,d:1},{n:N.G3,d:1},
      {n:N.A2,d:2},{n:N.E3,d:2},
    ],
    melodyVol: 0.12,
    bassVol:   0.08,
  },

  // ── 恒山：北岳玄武，苍茫深沉，暗流涌动 ──────────────────────────────
  hengshan: {    bpm: 76,
    type: 'sawtooth',
    melody: [
      {n:N.A3,d:1.0},{n:N.G3,d:0.5},{n:N.E3,d:0.5},
      {n:N.C4,d:1.0},{n:N.A3,d:0.5},{n:N.G3,d:0.5},
      {n:N.D4,d:0.5},{n:N.C4,d:0.5},{n:N.A3,d:1.0},
      {n:N.G3,d:1.5},{n:N.R,d:0.5},
      {n:N.E3,d:0.5},{n:N.G3,d:0.5},{n:N.A3,d:0.5},{n:N.C4,d:0.5},
      {n:N.E4,d:1.0},{n:N.D4,d:0.5},{n:N.C4,d:0.5},
      {n:N.A3,d:1.0},{n:N.G3,d:1.0},
      {n:N.E3,d:2.0},{n:N.R,d:0.5},
    ],
    bass: [
      {n:N.A2,d:2},{n:N.G2,d:1},{n:N.E3,d:1},
      {n:N.C3,d:2},{n:N.G2,d:2},
      {n:N.A2,d:2},{n:N.C3,d:2},
    ],
    melodyVol: 0.11,
    bassVol:   0.09,
  },

  // ── 泰山：东岳雄峰，磅礴恢弘，天地之气 ──────────────────────────────
  taishan: {
    bpm: 84,
    type: 'square',
    melody: [
      {n:N.C4,d:0.5},{n:N.E4,d:0.5},{n:N.G4,d:1.0},
      {n:N.A4,d:0.5},{n:N.G4,d:0.5},{n:N.E4,d:1.0},
      {n:N.D4,d:0.5},{n:N.E4,d:0.5},{n:N.G4,d:0.5},{n:N.A4,d:0.5},
      {n:N.C5,d:1.5},{n:N.R,d:0.5},
      {n:N.G4,d:0.5},{n:N.E4,d:0.5},{n:N.D4,d:1.0},
      {n:N.C4,d:0.5},{n:N.D4,d:0.5},{n:N.E4,d:1.0},
      {n:N.G4,d:1.0},{n:N.A4,d:0.5},{n:N.G4,d:0.5},
      {n:N.C4,d:2.0},{n:N.R,d:0.5},
    ],
    bass: [
      {n:N.C3,d:2},{n:N.G3,d:1},{n:N.A3,d:1},
      {n:N.C3,d:2},{n:N.E3,d:2},
      {n:N.G2,d:1},{n:N.C3,d:1},{n:N.G3,d:2},
    ],
    melodyVol: 0.13,
    bassVol:   0.08,
  },
  victory: {
    bpm: 100,
    type: 'square',
    melody: [
      {n:N.C4,d:0.25},{n:N.E4,d:0.25},{n:N.G4,d:0.25},{n:N.C5,d:0.5},
      {n:N.R, d:0.25},{n:N.C5,d:0.25},{n:N.D5,d:0.25},{n:N.E5,d:0.5},
      {n:N.G5,d:0.5},{n:N.E5,d:0.25},{n:N.D5,d:0.25},
      {n:N.C5,d:1.0},{n:N.R,d:0.5},
      {n:N.G4,d:0.25},{n:N.A4,d:0.25},{n:N.C5,d:0.25},{n:N.E5,d:0.25},
      {n:N.G5,d:2.0},
    ],
    bass: [
      {n:N.C3,d:1},{n:N.G3,d:1},{n:N.A3,d:1},{n:N.G3,d:1},
      {n:N.C3,d:2},{n:N.E3,d:1},{n:N.G3,d:1},
    ],
    melodyVol: 0.14,
    bassVol:   0.09,
    loop: false, // play once
  },
};

class MusicSystem {
  constructor() {
    this._ctx    = null;
    this._master = null;
    this._muted  = false;
    this._volume = 0.22;
    this._current = null;
    this._loopTimer = null;
    this._scheduled = false;
  }

  // ── Public API ────────────────────────────────────────────────────────

  play(themeName) {
    if (this._current === themeName && this._scheduled) return;
    this._stop();
    this._current = themeName;
    this._scheduled = true;
    this._ensure();
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().then(() => this._loop(themeName));
    } else {
      this._loop(themeName);
    }
  }

  stop() { this._stop(); }

  setMute(muted) {
    this._muted = muted;
    if (this._master) {
      this._master.gain.setTargetAtTime(
        muted ? 0 : this._volume,
        this._ctx.currentTime,
        0.05,
      );
    }
  }

  isMuted() { return this._muted; }

  toggleMute() { this.setMute(!this._muted); }

  /** Call once on first user interaction to unlock AudioContext on iOS/Safari */
  unlock() {
    this._ensure();
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  // ── Private ───────────────────────────────────────────────────────────

  _ensure() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._muted ? 0 : this._volume;
      this._master.connect(this._ctx.destination);
    }
  }

  _stop() {
    this._scheduled = false;
    this._current   = null;
    if (this._loopTimer) { clearTimeout(this._loopTimer); this._loopTimer = null; }
  }

  _loop(themeName) {
    if (!this._scheduled || this._current !== themeName) return;
    const theme = THEMES[themeName];
    if (!theme) return;

    const now = this._ctx.currentTime + 0.05;
    const dur = this._schedule(theme, now);

    if (theme.loop === false) {
      // one-shot (victory fanfare)
      this._scheduled = false;
      return;
    }

    // schedule next iteration slightly before current ends to avoid gaps
    this._loopTimer = setTimeout(() => {
      this._loop(themeName);
    }, (dur - 0.08) * 1000);
  }

  /** Schedule all notes for one loop iteration; returns total duration (s). */
  _schedule(theme, startTime) {
    const beat = 60 / theme.bpm;
    let mTime = startTime;
    let bTime = startTime;

    for (const note of theme.melody) {
      const dur = note.d * beat;
      if (note.n > 0) this._note(note.n, dur, mTime, theme.type, theme.melodyVol);
      mTime += dur;
    }

    for (const note of theme.bass) {
      const dur = note.d * beat;
      if (note.n > 0) this._note(note.n, dur, bTime, 'triangle', theme.bassVol);
      bTime += dur;
    }

    return Math.max(mTime, bTime) - startTime;
  }

  /** Play a single oscillator note with quick attack/release envelope. */
  _note(freq, duration, startTime, type, vol) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    const attack  = Math.min(0.015, duration * 0.1);
    const release = duration * 0.25;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + attack);
    gain.gain.setValueAtTime(vol, startTime + duration - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this._master);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}

export const music = new MusicSystem();

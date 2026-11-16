// All non-speech sound is synthesized here with the Web Audio API: the game's
// effects, a music-box lullaby, and night ambience. No audio files.
import { progress } from '../state/progress.js';

let ctx = null;
let master = null;     // everything
let sfxBus = null;     // effects
let musicBus = null;   // lullaby + ambience
let reverb = null;
let noiseBuf = null;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function initAudio(game) {
  if (ctx || !game.sound || !game.sound.context) return;
  ctx = game.sound.context;
  master = ctx.createGain();
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);

  // A small synthetic room: decaying noise as the impulse response.
  const len = Math.floor(ctx.sampleRate * 2.4);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  }
  reverb = ctx.createConvolver();
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  reverb.connect(wet);
  wet.connect(master);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i += 1) nd[i] = Math.random() * 2 - 1;

  applySettings();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music.pause(); else music.resume();
  });
}

export function applySettings() {
  if (!ctx) return;
  master.gain.value = progress.settings.sound ? 1 : 0;
  music.setEnabled(progress.settings.music && progress.settings.sound);
}

export const audioTime = () => (ctx ? ctx.currentTime : 0);

// ---- building blocks -------------------------------------------------------
function tone(freq, t, dur, { type = 'sine', gain = 0.2, to = null, bus = sfxBus, attack = 0.005, send = 0 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus);
  if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(reverb); }
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(t, dur, { gain = 0.2, type = 'bandpass', from = 800, to = 800, q = 1, bus = sfxBus } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

// One music-box tine: a fundamental, an octave partial that dies sooner, and a
// brief inharmonic "tick" at the attack.
function chime(note, t, { gain = 0.16, decay = 1.6, bus = musicBus, send = 0.5 } = {}) {
  const f = midi(note);
  tone(f, t, decay, { gain, bus, attack: 0.004, send });
  tone(f * 2, t, decay * 0.45, { gain: gain * 0.28, bus, attack: 0.004, send: send * 0.5 });
  tone(f * 5.4, t, 0.09, { gain: gain * 0.1, bus, attack: 0.002 });
}

// ---- effects ---------------------------------------------------------------
const ready = () => ctx && ctx.state === 'running' && progress.settings.sound;

export const sfx = {
  tap() { if (ready()) tone(700, ctx.currentTime, 0.07, { gain: 0.1, to: 980 }); },
  grab() { if (ready()) tone(240, ctx.currentTime, 0.1, { type: 'triangle', gain: 0.12, to: 300 }); },
  // Creak of the band tightening; `amount` 0..1 sets the pitch.
  stretch(amount) {
    if (ready()) tone(150 + amount * 190, ctx.currentTime, 0.05, { type: 'triangle', gain: 0.045 });
  },
  launch(power = 1) {
    if (!ready()) return;
    const t = ctx.currentTime;
    noise(t, 0.3, { gain: 0.16 + 0.12 * power, from: 500, to: 2600, q: 0.8 });
    // "cirip!"
    tone(2300, t + 0.02, 0.07, { gain: 0.07, to: 3500 });
    tone(2700, t + 0.11, 0.08, { gain: 0.07, to: 3900 });
  },
  thud(strength = 0.5) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const g = Math.min(0.5, 0.12 + strength * 0.4);
    tone(150, t, 0.16, { gain: g, to: 55 });
    noise(t, 0.08, { gain: g * 0.5, type: 'lowpass', from: 900, to: 300 });
  },
  wood(strength = 0.5) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const g = Math.min(0.32, 0.08 + strength * 0.3);
    tone(420 + Math.random() * 160, t, 0.07, { type: 'triangle', gain: g, to: 260 });
    noise(t, 0.04, { gain: g * 0.5, from: 1800, to: 900, q: 2 });
  },
  correct() {
    if (!ready()) return;
    const t = ctx.currentTime;
    [74, 78, 81, 86].forEach((n, i) => chime(n, t + i * 0.075, { gain: 0.2, decay: 1.1, bus: sfxBus }));
  },
  wrong() {
    if (!ready()) return;
    const t = ctx.currentTime;
    tone(233, t, 0.18, { type: 'triangle', gain: 0.2, to: 208 });
    tone(196, t + 0.16, 0.26, { type: 'triangle', gain: 0.2, to: 165 });
  },
  star(i = 0) { if (ready()) chime(86 + i * 2, ctx.currentTime, { gain: 0.18, decay: 0.9, bus: sfxBus }); },
  // Three falling notes as the bird drifts off.
  sleep() {
    if (!ready()) return;
    const t = ctx.currentTime;
    [81, 78, 74].forEach((n, i) => chime(n, t + i * 0.32, { gain: 0.17, decay: 1.8, bus: sfxBus }));
  },
  fanfare() {
    if (!ready()) return;
    const t = ctx.currentTime;
    [62, 69, 74, 78, 81, 86].forEach((n, i) => chime(n, t + i * 0.11, { gain: 0.2, decay: 2.2, bus: sfxBus }));
    [74, 78, 81].forEach((n) => chime(n, t + 0.85, { gain: 0.15, decay: 2.6, bus: sfxBus }));
  },
  fail() {
    if (!ready()) return;
    const t = ctx.currentTime;
    [74, 71, 67, 62].forEach((n, i) => chime(n, t + i * 0.24, { gain: 0.15, decay: 1.6, bus: sfxBus }));
  },
  pop() { if (ready()) tone(520, ctx.currentTime, 0.09, { gain: 0.13, to: 900 }); },
};

// ---- lullaby + ambience ----------------------------------------------------
// An original lullaby in D major, 3/4, written as [beat, midi note, beats held].
const BEAT = 0.62;
const MELODY = [
  [0, 78, 2], [2, 81, 1], [3, 78, 2], [5, 74, 1], [6, 74, 1], [7, 79, 1], [8, 83, 1], [9, 81, 3],
  [12, 78, 2], [14, 81, 1], [15, 86, 2], [17, 83, 1], [18, 79, 1], [19, 78, 1], [20, 76, 1], [21, 74, 3],
  [24, 83, 2], [26, 79, 1], [27, 81, 2], [29, 78, 1], [30, 79, 1], [31, 76, 1], [32, 79, 1], [33, 76, 3],
  [36, 78, 2], [38, 83, 1], [39, 79, 2], [41, 83, 1], [42, 81, 1], [43, 79, 1], [44, 76, 1], [45, 74, 3],
];
// One broken chord per bar: [root, fifth, third] around middle C.
const D = [62, 69, 66]; const Bm = [59, 66, 62]; const G = [55, 62, 59];
const A = [57, 64, 61]; const Em = [52, 59, 55];
const CHORDS = [D, Bm, G, A, D, Bm, Em, D, G, D, Em, A, Bm, G, A, D];
const LOOP_BEATS = 48 + 6; // sixteen bars, then two bars of rest

export const music = {
  enabled: false,
  running: false,
  timer: null,
  beat: 0,
  pass: 0,
  nextTime: 0,
  level: 0.55,

  start() {
    if (!ctx || this.running) return;
    this.running = true;
    this.beat = 0;
    this.nextTime = ctx.currentTime + 0.4;
    this.nextCricket = ctx.currentTime + 1.5;
    this.nextOwl = ctx.currentTime + 14 + Math.random() * 20;
    this.timer = window.setInterval(() => this.tick(), 120);
    this.fade();
  },
  pause() { if (this.timer) { window.clearInterval(this.timer); this.timer = null; } },
  resume() {
    if (!this.running || this.timer || !ctx) return;
    this.nextTime = ctx.currentTime + 0.3;
    this.nextCricket = ctx.currentTime + 1;
    this.timer = window.setInterval(() => this.tick(), 120);
  },
  setEnabled(on) { this.enabled = on; this.fade(); },
  fade(target = this.enabled ? this.level : 0, time = 0.6) {
    if (!ctx) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(target, ctx.currentTime, time / 3);
  },
  // Lower the music while a voice clip plays.
  duck(on) { if (this.enabled) this.fade(on ? this.level * 0.3 : this.level, on ? 0.15 : 0.9); },

  tick() {
    if (!ctx || ctx.state !== 'running') return;
    const horizon = ctx.currentTime + 0.5;
    while (this.nextTime < horizon) {
      this.scheduleBeat(this.beat, this.nextTime);
      this.nextTime += BEAT;
      this.beat += 1;
      if (this.beat >= LOOP_BEATS) { this.beat = 0; this.pass += 1; }
    }
    if (ctx.currentTime > this.nextCricket) {
      this.cricket(ctx.currentTime + 0.05);
      this.nextCricket = ctx.currentTime + 1.2 + Math.random() * 2.6;
    }
    if (ctx.currentTime > this.nextOwl) {
      this.owl(ctx.currentTime + 0.1);
      this.nextOwl = ctx.currentTime + 25 + Math.random() * 35;
    }
  },
  scheduleBeat(beat, t) {
    if (beat >= 48) return;
    const soft = this.pass % 2 === 1; // every other pass is an octave lower and sparser
    for (const [b, note, held] of MELODY) {
      if (b === beat) {
        const human = (Math.random() - 0.5) * 0.02;
        chime(note - (soft ? 12 : 0), t + human, { gain: soft ? 0.11 : 0.14, decay: 0.9 + held * 0.75 });
      }
    }
    const chord = CHORDS[Math.floor(beat / 3)];
    const step = beat % 3;
    if (step === 0 || !soft) chime(chord[step], t + 0.01, { gain: 0.055, decay: 1.5, send: 0.35 });
  },
  cricket(t) {
    const n = 3 + Math.floor(Math.random() * 3);
    const f = 4100 + Math.random() * 500;
    for (let i = 0; i < n; i += 1) tone(f, t + i * 0.075, 0.045, { gain: 0.016, bus: musicBus, attack: 0.008 });
  },
  owl(t) {
    tone(410, t, 0.32, { gain: 0.045, to: 370, bus: musicBus, attack: 0.05, send: 0.8 });
    tone(390, t + 0.5, 0.6, { gain: 0.05, to: 330, bus: musicBus, attack: 0.06, send: 0.8 });
  },
};

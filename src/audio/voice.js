// Spoken Romanian: ElevenLabs clips in public/audio/, addressed by content
// hash. Clips load on demand (a topic at a time) through Phaser's loader.
import { audioUrl } from '../data/content.js';
import { progress } from '../state/progress.js';
import { music } from './synth.js';

let game = null;
let current = null;
let token = 0;
const VOLUME = 1.5; // the v4 clips are quiet next to the synthesized effects

export const voice = {
  init(g) { game = g; },

  has(hash) { return !!hash && game.cache.audio.exists(hash); },

  // Fetch and decode any clips not yet cached. Resolves when they are ready.
  load(scene, hashes) {
    const need = [...new Set(hashes)].filter((h) => h && !this.has(h));
    if (!need.length) return Promise.resolve();
    return new Promise((resolve) => {
      need.forEach((h) => scene.load.audio(h, audioUrl(h)));
      scene.load.once('complete', resolve);
      scene.load.start();
    });
  },

  stop() {
    token += 1;
    if (current) { current.stop(); current.destroy(); current = null; }
    music.duck(false);
  },

  // Play one clip, or several in order. Returns the total duration in ms of
  // the clips that were ready (0 if sound is off or nothing was loaded).
  play(hashes, { gap = 180, onDone } = {}) {
    this.stop();
    const list = (Array.isArray(hashes) ? hashes : [hashes]).filter((h) => this.has(h));
    if (!list.length || !progress.settings.sound || !game.sound.context) {
      if (onDone) onDone();
      return 0;
    }
    const mine = token;
    let total = 0;
    list.forEach((h) => { total += (game.cache.audio.get(h)?.duration ?? 1) * 1000 + gap; });
    music.duck(true);
    const next = (i) => {
      if (mine !== token) return;
      if (i >= list.length) {
        current = null;
        music.duck(false);
        if (onDone) onDone();
        return;
      }
      current = game.sound.add(list[i], { volume: VOLUME });
      current.once('complete', () => {
        if (mine !== token) return;
        current.destroy();
        current = null;
        window.setTimeout(() => next(i + 1), gap);
      });
      current.play();
    };
    next(0);
    return total;
  },
};

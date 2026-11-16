// The scene behind the play: painted dusk landscape, stars, a rising moon,
// lit village windows, fireflies, and the tree. `night` runs from 0 (dusk) to
// 1 (full night) and is animated as birds are put to bed.
import Phaser from 'phaser';
import { W, H } from '../constants.js';

const BG_W = 1728; // the 3:1 painting scaled to the field height
const BG_LEFT = W / 2 - BG_W / 2;
const BG_SCALE = H / 724;

// Lit windows, measured on a 3x enlargement of the painting's village
// (crop origin 1280,470), converted to field coordinates below.
const WINDOWS_3X = [
  [135, 242], [208, 242], [277, 245], [340, 245], [405, 243], [445, 243],
  [628, 205], [718, 203], [778, 197], [868, 192], [903, 190], [942, 190],
  [1020, 205], [1050, 203], [1210, 195], [1253, 195], [1290, 190], [1370, 200], [1413, 202], [1478, 200],
];
const WINDOWS = WINDOWS_3X.map(([x, y]) => ({
  x: BG_LEFT + (1280 + x / 3) * BG_SCALE,
  y: (470 + y / 3) * BG_SCALE,
}));

const DUSK = Phaser.Display.Color.ValueToColor(0xffffff);
const NIGHT_BG = Phaser.Display.Color.ValueToColor(0x5a66c0);
const NIGHT_TREE = Phaser.Display.Color.ValueToColor(0xa9b2e6);
const mix = (a, b, t) => {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

export function makeBackdropTextures(scene) {
  if (scene.textures.exists('glow')) return;
  const soft = (key, size, stops) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([at, col]) => g.addColorStop(at, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    scene.textures.addCanvas(key, c);
  };
  soft('glow', 64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  soft('dot', 16, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);

  // moon: a pale disc with a few soft craters and a wide halo
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  const halo = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
  halo.addColorStop(0, 'rgba(255,246,200,0.55)');
  halo.addColorStop(1, 'rgba(255,246,200,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#fbf3cf';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(214,200,160,0.55)';
  [[-0.06, -0.05, 0.045], [0.07, 0.03, 0.03], [-0.02, 0.09, 0.025], [0.05, -0.09, 0.02]].forEach(([dx, dy, r]) => {
    ctx.beginPath();
    ctx.arc(S / 2 + dx * S, S / 2 + dy * S, r * S, 0, Math.PI * 2);
    ctx.fill();
  });
  scene.textures.addCanvas('moon', c);

  // four-point sparkle for bursts
  const sp = document.createElement('canvas');
  sp.width = 32;
  sp.height = 32;
  const sx = sp.getContext('2d');
  sx.fillStyle = '#ffffff';
  sx.beginPath();
  sx.moveTo(16, 0); sx.quadraticCurveTo(17.5, 14.5, 32, 16); sx.quadraticCurveTo(17.5, 17.5, 16, 32);
  sx.quadraticCurveTo(14.5, 17.5, 0, 16); sx.quadraticCurveTo(14.5, 14.5, 16, 0);
  sx.fill();
  scene.textures.addCanvas('sparkle', sp);

  // a small feather
  const fe = document.createElement('canvas');
  fe.width = 28;
  fe.height = 12;
  const fx = fe.getContext('2d');
  fx.fillStyle = '#ffffff';
  fx.beginPath();
  fx.ellipse(14, 6, 13, 4.5, 0, 0, Math.PI * 2);
  fx.fill();
  scene.textures.addCanvas('feather', fe);
}

export class Backdrop {
  constructor(scene, { tree = true, night = 0, lantern = false } = {}) {
    this.scene = scene;
    makeBackdropTextures(scene);
    this._night = night;

    this.bg = scene.add.image(W / 2, 0, 'bg').setOrigin(0.5, 0).setDisplaySize(BG_W, H).setDepth(-20);

    // stars: only in the upper sky, fading in with the night
    this.stars = scene.add.container(0, 0).setDepth(-19);
    const rnd = new Phaser.Math.RandomDataGenerator(['stars']);
    for (let i = 0; i < 90; i += 1) {
      const y = rnd.between(6, 300);
      const s = scene.add.image(rnd.between(BG_LEFT + 60, BG_LEFT + BG_W - 60), y, 'dot')
        .setScale(rnd.realInRange(0.12, 0.34) * (y < 180 ? 1.15 : 0.8))
        .setTint(rnd.pick([0xffffff, 0xfff3c4, 0xd6e4ff]));
      this.stars.add(s);
      scene.tweens.add({
        targets: s, alpha: rnd.realInRange(0.25, 0.55), duration: rnd.between(900, 2600),
        yoyo: true, repeat: -1, delay: rnd.between(0, 2500), ease: 'Sine.easeInOut',
      });
    }

    this.moon = scene.add.image(W - 140, 240, 'moon').setDepth(-18).setScale(0.82);

    this.windows = scene.add.container(0, 0).setDepth(-17);
    WINDOWS.forEach((p, i) => {
      const g = scene.add.image(p.x, p.y, 'glow').setScale(0.24).setTint(0xffc45a).setBlendMode(Phaser.BlendModes.ADD);
      this.windows.add(g);
      scene.tweens.add({
        targets: g, alpha: 0.6, duration: 1400 + (i % 5) * 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });

    if (tree) {
      this.tree = scene.add.image(0, H, 'tree').setOrigin(0, 1).setDisplaySize(W, H).setDepth(-5);
    }
    if (lantern) {
      this.lanternGlow = scene.add.image(lantern.x, lantern.y + 8, 'glow').setScale(2.6).setTint(0xffb648)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(-4).setAlpha(0.5);
      this.lantern = scene.add.image(lantern.x, lantern.y, 'lantern').setDisplaySize(44, 71).setDepth(-3);
      scene.tweens.add({ targets: this.lanternGlow, alpha: 0.32, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // fireflies drift over the meadow once it gets dark
    this.fireflies = scene.add.particles(0, 0, 'glow', {
      x: { min: BG_LEFT + 200, max: BG_LEFT + BG_W - 200 },
      y: { min: 330, max: 540 },
      lifespan: { min: 3500, max: 6500 },
      speedX: { min: -14, max: 14 },
      speedY: { min: -10, max: 6 },
      scale: { min: 0.1, max: 0.2 },
      alpha: { onEmit: () => 0, onUpdate: (particle, key, t) => Math.sin(t * Math.PI) * 0.9 },
      tint: 0xe9ff9a,
      blendMode: 'ADD',
      frequency: 260,
      emitting: false,
    }).setDepth(-2);

    this.apply();
  }

  get night() { return this._night; }
  set night(v) { this._night = Phaser.Math.Clamp(v, 0, 1); this.apply(); }

  apply() {
    const t = this._night;
    this.bg.setTint(mix(DUSK, NIGHT_BG, t));
    if (this.tree) this.tree.setTint(mix(DUSK, NIGHT_TREE, t));
    this.stars.setAlpha(Phaser.Math.Clamp(t * 1.25, 0, 1));
    this.windows.setAlpha(0.35 + 0.65 * t);
    this.moon.setY(Phaser.Math.Linear(250, 96, Phaser.Math.Easing.Sine.Out(t)));
    this.moon.setAlpha(0.5 + 0.5 * t);
    const want = t > 0.3;
    if (want !== this.fireflies.emitting) { if (want) this.fireflies.start(); else this.fireflies.stop(); }
  }

  setNight(t, duration = 1400) {
    if (this.nightTween) this.nightTween.stop();
    this.nightTween = this.scene.tweens.add({ targets: this, night: t, duration, ease: 'Sine.easeInOut' });
  }
}

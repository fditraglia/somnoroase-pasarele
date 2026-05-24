import Phaser from 'phaser';

// Generates all textures procedurally so the prototype needs no asset files.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // Player bird: the 🐦 emoji — its slate-blue tone suits the dusk sky, and
    // it matches the 🐦 used for the lives counter. "Sleepy" is conveyed by the
    // bobbing 💤 floating above it (see GameScene), which vanishes on launch.
    this.makeEmojiBird('bird', '🐦');
    this.makeBoxTexture('box', 60, 60, 0xc9954f, 0x8a5a2b);
    this.makeBoxTexture('plank', 120, 26, 0xb07d3b, 0x7c5526);
    this.makeRoundTexture('target', 88, 88, 0x6ad0ff, 0x1f6f9c);

    this.scene.start('Intro');
  }

  // Renders an emoji to a canvas and registers it as a texture, so the Matter
  // bird is a real sprite that rotates as it tumbles. Mirrored so it faces
  // right — the direction it launches. The body fills the radius-24 circle.
  makeEmojiBird(key, emoji) {
    const S = 80;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '58px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.translate(S, 0);
    ctx.scale(-1, 1); // mirror so the bird faces right
    ctx.fillText(emoji, S / 2, S / 2);
    if (this.textures.exists(key)) this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
  }

  makeBoxTexture(key, w, h, fill, stroke) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.lineStyle(4, stroke, 1);
    g.fillRoundedRect(2, 2, w - 4, h - 4, 6);
    g.strokeRoundedRect(2, 2, w - 4, h - 4, 6);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  makeRoundTexture(key, w, h, fill, stroke) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.lineStyle(5, stroke, 1);
    g.fillRoundedRect(3, 3, w - 6, h - 6, 16);
    g.strokeRoundedRect(3, 3, w - 6, h - 6, 16);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}

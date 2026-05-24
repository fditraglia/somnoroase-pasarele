import Phaser from 'phaser';

// Generates all textures procedurally so the prototype needs no asset files.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeCircleTexture('bird', 26, 0xffd166, 0xb5651d);
    this.makeBoxTexture('box', 60, 60, 0xc9954f, 0x8a5a2b);
    this.makeBoxTexture('plank', 120, 26, 0xb07d3b, 0x7c5526);
    this.makeRoundTexture('target', 88, 88, 0x6ad0ff, 0x1f6f9c);

    this.scene.start('Game');
  }

  makeCircleTexture(key, r, fill, stroke) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.lineStyle(4, stroke, 1);
    g.fillCircle(r, r, r - 2);
    g.strokeCircle(r, r, r - 2);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
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

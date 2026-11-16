import Phaser from 'phaser';
import { W, H, FONT_DISPLAY, COLOR } from '../constants.js';
import { bindView } from '../view.js';
import { txt } from '../ui.js';
import { initAudio } from '../audio/synth.js';
import { voice } from '../audio/voice.js';
import { makeBackdropTextures } from '../world/backdrop.js';
import bgUrl from '../assets/bg.webp';
import treeUrl from '../assets/tree.webp';
import birdSleepy from '../assets/bird-sleepy.png';
import birdFly from '../assets/bird-fly.png';
import birdAsleep from '../assets/bird-asleep.png';
import birdGrumpy from '../assets/bird-grumpy.png';
import nestUrl from '../assets/nest.png';
import nestFrontUrl from '../assets/nest-front.png';
import crateUrl from '../assets/crate.png';
import cardUrl from '../assets/card.png';
import plankUrl from '../assets/plank.png';
import lanternUrl from '../assets/lantern.png';

// Loads the illustrated art, sets up audio, then hands over to the title.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    bindView(this);
    const label = txt(this, W / 2, H / 2 - 30, 'Somnoroase Păsărele', {
      fontFamily: FONT_DISPLAY, fontSize: '34px', color: COLOR.gold, fontStyle: '600',
    }).setOrigin(0.5);
    const bar = this.add.graphics();
    this.load.on('progress', (p) => {
      bar.clear();
      bar.fillStyle(0xffffff, 0.2).fillRoundedRect(W / 2 - 150, H / 2 + 10, 300, 12, 6);
      bar.fillStyle(0xffd166, 1).fillRoundedRect(W / 2 - 150, H / 2 + 10, 300 * p, 12, 6);
    });
    this.load.once('complete', () => { label.destroy(); bar.destroy(); });

    this.load.image('bg', bgUrl);
    this.load.image('tree', treeUrl);
    this.load.image('bird-sleepy', birdSleepy);
    this.load.image('bird-fly', birdFly);
    this.load.image('bird-asleep', birdAsleep);
    this.load.image('bird-grumpy', birdGrumpy);
    this.load.image('nest', nestUrl);
    this.load.image('nest-front', nestFrontUrl);
    this.load.image('crate', crateUrl);
    this.load.image('card', cardUrl);
    this.load.image('plank', plankUrl);
    this.load.image('lantern', lanternUrl);
  }

  create() {
    makeBackdropTextures(this);
    initAudio(this.game);
    voice.init(this.game);

    // Development shortcut: ?topic=fructe&tier=2&round=3 opens a level directly.
    const q = new URLSearchParams(window.location.search);
    if (import.meta.env.DEV && q.get('topic')) {
      this.scene.start('Game', {
        topicId: q.get('topic'), tier: Number(q.get('tier') || 1), round: Number(q.get('round') || 0),
      });
      return;
    }
    // ?layout=1 opens the tool for adjusting nest, perch, and sign points.
    if (import.meta.env.DEV && q.get('layout')) { this.scene.start('Game', { layout: true }); return; }
    if (import.meta.env.DEV && q.get('scene')) { this.scene.start(q.get('scene')); return; }
    this.scene.start('Title');
  }
}

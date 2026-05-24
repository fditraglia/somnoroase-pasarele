import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';

// Title + how-to-play screen. Tap/click (or press a key) to begin.
export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    // dusk backdrop, matching the game
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a2f6b, 0x2a2f6b, 0x4b3a72, 0x7a5a82, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.circle(GAME_WIDTH - 120, 90, 46, 0xf5f0c8, 0.9);
    this.add.circle(GAME_WIDTH - 100, 80, 40, 0x4b3a72, 1).setAlpha(0.25);

    const cx = GAME_WIDTH / 2;

    // the sleepy bird, with a bobbing 💤
    const bird = this.add.image(cx, 150, 'bird').setScale(1.3);
    const zzz = this.add.text(cx + 28, 118, '💤', { fontSize: '30px' }).setOrigin(0.5);
    this.tweens.add({ targets: zzz, y: 108, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: bird, y: 158, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.add.text(cx, 232, 'Somnoroase Păsărele', {
      fontFamily: 'Georgia, serif',
      fontSize: '52px',
      color: '#ffd166',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, 276, 'Sleepy Birds — learn a little Romanian', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#c9d3ff',
    }).setOrigin(0.5);

    const how = [
      '🎯  Drag the bird back and release to launch it',
      '🇷🇴  A Romanian word appears — find the matching picture',
      '🧱  Hit the correct target to score and move on',
      '📚  Clear the words in each theme to reach the next level',
      "🐦  Mind your birds — run out and it's game over!",
    ];
    this.add.text(cx, 380, how, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '19px',
      color: '#eef2ff',
      align: 'left',
      lineSpacing: 12,
    }).setOrigin(0.5);

    const start = this.add.text(cx, 510, 'Tap to start  ▶', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#9fffb3',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    const begin = () => this.scene.start('Game');
    this.input.once('pointerdown', begin);
    this.input.keyboard.once('keydown', begin);
  }
}

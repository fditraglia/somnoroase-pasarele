import Phaser from 'phaser';
import { W, FONT_DISPLAY, FONT_POEM, COLOR } from '../constants.js';
import { view, bindView } from '../view.js';
import { txt, button, iconButton } from '../ui.js';
import { music, applySettings } from '../audio/synth.js';
import { voice } from '../audio/voice.js';
import { POEM, PHRASES, TOPICS } from '../data/content.js';
import { progress } from '../state/progress.js';
import { Backdrop } from '../world/backdrop.js';

// Title screen: the first stanza of Eminescu's lullaby, a sleeping bird, Play.
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.backdrop = new Backdrop(this, { tree: false, night: 0.55 });
    const shadow = (t) => t.setShadow(0, 3, '#1a1035', 8, true, true);

    shadow(txt(this, W / 2, 78, 'Somnoroase Păsărele', {
      fontFamily: FONT_DISPLAY, fontSize: '66px', color: COLOR.gold, fontStyle: '700',
      stroke: '#3a1d55', strokeThickness: 8,
    }).setOrigin(0.5));
    shadow(txt(this, W / 2, 132, 'Sleepy Birds  ·  learn Romanian, one bedtime at a time', {
      fontSize: '20px', color: '#ffffff', fontStyle: '700',
    }).setOrigin(0.5));

    const stanza = POEM.stanzas[0];
    shadow(txt(this, W / 2, 224, stanza.ro.join('\n'), {
      fontFamily: FONT_POEM, fontSize: '25px', color: COLOR.cream, fontStyle: 'italic', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5));
    shadow(txt(this, W / 2, 318, stanza.en.join(' '), {
      fontSize: '15px', color: '#ffffff', fontStyle: '700', align: 'center', wordWrap: { width: 430 },
    }).setOrigin(0.5));
    shadow(txt(this, W / 2 - 96, 356, '— Mihai Eminescu', { fontSize: '15px', color: COLOR.pale, fontStyle: '700' }).setOrigin(0.5));

    // a bird asleep in its nest
    const nx = 196;
    const ny = 468;
    this.add.ellipse(nx, ny + 62, 250, 26, 0x1a1035, 0.3);
    this.add.image(nx, ny, 'nest').setDisplaySize(250, 150);
    const bird = this.add.image(nx, ny - 34, 'bird-asleep').setDisplaySize(150, 150).setAngle(-6);
    this.add.image(nx, ny, 'nest-front').setDisplaySize(250, 150);
    this.tweens.add({ targets: bird, scaleY: bird.scaleY * 1.03, y: bird.y - 2, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const zzz = txt(this, nx + 74, ny - 96, '💤', { fontSize: '36px' }).setOrigin(0.5);
    this.tweens.add({ targets: zzz, y: zzz.y - 14, alpha: 0.5, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // a lantern in the grass
    const lx = 842;
    const ly = 462;
    const glow = this.add.image(lx, ly + 6, 'glow').setScale(5.2).setTint(0xffb648).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    this.tweens.add({ targets: glow, alpha: 0.36, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.ellipse(lx, ly + 62, 80, 14, 0x1a1035, 0.3);
    this.add.image(lx, ly, 'lantern').setDisplaySize(76, 123);

    const start = () => {
      music.start();
      voice.stop();
      this.scene.start('Map');
    };
    const play = button(this, W / 2, 452, '▶   Joacă  ·  Play', { w: 330, h: 74, fontSize: 30, fill: 0xffd166, onClick: start });
    this.tweens.add({ targets: play, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const known = progress.wordsKnown();
    const total = TOPICS.reduce((n, t) => n + t.words.length, 0);
    shadow(txt(this, W / 2, 516, known
      ? `★ ${progress.totalStars()}   ·   ${known} of ${total} words learned`
      : `${total} words in ${TOPICS.length} topics, with spoken Romanian`, {
      fontSize: '17px', color: '#ffffff', fontStyle: '700',
    }).setOrigin(0.5));

    // sound toggles, and the stanza read aloud
    const icon = (on, a, b) => (on ? a : b);
    this.musicBtn = iconButton(this, 0, 36, icon(progress.settings.music, '🎵', '🔇'), () => {
      progress.setSetting('music', !progress.settings.music);
      applySettings();
      music.start();
      this.musicBtn.label.setText(icon(progress.settings.music, '🎵', '🔇'));
    });
    this.fullBtn = this.scale.fullscreen.available
      ? iconButton(this, 0, 36, '⛶', () => (this.scale.isFullscreen ? this.scale.stopFullscreen() : this.scale.startFullscreen()))
      : null;
    button(this, W / 2 + 84, 356, '🔊  Hear it', {
      w: 130, h: 34, fontSize: 16, fill: 0x2a1f63, stroke: 0xfff0c8, color: '#ffffff', radius: 12,
      onClick: () => { music.start(); voice.load(this, [stanza.a]).then(() => voice.play(stanza.a)); },
    });

    // the first tap anywhere unlocks audio in the browser; start the lullaby then
    this.input.once('pointerdown', () => music.start());
    this.input.keyboard.once('keydown-ENTER', start);
    voice.load(this, [stanza.a, PHRASES.goodNight.a]);

    bindView(this, () => {
      this.musicBtn.setX(view.right - 36);
      if (this.fullBtn) this.fullBtn.setX(view.right - 88);
    });
  }
}

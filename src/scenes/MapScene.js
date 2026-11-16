import Phaser from 'phaser';
import { W, H, FONT_DISPLAY, COLOR } from '../constants.js';
import { view, bindView } from '../view.js';
import { txt, button, panel, iconButton, emojiKey, withEmoji } from '../ui.js';
import { music } from '../audio/synth.js';
import { voice } from '../audio/voice.js';
import { TOPICS, wordsOf } from '../data/content.js';
import { progress } from '../state/progress.js';
import { TIERS } from '../game/rounds.js';
import { Backdrop } from '../world/backdrop.js';

const STAR_COLOR = ['#5a5390', '#d99a6c', '#dfe3ee', '#ffd166']; // none, 1, 2, 3 stars

// Topic picker. Every topic is open from the start; a topic opens into its
// word list (tap to hear) and three levels of increasing language depth.
export default class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  create() {
    this.backdrop = new Backdrop(this, { tree: false, night: 0.9 });
    this.add.rectangle(W / 2, H / 2, 4000, H * 2, 0x0d0830, 0.42);

    txt(this, W / 2, 30, 'Alege o temă', { fontFamily: FONT_DISPLAY, fontSize: '32px', color: COLOR.gold, fontStyle: '600' }).setOrigin(0.5);
    txt(this, W / 2, 59, 'Choose a topic', { fontSize: '15px', color: COLOR.pale, fontStyle: '700' }).setOrigin(0.5);
    this.backBtn = iconButton(this, 0, 36, '‹', () => this.scene.start('Title'), { fontSize: 30 });
    this.statText = txt(this, 0, 22, `★ ${progress.totalStars()} / ${TOPICS.length * TIERS.length * 3}`, {
      fontFamily: FONT_DISPLAY, fontSize: '20px', color: COLOR.gold, fontStyle: '500',
    }).setOrigin(1, 0);

    const cols = 5;
    const cw = 190;
    const ch = 106;
    const gx = 10;
    const gy = 9;
    const left = (W - (cols * cw + (cols - 1) * gx)) / 2;
    TOPICS.forEach((topic, i) => {
      const x = left + (i % cols) * (cw + gx);
      const y = 80 + Math.floor(i / cols) * (ch + gy);
      this.topicCard(topic, x, y, cw, ch);
    });

    this.modal = null;
    bindView(this, () => {
      this.backBtn.setX(view.left + 36);
      this.statText.setX(view.right - 18);
    });
    this.events.once('shutdown', () => voice.stop());
    this.input.once('pointerdown', () => music.start());
  }

  topicCard(topic, x, y, w, h) {
    const c = this.add.container(x + w / 2, y + h / 2);
    const g = this.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(0x0d0830, 0.35).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 14);
      g.fillStyle(hover ? 0x3d318a : 0x2a1f63, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      g.lineStyle(2.5, 0xfff0c8, hover ? 1 : 0.75).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    };
    draw(false);
    const icon = this.add.image(-w / 2 + 32, -h / 2 + 34, emojiKey(this, topic.icon)).setDisplaySize(42, 42);
    const title = txt(this, -w / 2 + 60, -h / 2 + 9, topic.ro, { fontFamily: FONT_DISPLAY, fontSize: '19px', color: '#ffffff', fontStyle: '600' });
    title.setScale(Math.min(1, (w - 68) / title.width));
    const sub = txt(this, -w / 2 + 60, -h / 2 + 35, topic.en, { fontSize: '14px', color: COLOR.pale, fontStyle: '700' });
    c.add([g, icon, title, sub]);

    // one star per level: gray until played, then bronze / silver / gold
    TIERS.forEach((tier, i) => {
      const lv = progress.level(topic.id, tier.id);
      c.add(txt(this, -w / 2 + 22 + i * 26, h / 2 - 39, '★', {
        fontSize: '22px', color: STAR_COLOR[lv ? lv.stars : 0], fontStyle: '800',
      }));
    });
    // share of the topic's words that are well known
    const m = progress.mastery(topic);
    const bar = this.add.graphics();
    bar.fillStyle(0xffffff, 0.16).fillRoundedRect(-w / 2 + 104, h / 2 - 25, w - 118, 7, 3.5);
    if (m > 0) bar.fillStyle(0xb6f5a8, 1).fillRoundedRect(-w / 2 + 104, h / 2 - 25, Math.max(7, (w - 118) * m), 7, 3.5);
    c.add(bar);

    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => draw(true));
    c.on('pointerout', () => draw(false));
    c.on('pointerup', () => { if (!this.modal) this.openTopic(topic); });
  }

  openTopic(topic) {
    const objs = [];
    const add = (o) => { objs.push(o); return o; };
    const close = () => { voice.stop(); objs.forEach((o) => o.destroy()); this.modal = null; };
    this.modal = objs;

    add(this.add.rectangle(W / 2, H / 2, 4000, H * 2, 0x0d0830, 0.6).setDepth(39).setInteractive());
    add(panel(this, W / 2, 292, 972, 536));
    add(txt(this, 76, 44, `${topic.icon}  ${topic.ro}`, { fontFamily: withEmoji(FONT_DISPLAY), fontSize: '34px', color: COLOR.gold, fontStyle: '600' }).setDepth(41));
    add(txt(this, 80, 92, `${topic.en}  ·  tap a word to hear it`, { fontSize: '16px', color: COLOR.pale, fontStyle: '700' }).setDepth(41));
    add(iconButton(this, 964, 62, '✕', close, { depth: 50 }));

    // word list
    const words = wordsOf(topic);
    const cw = 158;
    const ch = 98;
    words.forEach((w, i) => {
      const cx = 72 + (i % 4) * (cw + 6) + cw / 2;
      const cy = 126 + Math.floor(i / 4) * (ch + 6) + ch / 2;
      const g = add(this.add.graphics().setDepth(41));
      g.fillStyle(0x2f2670, 1).fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 12);
      g.lineStyle(2, 0xfff0c8, 0.5).strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 12);
      const pic = add(this.add.image(cx - cw / 2 + 32, cy - 10, emojiKey(this, w.emoji)).setDisplaySize(44, 44).setDepth(42));
      const ro = add(txt(this, cx - cw / 2 + 62, cy - 36, w.ro, { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffffff', fontStyle: '600' }).setDepth(42));
      ro.setScale(Math.min(1, (cw - 68) / ro.width));
      const en = add(txt(this, cx - cw / 2 + 62, cy - 10, w.en, { fontSize: '14px', color: COLOR.pale, fontStyle: '700' }).setDepth(42));
      en.setScale(Math.min(1, (cw - 68) / en.width));
      // how well the word is known, out of five
      const s = progress.strength(w.ro);
      for (let k = 0; k < 5; k += 1) {
        add(this.add.circle(cx - cw / 2 + 68 + k * 13, cy + 28, 4, k < s ? 0xb6f5a8 : 0xffffff, k < s ? 1 : 0.2).setDepth(42));
      }
      const zone = add(this.add.zone(cx, cy, cw, ch).setInteractive({ useHandCursor: true }).setDepth(43));
      zone.on('pointerup', () => {
        music.start();
        const clip = w.a.e ?? w.a.w;
        voice.load(this, [clip]).then(() => voice.play(clip));
        this.tweens.add({ targets: pic, scale: pic.scale * 1.25, duration: 120, yoyo: true });
      });
    });

    // the three levels
    TIERS.forEach((tier, i) => {
      const lv = progress.level(topic.id, tier.id);
      const bx = 848;
      const by = 176 + i * 116;
      const c = add(this.add.container(bx, by).setDepth(50));
      const bw = 232;
      const bh = 104;
      const g = this.add.graphics();
      const draw = (hover) => {
        g.clear();
        g.fillStyle(0x0d0830, 0.35).fillRoundedRect(-bw / 2, -bh / 2 + 4, bw, bh, 16);
        g.fillStyle(hover ? 0xffffff : 0xfff0c8, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
        g.lineStyle(3, 0x4a2148, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
      };
      draw(false);
      const head = txt(this, -bw / 2 + 14, -bh / 2 + 6, `${tier.icon} ${tier.ro}`, { fontFamily: withEmoji(FONT_DISPLAY), fontSize: '23px', color: COLOR.ink, fontStyle: '600' });
      const stars = txt(this, bw / 2 - 12, -bh / 2 + 9, '★'.repeat(lv ? lv.stars : 0) + '☆'.repeat(3 - (lv ? lv.stars : 0)), { fontSize: '20px', color: '#b5651d', fontStyle: '800' }).setOrigin(1, 0);
      const blurb = txt(this, -bw / 2 + 14, -bh / 2 + 42, `${tier.en}. ${tier.blurb}`, { fontSize: '14px', color: '#5a3a2a', fontStyle: '700', wordWrap: { width: bw - 28 }, lineSpacing: -2 });
      c.add([g, head, stars, blurb]);
      c.setSize(bw, bh);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerover', () => draw(true));
      c.on('pointerout', () => draw(false));
      c.on('pointerup', () => { music.start(); this.scene.start('Game', { topicId: topic.id, tier: tier.id }); });
    });

    // fetch this topic's spoken words in the background
    voice.load(this, words.flatMap((w) => [w.a.e ?? w.a.w]));
  }
}

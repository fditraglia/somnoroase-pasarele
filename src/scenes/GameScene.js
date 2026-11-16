import Phaser from 'phaser';
import {
  W, H, GROUND_Y, BIRD_R, BIRD_SIZE, FONT_DISPLAY, FONT_POEM, COLOR, MAX_PULL, LAUNCH_POWER,
} from '../constants.js';
import { view, bindView, worldPoint } from '../view.js';
import { txt, button, panel, iconButton, withEmoji, emojiKey } from '../ui.js';
import { sfx, music, applySettings } from '../audio/synth.js';
import { voice } from '../audio/voice.js';
import { topicById, TOPICS, PHRASES, POEM } from '../data/content.js';
import { progress } from '../state/progress.js';
import { buildSession, roundAudio, TIERS } from '../game/rounds.js';
import {
  buildTowers, buildSigns, buildNests, drawRopes, destroyTargets, targetPos,
} from '../game/mechanics.js';
import { Backdrop } from '../world/backdrop.js';

const AIM_STEPS = 44;      // how much of the flight the dotted preview shows
const SPARE_BIRDS = [10, 9, 8]; // misses allowed per level, by tier

const PRAISE = [
  ['Bravo!', 'Well done!'], ['Foarte bine!', 'Very good!'], ['Corect!', 'Correct!'],
  ['Excelent!', 'Excellent!'], ['Super!', 'Great!'], ['Minunat!', 'Wonderful!'],
];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Game', physics: { default: 'matter', matter: { gravity: { y: 1 }, debug: false } } });
  }

  init(data) {
    this.topicId = data.topicId ?? TOPICS[0].id;
    this.tierId = data.tier ?? 1;
    this.startAt = data.round ?? 0;
    this.layoutMode = !!data.layout;
  }

  create() {
    this.topic = topicById(this.topicId);
    this.session = buildSession(this.topic, this.tierId);
    this.total = this.session.rounds.length;

    this.backdrop = new Backdrop(this, { tree: true, night: 0 });
    this.buildWorld();
    this.buildEffects();
    this.buildHud();
    this.bindInput();
    this.bindCollisions();

    this.targets = [];
    this.results = [];
    this.score = 0;
    this.streak = 0;
    this.wrongAnswers = 0;
    this.birdsLeft = this.total + SPARE_BIRDS[this.tierId - 1];
    this.state = 'intro';
    this.landing = [0.15, 0.4, 0.6][this.tierId - 1];

    bindView(this, () => this.layout());
    this.events.once('shutdown', () => this.teardown());
    if (import.meta.env.DEV) window.__scene = this;

    if (this.layoutMode) { // development: adjust the hand-placed points on the tree
      [this.hudBar, this.birdIcon, ...this.pips].forEach((o) => o.setVisible(false));
      import('../dev/layoutTool.js').then((m) => m.startLayoutTool(this));
      return;
    }

    // Announce the level while its audio loads, then begin.
    this.updateHud();
    const tier = this.session.tier;
    this.showBanner(`${this.topic.icon}  ${this.topic.ro}`, `${tier.ro} · ${tier.en}`, null, 1500);
    // The first round's clips are fetched before play begins; the rest of the
    // level's clips follow in the background while that round is played.
    let ready = false;
    let waited = false;
    const go = () => { if (ready && waited && this.state === 'intro') this.startRound(this.startAt); };
    const rounds = this.session.rounds;
    const first = [...roundAudio(rounds[this.startAt]), ...Object.values(PHRASES).map((p) => p.a)];
    voice.load(this, first).then(() => {
      ready = true;
      go();
      voice.load(this, rounds.flatMap(roundAudio));
    });
    this.time.delayedCall(1500, () => { waited = true; go(); });
    this.time.delayedCall(8000, () => { ready = true; go(); }); // do not wait forever on a slow network
  }

  teardown() {
    voice.stop();
    destroyTargets(this, this.targets);
    this.targets = [];
  }

  // ---------------------------------------------------------------- world ----
  buildWorld() {
    this.matter.add.rectangle(W / 2, GROUND_Y + 40, 4000, 80, {
      isStatic: true, friction: 0.9, label: 'ground',
    });
    // Side walls sit at the edges of the visible strip (see layout()). The top
    // is open: gravity is the ceiling, so a high lob can leave and come back.
    const wall = { isStatic: true, friction: 0, restitution: 0.25, label: 'wall' };
    this.wallL = this.matter.add.rectangle(-30, 0, 60, H * 6, wall);
    this.wallR = this.matter.add.rectangle(W + 30, 0, 60, H * 6, wall);

    this.ropeGfx = this.add.graphics().setDepth(2.5);
    this.bandGfx = this.add.graphics().setDepth(6.5);
    this.aimGfx = this.add.graphics().setDepth(6);
    this.trailGfx = this.add.graphics().setDepth(5.8);
    this.trail = [];
  }

  buildEffects() {
    this.stars = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 90, max: 330 }, angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 360 },
      lifespan: { min: 500, max: 1000 }, gravityY: 260,
      tint: [0xffd166, 0xfff3c4, 0xffffff, 0xb6f5a8], emitting: false,
    }).setDepth(8);
    this.feathers = this.add.particles(0, 0, 'feather', {
      speed: { min: 30, max: 150 }, angle: { min: 200, max: 340 },
      scale: { start: 0.7, end: 0.3 }, rotate: { start: 0, end: 300 },
      alpha: { start: 0.9, end: 0 }, lifespan: { min: 700, max: 1400 }, gravityY: 120,
      tint: [0x8e9bc4, 0xe9e1c6, 0xa9b6dd], emitting: false,
    }).setDepth(8);
    this.dust = this.add.particles(0, 0, 'glow', {
      speed: { min: 20, max: 90 }, angle: { min: 180, max: 360 },
      scale: { start: 0.35, end: 0.05 }, alpha: { start: 0.5, end: 0 },
      lifespan: 450, tint: 0xd9c9a8, emitting: false,
    }).setDepth(8);
  }

  // ------------------------------------------------------------------ hud ----
  buildHud() {
    this.hudBar = this.add.graphics().setDepth(20);
    const display = { fontFamily: withEmoji(FONT_DISPLAY) };

    this.topicText = txt(this, 0, 6, '', { ...display, fontSize: '19px', color: COLOR.pale, fontStyle: '500' }).setDepth(21);
    this.pips = [];
    for (let i = 0; i < this.total; i += 1) {
      this.pips.push(this.add.circle(0, 44, 7, 0xffffff, 0.16).setStrokeStyle(1.5, 0xfff0c8, 0.7).setDepth(21));
    }

    this.promptMain = txt(this, W / 2, -2, '', { ...display, fontSize: '36px', color: COLOR.gold, fontStyle: '600', padding: { x: 4, y: 8 } })
      .setOrigin(0.5, 0).setDepth(21);
    this.promptSub = txt(this, W / 2, 42, '', { fontSize: '16px', color: COLOR.pale, fontStyle: '700' })
      .setOrigin(0.5, 0).setDepth(21);
    this.speakBtn = iconButton(this, 0, 26, '🔊', () => this.speakPrompt(), { size: 40, fontSize: 19 }).setVisible(false);

    this.birdIcon = this.add.image(0, 22, 'bird-sleepy').setDisplaySize(46, 46).setDepth(21);
    this.birdsText = txt(this, 0, 8, '', { ...display, fontSize: '22px', color: '#ffffff', fontStyle: '600' }).setDepth(21);
    this.scoreText = txt(this, 0, 36, '', { ...display, fontSize: '18px', color: COLOR.gold, fontStyle: '500' })
      .setOrigin(1, 0).setDepth(21);
    this.menuBtn = iconButton(this, 0, 30, '☰', () => this.openMenu(), { size: 44, fontSize: 22 });

    // feedback shown in the middle of the field
    this.banner = this.add.container(W / 2, 210).setDepth(30).setVisible(false);
    this.bannerBg = this.add.graphics();
    this.bannerTop = txt(this, 0, -52, '', { ...display, fontSize: '20px', color: COLOR.gold, fontStyle: '500' }).setOrigin(0.5);
    this.bannerMain = txt(this, 0, -10, '', { ...display, fontSize: '40px', color: '#ffffff', fontStyle: '600', align: 'center' }).setOrigin(0.5);
    this.bannerSub = txt(this, 0, 36, '', { fontSize: '20px', color: COLOR.pale, fontStyle: '700', align: 'center' }).setOrigin(0.5);
    this.banner.add([this.bannerBg, this.bannerTop, this.bannerMain, this.bannerSub]);

    this.toast = txt(this, W / 2, 96, '', {
      ...display, fontSize: '24px', color: '#fff1ec', fontStyle: '600', backgroundColor: '#7a2d3cdd', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(30).setVisible(false);

    this.hint = txt(this, W / 2, H - 22, '', {
      fontSize: '19px', color: '#ffffff', fontStyle: '800', backgroundColor: '#1d1447cc', padding: { x: 14, y: 7 },
    }).setOrigin(0.5).setDepth(30).setVisible(false);
  }

  layout() {
    const L = view.left;
    const R = view.right;
    this.hudBar.clear();
    this.hudBar.fillGradientStyle(0x150d3a, 0x150d3a, 0x150d3a, 0x150d3a, 0.78, 0.78, 0.4, 0.4);
    this.hudBar.fillRect(L - 4, 0, R - L + 8, 66);
    this.topicText.setX(L + 16);
    this.pips.forEach((p, i) => p.setX(L + 25 + i * 20));
    this.menuBtn.setX(R - 34);
    this.scoreText.setX(R - 66);
    this.birdsText.setX(R - 66 - this.birdsText.width);
    this.birdIcon.setX(this.birdsText.x - 24);
    this.placeSpeaker();
    // walls follow the visible edges
    const body = Phaser.Physics.Matter.Matter.Body;
    body.setPosition(this.wallL, { x: L - 30, y: 0 });
    body.setPosition(this.wallR, { x: R + 30, y: 0 });
  }

  placeSpeaker() {
    this.speakBtn.setX(W / 2 + this.promptMain.displayWidth / 2 + 34);
  }

  updateHud() {
    const tier = this.session.tier;
    this.topicText.setText(`${this.topic.icon} ${this.topic.ro}  ·  ${tier.ro}`);
    this.birdsText.setText(`× ${Math.max(0, this.birdsLeft)}`);
    this.scoreText.setText(`★ ${this.score}`);
    this.pips.forEach((p, i) => {
      const r = this.results[i];
      if (r) p.setFillStyle(r.firstTry ? 0xffd166 : 0xff9f80, 1);
      else if (this.round && i === this.round.index) p.setFillStyle(0xffffff, 0.75);
      else p.setFillStyle(0xffffff, 0.16);
    });
    this.layout();
  }

  setPrompt(main, sub, hasAudio) {
    this.promptMain.setText(main);
    this.promptSub.setText(sub);
    // long prompts shrink to stay clear of the corner readouts
    const room = 470;
    this.promptMain.setScale(Math.min(1, room / Math.max(1, this.promptMain.width)));
    this.speakBtn.setVisible(!!hasAudio);
    this.placeSpeaker();
    this.tweens.add({ targets: this.promptMain, y: { from: -10, to: -2 }, alpha: { from: 0, to: 1 }, duration: 260 });
  }

  // Say the prompt. On a slow connection the clip may still be on its way, so
  // keep trying for a few seconds rather than leave a listening round silent.
  speakPrompt(attempt = 0) {
    const round = this.round;
    if (!round || !round.prompt.audio || this.state === 'done') return;
    if (voice.has(round.prompt.audio)) { voice.play(round.prompt.audio); return; }
    if (attempt < 25) this.time.delayedCall(300, () => { if (this.round === round) this.speakPrompt(attempt + 1); });
  }

  showBanner(main, sub, top, hold = 0) {
    this.bannerTop.setText(top || '');
    this.bannerMain.setText(main);
    this.bannerSub.setText(sub || '');
    this.bannerMain.setScale(1);
    this.bannerMain.setScale(Math.min(1, 760 / Math.max(1, this.bannerMain.width)));
    const w = Math.max(this.bannerMain.displayWidth, this.bannerSub.width, this.bannerTop.width) + 70;
    const y0 = top ? -78 : -44;
    const h = (sub ? 62 : 36) - y0;
    this.bannerBg.clear();
    this.bannerBg.fillStyle(0x1d1447, 0.95).fillRoundedRect(-w / 2, y0, w, h, 20);
    this.bannerBg.lineStyle(2.5, 0xfff0c8, 0.85).strokeRoundedRect(-w / 2, y0, w, h, 20);
    this.tweens.killTweensOf(this.banner);
    this.banner.setVisible(true).setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 240, ease: 'Back.easeOut' });
    if (hold) this.time.delayedCall(hold, () => this.hideBanner());
  }

  hideBanner() {
    if (!this.banner.visible) return;
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 180, onComplete: () => this.banner.setVisible(false) });
  }

  showToast(text, hold = 1700) {
    this.toast.setText(text).setVisible(true).setAlpha(0);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 1, y: { from: 86, to: 96 }, duration: 160 });
    if (this.toastTimer) this.toastTimer.remove();
    this.toastTimer = this.time.delayedCall(hold, () => {
      this.tweens.add({ targets: this.toast, alpha: 0, duration: 200, onComplete: () => this.toast.setVisible(false) });
    });
  }

  // --------------------------------------------------------------- rounds ----
  startRound(i) {
    this.clearBird();
    destroyTargets(this, this.targets);
    this.targets = [];
    this.ropeGfx.clear();
    this.clearTrail();
    this.clearSpeech();
    this.hideBanner();

    this.round = this.session.rounds[i];
    this.roundWrong = 0;
    this.backdrop.setNight((i / this.total) * 0.85);

    const { mechanic, options } = this.round;
    const built = mechanic === 'towers' ? buildTowers(this, options)
      : mechanic === 'signs' ? buildSigns(this, options)
        : buildNests(this, options, this.landing, this.round.answer);
    this.targets = built.targets;
    this.perch = built.perch;

    const p = this.round.prompt;
    this.setPrompt(p.main, p.sub, p.audio);
    this.updateHud();
    this.spawnBird();
    this.state = 'aim';
    this.time.delayedCall(380, () => { if (this.state === 'aim') this.speakPrompt(); });

    if (!progress.seenHowTo) {
      this.hint.setText('👆  Drag anywhere to pull the bird back, then let go').setVisible(true);
    }
  }

  // ----------------------------------------------------------------- bird ----
  spawnBird() {
    const b = this.matter.add.image(this.perch.x, this.perch.y, 'bird-sleepy');
    b.setScale(BIRD_SIZE / 256);
    b.setCircle(BIRD_R);
    b.setFriction(0.6).setBounce(0.35).setDensity(0.004);
    b.setStatic(true);
    b.setDepth(7);
    // face the middle of the field
    b.setFlipX(this.perch.x > W / 2);
    b.setAlpha(0);
    this.tweens.add({ targets: b, alpha: 1, duration: 220 });
    this.bird = b;
    this.birdLive = false;
    this.dragging = false;
    this.restFrames = 0;
    this.flightFrames = 0;
    this.showZzz(this.perch.x + (b.flipX ? -30 : 30), this.perch.y - 34);
  }

  showZzz(x, y) {
    this.clearZzz();
    this.zzz = txt(this, x, y, '💤', { fontSize: '26px' }).setOrigin(0.5).setDepth(7.5);
    this.zzzBase = y;
  }

  clearZzz() {
    if (this.zzz) { this.zzz.destroy(); this.zzz = null; }
  }

  clearBird() {
    if (this.bird) { this.tweens.killTweensOf(this.bird); this.bird.destroy(); this.bird = null; }
    this.clearZzz();
    this.dragging = false;
  }

  clearTrail() {
    this.trail = [];
    this.trailGfx.clear();
  }

  // --------------------------------------------------------------- input -----
  bindInput() {
    this.input.on('pointerdown', (pointer, over) => {
      if (this.state !== 'aim' || !this.bird || this.dragging || over.length) return;
      this.dragStart = worldPoint(this, pointer).clone();
      this.dragging = true;
      this.pullStep = 0;
      this.bird.setTexture('bird-fly');
      this.clearZzz();
      sfx.grab();
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.dragging || !this.bird) return;
      const p = worldPoint(this, pointer);
      const d = new Phaser.Math.Vector2(p.x - this.dragStart.x, p.y - this.dragStart.y);
      if (d.length() > MAX_PULL) d.setLength(MAX_PULL);
      this.bird.setPosition(this.perch.x + d.x, this.perch.y + d.y);
      if (Math.abs(d.x) > 4) this.bird.setFlipX(d.x > 0); // it will fly the other way
      const step = Math.floor(d.length() / 16);
      if (step !== this.pullStep) { this.pullStep = step; sfx.stretch(d.length() / MAX_PULL); }
    });

    // a level opened directly (a reload, a shortcut) still gets its lullaby
    this.input.once('pointerdown', () => music.start());

    const release = () => {
      if (!this.dragging || !this.bird) return;
      this.dragging = false;
      const dx = this.perch.x - this.bird.x;
      const dy = this.perch.y - this.bird.y;
      if (Math.hypot(dx, dy) < 14) { // too small to count: settle back to sleep
        this.bird.setPosition(this.perch.x, this.perch.y);
        this.bird.setTexture('bird-sleepy');
        this.showZzz(this.perch.x + (this.bird.flipX ? -30 : 30), this.perch.y - 34);
        return;
      }
      this.launch(dx * LAUNCH_POWER, dy * LAUNCH_POWER);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  launch(vx, vy) {
    this.clearTrail();
    this.clearZzz();
    this.bird.setStatic(false);
    this.bird.setVelocity(vx, vy);
    this.bird.setAngularVelocity(vx >= 0 ? 0.04 : -0.04);
    this.state = 'flight';
    this.birdLive = true;
    this.restFrames = 0;
    this.flightFrames = 0;
    sfx.launch(Math.hypot(vx, vy) / (MAX_PULL * LAUNCH_POWER));
    this.feathers.explode(5, this.perch.x, this.perch.y);
    if (this.hint.visible) { this.hint.setVisible(false); progress.markHowTo(); }
  }

  // The flight the engine will actually produce, step by step. Matter's
  // integrator is: v = v * (1 - airFriction) + gravity * dt^2; position += v.
  flightPath(x, y, vx, vy, steps) {
    const world = this.matter.world;
    const dt = world.runner.delta * world.engine.timing.timeScale;
    const drag = 1 - 0.01 * (dt / (1000 / 60));
    const grav = world.engine.gravity || world.localWorld.gravity;
    const g = grav.y * grav.scale * dt * dt;
    const pts = [];
    for (let i = 0; i < steps; i += 1) {
      vx *= drag;
      vy = vy * drag + g;
      x += vx;
      y += vy;
      pts.push({ x, y });
      if (y > GROUND_Y) break;
    }
    return pts;
  }

  drawAim() {
    this.bandGfx.clear();
    this.aimGfx.clear();
    if (!this.bird || this.state !== 'aim') return;
    const px = this.perch.x;
    const py = this.perch.y;
    if (this.dragging) {
      // the band: a dark outline under a tan strap, from a twig fork to the bird
      for (const ox of [-9, 9]) {
        this.bandGfx.lineStyle(7, 0x3a2410, 1).lineBetween(px + ox, py, this.bird.x, this.bird.y);
        this.bandGfx.lineStyle(3.5, 0xd8b077, 1).lineBetween(px + ox, py, this.bird.x, this.bird.y);
      }
      const pts = this.flightPath(
        this.bird.x, this.bird.y,
        (px - this.bird.x) * LAUNCH_POWER, (py - this.bird.y) * LAUNCH_POWER, AIM_STEPS,
      );
      pts.forEach((p, i) => {
        if (i % 3 !== 2) return;
        const k = 1 - i / AIM_STEPS;
        this.aimGfx.fillStyle(0xffffff, 0.25 + 0.6 * k).fillCircle(p.x, p.y, 2.2 + 2.4 * k);
      });
    }
  }

  // ----------------------------------------------------------- collisions ----
  bindCollisions() {
    this.lastBump = 0;
    this.matter.world.on('collisionstart', (event) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const birdBody = this.bird && this.bird.body;
        const isBird = birdBody && (a === birdBody || b === birdBody);
        const other = a === birdBody ? b : a;

        // impact sound, scaled by how hard and rate-limited
        const speed = Math.max(a.speed || 0, b.speed || 0);
        if (speed > 1.6 && this.time.now - this.lastBump > 70 && !other.isSensor) {
          this.lastBump = this.time.now;
          const k = Math.min(1, speed / 16);
          if (isBird) sfx.thud(k); else sfx.wood(k * 0.7);
          if (isBird && k > 0.35) {
            this.dust.explode(6, this.bird.x, this.bird.y + BIRD_R * 0.6);
            if (k > 0.6) this.cameras.main.shake(110, 0.0035);
          }
        }

        if (!isBird || !this.birdLive || this.state !== 'flight') continue;
        const target = other.nestTarget || (other.gameObject && other.gameObject.target);
        if (target && !target.dead) {
          if (target.option.key === this.round.answer) this.onCorrect(target);
          else this.onWrong(target);
          break;
        }
      }
    });
  }

  // -------------------------------------------------------------- results ----
  onCorrect(target) {
    this.state = 'resolve';
    this.birdLive = false;
    const round = this.round;
    const firstTry = this.roundWrong === 0;
    this.streak = firstTry ? this.streak + 1 : 0;
    const points = 100 + (firstTry ? 50 : 0) + (firstTry ? Math.min(this.streak - 1, 5) * 10 : 0);
    this.score += points;
    this.results[round.index] = { word: round.word, firstTry };
    progress.record(round.word.ro, firstTry);

    const at = targetPos(target);
    sfx.correct();
    this.stars.explode(22, at.x, at.y);
    this.floatText(`+${points}`, at.x, at.y - 40, COLOR.gold);
    if (target.sprite) {
      this.tweens.add({ targets: target.sprite, scaleX: target.sprite.scaleX * 1.12, scaleY: target.sprite.scaleY * 1.12, duration: 140, yoyo: true });
    }
    if (round.prompt.afterMain) this.setPrompt(round.prompt.afterMain, round.prompt.sub, round.prompt.audio);
    this.updateHud();

    const nest = target.kind === 'nest';
    const [ro, en] = nest ? [PHRASES.goodNight.ro, PHRASES.goodNight.en] : Phaser.Utils.Array.GetRandom(PRAISE);
    this.showBanner(round.reveal.main, round.reveal.sub, `${ro}  ·  ${en}`);
    if (nest) this.landInNest(target);

    const clips = nest ? [PHRASES.goodNight.a, ...round.reveal.audio] : round.reveal.audio;
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      if (round.index + 1 < this.total) this.startRound(round.index + 1);
      else this.finish();
    };
    const spoken = voice.play(clips, { onDone: () => this.time.delayedCall(650, advance) });
    this.time.delayedCall(Math.max(2400, spoken + 1500), advance); // in case a clip never reports back
  }

  onWrong(target) {
    this.roundWrong += 1;
    this.wrongAnswers += 1;
    this.streak = 0;
    this.birdLive = false;
    target.dead = true;
    const at = targetPos(target);
    sfx.wrong();
    this.cameras.main.shake(140, 0.004);
    this.feathers.explode(8, this.bird.x, this.bird.y);
    this.bird.setTexture('bird-grumpy');

    // say what was actually hit, so a miss still teaches
    const o = target.option;
    if (o.word) {
      this.showToast(`✗  ${o.kind === 'text' ? o.text : o.word.ro} = ${o.gloss || o.word.en}`);
      voice.play(o.word.a.w);
    } else {
      this.showToast(`✗  ${o.text}${o.gloss ? ` = ${o.gloss}` : ''}`);
    }
    target.mark = txt(this, at.x, at.y, '✗', { fontSize: '54px', color: '#d2413a', fontStyle: '800', stroke: '#ffffff', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(5.6).setAlpha(0.9);
    if (target.sprite) target.sprite.setTint(0xb9b3c9);
    if (target.tag) target.tag.setTint(0xb9b3c9);

    if (target.kind === 'nest') {
      this.state = 'resolve';
      this.wrongNest(target, () => { this.state = 'flight'; this.recycleBird(true); });
    } else {
      this.time.delayedCall(1500, () => { if (this.state === 'flight') this.recycleBird(true); });
    }
  }

  // A bird is used up: by a miss, or after a wrong answer.
  recycleBird(afterWrong = false) {
    if (this.state !== 'flight') return;
    this.birdsLeft -= 1;
    this.clearBird();
    this.clearSpeech();
    this.updateHud();
    if (this.birdsLeft <= 0) { this.fail(); return; }
    this.spawnBird();
    this.state = 'aim';
    if (afterWrong) this.time.delayedCall(250, () => { if (this.state === 'aim') this.speakPrompt(); });
  }

  floatText(str, x, y, color) {
    const t = txt(this, x, y, str, { fontFamily: FONT_DISPLAY, fontSize: '28px', color, fontStyle: '700', stroke: '#2a1a4f', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(31);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- nests ----
  // Take the bird off physics and tween its pose by hand.
  poseBird() {
    const b = this.bird;
    b.setStatic(true);
    b.setVelocity(0, 0);
    b.setAngularVelocity(0);
    const pp = { x: b.x, y: b.y, rot: Phaser.Math.Angle.Wrap(b.rotation) };
    const apply = () => { if (this.bird === b && b.active) { b.setPosition(pp.x, pp.y); b.setRotation(pp.rot); } };
    return { pp, apply };
  }

  // The payoff: the bird drifts up, then settles into the bowl and sleeps.
  landInNest(target) {
    const n = target.nest;
    const { pp, apply } = this.poseBird();
    this.tweens.add({
      targets: pp, x: n.restX, y: n.restY - n.h * 0.38, rot: 0, duration: 620, ease: 'Sine.easeOut', onUpdate: apply,
      onComplete: () => {
        if (!this.bird) return;
        this.bird.setTexture('bird-asleep');
        this.bird.setDepth(4); // behind the nest's front rim
        sfx.sleep();
        this.showZzz(n.cx + n.w * 0.3, n.top - 12);
        this.tweens.add({ targets: this.zzz, y: n.top - 26, alpha: { from: 0, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
        this.tweens.add({
          targets: pp, y: n.restY, rot: Phaser.Math.DegToRad(this.bird.flipX ? 6 : -6),
          duration: 620, ease: 'Sine.easeInOut', onUpdate: apply,
        });
      },
    });
  }

  // The wrong nest: the bird settles in, then realizes, protests in Romanian,
  // shakes its head, and glides back to the perch.
  wrongNest(target, onDone) {
    const n = target.nest;
    const { pp, apply } = this.poseBird();
    this.bird.setDepth(4);
    const step = (props, duration, ease, next) => this.tweens.add({
      targets: pp, ...props, duration, ease, onUpdate: apply, onComplete: () => { if (this.bird) next(); },
    });
    step({ x: n.restX, y: n.restY, rot: 0 }, 300, 'Sine.easeOut', () => {
      this.time.delayedCall(450, () => {
        if (!this.bird) return;
        this.bird.setDepth(7);
        this.speak(n.cx, n.top - 30, PHRASES.notMine);
        step({ y: n.restY - 20 }, 150, 'Quad.easeOut', () => {
          const x0 = pp.x;
          this.tweens.add({
            targets: pp, x: { from: x0 - 6, to: x0 + 6 }, duration: 80, yoyo: true, repeat: 3, onUpdate: apply,
            onComplete: () => this.time.delayedCall(1500, () => {
              if (!this.bird) return;
              this.clearSpeech();
              step({ x: this.perch.x, y: this.perch.y, rot: 0 }, 800, 'Sine.easeInOut', onDone);
            }),
          });
        });
      });
    });
  }

  speak(x, y, phrase) {
    this.clearSpeech();
    this.speech = this.add.container(x, y).setDepth(31);
    const ro = txt(this, 0, -11, phrase.ro, { fontFamily: FONT_DISPLAY, fontSize: '21px', color: COLOR.ink, fontStyle: '600' }).setOrigin(0.5);
    const en = txt(this, 0, 13, phrase.en, { fontSize: '15px', color: '#6b4a3a', fontStyle: '700' }).setOrigin(0.5);
    const w = Math.max(ro.width, en.width) + 28;
    const g = this.add.graphics();
    g.fillStyle(0xfff6dc, 0.97).fillRoundedRect(-w / 2, -30, w, 60, 14);
    g.lineStyle(2.5, 0x4a2148, 1).strokeRoundedRect(-w / 2, -30, w, 60, 14);
    g.fillStyle(0xfff6dc, 0.97).fillTriangle(-8, 29, 8, 29, 0, 42);
    this.speech.add([g, ro, en]);
    // keep the bubble on screen
    this.speech.x = Phaser.Math.Clamp(x, view.left + w / 2 + 8, view.right - w / 2 - 8);
    this.speech.y = Math.max(y, 104);
    this.speech.setScale(0.6);
    this.tweens.add({ targets: this.speech, scale: 1, duration: 180, ease: 'Back.easeOut' });
    voice.play(phrase.a);
  }

  clearSpeech() {
    if (this.speech) { this.speech.destroy(); this.speech = null; }
  }

  // ----------------------------------------------------------- end states ----
  finish() {
    this.state = 'done';
    this.hint.setVisible(false);
    this.clearBird();
    destroyTargets(this, this.targets);
    this.targets = [];
    this.ropeGfx.clear();
    this.hideBanner();
    this.setPrompt('', '', null);
    this.backdrop.setNight(1, 2200);

    const stars = this.wrongAnswers === 0 ? 3 : this.wrongAnswers <= 2 ? 2 : 1;
    this.score += this.birdsLeft * 20; // unused birds count
    const stanza = POEM.stanzas[progress.clears % POEM.stanzas.length];
    progress.recordLevel(this.topicId, this.tierId, stars, this.score);
    this.updateHud();
    sfx.fanfare();
    this.time.delayedCall(700, () => this.showResults(stars, stanza));
  }

  showResults(stars, stanza) {
    const objs = [];
    const add = (o) => { objs.push(o); return o; };
    add(this.add.rectangle(W / 2, H / 2, 4000, H * 2, 0x0d0830, 0.45).setDepth(39).setInteractive());
    add(panel(this, W / 2, 304, 940, 470));

    const lx = 300; // left column: how it went
    add(txt(this, lx, 104, 'Noapte bună!', { fontFamily: FONT_DISPLAY, fontSize: '40px', color: COLOR.gold, fontStyle: '600' }).setOrigin(0.5).setDepth(41));
    add(txt(this, lx, 140, `${this.topic.ro} · ${this.session.tier.ro} complete`, { fontSize: '17px', color: COLOR.pale, fontStyle: '700' }).setOrigin(0.5).setDepth(41));
    for (let i = 0; i < 3; i += 1) {
      const on = i < stars;
      const s = add(txt(this, lx - 62 + i * 62, 190, '★', { fontSize: '58px', color: on ? COLOR.gold : '#5a5390', fontStyle: '800' }).setOrigin(0.5).setDepth(41));
      if (on) {
        s.setScale(0);
        this.tweens.add({ targets: s, scale: 1, duration: 320, delay: 250 + i * 280, ease: 'Back.easeOut', onStart: () => sfx.star(i) });
      }
    }
    const first = this.results.filter((r) => r && r.firstTry).length;
    add(txt(this, lx, 240, `Score ${this.score}   ·   ${first} of ${this.total} right first time`, { fontSize: '18px', color: '#ffffff', fontStyle: '700' }).setOrigin(0.5).setDepth(41));

    // the words practiced: gold = right first time, coral = needed another try
    this.results.forEach((r, i) => {
      if (!r) return;
      const cx = lx - 147 + (i % 4) * 98;
      const cy = 292 + Math.floor(i / 4) * 78;
      const g = add(this.add.graphics().setDepth(41));
      g.fillStyle(r.firstTry ? 0x3a3477 : 0x5a2d4a, 1).fillRoundedRect(cx - 45, cy - 34, 90, 68, 12);
      g.lineStyle(2, r.firstTry ? 0xffd166 : 0xff9f80, 1).strokeRoundedRect(cx - 45, cy - 34, 90, 68, 12);
      add(this.add.image(cx, cy - 11, emojiKey(this, r.word.emoji)).setDisplaySize(36, 36).setDepth(42));
      const label = add(txt(this, cx, cy + 19, r.word.ro, { fontFamily: FONT_DISPLAY, fontSize: '16px', color: '#ffffff', fontStyle: '500' }).setOrigin(0.5).setDepth(42));
      label.setScale(Math.min(1, 82 / label.width));
      const zone = add(this.add.zone(cx, cy, 90, 68).setInteractive({ useHandCursor: true }).setDepth(43));
      zone.on('pointerup', () => voice.play(r.word.a.e ?? r.word.a.w));
    });

    // right column: a stanza of the poem the game is named for
    const rx = 742;
    add(txt(this, rx, 100, '— Mihai Eminescu, „Somnoroase păsărele” —', { fontSize: '14px', color: COLOR.pale, fontStyle: '700' }).setOrigin(0.5).setDepth(41));
    add(txt(this, rx, 176, stanza.ro.join('\n'), { fontFamily: FONT_POEM, fontSize: '23px', color: COLOR.cream, fontStyle: 'italic', align: 'center', lineSpacing: 5 }).setOrigin(0.5).setDepth(41));
    add(txt(this, rx, 300, stanza.en.join('\n'), { fontSize: '15px', color: COLOR.pale, fontStyle: '600', align: 'center', lineSpacing: 3 }).setOrigin(0.5).setDepth(41));
    add(button(this, rx, 372, '🔊  Listen', { w: 150, h: 42, fontSize: 18, onClick: () => voice.play(stanza.a) }));
    this.time.delayedCall(1700, () => { if (this.state === 'done') voice.play([PHRASES.goodNight.a, stanza.a], { gap: 500 }); });

    const next = this.nextLevel();
    add(button(this, 250, 486, 'Topics', { w: 160, h: 50, fontSize: 21, onClick: () => this.scene.start('Map') }));
    add(button(this, 440, 486, '↻  Again', { w: 170, h: 50, fontSize: 21, onClick: () => this.scene.restart({ topicId: this.topicId, tier: this.tierId }) }));
    add(button(this, 712, 486, `${next.label}  ▶`, {
      w: 320, h: 54, fontSize: 22, fill: 0xffd166, onClick: () => this.scene.start('Game', { topicId: next.topicId, tier: next.tier }),
    }));
  }

  // After a level: the same topic one tier deeper, then the next topic.
  nextLevel() {
    if (this.tierId < TIERS.length) {
      const t = TIERS[this.tierId];
      return { topicId: this.topicId, tier: t.id, label: `${t.ro} · ${t.en}` };
    }
    const i = TOPICS.findIndex((t) => t.id === this.topicId);
    const topic = TOPICS[(i + 1) % TOPICS.length];
    return { topicId: topic.id, tier: 1, label: `${topic.icon} ${topic.ro}` };
  }

  fail() {
    this.state = 'done';
    this.clearBird();
    this.hideBanner();
    voice.stop();
    sfx.fail();
    const objs = [];
    objs.push(this.add.rectangle(W / 2, H / 2, 4000, H * 2, 0x0d0830, 0.5).setDepth(39).setInteractive());
    objs.push(panel(this, W / 2, 290, 560, 300));
    objs.push(this.add.image(W / 2, 196, 'bird-asleep').setDisplaySize(96, 96).setDepth(41));
    objs.push(txt(this, W / 2, 262, PHRASES.tryAgain.ro, { fontFamily: FONT_DISPLAY, fontSize: '38px', color: COLOR.gold, fontStyle: '600' }).setOrigin(0.5).setDepth(41));
    objs.push(txt(this, W / 2, 304, 'Try again — the birds ran out before bedtime.', { fontSize: '18px', color: COLOR.pale, fontStyle: '700' }).setOrigin(0.5).setDepth(41));
    button(this, W / 2 - 110, 372, 'Topics', { w: 170, h: 52, fontSize: 21, onClick: () => this.scene.start('Map') });
    button(this, W / 2 + 110, 372, '↻  Again', { w: 190, h: 52, fontSize: 21, fill: 0xffd166, onClick: () => this.scene.restart({ topicId: this.topicId, tier: this.tierId }) });
    this.time.delayedCall(500, () => voice.play(PHRASES.tryAgain.a));
  }

  // ----------------------------------------------------------------- menu ----
  openMenu() {
    if (this.menu || this.state === 'done') return;
    const was = this.state;
    this.matter.world.pause();
    this.state = 'menu';
    const objs = [];
    const close = () => {
      objs.forEach((o) => o.destroy());
      this.menu = null;
      this.matter.world.resume();
      this.state = was;
    };
    objs.push(this.add.rectangle(W / 2, H / 2, 4000, H * 2, 0x0d0830, 0.5).setDepth(39).setInteractive());
    objs.push(panel(this, W / 2, 292, 380, 372));
    objs.push(txt(this, W / 2, 142, 'Pauză · Paused', { fontFamily: FONT_DISPLAY, fontSize: '28px', color: COLOR.gold, fontStyle: '600' }).setOrigin(0.5).setDepth(41));
    const label = (name, on) => `${name}: ${on ? 'on' : 'off'}`;
    objs.push(button(this, W / 2, 204, '▶  Continue', { w: 280, h: 50, fontSize: 21, fill: 0xffd166, onClick: close }));
    const mus = button(this, W / 2, 264, label('🎵  Music', progress.settings.music), {
      w: 280, h: 50, fontSize: 21,
      onClick: () => { progress.setSetting('music', !progress.settings.music); applySettings(); mus.label.setText(label('🎵  Music', progress.settings.music)); },
    });
    const snd = button(this, W / 2, 324, label('🔊  Sound', progress.settings.sound), {
      w: 280, h: 50, fontSize: 21,
      onClick: () => { progress.setSetting('sound', !progress.settings.sound); applySettings(); snd.label.setText(label('🔊  Sound', progress.settings.sound)); },
    });
    objs.push(mus, snd);
    objs.push(button(this, W / 2, 384, 'Topics', { w: 280, h: 50, fontSize: 21, onClick: () => { this.matter.world.resume(); this.scene.start('Map'); } }));
    objs.push(txt(this, W / 2, 440, 'Leaving ends this level.', { fontSize: '14px', color: COLOR.pale, fontStyle: '600' }).setOrigin(0.5).setDepth(41));
    this.menu = objs;
  }

  // --------------------------------------------------------------- update ----
  update() {
    if (this.zzz && this.bird && this.state === 'aim' && !this.dragging) {
      this.zzz.setY(this.zzzBase + Math.sin(this.time.now / 320) * 3);
    }
    if (this.targets.length && this.round && this.round.mechanic === 'signs') drawRopes(this.ropeGfx, this.targets);
    this.targets.forEach((t) => { if (t.mark && t.sprite && t.sprite.active) t.mark.setPosition(t.sprite.x, t.sprite.y); });
    this.drawAim();

    if (this.state !== 'flight' || !this.bird) return;
    this.flightFrames += 1;
    // dotted trail of the flight just taken, to judge the next shot against
    if (this.birdLive && this.flightFrames % 4 === 0 && this.trail.length < 70) {
      this.trail.push({ x: this.bird.x, y: this.bird.y });
      this.trailGfx.fillStyle(0xffffff, 0.42).fillCircle(this.bird.x, this.bird.y, 2.6);
    }
    if (!this.birdLive) return; // a wrong answer is already being resolved
    const v = this.bird.body.velocity;
    const off = this.bird.x < view.left - 80 || this.bird.x > view.right + 80 || this.bird.y > H + 80;
    this.restFrames = Math.hypot(v.x, v.y) < 0.4 && !off ? this.restFrames + 1 : 0;
    if (off || this.restFrames > 45 || this.flightFrames > 900) this.recycleBird(false);
  }
}

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { LEVELS, levelParams } from '../data/words.js';

const GROUND_Y = GAME_HEIGHT - 48;
const ANCHOR = { x: 180, y: GROUND_Y - 150 };
const MAX_STRETCH = 120; // how far back the slingshot can be pulled
const LAUNCH_POWER = 0.22; // drag distance -> velocity multiplier

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.buildWorld();
    this.buildSlingshot();
    this.buildHud();
    this.bindInput();
    this.bindCollisions();

    // dev-only handle for automated playtesting in a headless browser
    if (import.meta.env.DEV) {
      window.__scene = this;
      // ?mode=nest plays only nest rounds so the landing feel can be tuned in
      // isolation; the live knock-down game is untouched without the flag.
      const params = new URLSearchParams(window.location.search);
      this.forceNest = params.get('mode') === 'nest';
    }

    // tunable alignment for the bird as it rests in a nest (see nestRestPose);
    // adjust live in dev with __scene.tuneNest({ ... }).
    this.nestTune = { scale: 1, hide: 0.08, tilt: -6, dx: 0.05, floatUp: 0.25, sleepDx: 0.2, sleepDy: -0.3 };

    this.score = 0;
    this.levelIndex = 0;
    this.startLevel();
  }

  // ---------------------------------------------------------------- world ----
  buildWorld() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a2f6b, 0x2a2f6b, 0x4b3a72, 0x7a5a82, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.circle(GAME_WIDTH - 120, 90, 46, 0xf5f0c8, 0.9);
    this.add.circle(GAME_WIDTH - 100, 80, 40, 0x4b3a72, 1).setAlpha(0.25);

    this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 24, GAME_WIDTH, 48, 0x355e3b);
    this.matter.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 24, GAME_WIDTH, 48, {
      isStatic: true,
      friction: 0.8,
      label: 'ground',
    });

    // Invisible side walls only: nothing escapes left/right (no restoring force
    // there). The top is open on purpose — gravity is the ceiling, so high
    // parabolas can sail off the top and arc back down.
    const wall = { isStatic: true, friction: 0, restitution: 0.2, label: 'wall' };
    this.matter.add.rectangle(-25, 0, 50, GAME_HEIGHT * 4, wall);
    this.matter.add.rectangle(GAME_WIDTH + 25, 0, 50, GAME_HEIGHT * 4, wall);
  }

  buildSlingshot() {
    const g = this.add.graphics();
    g.lineStyle(10, 0x5a3a1b, 1);
    g.beginPath();
    g.moveTo(ANCHOR.x, GROUND_Y);
    g.lineTo(ANCHOR.x, ANCHOR.y);
    g.strokePath();
    g.setDepth(1);

    this.bandGfx = this.add.graphics().setDepth(3);
    this.aimGfx = this.add.graphics().setDepth(2);
  }

  spawnBird() {
    this.bird = this.matter.add.image(ANCHOR.x, ANCHOR.y, 'bird');
    this.bird.setCircle(24);
    this.bird.setFriction(0.6);
    this.bird.setBounce(0.35);
    this.bird.setDensity(0.004);
    this.bird.setStatic(true);
    this.bird.setDepth(7); // flies above the nests' front rims

    this.zzz = this.add.text(ANCHOR.x + 16, ANCHOR.y - 28, '💤', {
      fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(6);

    this.launched = false;
    this.dragging = false;
    this.restFrames = 0;
  }

  clearZzz() {
    if (this.zzz) {
      this.zzz.destroy();
      this.zzz = null;
    }
  }

  clearBird() {
    if (this.bird) {
      this.bird.destroy();
      this.bird = null;
    }
    this.clearZzz();
    this.launched = false;
    this.dragging = false;
    this.restFrames = 0;
  }

  // --------------------------------------------------------------- levels ----
  startLevel() {
    this.level = LEVELS[this.levelIndex];
    const p = levelParams(this.levelIndex);
    this.targetCount = p.targetCount;
    this.wordsToClear = p.wordsToClear;
    this.birdsLeft = p.birds;
    this.wordsCleared = 0;
    this.usedWords = new Set();
    this.gameState = 'playing';

    // landing demand for nest rounds: 0 = forgiving (wide, short walls),
    // 1 = demanding (narrow opening, tall walls that force a real arc).
    this.landingDifficulty = Math.min(this.levelIndex / 4, 1);
    if (this.forceNest) {
      // a meaty default for isolated tuning; override live via __scene
      this.targetCount = 3;
      this.landingDifficulty = 0.55;
    }

    this.updateHud();
    this.showToast('Level ' + (this.levelIndex + 1) + ' · ' + this.level.theme + ' ' + this.level.icon);
    this.startRound();
  }

  startRound() {
    this.clearBird();
    this.clearTargets();
    this.clearSpeech();
    this.roundResolved = false;

    // answer prefers an unused word; distractors come from the same theme
    const words = this.level.words;
    let pool = words.filter((w) => !this.usedWords.has(w.ro));
    if (pool.length === 0) {
      this.usedWords.clear();
      pool = [...words];
    }
    this.answer = Phaser.Utils.Array.GetRandom(pool);
    this.usedWords.add(this.answer.ro);
    const distractors = Phaser.Utils.Array.Shuffle(
      words.filter((w) => w.ro !== this.answer.ro),
    ).slice(0, this.targetCount - 1);
    const placement = Phaser.Utils.Array.Shuffle([this.answer, ...distractors]);

    // spread targets across the right of the field at varied heights
    const startX = GAME_WIDTH * (this.forceNest ? 0.5 : 0.42);
    const endX = GAME_WIDTH * (this.forceNest ? 0.86 : 0.95);
    const tiers = Phaser.Utils.Array.Shuffle([0, 1, 2, 0, 1]);
    const build = this.forceNest ? this.buildNest : this.buildTarget;
    this.targets = placement.map((word, i) => {
      const x = placement.length === 1
        ? (startX + endX) / 2
        : startX + ((endX - startX) * i) / (placement.length - 1);
      return build.call(this, x, word, tiers[i % tiers.length]);
    });

    this.promptText.setText(this.answer.ro);
    this.hintText.setText(this.forceNest
      ? 'Tuck the bird into the "' + this.answer.ro + '" nest'
      : 'Find the "' + this.answer.ro + '"');
    this.feedbackText.setText('');
    this.spawnBird();
  }

  buildTarget(x, word, tier) {
    const towerH = tier + 1; // 1..3 boxes -> varied perch heights
    const boxes = [];
    for (let row = 0; row < towerH; row += 1) {
      const by = GROUND_Y - 30 - row * 60;
      boxes.push(
        this.matter.add.image(x, by, 'box').setFriction(0.8).setBounce(0.1).setDepth(2),
      );
    }

    const perchTop = GROUND_Y - 30 - towerH * 60 - 44;
    const go = this.matter.add.image(x, perchTop, 'target');
    go.setRectangle(88, 88, { chamfer: { radius: 14 } });
    go.setFriction(0.8);
    go.setBounce(0.1);
    go.setDensity(0.003);
    go.setDepth(3);
    go.isTarget = true;
    go.word = word;

    const label = this.add.text(x, perchTop, word.emoji + '\n' + word.en, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      align: 'center',
      color: '#06283d',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);

    return { go, label, boxes, word };
  }

  // An open-top nest the bird must arc down into, drawn with the 🪹 emoji.
  // Static (opening always faces up → round stays winnable); difficulty comes
  // from opening width + nest height/placement, set by this.landingDifficulty.
  buildNest(x, word, tier) {
    const landing = this.landingDifficulty ?? 0.4;
    const cx = x;
    const size = Phaser.Math.Linear(150, 116, landing);
    const cyImg = GROUND_Y - size * 0.5 - (18 + tier * 64);

    // back layer: the whole nest. front layer: a copy cropped to just the front
    // lip, drawn above the bird so a settled bird is occluded and looks *inside*.
    const img = this.add.image(cx, cyImg, 'nest').setDisplaySize(size, size).setDepth(2);
    const imgFront = this.add.image(cx, cyImg, 'nest').setDisplaySize(size, size).setDepth(5);
    const texH = imgFront.frame.realHeight;
    imgFront.setCrop(0, texH * 0.58, texH, texH * 0.42); // bottom lip only

    // the bowl's opening sits a touch above the emoji's centre; physics walls
    // run along the visible bowl sides so a flat shot is blocked and you must
    // drop in from above.
    const openCy = cyImg - size * 0.04;
    const openH = size * 0.30;
    const openW = size * Phaser.Math.Linear(0.50, 0.38, landing);
    const rimTop = openCy - openH / 2;
    const floorTopY = openCy + openH / 2;
    const wallT = 12;
    const floorThk = 14;

    const solid = { isStatic: true, friction: 0.95, restitution: 0.05, label: 'nest' };
    const floor = this.matter.add.rectangle(cx, floorTopY + floorThk / 2, openW + 2 * wallT, floorThk, solid);
    const leftWall = this.matter.add.rectangle(cx - openW / 2 - wallT / 2, openCy, wallT, openH, solid);
    const rightWall = this.matter.add.rectangle(cx + openW / 2 + wallT / 2, openCy, wallT, openH, solid);
    const sensor = this.matter.add.rectangle(cx, openCy, openW * 0.9, openH * 0.9, {
      isStatic: true, isSensor: true, label: 'nestSensor',
    });

    const label = this.add.text(cx, cyImg + size * 0.5 + 4, word.emoji + '\n' + word.en, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      align: 'center',
      color: '#f3ead6',
      fontStyle: 'bold',
      backgroundColor: '#0b1026aa',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(6);

    const nest = { bodies: [floor, leftWall, rightWall], sensor, gfx: img, gfxFront: imgFront, label, word, cx, cyImg, size, restY: floorTopY - 6 };
    sensor.isNestSensor = true;
    sensor.word = word;
    sensor.nest = nest;
    return nest;
  }

  // where/how the bird rests in a nest, from this.nestTune + the nest geometry.
  // The front-rim layer is cropped at 58% down the texture, so its top edge is
  // at cyImg + 0.08*size; the bird rests `sink` of its height below that line.
  nestRestPose(nest) {
    const t = this.nestTune;
    const s = t.scale; // multiplier on the bird's native size; 1 = no shrink
    const birdH = 80 * s;
    const rimTopY = nest.cyImg + 0.08 * nest.size; // top edge of the front lip
    return {
      x: nest.cx + t.dx * nest.size,
      // `hide` = fraction of the bird tucked behind the rim (0 = on top, 0.5 = half)
      y: rimTopY - (0.5 - t.hide) * birdH,
      s,
      rot: Phaser.Math.DegToRad(t.tilt),
    };
  }

  // dev: snap a bird into the first nest with the current tune so the landed
  // look can be dialled in live, e.g. __scene.tuneNest({ sink: 0.25, scale: 0.5 })
  tuneNest(opts = {}) {
    Object.assign(this.nestTune, opts);
    const nest = this.targets && this.targets[0];
    if (!nest) { console.warn('no nest to tune against'); return; }
    if (!this.bird) this.spawnBird();
    this.bird.setStatic(true);
    this.bird.setVelocity(0, 0);
    this.bird.setDepth(4);
    const pose = this.nestRestPose(nest);
    this.bird.setPosition(pose.x, pose.y);
    this.bird.setRotation(pose.rot);
    this.bird.setScale(pose.s);
    this.sleepAt(pose.x + nest.size * this.nestTune.sleepDx, pose.y + nest.size * this.nestTune.sleepDy);
    console.log('nestTune =', JSON.stringify(this.nestTune));
  }

  // The landing payoff: the bird drifts gently straight up just above the nest,
  // gets its 💤, then settles softly down into the bowl to sleep.
  animateNestLanding(nest) {
    this.bird.setStatic(true);
    this.bird.setVelocity(0, 0);
    this.bird.setAngularVelocity(0);
    this.bird.setDepth(4); // tuck behind the nest's front rim → looks inside

    const pose = this.nestRestPose(nest);
    const aboveY = pose.y - this.nestTune.floatUp * nest.size;
    const pp = { x: this.bird.x, y: this.bird.y, rot: this.bird.rotation, s: this.bird.scaleX };
    const apply = () => {
      if (!this.bird) return;
      this.bird.setPosition(pp.x, pp.y);
      this.bird.setRotation(pp.rot);
      this.bird.setScale(pp.s);
    };
    // phase 1: gentle rise to just above the nest, straightening upright
    this.tweens.add({
      targets: pp, x: pose.x, y: aboveY, rot: 0, s: pose.s,
      duration: 700, ease: 'Sine.easeOut', onUpdate: apply,
      onComplete: () => {
        this.sleepAt(pose.x + nest.size * this.nestTune.sleepDx, pose.y + nest.size * this.nestTune.sleepDy);
        // phase 2: settle softly down into the bowl, head tilting to sleep
        this.tweens.add({
          targets: pp, y: pose.y, rot: Phaser.Math.DegToRad(this.nestTune.tilt),
          duration: 650, ease: 'Sine.easeInOut', onUpdate: apply,
        });
      },
    });
  }

  // dev: replay the landing motion on the first nest without scoring/advancing
  previewLand() {
    const nest = this.targets && this.targets[0];
    if (!nest) { console.warn('no nest to preview'); return; }
    if (!this.bird) this.spawnBird();
    this.clearZzz();
    this.launched = true;       // suppress the slingshot bands during preview
    this.roundResolved = true;  // and stop the idle bird from being recycled
    this.bird.setStatic(true);
    this.bird.setScale(1);
    this.bird.setRotation(0.4);
    this.bird.setPosition(nest.cx + 24, nest.cyImg - nest.size * 0.55);
    this.animateNestLanding(nest);
  }

  // bird settled into the correct nest — let it fall asleep
  onCorrectNest(nest) {
    this.roundResolved = true;
    this.score += 1;
    this.wordsCleared += 1;
    this.birdsLeft -= 1;
    this.updateHud();

    this.animateNestLanding(nest);

    this.feedbackText.setColor('#cfe3ff');
    this.feedbackText.setText('Noapte bună 🌙\n' + this.answer.ro + ' = ' + this.answer.en);

    this.time.delayedCall(2200, () => {
      if (this.wordsCleared >= this.wordsToClear) this.onLevelClear();
      else if (this.birdsLeft <= 0) this.onGameOver();
      else this.startRound();
    });
  }

  // A little speech bubble above a nest — the bird "saying" something. (When the
  // bird gets a voice, this is where a spoken line would sync.)
  speakWrong(nest) {
    this.clearSpeech();
    const y = nest.cyImg - nest.size * 0.5;
    this.speechObj = this.add.text(nest.cx, y, 'Ăsta nu-i cuibul meu!', {
      fontFamily: 'Georgia, serif', fontSize: '19px', color: '#fff3c4', fontStyle: 'italic',
      backgroundColor: '#0b1026cc', padding: { x: 10, y: 6 }, align: 'center',
    }).setOrigin(0.5).setDepth(21).setAlpha(0);
    this.tweens.add({ targets: this.speechObj, alpha: 1, y: y - 8, duration: 200 });
  }

  clearSpeech() {
    if (this.speechObj) { this.speechObj.destroy(); this.speechObj = null; }
  }

  // The wrong-nest beat: the bird settles in as if home, pauses, then *realizes*
  // it's the wrong nest — pops up, protests in Romanian, shakes its head "no",
  // and hops back out.
  animateWrongNest(nest, onDone) {
    this.bird.setStatic(true);
    this.bird.setVelocity(0, 0);
    this.bird.setAngularVelocity(0);
    this.bird.setDepth(4); // settles in at first — it thinks it's home
    const pose = this.nestRestPose(nest);
    const pp = { x: this.bird.x, y: this.bird.y, rot: this.bird.rotation, s: this.bird.scaleX, a: 1 };
    const apply = () => {
      if (!this.bird) return;
      this.bird.setPosition(pp.x, pp.y);
      this.bird.setRotation(pp.rot);
      this.bird.setScale(pp.s);
      this.bird.setAlpha(pp.a);
    };
    // 0: settle into the nest as if it were home
    this.tweens.add({
      targets: pp, x: pose.x, y: pose.y, rot: pose.rot, s: pose.s,
      duration: 300, ease: 'Sine.easeOut', onUpdate: apply,
      onComplete: () => {
        // ...a beat... then the realization
        this.time.delayedCall(650, () => {
          if (!this.bird) return;
          this.bird.setDepth(7); // pops above the rim now
          this.speakWrong(nest);
          const baseX = pp.x;
          // 1: startled perk-up
          this.tweens.add({
            targets: pp, y: pose.y - 18, rot: 0, duration: 150, ease: 'Quad.easeOut', onUpdate: apply,
            onComplete: () => {
              // 2: shake head "no" — side-to-side, upright
              this.tweens.add({
                targets: pp, x: { from: baseX - 6, to: baseX + 6 }, duration: 80, ease: 'Sine.easeInOut',
                yoyo: true, repeat: 3, onUpdate: apply,
                onComplete: () => {
                  // a beat to read the line (and later hear it), then glide
                  // slowly back to the slingshot to try again
                  this.time.delayedCall(1000, () => {
                    if (!this.bird) return;
                    this.clearSpeech();
                    this.tweens.add({
                      targets: pp, x: ANCHOR.x, y: ANCHOR.y, rot: 0,
                      duration: 850, ease: 'Sine.easeInOut', onUpdate: apply,
                      onComplete: () => onDone && onDone(),
                    });
                  });
                },
              });
            },
          });
        });
      },
    });
  }

  // dev: replay the wrong-nest reaction on a distractor nest
  previewWrong() {
    const nest = (this.targets || []).find((t) => t.word.ro !== this.answer.ro) || (this.targets || [])[0];
    if (!nest) { console.warn('no nest to preview'); return; }
    if (!this.bird) this.spawnBird();
    this.launched = true;
    this.roundResolved = true; // dev: stop idle-recycle during preview
    this.bird.setScale(1);
    this.bird.setAlpha(1);
    this.bird.setPosition(nest.cx, nest.cyImg - nest.size * 0.4);
    this.animateWrongNest(nest, () => { this.clearSpeech(); this.feedbackText.setText(''); });
  }

  // bird dropped into the wrong nest — react, then spend it and retry the word
  onWrongNest(nest) {
    if (this.roundResolved || this.wrongResolving) return;
    this.wrongResolving = true;
    this.animateWrongNest(nest, () => {
      this.wrongResolving = false;
      this.clearSpeech();
      this.feedbackText.setText('');
      this.recycleBird(); // costs a bird; respawns to retry, or ends the game
    });
  }

  sleepAt(x, y) {
    this.clearZzz();
    this.zzz = this.add.text(x, y, '💤', {
      fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      fontSize: '26px',
    }).setOrigin(0.5).setDepth(7).setAlpha(0);
    this.tweens.add({ targets: this.zzz, alpha: 1, y: y - 12, duration: 600, yoyo: true, repeat: 2 });
  }

  clearTargets() {
    if (!this.targets) return;
    this.targets.forEach((t) => {
      if (t.label) t.label.destroy();
      if (t.go) t.go.destroy();
      if (t.boxes) t.boxes.forEach((b) => b.destroy());
      if (t.gfx) t.gfx.destroy();
      if (t.gfxFront) t.gfxFront.destroy();
      if (t.sensor) this.matter.world.remove(t.sensor);
      if (t.bodies) t.bodies.forEach((b) => this.matter.world.remove(b));
    });
    this.targets = [];
  }

  // ----------------------------------------------------------------- hud -----
  buildHud() {
    this.add.rectangle(GAME_WIDTH / 2, 34, GAME_WIDTH, 68, 0x0b1026, 0.55).setDepth(10);

    this.levelText = this.add.text(20, 12, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#9fb3ff',
      fontStyle: 'bold',
    }).setDepth(11);

    this.progressText = this.add.text(20, 36, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#c9d3ff',
    }).setDepth(11);

    this.promptText = this.add.text(GAME_WIDTH / 2, 30, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '34px',
      color: '#ffd166',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    this.hintText = this.add.text(GAME_WIDTH / 2, 56, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#c9d3ff',
    }).setOrigin(0.5, 0).setDepth(11);

    this.scoreText = this.add.text(GAME_WIDTH - 20, 12, 'Score: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#9fffb3',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(11);

    this.birdsText = this.add.text(GAME_WIDTH - 20, 36, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#ffd1d1',
    }).setOrigin(1, 0).setDepth(11);

    this.feedbackText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '38px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(20);
  }

  updateHud() {
    this.levelText.setText('Level ' + (this.levelIndex + 1) + ' · ' + this.level.theme + ' ' + this.level.icon);
    this.progressText.setText('Cleared ' + this.wordsCleared + ' / ' + this.wordsToClear);
    this.scoreText.setText('Score: ' + this.score);
    this.birdsText.setText('🐦 × ' + Math.max(0, this.birdsLeft));
  }

  // --------------------------------------------------------------- input -----
  bindInput() {
    this.input.on('pointerdown', (p) => {
      // while an overlay is up, a tap advances it
      if (this.gameState !== 'playing') {
        if (this.overlayTap) {
          const cb = this.overlayTap;
          this.overlayTap = null;
          this.hideOverlay();
          cb();
        }
        return;
      }
      if (!this.bird || this.launched || this.roundResolved) return;
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.bird.x, this.bird.y);
      if (d < 60) this.dragging = true;
    });

    this.input.on('pointermove', (p) => {
      if (!this.dragging || !this.bird) return;
      const angle = Phaser.Math.Angle.Between(ANCHOR.x, ANCHOR.y, p.x, p.y);
      const dist = Math.min(MAX_STRETCH, Phaser.Math.Distance.Between(ANCHOR.x, ANCHOR.y, p.x, p.y));
      this.bird.setPosition(ANCHOR.x + Math.cos(angle) * dist, ANCHOR.y + Math.sin(angle) * dist);
    });

    this.input.on('pointerup', () => {
      if (!this.dragging || !this.bird) return;
      this.dragging = false;
      const dx = ANCHOR.x - this.bird.x;
      const dy = ANCHOR.y - this.bird.y;
      if (Math.hypot(dx, dy) < 12) {
        this.bird.setPosition(ANCHOR.x, ANCHOR.y);
        return;
      }
      this.bird.setStatic(false);
      this.bird.setVelocity(dx * LAUNCH_POWER, dy * LAUNCH_POWER);
      this.bird.setAngularVelocity(0.05);
      this.clearZzz(); // awake now!
      this.launched = true;
    });
  }

  // ----------------------------------------------------------- collisions ----
  bindCollisions() {
    this.matter.world.on('collisionstart', (event) => {
      if (this.gameState !== 'playing' || this.roundResolved || this.wrongResolving || !this.launched || !this.bird) return;
      const birdBody = this.bird.body;
      for (const pair of event.pairs) {
        let otherBody = null;
        if (pair.bodyA === birdBody) otherBody = pair.bodyB;
        else if (pair.bodyB === birdBody) otherBody = pair.bodyA;
        else continue;

        // nest round: raw sensor body carries its nest + word
        if (otherBody.isNestSensor) {
          if (otherBody.word.ro === this.answer.ro) this.onCorrectNest(otherBody.nest);
          else this.onWrongNest(otherBody.nest);
          break;
        }
        // knock-down round: a target game object
        const other = otherBody.gameObject;
        if (other && other.isTarget) {
          if (other.word.ro === this.answer.ro) this.onCorrect(other);
          else this.onWrong(other);
          break;
        }
      }
    });
  }

  onCorrect(targetGo) {
    this.roundResolved = true;
    this.score += 1;
    this.wordsCleared += 1;
    this.birdsLeft -= 1; // the launch that scored still costs a bird
    this.updateHud();

    targetGo.setTint(0x9fffb3);
    this.feedbackText.setColor('#9fffb3');
    this.feedbackText.setText('Bravo! 🎉\n' + this.answer.ro + ' = ' + this.answer.en);

    this.time.delayedCall(1300, () => {
      if (this.wordsCleared >= this.wordsToClear) this.onLevelClear();
      else if (this.birdsLeft <= 0) this.onGameOver();
      else this.startRound();
    });
  }

  onWrong(targetGo) {
    // feedback only; the bird will come to rest and be spent in recycleBird
    targetGo.setTint(0xff8a8a);
    this.feedbackText.setColor('#ffb3b3');
    this.feedbackText.setText('Nu... that is "' + targetGo.word.ro + '"');
    this.time.delayedCall(900, () => {
      if (!this.roundResolved) this.feedbackText.setText('');
      if (targetGo.active) targetGo.clearTint();
    });
  }

  recycleBird() {
    // reached only on a miss / wrong hit (round not yet resolved)
    this.birdsLeft -= 1;
    this.clearBird();
    this.updateHud();
    if (this.birdsLeft <= 0) this.onGameOver();
    else this.spawnBird();
  }

  // ----------------------------------------------------------- end states ----
  onLevelClear() {
    this.gameState = 'paused';
    this.clearBird();
    this.clearTargets();
    this.clearPrompts();
    this.levelIndex += 1;
    if (this.levelIndex >= LEVELS.length) {
      this.showOverlay('Felicitări! 🎉', 'You cleared every level!\nFinal score: ' + this.score, 'Tap to play again', () => this.restartGame());
    } else {
      this.showOverlay('Level Complete! ✨', 'Score: ' + this.score, 'Tap for the next theme', () => this.startLevel());
    }
  }

  onGameOver() {
    this.gameState = 'paused';
    this.clearBird();
    this.clearTargets();
    this.clearPrompts();
    this.showOverlay('Out of birds 😴', 'Score: ' + this.score + '  ·  Reached Level ' + (this.levelIndex + 1), 'Tap to try again', () => this.restartGame());
  }

  restartGame() {
    this.score = 0;
    this.levelIndex = 0;
    this.startLevel();
  }

  clearPrompts() {
    this.promptText.setText('');
    this.hintText.setText('');
    this.feedbackText.setText('');
  }

  // ------------------------------------------------------------- overlays ----
  showToast(text) {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.32, text, {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: '#0b1026cc',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 250, yoyo: true, hold: 1100, onComplete: () => t.destroy() });
  }

  showOverlay(title, subtitle, prompt, onTap) {
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1026, 0.8).setDepth(40);
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, title, {
      fontFamily: 'Georgia, serif', fontSize: '56px', color: '#ffd166', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setDepth(41);
    const s = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5, subtitle, {
      fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: '#eef2ff', align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(41);
    const p = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, prompt, {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#9fffb3', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(41);
    this.tweens.add({ targets: p, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.overlayObjects = [bg, t, s, p];
    // ignore taps for a beat so the click that ended the round doesn't skip it
    this.overlayTap = null;
    this.time.delayedCall(450, () => { this.overlayTap = onTap; });
  }

  hideOverlay() {
    if (!this.overlayObjects) return;
    this.overlayObjects.forEach((o) => o.destroy());
    this.overlayObjects = null;
  }

  // --------------------------------------------------------------- update ----
  update() {
    if (this.zzz && this.bird && !this.launched) {
      const bob = Math.sin(this.time.now / 300) * 3;
      this.zzz.setPosition(this.bird.x + 16, this.bird.y - 28 + bob);
    }

    if (this.targets) {
      // knock-down targets move (dynamic); nest labels are static
      this.targets.forEach((t) => {
        if (t.go && t.go.active) t.label.setPosition(t.go.x, t.go.y);
      });
    }

    this.drawBands();

    if (this.gameState === 'playing' && this.launched && !this.roundResolved && !this.wrongResolving) this.checkBirdSpent();
  }

  drawBands() {
    this.bandGfx.clear();
    this.aimGfx.clear();
    if (this.launched || !this.bird) return;

    this.bandGfx.lineStyle(6, 0x3a2410, 1);
    this.bandGfx.lineBetween(ANCHOR.x - 8, ANCHOR.y, this.bird.x, this.bird.y);
    this.bandGfx.lineBetween(ANCHOR.x + 8, ANCHOR.y, this.bird.x, this.bird.y);

    if (this.dragging) {
      let px = this.bird.x;
      let py = this.bird.y;
      let svx = (ANCHOR.x - this.bird.x) * LAUNCH_POWER;
      let svy = (ANCHOR.y - this.bird.y) * LAUNCH_POWER;
      this.aimGfx.fillStyle(0xffffff, 0.5);
      for (let i = 0; i < 24; i += 1) {
        px += svx;
        py += svy;
        svy += 0.45; // approx gravity per step
        if (i % 2 === 0) this.aimGfx.fillCircle(px, py, 3);
        if (py > GROUND_Y) break;
      }
    }
  }

  checkBirdSpent() {
    if (!this.bird) return;
    const v = this.bird.body.velocity;
    const speed = Math.hypot(v.x, v.y);
    const offscreen = this.bird.x < -60 || this.bird.x > GAME_WIDTH + 60 || this.bird.y > GAME_HEIGHT + 60;
    if (speed < 0.4 && !offscreen) this.restFrames += 1;
    else this.restFrames = 0;
    if (offscreen || this.restFrames > 50) this.recycleBird();
  }
}

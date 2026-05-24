import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { WORDS } from '../data/words.js';

const GROUND_Y = GAME_HEIGHT - 48;
const ANCHOR = { x: 180, y: GROUND_Y - 150 };
const MAX_STRETCH = 120; // how far back the slingshot can be pulled
const LAUNCH_POWER = 0.22; // drag distance -> velocity multiplier
const BIRDS_PER_ROUND = 3;
const TARGET_COUNT = 3;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.score = 0;
    this.roundResolved = false;

    this.buildWorld();
    this.buildSlingshot();
    this.buildHud();
    this.bindInput();
    this.bindCollisions();

    // dev-only handle for automated playtesting in a headless browser
    if (import.meta.env.DEV) window.__scene = this;

    this.startRound();
  }

  // ---------------------------------------------------------------- world ----
  buildWorld() {
    // soft dusk gradient backdrop
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a2f6b, 0x2a2f6b, 0x4b3a72, 0x7a5a82, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // a sleepy moon
    this.add.circle(GAME_WIDTH - 120, 90, 46, 0xf5f0c8, 0.9);
    this.add.circle(GAME_WIDTH - 100, 80, 40, 0x4b3a72, 1).setAlpha(0.25);

    // ground
    this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 24, GAME_WIDTH, 48, 0x355e3b);
    this.matter.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 24, GAME_WIDTH, 48, {
      isStatic: true,
      friction: 0.8,
      label: 'ground',
    });

    // Invisible side walls only: nothing can escape left or right (horizontal
    // escape has no restoring force, so it'd be lost forever). The top is left
    // open on purpose — gravity is the ceiling, so high parabolas can sail off
    // the top of the screen and arc back down, and anything knocked upward
    // always falls back into the field.
    const wall = { isStatic: true, friction: 0, restitution: 0.2, label: 'wall' };
    this.matter.add.rectangle(-25, 0, 50, GAME_HEIGHT * 4, wall); // left
    this.matter.add.rectangle(GAME_WIDTH + 25, 0, 50, GAME_HEIGHT * 4, wall); // right
  }

  buildSlingshot() {
    // the fork
    const g = this.add.graphics();
    g.lineStyle(10, 0x5a3a1b, 1);
    g.beginPath();
    g.moveTo(ANCHOR.x, GROUND_Y);
    g.lineTo(ANCHOR.x, ANCHOR.y);
    g.strokePath();
    g.setDepth(1);

    this.bandGfx = this.add.graphics().setDepth(3);
    this.aimGfx = this.add.graphics().setDepth(2);
    // the bird is spawned by startRound(), which owns the round lifecycle
  }

  spawnBird() {
    // starts asleep (closed eyes); swaps to 'birdAwake' the moment it launches
    this.bird = this.matter.add.image(ANCHOR.x, ANCHOR.y, 'bird');
    this.bird.setCircle(24);
    this.bird.setFriction(0.6);
    this.bird.setBounce(0.35);
    this.bird.setDensity(0.004);
    this.bird.setStatic(true);
    this.bird.setDepth(4);

    // a little 💤 that floats above the bird while it dozes in the cradle,
    // and disappears the moment it launches
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

  // Tears down the current bird (in-flight or cradled) and resets flight state.
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

  // --------------------------------------------------------------- rounds ----
  startRound() {
    // fully reset the field before building the next round, so nothing from
    // the previous shot lingers or steals a bird from this round
    this.clearBird();
    this.clearTargets();
    this.roundResolved = false;
    this.birdsLeft = BIRDS_PER_ROUND;

    // choose answer + distractors
    const pool = Phaser.Utils.Array.Shuffle([...WORDS]);
    const chosen = pool.slice(0, TARGET_COUNT);
    this.answer = chosen[0];
    const placement = Phaser.Utils.Array.Shuffle([...chosen]);

    // spread targets across the right two-thirds of the field, at varied
    // heights so aiming is a real precision challenge
    const startX = GAME_WIDTH * 0.45;
    const gap = (GAME_WIDTH * 0.5) / TARGET_COUNT;
    const levels = Phaser.Utils.Array.Shuffle([0, 1, 2]);

    this.targets = placement.map((word, i) => {
      const x = startX + gap * i + gap * 0.5;
      return this.buildTarget(x, word, levels[i % levels.length]);
    });

    this.promptText.setText(this.answer.ro);
    this.hintText.setText('Find the "' + this.answer.ro + '"');
    this.feedbackText.setText('');
    this.spawnBird();
    this.updateBirdsHud();
  }

  // Knock-down-able target perched on a tower of boxes. The screen-edge walls
  // (see buildWorld) keep it from ever leaving the field, so it stays hittable.
  // Touching the *correct* target with the bird is what scores the round.
  buildTarget(x, word, level) {
    const towerH = level + 1; // 1..3 boxes -> varied perch heights
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

  clearTargets() {
    if (!this.targets) return;
    this.targets.forEach((t) => {
      t.go.destroy();
      t.label.destroy();
      t.boxes.forEach((b) => b.destroy());
    });
    this.targets = [];
  }

  // ----------------------------------------------------------------- hud -----
  buildHud() {
    this.add.rectangle(GAME_WIDTH / 2, 34, GAME_WIDTH, 68, 0x0b1026, 0.55).setDepth(10);

    this.add.text(20, 14, 'Somnoroase Păsărele', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#9fb3ff',
    }).setDepth(11);

    this.promptText = this.add.text(GAME_WIDTH / 2, 34, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '34px',
      color: '#ffd166',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    this.hintText = this.add.text(GAME_WIDTH / 2, 60, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#c9d3ff',
    }).setOrigin(0.5, 0).setDepth(11);

    this.scoreText = this.add.text(GAME_WIDTH - 20, 14, 'Score: 0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#9fffb3',
    }).setOrigin(1, 0).setDepth(11);

    this.birdsText = this.add.text(GAME_WIDTH - 20, 38, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffd1d1',
    }).setOrigin(1, 0).setDepth(11);

    this.feedbackText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '40px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(20);
  }

  updateBirdsHud() {
    this.birdsText.setText('Birds: ' + '🐦'.repeat(Math.max(0, this.birdsLeft)));
  }

  // --------------------------------------------------------------- input -----
  bindInput() {
    this.input.on('pointerdown', (p) => {
      if (this.launched || this.roundResolved) return;
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.bird.x, this.bird.y);
      if (d < 60) this.dragging = true;
    });

    this.input.on('pointermove', (p) => {
      if (!this.dragging) return;
      const angle = Phaser.Math.Angle.Between(ANCHOR.x, ANCHOR.y, p.x, p.y);
      const dist = Math.min(
        MAX_STRETCH,
        Phaser.Math.Distance.Between(ANCHOR.x, ANCHOR.y, p.x, p.y),
      );
      const x = ANCHOR.x + Math.cos(angle) * dist;
      const y = ANCHOR.y + Math.sin(angle) * dist;
      this.bird.setPosition(x, y);
    });

    this.input.on('pointerup', () => {
      if (!this.dragging) return;
      this.dragging = false;
      const dx = ANCHOR.x - this.bird.x;
      const dy = ANCHOR.y - this.bird.y;
      // too small a pull = a nudge back to the cradle
      if (Math.hypot(dx, dy) < 12) {
        this.bird.setPosition(ANCHOR.x, ANCHOR.y);
        return;
      }
      this.bird.setStatic(false);
      this.bird.setVelocity(dx * LAUNCH_POWER, dy * LAUNCH_POWER);
      this.bird.setAngularVelocity(0.05);
      this.clearZzz(); // the 💤 drops away — it's awake now!
      this.launched = true;
    });
  }

  // ----------------------------------------------------------- collisions ----
  bindCollisions() {
    this.matter.world.on('collisionstart', (event) => {
      if (this.roundResolved || !this.launched) return;
      for (const pair of event.pairs) {
        const a = pair.bodyA.gameObject;
        const b = pair.bodyB.gameObject;
        const bird = a === this.bird ? a : b === this.bird ? b : null;
        if (!bird) continue;
        const other = bird === a ? b : a;
        if (other && other.isTarget) {
          this.resolveHit(other);
          break;
        }
      }
    });
  }

  resolveHit(targetGo) {
    const correct = targetGo.word.ro === this.answer.ro;
    if (correct) {
      this.roundResolved = true;
      this.score += 1;
      this.scoreText.setText('Score: ' + this.score);
      this.feedbackText.setText('Bravo! 🎉\n' + this.answer.ro + ' = ' + this.answer.en);
      this.feedbackText.setColor('#9fffb3');
      targetGo.setTint(0x9fffb3);
      this.time.delayedCall(1600, () => this.startRound());
    } else {
      // wrong target — costs the current bird, give feedback
      targetGo.setTint(0xff8a8a);
      this.feedbackText.setColor('#ffb3b3');
      this.feedbackText.setText('Nu... that is "' + targetGo.word.ro + '"');
      this.time.delayedCall(900, () => {
        if (!this.roundResolved) this.feedbackText.setText('');
        targetGo.clearTint();
      });
    }
  }

  // --------------------------------------------------------------- update ----
  update() {
    // float the 💤 just above the dozing bird, with a gentle bob
    if (this.zzz && this.bird && !this.launched) {
      const bob = Math.sin(this.time.now / 300) * 3;
      this.zzz.setPosition(this.bird.x + 16, this.bird.y - 28 + bob);
    }

    // keep emoji labels glued to their (possibly toppling) targets
    if (this.targets) {
      this.targets.forEach((t) => {
        if (t.go.active) t.label.setPosition(t.go.x, t.go.y);
      });
    }

    this.drawBands();

    if (this.launched && !this.roundResolved) this.checkBirdSpent();
  }

  drawBands() {
    this.bandGfx.clear();
    this.aimGfx.clear();
    if (this.launched || !this.bird) return;

    // slingshot bands
    this.bandGfx.lineStyle(6, 0x3a2410, 1);
    this.bandGfx.lineBetween(ANCHOR.x - 8, ANCHOR.y, this.bird.x, this.bird.y);
    this.bandGfx.lineBetween(ANCHOR.x + 8, ANCHOR.y, this.bird.x, this.bird.y);

    // aim preview while dragging
    if (this.dragging) {
      const vx = (ANCHOR.x - this.bird.x) * LAUNCH_POWER;
      const vy = (ANCHOR.y - this.bird.y) * LAUNCH_POWER;
      let px = this.bird.x;
      let py = this.bird.y;
      let svx = vx;
      let svy = vy;
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

    if (offscreen || this.restFrames > 50) {
      this.recycleBird();
    }
  }

  recycleBird() {
    this.birdsLeft -= 1;
    this.clearBird();
    this.updateBirdsHud();

    if (this.birdsLeft <= 0) {
      // out of birds — reveal the answer, then a fresh round
      this.roundResolved = true;
      this.feedbackText.setColor('#ffd166');
      this.feedbackText.setText('It was "' + this.answer.ro + '"\n(' + this.answer.en + ')');
      this.time.delayedCall(1800, () => this.startRound());
    } else {
      this.spawnBird();
    }
  }
}

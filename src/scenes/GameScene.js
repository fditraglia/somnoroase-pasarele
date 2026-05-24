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
    if (import.meta.env.DEV) window.__scene = this;

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
    this.bird.setDepth(4);

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

    this.updateHud();
    this.showToast('Level ' + (this.levelIndex + 1) + ' · ' + this.level.theme + ' ' + this.level.icon);
    this.startRound();
  }

  startRound() {
    this.clearBird();
    this.clearTargets();
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
    const startX = GAME_WIDTH * 0.42;
    const endX = GAME_WIDTH * 0.95;
    const tiers = Phaser.Utils.Array.Shuffle([0, 1, 2, 0, 1]);
    this.targets = placement.map((word, i) => {
      const x = placement.length === 1
        ? (startX + endX) / 2
        : startX + ((endX - startX) * i) / (placement.length - 1);
      return this.buildTarget(x, word, tiers[i % tiers.length]);
    });

    this.promptText.setText(this.answer.ro);
    this.hintText.setText('Find the "' + this.answer.ro + '"');
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
      if (this.gameState !== 'playing' || this.roundResolved || !this.launched) return;
      for (const pair of event.pairs) {
        const a = pair.bodyA.gameObject;
        const b = pair.bodyB.gameObject;
        const bird = a === this.bird ? a : b === this.bird ? b : null;
        if (!bird) continue;
        const other = bird === a ? b : a;
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
      this.targets.forEach((t) => {
        if (t.go.active) t.label.setPosition(t.go.x, t.go.y);
      });
    }

    this.drawBands();

    if (this.gameState === 'playing' && this.launched && !this.roundResolved) this.checkBirdSpent();
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

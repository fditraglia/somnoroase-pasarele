// The three ways a round can be laid out. Each builder turns the round's
// options into targets and returns { targets, perch }. A target is
//   { option, kind, sprite?, nest?, x, y, labelKey, extras, bodies, constraints }
// and the scene decides what a hit means.
import Phaser from 'phaser';
import { W, GROUND_Y, BIRD_R, MAX_PULL, LAUNCH_POWER } from '../constants.js';
import { makeLabel, plankWidth, dropLabel } from '../world/cards.js';

// Points on the tree, placed by hand on the illustration (field coordinates).
export const NEST_ANCHORS = [
  { x: 507, y: 443 }, { x: 875, y: 438 }, { x: 795, y: 344 }, { x: 174, y: 368 },
  { x: 323, y: 297 }, { x: 518, y: 234 }, { x: 555, y: 108 }, { x: 184, y: 112 },
];
// Keep perches below the prompt bar (66 high): a bird on the topmost twig, at
// (565, 50), sat behind the prompt and could barely be seen.
export const BIRD_PERCHES = [
  { x: 641, y: 415 }, { x: 883, y: 443 }, { x: 915, y: 241 }, { x: 946, y: 316 },
  { x: 38, y: 313 }, { x: 95, y: 111 }, { x: 534, y: 303 }, { x: 780, y: 81 },
  { x: 335, y: 372 }, { x: 329, y: 190 },
];
// Undersides of branches from which a sign can hang with room to swing.
export const HANG_ANCHORS = [
  { x: 590, y: 126 }, { x: 716, y: 112 }, { x: 640, y: 296 }, { x: 768, y: 340 },
  { x: 892, y: 334 }, { x: 452, y: 262 }, { x: 150, y: 138 }, { x: 122, y: 362 },
];

const shuffle = (a) => Phaser.Utils.Array.Shuffle(a.slice());
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function labelSize(scene, options, pic, text) {
  if (options[0].kind === 'pic') return pic;
  return { w: plankWidth(scene, options, text.max), h: text.h };
}

// ---- towers: labels stand on crate stacks; knock into the right one --------
export function buildTowers(scene, options) {
  const n = options.length;
  const size = labelSize(scene, options, { w: 100, h: 100 }, { max: 164, h: 60 });
  const startX = W * 0.41 + size.w * 0.1;
  const endX = W * 0.95 - size.w * 0.1;
  const gap = n > 1 ? (endX - startX) / (n - 1) : 0;
  // Wide planks on neighboring towers must sit at different heights.
  const crowded = gap < size.w + 18;
  const heights = [];
  for (let i = 0; i < n; i += 1) {
    let h = Phaser.Math.Between(1, 3);
    if (crowded && i > 0 && h === heights[i - 1]) h = (h % 3) + 1;
    heights.push(h);
  }

  const targets = options.map((option, i) => {
    const x = n === 1 ? (startX + endX) / 2 : startX + gap * i;
    const extras = [];
    extras.push(scene.add.ellipse(x, GROUND_Y + 2, 96, 14, 0x1a1035, 0.28).setDepth(1));
    for (let row = 0; row < heights[i]; row += 1) {
      const crate = scene.matter.add.image(x, GROUND_Y - 30 - row * 60, 'crate');
      crate.setDisplaySize(60, 60);
      crate.setRectangle(59, 59);
      crate.setFriction(0.9).setBounce(0.05).setDensity(0.0022).setDepth(2);
      crate.isCrate = true;
      extras.push(crate);
    }
    const label = makeLabel(scene, option, size);
    const y = GROUND_Y - heights[i] * 60 - size.h / 2;
    const sprite = scene.matter.add.image(x, y, label.key);
    sprite.setDisplaySize(size.w, size.h);
    sprite.setRectangle(size.w - 4, size.h - 2, { chamfer: { radius: 8 } });
    sprite.setFriction(0.9).setBounce(0.08).setDensity(0.0018).setDepth(3);
    const target = { option, kind: 'tower', sprite, labelKey: label.key, extras, bodies: [], constraints: [] };
    sprite.target = target;
    return target;
  });

  // A perch on the left, with room between the bird and the nearest tower: to
  // the side of its plank, or well above it. A bird resting against the plank
  // has no clear shot at any other tower.
  const left = startX - size.w / 2;
  const top = GROUND_Y - heights[0] * 60 - size.h;
  const open = BIRD_PERCHES.filter((p) => p.x < 340
    && (p.x + BIRD_R + 60 <= left || p.y + BIRD_R + 50 <= top));
  const perch = Phaser.Utils.Array.GetRandom(open) || BIRD_PERCHES[4];
  return { targets, perch };
}

// ---- signs: labels hang from branches and swing when struck ----------------
// Count the shots from this perch that strike the answer sign before anything
// else. A shot counts only if the bird stays on screen the whole way and keeps
// clear of every other sign (with a margin, since signs sway), the side walls,
// and the ground. `answer` and `others` are sign centers; `size` is the plank.
// buildSigns uses it to reject layouts where the answer is boxed in by other
// signs or can only be reached by a lob over the top of the screen.
export function signShots(scene, perch, answer, others, size, stopAt = Infinity) {
  const halfW = (size.w - 4) / 2;
  const halfH = (size.h - 2) / 2;
  const within = (q, c, r) => Math.hypot(
    Math.max(Math.abs(q.x - c.x) - halfW, 0), Math.max(Math.abs(q.y - c.y) - halfH, 0),
  ) < r;
  let wins = 0;
  for (let a = 0; a < 360; a += 2) {
    const cos = Math.cos(Phaser.Math.DegToRad(a));
    const sin = Math.sin(Phaser.Math.DegToRad(a));
    for (let p = 30; p <= MAX_PULL; p += 3) {
      const from = scene.holdPoint(perch, -cos * p, -sin * p);
      const pts = scene.flightPath(from.x, from.y, cos * p * LAUNCH_POWER, sin * p * LAUNCH_POWER, 260);
      for (const q of pts) {
        if (q.x < BIRD_R || q.x > W - BIRD_R || q.y < BIRD_R || q.y > GROUND_Y - BIRD_R) break;
        if (others.some((o) => within(q, o, BIRD_R + 10))) break;
        if (within(q, answer, BIRD_R)) { wins += 1; break; }
      }
      if (wins >= stopAt) return wins;
    }
  }
  return wins;
}

export function buildSigns(scene, options, answerKey) {
  const n = options.length;
  // Of the 5,580 shots signShots tries, a typical layout has about 220 that
  // work; below this many the answer needs a shot too exact to find by aiming.
  const MIN_SHOTS = 40;
  const answerAt = options.findIndex((o) => o.key === answerKey);
  const size = labelSize(scene, options, { w: 96, h: 96 }, { max: 160, h: 58 });
  const boxOf = (a, rope) => new Phaser.Geom.Rectangle(
    a.x - size.w / 2 - 22, a.y, size.w + 44, rope + size.h + 16,
  );

  // Choose anchors whose signs cannot touch, a perch clear of all of them, and
  // an answer sign with enough ways to reach it. If no layout has enough, use
  // the one that came closest.
  let chosen = null;
  let closest = null;
  for (let attempt = 0; attempt < 400 && !chosen; attempt += 1) {
    const anchors = shuffle(HANG_ANCHORS).slice(0, n)
      .map((a) => ({ ...a, rope: Phaser.Math.Between(30, 52) }));
    const boxes = anchors.map((a) => boxOf(a, a.rope));
    let clear = true;
    for (let i = 0; i < n && clear; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (Phaser.Geom.Rectangle.Overlaps(boxes[i], boxes[j])) { clear = false; break; }
      }
    }
    if (!clear) continue;
    const centers = anchors.map((a) => ({ x: a.x, y: a.y + a.rope + size.h / 2 }));
    const perch = shuffle(BIRD_PERCHES).find((p) => centers.every(
      (c) => dist(p, c) > 190 && Math.abs(p.x - c.x) > 100,
    ));
    if (!perch) continue;
    if (answerAt < 0) { chosen = { anchors, perch }; break; }
    const shots = signShots(
      scene, perch, centers[answerAt], centers.filter((_, i) => i !== answerAt), size, MIN_SHOTS,
    );
    if (shots >= MIN_SHOTS) chosen = { anchors, perch };
    else if (!closest || shots > closest.shots) closest = { anchors, perch, shots };
  }
  chosen = chosen || closest;
  if (!chosen) {
    chosen = {
      anchors: HANG_ANCHORS.slice(0, n).map((a) => ({ ...a, rope: 40 })),
      perch: BIRD_PERCHES[4],
    };
  }

  const targets = chosen.anchors.map((a, i) => {
    const option = options[i];
    const label = makeLabel(scene, option, size);
    const y = a.y + a.rope + size.h / 2;
    const sprite = scene.matter.add.image(a.x, y, label.key);
    sprite.setDisplaySize(size.w, size.h);
    sprite.setRectangle(size.w - 4, size.h - 2, { chamfer: { radius: 8 } });
    sprite.setFriction(0.6).setBounce(0.2).setDensity(0.0016).setFrictionAir(0.022).setDepth(3);
    // Two ropes from one knot on the branch to the sign's top corners.
    const dx = size.w * 0.36;
    const top = -size.h / 2 + 7;
    const len = Math.hypot(dx, a.rope + 7);
    const constraints = [-dx, dx].map((ox) => scene.matter.add.worldConstraint(
      sprite.body, len, 0.9, { pointA: { x: a.x, y: a.y }, pointB: { x: ox, y: top }, damping: 0.04 },
    ));
    sprite.setVelocity(Phaser.Math.FloatBetween(-1.2, 1.2), 0); // a little sway
    const knot = scene.add.circle(a.x, a.y, 4, 0x6b4a2a).setStrokeStyle(1.5, 0x3a2410).setDepth(2.6);
    const target = {
      option, kind: 'sign', sprite, labelKey: label.key, extras: [knot], bodies: [], constraints,
      rope: { ax: a.x, ay: a.y, dx, top },
    };
    sprite.target = target;
    return target;
  });
  return { targets, perch: chosen.perch };
}

// Draw every sign's ropes at its current swing.
export function drawRopes(gfx, targets) {
  gfx.clear();
  for (const t of targets) {
    if (t.kind !== 'sign' || !t.sprite.active) continue;
    const { ax, ay, dx, top } = t.rope;
    const cos = Math.cos(t.sprite.rotation);
    const sin = Math.sin(t.sprite.rotation);
    for (const ox of [-dx, dx]) {
      const px = t.sprite.x + ox * cos - top * sin;
      const py = t.sprite.y + ox * sin + top * cos;
      gfx.lineStyle(5, 0x3a2410, 1).lineBetween(ax, ay, px, py);
      gfx.lineStyle(2.5, 0xc9a56b, 1).lineBetween(ax, ay, px, py);
    }
  }
}

// ---- nests: drop the bird into the right nest ------------------------------
// `landing` runs 0 (wide, forgiving) to 1 (narrow, needs a steep arc).
function nestShape(anchor, landing) {
  const w = Phaser.Math.Linear(160, 130, landing);
  const h = w * 0.6;
  const top = anchor.y - h / 2;
  return {
    cx: anchor.x, cy: anchor.y, w, h, top,
    openW: w * Phaser.Math.Linear(0.74, 0.58, landing),
    rimY: top + h * 0.14,
    floorY: top + h * 0.62,
  };
}

// Search for shots from this perch that drop into this nest. A shot counts if
// the bird crosses the rim on its way down inside the opening, is still inside
// once it is below the rim, and touches no other nest on the way. Returns how
// many shots on the search grid work and the most central one. buildNests uses
// it to reject layouts where the answer nest is out of range, walled off by
// another nest, or needs a freak shot.
export function nestShots(scene, perch, shape, others = [], stopAt = Infinity) {
  const tol = shape.openW / 2 - BIRD_R;
  let wins = 0;
  let best = null;
  for (let a = 181; a < 360; a += 2) {
    const cos = Math.cos(Phaser.Math.DegToRad(a));
    const sin = Math.sin(Phaser.Math.DegToRad(a));
    for (let p = 30; p <= MAX_PULL; p += 3) {
      const vx = cos * p * LAUNCH_POWER;
      const vy = sin * p * LAUNCH_POWER;
      // the bird is released from where it was drawn back to, not from the perch
      const from = scene.holdPoint(perch, -cos * p, -sin * p);
      const pts = scene.flightPath(from.x, from.y, vx, vy, 260);
      for (let i = 1; i < pts.length; i += 1) {
        const q = pts[i];
        if (q.x < BIRD_R || q.x > W - BIRD_R) break; // would bounce off a side wall
        if (others.some((o) => Math.abs(q.x - o.cx) < o.openW / 2 + 12 + BIRD_R
          && q.y > o.rimY - BIRD_R && q.y < o.floorY + 14 + BIRD_R)) break;
        if (pts[i - 1].y < shape.rimY - BIRD_R && q.y >= shape.rimY - BIRD_R) {
          let j = i;
          while (j < pts.length - 1 && pts[j].y < shape.rimY + 20) j += 1;
          const off = Math.max(Math.abs(q.x - shape.cx), Math.abs(pts[j].x - shape.cx));
          if (off < tol) {
            wins += 1;
            if (!best || off < best.off) best = { off, vx, vy };
          }
          break;
        }
      }
      if (wins >= stopAt) return { wins, best };
    }
  }
  return { wins, best };
}

export function buildNests(scene, options, landing, answerKey) {
  const n = options.length;
  const MIN_GAP = 160; // between nests
  const MIN_PDX = 150; // horizontal clearance between the perch and every nest
  const answerAt = options.findIndex((o) => o.key === answerKey);
  let layout = null;
  let fallback = null;
  for (let attempt = 0; attempt < 300 && !layout; attempt += 1) {
    const anchors = shuffle(NEST_ANCHORS).slice(0, n);
    let spaced = true;
    for (let i = 0; i < n && spaced; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        if (dist(anchors[i], anchors[j]) < MIN_GAP) { spaced = false; break; }
      }
    }
    if (!spaced) continue;
    const perch = shuffle(BIRD_PERCHES).find((p) => anchors.every((a) => Math.abs(a.x - p.x) >= MIN_PDX));
    if (!perch) continue;
    if (!fallback) fallback = { anchors, perch };
    const shapes = anchors.map((a) => nestShape(a, landing));
    const others = shapes.filter((_, i) => i !== answerAt);
    if (answerAt < 0 || nestShots(scene, perch, shapes[answerAt], others, 6).wins >= 6) layout = { anchors, perch };
  }
  layout = layout || fallback || { anchors: shuffle(NEST_ANCHORS).slice(0, n), perch: BIRD_PERCHES[4] };

  const size = labelSize(scene, options, { w: 66, h: 66 }, { max: 150, h: 48 });
  const targets = layout.anchors.map((anchor, i) => {
    const option = options[i];
    const {
      cx, cy, w, h, top, openW, rimY, floorY,
    } = nestShape(anchor, landing);

    // Back layer is the whole nest; the front layer is only the near rim and
    // is drawn over a settled bird, so the bird reads as inside the bowl.
    const back = scene.add.image(cx, cy, 'nest').setDisplaySize(w, h).setDepth(2);
    const front = scene.add.image(cx, cy, 'nest-front').setDisplaySize(w, h).setDepth(5);

    // Physics follows the bowl: two side walls and a floor, open at the top.
    const wallT = 12;
    const solid = { isStatic: true, friction: 0.95, restitution: 0.05, label: 'nest' };
    const mid = (rimY + floorY) / 2;
    const bodies = [
      scene.matter.add.rectangle(cx, floorY + 7, openW + 2 * wallT, 14, solid),
      scene.matter.add.rectangle(cx - openW / 2 - wallT / 2, mid, wallT, floorY - rimY, solid),
      scene.matter.add.rectangle(cx + openW / 2 + wallT / 2, mid, wallT, floorY - rimY, solid),
    ];
    const sensor = scene.matter.add.rectangle(cx, mid + 5, openW * 0.8, (floorY - rimY) * 0.6, {
      isStatic: true, isSensor: true, label: 'nestSensor',
    });
    bodies.push(sensor);

    const label = makeLabel(scene, option, size);
    const tag = scene.add.image(cx, cy + h / 2 + size.h / 2 - 16, label.key)
      .setDisplaySize(size.w, size.h).setDepth(5.5);

    const target = {
      option, kind: 'nest', labelKey: label.key, extras: [back, front, tag], bodies, constraints: [],
      nest: { cx, cy, w, h, top, openW, rimY, floorY, restX: cx, restY: top + h * 0.37 },
      tag,
    };
    sensor.nestTarget = target;
    // nests grow in, one after another
    [back, front, tag].forEach((o) => {
      const sx = o.scaleX;
      const sy = o.scaleY;
      o.setScale(sx * 0.2, sy * 0.2).setAlpha(0);
      scene.tweens.add({ targets: o, scaleX: sx, scaleY: sy, alpha: 1, duration: 320, delay: i * 90, ease: 'Back.easeOut' });
    });
    return target;
  });
  return { targets, perch: layout.perch };
}

export const targetPos = (t) => (t.sprite ? { x: t.sprite.x, y: t.sprite.y } : { x: t.nest.cx, y: t.nest.cy });

export function destroyTargets(scene, targets) {
  for (const t of targets) {
    t.constraints.forEach((c) => scene.matter.world.removeConstraint(c));
    t.bodies.forEach((b) => scene.matter.world.remove(b));
    t.extras.forEach((o) => { scene.tweens.killTweensOf(o); o.destroy(); });
    if (t.sprite) { scene.tweens.killTweensOf(t.sprite); t.sprite.destroy(); }
    if (t.mark) t.mark.destroy();
    dropLabel(scene, t.labelKey);
  }
}

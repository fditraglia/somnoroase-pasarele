import { view } from './view.js';
import { FONT_UI, FONT_DISPLAY, FONT_EMOJI, COLOR } from './constants.js';
import { sfx } from './audio/synth.js';

// Text at the canvas's real resolution, so it stays sharp when zoomed.
export function txt(scene, x, y, str, style = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT_UI,
    fontSize: '20px',
    color: '#ffffff',
    padding: { x: 2, y: 4 },
    ...style,
  });
  t.setResolution(Math.max(1, view.zoom));
  return t;
}

export const withEmoji = (family) => `${family}, ${FONT_EMOJI}`;

// A rounded button: cream face, plum outline, a small press animation.
export function button(scene, x, y, label, opts = {}) {
  const {
    w = 200, h = 56, fontSize = 24, onClick, fill = 0xfff0c8, stroke = 0x4a2148,
    color = COLOR.ink, depth = 50, family = FONT_DISPLAY, weight = '600', radius = 16,
  } = opts;
  const c = scene.add.container(x, y).setDepth(depth);
  const g = scene.add.graphics();
  const draw = (face) => {
    g.clear();
    g.fillStyle(0x1a1035, 0.35).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, radius);
    g.fillStyle(face, 1).fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.lineStyle(3, stroke, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  };
  draw(fill);
  const t = txt(scene, 0, -1, label, {
    fontFamily: withEmoji(family), fontSize: `${fontSize}px`, color, fontStyle: weight, align: 'center',
  }).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(0xffffff));
  c.on('pointerout', () => { draw(fill); c.setScale(1); });
  c.on('pointerdown', () => { c.setScale(0.95); });
  c.on('pointerup', () => {
    c.setScale(1);
    sfx.tap();
    if (onClick) onClick();
  });
  c.label = t;
  c.redraw = draw;
  return c;
}

// A translucent rounded panel, centered on (x, y).
export function panel(scene, x, y, w, h, opts = {}) {
  const { fill = 0x1d1447, alpha = 0.92, stroke = 0xfff0c8, depth = 40, radius = 22 } = opts;
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(fill, alpha).fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(3, stroke, 0.9).strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  return g;
}

// An emoji drawn to its own texture (once), for use as an ordinary sprite.
export function emojiKey(scene, emoji) {
  const key = `emoji:${emoji}`;
  if (scene.textures.exists(key)) return key;
  const S = 144;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.floor(S * 0.8)}px ${FONT_EMOJI}`;
  ctx.fillText(emoji, S / 2, S / 2 + S * 0.04);
  scene.textures.addCanvas(key, canvas);
  return key;
}

// Small round icon button used for the sound toggles and the menu.
export function iconButton(scene, x, y, icon, onClick, opts = {}) {
  return button(scene, x, y, icon, {
    w: opts.size ?? 44, h: opts.size ?? 44, fontSize: opts.fontSize ?? 22, radius: 14,
    fill: 0x2a1f63, stroke: 0xfff0c8, color: '#ffffff', family: FONT_UI, depth: opts.depth ?? 22, onClick,
  });
}

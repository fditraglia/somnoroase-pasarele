// The labels on targets. Each label is baked into one texture — the wooden
// card or plank from the art, plus an emoji and/or text — so a target is a
// single sprite that tumbles and swings as one piece.
import { FONT_UI, FONT_DISPLAY, FONT_EMOJI } from '../constants.js';

const SCALE = 2; // texture pixels per design unit
let serial = 0;

function fitFont(ctx, text, weight, family, size, maxWidth, minSize = 12) {
  let s = size;
  for (;;) {
    ctx.font = `${weight} ${s * SCALE}px ${family}`;
    if (s <= minSize || ctx.measureText(text).width <= maxWidth * SCALE) return s;
    s -= 1;
  }
}

// option: { kind: 'pic', emoji, sub } or { kind: 'text', text }
// Returns { key, w, h } — draw it with setDisplaySize(w, h).
export function makeLabel(scene, option, size = {}) {
  const pic = option.kind === 'pic';
  const w = size.w ?? (pic ? 100 : 160);
  const h = size.h ?? (pic ? 100 : 62);
  const canvas = document.createElement('canvas');
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext('2d');
  const base = scene.textures.get(pic ? 'card' : 'plank').getSourceImage();
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (pic) {
    const es = option.sub ? h * 0.46 : h * 0.56;
    ctx.font = `${es * SCALE}px ${FONT_EMOJI}`;
    ctx.fillText(option.emoji, (w / 2) * SCALE, (option.sub ? h * 0.42 : h * 0.52) * SCALE);
    if (option.sub) {
      ctx.fillStyle = '#4a2b1a';
      fitFont(ctx, option.sub, 800, FONT_UI, Math.max(14, h * 0.17), w - 24, 10);
      ctx.fillText(option.sub, (w / 2) * SCALE, h * 0.78 * SCALE);
    }
  } else {
    ctx.fillStyle = '#3d2314';
    fitFont(ctx, option.text, 600, FONT_DISPLAY, Math.min(30, h * 0.5), w - 26, 13);
    ctx.fillText(option.text, (w / 2) * SCALE, h * 0.53 * SCALE);
  }

  serial += 1;
  const key = `label:${serial}`;
  scene.textures.addCanvas(key, canvas);
  return { key, w, h };
}

// Width a text plank needs for the longest label in a round.
export function plankWidth(scene, options, max = 176) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `600 28px ${FONT_DISPLAY}`;
  const widest = Math.max(...options.map((o) => ctx.measureText(o.text).width));
  return Math.round(Math.min(max, Math.max(112, widest + 40)));
}

export function dropLabel(scene, key) {
  if (key && scene.textures.exists(key)) scene.textures.remove(key);
}

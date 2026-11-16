// Development tool, opened with ?layout=1. Shows every hand-placed point on
// the tree — nests, bird perches, and the knots that signs hang from — as
// draggable ghosts, so the points can be adjusted by eye and copied back into
// src/game/mechanics.js. No console needed.
//   drag = move · click empty space = add · N / P / H = what a click adds
//   Z = remove the last point of that kind · C = copy all coordinates
import { W, H, BIRD_SIZE } from '../constants.js';
import { txt } from '../ui.js';
import { worldPoint } from '../view.js';
import { NEST_ANCHORS, BIRD_PERCHES, HANG_ANCHORS } from '../game/mechanics.js';

const KINDS = {
  nest: { name: 'NEST_ANCHORS', source: NEST_ANCHORS, key: 'N' },
  perch: { name: 'BIRD_PERCHES', source: BIRD_PERCHES, key: 'P' },
  hang: { name: 'HANG_ANCHORS', source: HANG_ANCHORS, key: 'H' },
};

export function startLayoutTool(scene) {
  const grid = scene.add.graphics().setDepth(50);
  for (let x = 0; x <= W; x += 50) grid.lineStyle(1, 0xffffff, x % 100 ? 0.12 : 0.3).lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += 50) grid.lineStyle(1, 0xffffff, y % 100 ? 0.12 : 0.3).lineBetween(0, y, W, y);

  const ghosts = { nest: [], perch: [], hang: [] };
  let kind = 'nest';
  const header = txt(scene, W / 2, 84, '', { fontSize: '15px', color: '#ffe14d', fontStyle: '800', backgroundColor: '#000a', padding: { x: 8, y: 4 } })
    .setOrigin(0.5).setDepth(61);
  const readout = txt(scene, 8, H - 8, '', { fontSize: '11px', color: '#bdf', backgroundColor: '#000b', padding: { x: 6, y: 4 }, wordWrap: { width: W - 16 } })
    .setOrigin(0, 1).setDepth(61);
  const dump = () => Object.entries(KINDS).map(([k, v]) => `export const ${v.name} = [\n  ${
    ghosts[k].map((g) => `{ x: ${Math.round(g.x)}, y: ${Math.round(g.y)} }`).join(', ')},\n];`).join('\n');
  const refresh = () => {
    header.setText(`Click adds: ${kind.toUpperCase()}   ·   drag to move   ·   N / P / H switch   ·   Z undo   ·   C copy`);
    readout.setText(Object.entries(KINDS).map(([k, v]) => `${v.name}: ${ghosts[k].map((g) => `(${Math.round(g.x)},${Math.round(g.y)})`).join(' ')}`).join('\n'));
  };

  const place = (k, x, y) => {
    const c = scene.add.container(x, y).setDepth(58);
    if (k === 'nest') c.add(scene.add.image(0, 0, 'nest').setDisplaySize(150, 90).setAlpha(0.75));
    else if (k === 'perch') c.add(scene.add.image(0, 0, 'bird-sleepy').setDisplaySize(BIRD_SIZE, BIRD_SIZE).setAlpha(0.85));
    else c.add([scene.add.image(0, 70, 'card').setDisplaySize(96, 96).setAlpha(0.55), scene.add.circle(0, 0, 6, 0xffe14d)]);
    const label = txt(scene, 8, -22, '', { fontSize: '12px', color: '#fff', fontStyle: '800', backgroundColor: '#0009' });
    c.add(label);
    c.label = label;
    c.kind = k;
    c.setSize(70, 70);
    c.setInteractive({ draggable: true, useHandCursor: true });
    ghosts[k].push(c);
    label.setText(`${k[0]}${ghosts[k].length} (${x},${y})`);
    return c;
  };
  Object.entries(KINDS).forEach(([k, v]) => v.source.forEach((p) => place(k, p.x, p.y)));

  scene.input.on('drag', (pointer, obj, x, y) => {
    obj.setPosition(Math.round(x), Math.round(y));
    obj.label.setText(`${obj.kind[0]}${ghosts[obj.kind].indexOf(obj) + 1} (${obj.x},${obj.y})`);
    refresh();
  });
  scene.input.on('pointerdown', (pointer, over) => {
    if (over.length) return;
    const p = worldPoint(scene, pointer);
    place(kind, Math.round(p.x), Math.round(p.y));
    refresh();
  });
  Object.entries(KINDS).forEach(([k, v]) => scene.input.keyboard.on(`keydown-${v.key}`, () => { kind = k; refresh(); }));
  scene.input.keyboard.on('keydown-Z', () => {
    const g = ghosts[kind].pop();
    if (g) g.destroy();
    refresh();
  });
  scene.input.keyboard.on('keydown-C', () => {
    if (navigator.clipboard) navigator.clipboard.writeText(dump()).catch(() => {});
    const note = txt(scene, W / 2, H / 2, 'Copied. Paste it to Claude.', { fontSize: '24px', color: '#9fffb3', fontStyle: '800', backgroundColor: '#000c', padding: { x: 16, y: 12 } })
      .setOrigin(0.5).setDepth(70);
    scene.time.delayedCall(1600, () => note.destroy());
  });
  refresh();
}

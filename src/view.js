import { W, H, MAX_W } from './constants.js';

// Shared description of what is currently visible, in design units.
//   width / left / right: the visible strip (always contains 0..W)
//   zoom: canvas pixels per design unit, fixed at startup so text stays crisp
export const view = { zoom: 1, width: W, left: 0, right: W };

export function initZoom() {
  const dpr = window.devicePixelRatio || 1;
  // The game is height-limited in landscape, so size the canvas for the short
  // side of the screen. Quantized to halves, capped at 2x for fill-rate.
  const shortSide = Math.min(window.screen.width, window.screen.height) * dpr;
  view.zoom = Math.min(2, Math.max(1, Math.round((shortSide / H) * 2) / 2));
}

export function measure() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  view.width = Math.round(Math.min(MAX_W, Math.max(W, H * aspect)));
  view.left = (W - view.width) / 2;
  view.right = view.left + view.width;
  return view;
}

export function canvasSize() {
  return { width: Math.round(view.width * view.zoom), height: Math.round(H * view.zoom) };
}

// Point a scene's camera at the play field and keep it there across resizes.
// `onChange` is called after every resize so the scene can re-anchor its HUD.
export function bindView(scene, onChange) {
  const fit = () => {
    const cam = scene.cameras.main;
    cam.setZoom(view.zoom);
    cam.centerOn(W / 2, H / 2);
    if (onChange) onChange();
  };
  fit();
  scene.scale.on('resize', fit);
  scene.events.once('shutdown', () => scene.scale.off('resize', fit));
}

// Pointer position in design units.
export function worldPoint(scene, pointer) {
  return pointer.positionToCamera(scene.cameras.main);
}

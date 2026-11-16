import Phaser from 'phaser';
import '@fontsource-variable/baloo-2/wght.css';
import '@fontsource-variable/nunito/wght.css';
import { initZoom, measure, canvasSize } from './view.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import MapScene from './scenes/MapScene.js';
import GameScene from './scenes/GameScene.js';

// Canvas text is drawn once, so the web fonts must be ready before any scene
// creates a Text object. The sample string forces the Latin-Extended subset
// (ă â î ș ț) to load as well. A slow network falls back after a short wait.
async function loadFonts() {
  const sample = 'Somnoroase păsărele ăâîșț';
  const wanted = [
    '500 20px "Baloo 2 Variable"', '700 20px "Baloo 2 Variable"',
    '600 20px "Nunito Variable"', '800 20px "Nunito Variable"',
  ].map((f) => document.fonts.load(f, sample));
  const timeout = new Promise((resolve) => { setTimeout(resolve, 2500); });
  try { await Promise.race([Promise.all(wanted), timeout]); } catch { /* fall back to system fonts */ }
}

async function start() {
  await loadFonts();
  initZoom();
  measure();
  const size = canvasSize();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: size.width,
    height: size.height,
    backgroundColor: '#2f2569',
    scene: [BootScene, TitleScene, MapScene, GameScene],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    input: { activePointers: 2 },
  });

  // Rotating a phone or resizing the window changes how much scenery fits.
  let pending = false;
  const onResize = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      measure();
      const s = canvasSize();
      if (s.width !== game.scale.width || s.height !== game.scale.height) {
        game.scale.setGameSize(s.width, s.height);
      }
      game.scale.refresh();
    });
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  if (import.meta.env.DEV) window.__game = game;
}

start();

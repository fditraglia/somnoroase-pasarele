# Somnoroase Păsărele 🐦💤

> *"Sleepy Birds"* — a physics game in the spirit of Angry Birds, with a twist:
> the birds are drowsy, and playing it teaches you a little Romanian along the way.

The name comes from Mihai Eminescu's beloved poem **"Somnoroase păsărele"**
("Sleepy little birds"), a Romanian lullaby about birds settling down to sleep
at dusk.

**▶ Play it: https://sleepy-birds.com/**

## Concept

A prompt shows you a **Romanian word**. Several perched targets each show a
picture + English word — one of them matches. Pull back the slingshot, launch a
sleepy bird, and **hit the correct target** to score. Hit the wrong one and you
learn what it actually was. Aim, physics, and vocabulary in one loop.

## How to play

- **Drag** the bird back from the slingshot and **release** to launch; a dotted
  arc previews your trajectory while you aim.
- Read the **Romanian word** at the top and hit the target with the matching
  picture. (Toppling the towers is fun, but it's *touching the right target*
  that scores.)
- Each level gives you a limited number of **birds** — wrong answers and misses
  waste them. **Clear 5 words** in a theme to advance; **run out of birds** and
  it's game over.

## Levels

Five themed levels of common, concrete nouns, with difficulty ramping as you go
(more targets on screen, tighter bird budgets):

1. **Animals** 🐾
2. **Food & Drink** 🍎
3. **Nature** 🌙
4. **Around the Home** 🏠
5. **Getting Around** 🚗

The vocabulary lives in [`src/data/words.js`](src/data/words.js), organized by
theme and easy to extend — every word is a common noun with a clear emoji.

## Development

Built with [Phaser 3](https://phaser.io/) (Matter physics) + [Vite](https://vitejs.dev/).

```bash
npm install
npm run dev      # local dev server with hot reload
npm run build    # production build into dist/
```

Source layout:

- `src/main.js` — Phaser game config; scene order is Boot → Intro → Game
- `src/scenes/BootScene.js` — generates textures procedurally (and the 🐦 bird)
- `src/scenes/IntroScene.js` — title + how-to-play
- `src/scenes/GameScene.js` — slingshot, physics, rounds, levels, scoring
- `src/data/words.js` — themed word bank + per-level difficulty params

## Deployment

Pushes to `main` auto-deploy to **GitHub Pages** via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The build uses a
relative base (`base: './'`), so it works at the project subpath *and* at any
custom domain root without code changes.

## Roadmap

- 🔊 **Audio** — word pronunciation (the big learning win), game-feel SFX, and a
  gentle ambient lullaby.

## Acknowledgements

Romanian language material is drawn from a companion repository of vocabulary,
grammar primers, and translation notes.

# Somnoroase Păsărele 🐦💤

> *"Sleepy Birds"* — a physics game in the spirit of Angry Birds, with a twist:
> the birds are drowsy, and playing it teaches you a little Romanian along the way.

The name comes from Mihai Eminescu's beloved poem **"Somnoroase păsărele"**
("Sleepy little birds"), a Romanian lullaby about birds settling down to sleep
at dusk.

## Status

🚧 Early prototype — building out the core slingshot/physics mechanic first.
Romanian language content will be layered in once the game feel is right.

## Concept

A prompt shows you a **Romanian word**. Three perched targets each show a
picture + English word — one of them matches. Pull back the slingshot, launch a
sleepy bird, and knock down the **correct** target to score. Hit the wrong one
and you learn what it actually was. Aim, physics, and vocabulary in one loop.

The word list lives in [`src/data/words.js`](src/data/words.js) and is
deliberately pluggable — the prototype is about getting the *game feel* right
before we layer in real curriculum from the companion `limba-română` material.

## Development

Built with [Phaser 3](https://phaser.io/) (Matter physics) + [Vite](https://vitejs.dev/).

```bash
npm install
npm run dev      # local dev server with hot reload
npm run build    # production build into dist/
```

### How to play

- **Drag** the bird back from the slingshot and **release** to launch.
- A dotted arc previews your trajectory while you aim.
- You get 3 birds per round. Find the word shown at the top!

## Deployment

Pushes to `main` auto-deploy to **GitHub Pages** via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Enable it once in
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Acknowledgements

Romanian language material is drawn from a companion repository of vocabulary,
grammar primers, and translation notes.

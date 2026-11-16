# Somnoroase Păsărele 🐦💤

> *"Sleepy Birds"* — a slingshot game in which drowsy birds are put to bed, and playing it teaches Romanian vocabulary and grammar.

The name comes from Mihai Eminescu's lullaby **"Somnoroase păsărele"** ("Sleepy little birds"), about birds settling into their nests at dusk. A stanza of the poem, read aloud, closes every level.

**▶ Play it: https://sleepy-birds.com/**

## How it plays

Pick one of 20 topics (animals, fruit, the body, getting around, and so on; 224 words in all). A topic opens into its word list, where tapping a word plays it, and into three levels of increasing language depth. Every topic and level is open from the start.

A level is eight rounds. In each round a prompt appears at the top, the targets show the possible answers, and you sling a sleepy bird at the right one. Drag anywhere to draw the bird back, release to launch, and use the dotted arc to aim. The sky darkens from dusk to night as the level goes on.

A topic has three levels:

1. **Cuvinte (Words).** A Romanian word is shown and spoken; find its picture. English captions appear under the pictures until a word is familiar.
2. **Ascultă (Listen).** A round gives either a spoken question with no text (*Unde este pisica?*) and pictures to choose from, or a picture and Romanian words to choose from.
3. **Gramatică (Grammar).** There are three kinds of round. *Gender*: Romanian nouns are counted *un … doi* (masculine), *o … două* (feminine), or *un … două* (neuter); pick the pattern. *Number*: pick the singular or the plural. *Definite article*: Romanian attaches "the" to the end of the noun (*casă* → *casa*); pick that form. All the choices shown are real forms.

Three mechanics rotate through a level, independently of the question type:

- **Towers.** Answers stand on stacks of crates; knock into the right one.
- **Hanging signs.** Answers hang from branches and swing when struck.
- **Nests.** Answers label nests in the tree; the bird has to drop in from above. A bird in the wrong nest protests (*Ăsta nu-i cuibul meu!*) and flies back.

After a correct answer the game shows and speaks the word's dictionary entry, for example *o pisică · două pisici*, so gender and plural are heard from the first level on. A wrong hit shows and speaks the word that was actually hit.

Stars measure language only: three for no wrong answers, two for one or two, one for finishing. Shots that miss everything use up a bird but do not reduce the stars. Each word has a strength from 0 to 5 that rises with an answer that is right on the first try and falls with a wrong one; replaying a topic drills the weakest words first. Progress is kept in the browser's local storage.

## Sound

- **Speech** is ElevenLabs text-to-speech (voice Corina, model `eleven_v4`). The 666 clips are in `public/audio/` and are fetched a topic at a time.
- **Music and effects** are synthesized in the browser with the Web Audio API (`src/audio/synth.js`): a music-box lullaby, crickets, an occasional owl, and the game's effects. There are no music files. Music and sound can be switched off separately from the pause menu.

## Development

The game is built with [Phaser 3](https://phaser.io/) (Matter physics) and [Vite](https://vitejs.dev/).

```bash
npm install
npm run dev      # local dev server with hot reload
npm run build    # production build into dist/
```

The following development shortcuts work on the dev server only:

- `?topic=fructe&tier=3&round=2` opens a level directly at a given round.
- `?layout=1` opens an on-screen tool for adjusting the hand-placed points on the tree (nests, perches, and the knots signs hang from) and copying the coordinates.

### Source layout

- `src/main.js` — fonts, canvas sizing, scene list
- `src/view.js` — fits the game to the screen: the play field is 1024×576, and wider screens (phones in landscape) show more scenery at the sides rather than black bars
- `src/scenes/` — `BootScene` (loading), `TitleScene`, `MapScene` (topics and word lists), `GameScene` (slingshot, rounds, results)
- `src/game/rounds.js` — the question types and the plan of a level
- `src/game/mechanics.js` — towers, hanging signs, nests, and the points on the tree
- `src/world/` — the backdrop (sky, stars, moon, village lights, fireflies) and target labels
- `src/audio/` — synthesized sound and voice playback
- `src/state/progress.js` — saved progress
- `src/data/content.json` — generated vocabulary (do not edit by hand)

### Content pipeline

The vocabulary is built from two small tables joined onto the A1–A2 word list in the companion repository `~/limba-românǎ` (`deck-data/limba-romana-a1a2.jsonl`), which supplies gender, plural, and definite forms from dexonline.

- `content/topics.tsv` — the topics
- `content/words.tsv` — one row per word: topic, Romanian, English, emoji, and whether it is countable. A word missing from the companion list has its forms in the last column as `gender|plural|definite sg|definite pl`.
- `content/extras.json` — the bird's phrases and the poem with its translation

```bash
uv run scripts/build_content.py            # writes src/data/content.json and content/audio-manifest.json
uv run scripts/build_audio.py --dry-run    # how many clips are missing, and how many characters
uv run scripts/build_audio.py              # generates the missing clips (needs an ElevenLabs key)
```

Clips are named by a hash of their text and voice settings, so a clip is generated once and never billed again. Each new clip is checked for a cut-off ending and regenerated if it fails. The full set cost about 4,400 ElevenLabs credits.

### Art

The background, tree, bird, nest, and props were generated with an image model on a flat magenta background (the model cannot output transparency); the originals are in `art-src/`. `uv run scripts/process_art.py` keys out the magenta and writes the game sprites to `src/assets/`. The tree is a repaint of an earlier drawing with the same branch layout (`art-src/tree-original.png`), so the hand-placed points still fit.

## Deployment

Pushes to `main` deploy to **GitHub Pages** through [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The build uses a relative base (`base: './'`), so it works at a project subpath and at a custom domain root alike. A web app manifest is included, so the game can be added to a phone's home screen and opened full-screen in landscape.

## Acknowledgements

The poem is by Mihai Eminescu (1883). Romanian word forms come from [dexonline](https://dexonline.ro/) by way of the companion repository of vocabulary, grammar notes, and audio.

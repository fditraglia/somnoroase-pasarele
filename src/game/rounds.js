// What a level asks. A level is a "session" of eight rounds over one topic.
// Each round pairs a QUESTION TYPE (below) with a MECHANIC (towers, hanging
// signs, or nests — see mechanics.js). The two vary independently: the tier
// sets how deep the language goes, the mechanic sets what the aiming is like.
//
// A round is plain data:
//   prompt   what the top bar shows and says
//   options  the labels on the targets; exactly one has key === answer
//   reveal   what is shown and said once the right target is hit
import Phaser from 'phaser';
import { wordsOf, GENDER_NAME } from '../data/content.js';
import { progress } from '../state/progress.js';

const shuffle = (a) => Phaser.Utils.Array.Shuffle(a.slice());

export const TIERS = [
  {
    id: 1, ro: 'Cuvinte', en: 'Words', icon: '👀',
    blurb: 'Read and hear a word, find its picture.',
    types: ['read', 'read', 'read', 'read', 'read', 'read', 'read', 'read'],
    mechanics: ['towers', 'signs', 'towers', 'nest', 'signs', 'towers', 'signs', 'nest'],
    counts: [3, 3, 3, 3, 4, 4, 4, 4],
  },
  {
    id: 2, ro: 'Ascultă', en: 'Listen', icon: '👂',
    blurb: 'Hear a sentence, or name a picture in Romanian.',
    types: ['listen', 'name', 'listen', 'listen', 'name', 'listen', 'name', 'listen'],
    mechanics: ['towers', 'signs', 'towers', 'nest', 'signs', 'towers', 'signs', 'nest'],
    counts: [3, 3, 4, 3, 4, 4, 4, 4],
  },
  {
    id: 3, ro: 'Gramatică', en: 'Grammar', icon: '🧩',
    blurb: 'Gender, plurals, and the built-in “the”.',
    types: ['gender', 'number', 'definite', 'gender', 'number', 'definite', 'gender', 'definite'],
    mechanics: ['towers', 'nest', 'signs', 'nest', 'towers', 'signs', 'nest', 'nest'],
    counts: [3, 4, 4, 3, 4, 4, 3, 4],
  },
];

// English plurals for the "the cats" prompts. Words whose English plural is
// awkward (pants, luggage, a bunch of grapes) are only ever asked in the singular.
const EN_PLURAL = {
  sheep: 'sheep', fish: 'fish', wolf: 'wolves', leaf: 'leaves', knife: 'knives',
  tooth: 'teeth', man: 'men', woman: 'women', child: 'children', bus: 'buses',
  'police officer': 'police officers', 'post office': 'post offices',
  'fir tree': 'fir trees', 'train station': 'train stations',
};
const NO_EN_PLURAL = new Set(['pants', 'luggage', 'bunch of grapes', 'scissors', 'money', 'paper', 'corn']);
function enPlural(en) {
  if (NO_EN_PLURAL.has(en)) return null;
  if (EN_PLURAL[en]) return EN_PLURAL[en];
  if (/(s|x|ch|sh)$/.test(en)) return `${en}es`;
  if (/[^aeiou]y$/.test(en)) return `${en.slice(0, -1)}ies`;
  if (/(tomato|potato)$/.test(en)) return `${en}es`;
  return `${en}s`;
}

const picOption = (w, caption) => ({ key: w.ro, kind: 'pic', emoji: w.emoji, sub: caption ? w.en : null, word: w });
const textOption = (text, extra = {}) => ({ key: text, kind: 'text', text, ...extra });
const entryText = (w) => (w.entry ? w.entry.replace(', ', '  ·  ') : w.ro);

// ---- question types --------------------------------------------------------
const BUILD = {
  // Tier 1: the written word, spoken aloud; find the picture.
  read(w, others) {
    const caption = (x) => progress.strength(x.ro) < 2; // English help until a word is familiar
    return {
      prompt: { main: w.ro, sub: 'Find the picture', audio: w.a.w },
      options: [w, ...others].map((x) => picOption(x, caption(x))),
      answer: w.ro,
      reveal: { main: entryText(w), sub: w.en, audio: [w.a.e ?? w.a.w] },
    };
  },
  // Tier 2: a spoken question only ("Unde este pisica?"); find the picture.
  listen(w, others) {
    return {
      prompt: { main: '🔊  ?', sub: 'Listen, then find the picture', audio: w.a.q, afterMain: w.ask },
      options: [w, ...others].map((x) => picOption(x, false)),
      answer: w.ro,
      reveal: { main: w.ask, sub: `Where ${w.ask.startsWith('Unde sunt') ? 'are' : 'is'} the ${w.en}?`, audio: [w.a.w] },
    };
  },
  // Tier 2: a picture; find the Romanian word.
  name(w, others) {
    return {
      prompt: { main: `${w.emoji}  ${w.en}`, sub: 'Find the Romanian word', audio: null },
      options: [w, ...others].map((x) => textOption(x.ro, { word: x })),
      answer: w.ro,
      reveal: { main: entryText(w), sub: w.en, audio: [w.a.e ?? w.a.w] },
    };
  },
  // Tier 3: Romanian has three genders, and counting shows which one a noun
  // has: un-doi (masculine), o-două (feminine), un-două (neuter).
  gender(w) {
    return {
      prompt: { main: `${w.emoji}  ${w.ro}`, sub: 'How do you count it? One … two …', audio: w.a.w },
      options: [
        textOption('un · doi', { key: 'm', gloss: 'masculine' }),
        textOption('o · două', { key: 'f', gloss: 'feminine' }),
        textOption('un · două', { key: 'n', gloss: 'neuter' }),
      ],
      answer: w.g,
      reveal: { main: entryText(w), sub: `${GENDER_NAME[w.g]} · ${w.en}`, audio: [w.a.e] },
    };
  },
  // Tier 3: one or many? All the labels are real forms.
  number(w, others, n) {
    const many = Math.random() < 0.7;
    const forms = [textOption(w.ro, { gloss: 'just one' }), textOption(w.pl, { gloss: 'more than one' })];
    for (const o of others) {
      if (forms.length >= n) break;
      const f = many ? o.pl : o.ro;
      if (!forms.some((x) => x.key === f)) forms.push(textOption(f, { word: o }));
    }
    return {
      prompt: {
        main: many ? `${w.emoji} ${w.emoji} ${w.emoji}` : w.emoji,
        sub: many ? 'More than one — find the plural' : 'Just one — find the singular',
        audio: null,
      },
      options: forms,
      answer: many ? w.pl : w.ro,
      reveal: { main: entryText(w), sub: w.en, audio: [w.a.e] },
    };
  },
  // Tier 3: Romanian attaches "the" to the end of the noun.
  definite(w, others, n) {
    const enPl = w.count ? enPlural(w.en) : null;
    const plural = !!enPl && w.defPl !== w.def && Math.random() < 0.35;
    const mine = w.count
      ? [[w.ro, `${w.en}`], [w.def, `the ${w.en}`], [w.pl, 'more than one'], [w.defPl, 'the … (many)']]
      : [[w.ro, w.en], [w.def, `the ${w.en}`]];
    const forms = [];
    for (const [f, gloss] of mine) if (!forms.some((x) => x.key === f)) forms.push(textOption(f, { gloss }));
    for (const o of others) {
      if (forms.length >= n) break;
      if (!forms.some((x) => x.key === o.def)) forms.push(textOption(o.def, { word: o, gloss: `the ${o.en}` }));
    }
    const answer = plural ? w.defPl : w.def;
    // keep the answer among the first n labels
    const at = forms.findIndex((x) => x.key === answer);
    if (at >= n) [forms[n - 1], forms[at]] = [forms[at], forms[n - 1]];
    return {
      prompt: {
        main: `${w.emoji}  the ${plural ? enPl : w.en}`,
        sub: 'Find the form with “the” built in',
        audio: null,
      },
      options: forms.slice(0, Math.max(n, 2)),
      answer,
      reveal: plural
        ? { main: `${w.pl}  →  ${w.defPl}`, sub: `${enPl}  →  the ${enPl}`, audio: [w.a.e] }
        : { main: `${w.ro}  →  ${w.def}`, sub: `${w.en}  →  the ${w.en}`, audio: [w.a.q] },
    };
  },
};

// Grammar rounds need a countable noun with distinct forms; fall back to the
// "the" round, which every noun can do.
function fitType(type, w) {
  if (type === 'gender' && !w.count) return 'definite';
  if (type === 'number' && (!w.count || w.pl === w.ro)) return 'definite';
  return type;
}

// Choose the level's words: the least familiar first, so replaying a topic
// drills what was missed. Ties are broken at random.
function chooseWords(topic, tier, count) {
  const all = shuffle(wordsOf(topic));
  const score = (w) => progress.strength(w.ro) + (progress.seen(w.ro) ? 0.5 : 0)
    + (tier.id === 3 && !w.count ? 2 : 0);
  return all.sort((a, b) => score(a) - score(b)).slice(0, count);
}

export function buildSession(topic, tierId) {
  const tier = TIERS[tierId - 1];
  const total = tier.types.length;
  const words = shuffle(chooseWords(topic, tier, total));
  const pool = wordsOf(topic);
  const rounds = words.map((w, i) => {
    const type = fitType(tier.types[i], w);
    const mechanic = tier.mechanics[i];
    let n = tier.counts[i];
    if (type !== 'read' && type !== 'listen') n = Math.min(n, 4); // word planks are wide
    if (mechanic === 'nest') n = Math.min(n, 4);
    const others = shuffle(pool.filter((x) => x.ro !== w.ro)).slice(0, n - 1);
    const round = BUILD[type](w, others, n);
    round.options = shuffle(round.options);
    return { ...round, type, mechanic, word: w, index: i };
  });
  return { topic, tier, rounds };
}

// Every clip one round can play, for preloading.
export function roundAudio(r) {
  const out = [r.prompt.audio, ...r.reveal.audio];
  for (const o of r.options) if (o.word) out.push(o.word.a.w);
  return out.filter(Boolean);
}

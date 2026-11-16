// Saved progress: per-word strength, per-level stars, and sound settings.
// Everything lives in one localStorage entry; a private-mode browser that
// refuses storage simply plays without saving.
const KEY = 'sleepy-birds-v2';
const MAX_STRENGTH = 5;

const fresh = () => ({
  words: {},     // ro -> { s: 0..5, right, wrong }
  levels: {},    // "topic:tier" -> { stars: 1..3, best: score }
  clears: 0,     // levels completed, drives which poem stanza is shown
  settings: { music: true, sound: true },
  seenHowTo: false,
});

let state = fresh();
try {
  const raw = window.localStorage.getItem(KEY);
  if (raw) state = { ...fresh(), ...JSON.parse(raw) };
} catch { /* start fresh */ }

function save() {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* not saved */ }
}

export const progress = {
  get settings() { return state.settings; },
  setSetting(name, value) { state.settings[name] = value; save(); },

  get seenHowTo() { return state.seenHowTo; },
  markHowTo() { if (!state.seenHowTo) { state.seenHowTo = true; save(); } },

  strength(ro) { return state.words[ro]?.s ?? 0; },
  seen(ro) { return ro in state.words; },
  // A first-try answer strengthens a word; a wrong answer weakens it.
  record(ro, firstTry) {
    const w = state.words[ro] ?? { s: 0, right: 0, wrong: 0 };
    if (firstTry) { w.s = Math.min(MAX_STRENGTH, w.s + 1); w.right += 1; }
    else { w.s = Math.max(0, w.s - 1); w.wrong += 1; }
    state.words[ro] = w;
    save();
  },

  level(topicId, tier) { return state.levels[`${topicId}:${tier}`] ?? null; },
  recordLevel(topicId, tier, stars, score) {
    const k = `${topicId}:${tier}`;
    const old = state.levels[k] ?? { stars: 0, best: 0 };
    state.levels[k] = { stars: Math.max(old.stars, stars), best: Math.max(old.best, score) };
    state.clears += 1;
    save();
  },
  get clears() { return state.clears; },

  // Share of a topic's words answered right first time at least three times net.
  mastery(topic) {
    const known = topic.words.filter((ro) => (state.words[ro]?.s ?? 0) >= 3).length;
    return known / topic.words.length;
  },
  totalStars() { return Object.values(state.levels).reduce((n, l) => n + l.stars, 0); },
  wordsKnown() { return Object.values(state.words).filter((w) => w.s >= 3).length; },

  reset() { state = fresh(); save(); },
};

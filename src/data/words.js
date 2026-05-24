// Pluggable Romanian word list.
//
// This is intentionally minimal for the prototype — the *mechanic* is what we
// are tuning right now, not the curriculum. Later this can be swapped for
// richer data drawn from the companion `limba-română` material (audio,
// difficulty tiers, themed sets, grammar drills, etc.).
//
// Each entry:
//   ro    — the Romanian word (what the player is asked to find)
//   en    — English gloss (shown on the target so the player can match)
//   emoji — a quick visual cue shown on the target
//
// A round picks one entry as the answer and a few others as distractors.

export const WORDS = [
  { ro: 'pisică', en: 'cat', emoji: '🐱' },
  { ro: 'câine', en: 'dog', emoji: '🐶' },
  { ro: 'pasăre', en: 'bird', emoji: '🐦' },
  { ro: 'pește', en: 'fish', emoji: '🐟' },
  { ro: 'cal', en: 'horse', emoji: '🐴' },
  { ro: 'urs', en: 'bear', emoji: '🐻' },
  { ro: 'soare', en: 'sun', emoji: '☀️' },
  { ro: 'lună', en: 'moon', emoji: '🌙' },
  { ro: 'stea', en: 'star', emoji: '⭐' },
  { ro: 'copac', en: 'tree', emoji: '🌳' },
  { ro: 'floare', en: 'flower', emoji: '🌸' },
  { ro: 'casă', en: 'house', emoji: '🏠' },
  { ro: 'măr', en: 'apple', emoji: '🍎' },
  { ro: 'pâine', en: 'bread', emoji: '🍞' },
  { ro: 'apă', en: 'water', emoji: '💧' },
];

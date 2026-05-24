// Themed vocabulary — common, concrete nouns that have a clear emoji.
//
// Each level is a theme. A round picks one word as the answer and a few others
// from the SAME theme as distractors, so you're choosing within a category.
// Difficulty ramps across levels (see GameScene: more targets later on).
//
// Each entry: ro (Romanian word shown as the prompt), en (English gloss shown
// on the target), emoji (the picture on the target).

export const LEVELS = [
  {
    theme: 'Animals',
    icon: '🐾',
    words: [
      { ro: 'câine', en: 'dog', emoji: '🐶' },
      { ro: 'pisică', en: 'cat', emoji: '🐱' },
      { ro: 'cal', en: 'horse', emoji: '🐴' },
      { ro: 'vacă', en: 'cow', emoji: '🐮' },
      { ro: 'porc', en: 'pig', emoji: '🐷' },
      { ro: 'oaie', en: 'sheep', emoji: '🐑' },
      { ro: 'iepure', en: 'rabbit', emoji: '🐰' },
      { ro: 'șoarece', en: 'mouse', emoji: '🐭' },
      { ro: 'urs', en: 'bear', emoji: '🐻' },
      { ro: 'leu', en: 'lion', emoji: '🦁' },
      { ro: 'broască', en: 'frog', emoji: '🐸' },
      { ro: 'pește', en: 'fish', emoji: '🐟' },
    ],
  },
  {
    theme: 'Food & Drink',
    icon: '🍎',
    words: [
      { ro: 'măr', en: 'apple', emoji: '🍎' },
      { ro: 'pâine', en: 'bread', emoji: '🍞' },
      { ro: 'brânză', en: 'cheese', emoji: '🧀' },
      { ro: 'ou', en: 'egg', emoji: '🥚' },
      { ro: 'lapte', en: 'milk', emoji: '🥛' },
      { ro: 'banană', en: 'banana', emoji: '🍌' },
      { ro: 'morcov', en: 'carrot', emoji: '🥕' },
      { ro: 'cartof', en: 'potato', emoji: '🥔' },
      { ro: 'tort', en: 'cake', emoji: '🍰' },
      { ro: 'cafea', en: 'coffee', emoji: '☕' },
      { ro: 'struguri', en: 'grapes', emoji: '🍇' },
      { ro: 'pizza', en: 'pizza', emoji: '🍕' },
    ],
  },
  {
    theme: 'Nature',
    icon: '🌙',
    words: [
      { ro: 'soare', en: 'sun', emoji: '☀️' },
      { ro: 'lună', en: 'moon', emoji: '🌙' },
      { ro: 'stea', en: 'star', emoji: '⭐' },
      { ro: 'copac', en: 'tree', emoji: '🌳' },
      { ro: 'floare', en: 'flower', emoji: '🌸' },
      { ro: 'munte', en: 'mountain', emoji: '🏔️' },
      { ro: 'foc', en: 'fire', emoji: '🔥' },
      { ro: 'curcubeu', en: 'rainbow', emoji: '🌈' },
      { ro: 'nor', en: 'cloud', emoji: '☁️' },
      { ro: 'val', en: 'wave', emoji: '🌊' },
      { ro: 'fulger', en: 'lightning', emoji: '⚡' },
      { ro: 'zăpadă', en: 'snow', emoji: '❄️' },
    ],
  },
  {
    theme: 'Around the Home',
    icon: '🏠',
    words: [
      { ro: 'casă', en: 'house', emoji: '🏠' },
      { ro: 'scaun', en: 'chair', emoji: '🪑' },
      { ro: 'pat', en: 'bed', emoji: '🛏️' },
      { ro: 'ușă', en: 'door', emoji: '🚪' },
      { ro: 'ceas', en: 'clock', emoji: '⏰' },
      { ro: 'carte', en: 'book', emoji: '📖' },
      { ro: 'cheie', en: 'key', emoji: '🔑' },
      { ro: 'telefon', en: 'phone', emoji: '📱' },
      { ro: 'bec', en: 'lightbulb', emoji: '💡' },
      { ro: 'foarfece', en: 'scissors', emoji: '✂️' },
      { ro: 'umbrelă', en: 'umbrella', emoji: '☂️' },
      { ro: 'lumânare', en: 'candle', emoji: '🕯️' },
    ],
  },
  {
    theme: 'Getting Around',
    icon: '🚗',
    words: [
      { ro: 'mașină', en: 'car', emoji: '🚗' },
      { ro: 'tren', en: 'train', emoji: '🚆' },
      { ro: 'avion', en: 'airplane', emoji: '✈️' },
      { ro: 'bicicletă', en: 'bicycle', emoji: '🚲' },
      { ro: 'barcă', en: 'boat', emoji: '⛵' },
      { ro: 'autobuz', en: 'bus', emoji: '🚌' },
      { ro: 'rachetă', en: 'rocket', emoji: '🚀' },
      { ro: 'elicopter', en: 'helicopter', emoji: '🚁' },
      { ro: 'camion', en: 'truck', emoji: '🚚' },
    ],
  },
];

// Difficulty per level (0-based index): more targets and tighter bird budgets
// as you progress. wordsToClear is how many correct words finish the level.
export function levelParams(i) {
  return {
    targetCount: Math.min(3 + i, 5), // 3,4,5,5,5 targets on screen
    wordsToClear: 5,
    birds: 5 + Math.max(3 - i, 1), // 8,7,6,6,6 birds — slack shrinks
  };
}

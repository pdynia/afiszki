// FSRS-5 (Free Spaced Repetition Scheduler), the algorithm modern Anki uses.
// Open algorithm: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
// Default parameters trained on Anki users' review logs.
export const DEFAULT_W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];

const DECAY = -0.5;
const FACTOR = 19 / 81;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Probability of recall after t days with stability S.
export function retrievability(t, S) {
  if (S <= 0) return 0;
  return Math.pow(1 + FACTOR * t / S, DECAY);
}

// Days until recall probability drops to the desired retention.
export function nextInterval(S, retention) {
  return (S / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

export function initStability(w, g) { return Math.max(0.1, w[g - 1]); }
export function initDifficulty(w, g) { return clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10); }

export function nextDifficulty(w, D, g) {
  const delta = -w[6] * (g - 3);
  const linear = D + delta * (10 - D) / 9;             // linear damping (FSRS-5)
  const meanRev = w[7] * initDifficulty(w, 4) + (1 - w[7]) * linear;
  return clamp(meanRev, 1, 10);
}

export function recallStability(w, D, S, R, g) {
  const hard = g === 2 ? w[15] : 1;
  const easy = g === 4 ? w[16] : 1;
  return S * (Math.exp(w[8]) * (11 - D) * Math.pow(S, -w[9]) * (Math.exp(w[10] * (1 - R)) - 1) * hard * easy + 1);
}

export function lapseStability(w, D, S, R) {
  const s = w[11] * Math.pow(D, -w[12]) * (Math.pow(S + 1, w[13]) - 1) * Math.exp(w[14] * (1 - R));
  return Math.min(s, S);
}

// Same-day (short-term) review, used while a card is in learning / relearning.
export function shortTermStability(w, S, g) {
  return S * Math.exp(w[17] * (g - 3 + w[18]));
}

// Convert FSRS difficulty to an Anki-style ease factor (permille) for .apkg export.
export function difficultyToEase(D) { return Math.round(1300 + (10 - D) / 9 * 1700); }
// Rough FSRS state for cards that only have SM-2 data.
export function fromSm2(ivl, ease) {
  const D = ease ? clamp(1 + (3000 - ease) / 1700 * 9, 1, 10) : 5;
  return { stability: Math.max(0.1, ivl || 1), difficulty: D };
}

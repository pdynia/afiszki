// SM-2 style scheduler modelled on Anki's classic (v2) scheduler.
// Card fields used: state ('new'|'learn'|'review'|'relearn'), due (ms), ivl (days),
// ease (permille, e.g. 2500), step (index into learning steps), reps, lapses.

export const DEFAULTS = {
  newPerDay: 20,
  revPerDay: 200,
  learnSteps: [1, 10],       // minutes
  relearnSteps: [10],        // minutes
  graduatingIvl: 1,          // days
  easyIvl: 4,                // days
  startEase: 2500,
  minEase: 1300,
  easyBonus: 1.3,
  hardMult: 1.2,
  lapseMult: 0.5,
  maxIvl: 36500,
};

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

function fuzz(days) {
  if (days < 2) return days;
  const f = days < 7 ? 0.25 : days < 30 ? 0.15 : 0.05;
  const delta = Math.max(1, Math.round(days * f));
  return days + Math.floor(Math.random() * (2 * delta + 1)) - delta;
}

// Returns a new card object with scheduling applied. Pure: does not mutate.
export function answer(card, grade, cfg = DEFAULTS, now = Date.now()) {
  const c = { ...card, reps: (card.reps || 0) + 1, lastReview: now };
  const steps = cfg.learnSteps.length ? cfg.learnSteps : [1];
  const relearn = cfg.relearnSteps.length ? cfg.relearnSteps : [10];

  const graduate = (easy) => {
    c.state = 'review';
    c.step = 0;
    c.ivl = fuzz(easy ? cfg.easyIvl : cfg.graduatingIvl);
    c.ease = c.ease || cfg.startEase;
    c.due = now + c.ivl * DAY;
  };

  if (c.state === 'new' || c.state === 'learn') {
    const wasNew = c.state === 'new';
    c.ease = c.ease || cfg.startEase;
    if (grade === AGAIN) {
      c.state = 'learn'; c.step = 0;
      c.due = now + steps[0] * MIN;
    } else if (grade === HARD) {
      c.state = 'learn';
      c.step = wasNew ? 0 : (c.step || 0);
      const s = steps[c.step] ?? steps[0];
      c.due = now + s * 1.5 * MIN;
    } else if (grade === GOOD) {
      const next = (wasNew ? 0 : (c.step || 0)) + 1;
      if (next >= steps.length) graduate(false);
      else { c.state = 'learn'; c.step = next; c.due = now + steps[next] * MIN; }
    } else {
      graduate(true);
    }
    return c;
  }

  if (c.state === 'relearn') {
    if (grade === AGAIN) {
      c.step = 0; c.due = now + relearn[0] * MIN;
    } else if (grade === HARD) {
      const s = relearn[c.step || 0] ?? relearn[0];
      c.due = now + s * 1.5 * MIN;
    } else {
      const next = (c.step || 0) + 1;
      if (next >= relearn.length || grade === EASY) {
        c.state = 'review'; c.step = 0;
        c.ivl = Math.max(1, c.ivl || 1);
        c.due = now + c.ivl * DAY;
      } else { c.step = next; c.due = now + relearn[next] * MIN; }
    }
    return c;
  }

  // review
  const ease = c.ease || cfg.startEase;
  const ivl = Math.max(1, c.ivl || 1);
  const late = Math.max(0, (now - (card.due || now)) / DAY);
  if (grade === AGAIN) {
    c.lapses = (c.lapses || 0) + 1;
    c.ease = Math.max(cfg.minEase, ease - 200);
    c.ivl = Math.max(1, Math.round(ivl * cfg.lapseMult));
    c.state = 'relearn'; c.step = 0;
    c.due = now + relearn[0] * MIN;
    return c;
  }
  let next;
  if (grade === HARD) {
    c.ease = Math.max(cfg.minEase, ease - 150);
    next = Math.max(ivl + 1, Math.round((ivl + late / 4) * cfg.hardMult));
  } else if (grade === GOOD) {
    next = Math.max(ivl + 1, Math.round((ivl + late / 2) * ease / 1000));
  } else {
    c.ease = ease + 150;
    next = Math.max(ivl + 1, Math.round((ivl + late) * ease / 1000 * cfg.easyBonus));
  }
  c.ivl = Math.min(cfg.maxIvl, fuzz(next));
  c.due = now + c.ivl * DAY;
  return c;
}

// Human-readable preview of the interval each grade would produce.
export function previewIntervals(card, cfg = DEFAULTS, now = Date.now()) {
  const out = {};
  for (const g of [AGAIN, HARD, GOOD, EASY]) {
    const c = answer(card, g, { ...cfg, maxIvl: cfg.maxIvl }, now);
    out[g] = fmtDelta(c.due - now);
  }
  return out;
}

export function fmtDelta(ms) {
  const m = ms / MIN;
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)}d`;
  const mo = d / 30;
  if (mo < 12) return `${mo.toFixed(mo < 10 ? 1 : 0)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

// Local-day boundary helpers (day rolls over at 4am like Anki).
export function dayStart(now = Date.now(), rolloverHour = 4) {
  const d = new Date(now);
  d.setHours(rolloverHour, 0, 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}
export const dayEnd = (now) => dayStart(now) + DAY;
export const dayKey = (now) => String(dayStart(now));

// Classify cards for counts and queue building.
export function classify(cards, now = Date.now()) {
  const end = dayEnd(now);
  const res = { newCards: [], learn: [], learnLater: [], due: [], total: cards.length };
  for (const c of cards) {
    if (c.suspended) continue;
    if (c.state === 'new') res.newCards.push(c);
    else if (c.state === 'learn' || c.state === 'relearn') {
      (c.due <= now ? res.learn : res.learnLater).push(c);
    } else if (c.state === 'review' && c.due < end) res.due.push(c);
  }
  res.newCards.sort((a, b) => (a.order ?? a.due) - (b.order ?? b.due));
  res.learn.sort((a, b) => a.due - b.due);
  res.learnLater.sort((a, b) => a.due - b.due);
  res.due.sort((a, b) => a.due - b.due);
  return res;
}

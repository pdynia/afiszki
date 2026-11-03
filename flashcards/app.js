import * as db from './db.js';
import { importApkg, exportDeck } from './apkg.js';
import * as sched from './scheduler.js';
import { renderCard, mount, releaseMediaUrls } from './render.js';

export const VERSION = '0.2.0';
const $ = (id) => document.getElementById(id);
const DAY = 86400000;

// ---------------------------------------------------------------- settings
let settings = { ...sched.DEFAULTS, theme: 'auto' };
async function loadSettings() {
  settings = { ...settings, ...(await db.getMeta('settings', {})) };
  applyTheme();
}
function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = settings.theme;
}
function isDark() {
  return settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

// ---------------------------------------------------------------- navigation
const views = ['decks', 'deck', 'study', 'settings'];
let current = 'decks';
let currentDeck = null;
function show(view, title) {
  current = view;
  for (const v of views) $(`view-${v}`).classList.toggle('hidden', v !== view);
  $('title').textContent = title;
  $('btn-back').classList.toggle('hidden', view === 'decks');
  $('btn-settings').classList.toggle('hidden', view !== 'decks');
  $('btn-more').classList.toggle('hidden', view !== 'decks');
  $('btn-undo').classList.toggle('hidden', view !== 'study');
  $('study-progress').classList.toggle('hidden', view !== 'study');
  window.scrollTo(0, 0);
}
$('btn-back').onclick = () => {
  if (current === 'study') { releaseMediaUrls(); return openDeck(currentDeck.id); }
  return showDecks();
};
$('btn-settings').onclick = openSettings;

let toastTimer;
function toast(msg, ms = 2500) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------------------------------------------------------------- daily limits & stats
const dailyKey = (deckId) => `daily:${deckId}:${sched.dayKey()}`;
async function getDaily(deckId) { return db.getMeta(dailyKey(deckId), { new: 0, rev: 0 }); }
async function bumpDaily(deckId, field, delta = 1) {
  const d = await getDaily(deckId);
  d[field] = Math.max(0, (d[field] || 0) + delta);
  await db.setMeta(dailyKey(deckId), d);
}

async function deckCounts(deckId, cards) {
  cards = cards || await db.getAllByIndex('cards', 'deckId', deckId);
  const c = sched.classify(cards);
  const daily = await getDaily(deckId);
  const learned = cards.filter(x => x.state === 'review' && !x.suspended).length;
  return {
    cards: c,
    new: Math.max(0, Math.min(c.newCards.length, settings.newPerDay - daily.new)),
    learn: c.learn.length + c.learnLater.length,
    due: Math.max(0, Math.min(c.due.length, settings.revPerDay - daily.rev)),
    total: c.total,
    learned,
  };
}

// Reviews grouped by study day for the last n days (oldest first).
function reviewsPerDay(reviews, days = 7) {
  const today = sched.dayStart();
  const buckets = Array.from({ length: days }, (_, i) => ({ day: today - (days - 1 - i) * DAY, count: 0 }));
  for (const r of reviews) {
    const idx = days - 1 - Math.floor((today - sched.dayStart(r.at)) / DAY);
    if (idx >= 0 && idx < days) buckets[idx].count++;
  }
  return buckets;
}
function streak(reviews) {
  const days = new Set(reviews.map(r => sched.dayStart(r.at)));
  let d = sched.dayStart(), n = 0;
  if (!days.has(d)) d -= DAY; // today not studied yet still counts yesterday's streak
  while (days.has(d)) { n++; d -= DAY; }
  return n;
}

// ---------------------------------------------------------------- deck list
async function showDecks() {
  show('decks', 'Decks');
  const decks = (await db.getAll('decks')).sort((a, b) => a.name.localeCompare(b.name));
  const list = $('deck-list');
  list.innerHTML = '';
  $('empty-state').classList.toggle('hidden', decks.length > 0);
  $('hero').classList.toggle('hidden', decks.length === 0);
  let totalDue = 0, totalCards = 0;
  for (const d of decks) {
    const counts = await deckCounts(d.id);
    totalDue += counts.new + counts.learn + counts.due;
    totalCards += counts.total;
    const pct = counts.total ? Math.round(100 * counts.learned / counts.total) : 0;
    const b = document.createElement('button');
    b.className = 'deck';
    b.innerHTML = `
      <span class="name"></span>
      <svg class="chev"><use href="#i-chev"/></svg>
      <span class="meta">
        <span class="tag new ${counts.new ? '' : 'zero'}"><i></i>${counts.new} new</span>
        <span class="tag learn ${counts.learn ? '' : 'zero'}"><i></i>${counts.learn} learning</span>
        <span class="tag due ${counts.due ? '' : 'zero'}"><i></i>${counts.due} due</span>
        <span>${counts.total} cards · ${pct}% learned</span>
      </span>
      <span class="bar"><i style="width:${pct}%"></i></span>`;
    b.querySelector('.name').textContent = d.name;
    b.onclick = () => openDeck(d.id);
    list.appendChild(b);
  }
  $('deck-summary').textContent = decks.length ? `${decks.length} deck${decks.length > 1 ? 's' : ''} · ${totalCards} cards` : '';
  if (decks.length) {
    const reviews = await db.getAll('reviews');
    const today = sched.dayStart();
    $('hero-due').textContent = totalDue;
    $('hero-sub').textContent = totalDue ? 'cards waiting across all decks' : 'all caught up';
    $('hero-done').textContent = reviews.filter(r => r.at >= today).length;
    $('hero-streak').textContent = streak(reviews);
  }
}

async function openDeck(id) {
  currentDeck = await db.get('decks', id);
  if (!currentDeck) return showDecks();
  show('deck', 'Deck');
  $('deck-name').textContent = currentDeck.name;
  const counts = await deckCounts(id);
  $('c-new').textContent = counts.new;
  $('c-learn').textContent = counts.learn;
  $('c-due').textContent = counts.due;
  $('deck-total').textContent = `${counts.total} cards · ${counts.learned} learned`;
  const pct = counts.total ? counts.learned / counts.total : 0;
  $('ring-pct').textContent = `${Math.round(pct * 100)}%`;
  requestAnimationFrame(() => { $('ring-fg').style.strokeDashoffset = String(326.7 * (1 - pct)); });
  const reviews = await db.getAllByIndex('reviews', 'deckId', id);
  const buckets = reviewsPerDay(reviews);
  const max = Math.max(1, ...buckets.map(b => b.count));
  $('hist').innerHTML = buckets.map(b =>
    `<div><i class="${b.count ? '' : 'zero'}" style="height:${Math.max(4, Math.round(52 * b.count / max))}px" title="${b.count}"></i><span>${new Date(b.day).toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>`).join('');
  const week = buckets.reduce((s, b) => s + b.count, 0);
  $('hist-total').textContent = `${week} review${week === 1 ? '' : 's'}`;
  const nothing = counts.new + counts.cards.learn.length + counts.due === 0 && counts.cards.learnLater.length === 0;
  $('btn-study').disabled = nothing;
  $('btn-study').textContent = nothing ? 'Nothing due right now' : `Study now · ${counts.new + counts.learn + counts.due}`;
}

$('btn-study').onclick = () => startStudy(currentDeck.id);
$('btn-deck-delete').onclick = async () => {
  if (!confirm(`Delete "${currentDeck.name}" and all its progress?`)) return;
  await db.deleteDeckData(currentDeck.id);
  toast('Deck deleted');
  showDecks();
};
$('btn-deck-export').onclick = async () => {
  toast('Exporting…');
  try {
    const blob = await exportDeck(currentDeck.id);
    download(blob, `${currentDeck.name.replace(/[^\w.-]+/g, '_')}.apkg`);
  } catch (e) { console.error(e); toast(`Export failed: ${e.message}`, 5000); }
};

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 10000);
}

// ---------------------------------------------------------------- import / backup
async function importFile(file) {
  const status = $('import-status');
  status.className = 'status';
  status.textContent = 'Reading file…';
  if (current !== 'decks') showDecks();
  try {
    const res = await importApkg(file, (msg) => { status.textContent = msg; });
    const names = res.decks.map(d => `${d.name} (${d.cards} cards)`).join(', ');
    await showDecks();
    status.className = 'status ok';
    status.textContent = `Imported ${names}` + (res.warnings.length ? ` — ${res.warnings.join(' ')}` : '');
  } catch (err) {
    console.error(err);
    status.className = 'status err';
    status.textContent = `Import failed: ${err.message}`;
  }
}
$('file-apkg').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };

// Drag & drop on desktop
let dragDepth = 0;
document.addEventListener('dragenter', (e) => { e.preventDefault(); if (++dragDepth === 1) $('drop-overlay').classList.remove('hidden'); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop-overlay').classList.add('hidden'); } });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; $('drop-overlay').classList.add('hidden');
  const f = e.dataTransfer.files[0];
  if (!f) return;
  if (/\.zip$/i.test(f.name) && !/\.apkg$/i.test(f.name)) restoreBackup(f); else importFile(f);
});

async function backupAll() {
  toast('Preparing backup…');
  const zip = new JSZip();
  const data = {};
  for (const s of ['decks', 'models', 'notes', 'cards', 'reviews', 'meta']) data[s] = await db.getAll(s);
  data.version = VERSION;
  zip.file('data.json', JSON.stringify(data));
  for (const m of await db.getAll('media')) zip.file(`media/${m.name}`, m.blob);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  download(blob, `cards-backup-${new Date().toISOString().slice(0, 10)}.zip`);
}
async function restoreBackup(file) {
  if (!confirm('Restore this backup? Existing data with the same ids will be overwritten.')) return;
  try {
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file('data.json');
    if (!entry) throw new Error('not a Cards backup');
    const data = JSON.parse(await entry.async('string'));
    for (const s of ['decks', 'models', 'notes', 'cards', 'reviews', 'meta']) await db.putMany(s, data[s] || []);
    const media = [];
    for (const [path, f] of Object.entries(zip.files)) {
      if (f.dir || !path.startsWith('media/')) continue;
      media.push({ name: path.slice(6), blob: await f.async('blob') });
      if (media.length >= 25) await db.putMany('media', media.splice(0));
    }
    await db.putMany('media', media);
    await loadSettings();
    toast('Backup restored');
    showDecks();
  } catch (err) { console.error(err); toast(`Restore failed: ${err.message}`, 5000); }
}
$('file-backup').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreBackup(f); };
$('btn-export').onclick = backupAll;
$('btn-restore').onclick = () => $('file-backup').click();

// "More" sheet on the deck list
const sheet = $('sheet');
const closeSheet = () => sheet.classList.add('hidden');
$('btn-more').onclick = () => sheet.classList.remove('hidden');
$('sheet-backdrop').onclick = closeSheet;
$('sheet-cancel').onclick = closeSheet;
$('sheet-backup').onclick = () => { closeSheet(); backupAll(); };
$('sheet-restore').onclick = () => { closeSheet(); $('file-backup').click(); };

// ---------------------------------------------------------------- study
let study = null;
const mediaCache = new Map();
async function getBlobCached(name) {
  if (!mediaCache.has(name)) mediaCache.set(name, (await db.get('media', name))?.blob || null);
  return mediaCache.get(name);
}

async function startStudy(deckId) {
  const counts = await deckCounts(deckId);
  const c = counts.cards;
  study = {
    deckId,
    learn: [...c.learn, ...c.learnLater],
    due: c.due.slice(0, counts.due),
    newCards: c.newCards.slice(0, counts.new),
    card: null,
    models: new Map((await db.getAll('models')).map(m => [m.id, m])),
    startedAt: Date.now(),
    answered: 0, again: 0,
    history: [], // for undo: { before, after, reviewId, dailyField }
  };
  study.planned = study.learn.length + study.due.length + study.newCards.length;
  show('study', currentDeck.name);
  $('study-done').classList.add('hidden');
  $('card-wrap').classList.remove('hidden');
  $('btn-show').classList.remove('hidden');
  $('btn-undo').disabled = true;
  await nextCard();
}

function pickNext() {
  const now = Date.now();
  study.learn.sort((a, b) => a.due - b.due);
  if (study.learn.length && study.learn[0].due <= now) return study.learn.shift();
  if (study.due.length) return study.due.shift();
  if (study.newCards.length) return study.newCards.shift();
  // Learn-ahead: show a learning card up to 20 minutes early rather than nothing (as Anki does).
  if (study.learn.length && study.learn[0].due <= now + 20 * 60000) return study.learn.shift();
  return null;
}

async function showCard(card) {
  study.card = card;
  const note = await db.get('notes', card.noteId);
  const model = note && study.models.get(note.modelId);
  if (!note || !model) { toast('Skipping card with missing note'); return nextCard(); }
  const names = new Set();
  for (const f of note.fields) {
    for (const m of f.matchAll(/src="([^"]+)"/g)) names.add(decodeURIComponent(m[1]));
    for (const m of f.matchAll(/\[sound:([^\]]+)\]/g)) names.add(m[1]);
  }
  await Promise.all([...names].map(getBlobCached));
  study.rendered = renderCard({ note, model, card, deckName: currentDeck.name, getBlob: (n) => mediaCache.get(n) || null });
  const host = $('card-host');
  host.classList.remove('answer');
  mount(host, study.rendered.front, study.rendered.css, { nightMode: isDark() && /night_?mode/i.test(study.rendered.css) });
  $('card-hint').textContent = 'Tap the card to show the answer';
  $('grade').classList.add('hidden');
  $('btn-show').classList.remove('hidden');
}

async function nextCard() {
  updateStudyCounts();
  const card = pickNext();
  if (!card) return finishStudy();
  await showCard(card);
}

function updateStudyCounts() {
  $('s-new').textContent = study.newCards.length;
  $('s-learn').textContent = study.learn.length;
  $('s-due').textContent = study.due.length;
  const remaining = study.newCards.length + study.learn.length + study.due.length;
  const total = Math.max(study.planned, study.answered + remaining);
  $('study-progress-bar').style.width = `${total ? Math.round(100 * study.answered / total) : 0}%`;
}

function showAnswer() {
  if (!study?.card || !$('grade').classList.contains('hidden')) return;
  const host = $('card-host');
  host.classList.add('answer');
  mount(host, study.rendered.back, study.rendered.css, { nightMode: isDark() && /night_?mode/i.test(study.rendered.css) });
  const iv = sched.previewIntervals(study.card, settings);
  for (const g of [1, 2, 3, 4]) $(`iv-${g}`).textContent = iv[g];
  $('card-hint').textContent = 'How well did you know it?';
  $('btn-show').classList.add('hidden');
  $('grade').classList.remove('hidden');
}
$('btn-show').onclick = showAnswer;
$('card-host').onclick = (e) => { if (!e.target.closest('audio, a, details, summary')) showAnswer(); };

async function grade(g) {
  if (!study?.card || $('grade').classList.contains('hidden')) return;
  const before = study.card;
  const after = sched.answer(before, g, settings);
  await db.put('cards', after);
  const reviewId = await db.put('reviews', { cardId: after.id, deckId: after.deckId, grade: g, at: after.lastReview, ivl: after.ivl, ease: after.ease, state: before.state });
  let dailyField = null;
  if (before.state === 'new') dailyField = 'new'; else if (before.state === 'review') dailyField = 'rev';
  if (dailyField) await bumpDaily(after.deckId, dailyField);
  if (after.state === 'learn' || after.state === 'relearn') study.learn.push(after);
  study.answered++;
  if (g === 1) study.again++;
  study.history.push({ before, after, reviewId, dailyField, grade: g });
  $('btn-undo').disabled = false;
  await nextCard();
}
for (const b of document.querySelectorAll('#grade button')) b.onclick = () => grade(Number(b.dataset.grade));

async function undo() {
  const h = study?.history.pop();
  if (!h) return;
  await db.put('cards', h.before);
  await db.del('reviews', h.reviewId);
  if (h.dailyField) await bumpDaily(h.before.deckId, h.dailyField, -1);
  // Remove the re-queued learning copy and put the current card back where it came from.
  study.learn = study.learn.filter(c => c.id !== h.after.id);
  if (study.card) {
    const cur = study.card;
    if (cur.state === 'new') study.newCards.unshift(cur);
    else if (cur.state === 'review') study.due.unshift(cur);
    else study.learn.unshift(cur);
  }
  study.answered = Math.max(0, study.answered - 1);
  if (h.grade === 1) study.again = Math.max(0, study.again - 1);
  $('btn-undo').disabled = study.history.length === 0;
  $('study-done').classList.add('hidden');
  $('card-wrap').classList.remove('hidden');
  updateStudyCounts();
  await showCard(h.before);
}
$('btn-undo').onclick = undo;

function finishStudy() {
  $('card-wrap').classList.add('hidden');
  $('btn-show').classList.add('hidden');
  $('grade').classList.add('hidden');
  $('study-done').classList.remove('hidden');
  $('study-progress-bar').style.width = '100%';
  const pending = study?.learn?.length || 0;
  $('study-done-msg').textContent = pending
    ? `${pending} learning card${pending > 1 ? 's' : ''} will be due again in ${sched.fmtDelta(study.learn[0].due - Date.now())}.`
    : 'No more cards are due in this deck right now.';
  $('sum-count').textContent = study.answered;
  $('sum-acc').textContent = study.answered ? `${Math.round(100 * (study.answered - study.again) / study.answered)}%` : '–';
  $('sum-time').textContent = sched.fmtDelta(Math.max(60000, Date.now() - study.startedAt));
  releaseMediaUrls();
}
$('btn-done-back').onclick = showDecks;

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') { if (!sheet.classList.contains('hidden')) closeSheet(); return; }
  if (current !== 'study' || e.target.matches('input, select, textarea')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); $('grade').classList.contains('hidden') ? showAnswer() : grade(3); }
  else if (/^[1-4]$/.test(e.key)) grade(Number(e.key));
  else if (e.key === 'z' || e.key === 'Backspace') { e.preventDefault(); undo(); }
});

// ---------------------------------------------------------------- settings view
async function openSettings() {
  show('settings', 'Settings');
  $('set-new-per-day').value = settings.newPerDay;
  $('set-rev-per-day').value = settings.revPerDay;
  $('set-steps').value = settings.learnSteps.join(', ');
  $('set-theme').value = settings.theme;
  $('app-version').textContent = VERSION;
  const info = $('storage-info');
  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    info.textContent = `Using ${(usage / 1048576).toFixed(1)} MB of ${(quota / 1048576).toFixed(0)} MB available. Persistent storage ${persisted ? 'granted' : 'not granted'} — granting it stops the browser from evicting your decks when space is low.`;
  } else info.textContent = 'Storage information unavailable.';
}
$('btn-settings-save').onclick = async () => {
  settings.newPerDay = Math.max(0, Number($('set-new-per-day').value) || 0);
  settings.revPerDay = Math.max(0, Number($('set-rev-per-day').value) || 0);
  const steps = $('set-steps').value.split(/[,\s]+/).map(Number).filter(n => n > 0);
  settings.learnSteps = steps.length ? steps : [1, 10];
  settings.theme = $('set-theme').value;
  await db.setMeta('settings', settings);
  applyTheme();
  toast('Settings saved');
  showDecks();
};
$('btn-persist').onclick = async () => {
  const ok = navigator.storage?.persist ? await navigator.storage.persist() : false;
  toast(ok ? 'Persistent storage granted' : 'Not granted by the browser');
  openSettings();
};
$('btn-wipe').onclick = async () => {
  if (!confirm('Delete ALL decks, progress and media on this device?')) return;
  await db.wipe();
  settings = { ...sched.DEFAULTS, theme: 'auto' };
  applyTheme();
  toast('All data deleted');
  showDecks();
};

// ---------------------------------------------------------------- boot
(async () => {
  await loadSettings();
  await showDecks();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  }
})();

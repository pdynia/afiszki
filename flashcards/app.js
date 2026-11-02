import * as db from './db.js';
import { importApkg, exportDeck } from './apkg.js';
import * as sched from './scheduler.js';
import { renderCard, mount, releaseMediaUrls } from './render.js';

export const VERSION = '0.1.0';
const $ = (id) => document.getElementById(id);

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
  $('btn-settings').classList.toggle('hidden', view === 'settings' || view === 'study');
  window.scrollTo(0, 0);
}
$('btn-back').onclick = () => {
  if (current === 'study') { releaseMediaUrls(); return openDeck(currentDeck.id); }
  if (current === 'deck' || current === 'settings') return showDecks();
};
$('btn-settings').onclick = openSettings;

let toastTimer;
function toast(msg, ms = 2500) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------------------------------------------------------------- daily limits
const dailyKey = (deckId) => `daily:${deckId}:${sched.dayKey()}`;
async function getDaily(deckId) { return db.getMeta(dailyKey(deckId), { new: 0, rev: 0 }); }
async function bumpDaily(deckId, field) {
  const d = await getDaily(deckId);
  d[field] = (d[field] || 0) + 1;
  await db.setMeta(dailyKey(deckId), d);
}

async function deckCounts(deckId) {
  const cards = await db.getAllByIndex('cards', 'deckId', deckId);
  const c = sched.classify(cards);
  const daily = await getDaily(deckId);
  return {
    cards: c,
    new: Math.max(0, Math.min(c.newCards.length, settings.newPerDay - daily.new)),
    learn: c.learn.length + c.learnLater.length,
    due: Math.max(0, Math.min(c.due.length, settings.revPerDay - daily.rev)),
    total: c.total,
  };
}

// ---------------------------------------------------------------- deck list
async function showDecks() {
  show('decks', 'Decks');
  const decks = (await db.getAll('decks')).sort((a, b) => a.name.localeCompare(b.name));
  const list = $('deck-list');
  list.innerHTML = '';
  $('empty-state').classList.toggle('hidden', decks.length > 0);
  for (const d of decks) {
    const counts = await deckCounts(d.id);
    const b = document.createElement('button');
    b.className = 'deck';
    b.innerHTML = `<span class="name"></span><span class="counts-inline"><span class="new">${counts.new}</span><span class="learn">${counts.learn}</span><span class="due">${counts.due}</span></span>`;
    b.querySelector('.name').textContent = d.name;
    b.onclick = () => openDeck(d.id);
    list.appendChild(b);
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
  $('deck-total').textContent = `${counts.total} cards in total`;
  $('btn-study').disabled = counts.new + counts.cards.learn.length + counts.due === 0 && counts.cards.learnLater.length === 0;
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
$('file-apkg').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const status = $('import-status');
  status.classList.remove('hidden');
  try {
    const res = await importApkg(file, (msg) => { status.textContent = msg; });
    const names = res.decks.map(d => `${d.name} (${d.cards})`).join(', ');
    status.textContent = `Imported: ${names}` + (res.warnings.length ? ` — ${res.warnings.join(' ')}` : '');
    await showDecks();
    status.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    status.textContent = `Import failed: ${err.message}`;
  }
};

$('btn-export').onclick = async () => {
  toast('Preparing backup…');
  const zip = new JSZip();
  const data = {};
  for (const s of ['decks', 'models', 'notes', 'cards', 'reviews', 'meta']) data[s] = await db.getAll(s);
  data.version = VERSION;
  zip.file('data.json', JSON.stringify(data));
  for (const m of await db.getAll('media')) zip.file(`media/${m.name}`, m.blob);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  download(blob, `cards-backup-${new Date().toISOString().slice(0, 10)}.zip`);
};

$('file-backup').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!confirm('Restore this backup? Existing data with the same ids will be overwritten.')) return;
  try {
    const zip = await JSZip.loadAsync(file);
    const data = JSON.parse(await zip.file('data.json').async('string'));
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
};
$('file-backup').accept = '.zip,application/zip';

// ---------------------------------------------------------------- study
let study = null; // { deckId, queue state, current card, rendered }
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
    newBudget: counts.new,
    revBudget: counts.due,
    card: null,
    models: new Map((await db.getAll('models')).map(m => [m.id, m])),
  };
  show('study', currentDeck.name);
  $('study-done').classList.add('hidden');
  $('card-host').classList.remove('hidden');
  $('btn-show').classList.remove('hidden');
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

async function nextCard() {
  const card = pickNext();
  updateStudyCounts();
  if (!card) return finishStudy();
  study.card = card;
  const note = await db.get('notes', card.noteId);
  const model = note && study.models.get(note.modelId);
  if (!note || !model) { toast('Skipping card with missing note'); return nextCard(); }
  // Preload media blobs referenced by this note.
  const names = new Set();
  for (const f of note.fields) {
    for (const m of f.matchAll(/src="([^"]+)"/g)) names.add(decodeURIComponent(m[1]));
    for (const m of f.matchAll(/\[sound:([^\]]+)\]/g)) names.add(m[1]);
  }
  await Promise.all([...names].map(getBlobCached));
  study.rendered = renderCard({ note, model, card, deckName: currentDeck.name, getBlob: (n) => mediaCache.get(n) || null });
  mount($('card-host'), study.rendered.front, study.rendered.css, { nightMode: isDark() });
  $('grade').classList.add('hidden');
  $('btn-show').classList.remove('hidden');
}

function updateStudyCounts() {
  $('s-new').textContent = study.newCards.length;
  $('s-learn').textContent = study.learn.length;
  $('s-due').textContent = study.due.length;
}

function showAnswer() {
  if (!study?.card || !$('grade').classList.contains('hidden')) return;
  mount($('card-host'), study.rendered.back, study.rendered.css, { nightMode: isDark() });
  const iv = sched.previewIntervals(study.card, settings);
  for (const g of [1, 2, 3, 4]) $(`iv-${g}`).textContent = iv[g];
  $('btn-show').classList.add('hidden');
  $('grade').classList.remove('hidden');
}
$('btn-show').onclick = showAnswer;

async function grade(g) {
  if (!study?.card || $('grade').classList.contains('hidden')) return;
  const before = study.card;
  const after = sched.answer(before, g, settings);
  await db.put('cards', after);
  await db.put('reviews', { cardId: after.id, deckId: after.deckId, grade: g, at: after.lastReview, ivl: after.ivl, ease: after.ease, state: before.state });
  if (before.state === 'new') await bumpDaily(after.deckId, 'new');
  else if (before.state === 'review') await bumpDaily(after.deckId, 'rev');
  if (after.state === 'learn' || after.state === 'relearn') study.learn.push(after);
  await nextCard();
}
for (const b of document.querySelectorAll('#grade button')) b.onclick = () => grade(Number(b.dataset.grade));

function finishStudy() {
  $('card-host').classList.add('hidden');
  $('btn-show').classList.add('hidden');
  $('grade').classList.add('hidden');
  $('study-done').classList.remove('hidden');
  const pending = study?.learn?.length || 0;
  $('study-done-msg').textContent = pending
    ? `${pending} learning card${pending > 1 ? 's' : ''} will be due again in ${sched.fmtDelta(study.learn[0].due - Date.now())}.`
    : 'No more cards are due in this deck right now.';
  releaseMediaUrls();
}
$('btn-done-back').onclick = showDecks;

document.addEventListener('keydown', (e) => {
  if (current !== 'study' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); $('grade').classList.contains('hidden') ? showAnswer() : grade(3); }
  else if (/^[1-4]$/.test(e.key)) grade(Number(e.key));
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
    info.textContent = `Using ${(usage / 1048576).toFixed(1)} MB of ${(quota / 1048576).toFixed(0)} MB. Persistent storage: ${persisted ? 'granted' : 'not granted'}.`;
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

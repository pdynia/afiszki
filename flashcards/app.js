import * as db from './db.js';
import { importApkg, exportDeck } from './apkg.js';
import * as sched from './scheduler.js';
import { renderCard, mount, releaseMediaUrls } from './render.js';
import { t, setLang, detectLang, lang as currentLang } from './i18n.js';
import { HELP } from './help.js';
import { clozeNumbers } from './render.js';
import * as syncer from './sync.js';

export const VERSION = '0.8.3';
const $ = (id) => document.getElementById(id);
const DAY = 86400000;

// ---------------------------------------------------------------- settings
let settings = { ...sched.DEFAULTS, theme: 'auto', lang: 'auto' };
async function loadSettings() {
  settings = { ...settings, ...(await db.getMeta('settings', {})) };
  applyTheme();
  applyLang();
}
function applyTheme() {
  const root = document.documentElement;
  if (settings.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = settings.theme;
}
function applyLang() {
  setLang(settings.lang === 'auto' ? detectLang() : settings.lang);
}
function isDark() {
  return settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

// ---------------------------------------------------------------- navigation
const views = ['decks', 'deck', 'study', 'settings', 'help', 'editor', 'browser', 'stats', 'notetypes', 'template'];
let current = 'decks';
let previous = 'decks';
let currentDeck = null;
function show(view, title) {
  previous = current;
  current = view;
  for (const v of views) $(`view-${v}`).classList.toggle('hidden', v !== view);
  $('title').textContent = title;
  $('btn-back').classList.toggle('hidden', view === 'decks');
  $('btn-settings').classList.toggle('hidden', view !== 'decks');
  $('btn-help').classList.toggle('hidden', view !== 'decks');
  $('btn-more').classList.toggle('hidden', view !== 'decks');
  $('btn-undo').classList.toggle('hidden', view !== 'study');
  $('btn-edit-card').classList.toggle('hidden', view !== 'study');
  $('btn-study-more').classList.toggle('hidden', view !== 'study');
  $('study-progress').classList.toggle('hidden', view !== 'study');
  window.scrollTo(0, 0);
}
$('btn-back').onclick = () => {
  if (current === 'study') { releaseMediaUrls(); return openDeck(currentDeck.id); }
  if (current === 'help' && previous === 'settings') return openSettings();
  if (current === 'editor') return editorReturn();
  if (current === 'browser' || current === 'stats') return openDeck(currentDeck.id);
  if (current === 'notetypes') return openSettings();
  if (current === 'template') return openNoteTypes();
  return showDecks();
};
$('btn-settings').onclick = openSettings;
$('btn-help').onclick = openHelp;
$('btn-empty-help').onclick = openHelp;
$('btn-settings-help').onclick = openHelp;

function openHelp() {
  show('help', t('app.help'));
  $('help-body').innerHTML = HELP[document.documentElement.lang] || HELP.en;
}

let toastTimer;
function toast(msg, ms = 2500) {
  const el = $('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// ---------------------------------------------------------------- daily limits & stats
const dailyKey = (deckId) => `daily:${deckId}:${sched.dayKey()}`;
async function getDaily(deckId) { return db.getMeta(dailyKey(deckId), { new: 0, rev: 0 }); }
async function bumpDaily(deckId, field, delta = 1) {
  const d = await getDaily(deckId);
  d[field] = Math.max(0, (d[field] || 0) + delta);
  await db.setMeta(dailyKey(deckId), d);
}

// A deck id is its full name; "A::B" lives under "A". These helpers include sub-decks.
const inDeck = (rowDeckId, deckId) => deckId === '' || rowDeckId === deckId || rowDeckId.startsWith(deckId + '::');
async function cardsIn(deckId) { return (await db.getAll('cards')).filter(c => inDeck(c.deckId, deckId)); }
async function notesIn(deckId) { return (await db.getAll('notes')).filter(n => inDeck(n.deckId, deckId)); }
async function reviewsIn(deckId) { return (await db.getAll('reviews')).filter(r => inDeck(r.deckId, deckId)); }

async function deckCounts(deckId, cards) {
  cards = cards || await cardsIn(deckId);
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
  if (!days.has(d)) d -= DAY;
  while (days.has(d)) { n++; d -= DAY; }
  return n;
}

// ---------------------------------------------------------------- deck list
let collapsed = null;
const DECK_COLORS = ['#4A6FA5', '#A35139', '#388E3C', '#B05A7A', '#6E63A8', '#D98F3A', '#3F8F8F'];
function deckColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return DECK_COLORS[h % DECK_COLORS.length];
}
async function showDecks() {
  show('decks', t('app.decks'));
  const decks = (await db.getAll('decks')).sort((a, b) => a.name.localeCompare(b.name));
  const list = $('deck-list');
  list.innerHTML = '';
  $('empty-state').classList.toggle('hidden', decks.length > 0);
  $('hero').classList.toggle('hidden', decks.length === 0);
  let totalDue = 0, totalCards = 0;
  // Build the tree: every "A::B::C" implies groups "A" and "A::B".
  const allCards = await db.getAll('cards');
  const ids = new Set(decks.map(d => d.id));
  for (const d of decks) { const parts = d.id.split('::'); for (let i = 1; i < parts.length; i++) ids.add(parts.slice(0, i).join('::')); }
  const rows = [...ids].sort((a, b) => a.localeCompare(b)).map(id => ({ id, name: id.split('::').pop(), depth: id.split('::').length - 1, virtual: !decks.some(d => d.id === id) }));
  collapsed = collapsed || new Set();
  for (const d of rows) {
    const parent = d.id.includes('::') ? d.id.slice(0, d.id.lastIndexOf('::')) : null;
    if (parent && [...collapsed].some(c => inDeck(d.id, c) && d.id !== c)) continue;
    const counts = await deckCounts(d.id, allCards.filter(c => inDeck(c.deckId, d.id)));
    if (!parent) { totalDue += counts.new + counts.learn + counts.due; totalCards += counts.total; }
    const pct = counts.total ? Math.round(100 * counts.learned / counts.total) : 0;
    const hasKids = rows.some(r => r.id !== d.id && inDeck(r.id, d.id));
    const b = document.createElement('button');
    b.className = 'deck' + (d.depth ? ' child' : '');
    b.style.marginLeft = `${d.depth * 18}px`;
    b.innerHTML = `
      <span class="icon ${hasKids ? 'group' : ''}" style="background:${deckColor(d.id)}">${hasKids ? (collapsed.has(d.id) ? '▸' : '▾') : ([...d.name.trim()][0]?.toUpperCase() || '?')}</span>
      <span class="name"></span>
      <svg class="chev"><use href="#i-chev"/></svg>
      <span class="meta">
        <span class="tag new ${counts.new ? '' : 'zero'}"><i></i>${t('deck.tag_new', { n: counts.new })}</span>
        <span class="tag learn ${counts.learn ? '' : 'zero'}"><i></i>${t('deck.tag_learn', { n: counts.learn })}</span>
        <span class="tag due ${counts.due ? '' : 'zero'}"><i></i>${t('deck.tag_due', { n: counts.due })}</span>
        <span>${t('deck.meta', { n: counts.total, pct })}</span>
      </span>
      <span class="bar"><i style="width:${pct}%"></i></span>`;
    b.querySelector('.name').textContent = d.name;
    b.onclick = () => openDeck(d.id);
    if (hasKids) b.querySelector('.icon').onclick = (e) => { e.stopPropagation(); collapsed.has(d.id) ? collapsed.delete(d.id) : collapsed.add(d.id); showDecks(); };
    list.appendChild(b);
  }
  $('deck-summary').textContent = decks.length ? t('decks.summary', { n: decks.length, cards: totalCards }) : '';
  if (decks.length) {
    const reviews = await db.getAll('reviews');
    const today = sched.dayStart();
    $('hero-due').textContent = totalDue;
    $('hero-sub').textContent = totalDue ? t('hero.waiting') : t('hero.caught_up');
    $('hero-done').textContent = reviews.filter(r => r.at >= today).length;
    $('hero-streak').textContent = streak(reviews);
  }
}

async function openDeck(id) {
  currentDeck = await db.get('decks', id);
  if (!currentDeck) {
    const kids = (await db.getAll('decks')).filter(d => inDeck(d.id, id) && d.id !== id);
    if (!kids.length) return showDecks();
    currentDeck = { id, name: id, virtual: true, kids: kids.length };
  }
  show('deck', t('app.deck'));
  $('deck-name').textContent = currentDeck.name;
  for (const b of ['btn-add-card', 'btn-deck-rename', 'btn-deck-delete', 'btn-deck-export']) $(b).classList.toggle('hidden', !!currentDeck.virtual);
  const counts = await deckCounts(id);
  $('c-new').textContent = counts.new;
  $('c-learn').textContent = counts.learn;
  $('c-due').textContent = counts.due;
  $('deck-total').textContent = (currentDeck.virtual ? t('deck.group', { n: currentDeck.kids }) + ' · ' : '') + t('deck.total', { n: counts.total, learned: counts.learned });
  const pct = counts.total ? counts.learned / counts.total : 0;
  $('ring-pct').textContent = `${Math.round(pct * 100)}%`;
  requestAnimationFrame(() => { $('ring-fg').style.strokeDashoffset = String(326.7 * (1 - pct)); });
  const reviews = await reviewsIn(id);
  const buckets = reviewsPerDay(reviews);
  const max = Math.max(1, ...buckets.map(b => b.count));
  const locale = document.documentElement.lang;
  $('hist').innerHTML = buckets.map(b =>
    `<div><i class="${b.count ? '' : 'zero'}" style="height:${Math.max(4, Math.round(52 * b.count / max))}px" title="${b.count}"></i><span>${new Date(b.day).toLocaleDateString(locale, { weekday: 'narrow' })}</span></div>`).join('');
  const week = buckets.reduce((s, b) => s + b.count, 0);
  $('hist-total').textContent = t('deck.reviews', { n: week });
  const nothing = counts.new + counts.cards.learn.length + counts.due === 0 && counts.cards.learnLater.length === 0;
  $('btn-study').disabled = nothing;
  $('btn-study').textContent = nothing ? t('btn.nothing_due') : t('btn.study_n', { n: counts.new + counts.learn + counts.due });
}

$('btn-study').onclick = () => startStudy(currentDeck.id);
$('btn-custom').onclick = async () => {
  const tags = new Set();
  for (const n of await notesIn(currentDeck.id)) for (const tg of n.tags || []) tags.add(tg);
  $('cs-tag').innerHTML = '<option value="">—</option>' + [...tags].sort().map(x => `<option>${x.replace(/</g, '&lt;')}</option>`).join('');
  $('sheet-custom').classList.remove('hidden');
};
$('sheet-custom').querySelector('.sheet-backdrop').onclick = () => $('sheet-custom').classList.add('hidden');
$('cs-cancel').onclick = () => $('sheet-custom').classList.add('hidden');
$('cs-start').onclick = () => {
  $('sheet-custom').classList.add('hidden');
  startStudy(currentDeck.id, { tag: $('cs-tag').value, flag: $('cs-flag').checked, hard: $('cs-hard').checked,
    ahead: Number($('cs-ahead').value) || 0, extraNew: Number($('cs-new').value) || 0, nolimit: $('cs-nolimit').checked });
};
$('btn-stats').onclick = () => openStats(currentDeck.id);
$('btn-add-card').onclick = () => openEditor({ deckId: currentDeck.id, back: () => openDeck(currentDeck.id) });
$('btn-browse').onclick = () => openBrowser();
$('btn-br-add').onclick = () => openEditor({ deckId: currentDeck.id, back: () => openBrowser() });
$('btn-new-deck').onclick = async () => {
  const name = (prompt(t('prompt.deck_name')) || '').trim();
  if (!name) return;
  if (await db.get('decks', name)) return toast(t('toast.deck_exists'));
  await db.put('decks', { id: name, name, created: Date.now(), mod: Date.now() });
  await openDeck(name);
};
$('btn-deck-rename').onclick = async () => {
  const name = (prompt(t('prompt.rename'), currentDeck.name) || '').trim();
  if (!name || name === currentDeck.name) return;
  if (await db.get('decks', name)) return toast(t('toast.deck_exists'));
  // Deck id doubles as its name, so move every row to the new id.
  const old = currentDeck.id;
  const notes = await db.getAllByIndex('notes', 'deckId', old);
  const cards = await db.getAllByIndex('cards', 'deckId', old);
  const reviews = await db.getAllByIndex('reviews', 'deckId', old);
  await db.putMany('notes', notes.map(n => ({ ...n, deckId: name })));
  await db.putMany('cards', cards.map(c => ({ ...c, deckId: name })));
  await db.putMany('reviews', reviews.map(r => ({ ...r, deckId: name })));
  await db.put('decks', { ...currentDeck, id: name, name, mod: Date.now() });
  await db.del('decks', old);
  const daily = await getDaily(old);
  await db.setMeta(dailyKey(name), daily);
  await openDeck(name);
};
$('btn-deck-delete').onclick = async () => {
  if (!confirm(t('confirm.delete_deck', { name: currentDeck.name }))) return;
  await db.deleteDeckData(currentDeck.id);
  toast(t('toast.deleted'));
  showDecks();
};
$('btn-deck-export').onclick = async () => {
  toast(t('toast.exporting'));
  try {
    const blob = await exportDeck(currentDeck.id);
    download(blob, `${currentDeck.name.replace(/[^\w.-]+/g, '_')}.apkg`);
  } catch (e) { console.error(e); toast(t('toast.export_failed', { e: e.message }), 5000); }
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
  status.textContent = t('import.reading');
  if (current !== 'decks') showDecks();
  try {
    const res = await importApkg(file, (msg) => { status.textContent = msg; }, t);
    const names = res.decks.map(d => `${d.name} (${t('import.cards', { n: d.cards })})`).join(', ');
    await showDecks();
    syncer.sync().catch(() => {});
    status.className = 'status ok';
    status.textContent = t('import.done', { names }) + (res.warnings.length ? ` — ${res.warnings.join(' ')}` : '');
  } catch (err) {
    console.error(err);
    status.className = 'status err';
    status.textContent = t('import.failed', { e: err.message });
  }
}
$('file-apkg').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };

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
  toast(t('toast.backup'));
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
  if (!confirm(t('confirm.restore'))) return;
  try {
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file('data.json');
    if (!entry) throw new Error(t('import.not_backup'));
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
    toast(t('toast.restored'));
    showDecks();
  } catch (err) { console.error(err); toast(t('toast.restore_failed', { e: err.message }), 5000); }
}
$('file-backup').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreBackup(f); };
$('btn-export').onclick = backupAll;
$('btn-restore').onclick = () => $('file-backup').click();

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
  if (!mediaCache.has(name)) {
    let blob = (await db.get('media', name))?.blob || null;
    if (!blob && syncer.state.user) blob = await syncer.fetchMedia(name);
    mediaCache.set(name, blob);
  }
  return mediaCache.get(name);
}

async function startStudy(deckId, opts = null) {
  let cards = await cardsIn(deckId);
  if (opts) {
    if (opts.tag) { const ok = new Set((await notesIn(deckId)).filter(n => (n.tags || []).includes(opts.tag)).map(n => n.id)); cards = cards.filter(c => ok.has(c.noteId)); }
    if (opts.flag) cards = cards.filter(c => c.flag > 0);
    if (opts.hard) cards = cards.filter(c => (c.lapses || 0) >= 2);
    if (opts.ahead > 0) { const limit = sched.dayEnd() + opts.ahead * DAY; cards = cards.map(c => c.state === 'review' && c.due < limit ? { ...c, due: Math.min(c.due, sched.dayEnd() - 1) } : c); }
  }
  const counts = await deckCounts(deckId, cards);
  const c = counts.cards;
  const nolimit = opts?.nolimit;
  const newN = opts ? (nolimit ? c.newCards.length : Math.min(c.newCards.length, counts.new + (opts.extraNew || 0))) : counts.new;
  study = {
    deckId, custom: !!opts,
    learn: [...c.learn, ...c.learnLater],
    due: nolimit ? c.due : c.due.slice(0, counts.due),
    newCards: c.newCards.slice(0, newN),
    card: null,
    models: new Map((await db.getAll('models')).map(m => [m.id, m])),
    startedAt: Date.now(),
    answered: 0, again: 0,
    history: [],
  };
  study.planned = study.learn.length + study.due.length + study.newCards.length;
  show('study', currentDeck.name);
  $('study-done').classList.add('hidden');
  $('card-wrap').classList.remove('hidden');
  $('btn-show').classList.remove('hidden');
  $('btn-undo').disabled = true;
  if (!study.learn.length && !study.due.length && !study.newCards.length && opts) { toast(t('cs.empty')); return openDeck(deckId); }
  await nextCard();
}

function pickNext() {
  const now = Date.now();
  study.learn.sort((a, b) => a.due - b.due);
  if (study.learn.length && study.learn[0].due <= now) return study.learn.shift();
  if (study.due.length) return study.due.shift();
  if (study.newCards.length) return study.newCards.shift();
  if (study.learn.length && study.learn[0].due <= now + 20 * 60000) return study.learn.shift();
  return null;
}

async function showCard(card) {
  study.card = card;
  const note = await db.get('notes', card.noteId);
  const model = note && study.models.get(note.modelId);
  if (!note || !model) { toast(t('toast.missing_note')); return nextCard(); }
  const names = new Set();
  for (const f of note.fields) {
    for (const m of f.matchAll(/src="([^"]+)"/g)) names.add(decodeURIComponent(m[1]));
    for (const m of f.matchAll(/\[sound:([^\]]+)\]/g)) names.add(m[1]);
  }
  await Promise.all([...names].map(getBlobCached));
  study.rendered = renderCard({ note, model, card, deckName: currentDeck.name, getBlob: (n) => mediaCache.get(n) || null });
  const host = $('card-host');
  host.classList.remove('answer');
  mount(host, study.rendered.front, study.rendered.css, { nightMode: isDark() });
  $('card-hint').textContent = t('study.tap');
  $('grade').classList.add('hidden');
  $('btn-show').classList.remove('hidden');
  study.shownAt = Date.now();
  updateFlagDot();
  // type-the-answer
  study.expected = settings.typeAnswer ? expectedAnswer(note, model, card) : null;
  $('type-wrap').classList.toggle('hidden', !study.expected);
  $('type-result').classList.add('hidden');
  if (study.expected) { $('type-input').value = ''; $('card-hint').textContent = ''; setTimeout(() => $('type-input').focus(), 50); }
  startTimer();
  if (settings.autoplay !== false) autoplay(host, 'front');
}

function updateFlagDot() {
  const f = study?.card?.flag || 0;
  const el = $('flag-dot');
  el.className = 'flagdot' + (f ? ` flag${f}` : ' hidden');
}

// Expected answer for typing: cloze answers of this card, else the first field used on the back but not the front.
function expectedAnswer(note, model, card) {
  const strip = (h) => { const d = document.createElement('div'); d.innerHTML = (h || '').replace(/\[sound:[^\]]+\]/g, '').replace(/<br\s*\/?>/gi, ' '); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
  if (model.type === 1) {
    const ord = card.ord + 1;
    const ans = [...(note.fields[0] || '').matchAll(/\{\{c(\d+)::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g)].filter(m => Number(m[1]) === ord).map(m => strip(m[2]));
    return ans.length ? ans.join(' / ') : null;
  }
  const tpl = model.tmpls[card.ord] || model.tmpls[0];
  const names = (f) => new Set([...f.matchAll(/\{\{(?:[^}:]+:)?([^}]+)\}\}/g)].map(m => m[1].trim()));
  const front = names(tpl.qfmt);
  for (const name of names(tpl.afmt)) {
    if (name === 'FrontSide' || front.has(name)) continue;
    const i = model.flds.findIndex(f => f.name === name);
    if (i >= 0) { const v = strip(note.fields[i]); if (v) return v; }
  }
  return null;
}

// Character-level diff (LCS) rendered as HTML.
function diffHtml(typed, expected) {
  const a = [...typed], b = [...expected];
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i].toLowerCase() === b[j].toLowerCase() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0, out = '';
  const esc = (c) => c === '<' ? '&lt;' : c === '&' ? '&amp;' : c;
  while (i < n || j < m) {
    if (i < n && j < m && a[i].toLowerCase() === b[j].toLowerCase()) { out += `<span class="ok">${esc(b[j])}</span>`; i++; j++; }
    else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { out += `<span class="miss">${esc(b[j])}</span>`; j++; }
    else { out += `<span class="bad">${esc(a[i])}</span>`; i++; }
  }
  return out;
}
function checkTyped() {
  if (!study?.expected) return;
  const typed = $('type-input').value.trim();
  const norm = (x) => x.toLowerCase().replace(/[\s.,;:!?'"()\-]/g, '');
  const correct = norm(typed) === norm(study.expected);
  const res = $('type-result');
  res.className = 'type-result' + (correct ? ' correct' : '');
  res.innerHTML = correct ? `<span class="ok">✓ ${diffHtml(typed, study.expected)}</span>` : `${diffHtml(typed, study.expected)}<span class="exp">${study.expected.replace(/</g, '&lt;')}</span>`;
  res.classList.remove('hidden');
  $('type-wrap').classList.add('hidden');
  study.typedCorrect = correct;
  showAnswer();
}
$('btn-type-check').onclick = checkTyped;
$('type-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); checkTyped(); } });

// Per-card time limit
let timerHandle = null;
function startTimer() {
  clearTimer();
  const limit = Number(settings.timeLimit) || 0;
  const bar = $('timer-bar');
  if (!limit) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const fill = bar.firstElementChild;
  fill.style.transition = 'none'; fill.style.width = '100%';
  requestAnimationFrame(() => { fill.style.transition = `width ${limit}s linear`; fill.style.width = '0%'; });
  timerHandle = setTimeout(() => { if (current === 'study' && $('grade').classList.contains('hidden')) showAnswer(); }, limit * 1000);
}
function clearTimer() { if (timerHandle) clearTimeout(timerHandle); timerHandle = null; $('timer-bar').classList.add('hidden'); }

function autoplay(host, side) {
  const audios = [...host.shadowRoot.querySelectorAll('audio')];
  if (!audios.length) return;
  const skip = side === 'back' ? new Set(study.frontAudio || []) : new Set();
  const el = audios.find(a => !skip.has(a.getAttribute('src')));
  if (side === 'front') study.frontAudio = audios.map(a => a.getAttribute('src'));
  if (el) el.play().catch(() => {});
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
  if (study.expected && !$('type-wrap').classList.contains('hidden')) return checkTyped();
  clearTimer();
  const host = $('card-host');
  host.classList.add('answer');
  mount(host, study.rendered.back, study.rendered.css, { nightMode: isDark() });
  if (settings.autoplay !== false) autoplay(host, 'back');
  const iv = sched.previewIntervals(study.card, settings);
  for (const g of [1, 2, 3, 4]) $(`iv-${g}`).textContent = iv[g];
  $('card-hint').textContent = t('study.how_well');
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
  const reviewId = await db.put('reviews', { id: newGuid(), cardId: after.id, deckId: after.deckId, grade: g, at: after.lastReview, ivl: after.ivl, ease: after.ease, state: before.state, ms: Math.min(120000, Date.now() - (study.shownAt || Date.now())) });
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
  clearTimer();
  $('card-wrap').classList.add('hidden');
  $('btn-show').classList.add('hidden');
  $('grade').classList.add('hidden');
  $('study-done').classList.remove('hidden');
  $('study-progress-bar').style.width = '100%';
  const pending = study?.learn?.length || 0;
  $('study-done-msg').textContent = pending
    ? t('done.pending', { n: pending, t: sched.fmtDelta(study.learn[0].due - Date.now()) })
    : t('done.none');
  $('sum-count').textContent = study.answered;
  $('sum-acc').textContent = study.answered ? `${Math.round(100 * (study.answered - study.again) / study.answered)}%` : '–';
  $('sum-time').textContent = sched.fmtDelta(Math.max(60000, Date.now() - study.startedAt));
  releaseMediaUrls();
  syncer.sync().catch(() => {});
}
$('btn-done-back').onclick = showDecks;

// Study "more" sheet: flag, suspend, bury
const sheetStudy = $('sheet-study');
const closeStudySheet = () => sheetStudy.classList.add('hidden');
$('btn-study-more').onclick = () => {
  if (!study?.card) return;
  $('ss-flag').querySelector('span').textContent = study.card.flag ? t('study.unflag') : t('study.flag');
  sheetStudy.classList.remove('hidden');
};
sheetStudy.querySelector('.sheet-backdrop').onclick = closeStudySheet;
$('ss-cancel').onclick = closeStudySheet;
$('ss-flag').onclick = async () => {
  closeStudySheet();
  const c = study.card;
  c.flag = ((c.flag || 0) + 1) % 5;
  await db.put('cards', c);
  updateFlagDot();
};
async function removeCurrent(patch, msg) {
  closeStudySheet();
  const c = { ...study.card, ...patch };
  await db.put('cards', c);
  toast(t(msg));
  study.card = null;
  await nextCard();
}
$('ss-suspend').onclick = () => removeCurrent({ suspended: true }, 'toast.suspended');
$('ss-bury').onclick = () => removeCurrent({ buriedUntil: sched.dayEnd() }, 'toast.buried');

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') { closeSheet(); closeStudySheet(); $('sheet-custom').classList.add('hidden'); return; }
  if (current !== 'study' || e.target.matches('input, select, textarea')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); $('grade').classList.contains('hidden') ? showAnswer() : grade(3); }
  else if (/^[1-4]$/.test(e.key)) grade(Number(e.key));
  else if (e.key === 'z' || e.key === 'Backspace') { e.preventDefault(); undo(); }
});

// ---------------------------------------------------------------- card editor
const BUILTIN_CSS = '.card { font-family: arial; font-size: 20px; text-align: center; color: black; background: white; }';
const BUILTIN = {
  basic: { id: '1607392319001', name: 'Basic', type: 0, css: BUILTIN_CSS,
    flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
    tmpls: [{ name: 'Card 1', ord: 0, qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr id=answer>{{Back}}' }] },
  reversed: { id: '1607392319002', name: 'Basic (and reversed card)', type: 0, css: BUILTIN_CSS,
    flds: [{ name: 'Front', ord: 0 }, { name: 'Back', ord: 1 }],
    tmpls: [{ name: 'Card 1', ord: 0, qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr id=answer>{{Back}}' },
            { name: 'Card 2', ord: 1, qfmt: '{{Back}}', afmt: '{{FrontSide}}<hr id=answer>{{Front}}' }] },
  cloze: { id: '1607392319003', name: 'Cloze', type: 1, css: BUILTIN_CSS + ' .cloze { font-weight: bold; color: #A35139; }',
    flds: [{ name: 'Text', ord: 0 }, { name: 'Back Extra', ord: 1 }],
    tmpls: [{ name: 'Cloze', ord: 0, qfmt: '{{cloze:Text}}', afmt: '{{cloze:Text}}<br>{{Back Extra}}' }] },
};
async function ensureModel(key) {
  const m = BUILTIN[key];
  if (!(await db.get('models', m.id))) await db.put('models', m);
  return m;
}
function modelKind(model) {
  if (model.type === 1) return 'cloze';
  return model.tmpls.length > 1 ? 'reversed' : 'basic';
}
const escapeHtml = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Field HTML <-> editor representation { text, images: [name], audios: [name] }
function parseField(html) {
  const images = [], audios = [];
  let rest = (html || '').replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, (m, src) => { images.push(decodeURIComponent(src)); return ''; });
  rest = rest.replace(/\[sound:([^\]]+)\]/g, (m, n) => { audios.push(n); return ''; });
  const d = document.createElement('div');
  d.innerHTML = rest.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>/gi, '\n');
  const kept = rest.replace(/(<br\s*\/?>\s*)+$/i, '').trim();
  return { text: (d.textContent || '').replace(/\n{3,}/g, '\n\n').trim(), html: kept, images, audios };
}
// Keep formatting from the rich editor, drop anything executable.
function sanitizeHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  for (const el of d.querySelectorAll('script, style, iframe, object, embed, link, meta')) el.remove();
  for (const el of d.querySelectorAll('*')) for (const a of [...el.attributes]) {
    if (/^on/i.test(a.name) || (a.name === 'href' && /^\s*javascript:/i.test(a.value))) el.removeAttribute(a.name);
  }
  return d.innerHTML.replace(/(<br\s*\/?>\s*)+$/i, '').replace(/^(<div><br><\/div>)+|(<div><br><\/div>)+$/g, '').trim();
}
function buildField(html, images, audios = []) {
  let out = sanitizeHtml(html);
  for (const n of images) out += `<br><img src="${encodeURIComponent(n)}">`;
  for (const n of audios) out += `[sound:${n}]`;
  return out;
}
const getField = (i) => $(`ed-f${i}`).innerHTML;
const setField = (i, html) => { $(`ed-f${i}`).innerHTML = html || ''; };
const fieldText = (i) => $(`ed-f${i}`).textContent || '';

// Toolbar: execCommand on the field the toolbar belongs to.
for (const tb of document.querySelectorAll('.toolbar')) {
  const field = () => $(tb.dataset.for);
  const run = (cmd, val = null) => { field().focus(); document.execCommand(cmd, false, val); };
  for (const b of tb.querySelectorAll('button[data-cmd]')) { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => run(b.dataset.cmd); }
  tb.querySelector('[data-font]').onchange = (e) => { if (e.target.value) run('fontName', e.target.value); e.target.value = ''; };
  tb.querySelector('[data-size]').onchange = (e) => { if (e.target.value) run('fontSize', e.target.value); e.target.value = ''; };
  tb.querySelector('[data-color]').oninput = (e) => run('foreColor', e.target.value);
  tb.querySelector('[data-hilite]').oninput = (e) => { run('hiliteColor', e.target.value); };
  for (const sel of tb.querySelectorAll('select, input')) sel.onmousedown = (ev) => { ev.stopPropagation(); };
  const cl = tb.querySelector('[data-cloze]');
  cl.onmousedown = (e) => e.preventDefault();
  cl.onclick = () => {
    const f = field();
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed || !f.contains(sel.anchorNode)) return toast(t('ed.select_first'));
    const n = Math.max(0, ...clozeNumbers(f.textContent)) + 1;
    const text = sel.toString();
    run('insertText', `{{c${n}::${text}}}`);
    if (editor && !editor.noteId && editor.kind !== 'cloze' && f.id === 'ed-f1') setEditorKind('cloze');
  };
}
for (const f of document.querySelectorAll('.rte')) {
  f.addEventListener('paste', (e) => {
    // Paste as plain text so foreign styles do not leak in.
    const txt = e.clipboardData?.getData('text/plain');
    if (txt != null) { e.preventDefault(); document.execCommand('insertText', false, txt); }
  });
  f.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const map = { b: 'bold', i: 'italic', u: 'underline' };
    if (map[e.key]) { e.preventDefault(); document.execCommand(map[e.key]); }
  });
}
const newGuid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Shrink photos before storing them; iPad photos are 12 MP otherwise.
async function shrinkImage(file, max = 1280) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 400000) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(b => res(b || file), 'image/jpeg', 0.85));
}

let editor = null; // { deckId, noteId, kind, images: {1:[],2:[]}, audios: {1:[],2:[]}, back }
async function renderAudioChips(i) {
  const box = $(`ed-aud${i}`);
  box.innerHTML = '';
  for (const name of editor.audios[i]) {
    const row = await db.get('media', name);
    const chip = document.createElement('span'); chip.className = 'audio-chip';
    chip.innerHTML = `<svg class="ico" style="width:16px;height:16px"><use href="#i-audio"/></svg><span></span><button type="button" title="play">▶</button><button type="button" aria-label="remove">×</button>`;
    chip.querySelector('span').textContent = name.replace(/^rec-\d+-\w+\./, 'rec.').slice(0, 18);
    const [play, del] = chip.querySelectorAll('button');
    play.onclick = () => { if (row) new Audio(thumbUrl(name, row.blob)).play().catch(() => {}); };
    del.onclick = () => { editor.audios[i] = editor.audios[i].filter(n => n !== name); renderAudioChips(i); };
    box.appendChild(chip);
  }
}
for (const input of document.querySelectorAll('.ed-aud-input')) input.onchange = async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file || !editor) return;
  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
  const name = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await db.put('media', { name, blob: file });
  const i = Number(input.dataset.field);
  editor.audios[i].push(name);
  renderAudioChips(i);
};
let recorder = null;
for (const btn of document.querySelectorAll('.ed-rec')) btn.onclick = async () => {
  const i = Number(btn.dataset.field);
  if (recorder) { recorder.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast(t('ed.mic_failed'));
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(tr => tr.stop());
      recorder = null;
      btn.classList.remove('recording'); btn.querySelector('span').textContent = t('ed.record');
      const type = rec.mimeType || mime || 'audio/webm';
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(chunks, { type });
      if (!blob.size || !editor) return;
      const name = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      await db.put('media', { name, blob });
      editor.audios[i].push(name);
      renderAudioChips(i);
    };
    rec.start();
    recorder = rec;
    btn.classList.add('recording'); btn.querySelector('span').textContent = t('ed.stop');
  } catch (err) { console.error(err); toast(t('ed.mic_failed')); }
};
const edUrls = new Map();
function thumbUrl(name, blob) { if (!edUrls.has(name)) edUrls.set(name, URL.createObjectURL(blob)); return edUrls.get(name); }
async function renderThumbs(i) {
  const box = $(`ed-img${i}`);
  box.innerHTML = '';
  for (const name of editor.images[i]) {
    const row = await db.get('media', name);
    if (!row) continue;
    const d = document.createElement('div'); d.className = 'thumb';
    d.innerHTML = `<img alt=""><button type="button" aria-label="remove">×</button>`;
    d.querySelector('img').src = thumbUrl(name, row.blob);
    d.querySelector('button').onclick = () => { editor.images[i] = editor.images[i].filter(n => n !== name); renderThumbs(i); };
    box.appendChild(d);
  }
}
for (const input of document.querySelectorAll('.ed-img-input')) input.onchange = async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file || !editor) return;
  try {
    const blob = await shrinkImage(file);
    const name = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
    await db.put('media', { name, blob });
    const i = Number(input.dataset.field);
    editor.images[i].push(name);
    renderThumbs(i);
  } catch (err) { console.error(err); toast(t('ed.image_failed')); }
};

function setEditorKind(kind) {
  editor.kind = kind;
  $('ed-f1').dataset.placeholder = kind === 'cloze' ? '{{c1::…}}' : '';
  for (const b of document.querySelectorAll('#ed-type button')) b.classList.toggle('on', b.dataset.type === kind);
  $('ed-l1').textContent = t(kind === 'cloze' ? 'ed.text' : 'ed.front');
  $('ed-l2').textContent = t(kind === 'cloze' ? 'ed.extra' : 'ed.back');
  $('ed-hint').textContent = kind === 'cloze' ? t('ed.hint_cloze') : kind === 'reversed' ? t('ed.hint_reversed') : '';
}
for (const b of document.querySelectorAll('#ed-type button')) b.onclick = () => { if (!editor.noteId) setEditorKind(b.dataset.type); };

async function openEditor({ deckId, noteId = null, back }) {
  editor = { deckId, noteId, kind: 'basic', images: { 1: [], 2: [] }, audios: { 1: [], 2: [] }, back };
  show('editor', t(noteId ? 'ed.title_edit' : 'ed.title'));
  setField(1, ''); setField(2, ''); $('ed-tags').value = '';
  $('btn-ed-delete').classList.toggle('hidden', !noteId);
  $('btn-ed-save-add').classList.toggle('hidden', !!noteId);
  $('ed-type').style.opacity = noteId ? '.5' : '';
  if (noteId) {
    const note = await db.get('notes', noteId);
    const model = await db.get('models', note.modelId);
    editor.kind = modelKind(model);
    const f1 = parseField(note.fields[0]), f2 = parseField(note.fields[1] || '');
    setField(1, f1.html); setField(2, f2.html);
    editor.images = { 1: f1.images, 2: f2.images };
    editor.audios = { 1: f1.audios, 2: f2.audios };
    editor.modelId = note.modelId;
    const cards = await db.getAllByIndex('cards', 'noteId', noteId);
    editor.suspended = cards.length > 0 && cards.every(c => c.suspended);
    $('btn-ed-suspend').textContent = t(editor.suspended ? 'ed.unsuspend' : 'ed.suspend');
    // Notes with more than two fields or rich templates: keep extra fields untouched.
    editor.extraFields = note.fields.slice(2);
    $('ed-tags').value = (note.tags || []).join(', ');
  }
  $('btn-ed-suspend').classList.toggle('hidden', !noteId);
  setEditorKind(editor.kind);
  renderThumbs(1); renderThumbs(2); renderAudioChips(1); renderAudioChips(2);
  setTimeout(() => $('ed-f1').focus(), 50);
}
function editorReturn() {
  for (const u of edUrls.values()) URL.revokeObjectURL(u);
  edUrls.clear();
  const back = editor?.back || (() => showDecks());
  editor = null;
  back();
}

async function saveEditor(addAnother) {
  const text1 = fieldText(1), html1 = getField(1), html2 = getField(2);
  if (!text1.trim() && !editor.images[1].length && !editor.audios[1].length) { toast(t('ed.empty')); return false; }
  if (editor.kind === 'cloze' && !clozeNumbers(text1).length) { toast(t('ed.no_cloze')); return false; }
  const tags = $('ed-tags').value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
  const now = Date.now();
  let modelId = editor.modelId;
  if (!modelId) modelId = (await ensureModel(editor.kind)).id;
  const fields = [buildField(html1, editor.images[1], editor.audios[1]), buildField(html2, editor.images[2], editor.audios[2]), ...(editor.extraFields || [])];
  const noteId = editor.noteId || newGuid();
  await db.put('notes', { id: noteId, deckId: editor.deckId, modelId, fields, tags, mod: now });

  // Which card ordinals should exist for this note?
  const wanted = editor.kind === 'cloze' ? clozeNumbers(text1).map(n => n - 1) : editor.kind === 'reversed' ? [0, 1] : [0];
  const existing = await db.getAllByIndex('cards', 'noteId', noteId);
  const have = new Set(existing.map(c => c.ord));
  const add = wanted.filter(o => !have.has(o)).map(ord => ({ id: `${noteId}:${ord}`, deckId: editor.deckId, noteId, ord, state: 'new', due: 0, ivl: 0, ease: 0, step: 0, reps: 0, lapses: 0, order: now + ord, suspended: false }));
  await db.putMany('cards', add);
  for (const c of existing) if (!wanted.includes(c.ord)) await db.del('cards', c.id);

  toast(t('toast.card_saved'));
  syncer.sync().catch(() => {});
  if (addAnother) {
    editor.noteId = null; editor.modelId = null; editor.extraFields = null; editor.images = { 1: [], 2: [] }; editor.audios = { 1: [], 2: [] };
    setField(1, ''); setField(2, '');
    renderThumbs(1); renderThumbs(2); renderAudioChips(1); renderAudioChips(2);
    $('ed-f1').focus();
  } else editorReturn();
  return true;
}
$('btn-ed-save').onclick = () => saveEditor(false);
$('btn-ed-save-add').onclick = () => saveEditor(true);
$('btn-ed-suspend').onclick = async () => {
  if (!editor?.noteId) return;
  const cards = await db.getAllByIndex('cards', 'noteId', editor.noteId);
  const susp = !editor.suspended;
  await db.putMany('cards', cards.map(c => ({ ...c, suspended: susp })));
  editor.suspended = susp;
  $('btn-ed-suspend').textContent = t(susp ? 'ed.unsuspend' : 'ed.suspend');
  toast(t(susp ? 'toast.suspended' : 'toast.unsuspended'));
};
$('btn-ed-delete').onclick = async () => {
  if (!editor?.noteId || !confirm(t('confirm.delete_card'))) return;
  const cards = await db.getAllByIndex('cards', 'noteId', editor.noteId);
  for (const c of cards) await db.del('cards', c.id);
  await db.del('notes', editor.noteId);
  toast(t('toast.card_deleted'));
  editorReturn();
};
$('btn-edit-card').onclick = () => {
  if (!study?.card) return;
  const card = study.card;
  openEditor({ deckId: card.deckId, noteId: card.noteId, back: async () => {
    // Re-render the current card with the edited note; drop it if it was deleted.
    show('study', currentDeck.name);
    const fresh = await db.get('cards', card.id);
    if (!fresh) return nextCard();
    study.card = fresh;
    await showCard(fresh);
  } });
};

// ---------------------------------------------------------------- card browser
let browserNotes = [];
async function openBrowser() {
  show('browser', t('br.title'));
  $('br-search').value = '';
  const notes = await notesIn(currentDeck.id);
  const cards = await cardsIn(currentDeck.id);
  const info = new Map();
  const end = sched.dayEnd();
  for (const c of cards) {
    const i = info.get(c.noteId) || { rank: 9, flag: 0, susp: true, due: false };
    const rank = { new: 0, learn: 1, relearn: 1, review: 2 }[c.state] ?? 0;
    i.rank = Math.min(i.rank, rank); i.flag = Math.max(i.flag, c.flag || 0); i.susp = i.susp && !!c.suspended;
    i.due = i.due || (!c.suspended && c.state !== 'new' && c.due < end);
    info.set(c.noteId, i);
  }
  browserNotes = notes.map(n => {
    const f1 = parseField(n.fields[0]), f2 = parseField(n.fields[1] || '');
    const i = info.get(n.id) || { rank: 0, flag: 0, susp: false, due: false };
    return { id: n.id, q: f1.text || (f1.images.length ? '🖼' : f1.audios.length ? '🔊' : ''), a: f2.text, state: ['new', 'learn', 'review'][i.rank] || 'new', flag: i.flag, susp: i.susp, due: i.due, mod: n.mod || 0, tags: n.tags || [] };
  }).sort((a, b) => b.mod - a.mod);
  browserFilter = 'all';
  for (const b of document.querySelectorAll('#br-filter button')) b.classList.toggle('on', b.dataset.f === 'all');
  renderBrowser();
}
let browserFilter = 'all';
for (const b of document.querySelectorAll('#br-filter button')) b.onclick = () => {
  browserFilter = b.dataset.f;
  for (const x of document.querySelectorAll('#br-filter button')) x.classList.toggle('on', x === b);
  renderBrowser();
};
function renderBrowser() {
  const q = $('br-search').value.trim().toLowerCase();
  let rows = q ? browserNotes.filter(n => (n.q + ' ' + n.a + ' ' + n.tags.join(' ')).toLowerCase().includes(q)) : browserNotes;
  if (browserFilter === 'new') rows = rows.filter(n => n.state === 'new' && !n.susp);
  else if (browserFilter === 'due') rows = rows.filter(n => n.due);
  else if (browserFilter === 'flag') rows = rows.filter(n => n.flag > 0);
  else if (browserFilter === 'susp') rows = rows.filter(n => n.susp);
  $('br-count').textContent = t('br.count', { n: rows.length });
  const list = $('br-list');
  list.innerHTML = '';
  if (!rows.length) { list.innerHTML = `<p class="muted center">${t('br.empty')}</p>`; return; }
  for (const n of rows.slice(0, 300)) {
    const b = document.createElement('button');
    b.className = 'note-row' + (n.susp ? ' susp' : '');
    b.innerHTML = `<span class="q"></span><span class="st ${n.susp ? '' : n.state}">${t(n.susp ? 'st.susp' : 'st.' + n.state)}</span><span class="a"></span>${n.flag ? `<i class="fl flag${n.flag}"></i>` : ''}`;
    b.querySelector('.q').textContent = n.q;
    b.querySelector('.a').textContent = n.a;
    b.onclick = () => openEditor({ deckId: currentDeck.id, noteId: n.id, back: () => openBrowser() });
    list.appendChild(b);
  }
}
$('br-search').oninput = renderBrowser;

// ---------------------------------------------------------------- settings view
async function openSettings() {
  show('settings', t('app.settings'));
  $('set-new-per-day').value = settings.newPerDay;
  $('set-rev-per-day').value = settings.revPerDay;
  $('set-steps').value = settings.learnSteps.join(', ');
  $('set-algo').value = settings.algorithm || 'fsrs';
  $('set-retention').value = Math.round((settings.retention || 0.9) * 100);
  $('row-retention').classList.toggle('hidden', $('set-algo').value !== 'fsrs');
  $('set-theme').value = settings.theme;
  $('set-lang').value = settings.lang;
  $('set-type').value = settings.typeAnswer ? '1' : '0';
  $('set-autoplay').value = settings.autoplay === false ? '0' : '1';
  $('set-timelimit').value = Number(settings.timeLimit) || 0;
  $('settings-footer').textContent = t('set.footer', { v: VERSION });
  renderSyncUI();
  const info = $('storage-info');
  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    info.textContent = t('set.storage', { used: (usage / 1048576).toFixed(1), quota: (quota / 1048576).toFixed(0), state: t(persisted ? 'set.granted' : 'set.not_granted') });
  } else info.textContent = t('set.storage_na');
}
$('btn-settings-save').onclick = async () => {
  settings.newPerDay = Math.max(0, Number($('set-new-per-day').value) || 0);
  settings.revPerDay = Math.max(0, Number($('set-rev-per-day').value) || 0);
  const steps = $('set-steps').value.split(/[,\s]+/).map(Number).filter(n => n > 0);
  settings.learnSteps = steps.length ? steps : [1, 10];
  settings.algorithm = $('set-algo').value;
  settings.retention = Math.min(0.97, Math.max(0.7, (Number($('set-retention').value) || 90) / 100));
  settings.theme = $('set-theme').value;
  settings.lang = $('set-lang').value;
  settings.typeAnswer = $('set-type').value === '1';
  settings.autoplay = $('set-autoplay').value === '1';
  settings.timeLimit = Math.max(0, Number($('set-timelimit').value) || 0);
  await db.setMeta('settings', settings);
  applyTheme();
  applyLang();
  toast(t('toast.saved'));
  showDecks();
};
$('set-algo').onchange = () => $('row-retention').classList.toggle('hidden', $('set-algo').value !== 'fsrs');
$('set-lang').onchange = () => { settings.lang = $('set-lang').value; applyLang(); $('settings-footer').textContent = t('set.footer', { v: VERSION }); $('title').textContent = t('app.settings'); };
// ---- sync UI
function renderSyncUI() {
  const st = syncer.state;
  const group = $('sync-group');
  group.classList.toggle('hidden', st.reason === 'no-config');
  $('sync-unavailable').classList.toggle('hidden', st.enabled);
  if (!st.enabled) {
    const loaded = [...document.scripts].filter(x => /firebase/.test(x.src)).map(x => x.src.split('/').pop().replace('firebase-', '').replace('-compat.js', '')).join(', ');
    const diag = `[firebase=${typeof firebase}${typeof firebase !== 'undefined' ? ' auth=' + typeof firebase.auth + ' firestore=' + typeof firebase.firestore + ' apps=' + (firebase.apps || []).length : ''}; scripts: ${loaded || 'none'}; online=${navigator.onLine}]`;
    $('sync-unavailable').textContent = t('sync.unavailable', { why: (st.reason === 'sdk-missing' ? t('sync.sdk_missing') : st.reason || '?') + ' ' + diag });
  }
  $('sync-signed-out').classList.toggle('hidden', !st.enabled || !!st.user);
  $('sync-signed-in').classList.toggle('hidden', !st.enabled || !st.user);
  const btn = $('btn-sync');
  btn.className = 'icon-btn' + (st.status === 'syncing' ? ' sync-busy' : st.status === 'error' ? ' sync-error' : st.pending ? ' sync-pending' : '');
  btn.classList.toggle('hidden', !st.enabled || !st.user);
  btn.title = t('sync.status_' + (st.status === 'signed-out' ? 'off' : st.status)) + (st.error ? `: ${st.error}` : '');
  if (!st.enabled) return;
  if (st.user) {
    $('sync-who').textContent = t('sync.signed_in_as', { email: st.user.email || st.user.uid });
    const last = st.lastSync ? new Date(st.lastSync).toLocaleString(document.documentElement.lang) : t('sync.never');
    $('sync-info').textContent = (navigator.onLine ? t('sync.last', { t: last }) : t('sync.offline')) + (st.pending ? ` · ${t('sync.pending', { n: st.pending })}` : '');
  }
  $('sync-error').classList.toggle('hidden', !st.error);
  $('sync-error').textContent = st.error || '';
}
syncer.onChange(renderSyncUI);
$('btn-sync').onclick = () => syncer.sync({ force: true });
$('btn-sync-now').onclick = () => syncer.sync({ force: true });
$('btn-sync-out').onclick = () => syncer.signOut();
$('btn-sync-google').onclick = () => syncer.signInGoogle().catch(e => toast(e.message, 5000));
$('btn-sync-link').onclick = async () => {
  const email = $('sync-email').value.trim();
  if (!email) return $('sync-email').focus();
  try { await syncer.sendLink(email); toast(t('sync.link_sent'), 6000); } catch (e) { toast(e.message, 6000); }
};

$('btn-persist').onclick = async () => {
  const ok = navigator.storage?.persist ? await navigator.storage.persist() : false;
  toast(t(ok ? 'toast.persist_ok' : 'toast.persist_no'));
  openSettings();
};
$('btn-wipe').onclick = async () => {
  if (!confirm(t('confirm.wipe'))) return;
  await db.wipe();
  settings = { ...sched.DEFAULTS, theme: 'auto', lang: 'auto' };
  applyTheme();
  applyLang();
  toast(t('toast.wiped'));
  showDecks();
};

// ---------------------------------------------------------------- statistics
async function openStats(deckId) {
  show('stats', t('stats.title'));
  const cards = await cardsIn(deckId);
  const reviews = await reviewsIn(deckId);
  const notes = new Map((await notesIn(deckId)).map(n => [n.id, n]));
  const now = Date.now();
  const st = { new: 0, learning: 0, young: 0, mature: 0, suspended: 0 };
  for (const c of cards) {
    if (c.suspended) st.suspended++;
    else if (c.state === 'new') st.new++;
    else if (c.state === 'learn' || c.state === 'relearn') st.learning++;
    else if ((c.ivl || 0) < 21) st.young++;
    else st.mature++;
  }
  const colors = { new: 'var(--new)', learning: 'var(--learn)', young: 'var(--good)', mature: '#2E6B33', suspended: 'var(--muted)' };
  const total = cards.length || 1;
  $('st-total').textContent = t('br.count', { n: cards.length });
  $('st-states').innerHTML = Object.entries(st).map(([k, v]) => `<i style="width:${100 * v / total}%;background:${colors[k]}"></i>`).join('');
  $('st-legend').innerHTML = Object.entries(st).map(([k, v]) => `<span style="--c:${colors[k]}">${t('stats.' + k)} ${v}</span>`).join('');
  const since = now - 30 * DAY;
  const recent = reviews.filter(r => r.at >= since);
  const revOnly = recent.filter(r => r.state === 'review');
  $('st-ret').textContent = revOnly.length ? `${Math.round(100 * revOnly.filter(r => r.grade > 1).length / revOnly.length)}%` : '–';
  $('st-reviews').textContent = recent.length;
  const timed = recent.filter(r => r.ms > 0);
  $('st-time').textContent = timed.length ? `${(timed.reduce((s, r) => s + r.ms, 0) / timed.length / 1000).toFixed(1)}s` : '–';
  const locale = document.documentElement.lang;
  const bars = (buckets, cls) => {
    const max = Math.max(1, ...buckets.map(b => b.count));
    return buckets.map(b => `<div><i class="${b.count ? '' : 'zero'}" style="height:${Math.max(3, Math.round(56 * b.count / max))}px" title="${b.count}"></i><span>${new Date(b.day).toLocaleDateString(locale, { day: 'numeric' })}</span></div>`).join('');
  };
  const hist = reviewsPerDay(reviews, 30);
  $('st-hist').innerHTML = bars(hist);
  $('st-hist-total').textContent = t('deck.reviews', { n: hist.reduce((s, b) => s + b.count, 0) });
  const today = sched.dayStart();
  const fc = Array.from({ length: 30 }, (_, i) => ({ day: today + i * DAY, count: 0 }));
  for (const c of cards) {
    if (c.suspended || c.state === 'new') continue;
    const idx = Math.max(0, Math.floor((c.due - today) / DAY));
    if (idx < 30) fc[idx].count++;
  }
  $('st-forecast').innerHTML = bars(fc);
  $('st-forecast-total').textContent = t('br.count', { n: fc.reduce((s, b) => s + b.count, 0) });
  const hard = cards.filter(c => (c.lapses || 0) > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 8);
  $('st-hard').innerHTML = hard.length ? '' : `<p class="muted center">${t('stats.none_hard')}</p>`;
  for (const c of hard) {
    const n = notes.get(c.noteId);
    const row = document.createElement('button'); row.className = 'hard-row';
    row.innerHTML = `<span></span><b>${t('stats.lapses', { n: c.lapses })}</b>`;
    row.querySelector('span').textContent = n ? parseField(n.fields[0]).text || '🖼' : c.noteId;
    row.onclick = () => n && openEditor({ deckId: n.deckId, noteId: n.id, back: () => openStats(deckId) });
    $('st-hard').appendChild(row);
  }
}
$('hero').onclick = async () => { if ((await db.getAll('decks')).length) { currentDeck = { id: '', name: t('app.decks'), virtual: true }; openStats(''); } };

// ---------------------------------------------------------------- note types (templates)
let tpModel = null;
async function openNoteTypes() {
  show('notetypes', t('nt.title'));
  const models = await db.getAll('models');
  const notes = await db.getAll('notes');
  const list = $('nt-list');
  list.innerHTML = '';
  for (const m of models.sort((a, b) => a.name.localeCompare(b.name))) {
    const n = notes.filter(x => x.modelId === m.id).length;
    if (!n) continue;
    const b = document.createElement('button'); b.className = 'note-row';
    b.innerHTML = `<span class="q"></span><span class="st">${t('nt.notes', { n })}</span><span class="a"></span>`;
    b.querySelector('.q').textContent = m.name;
    b.querySelector('.a').textContent = m.tmpls.map(x => x.name).join(', ');
    b.onclick = () => openTemplate(m);
    list.appendChild(b);
  }
}
function openTemplate(model) {
  tpModel = JSON.parse(JSON.stringify(model));
  show('template', model.name);
  $('tp-select').innerHTML = model.tmpls.map((x, i) => `<option value="${i}">${x.name.replace(/</g, '&lt;')}</option>`).join('');
  $('tp-css').value = model.css || '';
  $('tp-fields').textContent = t('nt.fields', { f: model.flds.map(f => `{{${f.name}}}`).join(' ') });
  loadTpl(0);
}
function loadTpl(i) { const x = tpModel.tmpls[i]; $('tp-qfmt').value = x.qfmt; $('tp-afmt').value = x.afmt; $('tp-select').value = String(i); }
function storeTpl() { const x = tpModel.tmpls[Number($('tp-select').value)]; x.qfmt = $('tp-qfmt').value; x.afmt = $('tp-afmt').value; }
let tpPrev = 0;
$('tp-select').onchange = () => { const x = tpModel.tmpls[tpPrev]; x.qfmt = $('tp-qfmt').value; x.afmt = $('tp-afmt').value; tpPrev = Number($('tp-select').value); loadTpl(tpPrev); };
$('btn-tp-save').onclick = async () => {
  storeTpl();
  tpModel.css = $('tp-css').value;
  if (tpModel.raw) { tpModel.raw.css = tpModel.css; for (const x of tpModel.tmpls) { const r = (tpModel.raw.tmpls || [])[x.ord]; if (r) { r.qfmt = x.qfmt; r.afmt = x.afmt; } } }
  await db.put('models', tpModel);
  toast(t('toast.template_saved'));
  openNoteTypes();
};
$('btn-notetypes').onclick = openNoteTypes;

// ---------------------------------------------------------------- boot
(async () => {
  await loadSettings();
  syncer.state.lastSync = await db.getMeta('sync:lastSync', 0);
  try { syncer.init(); } catch (e) { console.error('sync init failed', e); syncer.state.reason = 'init-threw: ' + (e && (e.message || e.code) || e); }
  renderSyncUI();
  await showDecks();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Reload once when a new version of the app has taken over.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !navigator.serviceWorker.controller) return;
      reloading = true;
      if (current !== 'study') location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(reg => { reg.update().catch(() => {}); setInterval(() => reg.update().catch(() => {}), 60 * 60000); })
      .catch(err => console.warn('SW registration failed', err));
  }
})();

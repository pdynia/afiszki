// Import and export of Anki .apkg packages, entirely in the browser.
import * as db from './db.js';

const DAY = 86400000;
let sqlPromise;
function sql() {
  if (!sqlPromise) sqlPromise = initSqlJs({ locateFile: f => `vendor/${f}` });
  return sqlPromise;
}

function rows(res) {
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(v => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
}

const stripHtml = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

/**
 * Import an .apkg File/Blob. Returns { decks: [{id,name,cards}], warnings: [] }.
 */
export async function importApkg(file, onProgress = () => {}, t = (k) => k) {
  onProgress('Unpacking…');
  const zip = await JSZip.loadAsync(file);
  const dbEntry = zip.file('collection.anki21') || zip.file('collection.anki2');
  if (!dbEntry) {
    if (zip.file('collection.anki21b')) {
      throw new Error(t('err.new_format'));
    }
    throw new Error(t('err.not_apkg'));
  }
  const warnings = [];

  onProgress('Reading database…');
  const SQL = await sql();
  const database = new SQL.Database(new Uint8Array(await dbEntry.async('arraybuffer')));
  try {
    const col = rows(database.exec('SELECT crt, models, decks FROM col'))[0];
    const crtMs = col.crt * 1000;
    const models = JSON.parse(col.models);
    const ankiDecks = JSON.parse(col.decks);
    const notes = rows(database.exec('SELECT id, guid, mid, tags, flds FROM notes'));
    const cards = rows(database.exec('SELECT id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses FROM cards'));

    // Models
    const modelRows = Object.values(models).map(m => ({
      id: String(m.id),
      name: m.name,
      type: m.type || 0,
      css: m.css || '',
      flds: (m.flds || []).map(f => ({ name: f.name, ord: f.ord })),
      tmpls: (m.tmpls || []).map(t => ({ name: t.name, ord: t.ord, qfmt: t.qfmt, afmt: t.afmt })),
      raw: m,
    }));
    await db.putMany('models', modelRows);

    // Existing state so re-imports keep progress.
    const existingCards = new Map((await db.getAll('cards')).map(c => [c.id, c]));

    const noteById = new Map(notes.map(n => [n.id, n]));
    const deckKey = (did) => {
      const d = ankiDecks[String(did)];
      return d ? d.name : `Deck ${did}`;
    };
    const touchedDecks = new Map();
    const noteRows = new Map();
    const cardRows = [];
    const now = Date.now();

    for (const c of cards) {
      const n = noteById.get(c.nid);
      if (!n) continue;
      const deckId = deckKey(c.did);
      const noteId = n.guid;
      if (!noteRows.has(noteId)) {
        noteRows.set(noteId, {
          id: noteId,
          deckId,
          modelId: String(n.mid),
          fields: String(n.flds).split('\x1f'),
          tags: String(n.tags || '').trim().split(/\s+/).filter(Boolean),
          mod: now,
        });
      }
      const cardId = `${noteId}:${c.ord}`;
      const prev = existingCards.get(cardId);
      let card;
      if (prev) {
        card = { ...prev, deckId, noteId, ord: c.ord };
      } else {
        card = { id: cardId, deckId, noteId, ord: c.ord, state: 'new', due: 0, ivl: 0, ease: 0, step: 0, reps: c.reps || 0, lapses: c.lapses || 0, order: c.due, suspended: c.queue === -1 };
        if (c.type === 2 && c.ivl > 0) {
          card.state = 'review';
          card.ivl = c.ivl;
          card.ease = c.factor || 2500;
          card.due = crtMs + c.due * DAY;
        } else if (c.type === 1) {
          card.state = 'learn'; card.ease = c.factor || 2500; card.due = now;
        } else if (c.type === 3) {
          card.state = 'relearn'; card.ivl = Math.max(1, c.ivl); card.ease = c.factor || 2500; card.due = now;
        }
      }
      cardRows.push(card);
      touchedDecks.set(deckId, (touchedDecks.get(deckId) || 0) + 1);
    }

    const deckRows = [];
    for (const [id, n] of touchedDecks) {
      const existing = await db.get('decks', id);
      deckRows.push(existing ? { ...existing, mod: now } : { id, name: id, created: now, mod: now });
    }
    onProgress(`Saving ${cardRows.length} cards…`);
    await db.putMany('notes', [...noteRows.values()]);
    await db.putMany('cards', cardRows);
    await db.putMany('decks', deckRows);

    // Media
    const mediaEntry = zip.file('media');
    if (mediaEntry) {
      let map = null;
      try { map = JSON.parse(await mediaEntry.async('string')); } catch { warnings.push(t('warn.media')); }
      if (map) {
        const entries = Object.entries(map);
        let i = 0;
        const batch = [];
        for (const [key, name] of entries) {
          const f = zip.file(key);
          if (!f) continue;
          const blob = await f.async('blob');
          batch.push({ name, blob });
          if (batch.length >= 25) { await db.putMany('media', batch.splice(0)); }
          if (++i % 25 === 0) onProgress(`Saving media ${i}/${entries.length}…`);
        }
        await db.putMany('media', batch);
      }
    }

    return { decks: deckRows.map(d => ({ ...d, cards: touchedDecks.get(d.id) })), warnings };
  } finally {
    database.close();
  }
}

// ---------------------------------------------------------------------------
// Export one deck as a legacy (.anki2) package that Anki and this app can read.

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

const DCONF = { 1: { id: 1, name: 'Default', mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true,
  new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
  rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
  lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 }, dyn: false } };

async function csum(text) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return parseInt([...new Uint8Array(buf).slice(0, 4)].map(b => b.toString(16).padStart(2, '0')).join(''), 16);
}

export async function exportDeck(deckId) {
  const SQL = await sql();
  const deck = await db.get('decks', deckId);
  const notes = await db.getAllByIndex('notes', 'deckId', deckId);
  const cards = await db.getAllByIndex('cards', 'deckId', deckId);
  const allModels = await db.getAll('models');
  const modelsUsed = new Set(notes.map(n => n.modelId));
  const nowS = Math.floor(Date.now() / 1000);
  const crt = nowS - (nowS % 86400);
  const crtMs = crt * 1000;

  const models = {};
  for (const m of allModels) {
    if (!modelsUsed.has(m.id)) continue;
    const raw = m.raw || { id: Number(m.id), name: m.name, type: m.type, css: m.css,
      flds: m.flds.map(f => ({ ...f, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] })),
      tmpls: m.tmpls.map(t => ({ ...t, bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 })),
      sortf: 0, did: 1, latexPre: '', latexPost: '', latexsvg: false, req: [[0, 'any', [0]]], vers: [], tags: [] };
    models[m.id] = { ...raw, id: Number(m.id), mod: nowS, usn: -1 };
  }
  const did = 1;
  const decks = { [did]: { id: did, name: deck.name, mod: nowS, usn: -1, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
    collapsed: false, browserCollapsed: false, desc: '', dyn: 0, conf: 1, extendNew: 0, extendRev: 0 } };
  const conf = { nextPos: cards.length + 1, estTimes: true, activeDecks: [did], sortType: 'noteFld', timeLim: 0, sortBackwards: false,
    addToCur: true, curDeck: did, newBury: true, newSpread: 0, dueCounts: true, curModel: Object.keys(models)[0] || '', collapseTime: 1200 };

  const database = new SQL.Database();
  try {
    database.exec(SCHEMA);
    database.run('INSERT INTO col VALUES (1,?,?,?,11,0,0,0,?,?,?,?,?)',
      [crt, nowS, nowS * 1000, JSON.stringify(conf), JSON.stringify(models), JSON.stringify(decks), JSON.stringify(DCONF), '{}']);

    let nextId = Date.now();
    const noteIdMap = new Map();
    const insNote = database.prepare('INSERT INTO notes VALUES (?,?,?,?,-1,?,?,?,?,0,"")');
    for (const n of notes) {
      const id = nextId++;
      noteIdMap.set(n.id, id);
      const sfld = stripHtml(n.fields[0] || '');
      insNote.run([id, n.id, Number(n.modelId), nowS, n.tags.length ? ` ${n.tags.join(' ')} ` : '', n.fields.join('\x1f'), sfld, await csum(sfld)]);
    }
    insNote.free();

    const insCard = database.prepare('INSERT INTO cards VALUES (?,?,?,?,?,-1,?,?,?,?,?,?,?,0,0,0,0,"")');
    let pos = 1;
    for (const c of cards) {
      const nid = noteIdMap.get(c.noteId);
      if (!nid) continue;
      let type = 0, queue = 0, due = pos++, ivl = 0, factor = 0;
      if (c.state === 'review') { type = 2; queue = 2; due = Math.max(0, Math.round((c.due - crtMs) / DAY)); ivl = c.ivl || 1; factor = c.ease || 2500; }
      else if (c.state === 'learn') { type = 1; queue = 1; due = Math.floor(c.due / 1000); factor = c.ease || 2500; }
      else if (c.state === 'relearn') { type = 3; queue = 1; due = Math.floor(c.due / 1000); ivl = c.ivl || 1; factor = c.ease || 2500; }
      if (c.suspended) queue = -1;
      insCard.run([nextId++, nid, did, c.ord, nowS, type, queue, due, ivl, factor, c.reps || 0, c.lapses || 0]);
    }
    insCard.free();

    const bytes = database.export();
    const zip = new JSZip();
    zip.file('collection.anki2', bytes);

    // Media referenced by these notes.
    const names = new Set();
    for (const n of notes) for (const f of n.fields) {
      for (const m of f.matchAll(/src="([^"]+)"/g)) names.add(decodeURIComponent(m[1]));
      for (const m of f.matchAll(/\[sound:([^\]]+)\]/g)) names.add(m[1]);
    }
    const mediaMap = {};
    let i = 0;
    for (const name of names) {
      const row = await db.get('media', name);
      if (!row) continue;
      zip.file(String(i), row.blob);
      mediaMap[String(i)] = name;
      i++;
    }
    zip.file('media', JSON.stringify(mediaMap));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  } finally {
    database.close();
  }
}

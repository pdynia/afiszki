// Minimal IndexedDB wrapper. All app state lives here, on the device.
// Every write is also recorded in the 'dirty' store so sync.js knows what to push.
const DB_NAME = 'cards-app';
const DB_VERSION = 2;
export const STORES = ['decks', 'models', 'notes', 'cards', 'reviews', 'media', 'meta'];
const SYNCED = new Set(['decks', 'models', 'notes', 'cards', 'reviews', 'media']);

let dbPromise;

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (ev.oldVersion < 1) {
        const decks = db.createObjectStore('decks', { keyPath: 'id' });
        decks.createIndex('name', 'name');
        db.createObjectStore('models', { keyPath: 'id' });
        const notes = db.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('deckId', 'deckId');
        const cards = db.createObjectStore('cards', { keyPath: 'id' });
        cards.createIndex('deckId', 'deckId');
        cards.createIndex('noteId', 'noteId');
        cards.createIndex('deckDue', ['deckId', 'due']);
        const reviews = db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
        reviews.createIndex('cardId', 'cardId');
        reviews.createIndex('deckId', 'deckId');
        db.createObjectStore('media', { keyPath: 'name' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (ev.oldVersion < 2) {
        db.createObjectStore('dirty', { keyPath: ['store', 'key'] });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab is upgrading the schema: let go so it isn't blocked, then reload.
      db.onversionchange = () => { db.close(); dbPromise = null; location.reload(); };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => { if (typeof onBlocked === 'function') onBlocked(); };
  });
  return dbPromise;
}
let onBlocked = null;
export function setBlockedHandler(fn) { onBlocked = fn; }

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function tx(stores, mode, fn) {
  const db = await open();
  const t = db.transaction(stores, mode);
  const result = await fn(t);
  await new Promise((resolve, reject) => {
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction aborted'));
  });
  return result;
}

// While sync.js applies remote changes it sets this so they are not re-queued as local edits.
export let applyingRemote = false;
export function setApplyingRemote(v) { applyingRemote = v; }

const keyOf = (store, value) => store === 'media' ? value.name : value.id;
function markDirty(t, store, key, deleted = false) {
  if (applyingRemote || !SYNCED.has(store) || key == null) return;
  t.objectStore('dirty').put({ store, key, deleted, at: Date.now() });
}

export const get = (store, key) => tx([store], 'readonly', t => promisify(t.objectStore(store).get(key)));
export const getAll = (store) => tx([store], 'readonly', t => promisify(t.objectStore(store).getAll()));

export function put(store, value) {
  if (SYNCED.has(store) && store !== 'reviews' && store !== 'media') value.mod = Date.now();
  return tx([store, 'dirty'], 'readwrite', async t => {
    const key = await promisify(t.objectStore(store).put(value));
    markDirty(t, store, key);
    return key;
  });
}
export function del(store, key) {
  return tx([store, 'dirty'], 'readwrite', t => { t.objectStore(store).delete(key); markDirty(t, store, key, true); return promisify(t.objectStore(store).count()); });
}

export function getAllByIndex(store, index, value) {
  return tx([store], 'readonly', t => promisify(t.objectStore(store).index(index).getAll(value)));
}

export async function putMany(store, values) {
  if (!values.length) return;
  const stamp = SYNCED.has(store) && store !== 'reviews' && store !== 'media';
  return tx([store, 'dirty'], 'readwrite', async t => {
    const os = t.objectStore(store);
    for (const v of values) {
      if (stamp && !applyingRemote) v.mod = Date.now();
      const key = await promisify(os.put(v));
      markDirty(t, store, key);
    }
  });
}

export async function count(store) {
  return tx([store], 'readonly', t => promisify(t.objectStore(store).count()));
}

export async function getMeta(key, fallback) {
  const row = await get('meta', key);
  return row ? row.value : fallback;
}
export const setMeta = (key, value) => tx(['meta'], 'readwrite', t => promisify(t.objectStore('meta').put({ key, value })));

export async function deleteDeckData(deckId) {
  return tx(['decks', 'notes', 'cards', 'reviews', 'dirty'], 'readwrite', async t => {
    t.objectStore('decks').delete(deckId);
    markDirty(t, 'decks', deckId, true);
    for (const store of ['notes', 'cards', 'reviews']) {
      const idx = t.objectStore(store).index('deckId');
      const keys = await promisify(idx.getAllKeys(deckId));
      for (const k of keys) { t.objectStore(store).delete(k); markDirty(t, store, k, true); }
    }
  });
}

// Dirty queue for sync
export const getDirty = () => tx(['dirty'], 'readonly', t => promisify(t.objectStore('dirty').getAll()));
export function clearDirty(entries) {
  return tx(['dirty'], 'readwrite', t => { for (const e of entries) t.objectStore('dirty').delete([e.store, e.key]); });
}
export const markAllDirty = async () => {
  for (const store of SYNCED) {
    const rows = await getAll(store);
    await tx(['dirty'], 'readwrite', t => { for (const r of rows) t.objectStore('dirty').put({ store, key: keyOf(store, r), deleted: false, at: Date.now() }); });
  }
};

export async function wipe() {
  return tx([...STORES, 'dirty'], 'readwrite', t => {
    for (const s of [...STORES, 'dirty']) t.objectStore(s).clear();
  });
}

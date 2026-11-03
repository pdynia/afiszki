// Minimal IndexedDB wrapper. All app state lives here, on the device.
const DB_NAME = 'cards-app';
const DB_VERSION = 1;
export const STORES = ['decks', 'models', 'notes', 'cards', 'reviews', 'media', 'meta'];

let dbPromise;

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

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

export const get = (store, key) => tx([store], 'readonly', t => promisify(t.objectStore(store).get(key)));
export const getAll = (store) => tx([store], 'readonly', t => promisify(t.objectStore(store).getAll()));
export const put = (store, value) => tx([store], 'readwrite', t => promisify(t.objectStore(store).put(value)));
export const del = (store, key) => tx([store], 'readwrite', t => promisify(t.objectStore(store).delete(key)));

export function getAllByIndex(store, index, value) {
  return tx([store], 'readonly', t => promisify(t.objectStore(store).index(index).getAll(value)));
}

export async function putMany(store, values) {
  if (!values.length) return;
  return tx([store], 'readwrite', t => {
    const os = t.objectStore(store);
    for (const v of values) os.put(v);
  });
}

export async function count(store) {
  return tx([store], 'readonly', t => promisify(t.objectStore(store).count()));
}

export async function getMeta(key, fallback) {
  const row = await get('meta', key);
  return row ? row.value : fallback;
}
export const setMeta = (key, value) => put('meta', { key, value });

export async function deleteDeckData(deckId) {
  return tx(['decks', 'notes', 'cards', 'reviews'], 'readwrite', async t => {
    t.objectStore('decks').delete(deckId);
    for (const store of ['notes', 'cards', 'reviews']) {
      const idx = t.objectStore(store).index('deckId');
      const keys = await promisify(idx.getAllKeys(deckId));
      for (const k of keys) t.objectStore(store).delete(k);
    }
  });
}

export async function wipe() {
  return tx(STORES, 'readwrite', t => {
    for (const s of STORES) t.objectStore(s).clear();
  });
}

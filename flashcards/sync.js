// Optional cloud sync through Firebase (Auth + Firestore + Storage).
// Local IndexedDB stays the source of truth; this pushes the dirty queue and
// pulls remote changes newer than the last pull. Last write (by `mod`) wins.
import * as db from './db.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

const COLLECTIONS = ['decks', 'models', 'notes', 'cards', 'reviews', 'media'];
let app = null, auth = null, fs = null, storage = null;
let running = false;
const listeners = new Set();
export const state = { enabled: false, user: null, status: 'off', lastSync: 0, error: null, pending: 0 };

function emit() { for (const l of listeners) l(state); }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setStatus(status, error = null) { state.status = status; state.error = error; emit(); }

export const configured = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && typeof firebase !== 'undefined');

export function init() {
  if (!configured() || app) return configured();
  app = firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  fs = firebase.firestore();
  storage = firebase.storage();
  state.enabled = true;
  auth.onAuthStateChanged(async (user) => {
    state.user = user ? { uid: user.uid, email: user.email } : null;
    setStatus(user ? 'idle' : 'signed-out');
    if (user) {
      const prev = await db.getMeta('sync:uid', null);
      if (prev !== user.uid) { await db.markAllDirty(); await db.setMeta('sync:pulledAt', 0); await db.setMeta('sync:uid', user.uid); }
      sync().catch(() => {});
    }
  });
  // Complete an e-mail-link sign-in if we were opened from one.
  if (auth.isSignInWithEmailLink(location.href)) {
    const email = localStorage.getItem('sync:email') || prompt('E-mail');
    if (email) auth.signInWithEmailLink(email, location.href).then(() => {
      localStorage.removeItem('sync:email');
      history.replaceState(null, '', location.pathname);
    }).catch(e => setStatus('error', e.message));
  }
  window.addEventListener('online', () => sync().catch(() => {}));
  setInterval(() => { if (navigator.onLine) sync().catch(() => {}); }, 5 * 60000);
  return true;
}

export async function sendLink(email) {
  localStorage.setItem('sync:email', email);
  await auth.sendSignInLinkToEmail(email, { url: location.origin + location.pathname, handleCodeInApp: true });
}
export async function signInGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithRedirect(provider);
}
export async function signOut() { await auth.signOut(); }

const col = (name) => fs.collection('users').doc(state.user.uid).collection(name);
const mediaRef = (name) => storage.ref(`users/${state.user.uid}/media/${name}`);

// Firestore rejects undefined values and nested arrays; cards/notes are plain JSON.
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

export async function sync({ force = false } = {}) {
  if (!state.user || running || (!navigator.onLine && !force)) return;
  running = true;
  setStatus('syncing');
  try {
    await push();
    await pull();
    state.lastSync = Date.now();
    await db.setMeta('sync:lastSync', state.lastSync);
    setStatus('idle');
  } catch (e) {
    console.error('sync failed', e);
    setStatus('error', e.message);
  } finally {
    running = false;
    emit();
  }
}

async function push() {
  const dirty = await db.getDirty();
  state.pending = dirty.length; emit();
  if (!dirty.length) return;
  const done = [];
  // Media blobs first, so notes that reference them never point at nothing.
  for (const d of dirty.filter(x => x.store === 'media')) {
    if (d.deleted) { await mediaRef(d.key).delete().catch(() => {}); await col('media').doc(encodeURIComponent(d.key)).set({ name: d.key, deleted: true, mod: Date.now() }); }
    else {
      const row = await db.get('media', d.key);
      if (row) {
        await mediaRef(d.key).put(row.blob, { contentType: row.blob.type || 'application/octet-stream' });
        await col('media').doc(encodeURIComponent(d.key)).set({ name: d.key, size: row.blob.size, type: row.blob.type || '', mod: Date.now() });
      }
    }
    done.push(d);
  }
  const rest = dirty.filter(x => x.store !== 'media');
  for (let i = 0; i < rest.length; i += 400) {
    const batch = fs.batch();
    const chunk = rest.slice(i, i + 400);
    for (const d of chunk) {
      const ref = col(d.store).doc(String(d.key));
      if (d.deleted) batch.set(ref, { id: d.key, deleted: true, mod: Date.now() });
      else {
        const row = await db.get(d.store, d.key);
        if (!row) continue;
        const doc = clean(row);
        if (d.store === 'reviews') doc.mod = row.at || Date.now();
        if (!doc.mod) doc.mod = Date.now();
        if (d.store === 'models' && doc.raw) doc.raw = JSON.stringify(doc.raw); // nested arrays are not allowed
        batch.set(ref, doc);
      }
    }
    await batch.commit();
    done.push(...chunk);
    await db.clearDirty(chunk);
  }
  await db.clearDirty(done.filter(x => x.store === 'media'));
  state.pending = 0;
}

async function pull() {
  const since = await db.getMeta('sync:pulledAt', 0);
  let newest = since;
  db.setApplyingRemote(true);
  try {
    for (const name of COLLECTIONS) {
      const snap = await col(name).where('mod', '>', since).orderBy('mod').get();
      if (snap.empty) continue;
      const rows = [], dels = [];
      for (const doc of snap.docs) {
        const r = doc.data();
        newest = Math.max(newest, r.mod || 0);
        if (name === 'media') {
          const localRow = await db.get('media', r.name);
          if (r.deleted) { if (localRow) await db.del('media', r.name); continue; }
          if (!localRow) {
            try {
              const url = await mediaRef(r.name).getDownloadURL();
              const blob = await (await fetch(url)).blob();
              await db.put('media', { name: r.name, blob });
            } catch (e) { console.warn('media download failed', r.name, e); }
          }
          continue;
        }
        if (r.deleted) { dels.push(r.id); continue; }
        if (name === 'models' && typeof r.raw === 'string') { try { r.raw = JSON.parse(r.raw); } catch { delete r.raw; } }
        const local = await db.get(name, r.id);
        if (local && (local.mod || local.at || 0) > (r.mod || 0)) continue; // local is newer
        rows.push(r);
      }
      if (rows.length) await db.putMany(name, rows);
      for (const id of dels) await db.del(name, id);
    }
    await db.setMeta('sync:pulledAt', newest);
  } finally {
    db.setApplyingRemote(false);
  }
}

// Fallback used by the study screen when a media file is missing locally.
export async function fetchMedia(name) {
  if (!state.user) return null;
  try {
    const url = await mediaRef(name).getDownloadURL();
    const blob = await (await fetch(url)).blob();
    await db.put('media', { name, blob });
    return blob;
  } catch { return null; }
}

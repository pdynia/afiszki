// Renders Anki note templates into HTML. Supports {{Field}}, {{FrontSide}},
// {{cloze:Field}}, {{hint:Field}}, {{text:Field}}, {{type:Field}},
// {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}} sections.

const mediaUrlCache = new Map();

export function releaseMediaUrls() {
  for (const url of mediaUrlCache.values()) URL.revokeObjectURL(url);
  mediaUrlCache.clear();
}

export function mediaUrl(name, blob) {
  if (!blob) return null;
  if (!mediaUrlCache.has(name)) mediaUrlCache.set(name, URL.createObjectURL(blob));
  return mediaUrlCache.get(name);
}

function stripHtml(s) {
  const d = document.createElement('div');
  d.innerHTML = s;
  return d.textContent || '';
}

function clozeFront(text, ord) {
  return text.replace(/\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (m, n, ans, hint) =>
    Number(n) === ord ? `<span class="cloze">[${hint || '...'}]</span>` : ans);
}
function clozeBack(text, ord) {
  return text.replace(/\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (m, n, ans) =>
    Number(n) === ord ? `<span class="cloze">${ans}</span>` : ans);
}
export function clozeNumbers(text) {
  const nums = new Set();
  for (const m of text.matchAll(/\{\{c(\d+)::/g)) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b);
}

function renderTemplate(tpl, fields, ctx) {
  // Sections
  let out = tpl.replace(/\{\{([#^])([^}]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (m, kind, name, body) => {
    const v = (fields[name.trim()] || '').trim();
    const nonEmpty = stripHtml(v).trim() !== '' || /<img|\[sound:/.test(v);
    return (kind === '#') === nonEmpty ? renderTemplate(body, fields, ctx) : '';
  });
  // Fields
  out = out.replace(/\{\{([^}]+)\}\}/g, (m, raw) => {
    const spec = raw.trim();
    if (spec === 'FrontSide') return ctx.frontSide || '';
    if (spec === 'Tags') return ctx.tags || '';
    if (spec === 'Deck') return ctx.deckName || '';
    if (spec === 'Card') return ctx.cardName || '';
    const parts = spec.split(':');
    const name = parts.pop().trim();
    const filters = parts.map(p => p.trim());
    let v = fields[name] ?? '';
    for (const f of filters.reverse()) {
      if (f === 'cloze') v = ctx.back ? clozeBack(v, ctx.clozeOrd) : clozeFront(v, ctx.clozeOrd);
      else if (f === 'text') v = stripHtml(v);
      else if (f === 'hint') v = v ? `<details><summary>${name}</summary>${v}</details>` : '';
      else if (f === 'type') v = ctx.back ? `<div class="typeans">${v}</div>` : '<div class="typeans muted">(type answer)</div>';
    }
    return v;
  });
  return out;
}

function resolveMedia(html, getBlob) {
  html = html.replace(/\[sound:([^\]]+)\]/g, (m, name) => {
    const url = mediaUrl(name, getBlob(name));
    return url ? `<audio controls preload="none" src="${url}"></audio>` : '';
  });
  const d = document.createElement('div');
  d.innerHTML = html;
  for (const el of d.querySelectorAll('img, audio, video, source')) {
    const src = el.getAttribute('src');
    if (!src || /^(https?:|data:|blob:)/.test(src)) continue;
    const name = decodeURIComponent(src);
    const url = mediaUrl(name, getBlob(name));
    if (url) el.setAttribute('src', url); else el.removeAttribute('src');
  }
  for (const s of d.querySelectorAll('script')) s.remove();
  return d.innerHTML;
}

/**
 * @returns {{front: string, back: string, css: string}} HTML for both sides.
 */
export function renderCard({ note, model, card, deckName, getBlob }) {
  const fields = {};
  model.flds.forEach((f, i) => { fields[f.name] = note.fields[i] ?? ''; });
  const isCloze = model.type === 1;
  const tpl = isCloze ? model.tmpls[0] : (model.tmpls[card.ord] || model.tmpls[0]);
  const ctx = {
    clozeOrd: isCloze ? card.ord + 1 : 0,
    tags: (note.tags || []).join(' '),
    deckName,
    cardName: tpl.name,
  };
  const front = renderTemplate(tpl.qfmt, fields, { ...ctx, back: false });
  const back = renderTemplate(tpl.afmt, fields, { ...ctx, back: true, frontSide: front });
  return {
    front: resolveMedia(front, getBlob),
    back: resolveMedia(back, getBlob),
    css: model.css || '',
  };
}

const BASE_CSS = `
:host { display:block; }
.card { padding: 20px; min-height: 100%; font-family: arial, sans-serif; font-size: 20px; text-align: center; color: black; background: white; word-wrap: break-word; }
.card.nightMode { color: #EEE9DF; background: transparent; }
.card img { max-width: 100%; height: auto; }
.cloze { font-weight: bold; color: #A35139; }
hr#answer { margin: 16px 0; border: 0; border-top: 1px solid rgba(128,128,128,.4); }
audio { max-width: 100%; }
`;
// In night mode most shared decks hard-code dark text, so force readable colours.
const NIGHT_CSS = `
.card.nightMode, .card.nightMode :is(div, p, span:not(.cloze), b, i, u, em, strong, td, th, li, h1, h2, h3, h4, font, a) { color: #EEE9DF !important; }
.card.nightMode { background: transparent !important; }
.card.nightMode :is(div, p, span, td, table, section) { background-color: transparent !important; }
.card.nightMode .cloze { color: #FFB162 !important; }
.card.nightMode hr, .card.nightMode hr#answer { border-color: rgba(238,233,223,.25) !important; }
`;

// Mounts the given side into a host element using shadow DOM so deck CSS stays isolated.
export function mount(host, html, css, { nightMode = false } = {}) {
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${BASE_CSS}\n${css}\n${nightMode ? NIGHT_CSS : ''}</style><div class="card${nightMode ? ' nightMode night_mode' : ''}">${html}</div>`;
  host.scrollTop = 0;
}

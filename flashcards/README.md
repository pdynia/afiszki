# Cards — study Anki decks in the browser

A spaced-repetition flashcard app that runs entirely in the browser. Nothing to install,
so it works on managed (MDM-locked) iPads as long as Safari can open the page. It also
works in any desktop browser.

- Imports Anki **`.apkg`** files (legacy format; see note below)
- Front/back templates, cloze deletions, images and audio from the deck
- Anki-style scheduler (Again / Hard / Good / Easy, learning steps, ease factor)
- All data stays on the device (IndexedDB); works offline after the first visit
- "Add to Home Screen" on iOS for an app-like experience
- Export a deck back to `.apkg`, or back up / restore everything as a zip
- Built-in user guide (the ? button) and a Polish translation, chosen automatically from the device language

## Running it

It is a static site: `flashcards/` is deployed to GitHub Pages by
`.github/workflows/pages.yml` on every push to `main`. To enable it once:
repository **Settings → Pages → Source: GitHub Actions**.

Locally: `cd flashcards && python3 -m http.server 8080` and open http://localhost:8080.
(It must be served over http(s); opening `index.html` directly won't work because of the
WebAssembly SQLite engine.)

## Note on Anki package format

Anki 2.1.50+ exports a newer compressed format by default. If an import reports that,
re-export the deck in Anki with **"Support older Anki versions"** checked. Decks shared on
AnkiWeb are generally fine.

## Files

| File | Purpose |
|---|---|
| `app.js` | UI and study flow |
| `apkg.js` | `.apkg` import/export (JSZip + sql.js) |
| `scheduler.js` | SM‑2 scheduler and queue classification |
| `render.js` | Anki template rendering, media resolution, shadow-DOM mounting |
| `db.js` | IndexedDB layer |
| `i18n.js` | English / Polish strings |
| `help.js` | In-app user guide (EN / PL) |
| `sw.js` | Offline cache (bump `CACHE` when files change) |
| `vendor/` | JSZip 3.10.1, sql.js 1.12.0 |

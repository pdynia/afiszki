// Tiny i18n: dictionaries, t(), and DOM application via data-i18n attributes.
const STRINGS = {
  en: {
    'app.decks': 'Decks', 'app.deck': 'Deck', 'app.settings': 'Settings', 'app.help': 'Help',
    'hero.due': 'Due today', 'hero.waiting': 'cards waiting across all decks', 'hero.caught_up': 'all caught up',
    'hero.reviewed': 'reviewed today', 'hero.streak': 'day streak',
    'decks.title': 'Decks', 'decks.summary': '{n} deck{s} · {cards} cards',
    'empty.title': 'No decks yet',
    'empty.text': 'Import an Anki <code>.apkg</code> file to start studying.<br>On a computer you can also drop the file anywhere on this page.',
    'empty.help': 'How do I get a deck from Anki?',
    'btn.import': 'Import deck (.apkg)', 'btn.backup': 'Back up everything (.zip)', 'btn.restore': 'Restore from backup…',
    'btn.cancel': 'Cancel', 'btn.save': 'Save', 'btn.persist': 'Request persistent storage', 'btn.wipe': 'Delete all data on this device',
    'btn.study': 'Study now', 'btn.study_n': 'Study now · {n}', 'btn.nothing_due': 'Nothing due right now',
    'btn.export_deck': 'Export .apkg', 'btn.delete_deck': 'Delete deck', 'btn.show': 'Show answer', 'btn.back_to_decks': 'Back to decks',
    'deck.tag_new': '{n} new', 'deck.tag_learn': '{n} learning', 'deck.tag_due': '{n} due', 'deck.meta': '{n} cards · {pct}% learned',
    'deck.total': '{n} cards · {learned} learned', 'deck.learned': 'learned', 'deck.last7': 'Last 7 days', 'deck.reviews': '{n} review{s}',
    'count.new': 'New', 'count.learn': 'Learning', 'count.due': 'To review',
    'study.new': 'new', 'study.learn': 'learning', 'study.due': 'review',
    'study.tap': 'Tap the card to show the answer', 'study.how_well': 'How well did you know it?',
    'grade.again': 'Again', 'grade.hard': 'Hard', 'grade.good': 'Good', 'grade.easy': 'Easy',
    'done.title': 'Session complete', 'done.cards': 'cards', 'done.correct': 'correct', 'done.time': 'time',
    'done.pending': '{n} learning card{s} will be due again in {t}.', 'done.none': 'No more cards are due in this deck right now.',
    'set.limits': 'Daily limits', 'set.new_per_day': 'New cards per day', 'set.rev_per_day': 'Maximum reviews per day',
    'set.learning': 'Learning', 'set.steps': 'Learning steps (minutes)', 'set.appearance': 'Appearance', 'set.theme': 'Theme',
    'set.theme_auto': 'System', 'set.theme_light': 'Light', 'set.theme_dark': 'Dark', 'set.language': 'Language', 'set.lang_auto': 'Automatic',
    'set.data': 'Data', 'set.danger': 'Danger zone', 'set.footer': 'Cards v{v} · all data stays on this device',
    'set.storage': 'Using {used} MB of {quota} MB available. Persistent storage {state} — granting it stops the browser from evicting your decks when space is low.',
    'set.storage_na': 'Storage information unavailable.', 'set.granted': 'granted', 'set.not_granted': 'not granted',
    'toast.saved': 'Settings saved', 'toast.deleted': 'Deck deleted', 'toast.exporting': 'Exporting…', 'toast.export_failed': 'Export failed: {e}',
    'toast.backup': 'Preparing backup…', 'toast.restored': 'Backup restored', 'toast.restore_failed': 'Restore failed: {e}',
    'toast.persist_ok': 'Persistent storage granted', 'toast.persist_no': 'Not granted by the browser', 'toast.wiped': 'All data deleted',
    'toast.missing_note': 'Skipping card with missing note',
    'confirm.delete_deck': 'Delete "{name}" and all its progress?', 'confirm.restore': 'Restore this backup? Existing data with the same ids will be overwritten.',
    'confirm.wipe': 'Delete ALL decks, progress and media on this device?',
    'import.reading': 'Reading file…', 'import.done': 'Imported {names}', 'import.cards': '{n} cards', 'import.failed': 'Import failed: {e}',
    'import.not_backup': 'not a Cards backup', 'drop.hint': 'Drop the .apkg file to import',
    'err.new_format': 'This deck uses the newest Anki package format. In Anki, export it again with "Support older Anki versions" checked, then import that file.',
    'err.not_apkg': 'Not an Anki package: no collection database found.',
    'warn.media': 'Media index is in a newer format and was skipped.',
    'btn.new_deck': 'New deck', 'btn.add_card': 'Add card', 'btn.browse': 'Browse cards', 'btn.rename_deck': 'Rename', 'btn.edit': 'Edit card',
    'prompt.deck_name': 'Deck name', 'prompt.rename': 'New name for the deck', 'toast.deck_exists': 'A deck with that name already exists',
    'ed.title': 'New card', 'ed.title_edit': 'Edit card', 'ed.type': 'Card type', 'ed.basic': 'Basic', 'ed.reversed': 'Basic + reversed', 'ed.cloze': 'Cloze',
    'ed.front': 'Front', 'ed.back': 'Back', 'ed.text': 'Text', 'ed.extra': 'Extra (shown on the back)', 'ed.tags': 'Tags (optional)',
    'ed.hint_cloze': 'Hide a word with {{c1::word}} — e.g. “The capital of {{c1::Spain}} is {{c2::Madrid}}.” Each number becomes its own card.',
    'ed.hint_reversed': 'Creates two cards: front→back and back→front.',
    'ed.save': 'Save', 'ed.save_add': 'Save and add another', 'ed.delete': 'Delete this card', 'ed.empty': 'The first field cannot be empty',
    'ed.no_cloze': 'Add at least one {{c1::…}} cloze', 'toast.card_saved': 'Card saved', 'toast.card_deleted': 'Card deleted', 'confirm.delete_card': 'Delete this card?',
    'br.title': 'Cards', 'br.search': 'Search cards…', 'br.count': '{n} card{s}', 'br.empty': 'No cards yet — add the first one.',
    'st.new': 'new', 'st.learn': 'learning', 'st.review': 'review',
    'ed.add_image': 'Add photo', 'ed.image_failed': 'Could not read that image',
  },
  pl: {
    'app.decks': 'Talie', 'app.deck': 'Talia', 'app.settings': 'Ustawienia', 'app.help': 'Pomoc',
    'hero.due': 'Na dziś', 'hero.waiting': 'kart czeka we wszystkich taliach', 'hero.caught_up': 'wszystko powtórzone',
    'hero.reviewed': 'powtórzone dziś', 'hero.streak': 'dni z rzędu',
    'decks.title': 'Talie', 'decks.summary': '{n} tali{s} · {cards} kart',
    'empty.title': 'Nie ma jeszcze talii',
    'empty.text': 'Zaimportuj plik Anki <code>.apkg</code>, aby zacząć naukę.<br>Na komputerze możesz też przeciągnąć plik na tę stronę.',
    'empty.help': 'Jak pobrać talię z Anki?',
    'btn.import': 'Importuj talię (.apkg)', 'btn.backup': 'Kopia zapasowa wszystkiego (.zip)', 'btn.restore': 'Przywróć z kopii…',
    'btn.cancel': 'Anuluj', 'btn.save': 'Zapisz', 'btn.persist': 'Poproś o trwałe przechowywanie', 'btn.wipe': 'Usuń wszystkie dane z tego urządzenia',
    'btn.study': 'Ucz się', 'btn.study_n': 'Ucz się · {n}', 'btn.nothing_due': 'Nic do powtórki teraz',
    'btn.export_deck': 'Eksportuj .apkg', 'btn.delete_deck': 'Usuń talię', 'btn.show': 'Pokaż odpowiedź', 'btn.back_to_decks': 'Wróć do talii',
    'deck.tag_new': '{n} nowych', 'deck.tag_learn': '{n} w nauce', 'deck.tag_due': '{n} do powtórki', 'deck.meta': '{n} kart · {pct}% opanowanych',
    'deck.total': '{n} kart · {learned} opanowanych', 'deck.learned': 'opanowane', 'deck.last7': 'Ostatnie 7 dni', 'deck.reviews': '{n} powtór{s}',
    'count.new': 'Nowe', 'count.learn': 'W nauce', 'count.due': 'Do powtórki',
    'study.new': 'nowe', 'study.learn': 'w nauce', 'study.due': 'powtórka',
    'study.tap': 'Dotknij karty, aby zobaczyć odpowiedź', 'study.how_well': 'Jak dobrze to pamiętasz?',
    'grade.again': 'Jeszcze raz', 'grade.hard': 'Trudne', 'grade.good': 'Dobrze', 'grade.easy': 'Łatwe',
    'done.title': 'Sesja zakończona', 'done.cards': 'kart', 'done.correct': 'poprawnie', 'done.time': 'czas',
    'done.pending': '{n} kart{s} w nauce wróci za {t}.', 'done.none': 'W tej talii nie ma teraz więcej kart do powtórki.',
    'set.limits': 'Dzienne limity', 'set.new_per_day': 'Nowe karty dziennie', 'set.rev_per_day': 'Maks. powtórek dziennie',
    'set.learning': 'Nauka', 'set.steps': 'Kroki nauki (minuty)', 'set.appearance': 'Wygląd', 'set.theme': 'Motyw',
    'set.theme_auto': 'Systemowy', 'set.theme_light': 'Jasny', 'set.theme_dark': 'Ciemny', 'set.language': 'Język', 'set.lang_auto': 'Automatycznie',
    'set.data': 'Dane', 'set.danger': 'Strefa niebezpieczna', 'set.footer': 'Cards v{v} · wszystkie dane zostają na tym urządzeniu',
    'set.storage': 'Zajęte {used} MB z {quota} MB. Trwałe przechowywanie: {state} — po przyznaniu przeglądarka nie usunie talii, gdy braknie miejsca.',
    'set.storage_na': 'Brak informacji o pamięci.', 'set.granted': 'przyznane', 'set.not_granted': 'nieprzyznane',
    'toast.saved': 'Ustawienia zapisane', 'toast.deleted': 'Talia usunięta', 'toast.exporting': 'Eksportowanie…', 'toast.export_failed': 'Eksport nie powiódł się: {e}',
    'toast.backup': 'Przygotowywanie kopii…', 'toast.restored': 'Kopia przywrócona', 'toast.restore_failed': 'Przywracanie nie powiodło się: {e}',
    'toast.persist_ok': 'Trwałe przechowywanie przyznane', 'toast.persist_no': 'Przeglądarka nie przyznała', 'toast.wiped': 'Wszystkie dane usunięte',
    'toast.missing_note': 'Pominięto kartę bez notatki',
    'confirm.delete_deck': 'Usunąć talię „{name}” wraz z postępami?', 'confirm.restore': 'Przywrócić tę kopię? Istniejące dane o tych samych identyfikatorach zostaną nadpisane.',
    'confirm.wipe': 'Usunąć WSZYSTKIE talie, postępy i media z tego urządzenia?',
    'import.reading': 'Wczytywanie pliku…', 'import.done': 'Zaimportowano {names}', 'import.cards': '{n} kart', 'import.failed': 'Import nie powiódł się: {e}',
    'import.not_backup': 'to nie jest kopia zapasowa Cards', 'drop.hint': 'Upuść plik .apkg, aby zaimportować',
    'err.new_format': 'Ta talia używa najnowszego formatu Anki. W Anki wyeksportuj ją ponownie z zaznaczoną opcją „Obsługa starszych wersji Anki” (Support older Anki versions) i zaimportuj ten plik.',
    'err.not_apkg': 'To nie jest pakiet Anki: brak bazy kolekcji.',
    'warn.media': 'Indeks mediów jest w nowszym formacie i został pominięty.',
    'btn.new_deck': 'Nowa talia', 'btn.add_card': 'Dodaj kartę', 'btn.browse': 'Przeglądaj karty', 'btn.rename_deck': 'Zmień nazwę', 'btn.edit': 'Edytuj kartę',
    'prompt.deck_name': 'Nazwa talii', 'prompt.rename': 'Nowa nazwa talii', 'toast.deck_exists': 'Talia o tej nazwie już istnieje',
    'ed.title': 'Nowa karta', 'ed.title_edit': 'Edytuj kartę', 'ed.type': 'Rodzaj karty', 'ed.basic': 'Zwykła', 'ed.reversed': 'Zwykła + odwrotna', 'ed.cloze': 'Luka',
    'ed.front': 'Przód', 'ed.back': 'Tył', 'ed.text': 'Tekst', 'ed.extra': 'Dodatkowo (widoczne na odwrocie)', 'ed.tags': 'Tagi (opcjonalnie)',
    'ed.hint_cloze': 'Ukryj słowo zapisem {{c1::słowo}} — np. „Stolicą {{c1::Hiszpanii}} jest {{c2::Madryt}}.” Każdy numer to osobna karta.',
    'ed.hint_reversed': 'Tworzy dwie karty: przód→tył i tył→przód.',
    'ed.save': 'Zapisz', 'ed.save_add': 'Zapisz i dodaj następną', 'ed.delete': 'Usuń tę kartę', 'ed.empty': 'Pierwsze pole nie może być puste',
    'ed.no_cloze': 'Dodaj co najmniej jedną lukę {{c1::…}}', 'toast.card_saved': 'Karta zapisana', 'toast.card_deleted': 'Karta usunięta', 'confirm.delete_card': 'Usunąć tę kartę?',
    'br.title': 'Karty', 'br.search': 'Szukaj kart…', 'br.count': '{n} kart{s}', 'br.empty': 'Nie ma jeszcze kart — dodaj pierwszą.',
    'st.new': 'nowa', 'st.learn': 'w nauce', 'st.review': 'powtórka',
    'ed.add_image': 'Dodaj zdjęcie', 'ed.image_failed': 'Nie udało się wczytać zdjęcia',
  },
};

export let lang = 'en';

export function detectLang() {
  return (navigator.languages || [navigator.language || 'en']).some(l => /^pl\b/i.test(l)) ? 'pl' : 'en';
}

export function setLang(l) {
  lang = STRINGS[l] ? l : 'en';
  document.documentElement.lang = lang;
  applyTranslations();
}

// Plural suffix helper: {s} → "" or "s" (en); Polish picks a form via {s} with pl rules for the few keys that use it.
function plural(n, key) {
  if (lang === 'pl') {
    const n10 = n % 10, n100 = n % 100;
    const few = n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14);
    if (key === 'decks.summary') return n === 1 ? 'a' : few ? 'e' : 'i';           // talia / talie / talii
    if (key === 'deck.reviews') return n === 1 ? 'ka' : few ? 'ki' : 'ek';         // powtórka / powtórki / powtórek
    if (key === 'done.pending' || key === 'br.count') return n === 1 ? 'a' : few ? 'y' : ''; // karta / karty / kart
    return '';
  }
  return n === 1 ? '' : 's';
}

export function t(key, vars = {}) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
  if ('n' in vars && s.includes('{s}')) s = s.replace('{s}', plural(Number(vars.n), key));
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
}

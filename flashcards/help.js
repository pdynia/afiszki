// In-app user guide, in English and Polish.
export const HELP = {
  en: `
<section>
  <h2>What is this?</h2>
  <p>Cards is a flashcard app that works like Anki, but runs in the browser. Nothing is installed, and all your decks and progress stay on this device. It works offline once it has been opened once.</p>
</section>

<section>
  <h2>1. Put the app on your iPad's Home Screen</h2>
  <ol>
    <li>Open this page in <strong>Safari</strong>.</li>
    <li>Tap the <strong>Share</strong> button (the square with an arrow).</li>
    <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
  </ol>
  <p>You now have a Cards icon like any other app. Open it from there from now on; it works without internet.</p>
  <p class="note">If "Add to Home Screen" is missing, your iPad's management settings block it. The app still works normally inside Safari — just bookmark the page.</p>
</section>

<section>
  <h2>2. Export a deck from Anki on the computer</h2>
  <ol>
    <li>In Anki, on the main deck list, click the <strong>gear</strong> next to the deck (or choose <em>File → Export…</em>).</li>
    <li>Choose <strong>Export…</strong>.</li>
    <li>Set <em>Export format</em> to <strong>Anki Deck Package (*.apkg)</strong>.</li>
    <li>Under <em>Include</em>, pick the deck you want (or <em>All decks</em>).</li>
    <li>Tick <strong>Include media</strong> (so pictures and sounds come along).</li>
    <li>Tick <strong>Support older Anki versions</strong> (also called <em>Legacy support</em>). <strong>This is important</strong> — without it the file cannot be read here.</li>
    <li>Untick <em>Include scheduling information</em> if you want to start fresh; leave it on to keep your Anki progress.</li>
    <li>Click <strong>Export</strong> and save the <code>.apkg</code> file.</li>
  </ol>
  <p>Decks downloaded from <a href="https://ankiweb.net/shared/decks" target="_blank" rel="noopener">AnkiWeb shared decks</a> can be imported directly.</p>
</section>

<section>
  <h2>3. Get the file onto the iPad</h2>
  <p>Any of these works:</p>
  <ul>
    <li><strong>AirDrop</strong> from a Mac — accept it on the iPad and choose <em>Save to Files</em>.</li>
    <li><strong>iCloud Drive / Google Drive / OneDrive</strong> — copy the file into a cloud folder on the computer, then open it in the Files app on the iPad.</li>
    <li><strong>E‑mail</strong> the file to yourself and save the attachment to Files.</li>
    <li><strong>USB cable</strong> — in Finder (Mac) or iTunes (Windows) drag the file into the iPad's Files area.</li>
  </ul>
</section>

<section>
  <h2>4. Import the deck</h2>
  <ol>
    <li>In Cards, tap <strong>Import deck (.apkg)</strong>.</li>
    <li>Pick the file from Files, iCloud Drive or Downloads.</li>
    <li>Wait a moment — large decks with pictures can take a few seconds. The new deck appears in the list.</li>
  </ol>
  <p>Importing the same deck again later <strong>keeps your progress</strong> and only updates the cards' content. On a computer you can also drag the file onto the page.</p>
</section>

<section>
  <h2>5. Making your own decks and cards</h2>
  <ol>
    <li>On the deck list tap <strong>New deck</strong> and give it a name.</li>
    <li>Open the deck and tap <strong>Add card</strong>.</li>
    <li>Pick the card type:
      <ul>
        <li><strong>Basic</strong> — a question on the front, the answer on the back.</li>
        <li><strong>Basic + reversed</strong> — the same, but you also get a second card asking the other way round (good for vocabulary).</li>
        <li><strong>Cloze</strong> — a sentence with a hidden part: write <code>{{c1::word}}</code> around what should be hidden. <code>c1</code>, <code>c2</code>… each become a separate card.</li>
      </ul>
    </li>
    <li>Type the text. <strong>Add photo</strong> under a field attaches a picture from your photos or straight from the camera — photos are shrunk automatically so they don't fill the iPad.</li>
    <li><strong>Save</strong>, or <strong>Save and add another</strong> to keep going.</li>
  </ol>
  <p><strong>Browse cards</strong> on the deck page lists everything in the deck with a search box; tap a card to edit or delete it. During study, the pencil icon at the top edits the card you're looking at.</p>
  <p class="note">Cards made here can be exported with <em>Export .apkg</em> and opened in Anki desktop like any other deck.</p>
</section>

<section>
  <h2>6. Studying</h2>
  <ul>
    <li>Tap a deck, then <strong>Study now</strong>.</li>
    <li>Read the question, think of the answer, then <strong>tap the card</strong> (or <em>Show answer</em>).</li>
    <li>Rate yourself:
      <ul>
        <li><span class="k again">Again</span> — I didn't know it. The card comes back in a minute.</li>
        <li><span class="k hard">Hard</span> — I got it, but with difficulty.</li>
        <li><span class="k good">Good</span> — I knew it. This is the normal choice.</li>
        <li><span class="k easy">Easy</span> — Far too easy; show it much later.</li>
      </ul>
      The small text on each button says when you'll see the card again.</li>
    <li>Made a mistake? Tap <strong>↶ Undo</strong> at the top right.</li>
    <li>Counters at the top: <span class="dot new"></span> new cards, <span class="dot learn"></span> cards in learning, <span class="dot due"></span> cards to review.</li>
  </ul>
  <p>Cards you get right come back at growing intervals (1 day, 3 days, a week, a month…). Cards you miss come back sooner. Study a little every day — the "Due today" number on the first screen tells you how much is waiting.</p>
  <p class="note">On a keyboard: <kbd>Space</kbd> shows the answer / rates Good, <kbd>1</kbd>–<kbd>4</kbd> rate Again…Easy, <kbd>Z</kbd> undoes.</p>
</section>

<section>
  <h2>7. Settings</h2>
  <ul>
    <li><strong>New cards per day</strong> — how many unseen cards are introduced each day (20 is a good default; lower it if reviews pile up).</li>
    <li><strong>Maximum reviews per day</strong> — a safety cap on reviews.</li>
    <li><strong>Scheduling algorithm</strong> — <strong>FSRS</strong> (default) is the modern algorithm Anki uses; it learns how hard each card is for you and spaces reviews so you need fewer of them. <strong>SM‑2</strong> is the classic one.</li>
    <li><strong>Desired retention</strong> — how sure you want to be of remembering a card when it comes up. 90% is the sweet spot; 95% roughly doubles the reviews.</li>
    <li><strong>Learning steps</strong> — minutes between repetitions of a brand-new card (default <code>1, 10</code>).</li>
    <li><strong>Theme</strong> and <strong>Language</strong>.</li>
  </ul>
</section>

<section>
  <h2>8. Backups and getting progress back into Anki</h2>
  <ul>
    <li><strong>Back up everything (.zip)</strong> (⋯ menu or Settings → Data) saves all decks, progress and media into one file. Keep it in iCloud Drive or send it to yourself now and then.</li>
    <li><strong>Restore from backup…</strong> loads such a file — also on another device, which is how you move to a new iPad or a computer.</li>
    <li><strong>Export .apkg</strong> on a deck page creates an Anki file with your current progress. Import it into Anki desktop with <em>File → Import</em>.</li>
    <li>In Settings, tap <strong>Request persistent storage</strong> once, so the browser never deletes your decks to free space.</li>
  </ul>
</section>

<section>
  <h2>Problems?</h2>
  <ul>
    <li><em>"This deck uses the newest Anki package format"</em> — export again from Anki with <strong>Support older Anki versions</strong> ticked (step 2).</li>
    <li><em>Pictures are missing</em> — the deck was exported without <strong>Include media</strong>.</li>
    <li><em>Nothing due</em> — all cards are scheduled for later. Come back tomorrow, or raise <em>New cards per day</em>.</li>
    <li><em>Decks disappeared</em> — Safari data was cleared. Restore your last backup.</li>
  </ul>
</section>`,

  pl: `
<section>
  <h2>Co to jest?</h2>
  <p>Cards to aplikacja do fiszek działająca jak Anki, ale w przeglądarce. Niczego nie trzeba instalować, a wszystkie talie i postępy zostają na tym urządzeniu. Po pierwszym otwarciu działa także bez internetu.</p>
</section>

<section>
  <h2>1. Dodaj aplikację do ekranu początkowego iPada</h2>
  <ol>
    <li>Otwórz tę stronę w <strong>Safari</strong>.</li>
    <li>Stuknij przycisk <strong>Udostępnij</strong> (kwadrat ze strzałką).</li>
    <li>Wybierz <strong>Do ekranu początkowego</strong>, a potem <strong>Dodaj</strong>.</li>
  </ol>
  <p>Od teraz masz ikonę Cards jak każda inna aplikacja. Otwieraj ją stamtąd — działa bez internetu.</p>
  <p class="note">Jeśli nie ma opcji „Do ekranu początkowego”, blokują ją ustawienia zarządzania iPadem. Aplikacja i tak działa normalnie w Safari — dodaj stronę do zakładek.</p>
</section>

<section>
  <h2>2. Wyeksportuj talię z Anki na komputerze</h2>
  <ol>
    <li>W Anki, na liście talii, kliknij <strong>kółko zębate</strong> obok talii (albo wybierz <em>Plik → Eksportuj…</em>).</li>
    <li>Wybierz <strong>Eksportuj…</strong>.</li>
    <li>Jako <em>Format eksportu</em> ustaw <strong>Pakiet talii Anki (*.apkg)</strong>.</li>
    <li>W polu <em>Dołącz</em> wybierz właściwą talię (albo <em>Wszystkie talie</em>).</li>
    <li>Zaznacz <strong>Dołącz media</strong> (żeby obrazki i dźwięki też się skopiowały).</li>
    <li>Zaznacz <strong>Obsługa starszych wersji Anki</strong> (po angielsku <em>Support older Anki versions</em> / <em>Legacy support</em>). <strong>To ważne</strong> — bez tego pliku nie da się tu wczytać.</li>
    <li>Odznacz <em>Dołącz informacje o planowaniu</em>, jeśli chcesz zacząć od zera; zostaw zaznaczone, żeby zachować postępy z Anki.</li>
    <li>Kliknij <strong>Eksportuj</strong> i zapisz plik <code>.apkg</code>.</li>
  </ol>
  <p>Talie pobrane ze strony <a href="https://ankiweb.net/shared/decks" target="_blank" rel="noopener">AnkiWeb (udostępnione talie)</a> można importować od razu.</p>
</section>

<section>
  <h2>3. Przenieś plik na iPada</h2>
  <p>Dowolny z tych sposobów:</p>
  <ul>
    <li><strong>AirDrop</strong> z Maca — zaakceptuj na iPadzie i wybierz <em>Zachowaj w Plikach</em>.</li>
    <li><strong>iCloud Drive / Dysk Google / OneDrive</strong> — skopiuj plik do folderu w chmurze na komputerze, a potem otwórz go w aplikacji Pliki na iPadzie.</li>
    <li><strong>E‑mail</strong> — wyślij plik do siebie i zapisz załącznik w Plikach.</li>
    <li><strong>Kabel USB</strong> — w Finderze (Mac) lub iTunes (Windows) przeciągnij plik do obszaru Pliki iPada.</li>
  </ul>
</section>

<section>
  <h2>4. Zaimportuj talię</h2>
  <ol>
    <li>W Cards stuknij <strong>Importuj talię (.apkg)</strong>.</li>
    <li>Wybierz plik z aplikacji Pliki, iCloud Drive albo Pobranych.</li>
    <li>Poczekaj chwilę — duże talie z obrazkami mogą wczytywać się kilka sekund. Nowa talia pojawi się na liście.</li>
  </ol>
  <p>Ponowny import tej samej talii <strong>zachowuje postępy</strong> i aktualizuje tylko treść kart. Na komputerze można też przeciągnąć plik na stronę.</p>
</section>

<section>
  <h2>5. Własne talie i karty</h2>
  <ol>
    <li>Na liście talii stuknij <strong>Nowa talia</strong> i nadaj jej nazwę.</li>
    <li>Otwórz talię i stuknij <strong>Dodaj kartę</strong>.</li>
    <li>Wybierz rodzaj karty:
      <ul>
        <li><strong>Zwykła</strong> — pytanie z przodu, odpowiedź z tyłu.</li>
        <li><strong>Zwykła + odwrotna</strong> — to samo, ale dostajesz też drugą kartę pytającą w drugą stronę (dobre do słówek).</li>
        <li><strong>Luka</strong> — zdanie z ukrytym fragmentem: otocz go zapisem <code>{{c1::słowo}}</code>. Każdy numer <code>c1</code>, <code>c2</code>… to osobna karta.</li>
      </ul>
    </li>
    <li>Wpisz tekst. <strong>Dodaj zdjęcie</strong> pod polem dołącza obrazek ze zdjęć albo prosto z aparatu — zdjęcia są automatycznie zmniejszane, żeby nie zapełniały iPada.</li>
    <li><strong>Zapisz</strong> albo <strong>Zapisz i dodaj następną</strong>, żeby dodawać dalej.</li>
  </ol>
  <p><strong>Przeglądaj karty</strong> na stronie talii pokazuje wszystkie karty z wyszukiwarką; stuknij kartę, żeby ją poprawić lub usunąć. W trakcie nauki ołówek u góry otwiera edycję aktualnej karty.</p>
  <p class="note">Karty zrobione tutaj można wyeksportować przez <em>Eksportuj .apkg</em> i otworzyć w Anki na komputerze jak każdą inną talię.</p>
</section>

<section>
  <h2>6. Nauka</h2>
  <ul>
    <li>Stuknij talię, a potem <strong>Ucz się</strong>.</li>
    <li>Przeczytaj pytanie, pomyśl o odpowiedzi i <strong>stuknij kartę</strong> (albo <em>Pokaż odpowiedź</em>).</li>
    <li>Oceń siebie:
      <ul>
        <li><span class="k again">Jeszcze raz</span> — nie pamiętam. Karta wróci za minutę.</li>
        <li><span class="k hard">Trudne</span> — pamiętam, ale z trudem.</li>
        <li><span class="k good">Dobrze</span> — pamiętam. To zwykły wybór.</li>
        <li><span class="k easy">Łatwe</span> — zbyt łatwe; pokaż dużo później.</li>
      </ul>
      Mały napis na każdym przycisku mówi, kiedy karta pojawi się ponownie.</li>
    <li>Pomyłka? Stuknij <strong>↶ Cofnij</strong> w prawym górnym rogu.</li>
    <li>Liczniki u góry: <span class="dot new"></span> nowe karty, <span class="dot learn"></span> karty w nauce, <span class="dot due"></span> karty do powtórki.</li>
  </ul>
  <p>Karty, które pamiętasz, wracają w coraz większych odstępach (1 dzień, 3 dni, tydzień, miesiąc…). Te, których nie pamiętasz, wracają szybciej. Ucz się po trochu codziennie — liczba „Na dziś” na pierwszym ekranie mówi, ile czeka.</p>
  <p class="note">Na klawiaturze: <kbd>Spacja</kbd> pokazuje odpowiedź / ocenia „Dobrze”, <kbd>1</kbd>–<kbd>4</kbd> to oceny od „Jeszcze raz” do „Łatwe”, <kbd>Z</kbd> cofa.</p>
</section>

<section>
  <h2>7. Ustawienia</h2>
  <ul>
    <li><strong>Nowe karty dziennie</strong> — ile nowych kart pojawia się każdego dnia (20 to dobry start; zmniejsz, jeśli powtórek robi się za dużo).</li>
    <li><strong>Maks. powtórek dziennie</strong> — górny limit powtórek.</li>
    <li><strong>Algorytm planowania</strong> — <strong>FSRS</strong> (domyślny) to nowoczesny algorytm Anki; uczy się, jak trudna jest dla Ciebie każda karta, i tak rozkłada powtórki, żeby było ich mniej. <strong>SM‑2</strong> to klasyczny algorytm.</li>
    <li><strong>Docelowa zapamiętywalność</strong> — na ile pewnie chcesz pamiętać kartę, gdy się pojawi. 90% to złoty środek; 95% mniej więcej podwaja liczbę powtórek.</li>
    <li><strong>Kroki nauki</strong> — minuty między powtórzeniami zupełnie nowej karty (domyślnie <code>1, 10</code>).</li>
    <li><strong>Motyw</strong> i <strong>Język</strong>.</li>
  </ul>
</section>

<section>
  <h2>8. Kopie zapasowe i powrót postępów do Anki</h2>
  <ul>
    <li><strong>Kopia zapasowa wszystkiego (.zip)</strong> (menu ⋯ albo Ustawienia → Dane) zapisuje wszystkie talie, postępy i media w jednym pliku. Co jakiś czas odłóż go na iCloud Drive albo wyślij do siebie.</li>
    <li><strong>Przywróć z kopii…</strong> wczytuje taki plik — także na innym urządzeniu; tak przenosisz się na nowego iPada albo komputer.</li>
    <li><strong>Eksportuj .apkg</strong> na stronie talii tworzy plik Anki z aktualnymi postępami. Zaimportuj go w Anki na komputerze przez <em>Plik → Importuj</em>.</li>
    <li>W Ustawieniach stuknij raz <strong>Poproś o trwałe przechowywanie</strong>, żeby przeglądarka nigdy nie usunęła talii dla zwolnienia miejsca.</li>
  </ul>
</section>

<section>
  <h2>Problemy?</h2>
  <ul>
    <li><em>„Ta talia używa najnowszego formatu Anki”</em> — wyeksportuj ponownie z zaznaczoną opcją <strong>Obsługa starszych wersji Anki</strong> (krok 2).</li>
    <li><em>Brakuje obrazków</em> — talia została wyeksportowana bez <strong>Dołącz media</strong>.</li>
    <li><em>Nic do powtórki</em> — wszystkie karty są zaplanowane na później. Wróć jutro albo zwiększ <em>Nowe karty dziennie</em>.</li>
    <li><em>Talie zniknęły</em> — dane Safari zostały wyczyszczone. Przywróć ostatnią kopię zapasową.</li>
  </ul>
</section>`,
};

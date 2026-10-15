# Rondo – UI-Neuaufbau

> Ziel: Rondo soll nicht mehr wie eine Standard-App aussehen, sondern wie eine Fußball-App mit eigenem Charakter. Vor allem soll sie auf dem Handy mit einer Hand schnell und ohne Nachdenken bedienbar sein.
> Dieser Plan ergänzt [PLAN.md](PLAN.md). Datenmodell, Supabase, Routen und Geschäftslogik bleiben gleich. Neu gebaut wird nur die **Oberfläche**.

---

## 0. Arbeitsanweisungen

- Es gelten die Regeln aus PLAN.md, Abschnitt 0: Phase für Phase arbeiten, nach jeder Phase anhalten und auf OK warten, vor jedem Abschluss `typecheck`, `lint`, `test` grün, nach jeder Phase committen.
- Zusätzlich muss vor jedem Phasen-Abschluss **`npm run test:browsers` grün** sein (UI und Barrierefreiheit in Chromium, Firefox, Opera). Die Barrierefreiheit darf nicht schlechter werden.
- Jede Phase endet mit **Vorher/Nachher-Screenshots** (375 px, hell und dunkel) der betroffenen Seiten (`npm run test:screens`).
- **Nicht angefasst werden:** `features/*/api.ts`, die TanStack-Query-Composables, Pinia-Stores, Router-Pfade, Supabase. Neu gebaut werden Views, Komponenten, Styles und Icons.
- Keine UI-Komponentenbibliothek (wie in PLAN.md). Schriften werden **selbst gehostet** (DSGVO: kein Google-Fonts-CDN).
- Wenn ein Bildschirm umgebaut ist, wird sein alter Code im selben Schritt gelöscht. Es soll keine zwei parallelen UIs auf Dauer geben.

---

## 1. Befund: Was heute generisch oder umständlich ist

| Problem | Beispiel |
|---|---|
| Alles ist eine weiße Karte mit Rahmen und Schatten, nichts sticht heraus | Termin-Detail: Antwort, Plan und Infos sind gleich gewichtet |
| Systemschrift, keine typografische Persönlichkeit | Überschriften und Zahlen wirken wie ein Formular |
| Grün ist Marke, „Training“, „Zusage“ und Link zugleich | Man erkennt nicht, was klickbar ist und was nur Status zeigt |
| Zu viele gleichrangige Knöpfe | Plan-Editor: ↑ ↓ Notiz Gruppen ✕ pro Übung, darunter 4 Aktionen |
| Navigation ist uneinheitlich | Zurück mal im Kopf, mal als Link „‹ Zum Termin“ |
| Der Kopfbereich kostet Platz und bringt wenig | Vereinsname, Team und Wechsel-Icon stehen auf jeder Seite |
| Lange Formularseiten statt kurzer Abläufe | „Neues Training“: alle Felder auf einmal |
| Wichtige Aktion scrollt weg | „Bist du dabei?“ verschwindet unter der Navigation |
| Kein Feedback mit Rückgängig | Absagen und Löschen ohne Undo, Ladezustände nur als „Lädt …“ |
| Emoji als Logo, Icons gemischt (✓ ? ✗ als Text) | Wirkt unfertig |

---

## 2. Prinzipien

1. **Daumen zuerst.** Hauptaktionen liegen im unteren Drittel des Bildschirms (Bottom Sheets, Aktionsleiste unten, kein wichtiger Knopf oben rechts).
2. **Eine Hauptaktion pro Bildschirm.** Alles andere ist sekundär, liegt im Überlaufmenü (⋯) oder ist per Wischen erreichbar.
3. **Drei-Sekunden-Regel für Spieler.** Nach dem Öffnen sieht der Spieler sofort: Was ist als Nächstes, bin ich dabei, welche Gruppe habe ich, und kann direkt antworten.
4. **Kluge Vorgaben statt Formulare.** Ort, Uhrzeit und Dauer werden aus dem letzten Termin übernommen, Felder erscheinen erst, wenn man sie braucht.
5. **Farbe hat Bedeutung.** Die Vereinsfarbe ist Akzent und zeigt Aktionen. Typfarben (Training/Spiel/Event) und Antwortfarben (Zusage/Vielleicht/Absage) kennzeichnen nur Inhalte. Farbe ist nie das einzige Merkmal.
6. **Sofortiges Feedback.** Optimistische Updates, Snackbar mit „Rückgängig“, Skeletons statt „Lädt …“, kurze Vibration bei Zu- und Absage (falls verfügbar).
7. **Weniger Kästen.** Listen und Abschnitte statt verschachtelter Karten. Karten nur dort, wo sie ein Objekt darstellen (z. B. ein Termin).

---

## 3. Designrichtung (Vorschlag: „Spieltag“)

Der Vorschlag wird in Phase U0 mit Alternativen als Klick-Mockup vorgelegt. Gebaut wird erst nach deiner Entscheidung.

- **Typografie:** eine kräftige, schmale Display-Schrift für Überschriften, Datum und Zahlen (z. B. *Barlow Condensed* oder *Saira Condensed*, wie auf Anzeigetafeln und Trikotnummern) plus eine gut lesbare Textschrift (z. B. *Inter*). Zahlen in Tabellenziffern.
- **Farbe:** ruhige, leicht warme Grundfläche, ein tiefer Dunkelmodus als gleichwertiges Theme. Vereinsfarbe als Akzent (Logik aus Abschnitt 9 bleibt: Kontrast ≥ 4,5:1).
- **Formen und Motive:** große Datumsblöcke wie auf einem Spielplan, Leibchen als echtes Trikot-Icon mit Farbe und Namen, dezente Spielfeldlinien als Gestaltungselement (z. B. im Kopf der Startseite), Trikotnummern statt Avatar-Platzhaltern.
- **Icons:** ein einheitliches, eigenes Linien-Icon-Set (24 px, 2 px Strich) inklusive Zusage-, Vielleicht- und Absage-Icon. Kein Emoji mehr, auch nicht im Logo.
- **Bewegung:** kurze, sinnvolle Übergänge (Sheet gleitet hoch, Antwort-Knopf „rastet ein“, Listen-Einträge blenden ein). `prefers-reduced-motion` wird respektiert.
- **Logo:** einfache Wortmarke „Rondo“ mit Symbol (z. B. Kreis aus Punkten wie bei der Übung), als SVG, auch für App-Icon und Splash.

---

## 4. Neue Informationsarchitektur

**Unten vier Tabs, Profil oben im Kopf:**

| Tab | Spieler | Trainer |
|---|---|---|
| **Start** | Nächster Termin mit Antwort, eigene Gruppe, offene Antworten | Nächster Termin mit „Wer kommt?“, offene Aufgaben (Plan nicht veröffentlicht, Kader nicht nominiert, Antworten fehlen) |
| **Termine** | Liste nach Wochen gruppiert, Antwort direkt in der Zeile | dazu ⊕ für neuen Termin |
| **Training** | Übungen ansehen | Übungsbibliothek, Taktiktafel, Vorlagen (Segmente oben) |
| **Team** | Kader, Statistik | dazu Einladen, Abwesenheiten, Verein/Belegungsplan für Admins |

- **Kopf:** schlank, mit Seitentitel, Zurück-Pfeil und rechts dem eigenen Profilbild (führt zu Profil/Einstellungen). Mannschaftswechsel über Antippen von Vereinslogo und Teamname als Bottom Sheet. Der Kopf wird beim Scrollen kleiner.
- **Zurück** ist immer derselbe Pfeil oben links. Es gibt keine Text-Links wie „‹ Zum Termin“ mehr.
- **Unterseiten eines Termins** (Plan, Gruppen, Kader) liegen als Segmente im Termin, nicht als eigene Seiten mit eigener Navigation.
- Die Routen aus PLAN.md bleiben erreichbar (Deep Links, Push), neue Routen kommen nur dazu.

---

## 5. Technischer Aufbau

```
src/ui/                 # neues Design-System (ersetzt src/components/Base*)
  tokens/               # Farben, Typo, Abstände, Radien, Schatten, Bewegung (SCSS + CSS-Variablen)
  fonts/                # selbst gehostete WOFF2-Dateien
  icons/                # eigenes SVG-Icon-Set + <UiIcon>
  primitives/           # UiButton, UiIconButton, UiInput, UiSelect, UiSwitch, UiChip, UiSegmented,
                        # UiStepper, UiListRow, UiSection, UiAvatar, UiBadge, UiSkeleton
  patterns/             # AppShell, TopBar, TabBar, BottomSheet (ziehbar), ActionBar (sticky unten),
                        # Snackbar mit Undo, Fab, OverflowMenu, SwipeRow, EmptyState, DateBlock,
                        # BibChip (Leibchen), AnswerControl (Zu-/Absage), PullToRefresh
```

- Eine Entwickler-Seite `/dev/ui` (nur im Dev-Build) zeigt alle Bausteine in hell und dunkel, zum schnellen Prüfen.
- Jeder Baustein bekommt Vitest-Tests für Tastatur, ARIA und Zustände. Das BottomSheet wird zum Fokus-Fallen-Dialog mit Escape und Wischen nach unten.
- Die E2E-Tests nutzen Rollen und Beschriftungen. Barrierefreie Namen bleiben möglichst gleich, damit die Tests nur dort angepasst werden müssen, wo sich Abläufe wirklich ändern.
- Performance: Schriften mit `font-display: swap` und vorab geladen, Icons als Sprite oder Inline-SVG, Ziel ist ein LCP unter 2,5 s auf einem Mittelklasse-Handy (Lighthouse Mobile).

---

## 6. Phasen

### Phase U0 – Richtung festlegen
- [ ] Screenshot-Bestand aller Hauptseiten als „Vorher“ sichern (`docs/ui/before/`)
- [ ] 2–3 Designrichtungen als klickbare Mockups für 3 Schlüsselseiten: Spieler-Start, Termin-Detail, Plan-Editor (hell und dunkel, 375 px)
- [ ] Vorschlag für Tab-Struktur und Navigation (Abschnitt 4) im Mockup erlebbar machen
- [ ] Entscheidung festhalten: Richtung, Schriften, Logo-Idee, Tab-Struktur

**Abnahme:** Du hast eine Richtung gewählt. Erst danach wird gebaut.

### Phase U1 – Fundament
- [ ] Tokens v2 (inkl. Dunkelmodus, Vereinsfarbe, Bewegung), Schriften selbst gehostet, Icon-Set
- [ ] Primitives und Patterns aus Abschnitt 5, mit Unit-Tests
- [ ] Neue AppShell: TopBar (schrumpft beim Scrollen, Profil-Avatar), TabBar mit Safe Area, Mannschaftswechsel als Sheet
- [ ] Snackbar mit „Rückgängig“ und Skeletons als Standard für Mutationen und Laden
- [ ] Entwickler-Seite `/dev/ui`
- [ ] Neues Logo und App-Icon (Manifest)

**Abnahme:** Alle Bausteine laufen auf `/dev/ui` in hell und dunkel und bestehen axe. Die App läuft schon in der neuen Shell (Inhalte noch alt).

### Phase U2 – Spieler-Kern
- [ ] **Start:** großer Block „Als Nächstes“ mit Datum, Uhrzeit, Ort, eigener Leibchenfarbe bzw. Nominierung und Antwort-Knöpfen. Darunter „Noch offen“ (unbeantwortete Termine) mit Antwort in der Zeile
- [ ] **Termine:** nach Wochen gruppiert mit festem Wochenkopf beim Scrollen, kompakte Zeilen mit Datumsblock, Typ-Kennung und Antwort; vergangene Termine darunter; Filter als Sheet
- [ ] **Termin-Detail:** Kopfbereich in Typfarbe, Antwort als feste Leiste unten (immer erreichbar), Plan als Zeitleiste mit eigener Gruppe, Treffpunkt mit Link zur Karten-App
- [ ] **Absage:** Sheet mit großen Grund-Chips, Absage mit einem Tipp, Bemerkung optional; Snackbar „Abgesagt · Rückgängig“
- [ ] Übungsdetail für Spieler: Animation bzw. Video in voller Breite, Beschreibung darunter

**Abnahme:** Ein Spieler sagt vom App-Start aus mit **einem Tipp** zu und erkennt seine Gruppe ohne Scrollen. Die Absage mit Grund braucht höchstens 2 Tipps.

### Phase U3 – Trainer-Kern
- [ ] **Termin anlegen** über ⊕ als geführtes Sheet: Typ wählen, Datum, dann fertig. Ort, Uhrzeit, Dauer und Anmeldeschluss werden vom letzten gleichartigen Termin übernommen und sind änderbar. Serien und Spiele haben je einen zusätzlichen Schritt.
- [ ] **Wer kommt?** Zähler als große Zahlen, Namen als Trikotnummer-Chips je Status, live; Antwort für Spieler ohne Konto per Tipp auf den Namen
- [ ] **Plan-Editor:** kompakte Übungszeilen mit Ziehgriff, Dauer als Stepper (− 10 +), Notiz/Gruppen/Löschen über ⋯ oder Wischen; eine feste Leiste mit Gesamtzeit und „Veröffentlichen“; „Übung hinzufügen“ als einzige Hauptaktion, Kopieren/Vorlage im ⋯-Menü
- [ ] **Gruppen:** Leibchen-Spalten, Spieler antippen und dann Gruppe antippen (und Ziehen), Schnellaktionen (zufällig, nach Positionen, wie vorher) im ⋯-Menü, Hinweis bei nicht eingeteilten Spielern als feste Leiste
- [ ] **Nominierung:** drei Bereiche (Startelf/Bank/Reserve) mit Zähler; Spieler per Tipp durchschalten
- [ ] Termin absagen, bearbeiten und löschen über ⋯ mit Bestätigungs-Sheet; Löschen mit Undo

**Abnahme:** Der Trainer legt ein Training mit übernommenen Vorgaben in **höchstens 4 Tipps** an, baut einen Plan aus 3 Übungen und veröffentlicht ihn, ohne zu scrollen, um den Veröffentlichen-Knopf zu finden.

### Phase U4 – Training und Bibliothek
- [ ] Übungsbibliothek: Kacheln mit Vorschaubild (Standbild der Animation oder Video-Thumbnail), Suche und Kategorie-Chips immer sichtbar
- [ ] Übung anlegen/bearbeiten in Abschnitten (Basis, Material, Medien) statt einer langen Seite
- [ ] Taktiktafel mobil: Spielfeld maximal groß, Material-Leiste und Zeitleiste unten, Eigenschaften als Sheet
- [ ] Vorlagen: Liste mit Gesamtdauer und Übungsanzahl, „Auf Training legen“ als Sheet

**Abnahme:** Eine Übung finden, öffnen und einem Training hinzufügen geht flüssig mit einer Hand. Die Taktiktafel ist auf 375 px ohne Zoomen bedienbar.

### Phase U5 – Team, Verein, Profil
- [ ] Kader: Nummer, Name, Positionen, Status-Icon; Filter als Chips; Bearbeiten als Sheet
- [ ] Statistik visuell: Beteiligungsbalken, sortierbar, eigene Zeile hervorgehoben
- [ ] Profil und Einstellungen als gruppierte Listen (Konto, Benachrichtigungen, Abwesenheiten, Daten und Datenschutz, Sprache, Darstellung hell/dunkel/automatisch)
- [ ] Verein, Mannschaften, Einladungen, Logo/Farbe und Belegungsplan im neuen Stil; Belegungsplan als Tagesansicht mit Wischen zwischen Tagen

**Abnahme:** Alle Team- und Profilseiten im neuen Design, keine alten Base-Komponenten mehr in diesen Bereichen.

### Phase U6 – Einstieg und Leerzustände
- [ ] Login, Registrierung und Passwort-Reset neu: Wortmarke, kurze Formulare, Passwort anzeigen, Fehlermeldungen direkt am Feld
- [ ] Einladung `/join/:token`: Vereinslogo, Mannschaft und Rolle groß, ein Knopf „Beitreten“
- [ ] Erster Start ohne Mannschaft: zwei klare Wege („Verein gründen“ / „Ich habe einen Einladungslink“)
- [ ] Alle Leerzustände mit kleiner Illustration (Linienstil passend zum Icon-Set) und genau einer Aktion

**Abnahme:** Ein neuer Spieler kommt vom Einladungslink bis zur ersten Zusage, ohne nachzudenken.

### Phase U7 – Feinschliff und Abnahme
- [ ] Übergänge und Mikroanimationen vereinheitlichen, `prefers-reduced-motion` prüfen
- [ ] Alte Komponenten (`src/components/Base*`, alte Tokens) entfernen
- [ ] Lighthouse Mobile: Performance ≥ 90, Barrierefreiheit 100 auf Start, Termine, Termin-Detail
- [ ] Usability-Test mit 3–5 Personen (Spieler und Trainer) anhand der Aufgaben aus Abschnitt 7, Erkenntnisse umsetzen
- [ ] Vorher/Nachher-Screenshots aller Hauptseiten in `docs/ui/`

**Abnahme:** Alle Ziele aus Abschnitt 7 erreicht, alle Test-Suiten grün in allen Browsern.

---

## 7. Messbare Ziele

| Aufgabe | Ziel |
|---|---|
| Spieler: App öffnen → für nächsten Termin zusagen | 1 Tipp, < 5 s |
| Spieler: Absage mit Grund | ≤ 2 Tipps nach dem Absage-Knopf |
| Spieler: eigene Gruppe/Leibchenfarbe fürs nächste Training erkennen | ohne Scrollen |
| Trainer: Training mit übernommenen Vorgaben anlegen | ≤ 4 Tipps |
| Trainer: sehen, wer zum nächsten Termin kommt | von Start aus ohne Navigation |
| Trainer: Plan veröffentlichen | Knopf immer sichtbar |
| Alle Bedienelemente | ≥ 44 × 44 px, Hauptaktionen im unteren Bildschirmdrittel |
| Barrierefreiheit | axe ohne Verstöße (WCAG 2.1 AA), hell und dunkel, alle Browser |

---

## 8. Offene Entscheidungen (in Phase U0)

1. **Neuaufbau oder Umbau?** Empfehlung: Neuaufbau der Oberfläche (neues `src/ui/`, Views neu geschrieben) bei unveränderter Daten- und Logikschicht. So gibt es ein durchgängiges neues Bild, ohne das Risiko, Supabase-Logik neu schreiben zu müssen.
2. **Designrichtung, Schriften und Logo:** Auswahl anhand der Mockups.
3. **Tab-Struktur:** Vorschlag aus Abschnitt 4 (Start, Termine, Training, Team plus Profil oben) oder die bisherige Aufteilung beibehalten.
4. **Darstellung:** Soll es zusätzlich zu „automatisch“ eine feste Wahl hell/dunkel im Profil geben? (Vorschlag: ja)

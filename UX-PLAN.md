# Rondo – UX-Durchsicht Oktober 2026 (Phasen X1–X7)

Ergebnis einer Playwright-Tour am 25.10.2026 (einem Sonntag) mit den Entwicklungsdaten (`npm run seed:dev`):
rund 40 Seiten als Spieler (`luca@`), Trainer (`trainer.u17@`) und Vereins-Admin (`vorstand@`),
375 × 740 px, hell und dunkel. Pro Seite wurden gemessen: Seitenhöhe, Bedienelemente unter dem
Falz, Touch-Ziele unter 44 px, waagerechtes Scrollen, Konsolenfehler. Belege: `docs/ui/ux-review/`.

Es gelten die Arbeitsanweisungen aus [PLAN.md](PLAN.md), Abschnitt 0, und aus
[UI-PLAN.md](UI-PLAN.md), Abschnitt 0 (u. a. `npm run test:browsers` grün, Screenshots vorher/nachher).

## Was schon gut ist

- **Technisch sauber:** keine Konsolenfehler, nirgends waagerechtes Scrollen, Touch-Ziele fast überall
  ≥ 44 px (Ausnahme: die Balken in der Statistik). 49 von 50 Browser-Tests grün (`chromium` + `phone`).
  Der eine Fehler war der Push-Versand, weil der lokale Edge-Functions-Container nicht lief –
  ein Umgebungsproblem, kein UI-Fehler.
- **Spieler-Kern:** Zusagen geht mit einem Tipp von Start aus, die eigenen Leibchen sind ohne Scrollen
  sichtbar, die Antwortleiste im Termin-Detail ist immer erreichbar.
- Termin anlegen (Art wählen → Formular), der Plan-Editor mit Stepper und fester Leiste und die
  Statistik sind klar und gut bedienbar.

## Befund

### A. Fehler und Ungereimtheiten

| # | Wo | Was passiert | Beleg |
|---|---|---|---|
| A1 | Start, Belegungsplan | Am Wochenende zeigt die Wochenleiste die **abgelaufene Woche**. Sonntag, 25.10.: Leiste Mo 19.–So 25., der nächste Termin (Di 27.) fehlt darin. Der Belegungsplan zeigt nur Mo–Fr und am Sonntag deshalb nur Vergangenes (KW 43, alles schraffiert); Lösung siehe X2. | `player-home-light.png`, `admin-schedule-light.png` |
| A2 | Gruppen | Bei einer Übung ohne Gruppen steht oben „Noch nicht eingeteilt (11)“ und unten zugleich „Alle Zusagen sind eingeteilt“ (`GroupsView.vue`: Warnliste wird ohne Gruppen geleert). | `coach-groups-light.png` |
| A3 | Animation einer Bibliotheksübung | Der Trainer liest „Nur Trainer können Animationen … bearbeiten“. Die Seite hat keine Überschrift, keinen Zurück-Pfeil und keinen Knopf „In meine Mannschaft kopieren“. Das ist eine Sackgasse. | `coach-drill-animation-light.png` |
| A4 | Spiel-Detail (Trainer) | „Du bist für dieses Spiel nicht nominiert“ wird dem Trainer angezeigt. | `coach-match-detail-light-full.png` |
| A5 | Nominierung | Spieler mit Absage (Paul Richter, Urlaub) oder ohne Antwort stehen ohne Hinweis in der Startelf. Nur „(Vielleicht)“ ist markiert. | `coach-match-detail-light-full.png` |
| A6 | Termin/Verein nicht ladbar | Es kommt nur eine rote Zeile („Termin konnte nicht geladen werden.“), ohne Überschrift, ohne Erklärung und ohne Weg zurück. | gefunden über einen fremden Termin-Link |
| A7 | Team-Bereich | „Statistik“ hat einen Zurück-Pfeil, die gleichrangigen Reiter „Kader“ und „Mannschaften“ nicht (`meta.back: 'squad'`). | `coach-stats-light.png` |
| A8 | Dunkelmodus | Der Hauptknopf „Ich bin dabei“ (hellblau, dunkle Schrift) sieht aus wie der **deaktivierte** „Gespeichert“-Knopf im hellen Modus. | `coach-training-detail-dark.png` |
| A9 | Training › Trainings | Wenn die Marke „Veröffentlicht“/„Plan verfügbar“ daneben steht, bricht die Uhrzeit „18:30 – 20:00“ um. | `coach-training-light.png` |

### B. Platz und Bedienung

| # | Wo | Was auffällt |
|---|---|---|
| B1 | Termin-Detail | Antwortleiste und Tab-Leiste belegen zusammen **≈ 330 von 740 px (45 %)**. Für den Inhalt bleibt ein Streifen, der Trainingsplan ist halb verdeckt. |
| B2 | Spiel-Detail (Trainer) | **3.400 px** lang. „Spieltagskader“ steht zweimal da (Zusammenfassung oben, Editor ganz unten). „Wer kommt?“ besteht aus 16 Zeilen in voller Breite. Zum Nominieren muss man an allem vorbeiscrollen. |
| B3 | Termin-Detail Training (Trainer) | „Wer kommt?“ besteht ebenfalls aus 16 Zeilen in voller Breite (UI-PLAN U3 wollte Trikotnummer-Chips). |
| B4 | Verein (Admin) | **4.000 px** lang. Jedes der 25 Mitglieder hat einen großen Knopf „Zum Admin machen“. Die einmalige Einrichtung (Logo) steht oben, die Alltagsaufgabe (Trainer einladen) darunter. |
| B5 | Übungen | Ohne Animation zeigen alle Kacheln dasselbe Platzhalterbild. Pro Bildschirm passen nur 2 Übungen. |
| B6 | Bereichsleiste Training | Der 4. Reiter „Vorlagen“ ist bei 375 px abgeschnitten, und nichts deutet aufs Wischen hin. |
| B7 | Formulare Training/Spiel | „Speichern“ steht am Seitenende (beim Spiel unter dem Falz), im Übungsformular aber in einer festen Leiste. Uneinheitlich. |
| B8 | Kader | Zwei Filterzeilen (Status, Position) stehen vor der Liste, die Positionen sind abgeschnitten. Für Spieler ist der Statusfilter unnötig. |
| B9 | viele Listen | Reiter und Überschrift doppeln sich („TERMINE“ + „Termine“, „Training“ + „Nächste Trainings“, „KADER“ + „Kader“). Das kostet ~80 px über jeder Liste. |

### C. Informationsarchitektur (was liegt wo)

| # | Thema | Befund |
|---|---|---|
| C1 | Trainer-Start | Er ist der Spieler-Start plus Zahlen. Die in UI-PLAN Abschnitt 4 versprochenen **offenen Aufgaben** (Plan nicht veröffentlicht, Kader nicht nominiert, Antworten fehlen) gibt es nicht. |
| C2 | Trainer antwortet selbst | Der Trainer sieht „Ich bin dabei“ als Hauptaktion auf Start und Termin-Detail, dazu „Du hast 3 Termine noch nicht beantwortet“ und „Alle zusagen“. Seine Hauptaufgabe (Plan, Kader) tritt dahinter zurück. |
| C3 | Trainings doppelt | Training › Trainings ist für Spieler eine Teilmenge von „Termine“ und bringt ihnen nichts. Für Trainer ist es als Planungsübersicht sinnvoll. |
| C4 | Belegungsplan an drei Stellen | Er steht unter Termine › Belegungsplan, als Karte unten im Training-Tab und auf der Vereinsseite. Spieler lesen dort „freie Zeiten reservieren“, dürfen aber nicht reservieren. |
| C5 | Mannschaft/Verein an drei Stellen | Kopf-Umschalter, Team › Mannschaften und Profil › Meine Vereine. Spieler sehen dazu groß „Weiteren Verein anlegen“. |
| C6 | Abwesenheit versteckt | Abwesenheit eintragen (Urlaub, häufige Spieleraktion, Usability-Aufgabe S6) liegt im Profil an 5. Stelle: Avatar → scrollen → eintragen. |
| C7 | Belegungsplan ohne Wochenende und ohne Spiele | Der Kalender zeigt nur Mo–Fr, 15:00–20:30 (die buchbaren Zeiten). Heimspiele, meist am Wochenende, tauchen gar nicht auf, obwohl sie einen Platz belegen. Ein Spiel hat nur einen Freitext-Ort und keine Verbindung zu einem Platz; dass es „auf diesem Feld“ stattfindet, lässt sich heute nicht feststellen. (Wunsch des Nutzers, 25.10.2026) |

## Annahmen (bitte korrigieren, falls anders gewünscht)

- **C2 Trainer-Antwort:** Trainer können weiter zu- und absagen. Auf Start und Termin-Detail wird ihre
  Antwort aber zur kleinen Nebenaktion, und die Hinweise „noch nicht beantwortet“ / „Alle zusagen“
  zählen für Trainer nicht. Alternative: Trainer antworten gar nicht.
- **B1 Tab-Leiste:** Laut F1 ist die Tab-Leiste überall sichtbar. Vorschlag: Sie bleibt, **blendet sich
  aber beim Runterscrollen aus** und kommt beim Hochscrollen zurück. Nach einer Antwort wird die
  Antwortleiste zu einer schmalen Zeile („✓ Du bist dabei · ändern“).
- **C3:** Spieler bekommen im Training-Tab keine Trainingsliste mehr, nur die Übungen. Ihre Trainings
  finden sie unter „Termine“.
- **C7 Platz eines Heimspiels:** Beim Heimspiel wählt der Trainer optional den Platz des Vereins
  (und ganz oder Hälfte A/B; Standard: ganz). Nur Spiele mit `is_home = true` **und** gewähltem Platz
  erscheinen im Belegungsplan, und zwar nur auf diesem Platz. Auswärtsspiele und Heimspiele ohne
  Platz erscheinen nicht. Der Freitext-Ort wird beim Wählen mit dem Platznamen vorbelegt.
- **C7 Dauer:** Ein Spiel belegt den Platz ab Treffzeit (sonst Anstoß) bis zum Ende (`ends_at`, sonst
  Anstoß + 2 Std.).
- **C7 Buchungsregeln:** Trainings bleiben nur Mo–Fr 15:00–20:30 buchbar. Sa/So werden nur angezeigt.
  Ein Heimspiel auf einem Platz sperrt ihn für neue Trainingsbuchungen in dieser Zeit. Bestehende
  Trainings, die mit einem Spiel überlappen, bekommen einen Konflikt-Hinweis (beide bleiben bestehen).
- **C5:** Der Reiter „Mannschaften“ im Team-Bereich entfällt. Mannschaften wechselt und verwaltet man
  über den Kopf-Umschalter („Mannschaften verwalten“). „Verein anlegen“ wandert klein ins Profil.

## Phasen

### X1 – Fehler und Ungereimtheiten
- [x] A1: Wochenleiste rollierend (heute + 6 Tage) oder ab Samstag die nächste Woche. Unit-Test
      für Sa/So (der Belegungsplan wird in X2 behoben)
- [x] A2: Gruppen-Seite: Übung ohne Gruppen zeigt „Für diese Übung gibt es noch keine Gruppen“ statt
      „Alle eingeteilt“; die Warnung zählt nur Übungen mit Gruppen
- [x] A3: Animation einer fremden Übung: Überschrift, Zurück-Pfeil, Knopf „In meine Mannschaft
      kopieren und bearbeiten“; für Spieler gar nicht verlinkt
- [x] A4: Nominierungs-Satz nur für Spieler
- [x] A5: Nominierung zeigt den Antwortstatus je Spieler (Absage/keine Antwort markiert, Absagen
      ans Ende); Warnung in der Leiste, wenn nominierte Spieler abgesagt haben
- [x] A6: Gemeinsamer Fehler-/„Nicht gefunden“-Zustand mit Überschrift, Erklärung und Knopf zurück
- [x] A7: Kein Zurück-Pfeil auf Reiter-Seiten (Statistik wie Kader)
- [x] A8: Hauptknopf im Dunkelmodus kräftig (Akzent-Fläche), deaktivierte Knöpfe klar anders
      (Umriss/gedämpft, nicht nur heller)
- [x] A9: Trainingszeile: Marke unter die Uhrzeit oder Uhrzeit `white-space: nowrap`

**Abnahme:** Jede Zeile der Tabelle A ist mit einem Browser-Test oder Unit-Test abgedeckt.

### X2 – Belegungsplan: ganze Woche und Heimspiele
- [x] Migration: `events.pitch_id` (→ `pitches`, nur bei `type = 'match'` und `is_home = true`, Platz
      aus dem Verein der Mannschaft) und `events.pitch_part` (`full`/`a`/`b`, nur bei teilbarem
      Platz); Check-Constraints, RLS unverändert (Lesen wie der Termin)
- [x] Spiel-Formular und Schnell-Anlegen: bei „Heim“ Auswahl „Platz (optional)“ mit den Plätzen des
      Vereins (+ Hälfte, wenn teilbar); Ort wird mit dem Platznamen vorbelegt; bei „Auswärts“
      ausgeblendet und geleert
- [x] Belegungsplan zeigt **Mo–So**; die Wochenansicht startet in der Woche von heute (Sonntag
      eingeschlossen). Sa/So sind nicht buchbar und so gekennzeichnet (nicht schraffiert wie
      „vergangen“). Platzbedarf auf 375 px: 7 Tagesspalten wischbar wie heute die Spalten, Start
      bei heute
- [x] Zeitachse: Stunden ergeben sich aus Platzzeiten **und** Heimspielen der Woche (z. B. 10:00
      am Samstag), weiter nur relevante Stunden
- [x] Heimspiele mit Platz als eigener Block auf genau diesem Platz (und dieser Hälfte): Spiel-Farbe
      und Spiel-Icon (nicht nur Farbe), Text „U17 – FC Nachbarort“, Antippen öffnet das Spiel.
      Abgesagte Spiele erscheinen nicht
- [x] Datenbank: Buchen/Eintragen eines Trainings (`book_pitch`, `attach_events_to_pitch`) lehnt
      Zeiten ab, in denen ein Heimspiel den Platz(-teil) belegt (Hinweis `match_on_pitch`);
      überlappende bestehende Trainings bekommen im Kalender und im Termin einen Konflikt-Hinweis
- [x] Spiel-Detail: „Platz“ statt nur Ort, mit Link in den Belegungsplan dieses Tages
- [x] Seed-Daten: ein Heimspiel am Samstag auf einem Platz, eins ohne Platz, ein Auswärtsspiel
- [x] Tests: pgTAP (Constraint, Platz eines fremden Vereins abgelehnt, Buchung gegen Spiel
      abgelehnt), Unit-Tests für Wochentage/Zeitachse, Browser-Test „Heimspiel erscheint nur auf
      seinem Platz, Auswärtsspiel nicht“

**Abnahme:** Am Sonntag zeigt der Belegungsplan die laufende Woche bis heute einschließlich. Ein
Heimspiel mit Platz erscheint am richtigen Tag auf genau diesem Platz (und dieser Hälfte), ein
Heimspiel ohne Platz und ein Auswärtsspiel erscheinen nicht. Ein Training lässt sich nicht in die
Zeit eines Heimspiels auf demselben Platz buchen.

### X3 – Platz auf Detailseiten
- [x] B1: Tab-Leiste blendet sich beim Runterscrollen aus (nicht bei `prefers-reduced-motion`
      ruckartig, Fokus/Tastatur holt sie zurück); Antwortleiste nach einer Antwort schmal
- [x] B2: Spiel-Detail für Trainer mit Reitern **Übersicht · Kader** (wie Übersicht · Plan · Gruppen
      beim Training); „Spieltagskader“ nur einmal
- [x] B3: „Wer kommt?“ kompakt: Zähler bleiben, Namen als Trikotnummer-Chips je Status, Antippen
      öffnet wie bisher die Antwort für Spieler ohne Konto
- [x] B9: Bei Seiten mit Bereichsleiste ist die H1 nur für Screenreader sichtbar (bleibt für
      Fokus und Seitentitel)

**Abnahme:** Termin-Detail: ≥ 60 % des Bildschirms zeigen Inhalt. Spiel-Detail (Trainer) ≤ 2
Bildschirmhöhen pro Reiter. Nominieren ohne Scrollen über „Wer kommt?“.

### X4 – Trainer-Start mit Aufgaben
- [x] C1: Karte „Zu erledigen“ für Trainer auf Start: Training in < 3 Tagen ohne veröffentlichten
      Plan, Spiel ohne Kader, Zusagen nicht in Gruppen, Termine mit vielen fehlenden Antworten –
      jede Zeile führt direkt an die Stelle
- [x] C2: Trainer-Antwort als Nebenaktion (siehe Annahmen); „noch nicht beantwortet“ und
      „Alle zusagen“ zählen für Trainer nicht

**Abnahme:** Vom Start aus erreicht der Trainer die nächste offene Aufgabe mit 1 Tipp.

### X5 – Navigation entrümpeln
- [ ] C3: Training-Tab für Spieler = Übungen (ohne Bereichsleiste); für Trainer bleibt
      Trainings · Übungen · Taktik · Vorlagen
- [ ] B6: Kürzere Reiternamen („Taktik“) und Ausblend-Verlauf am Rand, wenn wischbar
- [ ] C4: Belegungsplan-Karte im Training-Tab entfernen; Spieler sehen den Plan nur lesend ohne
      „reservieren“-Text
- [ ] C5: Reiter „Mannschaften“ entfällt; Kopf-Umschalter bekommt „Mannschaften verwalten“;
      „Verein anlegen“ klein im Profil
- [ ] C6: „Abwesenheit eintragen“ auch auf Start (unter dem nächsten Termin, klein) und im
      Absage-Sheet („Länger weg? Abwesenheit eintragen“)
- [ ] Browser-Tests der Navigation anpassen

**Abnahme:** Usability-Aufgabe S6 (Urlaub eintragen) in ≤ 3 Tipps ohne Scrollen vom Start aus.

### X6 – Verein und Listen
- [ ] B4: Vereinsseite neu ordnen: Mannschaften (mit Trainer einladen) → Belegungsplan/Plätze →
      Admins (kurze Liste + „Admin ernennen“ mit Suche im Sheet) → Erscheinungsbild (Logo, eingeklappt)
- [ ] B5: Übungen als kompakte Liste mit kleiner Vorschau; Kachelansicht nur, wenn es echte
      Vorschauen gibt (oder Umschalter, pro Gerät gemerkt)
- [ ] B7: Termin-Formulare mit fester Speichern-Leiste wie das Übungsformular
- [ ] B8: Kader-Filter hinter einem Filter-Knopf wie bei Übungen; Spieler sehen nur Positionen

**Abnahme:** Vereinsseite ≤ 2 Bildschirmhöhen bis „Admins“. Übungen: ≥ 5 Einträge pro Bildschirm.

### X7 – UX-Tour als dauerhafte Prüfung
- [ ] Die Tour aus dieser Durchsicht als `e2e/ux-tour.spec.ts` (`npm run test:tour`): alle Seiten
      je Rolle, Screenshots hell/dunkel nach `e2e/__tour__/`, Bericht mit Seitenhöhe,
      Bedienelementen unter dem Falz und Touch-Zielen < 44 px
- [ ] Feste Datumsangabe per `page.clock`, damit Wochenend-Fälle (A1, X2) reproduzierbar sind
- [ ] Tipp-Zähler-Tests für die Kernaufgaben aus `docs/ui/usability-test.md` (S1–S6 und Trainer)
- [ ] README-Abschnitt

**Abnahme:** `npm run test:tour` läuft ohne Supabase-Seed-Handarbeit und erzeugt den Bericht.

## Umsetzungsnotizen

### X1
- A1: `stripDays()` (player-view/logic) liefert heute + 6 Tage; die Leiste heißt jetzt „Die nächsten
  7 Tage“. Der Belegungsplan bleibt bis X2 unverändert.
- A2: Ohne Gruppen heißt die Liste „Verfügbar“, die Leiste sagt „Ohne Gruppen – alle zusammen“.
- A3: Animations-Editor hat `meta.back: 'drill'` (Zurück-Pfeil oben, der Textlink „‹ Übung“ ist
  weg). Ohne Recht: Überschrift und Hinweis; Trainer kopieren eine Bibliotheksübung mit einem Tipp
  und landen im Editor der Kopie. Für Spieler war der Editor schon nicht verlinkt.
- A5: `squadCandidates()`/`unavailableNominees()` (events/logic); Absage und „keine Antwort“ stehen
  am Namen und am Ende der Liste, eine gestrichelte Warnung über „Kader speichern“.
- A6: Neuer Baustein `ui/PageProblem.vue` (Seitenüberschrift aus `meta.title`, `UiEmptyState`,
  Knopf zur Übersicht) in Termin, Plan, Gruppen, Übung, Animation, Tafel, Vorlage und Verein, auch
  für „Nur Trainer“ (neues Icon `lock`).
- A8: Deaktivierte `UiButton` sind in allen Varianten grau (`--color-surface-muted`, gedämpfte
  Schrift) statt verblasst; ein ladender Knopf (`aria-busy`) behält seine Farbe. `AnswerControl`
  bleibt bewusst verblasst: Nach dem Anmeldeschluss muss die gewählte Antwort erkennbar bleiben.
- A9: Plan-Marke steht unter Uhrzeit und Ort.
- Tests: Unit-Tests für A1, A3, A5; Browser-Tests `e2e/ux-fixes.spec.ts` für A2, A4–A9.
  Nachher-Bilder: `docs/ui/ux-review/x1-after/`.
- Lokal nicht grün: `e2e/push-delivery.spec.ts` (unabhängig von X1). Die Edge Function läuft, aber
  ihre Anfrage erreicht den Test-Server auf dem Rechner (`host.docker.internal`) nicht –
  vermutlich die Windows-Firewall. `private.push_config` war leer und wurde mit
  `npm run setup:push` neu befüllt.

### X2
- Migration `20261025000100_match_pitch.sql`: `events.pitch_id`/`pitch_part`. Ein Trigger räumt auf
  statt abzulehnen: Auswärtsspiele und andere Termine verlieren den Platz, ohne Hälfte gilt der
  ganze Platz. Ein Platz eines fremden Vereins und Hälften eines nicht teilbaren Platzes werden
  abgelehnt. Wird ein Platz gelöscht, bleibt das Spiel ohne Platz bestehen.
- Belegt wird ab Treffzeit (sonst Anstoß) bis Ende (sonst Anstoß + 2 Std.):
  `private.match_occupied_from/until`. `private.range_taken` berücksichtigt Heimspiele, damit
  sperren `book_pitch` und `attach_events_to_pitch` die Zeit ohne eigene Änderung. Der Hinweis
  bleibt `slot_taken` (kein eigenes `match_on_pitch`); im Kalender sieht man den Grund.
- `public.club_pitch_matches(club, von, bis)`: Vereinsmitglieder sehen Heimspiele aller
  Mannschaften auf Vereinsplätzen (nur Kalender-Angaben, die Termine selbst bleiben teamintern).
- Kalender: Mo–So passt auf 375 px ohne Wischen. In Halb-Spuren (≈ 20 px) steht der
  Mannschaftsname senkrecht und ohne Uhrzeit. Sa/So sind schlicht grau („nicht buchbar“), nicht
  schraffiert wie „vergangen“. Heimspiele sind schraffiert mit Rahmen in Spielfarbe und Wappen
  (`shield`), damit sie auch bei blauer Vereinsfarbe nicht wie eigene Buchungen aussehen. Spiele
  der eigenen Mannschaften sind Links zum Spiel. `?date=yyyy-MM-dd` öffnet die Woche des Datums
  (Link aus dem Spiel-Detail).
- Konflikt: Ein Training über einem Heimspiel bekommt roten gestrichelten Rahmen und Warnsymbol.
  Ein Training auf dem ganzen Platz rückt auf die freie Hälfte, sonst teilen sich beide die Spur.
  Darunter steht ein Hinweis, und im Termin-Detail sehen Trainer
  „Überschneidung mit einem Heimspiel …“ (`useTrainingMatchConflicts`).
- Formulare: Spiel und Schnell-Anlegen zeigen bei „Heim“ die Platzauswahl (`PitchPicker`,
  „Anderer Ort“ = ohne Platz). Mit Platz entfällt das Feld Spielort, der Ort ist der Platzname
  („Rasen · B“).
- Testdaten: Damen-Heimspiel am Sonntag auf dem Rasen, ein Nachholspiel Do 19:00 auf Kunstrasen A
  (Konflikt mit dem U17-Training); das U17-Pokal-Heimspiel bleibt ohne Platz, das U17-Spiel ist
  auswärts.
- Tests: pgTAP `match_pitch.test.sql` (12), Unit-Tests (Woche, Buchbarkeit, Zeitachse, Spiele,
  Überschneidung), Browser-Tests `e2e/schedule-matches.spec.ts` (3). Nachher-Bilder:
  `docs/ui/ux-review/x2-after/`.

### X3
- B1: Die Tab-Leiste gleitet beim Runterscrollen weg (ab 80 px, Schwelle 8 px) und kommt beim
  Hochscrollen, oben, bei jedem Seitenwechsel und bei Tastaturfokus (`:focus-within`) zurück; mit
  `prefers-reduced-motion` blendet sie nur aus. `--nav-offset` folgt, damit Aktionsleisten und
  Snackbar nachrutschen. Der Platzhalter unter `ActionBar` ist jetzt so hoch wie die Leiste
  (vorher fest 96 px).
- Antwortleiste: Öffnet man einen Termin mit schon gegebener Antwort, zeigt sie nur den Status
  („Du bist dabei“) und die drei kleinen Antwortknöpfe. Ändern bleibt ein Tipp, statt
  „Ändern“ + Antwort. Antwortet man auf der Seite, bleibt die volle Leiste stehen (nichts springt).
- B2: Neue Seite `MatchSquadView` (`/events/:id/squad`, `event-squad`), `EventCoachNav` mit
  `type="match"` (Übersicht · Kader). Speichern in fester Leiste; in der Übersicht steht der
  Kader für Trainer nicht mehr (Spieler sehen ihre Nominierung wie bisher).
- B3: „Wer kommt?“ als umbrechende Chips (Nummer, Name, ggf. Grund); Antippen wie bisher. Die
  Kachel „Zusagen x von y“ entfällt für Trainer (steht in „Wer kommt?“).
- B9: Auf neun Bereichsseiten ist die H1 nur für Screenreader da (Fokus nach Seitenwechsel
  bleibt), die Kopf-Knöpfe stehen rechts.
- Gemessen (375 × 740, Testdaten): Termin-Detail eines Spielers 72 % Inhalt oben, 82 %
  gescrollt (vorher ≈ 55 %); Spiel für Trainer: Übersicht 2,00, Kader 2,00 Bildschirmhöhen
  (vorher 4,6 auf einer Seite) – knapp an der Grenze, mit mehr als 16 Spielern darüber.
- Tests angepasst: `ux-fixes.spec.ts` (Nominierung auf dem Reiter Kader). Nachher-Bilder:
  `docs/ui/ux-review/x3-after/`.

### X4
- C1: `CoachTasks` steht beim Trainer ganz oben auf Start. Die Aufgaben kommen aus `coachTasks()`
  (player-view/logic):
  - Plan nicht veröffentlicht (Training in < 3 Tagen) → Plan
  - Kader fehlt (Spiel in < 7 Tagen) → Reiter Kader
  - ≥ 3 Spieler ohne Antwort (in < 7 Tagen, solange die Anmeldung offen ist) → Übersicht
  - Zusagen ohne Gruppe (`unassignedYes()`, nur das nächste veröffentlichte Training, eine
    Abfrage) → Gruppen

  Ohne Aufgaben steht dort „Alles erledigt für die nächsten Tage“.
- C2: Trainer antworten weiter, aber nebenbei:
  - Start: „Deine Antwort“ mit drei kleinen Knöpfen, die Zahlen der Mannschaft stehen darunter.
  - Termin-Detail: immer die schmale Leiste.
  - Terminliste: nur noch die Zahlen der Mannschaft, keine eigenen Antwortknöpfe.
  - „Wartet auf deine Antwort“, der Hinweis „noch nicht beantwortet“ und „Alle zusagen“
    entfallen für Trainer.
  - Push-Erinnerungen gingen schon vorher nur an Spieler.
- Tests: Unit-Tests für `coachTasks`/`unassignedYes`; Browser-Tests `e2e/coach-tasks.spec.ts`
  (jede Aufgabe mit einem Tipp erreichbar, Trainer ohne Erinnerung und „Alle zusagen“).
  Nachher-Bilder: `docs/ui/ux-review/x4-after/`.

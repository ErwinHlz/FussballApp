# Rondo – Wunschliste Oktober 2026 (Phasen F1–F6)

Neue Funktionen und Verbesserungen nach dem UI-Neuaufbau, mit dem Nutzer abgestimmt am 17.10.2026.
Es gelten die Arbeitsanweisungen aus [PLAN.md](PLAN.md), Abschnitt 0: Phase für Phase, am Ende jeder
Phase anhalten, typecheck/lint/test grün, ein Commit pro Phase.

## Annahmen (bitte korrigieren, falls anders gemeint)

- **„Alle zusagen“** ist der Knopf in der Terminliste. Er bleibt immer in der Kopfzeile sichtbar
  (bisher nur, wenn es offene Termine gab) und erklärt sonst, dass nichts offen ist.
- **Karten:** Ein Ort bleibt ein Freitext (Adresse oder Platzname). Daneben kommt „In Karten öffnen“:
  Auf dem Handy öffnet das die Karten-App (Apple Karten auf iOS, sonst Google Maps), am Rechner
  Google Maps im Browser. Kein API-Schlüssel und keine Kosten. Eine Adress-Autovervollständigung
  bräuchte einen Google-API-Schlüssel und ist bewusst nicht dabei.
- **Datenexport:** Der Knopf „Meine Daten herunterladen“ entfällt. Hinweis: Nach DSGVO (Art. 15/20)
  muss eine Auskunft auf Anfrage trotzdem möglich sein. Die Datenschutzerklärung nennt dafür die
  Kontakt-Adresse; die Datenbankfunktion bleibt für solche Anfragen erhalten.
- **Akzentfarbe:** Jedes Konto wählt seine eigene Akzentfarbe in den Einstellungen. Ohne Auswahl gilt
  die Farbe des Vereins (aus dem Logo bzw. vom Admin gesetzt) – der Admin legt also weiter die
  Vereinsfarbe als Standard fest, sie ist aber nicht mehr das letzte Wort.

## Phasen

### F1 – Navigation
- [x] Die Tab-Leiste unten ist auf allen Seiten sichtbar (auch Termin-Detail, Plan, Gruppen, Editoren);
      Aktionsleisten und schwebende Knöpfe sitzen darüber
- [x] Neuer Tab **„Verein“** für Vereins-Admins (führt direkt zur Vereinsverwaltung)
- [x] Bereichsleiste (Training: Einheiten/Übungen/Taktik/Vorlagen, Team: Kader/Statistik/Teams)
      neu gestaltet als Reiter mit Unterstrich und **sticky unter der Kopfzeile**
- [x] Browser-Tests angepasst

### F2 – Testdaten und Debug-Kontowechsel
- [x] `npm run seed:dev` (frontend) füllt die lokale Datenbank: ein Verein mit Vereinsfarbe, zwei
      Mannschaften, Admin, Trainer, 21 Spieler mit Konten, Termine der nächsten Wochen mit Antworten,
      Übungen, ein veröffentlichter Trainingsplan mit Gruppen, Belegungsplan
- [x] Alle Testkonten mit bekanntem Passwort; Liste in einer gemeinsamen Datei
- [x] Debug-Werkzeug (nur im Entwicklungsmodus, nicht im Produktions-Build): schwebender Knopf,
      Liste der Testkonten mit Rolle, ein Tipp meldet sich als dieses Konto an
- [x] README-Abschnitt

### F3 – Termine anlegen
- [x] „+“ öffnet eine **ganze Seite** statt eines Popups (Art wählen → Formular)
- [x] Neues Spiel: **Treffpunkt** (Zeit und Ort) und **Anstoß** direkt im Schnell-Anlegen
- [x] Anmeldeschluss: Überschrift „Anmeldeschluss (vorher)“, Auswahl nur noch „Keiner, 2 Std.,
      6 Std., 12 Std., 1 Tag, 2 Tage“ statt „… Std. vorher“ bei jeder Option
- [x] **Ort** beim Anlegen eingeben (auch im Schnell-Anlegen), mit „In Karten öffnen“ im Formular
      und auf der Termin-Seite (Ort und Treffpunkt)

### F4 – Terminliste und Termin-Detail
- [ ] „live“-Hinweis bei „Wer kommt?“ entfernen
- [ ] „Alle zusagen“ immer in der Kopfzeile der Terminliste
- [ ] Bereichsleiste in „Termine“: **Termine | Belegungsplan**; der Belegungsplan des ganzen Vereins
      als **Wochenkalender** (Tage als Spalten, Plätze/Zeiten als Blöcke, Woche vor/zurück wischen)

### F5 – Übungen
- [ ] Filter der Übungsbibliothek neu gestaltet (Suche + Kategorie-Reiter + Filter-Knopf für den Rest)
- [ ] Überschrift „Das Wichtigste“ im Übungsformular entfernt

### F6 – Verein und Konto
- [ ] Ein Nutzer darf **nur einen Verein verwalten** (Datenbankregel + Hinweis beim Anlegen/Ernennen)
- [ ] Akzentfarbe wandert in die Konto-Einstellungen (Spalte `profiles.accent_color`, Standard =
      Vereinsfarbe); im Verein bleibt nur das Logo (und die Standardfarbe des Vereins)
- [ ] „Meine Daten herunterladen“ entfernt; „Konto löschen“ löscht alle persönlichen Daten
      (Profil, Kader-Einträge mit Antworten, Geräte, Abwesenheiten, Vereine ohne andere Mitglieder) –
      Text im Profil macht das klar
- [ ] Migrationen + pgTAP-Tests

## Umsetzungsnotizen

### F1
- `hideNav` gibt es nicht mehr; die Tab-Leiste fehlt nur beim ersten Start ohne Mannschaft.
- `ActionBar` reicht jetzt bis unter die schwebende Tab-Leiste (kein Inhalt blitzt dazwischen durch)
  und meldet ihre Höhe als `--action-bar-height`; die Snackbar erscheint darüber.
- Tab „Verein“ (Icon Gebäude) nur für Vereins-Admins: Verein der aktiven Mannschaft, sonst der
  verwaltete Verein. Der Belegungsplan (`/clubs/:id/schedule`) bleibt unter „Training“, bis er in F4
  zu „Termine“ wandert; die Platz-Einrichtung gehört zu „Verein“.
- `AreaNav`: Reiter in der Display-Schrift mit Akzent-Unterstrich, sticky unter der Kopfzeile,
  waagerecht wischbar; setzt `--area-nav-height`, damit Wochen-Überschriften darunter kleben.
  `EventCoachNav` (Übersicht/Plan/Gruppen) nutzt dieselbe Leiste (`fill`, `replace`).
- Taktiktafel: Weil die Tab-Leiste bleibt, ist die Auswahlzeile einzeilig (Eigenschaften als
  Zahnrad-Knopf), damit das Material auch mit Auswahl über der Tab-Leiste liegt.

### F2
- Skript `frontend/scripts/seed-dev.mjs` (statt im Backend, weil es `@supabase/supabase-js` braucht);
  läuft nur gegen `localhost`/`127.0.0.1`. Aufräumen über `delete_my_account` der Testkonten
  (Spieler zuerst, Admin zuletzt → Verein wird mit gelöscht), daher beliebig oft ausführbar.
- Trainings entstehen über Buchungen im Belegungsplan (U17 Di/Do Kunstrasen ganz, Damen Mo/Mi
  Hälfte A), wie in der echten App. Historie per `docker exec` (fehlt Docker, wird sie übersprungen).
- Luca Brandt (U17) und Mia Hartmann (Damen) haben noch keine Antworten – zum Ausprobieren.
- Kontowechsler `src/dev/DevAccountSwitcher.vue`, in `App.vue` nur bei `import.meta.env.DEV`
  geladen (im Build entfernt, geprüft). In Browser-Tests (`navigator.webdriver`) ausgeblendet,
  außer `localStorage['rondo.devTools'] = 'on'`; Test `e2e/dev-tools.spec.ts` (übersprungen ohne
  Testdaten).

### F3
- Neue Seite `EventCreateView` unter `/events/new`; die Art steht in `?kind=`, damit „Zurück“ zur
  Auswahl führt. Trainingsserie geht direkt ins ausführliche Formular. `QuickCreateSheet` entfällt.
  „Anlegen“ sitzt in der Aktionsleiste über der Tab-Leiste.
- Spiel: Treffzeit folgt dem Anstoß (Abstand vom letzten Spiel, sonst 60 Min.), bis sie von Hand
  geändert wird; Treffpunkt und Spielort mit Vorschlägen. „Alles anpassen“ übergibt auch
  Treffzeit und Treffpunkt.
- Ortsfelder (`LocationField`): Vorschläge aus früheren Orten und Treffpunkten der Mannschaft
  (`placeSuggestions`, per `<datalist>`), Link „In Karten öffnen“. `lib/maps.ts`: Apple Karten auf
  iPhone/iPad, sonst Google Maps; kein API-Schlüssel.
- Behoben dabei: Ein `<fieldset>` ist mindestens so breit wie sein Inhalt – der Tagesstreifen hat
  die Seite seitlich aufgeschoben (`min-width: 0`), und `scrollIntoView` hat die ganze Seite bewegt
  (jetzt scrollt nur der Streifen).

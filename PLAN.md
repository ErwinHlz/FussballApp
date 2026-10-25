# Rondo – Bauplan für Claude Code

> Arbeitstitel: **Rondo**. Fußball-App für Trainer und Spieler.
> Der Trainer plant Kader, Trainings und Spiele, die Spieler melden sich an oder ab, werden in Übungsgruppen eingeteilt und sehen **vor dem Training** ihren Plan inklusive animierter Übungen und Videos.

---

## 0. Anweisungen an Claude Code (zuerst lesen)

- Lies diese Datei vollständig, bevor du anfängst.
- Arbeite **Phase für Phase** in der angegebenen Reihenfolge. Fang keine neue Phase an, bevor die aktuelle fertig ist und ihre Abnahmekriterien erfüllt.
- Hake erledigte Aufgaben in dieser Datei ab (`- [x]`), damit der Fortschritt sichtbar bleibt.
- **Halte am Ende jeder Phase an**, fasse kurz zusammen, was gebaut wurde und wie man es testet, und warte auf mein OK.
- Frag nach, bevor du vom Datenmodell oder Tech-Stack abweichst.
- Vor jedem Phasen-Abschluss: `npm run typecheck`, `npm run lint` und `npm run test` müssen grün sein.
- Committe nach jeder Phase mit einer aussagekräftigen Nachricht (`feat(phase-4): anmeldung training und spiel`).
- Committe **niemals** Secrets. Supabase-Keys gehören in `.env.local`, eine `.env.example` wird committet.
- Code und Kommentare auf Englisch, UI-Texte über i18n (Deutsch und Englisch).
- Mobile first: Jede Ansicht muss auf 375 px Breite gut bedienbar sein.

---

## 1. Produktziel

### Kernidee
Spieler kommen vorbereitet ins Training. Sie wissen schon vorher, welche Übungen kommen, in welcher Gruppe (Leibchenfarbe) sie sind und wie die Übung abläuft (Animation oder Video). Für Trainings **und** Spiele melden sie sich mit einem Tipp an oder ab.

### Struktur und Rollen
**Verein → Mannschaften → Mitglieder.** Jeder registrierte Nutzer kann einen Verein anlegen und ist dann dessen Admin.

- **Vereins-Admin (club admin):** legt den Verein an, meldet Mannschaften an, bestimmt per Trainer-Einladungslink den Trainer jeder Mannschaft und kann weitere Admins ernennen. Hat in allen Mannschaften des Vereins Trainerrechte.
- **Trainer (coach):** wird per Trainer-Einladungslink einer Mannschaft zugeordnet, lädt Spieler per Einladungslink ein, verwaltet den Kader, legt Trainings und Spiele an, baut Trainingsinhalte, teilt Gruppen ein, nominiert für Spiele, veröffentlicht Pläne.
- **Spieler (player):** tritt per Einladungslink bei (legt dabei ein Konto mit E-Mail und Passwort an), meldet sich für Trainings und Spiele an oder ab, sieht die eigene Gruppe, die Übungen und die Spielinfos.
- Ein Nutzer kann in mehreren Vereinen und Mannschaften sein, mit unterschiedlichen Rollen. Jedes Konto hat eine eindeutige interne ID (UUID).

### Bewusst NICHT im MVP
Chat, Zahlungen, Mannschaftskasse, Mitgliederverwaltung des Vereins (Beiträge, Abteilungen usw.). Der Verein ist nur die Klammer um die Mannschaften. Das machen Spond und SpielerPlus, dort konkurrieren wir nicht.

---

## 2. Tech-Stack

| Bereich | Wahl |
|---|---|
| Build | Vite |
| UI | Vue 3 (Composition API, `<script setup lang="ts">`) |
| Sprache | TypeScript (strict), Typcheck mit `vue-tsc` |
| Styling | SCSS (`sass`), Scoped Styles in Single File Components |
| Routing | Vue Router 4 |
| Server-State | TanStack Query für Vue (`@tanstack/vue-query`) |
| Client-State | Pinia (nur wo nötig, z. B. aktives Team, Board-Editor) |
| Formulare | VeeValidate + Zod (`@vee-validate/zod`) |
| Drag & Drop | `vue-draggable-plus` (SortableJS, touchfähig) |
| Hilfsfunktionen | VueUse |
| Datum | date-fns |
| i18n | vue-i18n (de, en) |
| Backend | Supabase (Auth, Postgres, Row Level Security, Storage, Realtime) |
| Tests | Vitest + Vue Test Utils |
| Linting | ESLint (`eslint-plugin-vue`, `@vue/eslint-config-typescript`) + Prettier |
| Native App | Capacitor (iOS, Android), ab Phase 11 |

Keine UI-Komponentenbibliothek. Eigene Basis-Komponenten (`BaseButton`, `BaseInput`, `BaseCard`, `BaseModal`, `BaseBadge`, `BottomSheet`) mit SCSS.

---

## 3. Styling-Konzept (SCSS)

```
src/styles/
  _tokens.scss     # Farben, Abstände, Radien, Schatten, Schriftgrößen als SCSS-Variablen + CSS Custom Properties
  _mixins.scss     # Breakpoints (mobile first), Fokus-Ring, Truncate, Safe-Area-Insets
  _reset.scss
  _typography.scss
  main.scss        # importiert alles Globale
```

- `_tokens.scss` und `_mixins.scss` per `css.preprocessorOptions.scss.additionalData` in `vite.config.ts` automatisch in jede Komponente einbinden (`@use`, nicht `@import`).
- Farben als CSS Custom Properties auf `:root`, damit ein Dark Mode später nur die Variablen überschreibt.
- Leibchenfarben (Rot, Blau, Gelb, Grün, Orange, Weiß) als eigene Token.
- Komponenten-Styles immer `<style scoped lang="scss">`, Klassennamen nach BEM.
- Touch-Ziele mindestens 44 × 44 px, Safe-Area-Insets für iPhone beachten.

---

## 4. Projektstruktur

```
src/
  app/              # App.vue, Router, Layouts, Plugin-Setup
  components/       # geteilte Base-Komponenten
  features/
    auth/
    teams/
    squad/          # Kader
    events/         # Termine: Trainings und Spiele, Anmeldung
    drills/         # Übungsbibliothek
    training-plan/  # Übungen einer Trainingseinheit
    groups/         # Gruppeneinteilung
    board/          # Taktikboard / Animationen
    player-view/    # Ansicht für Spieler
  lib/              # supabase client, query client, i18n, utils
  stores/           # Pinia-Stores
  styles/
  types/            # generierte DB-Typen + Domain-Typen
  locales/
    de.json
    en.json
supabase/
  migrations/       # SQL-Migrationen, nummeriert
  seed.sql
```

Jedes Feature enthält `components/`, `views/`, `composables/` (TanStack-Query-Composables wie `useEvents()`) und `api.ts` (reine Supabase-Aufrufe).

---

## 5. Datenmodell (Supabase / Postgres)

Alle Tabellen haben `id uuid primary key default gen_random_uuid()` und `created_at timestamptz default now()`, sofern nicht anders angegeben.

```
profiles            (id = auth.users.id, display_name, avatar_url)

clubs               (name, created_by → profiles)

club_members        (club_id → clubs, user_id → profiles,
                     role: 'admin' | 'member',
                     unique(club_id, user_id))
                     -- Ersteller wird automatisch 'admin'; wer einer Mannschaft beitritt, wird 'member'

teams               (club_id → clubs, name, season, created_by → profiles)

team_members        (team_id → teams, user_id → profiles NULL,
                     role: 'coach' | 'player',
                     display_name, shirt_number, positions text[],
                     status: 'active' | 'injured' | 'inactive')
                     -- user_id NULL = Spieler ohne Account (Trainer pflegt ihn manuell)

team_invites        (team_id, token unique, role: 'coach' | 'player', expires_at,
                     created_by, revoked_at NULL)
                     -- Trainer-Einladungen erstellt nur der Vereins-Admin, Spieler-Einladungen auch der Trainer

event_series        (team_id, type: 'training', weekday int, start_time time,
                     duration_min, location, valid_from date, valid_until date)
                     -- wiederkehrende Trainings, erzeugt einzelne events

events              (team_id, type: 'training' | 'match',
                     series_id NULL → event_series,
                     starts_at, ends_at NULL, meet_at NULL, meet_location NULL, location, notes,
                     response_deadline NULL,           -- Anmeldeschluss
                     is_cancelled bool default false, cancel_reason NULL,
                     plan_status: 'draft' | 'published' default 'draft',  -- nur für Training relevant
                     plan_published_at NULL,           -- Zeitpunkt der Veröffentlichung (späte Absagen erkennen)
                     opponent NULL, is_home bool NULL, competition NULL)    -- nur für Spiele

attendances         (event_id → events, member_id → team_members,
                     status: 'yes' | 'no' | 'maybe',
                     reason NULL, reason_note NULL (Freitext),
                     updated_by → profiles (NULL = vom System, z. B. „verletzt“), updated_at,
                     unique(event_id, member_id))
                     -- keine Zeile = noch nicht geantwortet

match_squad         (event_id → events, member_id → team_members,
                     role: 'starter' | 'bench' | 'reserve',
                     unique(event_id, member_id))
                     -- Nominierung für ein Spiel

drills              (team_id NULL = öffentliche Bibliothek, created_by,
                     title, description, category, duration_min,
                     min_players, max_players, equipment text[],
                     video_url NULL, video_path NULL,   -- YouTube-Link oder Storage-Pfad
                     animation jsonb NULL)              -- siehe Abschnitt 6

event_drills        (event_id → events (nur type = 'training'), drill_id,
                     position int, duration_min, coach_notes)

drill_groups        (event_drill_id, name, color)       -- z. B. "Rot", 'red' (Leibchenfarben-Token)

group_assignments   (group_id → drill_groups, member_id → team_members,
                     unique(group_id, member_id))
```

### Row Level Security
- Hilfsfunktionen `is_club_admin(club_id)`, `is_club_member(club_id)`, `is_team_member(team_id)` und `is_team_coach(team_id)` als `security definer`. `is_team_coach` ist auch für Vereins-Admins wahr.
- **Lesen:** Alle Mitglieder eines Teams lesen dessen Termine, Anmeldungen und Nominierungen. Trainingsinhalte (`event_drills`, `drill_groups`, `group_assignments`) sehen Spieler nur, wenn `events.plan_status = 'published'`.
- **Schreiben:** nur Trainer, mit einer Ausnahme: Spieler dürfen die `attendances`-Zeile für ihr eigenes `team_members`-Mitglied anlegen und ändern, solange der Anmeldeschluss nicht überschritten und der Termin nicht abgesagt ist. Trainer dürfen Anmeldungen für alle ändern (z. B. für Spieler ohne Account).
- Öffentliche Drills (`team_id IS NULL`) sind für alle eingeloggten Nutzer lesbar.
- Für jede Tabelle müssen RLS-Policies existieren. Schreib Tests oder SQL-Checks, die zeigen, dass ein Spieler keine fremden Teams sieht und keine fremden Anmeldungen ändern kann.

TypeScript-Typen mit `supabase gen types typescript` nach `src/types/database.ts` generieren.

---

## 6. Animationsformat (Taktikboard)

Gespeichert in `drills.animation` als JSON:

```json
{
  "version": 1,
  "field": "full | half | quarter",
  "durationMs": 8000,
  "objects": [
    { "id": "p1", "type": "player", "color": "#ef4444", "label": "1" },
    { "id": "b1", "type": "ball" },
    { "id": "c1", "type": "cone", "color": "#f97316" }
  ],
  "keyframes": [
    { "t": 0,    "positions": { "p1": [20, 50], "b1": [22, 50], "c1": [50, 50] } },
    { "t": 3000, "positions": { "p1": [48, 45], "b1": [50, 48] } }
  ],
  "annotations": [
    { "type": "arrow", "from": [20, 50], "to": [48, 45], "style": "run | pass | dribble" }
  ]
}
```

- Koordinaten in Prozent des Spielfelds (0–100), damit es auf jeder Bildschirmgröße passt.
- Objekte ohne Position in einem Keyframe behalten die letzte bekannte Position.
- Objekttypen: `player`, `ball`, `cone`, `goal` (Tor ergänzt, weil der Editor Tore platzieren soll).
- **Erweitert (Taktiktafel 2, weiterhin `version: 1`, alle Felder optional):** weitere Typen `goalkeeper`, `coach`, `disc`, `pole`, `dummy`, `minigoal`, `ladder`, `ring`, `zone`, `text`; Objekt-Felder `name` (≤ 16), `rotation` (0–359°), `w`/`h` (Zonen in Metern), `shape` (`rect`/`circle`), `text` (≤ 40); Pfeilstil `line`; Keyframe-Feld `holders` (Ball-ID → Spieler-ID oder `null`): ein gehaltener Ball sitzt am Fuß des Spielers, ein Pass ist ein neuer Halter in einem späteren Keyframe.
- Grenzen: max. 60 Objekte (vorher 40), 30 Keyframes, 60 s; erster Keyframe bei `t = 0`, Zeiten streng aufsteigend. Die Datenbank prüft Version, Feldtyp und Größe (Check-Constraint).
- Zwischen Keyframes wird linear interpoliert (Easing optional).
- Rendering mit SVG in einer Vue-Komponente, Abspielen per `requestAnimationFrame` (oder `useRafFn` aus VueUse).
- Format mit Zod-Schema validieren, Typ daraus ableiten.

---

## 7. Phasen

### Phase 0 – Projekt-Setup
- [x] Vite + Vue 3 + TypeScript (strict) anlegen
- [x] SCSS einrichten: `sass`, Ordner `src/styles/`, Tokens und Mixins global per `additionalData`
- [x] ESLint, Prettier, Vitest, Vue Test Utils einrichten
- [x] Skripte: `dev`, `build`, `typecheck` (`vue-tsc --noEmit`), `lint`, `test`
- [x] Vue Router mit Grundlayout (mobile Bottom-Navigation: Termine, Training, Kader, Profil)
- [x] Pinia und TanStack Query registrieren
- [x] vue-i18n mit `de` und `en`, Sprache aus Browser übernehmen
- [x] Base-Komponenten: `BaseButton`, `BaseInput`, `BaseCard`, `BaseModal`, `BaseBadge`
- [x] Supabase-Client in `src/lib/supabase.ts`, `.env.example` mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`
- [x] `supabase/`-Ordner für lokale Entwicklung (`supabase init`)
- [x] README mit Setup-Anleitung

**Abnahme:** `npm run dev` startet, leere App mit Navigation wird angezeigt, alle Checks grün.

### Phase 1 – Login und Profil
- [x] Migration: `profiles` + Trigger, der beim Registrieren ein Profil anlegt
- [x] Login per Magic Link (E-Mail) über Supabase Auth
- [x] **Geändert:** Registrierung und Login mit E-Mail + Passwort statt Magic Link, „Passwort vergessen“ per Mail
- [x] Auth-Store (Pinia) mit Session, Router-Guard für geschützte Routen, Redirect zum Login
- [x] Profil-Seite: Anzeigename ändern
- [x] Logout

**Abnahme:** Registrieren, Einloggen, Namen ändern und Ausloggen funktionieren.

### Phase 2 – Vereine, Mannschaften und Einladungen
- [x] Migration: `clubs`, `club_members`, `teams`, `team_members`, `team_invites` + RLS + Hilfsfunktionen
- [x] Verein anlegen (Ersteller wird automatisch Vereins-Admin)
- [x] Vereins-Admin meldet Mannschaften an (Name, Saison)
- [x] Vereins-Admin erzeugt pro Mannschaft einen **Trainer-Einladungslink**
- [x] Trainer (und Admin) erzeugen **Spieler-Einladungslinks** (Token, Ablaufdatum, widerrufbar), mit Teilen-Button (Web Share API, Fallback: kopieren)
- [x] Route `/join/:token`: zeigt Verein, Mannschaft und Rolle; ohne Konto direkt registrieren, danach automatisch beitreten
- [x] Vereins-Admin kann weitere Admins ernennen
- [x] Mannschafts-Auswahl, wenn der Nutzer in mehreren Mannschaften ist (aktive Mannschaft im Pinia-Store, in `localStorage` merken)
- [x] Start ohne Verein/Mannschaft: „Verein anlegen“ oder Hinweis auf Einladungslink
- [x] RLS-Tests: Nutzer A sieht Verein/Mannschaft von Nutzer B nicht, Spieler können keine Einladungen erzeugen, Trainer keine Trainer-Einladungen

**Abnahme:** Nutzer legt Verein an, meldet eine Mannschaft an und schickt den Trainer-Link. Der Trainer registriert sich über den Link, schickt einen Spieler-Link, der Spieler registriert sich und erscheint im Kader.

### Phase 3 – Kader
- [x] Kaderliste mit Rückennummer, Positionen, Status
- [x] Spieler ohne Account manuell anlegen (`user_id = NULL`)
- [x] Manuellen Spieler später mit einem beigetretenen Account verknüpfen
- [x] Status ändern (aktiv, verletzt, inaktiv), Filter nach Status und Position
- [x] Rolle ändern (Spieler zu Co-Trainer machen)

**Abnahme:** Trainer pflegt einen vollständigen Kader, Spieler sehen ihn nur lesend.

### Phase 4 – Termine und Anmeldung (Training und Spiel)
- [x] Migration: `event_series`, `events`, `attendances`, `match_squad` + RLS
- [x] **Training anlegen:** Datum, Uhrzeit, Dauer, Ort, Notizen, optional Anmeldeschluss
- [x] **Trainingsserie anlegen:** z. B. „jeden Dienstag und Donnerstag 19:00“ für einen Zeitraum, erzeugt die einzelnen Termine. Einzelne Termine der Serie bleiben einzeln bearbeitbar.
- [x] **Spiel anlegen:** Gegner, Heim/Auswärts, Wettbewerb (Liga, Pokal, Test), Treffpunkt und Treffzeit, Anstoß, Ort, Anmeldeschluss
- [x] Terminliste: kommende Termine chronologisch, Training und Spiel optisch klar unterscheidbar, vergangene Termine einklappbar
- [x] **Anmeldung:** Zusage, Absage, Vielleicht mit einem Tipp direkt in der Liste. Bei Absage optional Grund (Verletzt, Krank, Arbeit, Urlaub, Sonstiges + Freitext)
- [x] Anmeldung ändern bis zum Anmeldeschluss, danach gesperrt (Trainer kann weiterhin ändern)
- [x] **Übersicht für den Trainer:** Zugesagt / Abgesagt / Vielleicht / Keine Antwort mit Namen und Anzahl, live per Supabase Realtime
- [x] Trainer kann Anmeldungen für Spieler ohne Account eintragen
- [x] Verletzte Spieler werden bei neuen Terminen automatisch als „abgesagt (verletzt)“ vorgeschlagen
- [x] **Nominierung für Spiele:** Trainer wählt aus den Zusagen den Spieltagskader (Startelf, Bank, Reserve). Spieler sehen, ob sie nominiert sind.
- [x] Termin absagen (mit Grund), abgesagte Termine bleiben sichtbar, aber durchgestrichen
- [x] Erinnerungs-Hinweis in der App für Spieler, die noch nicht geantwortet haben (Push folgt in Phase 11)
- [x] Unit-Tests für Serienerzeugung und Anmeldeschluss-Logik

**Abnahme:** Trainer legt eine Trainingsserie und ein Spiel an. Spieler melden sich an oder ab, der Trainer sieht live, wer kommt, und nominiert den Kader fürs Spiel.

### Phase 5 – Übungsbibliothek
- [x] Migration: `drills` + RLS
- [x] Übungen anlegen und bearbeiten: Titel, Beschreibung, Kategorie, Dauer, Spielerzahl, Material
- [x] Video als YouTube-Link (eingebettete Vorschau)
- [x] Liste mit Suche und Filter nach Kategorie
- [x] Seed-Daten: 10–15 Standardübungen (Rondo 4v2, Passdreieck, Torschuss, Abschlussspiel usw.) als öffentliche Bibliothek
- [x] Öffentliche Übung ins eigene Team kopieren und anpassen

**Abnahme:** Trainer findet, erstellt und bearbeitet Übungen. Videos werden angezeigt.

### Phase 6 – Trainingsinhalte
- [x] Migration: `event_drills` + RLS
- [x] Zu einem Trainingstermin Übungen aus der Bibliothek hinzufügen und per Drag & Drop sortieren
- [x] Dauer pro Übung überschreiben, Gesamtdauer anzeigen und mit Termindauer vergleichen
- [x] Trainingsplan von einem anderen Termin kopieren
- [x] Plan-Status `draft` / `published`, Button „Plan veröffentlichen“
- [x] Hinweis an den Trainer, wenn Spieler nach Veröffentlichung absagen

**Abnahme:** Trainer baut den Inhalt einer Einheit und veröffentlicht den Plan.

### Phase 7 – Gruppeneinteilung
- [x] Migration: `drill_groups`, `group_assignments` + RLS
- [x] Pro Übung Gruppen anlegen, mit Name und Leibchenfarbe
- [x] Spieler per Drag & Drop in Gruppen ziehen (`vue-draggable-plus`, auch per Touch)
- [x] Nur zugesagte Spieler (und „Vielleicht“, markiert) stehen zur Auswahl, abgesagte sind ausgeblendet
- [x] „Zufällig verteilen“, „Nach Positionen ausgleichen“ und „Gleich wie vorherige Übung“
- [x] Hinweis, wenn ein zugesagter Spieler in keiner Gruppe ist oder nach der Einteilung absagt

**Abnahme:** Trainer teilt für jede Übung alle zugesagten Spieler in farbige Gruppen ein.

### Phase 8 – Spieleransicht
- [x] Startseite für Spieler: nächster Termin oben (Training oder Spiel), mit Zu- und Absage-Buttons
- [x] **Training:** Ablauf der Einheit, pro Übung die eigene Gruppe und Leibchenfarbe hervorgehoben
- [x] **Spiel:** Gegner, Treffpunkt und Treffzeit, Anstoß (Nominierungsstatus auf Wunsch nicht auf der Startkarte, nur auf der Termin-Detailseite)
- [x] Übungsdetail: Beschreibung, Video, (ab Phase 9) Animation
- [x] Die Ansicht muss in unter 10 Sekunden erfassbar sein: wenig Text, große Farben, klare Reihenfolge

**Abnahme:** Spieler öffnet die App, sieht sofort den nächsten Termin, seine Gruppe bzw. Nominierung und sagt zu.

### Phase 9 – Animiertes Taktikboard
- [x] Spielfeld als SVG-Komponente (ganzes, halbes, Viertelfeld)
- [x] Editor: Spieler, Ball, Hütchen, Tore platzieren und verschieben (Pointer Events, Touch)
- [x] Keyframes anlegen: Zeitleiste, Positionen pro Keyframe
- [x] Pfeile für Laufweg, Pass, Dribbling
- [x] Player-Komponente: Abspielen, Pause, Zurückspulen, Geschwindigkeit, Schleife
- [x] Speichern im Format aus Abschnitt 6, mit Zod validieren
- [x] Animation in der Spieleransicht einbinden
- [x] Unit-Tests für die Interpolation

**Abnahme:** Trainer erstellt eine Animation für eine Übung, Spieler können sie abspielen.

### Phase 10 – Video-Upload
- [x] Supabase Storage Bucket `drill-videos` mit RLS (nur Teammitglieder lesen, nur Trainer schreiben)
- [x] Upload mit Fortschrittsanzeige, Größenlimit (z. B. 50 MB), erlaubte Formate
- [x] Wiedergabe im Übungsdetail

**Abnahme:** Trainer lädt ein kurzes Video hoch, Spieler sehen es.

### Phase 11 – Native App mit Capacitor
- [ ] Capacitor einrichten, Android- und iOS-Projekte erzeugen
- [ ] Deep Links für `/join/:token` und „Passwort zurücksetzen“
- [ ] Push-Benachrichtigungen: neuer Termin, Plan veröffentlicht, Erinnerung vor Anmeldeschluss für Spieler ohne Antwort, Nominierung fürs Spiel, Terminabsage
- [ ] App-Icon und Splash Screen
- [ ] Auf echtem Android-Gerät testen

**Abnahme:** App läuft auf dem Handy, Einladung und Login funktionieren über Links, Push kommt an.

### Phase 12 – Spieltag erweitert (später)
- [ ] ~~Spielplan per `.ics` importieren~~ – verworfen (Nutzerentscheidung). Ein automatischer Import von FuPa wurde ebenfalls verworfen: keine offizielle Schnittstelle, rechtliches Risiko (Nutzungsbedingungen, Datenbankrecht, Vereinswappen).
- [ ] Aufstellung auf dem Taktikboard aus dem nominierten Kader
- [ ] Wechsel und Einsatzzeiten live erfassen, Tore und Karten
- [x] Saisonstatistik pro Spieler: Trainingsbeteiligung, Trainingszeit, Zusage-/Antwortquote, Absagegründe, Nominierungen – nur aus vorhandenen App-Daten, ohne manuelle Pflege (Zeitraum: 30 Tage / Saison ab 1. Juli / gesamt). Einsatzminuten, Tore und Karten nicht enthalten.

---

## 8. Qualitätsregeln
- Keine `any`-Typen ohne Begründung im Kommentar.
- Props und Emits typisiert mit `defineProps<…>()` und `defineEmits<…>()`.
- Jeder Supabase-Aufruf läuft über ein TanStack-Query-Composable mit Fehler- und Ladezustand. Mutationen invalidieren die betroffenen Queries.
- Leere Zustände gestalten („Noch kein Training geplant“ mit Button zum Anlegen).
- Barrierefreiheit: Buttons mit Labels, Farben nie als einziges Unterscheidungsmerkmal (Gruppen zusätzlich mit Namen, Zu-/Absage zusätzlich mit Icon).
- Datums- und Zeitangaben immer in der lokalen Zeitzone des Nutzers anzeigen, in der Datenbank als `timestamptz` speichern.
- Keine echten Personendaten in Seeds oder Tests.

---

## 9. Erweiterungen nach dem Plan (mit dem Nutzer abgestimmt)

- [x] Qualitätsrunde: Browser-Tests (Playwright), Sichtprüfung per Screenshots, Dark Mode, installierbare Web-App (Manifest + Icon), Zurück-Navigation, Seitentitel und Fokus für Screenreader
- [x] Statistik aus vorhandenen App-Daten (siehe Phase 12), für die ganze Mannschaft sichtbar
- [x] **Abwesenheiten:** Zeitraum (Urlaub, Krank, Verletzt, Arbeit, Sonstiges) einmal eintragen – alle Termine darin werden automatisch abgesagt, auch später angelegte. Eigene Antworten haben Vorrang; nach Anmeldeschluss wirkt nur der Trainer. Löschen entfernt genau die automatischen Absagen.
- [x] **Web-Push:** Benachrichtigungen über die installierte Web-App – neuer Termin (Serie: eine Nachricht), Plan veröffentlicht (Spieler), Absage, Nominierung (nur neu Nominierte), Erinnerung < 24 h vor Anmeldeschluss (nur ohne Antwort). Outbox per Trigger, pg_cron jede Minute, Edge Function `push-dispatch` (VAPID, aes128gcm), abgelaufene Geräte werden entfernt. Testnachricht im Profil.
- [x] **DSGVO & Go-live:** Konto löschen, Datenexport (Knopf seit F6 entfernt, Auskunft auf Anfrage), Datenschutz/Impressum, Supabase-Cloud und Hosting vorbereiten
- [x] **Belegungsplan des Vereins:** Der Admin legt Plätze (teilbar in Hälften A/B) und feste Wochen-Platzzeiten pro Saison an. Trainer reservieren freie Zeiten für ein Datum oder jede Woche und geben einzelne Termine oder den Rest wieder ab. Reservierungen legen automatisch die Trainings an, Abgeben sagt sie ab (Push an die Spieler). Alle Vereinsmitglieder sehen den Plan.
- [x] **Vereinslogo & Vereinsfarbe:** Der Admin lädt das Logo hoch (verkleinert, öffentlicher Speicher). Die App schlägt die prägenden Logofarben vor, alternativ eine eigene Farbe oder Standard-Grün. Die Akzentfarbe wird für hell und dunkel auf WCAG-Kontrast ≥ 4,5:1 angepasst. Logo im Kopfbereich; Bedeutungsfarben (Training, Spiel, Zu-/Absage) bleiben.
- [x] **Trainingsvorlagen:** Trainings ohne Datum bauen (Übungen, Dauer, Notizen), einen fertigen Plan als Vorlage speichern, Vorlagen auf kommende Trainings legen (angehängt). Optional mit den Trainern im Verein teilen; Übungen anderer Mannschaften werden beim Übernehmen in die eigene Bibliothek kopiert. Spieler sehen keine Vorlagen.
- [x] **Taktiktafel 2:** eigener Bereich „Taktiktafel“ (Tafeln pro Mannschaft, nur Trainer) und derselbe Editor für Übungs-Animationen. Material per Drag & Drop aus einer Leiste (Spieler, Torwart, Trainer, Ball, Hütchen, Scheiben, Stangen, Dummies, Minitore, Tore, Leiter, Ringe, Zonen, Text), Eigenschaften (Farbe, Nummer, Name aus dem Kader, Drehen, Größe, Duplizieren), Linien, Ball klebt am Spieler und wird per „Ball geben“ gepasst. Tafeln lassen sich an Übungen hängen.
- [x] **+-Knopf & Events:** Neue Termine über den +-Knopf in der Kopfzeile (Training, Trainingsserie, Spiel, Event). Neuer Termintyp `event` mit Pflicht-Titel (Teamabend, Turnier, Versammlung …): Zu-/Absagen, Abwesenheiten, Erinnerungen und Push wie bei anderen Terminen, kein Trainingsplan und kein Kader; eigene Farbe (Violett). Zählt nicht in die Trainings- oder Spielstatistik.
- [x] **Terminliste:** Kopfzeile mit „Alle zusagen“ (alle angezeigten offenen, unbeantworteten Termine nach Rückfrage; vorhandene Antworten und Abwesenheits-Absagen bleiben), Filter (Art, nur unbeantwortete; pro Gerät gemerkt) und +-Knopf; halbtransparenter „Nach oben“-Knopf beim Scrollen.
- [ ] **Cross-Browser- und Barrierefreiheitstests (Playwright):** eigene Test-Suite, die in **Chromium, Firefox und Opera** läuft (`npm run test:browsers`, einzeln per `--project=chromium|firefox|opera`). Opera ist Chromium-basiert und wird über die installierte `opera.exe` gestartet (automatisch gesucht oder `OPERA_PATH`); fehlt Opera, wird das Projekt mit Hinweis übersprungen statt rot zu werden.
  - [x] Projekte `chromium`, `firefox`, `opera` in `playwright.config.ts` (Telefon-Viewport 375 px, Firefox ohne `isMobile`, das Firefox nicht unterstützt), bestehende Projekte `phone` und `screens` bleiben
  - [x] **UI-Elemente** (`e2e/ui.spec.ts`): Login-/Registrierungsformular (Labels, Fehlermeldung), Bottom-Navigation (alle Tabs erreichbar, aktiver Tab mit `aria-current`), Zurück-Knopf, Zu-/Absage-Knöpfe (`aria-pressed`), Dialoge (öffnen, Escape schließt, Fokus kehrt zurück), +-Menü, Filter, Dark Mode, keine Konsolenfehler, kein horizontales Scrollen bei 375 px
  - [x] **Barrierefreiheit** (`e2e/a11y.spec.ts`): automatischer WCAG-2.1-AA-Check mit `@axe-core/playwright` auf den Hauptseiten (Login, Registrieren, Termine, Termin-Detail Training/Spiel, Trainingsplan, Gruppen, Übungen, Kader, Profil, Datenschutz) als Spieler und Trainer, hell und dunkel; offene Dialoge mitprüfen
  - [x] Tastaturbedienung: Tab-Reihenfolge erreicht alle Bedienelemente, sichtbarer Fokus-Ring, Fokus springt nach Navigation auf die Überschrift, Touch-Ziele ≥ 44 × 44 px
  - [x] Gefundene Barrierefreiheits-Fehler beheben (nicht per Ausnahme wegdefinieren; begründete Ausnahmen im Test kommentieren) – Kontraste der Bedeutungsfarben (neue `--color-*-text`-Tokens), Kader-Buttons, Push-Status in Firefox
  - [ ] Opera-Lauf auf einem Rechner mit installiertem Opera bestätigen
  - [x] README: wie man die Browser installiert (`npx playwright install chromium firefox`) und die Suite startet
- [ ] **UI-Neuaufbau:** eigener Plan in [UI-PLAN.md](UI-PLAN.md) (Phasen U0–U7). Die Oberfläche wird weniger generisch und konsequent mobil und mit einer Hand bedienbar neu gebaut; Daten- und Logikschicht bleiben. Stand: U0–U7 umgesetzt (Richtung „Taktiktafel“); offen ist nur der Usability-Test mit echten Nutzern.
- [x] **Wunschliste Oktober 2026:** eigener Plan in [FEATURES-PLAN.md](FEATURES-PLAN.md) (Phasen F1–F6): Navigation, Testdaten und Debug-Kontowechsel, Termine anlegen (ganze Seite, Treffpunkt, Ort mit Karten), Belegungsplan als Wochenkalender, Übungsfilter, ein Verein pro Admin, Akzentfarbe pro Konto. Stand: F1–F6 umgesetzt.
- [ ] **UX-Durchsicht Oktober 2026:** eigener Plan in [UX-PLAN.md](UX-PLAN.md) (Phasen X1–X7), Ergebnis einer Playwright-Tour als Spieler, Trainer und Admin: Fehler und Ungereimtheiten, Belegungsplan Mo–So mit Heimspielen auf ihrem Platz, Platz auf Detailseiten, Trainer-Start mit Aufgaben, Navigation entrümpeln, Verein und Listen, Tour als dauerhafte Prüfung. Stand: X1–X2 umgesetzt.

# Usability-Test Rondo (UI-PLAN.md, Phase U7)

Ziel: prüfen, ob echte Spieler und Trainer die neue Oberfläche ohne Hilfe bedienen können.
Dauer: 15–20 Minuten pro Person. 3–5 Personen reichen, um die meisten Probleme zu finden.

## Vorbereitung

- Demo-Verein anlegen (z. B. mit `seedDemo` aus `frontend/e2e/support/seed.ts` oder von Hand): eine Mannschaft, ein Training morgen mit veröffentlichtem Plan und Gruppen, ein Spiel in drei Tagen, ein paar Spieler.
- Je ein Spieler- und ein Trainerkonto, auf dem **eigenen Handy der Testperson** geöffnet (nicht am Laptop).
- Stoppuhr (Handy reicht) und dieser Zettel zum Mitschreiben.

## Ablauf

1. Kurz erklären: „Wir testen die App, nicht dich. Sag laut, was du denkst und was du suchst.“
2. Aufgabe vorlesen, dann **nicht helfen**. Erst eingreifen, wenn jemand nach 2 Minuten feststeckt.
3. Pro Aufgabe notieren: geschafft ja/nein, Zeit, Anzahl Tipps, wo gezögert wurde, Zitate.

## Aufgaben für Spieler

| # | Aufgabe (vorlesen) | Ziel |
|---|---|---|
| S1 | „Du kannst morgen zum Training. Sag zu.“ | 1 Tipp, < 5 s |
| S2 | „Welches Leibchen hast du morgen beim Rondo?“ | ohne Scrollen |
| S3 | „Am Sonntag hast du Spätschicht. Sag fürs Spiel ab und sag warum.“ | ≤ 2 Tipps nach „Absage“ |
| S4 | „Oh, falsch. Mach die Absage rückgängig.“ | Snackbar „Rückgängig“ gefunden |
| S5 | „Schau dir an, wie die zweite Übung morgen abläuft.“ | Animation gestartet |
| S6 | „Du bist nächste Woche im Urlaub. Trag das ein.“ | Abwesenheit gespeichert |

## Aufgaben für Trainer

| # | Aufgabe (vorlesen) | Ziel |
|---|---|---|
| T1 | „Leg für nächsten Dienstag ein Training an.“ | ≤ 4 Tipps |
| T2 | „Wer kommt zum Spiel am Sonntag, wer fehlt noch?“ | ohne Navigation von Start aus erkannt |
| T3 | „Lena hat dich angerufen, sie kommt doch. Trag das für sie ein.“ | Antwort für Spielerin gesetzt |
| T4 | „Stell für das Training einen Plan aus drei Übungen zusammen und gib ihn für die Spieler frei.“ | Veröffentlichen ohne Suchen |
| T5 | „Teil die Spieler fürs Rondo in zwei Gruppen ein.“ | gespeichert |
| T6 | „Das Training fällt aus, der Platz ist gesperrt.“ | Termin abgesagt mit Grund |

## Nach dem Test (2 Fragen)

- „Was war am nervigsten?“
- „Was würdest du deinem Team über die App sagen?“

## Auswertung

Probleme sammeln, nach Häufigkeit sortieren (wie viele Personen hatten es) und je Problem eine Änderung vorschlagen. Alles, was mindestens zwei Personen ausgebremst hat, gehört vor dem Go-live behoben.

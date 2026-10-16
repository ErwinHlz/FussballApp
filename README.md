# Rondo

Fußball-App für Trainer und Spieler: Kader, Trainings, Spiele, Anmeldung, Gruppeneinteilung
und animierte Übungen. Der vollständige Bauplan steht in [PLAN.md](PLAN.md).

```text
frontend/           Vue 3 + TypeScript + SCSS (Vite)
backend/            Supabase-CLI und Backend-Konfiguration
backend/supabase/   Lokales Supabase-Projekt (Migrationen, Seed, config.toml)
```

## Voraussetzungen

- Node.js 22.12 oder neuer (empfohlen: aktuelle 22er- oder 24er-Version)
- Docker Desktop (für das lokale Supabase-Backend)

## 1. Backend starten

```sh
cd backend
npm install
npm start          # startet Postgres, Auth, Storage, Realtime, Studio
npm run status     # zeigt URLs und API-Schlüssel
```

- Studio: http://127.0.0.1:54323
- Mails (Magic Links): http://127.0.0.1:54324
- `npm run db:reset` spielt alle Migrationen und `seed.sql` neu ein
- `npm run gen:types` erzeugt `frontend/src/types/database.ts` (nach jeder neuen Migration)
- `npm run test:db` prüft die Zugriffsregeln (RLS) mit pgTAP
- `npm run setup:push` richtet Push-Benachrichtigungen lokal ein (einmalig): erzeugt die
  VAPID-Schlüssel (`supabase/functions/.env`, nicht im Git), schreibt den öffentlichen Schlüssel
  nach `frontend/.env.local` und sagt dem Zeitjob, wo die Edge Function `push-dispatch` läuft.
  Danach einmal `npm run stop && npm start`.
- `npm run stop` stoppt das Backend

Hinweis Windows: Supabase-Analytics ist in `config.toml` deaktiviert, weil der Log-Dienst
unter Docker Desktop nicht startet. Für die App wird er nicht gebraucht.

## 2. Frontend starten

```sh
cd frontend
cp .env.example .env.local   # dann VITE_SUPABASE_ANON_KEY aus `npm run status` eintragen
npm install
npm run dev
```

Die App läuft unter http://localhost:5173. Konto mit E-Mail und Passwort anlegen, dann
„Verein anlegen“ → Mannschaft anmelden → Trainer-Link verschicken. Mails (z. B. „Passwort
vergessen“) landen lokal im Postfach unter http://127.0.0.1:54324.

## Skripte (frontend)

| Skript              | Zweck                               |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Entwicklungsserver                  |
| `npm run build`     | Typcheck und Produktionsbuild       |
| `npm run preview`   | Produktionsbuild lokal ansehen      |
| `npm run typecheck` | `vue-tsc`                           |
| `npm run lint`      | ESLint                              |
| `npm run format`    | Prettier                            |
| `npm run test`      | Vitest (einmalig), `test:watch` für Watch-Modus |
| `npm run test:e2e`  | Browser-Tests (Playwright, Handy-Ansicht 375 px) |
| `npm run test:screens` | Screenshots aller Hauptseiten nach `e2e/__screens__/` |
| `npm run test:browsers` | UI- und Barrierefreiheitstests in Chromium, Firefox und Opera |
| `npm run lighthouse` | Lighthouse (mobil) für Start, Termine und Termin-Detail |

## Tests

- **Unit- und Komponententests:** `npm run test` in `frontend/`
- **Zugriffsregeln (RLS) der Datenbank:** `npm run test:db` in `backend/`
- **Browser-Tests:** einmalig `npx playwright install chromium`, dann bei laufendem Backend
  `npm run test:e2e` in `frontend/`. Jeder Test legt sich einen eigenen Demo-Verein mit
  Testkonten (`…@example.test`) an; die App startet dafür automatisch auf Port 5180.
- **Cross-Browser und Barrierefreiheit:** einmalig `npx playwright install chromium firefox`,
  dann `npm run test:browsers` (einzeln: `npx playwright test --project=firefox`). Geprüft werden
  Bedienelemente, Tastaturbedienung, Touch-Ziele und WCAG 2.1 AA per axe (hell und dunkel).
  Opera ist Chromium-basiert und wird über die installierte `opera.exe` gestartet: Sie wird
  automatisch gesucht, sonst `OPERA_PATH` auf die Datei setzen. Ohne Opera werden diese Tests
  übersprungen.
- **Lighthouse:** `npm run build`, dann `npx vite preview --port 4173 --strictPort` und in einem
  zweiten Terminal `npm run lighthouse`. Berichte landen in `frontend/lighthouse/`.
- **Design-System:** alle Bausteine aus `src/ui/` hell und dunkel auf http://localhost:5173/dev/ui
  (nur im Entwicklungsmodus). Der Plan dazu steht in `UI-PLAN.md`.

## WSL

Unter WSL gibt es eine lokale Node-Laufzeit in `frontend/.tools/`. Die Wrapper nutzen sie
anstelle des Windows-npm:

```sh
bash scripts/npm.sh install
bash scripts/npm.sh run dev
```

Für das Backend muss in Docker Desktop die WSL-Integration aktiviert sein.

## Live schalten

Supabase-Cloud, Hosting, Push, Mails und Rechtstexte: siehe [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
Die CI in `.github/workflows/ci.yml` prüft jeden Push.

## Secrets

Supabase-Schlüssel gehören ausschließlich in `frontend/.env.local` (gitignored).
Committet wird nur `frontend/.env.example`.

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
- `npm run gen:types` erzeugt `frontend/src/types/database.ts`
- `npm run stop` stoppt das Backend

## 2. Frontend starten

```sh
cd frontend
cp .env.example .env.local   # dann VITE_SUPABASE_ANON_KEY aus `npm run status` eintragen
npm install
npm run dev
```

Die App läuft unter http://localhost:5173.

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

## WSL

Unter WSL gibt es eine lokale Node-Laufzeit in `frontend/.tools/`. Die Wrapper nutzen sie
anstelle des Windows-npm:

```sh
bash scripts/npm.sh install
bash scripts/npm.sh run dev
```

Für das Backend muss in Docker Desktop die WSL-Integration aktiviert sein.

## Secrets

Supabase-Schlüssel gehören ausschließlich in `frontend/.env.local` (gitignored).
Committet wird nur `frontend/.env.example`.

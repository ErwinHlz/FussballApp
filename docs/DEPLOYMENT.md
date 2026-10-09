# Rondo live schalten

Diese Anleitung bringt Rondo von der lokalen Entwicklung ins Netz. Sie richtet sich an die
Person, die das Projekt betreibt. Du brauchst:

- ein Konto bei [Supabase](https://supabase.com),
- einen Hoster für statische Seiten (z. B. Netlify, Cloudflare Pages oder Vercel),
- eine eigene Domain (empfohlen) und ein Postfach für die Absenderadresse der App-Mails.

Ablauf: Supabase-Projekt anlegen → Datenbank übertragen → Anmeldung und Mails einrichten →
Push einrichten → Web-App hosten → Rechtstexte ausfüllen → Abnahme.

## 1. Supabase-Projekt anlegen

1. Im Supabase-Dashboard ein neues Projekt anlegen. **Region: Central EU (Frankfurt)**, damit
   die Daten in der EU liegen. Das Datenbank-Passwort sicher aufbewahren.
2. Unter *Settings → Legal* den Auftragsverarbeitungsvertrag (DPA) abschließen.
3. Lokal verknüpfen (im Ordner `backend/`):

   ```sh
   npx supabase login
   npx supabase link --project-ref <projekt-ref>
   ```

## 2. Datenbank übertragen

```sh
npx supabase db push
```

Das spielt alle Migrationen aus `supabase/migrations/` ein: Tabellen, Zugriffsregeln (RLS),
Funktionen, den Video-Speicher und die öffentlichen Übungen. `seed.sql` enthält keine
Demodaten und muss nicht übertragen werden.

Prüfen: Im Dashboard unter *Database → Extensions* müssen `pg_cron` und `pg_net` aktiv sein
(die Migration aktiviert sie; falls nicht, dort einschalten und `db push` wiederholen).

## 3. Anmeldung und Mails

Im Dashboard unter *Authentication*:

| Einstellung | Wert |
| --- | --- |
| *URL Configuration → Site URL* | `https://<deine-domain>` |
| *URL Configuration → Redirect URLs* | `https://<deine-domain>/**` |
| *Providers → Email → Confirm email* | **an** (lokal ist es aus) |
| *Providers → Email → Secure password change* | an |
| *Emails → SMTP Settings* | eigener SMTP-Server (der eingebaute Versand ist stark begrenzt) |

Die Mailvorlagen (*Emails → Templates*) auf Deutsch anpassen: Bestätigung und „Passwort
zurücksetzen“ werden gebraucht. Der Link in der Vorlage bleibt `{{ .ConfirmationURL }}`.

## 4. Push-Benachrichtigungen

1. VAPID-Schlüssel erzeugen: lokal `npm run setup:push` ausführen und die Werte aus
   `supabase/functions/.env` übernehmen – oder für Produktion eigene erzeugen, indem du die
   Datei vorher löschst (dann neu: `npm run setup:push`). Die Datei ist nicht im Git.
2. Schlüssel als Secrets der Edge Function setzen und die Funktion veröffentlichen:

   ```sh
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:<deine-adresse>
   npx supabase functions deploy push-dispatch
   ```

3. Der Datenbank sagen, wo die Funktion läuft. Im Dashboard unter *SQL Editor* einmal
   ausführen (Service-Role-Key unter *Settings → API*):

   ```sql
   insert into private.push_config (dispatch_url, service_key)
   values ('https://<projekt-ref>.supabase.co/functions/v1/push-dispatch', '<service-role-key>')
   on conflict (id) do update
     set dispatch_url = excluded.dispatch_url, service_key = excluded.service_key;
   ```

   Ohne diesen Eintrag läuft die App normal, verschickt aber keine Benachrichtigungen.

Der Service-Role-Key umgeht alle Zugriffsregeln. Er gehört nur in diese Tabelle (Schema
`private`, für die App nicht erreichbar) und niemals ins Frontend oder ins Git.

## 5. Web-App hosten

Build-Einstellungen beim Hoster:

| Einstellung | Wert |
| --- | --- |
| Basisordner | `frontend` |
| Build-Befehl | `npm ci && npm run build` |
| Ausgabeordner | `frontend/dist` |
| Node-Version | 22 |

Umgebungsvariablen beim Hoster (*nicht* in eine Datei im Git):

| Variable | Wert |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<projekt-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *Settings → API → anon public* |
| `VITE_VAPID_PUBLIC_KEY` | öffentlicher VAPID-Schlüssel aus Schritt 4 |

Rondo ist eine Single-Page-App: Jeder Pfad muss `index.html` ausliefern.
`frontend/public/_redirects` erledigt das für Netlify und Cloudflare Pages. Bei Vercel
stattdessen eine Rewrite-Regel `/(.*) → /index.html` anlegen.

HTTPS ist Pflicht – ohne HTTPS gibt es weder Installation als App noch Push.

## 6. Rechtstexte

Datenschutzerklärung und Impressum liegen als **Vorlagen** in
`frontend/src/features/legal/content.ts`. Alle Stellen in `[eckigen Klammern]` ausfüllen; die
App hebt sie gelb hervor, solange sie fehlen. Danach den Hinweis „Vorlage“ in
`LegalView.vue` entfernen.

Die Texte sind keine Rechtsberatung. Vor dem Start von einer fachkundigen Person prüfen
lassen – vor allem, weil Absagegründe wie „Krank“ und „Verletzt“ Gesundheitsdaten sind und
Jugendmannschaften Minderjährige betreffen.

Was die App dafür schon mitbringt:

- Einwilligung bei der Registrierung (Datenschutzerklärung gelesen, 16+ oder Zustimmung der
  Eltern),
- „Meine Daten herunterladen“ und „Konto löschen“ im Profil (Art. 15, 17 und 20 DSGVO),
- Absagegründe sind freiwillig,
- Push nur nach ausdrücklichem Einschalten, YouTube erst nach Klick,
- kein Tracking, keine Cookies außer der Anmeldung.

## 7. Abnahme

1. Konto registrieren → Bestätigungsmail kommt an → Link öffnet die App angemeldet.
2. Verein anlegen, Mannschaft anlegen, Trainer- und Spielerlink testen.
3. Auf dem Handy die App installieren („Zum Home-Bildschirm“) und Benachrichtigungen
   einschalten; einen Termin für morgen anlegen und die Erinnerung abwarten.
4. Video zu einer Übung hochladen und abspielen.
5. Testkonto über „Konto löschen“ entfernen.

## Laufender Betrieb

- Neue Migrationen: `npx supabase db push` (vorher lokal `npm run test:db`).
- Edge Function geändert: `npx supabase functions deploy push-dispatch`.
- Backups: im Free-Plan gibt es keine automatischen Backups. Für den Echtbetrieb einen
  bezahlten Plan wählen oder regelmäßig `npx supabase db dump` sichern.
- Die CI (`.github/workflows/ci.yml`) prüft bei jedem Push Lint, Typen, Unit-Tests, Build,
  die Datenbanktests und ob `database.ts` zu den Migrationen passt.

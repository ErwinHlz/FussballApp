/**
 * Legal texts (German). TEMPLATE – must be completed and reviewed before going live.
 * Placeholders in [square brackets] are highlighted on the page. Not legal advice.
 */

export type LegalSection = { heading: string; paragraphs: string[] }
export type LegalDocument = { title: string; updated: string; sections: LegalSection[] }

export const privacyPolicy: LegalDocument = {
  title: 'Datenschutzerklärung',
  updated: '[Datum der letzten Änderung]',
  sections: [
    {
      heading: '1. Verantwortlicher',
      paragraphs: [
        'Verantwortlich für die Verarbeitung personenbezogener Daten in dieser App ist: [Name / Verein], [Straße Nr.], [PLZ Ort], E-Mail: [E-Mail-Adresse].',
        '[Falls vorhanden: Datenschutzbeauftragte/r mit Kontaktdaten]',
      ],
    },
    {
      heading: '2. Welche Daten wir verarbeiten',
      paragraphs: [
        'Konto: E-Mail-Adresse und Passwort (nur verschlüsselt als Hash gespeichert).',
        'Profil und Mannschaft: Anzeigename, Rolle (Admin, Trainer, Spieler), Rückennummer, Positionen und Status (aktiv, verletzt, inaktiv).',
        'Termine: Zu- und Absagen mit optionalem Grund und Bemerkung, Abwesenheiten, Nominierungen, Gruppeneinteilungen, Trainingspläne und Übungen (inkl. hochgeladener Videos).',
        'Benachrichtigungen: Wenn du sie aktivierst, die Adresse deines Geräts beim Push-Dienst deines Browsers, Sprache und Browserkennung.',
        'Technisch: Beim Aufruf verarbeiten unsere Dienstleister Server-Protokolle (z. B. IP-Adresse, Zeitpunkt), um die App sicher zu betreiben.',
      ],
    },
    {
      heading: '3. Gesundheitsangaben',
      paragraphs: [
        'Absagegründe wie „Krank“ oder „Verletzt“ und der Status „verletzt“ sind Gesundheitsdaten (Art. 9 DSGVO). Diese Angaben sind freiwillig; du kannst ohne Grund absagen. Mit der Angabe willigst du ein, dass Trainer und deine Mannschaft sie sehen (Art. 9 Abs. 2 lit. a DSGVO). Du kannst sie jederzeit ändern oder löschen.',
      ],
    },
    {
      heading: '4. Zwecke und Rechtsgrundlagen',
      paragraphs: [
        'Organisation des Trainings- und Spielbetriebs deiner Mannschaft (Art. 6 Abs. 1 lit. b DSGVO – Nutzungsvertrag bzw. Mitgliedschaft).',
        'Push-Benachrichtigungen nur mit deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), widerrufbar jederzeit im Profil.',
        'Sicherer Betrieb und Missbrauchsschutz (Art. 6 Abs. 1 lit. f DSGVO).',
      ],
    },
    {
      heading: '5. Wer die Daten sieht',
      paragraphs: [
        'Mitglieder deiner Mannschaft sehen Kader, Termine, Zu- und Absagen, Abwesenheiten und die Statistik. Vereins-Admins sehen die Mannschaften ihres Vereins. Andere Nutzer sehen nichts davon.',
        'Auftragsverarbeiter: [Supabase Inc. – Datenbank, Anmeldung, Speicher; Region: EU (Frankfurt)], [Hosting-Anbieter der Web-App]. Mit beiden besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO).',
        'Push-Dienste der Browser-Hersteller (z. B. Google, Apple, Mozilla) leiten Benachrichtigungen an dein Gerät weiter. Der Inhalt ist Ende-zu-Ende verschlüsselt und für sie nicht lesbar.',
        'YouTube-Videos werden erst geladen, wenn du auf „Video laden“ tippst; dann gelten die Datenschutzbestimmungen von Google/YouTube.',
      ],
    },
    {
      heading: '6. Speicherdauer',
      paragraphs: [
        'Wir speichern deine Daten, solange dein Konto besteht. Wenn du dein Konto löschst, werden Profil, Mannschaftseinträge, Antworten, Abwesenheiten und Geräte sofort gelöscht. Inhalte, die du für die Mannschaft angelegt hast (z. B. Termine, Übungen), bleiben ohne Bezug zu dir erhalten. [Ggf. Fristen für Backups ergänzen.]',
      ],
    },
    {
      heading: '7. Deine Rechte',
      paragraphs: [
        'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie auf Widerruf erteilter Einwilligungen.',
        'Im Profil kannst du unter „Daten & Konto“ deine Daten jederzeit herunterladen und dein Konto selbst löschen.',
        'Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, z. B. [zuständige Landesbehörde].',
      ],
    },
    {
      heading: '8. Kinder und Jugendliche',
      paragraphs: [
        'Wer jünger als 16 Jahre ist, darf die App nur mit Zustimmung der Erziehungsberechtigten nutzen (Art. 8 DSGVO). Trainer können Spieler auch ohne eigenes Konto im Kader führen.',
      ],
    },
    {
      heading: '9. Speicherung auf deinem Gerät',
      paragraphs: [
        'Die App speichert im Browser nur, was für den Betrieb nötig ist: deine Anmeldung und die zuletzt gewählte Mannschaft (§ 25 Abs. 2 TDDDG). Es gibt kein Tracking und keine Werbe-Cookies.',
      ],
    },
  ],
}

export const imprint: LegalDocument = {
  title: 'Impressum',
  updated: '[Datum]',
  sections: [
    {
      heading: 'Angaben gemäß § 5 DDG',
      paragraphs: ['[Name / Verein]', '[Straße Nr.]', '[PLZ Ort]'],
    },
    {
      heading: 'Vertreten durch',
      paragraphs: ['[Vorstand / vertretungsberechtigte Person]'],
    },
    {
      heading: 'Kontakt',
      paragraphs: ['E-Mail: [E-Mail-Adresse]', '[Telefon, optional]'],
    },
    {
      heading: 'Registereintrag',
      paragraphs: ['[Vereinsregister, Registergericht, Registernummer – falls vorhanden]'],
    },
    {
      heading: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
      paragraphs: ['[Name, Anschrift]'],
    },
  ],
}

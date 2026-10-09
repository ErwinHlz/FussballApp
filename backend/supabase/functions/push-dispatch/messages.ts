/**
 * Notification texts for push messages (German / English).
 * Pure module without Deno APIs, so it is unit-tested with Vitest from the frontend.
 */

export type PushRow = {
  outbox_id: number
  kind:
    | 'event_created'
    | 'series_created'
    | 'event_cancelled'
    | 'plan_published'
    | 'nomination'
    | 'reminder'
    | 'test'
  payload: Record<string, unknown>
  event_id: string | null
  event_type: 'training' | 'match' | null
  starts_at: string | null
  opponent: string | null
  is_home: boolean | null
  location: string | null
  team_name: string | null
  locale: string
}

export type PushMessage = { title: string; body: string; url: string; tag: string }

/** Teams are German amateur teams: show times in German local time. */
const TIME_ZONE = 'Europe/Berlin'

function when(iso: string | null, locale: 'de' | 'en'): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(iso))
}

const texts = {
  de: {
    training: 'Training',
    match: 'Spiel',
    vs: (o: string) => `vs. ${o}`,
    created: (what: string, team: string) => `Neues ${what} · ${team}`,
    series: (team: string) => `Neue Trainings · ${team}`,
    seriesBody: (n: number, date: string) => `${n} Trainings angelegt, ab ${date}`,
    cancelled: (what: string, date: string) => `Abgesagt: ${what} am ${date}`,
    plan: 'Der Trainingsplan ist da',
    planBody: (team: string, date: string) => `${team} · ${date} – schau dir deine Gruppe an`,
    nominated: 'Du bist nominiert!',
    reminder: 'Bist du dabei?',
    reminderBody: (what: string, date: string) => `${what} ${date} – bitte bis zum Anmeldeschluss antworten`,
    test: 'Benachrichtigungen funktionieren',
    testBody: 'So erfährst du von neuen Terminen, Plänen und Absagen.',
  },
  en: {
    training: 'Training',
    match: 'Match',
    vs: (o: string) => `vs. ${o}`,
    created: (what: string, team: string) => `New ${what.toLowerCase()} · ${team}`,
    series: (team: string) => `New trainings · ${team}`,
    seriesBody: (n: number, date: string) => `${n} trainings created, starting ${date}`,
    cancelled: (what: string, date: string) => `Cancelled: ${what} on ${date}`,
    plan: 'The training plan is ready',
    planBody: (team: string, date: string) => `${team} · ${date} – check your group`,
    nominated: 'You have been nominated!',
    reminder: 'Are you in?',
    reminderBody: (what: string, date: string) => `${what} ${date} – please answer before the deadline`,
    test: 'Notifications work',
    testBody: 'This is how you hear about new events, plans and cancellations.',
  },
}

export function buildMessage(row: PushRow): PushMessage {
  const locale = row.locale === 'en' ? 'en' : 'de'
  const tx = texts[locale]
  const team = row.team_name ?? 'Rondo'
  const date = when(row.starts_at, locale)
  const what = row.event_type === 'match' ? tx.match : tx.training
  const title = row.event_type === 'match' && row.opponent ? tx.vs(row.opponent) : what
  const url = row.event_id ? `/events/${row.event_id}` : '/events'
  // One notification per event and kind; a newer one replaces an older one.
  const tag = `${row.kind}:${row.event_id ?? row.outbox_id}`

  switch (row.kind) {
    case 'event_created':
      return {
        title: tx.created(what, team),
        body: [row.event_type === 'match' ? title : null, date, row.location].filter(Boolean).join(' · '),
        url,
        tag,
      }
    case 'series_created':
      return {
        title: tx.series(team),
        body: tx.seriesBody(Number(row.payload.count ?? 0), date),
        url: '/training',
        tag,
      }
    case 'event_cancelled':
      return { title: tx.cancelled(title, date), body: team, url, tag }
    case 'plan_published':
      return { title: tx.plan, body: tx.planBody(team, date), url, tag }
    case 'nomination':
      return { title: tx.nominated, body: `${team} ${title} · ${date}`, url, tag }
    case 'reminder':
      return { title: tx.reminder, body: tx.reminderBody(title, date), url, tag }
    case 'test':
      return { title: tx.test, body: tx.testBody, url: '/profile', tag }
  }
}

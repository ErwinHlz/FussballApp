/**
 * Fills the LOCAL database with a realistic club for manual testing (`npm run seed:dev`).
 * Removes the previous dev data first (the accounts delete themselves), so it can run again.
 * Everything goes through the public API with the same rules as the app.
 * Accounts and password: src/dev/accounts.ts. Never run against the production project.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { DEV_ACCOUNTS, DEV_PASSWORD } from '../src/dev/accounts.ts'

function env(name) {
  if (process.env[name]) return process.env[name]
  const file = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const value = file.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
  if (!value) throw new Error(`${name} missing (set it or create frontend/.env.local)`)
  return value
}

const URL_ = env('VITE_SUPABASE_URL')
const KEY = env('VITE_SUPABASE_ANON_KEY')
if (!/127\.0\.0\.1|localhost/.test(URL_)) {
  throw new Error(`Refusing to seed ${URL_}: dev data is for the local Supabase only.`)
}

const client = () =>
  createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

function must(result, what) {
  if (result.error) throw new Error(`${what}: ${JSON.stringify(result.error)}`)
  return result.data
}

const at = (daysFromNow, hour, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d
}
const day = (daysFromNow) => {
  const d = at(daysFromNow, 12)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Days from today to the next given weekday (0 = Sunday), at least `min` days ahead. */
const nextWeekday = (weekday, min = 1) => {
  for (let d = min; d < min + 7; d++) if (at(d, 12).getDay() === weekday) return d
  return min
}

// ---------------------------------------------------------------------------
// 1. Remove earlier dev data: players first, the admin last (then the club has no other
//    members and is deleted with everything in it).
// ---------------------------------------------------------------------------
const order = { player: 0, coach: 1, admin: 2 }
let removed = 0
for (const account of [...DEV_ACCOUNTS].sort((a, b) => order[a.role] - order[b.role])) {
  const sb = client()
  const { error } = await sb.auth.signInWithPassword({ email: account.email, password: DEV_PASSWORD })
  if (error) continue
  must(await sb.rpc('delete_my_account'), `delete ${account.email}`)
  removed++
}
if (removed) console.log(`Removed ${removed} earlier dev accounts.`)

// ---------------------------------------------------------------------------
// 2. Accounts
// ---------------------------------------------------------------------------
const sessions = new Map()
const userIds = new Map()
for (const account of DEV_ACCOUNTS) {
  const sb = client()
  const { user } = must(
    await sb.auth.signUp({
      email: account.email,
      password: DEV_PASSWORD,
      options: { data: { display_name: account.name } },
    }),
    `sign up ${account.email}`,
  )
  sessions.set(account.email, sb)
  userIds.set(account.email, user.id)
}
const as = (email) => sessions.get(email)
const admin = as('vorstand@rondo.test')

// ---------------------------------------------------------------------------
// 3. Club, teams, coaches, players
// ---------------------------------------------------------------------------
const club = must(await admin.rpc('create_club', { p_name: 'SV Rondo 1920' }), 'club')
must(
  await admin.rpc('set_club_branding', {
    p_club_id: club.id,
    p_logo_path: null,
    p_accent_color: '#1d4ed8',
  }),
  'branding',
)

const teams = {}
for (const [name, season] of [
  ['U17', '2026/27'],
  ['Damen', '2026/27'],
]) {
  teams[name] = must(
    await admin
      .from('teams')
      .insert({ club_id: club.id, name, season })
      .select()
      .single(),
    `team ${name}`,
  )
}

async function join(email, teamName, role) {
  const invite = must(
    await admin
      .from('team_invites')
      .insert({ team_id: teams[teamName].id, role })
      .select()
      .single(),
    'invite',
  )
  must(await as(email).rpc('accept_team_invite', { p_token: invite.token }), `join ${email}`)
}
for (const account of DEV_ACCOUNTS.filter((a) => a.team)) {
  await join(account.email, account.team, account.role)
}

const coachOf = { U17: as('trainer.u17@rondo.test'), Damen: as('trainerin.damen@rondo.test') }
const membersOf = {}
for (const teamName of Object.keys(teams)) {
  const coach = coachOf[teamName]
  // Shirt numbers and positions; one player without an account per team.
  for (const account of DEV_ACCOUNTS.filter((a) => a.team === teamName && a.role === 'player')) {
    must(
      await coach
        .from('team_members')
        .update({ shirt_number: account.shirtNumber, positions: account.positions })
        .eq('team_id', teams[teamName].id)
        .eq('user_id', userIds.get(account.email)),
      `squad ${account.name}`,
    )
  }
  must(
    await coach.from('team_members').insert({
      team_id: teams[teamName].id,
      display_name: teamName === 'U17' ? 'Yusuf Demir' : 'Jana Vogel',
      shirt_number: 99,
      positions: ['MF'],
      status: 'injured',
    }),
    'manual member',
  )
  membersOf[teamName] = must(
    await coach
      .from('team_members')
      .select('id, display_name, role, status')
      .eq('team_id', teams[teamName].id),
    'members',
  )
}
const players = (teamName) => membersOf[teamName].filter((m) => m.role === 'player')

// ---------------------------------------------------------------------------
// 4. Pitch schedule: the bookings create the regular trainings.
// ---------------------------------------------------------------------------
const pitches = must(
  await admin
    .from('pitches')
    .insert([
      { club_id: club.id, name: 'Rasen', splittable: true, sort_order: 1 },
      { club_id: club.id, name: 'Kunstrasen', splittable: true, sort_order: 2 },
    ])
    .select(),
  'pitches',
)
const [grass, turf] = pitches
// Monday to Friday, 15:00–20:30 in half hours; weekly for six weeks.
const until = day(42)
for (const [teamName, pitch, weekday, start, end, part] of [
  ['U17', turf, 2, '18:30', '20:00', 'full'],
  ['U17', turf, 4, '18:30', '20:00', 'full'],
  ['Damen', turf, 1, '18:30', '20:00', 'a'],
  ['Damen', turf, 3, '18:30', '20:00', 'a'],
  ['Damen', grass, 5, '17:00', '18:30', 'full'],
]) {
  must(
    await coachOf[teamName].rpc('book_pitch', {
      p_pitch_id: pitch.id,
      p_team_id: teams[teamName].id,
      p_part: part,
      p_start: start,
      p_end: end,
      p_from: day(nextWeekday(weekday, 1)),
      p_until: until,
    }),
    `booking ${teamName}`,
  )
}

// ---------------------------------------------------------------------------
// 5. Matches and a team evening
// ---------------------------------------------------------------------------
async function insertEvent(teamName, row) {
  return must(
    await coachOf[teamName]
      .from('events')
      .insert({ team_id: teams[teamName].id, ...row })
      .select()
      .single(),
    'event',
  )
}
const saturday = nextWeekday(6, 2)
const kickoff = at(saturday, 15)
const u17Match = await insertEvent('U17', {
  type: 'match',
  starts_at: kickoff.toISOString(),
  meet_at: new Date(kickoff.getTime() - 75 * 60_000).toISOString(),
  meet_location: 'Vereinsheim, Parkplatz',
  location: 'Waldstadion, Am Stadtwald 1',
  opponent: 'FC Nachbarort',
  is_home: false,
  competition: 'league',
  response_deadline: at(saturday - 2, 20).toISOString(),
})
const homeKickoff = at(saturday + 7, 13)
await insertEvent('U17', {
  type: 'match',
  starts_at: homeKickoff.toISOString(),
  meet_at: new Date(homeKickoff.getTime() - 60 * 60_000).toISOString(),
  meet_location: 'Kabine 2',
  location: 'Sportpark Rondo, Rasen',
  opponent: 'SG Talheim',
  is_home: true,
  competition: 'cup',
})
const sunday = nextWeekday(0, 2)
const damenKickoff = at(sunday, 11)
await insertEvent('Damen', {
  type: 'match',
  starts_at: damenKickoff.toISOString(),
  meet_at: new Date(damenKickoff.getTime() - 60 * 60_000).toISOString(),
  meet_location: 'Sportpark Rondo',
  location: 'Sportpark Rondo, Rasen',
  opponent: 'TSV Bergdorf',
  is_home: true,
  competition: 'league',
})
const evening = at(nextWeekday(5, 8), 19)
await insertEvent('U17', {
  type: 'event',
  title: 'Teamabend mit Grillen',
  starts_at: evening.toISOString(),
  ends_at: new Date(evening.getTime() + 3 * 3600_000).toISOString(),
  location: 'Vereinsheim',
  notes: 'Getränke stellt der Verein, bitte Salat oder Nachtisch mitbringen.',
})

// ---------------------------------------------------------------------------
// 6. Answers: most say yes, some maybe or no; some are still open (for the reminders).
// ---------------------------------------------------------------------------
const reasons = ['sick', 'work', 'vacation', 'other']
for (const teamName of Object.keys(teams)) {
  const events = must(
    await coachOf[teamName]
      .from('events')
      .select('id, starts_at')
      .eq('team_id', teams[teamName].id)
      .gt('starts_at', new Date().toISOString())
      .order('starts_at'),
    'events',
  )
  for (const [e, event] of events.slice(0, 6).entries()) {
    for (const [p, member] of players(teamName).entries()) {
      if (member.status === 'injured') continue
      const pick = (e * 7 + p * 3) % 10
      if (pick === 9) continue // not answered yet
      const status = pick < 7 ? 'yes' : pick === 7 ? 'maybe' : 'no'
      must(
        await coachOf[teamName].rpc('set_attendance', {
          p_event_id: event.id,
          p_member_id: member.id,
          p_status: status,
          p_reason: status === 'no' ? reasons[(e + p) % reasons.length] : null,
        }),
        'answer',
      )
    }
  }
}
// The first dev player of each team leaves the next dates open (to try answering).
for (const name of ['Luca Brandt', 'Mia Hartmann']) {
  const sb = as(DEV_ACCOUNTS.find((a) => a.name === name).email)
  const memberId = Object.values(membersOf)
    .flat()
    .find((m) => m.display_name === name).id
  must(await sb.from('attendances').delete().eq('member_id', memberId), 'clear answers')
}
// A holiday: absences cancel the trainings in that time automatically.
must(
  await as('karim@rondo.test').rpc('create_absences', {
    p_member_ids: [players('U17').find((m) => m.display_name === 'Karim Aydin').id],
    p_starts_at: at(nextWeekday(1, 7), 0).toISOString(),
    p_ends_at: at(nextWeekday(1, 7) + 7, 0).toISOString(),
    p_reason: 'vacation',
    p_note: 'Familienurlaub',
  }),
  'absence',
)

// ---------------------------------------------------------------------------
// 7. Drills, the next U17 training with a published plan and groups, the squad for the match
// ---------------------------------------------------------------------------
const u17 = coachOf.U17
for (const drill of [
  {
    title: 'Pressing 6 gegen 4',
    category: 'tactics',
    duration_min: 20,
    min_players: 10,
    max_players: 14,
    equipment: ['Hütchen', 'Leibchen', 'Bälle'],
    description: 'Ballverlust → sofort Gegenpressing, 6 Sekunden Zeit für die Rückeroberung.',
  },
  {
    title: 'Torschuss nach Doppelpass',
    category: 'finishing',
    duration_min: 15,
    min_players: 6,
    max_players: 16,
    equipment: ['Bälle', 'Hütchen'],
    description: 'Doppelpass mit dem Trainer an der Strafraumkante, Abschluss mit dem ersten Kontakt.',
  },
]) {
  must(await u17.from('drills').insert({ team_id: teams.U17.id, ...drill }), 'drill')
}
const library = must(await u17.from('drills').select('id, title').is('team_id', null), 'library')
const nextTraining = must(
  await u17
    .from('events')
    .select('id')
    .eq('team_id', teams.U17.id)
    .eq('type', 'training')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(1)
    .single(),
  'next training',
)
const eventDrills = []
for (const [index, title] of [
  'Aufwärmen mit Ball',
  'Rondo 4 gegen 2',
  'Abschlussspiel 7 gegen 7',
].entries()) {
  const drill = library.find((d) => d.title === title)
  if (!drill) continue
  eventDrills.push(
    must(
      await u17
        .from('event_drills')
        .insert({ event_id: nextTraining.id, drill_id: drill.id, position: index + 1 })
        .select()
        .single(),
      'plan',
    ),
  )
}
const fit = players('U17').filter((m) => m.status !== 'injured')
const half = Math.ceil(fit.length / 2)
for (const eventDrill of eventDrills.slice(1)) {
  must(
    await u17.rpc('set_drill_groups', {
      p_event_drill_id: eventDrill.id,
      p_groups: [
        { name: 'Rot', color: 'red', member_ids: fit.slice(0, half).map((m) => m.id) },
        { name: 'Blau', color: 'blue', member_ids: fit.slice(half).map((m) => m.id) },
      ],
    }),
    'groups',
  )
}
must(
  await u17.from('events').update({ plan_status: 'published' }).eq('id', nextTraining.id),
  'publish',
)
const squadRows = fit.map((m, i) => ({
  event_id: u17Match.id,
  member_id: m.id,
  role: i < 11 ? 'starter' : i < 14 ? 'bench' : 'reserve',
}))
must(await u17.from('match_squad').insert(squadRows), 'match squad')

// ---------------------------------------------------------------------------
// 8. History for the statistics: past trainings (squad backdated in the local container).
// ---------------------------------------------------------------------------
try {
  execSync(
    `docker exec supabase_db_fussballapp psql -U postgres -c "update public.team_members set created_at = now() - interval '90 days' where team_id in ('${teams.U17.id}', '${teams.Damen.id}')"`,
    { stdio: 'ignore' },
  )
  for (let week = 1; week <= 8; week++) {
    const start = at(-week * 7 + 1, 18, 30)
    const training = await insertEvent('U17', {
      type: 'training',
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 90 * 60_000).toISOString(),
      location: 'Sportpark Rondo, Kunstrasen',
    })
    for (const [p, member] of players('U17').entries()) {
      const yes = (week * 5 + p * 3) % 7 !== 0 && member.status !== 'injured'
      must(
        await u17.rpc('set_attendance', {
          p_event_id: training.id,
          p_member_id: member.id,
          p_status: yes ? 'yes' : 'no',
          p_reason: yes ? null : member.status === 'injured' ? 'injured' : 'work',
        }),
        'past answer',
      )
    }
  }
} catch (error) {
  console.warn('Skipped the training history (needs the local Docker container):', error.message)
}

console.log(`Dev data ready: club "SV Rondo 1920", ${DEV_ACCOUNTS.length} accounts.`)
console.log(`Sign in with any account from src/dev/accounts.ts, password "${DEV_PASSWORD}".`)

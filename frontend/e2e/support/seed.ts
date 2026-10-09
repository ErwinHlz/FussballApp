/**
 * Creates a realistic demo club through the public API (same rules as the app, RLS applies).
 * Every call uses fresh, unique accounts, so tests never share state. No real personal data.
 */
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

export const PASSWORD = 'demo-pass-1234'

function env(name: string): string {
  if (process.env[name]) return process.env[name]!
  const file = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  const value = file.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
  if (!value) throw new Error(`${name} missing (set it or create frontend/.env.local)`)
  return value
}

export const SUPABASE_URL = env('VITE_SUPABASE_URL')
export const SUPABASE_ANON_KEY = env('VITE_SUPABASE_ANON_KEY')

function client(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function must<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(JSON.stringify(result.error ?? 'no data'))
  }
  return result.data
}

/** For writes without returned rows: only checks the error. */
function ok(result: { error: unknown }): void {
  if (result.error) throw new Error(JSON.stringify(result.error))
}

export async function register(name: string, stamp: string) {
  const sb = client()
  const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${stamp}@example.test`
  must(
    await sb.auth.signUp({ email, password: PASSWORD, options: { data: { display_name: name } } }),
  )
  return { sb, email, name }
}

const at = (daysFromNow: number, hour: number, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d
}

export type Demo = Awaited<ReturnType<typeof seedDemo>>

export async function seedDemo() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const coach = await register('Trainerin Tina', stamp)
  const player = await register('Pia', stamp)

  const club = must(await coach.sb.rpc('create_club', { p_name: 'SV Demo 09' }))
  const team = must(
    await coach.sb
      .from('teams')
      .insert({ club_id: club.id, name: 'U17', season: '2026/27' })
      .select()
      .single(),
  )
  // Tina coaches the team herself (via her own coach link).
  const coachInvite = must(
    await coach.sb
      .from('team_invites')
      .insert({ team_id: team.id, role: 'coach' })
      .select()
      .single(),
  )
  must(await coach.sb.rpc('accept_team_invite', { p_token: coachInvite.token }))
  const playerInvite = must(
    await coach.sb
      .from('team_invites')
      .insert({ team_id: team.id, role: 'player' })
      .select()
      .single(),
  )
  must(await player.sb.rpc('accept_team_invite', { p_token: playerInvite.token }))

  // Squad: Pia + players without account.
  const manual = [
    ['Lena', 1, ['GK']],
    ['Ali', 4, ['DF']],
    ['Ben', 5, ['DF']],
    ['Cem', 6, ['MF']],
    ['Dana', 8, ['MF']],
    ['Emil', 9, ['FW']],
    ['Finn', 11, ['FW', 'MF']],
  ] as const
  for (const [name, number, positions] of manual) {
    ok(
      await coach.sb.from('team_members').insert({
        team_id: team.id,
        display_name: name,
        shirt_number: number,
        positions: [...positions],
        status: name === 'Ben' ? 'injured' : 'active',
      }),
    )
  }
  const members = must(
    await coach.sb.from('team_members').select('id, display_name').eq('team_id', team.id),
  )
  const id = (name: string) => members.find((m) => m.display_name === name)!.id
  ok(
    await coach.sb
      .from('team_members')
      .update({ shirt_number: 10, positions: ['MF'] })
      .eq('id', id('Pia')),
  )

  // Training tomorrow 18:30–20:00 with a published plan and groups.
  const trainingStart = at(1, 18, 30)
  const training = must(
    await coach.sb
      .from('events')
      .insert({
        team_id: team.id,
        type: 'training',
        starts_at: trainingStart.toISOString(),
        ends_at: new Date(trainingStart.getTime() + 90 * 60_000).toISOString(),
        location: 'Sportpark, Platz 2',
        notes: 'Bitte Schienbeinschoner mitbringen.',
        response_deadline: new Date(trainingStart.getTime() - 2 * 3600_000).toISOString(),
      })
      .select()
      .single(),
  )
  for (const name of ['Pia', 'Lena', 'Ali', 'Cem', 'Dana', 'Emil']) {
    must(
      await coach.sb.rpc('set_attendance', {
        p_event_id: training.id,
        p_member_id: id(name),
        p_status: 'yes',
      }),
    )
  }
  must(
    await coach.sb.rpc('set_attendance', {
      p_event_id: training.id,
      p_member_id: id('Finn'),
      p_status: 'maybe',
    }),
  )

  const library = must(await coach.sb.from('drills').select('id, title').is('team_id', null))
  const drill = (title: string) => library.find((d) => d.title === title)!.id
  const planTitles = ['Aufwärmen mit Ball', 'Rondo 4 gegen 2', 'Abschlussspiel 7 gegen 7']
  const eventDrills = []
  for (const [index, title] of planTitles.entries()) {
    eventDrills.push(
      must(
        await coach.sb
          .from('event_drills')
          .insert({ event_id: training.id, drill_id: drill(title), position: index + 1 })
          .select()
          .single(),
      ),
    )
  }
  const groups = (red: string[], blue: string[]) => [
    { name: 'Rot', color: 'red', member_ids: red.map(id) },
    { name: 'Blau', color: 'blue', member_ids: blue.map(id) },
  ]
  ok(
    await coach.sb.rpc('set_drill_groups', {
      p_event_drill_id: eventDrills[1]!.id,
      p_groups: groups(['Pia', 'Lena', 'Cem'], ['Ali', 'Dana', 'Emil', 'Finn']),
    }),
  )
  ok(
    await coach.sb.rpc('set_drill_groups', {
      p_event_drill_id: eventDrills[2]!.id,
      p_groups: groups(['Lena', 'Ali', 'Emil'], ['Pia', 'Cem', 'Dana', 'Finn']),
    }),
  )
  ok(await coach.sb.from('events').update({ plan_status: 'published' }).eq('id', training.id))

  // Match in 3 days, away, with meeting point.
  const kickoff = at(3, 15)
  const match = must(
    await coach.sb
      .from('events')
      .insert({
        team_id: team.id,
        type: 'match',
        starts_at: kickoff.toISOString(),
        meet_at: new Date(kickoff.getTime() - 75 * 60_000).toISOString(),
        meet_location: 'Vereinsheim',
        location: 'Waldstadion',
        opponent: 'FC Nachbarort',
        is_home: false,
        competition: 'league',
        response_deadline: at(2, 20).toISOString(),
      })
      .select()
      .single(),
  )
  for (const name of ['Lena', 'Ali', 'Cem', 'Dana']) {
    must(
      await coach.sb.rpc('set_attendance', {
        p_event_id: match.id,
        p_member_id: id(name),
        p_status: 'yes',
      }),
    )
  }

  // Next week's trainings as a series (Tue + Thu).
  for (const weekday of [2, 4]) {
    const dates: string[] = []
    for (let d = 4; d <= 18; d++) {
      const day = at(d, 18, 30)
      if (day.getDay() === weekday) dates.push(day.toISOString())
    }
    must(
      await coach.sb.rpc('create_training_series', {
        p_team_id: team.id,
        p_weekday: weekday,
        p_start_time: '18:30',
        p_duration_min: 90,
        p_location: 'Sportpark, Platz 2',
        p_valid_from: at(4, 0).toISOString().slice(0, 10),
        p_valid_until: at(18, 0).toISOString().slice(0, 10),
        p_starts_at: dates,
        p_deadline_hours: 2,
      }),
    )
  }

  return { stamp, coach, player, club, team, training, match, memberId: id }
}

/**
 * Local-only: gives a demo team a history for the statistics screens. Backdates the squad
 * (players only count from when they joined) directly in the local database container and
 * adds past trainings with answers through the API.
 */
export async function seedHistory(demo: Demo) {
  const { execSync } = await import('node:child_process')
  execSync(
    `docker exec supabase_db_fussballapp psql -U postgres -c "update public.team_members set created_at = now() - interval '90 days' where team_id = '${demo.team.id}'"`,
    { stdio: 'ignore' },
  )
  const names = ['Pia', 'Lena', 'Ali', 'Ben', 'Cem', 'Dana', 'Emil', 'Finn']
  // Deterministic pattern: who said yes in each of the 8 past trainings.
  const yes = [
    'PLACDEF',
    'PLAC-EF',
    'PL-CDE-',
    'P-ACD-F',
    'PLAC-E-',
    'PLA-DEF',
    '-LACDEF',
    'PLACDE-',
  ]
  for (const [week, pattern] of yes.entries()) {
    const start = at(-(8 - week) * 7 + 1, 18, 30)
    const training = must(
      await demo.coach.sb
        .from('events')
        .insert({
          team_id: demo.team.id,
          type: 'training',
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + 90 * 60_000).toISOString(),
          location: 'Sportpark, Platz 2',
        })
        .select()
        .single(),
    )
    for (const name of names) {
      const said = pattern.includes(name[0]!) && name !== 'Ben'
      ok(
        await demo.coach.sb.rpc('set_attendance', {
          p_event_id: training.id,
          p_member_id: demo.memberId(name),
          p_status: said ? 'yes' : 'no',
          p_reason: said ? undefined : name === 'Ben' ? 'injured' : 'work',
        }),
      )
    }
  }
}

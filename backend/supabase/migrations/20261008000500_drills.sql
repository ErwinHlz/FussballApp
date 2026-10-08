-- Phase 5: drill library. team_id NULL = public library (read-only for everyone).

create table public.drills (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  title text not null check (char_length(trim(title)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 4000),
  category text not null check (category in (
    'warmup', 'passing', 'possession', 'technique', 'finishing',
    'defending', 'tactics', 'game', 'fitness', 'goalkeeping'
  )),
  duration_min int check (duration_min between 1 and 180),
  min_players int check (min_players between 1 and 40),
  max_players int check (max_players between 1 and 40),
  equipment text[] not null default '{}',
  -- Only YouTube links (embedded via youtube-nocookie.com after an explicit click).
  video_url text check (
    video_url ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/'
  ),
  video_path text, -- Supabase Storage (Phase 10)
  animation jsonb, -- Tactics board animation (Phase 9)
  copied_from uuid references public.drills (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_players is null or max_players is null or min_players <= max_players),
  check (cardinality(equipment) <= 20)
);

create index drills_team_idx on public.drills (team_id);

create function public.drills_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger drills_touch before update on public.drills
  for each row execute function public.drills_touch();

alter table public.drills enable row level security;

create policy "drills: public library and team drills readable" on public.drills
  for select to authenticated
  using (team_id is null or public.is_team_member(team_id));
create policy "drills: coaches create team drills" on public.drills
  for insert to authenticated
  with check (team_id is not null and public.is_team_coach(team_id));
create policy "drills: coaches update team drills" on public.drills
  for update to authenticated
  using (team_id is not null and public.is_team_coach(team_id))
  with check (team_id is not null and public.is_team_coach(team_id));
create policy "drills: coaches delete team drills" on public.drills
  for delete to authenticated
  using (team_id is not null and public.is_team_coach(team_id));

revoke all on public.drills from anon;
revoke insert, update on public.drills from authenticated;
grant insert (team_id, title, description, category, duration_min, min_players, max_players,
  equipment, video_url, animation, copied_from) on public.drills to authenticated;
grant update (title, description, category, duration_min, min_players, max_players,
  equipment, video_url, animation) on public.drills to authenticated;

-- Copies a (public or own) drill into a team so the coach can adapt it.
create function public.copy_drill(p_drill_id uuid, p_team_id uuid)
returns public.drills
language plpgsql security invoker set search_path = ''
as $$
declare
  v_copy public.drills;
begin
  insert into public.drills (team_id, title, description, category, duration_min, min_players,
    max_players, equipment, video_url, animation, copied_from)
  select p_team_id, d.title, d.description, d.category, d.duration_min, d.min_players,
    d.max_players, d.equipment, d.video_url, d.animation, d.id
  from public.drills d
  where d.id = p_drill_id
  returning * into v_copy;

  if v_copy.id is null then
    raise exception 'drill not found' using errcode = 'P0002';
  end if;
  return v_copy;
end;
$$;

revoke execute on function public.copy_drill from anon, public;
grant execute on function public.copy_drill to authenticated;

-- ---------------------------------------------------------------------------
-- Public library: standard drills (fixed ids so this is idempotent).
-- ---------------------------------------------------------------------------

insert into public.drills
  (id, team_id, created_by, title, description, category, duration_min, min_players, max_players, equipment)
values
  ('0d000000-0000-4000-8000-000000000001', null, null, 'Rondo 4 gegen 2',
   E'Feld 10 x 10 m. Vier Spieler außen halten den Ball, zwei Verteidiger in der Mitte jagen ihn.\n\nRegeln: maximal zwei Kontakte. Wer den Ballverlust verursacht, geht in die Mitte.\n\nCoaching: Körper offen stellen, früh anbieten, flach und scharf passen.',
   'possession', 15, 6, 6, array['Hütchen', 'Bälle', 'Leibchen']),
  ('0d000000-0000-4000-8000-000000000002', null, null, 'Passdreieck',
   E'Drei Hütchen im Dreieck (Abstand 10–12 m), an jedem Hütchen zwei bis drei Spieler.\n\nAblauf: Pass zum nächsten Hütchen, dem Ball hinterherlaufen. Nach zwei Minuten Richtung wechseln.\n\nVarianten: nur linker Fuß, Direktspiel, Doppelpass vor dem Weiterspielen.',
   'passing', 15, 6, 12, array['Hütchen', 'Bälle']),
  ('0d000000-0000-4000-8000-000000000003', null, null, 'Torschuss nach Doppelpass',
   E'Spieler dribbelt auf den Anspieler an der Strafraumgrenze zu, spielt einen Doppelpass und schließt direkt ab.\n\nCoaching: Ball vor dem Abschluss in den Lauf legen, Blick zum Tor, Standbein neben den Ball.',
   'finishing', 20, 6, 14, array['Bälle', 'Hütchen', 'Tor']),
  ('0d000000-0000-4000-8000-000000000004', null, null, 'Abschlussspiel 7 gegen 7',
   E'Spiel auf zwei Tore mit Torhütern, halbes Feld.\n\nRegeln: freies Spiel. Optional: Tor zählt doppelt nach mindestens fünf Pässen.\n\nCoaching: Inhalte der Einheit im Spiel wiederfinden.',
   'game', 25, 12, 16, array['Leibchen', 'Bälle', '2 Tore']),
  ('0d000000-0000-4000-8000-000000000005', null, null, 'Aufwärmen mit Ball',
   E'Jeder Spieler hat einen Ball im Feld 20 x 20 m.\n\nAufgaben: Innenseite, Außenseite, Sohle, Richtungswechsel auf Zuruf, Tempo steigern. Dazwischen Dehnung und Steigerungsläufe.',
   'warmup', 10, 1, 30, array['Bälle', 'Hütchen']),
  ('0d000000-0000-4000-8000-000000000006', null, null, 'Dribbelparcours',
   E'Slalom durch Stangen, danach Finte am Dummy und Pass ins Minitor.\n\nAls Staffel gegeneinander möglich.\n\nCoaching: Ball eng am Fuß, Kopf nach dem Parcours hoch.',
   'technique', 15, 4, 16, array['Stangen', 'Bälle', 'Minitore', 'Dummy']),
  ('0d000000-0000-4000-8000-000000000007', null, null, '1 gegen 1 auf zwei Tore',
   E'Feld 15 x 10 m mit zwei Minitoren. Trainer spielt den Ball ein, beide Spieler duellieren sich.\n\nNach 30 Sekunden oder Tor wechselt das Paar.\n\nCoaching Angreifer: Tempo aufnehmen, Finte. Verteidiger: seitlich stellen, nicht springen.',
   'defending', 15, 4, 16, array['Minitore', 'Bälle', 'Hütchen']),
  ('0d000000-0000-4000-8000-000000000008', null, null, 'Flanken und Abschluss',
   E'Außenspieler dribbelt die Linie entlang und flankt, zwei Stürmer laufen gegenläufig in den Strafraum (erster und zweiter Pfosten).\n\nCoaching: Timing der Läufe, Flanke in den Raum zwischen Torwart und Abwehr.',
   'finishing', 20, 6, 14, array['Bälle', 'Tor', 'Hütchen']),
  ('0d000000-0000-4000-8000-000000000009', null, null, 'Spielaufbau 6 gegen 4',
   E'Sechs Spieler bauen von hinten gegen vier Pressingspieler auf und sollen über eine Linie dribbeln oder in ein Minitor passen.\n\nCoaching: Breite und Tiefe herstellen, Dreiecke bilden, den freien Mann finden.',
   'tactics', 20, 10, 12, array['Leibchen', 'Bälle', 'Minitore', 'Hütchen']),
  ('0d000000-0000-4000-8000-000000000010', null, null, 'Kopfballspiel',
   E'Paarweise: ein Spieler wirft, der andere köpft zurück. Danach 3 gegen 3 auf kleine Tore, Tore zählen nur per Kopf.\n\nCoaching: Augen offen, Stirn, Oberkörper einsetzen.',
   'technique', 15, 6, 12, array['Bälle', 'Minitore']),
  ('0d000000-0000-4000-8000-000000000011', null, null, 'Pressing 5 gegen 5',
   E'Feld 30 x 25 m. Nach Ballverlust hat das Team sechs Sekunden Zeit, den Ball zurückzuerobern (Gegenpressing). Gelingt das, gibt es einen Punkt.\n\nCoaching: sofort umschalten, Passwege zustellen, im Verbund verschieben.',
   'tactics', 20, 10, 10, array['Leibchen', 'Bälle', 'Hütchen']),
  ('0d000000-0000-4000-8000-000000000012', null, null, 'Torwart: Fangen und Fallen',
   E'Torwarttrainer schießt flach und halbhoch auf beide Seiten. Torwart fängt oder fällt und steht schnell wieder auf.\n\nSteigerung: zweiter Ball direkt nach dem Aufstehen.\n\nCoaching: Grundstellung, Hände hinter den Ball, über die Seite abrollen.',
   'goalkeeping', 15, 1, 3, array['Bälle', 'Tor']),
  ('0d000000-0000-4000-8000-000000000013', null, null, 'Koordinationsleiter und Sprint',
   E'Verschiedene Schrittfolgen durch die Koordinationsleiter, danach 10 m Sprint um ein Hütchen.\n\nKurze Belastung, volle Pause. Gut nach dem Aufwärmen.',
   'fitness', 10, 1, 20, array['Koordinationsleiter', 'Hütchen']),
  ('0d000000-0000-4000-8000-000000000014', null, null, 'Positionsspiel im Viereck',
   E'Vier Spieler an den Ecken eines Vierecks (15 x 15 m), ein Spieler in der Mitte. Ball zirkuliert, die Mitte muss sich immer neu anbieten und aufdrehen.\n\nCoaching: offene Ballannahme, mit dem ersten Kontakt in die Bewegung.',
   'passing', 15, 5, 10, array['Hütchen', 'Bälle'])
on conflict (id) do nothing;

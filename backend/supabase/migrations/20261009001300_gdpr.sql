-- GDPR: delete the own account (Art. 17) and export the own data (Art. 15/20).

-- Creator references must not block deleting an account; the content stays with the team.
alter table public.clubs alter column created_by drop not null;
alter table public.clubs drop constraint clubs_created_by_fkey,
  add constraint clubs_created_by_fkey foreign key (created_by)
    references public.profiles (id) on delete set null;

alter table public.teams alter column created_by drop not null;
alter table public.teams drop constraint teams_created_by_fkey,
  add constraint teams_created_by_fkey foreign key (created_by)
    references public.profiles (id) on delete set null;

alter table public.team_invites alter column created_by drop not null;
alter table public.team_invites drop constraint team_invites_created_by_fkey,
  add constraint team_invites_created_by_fkey foreign key (created_by)
    references public.profiles (id) on delete set null;

-- RESTRICT is checked immediately and would break cascading deletes of a whole club;
-- NO ACTION is checked at the end of the statement and still protects drills used in plans.
alter table public.event_drills drop constraint event_drills_drill_id_fkey,
  add constraint event_drills_drill_id_fkey foreign key (drill_id) references public.drills (id);

-- ---------------------------------------------------------------------------
-- Delete my account
-- ---------------------------------------------------------------------------

create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- A club must not lose its last admin while others still use it.
  if exists (
    select 1 from public.club_members me
    where me.user_id = v_uid and me.role = 'admin'
      and not exists (
        select 1 from public.club_members o
        where o.club_id = me.club_id and o.role = 'admin' and o.user_id <> v_uid
      )
      and exists (
        select 1 from public.club_members o where o.club_id = me.club_id and o.user_id <> v_uid
      )
  ) then
    raise exception 'last admin of a club with other members'
      using errcode = 'P0001', hint = 'sole_admin';
  end if;

  -- Clubs nobody else uses are deleted completely (teams, events, drills, …).
  delete from public.clubs c
  where exists (select 1 from public.club_members m where m.club_id = c.id and m.user_id = v_uid)
    and not exists (select 1 from public.club_members m where m.club_id = c.id and m.user_id <> v_uid);

  -- Squad entries with all answers, groups, nominations and absences.
  delete from public.team_members where user_id = v_uid;

  -- Profile, club memberships and devices follow via cascade; creator references are cleared.
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account from anon, public;
grant execute on function public.delete_my_account to authenticated;

-- ---------------------------------------------------------------------------
-- Export my data
-- ---------------------------------------------------------------------------

create function public.export_my_data()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid)
  select jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at)
      from auth.users u, me where u.id = me.uid
    ),
    'profile', (
      select to_jsonb(p) from public.profiles p, me where p.id = me.uid
    ),
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object('club', c.name, 'role', cm.role, 'since', cm.created_at))
      from public.club_members cm join public.clubs c on c.id = cm.club_id, me
      where cm.user_id = me.uid
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'club', c.name, 'team', t.name, 'role', m.role, 'display_name', m.display_name,
        'shirt_number', m.shirt_number, 'positions', m.positions, 'status', m.status,
        'since', m.created_at
      ))
      from public.team_members m
      join public.teams t on t.id = m.team_id
      join public.clubs c on c.id = t.club_id, me
      where m.user_id = me.uid
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team', t.name, 'event_type', e.type, 'starts_at', e.starts_at, 'opponent', e.opponent,
        'status', a.status, 'reason', a.reason, 'note', a.reason_note, 'updated_at', a.updated_at
      ) order by e.starts_at)
      from public.attendances a
      join public.team_members m on m.id = a.member_id
      join public.events e on e.id = a.event_id
      join public.teams t on t.id = e.team_id, me
      where m.user_id = me.uid
    ), '[]'::jsonb),
    'nominations', coalesce((
      select jsonb_agg(jsonb_build_object('starts_at', e.starts_at, 'opponent', e.opponent, 'role', s.role))
      from public.match_squad s
      join public.team_members m on m.id = s.member_id
      join public.events e on e.id = s.event_id, me
      where m.user_id = me.uid
    ), '[]'::jsonb),
    'absences', coalesce((
      select jsonb_agg(jsonb_build_object('from', ab.starts_at, 'until', ab.ends_at, 'reason', ab.reason, 'note', ab.note))
      from public.absences ab
      join public.team_members m on m.id = ab.member_id, me
      where m.user_id = me.uid
    ), '[]'::jsonb),
    'notification_devices', coalesce((
      select jsonb_agg(jsonb_build_object('registered_at', s.created_at, 'language', s.locale, 'browser', s.user_agent))
      from public.push_subscriptions s, me
      where s.user_id = me.uid
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.export_my_data from anon, public;
grant execute on function public.export_my_data to authenticated;

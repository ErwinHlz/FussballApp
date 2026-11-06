-- An absence is stronger than earlier answers: entering one declines every upcoming event in
-- the period, also those the player had already answered (e.g. via "attend all"). Answers
-- changed by hand after the absence was entered still win, and deleting the absence removes
-- its declines again (the event is then unanswered).

create or replace function public.apply_absence(p_absence_id uuid, p_include_closed boolean)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_absence public.absences;
  v_team_id uuid;
  v_count int;
begin
  select * into v_absence from public.absences where id = p_absence_id;
  if v_absence.id is null then
    return 0;
  end if;
  select team_id into v_team_id from public.team_members where id = v_absence.member_id;

  perform set_config('rondo.system_write', 'on', true);

  with targets as (
    select e.id
    from public.events e
    where e.team_id = v_team_id
      and not e.is_cancelled
      and e.starts_at >= greatest(v_absence.starts_at, now())
      and e.starts_at < v_absence.ends_at
      and (p_include_closed or now() < coalesce(e.response_deadline, e.starts_at))
  ),
  upserted as (
    insert into public.attendances (event_id, member_id, status, reason, reason_note, source_absence_id)
    select t.id, v_absence.member_id, 'no', v_absence.reason, v_absence.note, v_absence.id
    from targets t
    on conflict (event_id, member_id) do update
      set status = 'no',
          reason = excluded.reason,
          reason_note = excluded.reason_note,
          source_absence_id = excluded.source_absence_id
    returning 1
  )
  select count(*) into v_count from upserted;

  perform set_config('rondo.system_write', 'off', true);
  return v_count;
end;
$$;

revoke execute on function public.apply_absence from anon, public, authenticated;

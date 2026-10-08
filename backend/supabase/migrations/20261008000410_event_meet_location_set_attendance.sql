-- Phase 4 additions.

-- Matches have a meeting point (Treffpunkt) besides the venue (location).
alter table public.events
  add column meet_location text check (char_length(meet_location) <= 120);

grant update (meet_location) on public.events to authenticated;

-- Answer for an event (insert or update). Runs as the caller, so the attendance RLS policies
-- decide: players only for themselves and only while the event is open, coaches for everyone.
create function public.set_attendance(
  p_event_id uuid,
  p_member_id uuid,
  p_status public.attendance_status,
  p_reason text default null,
  p_reason_note text default null
)
returns public.attendances
language plpgsql security invoker set search_path = ''
as $$
declare
  v_row public.attendances;
  v_reason text := case when p_status = 'no' then p_reason end;
  v_note text := case when p_status = 'no' then nullif(trim(p_reason_note), '') end;
begin
  update public.attendances
  set status = p_status, reason = v_reason, reason_note = v_note
  where event_id = p_event_id and member_id = p_member_id
  returning * into v_row;

  if not found then
    insert into public.attendances (event_id, member_id, status, reason, reason_note)
    values (p_event_id, p_member_id, p_status, v_reason, v_note)
    returning * into v_row;
  end if;

  -- Update blocked by RLS (e.g. deadline passed) returns no row; make that an error.
  if v_row.id is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.set_attendance from anon, public;
grant execute on function public.set_attendance to authenticated;

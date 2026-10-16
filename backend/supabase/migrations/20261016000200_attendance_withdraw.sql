-- Players may withdraw their own answer (back to "no answer yet") under the same conditions as
-- changing it: the event is open for responses (not cancelled, before the deadline or start).
-- Used for "undo" right after a first decline. Coaches can already delete via their policy.
create policy "attendances: players withdraw own answer" on public.attendances
  for delete to authenticated
  using (public.is_own_member(member_id) and public.event_open_for_responses(event_id));

-- Training templates are removed: they had no practical use (copying a plan from another
-- training covers the need). private.templates_touch() stays, tactic_boards uses it.

drop function public.apply_training_template(uuid, uuid);
drop function public.create_template_from_event(uuid, text, boolean);
drop function public.reorder_template_drills(uuid, uuid[]);
drop function public.template_items(uuid);
drop function public.list_training_templates(uuid);

drop table public.template_drills;
drop table public.training_templates;

drop function public.can_read_template(uuid);
drop function public.template_team_id(uuid);
drop function public.drill_usable_by_team(uuid, uuid);
drop function public.is_club_coach(uuid);

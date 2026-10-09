-- New event type for team events that are neither training nor match (team evening,
-- tournament, meeting). In its own migration: a new enum value cannot be used in the
-- transaction that adds it.
alter type public.event_type add value if not exists 'event';

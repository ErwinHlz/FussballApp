-- Phase 9: tactics board animations (format: PLAN.md section 6, validated with Zod in the app).
-- The database guards the basics so no broken or huge documents can be stored.

alter table public.drills
  add constraint drills_animation_check check (
    animation is null or (
      jsonb_typeof(animation) = 'object'
      and animation ->> 'version' = '1'
      and animation ->> 'field' in ('full', 'half', 'quarter')
      and jsonb_typeof(animation -> 'objects') = 'array'
      and jsonb_typeof(animation -> 'keyframes') = 'array'
      and jsonb_array_length(animation -> 'keyframes') between 1 and 30
      and jsonb_array_length(animation -> 'objects') <= 40
      and octet_length(animation::text) <= 100000
    )
  );

-- Demo animation for the public "Rondo 4 gegen 2": the ball circulates around the square,
-- the two defenders shift with it.
update public.drills
set animation = $json$
{
  "version": 1,
  "field": "quarter",
  "durationMs": 6000,
  "objects": [
    { "id": "a1", "type": "player", "color": "#3b82f6", "label": "1" },
    { "id": "a2", "type": "player", "color": "#3b82f6", "label": "2" },
    { "id": "a3", "type": "player", "color": "#3b82f6", "label": "3" },
    { "id": "a4", "type": "player", "color": "#3b82f6", "label": "4" },
    { "id": "d1", "type": "player", "color": "#ef4444", "label": "V" },
    { "id": "d2", "type": "player", "color": "#ef4444", "label": "V" },
    { "id": "b1", "type": "ball" },
    { "id": "c1", "type": "cone", "color": "#f97316" },
    { "id": "c2", "type": "cone", "color": "#f97316" },
    { "id": "c3", "type": "cone", "color": "#f97316" },
    { "id": "c4", "type": "cone", "color": "#f97316" }
  ],
  "keyframes": [
    { "t": 0, "positions": {
      "a1": [25, 35], "a2": [75, 35], "a3": [75, 65], "a4": [25, 65],
      "d1": [42, 45], "d2": [52, 55], "b1": [29, 37],
      "c1": [18, 30], "c2": [82, 30], "c3": [82, 70], "c4": [18, 70] } },
    { "t": 1500, "positions": { "b1": [71, 37], "d1": [60, 42], "d2": [60, 53] } },
    { "t": 3000, "positions": { "b1": [71, 63], "d1": [64, 58], "d2": [55, 47] } },
    { "t": 4500, "positions": { "b1": [29, 63], "d1": [40, 60], "d2": [45, 49] } },
    { "t": 6000, "positions": { "b1": [29, 37], "d1": [42, 45], "d2": [52, 55] } }
  ],
  "annotations": [
    { "type": "arrow", "from": [30, 35], "to": [70, 35], "style": "pass" },
    { "type": "arrow", "from": [75, 40], "to": [75, 60], "style": "pass" },
    { "type": "arrow", "from": [70, 65], "to": [30, 65], "style": "pass" },
    { "type": "arrow", "from": [25, 60], "to": [25, 40], "style": "pass" }
  ]
}
$json$::jsonb
where id = '0d000000-0000-4000-8000-000000000001' and animation is null;

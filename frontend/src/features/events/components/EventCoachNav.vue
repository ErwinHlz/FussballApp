<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaNav, { type Area } from '@/ui/AreaNav.vue'

type View = 'event' | 'event-plan' | 'event-groups' | 'event-squad'

/**
 * Coach views of an event: a training has overview (answers, details), plan and groups, a
 * match has overview and squad. Links, so every view keeps its own address (deep links, back
 * button).
 */
const props = withDefaults(
  defineProps<{ eventId: string; active: View; type?: 'training' | 'match' }>(),
  { type: 'training' },
)

const { t } = useI18n()
const areas = computed<Area[]>(() =>
  (props.type === 'match'
    ? ([
        ['event', 'events.coachNav.overview'],
        ['event-squad', 'events.coachNav.squad'],
      ] as const)
    : ([
        ['event', 'events.coachNav.overview'],
        ['event-plan', 'events.coachNav.plan'],
        ['event-groups', 'events.coachNav.groups'],
      ] as const)
  ).map(([name, labelKey]) => ({
    key: name,
    to: { name, params: { eventId: props.eventId } },
    label: t(labelKey),
  })),
)
const label = computed(() =>
  props.type === 'match' ? t('events.coachNav.matchLabel') : t('events.coachNav.label'),
)
</script>

<template>
  <AreaNav :areas="areas" :active="active" :label="label" fill replace />
</template>

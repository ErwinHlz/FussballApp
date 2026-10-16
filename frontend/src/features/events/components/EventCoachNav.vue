<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaNav, { type Area } from '@/ui/AreaNav.vue'

/**
 * Coach view of a training: overview (answers, details), plan and groups are three views of
 * the same event. Links, so every view keeps its own address (deep links, back button).
 */
const props = defineProps<{ eventId: string; active: 'event' | 'event-plan' | 'event-groups' }>()

const { t } = useI18n()
const areas = computed<Area[]>(() =>
  (
    [
      ['event', 'events.coachNav.overview'],
      ['event-plan', 'events.coachNav.plan'],
      ['event-groups', 'events.coachNav.groups'],
    ] as const
  ).map(([name, labelKey]) => ({
    key: name,
    to: { name, params: { eventId: props.eventId } },
    label: t(labelKey),
  })),
)
</script>

<template>
  <AreaNav :areas="areas" :active="active" :label="t('events.coachNav.label')" fill replace />
</template>

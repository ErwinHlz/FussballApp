<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AreaNav, { type Area } from '@/ui/AreaNav.vue'

/** The events tab's areas: the team's dates and the club's pitch schedule. */
defineProps<{ active: 'events' | 'events-schedule' }>()

const { t } = useI18n()
const areas = computed<Area[]>(() => [
  { key: 'events', to: { name: 'events' }, label: t('events.title') },
  { key: 'events-schedule', to: { name: 'events-schedule' }, label: t('schedule.title') },
])
</script>

<template>
  <AreaNav :areas="areas" :active="active" :label="t('events.navLabel')" fill />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseBadge from '@/components/BaseBadge.vue'
import type { MemberStatus } from '../squad'

defineProps<{ status: MemberStatus }>()

const { t } = useI18n()

// Icon + text, so status is never conveyed by color alone.
const tones = { active: 'success', injured: 'danger', inactive: 'neutral' } as const
const icons = { active: '✓', injured: '✚', inactive: '–' } as const
</script>

<template>
  <BaseBadge :tone="tones[status]">
    <template #icon
      ><span aria-hidden="true">{{ icons[status] }}</span></template
    >
    {{ t(`squad.status.${status}`) }}
  </BaseBadge>
</template>

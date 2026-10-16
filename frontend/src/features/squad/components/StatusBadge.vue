<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UiBadge from '@/ui/UiBadge.vue'
import type { MemberStatus } from '../squad'

defineProps<{ status: MemberStatus }>()

const { t } = useI18n()

// Icon + text, so status is never conveyed by color alone.
const tones = { active: 'yes', injured: 'no', inactive: 'neutral' } as const
const icons = { active: '✓', injured: '✚', inactive: '–' } as const
</script>

<template>
  <UiBadge :tone="tones[status]">
    <span aria-hidden="true">{{ icons[status] }}</span>
    {{ t(`squad.status.${status}`) }}
  </UiBadge>
</template>

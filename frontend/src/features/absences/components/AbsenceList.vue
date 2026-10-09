<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import { formatDate } from '@/lib/date'
import { useAuthStore } from '@/stores/auth'
import type { Absence } from '../api'
import { isCurrent, lastDay } from '../logic'
import { useDeleteAbsence } from '../composables/useAbsences'

const props = withDefaults(
  defineProps<{
    absences: Absence[]
    /** Show whose absence it is (team overview). */
    showName?: boolean
    /** Coaches may delete every absence of their team. */
    canManage?: boolean
  }>(),
  { showName: false, canManage: false },
)

const { t, locale } = useI18n()
const auth = useAuthStore()
const remove = useDeleteAbsence()

const day = (value: Date | string) => formatDate(value, locale.value, 'EEEEEE dd.MM.')

function canDelete(a: Absence) {
  return props.canManage || (a.member.user_id !== null && a.member.user_id === auth.userId)
}
</script>

<template>
  <ul class="absences" role="list">
    <li v-for="a in absences" :key="a.id" class="absences__item">
      <span class="absences__main">
        <span v-if="showName" class="absences__name">{{ a.member.display_name }}</span>
        <span class="absences__dates">
          {{ day(a.starts_at) }} – {{ day(lastDay(a.ends_at)) }}
        </span>
        <span class="absences__reason">
          {{ t(`events.reasons.${a.reason}`) }}<template v-if="a.note"> · {{ a.note }}</template>
        </span>
      </span>
      <BaseBadge v-if="isCurrent(a)" tone="warning">{{ t('absences.now') }}</BaseBadge>
      <button
        v-if="canDelete(a)"
        type="button"
        class="absences__delete"
        :aria-label="t('absences.delete', { name: a.member.display_name })"
        :disabled="remove.isPending.value"
        @click="remove.mutate(a.id)"
      >
        <AppIcon name="x" :size="18" />
      </button>
    </li>
  </ul>
</template>

<style scoped lang="scss">
.absences {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: $radius-lg;

  &__item {
    display: flex;
    align-items: center;
    gap: $space-2;
    padding: $space-2 $space-2 $space-2 $space-3;

    & + & {
      border-top: 1px solid var(--color-border);
    }
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__name,
  &__dates {
    font-weight: 700;
  }

  &__reason {
    font-size: $font-sm;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  &__delete {
    @include touch-target;
    @include focus-visible;

    display: grid;
    flex-shrink: 0;
    place-items: center;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: var(--color-danger);
  }
}
</style>

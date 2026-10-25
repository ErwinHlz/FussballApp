<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UiIcon, { type UiIconName } from '@/ui/UiIcon.vue'
import UiListRow from '@/ui/UiListRow.vue'
import UiSection from '@/ui/UiSection.vue'
import { useEventFormat } from '@/features/events/format'
import type { TeamEvent } from '@/features/events/logic'
import { useEventGroups } from '@/features/groups/composables/useGroups'
import { coachTasks, PLAN_TASK_DAYS, unassignedYes } from '../logic'
import { differenceInCalendarDays } from 'date-fns'

/**
 * "To do" on the coach's start page: every open task of the coming days is one row that leads
 * straight to the place where it is done (plan, groups, squad, who is coming).
 */
const props = defineProps<{ events: TeamEvent[]; playerIds: string[] }>()

const { t } = useI18n()
const fmt = useEventFormat()

// Groups: only for the next training with a published plan (one query, not one per event).
const nextPublished = computed(
  () =>
    [...props.events]
      .filter(
        (e) =>
          e.type === 'training' &&
          !e.is_cancelled &&
          e.plan_status === 'published' &&
          new Date(e.starts_at) > new Date() &&
          differenceInCalendarDays(new Date(e.starts_at), new Date()) < PLAN_TASK_DAYS,
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null,
)
const groups = useEventGroups(
  () => nextPublished.value?.id ?? '',
  () => !!nextPublished.value,
)
const unassigned = computed(() =>
  nextPublished.value && groups.data.value
    ? unassignedYes(groups.data.value, nextPublished.value.attendances)
    : [],
)

type Row = { key: string; icon: UiIconName; title: string; subtitle: string; to: RouteLocationRaw }
const when = (e: TeamEvent) =>
  `${fmt.title(e)} · ${fmt.weekdayShort(e.starts_at)} ${fmt.dayMonth(e.starts_at)}`
const rows = computed<Row[]>(() => {
  const list = coachTasks(props.events, props.playerIds).map<Row & { at: string }>((task) => {
    const params = { eventId: task.event.id }
    const at = task.event.starts_at
    if (task.kind === 'plan')
      return {
        key: `plan-${task.event.id}`,
        icon: 'cone',
        title: t('coachTasks.plan'),
        subtitle: when(task.event),
        to: { name: 'event-plan', params },
        at,
      }
    if (task.kind === 'squad')
      return {
        key: `squad-${task.event.id}`,
        icon: 'shirt',
        title: t('coachTasks.squad'),
        subtitle: when(task.event),
        to: { name: 'event-squad', params },
        at,
      }
    return {
      key: `answers-${task.event.id}`,
      icon: 'bell',
      title: t('coachTasks.answers', task.count),
      subtitle: when(task.event),
      to: { name: 'event', params },
      at,
    }
  })
  if (nextPublished.value && unassigned.value.length)
    list.push({
      key: 'groups',
      icon: 'users',
      title: t('coachTasks.groups', unassigned.value.length),
      subtitle: when(nextPublished.value),
      to: { name: 'event-groups', params: { eventId: nextPublished.value.id } },
      at: nextPublished.value.starts_at,
    })
  return list.sort((a, b) => a.at.localeCompare(b.at))
})
</script>

<template>
  <UiSection v-if="rows.length" :title="t('coachTasks.title')" :count="rows.length">
    <ul class="tasks" role="list">
      <li v-for="row in rows" :key="row.key">
        <UiListRow :title="row.title" :subtitle="row.subtitle" :to="row.to" chevron>
          <template #leading><UiIcon :name="row.icon" :size="22" /></template>
        </UiListRow>
      </li>
    </ul>
  </UiSection>
  <p v-else class="tasks__done" role="status">
    <UiIcon name="check" :size="20" />
    {{ t('coachTasks.allDone') }}
  </p>
</template>

<style scoped lang="scss">
.tasks {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  margin: 0;

  &__done {
    display: flex;
    align-items: center;
    gap: $space-2;
    color: var(--color-yes-text);
    font-weight: 700;
  }
}
</style>

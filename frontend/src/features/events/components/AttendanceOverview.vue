<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AnswerControl from '@/ui/AnswerControl.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiAvatar from '@/ui/UiAvatar.vue'
import type { TeamMember } from '@/features/teams/api'
import { useAnswer } from '../composables/useAnswer'
import { useEventFormat } from '../format'
import {
  canRespond,
  summarizeAttendance,
  type Attendance,
  type AttendanceGroup,
  type AttendanceStatus,
  type TeamEvent,
} from '../logic'
import DeclineSheet from './DeclineSheet.vue'

/**
 * "Who is coming?" for coaches, live: big counts, then everyone by answer. Tapping a person
 * lets the coach answer for them (players without account, phone calls, late changes).
 */
const props = defineProps<{ event: TeamEvent; members: TeamMember[] }>()

const { t } = useI18n()
const fmt = useEventFormat()
const summary = computed(() => summarizeAttendance(props.members, props.event.attendances))
const groups: { key: AttendanceGroup; icon: string }[] = [
  { key: 'yes', icon: '✓' },
  { key: 'maybe', icon: '?' },
  { key: 'no', icon: '✗' },
  { key: 'none', icon: '–' },
]

function reasonText(attendance: Attendance | null) {
  if (!attendance?.reason && !attendance?.reason_note) return null
  const text = [
    attendance.reason ? t(`events.reasons.${attendance.reason}`) : null,
    attendance.reason_note,
  ]
    .filter(Boolean)
    .join(': ')
  return attendance.source_absence_id ? `${text} · ${t('absences.auto')}` : text
}

const editing = ref<{ member: TeamMember; attendance: Attendance | null } | null>(null)
const editOpen = computed({
  get: () => !!editing.value,
  set: (value) => {
    if (!value) editing.value = null
  },
})
const canAnswer = computed(() => canRespond(props.event, true))

const { answer, decline, declining } = useAnswer()
function onAnswer(status: AttendanceStatus) {
  const entry = editing.value
  if (!entry) return
  editing.value = null
  const label = `${entry.member.display_name} · ${fmt.title(props.event)}`
  answer(props.event, entry.member.id, entry.attendance, status, label)
}
</script>

<template>
  <section class="overview" aria-labelledby="overview-title">
    <h2 id="overview-title" class="overview__title">
      {{ t('events.overview.title') }}
      <span class="overview__live"
        ><span class="overview__pulse" aria-hidden="true" />{{ t('events.overview.live') }}</span
      >
    </h2>

    <div class="overview__totals">
      <span
        v-for="group in groups"
        :key="group.key"
        class="overview__total"
        :class="`overview__total--${group.key}`"
      >
        <span class="overview__total-count">
          <span aria-hidden="true" class="overview__icon">{{ group.icon }}</span>
          {{ summary[group.key].length }}
        </span>
        <span class="overview__total-label">{{ t(`events.overview.${group.key}`) }}</span>
      </span>
    </div>

    <template v-for="group in groups" :key="group.key">
      <div
        v-if="summary[group.key].length"
        class="overview__group"
        :class="`overview__group--${group.key}`"
      >
        <h3 class="overview__group-title">
          {{ t(`events.overview.${group.key}`) }} ({{ summary[group.key].length }})
        </h3>
        <ul class="overview__list" role="list">
          <li v-for="entry in summary[group.key]" :key="entry.member.id">
            <button
              type="button"
              class="overview__person"
              :disabled="!canAnswer"
              @click="editing = entry"
            >
              <UiAvatar
                :name="entry.member.display_name"
                :number="entry.member.shirt_number"
                :size="36"
              />
              <span class="overview__text">
                <span class="overview__name">
                  {{ entry.member.display_name }}
                  <span v-if="entry.member.user_id === null" class="overview__muted">
                    ({{ t('squad.noAccount') }})
                  </span>
                </span>
                <span v-if="reasonText(entry.attendance)" class="overview__reason">
                  {{ reasonText(entry.attendance) }}
                </span>
              </span>
              <span class="visually-hidden">– {{ t('events.overview.change') }}</span>
            </button>
          </li>
        </ul>
      </div>
    </template>

    <BottomSheet
      v-model:open="editOpen"
      :title="t('events.overview.answerFor', { name: editing?.member.display_name ?? '' })"
      :description="fmt.title(event)"
    >
      <AnswerControl
        v-if="editing"
        :status="editing.attendance?.status ?? null"
        :label="t('events.overview.answerFor', { name: editing.member.display_name })"
        @answer="onAnswer"
      />
    </BottomSheet>
    <DeclineSheet :request="declining" @decline="decline" @cancel="declining = null" />
  </section>
</template>

<style scoped lang="scss">
.overview {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__title {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__live {
    display: inline-flex;
    align-items: center;
    gap: $space-1;
    color: var(--color-yes-text);
    font-family: var(--font-sans);
    font-size: $font-xs;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  &__pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-yes);
    animation: overview-pulse 2s ease-in-out infinite;
  }

  &__totals {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: $space-2;
  }

  &__total {
    --total-text: var(--color-text-muted);

    display: flex;
    flex-direction: column;
    align-items: center;
    padding: $space-2 $space-1;
    border-radius: $radius-lg;
    background: var(--color-surface);

    @each $answer in yes, maybe, no {
      &--#{$answer} {
        --total-text: var(--color-#{$answer}-text);
      }
    }
  }

  &__total-count {
    color: var(--total-text);
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  &__icon {
    font-size: $font-lg;
  }

  &__total-label {
    color: var(--color-text-muted);
    font-size: $font-xs;
    font-weight: 700;
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__group-title {
    font-size: $font-md;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
  }

  &__person {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 52px;
    padding: $space-2 $space-3;
    border: 0;
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    text-align: left;

    &:disabled {
      cursor: default;
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 700;
  }

  &__muted,
  &__reason {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 500;
  }
}

@keyframes overview-pulse {
  50% {
    opacity: 0.35;
  }
}
</style>

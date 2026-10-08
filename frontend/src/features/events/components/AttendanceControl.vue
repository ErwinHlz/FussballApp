<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseModal from '@/components/BaseModal.vue'
import {
  canRespond,
  DECLINE_REASONS,
  responseState,
  type Attendance,
  type AttendanceStatus,
  type DeclineReason,
  type EventRow,
} from '../logic'
import { useSetAttendance } from '../composables/useEvents'

const props = withDefaults(
  defineProps<{
    event: Pick<EventRow, 'id' | 'is_cancelled' | 'response_deadline' | 'starts_at'>
    memberId: string
    attendance: Attendance | null
    /** Coaches may answer after the deadline and for other members. */
    asCoach?: boolean
    /** Name of the member when a coach answers for someone else (accessible labels). */
    memberName?: string
    compact?: boolean
  }>(),
  { asCoach: false, memberName: undefined, compact: false },
)

const { t } = useI18n()
const setAttendance = useSetAttendance()

const declineOpen = ref(false)
const reason = ref<DeclineReason | 'none'>('none')
const reasonNote = ref('')

const status = computed(() => props.attendance?.status ?? null)
const enabled = computed(() => canRespond(props.event, props.asCoach))
const lockedHint = computed(() => {
  if (enabled.value) return null
  const state = responseState(props.event)
  return state === 'cancelled' ? null : t(`events.locked.${state}`)
})

const options = [
  { value: 'yes', icon: '✓' },
  { value: 'maybe', icon: '?' },
  { value: 'no', icon: '✗' },
] as const

const reasonOptions = computed(() => [
  { value: 'none' as const, label: t('events.reasons.none') },
  ...DECLINE_REASONS.map((r) => ({ value: r, label: t(`events.reasons.${r}`) })),
])

function label(value: AttendanceStatus) {
  const text = t(`events.answer.${value}`)
  return props.memberName ? `${props.memberName}: ${text}` : text
}

function answer(value: AttendanceStatus) {
  if (value === 'no') {
    reason.value = (props.attendance?.reason as DeclineReason | null) ?? 'none'
    reasonNote.value = props.attendance?.reason_note ?? ''
    declineOpen.value = true
    return
  }
  setAttendance.mutate({ eventId: props.event.id, memberId: props.memberId, status: value })
}

function confirmDecline() {
  setAttendance.mutate({
    eventId: props.event.id,
    memberId: props.memberId,
    status: 'no',
    reason: reason.value === 'none' ? null : reason.value,
    reasonNote: reasonNote.value || null,
  })
  declineOpen.value = false
}
</script>

<template>
  <div class="attendance" :class="{ 'attendance--compact': compact }">
    <div class="attendance__buttons" role="group" :aria-label="t('events.answer.label')">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="attendance__button"
        :class="[
          `attendance__button--${option.value}`,
          { 'attendance__button--selected': status === option.value },
        ]"
        :aria-pressed="status === option.value"
        :aria-label="compact ? label(option.value) : undefined"
        :disabled="!enabled || setAttendance.isPending.value"
        @click="answer(option.value)"
      >
        <span class="attendance__icon" aria-hidden="true">{{ option.icon }}</span>
        <span v-if="!compact" class="attendance__text">{{
          t(`events.answer.${option.value}`)
        }}</span>
      </button>
    </div>
    <p v-if="lockedHint && !compact" class="attendance__hint">{{ lockedHint }}</p>
    <p v-if="setAttendance.isError.value" class="attendance__error" role="alert">
      {{ t('events.answerFailed') }}
    </p>

    <BaseModal v-model:open="declineOpen" :title="t('events.declineTitle')">
      <div class="attendance__decline">
        <BaseChipGroup v-model="reason" :label="t('events.reasonLabel')" :options="reasonOptions" />
        <BaseInput
          v-model="reasonNote"
          :label="t('events.reasonNote')"
          :placeholder="t('events.reasonNotePlaceholder')"
        />
      </div>
      <template #footer>
        <BaseButton variant="secondary" @click="declineOpen = false">
          {{ t('common.cancel') }}
        </BaseButton>
        <BaseButton variant="danger" @click="confirmDecline">{{
          t('events.answer.no')
        }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped lang="scss">
.attendance {
  display: flex;
  flex-direction: column;
  gap: $space-1;

  &__buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $space-2;
  }

  &--compact &__buttons {
    display: flex;
    gap: $space-1;
  }

  &__button {
    @include touch-target;
    @include focus-visible;

    --answer-color: var(--color-text-muted);

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: $space-1;
    padding: $space-1 $space-2;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: 700;
    font-size: $font-sm;

    &--yes {
      --answer-color: var(--color-yes);
    }

    &--maybe {
      --answer-color: var(--color-maybe);
    }

    &--no {
      --answer-color: var(--color-no);
    }

    &--selected {
      border-color: var(--answer-color);
      background: var(--answer-color);
      color: #fff;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &:disabled.attendance__button--selected {
      opacity: 0.85;
    }
  }

  &__icon {
    font-size: $font-lg;
    line-height: 1;
  }

  &__hint {
    font-size: $font-xs;
    color: var(--color-text-muted);
  }

  &__error {
    font-size: $font-sm;
    color: var(--color-danger);
  }

  &__decline {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }
}
</style>

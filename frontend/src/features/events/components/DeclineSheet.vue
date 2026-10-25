<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiButton from '@/ui/UiButton.vue'
import UiInput from '@/ui/UiInput.vue'
import AbsenceSheet from '@/features/absences/components/AbsenceSheet.vue'
import type { DeclineRequest } from '../composables/useAnswer'
import { DECLINE_REASONS, type DeclineReason } from '../logic'

/**
 * Decline with one tap on the reason. The optional note goes first, so it is filled in before
 * the reason button saves the answer.
 */
const props = defineProps<{
  request: DeclineRequest | null
  /** Own answers: offer an absence for longer times away (not when answering for others). */
  offerAbsence?: boolean
}>()
const emit = defineEmits<{ decline: [DeclineReason | null, string]; cancel: [] }>()

const { t } = useI18n()
const note = ref('')
const open = computed({
  get: () => !!props.request,
  set: (value) => {
    if (!value) emit('cancel')
  },
})

// A previous decline pre-fills its note.
watch(
  () => props.request,
  (request) => {
    note.value = request?.previous?.status === 'no' ? (request.previous.reason_note ?? '') : ''
  },
)

// Away for longer: leave the decline and enter an absence instead.
const absenceOpen = ref(false)
function toAbsence() {
  emit('cancel')
  absenceOpen.value = true
}

const previousReason = computed(() =>
  props.request?.previous?.status === 'no' ? props.request.previous.reason : null,
)
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('events.declineTitle')" :description="request?.label">
    <div class="decline">
      <UiInput
        v-model="note"
        :label="t('events.reasonNote')"
        :placeholder="t('events.reasonNotePlaceholder')"
      />
      <p class="decline__hint">{{ t('events.declineHint') }}</p>
      <ul class="decline__reasons" role="list">
        <li v-for="reason in DECLINE_REASONS" :key="reason">
          <button
            type="button"
            class="decline__reason"
            :aria-current="previousReason === reason ? 'true' : undefined"
            @click="emit('decline', reason, note)"
          >
            {{ t(`events.reasons.${reason}`) }}
          </button>
        </li>
      </ul>
      <UiButton variant="secondary" block @click="emit('decline', null, note)">
        {{ t('events.declineWithoutReason') }}
      </UiButton>
      <button v-if="offerAbsence" type="button" class="decline__away" @click="toAbsence">
        {{ t('events.declineLonger') }}
      </button>
    </div>
  </BottomSheet>
  <AbsenceSheet v-if="offerAbsence" v-model:open="absenceOpen" />
</template>

<style scoped lang="scss">
.decline {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 600;
  }

  &__away {
    @include focus-visible;

    min-height: $touch-target;
    border: 0;
    background: transparent;
    color: var(--color-text);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  &__reasons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-2;
    margin: 0;
  }

  &__reason {
    @include focus-visible;

    width: 100%;
    min-height: 60px;
    border: 2px solid var(--color-border);
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: $font-lg;
    font-weight: 800;

    &[aria-current='true'] {
      border-color: var(--color-no);
    }

    &:active {
      background: var(--color-no);
      color: #ffffff;
    }
  }
}
</style>

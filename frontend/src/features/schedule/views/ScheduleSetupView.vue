<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import UiIcon from '@/ui/UiIcon.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiButton from '@/ui/UiButton.vue'
import UiCard from '@/ui/UiCard.vue'
import UiInput from '@/ui/UiInput.vue'
import { useCreatePitch, useDeletePitch, usePitches } from '../composables/useSchedule'
import { OPEN_FROM, OPEN_UNTIL } from '../logic'
import { pitchSchema } from '../schemas'

const props = defineProps<{ clubId: string }>()

const { t } = useI18n()
const pitches = usePitches(() => props.clubId)
const createPitch = useCreatePitch(() => props.clubId)
const deletePitch = useDeletePitch(() => props.clubId)

/** Two-step delete: first tap arms, second tap deletes. */
const armed = ref<string | null>(null)

const { defineField, errors, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(pitchSchema),
  initialValues: { name: '', splittable: true },
})
const [name] = defineField('name')
const [splittable] = defineField('splittable')

const onCreatePitch = handleSubmit(async (values) => {
  await createPitch.mutateAsync({ clubId: props.clubId, ...values })
  resetForm()
})

function confirmDelete(key: string, action: () => void) {
  if (armed.value === key) {
    armed.value = null
    action()
  } else {
    armed.value = key
  }
}
</script>

<template>
  <section class="setup">
    <header>
      <h1>{{ t('schedule.setup') }}</h1>
      <p class="setup__muted">
        {{ t('schedule.setupIntro', { from: OPEN_FROM, until: OPEN_UNTIL }) }}
      </p>
    </header>

    <p v-if="pitches.isPending.value" class="setup__muted">{{ t('common.loading') }}</p>

    <UiCard v-for="pitch in pitches.data.value" :key="pitch.id" class="setup__pitch">
      <div class="setup__pitch-head">
        <h2 class="setup__pitch-name">{{ pitch.name }}</h2>
        <UiBadge v-if="pitch.splittable" tone="training">{{ t('schedule.splittable') }}</UiBadge>
      </div>

      <p v-if="armed === pitch.id" class="setup__warning">
        {{ t('schedule.deleteWarning') }}
      </p>

      <UiButton
        :variant="armed === pitch.id ? 'danger' : 'ghost'"
        block
        :loading="deletePitch.isPending.value && deletePitch.variables.value === pitch.id"
        @click="confirmDelete(pitch.id, () => deletePitch.mutate(pitch.id))"
      >
        {{ armed === pitch.id ? t('schedule.confirmDelete') : t('schedule.deletePitch') }}
      </UiButton>
    </UiCard>

    <p v-if="deletePitch.isError.value" class="setup__error" role="alert">
      {{ t('schedule.errors.saveFailed') }}
    </p>

    <UiCard>
      <form class="setup__form" novalidate @submit="onCreatePitch">
        <h2 class="setup__pitch-name">{{ t('schedule.addPitch') }}</h2>
        <UiInput
          v-model="name"
          :label="t('schedule.pitchName')"
          :placeholder="t('schedule.pitchNamePlaceholder')"
          required
          :error="errors.name ? t(errors.name) : undefined"
        />
        <label class="setup__check">
          <input v-model="splittable" type="checkbox" class="setup__box" />
          <span>
            {{ t('schedule.splittableLabel') }}
            <span class="setup__muted">{{ t('schedule.splittableHint') }}</span>
          </span>
        </label>
        <p v-if="createPitch.isError.value" class="setup__error" role="alert">
          {{ t('schedule.errors.saveFailed') }}
        </p>
        <UiButton type="submit" block :loading="createPitch.isPending.value">
          <template #icon><UiIcon name="plus" :size="18" /></template>
          {{ t('schedule.addPitch') }}
        </UiButton>
      </form>
    </UiCard>
  </section>
</template>

<style scoped lang="scss">
.setup {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__pitch,
  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__pitch-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  &__pitch-name {
    font-size: $font-lg;
  }

  &__check {
    display: flex;
    align-items: flex-start;
    gap: $space-3;
  }

  &__box {
    @include focus-visible;

    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    accent-color: var(--color-primary);
  }

  &__muted {
    display: block;
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__warning {
    font-size: $font-sm;
    color: var(--color-warning);
    font-weight: 600;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>

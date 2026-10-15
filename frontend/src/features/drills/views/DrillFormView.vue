<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseTextarea from '@/components/BaseTextarea.vue'
import ActionBar from '@/ui/ActionBar.vue'
import UiButton from '@/ui/UiButton.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiInput from '@/ui/UiInput.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import YouTubeEmbed from '../components/YouTubeEmbed.vue'
import type { DrillInput } from '../api'
import { DRILL_CATEGORIES, parseEquipment, parseYouTubeId } from '../logic'
import { drillSchema, toCount } from '../schemas'
import { useCreateDrill, useDrill, useUpdateDrill } from '../composables/useDrills'

const props = defineProps<{ drillId?: string }>()

const { t } = useI18n()
const router = useRouter()
const { activeTeam } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const existing = props.drillId ? useDrill(props.drillId) : null
const createDrill = useCreateDrill(teamId)
const updateDrill = useUpdateDrill()

const { defineField, errors, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(drillSchema),
  initialValues: { category: 'passing' as const },
})
const [title] = defineField('title')
const [description] = defineField('description')
const [category] = defineField('category')
const [durationMin] = defineField('durationMin')
const [minPlayers] = defineField('minPlayers')
const [maxPlayers] = defineField('maxPlayers')
const [equipment] = defineField('equipment')
const [videoUrl] = defineField('videoUrl')

watch(
  () => existing?.data.value,
  (drill) => {
    if (!drill) return
    resetForm({
      values: {
        title: drill.title,
        description: drill.description,
        category: drill.category as (typeof DRILL_CATEGORIES)[number],
        durationMin: drill.duration_min?.toString() ?? '',
        minPlayers: drill.min_players?.toString() ?? '',
        maxPlayers: drill.max_players?.toString() ?? '',
        equipment: drill.equipment.join(', '),
        videoUrl: drill.video_url ?? '',
      },
    })
    // Sections with content start open.
    open.squad = !!(drill.min_players || drill.max_players || drill.equipment.length)
    open.media = !!drill.video_url
  },
  { immediate: true },
)

const categoryOptions = computed(() =>
  DRILL_CATEGORIES.map((c) => ({ value: c, label: t(`drills.categories.${c}`) })),
)
const previewUrl = computed(() =>
  videoUrl.value && parseYouTubeId(videoUrl.value) ? videoUrl.value : null,
)
const isSaving = computed(() => createDrill.isPending.value || updateDrill.isPending.value)
const saveFailed = computed(() => createDrill.isError.value || updateDrill.isError.value)
const err = (key: string | undefined) => (key ? t(key) : undefined)

// Three sections instead of one long page: basics always open, the others on demand.
const open = reactive({ squad: false, media: false })
const sectionErrors = computed(() => ({
  squad: !!(errors.value.minPlayers || errors.value.maxPlayers || errors.value.equipment),
  media: !!errors.value.videoUrl,
}))

const onSubmit = handleSubmit(
  async (values) => {
    const input: DrillInput = {
      title: values.title,
      description: values.description?.trim() ?? '',
      category: values.category,
      duration_min: toCount(values.durationMin),
      min_players: toCount(values.minPlayers),
      max_players: toCount(values.maxPlayers),
      equipment: parseEquipment(values.equipment),
      video_url: values.videoUrl || null,
    }
    const saved = props.drillId
      ? await updateDrill.mutateAsync({ drillId: props.drillId, input })
      : await createDrill.mutateAsync(input)
    await router.replace({ name: 'drill', params: { drillId: saved.id } })
  },
  () => {
    // Show the section that holds the error.
    if (sectionErrors.value.squad) open.squad = true
    if (sectionErrors.value.media) open.media = true
  },
)
</script>

<template>
  <section class="drill-form">
    <h1>{{ drillId ? t('drills.form.editTitle') : t('drills.form.newTitle') }}</h1>

    <p v-if="existing?.isPending.value">{{ t('common.loading') }}</p>

    <form v-else class="drill-form__form" novalidate @submit="onSubmit">
      <fieldset class="drill-form__section">
        <legend class="drill-form__legend">{{ t('drills.form.sections.basics') }}</legend>
        <UiInput
          v-model="title"
          :label="t('drills.form.title')"
          required
          :error="err(errors.title)"
        />
        <BaseChipGroup
          v-model="category"
          :label="t('drills.category')"
          :options="categoryOptions"
        />
        <div class="drill-form__row">
          <UiInput
            v-model="durationMin"
            :label="t('drills.form.duration')"
            type="number"
            inputmode="numeric"
            :error="err(errors.durationMin)"
          />
        </div>
        <BaseTextarea
          v-model="description"
          :label="t('drills.form.description')"
          :placeholder="t('drills.form.descriptionPlaceholder')"
          :rows="6"
          :error="err(errors.description)"
        />
      </fieldset>

      <details
        class="drill-form__more"
        :open="open.squad"
        @toggle="open.squad = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="drill-form__summary">
          <span>{{ t('drills.form.sections.squad') }}</span>
          <span v-if="sectionErrors.squad" class="drill-form__flag">
            <UiIcon name="alert" :size="16" />{{ t('drills.form.sections.check') }}
          </span>
          <UiIcon name="chevronDown" :size="20" class="drill-form__chevron" />
        </summary>
        <div class="drill-form__body">
          <div class="drill-form__row">
            <UiInput
              v-model="minPlayers"
              :label="t('drills.form.minPlayers')"
              type="number"
              inputmode="numeric"
              :error="err(errors.minPlayers)"
            />
            <UiInput
              v-model="maxPlayers"
              :label="t('drills.form.maxPlayers')"
              type="number"
              inputmode="numeric"
              :error="err(errors.maxPlayers)"
            />
          </div>
          <UiInput
            v-model="equipment"
            :label="t('drills.form.equipment')"
            :hint="t('drills.form.equipmentHint')"
            :error="err(errors.equipment)"
          />
        </div>
      </details>

      <details
        class="drill-form__more"
        :open="open.media"
        @toggle="open.media = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="drill-form__summary">
          <span>{{ t('drills.form.sections.media') }}</span>
          <span v-if="sectionErrors.media" class="drill-form__flag">
            <UiIcon name="alert" :size="16" />{{ t('drills.form.sections.check') }}
          </span>
          <UiIcon name="chevronDown" :size="20" class="drill-form__chevron" />
        </summary>
        <div class="drill-form__body">
          <UiInput
            v-model="videoUrl"
            :label="t('drills.form.video')"
            type="url"
            placeholder="https://youtu.be/…"
            :hint="t('drills.form.videoHint')"
            :error="err(errors.videoUrl)"
          />
          <YouTubeEmbed v-if="previewUrl" :url="previewUrl" :title="title ?? ''" />
          <p class="drill-form__hint">{{ t('drills.form.sections.mediaHint') }}</p>
        </div>
      </details>

      <p v-if="saveFailed" class="drill-form__error" role="alert">
        {{ t('drills.form.saveFailed') }}
      </p>

      <ActionBar :label="t('drills.form.sections.actions')">
        <UiButton variant="secondary" @click="router.back()">{{ t('common.cancel') }}</UiButton>
        <UiButton type="submit" :loading="isSaving" class="drill-form__save">
          {{ t('common.save') }}
        </UiButton>
      </ActionBar>
    </form>
  </section>
</template>

<style scoped lang="scss">
.drill-form {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-4;
    margin: 0;
    padding: 0;
    border: 0;
  }

  &__legend {
    margin-bottom: $space-3;
    font-family: var(--font-display);
    font-size: $font-xl;
    font-weight: 800;
  }

  &__more {
    border-radius: $radius-xl;
    background: var(--color-surface);
  }

  &__summary {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: 56px;
    padding: 0 $space-4;
    border-radius: $radius-xl;
    font-family: var(--font-display);
    font-size: $font-xl;
    font-weight: 800;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }

    > :first-child {
      flex: 1;
    }
  }

  &__more[open] &__chevron {
    transform: rotate(180deg);
  }

  &__flag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-danger);
    font-family: var(--font-sans);
    font-size: $font-sm;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $space-4;
    padding: 0 $space-4 $space-4;
  }

  &__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-2;
  }

  &__hint {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__save {
    flex: 1;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>

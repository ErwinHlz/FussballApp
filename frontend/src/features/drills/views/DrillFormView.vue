<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import BaseButton from '@/components/BaseButton.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseTextarea from '@/components/BaseTextarea.vue'
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

const onSubmit = handleSubmit(async (values) => {
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
})
</script>

<template>
  <section class="drill-form">
    <h1>{{ drillId ? t('drills.form.editTitle') : t('drills.form.newTitle') }}</h1>

    <p v-if="existing?.isPending.value">{{ t('common.loading') }}</p>

    <form v-else class="drill-form__form" novalidate @submit="onSubmit">
      <BaseInput
        v-model="title"
        :label="t('drills.form.title')"
        required
        :error="err(errors.title)"
      />
      <BaseChipGroup v-model="category" :label="t('drills.category')" :options="categoryOptions" />
      <BaseTextarea
        v-model="description"
        :label="t('drills.form.description')"
        :placeholder="t('drills.form.descriptionPlaceholder')"
        :rows="7"
        :error="err(errors.description)"
      />
      <div class="drill-form__row">
        <BaseInput
          v-model="durationMin"
          :label="t('drills.form.duration')"
          type="number"
          :error="err(errors.durationMin)"
        />
        <BaseInput
          v-model="minPlayers"
          :label="t('drills.form.minPlayers')"
          type="number"
          :error="err(errors.minPlayers)"
        />
        <BaseInput
          v-model="maxPlayers"
          :label="t('drills.form.maxPlayers')"
          type="number"
          :error="err(errors.maxPlayers)"
        />
      </div>
      <BaseInput
        v-model="equipment"
        :label="t('drills.form.equipment')"
        :hint="t('drills.form.equipmentHint')"
        :error="err(errors.equipment)"
      />
      <BaseInput
        v-model="videoUrl"
        :label="t('drills.form.video')"
        type="url"
        placeholder="https://youtu.be/…"
        :hint="t('drills.form.videoHint')"
        :error="err(errors.videoUrl)"
      />
      <YouTubeEmbed v-if="previewUrl" :url="previewUrl" :title="title ?? ''" />

      <p v-if="saveFailed" class="drill-form__error" role="alert">
        {{ t('drills.form.saveFailed') }}
      </p>
      <div class="drill-form__actions">
        <BaseButton variant="secondary" @click="router.back()">{{ t('common.cancel') }}</BaseButton>
        <BaseButton type="submit" :loading="isSaving">{{ t('common.save') }}</BaseButton>
      </div>
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
    gap: $space-4;
  }

  &__row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $space-2;
  }

  &__actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: $space-2;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>

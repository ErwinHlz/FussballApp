<script setup lang="ts">
import { computed, reactive, ref, toRaw, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import UiTextarea from '@/ui/UiTextarea.vue'
import ActionBar from '@/ui/ActionBar.vue'
import UiButton from '@/ui/UiButton.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiInput from '@/ui/UiInput.vue'
import UiWheel from '@/ui/UiWheel.vue'
import UiWheelPicker from '@/ui/UiWheelPicker.vue'
import { FEATURES } from '@/lib/features'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import BoardEditor from '@/features/board/components/BoardEditor.vue'
import { useBoardSquad } from '@/features/board/composables/useBoardSquad'
import {
  animationSchema,
  emptyAnimation,
  parseAnimation,
  type Animation,
} from '@/features/board/schema'
import type { Json } from '@/types/database'
import DrillThumb from '../components/DrillThumb.vue'
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

// The animation lives in the form and is saved with the drill (also for a new drill).
const animation = ref<Animation | null>(null)

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
    animation.value = parseAnimation(drill.animation)
    // Sections with content start open.
    open.squad = !!(drill.min_players || drill.max_players || drill.equipment.length)
    open.animation = !!animation.value
    open.media = !!drill.video_url
  },
  { immediate: true },
)

const categoryOptions = computed(() =>
  DRILL_CATEGORIES.map((c) => ({ value: c, label: t(`drills.categories.${c}`) })),
)
// Duration as hours and minutes (5-minute steps, plus an older value off that grid). The
// database allows at most 3 hours, so 3 hours sets the minutes to 0.
const MAX_DURATION = 180
const total = computed(() => Number(durationMin.value) || 0)
function setDuration(hours: number, minutes: number) {
  const value = Math.min(MAX_DURATION, hours * 60 + minutes)
  durationMin.value = value ? String(value) : ''
}
const durationHours = computed({
  get: () => String(Math.floor(total.value / 60)),
  set: (h) => setDuration(Number(h), total.value % 60),
})
const durationMinutes = computed({
  get: () => String(total.value % 60),
  set: (m) => setDuration(Math.floor(total.value / 60), Number(m)),
})
const hourOptions = computed(() =>
  [0, 1, 2, 3].map((n) => ({ value: String(n), label: t('drills.form.hours', { n }) })),
)
const minuteOptions = computed(() => {
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5)
  const current = total.value % 60
  if (!minutes.includes(current)) minutes.push(current)
  return minutes
    .sort((a, b) => a - b)
    .map((n) => ({ value: String(n), label: t('drills.minutes', { n }) }))
})
const previewUrl = computed(() =>
  videoUrl.value && parseYouTubeId(videoUrl.value) ? videoUrl.value : null,
)
const isSaving = computed(() => createDrill.isPending.value || updateDrill.isPending.value)
const saveFailed = computed(() => createDrill.isError.value || updateDrill.isError.value)
const err = (key: string | undefined) => (key ? t(key) : undefined)

// Folding sections instead of one long page: the core data starts open, the others on demand.
const open = reactive({ basics: true, squad: false, animation: false, media: false })
const sectionErrors = computed(() => ({
  basics: !!(errors.value.title || errors.value.description),
  squad: !!(errors.value.minPlayers || errors.value.maxPlayers || errors.value.equipment),
  media: !!errors.value.videoUrl,
}))

// --- Animation builder in a full-screen window -------------------------------------------
const squad = useBoardSquad(() => teamId.value)
const builderOpen = ref(false)
const builderDraft = ref<Animation>(emptyAnimation())
let builderStart = ''
const builderError = ref(false)
const animationSummary = computed(() =>
  animation.value
    ? t(
        'drills.form.animation.summary',
        {
          steps: animation.value.keyframes.length,
          seconds: (animation.value.durationMs / 1000).toLocaleString(),
        },
        animation.value.keyframes.length,
      )
    : t('drills.form.animation.empty'),
)

function openBuilder() {
  builderDraft.value = structuredClone(toRaw(animation.value) ?? emptyAnimation())
  builderStart = JSON.stringify(builderDraft.value)
  builderError.value = false
  builderOpen.value = true
}

/** Closing without taking over the changes asks first. */
function canCloseBuilder() {
  return (
    JSON.stringify(builderDraft.value) === builderStart ||
    window.confirm(t('drills.form.animation.discardConfirm'))
  )
}

function cancelBuilder() {
  if (canCloseBuilder()) builderOpen.value = false
}

function applyBuilder() {
  const result = animationSchema.safeParse(builderDraft.value)
  if (!result.success) {
    builderError.value = true
    return
  }
  // An empty pitch is no animation.
  animation.value = result.data.objects.length ? (result.data as Animation) : null
  builderStart = JSON.stringify(builderDraft.value)
  builderOpen.value = false
}

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
      animation: (animation.value as unknown as Json) ?? null,
    }
    const saved = props.drillId
      ? await updateDrill.mutateAsync({ drillId: props.drillId, input })
      : await createDrill.mutateAsync(input)
    await router.replace({ name: 'drill', params: { drillId: saved.id } })
  },
  () => {
    // Show the section that holds the error.
    if (sectionErrors.value.basics) open.basics = true
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
      <details
        class="fold"
        :open="open.basics"
        @toggle="open.basics = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="fold__summary">
          <span class="fold__title">{{ t('drills.form.sections.basics') }}</span>
          <span v-if="sectionErrors.basics" class="fold__flag">
            <UiIcon name="alert" :size="16" />{{ t('drills.form.sections.check') }}
          </span>
          <UiIcon name="chevronDown" :size="20" class="fold__chevron" />
        </summary>
        <div class="fold__body">
          <UiInput
            v-model="title"
            :label="t('drills.form.title')"
            required
            :error="err(errors.title)"
          />
          <div class="drill-form__row">
            <UiWheelPicker :label="t('drills.category')">
              <UiWheel
                v-model="category"
                :label="t('drills.category')"
                :options="categoryOptions"
              />
            </UiWheelPicker>
            <UiWheelPicker :label="t('drills.duration')">
              <UiWheel
                v-model="durationHours"
                :label="t('drills.form.hoursLabel')"
                :options="hourOptions"
              />
              <UiWheel
                v-model="durationMinutes"
                :label="t('drills.form.minutesLabel')"
                :options="minuteOptions"
              />
            </UiWheelPicker>
          </div>
          <UiTextarea
            v-model="description"
            :label="t('drills.form.description')"
            :placeholder="t('drills.form.descriptionPlaceholder')"
            :rows="6"
            :error="err(errors.description)"
          />
        </div>
      </details>

      <details
        class="fold"
        :open="open.squad"
        @toggle="open.squad = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="fold__summary">
          <span class="fold__title">{{ t('drills.form.sections.squad') }}</span>
          <span v-if="sectionErrors.squad" class="fold__flag">
            <UiIcon name="alert" :size="16" />{{ t('drills.form.sections.check') }}
          </span>
          <UiIcon name="chevronDown" :size="20" class="fold__chevron" />
        </summary>
        <div class="fold__body">
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
        class="fold"
        :open="open.animation"
        @toggle="open.animation = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="fold__summary">
          <span class="fold__title">{{ t('drills.form.sections.animation') }}</span>
          <UiIcon name="chevronDown" :size="20" class="fold__chevron" />
        </summary>
        <div class="fold__body">
          <div class="drill-form__animation">
            <DrillThumb
              :drill="{
                animation: animation as unknown as Json,
                video_url: null,
                video_path: null,
              }"
              class="drill-form__preview"
            />
            <div class="drill-form__animation-text">
              <p class="drill-form__animation-summary">{{ animationSummary }}</p>
              <p class="drill-form__hint">{{ t('drills.form.animation.hint') }}</p>
            </div>
          </div>
          <UiButton variant="secondary" block @click="openBuilder">
            {{ animation ? t('board.editAnimation') : t('board.createAnimation') }}
          </UiButton>
          <UiButton v-if="animation" variant="ghost" block @click="animation = null">
            {{ t('board.removeAnimation') }}
          </UiButton>
        </div>
      </details>

      <details
        v-if="FEATURES.videos"
        class="fold"
        :open="open.media"
        @toggle="open.media = ($event.target as HTMLDetailsElement).open"
      >
        <summary class="fold__summary">
          <span class="fold__title">{{ t('drills.form.sections.media') }}</span>
          <span v-if="sectionErrors.media" class="fold__flag">
            <UiIcon name="alert" :size="16" />{{ t('drills.form.sections.check') }}
          </span>
          <UiIcon name="chevronDown" :size="20" class="fold__chevron" />
        </summary>
        <div class="fold__body">
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

      <BoardEditor
        v-if="builderOpen"
        v-model="builderDraft"
        :heading="t('board.title')"
        :eyebrow="title || undefined"
        :title="title ?? ''"
        :squad="squad"
        @back="cancelBuilder"
      >
        <template #actions>
          <UiButton @click="applyBuilder">{{ t('drills.form.animation.apply') }}</UiButton>
        </template>
        <template #status>
          <p v-if="builderError" class="drill-form__error" role="alert">
            {{ t('board.invalid') }}
          </p>
        </template>
      </BoardEditor>

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

  // Small preview next to the summary; the builder opens in a full-screen window.
  &__animation {
    display: flex;
    align-items: center;
    gap: $space-3;
  }

  &__preview {
    flex-shrink: 0;
    width: 128px;
  }

  &__animation-text {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    min-width: 0;
  }

  &__animation-summary {
    font-weight: 700;
  }

  &__row {
    display: grid;
    align-items: start;
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

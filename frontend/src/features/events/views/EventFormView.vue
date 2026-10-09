<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { addDays, addMonths, differenceInHours, format } from 'date-fns'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseTextarea from '@/components/BaseTextarea.vue'
import { formatDate } from '@/lib/date'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import type { EventInput } from '../api'
import {
  COMPETITIONS,
  DEADLINE_HOURS,
  deadlineFromHours,
  generateMultiWeekdayOccurrences,
  type Competition,
} from '../logic'
import {
  combineDateTime,
  eventSchema,
  matchSchema,
  parseDeadline,
  seriesSchema,
  trainingSchema,
} from '../schemas'
import { useCreateEvent, useCreateSeries, useEvent, useUpdateEvent } from '../composables/useEvents'

type Kind = 'training' | 'series' | 'match' | 'event'

const props = defineProps<{ kind?: Kind; eventId?: string }>()

const { t, locale } = useI18n()
const router = useRouter()
const { activeTeam } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)

const isEdit = computed(() => !!props.eventId)
const existing = props.eventId ? useEvent(props.eventId) : null
const kind = computed<Kind>(() =>
  isEdit.value ? (existing?.data.value?.type ?? 'training') : (props.kind ?? 'training'),
)

const createEvent = useCreateEvent(teamId)
const createSeries = useCreateSeries()
const updateEvent = useUpdateEvent()

const schema = computed(() =>
  toTypedSchema(
    kind.value === 'series'
      ? seriesSchema
      : kind.value === 'match'
        ? matchSchema
        : kind.value === 'event'
          ? eventSchema
          : trainingSchema,
  ),
)

const today = format(new Date(), 'yyyy-MM-dd')
const { defineField, errors, handleSubmit, resetForm, values } = useForm({
  // Shared superset of fields; the active schema validates the relevant ones.
  validationSchema: schema,
  initialValues: {
    date: today,
    startTime: '19:00',
    kickoffTime: '15:00',
    durationMin: '90',
    deadline: 'none',
    weekdays: [] as string[],
    validFrom: today,
    validUntil: format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
    venue: 'home',
    competition: 'league',
  } as Record<string, unknown>,
})

const field = (name: string) => defineField(name as never)[0]
const date = field('date')
const startTime = field('startTime')
const kickoffTime = field('kickoffTime')
const meetTime = field('meetTime')
const meetLocation = field('meetLocation')
const durationMin = field('durationMin')
const location = field('location')
const notes = field('notes')
const deadline = field('deadline')
const weekdays = field('weekdays')
const validFrom = field('validFrom')
const validUntil = field('validUntil')
const opponent = field('opponent')
const eventTitle = field('title')
const venue = field('venue')
const competition = field('competition')

const err = (name: string) => {
  const key = (errors.value as Record<string, string | undefined>)[name]
  return key ? t(key) : undefined
}

// Prefill when editing a single event.
watch(
  () => existing?.data.value,
  (event) => {
    if (!event) return
    const starts = new Date(event.starts_at)
    const hoursBefore = event.response_deadline
      ? differenceInHours(starts, new Date(event.response_deadline))
      : null
    resetForm({
      values: {
        date: format(starts, 'yyyy-MM-dd'),
        startTime: format(starts, 'HH:mm'),
        kickoffTime: format(starts, 'HH:mm'),
        meetTime: event.meet_at ? format(new Date(event.meet_at), 'HH:mm') : '',
        meetLocation: event.meet_location ?? '',
        durationMin: event.ends_at
          ? String(Math.round((new Date(event.ends_at).getTime() - starts.getTime()) / 60000))
          : '90',
        location: event.location ?? '',
        notes: event.notes ?? '',
        deadline: hoursBefore === null ? 'none' : String(hoursBefore),
        opponent: event.opponent ?? '',
        title: event.title ?? '',
        venue: event.is_home === false ? 'away' : 'home',
        competition: event.competition ?? 'league',
      },
    })
  },
  { immediate: true },
)

const deadlineOptions = computed(() => {
  const hours = new Set<number>(DEADLINE_HOURS)
  const current = parseDeadline(String(deadline.value ?? 'none'))
  if (current !== null) hours.add(current)
  return [
    { value: 'none', label: t('events.form.noDeadline') },
    ...[...hours]
      .sort((a, b) => a - b)
      .map((h) => ({ value: String(h), label: t('events.form.hoursBefore', h) })),
  ]
})
const weekdayOptions = computed(() =>
  [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    value: String(d),
    // 2030-01-06 is a Sunday: add d days to get the weekday name.
    label: formatDate(addDays(new Date(2030, 0, 6), d), locale.value, 'EEEEEE'),
  })),
)
const venueOptions = computed(() => [
  { value: 'home', label: t('events.home') },
  { value: 'away', label: t('events.away') },
])
const competitionOptions = computed(() =>
  COMPETITIONS.map((c) => ({ value: c, label: t(`events.competition.${c}`) })),
)

// Series preview: how many trainings will be created.
const seriesPreview = computed(() => {
  if (kind.value !== 'series') return []
  const v = values as Record<string, string | string[] | undefined>
  return generateMultiWeekdayOccurrences(((v.weekdays as string[]) ?? []).map(Number), {
    startTime: String(v.startTime ?? '19:00'),
    validFrom: String(v.validFrom ?? ''),
    validUntil: String(v.validUntil ?? ''),
  })
})
const seriesCount = computed(() => seriesPreview.value.reduce((n, s) => n + s.dates.length, 0))
const seriesFirstDate = computed(() => {
  const first = seriesPreview.value
    .flatMap((s) => s.dates)
    .sort((a, b) => a.getTime() - b.getTime())[0]
  return first ? formatDate(first, locale.value, 'EEEE, PPP') : null
})

const isSaving = computed(
  () => createEvent.isPending.value || createSeries.isPending.value || updateEvent.isPending.value,
)
const saveFailed = computed(
  () => createEvent.isError.value || createSeries.isError.value || updateEvent.isError.value,
)

const title = computed(() => {
  if (isEdit.value) return t('events.form.editTitle')
  return t(`events.form.newTitle.${kind.value}`)
})

const onSubmit = handleSubmit(async (raw) => {
  const v = raw as Record<string, string | string[] | undefined>
  const text = (key: string) => (typeof v[key] === 'string' && v[key] ? (v[key] as string) : null)
  const deadlineHours = parseDeadline(String(v.deadline))

  if (kind.value === 'series') {
    for (const series of seriesPreview.value) {
      if (!series.dates.length) continue
      await createSeries.mutateAsync({
        teamId: teamId.value!,
        weekday: series.weekday,
        startTime: String(v.startTime),
        durationMin: Number(v.durationMin),
        location: text('location'),
        validFrom: String(v.validFrom),
        validUntil: String(v.validUntil),
        startsAt: series.dates,
        deadlineHours,
      })
    }
    await router.replace({ name: 'events' })
    return
  }

  let input: EventInput
  if (kind.value === 'match') {
    const startsAt = combineDateTime(String(v.date), String(v.kickoffTime))
    input = {
      type: 'match',
      starts_at: startsAt.toISOString(),
      ends_at: null,
      meet_at: text('meetTime')
        ? combineDateTime(String(v.date), String(v.meetTime)).toISOString()
        : null,
      meet_location: text('meetLocation'),
      location: text('location'),
      notes: text('notes'),
      response_deadline: deadlineFromHours(startsAt, deadlineHours)?.toISOString() ?? null,
      opponent: String(v.opponent).trim(),
      is_home: v.venue === 'home',
      competition: v.competition as Competition,
    }
  } else {
    const startsAt = combineDateTime(String(v.date), String(v.startTime))
    input = {
      type: kind.value === 'event' ? 'event' : 'training',
      ...(kind.value === 'event' ? { title: String(v.title).trim() } : {}),
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + Number(v.durationMin) * 60000).toISOString(),
      location: text('location'),
      notes: text('notes'),
      response_deadline: deadlineFromHours(startsAt, deadlineHours)?.toISOString() ?? null,
    }
  }

  if (props.eventId) {
    // The type of an existing event cannot change.
    const patch: Partial<EventInput> = { ...input }
    delete patch.type
    await updateEvent.mutateAsync({ eventId: props.eventId, patch })
    await router.replace({ name: 'event', params: { eventId: props.eventId } })
  } else {
    const created = await createEvent.mutateAsync(input)
    await router.replace({ name: 'event', params: { eventId: created.id } })
  }
})
</script>

<template>
  <section class="event-form">
    <h1>{{ title }}</h1>

    <p v-if="existing?.isPending.value">{{ t('common.loading') }}</p>

    <form v-else class="event-form__form" novalidate @submit="onSubmit">
      <!-- Team event -->
      <BaseInput
        v-if="kind === 'event'"
        v-model="eventTitle"
        :label="t('events.form.eventTitle')"
        :placeholder="t('events.form.eventTitlePlaceholder')"
        required
        :error="err('title')"
      />

      <!-- Match -->
      <template v-if="kind === 'match'">
        <BaseInput
          v-model="opponent"
          :label="t('events.form.opponent')"
          required
          :error="err('opponent')"
        />
        <BaseChipGroup v-model="venue" :label="t('events.form.venue')" :options="venueOptions" />
        <BaseChipGroup
          v-model="competition"
          :label="t('events.form.competition')"
          :options="competitionOptions"
        />
      </template>

      <!-- Series -->
      <template v-if="kind === 'series'">
        <BaseChipGroup
          v-model="weekdays"
          :label="t('events.form.weekdays')"
          :options="weekdayOptions"
          :columns="7"
          multiple
        />
        <p v-if="err('weekdays')" class="event-form__error" role="alert">{{ err('weekdays') }}</p>
        <div class="event-form__row">
          <BaseInput
            v-model="validFrom"
            :label="t('events.form.validFrom')"
            type="date"
            required
            :error="err('validFrom')"
          />
          <BaseInput
            v-model="validUntil"
            :label="t('events.form.validUntil')"
            type="date"
            required
            :error="err('validUntil')"
          />
        </div>
      </template>
      <BaseInput
        v-else
        v-model="date"
        :label="t('events.form.date')"
        type="date"
        required
        :error="err('date')"
      />

      <div class="event-form__row">
        <BaseInput
          v-if="kind === 'match'"
          v-model="kickoffTime"
          :label="t('events.form.kickoff')"
          type="time"
          required
          :error="err('kickoffTime')"
        />
        <BaseInput
          v-else
          v-model="startTime"
          :label="t('events.form.startTime')"
          type="time"
          required
          :error="err('startTime')"
        />
        <BaseInput
          v-if="kind !== 'match'"
          v-model="durationMin"
          :label="t('events.form.duration')"
          type="number"
          required
          :error="err('durationMin')"
        />
        <BaseInput
          v-else
          v-model="meetTime"
          :label="t('events.form.meetTime')"
          type="time"
          :error="err('meetTime')"
        />
      </div>

      <BaseInput
        v-if="kind === 'match'"
        v-model="meetLocation"
        :label="t('events.form.meetLocation')"
        :error="err('meetLocation')"
      />
      <BaseInput
        v-model="location"
        :label="kind === 'match' ? t('events.form.venueLocation') : t('events.form.location')"
        :error="err('location')"
      />
      <BaseChipGroup
        v-model="deadline"
        :label="t('events.form.deadline')"
        :options="deadlineOptions"
      />
      <BaseTextarea
        v-if="kind !== 'series'"
        v-model="notes"
        :label="t('events.form.notes')"
        :error="err('notes')"
      />

      <BaseCard v-if="kind === 'series'" padding="sm" class="event-form__preview" role="status">
        <strong>{{ t('events.form.seriesCount', seriesCount) }}</strong>
        <span v-if="seriesFirstDate" class="event-form__muted">
          {{ t('events.form.seriesFirst', { date: seriesFirstDate }) }}
        </span>
      </BaseCard>

      <p v-if="saveFailed" class="event-form__error" role="alert">
        {{ t('events.form.saveFailed') }}
      </p>

      <div class="event-form__actions">
        <BaseButton variant="secondary" @click="router.back()">{{ t('common.cancel') }}</BaseButton>
        <BaseButton
          type="submit"
          :loading="isSaving"
          :disabled="kind === 'series' && seriesCount === 0"
        >
          {{
            kind === 'series' && !isEdit
              ? t('events.form.createSeries', seriesCount)
              : t('common.save')
          }}
        </BaseButton>
      </div>
    </form>
  </section>
</template>

<style scoped lang="scss">
.event-form {
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
    grid-template-columns: 1fr 1fr;
    gap: $space-3;
  }

  &__preview {
    display: flex;
    flex-direction: column;
    gap: $space-1;
  }

  &__actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: $space-2;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>

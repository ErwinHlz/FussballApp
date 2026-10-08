<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import type { TeamMember } from '@/features/teams/api'
import { SQUAD_ROLES, type SquadRole, type TeamEvent } from '../logic'
import { useSetMatchSquad } from '../composables/useEvents'

const props = defineProps<{ event: TeamEvent; members: TeamMember[] }>()

const { t } = useI18n()
const save = useSetMatchSquad()

type Choice = SquadRole | 'none'
const choices = ref<Record<string, Choice>>({})
const saved = ref(false)

function reset() {
  choices.value = Object.fromEntries(props.event.match_squad.map((s) => [s.member_id, s.role]))
  saved.value = false
}
watch(() => props.event.match_squad, reset, { immediate: true })

// Players who said yes (or maybe) can be nominated; already nominated ones stay visible.
const candidates = computed(() => {
  const status = new Map(props.event.attendances.map((a) => [a.member_id, a.status]))
  return props.members
    .filter((m) => m.role === 'player')
    .filter((m) => ['yes', 'maybe'].includes(status.get(m.id) ?? '') || choices.value[m.id])
    .map((m) => ({ member: m, status: status.get(m.id) ?? null }))
})

const counts = computed(() => {
  const c: Record<SquadRole, number> = { starter: 0, bench: 0, reserve: 0 }
  for (const role of Object.values(choices.value)) if (role !== 'none') c[role]++
  return c
})

function choose(memberId: string, role: Choice) {
  choices.value = { ...choices.value, [memberId]: role }
  saved.value = false
}

async function submit() {
  const entries = Object.entries(choices.value)
    .filter((entry): entry is [string, SquadRole] => entry[1] !== 'none')
    .map(([member_id, role]) => ({ member_id, role }))
  await save.mutateAsync({ eventId: props.event.id, entries })
  saved.value = true
}

const options: Choice[] = [...SQUAD_ROLES, 'none']
</script>

<template>
  <section class="squad-editor" aria-labelledby="squad-editor-title">
    <h2 id="squad-editor-title" class="squad-editor__title">{{ t('events.nomination.title') }}</h2>
    <p class="squad-editor__muted">
      {{ t('events.nomination.counts', counts) }}
    </p>

    <p v-if="!candidates.length" class="squad-editor__muted">
      {{ t('events.nomination.noCandidates') }}
    </p>

    <ul v-else class="squad-editor__list" role="list">
      <li v-for="{ member, status } in candidates" :key="member.id" class="squad-editor__row">
        <span class="squad-editor__name">
          <span v-if="member.shirt_number !== null" class="squad-editor__number">{{
            member.shirt_number
          }}</span>
          {{ member.display_name }}
          <span v-if="status === 'maybe'" class="squad-editor__muted"
            >({{ t('events.answer.maybe') }})</span
          >
        </span>
        <div class="squad-editor__choices" role="group" :aria-label="member.display_name">
          <button
            v-for="option in options"
            :key="option"
            type="button"
            class="squad-editor__choice"
            :class="{ 'squad-editor__choice--selected': (choices[member.id] ?? 'none') === option }"
            :aria-pressed="(choices[member.id] ?? 'none') === option"
            @click="choose(member.id, option)"
          >
            {{ t(`events.squadRoleShort.${option}`) }}
          </button>
        </div>
      </li>
    </ul>

    <p v-if="save.isError.value" class="squad-editor__error" role="alert">
      {{ t('events.nomination.saveFailed') }}
    </p>
    <p v-if="saved" class="squad-editor__saved" role="status">
      ✓ {{ t('events.nomination.saved') }}
    </p>
    <BaseButton
      block
      :loading="save.isPending.value"
      :disabled="!candidates.length"
      @click="submit"
    >
      {{ t('events.nomination.save') }}
    </BaseButton>
  </section>
</template>

<style scoped lang="scss">
.squad-editor {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__title {
    font-size: $font-lg;
  }

  &__list {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
  }

  &__row {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding: $space-3;

    & + & {
      border-top: 1px solid var(--color-border);
    }
  }

  &__name {
    display: flex;
    align-items: center;
    gap: $space-2;
    font-weight: 600;
  }

  &__number {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: $radius-full;
    background: var(--color-surface-muted);
    font-size: $font-sm;
    font-weight: 800;
  }

  &__choices {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $space-1;
  }

  &__choice {
    @include touch-target;
    @include focus-visible;

    padding: $space-1;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    font-size: $font-sm;
    font-weight: 700;

    &--selected {
      border-color: var(--color-match);
      background: var(--color-match);
      color: #fff;
    }
  }

  &__muted {
    font-size: $font-sm;
    font-weight: 400;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }

  &__saved {
    color: var(--color-success);
    font-weight: 600;
  }
}
</style>

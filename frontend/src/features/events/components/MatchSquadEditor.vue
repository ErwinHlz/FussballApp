<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiAvatar from '@/ui/UiAvatar.vue'
import UiButton from '@/ui/UiButton.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import type { TeamMember } from '@/features/teams/api'
import { SQUAD_ROLES, type SquadRole, type TeamEvent } from '../logic'
import { useSetMatchSquad } from '../composables/useEvents'

/**
 * Match squad: counters for starters, bench and reserve; each player's role switches with a
 * tap (not nominated → starter → bench → reserve → not nominated).
 */
const props = defineProps<{ event: TeamEvent; members: TeamMember[] }>()

const { t } = useI18n()
const snackbar = useSnackbar()
const save = useSetMatchSquad()

type Choice = SquadRole | 'none'
const order: Choice[] = ['none', ...SQUAD_ROLES]
const choices = ref<Record<string, Choice>>({})
const dirty = ref(false)

function reset() {
  choices.value = Object.fromEntries(props.event.match_squad.map((s) => [s.member_id, s.role]))
  dirty.value = false
}
watch(() => props.event.match_squad, reset, { immediate: true })

// Players who said yes (or maybe) can be nominated; already nominated ones stay visible.
const candidates = computed(() => {
  const status = new Map(props.event.attendances.map((a) => [a.member_id, a.status]))
  return props.members
    .filter((m) => m.role === 'player')
    .filter((m) => ['yes', 'maybe'].includes(status.get(m.id) ?? '') || choices.value[m.id])
    .map((m) => ({ member: m, status: status.get(m.id) ?? null }))
    .sort((a, b) => (a.member.shirt_number ?? 999) - (b.member.shirt_number ?? 999))
})

const counts = computed(() => {
  const c: Record<SquadRole, number> = { starter: 0, bench: 0, reserve: 0 }
  for (const role of Object.values(choices.value)) if (role !== 'none') c[role]++
  return c
})

function roleOf(memberId: string): Choice {
  return choices.value[memberId] ?? 'none'
}

function cycle(memberId: string) {
  const next = order[(order.indexOf(roleOf(memberId)) + 1) % order.length]!
  choices.value = { ...choices.value, [memberId]: next }
  dirty.value = true
}

async function submit() {
  const entries = Object.entries(choices.value)
    .filter((entry): entry is [string, SquadRole] => entry[1] !== 'none')
    .map(([member_id, role]) => ({ member_id, role }))
  try {
    await save.mutateAsync({ eventId: props.event.id, entries })
    dirty.value = false
    snackbar.show({ text: t('events.nomination.saved') })
  } catch {
    snackbar.show({ text: t('events.nomination.saveFailed'), tone: 'error' })
  }
}
</script>

<template>
  <section class="squad-editor" aria-labelledby="squad-editor-title">
    <h2 id="squad-editor-title">{{ t('events.nomination.title') }}</h2>

    <div class="squad-editor__counts">
      <span
        v-for="role in SQUAD_ROLES"
        :key="role"
        class="squad-editor__count"
        :class="`squad-editor__count--${role}`"
      >
        <span class="squad-editor__number">{{ counts[role] }}</span>
        <span class="squad-editor__label">{{ t(`events.squadRole.${role}`) }}</span>
      </span>
    </div>

    <p v-if="!candidates.length" class="squad-editor__muted">
      {{ t('events.nomination.noCandidates') }}
    </p>

    <template v-else>
      <p class="squad-editor__muted">{{ t('events.nomination.tapHint') }}</p>
      <ul class="squad-editor__list" role="list">
        <li v-for="{ member, status } in candidates" :key="member.id" class="squad-editor__row">
          <UiAvatar :name="member.display_name" :number="member.shirt_number" :size="36" />
          <span class="squad-editor__name">
            {{ member.display_name }}
            <span v-if="status === 'maybe'" class="squad-editor__muted">
              ({{ t('events.answer.maybe') }})
            </span>
          </span>
          <button
            type="button"
            class="squad-editor__role"
            :class="`squad-editor__role--${roleOf(member.id)}`"
            :aria-label="
              t('events.nomination.roleOf', {
                name: member.display_name,
                role: t(`events.squadRoleLong.${roleOf(member.id)}`),
              })
            "
            @click="cycle(member.id)"
          >
            {{ t(`events.squadRoleLong.${roleOf(member.id)}`) }}
          </button>
        </li>
      </ul>
      <UiButton
        block
        :variant="dirty ? 'primary' : 'secondary'"
        :disabled="!dirty"
        :loading="save.isPending.value"
        @click="submit"
      >
        {{ dirty ? t('events.nomination.save') : `✓ ${t('events.nomination.saved')}` }}
      </UiButton>
    </template>
  </section>
</template>

<style scoped lang="scss">
.squad-editor {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__counts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: $space-2;
  }

  &__count {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: $space-2;
    border-radius: $radius-lg;
    background: var(--color-surface);

    &--starter {
      box-shadow: inset 0 -4px 0 var(--color-primary);
    }
  }

  &__number {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }

  &__label,
  &__muted {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 600;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: 56px;
    padding: $space-2 $space-2 $space-2 $space-3;
    border-radius: $radius-lg;
    background: var(--color-surface);
  }

  &__name {
    flex: 1;
    min-width: 0;
    font-weight: 700;
  }

  &__role {
    @include focus-visible;

    min-width: 112px;
    min-height: $touch-target;
    padding: 0 $space-3;
    border: 2px dashed var(--color-chalk);
    border-radius: $radius-full;
    background: transparent;
    color: var(--color-text-muted);
    font-weight: 800;

    &--starter {
      border: 2px solid var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-contrast);
    }

    &--bench {
      border: 2px solid var(--color-text);
      color: var(--color-text);
    }

    &--reserve {
      border: 2px solid var(--color-border);
      color: var(--color-text);
    }
  }
}
</style>

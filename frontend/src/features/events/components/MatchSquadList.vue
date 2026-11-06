<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiAvatar from '@/ui/UiAvatar.vue'
import type { TeamMember } from '@/features/teams/api'
import { matchSquad, type TeamEvent } from '../logic'

/**
 * The squad of a match: everyone who said yes, with their shirt number. No starters, bench or
 * reserve; the answers are the squad.
 */
const props = defineProps<{ event: TeamEvent; members: TeamMember[]; myMemberId: string | null }>()

const { t } = useI18n()
const squad = computed(() => matchSquad(props.members, props.event.attendances))
</script>

<template>
  <section class="match-squad" aria-labelledby="match-squad-title">
    <h2 id="match-squad-title">{{ t('events.squad.title') }} ({{ squad.length }})</h2>
    <p v-if="!squad.length" class="match-squad__empty">{{ t('events.squad.empty') }}</p>
    <ul v-else class="match-squad__list" role="list">
      <li
        v-for="m in squad"
        :key="m.id"
        class="match-squad__player"
        :class="{ 'match-squad__player--me': m.id === myMemberId }"
      >
        <UiAvatar :name="m.display_name" :number="m.shirt_number" :size="32" />
        <span class="match-squad__name">{{ m.display_name }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.match-squad {
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__empty {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    margin: 0;
  }

  &__player {
    display: flex;
    align-items: center;
    gap: $space-2;
    min-width: 0;
    min-height: 44px;
    padding: 4px $space-2;
    border-radius: $radius-sm;
    background: var(--color-surface);
    font-weight: 700;

    &--me {
      box-shadow: inset 0 0 0 2px var(--color-primary);
    }
  }

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

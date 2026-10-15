<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiIcon from '@/ui/UiIcon.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useMyClubs } from '@/features/teams/composables/useTeams'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const router = useRouter()
const { myTeams, activeTeam, setActiveTeam } = useActiveTeam()
const myClubs = useMyClubs()
const adminClubs = computed(() => (myClubs.data.value ?? []).filter((c) => c.role === 'admin'))

function pick(teamId: string) {
  setActiveTeam(teamId)
  open.value = false
}

function go(to: Parameters<typeof router.push>[0]) {
  open.value = false
  void router.push(to)
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('ui.teamSwitcher.title')">
    <ul class="switcher" role="list">
      <li v-for="team in myTeams.data.value ?? []" :key="team.team_id">
        <button
          type="button"
          class="switcher__item"
          :aria-current="team.team_id === activeTeam?.team_id ? 'true' : undefined"
          @click="pick(team.team_id)"
        >
          <span class="switcher__text">
            <span class="switcher__name">{{ team.team_name }}</span>
            <span class="switcher__club">{{ team.club_name }}</span>
          </span>
          <UiIcon
            v-if="team.team_id === activeTeam?.team_id"
            name="check"
            :size="22"
            :stroke-width="2.6"
          />
        </button>
      </li>
    </ul>
    <ul class="switcher switcher--links" role="list">
      <li v-for="club in adminClubs" :key="club.club_id">
        <button
          type="button"
          class="switcher__link"
          @click="go({ name: 'club', params: { clubId: club.club_id } })"
        >
          <UiIcon name="building" :size="22" />
          {{ t('ui.teamSwitcher.manageClub', { name: club.club_name }) }}
        </button>
      </li>
      <li>
        <button type="button" class="switcher__link" @click="go({ name: 'teams' })">
          <UiIcon name="swap" :size="22" />
          {{ t('ui.teamSwitcher.all') }}
        </button>
      </li>
    </ul>
  </BottomSheet>
</template>

<style scoped lang="scss">
.switcher {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;

  &--links {
    margin-top: $space-4;
  }

  &__item,
  &__link {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    width: 100%;
    min-height: 60px;
    padding: $space-2 $space-4;
    border: 2px solid transparent;
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: var(--color-text);
    text-align: left;
  }

  &__item[aria-current='true'] {
    border-color: var(--color-primary);
  }

  &__link {
    min-height: 52px;
    font-weight: 700;
  }

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  &__name {
    font-family: var(--font-display);
    font-size: $font-xl;
    font-weight: 800;
    line-height: 1.1;
  }

  &__club {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }
}
</style>

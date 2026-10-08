<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { refDebounced } from '@vueuse/core'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseChipGroup from '@/components/BaseChipGroup.vue'
import BaseInput from '@/components/BaseInput.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import {
  DRILL_CATEGORIES,
  filterDrills,
  playersLabel,
  type DrillCategory,
  type DrillScope,
} from '../logic'
import { useDrills } from '../composables/useDrills'

const { t } = useI18n()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const drills = useDrills(teamId)

const filter = reactive<{ query: string; category: DrillCategory | 'all'; scope: DrillScope }>({
  query: '',
  category: 'all',
  scope: 'all',
})
const query = computed({
  get: () => filter.query,
  set: (value: string) => (filter.query = value),
})
const debouncedQuery = refDebounced(query, 150)

const visible = computed(() =>
  filterDrills(drills.data.value ?? [], { ...filter, query: debouncedQuery.value }),
)

const categoryOptions = computed(() => [
  { value: 'all' as const, label: t('drills.allCategories') },
  ...DRILL_CATEGORIES.map((c) => ({ value: c, label: t(`drills.categories.${c}`) })),
])
const scopeOptions = computed(() => [
  { value: 'all' as const, label: t('drills.scope.all') },
  { value: 'team' as const, label: t('drills.scope.team') },
  { value: 'library' as const, label: t('drills.scope.library') },
])

const category = computed({
  get: () => filter.category,
  set: (v: DrillCategory | 'all' | (DrillCategory | 'all')[] | undefined) => {
    if (typeof v === 'string') filter.category = v
  },
})
const scope = computed({
  get: () => filter.scope,
  set: (v: DrillScope | DrillScope[] | undefined) => {
    if (typeof v === 'string') filter.scope = v
  },
})
</script>

<template>
  <section class="drills">
    <header class="drills__header">
      <h1>{{ t('drills.title') }}</h1>
      <RouterLink v-if="isCoach" v-slot="{ navigate }" custom :to="{ name: 'drill-new' }">
        <BaseButton @click="navigate">
          <template #icon><AppIcon name="plus" :size="18" /></template>
          {{ t('drills.new') }}
        </BaseButton>
      </RouterLink>
    </header>

    <BaseInput
      v-model="query"
      :label="t('drills.search')"
      type="search"
      :placeholder="t('drills.searchPlaceholder')"
      hide-label
    />
    <BaseChipGroup
      v-model="scope"
      :label="t('drills.scope.label')"
      :options="scopeOptions"
      hide-label
    />
    <BaseChipGroup
      v-model="category"
      :label="t('drills.category')"
      :options="categoryOptions"
      hide-label
    />

    <p v-if="drills.isPending.value" class="drills__muted">{{ t('common.loading') }}</p>
    <p v-else-if="drills.isError.value" class="drills__error" role="alert">
      {{ t('drills.loadFailed') }}
    </p>

    <template v-else>
      <p class="drills__muted" role="status">{{ t('drills.count', visible.length) }}</p>
      <ul v-if="visible.length" class="drills__list" role="list">
        <li v-for="drill in visible" :key="drill.id">
          <RouterLink :to="{ name: 'drill', params: { drillId: drill.id } }" class="drills__item">
            <span class="drills__main">
              <span class="drills__name">{{ drill.title }}</span>
              <span class="drills__meta">
                <span>{{ t(`drills.categories.${drill.category}`) }}</span>
                <span v-if="drill.duration_min"
                  >· {{ t('drills.minutes', { n: drill.duration_min }) }}</span
                >
                <span v-if="playersLabel(drill)"
                  >· {{ t('drills.players', { n: playersLabel(drill) }) }}</span
                >
                <span v-if="drill.video_url">· ▶ {{ t('drills.hasVideo') }}</span>
              </span>
            </span>
            <BaseBadge :tone="drill.team_id ? 'training' : 'neutral'">
              {{ drill.team_id ? t('drills.scope.teamShort') : t('drills.scope.libraryShort') }}
            </BaseBadge>
            <AppIcon name="chevronRight" :size="18" class="drills__chevron" />
          </RouterLink>
        </li>
      </ul>
      <EmptyState v-else icon="whistle" :title="t('drills.empty')" :text="t('drills.emptyHint')" />
    </template>
  </section>
</template>

<style scoped lang="scss">
.drills {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
  }

  &__list {
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;

    > li + li {
      border-top: 1px solid var(--color-border);
    }
  }

  &__item {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: 64px;
    padding: $space-2 $space-3 $space-2 $space-4;
    color: inherit;
    text-decoration: none;

    &:hover {
      background: var(--color-surface-muted);
    }
  }

  &__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--color-text-muted);
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

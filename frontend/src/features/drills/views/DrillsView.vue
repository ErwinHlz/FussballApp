<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { refDebounced } from '@vueuse/core'
import UiChip from '@/ui/UiChip.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import TrainingNav from '@/features/training-plan/components/TrainingNav.vue'
import DrillThumb from '../components/DrillThumb.vue'
import {
  DRILL_CATEGORIES,
  filterDrills,
  playersLabel,
  type DrillCategory,
  type DrillScope,
} from '../logic'
import { useDrills } from '../composables/useDrills'

/** Drill library as tiles with a preview; search and category chips stay on top. */
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

const scopes: DrillScope[] = ['all', 'team', 'library']
</script>

<template>
  <section class="drills">
    <TrainingNav active="drills" />

    <header class="drills__head">
      <h1>{{ t('drills.title') }}</h1>
      <UiIconButton
        v-if="isCoach"
        icon="plus"
        variant="primary"
        :label="t('drills.new')"
        :to="{ name: 'drill-new' }"
      />
    </header>

    <div class="drills__filters">
      <label class="drills__search">
        <span class="visually-hidden">{{ t('drills.search') }}</span>
        <UiIcon name="search" :size="20" />
        <input v-model="query" type="search" :placeholder="t('drills.searchPlaceholder')" />
      </label>
      <div class="drills__chips" role="group" :aria-label="t('drills.category')">
        <UiChip
          :model-value="filter.category === 'all'"
          @update:model-value="filter.category = 'all'"
        >
          {{ t('drills.allCategories') }}
        </UiChip>
        <UiChip
          v-for="category in DRILL_CATEGORIES"
          :key="category"
          :model-value="filter.category === category"
          @update:model-value="filter.category = filter.category === category ? 'all' : category"
        >
          {{ t(`drills.categories.${category}`) }}
        </UiChip>
      </div>
      <div class="drills__chips" role="group" :aria-label="t('drills.scope.label')">
        <UiChip
          v-for="scope in scopes"
          :key="scope"
          :model-value="filter.scope === scope"
          @update:model-value="filter.scope = scope"
        >
          {{ t(`drills.scope.${scope}`) }}
        </UiChip>
      </div>
    </div>

    <div v-if="drills.isPending.value" class="drills__grid" aria-busy="true">
      <UiSkeleton v-for="n in 4" :key="n" shape="block" height="180px" />
    </div>
    <p v-else-if="drills.isError.value" class="drills__error" role="alert">
      {{ t('drills.loadFailed') }}
    </p>

    <template v-else>
      <p class="drills__count" role="status">{{ t('drills.count', visible.length) }}</p>
      <ul v-if="visible.length" class="drills__grid" role="list">
        <li v-for="drill in visible" :key="drill.id">
          <RouterLink :to="{ name: 'drill', params: { drillId: drill.id } }" class="drill-tile">
            <DrillThumb :drill="drill" />
            <span class="drill-tile__title">{{ drill.title }}</span>
            <span class="drill-tile__meta">
              {{ t(`drills.categories.${drill.category}`) }}
              <template v-if="drill.duration_min">
                · {{ t('drills.minutes', { n: drill.duration_min }) }}</template
              >
              <template v-if="playersLabel(drill)">
                · {{ t('drills.players', { n: playersLabel(drill) }) }}</template
              >
            </span>
            <span class="drill-tile__tags">
              <span v-if="drill.team_id" class="drill-tile__tag">{{
                t('drills.scope.teamShort')
              }}</span>
              <span v-if="drill.animation" class="drill-tile__tag">{{ t('board.animation') }}</span>
              <span v-if="drill.video_url || drill.video_path" class="drill-tile__tag">{{
                t('drills.hasVideo')
              }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
      <UiEmptyState v-else icon="cone" :title="t('drills.empty')" :text="t('drills.emptyHint')" />
    </template>
  </section>
</template>

<style scoped lang="scss">
.drills {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
  }

  // Search and chips stay in reach while browsing the tiles.
  &__filters {
    position: sticky;
    top: calc(var(--top-bar-height, 64px) + var(--area-nav-height, 0px));
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin-inline: -$space-4;
    padding: $space-2 $space-4;
    background: var(--color-bg);
  }

  &__search {
    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: 48px;
    padding: 0 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-full;
    background: var(--color-surface);
    color: var(--color-text-muted);

    &:focus-within {
      @include focus-ring;
    }

    input {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      color: var(--color-text);
      font-size: $font-md;
      outline: none;
    }
  }

  &__chips {
    display: flex;
    gap: $space-2;
    margin-inline: -$space-4;
    padding-inline: $space-4;
    overflow-x: auto;
    scrollbar-width: none;

    > * {
      flex-shrink: 0;
    }
  }

  &__count {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space-3;
    margin: 0;

    @include from($bp-md) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  &__error {
    color: var(--color-danger);
  }
}

.drill-tile {
  @include focus-visible;

  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  padding: $space-2 $space-2 $space-3;
  border-radius: $radius-xl;
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;

  &__title {
    margin-top: $space-1;
    font-weight: 800;
    line-height: 1.2;
  }

  &__meta {
    color: var(--color-text-muted);
    font-size: $font-xs;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: auto;
    padding-top: 2px;
  }

  &__tag {
    padding: 1px $space-2;
    border-radius: $radius-full;
    background: var(--color-surface-muted);
    font-size: 11px;
    font-weight: 700;
  }
}
</style>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { refDebounced, useLocalStorage } from '@vueuse/core'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiButton from '@/ui/UiButton.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiSegmented from '@/ui/UiSegmented.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import UiSwitch from '@/ui/UiSwitch.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import TrainingNav from '@/features/training-plan/components/TrainingNav.vue'
import DrillThumb from '../components/DrillThumb.vue'
import {
  activeDrillFilters,
  DEFAULT_DRILL_FILTER,
  DRILL_CATEGORIES,
  filterDrills,
  playersLabel,
  type DrillCategory,
  type DrillFilter,
  type DrillScope,
} from '../logic'
import { useDrills } from '../composables/useDrills'

/**
 * Drill library as tiles with a preview. On top (sticky): search with the filter button, the
 * categories as tabs; origin and "with animation or video" sit in the filter sheet and show up
 * as removable pills. Category and filters are remembered per device.
 */
const { t } = useI18n()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const drills = useDrills(teamId)

const saved = useLocalStorage<Omit<DrillFilter, 'query'>>(
  'rondo.drillFilter',
  { ...DEFAULT_DRILL_FILTER },
  { mergeDefaults: true },
)
const query = ref('')
const debouncedQuery = refDebounced(query, 150)
const filterCount = computed(() => activeDrillFilters(saved.value))

const visible = computed(() =>
  filterDrills(drills.data.value ?? [], { ...saved.value, query: debouncedQuery.value }),
)

function setCategory(category: DrillCategory | 'all') {
  saved.value = { ...saved.value, category }
}
const scope = computed({
  get: () => saved.value.scope,
  set: (value: DrillScope) => (saved.value = { ...saved.value, scope: value }),
})
const media = computed({
  get: () => !!saved.value.media,
  set: (value: boolean) => (saved.value = { ...saved.value, media: value }),
})
function resetFilters() {
  saved.value = { ...saved.value, scope: 'all', media: false }
}
function resetAll() {
  saved.value = { ...DEFAULT_DRILL_FILTER }
  query.value = ''
}

const scopeOptions = computed(() =>
  (['all', 'team', 'library'] as DrillScope[]).map((value) => ({
    value,
    label: t(`drills.scope.${value}`),
  })),
)
const categories = computed(() => [
  { value: 'all' as const, label: t('drills.allCategories') },
  ...DRILL_CATEGORIES.map((value) => ({ value, label: t(`drills.categories.${value}`) })),
])

/** Active sheet filters as pills; tapping one removes it. */
const pills = computed(() => [
  ...(saved.value.scope !== 'all'
    ? [
        {
          key: 'scope',
          label: t(`drills.scope.${saved.value.scope}`),
          clear: () => (scope.value = 'all'),
        },
      ]
    : []),
  ...(saved.value.media
    ? [{ key: 'media', label: t('drills.filter.mediaShort'), clear: () => (media.value = false) }]
    : []),
])

// Keep the chosen category in view in the tab row (only the row scrolls, not the page).
const tabsEl = ref<HTMLElement | null>(null)
watch(
  () => saved.value.category,
  async () => {
    await nextTick()
    const strip = tabsEl.value
    const tab = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (strip && tab) strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2
  },
  { immediate: true },
)

const filterOpen = ref(false)
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
      <div class="drills__search-row">
        <label class="drills__search">
          <span class="visually-hidden">{{ t('drills.search') }}</span>
          <UiIcon name="search" :size="20" />
          <input v-model="query" type="search" :placeholder="t('drills.searchPlaceholder')" />
        </label>
        <UiIconButton
          icon="filter"
          :label="
            filterCount
              ? t('drills.filter.labelActive', { n: filterCount })
              : t('drills.filter.label')
          "
          :class="{ 'drills__filter--on': filterCount > 0 }"
          aria-haspopup="dialog"
          @click="filterOpen = true"
        >
          <UiIcon name="filter" :size="22" />
          <span v-if="filterCount" class="drills__badge" aria-hidden="true">{{ filterCount }}</span>
        </UiIconButton>
      </div>
      <div ref="tabsEl" class="drills__tabs" role="group" :aria-label="t('drills.category')">
        <button
          v-for="category in categories"
          :key="category.value"
          type="button"
          class="drills__tab"
          :aria-pressed="saved.category === category.value"
          @click="setCategory(category.value)"
        >
          {{ category.label }}
        </button>
      </div>
    </div>

    <div v-if="pills.length" class="drills__pills">
      <button
        v-for="pill in pills"
        :key="pill.key"
        type="button"
        class="drills__pill"
        :aria-label="t('drills.filter.remove', { name: pill.label })"
        @click="pill.clear"
      >
        {{ pill.label }}
        <UiIcon name="x" :size="16" />
      </button>
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
      <UiEmptyState v-else icon="cone" :title="t('drills.empty')" :text="t('drills.emptyHint')">
        <UiButton variant="secondary" @click="resetAll">{{ t('drills.filter.resetAll') }}</UiButton>
      </UiEmptyState>
    </template>

    <BottomSheet v-model:open="filterOpen" :title="t('drills.filter.label')">
      <div class="drills__sheet">
        <UiSegmented
          v-model="scope"
          as="radio"
          :label="t('drills.scope.label')"
          :options="scopeOptions"
        />
        <UiSwitch v-model="media" :label="t('drills.filter.media')" />
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="!filterCount" @click="resetFilters">
          {{ t('drills.filter.reset') }}
        </UiButton>
        <UiButton @click="filterOpen = false">
          {{ t('drills.filter.show', { n: visible.length }) }}
        </UiButton>
      </template>
    </BottomSheet>
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
    gap: $space-1;
    margin-inline: -$space-4;
    padding: $space-2 $space-4 0;
    background: var(--color-bg);
  }

  &__search-row {
    display: flex;
    align-items: center;
    gap: $space-2;
  }

  &__filter--on {
    position: relative;
    outline: 2px solid var(--color-primary);
  }

  &__badge {
    position: absolute;
    top: -2px;
    right: -2px;
    display: grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    border-radius: $radius-full;
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-size: $font-xs;
    font-weight: 800;
  }

  &__search {
    flex: 1;
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

  // Categories as tabs with an underline, like the area navigation.
  &__tabs {
    display: flex;
    gap: $space-1;
    margin-inline: -$space-4;
    padding-inline: $space-2;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  &__tab {
    position: relative;
    flex-shrink: 0;
    min-height: $touch-target;
    padding: 0 $space-3;
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    font-weight: 700;
    white-space: nowrap;

    &::after {
      content: '';
      position: absolute;
      inset-inline: $space-2;
      bottom: 0;
      height: 3px;
      border-radius: 3px 3px 0 0;
      background: var(--color-primary);
      transform: scaleX(0);
      transition: transform var(--duration-medium) var(--ease-out);
    }

    &:focus-visible {
      outline: 3px solid var(--color-focus);
      outline-offset: -3px;
      border-radius: $radius-md;
    }

    &[aria-pressed='true'] {
      color: var(--color-text);
      font-weight: 800;

      &::after {
        transform: scaleX(1);
      }
    }
  }

  &__pills {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }

  &__pill {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    gap: $space-1;
    min-height: 36px;
    padding: 0 $space-2 0 $space-3;
    border: 0;
    border-radius: $radius-full;
    background: var(--color-text);
    color: var(--color-bg);
    font-size: $font-sm;
    font-weight: 800;
  }

  &__sheet {
    display: flex;
    flex-direction: column;
    gap: $space-4;
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

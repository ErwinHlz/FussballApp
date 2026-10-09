<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventGroups } from '@/features/groups/composables/useGroups'
import { itemMinutes, planTotalMinutes } from '@/features/training-plan/logic'
import { usePlan } from '@/features/training-plan/composables/usePlan'
import BibBadge from './BibBadge.vue'
import { myGroupsByDrill } from '../logic'

/** The published training flow from the player's point of view: drills in order, own group per drill. */
const props = defineProps<{ eventId: string; memberId: string | null }>()

const { t } = useI18n()
const plan = usePlan(() => props.eventId)
const groups = useEventGroups(() => props.eventId)

const items = computed(() => plan.data.value ?? [])
const myGroups = computed(() => myGroupsByDrill(groups.data.value ?? [], props.memberId))
const total = computed(() => planTotalMinutes(items.value))
// Same group in every drill? Then show it once prominently.
const sameGroupEverywhere = computed(() => {
  const list = items.value.map((i) => myGroups.value.get(i.id))
  const first = list[0]
  return first && list.every((g) => g && g.color === first.color && g.name === first.name)
    ? first
    : null
})
</script>

<template>
  <div class="flow">
    <p v-if="plan.isPending.value" class="flow__muted">{{ t('common.loading') }}</p>

    <template v-else-if="items.length">
      <p v-if="sameGroupEverywhere" class="flow__same">
        {{ t('player.yourGroupAll') }}
        <BibBadge :color="sameGroupEverywhere.color" :name="sameGroupEverywhere.name" size="lg" />
      </p>

      <ol class="flow__list">
        <li
          v-for="(item, index) in items"
          :key="item.id"
          class="flow__item"
          :style="
            myGroups.get(item.id)
              ? { '--bib': `var(--bib-${myGroups.get(item.id)!.color})` }
              : undefined
          "
          :class="{ 'flow__item--grouped': myGroups.get(item.id) }"
        >
          <span class="flow__index">{{ index + 1 }}</span>
          <RouterLink
            :to="{
              name: 'drill',
              params: { drillId: item.drill.id },
              query: { event: eventId, ed: item.id },
            }"
            class="flow__main"
          >
            <span class="flow__title">{{ item.drill.title }}</span>
            <span class="flow__muted">{{ t('plan.minutesShort', { n: itemMinutes(item) }) }}</span>
          </RouterLink>
          <BibBadge
            v-if="myGroups.get(item.id) && !sameGroupEverywhere"
            :color="myGroups.get(item.id)!.color"
            :name="myGroups.get(item.id)!.name"
          />
        </li>
      </ol>
      <p class="flow__muted">{{ t('plan.total', { n: total }) }}</p>
    </template>

    <p v-else class="flow__muted">{{ t('player.planNotYet') }}</p>
  </div>
</template>

<style scoped lang="scss">
.flow {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__same {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    font-weight: 700;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding: 0;
    list-style: none;
  }

  &__item {
    --bib: var(--color-border);

    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: 56px;
    padding: $space-2;
    border: 1px solid var(--color-border);
    border-left: 6px solid var(--bib);
    border-radius: $radius-md;
    background: var(--color-surface);
  }

  &__index {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: $radius-full;
    background: var(--color-training);
    color: #fff;
    font-size: $font-sm;
    font-weight: 800;
  }

  &__main {
    @include focus-visible;

    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }

  &__title {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }
}
</style>

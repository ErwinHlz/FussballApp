<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BibChip from '@/ui/BibChip.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useEventGroups } from '@/features/groups/composables/useGroups'
import { itemMinutes, planTotalMinutes } from '@/features/training-plan/logic'
import { usePlan } from '@/features/training-plan/composables/usePlan'
import { myGroupsByDrill } from '../logic'

/**
 * The published training from the player's point of view: drills in order on a dashed time
 * line, the own bib per drill. Each drill opens its detail (animation, video).
 */
const props = defineProps<{ eventId: string; memberId: string | null }>()

const { t } = useI18n()
const plan = usePlan(() => props.eventId)
const groups = useEventGroups(() => props.eventId)

const items = computed(() => plan.data.value ?? [])
const myGroups = computed(() => myGroupsByDrill(groups.data.value ?? [], props.memberId))
const total = computed(() => planTotalMinutes(items.value))
</script>

<template>
  <section class="flow" aria-labelledby="flow-title">
    <h2 id="flow-title" class="flow__title">
      {{ t('plan.title') }}
      <span v-if="items.length" class="flow__total">{{
        t('plan.minutesShort', { n: total })
      }}</span>
    </h2>

    <div v-if="plan.isPending.value" aria-busy="true"><UiSkeleton :lines="3" /></div>
    <ol v-else-if="items.length" class="flow__list">
      <li v-for="(item, index) in items" :key="item.id" class="flow__item">
        <span class="flow__step" aria-hidden="true">
          <span class="flow__number">{{ index + 1 }}</span>
          <span v-if="index < items.length - 1" class="flow__line" />
        </span>
        <RouterLink
          class="flow__card"
          :to="{
            name: 'drill',
            params: { drillId: item.drill.id },
            query: { event: eventId, ed: item.id },
          }"
        >
          <span class="flow__text">
            <span class="flow__drill">{{ item.drill.title }}</span>
            <span class="flow__minutes">{{
              t('plan.minutesShort', { n: itemMinutes(item) })
            }}</span>
          </span>
          <BibChip
            v-if="myGroups.get(item.id)"
            :color="myGroups.get(item.id)!.color"
            :label="myGroups.get(item.id)!.name"
          />
          <UiIcon name="chevronRight" :size="20" class="flow__chevron" />
        </RouterLink>
      </li>
    </ol>
    <p v-else class="flow__muted">{{ t('plan.empty') }}</p>
  </section>
</template>

<style scoped lang="scss">
.flow {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  &__total {
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    gap: $space-3;
  }

  &__step {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 36px;
    flex-shrink: 0;
  }

  &__number {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    margin-top: $space-3;
    border-radius: 50%;
    background: var(--color-training);
    color: #ffffff;
    font-family: var(--font-display);
    font-size: $font-lg;
    font-weight: 800;
  }

  &__line {
    flex: 1;
    min-height: 16px;
    border-left: 2px dashed var(--color-chalk);
  }

  &__card {
    @include focus-visible;

    display: flex;
    flex: 1;
    align-items: center;
    gap: $space-2;
    min-width: 0;
    min-height: 64px;
    margin-bottom: $space-2;
    padding: $space-3;
    border-radius: $radius-lg;
    background: var(--color-surface);
    color: inherit;
    text-decoration: none;
  }

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__drill {
    font-weight: 800;
  }

  &__minutes,
  &__muted {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__chevron {
    color: var(--color-text-muted);
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BibChip from '@/ui/BibChip.vue'
import { useEventGroups } from '@/features/groups/composables/useGroups'
import { usePlan } from '@/features/training-plan/composables/usePlan'
import { myGroupsByDrill } from '../logic'

/** The player's bibs for a published training: once if always the same, else per drill. */
const props = defineProps<{ eventId: string; memberId: string | null }>()

const { t } = useI18n()
const plan = usePlan(() => props.eventId)
const groups = useEventGroups(() => props.eventId)

const bibs = computed(() => {
  const mine = myGroupsByDrill(groups.data.value ?? [], props.memberId)
  return (plan.data.value ?? [])
    .map((item) => ({ id: item.id, drill: item.drill.title, group: mine.get(item.id) }))
    .filter((b) => b.group)
})
const same = computed(() => {
  const first = bibs.value[0]?.group
  const all = plan.data.value?.length ?? 0
  return first &&
    bibs.value.length === all &&
    bibs.value.every((b) => b.group!.color === first.color && b.group!.name === first.name)
    ? first
    : null
})
</script>

<template>
  <div v-if="bibs.length" class="my-bibs">
    <p class="my-bibs__label">{{ t('player.yourBibs') }}</p>
    <div class="my-bibs__list">
      <BibChip v-if="same" :color="same.color" :label="same.name" :detail="t('player.allDrills')" />
      <template v-else>
        <BibChip
          v-for="bib in bibs"
          :key="bib.id"
          :color="bib.group!.color"
          :label="bib.group!.name"
          :detail="bib.drill"
        />
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.my-bibs {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: $space-2;

  &__label {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
  }
}
</style>

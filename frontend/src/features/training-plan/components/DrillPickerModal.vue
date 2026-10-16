<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UiBadge from '@/ui/UiBadge.vue'
import UiInput from '@/ui/UiInput.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import { filterDrills, type Drill } from '@/features/drills/logic'
import { useDrills } from '@/features/drills/composables/useDrills'

const props = defineProps<{ teamId: string; usedDrillIds: string[] }>()
const emit = defineEmits<{ pick: [drill: Drill] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const drills = useDrills(() => props.teamId)
const query = ref('')

const visible = computed(() =>
  filterDrills(drills.data.value ?? [], { query: query.value, category: 'all', scope: 'all' }),
)
const used = computed(() => new Set(props.usedDrillIds))

function pick(drill: Drill) {
  emit('pick', drill)
  open.value = false
  query.value = ''
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="t('plan.addDrill')">
    <div class="picker">
      <UiInput
        v-model="query"
        :label="t('drills.search')"
        type="search"
        :placeholder="t('drills.searchPlaceholder')"
        hide-label
      />
      <p v-if="drills.isPending.value" class="picker__muted">{{ t('common.loading') }}</p>
      <ul v-else class="picker__list" role="list">
        <li v-for="drill in visible" :key="drill.id">
          <button type="button" class="picker__item" @click="pick(drill)">
            <span class="picker__main">
              <span class="picker__title">{{ drill.title }}</span>
              <span class="picker__muted">
                {{ t(`drills.categories.${drill.category}`) }}
                <template v-if="drill.duration_min">
                  · {{ t('drills.minutes', { n: drill.duration_min }) }}
                </template>
              </span>
            </span>
            <UiBadge v-if="used.has(drill.id)" tone="neutral">{{
              t('plan.alreadyInPlan')
            }}</UiBadge>
            <UiBadge v-else-if="drill.team_id" tone="training">{{
              t('drills.scope.teamShort')
            }}</UiBadge>
          </button>
        </li>
      </ul>
      <p v-if="!drills.isPending.value && !visible.length" class="picker__muted">
        {{ t('drills.empty') }}
      </p>
    </div>
  </BottomSheet>
</template>

<style scoped lang="scss">
.picker {
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__list {
    display: flex;
    flex-direction: column;
  }

  &__item {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-2;
    width: 100%;
    min-height: 56px;
    padding: $space-2;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    text-align: left;

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

  &__title {
    font-weight: 700;
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }
}
</style>

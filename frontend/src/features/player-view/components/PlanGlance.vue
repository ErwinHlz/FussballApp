<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BibChip from '@/ui/BibChip.vue'
import UiBadge from '@/ui/UiBadge.vue'
import DrillThumb from '@/features/drills/components/DrillThumb.vue'
import type { SavedGroup } from '@/features/groups/api'
import { useEventGroups } from '@/features/groups/composables/useGroups'
import { itemMinutes, planTotalMinutes, type PlanItem } from '@/features/training-plan/logic'
import { usePlan } from '@/features/training-plan/composables/usePlan'
import { FEATURES } from '@/lib/features'
import { myGroupsByDrill, sameGroupsEverywhere } from '../logic'

/**
 * Training plan at a glance (start page): drills in order with preview, minutes and groups.
 * Players see only their own bib per drill (once if it is the same everywhere); coaches see
 * every group with its players. Renders nothing without a plan.
 */
const props = defineProps<{
  eventId: string
  /** Own squad entry, highlighted in the groups. */
  memberId: string | null
  /** Squad names by member id (for the coach's view of the groups). */
  names: Map<string, string>
  /** Coaches also see a draft (marked as such). */
  draft: boolean
  /** Coaches: all groups with names; players: only the own bib. */
  showAll: boolean
}>()

const { t } = useI18n()
const plan = usePlan(() => props.eventId)
const groups = useEventGroups(() => props.eventId)

const items = computed(() => plan.data.value ?? [])
const total = computed(() => planTotalMinutes(items.value))
const groupsByDrill = computed(
  () => new Map((groups.data.value ?? []).map((ed) => [ed.id, ed.groups])),
)

// Coaches: the same split for every drill is shown once.
const shared = computed(() =>
  props.showAll
    ? sameGroupsEverywhere(items.value.map((i) => groupsByDrill.value.get(i.id) ?? []))
    : null,
)

// Players: their bib per drill, or once when it never changes.
const myBibs = computed(() => myGroupsByDrill(groups.data.value ?? [], props.memberId))
const mySameBib = computed(() => {
  if (props.showAll || !items.value.length) return null
  const bibs = items.value.map((i) => myBibs.value.get(i.id))
  const first = bibs[0]
  return first && bibs.every((b) => b && b.color === first.color && b.name === first.name)
    ? first
    : null
})

function media(item: PlanItem) {
  if (FEATURES.videos && (item.drill.video_url || item.drill.video_path)) return t('player.video')
  return item.drill.animation ? t('player.animation') : null
}

function players(group: SavedGroup) {
  return group.member_ids
    .filter((id) => props.names.has(id))
    .map((id) => ({
      id,
      name:
        id === props.memberId
          ? `${props.names.get(id)} (${t('common.you')})`
          : props.names.get(id)!,
      me: id === props.memberId,
    }))
}
</script>

<template>
  <section v-if="items.length" class="glance" aria-labelledby="glance-title">
    <h3 id="glance-title" class="glance__title">
      {{ t('plan.title') }}
      <UiBadge v-if="draft" tone="maybe">{{ t('plan.draft') }}</UiBadge>
      <span class="glance__total">{{ t('plan.minutesShort', { n: total }) }}</span>
    </h3>

    <div v-if="mySameBib" class="glance__mine">
      <BibChip :color="mySameBib.color" :label="mySameBib.name" :detail="t('player.allDrills')" />
    </div>

    <ol class="glance__drills">
      <li v-for="(item, index) in items" :key="item.id" class="glance__drill">
        <RouterLink
          class="glance__link card-link-above"
          :to="{
            name: 'drill',
            params: { drillId: item.drill.id },
            query: { event: eventId, ed: item.id },
          }"
        >
          <DrillThumb
            :drill="{
              animation: item.drill.animation ?? null,
              video_url: item.drill.video_url ?? null,
              video_path: item.drill.video_path ?? null,
            }"
            size="small"
          />
          <span class="glance__text">
            <span class="glance__name">{{ index + 1 }} · {{ item.drill.title }}</span>
            <span class="glance__meta">
              {{ t('plan.minutesShort', { n: itemMinutes(item) }) }}
              <template v-if="media(item)"> · {{ media(item) }}</template>
            </span>
          </span>
          <BibChip
            v-if="!showAll && !mySameBib && myBibs.get(item.id)"
            :color="myBibs.get(item.id)!.color"
            :label="myBibs.get(item.id)!.name"
          />
        </RouterLink>
        <ul v-if="showAll && !shared && groupsByDrill.get(item.id)?.length" class="glance__groups">
          <li v-for="group in groupsByDrill.get(item.id)" :key="group.id" class="glance__group">
            <BibChip :color="group.color" :label="group.name" />
            <span class="glance__players">
              <template v-for="(p, i) in players(group)" :key="p.id"
                ><template v-if="i">, </template
                ><span :class="{ glance__me: p.me }">{{ p.name }}</span></template
              >
            </span>
          </li>
        </ul>
      </li>
    </ol>

    <div v-if="shared" class="glance__shared">
      <p class="glance__label">{{ t('player.groupsAllDrills') }}</p>
      <ul class="glance__groups">
        <li v-for="group in shared" :key="group.id" class="glance__group">
          <BibChip :color="group.color" :label="group.name" />
          <span class="glance__players">
            <template v-for="(p, i) in players(group)" :key="p.id"
              ><template v-if="i">, </template
              ><span :class="{ glance__me: p.me }">{{ p.name }}</span></template
            >
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.glance {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: $space-3;

  &__title {
    display: flex;
    align-items: center;
    gap: $space-2;
    font-family: var(--font-sans);
    font-size: $font-md;
    font-weight: 800;
  }

  &__total {
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__drills,
  &__groups {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__drill {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__link {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-3;
    min-height: $touch-target;
    border-radius: $radius-md;
    color: inherit;
    text-decoration: none;
  }

  &__text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  &__meta,
  &__label {
    color: var(--color-text-muted);
    font-size: $font-sm;
    font-weight: 700;
  }

  &__group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-1 $space-2;
  }

  &__drill &__groups {
    padding-left: $space-6;
  }

  &__players {
    flex: 1;
    min-width: 0;
    font-size: $font-sm;
    overflow-wrap: anywhere;
  }

  &__me {
    font-weight: 800;
  }
}
</style>

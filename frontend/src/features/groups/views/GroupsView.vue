<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { VueDraggable } from 'vue-draggable-plus'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useEventFormat } from '@/features/events/format'
import { useEvent, useMyMember } from '@/features/events/composables/useEvents'
import { useEventGroups, useSaveDrillGroups } from '../composables/useGroups'
import type { SavedGroup } from '../api'
import {
  assignedIds,
  availablePlayers,
  copyGroups,
  distributeByPosition,
  distributeRandom,
  groupWarnings,
  newGroupKey,
  nextColor,
  type DraftGroup,
} from '../logic'

const props = defineProps<{ eventId: string }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const fmt = useEventFormat()
const event = useEvent(() => props.eventId)
const teamId = computed(() => event.data.value?.team_id ?? null)
const { members } = useMyMember(teamId)
const { myTeams } = useActiveTeam()
const isCoach = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === teamId.value)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})
const eventGroups = useEventGroups(() => props.eventId, isCoach)
const save = useSaveDrillGroups(() => props.eventId)

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const attendances = computed(() => event.data.value?.attendances ?? [])
const memberById = computed(() => new Map((members.data.value ?? []).map((m) => [m.id, m])))
const available = computed(() => availablePlayers(members.data.value ?? [], attendances.value))
const availableIds = computed(() => available.value.map((p) => p.member.id))
const maybeIds = computed(
  () => new Set(available.value.filter((p) => p.maybe).map((p) => p.member.id)),
)
const drills = computed(() => eventGroups.data.value ?? [])

type DrillDraft = { groups: DraftGroup[]; pool: string[]; snapshot: string }
const drafts = reactive<Record<string, DrillDraft>>({})

const serialize = (groups: DraftGroup[]) =>
  JSON.stringify(groups.map((g) => [g.name.trim(), g.color, [...g.memberIds].sort()]))

function fromSaved(saved: SavedGroup[]): DraftGroup[] {
  return saved.map((g) => ({
    key: newGroupKey(),
    name: g.name,
    color: g.color,
    memberIds: [...g.member_ids],
  }))
}

function refreshPool(draft: DrillDraft) {
  const assigned = assignedIds(draft.groups)
  draft.pool = availableIds.value.filter((id) => !assigned.has(id))
}

const isDirty = (id: string) => !!drafts[id] && serialize(drafts[id].groups) !== drafts[id].snapshot

// Load server state into drafts, but never overwrite unsaved local changes.
watch(
  drills,
  (list) => {
    for (const ed of list) {
      if (drafts[ed.id] && isDirty(ed.id)) continue
      const groups = fromSaved(ed.groups)
      drafts[ed.id] = { groups, pool: [], snapshot: serialize(groups) }
      refreshPool(drafts[ed.id]!)
    }
  },
  { immediate: true },
)
// New yes/maybe answers appear in the pool, declined players leave it.
watch(availableIds, () => Object.values(drafts).forEach(refreshPool))

const currentId = computed(() => {
  const wanted = route.query.drill
  return drills.value.find((d) => d.id === wanted)?.id ?? drills.value[0]?.id ?? null
})
const currentIndex = computed(() => drills.value.findIndex((d) => d.id === currentId.value))
const current = computed(() => (currentId.value ? drafts[currentId.value] : undefined))
const previous = computed(() => {
  const prev = drills.value[currentIndex.value - 1]
  return prev ? drafts[prev.id] : undefined
})
// Drills without groups (e.g. warm-up together) need no "not in a group" warning.
const warnings = computed(() => {
  if (!current.value) return null
  const w = groupWarnings(current.value.groups, attendances.value)
  return current.value.groups.length ? w : { ...w, unassigned: [] }
})
const anyDirty = computed(() => drills.value.some((d) => isDirty(d.id)))

function selectDrill(id: string) {
  selected.value = null
  void router.replace({ query: { drill: id } })
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

const selected = ref<string | null>(null)
const announcement = ref('')

function ensureGroups(draft: DrillDraft) {
  while (draft.groups.length < 2) addGroup(draft)
}

function addGroup(draft: DrillDraft) {
  const color = nextColor(draft.groups)
  draft.groups.push({ key: newGroupKey(), name: t(`groups.colors.${color}`), color, memberIds: [] })
}

function removeGroup(draft: DrillDraft, key: string) {
  draft.groups = draft.groups.filter((g) => g.key !== key)
  refreshPool(draft)
}

function shuffleRandom(draft: DrillDraft) {
  ensureGroups(draft)
  draft.groups = distributeRandom(availableIds.value, draft.groups)
  refreshPool(draft)
  announcement.value = t('groups.didRandom')
}

function balancePositions(draft: DrillDraft) {
  ensureGroups(draft)
  draft.groups = distributeByPosition(
    available.value.map((p) => p.member),
    draft.groups,
  )
  refreshPool(draft)
  announcement.value = t('groups.didPositions')
}

function sameAsPrevious(draft: DrillDraft) {
  if (!previous.value) return
  draft.groups = copyGroups(previous.value.groups, availableIds.value)
  refreshPool(draft)
  announcement.value = t('groups.didCopy')
}

function clearAll(draft: DrillDraft) {
  draft.groups.forEach((g) => (g.memberIds = []))
  refreshPool(draft)
}

function toggleSelect(id: string) {
  selected.value = selected.value === id ? null : id
}

/** Tap-to-move alternative to dragging. target = group key or 'pool'. */
function moveSelected(draft: DrillDraft, target: string) {
  const id = selected.value
  if (!id) return
  draft.pool = draft.pool.filter((x) => x !== id)
  draft.groups.forEach((g) => (g.memberIds = g.memberIds.filter((x) => x !== id)))
  const group = draft.groups.find((g) => g.key === target)
  if (group) group.memberIds.push(id)
  else draft.pool.push(id)
  announcement.value = t('groups.moved', {
    name: memberById.value.get(id)?.display_name ?? '',
    group: group?.name ?? t('groups.pool'),
  })
  selected.value = null
}

function containsSelected(ids: string[]) {
  return !!selected.value && ids.includes(selected.value)
}

async function saveCurrent() {
  if (!currentId.value || !current.value) return
  const groups = current.value.groups.map((g) => ({
    ...g,
    name: g.name.trim() || t(`groups.colors.${g.color}`),
  }))
  await save.mutateAsync({ eventDrillId: currentId.value, groups })
  current.value.groups = groups
  current.value.snapshot = serialize(groups)
  announcement.value = t('groups.saved')
}

onBeforeRouteLeave((to) => {
  if (to.name === route.name) return true
  return !anyDirty.value || window.confirm(t('groups.unsavedConfirm'))
})

function names(ids: string[]) {
  return ids.map((id) => memberById.value.get(id)?.display_name ?? '?').join(', ')
}
</script>

<template>
  <section class="groups">
    <p v-if="event.isPending.value || (isCoach && eventGroups.isPending.value)">
      {{ t('common.loading') }}
    </p>
    <p v-else-if="event.isError.value || !event.data.value" class="groups__error" role="alert">
      {{ t('events.loadFailedOne') }}
    </p>
    <p v-else-if="!isCoach" role="alert">{{ t('plan.coachOnly') }}</p>

    <template v-else>
      <header>
        <RouterLink :to="{ name: 'event-plan', params: { eventId } }" class="groups__back">
          ‹ {{ t('groups.backToPlan') }}
        </RouterLink>
        <h1>{{ t('groups.title') }}</h1>
        <p class="groups__muted">
          {{ fmt.longDay(event.data.value.starts_at) }} ·
          {{ t('groups.availableCount', { n: available.length }) }}
        </p>
      </header>

      <p v-if="!drills.length" class="groups__muted">{{ t('groups.noDrills') }}</p>

      <template v-else-if="current && currentId">
        <!-- Drill tabs -->
        <nav class="groups__drills" :aria-label="t('groups.drillsLabel')">
          <button
            v-for="(ed, index) in drills"
            :key="ed.id"
            type="button"
            class="groups__drill"
            :class="{ 'groups__drill--active': ed.id === currentId }"
            :aria-current="ed.id === currentId ? 'step' : undefined"
            @click="selectDrill(ed.id)"
          >
            <span class="groups__drill-index">{{ index + 1 }}</span>
            <span class="groups__drill-title">{{ ed.drill.title }}</span>
            <span v-if="isDirty(ed.id)" class="groups__dirty">● {{ t('groups.unsaved') }}</span>
            <span v-else-if="drafts[ed.id]?.groups.length" class="groups__muted">
              {{ t('groups.groupCount', drafts[ed.id]!.groups.length) }}
            </span>
          </button>
        </nav>

        <!-- Tools -->
        <div class="groups__tools">
          <BaseButton variant="secondary" @click="shuffleRandom(current)"
            >🎲 {{ t('groups.random') }}</BaseButton
          >
          <BaseButton variant="secondary" @click="balancePositions(current)"
            >⚖ {{ t('groups.byPosition') }}</BaseButton
          >
          <BaseButton
            v-if="previous"
            variant="secondary"
            :disabled="!previous.groups.length"
            @click="sameAsPrevious(current)"
          >
            ⟲ {{ t('groups.samePrevious') }}
          </BaseButton>
          <BaseButton variant="ghost" @click="clearAll(current)">{{
            t('groups.clear')
          }}</BaseButton>
        </div>

        <!-- Warnings -->
        <div
          v-if="warnings?.unassigned.length || warnings?.declinedButAssigned.length"
          class="groups__warnings"
          role="status"
        >
          <p v-if="warnings.unassigned.length">
            <strong>{{ t('groups.warnUnassigned', warnings.unassigned.length) }}</strong>
            {{ names(warnings.unassigned) }}
          </p>
          <p v-if="warnings.declinedButAssigned.length">
            <strong>{{ t('groups.warnDeclined', warnings.declinedButAssigned.length) }}</strong>
            {{ names(warnings.declinedButAssigned) }}
          </p>
        </div>

        <!-- Pool -->
        <section class="groups__box groups__box--pool" :aria-label="t('groups.pool')">
          <header class="groups__box-header">
            <h2 class="groups__box-title">{{ t('groups.pool') }} ({{ current.pool.length }})</h2>
            <button
              v-if="selected && !containsSelected(current.pool)"
              type="button"
              class="groups__here"
              @click="moveSelected(current, 'pool')"
            >
              {{ t('groups.moveHere') }}
            </button>
          </header>
          <VueDraggable
            v-model="current.pool"
            group="players"
            :animation="150"
            class="groups__chips"
          >
            <button
              v-for="id in current.pool"
              :key="id"
              type="button"
              class="chip"
              :class="{ 'chip--selected': selected === id }"
              :aria-pressed="selected === id"
              @click="toggleSelect(id)"
            >
              <span v-if="memberById.get(id)?.shirt_number !== null" class="chip__number">{{
                memberById.get(id)?.shirt_number
              }}</span>
              {{ memberById.get(id)?.display_name }}
              <span v-if="maybeIds.has(id)" class="chip__maybe" :title="t('events.answer.maybe')"
                >?<span class="visually-hidden"> {{ t('events.answer.maybe') }}</span></span
              >
            </button>
          </VueDraggable>
          <p v-if="!current.pool.length" class="groups__muted">{{ t('groups.poolEmpty') }}</p>
        </section>

        <!-- Groups -->
        <div class="groups__grid">
          <section
            v-for="group in current.groups"
            :key="group.key"
            class="groups__box"
            :style="{ '--bib': `var(--bib-${group.color})` }"
            :aria-label="group.name"
          >
            <header class="groups__box-header">
              <span class="groups__bib" aria-hidden="true" />
              <label class="groups__name">
                <span class="visually-hidden">{{ t('groups.groupName') }}</span>
                <input v-model="group.name" maxlength="30" />
              </label>
              <span class="groups__count">{{ group.memberIds.length }}</span>
              <button
                type="button"
                class="groups__icon-button"
                :aria-label="t('groups.removeGroup', { name: group.name })"
                @click="removeGroup(current, group.key)"
              >
                <AppIcon name="x" :size="16" />
              </button>
            </header>
            <button
              v-if="selected && !containsSelected(group.memberIds)"
              type="button"
              class="groups__here"
              @click="moveSelected(current, group.key)"
            >
              {{ t('groups.moveHere') }}
            </button>
            <VueDraggable
              v-model="group.memberIds"
              group="players"
              :animation="150"
              class="groups__chips groups__chips--group"
            >
              <button
                v-for="id in group.memberIds"
                :key="id"
                type="button"
                class="chip"
                :class="{
                  'chip--selected': selected === id,
                  'chip--declined': warnings?.declinedButAssigned.includes(id),
                }"
                :aria-pressed="selected === id"
                @click="toggleSelect(id)"
              >
                <span v-if="memberById.get(id)?.shirt_number !== null" class="chip__number">{{
                  memberById.get(id)?.shirt_number
                }}</span>
                {{ memberById.get(id)?.display_name ?? '?' }}
                <span v-if="maybeIds.has(id)" class="chip__maybe" :title="t('events.answer.maybe')"
                  >?<span class="visually-hidden"> {{ t('events.answer.maybe') }}</span></span
                >
                <span v-if="warnings?.declinedButAssigned.includes(id)" class="chip__flag">{{
                  t('groups.declined')
                }}</span>
              </button>
            </VueDraggable>
          </section>

          <button
            v-if="current.groups.length < 6"
            type="button"
            class="groups__add"
            @click="addGroup(current)"
          >
            <AppIcon name="plus" :size="20" />
            {{ t('groups.addGroup') }}
          </button>
        </div>

        <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
        <p v-if="save.isError.value" class="groups__error" role="alert">
          {{ t('groups.saveFailed') }}
        </p>

        <div class="groups__savebar">
          <BaseButton
            size="lg"
            block
            :disabled="!isDirty(currentId)"
            :loading="save.isPending.value"
            @click="saveCurrent"
          >
            {{ isDirty(currentId) ? t('groups.save') : `✓ ${t('groups.savedState')}` }}
          </BaseButton>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped lang="scss">
.groups {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__back {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    font-weight: 600;
    text-decoration: none;
  }

  &__drills {
    display: flex;
    gap: $space-2;
    overflow-x: auto;
    padding-bottom: $space-1;
    scroll-snap-type: x proximity;
  }

  &__drill {
    @include focus-visible;

    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    align-items: flex-start;
    gap: 2px;
    max-width: 180px;
    min-height: $touch-target;
    padding: $space-2 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    text-align: left;
    scroll-snap-align: start;

    &--active {
      border-color: var(--color-training);
    }
  }

  &__drill-index {
    font-size: $font-xs;
    font-weight: 800;
    color: var(--color-training);
  }

  &__drill-title {
    @include truncate;

    max-width: 100%;
    font-weight: 700;
  }

  &__dirty {
    font-size: $font-xs;
    font-weight: 700;
    color: var(--color-warning);
  }

  &__tools {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-2;
  }

  &__warnings {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    padding: $space-3;
    border: 2px solid var(--color-warning);
    border-radius: $radius-lg;
    background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
    font-size: $font-sm;
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: $space-3;

    @include from($bp-sm) {
      grid-template-columns: 1fr 1fr;
    }
  }

  &__box {
    --bib: var(--color-border);

    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding: $space-3;
    border: 1px solid var(--color-border);
    border-top: 6px solid var(--bib);
    border-radius: $radius-lg;
    background: var(--color-surface);

    &--pool {
      border-top-color: var(--color-text-muted);
      border-style: dashed;
      background: var(--color-surface-muted);
    }
  }

  &__box-header {
    display: flex;
    align-items: center;
    gap: $space-2;
  }

  &__box-title {
    flex: 1;
    font-size: $font-md;
  }

  &__bib {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: 2px solid rgb(0 0 0 / 25%);
    border-radius: $radius-full;
    background: var(--bib);
  }

  &__name {
    flex: 1;
    min-width: 0;

    input {
      width: 100%;
      min-height: 36px;
      padding: $space-1 $space-2;
      border: 1px solid transparent;
      border-radius: $radius-sm;
      background: transparent;
      font-weight: 800;
      font-size: $font-md;

      &:hover,
      &:focus-visible {
        border-color: var(--color-border);
      }

      &:focus-visible {
        @include focus-ring;
      }
    }
  }

  &__count {
    font-weight: 800;
    color: var(--color-text-muted);
  }

  &__icon-button {
    @include touch-target;
    @include focus-visible;

    display: grid;
    place-items: center;
    border: 0;
    border-radius: $radius-md;
    background: transparent;
    color: var(--color-text-muted);
  }

  &__here {
    @include focus-visible;

    min-height: $touch-target;
    border: 2px dashed var(--color-primary);
    border-radius: $radius-md;
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
    color: var(--color-primary-hover);
    font-weight: 700;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $space-2;
    min-height: 48px;

    &--group {
      min-height: 64px;
    }
  }

  &__add {
    @include focus-visible;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    min-height: 96px;
    border: 2px dashed var(--color-border);
    border-radius: $radius-lg;
    background: transparent;
    color: var(--color-text-muted);
    font-weight: 700;
  }

  &__savebar {
    @include safe-area-padding(bottom, $space-2);

    position: sticky;
    bottom: calc(#{$bottom-nav-height} + env(safe-area-inset-bottom, 0px));
    padding-top: $space-2;
    background: linear-gradient(transparent, var(--color-bg) 30%);
  }

  &__muted {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}

.chip {
  @include focus-visible;

  display: inline-flex;
  align-items: center;
  gap: $space-1;
  min-height: $touch-target;
  padding: $space-1 $space-3 $space-1 $space-1;
  border: 2px solid var(--color-border);
  border-radius: $radius-full;
  background: var(--color-surface);
  font-weight: 600;
  cursor: grab;
  touch-action: none;

  &--selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 30%, transparent);
  }

  &--declined {
    border-style: dashed;
    border-color: var(--color-danger);
    text-decoration: line-through;
  }

  &__number {
    display: grid;
    place-items: center;
    min-width: 28px;
    height: 28px;
    border-radius: $radius-full;
    background: var(--color-surface-muted);
    font-size: $font-sm;
    font-weight: 800;
  }

  &__maybe {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: $radius-full;
    background: var(--color-maybe);
    color: #fff;
    font-size: $font-xs;
    font-weight: 800;
  }

  &__flag {
    font-size: $font-xs;
    font-weight: 700;
    color: var(--color-danger);
    text-decoration: none;
  }
}

.visually-hidden {
  @include visually-hidden;
}
</style>

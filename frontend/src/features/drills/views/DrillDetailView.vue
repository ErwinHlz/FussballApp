<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import YouTubeEmbed from '../components/YouTubeEmbed.vue'
import DrillVideo from '../components/DrillVideo.vue'
import DrillVideoUpload from '../components/DrillVideoUpload.vue'
import AnimationPlayer from '@/features/board/components/AnimationPlayer.vue'
import { parseAnimation } from '@/features/board/schema'
import BibChip from '@/ui/BibChip.vue'
import UiBadge from '@/ui/UiBadge.vue'
import { useEventGroups } from '@/features/groups/composables/useGroups'
import { useMyMember } from '@/features/events/composables/useEvents'
import { playersLabel } from '../logic'
import { useCopyDrill, useDeleteDrill, useDrill } from '../composables/useDrills'

const props = defineProps<{ drillId: string }>()

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { activeTeam, myTeams } = useActiveTeam()
const drill = useDrill(() => props.drillId)
const copyDrill = useCopyDrill()
const deleteDrill = useDeleteDrill()
const confirmDelete = ref(false)

const d = computed(() => drill.data.value)
const animation = computed(() => parseAnimation(d.value?.animation))

// Opened from a training (?event=…&ed=…): show the player's group for this drill.
const fromEventId = computed(() => (typeof route.query.event === 'string' ? route.query.event : ''))
const fromEventDrillId = computed(() => (typeof route.query.ed === 'string' ? route.query.ed : ''))
const eventGroups = useEventGroups(fromEventId, () => !!fromEventId.value)
const { myMember } = useMyMember(() => activeTeam.value?.team_id ?? null)
const myGroup = computed(() => {
  const ed = eventGroups.data.value?.find((x) => x.id === fromEventDrillId.value)
  return (
    ed?.groups.find((g) => !!myMember.value && g.member_ids.includes(myMember.value.id)) ?? null
  )
})
const isPublic = computed(() => d.value?.team_id === null)
// Coach rights for the drill's team (own drills) or the active team (copying public ones).
const canEdit = computed(() => {
  const team = myTeams.data.value?.find((x) => x.team_id === d.value?.team_id)
  return !!team && (team.team_role === 'coach' || team.is_club_admin)
})
const canCopy = computed(
  () =>
    !!activeTeam.value &&
    (activeTeam.value.team_role === 'coach' || activeTeam.value.is_club_admin),
)

async function copy() {
  if (!activeTeam.value) return
  const created = await copyDrill.mutateAsync({
    drillId: props.drillId,
    teamId: activeTeam.value.team_id,
  })
  await router.push({ name: 'drill-edit', params: { drillId: created.id } })
}

async function remove() {
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  if (!d.value) return
  await deleteDrill.mutateAsync(d.value)
  await router.replace({ name: 'drills' })
}
</script>

<template>
  <article class="drill">
    <p v-if="drill.isPending.value">{{ t('common.loading') }}</p>
    <p v-else-if="drill.isError.value || !d" class="drill__error" role="alert">
      {{ t('drills.loadFailedOne') }}
    </p>

    <template v-else>
      <!-- Media first and full width: players open a drill to see how it works. -->
      <div v-if="animation || d.video_path || d.video_url" class="drill__media">
        <section v-if="animation" class="drill__animation" :aria-label="t('board.animation')">
          <AnimationPlayer
            :animation="animation"
            :title="t('board.animationOf', { title: d.title })"
          />
        </section>
        <DrillVideo v-if="d.video_path" :path="d.video_path" :title="d.title" />
        <YouTubeEmbed v-if="d.video_url" :url="d.video_url" :title="d.title" />
      </div>

      <header class="drill__header">
        <div class="drill__badges">
          <UiBadge tone="training">{{ t(`drills.categories.${d.category}`) }}</UiBadge>
          <UiBadge>
            {{ isPublic ? t('drills.scope.libraryShort') : t('drills.scope.teamShort') }}
          </UiBadge>
        </div>
        <h1>{{ d.title }}</h1>
      </header>

      <p v-if="myGroup" class="drill__my-group" role="status">
        {{ t('player.yourGroupHere') }}
        <BibChip :color="myGroup.color" :label="myGroup.name" />
      </p>

      <dl class="drill__facts">
        <div v-if="d.duration_min">
          <dt>{{ t('drills.duration') }}</dt>
          <dd>{{ t('drills.minutes', { n: d.duration_min }) }}</dd>
        </div>
        <div v-if="playersLabel(d)">
          <dt>{{ t('drills.form.players') }}</dt>
          <dd>{{ playersLabel(d) }}</dd>
        </div>
        <div v-if="d.equipment.length" class="drill__wide">
          <dt>{{ t('drills.form.equipment') }}</dt>
          <dd>
            <ul class="drill__equipment" role="list">
              <li v-for="item in d.equipment" :key="item">{{ item }}</li>
            </ul>
          </dd>
        </div>
      </dl>

      <p v-if="d.description" class="drill__description">{{ d.description }}</p>

      <section v-if="canEdit || (isPublic && canCopy)" class="drill__actions">
        <BaseButton
          v-if="isPublic && canCopy"
          block
          :loading="copyDrill.isPending.value"
          @click="copy"
        >
          {{ t('drills.copyToTeam', { team: activeTeam?.team_name }) }}
        </BaseButton>
        <template v-if="canEdit">
          <section class="drill__upload" :aria-label="t('drills.upload.title')">
            <h2 class="drill__subtitle">{{ t('drills.upload.title') }}</h2>
            <DrillVideoUpload :drill="d" />
          </section>
          <RouterLink
            v-slot="{ navigate }"
            custom
            :to="{ name: 'drill-animation', params: { drillId: d.id } }"
          >
            <BaseButton variant="secondary" block @click="navigate">
              {{ animation ? t('board.editAnimation') : t('board.createAnimation') }}
            </BaseButton>
          </RouterLink>
          <RouterLink
            v-slot="{ navigate }"
            custom
            :to="{ name: 'drill-edit', params: { drillId: d.id } }"
          >
            <BaseButton variant="secondary" block @click="navigate">{{
              t('drills.edit')
            }}</BaseButton>
          </RouterLink>
          <BaseButton
            :variant="confirmDelete ? 'danger' : 'ghost'"
            block
            :loading="deleteDrill.isPending.value"
            @click="remove"
          >
            {{ confirmDelete ? t('drills.deleteConfirm') : t('drills.delete') }}
          </BaseButton>
        </template>
        <p
          v-if="copyDrill.isError.value || deleteDrill.isError.value"
          class="drill__error"
          role="alert"
        >
          {{ t('squad.errors.unknown') }}
        </p>
      </section>
    </template>
  </article>
</template>

<style scoped lang="scss">
.drill {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__header {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;
  }

  &__upload {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding-bottom: $space-3;
    border-bottom: 1px solid var(--color-border);
  }

  &__subtitle {
    font-size: $font-md;
  }

  &__media {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    // Edge to edge on phones: the field is as big as possible.
    margin-inline: calc(-1 * #{$space-4});

    @include from($bp-sm) {
      margin-inline: 0;
    }
  }

  &__my-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    padding: $space-3 $space-4;
    border: 2px dashed var(--color-chalk);
    border-radius: $radius-lg;
    font-weight: 700;
  }

  &__facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $space-3;

    dt {
      font-size: $font-xs;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    dd {
      margin: 0;
      font-weight: 600;
    }
  }

  &__wide {
    grid-column: 1 / -1;
  }

  &__equipment {
    display: flex;
    flex-wrap: wrap;
    gap: $space-1;

    li {
      padding: 2px $space-2;
      border-radius: $radius-full;
      background: var(--color-surface-muted);
      font-size: $font-sm;
    }
  }

  &__description {
    white-space: pre-line;
    line-height: 1.6;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    padding-top: $space-4;
    border-top: 1px solid var(--color-border);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>

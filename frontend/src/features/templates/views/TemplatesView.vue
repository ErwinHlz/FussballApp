<script setup lang="ts">
import { computed, ref } from 'vue'
import TrainingNav from '@/features/training-plan/components/TrainingNav.vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useActiveTeam } from '@/features/teams/composables/useActiveTeam'
import { useCreateTemplate, useTemplates } from '../composables/useTemplates'

const { t } = useI18n()
const router = useRouter()
const { activeTeam, isCoach } = useActiveTeam()
const teamId = computed(() => activeTeam.value?.team_id ?? null)
const templates = useTemplates(teamId, isCoach)
const create = useCreateTemplate()

const own = computed(() => (templates.data.value ?? []).filter((x) => x.is_own))
const shared = computed(() => (templates.data.value ?? []).filter((x) => !x.is_own))

const title = ref('')
const titleError = ref<string | undefined>()

async function onCreate() {
  const value = title.value.trim()
  if (value.length < 2 || value.length > 80) {
    titleError.value = value.length < 2 ? t('validation.minLength2') : t('validation.maxLength80')
    return
  }
  titleError.value = undefined
  const template = await create.mutateAsync({ teamId: teamId.value!, title: value })
  title.value = ''
  await router.push({ name: 'template', params: { templateId: template.id } })
}
</script>

<template>
  <section class="templates">
    <TrainingNav active="templates" />
    <header>
      <h1>{{ t('templates.title') }}</h1>
      <p class="templates__muted">{{ t('templates.intro') }}</p>
    </header>

    <p v-if="!isCoach" role="alert">{{ t('plan.coachOnly') }}</p>

    <template v-else>
      <p v-if="templates.isPending.value" class="templates__muted">{{ t('common.loading') }}</p>
      <p v-else-if="templates.isError.value" class="templates__error" role="alert">
        {{ t('templates.loadFailed') }}
      </p>

      <EmptyState
        v-else-if="!templates.data.value?.length"
        icon="copy"
        :title="t('templates.emptyTitle')"
        :text="t('templates.emptyText')"
      />

      <section v-if="own.length" class="templates__section" aria-labelledby="templates-own">
        <h2 id="templates-own" class="templates__subtitle">
          {{ t('templates.own', { team: activeTeam?.team_name }) }}
        </h2>
        <ul class="templates__list" role="list">
          <li v-for="template in own" :key="template.id">
            <RouterLink
              class="templates__item"
              :to="{ name: 'template', params: { templateId: template.id } }"
            >
              <span class="templates__main">
                <span class="templates__name">
                  {{ template.title }}
                  <BaseBadge v-if="template.shared" tone="info">{{
                    t('templates.shared')
                  }}</BaseBadge>
                </span>
                <span class="templates__muted">
                  {{ t('plan.drillCount', template.drill_count) }} ·
                  {{ t('plan.minutesShort', { n: template.total_minutes }) }}
                </span>
              </span>
              <AppIcon name="chevronRight" :size="20" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="shared.length" class="templates__section" aria-labelledby="templates-shared">
        <h2 id="templates-shared" class="templates__subtitle">{{ t('templates.fromClub') }}</h2>
        <ul class="templates__list" role="list">
          <li v-for="template in shared" :key="template.id">
            <RouterLink
              class="templates__item"
              :to="{ name: 'template', params: { templateId: template.id } }"
            >
              <span class="templates__main">
                <span class="templates__name">
                  {{ template.title }}
                  <BaseBadge tone="match">{{ template.team_name }}</BaseBadge>
                </span>
                <span class="templates__muted">
                  {{ t('plan.drillCount', template.drill_count) }} ·
                  {{ t('plan.minutesShort', { n: template.total_minutes }) }}
                </span>
              </span>
              <AppIcon name="chevronRight" :size="20" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <BaseCard>
        <form class="templates__form" novalidate @submit.prevent="onCreate">
          <h2 class="templates__subtitle">{{ t('templates.new') }}</h2>
          <BaseInput
            v-model="title"
            :label="t('templates.name')"
            :placeholder="t('templates.namePlaceholder')"
            required
            :error="titleError"
          />
          <p v-if="create.isError.value" class="templates__error" role="alert">
            {{ t('templates.saveFailed') }}
          </p>
          <BaseButton type="submit" block :loading="create.isPending.value">
            <template #icon><AppIcon name="plus" :size="18" /></template>
            {{ t('templates.create') }}
          </BaseButton>
          <p class="templates__muted">{{ t('templates.fromPlanHint') }}</p>
        </form>
      </BaseCard>
    </template>
  </section>
</template>

<style scoped lang="scss">
.templates {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__section,
  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__subtitle {
    font-size: $font-lg;
  }

  &__list {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
  }

  li + li {
    border-top: 1px solid var(--color-border);
  }

  &__item {
    @include focus-visible;

    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: 64px;
    padding: $space-2 $space-3 $space-2 $space-4;
    color: var(--color-text);
    text-decoration: none;
  }

  &__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $space-1;
    min-width: 0;
  }

  &__name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
    font-weight: 700;
    overflow-wrap: anywhere;
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

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import AppIcon from '@/components/AppIcon.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import { useAuthStore } from '@/stores/auth'
import { useMyClubs } from '@/features/teams/composables/useTeams'
import { useQuery } from '@tanstack/vue-query'
import AbsenceForm from '@/features/absences/components/AbsenceForm.vue'
import NotificationSettings from '../components/NotificationSettings.vue'
import AbsenceList from '@/features/absences/components/AbsenceList.vue'
import { fetchMyMemberIds } from '@/features/absences/api'
import { useMyAbsences } from '@/features/absences/composables/useAbsences'
import { profileSchema } from '../schemas'
import { useProfile, useUpdateProfile } from '../composables/useProfile'
import { useSignOut } from '../composables/useAuth'

const { t } = useI18n()
const auth = useAuthStore()
const profile = useProfile()
const updateProfile = useUpdateProfile()
const signOut = useSignOut()
const myClubs = useMyClubs()
const myAbsences = useMyAbsences()
const myMemberIds = useQuery({
  queryKey: computed(() => ['my-member-ids', auth.userId] as const),
  queryFn: () => fetchMyMemberIds(auth.userId!),
  enabled: computed(() => !!auth.userId),
})
const absenceFormOpen = ref(false)

const { defineField, errors, handleSubmit, resetForm, meta } = useForm({
  validationSchema: toTypedSchema(profileSchema),
})
const [displayName] = defineField('displayName')
const saved = ref(false)

watch(
  () => profile.data.value,
  (value) => {
    if (value) resetForm({ values: { displayName: value.display_name } })
  },
  { immediate: true },
)

const onSubmit = handleSubmit(async (values) => {
  saved.value = false
  const updated = await updateProfile.mutateAsync({ display_name: values.displayName })
  resetForm({ values: { displayName: updated.display_name } })
  saved.value = true
})
</script>

<template>
  <section class="profile">
    <h1 class="profile__title">{{ t('profile.title') }}</h1>

    <p v-if="profile.isPending.value" class="profile__status">{{ t('common.loading') }}</p>

    <BaseCard v-else-if="profile.isError.value">
      <p role="alert">{{ t('profile.loadFailed') }}</p>
      <BaseButton variant="secondary" @click="profile.refetch()">{{
        t('common.retry')
      }}</BaseButton>
    </BaseCard>

    <BaseCard v-else>
      <form class="profile__form" novalidate @submit="onSubmit">
        <BaseInput
          v-model="displayName"
          :label="t('profile.displayName')"
          :hint="t('profile.displayNameHint')"
          autocomplete="nickname"
          required
          :error="errors.displayName ? t(errors.displayName) : undefined"
          @update:model-value="saved = false"
        />
        <div class="profile__email">
          <span class="profile__label">{{ t('auth.email') }}</span>
          <span>{{ auth.user?.email }}</span>
        </div>
        <p v-if="updateProfile.isError.value" class="profile__error" role="alert">
          {{ t('profile.saveFailed') }}
        </p>
        <p v-if="saved" class="profile__saved" role="status">✓ {{ t('profile.saved') }}</p>
        <BaseButton
          type="submit"
          block
          :disabled="!meta.dirty"
          :loading="updateProfile.isPending.value"
        >
          {{ t('common.save') }}
        </BaseButton>
      </form>
    </BaseCard>

    <section class="profile__clubs" aria-labelledby="profile-push">
      <h2 id="profile-push" class="profile__subtitle">{{ t('push.title') }}</h2>
      <BaseCard>
        <NotificationSettings />
      </BaseCard>
    </section>

    <section class="profile__clubs" aria-labelledby="profile-absences">
      <h2 id="profile-absences" class="profile__subtitle">{{ t('absences.title') }}</h2>
      <p class="profile__status">{{ t('absences.intro') }}</p>
      <AbsenceList v-if="myAbsences.data.value?.length" :absences="myAbsences.data.value" />
      <BaseButton
        v-if="myMemberIds.data.value?.length"
        variant="secondary"
        block
        :aria-expanded="absenceFormOpen"
        @click="absenceFormOpen = !absenceFormOpen"
      >
        {{ absenceFormOpen ? t('common.close') : t('absences.add') }}
      </BaseButton>
      <BaseCard v-if="absenceFormOpen && myMemberIds.data.value?.length">
        <AbsenceForm :member-ids="myMemberIds.data.value" />
      </BaseCard>
    </section>

    <section class="profile__clubs" aria-labelledby="profile-clubs">
      <h2 id="profile-clubs" class="profile__subtitle">{{ t('profile.myClubs') }}</h2>
      <p v-if="myClubs.isSuccess.value && !myClubs.data.value?.length" class="profile__status">
        {{ t('profile.noClubs') }}
      </p>
      <ul v-else class="profile__club-list" role="list">
        <li v-for="club in myClubs.data.value" :key="club.club_id" class="profile__club">
          <span class="profile__club-name">{{ club.club_name }}</span>
          <BaseBadge v-if="club.role === 'admin'" tone="training">
            <template #icon><AppIcon name="shield" :size="14" /></template>
            {{ t('roles.admin') }}
          </BaseBadge>
          <RouterLink
            v-if="club.role === 'admin'"
            class="profile__club-link"
            :to="{ name: 'club', params: { clubId: club.club_id } }"
          >
            {{ t('profile.manageClub') }}
            <AppIcon name="chevronRight" :size="18" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <BaseButton
      variant="secondary"
      block
      :loading="signOut.isPending.value"
      @click="signOut.mutate()"
    >
      {{ t('auth.signOut') }}
    </BaseButton>
    <p v-if="signOut.isError.value" class="profile__error" role="alert">
      {{ t('auth.signOutFailed') }}
    </p>
  </section>
</template>

<style scoped lang="scss">
.profile {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__subtitle {
    font-size: $font-lg;
  }

  &__clubs {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__club-list {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: $radius-lg;
  }

  &__club {
    display: flex;
    align-items: center;
    gap: $space-2;
    min-height: 52px;
    padding: $space-1 $space-2 $space-1 $space-4;

    & + & {
      border-top: 1px solid var(--color-border);
    }
  }

  &__club-name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__club-link {
    @include focus-visible;

    display: inline-flex;
    align-items: center;
    min-height: $touch-target;
    padding-inline: $space-2;
    font-weight: 600;
    text-decoration: none;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: $space-4;
  }

  &__email {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    overflow-wrap: anywhere;
  }

  &__label {
    font-weight: 600;
    font-size: $font-sm;
  }

  &__status {
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }

  &__saved {
    color: var(--color-success);
    font-weight: 600;
  }
}
</style>

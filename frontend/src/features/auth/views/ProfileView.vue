<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { useQuery } from '@tanstack/vue-query'
import BottomSheet from '@/ui/BottomSheet.vue'
import UiAvatar from '@/ui/UiAvatar.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiButton from '@/ui/UiButton.vue'
import UiIcon from '@/ui/UiIcon.vue'
import UiInput from '@/ui/UiInput.vue'
import UiListRow from '@/ui/UiListRow.vue'
import UiSection from '@/ui/UiSection.vue'
import UiSegmented from '@/ui/UiSegmented.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import { useSnackbar } from '@/ui/useSnackbar'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore, type LocalePreference } from '@/stores/locale'
import { useThemeStore, type ThemePreference } from '@/stores/theme'
import { useMyClubs } from '@/features/teams/composables/useTeams'
import AbsenceSheet from '@/features/absences/components/AbsenceSheet.vue'
import CreateClubForm from '@/features/teams/components/CreateClubForm.vue'
import type { Club } from '@/features/teams/api'
import AbsenceList from '@/features/absences/components/AbsenceList.vue'
import { fetchMyMemberIds } from '@/features/absences/api'
import { useMyAbsences } from '@/features/absences/composables/useAbsences'
import NotificationSettings from '../components/NotificationSettings.vue'
import AccentColorPicker from '../components/AccentColorPicker.vue'
import AccountSection from '../components/AccountSection.vue'
import { profileSchema } from '../schemas'
import { useProfile, useUpdateProfile } from '../composables/useProfile'
import { useSignOut } from '../composables/useAuth'

/** Profile and settings as grouped sections: account, appearance, notifications, absences… */
const { t } = useI18n()
const snackbar = useSnackbar()
const auth = useAuthStore()
const router = useRouter()
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

const { preference: theme } = storeToRefs(useThemeStore())
const { preference: language } = storeToRefs(useLocaleStore())
const themeOptions = computed(() =>
  (['auto', 'light', 'dark'] as ThemePreference[]).map((value) => ({
    value,
    label: t(`ui.theme.${value}`),
  })),
)
const languageOptions = computed<{ value: LocalePreference; label: string }[]>(() => [
  { value: 'auto', label: t('profile.language.auto') },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
])

const absenceOpen = ref(false)

// Founding a club lives here (rarely needed); one club per account to manage.
const managesClub = computed(() => myClubs.data.value?.some((c) => c.role === 'admin') ?? false)
const createClubOpen = ref(false)
async function onClubCreated(club: Club) {
  createClubOpen.value = false
  await router.push({ name: 'club', params: { clubId: club.id } })
}

const { defineField, errors, handleSubmit, resetForm, meta } = useForm({
  validationSchema: toTypedSchema(profileSchema),
})
const [displayName] = defineField('displayName')

watch(
  () => profile.data.value,
  (value) => {
    if (value) resetForm({ values: { displayName: value.display_name } })
  },
  { immediate: true },
)

const onSubmit = handleSubmit(async (values) => {
  try {
    const updated = await updateProfile.mutateAsync({ display_name: values.displayName })
    resetForm({ values: { displayName: updated.display_name } })
    snackbar.show({ text: t('profile.saved') })
  } catch {
    snackbar.show({ text: t('profile.saveFailed'), tone: 'error' })
  }
})
</script>

<template>
  <section class="profile">
    <header class="profile__head">
      <UiAvatar :name="profile.data.value?.display_name ?? '?'" :size="64" />
      <div class="profile__who">
        <h1 class="profile__title">{{ t('profile.title') }}</h1>
        <p class="profile__email">{{ auth.user?.email }}</p>
      </div>
    </header>

    <UiSection :title="t('profile.sections.account')">
      <div v-if="profile.isPending.value" aria-busy="true">
        <UiSkeleton shape="block" height="120px" />
      </div>
      <div v-else-if="profile.isError.value" class="profile__card">
        <p role="alert">{{ t('profile.loadFailed') }}</p>
        <UiButton variant="secondary" @click="profile.refetch()">{{ t('common.retry') }}</UiButton>
      </div>
      <form v-else class="profile__card" novalidate @submit="onSubmit">
        <UiInput
          v-model="displayName"
          :label="t('profile.displayName')"
          :hint="t('profile.displayNameHint')"
          autocomplete="nickname"
          required
          :error="errors.displayName ? t(errors.displayName) : undefined"
        />
        <UiButton
          type="submit"
          :variant="meta.dirty ? 'primary' : 'secondary'"
          :disabled="!meta.dirty"
          :loading="updateProfile.isPending.value"
        >
          {{ t('common.save') }}
        </UiButton>
      </form>
    </UiSection>

    <UiSection :title="t('profile.sections.appearance')">
      <div class="profile__card">
        <p class="profile__label">{{ t('profile.themeLabel') }}</p>
        <UiSegmented
          v-model="theme"
          as="radio"
          :label="t('profile.themeLabel')"
          :options="themeOptions"
        />
        <p class="profile__label">{{ t('profile.language.label') }}</p>
        <UiSegmented
          v-model="language"
          as="radio"
          :label="t('profile.language.label')"
          :options="languageOptions"
        />
        <p class="profile__label">{{ t('profile.accent.label') }}</p>
        <AccentColorPicker />
      </div>
    </UiSection>

    <UiSection :title="t('push.title')">
      <div class="profile__card">
        <NotificationSettings />
      </div>
    </UiSection>

    <UiSection :title="t('absences.title')">
      <p class="profile__muted">{{ t('absences.intro') }}</p>
      <AbsenceList v-if="myAbsences.data.value?.length" :absences="myAbsences.data.value" />
      <UiButton
        v-if="myMemberIds.data.value?.length"
        variant="secondary"
        icon="plus"
        block
        @click="absenceOpen = true"
      >
        {{ t('absences.add') }}
      </UiButton>
    </UiSection>

    <UiSection :title="t('profile.myClubs')">
      <p v-if="myClubs.isSuccess.value && !myClubs.data.value?.length" class="profile__muted">
        {{ t('profile.noClubs') }}
      </p>
      <ul v-else class="profile__list" role="list">
        <li v-for="club in myClubs.data.value" :key="club.club_id">
          <UiListRow
            :title="club.club_name"
            :subtitle="club.role === 'admin' ? t('profile.manageClub') : undefined"
            :to="
              club.role === 'admin' ? { name: 'club', params: { clubId: club.club_id } } : undefined
            "
            :chevron="club.role === 'admin'"
          >
            <template #leading><UiIcon name="building" :size="24" /></template>
            <template v-if="club.role === 'admin'" #trailing>
              <UiBadge tone="accent">{{ t('roles.admin') }}</UiBadge>
            </template>
          </UiListRow>
        </li>
      </ul>
      <UiButton
        v-if="myClubs.isSuccess.value && !managesClub"
        variant="ghost"
        icon="plus"
        @click="createClubOpen = true"
      >
        {{ myClubs.data.value?.length ? t('clubs.createAnother') : t('clubs.create') }}
      </UiButton>
      <p v-else-if="managesClub" class="profile__muted">{{ t('clubs.oneClubHint') }}</p>
    </UiSection>

    <UiSection :title="t('account.title')">
      <div class="profile__card">
        <AccountSection />
      </div>
      <ul class="profile__list" role="list">
        <li>
          <UiListRow :title="t('legal.privacy')" :to="{ name: 'privacy' }" chevron>
            <template #leading><UiIcon name="info" :size="22" /></template>
          </UiListRow>
        </li>
        <li>
          <UiListRow :title="t('legal.imprint')" :to="{ name: 'imprint' }" chevron>
            <template #leading><UiIcon name="note" :size="22" /></template>
          </UiListRow>
        </li>
      </ul>
    </UiSection>

    <UiButton
      variant="secondary"
      icon="logout"
      block
      :loading="signOut.isPending.value"
      @click="signOut.mutate()"
    >
      {{ t('auth.signOut') }}
    </UiButton>

    <AbsenceSheet v-model:open="absenceOpen" />
    <BottomSheet v-model:open="createClubOpen" :title="t('clubs.create')">
      <p class="profile__muted">{{ t('clubs.createIntro') }}</p>
      <CreateClubForm @created="onClubCreated" />
    </BottomSheet>
  </section>
</template>

<style scoped lang="scss">
.profile {
  display: flex;
  flex-direction: column;
  gap: $space-6;

  &__head {
    display: flex;
    align-items: center;
    gap: $space-4;
  }

  &__who {
    min-width: 0;
  }

  &__email {
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    padding: $space-4;
    border-radius: $radius-xl;
    background: var(--color-surface);
  }

  &__label {
    font-size: $font-sm;
    font-weight: 700;
  }

  &__muted {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin: 0;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import UiButton from '@/ui/UiButton.vue'
import UiChipGroup from '@/ui/UiChipGroup.vue'
import UiInput from '@/ui/UiInput.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import AbsenceForm from '@/features/absences/components/AbsenceForm.vue'
import { useAuthStore } from '@/stores/auth'
import type { TeamMember } from '@/features/teams/api'
import { squadErrorKind, type MemberInput } from '../api'
import { linkCandidates, MEMBER_STATUSES, POSITIONS } from '../squad'
import { memberSchema, parseShirtNumber } from '../schemas'
import {
  useCreateMember,
  useDeleteMember,
  useLinkMember,
  useUpdateMember,
} from '../composables/useSquad'

const props = defineProps<{
  teamId: string
  /** null = add a new player without account */
  member: TeamMember | null
  members: TeamMember[]
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const auth = useAuthStore()
const createMember = useCreateMember(() => props.teamId)
const updateMember = useUpdateMember(() => props.teamId)
const deleteMember = useDeleteMember(() => props.teamId)
const linkMember = useLinkMember(() => props.teamId)

const isEdit = computed(() => !!props.member)
const isSelf = computed(() => !!props.member?.user_id && props.member.user_id === auth.userId)
const confirmDelete = ref(false)
const linkTargetId = ref('')

const { defineField, errors, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(memberSchema),
})
const [displayName] = defineField('displayName')
const [shirtNumber] = defineField('shirtNumber')
const [positions] = defineField('positions')
const [status] = defineField('status')
const [role] = defineField('role')

watch(
  [open, () => props.member],
  ([isOpen]) => {
    if (!isOpen) return
    const m = props.member
    resetForm({
      values: {
        displayName: m?.display_name ?? '',
        shirtNumber: m?.shirt_number?.toString() ?? '',
        positions: (m?.positions ?? []) as MemberInput['positions'],
        status: m?.status ?? 'active',
        role: m?.role ?? 'player',
      },
    })
    confirmDelete.value = false
    linkTargetId.value = ''
    for (const mutation of [createMember, updateMember, deleteMember, linkMember]) mutation.reset()
  },
  { immediate: true },
)

const positionOptions = computed(() =>
  POSITIONS.map((p) => ({ value: p, label: t(`squad.positions.${p}`) })),
)
const statusOptions = computed(() =>
  MEMBER_STATUSES.map((s) => ({ value: s, label: t(`squad.status.${s}`) })),
)
const roleOptions = computed(() => [
  { value: 'player' as const, label: t('roles.player') },
  { value: 'coach' as const, label: t('roles.coach') },
])
const candidates = computed(() =>
  props.member?.user_id === null ? linkCandidates(props.members, auth.userId) : [],
)

const saveError = computed(() => {
  const error = createMember.error.value ?? updateMember.error.value
  return error ? t(`squad.errors.${squadErrorKind(error)}`) : null
})
const isSaving = computed(() => createMember.isPending.value || updateMember.isPending.value)

const onSubmit = handleSubmit(async (values) => {
  const input: MemberInput = {
    display_name: values.displayName,
    shirt_number: parseShirtNumber(values.shirtNumber),
    positions: values.positions,
    status: values.status,
    role: values.role,
  }
  if (props.member) {
    await updateMember.mutateAsync({ memberId: props.member.id, input })
  } else {
    await createMember.mutateAsync(input)
  }
  open.value = false
})

async function onDelete() {
  if (!props.member) return
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  await deleteMember.mutateAsync(props.member.id)
  open.value = false
}

async function onLink() {
  if (!props.member || !linkTargetId.value) return
  await linkMember.mutateAsync({ manualId: props.member.id, accountId: linkTargetId.value })
  open.value = false
}
</script>

<template>
  <BottomSheet v-model:open="open" :title="isEdit ? t('squad.editPlayer') : t('squad.addPlayer')">
    <form id="member-form" class="member-form" novalidate @submit="onSubmit">
      <p v-if="!isEdit" class="member-form__hint">{{ t('squad.addPlayerHint') }}</p>

      <UiInput
        v-model="displayName"
        :label="t('squad.name')"
        required
        :error="errors.displayName ? t(errors.displayName) : undefined"
      />
      <UiInput
        v-model="shirtNumber"
        :label="t('squad.shirtNumber')"
        type="tel"
        autocomplete="off"
        :error="errors.shirtNumber ? t(errors.shirtNumber) : undefined"
      />
      <UiChipGroup
        v-model="positions"
        :label="t('squad.positionsLabel')"
        :options="positionOptions"
        multiple
      />
      <UiChipGroup v-model="status" :label="t('squad.statusLabel')" :options="statusOptions" />
      <UiChipGroup
        v-if="isEdit && !isSelf"
        v-model="role"
        :label="t('squad.roleLabel')"
        :options="roleOptions"
      />

      <p v-if="saveError" class="member-form__error" role="alert">{{ saveError }}</p>
    </form>

    <section v-if="member && member.user_id === null" class="member-form__section">
      <h3 class="member-form__subtitle">{{ t('squad.linkTitle') }}</h3>
      <p class="member-form__hint">{{ t('squad.linkHint') }}</p>
      <template v-if="candidates.length">
        <label class="member-form__select-label" for="link-target">{{
          t('squad.linkSelect')
        }}</label>
        <select id="link-target" v-model="linkTargetId" class="member-form__select">
          <option value="" disabled>{{ t('squad.linkChoose') }}</option>
          <option v-for="c in candidates" :key="c.id" :value="c.id">{{ c.display_name }}</option>
        </select>
        <UiButton
          variant="secondary"
          block
          :disabled="!linkTargetId"
          :loading="linkMember.isPending.value"
          @click="onLink"
        >
          {{ t('squad.linkAction') }}
        </UiButton>
        <p v-if="linkMember.isError.value" class="member-form__error" role="alert">
          {{ t('squad.errors.unknown') }}
        </p>
      </template>
      <p v-else class="member-form__hint">{{ t('squad.linkNoCandidates') }}</p>
    </section>

    <section v-if="member" class="member-form__section">
      <h3 class="member-form__subtitle">{{ t('absences.forPlayer') }}</h3>
      <AbsenceForm :member-ids="[member.id]" />
    </section>

    <section v-if="member && !isSelf" class="member-form__section">
      <UiButton
        :variant="confirmDelete ? 'danger' : 'ghost'"
        block
        :loading="deleteMember.isPending.value"
        @click="onDelete"
      >
        {{
          confirmDelete
            ? t('squad.removeConfirm', { name: member.display_name })
            : t('squad.remove')
        }}
      </UiButton>
      <p v-if="deleteMember.isError.value" class="member-form__error" role="alert">
        {{ t('squad.errors.unknown') }}
      </p>
    </section>

    <template #footer>
      <UiButton variant="secondary" @click="open = false">{{ t('common.cancel') }}</UiButton>
      <UiButton type="submit" form="member-form" :loading="isSaving">
        {{ t('common.save') }}
      </UiButton>
    </template>
  </BottomSheet>
</template>

<style scoped lang="scss">
.member-form {
  display: flex;
  flex-direction: column;
  gap: $space-4;

  &__section {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin-top: $space-5;
    padding-top: $space-4;
    border-top: 1px solid var(--color-border);
  }

  &__subtitle {
    font-size: $font-md;
  }

  &__hint {
    font-size: $font-sm;
    color: var(--color-text-muted);
  }

  &__select-label {
    font-weight: 600;
    font-size: $font-sm;
  }

  &__select {
    @include focus-visible;

    min-height: $touch-target;
    padding: $space-2 $space-3;
    border: 2px solid var(--color-border);
    border-radius: $radius-md;
    background: var(--color-surface);
    font-size: $font-md;
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>

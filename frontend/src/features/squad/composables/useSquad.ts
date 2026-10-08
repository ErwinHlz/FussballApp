import { toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { teamKeys } from '@/features/teams/composables/useTeams'
import { createMember, deleteMember, linkMember, updateMember, type MemberInput } from '../api'

function useInvalidateSquad(teamId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient()
  return () => {
    const id = toValue(teamId)
    return id ? queryClient.invalidateQueries({ queryKey: teamKeys.teamMembers(id) }) : undefined
  }
}

export function useCreateMember(teamId: MaybeRefOrGetter<string | null>) {
  const invalidate = useInvalidateSquad(teamId)
  return useMutation({
    mutationFn: (input: MemberInput) => createMember(toValue(teamId)!, input),
    onSuccess: invalidate,
  })
}

export function useUpdateMember(teamId: MaybeRefOrGetter<string | null>) {
  const invalidate = useInvalidateSquad(teamId)
  return useMutation({
    mutationFn: ({ memberId, input }: { memberId: string; input: MemberInput }) =>
      updateMember(memberId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteMember(teamId: MaybeRefOrGetter<string | null>) {
  const invalidate = useInvalidateSquad(teamId)
  return useMutation({ mutationFn: deleteMember, onSuccess: invalidate })
}

export function useLinkMember(teamId: MaybeRefOrGetter<string | null>) {
  const invalidate = useInvalidateSquad(teamId)
  return useMutation({
    mutationFn: ({ manualId, accountId }: { manualId: string; accountId: string }) =>
      linkMember(manualId, accountId),
    onSuccess: invalidate,
  })
}

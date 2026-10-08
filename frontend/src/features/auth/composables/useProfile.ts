import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/stores/auth'
import { fetchProfile, updateProfile, type ProfileUpdate } from '../api'

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string | null) => ['profile', userId] as const,
}

export function useProfile() {
  const auth = useAuthStore()

  return useQuery({
    queryKey: computed(() => profileKeys.detail(auth.userId)),
    queryFn: () => fetchProfile(auth.userId!),
    enabled: computed(() => !!auth.userId),
  })
}

export function useUpdateProfile() {
  const auth = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: ProfileUpdate) => {
      if (!auth.userId) throw new Error('Not signed in')
      return updateProfile(auth.userId, patch)
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.detail(profile.id), profile)
      return queryClient.invalidateQueries({ queryKey: profileKeys.all })
    },
  })
}

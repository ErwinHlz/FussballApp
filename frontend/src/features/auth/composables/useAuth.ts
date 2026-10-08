import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { sendMagicLink, signOut } from '../api'

export function useSendMagicLink() {
  return useMutation({
    mutationFn: ({ email, redirectPath }: { email: string; redirectPath: string }) =>
      sendMagicLink(email, redirectPath),
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      queryClient.clear()
      await router.replace({ name: 'login' })
    },
  })
}

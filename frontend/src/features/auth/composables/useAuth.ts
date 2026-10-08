import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { requestPasswordReset, signIn, signOut, signUp, updatePassword } from '../api'

export function useSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn(email, password),
  })
}

export function useSignUp() {
  return useMutation({ mutationFn: signUp })
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (email: string) => requestPasswordReset(email) })
}

export function useUpdatePassword() {
  return useMutation({ mutationFn: (password: string) => updatePassword(password) })
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

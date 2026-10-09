import { AuthApiError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesUpdate } from '@/types/database'

export type Profile = Tables<'profiles'>
export type ProfileUpdate = Pick<TablesUpdate<'profiles'>, 'display_name' | 'avatar_url'>

export type AuthErrorKind =
  | 'invalidCredentials'
  | 'emailTaken'
  | 'emailNotConfirmed'
  | 'weakPassword'
  | 'rateLimited'
  | 'unknown'

/** Maps Supabase auth errors to an i18n-friendly kind. */
export function authErrorKind(error: unknown): AuthErrorKind {
  if (!(error instanceof AuthApiError)) return 'unknown'
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalidCredentials'
    case 'user_already_exists':
    case 'email_exists':
      return 'emailTaken'
    case 'email_not_confirmed':
      return 'emailNotConfirmed'
    case 'weak_password':
      return 'weakPassword'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'rateLimited'
    default:
      return 'unknown'
  }
}

function appUrl(path: string) {
  return new URL(path, window.location.origin).toString()
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** Returns whether the user is signed in right away (false = email confirmation required). */
export async function signUp(input: {
  email: string
  password: string
  displayName: string
  redirectPath: string
}): Promise<{ signedIn: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName },
      emailRedirectTo: appUrl(input.redirectPath),
    },
  })
  if (error) throw error
  return { signedIn: !!data.session }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl('/reset-password'),
  })
  if (error) throw error
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** GDPR Art. 15/20: everything stored about the signed-in user, as JSON. */
export async function exportMyData(): Promise<unknown> {
  const { data, error } = await supabase.rpc('export_my_data')
  if (error) throw error
  return data
}

/** GDPR Art. 17: deletes the account and the personal data; the local session is ended. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
  // The user no longer exists; drop the local session without calling the server.
  await supabase.auth.signOut({ scope: 'local' })
}

export function isSoleAdminError(error: unknown): boolean {
  return (error as { hint?: string } | null)?.hint === 'sole_admin'
}

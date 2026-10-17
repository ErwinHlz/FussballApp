import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/stores/auth'
import {
  acceptInvite,
  createClub,
  createInvite,
  createTeam,
  fetchClub,
  fetchClubMembers,
  fetchClubTeams,
  fetchInviteInfo,
  fetchMyClubs,
  fetchMyTeams,
  fetchTeamInvites,
  fetchTeamMembers,
  removeClubLogoFile,
  revokeInvite,
  setClubBranding,
  setClubMemberRole,
  uploadClubLogo,
} from '../api'

export const teamKeys = {
  myTeams: (userId: string | null) => ['my-teams', userId] as const,
  myClubs: (userId: string | null) => ['my-clubs', userId] as const,
  club: (clubId: string) => ['club', clubId] as const,
  clubTeams: (clubId: string) => ['club', clubId, 'teams'] as const,
  clubMembers: (clubId: string) => ['club', clubId, 'members'] as const,
  teamMembers: (teamId: string) => ['team', teamId, 'members'] as const,
  teamInvites: (teamId: string) => ['team', teamId, 'invites'] as const,
  invite: (token: string) => ['invite', token] as const,
}

export function useMyTeams() {
  const auth = useAuthStore()
  return useQuery({
    queryKey: computed(() => teamKeys.myTeams(auth.userId)),
    queryFn: fetchMyTeams,
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useMyClubs() {
  const auth = useAuthStore()
  return useQuery({
    queryKey: computed(() => teamKeys.myClubs(auth.userId)),
    queryFn: fetchMyClubs,
    enabled: computed(() => auth.isAuthenticated),
  })
}

export function useCreateClub() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createClub,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-clubs'] }),
  })
}

export function useClub(clubId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => teamKeys.club(toValue(clubId))),
    queryFn: () => fetchClub(toValue(clubId)),
    enabled: computed(() => !!toValue(clubId)),
  })
}

export function useClubTeams(clubId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => teamKeys.clubTeams(toValue(clubId))),
    queryFn: () => fetchClubTeams(toValue(clubId)),
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTeam,
    onSuccess: (team) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKeys.clubTeams(team.club_id) }),
        queryClient.invalidateQueries({ queryKey: ['my-teams'] }),
      ]),
  })
}

export function useClubMembers(clubId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => teamKeys.clubMembers(toValue(clubId))),
    queryFn: () => fetchClubMembers(toValue(clubId)),
  })
}

export function useSetClubMemberRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setClubMemberRole,
    onSuccess: (_data, { clubId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: teamKeys.clubMembers(clubId) }),
        queryClient.invalidateQueries({ queryKey: ['my-teams'] }),
        queryClient.invalidateQueries({ queryKey: ['my-clubs'] }),
      ]),
  })
}

export function useTeamMembers(teamId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => teamKeys.teamMembers(toValue(teamId) ?? '')),
    queryFn: () => fetchTeamMembers(toValue(teamId)!),
    enabled: computed(() => !!toValue(teamId)),
  })
}

export function useTeamInvites(teamId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => teamKeys.teamInvites(toValue(teamId))),
    queryFn: () => fetchTeamInvites(toValue(teamId)),
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createInvite,
    onSuccess: (invite) =>
      queryClient.invalidateQueries({ queryKey: teamKeys.teamInvites(invite.team_id) }),
  })
}

export function useRevokeInvite(teamId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: revokeInvite,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: teamKeys.teamInvites(toValue(teamId)) }),
  })
}

export function useInviteInfo(token: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => teamKeys.invite(toValue(token))),
    queryFn: () => fetchInviteInfo(toValue(token)),
  })
}

export function useAcceptInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acceptInvite,
    // Refetch even when no page shows the lists right now (the invite page does not): the
    // next page must see the new team, not the cached "no team yet".
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-teams'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['my-clubs'], refetchType: 'all' }),
      ]),
  })
}

/** Uploads a new logo (optional) and saves logo + color; the old file is removed afterwards. */
export function useSaveClubBranding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      clubId: string
      currentLogoPath: string | null
      newLogo: Blob | null
      removeLogo: boolean
      accentColor: string | null
    }) => {
      const logoPath = input.newLogo
        ? await uploadClubLogo(input.clubId, input.newLogo)
        : input.removeLogo
          ? null
          : input.currentLogoPath
      const club = await setClubBranding({
        clubId: input.clubId,
        logoPath,
        accentColor: input.accentColor,
      })
      if (input.currentLogoPath && input.currentLogoPath !== logoPath) {
        // Best effort: an orphaned file only costs storage.
        await removeClubLogoFile(input.currentLogoPath).catch(() => undefined)
      }
      return club
    },
    onSuccess: (club) => {
      queryClient.setQueryData(teamKeys.club(club.id), club)
      return queryClient.invalidateQueries({ queryKey: ['my-teams'] })
    },
  })
}

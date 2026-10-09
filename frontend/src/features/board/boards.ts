import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/types/database'
import { emptyAnimation, type Animation } from './schema'

/** Standalone tactics boards of a team (coaches only). */
export type TacticBoard = Tables<'tactic_boards'>

export async function fetchBoards(teamId: string): Promise<TacticBoard[]> {
  const { data, error } = await supabase
    .from('tactic_boards')
    .select('*')
    .eq('team_id', teamId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchBoard(boardId: string): Promise<TacticBoard> {
  const { data, error } = await supabase
    .from('tactic_boards')
    .select('*')
    .eq('id', boardId)
    .single()
  if (error) throw error
  return data
}

export async function createBoard(input: { teamId: string; title: string }): Promise<TacticBoard> {
  const { data, error } = await supabase
    .from('tactic_boards')
    .insert({
      team_id: input.teamId,
      title: input.title.trim(),
      animation: emptyAnimation() as unknown as NonNullable<Json>,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveBoard(input: {
  boardId: string
  title: string
  animation: Animation
}): Promise<TacticBoard> {
  const { data, error } = await supabase
    .from('tactic_boards')
    .update({
      title: input.title.trim(),
      animation: input.animation as unknown as NonNullable<Json>,
    })
    .eq('id', input.boardId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBoard(boardId: string): Promise<void> {
  const { error } = await supabase.from('tactic_boards').delete().eq('id', boardId)
  if (error) throw error
}

export const boardKeys = {
  all: ['boards'] as const,
  list: (teamId: string) => ['boards', 'list', teamId] as const,
  detail: (boardId: string) => ['boards', 'detail', boardId] as const,
}

export function useBoards(
  teamId: MaybeRefOrGetter<string | null>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  return useQuery({
    queryKey: computed(() => boardKeys.list(toValue(teamId) ?? '')),
    queryFn: () => fetchBoards(toValue(teamId)!),
    enabled: computed(() => !!toValue(teamId) && toValue(enabled)),
  })
}

export function useBoard(boardId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => boardKeys.detail(toValue(boardId))),
    queryFn: () => fetchBoard(toValue(boardId)),
  })
}

function useBoardMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKeys.all }),
  })
}

export const useCreateBoard = () => useBoardMutation(createBoard)
export const useSaveBoard = () => useBoardMutation(saveBoard)
export const useDeleteBoard = () => useBoardMutation(deleteBoard)

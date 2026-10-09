import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  copyDrill,
  createDrill,
  createVideoUploadUrl,
  deleteDrill,
  fetchDrill,
  fetchDrills,
  removeVideoFile,
  setDrillVideoPath,
  signedVideoUrl,
  updateDrill,
  updateDrillAnimation,
  type DrillInput,
} from '../api'
import type { Json } from '@/types/database'
import type { Drill } from '../logic'
import { uploadWithProgress, videoPath } from '../video'

export const drillKeys = {
  all: ['drills'] as const,
  list: (teamId: string) => ['drills', 'list', teamId] as const,
  detail: (drillId: string) => ['drills', 'detail', drillId] as const,
}

export function useDrills(teamId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => drillKeys.list(toValue(teamId) ?? '')),
    queryFn: () => fetchDrills(toValue(teamId)!),
    enabled: computed(() => !!toValue(teamId)),
    // The library rarely changes.
    staleTime: 5 * 60_000,
  })
}

export function useDrill(drillId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => drillKeys.detail(toValue(drillId))),
    queryFn: () => fetchDrill(toValue(drillId)),
  })
}

function useInvalidateDrills() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: drillKeys.all })
}

export function useCreateDrill(teamId: MaybeRefOrGetter<string | null>) {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: (input: DrillInput) => createDrill(toValue(teamId)!, input),
    onSuccess: invalidate,
  })
}

export function useUpdateDrill() {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: ({ drillId, input }: { drillId: string; input: DrillInput }) =>
      updateDrill(drillId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteDrill() {
  const invalidate = useInvalidateDrills()
  return useMutation({ mutationFn: deleteDrill, onSuccess: invalidate })
}

export function useCopyDrill() {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: ({ drillId, teamId }: { drillId: string; teamId: string }) =>
      copyDrill(drillId, teamId),
    onSuccess: invalidate,
  })
}

export function useSaveDrillAnimation() {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: ({ drillId, animation }: { drillId: string; animation: Json | null }) =>
      updateDrillAnimation(drillId, animation),
    onSuccess: invalidate,
  })
}

export function useDrillVideoUrl(path: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => ['drill-video', toValue(path)] as const),
    queryFn: () => signedVideoUrl(toValue(path)!),
    enabled: computed(() => !!toValue(path)),
    // Signed URLs live for an hour; refresh well before.
    staleTime: 45 * 60_000,
  })
}

/**
 * Uploads a video with progress, links it to the drill and removes the previous file.
 * `progress` (0–1) and `cancel()` drive the UI.
 */
export function useUploadDrillVideo() {
  const invalidate = useInvalidateDrills()
  const progress = ref(0)
  let controller: AbortController | null = null

  const mutation = useMutation({
    mutationFn: async ({
      drill,
      file,
    }: {
      drill: Pick<Drill, 'id' | 'team_id' | 'video_path'>
      file: File
    }) => {
      if (!drill.team_id) throw new Error('Only team drills can have uploaded videos')
      progress.value = 0
      controller = new AbortController()
      const path = videoPath(drill.team_id, drill.id, file)
      const signedUrl = await createVideoUploadUrl(path)
      await uploadWithProgress(signedUrl, file, {
        apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        onProgress: (fraction) => (progress.value = fraction),
        signal: controller.signal,
      })
      try {
        await setDrillVideoPath(drill.id, path)
      } catch (error) {
        await removeVideoFile(path).catch(() => undefined)
        throw error
      }
      if (drill.video_path) await removeVideoFile(drill.video_path).catch(() => undefined)
    },
    onSettled: () => {
      controller = null
      return invalidate()
    },
  })

  return { ...mutation, progress, cancel: () => controller?.abort() }
}

export function useRemoveDrillVideo() {
  const invalidate = useInvalidateDrills()
  return useMutation({
    mutationFn: async (drill: Pick<Drill, 'id' | 'video_path'>) => {
      await setDrillVideoPath(drill.id, null)
      if (drill.video_path) await removeVideoFile(drill.video_path)
    },
    onSuccess: invalidate,
  })
}

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { drillKeys } from '@/features/drills/composables/useDrills'
import { eventKeys } from '@/features/events/composables/useEvents'
import { planKeys } from '@/features/training-plan/composables/usePlan'
import {
  addTemplateDrill,
  applyTemplate,
  createTemplate,
  createTemplateFromEvent,
  deleteTemplate,
  fetchTemplate,
  fetchTemplateItems,
  listTemplates,
  removeTemplateItem,
  reorderTemplate,
  updateTemplate,
  updateTemplateItem,
} from '../api'

export const templateKeys = {
  all: ['templates'] as const,
  list: (teamId: string) => ['templates', 'list', teamId] as const,
  detail: (templateId: string) => ['templates', 'detail', templateId] as const,
  items: (templateId: string) => ['templates', 'items', templateId] as const,
}

export function useTemplates(
  teamId: MaybeRefOrGetter<string | null>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  return useQuery({
    queryKey: computed(() => templateKeys.list(toValue(teamId) ?? '')),
    queryFn: () => listTemplates(toValue(teamId)!),
    enabled: computed(() => !!toValue(teamId) && toValue(enabled)),
  })
}

export function useTemplate(templateId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => templateKeys.detail(toValue(templateId))),
    queryFn: () => fetchTemplate(toValue(templateId)),
  })
}

export function useTemplateItems(templateId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => templateKeys.items(toValue(templateId))),
    queryFn: () => fetchTemplateItems(toValue(templateId)),
  })
}

function useTemplateMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
  })
}

export const useCreateTemplate = () => useTemplateMutation(createTemplate)
export const useDeleteTemplate = () => useTemplateMutation(deleteTemplate)
export const useAddTemplateDrill = () => useTemplateMutation(addTemplateDrill)
export const useRemoveTemplateItem = () => useTemplateMutation(removeTemplateItem)
export const useUpdateTemplate = () =>
  useTemplateMutation(
    (input: { templateId: string; patch: Parameters<typeof updateTemplate>[1] }) =>
      updateTemplate(input.templateId, input.patch),
  )
export const useUpdateTemplateItem = () =>
  useTemplateMutation(
    (input: { itemId: string; patch: Parameters<typeof updateTemplateItem>[1] }) =>
      updateTemplateItem(input.itemId, input.patch),
  )
export const useReorderTemplate = () =>
  useTemplateMutation((input: { templateId: string; ids: string[] }) =>
    reorderTemplate(input.templateId, input.ids),
  )
export const useCreateTemplateFromEvent = () => useTemplateMutation(createTemplateFromEvent)

/** Applying changes the training's plan and may copy drills into the team. */
export function useApplyTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: applyTemplate,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: planKeys.all }),
        queryClient.invalidateQueries({ queryKey: eventKeys.all }),
        queryClient.invalidateQueries({ queryKey: drillKeys.all }),
      ]),
  })
}

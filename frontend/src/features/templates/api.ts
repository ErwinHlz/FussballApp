import { supabase } from '@/lib/supabase'
import type { Database, Tables } from '@/types/database'

type Functions = Database['public']['Functions']

export type Template = Tables<'training_templates'>
export type TemplateSummary = Functions['list_training_templates']['Returns'][number]
export type TemplateItem = Functions['template_items']['Returns'][number]

export async function listTemplates(teamId: string): Promise<TemplateSummary[]> {
  const { data, error } = await supabase.rpc('list_training_templates', { p_team_id: teamId })
  if (error) throw error
  return data
}

export async function fetchTemplate(templateId: string): Promise<Template> {
  const { data, error } = await supabase
    .from('training_templates')
    .select('*')
    .eq('id', templateId)
    .single()
  if (error) throw error
  return data
}

export async function fetchTemplateItems(templateId: string): Promise<TemplateItem[]> {
  const { data, error } = await supabase.rpc('template_items', { p_template_id: templateId })
  if (error) throw error
  return data
}

export async function createTemplate(input: {
  teamId: string
  title: string
  description?: string
  shared?: boolean
}): Promise<Template> {
  const { data, error } = await supabase
    .from('training_templates')
    .insert({
      team_id: input.teamId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      shared: input.shared ?? false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTemplate(
  templateId: string,
  patch: Partial<Pick<Template, 'title' | 'description' | 'shared'>>,
): Promise<Template> {
  const { data, error } = await supabase
    .from('training_templates')
    .update(patch)
    .eq('id', templateId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from('training_templates').delete().eq('id', templateId)
  if (error) throw error
}

export async function addTemplateDrill(input: {
  templateId: string
  drillId: string
  position: number
}): Promise<void> {
  const { error } = await supabase.from('template_drills').insert({
    template_id: input.templateId,
    drill_id: input.drillId,
    position: input.position,
  })
  if (error) throw error
}

export async function updateTemplateItem(
  itemId: string,
  patch: { duration_min?: number | null; coach_notes?: string | null },
): Promise<void> {
  const { error } = await supabase.from('template_drills').update(patch).eq('id', itemId)
  if (error) throw error
}

export async function removeTemplateItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('template_drills').delete().eq('id', itemId)
  if (error) throw error
}

export async function reorderTemplate(templateId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_template_drills', {
    p_template_id: templateId,
    p_ids: ids,
  })
  if (error) throw error
}

/** Appends the template to a training; returns the number of added drills. */
export async function applyTemplate(input: {
  templateId: string
  eventId: string
}): Promise<number> {
  const { data, error } = await supabase.rpc('apply_training_template', {
    p_template_id: input.templateId,
    p_event_id: input.eventId,
  })
  if (error) throw error
  return data
}

export async function createTemplateFromEvent(input: {
  eventId: string
  title: string
  shared: boolean
}): Promise<Template> {
  const { data, error } = await supabase.rpc('create_template_from_event', {
    p_event_id: input.eventId,
    p_title: input.title,
    p_shared: input.shared,
  })
  if (error) throw error
  return data
}

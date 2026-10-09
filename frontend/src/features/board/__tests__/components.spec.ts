import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '@/lib/i18n'
import AnimationPlayer from '../components/AnimationPlayer.vue'
import BoardEditorView from '../views/BoardEditorView.vue'
import { animationSchema, type Animation } from '../schema'

const animation: Animation = {
  version: 1,
  field: 'half',
  durationMs: 4000,
  objects: [{ id: 'p1', type: 'player', color: '#ef4444', label: '7' }],
  keyframes: [
    { t: 0, positions: { p1: [0, 0] } },
    { t: 4000, positions: { p1: [100, 100] } },
  ],
  annotations: [{ type: 'arrow', from: [0, 0], to: [100, 100], style: 'dribble' }],
}

const transformOf = (w: ReturnType<typeof mount>) =>
  w.find('.board__object').attributes('transform')

describe('AnimationPlayer', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
  })

  it('renders objects and arrows and does not autoplay', () => {
    const wrapper = mount(AnimationPlayer, {
      props: { animation, title: 'Rondo' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Rondo')
    expect(wrapper.find('.token__label').text()).toBe('7')
    expect(wrapper.find('.board__arrow--dribble').exists()).toBe(true)
    expect(transformOf(wrapper)).toBe('translate(0 0)')
    expect(wrapper.find('.player__play').attributes('aria-label')).toBe('Abspielen')
  })

  it('jumps to a time with the scrubber (linear when smoothing is off)', async () => {
    const wrapper = mount(AnimationPlayer, {
      props: { animation, title: 'Rondo' },
      global: { plugins: [i18n] },
    })
    const smooth = wrapper.findAll('.player__chip').find((c) => c.text() === 'Weich')!
    await smooth.trigger('click')
    await wrapper.find('.player__scrub').setValue('2000')

    // Half field is 68 x 52.5 m, so 50 % / 50 % = (34, 26.25).
    expect(transformOf(wrapper)).toBe('translate(34 26.25)')
    expect(wrapper.find('.player__scrub').attributes('aria-valuetext')).toBe('2.0 von 4.0 Sekunden')
  })
})

// ---------------------------------------------------------------------------

const saveMutate = vi.fn()
const drillData = ref<Record<string, unknown> | undefined>(undefined)

vi.mock('@/features/drills/composables/useDrills', () => ({
  useDrill: () => ({ data: drillData, isPending: ref(false), isError: ref(false) }),
  useSaveDrillAnimation: () => ({
    mutateAsync: saveMutate,
    isPending: ref(false),
    isError: ref(false),
  }),
}))
vi.mock('../composables/useSquadNames', () => ({ useSquadNames: () => ref([]) }))
vi.mock('@/features/teams/composables/useActiveTeam', () => ({
  useActiveTeam: () => ({
    myTeams: { data: ref([{ team_id: 't1', team_role: 'coach', is_club_admin: false }]) },
  }),
}))

async function mountEditor() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/drills/:drillId/animation', component: BoardEditorView, props: true },
      { path: '/drills/:drillId', name: 'drill', component: { template: '<div />' } },
    ],
  })
  await router.push('/drills/d1/animation')
  await router.isReady()
  return mount(BoardEditorView, { props: { drillId: 'd1' }, global: { plugins: [router, i18n] } })
}

const button = (w: Awaited<ReturnType<typeof mountEditor>>, text: string) =>
  w.findAll('button').find((b) => b.text().includes(text))!
const paletteItem = (w: Awaited<ReturnType<typeof mountEditor>>, key: string) =>
  w.get(`[data-palette="${key}"]`)

describe('BoardEditorView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    saveMutate.mockReset().mockResolvedValue({})
    drillData.value = { id: 'd1', team_id: 't1', title: 'Eigene Übung', animation: null }
  })

  it('adds a player, moves it with the keyboard in a new keyframe and saves a valid animation', async () => {
    const wrapper = await mountEditor()

    await paletteItem(wrapper, 'player').trigger('click')
    const player = wrapper.get('.board__object')
    expect(player.attributes('aria-label')).toBe('Spieler 1')

    await button(wrapper, '+ Schritt').trigger('click')
    await wrapper.get('.board__object').trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    await wrapper.get('.board__object').trigger('keydown', { key: 'ArrowDown' })

    await button(wrapper, 'Animation speichern').trigger('click')
    await flushPromises()

    const saved = saveMutate.mock.calls[0]![0].animation as Animation
    expect(animationSchema.safeParse(saved).success).toBe(true)
    expect(saved.objects).toEqual([{ id: 'p1', type: 'player', color: '#ef4444', label: '1' }])
    expect(saved.keyframes.map((k) => k.t)).toEqual([0, 1500])
    expect(saved.keyframes[0]!.positions.p1).toEqual([40, 45])
    expect(saved.keyframes[1]!.positions.p1).toEqual([45, 46])
  })

  it('removes an object with the erase tool', async () => {
    const wrapper = await mountEditor()
    await paletteItem(wrapper, 'ball').trigger('click')
    expect(wrapper.findAll('.board__object')).toHaveLength(1)

    await button(wrapper, 'Löschen').trigger('click')
    await wrapper.get('.board__object').trigger('pointerdown')

    expect(wrapper.findAll('.board__object')).toHaveLength(0)
  })

  it('only lets coaches of the drill team edit', async () => {
    drillData.value = { id: 'd1', team_id: null, title: 'Bibliothek', animation: null }
    const wrapper = await mountEditor()
    expect(wrapper.text()).toContain('Nur Trainer können Animationen')
  })
})

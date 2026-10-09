import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { i18n } from '@/lib/i18n'
import DrillVideoUpload from '../components/DrillVideoUpload.vue'

const uploadMutate = vi.fn()
const progress = ref(0)
const pending = ref(false)

vi.mock('../composables/useDrills', () => ({
  useUploadDrillVideo: () => ({
    mutate: uploadMutate,
    progress,
    cancel: vi.fn(),
    isPending: pending,
    isError: ref(false),
    isSuccess: ref(false),
    error: ref(null),
  }),
  useRemoveDrillVideo: () => ({ mutate: vi.fn(), isPending: ref(false), isError: ref(false) }),
}))

const drill = { id: 'd1', team_id: 't1', video_path: null }

function mountUpload() {
  return mount(DrillVideoUpload, { props: { drill }, global: { plugins: [i18n] } })
}

async function choose(wrapper: ReturnType<typeof mountUpload>, file: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

const sized = (bytes: number, type: string) => {
  const file = new File(['x'], 'clip', { type })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

describe('DrillVideoUpload', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'de'
    uploadMutate.mockReset()
    pending.value = false
    progress.value = 0
  })

  it('accepts only mp4, webm and mov in the file picker', () => {
    expect(mountUpload().get('input').attributes('accept')).toBe(
      'video/mp4,video/webm,video/quicktime',
    )
  })

  it('rejects too large files before uploading', async () => {
    const wrapper = mountUpload()
    await choose(wrapper, sized(60 * 1024 * 1024, 'video/mp4'))

    expect(uploadMutate).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('zu groß')
  })

  it('rejects unsupported formats', async () => {
    const wrapper = mountUpload()
    await choose(wrapper, sized(1000, 'video/x-msvideo'))

    expect(uploadMutate).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('nicht unterstützt')
  })

  it('uploads valid videos and shows the progress', async () => {
    const wrapper = mountUpload()
    const file = sized(5 * 1024 * 1024, 'video/mp4')
    await choose(wrapper, file)
    expect(uploadMutate).toHaveBeenCalledWith({ drill, file })

    pending.value = true
    progress.value = 0.42
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('42')
    expect(wrapper.text()).toContain('42 %')
  })
})

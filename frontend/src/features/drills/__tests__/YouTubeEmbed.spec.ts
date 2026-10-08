import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/lib/i18n'
import YouTubeEmbed from '../components/YouTubeEmbed.vue'

function mountEmbed(url: string) {
  return mount(YouTubeEmbed, {
    props: { url, title: 'Rondo' },
    global: { plugins: [i18n] },
  })
}

describe('YouTubeEmbed', () => {
  it('loads nothing from YouTube before the click', () => {
    const wrapper = mountEmbed('https://youtu.be/dQw4w9WgXcQ')

    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('embeds the privacy-enhanced player after the click', async () => {
    const wrapper = mountEmbed('https://youtu.be/dQw4w9WgXcQ')
    await wrapper.get('button').trigger('click')

    const iframe = wrapper.get('iframe')
    expect(iframe.attributes('src')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
    )
    expect(iframe.attributes('title')).toBe('Rondo')
  })

  it('shows a hint for invalid links', () => {
    i18n.global.locale.value = 'de'
    const wrapper = mountEmbed('https://evil.example/video')
    expect(wrapper.text()).toContain('Kein gültiger YouTube-Link')
  })
})

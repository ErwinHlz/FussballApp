<script lang="ts">
// Rondo icon set: 24×24 line icons with a 2px stroke, drawn for this app (no icon dependency).
const paths = {
  home: 'M4 11l8-7 8 7v9h-5v-6h-6v6H4z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  calendarPlus: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 13v5M9.5 15.5h5',
  cone: 'M12 3l6.5 17h-13zM8 13h8M3.5 20.5h17',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.8 2.8 2.6 3 5.2',
  user: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.7-4 3.9-6.5 8-6.5s7.3 2.5 8 6.5',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  maybe: 'M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.1-1.5 2.1V15M12 19h.01',
  x: 'M6 6l12 12M18 6L6 18',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  more: 'M5 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM19 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  moreVertical:
    'M12 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM12 18a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  grip: 'M9 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM15 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM15 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM15 17a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  share: 'M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v7h14v-7',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 5v14M16 5v14',
  filter: 'M3 5h18l-7 8.5V19l-4 2v-7.5z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff:
    'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.7-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  swap: 'M7 7h13M16 3l4 4-4 4M17 17H4M8 21l-4-4 4-4',
  shirt: 'M8 3L3 6l2 4 3-1.5V21h8V8.5l3 1.5 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  building: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  note: 'M4 5h16v11H8l-4 4z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
} as const

export type UiIconName = keyof typeof paths
export const uiIconNames = Object.keys(paths) as UiIconName[]
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    name: UiIconName
    size?: number
    /** Thicker stroke for small icons that must read at a glance (answers). */
    strokeWidth?: number
  }>(),
  { size: 24, strokeWidth: 2 },
)
</script>

<template>
  <svg
    class="ui-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>

<style scoped lang="scss">
.ui-icon {
  flex-shrink: 0;
}
</style>

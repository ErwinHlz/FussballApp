<script lang="ts">
// All icons of the app come from Lucide (lucide.dev, ISC license). The app names its icons by
// meaning ("pin", "maybe", "logout"); this map is the only place that knows the Lucide names,
// so an icon can be swapped here for the whole app.
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Bell,
  Building2,
  Calendar,
  CalendarPlus,
  ChartColumn,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleQuestionMark,
  Clock,
  Copy,
  Ellipsis,
  EllipsisVertical,
  Eye,
  EyeOff,
  Funnel,
  GripVertical,
  House,
  Info,
  Link,
  Lock,
  LogOut,
  MapPin,
  Minus,
  Monitor,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  Shield,
  Shirt,
  Star,
  StickyNote,
  Sun,
  TrafficCone,
  Trash2,
  TriangleAlert,
  Undo2,
  User,
  Users,
  X,
} from 'lucide-vue-next'

const icons = {
  home: House,
  calendar: Calendar,
  calendarPlus: CalendarPlus,
  cone: TrafficCone,
  users: Users,
  user: User,
  bell: Bell,
  plus: Plus,
  minus: Minus,
  check: Check,
  checkAll: CheckCheck,
  maybe: CircleQuestionMark,
  x: X,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  arrowRight: ArrowRight,
  arrowUp: ArrowUp,
  more: Ellipsis,
  moreVertical: EllipsisVertical,
  grip: GripVertical,
  pin: MapPin,
  clock: Clock,
  lock: Lock,
  share: Share2,
  play: Play,
  pause: Pause,
  filter: Funnel,
  eye: Eye,
  eyeOff: EyeOff,
  search: Search,
  edit: Pencil,
  trash: Trash2,
  copy: Copy,
  swap: ArrowLeftRight,
  shirt: Shirt,
  star: Star,
  shield: Shield,
  building: Building2,
  chart: ChartColumn,
  link: Link,
  info: Info,
  alert: TriangleAlert,
  undo: Undo2,
  note: StickyNote,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  logout: LogOut,
  settings: Settings,
} as const

export type UiIconName = keyof typeof icons
export const uiIconNames = Object.keys(icons) as UiIconName[]
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
  <component
    :is="icons[name]"
    class="ui-icon"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
    focusable="false"
  />
</template>

<style scoped lang="scss">
.ui-icon {
  flex-shrink: 0;
}
</style>

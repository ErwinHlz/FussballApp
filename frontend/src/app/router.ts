import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from './layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { resolveAuthRedirect } from '@/features/auth/redirect'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    /** Page only makes sense with an active team; users without a team go to /teams. */
    requiresTeam?: boolean
    /** i18n key of the page title (document title for screen readers and browser tabs). */
    title?: string
    /** Sub-page: the header shows a back button; this route is the fallback target. */
    back?: string
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    meta: { guestOnly: true, title: 'auth.signIn' },
    component: () => import('@/features/auth/views/LoginView.vue'),
  },
  {
    path: '/register',
    name: 'register',
    meta: { guestOnly: true, title: 'auth.createAccount' },
    component: () => import('@/features/auth/views/RegisterView.vue'),
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    meta: { guestOnly: true, title: 'auth.forgotPasswordTitle' },
    component: () => import('@/features/auth/views/ForgotPasswordView.vue'),
  },
  {
    // Opened from the reset email; the link itself signs the user in.
    path: '/reset-password',
    name: 'reset-password',
    meta: { title: 'auth.resetPasswordTitle' },
    component: () => import('@/features/auth/views/ResetPasswordView.vue'),
  },
  {
    // Public: guests see the invite and can register or sign in from here.
    path: '/join/:token',
    name: 'join',
    props: true,
    meta: { title: 'join.title' },
    component: () => import('@/features/teams/views/JoinView.vue'),
  },
  {
    // Public legal pages, reachable signed in and out.
    path: '/privacy',
    name: 'privacy',
    props: { document: 'privacy' },
    meta: { title: 'legal.privacy' },
    component: () => import('@/features/legal/views/LegalView.vue'),
  },
  {
    path: '/imprint',
    name: 'imprint',
    props: { document: 'imprint' },
    meta: { title: 'legal.imprint' },
    component: () => import('@/features/legal/views/LegalView.vue'),
  },
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home',
        meta: { requiresTeam: true, title: 'nav.start' },
        component: () => import('@/features/player-view/views/HomeView.vue'),
      },
      {
        path: 'events',
        name: 'events',
        meta: { requiresTeam: true, title: 'events.title' },
        component: () => import('@/features/events/views/EventsView.vue'),
      },
      {
        // The club's pitch schedule as a week calendar (club of the active team).
        path: 'events/schedule',
        name: 'events-schedule',
        meta: { requiresTeam: true, title: 'schedule.title' },
        component: () => import('@/features/schedule/views/ScheduleView.vue'),
      },
      {
        // "+": choose the type, then the short form (type in ?kind=).
        path: 'events/new',
        name: 'event-create',
        meta: { requiresTeam: true, title: 'events.createLabel', back: 'events' },
        component: () => import('@/features/events/views/EventCreateView.vue'),
      },
      {
        path: 'events/new/:kind(training|series|match|event)',
        name: 'event-new',
        props: true,
        meta: { requiresTeam: true, title: 'events.createLabel', back: 'events' },
        component: () => import('@/features/events/views/EventFormView.vue'),
      },
      {
        path: 'events/:eventId',
        name: 'event',
        props: true,
        meta: { title: 'events.detailTitle', back: 'events' },
        component: () => import('@/features/events/views/EventDetailView.vue'),
      },
      {
        // Plan and groups switch with the event overview via EventCoachNav.
        path: 'events/:eventId/plan',
        name: 'event-plan',
        props: true,
        meta: { title: 'plan.title', back: 'event' },
        component: () => import('@/features/training-plan/views/PlanEditorView.vue'),
      },
      {
        path: 'events/:eventId/groups',
        name: 'event-groups',
        props: true,
        meta: { title: 'groups.title', back: 'event' },
        component: () => import('@/features/groups/views/GroupsView.vue'),
      },
      {
        path: 'events/:eventId/edit',
        name: 'event-edit',
        props: true,
        meta: { title: 'events.form.editTitle', back: 'events' },
        component: () => import('@/features/events/views/EventFormView.vue'),
      },
      {
        path: 'drills',
        name: 'drills',
        meta: { requiresTeam: true, title: 'drills.title' },
        component: () => import('@/features/drills/views/DrillsView.vue'),
      },
      {
        path: 'drills/new',
        name: 'drill-new',
        meta: { requiresTeam: true, title: 'drills.form.newTitle', back: 'drills' },
        component: () => import('@/features/drills/views/DrillFormView.vue'),
      },
      {
        path: 'drills/:drillId',
        name: 'drill',
        props: true,
        meta: { title: 'drills.detailTitle', back: 'drills' },
        component: () => import('@/features/drills/views/DrillDetailView.vue'),
      },
      {
        path: 'drills/:drillId/animation',
        name: 'drill-animation',
        props: true,
        meta: { title: 'board.title' },
        component: () => import('@/features/board/views/BoardEditorView.vue'),
      },
      {
        path: 'drills/:drillId/edit',
        name: 'drill-edit',
        props: true,
        meta: { title: 'drills.form.editTitle', back: 'drills' },
        component: () => import('@/features/drills/views/DrillFormView.vue'),
      },
      {
        path: 'training',
        name: 'training',
        meta: { requiresTeam: true, title: 'training.title' },
        component: () => import('@/features/training-plan/views/TrainingView.vue'),
      },
      {
        path: 'boards',
        name: 'tactic-boards',
        meta: { requiresTeam: true, title: 'boards.title' },
        component: () => import('@/features/board/views/BoardsView.vue'),
      },
      {
        path: 'boards/:boardId',
        name: 'tactic-board',
        props: true,
        meta: { requiresTeam: true, title: 'boards.eyebrow', back: 'tactic-boards' },
        component: () => import('@/features/board/views/TacticBoardView.vue'),
      },
      {
        path: 'templates',
        name: 'templates',
        meta: { requiresTeam: true, title: 'templates.title' },
        component: () => import('@/features/templates/views/TemplatesView.vue'),
      },
      {
        path: 'templates/:templateId',
        name: 'template',
        props: true,
        meta: { requiresTeam: true, title: 'templates.eyebrow', back: 'templates' },
        component: () => import('@/features/templates/views/TemplateView.vue'),
      },
      {
        path: 'squad',
        name: 'squad',
        meta: { requiresTeam: true, title: 'squad.title' },
        component: () => import('@/features/squad/views/SquadView.vue'),
      },
      {
        path: 'stats',
        name: 'stats',
        meta: { requiresTeam: true, title: 'stats.title', back: 'squad' },
        component: () => import('@/features/stats/views/StatsView.vue'),
      },
      {
        path: 'profile',
        name: 'profile',
        meta: { title: 'profile.title' },
        component: () => import('@/features/auth/views/ProfileView.vue'),
      },
      {
        path: 'teams',
        name: 'teams',
        meta: { title: 'teams.title' },
        component: () => import('@/features/teams/views/TeamsView.vue'),
      },
      {
        // Older links: the schedule now lives in the events tab.
        path: 'clubs/:clubId/schedule',
        name: 'club-schedule',
        redirect: { name: 'events-schedule' },
      },
      {
        path: 'clubs/:clubId/schedule/setup',
        name: 'club-schedule-setup',
        props: true,
        meta: { title: 'schedule.setup', back: 'teams' },
        component: () => import('@/features/schedule/views/ScheduleSetupView.vue'),
      },
      {
        path: 'clubs/:clubId',
        name: 'club',
        props: true,
        meta: { title: 'clubs.club', back: 'teams' },
        component: () => import('@/features/teams/views/ClubView.vue'),
      },
    ],
  },
  // Living style guide of the design system, only in development builds.
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/ui',
          name: 'dev-ui',
          meta: { title: 'ui.dev.title' },
          component: () => import('./views/DevUiView.vue'),
        },
      ]
    : []),
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    meta: { title: 'common.notFound' },
    component: () => import('./views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Lists keep their scroll position on back navigation, new pages start at the top.
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  return resolveAuthRedirect(to, auth.isAuthenticated)
})

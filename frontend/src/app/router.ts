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
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    meta: { guestOnly: true },
    component: () => import('@/features/auth/views/LoginView.vue'),
  },
  {
    path: '/register',
    name: 'register',
    meta: { guestOnly: true },
    component: () => import('@/features/auth/views/RegisterView.vue'),
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    meta: { guestOnly: true },
    component: () => import('@/features/auth/views/ForgotPasswordView.vue'),
  },
  {
    // Opened from the reset email; the link itself signs the user in.
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/features/auth/views/ResetPasswordView.vue'),
  },
  {
    // Public: guests see the invite and can register or sign in from here.
    path: '/join/:token',
    name: 'join',
    props: true,
    component: () => import('@/features/teams/views/JoinView.vue'),
  },
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'events' } },
      {
        path: 'events',
        name: 'events',
        meta: { requiresTeam: true },
        component: () => import('@/features/events/views/EventsView.vue'),
      },
      {
        path: 'events/new/:kind(training|series|match)',
        name: 'event-new',
        props: true,
        meta: { requiresTeam: true },
        component: () => import('@/features/events/views/EventFormView.vue'),
      },
      {
        path: 'events/:eventId',
        name: 'event',
        props: true,
        component: () => import('@/features/events/views/EventDetailView.vue'),
      },
      {
        path: 'events/:eventId/edit',
        name: 'event-edit',
        props: true,
        component: () => import('@/features/events/views/EventFormView.vue'),
      },
      {
        path: 'drills',
        name: 'drills',
        meta: { requiresTeam: true },
        component: () => import('@/features/drills/views/DrillsView.vue'),
      },
      {
        path: 'drills/new',
        name: 'drill-new',
        meta: { requiresTeam: true },
        component: () => import('@/features/drills/views/DrillFormView.vue'),
      },
      {
        path: 'drills/:drillId',
        name: 'drill',
        props: true,
        component: () => import('@/features/drills/views/DrillDetailView.vue'),
      },
      {
        path: 'drills/:drillId/edit',
        name: 'drill-edit',
        props: true,
        component: () => import('@/features/drills/views/DrillFormView.vue'),
      },
      {
        path: 'training',
        name: 'training',
        meta: { requiresTeam: true },
        component: () => import('@/features/training-plan/views/TrainingView.vue'),
      },
      {
        path: 'squad',
        name: 'squad',
        meta: { requiresTeam: true },
        component: () => import('@/features/squad/views/SquadView.vue'),
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/features/auth/views/ProfileView.vue'),
      },
      {
        path: 'teams',
        name: 'teams',
        component: () => import('@/features/teams/views/TeamsView.vue'),
      },
      {
        path: 'clubs/:clubId',
        name: 'club',
        props: true,
        component: () => import('@/features/teams/views/ClubView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()
  return resolveAuthRedirect(to, auth.isAuthenticated)
})

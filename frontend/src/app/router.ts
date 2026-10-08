import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from './layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { resolveAuthRedirect } from '@/features/auth/redirect'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
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
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: { name: 'events' } },
      {
        path: 'events',
        name: 'events',
        component: () => import('@/features/events/views/EventsView.vue'),
      },
      {
        path: 'training',
        name: 'training',
        component: () => import('@/features/training-plan/views/TrainingView.vue'),
      },
      {
        path: 'squad',
        name: 'squad',
        component: () => import('@/features/squad/views/SquadView.vue'),
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/features/auth/views/ProfileView.vue'),
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

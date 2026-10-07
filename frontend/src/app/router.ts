import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from './layouts/AppLayout.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
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

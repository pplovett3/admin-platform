import { createRouter, createWebHistory } from 'vue-router'
import { currentUser } from './api'
import Login from './views/Login.vue'
import Shell from './components/Shell.vue'
import Chat from './views/Chat.vue'
import Agents from './views/Agents.vue'
import Knowledge from './views/Knowledge.vue'
import Resources from './views/Resources.vue'
import Security from './views/Security.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login },
    {
      path: '/',
      component: Shell,
      children: [
        { path: '', redirect: '/chat' },
        { path: 'chat', component: Chat },
        { path: 'agents', component: Agents },
        { path: 'knowledge', component: Knowledge },
        { path: 'resources', component: Resources },
        { path: 'security', component: Security }
      ]
    }
  ]
})

router.beforeEach((to) => {
  if (to.path !== '/login' && !currentUser()) return '/login'
  if (to.path === '/login' && currentUser()) return '/chat'
})

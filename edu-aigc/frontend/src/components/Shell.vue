<template>
  <div class="shell">
    <aside class="side">
      <div class="brand">
        <div class="mark">校</div>
        <div>
          <h1>校本智教</h1>
          <p>本地知识 · 脱敏生成</p>
        </div>
      </div>
      <nav class="nav">
        <router-link to="/chat">对话工作台</router-link>
        <router-link to="/agents">智能体</router-link>
        <router-link to="/knowledge">知识库</router-link>
        <router-link to="/resources">生成资源</router-link>
        <router-link to="/security">审计与安全</router-link>
      </nav>
      <div class="who" v-if="user">
        <strong>{{ user.display_name }}</strong>
        <span>{{ roleLabel[user.role] || user.role }} · {{ user.department }}</span>
        <button @click="logout">退出</button>
      </div>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { currentUser, clearSession, roleLabel } from '../api'
import { useRouter } from 'vue-router'

const user = currentUser()
const router = useRouter()
function logout() {
  clearSession()
  router.push('/login')
}
</script>

<template>
  <div class="login-wrap">
    <section class="hero">
      <div class="tag">示范小学 · 本地优先</div>
      <h2>把课标留在校园里，<br />再让模型写教案。</h2>
      <p>上传资料会先在本地脱敏。学生姓名、成绩明细和心理档案不会进入检索，也不会发往公有模型。</p>
    </section>
    <section class="panel">
      <form @submit.prevent="submit">
        <h2>登录</h2>
        <p class="muted">一期演示账号密码均为 Edu123456</p>
        <label class="field"><span>用户名</span><input v-model="username" autocomplete="username" /></label>
        <label class="field"><span>密码</span><input v-model="password" type="password" autocomplete="current-password" /></label>
        <p class="err" v-if="error">{{ error }}</p>
        <button class="btn" :disabled="loading">{{ loading ? '正在登录' : '进入工作台' }}</button>
        <div class="demo">
          <button type="button" v-for="item in demos" :key="item.username" @click="fill(item)">{{ item.label }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, setSession } from '../api'

const router = useRouter()
const username = ref('teacher')
const password = ref('Edu123456')
const error = ref('')
const loading = ref(false)
const demos = [
  { label: '语文教师', username: 'teacher' },
  { label: '数学教师', username: 'math' },
  { label: '语文组长', username: 'lead' },
  { label: '校务管理员', username: 'school' },
  { label: '超级管理员', username: 'admin' }
]
function fill(item) {
  username.value = item.username
  password.value = 'Edu123456'
}
async function submit() {
  error.value = ''
  loading.value = true
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.value, password: password.value })
    })
    setSession(data.token, data.user)
    router.push('/chat')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

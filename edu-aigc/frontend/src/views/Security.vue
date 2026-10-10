<template>
  <div>
    <div class="page-head">
      <div>
        <h2>审计与安全</h2>
        <p>日志只记录行为，不保存对话原文。白名单用于避免课文人物和历史名人被误脱敏。</p>
      </div>
    </div>
    <section class="card pad" style="margin-bottom:16px">
      <h3>学情汇总</h3>
      <p class="muted">这里只有班级汇总，没有学生姓名和个人分数。</p>
      <p v-for="s in stats" :key="s.id">{{ s.summary }}</p>
      <p class="muted" v-if="!stats.length">当前角色看不到汇总指标。</p>
    </section>
    <section class="card pad" style="margin-bottom:16px" v-if="canEdit">
      <h3>教育白名单</h3>
      <form class="row" @submit.prevent="add">
        <input v-model="term" placeholder="新增词语，例如课文角色" />
        <button class="btn">添加</button>
      </form>
      <p class="err" v-if="error">{{ error }}</p>
      <div class="demo">
        <span class="tag" v-for="w in words" :key="w.id">{{ w.term }} <button @click="remove(w)">×</button></span>
      </div>
    </section>
    <section class="card pad" v-else>
      <h3>教育白名单</h3>
      <div class="demo"><span class="tag" v-for="w in words" :key="w.id">{{ w.term }}</span></div>
    </section>
    <section class="card pad">
      <h3>审计日志</h3>
      <table>
        <thead><tr><th>时间</th><th>用户</th><th>操作</th><th>结果</th><th>摘要</th></tr></thead>
        <tbody>
          <tr v-for="a in audits" :key="a.id">
            <td>{{ a.create_time.slice(0, 19).replace('T', ' ') }}</td>
            <td>{{ a.user_name || a.user_id }}</td>
            <td>{{ a.operation_type }}</td>
            <td>{{ a.operation_result }}</td>
            <td>{{ a.operation_detail }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api, currentUser } from '../api'

const user = currentUser()
const canEdit = user && (user.role === 'admin' || user.role === 'school_admin')
const stats = ref([])
const words = ref([])
const audits = ref([])
const term = ref('')
const error = ref('')

async function load() {
  const [s, w, a] = await Promise.all([
    api('/api/learning/stats'),
    api('/api/whitelist'),
    api('/api/audit/log/list')
  ])
  stats.value = s.items || []
  words.value = w.items || []
  audits.value = a.items || []
}
async function add() {
  error.value = ''
  try {
    await api('/api/whitelist', { method: 'POST', body: JSON.stringify({ term: term.value }) })
    term.value = ''
    await load()
  } catch (e) {
    error.value = e.message
  }
}
async function remove(w) {
  await api('/api/whitelist?id=' + encodeURIComponent(w.id), { method: 'DELETE' })
  await load()
}
onMounted(load)
</script>

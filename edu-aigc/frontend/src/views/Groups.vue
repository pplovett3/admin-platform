<template>
  <div>
    <div class="page-head">
      <div>
        <h2>教研组</h2>
        <p>可以按学科、按年级或自定义建组。一位教师可以同时加入多个组，知识库和智能体按组共享，不再只看部门名称。</p>
      </div>
    </div>
    <div class="grid-2">
      <aside class="card">
        <button v-for="g in groups" :key="g.id" class="list-btn" :class="{ active: current && current.id === g.id }" @click="current = g">
          <strong>{{ g.name }}</strong>
          <div class="muted">{{ modeLabel[g.mode] || g.mode }} · {{ memberText(g) }}</div>
        </button>
        <p class="pad muted" v-if="!groups.length">还没有可见的教研组。</p>
      </aside>
      <section>
        <form class="card pad" v-if="canEdit" @submit.prevent="save">
          <h3>{{ form.id ? '编辑教研组' : '新建教研组' }}</h3>
          <label class="field"><span>名称</span><input v-model="form.name" placeholder="例如：校本课程组" /></label>
          <label class="field"><span>组织方式</span>
            <select v-model="form.mode">
              <option value="subject">按学科</option>
              <option value="grade">按年级</option>
              <option value="custom">自定义</option>
            </select>
          </label>
          <label class="field" v-if="form.mode === 'subject'"><span>学科</span><input v-model="form.subject" placeholder="例如：语文" /></label>
          <label class="field" v-if="form.mode === 'grade'"><span>年级</span><input v-model="form.grade_label" placeholder="例如：三年级" /></label>
          <label class="field"><span>说明</span><input v-model="form.description" /></label>
          <p class="err" v-if="error">{{ error }}</p>
          <div class="row">
            <button class="btn">保存</button>
            <button class="btn secondary" type="button" @click="reset">清空</button>
            <button class="btn danger" type="button" v-if="form.id" @click="remove">删除</button>
          </div>
        </form>
        <section class="card pad" :style="canEdit ? 'margin-top:16px' : ''" v-if="current">
          <h3>{{ current.name }}</h3>
          <p class="muted">{{ modeLabel[current.mode] }}<span v-if="current.subject"> · {{ current.subject }}</span><span v-if="current.grade_label"> · {{ current.grade_label }}</span></p>
          <p>{{ current.description || '未填写说明' }}</p>
          <button class="btn secondary" v-if="canEdit" type="button" @click="editCurrent">编辑此组</button>
          <div class="demo">
            <span class="tag" v-for="m in current.members || []" :key="m.id">
              {{ m.display_name }}
              <button v-if="canEdit" @click="drop(m)">×</button>
            </span>
          </div>
          <form class="row" v-if="canEdit" style="margin-top:12px" @submit.prevent="join">
            <select v-model="memberId">
              <option value="">添加成员</option>
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.display_name }}（{{ u.username }}）</option>
            </select>
            <button class="btn">加入</button>
          </form>
        </section>
        <section class="card pad" v-else-if="!canEdit"><p class="muted">选择左侧教研组查看成员。</p></section>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { api, currentUser } from '../api'

const user = currentUser()
const canEdit = user && (user.role === 'admin' || user.role === 'school_admin')
const modeLabel = { subject: '按学科', grade: '按年级', custom: '自定义' }
const groups = ref([])
const users = ref([])
const current = ref(null)
const memberId = ref('')
const error = ref('')
const form = reactive({ id: '', name: '', mode: 'custom', subject: '', grade_label: '', description: '' })

function memberText(g) {
  return ((g.members || []).map((m) => m.display_name).join('、')) || '暂无成员'
}
function reset() {
  Object.assign(form, { id: '', name: '', mode: 'custom', subject: '', grade_label: '', description: '' })
  error.value = ''
}
async function load() {
  const data = await api('/api/groups')
  groups.value = data.items || []
  if (current.value) {
    current.value = groups.value.find((g) => g.id === current.value.id) || null
  }
  if (canEdit) {
    const people = await api('/api/users/list')
    users.value = people.items || []
  }
}
async function save() {
  error.value = ''
  try {
    const saved = await api('/api/groups', { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(form) })
    current.value = saved
    reset()
    await load()
    current.value = groups.value.find((g) => g.id === saved.id) || saved
  } catch (e) {
    error.value = e.message
  }
}
async function remove() {
  if (!form.id || !confirm('删除这个教研组？已共享到该组的资料会失去组成员访问。')) return
  await api('/api/groups?id=' + encodeURIComponent(form.id), { method: 'DELETE' })
  current.value = null
  reset()
  await load()
}
async function join() {
  if (!current.value || !memberId.value) return
  await api('/api/groups/members', { method: 'POST', body: JSON.stringify({ group_id: current.value.id, user_id: memberId.value }) })
  memberId.value = ''
  await load()
}
async function drop(m) {
  await api('/api/groups/members?group_id=' + encodeURIComponent(current.value.id) + '&user_id=' + encodeURIComponent(m.id), { method: 'DELETE' })
  await load()
}
function editCurrent() {
  if (!current.value) return
  Object.assign(form, {
    id: current.value.id,
    name: current.value.name,
    mode: current.value.mode,
    subject: current.value.subject || '',
    grade_label: current.value.grade_label || '',
    description: current.value.description || ''
  })
}
onMounted(async () => {
  await load()
  if (groups.value.length) current.value = groups.value[0]
})
</script>

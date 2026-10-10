<template>
  <div>
    <div class="page-head">
      <div>
        <h2>智能体</h2>
        <p>设定角色、绑定知识库并挂载教学插件。共享范围受角色限制。</p>
      </div>
      <button class="btn" @click="reset">新建</button>
    </div>
    <div class="grid-2">
      <div class="cards">
        <article class="card pad" v-for="a in agents" :key="a.id">
          <div class="row"><strong>{{ a.name }}</strong><span class="tag">{{ shareLabel[a.share_type] }}</span></div>
          <p class="muted">{{ a.description || '未填写说明' }}</p>
          <p class="muted">插件 {{ (a.plugin_ids || []).length }} · 知识库 {{ (a.kb_ids || []).length }}</p>
          <div class="row">
            <button class="btn secondary" @click="edit(a)">编辑</button>
            <button class="btn danger" @click="remove(a)">删除</button>
          </div>
        </article>
      </div>
      <form class="card pad" @submit.prevent="save">
        <h3>{{ form.id ? '编辑智能体' : '新建智能体' }}</h3>
        <label class="field"><span>名称</span><input v-model="form.name" /></label>
        <label class="field"><span>说明</span><input v-model="form.description" /></label>
        <label class="field"><span>系统提示词</span><textarea v-model="form.system_prompt" /></label>
        <label class="field"><span>共享</span>
          <select v-model="form.share_type">
            <option value="private">私有</option>
            <option value="group">教研组</option>
            <option value="public">全校</option>
          </select>
        </label>
        <div class="field"><span>知识库</span>
          <label class="check" v-for="k in kbs" :key="k.id"><input type="checkbox" :value="k.id" v-model="form.kb_ids" />{{ k.name }}</label>
        </div>
        <div class="field"><span>插件</span>
          <label class="check" v-for="p in plugins" :key="p.id"><input type="checkbox" :value="p.id" v-model="form.plugin_ids" />{{ p.name }}</label>
        </div>
        <p class="err" v-if="error">{{ error }}</p>
        <button class="btn">保存</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { api, shareLabel } from '../api'

const agents = ref([])
const kbs = ref([])
const plugins = ref([])
const error = ref('')
const form = reactive({ id: '', name: '', description: '', system_prompt: '', share_type: 'private', kb_ids: [], plugin_ids: [] })

function reset() {
  Object.assign(form, { id: '', name: '', description: '', system_prompt: '', share_type: 'private', kb_ids: [], plugin_ids: [] })
}
function edit(a) {
  Object.assign(form, { ...a, kb_ids: [...(a.kb_ids || [])], plugin_ids: [...(a.plugin_ids || [])] })
}
async function load() {
  const [a, k, p] = await Promise.all([api('/api/agent/list'), api('/api/knowledge/list'), api('/api/plugin/list')])
  agents.value = a.items || []
  kbs.value = k.items || []
  plugins.value = p.items || []
}
async function save() {
  error.value = ''
  try {
    const payload = { ...form, kb_ids: form.kb_ids, plugin_ids: form.plugin_ids }
    if (form.id) await api('/api/agent/update', { method: 'PUT', body: JSON.stringify(payload) })
    else await api('/api/agent/create', { method: 'POST', body: JSON.stringify(payload) })
    reset()
    await load()
  } catch (e) {
    error.value = e.message
  }
}
async function remove(a) {
  if (!confirm('删除智能体「' + a.name + '」？')) return
  await api('/api/agent/delete?id=' + encodeURIComponent(a.id), { method: 'DELETE' })
  await load()
}
onMounted(load)
</script>

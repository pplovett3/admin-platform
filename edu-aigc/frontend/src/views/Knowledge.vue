<template>
  <div>
    <div class="page-head">
      <div>
        <h2>知识库</h2>
        <p>支持 txt、md、csv、docx、xlsx、pdf 和图片。文档先脱敏，再切片入库。全班成绩表会被拦截。图片只有在学校选定且已安装的 OCR 引擎下才会识别，否则只加密归档。</p>
      </div>
    </div>
    <div class="grid-2">
      <aside class="card">
        <form class="pad" @submit.prevent="create">
          <label class="field"><span>新建知识库</span><input v-model="name" placeholder="例如：三年级语文" /></label>
          <label class="field"><span>共享</span>
            <select v-model="share"><option value="private">私有</option><option value="group">教研组</option><option value="public">全校</option></select>
          </label>
          <label class="field" v-if="share === 'group'"><span>共享到</span>
            <select v-model="groupId">
              <option value="">选择教研组</option>
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </label>
          <button class="btn">创建</button>
          <p class="err" v-if="error">{{ error }}</p>
        </form>
        <button v-for="k in kbs" :key="k.id" class="list-btn" :class="{ active: current && current.id === k.id }" @click="open(k)">
          <strong>{{ k.name }}</strong>
          <div class="muted">{{ shareLabel[k.share_type] }} · {{ k.department }}</div>
        </button>
      </aside>
      <section class="card pad" v-if="current">
        <h3>{{ current.name }}</h3>
        <p class="muted">{{ current.description }}</p>
        <div class="row">
          <input type="file" @change="onFile" />
          <button class="btn" :disabled="!file || uploading" @click="upload">{{ uploading ? '处理中' : '上传并入库' }}</button>
        </div>
        <form class="row" style="margin-top:12px" @submit.prevent="search">
          <input v-model="query" placeholder="在当前库中试检索" style="flex:1" />
          <button class="btn secondary">检索</button>
        </form>
        <div v-for="h in hits" :key="h.doc_id + h.snippet" class="cite">{{ h.file_name }}：{{ h.snippet }}</div>
        <table>
          <thead><tr><th>文件</th><th>状态</th><th>脱敏</th><th>说明</th></tr></thead>
          <tbody>
            <tr v-for="d in docs" :key="d.id">
              <td>{{ d.file_name }}</td>
              <td>{{ statusLabel[d.status] || d.status }}</td>
              <td>{{ levelText(d.desensitize_level) }}</td>
              <td class="muted">{{ d.error_message || d.preview }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section class="card pad" v-else><p class="muted">先选择或创建一个知识库。</p></section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api, shareLabel, statusLabel } from '../api'

const kbs = ref([])
const current = ref(null)
const docs = ref([])
const name = ref('')
const share = ref('private')
const groupId = ref('')
const groups = ref([])
const file = ref(null)
const uploading = ref(false)
const error = ref('')
const query = ref('')
const hits = ref([])

function levelText(level) {
  return ['未改写', '一级替换', '二级屏蔽', '三级拦截'][level] || ''
}
async function load() {
  const [data, gs] = await Promise.all([api('/api/knowledge/list'), api('/api/groups')])
  kbs.value = data.items || []
  groups.value = gs.items || []
}
async function open(k) {
  current.value = k
  hits.value = []
  const data = await api('/api/knowledge/document/list?kb_id=' + encodeURIComponent(k.id))
  docs.value = data.items || []
}
async function create() {
  error.value = ''
  try {
    const data = await api('/api/knowledge/create', { method: 'POST', body: JSON.stringify({ name: name.value, share_type: share.value, group_id: share.value === 'group' ? groupId.value : '' }) })
    name.value = ''
    await load()
    await open(data)
  } catch (e) {
    error.value = e.message
  }
}
function onFile(e) { file.value = e.target.files[0] || null }
async function upload() {
  if (!file.value || !current.value) return
  uploading.value = true
  error.value = ''
  try {
    const fd = new FormData()
    fd.append('kb_id', current.value.id)
    fd.append('file', file.value)
    await api('/api/knowledge/upload', { method: 'POST', body: fd })
    file.value = null
    await open(current.value)
  } catch (e) {
    error.value = e.message
  } finally {
    uploading.value = false
  }
}
async function search() {
  const data = await api('/api/knowledge/search', { method: 'POST', body: JSON.stringify({ kb_ids: [current.value.id], query: query.value }) })
  hits.value = data.items || []
}
onMounted(load)
</script>

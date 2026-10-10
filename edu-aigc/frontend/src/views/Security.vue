<template>
  <div>
    <div class="page-head">
      <div>
        <h2>审计与安全</h2>
        <p>日志只记录行为，不保存对话原文。白名单用于避免课文人物和历史名人被误脱敏。</p>
      </div>
    </div>
    <section class="card pad" style="margin-bottom:16px">
      <h3>学校设定</h3>
      <p class="muted">{{ settings.curriculum_label }}</p>
      <p class="muted">当前登录仍是「{{ activeLabel }}」。图片 OCR：{{ ocrText }}。教案{{ settings.lesson_egress ? '会按已配置的兼容接口出校' : '留在校内本地模型，不会出校' }}。</p>
      <form v-if="canEdit" @submit.prevent="saveSettings">
        <label class="field"><span>课标或教材版本</span><input v-model="settings.curriculum_version" placeholder="学校填写，例如校本实验版" /></label>
        <label class="field"><span>文本来源</span><input v-model="settings.curriculum_source" placeholder="例如学校教务处 2026 年印发" /></label>
        <label class="field"><span>补充说明</span><input v-model="settings.curriculum_note" placeholder="可选" /></label>
        <label class="field"><span>图片 OCR</span>
          <select v-model="settings.ocr_engine">
            <option value="auto">自动（优先 PaddleOCR，其次 Tesseract）</option>
            <option value="paddle">只用 PaddleOCR</option>
            <option value="tesseract">只用 Tesseract</option>
            <option value="none">关闭，只加密归档</option>
          </select>
        </label>
        <p class="muted">本机 PaddleOCR {{ settings.ocr_available && settings.ocr_available.paddle ? '已安装' : '未安装' }}，Tesseract {{ settings.ocr_available && settings.ocr_available.tesseract ? '已安装' : '未安装' }}。选中的引擎不在时，图片只加密归档，不会改用另一个引擎。</p>
        <label class="field"><span>登录方式（预留）</span>
          <select v-model="settings.identity_mode">
            <option value="local">本校用户名密码</option>
            <option value="cas">CAS（接口预留）</option>
            <option value="oauth">OAuth（接口预留）</option>
          </select>
        </label>
        <p class="muted">选择 CAS 或 OAuth 只是记下学校意向。插件尚未启用时，登录仍使用本校用户名和密码，避免把管理员锁在外面。</p>
        <label class="field"><span>兼容模型地址</span><input v-model="settings.model_base_url" placeholder="OpenAI 兼容接口，不绑定具体厂商" /></label>
        <label class="field"><span>模型名称</span><input v-model="settings.model_name" placeholder="由学校填写的模型名" /></label>
        <label class="field"><span>模型密钥</span><input v-model="modelKey" type="password" autocomplete="new-password" :placeholder="settings.model_api_key_set ? '已保存，留空则不修改' : '留空则继续使用校内本地模型'" /></label>
        <label class="check"><input type="checkbox" v-model="clearKey" />清除已保存的密钥</label>
        <p class="err" v-if="settingsError">{{ settingsError }}</p>
        <button class="btn">保存学校设定</button>
      </form>
    </section>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { api, currentUser } from '../api'

const user = currentUser()
const canEdit = user && (user.role === 'admin' || user.role === 'school_admin')
const stats = ref([])
const words = ref([])
const audits = ref([])
const term = ref('')
const error = ref('')
const settingsError = ref('')
const modelKey = ref('')
const clearKey = ref(false)
const settings = reactive({
  curriculum_version: '',
  curriculum_source: '',
  curriculum_note: '',
  curriculum_label: '',
  ocr_engine: 'auto',
  ocr_available: { tesseract: false, paddle: false },
  identity_mode: 'local',
  identity_active: 'local',
  identity_providers: [],
  model_base_url: '',
  model_name: '',
  model_api_key_set: false,
  lesson_egress: false
})
const activeLabel = computed(() => {
  const hit = (settings.identity_providers || []).find((p) => p.mode === settings.identity_active)
  return hit ? hit.label : '本校用户名密码'
})
const ocrText = computed(() => {
  const map = { auto: '自动选择', paddle: 'PaddleOCR', tesseract: 'Tesseract', none: '已关闭' }
  return map[settings.ocr_engine] || settings.ocr_engine
})

async function load() {
  const [s, w, a, cfg] = await Promise.all([
    api('/api/learning/stats'),
    api('/api/whitelist'),
    api('/api/audit/log/list'),
    api('/api/settings')
  ])
  stats.value = s.items || []
  words.value = w.items || []
  audits.value = a.items || []
  Object.assign(settings, cfg)
}
async function saveSettings() {
  settingsError.value = ''
  try {
    const saved = await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        ...settings,
        model_api_key: modelKey.value,
        clear_model_key: clearKey.value
      })
    })
    Object.assign(settings, saved)
    modelKey.value = ''
    clearKey.value = false
  } catch (e) {
    settingsError.value = e.message
  }
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

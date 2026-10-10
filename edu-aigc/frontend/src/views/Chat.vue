<template>
  <div>
    <div class="page-head">
      <div>
        <h2>对话工作台</h2>
        <p>选择智能体后连续提问。生成结果会经过本地教育校验，教案类结果可导出带水印的文档。</p>
      </div>
      <div class="row">
        <select v-model="agentId">
          <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <button class="btn" @click="createConv">新对话</button>
      </div>
    </div>
    <div class="grid-2">
      <aside class="card">
        <button v-for="c in conversations" :key="c.id" class="list-btn" :class="{ active: c.id === convId }" @click="openConv(c.id)">
          <strong>{{ c.title }}</strong>
          <div class="muted">{{ c.create_time.slice(0, 16).replace('T', ' ') }}</div>
        </button>
        <p class="pad muted" v-if="!conversations.length">还没有会话。</p>
      </aside>
      <section class="card pad chat">
        <div class="thread">
          <article v-for="m in messages" :key="m.id" class="bubble" :class="m.role">
            <div>{{ m.content }}</div>
            <div v-if="m.role === 'assistant'" class="cite">
              <span class="badge" :class="badge(m).status">{{ badge(m).text }}</span>
              <span v-if="m.model"> · {{ m.model }}</span>
              <div v-if="badge(m).errors">{{ badge(m).errors }}</div>
              <div v-if="cites(m).length">参考：{{ cites(m).map(c => c.file_name).filter(Boolean).join('、') }}</div>
              <button v-if="m.resource_id" class="btn secondary" @click="downloadResource(m.resource_id)">下载文档</button>
            </div>
          </article>
        </div>
        <p class="err" v-if="error">{{ error }}</p>
        <p class="muted" v-if="notice">{{ notice }}</p>
        <form class="composer" @submit.prevent="send">
          <textarea v-model="text" placeholder="例如：请根据知识库写一份三年级语文比喻句教案" />
          <button class="btn" :disabled="sending || !convId">{{ sending ? '生成中' : '发送' }}</button>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api, downloadResource, parseMaybe } from '../api'

const agents = ref([])
const agentId = ref('')
const conversations = ref([])
const convId = ref('')
const messages = ref([])
const text = ref('')
const error = ref('')
const notice = ref('')
const sending = ref(false)

function badge(m) {
  const v = m._validation || parseMaybe(m.validation, null)
  if (!v) return { status: 'pass', text: '本地生成', errors: '' }
  const map = { pass: '校验通过', warn: '需教师复核', fail: '校验未通过' }
  return { status: v.status || 'pass', text: map[v.status] || v.status, errors: (v.error_list || []).join('；') }
}
function cites(m) {
  return m._citations || parseMaybe(m.citations, [])
}

async function loadAgents() {
  const data = await api('/api/agent/list')
  agents.value = data.items || []
  if (!agentId.value && agents.value.length) agentId.value = agents.value[0].id
}
async function loadConversations() {
  const data = await api('/api/chat/conversation/list')
  conversations.value = data.items || []
}
async function openConv(id) {
  convId.value = id
  notice.value = ''
  const data = await api('/api/chat/conversation?id=' + encodeURIComponent(id))
  messages.value = data.messages || []
}
async function createConv() {
  error.value = ''
  if (!agentId.value) return
  const data = await api('/api/chat/conversation', { method: 'POST', body: JSON.stringify({ agent_id: agentId.value }) })
  await loadConversations()
  await openConv(data.id)
}
async function send() {
  if (!text.value.trim() || !convId.value) return
  sending.value = true
  error.value = ''
  notice.value = ''
  const content = text.value
  text.value = ''
  try {
    const reply = await api('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: convId.value, content })
    })
    reply.assistant_message._validation = reply.validation
    reply.assistant_message._citations = reply.citations
    reply.assistant_message.resource_id = reply.resource_id
    messages.value.push(reply.user_message, reply.assistant_message)
    notice.value = reply.notice || ''
    await loadConversations()
  } catch (e) {
    error.value = e.message
    text.value = content
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  await loadAgents()
  await loadConversations()
  if (conversations.value.length) await openConv(conversations.value[0].id)
})
</script>

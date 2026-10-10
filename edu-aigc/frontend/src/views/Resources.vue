<template>
  <div>
    <div class="page-head">
      <div>
        <h2>生成资源</h2>
        <p>教案、课件大纲、练习和学情报告会导出为带显性水印和隐形溯源码的文档。</p>
      </div>
    </div>
    <section class="card">
      <div class="res-row row" v-for="r in items" :key="r.id" style="justify-content: space-between">
        <div>
          <strong>{{ r.title }}</strong>
          <div class="muted">{{ r.kind }} · {{ r.watermark }}</div>
        </div>
        <button class="btn secondary" @click="downloadResource(r.id)">下载</button>
      </div>
      <p class="pad muted" v-if="!items.length">还没有生成资源。去对话工作台写一份教案即可。</p>
      <p class="err pad" v-if="error">{{ error }}</p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api, downloadResource } from '../api'
const items = ref([])
const error = ref('')
onMounted(async () => {
  try {
    const data = await api('/api/resource/list')
    items.value = data.items || []
  } catch (e) {
    error.value = e.message
  }
})
</script>

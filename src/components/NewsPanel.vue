<template>
  <div class="news-panel">
    <div class="np-head">
      <div>
        <h3>免费新闻聚合</h3>
        <p class="np-sub">
          <template v-if="hasKey">数据源：天行数据 topnews</template>
          <template v-else>未配置天行 Key，已降级到公共 RSS</template>
        </p>
      </div>
      <el-button size="small" :loading="loading" @click="load">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <div class="np-controls">
      <el-input
        v-model="keyword"
        placeholder="关键词筛选（标题 / 来源）"
        class="np-search"
        clearable
        @keyup.enter="load"
      >
        <template #prepend><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <div v-if="loading && !news.length" class="np-skeleton"><el-skeleton :rows="6" animated /></div>

    <div v-else-if="news.length" class="np-list">
      <a
        v-for="(n, i) in news"
        :key="n.link + n.title + i"
        :href="n.link"
        target="_blank"
        rel="noopener"
        class="np-item"
      >
        <span class="np-title">{{ n.title }}</span>
        <span class="np-meta">
          <span class="np-src">{{ n.source }}</span>
          <span class="np-date">{{ n.pubDate || '—' }}</span>
        </span>
      </a>
    </div>

    <el-empty v-else description="暂无可获取的新闻（代理可能限流，请稍后刷新）" :image-size="50" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'
import { fetchNews, hasTianapiKey, type NewsItem } from '../services/newsService'

const keyword = ref('')
const news = ref<NewsItem[]>([])
const loading = ref(false)
const hasKey = ref(false)

async function load() {
  loading.value = true
  try {
    news.value = await fetchNews({ keyword: keyword.value.trim(), limit: 30 })
  } catch {
    news.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  hasKey.value = hasTianapiKey()
  load()
})
</script>

<style scoped>
.news-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-card);
  height: 100%;
  box-sizing: border-box;
}
.np-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.np-head h3 { margin: 0; font-size: 15px; color: var(--text-strong); }
.np-sub { margin: 2px 0 0; font-size: 12px; color: var(--text-faint); }

.np-controls { margin-bottom: 12px; }
.np-search { width: 100%; }

.np-list { display: flex; flex-direction: column; gap: 2px; max-height: 420px; overflow-y: auto; }
.np-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px; border-radius: 10px; text-decoration: none; color: var(--text);
  transition: background 0.15s;
}
.np-item:hover { background: var(--nav-hover); }
.np-title {
  font-size: 13px; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.np-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.np-src {
  font-size: 11px; color: var(--text-faint);
  background: var(--surface-soft); padding: 2px 8px; border-radius: 6px;
}
.np-date { font-size: 11px; color: var(--text-faint); font-variant-numeric: tabular-nums; }

@media (max-width: 768px) {
  .news-panel { padding: 14px; }
  .np-title { white-space: normal; -webkit-line-clamp: 2; -webkit-box-orient: vertical; display: -webkit-box; }
}
</style>

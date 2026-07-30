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

    <div v-else-if="news.length" class="np-grid">
      <a
        v-for="(n, i) in news"
        :key="n.link + n.title + i"
        :href="n.link"
        target="_blank"
        rel="noopener"
        class="np-card"
      >
        <div class="np-card-top">
          <span class="np-src">{{ n.source }}</span>
          <el-icon class="np-ext"><TopRight /></el-icon>
        </div>
        <div class="np-title">{{ n.title }}</div>
        <div class="np-date">{{ n.pubDate || '—' }}</div>
      </a>
    </div>

    <el-empty v-else description="暂无可获取的新闻（代理可能限流，请稍后刷新）" :image-size="50" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh, Search, TopRight } from '@element-plus/icons-vue'
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

onMounted(async () => {
  hasKey.value = await hasTianapiKey()
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

.np-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  max-height: 560px;
  overflow-y: auto;
  padding-right: 2px;
}
.np-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 12px;
  text-decoration: none;
  color: var(--text);
  background: var(--surface-soft);
  border: 1px solid var(--border);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.np-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  box-shadow: 0 8px 22px rgba(99, 102, 241, 0.12);
}
.np-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.np-src {
  font-size: 11px; color: var(--primary);
  background: var(--nav-hover); padding: 2px 8px; border-radius: 6px; font-weight: 600;
}
.np-ext { font-size: 14px; color: var(--text-faint); }
.np-title {
  font-size: 14px; line-height: 1.5; font-weight: 600; color: var(--text-strong);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.np-date { font-size: 11px; color: var(--text-faint); font-variant-numeric: tabular-nums; }

@media (max-width: 768px) {
  .news-panel { padding: 14px; }
  .np-grid { grid-template-columns: 1fr; }
}
</style>

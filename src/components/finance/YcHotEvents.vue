<template>
  <div class="he-page">
    <div class="he-head">
      <div>
        <h2>股票热点事件</h2>
        <p class="he-sub">实时聚合财经新闻 · 每条带时间与来源 · 数据来自 Google News RSS（免费）</p>
      </div>
      <div class="he-ctl">
        <el-switch v-model="autoRefresh" active-text="自动刷新" />
        <el-button size="small" :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <div class="he-kws">
      <span
        v-for="k in keywords"
        :key="k"
        :class="['he-kw', active === k ? 'on' : '']"
        @click="switchKw(k)"
        >{{ k }}</span
      >
    </div>

    <div v-if="loading && !items.length" class="he-loading">加载中…</div>
    <div v-else-if="!items.length" class="he-empty">暂无相关热点，请切换关键词或刷新</div>
    <div v-else class="he-list">
      <div v-for="(n, i) in items" :key="n.id" class="he-item">
        <span class="he-dot"></span>
        <div class="he-body">
          <a class="he-title" :href="n.link" target="_blank" rel="noopener">{{ n.title }}</a>
          <div class="he-meta">
            <span class="he-src">{{ n.source }}</span>
            <span class="he-sep">·</span>
            <span class="he-time">{{ n.pubDate }}</span>
            <span class="he-rel" v-if="n.pubTimestamp">{{ relativeTime(n.pubTimestamp) }}</span>
          </div>
          <div class="he-desc" v-if="n.description">{{ n.description }}</div>
        </div>
        <span class="he-idx">{{ i + 1 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { fetchNews, relativeTime, type NewsItem } from '../../services/newsService'

const keywords = ['财经', '股市', '基金', '黄金', '美股', 'A股']
const active = ref('财经')
const items = ref<NewsItem[]>([])
const loading = ref(false)
const autoRefresh = ref(true)
let timer: number | undefined

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await fetchNews({ category: 'business', keyword: active.value, limit: 30 })
  } catch (e) {
    console.error('[热点] 加载失败', e)
  } finally {
    loading.value = false
  }
}
function switchKw(k: string): void {
  if (k === active.value) return
  active.value = k
  void load()
}
function startAuto(): void {
  stopAuto()
  // 热点 1 分钟刷新一次，避免把免费代理拉爆
  timer = window.setInterval(() => void load(), 60_000)
}
function stopAuto(): void {
  if (timer) window.clearInterval(timer)
}

watch(autoRefresh, (v) => (v ? startAuto() : stopAuto()))

onMounted(() => {
  void load()
  if (autoRefresh.value) startAuto()
})
onUnmounted(() => stopAuto())
</script>

<style scoped>
.he-page {
  padding: 24px;
  max-width: 820px;
  margin: 0 auto;
  color: var(--text);
}
.he-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.he-head h2 {
  margin: 0 0 4px;
  font-size: 22px;
  color: var(--text-strong);
}
.he-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.he-ctl {
  display: flex;
  align-items: center;
  gap: 8px;
}
.he-kws {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.he-kw {
  font-size: 13px;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 14px;
  color: var(--text-muted);
  cursor: pointer;
}
.he-kw.on {
  border-color: var(--brand, #378add);
  color: var(--brand, #378add);
  background: var(--surface-soft);
}
.he-loading,
.he-empty {
  padding: 40px;
  text-align: center;
  color: var(--text-faint);
  font-size: 14px;
}
.he-list {
  display: flex;
  flex-direction: column;
}
.he-item {
  display: flex;
  gap: 12px;
  padding: 14px 4px;
  border-bottom: 1px solid var(--border);
}
.he-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  margin-top: 6px;
  flex-shrink: 0;
}
.he-body {
  flex: 1;
  min-width: 0;
}
.he-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-strong);
  text-decoration: none;
  line-height: 1.5;
}
.he-title:hover {
  color: var(--brand, #378add);
}
.he-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-faint);
}
.he-src {
  color: var(--text-muted);
}
.he-rel {
  color: #ba7517;
}
.he-desc {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}
.he-idx {
  font-size: 12px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>

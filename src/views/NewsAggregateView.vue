<template>
  <div class="news-page">
    <!-- 顶栏 -->
    <div class="np-top">
      <div class="np-title-row">
        <h2>新闻聚合</h2>
        <span class="np-date">{{ todayLabel }}</span>
        <div class="np-spacer"></div>
        <el-input
          v-model="keyword"
          placeholder="搜索关键词"
          class="np-search"
          clearable
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button :loading="loading" @click="loadAll">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
        <div class="np-auto">
          <span>自动</span>
          <el-switch v-model="autoRefresh" />
        </div>
      </div>
      <div class="np-update">更新于 {{ lastUpdate || '—' }}</div>
    </div>

    <!-- 分类下拉 -->
    <div class="np-cat-row">
      <span class="np-cat-label">分类</span>
      <el-select v-model="selectedCat" class="np-cat-select" @change="loadAll">
        <el-option
          v-for="c in NEWS_CATEGORIES"
          :key="c.key"
          :label="c.label"
          :value="c.key"
        />
      </el-select>
    </div>

    <!-- 主体两栏 -->
    <div class="np-body">
      <!-- 左：热搜 -->
      <aside class="np-hot">
        <h3 class="np-hot-title">{{ currentCat.label }}热搜 TOP 10</h3>
        <ol v-if="hot.length" class="np-hot-list">
          <li
            v-for="(h, i) in hot"
            :key="h.id"
            class="np-hot-item"
            @click="openDetail(h)"
          >
            <span class="np-rank" :class="'rk' + (i < 3 ? i + 1 : 0)">{{ i + 1 }}</span>
            <div class="np-hot-main">
              <div class="np-hot-name">{{ h.title }}</div>
              <div class="np-hot-meta">{{ h.source }} · {{ relativeTime(h.pubTimestamp) }}</div>
            </div>
          </li>
        </ol>
        <el-empty v-else-if="!loading" description="暂无热搜" :image-size="40" />
      </aside>

      <!-- 右：新闻流 -->
      <section class="np-feed">
        <div v-if="loading && !news.length" class="np-skeleton">
          <el-skeleton :rows="8" animated />
        </div>
        <template v-else>
          <div
            v-for="(n, i) in news"
            :key="n.id + i"
            class="np-item"
            @click="openDetail(n)"
          >
            <div class="np-thumb">
              <img
                v-if="n.thumbnail"
                :src="n.thumbnail"
                :alt="n.title"
                loading="lazy"
                @error="onImgError(i)"
              />
              <span v-else class="np-thumb-ph">{{ firstChar(n.title) }}</span>
            </div>
            <div class="np-item-main">
              <span
                class="np-tag"
                :style="{ color: currentCat.color, background: currentCat.color + '1a' }"
              >{{ currentCat.label }}</span>
              <div class="np-item-title">{{ n.title }}</div>
              <div class="np-item-meta">
                {{ n.source }} · {{ relativeTime(n.pubTimestamp) }} · {{ n.pubDate }}
              </div>
            </div>
            <span class="np-detail-btn">详情 ›</span>
          </div>
          <el-empty
            v-if="!news.length"
            :description="errorMsg || '暂无新闻，请刷新或切换分类'"
            :image-size="50"
          />
        </template>
      </section>
    </div>

    <!-- 详情弹框 -->
    <el-dialog v-model="showDetail" :title="detail?.title || ''" width="480px" append-to-body>
      <div v-if="detail" class="np-dlg-body">
        <div class="np-dlg-meta">
          <span
            class="np-tag"
            :style="{ color: currentCat.color, background: currentCat.color + '1a' }"
          >{{ currentCat.label }}</span>
          <span>{{ detail.source }} · {{ detail.pubDate }} · {{ relativeTime(detail.pubTimestamp) }}</span>
        </div>
        <p class="np-dlg-desc">{{ detail.description || '（暂无摘要，点击阅读全文查看原文）' }}</p>
        <a :href="detail.link" target="_blank" rel="noopener" class="np-dlg-link">
          阅读全文 ↗（打开源站）
        </a>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Search, Refresh } from '@element-plus/icons-vue'
import {
  NEWS_CATEGORIES,
  findCategory,
  fetchNews,
  fetchHot,
  relativeTime,
  formatNow,
  type NewsItem
} from '../services/newsService'

const keyword = ref('')
const selectedCat = ref('top')
const news = ref<NewsItem[]>([])
const hot = ref<NewsItem[]>([])
const loading = ref(false)
const errorMsg = ref('')
const lastUpdate = ref('')
const autoRefresh = ref(true)
const detail = ref<NewsItem | null>(null)

const currentCat = computed(() => findCategory(selectedCat.value))
const showDetail = computed({
  get: () => !!detail.value,
  set: (v) => {
    if (!v) detail.value = null
  }
})

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
const todayLabel = computed(() => {
  const d = new Date()
  const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${wk}`
})
function firstChar(s: string): string {
  return (s || '新').trim().charAt(0)
}

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [n, h] = await Promise.all([
      fetchNews({ category: selectedCat.value, keyword: keyword.value.trim(), limit: 30 }),
      fetchHot(selectedCat.value, 10)
    ])
    news.value = n
    hot.value = h
    lastUpdate.value = formatNow()
    if (!n.length) errorMsg.value = '当前分类暂无数据，可切换其它分类或稍后刷新'
  } catch {
    errorMsg.value = '加载失败，可能是代理限流，请稍后刷新重试'
  } finally {
    loading.value = false
  }
}

function openDetail(item: NewsItem) {
  detail.value = item
}
function onImgError(i: number) {
  if (news.value[i]) news.value[i].thumbnail = ''
}

// 搜索防抖（仅过滤新闻流，不影响热搜）
let kwTimer: number | undefined
watch(keyword, () => {
  clearTimeout(kwTimer)
  kwTimer = window.setTimeout(() => loadAll(), 500)
})

// 自动刷新：仅当前分类 + 热搜，每 5 分钟一次
let timer: number | undefined
watch(autoRefresh, (on) => {
  clearInterval(timer)
  if (on) timer = window.setInterval(loadAll, 5 * 60 * 1000)
})

onMounted(() => {
  loadAll()
  if (autoRefresh.value) timer = window.setInterval(loadAll, 5 * 60 * 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.news-page {
  padding: 20px 24px 32px;
  max-width: 1180px;
  margin: 0 auto;
  color: var(--el-text-color-primary);
  box-sizing: border-box;
}
.np-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.np-title-row h2 {
  margin: 0;
  font-size: 20px;
  color: var(--el-text-color-primary);
}
.np-date {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.np-spacer {
  flex: 1;
}
.np-search {
  width: 200px;
}
.np-auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.np-update {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.np-cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 16px;
}
.np-cat-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.np-cat-select {
  width: 180px;
}

.np-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.np-hot {
  width: 260px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 14px 14px 8px;
  box-sizing: border-box;
}
.np-hot-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-color-danger);
}
.np-hot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.np-hot-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  border-radius: 8px;
  padding: 2px;
  transition: background 0.15s ease;
}
.np-hot-item:hover {
  background: var(--el-fill-color-light);
}
.np-rank {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}
.np-rank.rk1 { background: #ffd54a; color: #7a5b00; }
.np-rank.rk2 { background: #d8dde3; color: #4a5159; }
.np-rank.rk3 { background: #e8b07a; color: #7a4a14; }
.np-hot-main { min-width: 0; }
.np-hot-name {
  font-size: 13px;
  line-height: 1.35;
  color: var(--el-text-color-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.np-hot-meta {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.np-feed {
  flex: 1;
  min-width: 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 6px 16px;
  box-sizing: border-box;
}
.np-skeleton {
  padding: 16px 0;
}
.np-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 4px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  transition: background 0.15s ease;
}
.np-item:last-child {
  border-bottom: none;
}
.np-item:hover {
  background: var(--el-fill-color-light);
}
.np-thumb {
  flex-shrink: 0;
  width: 64px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color);
  display: flex;
  align-items: center;
  justify-content: center;
}
.np-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.np-thumb-ph {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-secondary);
}
.np-item-main {
  flex: 1;
  min-width: 0;
}
.np-tag {
  display: inline-block;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  font-weight: 600;
  margin-bottom: 4px;
}
.np-item-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.45;
  color: var(--el-text-color-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.np-item-meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.np-detail-btn {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-color-primary);
  align-self: center;
}

.np-dlg-body {
  font-size: 13px;
}
.np-dlg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.np-dlg-desc {
  margin: 0 0 18px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
}
.np-dlg-link {
  display: inline-block;
  padding: 9px 18px;
  border-radius: 8px;
  background: var(--el-color-primary);
  color: #fff;
  text-decoration: none;
  font-size: 14px;
}

@media (max-width: 768px) {
  .news-page { padding: 16px; }
  .np-body { flex-direction: column; }
  .np-hot { width: 100%; }
  .np-search { width: 130px; }
}
</style>

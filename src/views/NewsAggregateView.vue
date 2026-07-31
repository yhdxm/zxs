<template>
  <div class="news-page">
    <!-- 顶栏 -->
    <div class="np-top">
      <div class="np-title-row">
        <h2 class="np-title">新闻聚合</h2>
        <span class="np-live"><i class="np-dot"></i>实时</span>
        <span class="np-date">{{ todayLabel }}</span>
        <div class="np-spacer"></div>
        <el-input
          v-model="keyword"
          placeholder="搜索关键词"
          class="np-search"
          clearable
          @keyup.enter="loadAll"
          @clear="loadAll"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button :loading="loading" @click="loadAll">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
        <router-link to="/automation" class="np-fx-btn">
          <el-icon><MagicStick /></el-icon> 沸爻机 ⚡
        </router-link>
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
      <el-select
        v-model="selectedCat"
        class="np-cat-select"
        placeholder="选择行业 / 领域"
        filterable
        @change="loadAll"
      >
        <el-option
          v-for="c in NEWS_CATEGORIES"
          :key="c.key"
          :label="c.label"
          :value="c.key"
        />
      </el-select>
      <span class="np-cat-hint">共 {{ NEWS_CATEGORIES.length }} 个细分领域，可输入检索</span>
    </div>

    <!-- 主体两栏 -->
    <div class="np-body">
      <!-- 左：热搜 TOP10 -->
      <aside class="np-hot">
        <h3 class="np-hot-title">
          <span class="np-fire">🔥</span>{{ currentCat.label }}热搜 TOP 10
          <span class="np-hot-badge">实时</span>
        </h3>
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

      <!-- 右：上半实时脉搏 + 下半信息流 -->
      <section class="np-feed">
        <!-- 实时脉搏：立体时间轴 -->
        <div class="np-pulse">
          <div class="np-pulse-head">
            <span class="np-pulse-title">⏱ 实时脉搏 · 热搜时间轴</span>
            <span class="np-pulse-sub">基于当前分类最热 5 条 · 按时间推进</span>
          </div>

          <div v-if="pulse.length" class="np-timeline">
            <div class="np-timeline-axis">
              <div class="np-timeline-glow"></div>
              <div
                v-for="(p, i) in pulse"
                :key="p.id"
                class="np-timeline-node"
                :style="{ left: `${i * (100 / Math.max(pulse.length - 1, 1))}%` }"
              >
                <div class="np-timeline-dot" :style="{ background: PULSE_RANK[i % PULSE_RANK.length] }"></div>
                <div class="np-timeline-tick">{{ p.pubDate.slice(11, 16) }}</div>
              </div>
            </div>

            <div class="np-pulse-cards">
              <div
                v-for="(p, i) in pulse"
                :key="p.id + i"
                class="np-pulse-card"
                :style="pulseStyle(i)"
                @click="openDetail(p)"
              >
                <div class="np-pulse-card-no">0{{ i + 1 }}</div>
                <div class="np-pulse-card-title">{{ p.title }}</div>
                <div class="np-pulse-card-meta">{{ p.source }} · {{ relativeTime(p.pubTimestamp) }}</div>
                <div class="np-pulse-card-arrow">→</div>
              </div>
            </div>
          </div>

          <el-empty v-else-if="!loading" description="暂无实时脉搏数据" :image-size="50" />
        </div>

        <!-- 信息流（第 11 条起） -->
        <div class="np-feed-head">
          <span class="np-feed-title">📰 {{ currentCat.label }} 更多头条（第 11 条起）</span>
          <span class="np-feed-count">已显示 {{ feed.length }}/{{ tailTotal }} 条</span>
        </div>

        <div v-if="loading && !feed.length" class="np-skeleton">
          <el-skeleton :rows="8" animated />
        </div>
        <template v-else>
          <div
            v-for="(n, i) in feed"
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

          <div v-if="!feed.length && !loading" class="np-empty">
            <el-empty :description="feedEmptyReason" :image-size="50" />
            <div v-if="allCount > 0 && allCount <= 10" class="np-empty-tip">
              当前分类共 {{ allCount }} 条新闻，已全部展示在左侧热搜榜
            </div>
          </div>

          <div v-if="feed.length && hasMore" class="np-more">
            <el-button :loading="loadingMore" plain @click="loadMore">加载更多 ↓</el-button>
          </div>
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
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Search, Refresh, MagicStick } from '@element-plus/icons-vue'
import {
  NEWS_CATEGORIES,
  findCategory,
  fetchNewsAll,
  relativeTime,
  formatNow,
  type NewsItem
} from '../services/newsService'

const selectedCat = ref('top')
const keyword = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const autoRefresh = ref(false)
const lastUpdate = ref('')
const hot = ref<NewsItem[]>([])
const pulse = ref<NewsItem[]>([])
const tail = ref<NewsItem[]>([])
const allCount = ref(0)
const feedCount = ref(12)
const errorMsg = ref('')
let autoTimer: ReturnType<typeof setInterval> | null = null

const currentCat = computed(() => findCategory(selectedCat.value))
const todayLabel = computed(() => {
  const d = new Date()
  const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${wk}`
})

const tailTotal = computed(() => tail.value.length)
const feed = computed(() => tail.value.slice(0, feedCount.value))
const hasMore = computed(() => feedCount.value < tail.value.length)
const feedEmptyReason = computed(() => {
  if (tail.value.length) return ''
  if (allCount.value <= 10) {
    return `当前「${currentCat.value.label}」共找到 ${allCount.value} 条新闻，已为您全部展示在左侧热搜榜。`
  }
  return errorMsg.value || '暂无更多新闻，请切换分类或刷新'
})

function firstChar(t: string): string {
  return (t || '新').trim().charAt(0)
}
function onImgError(i: number) {
  const img = (event?.target as HTMLImageElement) || null
  if (img) img.style.display = 'none'
}

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const all = await fetchNewsAll({ category: selectedCat.value, keyword: keyword.value })
    allCount.value = all.length
    hot.value = all.slice(0, 10)
    pulse.value = all.slice(0, 5)
    tail.value = all.slice(10)
    feedCount.value = 12
    lastUpdate.value = formatNow()
  } catch (e) {
    errorMsg.value = '加载失败，请稍后刷新（代理可能限流）'
    allCount.value = 0
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  feedCount.value += 12
  // 若已展示全部但本地缓存还有更多，则跳过等待
  await new Promise((r) => setTimeout(r, 150))
  loadingMore.value = false
}

function openDetail(n: NewsItem) {
  detail.value = n
  showDetail.value = true
}
const detail = ref<NewsItem | null>(null)
const showDetail = ref(false)

/* ---------- 实时脉搏 时间轴卡片 ---------- */
const PULSE_RANK = ['#f59e0b', '#94a3b8', '#b45309', '#6366f1', '#ec4899']
function pulseStyle(i: number) {
  const colors = [
    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
    'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
    'linear-gradient(135deg, #d946ef 0%, #ec4899 100%)',
    'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)'
  ]
  return {
    background: colors[i % colors.length],
    boxShadow: `0 14px 34px ${['rgba(99,102,241,0.35)', 'rgba(139,92,246,0.35)', 'rgba(168,85,247,0.35)', 'rgba(217,70,239,0.35)', 'rgba(236,72,153,0.35)'][i % 5]}`
  }
}

watch(autoRefresh, (v) => {
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = null
  }
  if (v) {
    autoTimer = setInterval(loadAll, 5 * 60 * 1000)
  }
})

onMounted(loadAll)
onBeforeUnmount(() => {
  if (autoTimer) clearInterval(autoTimer)
})
</script>

<style scoped>
.news-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  height: 100%;
  background: linear-gradient(160deg, #f5f7ff 0%, #faf5ff 100%);
  box-sizing: border-box;
}

/* 顶栏 */
.np-top {
  background: linear-gradient(135deg, #ffffff 0%, #f3f0ff 100%);
  border: 1px solid #e6e0ff;
  border-radius: 16px;
  padding: 14px 18px;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.08);
}
.np-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.np-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.np-live {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #16a34a;
  font-weight: 600;
}
.np-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
  animation: npBlink 1.4s infinite;
}
@keyframes npBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.np-date { font-size: 13px; color: #64748b; }
.np-spacer { flex: 1; }
.np-search { width: 180px; }
.np-fx-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  border-radius: 8px;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #fff !important;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
  transition: transform 0.15s ease;
}
.np-fx-btn:hover { transform: translateY(-1px); }
.np-auto { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; }
.np-update { margin-top: 8px; font-size: 11px; color: #94a3b8; }

/* 分类 */
.np-cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #e6e0ff;
  border-radius: 12px;
  padding: 10px 14px;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.05);
}
.np-cat-label { font-size: 13px; color: #475569; font-weight: 600; }
.np-cat-select { width: 220px; }
.np-cat-hint { font-size: 11px; color: #94a3b8; }

/* 主体 */
.np-body {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 14px;
  flex: 1;
  min-height: 0;
}
.np-hot {
  background: #fff;
  border: 1px solid #e6e0ff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.06);
  overflow-y: auto;
}
.np-hot-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 6px;
}
.np-fire { font-size: 15px; }
.np-hot-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  color: #16a34a;
  background: #dcfce7;
  padding: 2px 8px;
  border-radius: 999px;
}
.np-hot-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.np-hot-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  padding: 6px 6px;
  border-radius: 10px;
  transition: background 0.15s ease;
}
.np-hot-item:hover { background: #f5f3ff; }
.np-rank {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: #e2e8f0;
  color: #64748b;
}
.np-rank.rk1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #fff; }
.np-rank.rk2 { background: linear-gradient(135deg, #cbd5e1, #94a3b8); color: #fff; }
.np-rank.rk3 { background: linear-gradient(135deg, #fdba74, #fb923c); color: #fff; }
.np-hot-main { min-width: 0; }
.np-hot-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: #1e293b;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.np-hot-meta { font-size: 11px; color: #94a3b8; margin-top: 3px; }

/* 右栏 */
.np-feed {
  background: #fff;
  border: 1px solid #e6e0ff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.06);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.np-pulse {
  background: linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%);
  border: 1px solid #ede9fe;
  border-radius: 14px;
  padding: 12px 14px 18px;
  margin-bottom: 14px;
}
.np-pulse-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.np-pulse-title { font-size: 14px; font-weight: 700; color: #1e293b; }
.np-pulse-sub { font-size: 11px; color: #a855f7; }

/* 时间轴 */
.np-timeline { position: relative; }
.np-timeline-axis {
  position: relative;
  height: 28px;
  margin: 0 10px 16px;
}
.np-timeline-glow {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
  box-shadow: 0 0 14px rgba(168, 85, 247, 0.45), inset 0 0 6px rgba(255, 255, 255, 0.4);
}
.np-timeline-node {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.np-timeline-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.2), 0 2px 8px rgba(0, 0, 0, 0.12);
}
.np-timeline-tick {
  font-size: 10px;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}

/* 立体卡片 */
.np-pulse-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.np-pulse-card {
  position: relative;
  border-radius: 14px;
  padding: 14px 12px 32px;
  color: #fff;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.np-pulse-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%);
  border-radius: 14px;
  pointer-events: none;
}
.np-pulse-card:hover {
  transform: translateY(-6px) scale(1.02);
  z-index: 2;
}
.np-pulse-card-no {
  font-size: 22px;
  font-weight: 800;
  opacity: 0.35;
  line-height: 1;
  margin-bottom: 8px;
}
.np-pulse-card-title {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}
.np-pulse-card-meta {
  font-size: 10px;
  opacity: 0.82;
  margin-top: 8px;
}
.np-pulse-card-arrow {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 16px;
  opacity: 0.6;
}

@media (max-width: 1100px) {
  .np-pulse-cards { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 860px) {
  .np-pulse-cards { grid-template-columns: repeat(2, 1fr); }
  .np-timeline-axis { display: none; }
}

.np-feed-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}
.np-feed-title { font-size: 14px; font-weight: 700; color: #475569; }
.np-feed-count { font-size: 11px; color: #94a3b8; }

.np-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 6px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s ease;
}
.np-item:hover { background: #faf9ff; }
.np-thumb {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.np-thumb img { width: 100%; height: 100%; object-fit: cover; }
.np-thumb-ph {
  font-size: 22px;
  font-weight: 700;
  color: #6366f1;
}
.np-item-main { flex: 1; min-width: 0; }
.np-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  margin-bottom: 5px;
}
.np-item-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  color: #1e293b;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.np-item-meta { font-size: 11px; color: #94a3b8; margin-top: 4px; }
.np-detail-btn {
  flex-shrink: 0;
  font-size: 12px;
  color: #6366f1;
  font-weight: 600;
}
.np-empty { padding: 24px 0; }
.np-empty-tip {
  text-align: center;
  font-size: 12px;
  color: #64748b;
  margin-top: -18px;
  padding: 0 16px 10px;
}
.np-more { text-align: center; padding: 14px 0; }

.np-skeleton { padding: 10px; }

.np-dlg-body { display: flex; flex-direction: column; gap: 10px; }
.np-dlg-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; }
.np-dlg-desc { margin: 0; font-size: 13px; line-height: 1.7; color: #334155; }
.np-dlg-link {
  align-self: flex-start;
  font-size: 13px;
  color: #6366f1;
  text-decoration: none;
  font-weight: 600;
}
.np-dlg-link:hover { text-decoration: underline; }

@media (max-width: 860px) {
  .np-body { grid-template-columns: 1fr; }
  .np-hot { max-height: 320px; }
}
</style>

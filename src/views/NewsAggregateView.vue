<template>
  <div class="news-page" :style="{ '--cat': currentCat.color }">
    <PageHeader
      title="新闻聚合"
      subtitle="数据源：Google News 公开 RSS（中文区）｜前端直连免费聚合，不消耗任何额度"
      :icon="Bell"
    >
      <span class="np-live"><i class="np-dot"></i>实时聚合</span>
      <span class="np-beijing">北京时间 {{ beijingTime }}</span>
    </PageHeader>

    <!-- 筛选行：分类 + 搜索关键词 合并 -->
    <div class="np-filter-row">
      <span class="np-fl-label">筛选</span>
      <el-select
        v-model="selectedCat"
        class="np-cat-select"
        placeholder="选择领域"
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
      <span class="np-fl-hint">共 {{ NEWS_CATEGORIES.length }} 个领域 · 当前「{{ currentCat.label }}」{{ allCount }} 条</span>
      <router-link to="/automation" class="np-fx-btn">
        <el-icon><MagicStick /></el-icon> 沸爻机 ⚡
      </router-link>
      <el-button :loading="loading" @click="loadAll">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
      <span class="np-auto"><span>自动</span><el-switch v-model="autoRefresh" /></span>
    </div>

    <!-- 主体两栏 -->
    <div class="np-body">
      <!-- 左：热搜 TOP10 -->
      <aside class="np-hot">
        <h3 class="np-hot-title">
          <span class="np-fire">🔥</span>{{ currentCat.label }} 热搜 TOP 10
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

      <!-- 右：上=实时脉搏动态曲线图，下=所选分类其他新闻 -->
      <section class="np-feed">
        <!-- 实时脉搏：动态曲线图（数据=各领域热搜第一） -->
        <div class="np-pulse">
          <div class="np-pulse-head">
            <span class="np-pulse-title">📈 实时脉搏 · 热搜第一曲线</span>
            <span class="np-pulse-sub">
              已采集 {{ pulseAll.length }} / {{ NEWS_CATEGORIES.length }} 个领域的热搜第一
            </span>
          </div>

          <div class="np-chart">
            <!-- 未加载 / 采集中占位 -->
            <div v-if="pulseAll.length === 0" class="np-chart-empty">
              <div class="np-skeleton-bars">
                <i v-for="n in 9" :key="n" :style="{ animationDelay: (n * 0.1) + 's' }"></i>
              </div>
              <p>{{ loading ? '正在采集各域热搜第一…' : '暂无数据，切换或刷新分类后自动累积' }}</p>
            </div>
            <!-- 动态曲线 -->
            <svg
              v-else
              :viewBox="`0 0 ${PULSE_W} ${PULSE_H}`"
              class="np-chart-svg"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="npFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#7F77DD" stop-opacity="0.30" />
                  <stop offset="100%" stop-color="#7F77DD" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="npStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#8b5cf6" />
                  <stop offset="100%" stop-color="#06b6d4" />
                </linearGradient>
              </defs>
              <line x1="2" y1="30" :x2="PULSE_W - 2" y2="30" class="np-grid" />
              <line x1="2" y1="70" :x2="PULSE_W - 2" y2="70" class="np-grid" />
              <line x1="2" y1="110" :x2="PULSE_W - 2" y2="110" class="np-grid" />
              <path :d="pulseArea" fill="url(#npFill)" />
              <path :d="pulsePath" class="np-line" fill="none" />
              <circle
                v-for="(p, i) in pulseDots"
                :key="i"
                :cx="p.x"
                :cy="p.y"
                r="3"
                class="np-dot"
                :style="{ animationDelay: (i * 0.15) + 's' }"
              />
            </svg>
          </div>
          <div class="np-chart-foot">
            <span class="np-chart-caption">{{ pulseCaption }}</span>
            <span v-if="pulseAll.length > WINDOW" class="np-chart-roll">
              <i class="np-roll-dot"></i>自动轮播
            </span>
          </div>
        </div>

        <!-- 信息流：所选分类的其他新闻（随分类变化） -->
        <div class="np-feed-head">
          <span class="np-feed-title">📰 {{ currentCat.label }} · 其他头条</span>
          <span class="np-feed-count">已显示 {{ feed.length }} / {{ tailTotal }} 条</span>
        </div>

        <div v-if="loading && !feed.length" class="np-skeleton">
          <el-skeleton :rows="8" animated />
        </div>
        <template v-else-if="feed.length">
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

          <div v-if="hasMore" class="np-more">
            <el-button :loading="loadingMore" plain @click="loadMore">加载更多 ↓</el-button>
          </div>
        </template>
        <el-empty
          v-else
          :description="errorMsg || '该分类暂无可展示的其他新闻'"
          :image-size="48"
        />
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
import { Search, Refresh, Bell, MagicStick } from '@element-plus/icons-vue'
import {
  NEWS_CATEGORIES,
  findCategory,
  fetchNewsAll,
  relativeTime,
  type NewsItem
} from '../services/newsService'
import PageHeader from '../components/PageHeader.vue'

const selectedCat = ref('top')
const keyword = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const autoRefresh = ref(false)
const hot = ref<NewsItem[]>([])
const tail = ref<NewsItem[]>([])
const allCount = ref(0)
const feedCount = ref(12)
const errorMsg = ref('')
let autoTimer: ReturnType<typeof setInterval> | null = null

const currentCat = computed(() => findCategory(selectedCat.value))

/* 北京时间时钟 */
const beijingTime = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null
function tickBeijing() {
  const d = new Date()
  const utc = d.getTime() + d.getTimezoneOffset() * 60000
  const bj = new Date(utc + 8 * 3600000)
  const p = (n: number) => String(n).padStart(2, '0')
  beijingTime.value = `${p(bj.getHours())}:${p(bj.getMinutes())}:${p(bj.getSeconds())}`
}

/* ---------- 实时脉搏曲线：75 个领域各自的热搜第一 ---------- */
const WINDOW = 14 // 曲线同屏展示的领域数量，超出则自动轮播
const PULSE_W = 320
const PULSE_H = 150
const PULSE_PAD = 8

const domainFirsts = ref<Record<string, { label: string; value: number }>>({})
const carouselIdx = ref(0)
let rollTimer: ReturnType<typeof setInterval> | null = null

function freshnessValue(ts: number): number {
  const min = (Date.now() - ts) / 60000
  return Math.max(55, Math.min(100, 100 - Math.floor(min / 2)))
}

/** 已采集的各领域热搜第一（按标签排序，保证轮播稳定） */
const pulseAll = computed(() =>
  Object.values(domainFirsts.value).sort((a, b) => a.label.localeCompare(b.label))
)

/** 当前同屏可见的领域（总数 > WINDOW 时循环轮播） */
const pulseVisible = computed(() => {
  const all = pulseAll.value
  if (!all.length) return []
  if (all.length <= WINDOW) return all
  const start = carouselIdx.value % all.length
  const out: { label: string; value: number }[] = []
  for (let i = 0; i < WINDOW; i++) {
    const item = all[(start + i) % all.length]
    if (item) out.push(item)
  }
  return out
})

const pulseDots = computed(() => {
  const pts = pulseVisible.value
  if (!pts.length) return []
  const n = pts.length
  const step = (PULSE_W - 2 * PULSE_PAD) / Math.max(1, n - 1)
  return pts.map((p, i) => ({
    x: PULSE_PAD + step * i,
    y: PULSE_H - (p.value / 100) * (PULSE_H - 14) - 7,
    label: p.label,
    value: p.value
  }))
})

/** Catmull-Rom 转贝塞尔，得到平滑曲线 */
function smoothPath(pts: { x: number; y: number }[]): string {
  const head = pts[0]
  if (!head) return ''
  if (pts.length < 2) return `M${head.x.toFixed(1)},${head.y.toFixed(1)}`
  let d = `M${head.x.toFixed(1)},${head.y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    if (!p1 || !p2) continue
    const p0 = pts[i - 1] ?? p1
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

const pulsePath = computed(() => smoothPath(pulseDots.value))
const pulseArea = computed(() => {
  const dots = pulseDots.value
  if (dots.length < 2) return ''
  const first = dots[0]
  const last = dots[dots.length - 1]
  if (!first || !last) return ''
  return `${pulsePath.value} L${last.x.toFixed(1)},${PULSE_H} L${first.x.toFixed(1)},${PULSE_H} Z`
})

const pulseCaption = computed(() => {
  const total = pulseAll.value.length
  if (!total) return '尚未采集'
  if (total <= WINDOW) return `已展示全部 ${total} 个领域`
  return `共 ${total} 个领域 · 自动轮播展示`
})

const tailTotal = computed(() => tail.value.length)
const feed = computed(() => tail.value.slice(0, feedCount.value))
const hasMore = computed(() => feedCount.value < tail.value.length)

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
    // 累积当前领域热搜第一（用于实时脉搏曲线）
    const firstNews = all[0]
    if (firstNews) {
      domainFirsts.value = {
        ...domainFirsts.value,
        [selectedCat.value]: {
          label: currentCat.value.label,
          value: freshnessValue(firstNews.pubTimestamp)
        }
      }
    }
    tail.value = all.slice(10)
    feedCount.value = 40
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
  feedCount.value += 40
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

/* ---------- 自动刷新 ---------- */
watch(autoRefresh, (v) => {
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = null
  }
  if (v) {
    autoTimer = setInterval(loadAll, 5 * 60 * 1000)
  }
})

onMounted(() => {
  tickBeijing()
  clockTimer = setInterval(tickBeijing, 1000)
  rollTimer = setInterval(() => { carouselIdx.value++ }, 2800)
  loadAll()
})
onBeforeUnmount(() => {
  if (autoTimer) clearInterval(autoTimer)
  if (clockTimer) clearInterval(clockTimer)
  if (rollTimer) clearInterval(rollTimer)
})
</script>

<style scoped>
.news-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 18px 18px;
  height: 100%;
  background: linear-gradient(160deg, #f5f7ff 0%, #faf5ff 100%);
  box-sizing: border-box;
}

/* 顶栏 */
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
.np-auto { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; }
.np-beijing {
  font-size: 12px;
  font-weight: 600;
  color: #0c447c;
  background: #e6f1fb;
  padding: 3px 10px;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}

/* 主体 */
.np-body {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.np-hot {
  background: color-mix(in srgb, var(--cat) 6%, #fff);
  border: 1px solid color-mix(in srgb, var(--cat) 28%, var(--border));
  border-top: 4px solid var(--cat);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--cat) 14%, transparent);
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
.np-hot-item:not(:last-child) {
  border-bottom: 1px solid color-mix(in srgb, var(--cat) 16%, var(--border));
  padding-bottom: 10px;
}
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
  border: 1px solid #c7d2fe;
  border-top: 4px solid #14b8a6;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 8px 24px rgba(20, 184, 166, 0.12);
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

/* 实时脉搏曲线图 */
.np-chart {
  position: relative;
  background: linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%);
  border: 1px solid #ede9fe;
  border-radius: 12px;
  padding: 12px 12px 8px;
}
.np-chart-svg { width: 100%; height: 162px; display: block; }
.np-grid { stroke: #e9e3f7; stroke-width: 1; }
.np-line {
  stroke: url(#npStroke);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.np-dot {
  fill: #7F77DD;
  stroke: #fff;
  stroke-width: 1.5;
  animation: npDotPulse 1.8s ease-in-out infinite;
}
@keyframes npDotPulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
.np-chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 162px;
  color: #a855f7;
  font-size: 12px;
}
.np-skeleton-bars { display: flex; align-items: flex-end; gap: 7px; height: 72px; }
.np-skeleton-bars i {
  width: 16px;
  height: 18px;
  border-radius: 5px;
  background: linear-gradient(180deg, #c4b5fd, #ddd6fe);
  animation: npBar 1.2s ease-in-out infinite alternate;
}
@keyframes npBar { from { height: 14px; opacity: 0.45; } to { height: 60px; opacity: 1; } }
.np-chart-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.np-chart-caption { font-size: 11px; color: #8b5cf6; }
.np-chart-roll {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #0891b2;
  font-weight: 600;
  white-space: nowrap;
}
.np-roll-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #06b6d4;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.18);
  animation: npBlink 1.4s infinite;
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

/* 筛选行（分类 + 搜索合并） */
.np-filter-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 12px 16px;
  box-shadow: var(--shadow-card);
  margin-bottom: 14px;
}
.np-fl-label { font-size: 13px; font-weight: 700; color: var(--text-strong); }
.np-cat-select { width: 220px; }
.np-search { width: 240px; flex: 1; min-width: 180px; }
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
  flex-shrink: 0;
}
.np-fx-btn:hover { transform: translateY(-1px); }
.np-fl-hint { font-size: 11.5px; color: var(--text-faint); white-space: nowrap; flex-shrink: 0; }

.np-hot-title { color: color-mix(in srgb, var(--cat) 72%, #1e293b); }

@media (max-width: 860px) {
  .np-body { grid-template-columns: 1fr; }
  .np-hot { max-height: 320px; }
  .np-fl-hint { margin-left: 0; width: 100%; }
}
</style>

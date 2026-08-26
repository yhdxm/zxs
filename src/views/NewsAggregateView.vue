<template>
  <div class="news-page" :style="{ '--cat': currentCat.color }">
    <PageHeader
      title="新闻聚合"
      subtitle="数据源：Google News 公开 RSS（中文区）｜前端直连免费聚合，不消耗任何额度"
      :icon="Bell"
    >
      <span class="np-live"><i class="np-dot"></i>实时聚合</span>
      <span class="np-beijing">北京时间 {{ beijingTime }}</span>
      <span v-if="updatedAt" class="np-updated">更新于 {{ updatedAt }}</span>
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
        <!-- 实时脉搏：各领域热搜第一（文字轮播卡 + 带标签曲线） -->
        <div class="np-pulse">
          <div class="np-pulse-head">
            <span class="np-pulse-title">📈 实时脉搏 · 各领域热搜第一</span>
            <span class="np-pulse-sub">
              已采集 {{ pulseAll.length }} 个领域<template v-if="pulseAll.length > 1"> · 每 3 秒自动轮播</template>
            </span>
            <span class="np-pulse-ops">
              <button class="np-pop" type="button" title="上一条" @click="stepPulse(-1)">‹</button>
              <button
                class="np-pop"
                type="button"
                :title="rollPaused ? '继续轮播' : '暂停轮播'"
                @click="rollPaused = !rollPaused"
              >{{ rollPaused ? '▶' : '⏸' }}</button>
              <button class="np-pop" type="button" title="下一条" @click="stepPulse(1)">›</button>
            </span>
          </div>

          <!-- 轮播主卡：真实文字信息（领域 / 标题 / 来源 / 时间 / 热度） -->
          <div
            v-if="activePulse"
            class="np-pulse-card"
            :style="{ borderLeftColor: activePulse.color }"
            @click="openPulse(activePulse)"
          >
            <div class="np-pc-head">
              <span class="np-pc-cat" :style="{ background: activePulse.color }">{{ activePulse.label }}</span>
              <span class="np-pc-rank">热搜第一</span>
              <span class="np-pc-heat">热度 {{ activeHeat }}</span>
              <span class="np-pc-idx">{{ activeIdx + 1 }} / {{ pulseAll.length }}</span>
            </div>
            <div class="np-pc-title">{{ activePulse.title }}</div>
            <div class="np-pc-meta">
              <span class="np-pc-src">{{ activePulse.source || '综合来源' }}</span>
              <span>· {{ relativeTime(activePulse.ts) }}</span>
              <span class="np-pc-go">点击查看详情 ›</span>
            </div>
          </div>
          <div v-else class="np-pulse-card np-pc-empty">
            {{ loading ? '正在采集各领域热搜第一…' : '暂无数据，点击上方「刷新」重新采集' }}
          </div>

          <div ref="chartBox" class="np-chart">
            <!-- 未加载 / 采集中占位 -->
            <div v-if="pulseAll.length === 0" class="np-chart-empty">
              <div class="np-skeleton-bars">
                <i v-for="n in 9" :key="n" :style="{ animationDelay: (n * 0.1) + 's' }"></i>
              </div>
              <p>{{ loading ? '正在采集各域热搜第一…' : '暂无数据，切换或刷新分类后自动累积' }}</p>
            </div>
            <!-- 动态曲线（带领域文字标签，点击可切换） -->
            <svg
              v-else
              :viewBox="`0 0 ${chartW} ${PULSE_H}`"
              class="np-chart-svg"
              :style="{ height: PULSE_H + 'px' }"
            >
              <defs>
                <linearGradient id="npFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#7F77DD" stop-opacity="0.40" />
                  <stop offset="100%" stop-color="#7F77DD" stop-opacity="0" />
                </linearGradient>
                <linearGradient id="npStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#8b5cf6" />
                  <stop offset="100%" stop-color="#06b6d4" />
                </linearGradient>
                <!-- 3D 立体波段填充：上亮下暗，营造厚度 -->
                <linearGradient id="npRibbon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.95" />
                  <stop offset="60%" stop-color="#7c3aed" stop-opacity="0.80" />
                  <stop offset="100%" stop-color="#4c1d95" stop-opacity="0.55" />
                </linearGradient>
                <filter id="npGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <line
                v-for="(g, gi) in gridLines"
                :key="'g' + gi"
                x1="2"
                :y1="g"
                :x2="chartW - 2"
                :y2="g"
                class="np-grid"
              />
              <!-- 底部氛围面积（柔和渐变） -->
              <path :d="pulseArea" fill="url(#npFill)" opacity="0.55" />
              <!-- 3D 立体波段：上下折线闭合的带状体 -->
              <path
                :d="bandPath(pulseDots, PULSE_DEPTH)"
                fill="url(#npRibbon)"
                opacity="0.82"
              />
              <!-- 热度竖线：每个领域到折线点的高度，增强波动感 -->
              <line
                v-for="(p, i) in pulseDots"
                :key="'bar-' + p.key + '-' + i"
                class="np-bar"
                :class="{ 'is-active': p.active }"
                :x1="p.x"
                :y1="PLOT_BOTTOM"
                :x2="p.x"
                :y2="p.y + PULSE_DEPTH / 2"
                :stroke="p.active ? p.color : '#a78bfa'"
                stroke-width="2"
                stroke-linecap="round"
                opacity="0.35"
              />
              <!-- 顶部高光线 -->
              <path :d="pulsePath" class="np-line" fill="none" filter="url(#npGlow)" />
              <g
                v-for="(p, i) in pulseDots"
                :key="p.key + '-' + i"
                class="np-pt-g"
                @click="setActive(p.idx)"
              >
                <title>{{ p.label }}：{{ p.title }}</title>
                <circle
                  :cx="p.x"
                  :cy="p.y"
                  :r="p.active ? 5.5 : 3.2"
                  class="np-pt"
                  :class="{ 'is-active': p.active }"
                  :style="{ fill: p.color }"
                />
                <text
                  v-if="p.active"
                  :x="clampX(p.x)"
                  :y="p.y - 9"
                  class="np-pt-val"
                  text-anchor="middle"
                >{{ p.value }}</text>
                <text
                  :x="clampX(p.x)"
                  :y="PULSE_H - 6"
                  class="np-pt-label"
                  :class="{ 'is-active': p.active }"
                  text-anchor="middle"
                >{{ p.label }}</text>
              </g>
            </svg>
          </div>
          <div class="np-chart-foot">
            <span class="np-chart-caption">{{ pulseCaption }}</span>
            <span v-if="pulseAll.length > 1" class="np-chart-roll">
              <i class="np-roll-dot"></i>{{ rollPaused ? '已暂停' : '自动轮播中' }}
            </span>
          </div>
        </div>

        <!-- 信息流：所选分类的其他新闻；不足时展示其他分类相关推荐 -->
        <div class="np-feed-head">
          <span class="np-feed-title">📰 {{ tail.length ? currentCat.label + ' · 其他头条' : '相关推荐（多分类聚合）' }}</span>
          <span class="np-feed-count">已显示 {{ feed.length }} / {{ tailTotal }} 条</span>
        </div>

        <div v-if="loading && !feed.length" class="np-skeleton">
          <el-skeleton :rows="8" animated />
        </div>
        <template v-else-if="feed.length">
          <div
            v-for="(f, i) in feed"
            :key="f.item.id + i"
            class="np-item"
            @click="openDetail(f.item, f.cat)"
          >
            <div class="np-thumb">
              <img
                v-if="f.item.thumbnail"
                :src="f.item.thumbnail"
                :alt="f.item.title"
                loading="lazy"
                @error="onImgError"
              />
              <span v-else class="np-thumb-ph">{{ firstChar(f.item.title) }}</span>
            </div>
            <div class="np-item-main">
              <span
                class="np-tag"
                :style="{ color: f.cat.color, background: f.cat.color + '1a' }"
              >{{ f.cat.label }}</span>
              <div class="np-item-title">{{ f.item.title }}</div>
              <div class="np-item-meta">
                {{ f.item.source }} · {{ relativeTime(f.item.pubTimestamp) }} · {{ f.item.pubDate }}
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
    <el-dialog v-model="showDetail" :title="detail?.title || ''" width="min(92vw, 480px)" append-to-body>
      <div v-if="detail" class="np-dlg-body">
        <div class="np-dlg-meta">
          <span
            class="np-tag"
            :style="{ color: detailCat.color, background: detailCat.color + '1a' }"
          >{{ detailCat.label }}</span>
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
  type NewsItem,
  type NewsCategory
} from '../services/newsService'
import PageHeader from '../components/PageHeader.vue'

const selectedCat = ref('top')
const keyword = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const autoRefresh = ref(true)
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

/* ---------- 实时脉搏：各领域热搜第一（文字轮播 + 曲线） ---------- */
const PULSE_H = 168 // SVG 高度（含底部领域文字标签行）
const PLOT_TOP = 16 // 曲线绘制区上边界（给数值文字留白）
const PLOT_BOTTOM = PULSE_H - 22 // 曲线绘制区下边界（给领域标签留白）
const PULSE_PAD = 20
/** 立体波段厚度（顶部折线向下偏移的像素，用于构成 3D 带状体） */
const PULSE_DEPTH = 14
// 进入页面后自动预加载这些主要分类，保证实时脉搏和右侧推荐都有数据（领域更多，脉搏更丰富）
const PULSE_KEYS = [
  'top', 'nation', 'world', 'business', 'tech', 'ent',
  'sports', 'health', 'science', 'ai', 'internet', 'chip',
  'ev', 'stock', 'fund', 'forex', 'realestate', 'ecommerce',
  'travel', 'game', 'esports', 'car', 'energy', 'space',
  'medical', 'culture'
]

/** 单个领域的脉搏数据（带真实新闻文字信息） */
interface PulseEntry {
  key: string
  label: string
  color: string
  value: number
  title: string
  source: string
  ts: number
  item: NewsItem
}

const domainFirsts = ref<Record<string, PulseEntry>>({})
// 缓存各分类完整新闻列表，用于「当前分类无更多时」展示相关推荐
const categoryData = ref<Record<string, NewsItem[]>>({})
const carouselIdx = ref(0)
const rollPaused = ref(false)
let rollTimer: ReturnType<typeof setInterval> | null = null

/* 实时数值游走：每 2 秒对各领域热度做小幅随机游走，让曲线持续变化（仅展示层，不影响真实数据） */
const pulseLive = ref<Record<string, number>>({})
function liveVal(key: string, base: number): number {
  return Math.max(50, Math.min(100, Math.round(base + (pulseLive.value[key] || 0))))
}
let liveTimer: ReturnType<typeof setInterval> | null = null
function startLiveTick() {
  if (liveTimer) return
  liveTimer = setInterval(() => {
    const out: Record<string, number> = {}
    for (const k of PULSE_KEYS) {
      const prev = pulseLive.value[k] || 0
      const step = Math.round((Math.random() - 0.5) * 6) // -3 ~ +3
      out[k] = Math.max(-22, Math.min(22, prev + step))
    }
    pulseLive.value = out
  }, 2000)
}

/* 最近一次成功更新时间（实时更新提示） */
const updatedAt = ref('')

/* 图表宽度自适应（避免 preserveAspectRatio 拉伸导致文字变形） */
const chartBox = ref<HTMLElement | null>(null)
const chartW = ref(320)
let chartRo: ResizeObserver | null = null

function freshnessValue(ts: number): number {
  const min = (Date.now() - ts) / 60000
  return Math.max(55, Math.min(100, 100 - Math.floor(min / 2)))
}

/** 已采集的各领域热搜第一（按分类定义顺序排序，保证轮播稳定） */
const pulseAll = computed<PulseEntry[]>(() => {
  const order = new Map(NEWS_CATEGORIES.map((c, i) => [c.key, i]))
  return Object.values(domainFirsts.value).sort(
    (a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999)
  )
})

/** 同屏可见领域数量：按容器宽度自适应（每个标签约 58px） */
const windowSize = computed(() => Math.max(3, Math.min(9, Math.floor(chartW.value / 58))))

/** 当前高亮（轮播到）的领域下标 */
const activeIdx = computed(() => {
  const n = pulseAll.value.length
  if (!n) return 0
  return ((carouselIdx.value % n) + n) % n
})
const activePulse = computed<PulseEntry | null>(() => pulseAll.value[activeIdx.value] ?? null)
const activeHeat = computed(() => (activePulse.value ? liveVal(activePulse.value.key, activePulse.value.value) : 0))

/** 当前同屏可见的领域（总数 > windowSize 时循环轮播，高亮点固定在最右） */
const pulseVisible = computed<Array<PulseEntry & { idx: number }>>(() => {
  const all = pulseAll.value
  if (!all.length) return []
  const w = windowSize.value
  if (all.length <= w) return all.map((it, i) => ({ ...it, idx: i }))
  const out: Array<PulseEntry & { idx: number }> = []
  for (let i = w - 1; i >= 0; i--) {
    const idx = ((activeIdx.value - i) % all.length + all.length) % all.length
    const item = all[idx]
    if (item) out.push({ ...item, idx })
  }
  return out
})

const gridLines = computed(() => {
  const span = PLOT_BOTTOM - PLOT_TOP
  return [PLOT_TOP + span * 0.25, PLOT_TOP + span * 0.5, PLOT_TOP + span * 0.75]
})

/** 标签水平位置夹紧，避免首尾文字溢出 SVG */
function clampX(x: number): number {
  return Math.max(22, Math.min(chartW.value - 22, x))
}

const pulseDots = computed(() => {
  const pts = pulseVisible.value
  if (!pts.length) return []
  const n = pts.length
  const usable = Math.max(40, chartW.value - 2 * PULSE_PAD)
  const step = n > 1 ? usable / (n - 1) : 0
  const span = PLOT_BOTTOM - PLOT_TOP
  return pts.map((p, i) => ({
    x: n > 1 ? PULSE_PAD + step * i : chartW.value / 2,
    y: PLOT_BOTTOM - Math.max(0, Math.min(1, (p.value - 50) / 50)) * span,
    key: p.key,
    idx: p.idx,
    label: p.label,
    value: liveVal(p.key, p.value),
    color: p.color,
    title: p.title,
    active: p.idx === activeIdx.value
  }))
})

function setActive(idx: number) {
  const n = pulseAll.value.length
  if (!n) return
  carouselIdx.value = ((idx % n) + n) % n
}
function stepPulse(delta: number) {
  carouselIdx.value += delta
}
function openPulse(p: PulseEntry) {
  openDetail(p.item, findCategory(p.key))
}

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

/** 立体波段：由顶部折线 + 下移 DEPTH 的折线构成一条带状区域（ribbon），营造 3D 厚度 */
function bandPath(pts: { x: number; y: number }[], depth: number): string {
  const top = smoothPath(pts)
  if (!top || pts.length < 2) return ''
  const botPts = [...pts].reverse().map((p) => ({ x: p.x, y: p.y + depth }))
  const bot = smoothPath(botPts) // 起点为最后一个点的底部（即下移后的位置）
  const lastTop = pts[pts.length - 1]!
  const lastBot = { x: lastTop.x, y: lastTop.y + depth }
  const botTail = bot.startsWith('M') ? bot.slice(1) : bot
  return `${top} L${lastBot.x.toFixed(1)},${lastBot.y.toFixed(1)} ${botTail} Z`
}

const pulsePath = computed(() => smoothPath(pulseDots.value))
const pulseArea = computed(() => {
  const dots = pulseDots.value
  if (dots.length < 2) return ''
  const first = dots[0]
  const last = dots[dots.length - 1]
  if (!first || !last) return ''
  return `${pulsePath.value} L${last.x.toFixed(1)},${PLOT_BOTTOM} L${first.x.toFixed(1)},${PLOT_BOTTOM} Z`
})

const pulseCaption = computed(() => {
  const total = pulseAll.value.length
  if (!total) return '尚未采集'
  if (total <= windowSize.value) return `已展示全部 ${total} 个领域 · 数值为新闻新鲜度热度`
  return `共 ${total} 个领域 · 曲线滚动展示最近 ${windowSize.value} 个`
})

/** 推荐数据源总条数（当前分类 tail + 其他分类缓存） */
const relatedTotal = computed(() => {
  let sum = tail.value.length
  for (const [key, list] of Object.entries(categoryData.value)) {
    if (key !== selectedCat.value) sum += list.length
  }
  return sum
})
const tailTotal = computed(() => tail.value.length || relatedTotal.value)

/** 信息流条目：带上「新闻实际所属分类」，用于展示分类标签 */
interface FeedEntry { item: NewsItem; cat: NewsCategory }

const feed = computed<FeedEntry[]>(() => {
  if (tail.value.length) {
    const cat = currentCat.value
    return tail.value.slice(0, feedCount.value).map((item) => ({ item, cat }))
  }
  // 当前分类只有 TOP10，从其他已加载分类取数据作为「相关推荐」（标签用真实所属分类）
  const others: FeedEntry[] = []
  const seen = new Set<string>()
  for (const [key, list] of Object.entries(categoryData.value)) {
    if (key === selectedCat.value) continue
    const cat = findCategory(key)
    for (const it of list) {
      if (seen.has(it.id)) continue
      seen.add(it.id)
      others.push({ item: it, cat })
    }
  }
  others.sort((a, b) => b.item.pubTimestamp - a.item.pubTimestamp)
  return others.slice(0, feedCount.value)
})
const hasMore = computed(() => feedCount.value < tailTotal.value)

function firstChar(t: string): string {
  return (t || '新').trim().charAt(0)
}
function onImgError(e: Event) {
  const img = e.target as HTMLImageElement | null
  if (img) img.style.display = 'none'
}

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  try {
    const all = await fetchNewsAll({ category: selectedCat.value, keyword: keyword.value })
    allCount.value = all.length
    hot.value = all.slice(0, 10)
    // 缓存当前分类完整数据，供相关推荐复用
    categoryData.value[selectedCat.value] = all
    // 累积当前领域热搜第一（用于实时脉搏轮播 + 曲线）
    const firstNews = all[0]
    if (firstNews) {
      domainFirsts.value = {
        ...domainFirsts.value,
        [selectedCat.value]: buildPulseEntry(currentCat.value, firstNews)
      }
    }
    tail.value = all.slice(10)
    feedCount.value = 40
    // 后台静默预加载主要分类，充实实时脉搏与相关推荐
    void preloadPulseDomains()
  } catch (e) {
    errorMsg.value = '加载失败，请稍后刷新（代理可能限流）'
    allCount.value = 0
  } finally {
    loading.value = false
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    updatedAt.value = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }
}

/** 由分类 + 热搜第一条新闻构造脉搏条目（带真实文字信息） */
function buildPulseEntry(cat: NewsCategory, item: NewsItem): PulseEntry {
  return {
    key: cat.key,
    label: cat.label,
    color: cat.color,
    value: freshnessValue(item.pubTimestamp),
    title: item.title,
    source: item.source,
    ts: item.pubTimestamp,
    item
  }
}

/**
 * 后台预加载 PULSE_KEYS 分类，填充实时脉搏与相关推荐池。
 * 采用 3 并发分批，避免一次性打爆免费代理导致全部限流（脉搏反而没数据）。
 */
let preloading = false
async function preloadPulseDomains() {
  if (preloading) return
  preloading = true
  try {
    const jobs = PULSE_KEYS.filter((k) => k !== selectedCat.value && !categoryData.value[k]?.length)
    const CONCURRENCY = 3
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const batch = jobs.slice(i, i + CONCURRENCY)
      await Promise.all(
        batch.map(async (key) => {
          try {
            const all = await fetchNewsAll({ category: key })
            if (!all.length) return
            categoryData.value[key] = all
            const cat = findCategory(key)
            const first = all[0]
            if (first) {
              domainFirsts.value = { ...domainFirsts.value, [key]: buildPulseEntry(cat, first) }
            }
          } catch {
            // 单个分类预加载失败不影响主流程
          }
        })
      )
    }
  } finally {
    preloading = false
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

const detail = ref<NewsItem | null>(null)
const detailCatKey = ref('')
const showDetail = ref(false)
/** 详情弹框展示的分类（默认当前分类，跨分类推荐时用新闻真实分类） */
const detailCat = computed(() => (detailCatKey.value ? findCategory(detailCatKey.value) : currentCat.value))

function openDetail(n: NewsItem, cat?: NewsCategory) {
  detail.value = n
  detailCatKey.value = cat?.key || selectedCat.value
  showDetail.value = true
}

/* ---------- 自动刷新（默认开启，60 秒一次；缓存 3 分钟，命中缓存不打代理） ---------- */
function applyAuto() {
  if (autoTimer) {
    clearInterval(autoTimer)
    autoTimer = null
  }
  if (autoRefresh.value) {
    autoTimer = setInterval(loadAll, 60000)
  }
}
watch(autoRefresh, applyAuto)

onMounted(() => {
  tickBeijing()
  clockTimer = setInterval(tickBeijing, 1000)
  rollTimer = setInterval(() => {
    if (!rollPaused.value && pulseAll.value.length > 1) carouselIdx.value++
  }, 3000)
  // 实时数值游走：曲线持续变化
  startLiveTick()
  // 图表宽度自适应（响应式 + 移动端窄屏不变形）
  if (typeof ResizeObserver !== 'undefined') {
    chartRo = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 60) chartW.value = Math.round(w)
    })
    if (chartBox.value) chartRo.observe(chartBox.value)
  }
  applyAuto()
  loadAll()
})
// 图表容器在「采集到数据后」才渲染，需在挂载后补挂观察
watch(chartBox, (el) => {
  if (el && chartRo) {
    chartRo.disconnect()
    chartRo.observe(el)
    chartW.value = Math.round(el.clientWidth) || chartW.value
  }
})
onBeforeUnmount(() => {
  if (autoTimer) clearInterval(autoTimer)
  if (clockTimer) clearInterval(clockTimer)
  if (rollTimer) clearInterval(rollTimer)
  if (liveTimer) clearInterval(liveTimer)
  if (chartRo) chartRo.disconnect()
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
.np-updated {
  font-size: 12px;
  font-weight: 600;
  color: #7c3aed;
  background: #f3e8ff;
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
.np-pulse-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.np-pulse-title { font-size: 14px; font-weight: 700; color: #1e293b; }
.np-pulse-sub { font-size: 11px; color: #a855f7; }
.np-pulse-ops { margin-left: auto; display: inline-flex; gap: 4px; }
.np-pop {
  width: 24px; height: 24px; line-height: 1;
  border: 1px solid #e9d5ff; background: #fff; color: #7c3aed;
  border-radius: 7px; cursor: pointer; font-size: 12px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.15s ease, transform 0.15s ease;
}
.np-pop:hover { background: #f5f3ff; transform: translateY(-1px); }

/* 实时脉搏轮播主卡（真正展示文字信息） */
.np-pulse-card {
  background: #fff;
  border: 1px solid #ede9fe;
  border-left: 4px solid #8b5cf6;
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  animation: npCardIn 0.45s ease;
}
.np-pulse-card:hover { box-shadow: 0 8px 20px rgba(124, 58, 237, 0.14); transform: translateY(-1px); }
@keyframes npCardIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.np-pc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.np-pc-cat {
  font-size: 11px; font-weight: 700; color: #fff;
  padding: 2px 9px; border-radius: 999px;
}
.np-pc-rank {
  font-size: 10px; font-weight: 700; color: #b45309;
  background: #fef3c7; padding: 2px 7px; border-radius: 999px;
}
.np-pc-heat { font-size: 11px; color: #0891b2; font-weight: 600; font-variant-numeric: tabular-nums; }
.np-pc-idx { margin-left: auto; font-size: 11px; color: #94a3b8; font-variant-numeric: tabular-nums; }
.np-pc-title {
  font-size: 14px; font-weight: 600; line-height: 1.5; color: #1e293b;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.np-pc-meta {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: 11px; color: #94a3b8; margin-top: 5px;
}
.np-pc-src { font-weight: 600; color: #64748b; }
.np-pc-go { margin-left: auto; color: #7c3aed; font-weight: 600; }
.np-pc-empty {
  cursor: default; color: #a855f7; font-size: 12px; text-align: center;
  padding: 18px 14px; border-left-color: #ddd6fe;
}
.np-pc-empty:hover { box-shadow: none; transform: none; }

/* 实时脉搏曲线图 */
.np-chart {
  position: relative;
  background: linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%);
  border: 1px solid #ede9fe;
  border-radius: 12px;
  padding: 12px 12px 8px;
}
.np-chart-svg { width: 100%; display: block; }
.np-grid { stroke: #e9e3f7; stroke-width: 1; }
.np-line {
  stroke: url(#npStroke);
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.np-pt-g { cursor: pointer; }
.np-bar {
  transition: opacity 0.25s ease, stroke 0.25s ease;
  pointer-events: none;
}
.np-bar.is-active { opacity: 0.75; stroke-width: 3; }
.np-pt {
  stroke: #fff;
  stroke-width: 1.5;
  transition: r 0.25s ease;
}
.np-pt.is-active {
  stroke-width: 2.2;
  filter: drop-shadow(0 0 5px rgba(124, 58, 237, 0.55));
  animation: npDotPulse 1.6s ease-in-out infinite;
}
.np-pt-val {
  font-size: 10px;
  font-weight: 700;
  fill: #7c3aed;
}
.np-pt-label {
  font-size: 10px;
  fill: #94a3b8;
}
.np-pt-label.is-active { fill: #7c3aed; font-weight: 700; }
@keyframes npDotPulse {
  0%, 100% { opacity: 0.6; }
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
  /* 移动端改为整页自然滚动，去掉内部固定高度 + 内层滚动，避免底部新闻被固定导航遮挡 */
  .news-page { height: auto; }
  .np-body {
    grid-template-columns: 1fr;
    display: block;
    flex: none;
    min-height: 0;
  }
  .np-hot { max-height: none; }
  .np-feed { overflow-y: visible; }
  .np-fl-hint { margin-left: 0; width: 100%; }
  /* 筛选栏：窄屏下分类与搜索框各占整行，避免固定宽度拥挤/出屏幕 */
  .np-cat-select,
  .np-search {
    width: 100%;
    flex: 1 1 100%;
    min-width: 0;
  }
}
</style>

<!--
  差值台 GAPDESK · 路由壳
  ---------------------------------------------------------------
  结构：单路由 + `?view=`（与 /dashboard?view= 同构）。
  为什么不做 9 条独立路由：9 个视图共享同一份 feed 与同一套筛选器，
  独立路由会让「切视图 = 重新挂载 = 重新拉数据」，跨端同步也会被打断。
  换成 query 后，切视图只是换渲染分支，store 单例里的数据与滚动位置都还在。

  本批（第三批）只交付壳：视图切换 / 状态徽标 / 刷新 / 健康侧栏。
  9 个子视图组件在下一批落地，import 路径已按最终命名写死（见 VIEW_COMPONENTS 注释），
  届时只需取消注释，本文件的模板与路由逻辑不用再改。
-->
<template>
  <section class="gd">
    <PageHeader title="差值" subtitle="信息差情报终端 · 只看近 48 小时" :icon="TrendCharts">
      <template #actions>
        <span class="gd-badge" :class="`gd-badge-${status.tone}`" :title="statusTitle">
          <i class="gd-badge-dot" />
          {{ status.text }}
        </span>
        <!-- 窄屏才显示：aside 被收起时用抽屉看健康面板 -->
        <el-button class="gd-health-btn" size="small" @click="healthDrawer = true">
          信源 {{ health.ok }}/{{ health.total }}
        </el-button>
        <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
      </template>
    </PageHeader>

    <!-- 视图切换：PC 用按钮组，移动端用横向滚动 chips（都渲染，由 CSS 决定显隐） -->
    <div class="gd-switch gd-switch-pc">
      <el-radio-group :model-value="current" size="small" @update:model-value="onSwitch">
        <el-radio-button v-for="v in VIEWS" :key="v.key" :value="v.key">{{ v.label }}</el-radio-button>
      </el-radio-group>
    </div>
    <div class="gd-switch gd-switch-m">
      <button
        v-for="v in VIEWS"
        :key="v.key"
        type="button"
        :class="['gd-chip', current === v.key ? 'gd-chip-on' : '']"
        @click="onSwitch(v.key)"
      >
        {{ v.label }}
      </button>
    </div>

    <!-- 横向 ticker：最高分几条滚动播报，移动端隐藏（壳里控制） -->
    <div class="gd-ticker">
      <GapTicker :items="top14" :max="8" @open="onTickerOpen" />
    </div>

    <!-- 筛选栏：5 个情报流视图共用同一份 filters（单例 store） -->
    <GapFilterBar v-if="activeComp" />

    <div class="gd-body">
      <main class="gd-main">
        <!-- 全局失败态：一条都取不到时才占满主区（部分失败只降级徽标，不打断浏览） -->
        <GapEmptyState
          v-if="!events.length && error && !loading"
          type="error"
          action-text="重试"
          :detail="errorDetail"
          @action="refresh"
        />

        <!-- 离线镜像提示条：数据能看，但必须让用户知道它可能不是最新的 -->
        <div v-else-if="stale && events.length" class="gd-strip">
          <el-icon><Clock /></el-icon>
          <span>当前展示离线镜像（{{ Math.round(staleAgeMs / 60000) }} 分钟前），云端恢复后会自动刷新</span>
          <el-button size="small" text @click="refresh">立即重试</el-button>
        </div>

        <!-- 子视图挂载点：5 个情报流视图已接入，其余走占位态 -->
        <component :is="activeComp" v-if="activeComp" @open="onOpen" />

        <!-- 占位态：明确告诉用户「这个视图还没接」，不拿假数据充数 -->
        <GapEmptyState
          v-else
          type="empty"
          :title="`「${currentMeta.label}」将在下一批接入`"
          :desc="currentMeta.desc"
          :detail="[`待接入组件：${currentMeta.component}`, `当前视图键：view=${current}`]"
        />
      </main>

      <aside class="gd-aside">
        <div class="gd-card">
          <div class="gd-card-head">
            <span class="gd-card-title">信源健康</span>
            <span class="gd-card-num" :class="{ 'gd-card-num-bad': health.total > 0 && health.ok < health.total }">
              {{ health.ok }}/{{ health.total }}
            </span>
          </div>
          <!-- 面板本体：分组折叠 + 失败原因原样摊开 + 本轮漏斗 -->
          <GapSourceHealth :sources="sources" :meta="meta" />
          <p v-if="meta?.generated_at" class="gd-card-foot">
            采集于 {{ fmtClock(Date.parse(meta.generated_at)) }}
          </p>
        </div>
      </aside>
    </div>

    <!-- 窄屏（≤1080px）健康面板改由抽屉承载：aside 被收起，但信息不能丢 -->
    <el-drawer v-model="healthDrawer" title="信源健康" direction="rtl" size="86%" class="gd-health-drawer">
      <GapSourceHealth drawer :sources="sources" :meta="meta" />
    </el-drawer>

    <!-- 详情抽屉：由壳统一持有开关状态，各视图只 emit('open', id) -->
    <GapDetailDrawer v-model="drawerOpen" :event="activeEvent" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TrendCharts, Clock } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import GapEmptyState from '../components/gapdesk/GapEmptyState.vue'
import GapSourceHealth from '../components/gapdesk/GapSourceHealth.vue'
import GapTicker from '../components/gapdesk/GapTicker.vue'
import GapFilterBar from '../components/gapdesk/GapFilterBar.vue'
import GapDetailDrawer from '../components/gapdesk/GapDetailDrawer.vue'
import { useGapDesk, useGapDeskRealtime } from '../composables/useGapDesk'
import { fmtClock, fmtAgo } from '../utils/gapdeskFormat'

/* ============================================================
   一、9 个视图的注册表（顺序即展示顺序）
   ============================================================ */
type GapViewKey =
  | 'today'
  | 'radar'
  | 'matrix'
  | 'lag'
  | 'underground'
  | 'alert'
  | 'report'
  | 'seats'
  | 'pricing'

interface GapViewMeta {
  key: GapViewKey
  label: string
  desc: string
  /** 下一批要落地的组件路径（写死，避免下一批改壳） */
  component: string
}

/** 默认视图（同时也是回落视图：非法 query 一律走这里，页面绝不空白） */
const FALLBACK_VIEW: GapViewMeta = {
  key: 'today',
  label: '今日',
  desc: '按差值分排序的今日 Top14，卡片刻度即判断依据',
  component: 'src/views/gapdesk/GapTodayView.vue'
}

const VIEWS: readonly GapViewMeta[] = [
  FALLBACK_VIEW,
  { key: 'radar', label: '雷达', desc: '8 行业 × 双轨热度的行业分布雷达', component: 'src/views/gapdesk/GapRadarView.vue' },
  { key: 'matrix', label: '矩阵', desc: '行业 × 维度矩阵：哪个格子最热、哪些格子是空的', component: 'src/views/gapdesk/GapMatrixView.vue' },
  { key: 'lag', label: '时差', desc: '同一条事件从决策圈到大众榜的真实时间差', component: 'src/views/gapdesk/GapLagView.vue' },
  { key: 'underground', label: '暗流', desc: '单源、未出圈 —— 最值钱的那一批', component: 'src/views/gapdesk/GapUndergroundView.vue' },
  { key: 'alert', label: '预警', desc: '自定义规则：命中即提醒，规则存 gap_rules', component: 'src/views/gapdesk/GapAlertView.vue' },
  { key: 'report', label: '简报', desc: '把当日差值导成可转发的行业简报', component: 'src/views/gapdesk/GapReportView.vue' },
  { key: 'seats', label: '席位', desc: '套餐、席位与用量（gap_seats）', component: 'src/views/gapdesk/GapSeatsView.vue' },
  { key: 'pricing', label: '定价', desc: '四档套餐与功能对照', component: 'src/views/gapdesk/GapPricingView.vue' }
]

/**
 * 视图键 → 组件。
 * 情报流 5 个视图已落地；alert / report / seats / pricing 仍留占位（显示待接入提示）。
 */
import GapTodayView from './gapdesk/GapTodayView.vue'
import GapRadarView from './gapdesk/GapRadarView.vue'
import GapMatrixView from './gapdesk/GapMatrixView.vue'
import GapLagView from './gapdesk/GapLagView.vue'
import GapUndergroundView from './gapdesk/GapUndergroundView.vue'
import GapAlertView from './gapdesk/GapAlertView.vue'
import GapReportView from './gapdesk/GapReportView.vue'
import GapSeatsView from './gapdesk/GapSeatsView.vue'
import GapPricingView from './gapdesk/GapPricingView.vue'

const VIEW_COMPONENTS: Partial<Record<GapViewKey, Component>> = {
  today: GapTodayView,
  radar: GapRadarView,
  matrix: GapMatrixView,
  lag: GapLagView,
  underground: GapUndergroundView,
  alert: GapAlertView,
  report: GapReportView,
  seats: GapSeatsView,
  pricing: GapPricingView
}

/* ============================================================
   二、路由同步（?view=）
   ============================================================ */
const route = useRoute()
const router = useRouter()

const isViewKey = (v: unknown): v is GapViewKey => VIEWS.some((item) => item.key === v)

/** 当前视图：非法值一律回落 today（旧链接、手改 query 都不能让页面空白） */
const current = computed<GapViewKey>(() => {
  const raw = Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  return isViewKey(raw) ? raw : 'today'
})

const currentMeta = computed<GapViewMeta>(
  () => VIEWS.find((v) => v.key === current.value) ?? FALLBACK_VIEW
)

const activeComp = computed<Component | null>(() => VIEW_COMPONENTS[current.value] ?? null)

/** 切视图：replace 不写历史，避免用户点 9 下后「后退」要退 9 次 */
function onSwitch(key: string | number | boolean | undefined): void {
  const next = String(key ?? '')
  if (!isViewKey(next) || next === current.value) return
  void router.replace({ query: { ...route.query, view: next } })
}

/* ============================================================
   三、数据
   ============================================================ */
const { events, sources, top14, meta, loading, error, stale, staleAgeMs, lastLoadedAt, health, load } =
  useGapDesk()

/* ---------- 窄屏健康面板抽屉 ---------- */
const healthDrawer = ref(false)

/** ticker 抛的是事件对象（它不关心 id 从哪来），壳统一收敛成打开抽屉 */
function onTickerOpen(e: { id: number }): void {
  onOpen(e.id)
}

/* ---------- 详情抽屉（壳持有状态，视图只发事件） ---------- */
const drawerOpen = ref(false)
const activeId = ref<number | null>(null)

/** 从单例 events 里按 id 取当前事件：刷新后对象会被替换，用 id 查比存对象更稳 */
const activeEvent = computed(() => {
  if (activeId.value == null) return null
  return events.value.find((e) => e.id === activeId.value) ?? null
})

function onOpen(eventId: number): void {
  activeId.value = eventId
  drawerOpen.value = true
}

/** 失败态明细：把请求错误 + 每个 DOWN 源的 last_msg 一起摊开，便于直接定位是源挂了还是库挂了 */
const errorDetail = computed<string[]>(() => {
  const lines: string[] = []
  if (error.value) lines.push(`请求错误：${error.value}`)
  for (const s of health.value.down.slice(0, 6)) lines.push(`${s.name}：${s.msg || s.status || '未知'}`)
  return lines
})

// ⚠️ 必须在 setup 同步阶段调用：useCloudSync 内部会注册 onMounted / onBeforeUnmount，
// 若放进 onMounted 回调里调用，Vue 会因为「没有活跃组件实例」而告警且订阅不生效。
useGapDeskRealtime()

onMounted(() => {
  // Realtime / 切回前台 / 联网恢复由 useCloudSync 统一驱动；首次加载在这里发起
  void load()
})

function refresh(): void {
  void load(true)
}

/** 采集时间距今多少分钟（meta 缺失返回 -1） */
const generatedAgoMin = computed(() => {
  const iso = meta.value?.generated_at
  if (!iso) return -1
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return -1
  return Math.max(0, Math.round((Date.now() - ts) / 60000))
})

/**
 * 顶栏状态徽标。
 * 三态必须区分清楚，不能一律写 LIVE：
 *   live  —— 采集在 40 分钟内（= 最多漏一轮）
 *   lag   —— 采集偏旧，如实报「延迟 N 分钟」
 *   off   —— 云端不可达，当前是本地镜像
 */
const status = computed<{ text: string; tone: 'live' | 'lag' | 'off' | 'load' }>(() => {
  if (stale.value) {
    const mins = Math.round(staleAgeMs.value / 60000)
    return { text: mins > 0 ? `离线镜像 ${mins} 分钟前` : '离线镜像', tone: 'off' }
  }
  if (loading.value && lastLoadedAt.value === 0) return { text: '加载中', tone: 'load' }
  const mins = generatedAgoMin.value
  if (mins < 0) return { text: '待采集', tone: 'off' }
  if (mins <= 40) return { text: 'LIVE', tone: 'live' }
  return { text: `延迟 ${mins} 分钟`, tone: 'lag' }
})

const statusTitle = computed(() => {
  if (error.value) return `最近一次错误：${error.value}`
  if (lastLoadedAt.value) return `本地加载于 ${fmtAgo(lastLoadedAt.value)}`
  return '尚未加载'
})
</script>

<style scoped>
.gd {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* ---------- 状态徽标 ---------- */
.gd-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  border: 1px solid transparent;
  white-space: nowrap;
}
.gd-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.gd-badge-live {
  color: #0ba36f;
  background: rgba(11, 163, 111, 0.1);
  border-color: rgba(11, 163, 111, 0.25);
}
.gd-badge-lag {
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.3);
}
.gd-badge-off {
  color: #909399;
  background: rgba(144, 147, 153, 0.12);
  border-color: rgba(144, 147, 153, 0.25);
}
.gd-badge-load {
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.25);
}

/* ---------- 视图切换 ---------- */
.gd-switch {
  min-width: 0;
}

/* 信源健康按钮：只在 aside 收起（≤1080px）时出现 */
.gd-health-btn {
  display: none;
}

/* ticker：移动端隐藏（一行滚动条在窄屏只会挤掉内容） */
.gd-ticker {
  min-width: 0;
}

/* ---------- 离线镜像提示条 ---------- */
.gd-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.1);
  font-size: 12px;
  color: #b45309;
}
.gd-strip span {
  flex: 1;
  min-width: 0;
}
.gd-switch-m {
  display: none;
}
.gd-chip {
  flex: none;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--surface, #fff);
  color: var(--text-muted, #606266);
  font-size: 13px;
  cursor: pointer;
}
.gd-chip-on {
  color: #fff;
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

/* ---------- 主体：主区 + 侧栏 ---------- */
.gd-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 268px;
  gap: 12px;
  align-items: start;
  min-width: 0;
}
.gd-main {
  min-width: 0;
}
.gd-aside {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.gd-card {
  padding: 12px 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}
.gd-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.gd-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.gd-card-num {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #0ba36f;
}
.gd-card-num-bad {
  color: #ff3358;
}
.gd-card-tip {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted, #909399);
}
.gd-card-tip-ok {
  color: #0ba36f;
}
.gd-down {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.gd-down li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}
.gd-down-name {
  color: var(--text-strong, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gd-down-msg {
  flex: none;
  color: #ff3358;
  font-variant-numeric: tabular-nums;
}
.gd-card-foot {
  margin: 8px 0 0;
  font-size: 10px;
  color: var(--text-muted, #909399);
}
.gd-funnel {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gd-funnel li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted, #909399);
}
.gd-funnel b {
  color: var(--text-strong, #303133);
  font-variant-numeric: tabular-nums;
}

/* ---------- 移动端：单列、chips 横滚、侧栏隐藏 ---------- */
/* ≤1080px：aside 收起 → 健康面板改由 PageHeader 按钮 + 抽屉承载 */
@media (max-width: 1080px) {
  .gd-health-btn {
    display: inline-flex;
  }
  .gd-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .gd-aside {
    display: none;
  }
}

@media (max-width: 768px) {
  .gd-switch-pc {
    display: none;
  }
  .gd-ticker {
    display: none;
  }
  .gd-switch-m {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .gd-switch-m::-webkit-scrollbar {
    display: none;
  }
  .gd-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .gd-aside {
    display: none;
  }
}
</style>

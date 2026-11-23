<!--
  差值台 GAPDESK · Stage 宿主
  ---------------------------------------------------------------
  单路由 /gapdesk?view=<screen>&dev=<pc|mb|auto>，路由文件不动。
  ?view= 切屏只换渲染分支，store 单例不被重新挂载；dev=auto 由
  matchMedia('(max-width:768px), (hover:none) and (pointer:coarse)') 判定。

  PC 中栏与手机中栏共用同一份 store 与注册表，日期带 / 筛选器由宿主统一提供。
  外壳内不使用任何 UI 库组件，全部原生 div / button / span + class。
-->
<template>
  <div class="gd-stage" :class="{ 'gd-stage-mb': effectiveDev === 'mb' }">
    <!-- ============ PC：顶栏 + 三栏工作区 ============ -->
    <template v-if="effectiveDev === 'pc'">
      <GapTopbar
        :title="currentMeta.label"
        :live="isLive"
        @switch-dev="onSwitchDev('mb')"
        @exit="onExit"
      />
      <div class="gd-workspace">
        <GapSidebar :active="current" @navigate="onNavigate" />

        <main class="gd-main">
          <GapDateStrip
            :bands="dateBands"
            :active="filters.dateBand || 'today'"
            @pick="filters.dateBand = filters.dateBand === $event ? '' : $event"
          />
          <GapFilterBar />
          <component :is="activeComp" v-bind="activeProps" />
        </main>

        <GapRightCol @navigate="onNavigate" />
      </div>
    </template>

    <!-- ============ 手机壳：真机 ≤768px 由 matchMedia 强制进入 ============ -->
    <GapMobileShell
      v-else
      :title="currentMeta.label"
      :tab="mobileTab"
      :live="isLive"
      :l0-count="tierCounts.L0"
      @tab="onMobileTab"
      @switch-dev="onSwitchDev('pc')"
      @exit="onExit"
    >
      <div class="gd-vcol">
        <component :is="activeComp" v-bind="activeProps" @navigate="onNavigate" />
      </div>
    </GapMobileShell>

    <!-- 详情抽屉由宿主统一持有，内部 Teleport 到 body；视图通过 GAP_OPEN_DETAIL_KEY 打开 -->
    <GapDetailDrawer v-model="drawerOpen" :event="activeEvent" @navigate="openDetail" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GapTopbar from '../components/gapdesk/GapTopbar.vue'
import GapSidebar from '../components/gapdesk/GapSidebar.vue'
import GapRightCol from '../components/gapdesk/GapRightCol.vue'
import GapMobileShell from '../components/gapdesk/GapMobileShell.vue'
import GapDetailDrawer from '../components/gapdesk/GapDetailDrawer.vue'
import GapDateStrip from '../components/gapdesk/GapDateStrip.vue'
import GapFilterBar from '../components/gapdesk/GapFilterBar.vue'
import PcLatestView from './gapdesk/pc/PcLatestView.vue'
import PcProfileView from './gapdesk/pc/PcProfileView.vue'
import PcTimelineView from './gapdesk/pc/PcTimelineView.vue'
import PcMatrixView from './gapdesk/pc/PcMatrixView.vue'
import PcSpreadView from './gapdesk/pc/PcSpreadView.vue'
import PcScoreView from './gapdesk/pc/PcScoreView.vue'
import PcSourceView from './gapdesk/pc/PcSourceView.vue'
import PcBizViews from './gapdesk/pc/PcBizViews.vue'
import PcArchiveView from './gapdesk/pc/PcArchiveView.vue'
import PcBriefView from './gapdesk/pc/PcBriefView.vue'
import PcSourceRiskView from './gapdesk/pc/PcSourceRiskView.vue'
import PcEchoView from './gapdesk/pc/PcEchoView.vue'
import PcCycleView from './gapdesk/pc/PcCycleView.vue'
import PcAIView from './gapdesk/pc/PcAIView.vue'
import MbLatestView from './gapdesk/mb/MbLatestView.vue'
import MbProfileView from './gapdesk/mb/MbProfileView.vue'
import MbMatrixView from './gapdesk/mb/MbMatrixView.vue'
import MbSourceView from './gapdesk/mb/MbSourceView.vue'
import MbPricingView from './gapdesk/mb/MbPricingView.vue'
import MbDetailView from './gapdesk/mb/MbDetailView.vue'
import MbFilterView from './gapdesk/mb/MbFilterView.vue'
import MbBriefView from './gapdesk/mb/MbBriefView.vue'
import MbEchoView from './gapdesk/mb/MbEchoView.vue'
import MbSourceRiskView from './gapdesk/mb/MbSourceRiskView.vue'
import MbCycleView from './gapdesk/mb/MbCycleView.vue'
import MbAIView from './gapdesk/mb/MbAIView.vue'
import { GAP_OPEN_DETAIL_KEY, useGapDesk, useGapDeskRealtime } from '../composables/useGapDesk'
import '../styles/gapdesk/index.css'

/* ============================================================
   一、视图注册表（17 个 PC 入口全部落到真视图，无占位屏）
   ============================================================ */
type DeviceParam = 'pc' | 'mb' | 'auto'

interface GapViewMeta {
  key: string
  label: string
  desc: string
  scope: 'pc' | 'mb'
  /** detail / filter 是二级视图，不出现在主导航里 */
  secondary?: boolean
  component: Component
}

const FALLBACK_VIEW = 'latest'

/** 18 个 PC key（17 个侧栏入口 + 二级 detail），全部落到真视图 */
const VIEWS: readonly GapViewMeta[] = [
  { key: 'latest', label: '最新信息', desc: '按差值分排序的情报流', scope: 'pc', component: PcLatestView },
  { key: 'profile', label: '行业档案', desc: '行业分布与档案卡', scope: 'pc', component: PcProfileView },
  { key: 'timeline', label: '时间线', desc: '按发布日归组的时间线', scope: 'pc', component: PcTimelineView },
  { key: 'matrix', label: '全景矩阵', desc: '行业 × 维度全景矩阵', scope: 'pc', component: PcMatrixView },
  { key: 'spread', label: '传播路径', desc: '单条差值的跨源传播路径', scope: 'pc', component: PcSpreadView },
  { key: 'score', label: '评分模式', desc: '四维权重与 GAP 分口径说明', scope: 'pc', component: PcScoreView },
  { key: 'source', label: '单源情报', desc: '逐源查看未出圈条目', scope: 'pc', component: PcSourceView },
  { key: 'alert', label: '订阅提醒', desc: '规则命中即提醒', scope: 'pc', component: PcBizViews },
  { key: 'report', label: '导出报告', desc: '当日差值简报导出', scope: 'pc', component: PcBizViews },
  { key: 'seats', label: '团队席位', desc: '套餐、席位与用量', scope: 'pc', component: PcBizViews },
  { key: 'pricing', label: '价格', desc: '四档套餐功能对照', scope: 'pc', component: PcBizViews },
  { key: 'detail', label: '详情', desc: '单条差值详情（宿主抽屉）', scope: 'pc', secondary: true, component: PcLatestView },
  { key: 'archive', label: '归档检索', desc: '历史条目检索', scope: 'pc', component: PcArchiveView },
  { key: 'brief', label: '今日简报', desc: '按真实事件归纳的今日研判', scope: 'pc', component: PcBriefView },
  { key: 'source-risk', label: '信源分级', desc: '逐源健康度与分级体检表', scope: 'pc', component: PcSourceRiskView },
  { key: 'echo', label: '命中率', desc: '回打口径与待验证队列', scope: 'pc', component: PcEchoView },
  { key: 'cycle', label: '周期视图', desc: '日/周/月供给与当月热力日历', scope: 'pc', component: PcCycleView },
  { key: 'ai', label: 'AI 研判', desc: '规则式统计归纳与评分权重', scope: 'pc', component: PcAIView }
]

/** 5 个手机主 tab */
const MOBILE_VIEWS: readonly GapViewMeta[] = [
  { key: 'm-latest', label: '最新', desc: '手机端情报流', scope: 'mb', component: MbLatestView },
  { key: 'm-profile', label: '行业', desc: '手机端行业档案', scope: 'mb', component: MbProfileView },
  { key: 'm-matrix', label: '全景', desc: '手机端全景矩阵', scope: 'mb', component: MbMatrixView },
  { key: 'm-source', label: '单源', desc: '手机端单源情报', scope: 'mb', component: MbSourceView },
  { key: 'm-pricing', label: '价格', desc: '手机端价格', scope: 'mb', component: MbPricingView }
]

/** detail / filter 的手机二级形态 */
const MOBILE_SECONDARY: readonly GapViewMeta[] = [
  { key: 'm-detail', label: '详情', desc: '手机端详情（二级）', scope: 'mb', secondary: true, component: MbDetailView },
  { key: 'm-filter', label: '筛选', desc: '手机端筛选（二级）', scope: 'mb', secondary: true, component: MbFilterView },
  { key: 'm-brief', label: '今日简报', desc: '手机端简报（二级）', scope: 'mb', secondary: true, component: MbBriefView },
  { key: 'm-echo', label: '命中率', desc: '手机端回打口径（二级）', scope: 'mb', secondary: true, component: MbEchoView },
  { key: 'm-source-risk', label: '信源分级', desc: '手机端信源分级（二级）', scope: 'mb', secondary: true, component: MbSourceRiskView },
  { key: 'm-cycle', label: '周期视图', desc: '手机端供给日历（二级）', scope: 'mb', secondary: true, component: MbCycleView },
  { key: 'm-ai', label: 'AI 研判', desc: '手机端规则研判（二级）', scope: 'mb', secondary: true, component: MbAIView }
]

const ALL_META: Record<string, GapViewMeta> = {}
for (const meta of [...VIEWS, ...MOBILE_VIEWS, ...MOBILE_SECONDARY]) ALL_META[meta.key] = meta

const hasView = (key: string): boolean => Object.prototype.hasOwnProperty.call(ALL_META, key)

/* ============================================================
   二、路由解析：?view= 与 ?dev=（非法值回落，保留其它 query）
   ============================================================ */
const route = useRoute()
const router = useRouter()

/** route.query 的值可能是 string | string[] | null，统一收敛成单个字符串 */
function firstQuery(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : ''
  return typeof value === 'string' ? value : ''
}

/** 设备判定要早于 current：未知 view 在手机壳里必须回落到移动主 tab */
const devParam = computed<DeviceParam>(() => {
  const raw = firstQuery(route.query.dev)
  return raw === 'pc' || raw === 'mb' || raw === 'auto' ? raw : 'auto'
})

/** auto：窄屏或粗指针设备（真机）一律手机壳；桌面才允许 ?dev=mb 预览样机 */
const MEDIA_QUERY = '(max-width: 768px), (hover: none) and (pointer: coarse)'
const media =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(MEDIA_QUERY)
    : null
const isNarrow = ref<boolean>(media !== null && media.matches)
const effectiveDev = computed<'pc' | 'mb'>(() => {
  if (isNarrow.value) return 'mb'
  return devParam.value === 'mb' ? 'mb' : 'pc'
})

const current = computed<string>(() => {
  const raw = firstQuery(route.query.view)
  if (hasView(raw)) return raw
  // 手机壳没有 timeline/spread/score/archive 形态：回落到移动首个主 tab，而不是 PC 三栏稿
  return effectiveDev.value === 'mb' ? 'm-latest' : FALLBACK_VIEW
})

const FALLBACK_META: GapViewMeta = {
  key: FALLBACK_VIEW,
  label: '最新信息',
  desc: '按差值分排序的情报流',
  scope: 'pc',
  component: PcLatestView
}
const currentMeta = computed<GapViewMeta>(() => ALL_META[current.value] ?? FALLBACK_META)

const activeComp = computed<Component>(() => currentMeta.value.component)

/** 只有工作台四合一视图要传 kind，其余视图不接 props */
const BIZ_KEYS = new Set(['alert', 'report', 'seats', 'pricing'])
const activeProps = computed<Record<string, unknown>>(() =>
  BIZ_KEYS.has(current.value) ? { kind: current.value } : {}
)

/** PC view → 手机 tab 的映射，读 ?view= 时手机壳也能高亮正确的底 tab */
const MOBILE_TAB_OF: Readonly<Record<string, string>> = {
  latest: 'm-latest',
  profile: 'm-profile',
  matrix: 'm-matrix',
  source: 'm-source',
  pricing: 'm-pricing',
  detail: 'm-detail',
  // 新二级页 → 所属主 tab，返回后底栏高不错位
  'm-brief': 'm-latest',
  'm-echo': 'm-latest',
  'm-source-risk': 'm-latest',
  'm-cycle': 'm-latest',
  'm-ai': 'm-latest',
  brief: 'm-latest',
  echo: 'm-latest',
  'source-risk': 'm-latest',
  cycle: 'm-latest',
  ai: 'm-latest',
  alert: 'm-pricing',
  report: 'm-pricing',
  seats: 'm-pricing'
}
const mobileTab = computed<string>(() => MOBILE_TAB_OF[current.value] ?? current.value)

function onMediaChange(event: MediaQueryListEvent): void {
  isNarrow.value = event.matches
}

function replaceQuery(patch: Record<string, string>): void {
  void router.replace({ query: { ...route.query, ...patch } })
}

function onNavigate(key: string): void {
  if (!hasView(key) || key === current.value) return
  replaceQuery({ view: key })
}

function onMobileTab(key: string): void {
  const meta = ALL_META[key]
  if (!meta || meta.scope !== 'mb' || key === current.value) return
  replaceQuery({ view: key })
}

function onSwitchDev(target: 'pc' | 'mb'): void {
  if (devParam.value === target) return
  replaceQuery({ dev: target })
}

/** 全屏外壳下没有全局侧栏，头像就是返回工作台的入口 */
function onExit(): void {
  void router.push('/dashboard')
}

/* ============================================================
   三、生命周期
   ============================================================ */
const BODY_CLASS = 'gd-fullbleed'

/** 抽屉宿主 + 首次加载；各视图注入 openDetail 即可，不必各自挂抽屉 */
const { ranked, load, isLive, tierCounts, dateBands, filters } = useGapDesk()

const drawerOpen = ref(false)
const activeId = ref<number | null>(null)
const activeEvent = computed(() => {
  const id = activeId.value
  return id == null ? null : (ranked.value.find((row) => row.id === id) ?? null)
})
function openDetail(eventId: number): void {
  activeId.value = eventId
  drawerOpen.value = true
}
provide(GAP_OPEN_DETAIL_KEY, openDetail)

// ⚠️ 必须在 setup 同步阶段调用：内部会注册 onMounted / onBeforeUnmount，
// 放进 onMounted 回调会导致「没有活跃组件实例」且订阅不生效。
useGapDeskRealtime()

onMounted(() => {
  document.body.classList.add(BODY_CLASS)
  void load()
  if (media && typeof media.addEventListener === 'function') {
    media.addEventListener('change', onMediaChange)
  } else if (media) {
    media.addListener(onMediaChange)
  }
})

onUnmounted(() => {
  document.body.classList.remove(BODY_CLASS)
  if (media && typeof media.removeEventListener === 'function') {
    media.removeEventListener('change', onMediaChange)
  } else if (media) {
    media.removeListener(onMediaChange)
  }
})
</script>

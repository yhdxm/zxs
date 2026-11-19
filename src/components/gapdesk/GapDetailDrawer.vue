<!--
  事件详情抽屉
  ---------------------------------------------------------------
  内容顺序就是「让用户自己复核这条差值」的路径：
     标题/行业/时间 → 四维分解 → 双轨背离 → 为何是差 → 建议动作
     → 证据链（谁先报的，可点原文） → 平台轨迹（没触达就如实写没触达）
  证据链是**按需拉取**（loadEventDetail），feed 里不带，避免首屏一次拉几百条子表。
-->
<template>
  <el-drawer
    :model-value="modelValue"
    :size="drawerSize"
    direction="rtl"
    :with-header="false"
    class="gdd"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <!-- event 为 null 时完全不渲染内容，避免开关瞬间的闪烁与空壳 -->
    <div v-if="event" class="gdd-body">
      <header class="gdd-head">
        <div class="gdd-head-top">
          <span class="gdd-ind">
            <i class="gdd-dot" :style="{ background: indOption.color }" />
            {{ indOption.label }}
          </span>
          <span class="gdd-layer">{{ layerLabel }}</span>
          <span class="gdd-time">{{ timeText }}</span>
          <el-button class="gdd-close" text size="small" @click="close">关闭</el-button>
        </div>
        <h2 class="gdd-title">{{ event.title }}</h2>
        <div class="gdd-sub">
          <span class="gdd-gap">{{ event.gap }}</span>
          <span class="gdd-gap-cap">差值分（原始 {{ event.gap_raw }}）</span>
          <span class="gdd-sep">·</span>
          <span>{{ event.src_count }} 路信源</span>
          <template v-if="(event.mass_heat ?? 0) > 0">
            <span class="gdd-sep">·</span>
            <span class="gdd-mass">已出圈 {{ event.mass_on || '' }}</span>
          </template>
        </div>
      </header>

      <!-- 四维分解 -->
      <section class="gdd-sec">
        <h3 class="gdd-h3">四维分解（各 0-25）</h3>
        <GapScoreBar :b="event.b_json" />
      </section>

      <!-- 双轨 -->
      <section class="gdd-sec">
        <h3 class="gdd-h3">双轨背离</h3>
        <GapDualTrack :ins-heat="event.ins_heat ?? 0" :pub-heat="event.pub_heat ?? 0" :gap="event.gap" />
      </section>

      <!-- 为何是差 -->
      <section v-if="event.reason" class="gdd-sec">
        <h3 class="gdd-h3">为何是差</h3>
        <p class="gdd-p">{{ event.reason }}</p>
      </section>

      <!-- 建议动作 -->
      <section v-if="event.action" class="gdd-sec">
        <h3 class="gdd-h3">建议动作</h3>
        <p class="gdd-p gdd-p-act">{{ event.action }}</p>
      </section>

      <!-- 证据链 -->
      <section class="gdd-sec">
        <h3 class="gdd-h3">
          证据链
          <span class="gdd-h3-note">按发布时间升序 · 谁先报一目了然</span>
        </h3>

        <div v-if="detailLoading" class="gdd-skeleton">
          <i v-for="n in 3" :key="n" class="gdd-sk-line" />
        </div>
        <p v-else-if="detailError" class="gdd-p gdd-p-err">证据链读取失败：{{ detailError }}</p>
        <p v-else-if="!sources.length" class="gdd-p">库中没有该事件的证据行（可能刚入库，下一轮补齐）</p>
        <ul v-else class="gdd-srcs">
          <li v-for="s in sources" :key="s.id" class="gdd-src">
            <div class="gdd-src-main">
              <span class="gdd-src-name">{{ s.source_name || '未知来源' }}</span>
              <span class="gdd-src-layer">{{ layerLabelOf(s.layer) }}</span>
            </div>
            <div class="gdd-src-meta">
              <span>{{ fmtAgo(s.publish_ts ?? 0) }}</span>
              <span v-if="s.heat" class="gdd-src-heat">热度 {{ s.heat }}</span>
              <a
                v-if="s.url"
                class="gdd-src-link"
                :href="s.url"
                target="_blank"
                rel="noopener"
              >原文</a>
            </div>
          </li>
        </ul>
      </section>

      <!-- 平台轨迹 -->
      <section class="gdd-sec">
        <h3 class="gdd-h3">平台轨迹</h3>
        <ul class="gdd-plats">
          <li v-for="p in platformRows" :key="p.platform" class="gdd-plat">
            <span class="gdd-plat-name">{{ p.platform }}</span>
            <span v-if="p.firstTouchTs" class="gdd-plat-time">{{ fmtClock(p.firstTouchTs) }}</span>
            <span v-else class="gdd-plat-none">未触达</span>
            <span class="gdd-plat-heat">{{ p.heat == null ? '—' : p.heat }}</span>
          </li>
        </ul>
      </section>

      <!-- 底部动作 -->
      <footer class="gdd-foot">
        <el-button size="small" :type="isFavorite(event.id) ? 'warning' : 'default'" @click="onFavorite">
          {{ isFavorite(event.id) ? '已收藏' : '收藏' }}
        </el-button>
        <el-button size="small" @click="onRead">标记已读</el-button>
        <el-button size="small" type="primary" plain @click="onRule">建预警</el-button>
        <a v-if="event.url" class="gdd-origin" :href="event.url" target="_blank" rel="noopener">打开原文</a>
      </footer>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import GapScoreBar from './GapScoreBar.vue'
import GapDualTrack from './GapDualTrack.vue'
import { loadEventDetail } from '../../services/gapdeskService'
import { GAP_LAYER_LABEL, GAP_IND_MAP } from '../../config/gapdeskConfig'
import { fmtAgo, fmtClock } from '../../utils/gapdeskFormat'
import { useGapDesk } from '../../composables/useGapDesk'
import type { GapEventRow, GapEventSourceRow, GapInd, GapLayer } from '../../types/gapdesk'

const props = defineProps<{
  modelValue: boolean
  event: GapEventRow | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const { platforms, isFavorite, toggleFavoriteEvent, markEventRead } = useGapDesk()
const router = useRouter()
const route = useRoute()

const sources = ref<GapEventSourceRow[]>([])
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

/** 抽屉宽度：桌面 560，移动端 100%（一次 matchMedia 判定 + 监听，图表的 viewBox 不在这里管） */
const isMobile = ref(false)
let mq: MediaQueryList | null = null
const onMq = (e: MediaQueryListEvent): void => {
  isMobile.value = e.matches
}
onMounted(() => {
  if (typeof window === 'undefined') return
  mq = window.matchMedia('(max-width: 768px)')
  isMobile.value = mq.matches
  mq.addEventListener('change', onMq)
})
onBeforeUnmount(() => {
  if (mq) mq.removeEventListener('change', onMq)
})
const drawerSize = computed(() => (isMobile.value ? '100%' : '560px'))

const indOption = computed(() => {
  const ind = props.event?.ind as GapInd | undefined
  const hit = ind ? GAP_IND_MAP[ind] : undefined
  return hit ?? { key: 'glob', label: String(ind ?? '未分类'), color: '#909399' }
})

const layerLabel = computed(() => (props.event ? GAP_LAYER_LABEL[props.event.kind] ?? '情报' : ''))

function layerLabelOf(layer: GapLayer | null): string {
  if (!layer) return '未知层'
  return GAP_LAYER_LABEL[layer] ?? '未知层'
}

/** 有发布时间显示「发布距今」，没有就如实写「入池」时间 */
const timeText = computed(() => {
  const e = props.event
  if (!e) return ''
  if (e.ts_published > 0) return `${fmtAgo(e.ts_published)} · ${fmtClock(e.ts_published)}`
  return `入池 ${fmtAgo(e.ts_first_seen)}`
})

/** 平台轨迹：库里 first_touch_ts=0 表示未触达，界面绝不显示「0 分钟前」 */
const platformRows = computed(() => {
  const e = props.event
  if (!e) return []
  return platforms.value
    .filter((p) => p.event_id === e.id)
    .map((p) => ({
      platform: p.platform ?? '未知平台',
      heat: p.heat ?? null,
      firstTouchTs: p.first_touch_ts && p.first_touch_ts > 0 ? p.first_touch_ts : 0
    }))
})

/** 打开（或切换事件）时拉一次证据链 */
async function fetchDetail(id: number): Promise<void> {
  detailLoading.value = true
  detailError.value = null
  sources.value = []
  const res = await loadEventDetail(id)
  // 防止「快速切换事件」时旧请求后到把新数据覆盖掉
  if (props.event?.id !== id) return
  sources.value = res.data
  detailError.value = res.error
  detailLoading.value = false
}

watch(
  () => [props.modelValue, props.event?.id] as const,
  ([open, id]) => {
    if (open && typeof id === 'number') void fetchDetail(id)
  },
  { immediate: true }
)

function close(): void {
  emit('update:modelValue', false)
}

async function onFavorite(): Promise<void> {
  if (!props.event) return
  await toggleFavoriteEvent(props.event.id)
}

async function onRead(): Promise<void> {
  if (!props.event) return
  await markEventRead(props.event.id)
  ElMessage.success('已标记已读')
}

/** 建预警：跳到 alert 视图并把当前事件作为模板参数带过去（alert 视图下一批实现） */
function onRule(): void {
  if (!props.event) return
  close()
  void router.push({
    query: { ...route.query, view: 'alert', ind: props.event.ind, dim: props.event.dim }
  })
}
</script>

<style scoped>
.gdd-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 20px 24px;
  min-width: 0;
}
.gdd-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 12px;
}
.gdd-head-top {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted, #909399);
  min-width: 0;
}
.gdd-ind {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gdd-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.gdd-layer {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-soft, rgba(0, 0, 0, 0.04));
}
.gdd-time {
  flex: none;
}
.gdd-close {
  margin-left: auto;
  min-height: 44px;
}
.gdd-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.45;
  color: var(--text-strong, #303133);
}
.gdd-sub {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted, #909399);
}
.gdd-gap {
  font-size: 22px;
  font-weight: 800;
  color: #ff3358;
  font-variant-numeric: tabular-nums;
}
.gdd-gap-cap {
  font-size: 10px;
}
.gdd-sep {
  opacity: 0.6;
}
.gdd-mass {
  color: #0ba36f;
}
.gdd-sec {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gdd-h3 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.gdd-h3-note {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-muted, #909399);
}
.gdd-p {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-muted, #606266);
}
.gdd-p-act {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(11, 163, 111, 0.08);
  color: #0b7a54;
}
.gdd-p-err {
  color: #ff3358;
}
.gdd-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gdd-sk-line {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f2f3f5, #e9eaec, #f2f3f5);
  background-size: 200% 100%;
  animation: gdd-shine 1.2s ease-in-out infinite;
}
@keyframes gdd-shine {
  to {
    background-position: -200% 0;
  }
}
.gdd-srcs {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gdd-src {
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.gdd-src-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.gdd-src-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong, #303133);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gdd-src-layer {
  flex: none;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-soft, rgba(0, 0, 0, 0.04));
  color: var(--text-muted, #909399);
}
.gdd-src-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted, #909399);
}
.gdd-src-heat {
  font-variant-numeric: tabular-nums;
}
.gdd-src-link {
  margin-left: auto;
  color: var(--el-color-primary);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.gdd-plats {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gdd-plat {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted, #909399);
}
.gdd-plat-name {
  min-width: 76px;
  color: var(--text-strong, #303133);
}
.gdd-plat-time {
  font-variant-numeric: tabular-nums;
}
.gdd-plat-none {
  color: #c0c4cc;
}
.gdd-plat-heat {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong, #303133);
}
.gdd-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.gdd-foot :deep(.el-button) {
  min-height: 44px;
}
.gdd-origin {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
@media (max-width: 768px) {
  .gdd-body {
    /* 抽屉 teleport 到 body，需自己补偿底部手势条安全区 */
    padding: 14px 14px calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .gdd-title {
    font-size: 15px;
  }
}
</style>

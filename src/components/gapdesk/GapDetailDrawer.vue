<!--
  详情抽屉（原生浮层，零 UI 库组件）
  ---------------------------------------------------------------
  5 段固定结构：① 结论 ② 双轨差值 ③ 四维分解 ④ 证据链 ⑤ Echo 回打说明。
  遮罩 / Esc 关闭；j / k 切换上一条 / 下一条（通过 navigate 交回宿主改 ?view=）。
  证据链只展示真实行；平台未触达写「未触达 · 不补假数据」。
-->
<template>
  <!-- 挂到 body：避免被父级 transform / overflow 裁切，也不再依赖宿主的空节点。
       离开 .gd-stage 后令牌不继承，故补 gd-portal 承接同一套 --gd-*（见 tokens.css） -->
  <Teleport to="body">
    <div v-if="modelValue" class="gdd-wrap gd-portal" @click.self="close">
    <aside class="gdd" role="dialog" aria-modal="true" aria-label="差值详情">
      <template v-if="event">
        <header class="gdd-h">
          <i class="gdd-bar" aria-hidden="true" />
          <span class="gd-pill gd-pill-acc gd-mono">{{ event.tier }}</span>
          <span class="gdd-ind gd-mono">{{ indLabel }}</span>
          <span class="gdd-time gd-mono">{{ timeText }}</span>
          <span class="gd-spacer" />
          <span class="gdd-hint gd-mono">j / k 切换 · Esc 关闭</span>
          <button type="button" class="gdd-x gd-mono" title="关闭" @click="close">×</button>

          <div class="gdd-h2row">
            <GapI18nLine
              :original="event.title"
              :display="displayTitle"
              :state="i18nState"
              :has-translation="hasTranslation"
              :retry-key="event.event_key"
              tag="h2"
              large
            />
            <span class="gdd-score gd-mono">{{ event.gap }}</span>
          </div>
          <div class="gdd-gaptags" v-if="gapTags.length">
            <span v-for="tag in gapTags" :key="tag" class="gd-gaptag gd-mono" :class="`tone-${gapTagTone(tag)}`">{{ tag }}</span>
          </div>
          <p class="gdd-sub gd-mono">
            GAP · 池内第 {{ event.rank }} 位 · 原始 {{ event.gap_raw }}/90 · {{ event.src_count }} 路源
          </p>
        </header>

        <div class="gdd-body">
          <!-- ① 结论 -->
          <section class="gdd-sec">
            <h3 class="gdd-h3"><i class="gdd-h3bar" />结论</h3>
            <p class="gdd-p">{{ event.reason || '—' }}</p>
            <p v-if="event.action" class="gdd-act">{{ event.action }}</p>
          </section>

          <!-- ② 差值可视化 -->
          <section class="gdd-sec">
            <h3 class="gdd-h3"><i class="gdd-h3bar" />双轨差值</h3>
            <GapDualTrack
              :ins-heat="event.ins_heat ?? 0"
              :pub-heat="event.pub_heat ?? 0"
              :gap="event.gap"
            />
          </section>

          <!-- ③ 四维分解 -->
          <section class="gdd-sec">
            <h3 class="gdd-h3"><i class="gdd-h3bar" />四维分解</h3>
            <GapScoreBlock :event="event" />
          </section>

          <!-- ④ 证据链 -->
          <section class="gdd-sec">
            <h3 class="gdd-h3"><i class="gdd-h3bar" />证据链<span class="gdd-note">按发布时间升序 · 谁先报一目了然</span></h3>
            <p v-if="evidenceLoading" class="gdd-p">正在读取证据链…</p>
            <p v-else-if="evidenceError" class="gdd-p">证据链读取失败：{{ evidenceError }}</p>
            <p v-else-if="!evidenceRows.length" class="gdd-p">库中没有该事件的证据行（可能刚入库，下一轮补齐）</p>
            <ul v-else class="gdd-srcs">
              <li
                v-for="s in evidenceRows"
                :key="`${s.event_id}-${s.id}`"
                class="gdd-src"
                :class="{ first: s.id === firstSourceId }"
              >
                <div class="gdd-src-top">
                  <span v-if="s.id === firstSourceId" class="gdd-first gd-mono">首报</span>
                  <span class="gdd-src-name">{{ s.source_name || '未知来源' }}</span>
                  <span class="gd-pill gd-pill-soft gd-mono">{{ layerLabelOf(s.layer) }}</span>
                  <span class="gdd-src-time gd-mono">{{ stampText(s.publish_ts) }}</span>
                </div>
                <a v-if="s.url" class="gdd-src-link gd-mono" :href="s.url" target="_blank" rel="noopener">打开原文 ↗</a>
                <span v-else class="gdd-src-none gd-mono">未触达 · 不补假数据</span>
              </li>
            </ul>
          </section>

          <!-- ⑤ Echo 回打说明 -->
          <section class="gdd-sec">
            <h3 class="gdd-h3"><i class="gdd-h3bar" />Echo 回打</h3>
            <p class="gdd-p">{{ EMPTY_ECHO }}</p>
          </section>
        </div>

        <footer class="gdd-foot">
          <button type="button" class="gdd-btn gd-mono" @click="emit('navigate', prevId)" :disabled="prevId === event.id">← 上一条</button>
          <button type="button" class="gdd-btn gd-mono" @click="emit('navigate', nextId)" :disabled="nextId === event.id">下一条 →</button>
          <!-- 抽屉内直接完成动作：复用已暴露给宿主的同名方法，不重写 store 逻辑 -->
          <button type="button" class="gdd-btn gd-mono" :class="{ on: isCurrentLater() }" @click="onLater">
            {{ isCurrentLater() ? '移出稍后读' : '加入稍后读' }}
          </button>
          <button type="button" class="gdd-btn gd-mono" :class="{ on: isCurrentLike() }" @click="onLike">
            {{ isCurrentLike() ? '取消喜欢' : '喜欢' }}
          </button>
          <span class="gd-spacer" />
          <a v-if="event.url" class="gdd-origin gd-mono" :href="event.url" target="_blank" rel="noopener">原始出处 ↗</a>
        </footer>
      </template>
    </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GapDualTrack from './GapDualTrack.vue'
import GapScoreBlock from './GapScoreBlock.vue'
import GapI18nLine from './GapI18nLine.vue'
import { EMPTY_ECHO, GAP_IND_MAP, GAP_LAYER_LABEL } from '../../config/gapdeskConfig'
import { fmtAgo, fmtClock, gapGapTagsOf, gapTagTone } from '../../utils/gapdeskFormat'
import { loadEventDetail } from '../../services/gapdeskService'
import { useGapDesk } from '../../composables/useGapDesk'
import type { GapEventSourceRow, GapLayer, RankedEvent } from '../../types/gapdesk'

const props = defineProps<{
  modelValue: boolean
  event: RankedEvent | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  navigate: [id: number]
}>()

const { ranked, platforms, evidences, toggleLater, isLater, toggleFavoriteEvent, markEventRead, isFavorite, titleOf, i18nStateOf, ensureI18n } = useGapDesk()

const displayTitle = computed(() => (props.event ? titleOf(props.event) : ''))
const i18nState = computed(() => (props.event ? i18nStateOf(props.event) : 'native'))
const hasTranslation = computed(() => i18nState.value === 'done')
const gapTags = computed(() => (props.event ? gapGapTagsOf(props.event) : []))

/** 证据链首报：按 publish_ts 最小的一行，行内高亮，不依赖后端再补字段 */
const firstSourceId = computed<number | null>(() => {
  let best: GapEventSourceRow | null = null
  for (const row of evidenceRows.value) {
    const ts = row.publish_ts ?? Number.MAX_SAFE_INTEGER
    if (!best || ts < (best.publish_ts ?? Number.MAX_SAFE_INTEGER)) best = row
  }
  return best?.id ?? null
})

const detail = ref<GapEventSourceRow[]>([])
const evidenceLoading = ref(false)
const evidenceError = ref<string | null>(null)

const indLabel = computed(() => {
  const ind = props.event?.ind
  return (ind ? GAP_IND_MAP[ind]?.label : '') || '未分类'
})

const timeText = computed(() => {
  const e = props.event
  if (!e) return ''
  return e.ts_published > 0 ? `${fmtAgo(e.ts_published)} · ${fmtClock(e.ts_published)}` : `入池 ${fmtAgo(e.ts_first_seen)}`
})

/** 先用 feed 批量结果，缺该事件时再按需拉一次详情 */
const evidenceRows = computed<GapEventSourceRow[]>(() => {
  const id = props.event?.id
  if (id == null) return []
  const bulk = evidences.value.filter((row) => row.event_id === id)
  return bulk.length ? bulk : detail.value
})

function layerLabelOf(layer: GapLayer | null): string {
  if (!layer) return '未知层'
  return GAP_LAYER_LABEL[layer] ?? '未知层'
}

function stampText(ts: number | null): string {
  if (!ts || ts <= 0) return '时间未知'
  return fmtClock(ts)
}

/** 上一条 / 下一条（到边界时保持当前 id，按钮置灰） */
const currentIndex = computed(() => {
  const id = props.event?.id
  return typeof id === 'number' ? ranked.value.findIndex((row) => row.id === id) : -1
})
const prevId = computed(() => {
  const i = currentIndex.value
  return i > 0 ? (ranked.value[i - 1]?.id ?? props.event?.id ?? 0) : (props.event?.id ?? 0)
})
const nextId = computed(() => {
  const i = currentIndex.value
  return i >= 0 && i < ranked.value.length - 1
    ? (ranked.value[i + 1]?.id ?? props.event?.id ?? 0)
    : (props.event?.id ?? 0)
})

async function fetchDetail(id: number): Promise<void> {
  evidenceLoading.value = true
  evidenceError.value = null
  detail.value = []
  const res = await loadEventDetail(id)
  if (props.event?.id !== id) return
  detail.value = res.data
  evidenceError.value = res.error
  evidenceLoading.value = false
}

watch(
  () => [props.modelValue, props.event?.id] as const,
  ([open, id]) => {
    if (open && typeof id === 'number') {
      void fetchDetail(id)
      if (props.event) ensureI18n([props.event])
    }
  }
)

function close(): void {
  emit('update:modelValue', false)
}

/** Esc 关闭，j/k 切换；输入框聚焦时不抢键 */
function onKey(event: KeyboardEvent): void {
  if (!props.modelValue || !props.event) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (event.key === 'Escape') close()
  else if (event.key === 'j' || event.key === 'J') emit('navigate', nextId.value)
  else if (event.key === 'k' || event.key === 'K') emit('navigate', prevId.value)
}

onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
})

/** 供宿主接卡片操作；本组件只做转发，不改 store 状态 */
function onLater(): void {
  if (props.event) toggleLater(props.event.id)
}
function onLike(): void {
  if (props.event) void toggleFavoriteEvent(props.event.id)
}
function onRead(): void {
  if (props.event) void markEventRead(props.event.id)
}
function isCurrentLater(): boolean {
  return props.event ? isLater(props.event.id) : false
}
function isCurrentLike(): boolean {
  return props.event ? isFavorite(props.event.id) : false
}
defineExpose({ onLater, onLike, onRead, isCurrentLater })
</script>

<style scoped>
.gdd-wrap {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(12, 16, 48, .34);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
}
.gdd {
  width: min(560px, 100vw);
  height: 100%;
  background: var(--gd-card);
  display: flex;
  flex-direction: column;
  box-shadow: var(--gd-sh-lg);
  min-width: 0;
}
.gdd-h {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--gd-line);
  background: var(--gd-card);
}
.gdd-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gd-grad);
}
.gdd-ind,
.gdd-time,
.gdd-hint {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gdd-x {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-phead);
  cursor: pointer;
}
.gdd-h2row {
  flex: 1 0 100%;
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.gdd-title {
  margin: 0;
  font-size: var(--gd-fs-phead);
  font-weight: 700;
  line-height: 1.4;
  color: var(--gd-ink);
  overflow-wrap: anywhere;
}
.gdd-score {
  margin-left: auto;
  font-size: 26px;
  font-weight: 700;
  background: var(--gd-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.gdd-sub {
  flex: 1 0 100%;
  margin: 0;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gdd-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.gdd-body > * {
  flex-shrink: 0;
}
.gdd-sec {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.gdd-h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: var(--gd-fs-panelh);
  font-weight: 700;
  color: var(--gd-ink);
}
.gdd-h3bar {
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: var(--gd-grad);
}
.gdd-note {
  font-size: var(--gd-fs-pill);
  font-weight: 400;
  color: var(--gd-ink3);
}
.gdd-p {
  margin: 0;
  font-size: var(--gd-fs-why);
  line-height: 1.7;
  color: var(--gd-ink2);
  overflow-wrap: anywhere;
}
.gdd-act {
  margin: 0;
  padding: 8px 11px;
  border-radius: var(--gd-r-nav);
  background: color-mix(in srgb, var(--gd-ok) 10%, var(--gd-card));
  color: var(--gd-ok);
  font-size: var(--gd-fs-why);
  line-height: 1.6;
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
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 11px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-gcard);
  background: var(--gd-sub);
}
.gdd-src.first {
  border-color: color-mix(in srgb, var(--gd-brand) 45%, var(--gd-line));
  background: color-mix(in srgb, var(--gd-brand) 6%, var(--gd-sub));
}
.gdd-first {
  font-size: var(--gd-fs-pill);
  color: var(--gd-brand);
  background: color-mix(in srgb, var(--gd-brand) 10%, var(--gd-card));
  border-radius: 4px;
  padding: 1px 5px;
  flex-shrink: 0;
}
.gdd-gaptags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.gdd-src-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.gdd-src-name {
  font-size: var(--gd-fs-panels);
  font-weight: 600;
  color: var(--gd-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gdd-src-time {
  margin-left: auto;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  white-space: nowrap;
}
.gdd-src-link,
.gdd-origin {
  color: var(--gd-brand);
  font-size: var(--gd-fs-panels);
  text-decoration: none;
}
.gdd-src-none {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gdd-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 18px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--gd-line);
  background: var(--gd-sub);
}
.gdd-btn {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--gd-line2);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.gdd-btn:disabled {
  opacity: .45;
  cursor: default;
}
/* 已在队列/已喜欢：只加状态色，不改变按钮位置或原有操作 */
.gdd-btn.on {
  background: var(--gd-grad);
  border-color: transparent;
  color: var(--gd-card);
}

/* 窄屏：详情抽屉全屏化，证据链改纵向时间轴（左边一条线串起各源，首报节点高亮） */
@media (max-width: 768px), (hover: none) and (pointer: coarse) {
  .gdd-wrap {
    align-items: stretch;
  }
  .gdd {
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    border-radius: 0;
  }
  .gdd-h { padding: 12px 16px calc(12px + env(safe-area-inset-top)); }
  .gdd-body { padding: 14px 16px; gap: 16px; }
  .gdd-srcs {
    border-left: 2px solid var(--gd-line2);
    padding-left: 12px;
    margin-left: 4px;
  }
  .gdd-src {
    position: relative;
    border-radius: var(--gd-r-nav);
  }
  .gdd-src::before {
    content: '';
    position: absolute;
    left: -16px;
    top: 16px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--gd-line2);
  }
  .gdd-src.first::before {
    background: var(--gd-brand);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--gd-brand) 18%, transparent);
  }
  .gdd-foot { padding-left: 16px; padding-right: 16px; }
}
</style>

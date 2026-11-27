<!--
  差值台 GAPDESK · 右侧信息栏
  固定 5 卡：Echo 回打 / AI 今日研判 / 信源体温计 / 稍后读队列 / 今日概览。
  文案只走 config 的 EMPTY_*；Echo 与 AI 两卡可点击，交由宿主 onNavigate 切屏。
-->
<template>
  <aside class="gd-rightcol">
    <!-- 常驻证据侧栏：点任意差卡即切换；首报高亮，谁先报一目了然 -->
    <section class="gd-panel gd-evpanel">
      <div class="gd-panel-h">
        <i class="gd-bar" aria-hidden="true" />
        <span>选中差 · 证据链</span>
        <span class="gd-tag gd-mono">EVID</span>
      </div>
      <template v-if="event">
        <div class="gd-ev-title">{{ displayTitle }}</div>
        <div v-if="gapTags.length" class="gd-ev-tags">
          <span v-for="tag in gapTags" :key="tag" class="gd-gaptag gd-mono" :class="`tone-${gapTagTone(tag)}`">{{ tag }}</span>
        </div>
        <p v-if="!evidenceRows.length" class="gd-panel-body">
          {{ evidenceLoading ? '正在读取证据链…' : '库中没有该事件的证据行（可能刚入库，下一轮补齐）' }}
        </p>
        <ul v-else class="gd-ev-list">
          <li
            v-for="s in evidenceRows"
            :key="`${s.event_id}-${s.id}`"
            class="gd-ev-item"
            :class="{ first: s.id === firstSourceId }"
          >
            <span v-if="s.id === firstSourceId" class="gd-ev-first gd-mono">首报</span>
            <span class="gd-ev-src">{{ s.source_name || '未知来源' }}</span>
            <span class="gd-ev-time gd-mono">{{ stampText(s.publish_ts) }}</span>
          </li>
        </ul>
        <div v-if="selectedChain" class="gd-ev-chain">
          <span class="gd-ev-chain-lb gd-mono">跨源时差</span>
          <span class="gd-ev-chain-v gd-mono">{{ selectedChain.hopCount }} 源 · 跨度 {{ selectedChain.spanH }}h</span>
        </div>
        <div class="gd-ev-health">
          源健康 <span :class="health.ok > 0 ? 'gd-ev-ok' : 'gd-ev-bad'">{{ health.total > 0 ? `${health.ok}/${health.total} 正常` : '暂无数据' }}</span>
          <button type="button" class="gd-panel-link gd-mono gd-ev-more" @click="go('source-risk')">信源分级 →</button>
        </div>
      </template>
      <p v-else class="gd-panel-body">点击任意一条差，这里显示它的证据链、首报来源与源健康。</p>
    </section>

    <section v-for="panel in PANELS" :key="panel.title" class="gd-panel">
      <div class="gd-panel-h">
        <i class="gd-bar" aria-hidden="true" />
        <span>{{ panel.title }}</span>
        <span class="gd-tag gd-mono">{{ panel.tag }}</span>
      </div>
      <p class="gd-panel-body">{{ panel.body }}</p>
      <!-- 稍后读从「只有计数」扩展为可点开的清单；计数文案与写库逻辑原样保留 -->
      <template v-if="panel.tag === 'LATER' && laterList.length">
        <button
          type="button"
          class="gd-panel-link gd-mono gd-later-toggle"
          @click="laterOpen = !laterOpen"
        >{{ laterOpen ? GAP_LATER_COLLAPSE : GAP_LATER_EXPAND }}</button>
        <ul v-if="laterOpen" class="gd-later-list">
          <li v-for="ev in laterList" :key="ev.id">
            <button type="button" class="gd-later-row" @click="openLater(ev.id)">
              <span class="gd-later-title">{{ titleOf(ev) }}</span>
              <span v-if="rankById.has(ev.id)" class="gd-later-rank gd-mono">#{{ rankById.get(ev.id) }}</span>
            </button>
          </li>
        </ul>
        <p v-if="laterOpen && missingLaterCount" class="gd-panel-body gd-later-missing">{{ GAP_LATER_MISSING }}</p>
      </template>
      <button
        v-if="panel.linkText"
        type="button"
        class="gd-panel-link gd-mono"
        @click="go(panel.navKey)"
      >
        {{ panel.linkText }}
      </button>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import {
  EMPTY_ECHO,
  EMPTY_LLM,
  EMPTY_WAIT,
  GAP_LATER_COLLAPSE,
  GAP_LATER_EXPAND,
  GAP_LATER_MISSING
} from '../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../composables/useGapDesk'
import { fmtClock, gapGapTagsOf, gapTagTone } from '../../utils/gapdeskFormat'
import { loadEventDetail } from '../../services/gapdeskService'
import type { GapEventSourceRow, RankedEvent } from '../../types/gapdesk'

interface RightPanel {
  title: string
  tag: string
  body: string
  /** 有值则渲染跳屏按钮，具体跳转交给宿主的 onNavigate */
  navKey?: string
  linkText?: string
}

const props = defineProps<{ event?: RankedEvent | null }>()
const emit = defineEmits<{ navigate: [key: string] }>()

const { health, tierCounts, dailyBriefText, laterIds, laterList, laterLocalOnly, ranked, evidences, titleOf, ensureI18n, sourceHealthStats, echoChains } = useGapDesk()

/** 清单只读打开详情，不另建抽屉：沿用宿主 provide 的同一注入点 */
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})
const laterOpen = ref(false)
const rankById = computed(() => new Map(ranked.value.map((row) => [row.id, row.rank])))
const missingLaterCount = computed(() => Math.max(0, laterIds.value.length - laterList.value.length))
function openLater(id: number): void {
  openDetail(id)
}

/** 选中事件的传播链：与 Echo 页同源，仅取当前事件那条 */
const selectedChain = computed(() =>
  props.event ? echoChains.value.find((c) => c.eventId === props.event?.id) ?? null : null
)

/** 逐源实测摘要：首报 Top1 + 孤证数，全部来自证据链真值；无样本留口径文案 */
const sourceDigest = computed(() => {
  const rows = sourceHealthStats.value
  if (!rows.length) return ''
  const top = rows[0]!
  const lone = rows.filter((r) => r.loneCount > 0).length
  return `首报最多 ${top.source}（${top.firstCount} 次）；${lone} 路有孤证。`
})

/* ===== 常驻证据侧栏：与详情抽屉同源，按需补拉详情 ===== */
const detail = ref<GapEventSourceRow[]>([])
const evidenceLoading = ref(false)
const evidenceRows = computed<GapEventSourceRow[]>(() => {
  const id = props.event?.id
  if (id == null) return []
  const bulk = evidences.value.filter((row) => row.event_id === id)
  return bulk.length ? bulk : detail.value
})
/** 首报 = publish_ts 最小的一行；与详情抽屉同口径 */
const firstSourceId = computed<number | null>(() => {
  let best: GapEventSourceRow | null = null
  for (const row of evidenceRows.value) {
    const ts = row.publish_ts ?? Number.MAX_SAFE_INTEGER
    if (!best || ts < (best.publish_ts ?? Number.MAX_SAFE_INTEGER)) best = row
  }
  return best?.id ?? null
})
const displayTitle = computed(() => (props.event ? titleOf(props.event) : ''))
const gapTags = computed(() => (props.event ? gapGapTagsOf(props.event) : []))
function stampText(ts: number | null): string {
  return ts && ts > 0 ? fmtClock(ts) : '时间未知'
}

watch(
  () => props.event?.id,
  (id) => {
    if (typeof id !== 'number') { detail.value = []; return }
    if (props.event) ensureI18n([props.event])
    if (evidences.value.some((row) => row.event_id === id)) { detail.value = []; return }
    evidenceLoading.value = true
    void loadEventDetail(id).then((res) => {
      detail.value = res.data
      evidenceLoading.value = false
    })
  },
  { immediate: true }
)

/** 全部读真实 store；取不到就显示口径文案，不写死任何数字 */
const PANELS = computed<RightPanel[]>(() => [
  {
    title: 'Echo 回打',
    tag: 'ECHO',
    body: EMPTY_ECHO,
    navKey: 'echo',
    linkText: '查看命中率中心 →'
  },
  {
    title: 'AI 今日研判',
    tag: 'AI',
    body: dailyBriefText.value ? dailyBriefText.value.split('\n')[0] ?? EMPTY_LLM : `— ${EMPTY_LLM}`,
    navKey: 'ai',
    linkText: '进入 AI 研判 →'
  },
  {
    title: '信源体温计',
    tag: 'HEALTH',
    body: sourceDigest.value
      ? sourceDigest.value
      : health.value.total > 0
        ? `正常 ${health.value.ok} / ${health.value.total} 路；失败源逐一列在信源分级页，不隐藏。`
        : `— ${EMPTY_WAIT}：还没有逐源健康数据。`
  },
  {
    title: '稍后读队列',
    tag: 'LATER',
    body: laterLocalOnly.value
      ? `稍后读 ${laterIds.value.length} 条（仅本机）：gap_later 表不可用，执行 scripts/gapdesk_later.sql 后可跨端同步。`
      : laterIds.value.length
        ? `稍后读 ${laterIds.value.length} 条（登录后跨端同步）`
        : '— 队列为空，进入详情可加入稍后读。'
  },
  {
    title: '今日概览',
    tag: 'TODAY',
    body: `L0 ${tierCounts.value.L0} 条 · L1 ${tierCounts.value.L1} 条 · L2 ${tierCounts.value.L2} 条（池内分位）`
  }
])

function go(key: string | undefined): void {
  if (key) emit('navigate', key)
}
</script>

<style scoped>
.gd-panel-link {
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--gd-brand);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.gd-panel-link:hover {
  color: color-mix(in srgb, var(--gd-brand) 72%, var(--gd-brand2));
}
/* 稍后读清单：轻量、可滚动，点条目直接开对应详情 */
.gd-later-toggle {
  margin-bottom: 2px;
}
.gd-later-list {
  list-style: none;
  margin: 2px 0 6px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 190px;
  overflow-y: auto;
}
.gd-later-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  min-height: 30px;
  padding: 4px 6px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-sub);
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-pill);
  text-align: left;
  cursor: pointer;
}
.gd-later-row:hover {
  border-color: var(--gd-brand);
  color: var(--gd-brand);
}
.gd-later-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gd-later-rank {
  flex: none;
  color: var(--gd-brand);
}
.gd-later-missing {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
/* 常驻证据侧栏 */
.gd-evpanel {
  border-color: color-mix(in srgb, var(--gd-brand) 28%, var(--gd-line));
}
.gd-ev-title {
  font-size: var(--gd-fs-panels);
  font-weight: 600;
  line-height: 1.5;
  color: var(--gd-ink);
  overflow-wrap: anywhere;
  margin: 2px 0 6px;
}
.gd-ev-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.gd-ev-list {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.gd-ev-item {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 4px 6px;
  border-left: 2px solid var(--gd-line2);
  background: var(--gd-sub);
  border-radius: 4px;
}
.gd-ev-item.first {
  border-left-color: var(--gd-brand);
  background: color-mix(in srgb, var(--gd-brand) 6%, var(--gd-sub));
}
.gd-ev-first {
  flex-shrink: 0;
  font-size: var(--gd-fs-pill);
  color: var(--gd-card);
  background: var(--gd-brand);
  border-radius: 3px;
  padding: 1px 4px;
}
.gd-ev-src {
  flex: 1;
  min-width: 0;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gd-ev-time {
  flex-shrink: 0;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gd-ev-chain {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  margin-bottom: 6px;
}
.gd-ev-chain-lb {
  color: var(--gd-ink3);
}
.gd-ev-chain-v {
  color: var(--gd-brand);
}
.gd-ev-health {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  border-top: 1px solid var(--gd-line);
  padding-top: 7px;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gd-ev-ok { color: var(--gd-ok); }
.gd-ev-bad { color: var(--gd-warn); }
.gd-ev-more { font-size: var(--gd-fs-pill); }
</style>

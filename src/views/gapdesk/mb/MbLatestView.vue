<!--
  移动-01 最新信息
  与 PC-01 同一份 store 口径：L0 优先、日期胶囊来自 dateBands，卡片为移动 p-card。
-->
<template>
  <div class="mbview">
    <div class="p-sec">
      <div class="h">L0 · 今日必看 <b class="gd-mono">{{ l0.length }}</b></div>
    </div>
    <article v-for="item in l0" :key="item.id" class="p-card t-L0" @click="openDetail(item.id)">
      <div class="mhead">
        <i class="dot" :style="{ background: indColor(item.ind) }" aria-hidden="true" />
        <span class="m">{{ indLabel(item.ind) }}</span>
        <span class="gd-mono score">{{ item.gap }}</span>
        <span class="m gd-mono">#{{ item.rank }}</span>
      </div>
      <!-- 移动四行：差标签 → 译文标题 → GAP/时差/来源 → 原文；正文压一行，详情里看全 -->
      <div v-if="gapGapTagsOf(item).length" class="mb-gaptags">
        <span v-for="tag in gapGapTagsOf(item)" :key="tag" class="gd-gaptag gd-mono" :class="`tone-${gapTagTone(tag)}`">{{ tag }}</span>
      </div>
      <GapI18nLine
        :original="item.title"
        :display="titleOf(item)"
        :state="i18nStateOf(item)"
        :has-translation="i18nStateOf(item) === 'done'"
        compact
      />
      <p v-if="item.reason" class="why">{{ item.reason }}</p>
      <GapDualTrack compact :ins-heat="item.ins_heat ?? 0" :pub-heat="item.pub_heat ?? 0" :gap="item.gap" />
      <div class="ft">
        <span>{{ fmtAgo(item.ts_published || item.ts_first_seen) }}</span>
        <span>{{ item.src_count }} 路源</span>
        <span v-if="sourceOf(item.id)" class="src">{{ sourceOf(item.id)?.name }}</span>
        <a
          v-if="sourceOf(item.id)?.url"
          class="orig"
          :href="sourceOf(item.id)?.url ?? undefined"
          target="_blank"
          rel="noopener"
          @click.stop
        >原文 ↗</a>
      </div>
      <div class="row" @click.stop>
        <button type="button" @click="openDetail(item.id)">详情</button>
        <button type="button" :class="{ on: laterIds.includes(item.id) }" @click="toggleLater(item.id)">稍后读</button>
        <button type="button" :class="{ on: favorites.includes(item.id) }" @click="toggleFavoriteEvent(item.id)">喜欢</button>
      </div>
    </article>

    <GapEmptyState v-if="!displayList.length" type="empty" :desc="EMPTY_WINDOW" />

    <template v-if="rest.length">
      <div class="p-sec"><div class="h">L1 / L2 · 按评分排序 <b class="gd-mono">{{ rest.length }}</b></div></div>
      <article v-for="item in rest" :key="item.id" class="p-card" :class="`t-${item.tier}`" @click="openDetail(item.id)">
        <div class="mhead">
          <i class="dot" :style="{ background: indColor(item.ind) }" aria-hidden="true" />
          <span class="m">{{ indLabel(item.ind) }}</span>
          <span class="gd-mono score">{{ item.gap }}</span>
        </div>
        <GapI18nLine
          :original="item.title"
          :display="titleOf(item)"
          :state="i18nStateOf(item)"
          :has-translation="i18nStateOf(item) === 'done'"
          compact
        />
        <div v-if="gapGapTagsOf(item).length" class="mb-gaptags">
          <span v-for="tag in gapGapTagsOf(item)" :key="tag" class="mb-gaptag gd-mono">{{ tag }}</span>
        </div>
        <div class="ft">
          <span>{{ item.tier }}</span>
          <span>{{ fmtAgo(item.ts_published || item.ts_first_seen) }}</span>
          <span v-if="sourceOf(item.id)" class="src">{{ sourceOf(item.id)?.name }}</span>
          <a
            v-if="sourceOf(item.id)?.url"
            class="orig"
            :href="sourceOf(item.id)?.url ?? undefined"
            target="_blank"
            rel="noopener"
            @click.stop
          >原文 ↗</a>
        </div>
      </article>
    </template>

    <!-- 展开批次：还有未展开的条目就给「加载更多」，全展开后才说「以上是全部」 -->
    <div v-if="displayList.length && hasMoreShown" class="gd-more">
      <button type="button" class="gd-more-btn" @click="loadMoreTop">
        加载更多
        <span class="gd-mono">已显示 {{ displayList.length }} / 共 {{ totalShown }}</span>
      </button>
    </div>
    <p v-if="displayList.length && !hasMoreShown" class="end gd-mono">{{ closingText }}</p>

    <!-- 统计与入口不该挡在「差」前面：二级入口整块下移 -->
    <div class="p-sec"><div class="h">二级入口</div></div>
    <div class="entries">
      <button
        v-for="entry in ENTRIES"
        :key="entry.key"
        type="button"
        class="entry"
        @click="emit('navigate', entry.key)"
      >
        <b>{{ entry.label }}</b>
        <span class="gd-mono">{{ entry.desc }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import GapDualTrack from '../../../components/gapdesk/GapDualTrack.vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapI18nLine from '../../../components/gapdesk/GapI18nLine.vue'
import { EMPTY_WINDOW, GAP_IND_MAP } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import { bandKeyOf, fmtAgo, gapGapTagsOf, gapTagTone } from '../../../utils/gapdeskFormat'
import type { GapInd, RankedEvent } from '../../../types/gapdesk'

const { ranked, topList, loadMoreTop, filters, favorites, laterIds, toggleLater, toggleFavoriteEvent, firstSourceOf, titleOf, i18nStateOf, ensureI18n } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})
const emit = defineEmits<{ navigate: [key: string] }>()

/** 5 个新模块走二级页，底 tab 仍是原来 5 个 */
const ENTRIES = [
  { key: 'm-brief', label: '简报', desc: '每日研判' },
  { key: 'm-echo', label: '命中率', desc: '回打口径' },
  { key: 'm-source-risk', label: '信源', desc: '分级体检' },
  { key: 'm-cycle', label: '周期', desc: '供给日历' },
  { key: 'm-ai', label: 'AI', desc: '权重与引用' }
] as const

/** 与 PC-01 同口径：展开批次作用在筛选后的集合上，不是「全池取前 N 再筛日期」 */
const displayList = computed<RankedEvent[]>(() => {
  if (!filters.dateBand) return topList.value
  return ranked.value.filter((event) => bandKeyOf(event) === filters.dateBand).slice(0, topList.value.length)
})

/** 当前筛选下的池内总条数（不受展开批次限制） */
const totalShown = computed<number>(() =>
  filters.dateBand
    ? ranked.value.filter((event) => bandKeyOf(event) === filters.dateBand).length
    : ranked.value.length
)

/** 当前筛选下是否还有未展开的条目 */
const hasMoreShown = computed<boolean>(() => totalShown.value > displayList.value.length)

const l0 = computed(() => displayList.value.filter((item) => item.tier === 'L0'))
const rest = computed(() => displayList.value.filter((item) => item.tier !== 'L0'))

/** 切换日期带 / 加载更多后新出现的条目也要自动翻译，和 PC 的 GapEventCard 同口径 */
watch(displayList, (list) => ensureI18n(list), { immediate: true })

/**
 * 列表收尾语：live / unknown 不是日期，说「该日期」不成立。
 * 取值与 bandKeyOf 的返回同名，不另立一套判断。
 */
const closingText = computed<string>(() => {
  const band = filters.dateBand
  if (!band) return '以上是今日全部必看'
  if (band === 'live') return '以上是 1 小时内的全部必看'
  if (band === 'unknown') return '以上是时间未知的全部必看'
  return '以上是该日期全部必看'
})

/** 首触来源（谁先报），只取 feed 里真实带回的证据链；没有就返回 null */
const sourceMap = computed<Map<number, { name: string; url: string | null }>>(() => {
  const map = new Map<number, { name: string; url: string | null }>()
  for (const item of displayList.value) {
    const row = firstSourceOf.value(item.id)
    if (row?.source_name) map.set(item.id, { name: row.source_name, url: row.url })
  }
  return map
})
function sourceOf(id: number): { name: string; url: string | null } | null {
  return sourceMap.value.get(id) ?? null
}

const indColor = (ind: GapInd): string => GAP_IND_MAP[ind]?.color ?? 'var(--gd-ink3)'
const indLabel = (ind: GapInd): string => GAP_IND_MAP[ind]?.label ?? '未分类'
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 11px;
  min-width: 0;
}
.mbview > * {
  flex-shrink: 0;
}
.mhead {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}
.m {
  font-family: var(--gd-mono);
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.score {
  margin-left: auto;
  font-size: var(--gd-fs-gscore);
  font-weight: 700;
  color: var(--gd-gap);
}
.row {
  display: flex;
  gap: 7px;
  margin: 2px -3px -3px;
}
.row button {
  flex: 1;
  min-height: 44px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.row button.on {
  background: var(--gd-grad);
  border-color: transparent;
  color: var(--gd-card);
}
.entries {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 8px;
}
.entry {
  min-width: 0;
  min-height: 44px;
  padding: 7px 8px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  text-align: left;
  cursor: pointer;
}
.entry b {
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink);
}
.entry span {
  font-size: var(--gd-fs-kick);
  color: var(--gd-ink3);
  overflow-wrap: anywhere;
}
.end {
  text-align: center;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  padding: 4px 0;
}
.mb-gaptags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
/* L0 卡正文压一行：差在首屏优先，完整结论进详情 */
.p-card .why {
  line-height: 1.5;
  margin: 0;
  font-size: var(--gd-fs-why);
  color: var(--gd-ink2);
}
/* 来源与原文：真实数据才渲染；原文链接给足 44px 触控高度 */
.ft {
  flex-wrap: wrap;
  row-gap: 2px;
}
.src {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gd-ink2);
}
.orig {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 4px;
  color: var(--gd-brand);
  font-family: var(--gd-mono);
  text-decoration: none;
}
</style>

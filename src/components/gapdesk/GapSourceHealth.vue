<!--
  信源健康面板
  ---------------------------------------------------------------
  只呈现 `gap_sources` 表里的真实字段，不做任何推测：
   status=ok 绿点 / fail 红点（标 DOWN）/ 其他黄点；失败的源把 msg 原样摊开
   （例如 `HTTP 418`、`timeout 12000ms`），因为「为什么挂」比「挂了」更有用。
  全挂时顶部给红条并明说「不补假数据」——这是本产品的底线。
-->
<template>
  <div class="gsh" :class="{ 'gsh-in-drawer': drawer }">
    <!-- 顶部汇总 -->
    <div class="gsh-sum" :class="{ 'gsh-sum-bad': total > 0 && ok === 0 }">
      <div class="gsh-sum-main">
        <b class="gd-mono">{{ ok }}/{{ total }}</b>
        <span>路正常</span>
      </div>
      <p v-if="ok === 0 && total > 0" class="gsh-sum-msg">本轮采集全部失败，不补假数据</p>
      <p v-else-if="ok < total" class="gsh-sum-msg gsh-sum-warn">{{ total - ok }} 路异常（含冷却/超时）</p>
      <p v-else-if="total > 0" class="gsh-sum-msg gsh-sum-ok">全部信源正常</p>
      <p v-else class="gsh-sum-msg">还没有健康数据，采集跑完第一轮后出现</p>
    </div>

    <!-- 分组（按 GAP_LAYER_ORDER，可折叠） -->
    <div v-for="group in groups" :key="group.layer" class="gsh-group">
      <button type="button" class="gsh-group-head" @click="toggle(group.layer)">
        <span class="gsh-caret" :class="{ 'gsh-caret-open': expanded.has(group.layer) }">▸</span>
        <span class="gsh-group-lb">{{ group.label }}</span>
        <span class="gsh-group-n">{{ group.rows.length }}</span>
        <span v-if="group.bad" class="gsh-group-bad">{{ group.bad }} DOWN</span>
      </button>

      <ul v-if="expanded.has(group.layer)" class="gsh-rows">
        <li v-for="s in group.rows" :key="s.id" class="gsh-row" :class="{ 'gsh-row-bad': s.status !== 'ok' }">
          <i class="gsh-dot" :class="dotClass(s)" />
          <span class="gsh-name" :title="s.id">{{ s.name }}</span>
          <span class="gsh-items gd-mono">{{ s.items ?? 0 }} 条</span>
          <span class="gsh-lat gd-mono">{{ s.latency_ms ?? 0 }}ms</span>
          <span class="gsh-ok-at gd-mono">{{ s.last_ok ? fmtAgo(Date.parse(s.last_ok)) : '—' }}</span>
          <p v-if="s.status !== 'ok' && s.msg" class="gsh-msg">{{ s.msg }}</p>
        </li>
      </ul>
    </div>

    <!-- 漏斗 -->
    <div v-if="meta" class="gsh-funnel">
      <span class="gsh-funnel-lb">本轮漏斗</span>
      <span class="gsh-funnel-v">
        {{ meta.funnel.raw }} → {{ meta.funnel.exact }} → {{ meta.funnel.event }} → {{ meta.funnel.shown }}
      </span>
      <span class="gsh-funnel-cam">原始 → 精确 → 事件 → 展示</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { GAP_LAYER_LABEL, GAP_LAYER_ORDER } from '../../config/gapdeskConfig'
import { fmtAgo } from '../../utils/gapdeskFormat'
import type { GapSourceRow, GapLayer } from '../../types/gapdesk'

const props = withDefaults(
  defineProps<{
    sources: GapSourceRow[]
    /** 采集元信息（漏斗、生成时间）；缺失时底部不显示 */
    meta?: { funnel: { raw: number; exact: number; event: number; shown: number } } | null
    /** 放在抽屉里时不做 ≤1080px 隐藏（否则抽屉里也会空） */
    drawer?: boolean
  }>(),
  { meta: null, drawer: false }
)

const total = computed(() => props.sources.length)
const ok = computed(() => props.sources.filter((s) => s.status === 'ok').length)

interface GroupRow {
  layer: GapLayer
  label: string
  rows: GapSourceRow[]
  bad: number
}

/** 按层级分组；空层不出空分组 */
const groups = computed<GroupRow[]>(() =>
  GAP_LAYER_ORDER.map((layer) => {
    const rows = props.sources.filter((s) => s.layer === layer)
    return {
      layer,
      label: GAP_LAYER_LABEL[layer] ?? layer,
      rows,
      bad: rows.filter((s) => s.status !== 'ok').length
    }
  }).filter((g) => g.rows.length > 0)
)

/** 默认全部展开：健康面板的价值就在「一眼看到谁挂了」，收起会让它失去意义 */
const expanded = ref<Set<GapLayer>>(new Set(GAP_LAYER_ORDER))

function toggle(layer: GapLayer): void {
  const next = new Set(expanded.value)
  if (next.has(layer)) next.delete(layer)
  else next.add(layer)
  expanded.value = next
}

/** 状态点：ok 绿 / fail 红 / 其余（unknown、warn、冷却）黄 */
function dotClass(s: GapSourceRow): string {
  if (s.status === 'ok') return 'gsh-dot-ok'
  if (s.status === 'fail') return 'gsh-dot-fail'
  return 'gsh-dot-warn'
}
</script>

<style scoped>
.gsh {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.gsh-sum {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--gd-sub);
}
.gsh-sum-bad {
  background: color-mix(in srgb, var(--gd-gap) 10%, var(--gd-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gd-gap) 24%, transparent);
}
.gsh-sum-main {
  display: flex;
  align-items: baseline;
  gap: 5px;
}
.gsh-sum-main b {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--gd-ink);
}
.gsh-sum-bad .gsh-sum-main b {
  color: var(--gd-gap);
}
.gsh-sum-main span {
  font-size: 12px;
  color: var(--gd-ink3);
}
.gsh-sum-msg {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--gd-ink3);
}
.gsh-sum-ok {
  color: var(--gd-ok);
}
.gsh-sum-warn {
  color: var(--gd-warn);
}
.gsh-group {
  border-top: 1px solid var(--gd-line);
  padding-top: 6px;
}
.gsh-group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 44px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
}
.gsh-caret {
  font-size: 12px;
  color: var(--gd-ink3);
  transition: transform 0.15s ease;
}
.gsh-caret-open {
  transform: rotate(90deg);
}
.gsh-group-lb {
  font-size: 11px;
  font-weight: 600;
  color: var(--gd-ink);
}
.gsh-group-n {
  font-size: 12px;
  color: var(--gd-ink3);
  font-variant-numeric: tabular-nums;
}
.gsh-group-bad {
  margin-left: auto;
  font-size: 12px;
  color: var(--gd-gap);
  font-variant-numeric: tabular-nums;
}
.gsh-rows {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.gsh-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  padding: 4px 2px;
  font-size: 11px;
  color: var(--gd-ink2);
  min-width: 0;
}
.gsh-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.gsh-dot-ok {
  background: var(--gd-ok);
}
.gsh-dot-fail {
  background: var(--gd-gap);
}
.gsh-dot-warn {
  background: var(--gd-warn);
}
.gsh-name {
  flex: 1;
  min-width: 0;
  color: var(--gd-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gsh-items,
.gsh-lat,
.gsh-ok-at {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--gd-ink3);
}
.gsh-msg {
  flex-basis: 100%;
  margin: 0 0 0 11px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--gd-gap);
  word-break: break-all;
}
.gsh-funnel {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--gd-line);
}
.gsh-funnel-lb {
  font-size: 12px;
  color: var(--gd-ink3);
}
.gsh-funnel-v {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--gd-ink);
}
.gsh-funnel-cam {
  flex-basis: 100%;
  font-size: 11.5px;
  color: var(--gd-line2);
}

/* 窄屏隐藏（由壳改为 PageHeader 按钮 + 抽屉承载）；抽屉内实例通过 drawer 关闭此规则 */
@media (max-width: 1080px) {
  .gsh:not(.gsh-in-drawer) {
    display: none;
  }
}
</style>

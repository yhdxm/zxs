<!--
  差值事件卡 · gcard 皮肤
  ---------------------------------------------------------------
  信息顺序就是判断顺序：层级/行业/序号 → GAP 分 → 标题 → 四维微条
  → 为什么算差 → 双轨差值 → 操作（详情/稍后读/归档/喜欢）。
  没有的字段不渲染假值：理由为空显示「—」，无原文链接就不给链接位。
-->
<template>
  <article
    class="gd-gcard gcard"
    :class="[tier ? `t-${tier}` : '', { focus: active }]"
    @click="emit('open', event.id)"
  >
    <div class="gc-main">
      <div class="row1">
        <i class="dot" :style="{ background: indOption.color }" aria-hidden="true" />
        <span class="ind">{{ indOption.label }}</span>
        <span v-if="tier" class="badge gd-mono" :class="tier.toLowerCase()">{{ tier }}</span>
        <span class="num gd-mono">#{{ rank ?? '—' }}</span>
        <span class="tm gd-mono">{{ timeText }}</span>
      </div>

      <h3 class="ttl">{{ event.title }}</h3>

      <div class="gc-dims" aria-label="四维分解">
        <span v-for="seg in dims" :key="seg.label" class="gc-dim">
          <span>{{ seg.label }}</span>
          <i><b :style="{ width: `${seg.pct}%` }" /></i>
          <em class="gd-mono">{{ seg.value }}</em>
        </span>
      </div>

      <p class="why">{{ event.reason || '—' }}</p>

      <GapDualTrack
        compact
        :ins-heat="event.ins_heat ?? 0"
        :pub-heat="event.pub_heat ?? 0"
        :gap="event.gap"
      />

      <div class="cardfoot">
        <span class="gscore gd-mono" :class="tier ? tier.toLowerCase() : ''">{{ event.gap }}</span>
        <span class="glab gd-mono">GAP</span>
        <span class="dims gd-mono">{{ event.src_count }} 路源 · {{ layerLabel }}</span>
        <span v-if="source?.name" class="src gd-mono" :title="`首触来源：${source.name}`">{{ source.name }}</span>
        <a
          v-if="source?.url"
          class="orig gd-mono"
          :href="source.url"
          target="_blank"
          rel="noopener"
          @click.stop
        >原文 ↗</a>
        <div class="acts" @click.stop>
          <button type="button" class="act gd-mono" @click="emit('open', event.id)">详情</button>
          <button
            type="button"
            class="act gd-mono"
            :class="{ on: later }"
            :title="later ? '移出稍后读' : '加入稍后读（仅本机）'"
            @click="emit('later', event.id)"
          >稍后读</button>
          <button type="button" class="act gd-mono" :title="EMPTY_ARCHIVE" @click="emit('archive', event.id)">归档</button>
          <button
            type="button"
            class="act gd-mono"
            :class="{ on: favorite }"
            :title="favorite ? '取消喜欢' : '喜欢'"
            @click="onLike"
          >喜欢</button>
        </div>
      </div>
    </div>

    <div class="gc-side">
      <span class="conf gd-mono" :class="confClass">{{ confText }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GapDualTrack from './GapDualTrack.vue'
import { EMPTY_ARCHIVE, GAP_IND_MAP, GAP_LAYER_LABEL } from '../../config/gapdeskConfig'
import { fmtAgo, safeJson } from '../../utils/gapdeskFormat'
import type { GapEventRow, GapInd, GapTier, RankedEvent } from '../../types/gapdesk'

const props = withDefaults(
  defineProps<{
    /** 新版传 RankedEvent；旧视图仍传 GapEventRow，此时层级/序号显示「—」不伪造 */
    event: RankedEvent | GapEventRow
    active?: boolean
    favorite?: boolean
    later?: boolean
    /** 首触来源（谁先报）：不传就整块不渲染，绝不编造来源名 */
    source?: { name: string; url: string | null } | null
  }>(),
  { active: false, favorite: false, later: false, source: null }
)

const emit = defineEmits<{
  open: [id: number]
  later: [id: number]
  archive: [id: number]
  like: [id: number]
  /** 兼容旧视图的事件名 */
  favorite: [id: number]
}>()

/** 喜欢/收藏双事件名一起发，新视图听 like，旧视图听 favorite */
function onLike(): void {
  emit('like', props.event.id)
  emit('favorite', props.event.id)
}

const tier = computed<GapTier | null>(() => ('tier' in props.event ? props.event.tier : null))
const rank = computed<number | null>(() => ('rank' in props.event ? props.event.rank : null))

const indOption = computed(() => {
  const hit = GAP_IND_MAP[props.event.ind as GapInd]
  return hit ?? { key: props.event.ind, label: String(props.event.ind || '未分类'), color: 'var(--gd-ink3)' }
})

const layerLabel = computed(() => GAP_LAYER_LABEL[props.event.kind] ?? '情报')

/** 有发布时间显示「发布距今」，ts=0 如实写「入池距今」 */
const timeText = computed(() =>
  props.event.ts_published > 0
    ? fmtAgo(props.event.ts_published)
    : `入池 ${fmtAgo(props.event.ts_first_seen)}`
)

const DIM_LABELS = ['时效', '稀缺', '影响', '可行动'] as const
const dims = computed(() => {
  const raw = typeof props.event.b_json === 'string'
    ? safeJson<unknown>(props.event.b_json, null)
    : props.event.b_json
  const values = Array.isArray(raw) && raw.length === 4 ? raw : [0, 0, 0, 0]
  return DIM_LABELS.map((label, i) => {
    const n = Number(values[i])
    const value = Number.isFinite(n) ? Math.max(0, Math.min(25, Math.round(n))) : 0
    return { label, value, pct: Math.round((value / 25) * 100) }
  })
})

/** 孤证系数：仅 1 路源时显式降级显示，不用百分比伪装置信度 */
const confClass = computed(() => (props.event.src_count <= 1 ? 'c1' : props.event.src_count >= 3 ? 'c3' : 'c2'))
const confText = computed(() => (props.event.src_count <= 1 ? '孤证' : `${props.event.src_count} 源`))
</script>

<style scoped>
/* 只消费 .gd-stage 上的令牌，不写死色值/字号 */
.gcard {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all .18s var(--gd-ease);
  position: relative;
  overflow: hidden;
}
.gcard:hover {
  border-color: var(--gd-line2);
  box-shadow: var(--gd-sh-md);
  transform: translateY(-2px);
}
.gcard.focus {
  border-color: var(--gd-brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--gd-brand) 13%, transparent);
}
.gcard::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  opacity: 1;
}
.gcard.t-L0::before { background: linear-gradient(180deg, var(--gd-gap), var(--gd-gap2)); }
.gcard.t-L1::before { background: linear-gradient(180deg, var(--gd-brand), var(--gd-brand2)); }
.gcard.t-L2::before { background: var(--gd-line2); }

.gc-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-wrap: anywhere;
}
.gc-side {
  width: 60px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 0;
}
.row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}
.ind {
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
}
.badge {
  height: 18px;
  padding: 0 7px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  font-size: var(--gd-fs-pill);
  font-weight: 700;
  color: var(--gd-card);
}
.badge.l0 { background: linear-gradient(135deg, var(--gd-gap), var(--gd-gap2)); }
.badge.l1 { background: var(--gd-grad2); color: var(--gd-card); }
.badge.l2 { background: var(--gd-line); color: var(--gd-ink2); }
.num, .tm {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.ttl {
  margin: 0;
  font-size: var(--gd-fs-ttl);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -.1px;
  color: var(--gd-ink);
  overflow-wrap: anywhere;
}
.gc-dims {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.gc-dim {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gc-dim i {
  display: block;
  width: 34px;
  height: 4px;
  border-radius: 999px;
  background: var(--gd-line);
  overflow: hidden;
}
.gc-dim b {
  display: block;
  height: 100%;
  background: var(--gd-brand);
}
.gc-dim em {
  font-style: normal;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink2);
}
.why {
  margin: 0;
  font-size: var(--gd-fs-why);
  line-height: 1.55;
  color: var(--gd-ink2);
  overflow-wrap: anywhere;
}
.cardfoot {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.gscore {
  font-size: var(--gd-fs-gscore);
  font-weight: 700;
  line-height: 1;
  color: var(--gd-ink);
}
.gscore.l0 { background: var(--gd-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.gscore.l2 { color: var(--gd-ink3); }
.glab, .dims {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.src {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink2);
  max-width: 148px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.orig {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 4px;
  font-size: var(--gd-fs-pill);
  color: var(--gd-brand);
  text-decoration: none;
}
.orig:hover {
  text-decoration: underline;
}
.acts {
  display: flex;
  gap: 3px;
  margin-left: auto;
  flex-shrink: 0;
}
.act {
  min-height: 44px;
  padding: 0 8px;
  border: 1px solid var(--gd-line);
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-size: var(--gd-fs-pill);
  border-radius: 6px;
  cursor: pointer;
  transition: all .15s var(--gd-ease);
}
.act:hover {
  border-color: var(--gd-brand);
  color: var(--gd-brand);
}
.act.on {
  background: var(--gd-grad);
  border-color: transparent;
  color: var(--gd-card);
}
.conf {
  height: 18px;
  padding: 0 7px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  font-size: var(--gd-fs-pill);
}
.conf.c3 { background: color-mix(in srgb, var(--gd-ok) 12%, var(--gd-card)); color: var(--gd-ok); }
.conf.c2 { background: var(--gd-sub); color: var(--gd-ink2); }
.conf.c1 { background: color-mix(in srgb, var(--gd-warn) 12%, var(--gd-card)); color: var(--gd-warn); }
</style>

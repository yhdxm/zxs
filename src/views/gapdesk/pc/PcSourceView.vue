<!--
  PC-07 单源情报
  目录来自 bySource（真实证据链分组），健康四卡读 gap_sources 真值。
  silent 源如实写「今日未说话」，不把沉默误报成故障；没有证据链时给空态。
-->
<template>
  <div class="pcview">
    <div class="gh">
      <i class="bar" aria-hidden="true" />
      <span class="t">单源情报 · {{ groups.length }} 路有证据行</span>
      <span class="r">今日未说话 {{ silentCount }} 路</span>
    </div>

    <GapEmptyState v-if="!groups.length" type="empty" :desc="EMPTY_WAIT" />

    <div v-else class="source-layout">
      <aside class="srclist">
        <template v-for="section in layerGroups" :key="section.key">
          <div class="gl gd-mono">{{ section.label }} · {{ section.groups.length }} 路</div>
          <button
            v-for="group in section.groups"
            :key="group.source"
            type="button"
            class="srcitem"
            :class="{ on: selected === group.source }"
            @click="selected = group.source"
          >
            <i class="dot" :style="{ background: statusOf(group.source).color }" aria-hidden="true" />
            <span class="srcname">{{ group.source }}</span>
            <span class="ct gd-mono">{{ group.events.length }}</span>
          </button>
        </template>
      </aside>

      <div class="vcol" v-if="current">
        <div class="hero">
          <div class="hcard"><span class="n grad">{{ valueOf('ok') }}</span><span class="l">本轮成功抓取</span><span class="d">失败 {{ valueOf('fail') }} 次</span></div>
          <div class="hcard"><span class="n">{{ valueOf('latency_ms') }}</span><span class="l">响应延迟（ms）</span><span class="d">最近一次实测</span></div>
          <div class="hcard"><span class="n gr2">{{ valueOf('items') }}</span><span class="l">本轮条目</span><span class="d">源表实测</span></div>
          <div class="hcard"><span class="n" :style="{ color: statusOf(current.source).color }">{{ statusOf(current.source).text }}</span><span class="l">当前健康状态</span><span class="d">{{ current.silent ? '今日未说话' : '今日有证据行' }}</span></div>
        </div>

        <section class="panel">
          <div class="row1">
            <span>{{ current.source }}</span>
            <span class="gd-pill gd-pill-soft gd-mono">{{ layerLabel(current.layer) }}</span>
          </div>
          <p class="panel-note">
            <template v-if="current.silent">该源今日未说话。信源在跑，只是今天它没说话。</template>
            <template v-else>该源今日有真实证据行，已参与下方差值列表。</template>
            <br />{{ current.layer === 'mass' ? '大众探针只判断出圈，不计入差值评分。' : '该源进入候选池，参与聚类与评分。' }}
          </p>
        </section>

        <div class="gh">
          <i class="bar" aria-hidden="true" />
          <span class="t">该源参与的差值</span>
          <span class="b">{{ current.events.length }}</span>
        </div>

        <GapEmptyState v-if="!current.events.length" type="empty" :desc="EMPTY_WAIT" />
        <GapEventCard
          v-for="item in current.events"
          :key="item.id"
          :event="item"
          @open="openDetail"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapEventCard from '../../../components/gapdesk/GapEventCard.vue'
import { EMPTY_WAIT, GAP_LAYER_MAP, GAP_LAYER_ORDER } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'
import type { GapLayer } from '../../../types/gapdesk'

const { bySource, sources } = useGapDesk()
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})

const groups = computed(() => bySource.value)

/**
 * 分组唯一真源：层级顺序与标签都取自 config，避免再出现「rare 层漏写」。
 * layer 为 null 的证据行归入「未知层」兜底，保证表头数字与列表条目一致。
 */
const layerGroups = computed(() => {
  const sections = GAP_LAYER_ORDER.map((key) => ({
    key: key as string,
    label: GAP_LAYER_MAP[key].label,
    groups: groups.value.filter((group) => group.layer === key)
  }))
  sections.push({
    key: 'unknown',
    label: '未知层',
    groups: groups.value.filter((group) => !group.layer)
  })
  return sections.filter((section) => section.groups.length > 0)
})
const selected = ref(groups.value[0]?.source ?? '')
watch(groups, (list) => {
  if (!list.some((group) => group.source === selected.value)) selected.value = list[0]?.source ?? ''
})

const current = computed(() => groups.value.find((group) => group.source === selected.value) ?? null)
const silentCount = computed(() => groups.value.filter((group) => group.silent).length)

function layerLabel(layer: GapLayer | null): string {
  return (layer ? GAP_LAYER_MAP[layer].label : '') || '未知层'
}

function sourceRow(source: string) {
  return sources.value.find((row) => row.name === source || row.id === source) ?? null
}

/** 库里是 null 就显示「—」，绝不把 null 当 0 */
function valueOf(field: 'ok' | 'fail' | 'latency_ms' | 'items'): string {
  const row = current.value ? sourceRow(current.value.source) : null
  const value = row?.[field]
  return value == null ? '—' : String(value)
}

function statusOf(source: string): { text: string; color: string } {
  const row = sourceRow(source)
  if (!row) return { text: '—', color: 'var(--gd-ink3)' }
  if (row.status === 'ok') return { text: '正常', color: 'var(--gd-ok)' }
  if (row.status === 'fail') return { text: '失败', color: 'var(--gd-gap)' }
  return { text: '部分失败', color: 'var(--gd-warn)' }
}
</script>

<style scoped>
.source-layout {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
}
.srclist {
  width: 220px;
  flex: none;
  background: var(--gd-card);
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-panel);
  padding: 9px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: calc(100dvh - 180px);
  overflow-y: auto;
}
.gl {
  font-size: var(--gd-fs-kick);
  color: var(--gd-ink3);
  letter-spacing: .6px;
  padding: 8px 8px 2px;
}
.srcitem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 7px 9px;
  border: 0;
  border-radius: var(--gd-r-nav);
  background: transparent;
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
  text-align: left;
}
.srcitem:hover,
.srcitem.on {
  background: color-mix(in srgb, var(--gd-brand) 8%, var(--gd-card));
  color: var(--gd-brand);
}
.srcname {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ct {
  flex: none;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--gd-sub);
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.vcol {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.vcol > * {
  flex-shrink: 0;
}
@media (max-width: 1140px) {
  .source-layout { flex-direction: column; }
  .srclist { width: 100%; max-height: 180px; }
}
</style>

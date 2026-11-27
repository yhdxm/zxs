<!--
  移动-04 信息详情（二级页）
  五段 p-sec 与 PC 抽屉同口径；证据链只读真实 evidences，未触达如实标注。
-->
<template>
  <div class="mbview">
    <header class="head">
      <button type="button" class="back" @click="emit('navigate', 'm-latest')">← 返回</button>
      <span class="gd-pill gd-pill-acc gd-mono">{{ event?.tier ?? '—' }}</span>
    </header>

    <template v-if="event">
      <section class="p-sec">
        <div class="h">结论</div>
        <p class="why">{{ event.title }}</p>
        <p class="gd-mono meta">GAP {{ event.gap }} · 原始 {{ event.gap_raw }}/90 · 池内第 {{ event.rank }} 位</p>
        <p class="why">{{ event.reason || '—' }}</p>
        <p v-if="event.action" class="act">{{ event.action }}</p>
      </section>

      <section class="p-sec">
        <div class="h">双轨差值</div>
        <GapDualTrack :ins-heat="event.ins_heat ?? 0" :pub-heat="event.pub_heat ?? 0" :gap="event.gap" />
      </section>

      <section class="p-sec">
        <div class="h">四维分解</div>
        <GapScoreBlock :event="event" />
      </section>

      <section class="p-sec">
        <div class="h">证据链 · 按发布时间升序</div>
        <p v-if="!evidenceRows.length" class="why">库中没有该事件的证据行（可能刚入库，下一轮补齐）</p>
        <div v-for="row in evidenceRows" :key="row.id" class="ev">
          <div class="row1">
            <b>{{ row.source_name || '未知来源' }}</b>
            <span class="gd-mono m">{{ row.publish_ts && row.publish_ts > 0 ? fmtClock(row.publish_ts) : '时间未知' }}</span>
          </div>
          <a v-if="row.url" class="link gd-mono" :href="row.url" target="_blank" rel="noopener">打开原文 ↗</a>
          <span v-else class="m gd-mono">未触达 · 不补假数据</span>
        </div>
      </section>

      <section class="p-sec">
        <div class="h">Echo 回打</div>
        <p class="why">{{ EMPTY_ECHO }}</p>
      </section>
    </template>

    <GapEmptyState v-else type="empty" :title="EMPTY_MISSING_TITLE" :desc="EMPTY_MISSING" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GapDualTrack from '../../../components/gapdesk/GapDualTrack.vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import GapScoreBlock from '../../../components/gapdesk/GapScoreBlock.vue'
import { EMPTY_ECHO, EMPTY_MISSING, EMPTY_MISSING_TITLE } from '../../../config/gapdeskConfig'
import { useGapDesk } from '../../../composables/useGapDesk'
import { fmtClock } from '../../../utils/gapdeskFormat'

const emit = defineEmits<{ navigate: [key: string] }>()
const { ranked, evidences } = useGapDesk()
const route = useRoute()

const event = computed(() => {
  const raw = Array.isArray(route.query.id) ? route.query.id[0] : route.query.id
  const id = Number(raw)
  // 无效 / 过期 id 走既有 GapEmptyState，不静默展示另一条事件的详情（那会误导判断）
  if (!Number.isFinite(id) || id <= 0) return null
  return ranked.value.find((row) => row.id === id) ?? null
})

const evidenceRows = computed(() => {
  const id = event.value?.id
  return id == null ? [] : evidences.value.filter((row) => row.event_id === id)
})
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 13px;
  min-width: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.back {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--gd-line2);
  border-radius: var(--gd-r-nav);
  background: var(--gd-card);
  color: var(--gd-ink2);
  font-family: var(--gd-sans);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.why {
  margin: 0;
  font-size: var(--gd-fs-why);
  line-height: 1.65;
  color: var(--gd-ink2);
  overflow-wrap: anywhere;
}
.meta,
.m {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.act {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--gd-r-nav);
  background: color-mix(in srgb, var(--gd-ok) 10%, var(--gd-card));
  color: var(--gd-ok);
  font-size: var(--gd-fs-why);
  line-height: 1.6;
}
.ev {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 11px;
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-gcard);
  background: var(--gd-sub);
}
.link {
  color: var(--gd-brand);
  font-size: var(--gd-fs-panels);
  text-decoration: none;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
</style>

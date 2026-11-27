<!--
  差值台 GAPDESK · Echo 传播链（PC / 移动同源同口径）
  ---------------------------------------------------------------
  用 useGapDesk().echoChains：同一事件内按 publish_ts 排序的跨源首触序列。
  这是「谁先报、谁跟、隔多久」的实测，不是回打兑现率——兑现率没有回打表就是没有。
  每条链首触高亮，跟发标注小时差；无样本显示口径文案，不画假曲线。
-->
<template>
  <section class="gec" :class="{ 'gec-mb': mobile }">
    <div class="gec-h">
      <i class="gd-bar" aria-hidden="true" />
      <span class="gec-t">跨源传播链 · 实测</span>
      <span class="gec-n gd-mono">{{ chains.length }} 条有双源时戳</span>
    </div>

    <p v-if="!chains.length" class="gec-empty gd-mono">— {{ EMPTY_ECHO }}：还没有可计算的双源时戳样本。</p>

    <ul v-else class="gec-list">
      <li v-for="chain in chains.slice(0, limit)" :key="chain.eventId" class="gec-chain">
        <div class="gec-chain-h">
          <span class="gec-title" :title="chain.title">{{ chain.title }}</span>
          <span class="gec-span gd-mono" :title="`跨源首触跨度 ${chain.spanH} 小时`">跨度 {{ chain.spanH }}h</span>
        </div>
        <ol class="gec-hops">
          <li
            v-for="(hop, i) in chain.hops.slice(0, 6)"
            :key="`${hop.source}-${hop.ts}`"
            class="gec-hop"
            :class="{ first: i === 0 }"
          >
            <span v-if="i === 0" class="gec-first gd-mono">首触</span>
            <span v-else class="gec-lag gd-mono">+{{ hop.lagH }}h</span>
            <span class="gec-src">{{ hop.source }}</span>
          </li>
        </ol>
      </li>
    </ul>

    <p class="gec-note">{{ ECHO_CHAIN_NOTE }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EMPTY_ECHO } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'

withDefaults(defineProps<{ mobile?: boolean; limit?: number }>(), { mobile: false, limit: 6 })

const { echoChains } = useGapDesk()
const chains = computed(() => echoChains.value)
const ECHO_CHAIN_NOTE =
  '跨度=同事件最晚源与最早源的真实时间差；同源重复只记最早一条；无时间戳的证据行不参与计算。'
</script>

<style scoped>
.gec {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  background: var(--gd-card);
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-panel);
  padding: 10px 12px;
}
.gec-h {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.gec-t {
  font-size: var(--gd-fs-panels);
  font-weight: 600;
  color: var(--gd-ink);
}
.gec-n {
  margin-left: auto;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gec-empty,
.gec-note {
  margin: 0;
  font-size: var(--gd-fs-pill);
  line-height: 1.5;
  color: var(--gd-ink3);
}
.gec-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gec-chain {
  border-top: 1px solid var(--gd-line);
  padding-top: 7px;
}
.gec-chain:first-child {
  border-top: 0;
  padding-top: 0;
}
.gec-chain-h {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.gec-title {
  flex: 1;
  min-width: 0;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gec-span {
  flex: none;
  font-size: var(--gd-fs-pill);
  color: var(--gd-brand);
}
.gec-hops {
  list-style: none;
  margin: 5px 0 0;
  padding: 0 0 0 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  border-left: 2px solid var(--gd-line2);
}
.gec-hop {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink2);
}
.gec-hop.first {
  color: var(--gd-brand);
  font-weight: 600;
}
.gec-first,
.gec-lag {
  flex: none;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: var(--gd-fs-pill);
}
.gec-first {
  color: var(--gd-card);
  background: var(--gd-brand);
}
.gec-lag {
  color: var(--gd-ink3);
  background: var(--gd-sub);
}
.gec-src {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gec-mb .gec-chain-h {
  min-height: 44px;
}
</style>

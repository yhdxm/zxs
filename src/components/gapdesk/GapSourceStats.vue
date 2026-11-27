<!--
  差值台 GAPDESK · 逐源实测统计（PC / 移动同源同口径）
  ---------------------------------------------------------------
  只呈现 useGapDesk().sourceHealthStats 的 48h 证据链真值：
  首报次数 / 交叉次数 / 孤证次数 / 滞后中位（小时）/ 首报占比。
  无样本时显示「待采」，不写死数字、不推测、不补假数据。
-->
<template>
  <section class="gss" :class="{ 'gss-mb': mobile }">
    <div class="gss-h">
      <i class="gd-bar" aria-hidden="true" />
      <span class="gss-t">逐源实测 · 48h 池</span>
      <span class="gss-n gd-mono">{{ rows.length }} 源有证据行</span>
    </div>

    <p v-if="!rows.length" class="gss-empty gd-mono">— {{ EMPTY_WAIT }}：还没有可统计的证据链。</p>

    <template v-else>
      <div class="gss-head gd-mono" aria-hidden="true">
        <span>信源</span><span>首报</span><span>交叉</span><span>孤证</span><span>滞后h</span>
      </div>
      <ul class="gss-list">
        <li v-for="row in rows.slice(0, limit)" :key="row.source" class="gss-row">
          <span class="gss-src" :title="row.source">{{ row.source }}</span>
          <span class="gss-first gd-mono" :class="{ hot: row.firstCount > 0 }">{{ row.firstCount }}</span>
          <span class="gss-cross gd-mono">{{ row.crossCount }}</span>
          <span class="gss-lone gd-mono" :class="{ warn: row.loneCount > 0 }">{{ row.loneCount }}</span>
          <span class="gss-lag gd-mono">{{ row.lagH === null ? '—' : row.lagH }}</span>
        </li>
      </ul>
      <p class="gss-note">首报=该源最早发布且被采到的次数；滞后=相对同事件首报源的小时中位；孤证=仅此一源的条数。</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EMPTY_WAIT } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'

withDefaults(defineProps<{ mobile?: boolean; limit?: number }>(), { mobile: false, limit: 10 })

const { sourceHealthStats } = useGapDesk()
const rows = computed(() => sourceHealthStats.value)
</script>

<style scoped>
.gss {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  background: var(--gd-card);
  border: 1px solid var(--gd-line);
  border-radius: var(--gd-r-panel);
  padding: 10px 12px;
}
.gss-h {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.gss-t {
  font-size: var(--gd-fs-panels);
  font-weight: 600;
  color: var(--gd-ink);
}
.gss-n {
  margin-left: auto;
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.gss-empty,
.gss-note {
  margin: 0;
  font-size: var(--gd-fs-pill);
  line-height: 1.5;
  color: var(--gd-ink3);
}
.gss-head,
.gss-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 46px 46px 46px 52px;
  align-items: center;
  gap: 4px;
}
.gss-head {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
  padding: 4px 0;
  border-bottom: 1px solid var(--gd-line);
}
.gss-head span:not(:first-child),
.gss-row span:not(:first-child) {
  text-align: right;
}
.gss-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.gss-row {
  min-height: 32px;
  font-size: var(--gd-fs-panels);
  color: var(--gd-ink2);
  border-bottom: 1px solid var(--gd-line);
}
.gss-row:last-child {
  border-bottom: 0;
}
.gss-src {
  color: var(--gd-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gss-first.hot {
  color: var(--gd-brand);
  font-weight: 700;
}
.gss-lone.warn {
  color: var(--gd-warn);
}
.gss-lag {
  color: var(--gd-ink3);
}
/* 移动端：行高 ≥44px 拇指友好，数字列等比放大 */
.gss-mb .gss-row {
  min-height: 44px;
}
.gss-mb .gss-head,
.gss-mb .gss-row {
  grid-template-columns: minmax(0, 1fr) 40px 40px 40px 48px;
}
</style>

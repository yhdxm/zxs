<!--
  移动-06 稍后读清单（二级页）
  与 PC 右栏同一份 store：laterList 里是完整 feed 中真实存在的事件，
  点条目走宿主 provide 的 GAP_OPEN_DETAIL_KEY 打开同一个详情抽屉，不另建状态。
-->
<template>
  <div class="mbview">
    <header class="head">
      <button type="button" class="back" @click="emit('navigate', 'm-latest')">← 返回</button>
      <span class="gd-pill gd-pill-acc gd-mono">稍后读 {{ laterIds.length }}</span>
    </header>

    <GapEmptyState v-if="!laterList.length" type="empty" :desc="GAP_LATER_EMPTY" />

    <template v-else>
      <div class="p-sec">
        <div class="h">我的清单 · {{ laterList.length }} 条</div>
      </div>
      <article v-for="ev in laterList" :key="ev.id" class="p-card" @click="openDetail(ev.id)">
        <div class="mhead">
          <span class="gd-mono score">{{ ev.gap }}</span>
          <span v-if="rankById.has(ev.id)" class="gd-mono rank">#{{ rankById.get(ev.id) }}</span>
          <span class="gd-mono tier">{{ ev.kind }}</span>
        </div>
        <p class="why">{{ titleOf(ev) }}</p>
        <div class="row" @click.stop>
          <button type="button" @click="openDetail(ev.id)">看详情</button>
        </div>
      </article>
      <p v-if="missingLaterCount" class="note gd-mono">{{ GAP_LATER_MISSING }}</p>
      <p v-if="laterLocalOnly" class="note gd-mono">gap_later 表不可用，当前仅本机保存</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import GapEmptyState from '../../../components/gapdesk/GapEmptyState.vue'
import { GAP_LATER_EMPTY, GAP_LATER_MISSING } from '../../../config/gapdeskConfig'
import { GAP_OPEN_DETAIL_KEY, useGapDesk } from '../../../composables/useGapDesk'

const emit = defineEmits<{ navigate: [key: string] }>()
const { laterIds, laterList, laterLocalOnly, ranked, titleOf } = useGapDesk()
/** 沿用宿主注入的详情入口：PC 右栏与移动端清单打开的是同一个抽屉 */
const openDetail = inject(GAP_OPEN_DETAIL_KEY, (_id: number) => {})
const rankById = computed(() => new Map(ranked.value.map((row) => [row.id, row.rank])))
const missingLaterCount = computed(() => Math.max(0, laterIds.value.length - laterList.value.length))
</script>

<style scoped>
.mbview {
  display: flex;
  flex-direction: column;
  gap: 11px;
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
.mhead {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.score {
  font-size: var(--gd-fs-gscore);
  font-weight: 700;
  color: var(--gd-gap);
}
.rank,
.tier {
  font-size: var(--gd-fs-pill);
  color: var(--gd-ink3);
}
.why {
  margin: 0;
  font-size: var(--gd-fs-why);
  line-height: 1.6;
  color: var(--gd-ink2);
  overflow-wrap: anywhere;
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
.note {
  font-size: var(--gd-fs-pill);
  line-height: 1.5;
  color: var(--gd-ink3);
}
</style>

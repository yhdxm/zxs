<!--
  差值台 GAPDESK · 手机壳
  不是 PC 的缩放稿：独立状态栏 / 标题栏 / 数据年龄提示 / 滚动区 / 5 个底 tab。
  真机 ≤768px 由 layout.css 拆掉样机外框并让出安全区。
-->
<template>
  <div class="gd-mb-stage">
    <!-- 假状态栏：真机上由 layout.css 隐藏（系统状态栏已经存在） -->
    <div class="p-status gd-mono" aria-hidden="true">
      <span>--:--</span>
      <span class="gd-spacer" />
      <span>5G</span>
      <span>▮▮▮</span>
    </div>

    <div class="p-head">
      <span class="p-t">{{ title }}</span>
      <span class="gd-spacer" />

      <!-- 状态胶囊自带，真机看不到 PC 顶栏；与 PC 顶栏共用同一份数据年龄与分档 -->
      <span class="p-pillbtn" :title="dataFreshnessTitle">
        <span class="gd-pill gd-mono p-pill-sm p-age-pill" :class="'gd-age-' + dataFreshnessTone">
          {{ dataAgeText }}
        </span>
      </span>
      <span class="p-pillbtn" title="今日 L0 必看条数">
        <span class="gd-pill gd-pill-acc gd-mono p-pill-sm">{{ l0Count === null ? '—' : l0Count }} 条 L0</span>
      </span>

      <!-- 清理入口：44×44 触控区，不占底部 5 tab；仅管理员渲染 -->
      <button
        v-if="canPurge"
        class="p-purge"
        type="button"
        title="清理过期数据"
        aria-label="清理过期数据"
        @click="emit('purge')"
      ><i aria-hidden="true" /></button>

      <!-- 桌面样机上的回 PC 入口；真机按 ≤768px 强制手机壳，点了也会自动回手机壳 -->
      <button class="p-pillbtn p-pcbtn" type="button" title="切回 PC 版" @click="emit('switch-dev')">
        <span class="gd-pill gd-pill-soft gd-mono p-pill-sm">PC</span>
      </button>
      <button class="p-exit" type="button" title="返回工作台" aria-label="返回工作台" @click="emit('exit')">
        <i aria-hidden="true" />
      </button>
    </div>

    <!-- 不再按 isLive 二元切换：数据来自采集，只是可能滞后；提示对新鲜数据同样成立 -->
    <div class="p-note">{{ EMPTY_DEMO }}</div>

    <!-- 日期条槽：默认渲染真实日期胶囊（当前日渐变紫），各屏也可用 datebar 槽覆盖 -->
    <slot name="datebar">
      <div class="p-datebar gd-mono">
        <GapDateStrip :bands="dateBands" :active="activeBand" @pick="onPick" />
      </div>
    </slot>

    <div class="p-body">
      <slot />
    </div>

    <div class="p-tab">
      <div class="p-tabrow">
        <button
          v-for="item in TABS"
          :key="item.key"
          type="button"
          class="p-tabbtn"
          :class="{ on: tab === item.key }"
          :aria-current="tab === item.key ? 'page' : undefined"
          @click="emit('tab', item.key)"
        >
          <span class="ind" aria-hidden="true" />
          <span class="lb">{{ item.label }}</span>
        </button>
      </div>
      <div class="p-safe" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GapDateStrip from './GapDateStrip.vue'
import { EMPTY_DEMO } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'

const {
  dateBands,
  canPurge,
  filters,
  dataAgeText,
  dataFreshnessTone,
  dataFreshnessTitle
} = useGapDesk()
/** 高亮只从 store 的筛选派生，不允许有第二份本地状态（否则筛了日期再切视图会漂移） */
const activeBand = computed<string>(() => filters.dateBand)
function onPick(key: string): void {
  filters.dateBand = filters.dateBand === key ? '' : key
}

interface MobileTab {
  key: string
  label: string
}

/** 5 个底 tab：最新 / 行业 / 全景 / 单源 / 价格 */
const TABS: readonly MobileTab[] = [
  { key: 'm-latest', label: '最新' },
  { key: 'm-profile', label: '行业' },
  { key: 'm-matrix', label: '全景' },
  { key: 'm-source', label: '单源' },
  { key: 'm-pricing', label: '价格' }
]

withDefaults(
  defineProps<{
    title?: string
    /** @deprecated 宿主仍在传 isLive；手机壳已改用共享数据年龄，保留 prop 只是不破坏调用方 */
    live?: boolean
    /** null = 未知，显示「—」，不写死条数 */
    l0Count?: number | null
    tab?: string
  }>(),
  { title: '最新信息', live: false, l0Count: null, tab: 'm-latest' }
)

const emit = defineEmits<{
  tab: [key: string]
  'switch-dev': []
  exit: []
  purge: []
}>()
</script>

<style scoped>
/* 与 PC 顶栏同一套新鲜度配色：绿=新、黄=旧但可用、灰=时间未知 */
.gd-age-fresh {
  background: #E6F9F2;
  color: var(--gd-ok, #159c72);
  font-weight: 700;
}
.gd-age-aging {
  background: #FFF4DE;
  color: #946200;
  font-weight: 700;
  border: 1px solid #F3D9A4;
}
.gd-age-old,
.gd-age-unknown {
  background: #F0F4FB;
  color: var(--gd-ink2, #5d6b82);
  font-weight: 700;
  border: 1px solid var(--gd-line2, #dbe3ef);
}
/* 手机头寸更紧：只缩字号与内边距，文案与 PC 完全一致 */
.p-age-pill {
  padding: 0 5px;
  font-size: 9px;
  white-space: nowrap;
}
</style>

<!--
  差值台 GAPDESK · 手机壳
  不是 PC 的缩放稿：独立状态栏 / 标题栏 / 演示提示 / 滚动区 / 5 个底 tab。
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

      <!-- 状态胶囊自带，真机看不到 PC 顶栏 -->
      <span class="p-pillbtn" :title="live ? '网关已连接' : '未连上网关，当前为演示数据'">
        <span class="gd-pill gd-mono p-pill-sm" :class="live ? 'gd-pill-live' : 'gd-pill-demo'">
          {{ live ? 'LIVE' : 'DEMO' }}
        </span>
      </span>
      <span class="p-pillbtn" title="今日 L0 必看条数">
        <span class="gd-pill gd-pill-acc gd-mono p-pill-sm">{{ l0Count === null ? '—' : l0Count }} 条 L0</span>
      </span>

      <!-- 桌面样机上的回 PC 入口；真机按 ≤768px 强制手机壳，点了也会自动回手机壳 -->
      <button class="p-pillbtn p-pcbtn" type="button" title="切回 PC 版" @click="emit('switch-dev')">
        <span class="gd-pill gd-pill-soft gd-mono p-pill-sm">PC</span>
      </button>
      <button class="p-exit" type="button" title="返回工作台" aria-label="返回工作台" @click="emit('exit')">
        <i aria-hidden="true" />
      </button>
    </div>

    <!-- 非 LIVE 必须显式声明数据性质，避免把演示内容误读成实时源数据 -->
    <div v-if="!live" class="p-note">{{ EMPTY_DEMO }}</div>

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
import { ref } from 'vue'
import GapDateStrip from './GapDateStrip.vue'
import { EMPTY_DEMO } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'

const { dateBands } = useGapDesk()
/** 默认高亮「今天更早」胶囊（渐变紫底白字）；无当日数据时自然不高亮 */
const activeBand = ref('today')
function onPick(key: string): void {
  activeBand.value = activeBand.value === key ? '' : key
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
}>()
</script>

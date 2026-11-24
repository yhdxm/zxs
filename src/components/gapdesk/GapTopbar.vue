<!--
  差值台 GAPDESK · PC 顶栏
  纯 HTML + class，不引入任何 UI 库组件。
  指标位全部来自 store；没有真实数据时显示「—」。
-->
<template>
  <header class="gd-topbar">
    <div class="gd-brand">
      <span class="gd-logo" aria-hidden="true" />
      <span class="gd-nm">差值台</span>
      <span class="gd-en">GAPDESK</span>
    </div>

    <!-- 三条降级条件同时不满足才敢标 LIVE -->
    <span
      class="gd-pill gd-mono"
      :class="liveNow ? 'gd-pill-live' : 'gd-pill-demo'"
      :title="liveNow ? '40 分钟内有采集、非镜像、无错误' : demoTitle"
    >{{ liveNow ? 'LIVE' : 'DEMO' }}</span>
    <span class="gd-pill gd-pill-fnl gd-mono" title="按池内分位分层：L0 前 10% / L1 10–40% / L2 其余">
      今日 L0 {{ tierCounts.L0 }} · L1 {{ tierCounts.L1 }} · L2 {{ tierCounts.L2 }}
    </span>
    <span class="gd-pill gd-pill-acc gd-mono" :title="EMPTY_ECHO">兑现率 —</span>
    <span class="gd-pill gd-pill-okk gd-mono" title="源间时差取中位数，避免历史长尾带偏均值">
      时差中位 {{ lagMedianDays === null ? '—' : `${lagMedianDays} 天` }}
    </span>

    <span class="gd-spacer" />

    <div class="gd-searchbox" aria-hidden="true">
      <span class="gd-mono">⌕</span>
      <span>搜索归档 / 行业 / 信源</span>
      <span class="gd-kbd">/</span>
    </div>
    <span class="gd-pill gd-pill-soft">{{ title }}</span>

    <!-- 清理入口：仅 admin/superadmin 渲染，普通用户连按钮都看不到 -->
    <button
      v-if="canPurge"
      class="gd-purge-btn"
      type="button"
      title="清理过期数据"
      aria-label="清理过期数据"
      @click="emit('purge')"
    >清理</button>
    <button class="gd-viewbtn" type="button" title="切到手机视图" @click="emit('switch-dev')">手机版</button>
    <!-- 全屏外壳下唯一的返回工作台入口 -->
    <button class="gd-avatar-btn" type="button" title="返回工作台" aria-label="返回工作台" @click="emit('exit')" />
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EMPTY_ECHO } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'

const props = withDefaults(
  defineProps<{
    /** 当前视图名，由宿主按 ?view= 传入 */
    title?: string
    /** 外部强制实时态（默认走 store 的 isLive 判定） */
    live?: boolean
  }>(),
  { title: '最新信息', live: false }
)

const { tierCounts, lagMedianDays, isLive, demoReasons, canPurge } = useGapDesk()

const liveNow = computed(() => props.live || isLive.value)
const demoTitle = computed(() => demoReasons.value.join('；') || '未连上网关')

const emit = defineEmits<{
  'switch-dev': []
  exit: []
  purge: []
}>()
</script>

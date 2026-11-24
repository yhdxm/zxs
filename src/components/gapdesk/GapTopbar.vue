<!--
  差值台 GAPDESK · PC 顶栏
  ---------------------------------------------------------------
  视觉语言对齐宿主 PageHeader：白卡片 / 圆角 / 描边 / 阴影 / 40px 渐变图标 /
  标题+副标题 / 右侧 actions。功能信息（LIVE、L0/L1/L2、兑现率、时差、
  视图标题、清理、切端、退出）一条不少；指标位全部来自 store。
  搜索框是真控件：直接写 filters.keyword，"/" 可聚焦。
-->
<template>
  <header class="gd-topbar">
    <div class="gd-ph-inner">
      <div class="gd-ph-brand">
        <span class="gd-ph-icon" aria-hidden="true"><span class="gd-logo" /></span>
        <div class="gd-ph-text">
          <h2 class="gd-ph-title">差值台</h2>
          <p class="gd-ph-sub">GAPDESK · 数据差值情报</p>
        </div>
      </div>

      <!-- 三条降级条件同时不满足才敢标 LIVE -->
      <div class="gd-ph-status">
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
          时差中位 {{ lagMedianHours === null ? '—' : `${lagMedianHours} 小时` }}
        </span>
      </div>

      <div class="gd-ph-actions">
        <label class="gd-searchbox">
          <span class="gd-mono" aria-hidden="true">⌕</span>
          <input
            ref="searchInput"
            v-model="keywordInput"
            type="search"
            placeholder="搜索归档 / 行业 / 信源"
            aria-label="搜索差值"
          />
          <span class="gd-kbd" aria-hidden="true">/</span>
        </label>
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
        <button class="gd-avatar-btn" type="button" title="返回工作台" aria-label="返回工作台" @click="emit('exit')" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const { tierCounts, lagMedianHours, isLive, demoReasons, canPurge, filters, setKeyword } = useGapDesk()

const liveNow = computed<boolean>(() => props.live || isLive.value)
const demoTitle = computed<string>(() => demoReasons.value.join('；') || '未连上网关')

/** 顶栏搜索与筛选栏共用同一个 filters.keyword，300ms 防抖避免每敲一字重算整池 */
const keywordInput = ref<string>(filters.keyword)
const searchInput = ref<HTMLInputElement | null>(null)
let kwTimer: ReturnType<typeof setTimeout> | null = null

watch(keywordInput, (value) => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(() => setKeyword(value), 300)
})
// 筛选栏改了关键词时，顶栏输入框跟着回写（双向同步，不是两个各自为政的输入框）
watch(
  () => filters.keyword,
  (value) => {
    if (value !== keywordInput.value) keywordInput.value = value
  }
)

/** 与占位提示里的 "/" 对应：非输入态按 / 直接聚焦搜索 */
function onKey(event: KeyboardEvent): void {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  event.preventDefault()
  searchInput.value?.focus()
}

onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  if (kwTimer) clearTimeout(kwTimer)
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
})

const emit = defineEmits<{
  'switch-dev': []
  exit: []
  purge: []
}>()
</script>

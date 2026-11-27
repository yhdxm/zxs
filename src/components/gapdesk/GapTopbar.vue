<!--
  差值台 GAPDESK · PC 顶栏
  ---------------------------------------------------------------
  视觉语言对齐宿主 PageHeader：白卡片 / 圆角 / 描边 / 阴影 / 40px 渐变图标 /
  标题+副标题 / 右侧 actions。功能信息（数据年龄、L0/L1/L2、兑现率、时差、
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

      <!-- 数据是真的，只是可能旧：按 generated_at 的数据年龄如实展示；点击展开采集说明 -->
      <div class="gd-ph-status">
        <button
          type="button"
          class="gd-pill gd-mono gd-age-pill gd-age-btn"
          :class="'gd-age-' + dataFreshnessTone"
          :title="dataFreshnessTitle"
          :aria-expanded="ageOpen"
          @click="ageOpen = !ageOpen"
        >{{ dataAgeText }}</button>
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
            placeholder="搜索标题 / 摘要 / 行业"
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
    <div v-if="ageOpen" class="gd-age-note" role="note">
      <span class="gd-age-note-t">数据年龄说明</span>
      <span class="gd-age-note-x">{{ dataFreshnessTitle }}</span>
      <span class="gd-age-note-b">{{ GAP_COLLECT_NOTE }}</span>
      <span class="gd-age-manual">
        <button type="button" class="gd-collect-btn gd-mono" @click="openCollect">手动补采 →</button>
        <span class="gd-age-note-b">{{ GAP_COLLECT_MANUAL_NOTE }}</span>
      </span>
      <button type="button" class="gd-age-note-close gd-mono" aria-label="收起" @click="ageOpen = false">×</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  EMPTY_ECHO,
  GAP_COLLECT_MANUAL_NOTE,
  GAP_COLLECT_NOTE,
  GAP_COLLECT_URL
} from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'

const props = withDefaults(
  defineProps<{
    /** 当前视图名，由宿主按 ?view= 传入 */
    title?: string
    /** @deprecated 宿主仍在传 isLive；顶栏已改用数据年龄，保留 prop 只是不破坏调用方 */
    live?: boolean
  }>(),
  { title: '最新信息', live: false }
)

const {
  tierCounts,
  lagMedianHours,
  dataAgeText,
  dataFreshnessTone,
  dataFreshnessTitle,
  canPurge,
  filters,
  setKeyword
} = useGapDesk()

/** 顶栏搜索与筛选栏共用同一个 filters.keyword，300ms 防抖避免每敲一字重算整池 */
const keywordInput = ref<string>(filters.keyword)
const searchInput = ref<HTMLInputElement | null>(null)
/** 数据年龄说明面板开关：只在本组件内，不影响 store */
const ageOpen = ref(false)
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

/** 手动补采：新标签打开 GitHub Actions，用户在自己已登录会话里点 Run workflow */
function openCollect(): void {
  if (typeof window !== 'undefined') window.open(GAP_COLLECT_URL, '_blank', 'noopener,noreferrer')
}

const emit = defineEmits<{
  'switch-dev': []
  exit: []
  purge: []
}>()
</script>

<style scoped>
/* 数据新鲜度三档：绿=新、黄=旧但可用、灰=时间未知；只表达年龄，不暗示真假 */
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
/* 数据年龄徽标是可点按钮，保留胶囊外观，补焦点与问号提示 */
.gd-age-btn {
  cursor: pointer;
  min-height: 26px;
  font-family: inherit;
}
/* 问号用伪元素画，不进 DOM 文本，保持胶囊文案与 store 逐字一致 */
.gd-age-btn::after {
  content: '?';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  margin-left: 4px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 11.5px;
  vertical-align: middle;
  opacity: .8;
}
.gd-age-note {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  padding: 10px 18px 12px;
  border-top: 1px solid var(--gd-line, #e6ebf4);
  background: var(--gd-sub, #fafcff);
  font-size: var(--gd-fs-panels, 10.5px);
  line-height: 1.6;
}
.gd-age-note-t {
  font-weight: 700;
  color: var(--gd-ink, #0c1030);
}
.gd-age-note-x {
  color: var(--gd-ink2, #54608a);
}
.gd-age-note-b {
  flex: 1 0 100%;
  color: var(--gd-ink2, #54608a);
}
.gd-age-manual {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  flex: 1 0 100%;
}
.gd-collect-btn {
  flex: none;
  min-height: 32px;
  padding: 4px 12px;
  border: 1px solid var(--gd-brand, #3a5cf5);
  border-radius: var(--gd-r-nav, 8px);
  background: var(--gd-card, #fff);
  color: var(--gd-brand, #3a5cf5);
  font-size: var(--gd-fs-panels, 12px);
  cursor: pointer;
}
.gd-collect-btn:hover {
  background: color-mix(in srgb, var(--gd-brand, #3a5cf5) 8%, var(--gd-card, #fff));
}
.gd-age-note-close {
  position: absolute;
  top: 6px;
  right: 12px;
  width: 26px;
  height: 26px;
  border: 0;
  background: transparent;
  color: var(--gd-ink3, #93a1c4);
  font-size: 16px;
  cursor: pointer;
}
</style>

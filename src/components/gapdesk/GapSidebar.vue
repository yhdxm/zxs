<!--
  差值台 GAPDESK · 左侧分组导航
  4 组 17 项，编号 00-16 显式写死（不再由 seq++ 生成），与截图字面一致。
  计数胶囊只显示能算真的值，其余显示「—」，绝不写死假数字。
-->
<template>
  <aside class="gd-sidebar">
    <template v-for="group in NAV_GROUPS" :key="group.title">
      <div class="gd-gl">{{ group.title }}</div>
      <button
        v-for="item in group.items"
        :key="item.key"
        type="button"
        class="gd-nav"
        :class="{ on: active === item.key }"
        :title="item.label"
        @click="emit('navigate', item.key)"
      >
        <span class="gd-num">{{ item.num }}</span>
        <span class="gd-nav-label">{{ item.label }}</span>
        <span class="gd-cnt" :class="{ 'gd-cnt-hot': item.hot }">{{ countOf[item.key] ?? '—' }}</span>
      </button>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { GAP_IND } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'

const { tierCounts, top14, loneCount, ruleLoaded, ruleCount, health } = useGapDesk()

/** 只有能算真的入口给计数，其余保持「—」；不拿假数撑门面 */
const countOf = computed<Record<string, string>>(() => ({
  profile: String(GAP_IND.length),
  latest: String(top14.value.length),
  source: String(loneCount.value),
  alert: ruleLoaded.value ? String(ruleCount.value) : '—',
  brief: String(tierCounts.value.L0),
  // 网关未连时 total=0，显示 0/0 会被误读成「没有信源」，与信源分级页空态口径保持一致
  'source-risk': health.value.total === 0 ? '—' : `${health.value.ok}/${health.value.total}`
}))

interface NavItem {
  key: string
  label: string
  num: string
  hot?: boolean
}
interface NavGroup {
  title: string
  items: readonly NavItem[]
}

/**
 * 截图字面顺序：看信息 → 进阶·可关键 → 收费 → 研判·扩展。
 * 编号写死在项上，新增/调整一项不会让后面所有编号静默错位。
 */
const RAW_GROUPS: readonly NavGroup[] = [
  {
    title: '看信息',
    items: [
      { key: 'profile', label: '按行业', num: '00' },
      { key: 'latest', label: '最新信息', num: '01', hot: true },
      { key: 'timeline', label: '时间线', num: '02' },
      { key: 'matrix', label: '行业全景', num: '03' },
      { key: 'spread', label: '传播路径', num: '04' },
      { key: 'source', label: '单源情报', num: '05' }
    ]
  },
  {
    title: '进阶·可关键',
    items: [
      { key: 'alert', label: '订阅提醒', num: '06' },
      { key: 'report', label: '导出报告', num: '07' },
      { key: 'seats', label: '团队席位', num: '08' }
    ]
  },
  {
    title: '收费',
    items: [{ key: 'pricing', label: '价格', num: '09' }]
  },
  {
    title: '研判·扩展',
    items: [
      { key: 'brief', label: '今日简报', num: '10' },
      { key: 'source-risk', label: '信源分级', num: '11' },
      { key: 'echo', label: '命中率', num: '12' },
      { key: 'cycle', label: '周期视图', num: '13' },
      { key: 'score', label: '评分模式', num: '14' },
      { key: 'archive', label: '归档检索', num: '15' },
      { key: 'ai', label: 'AI 研判', num: '16' }
    ]
  }
]

const NAV_GROUPS: readonly NavGroup[] = RAW_GROUPS

withDefaults(defineProps<{ active?: string }>(), { active: '' })
const emit = defineEmits<{ navigate: [key: string] }>()
</script>

<!--
  差值台 GAPDESK · 右侧信息栏
  固定 5 卡：Echo 回打 / AI 今日研判 / 信源体温计 / 稍后读队列 / 今日概览。
  文案只走 config 的 EMPTY_*；Echo 与 AI 两卡可点击，交由宿主 onNavigate 切屏。
-->
<template>
  <aside class="gd-rightcol">
    <section v-for="panel in PANELS" :key="panel.title" class="gd-panel">
      <div class="gd-panel-h">
        <i class="gd-bar" aria-hidden="true" />
        <span>{{ panel.title }}</span>
        <span class="gd-tag gd-mono">{{ panel.tag }}</span>
      </div>
      <p class="gd-panel-body">{{ panel.body }}</p>
      <button
        v-if="panel.linkText"
        type="button"
        class="gd-panel-link gd-mono"
        @click="go(panel.navKey)"
      >
        {{ panel.linkText }}
      </button>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EMPTY_ECHO, EMPTY_LLM, EMPTY_WAIT } from '../../config/gapdeskConfig'
import { useGapDesk } from '../../composables/useGapDesk'

interface RightPanel {
  title: string
  tag: string
  body: string
  /** 有值则渲染跳屏按钮，具体跳转交给宿主的 onNavigate */
  navKey?: string
  linkText?: string
}

const emit = defineEmits<{ navigate: [key: string] }>()

const { health, tierCounts, dailyBriefText, laterIds } = useGapDesk()

/** 全部读真实 store；取不到就显示口径文案，不写死任何数字 */
const PANELS = computed<RightPanel[]>(() => [
  {
    title: 'Echo 回打',
    tag: 'ECHO',
    body: EMPTY_ECHO,
    navKey: 'echo',
    linkText: '查看命中率中心 →'
  },
  {
    title: 'AI 今日研判',
    tag: 'AI',
    body: dailyBriefText.value ? dailyBriefText.value.split('\n')[0] ?? EMPTY_LLM : `— ${EMPTY_LLM}`,
    navKey: 'ai',
    linkText: '进入 AI 研判 →'
  },
  {
    title: '信源体温计',
    tag: 'HEALTH',
    body: health.value.total > 0
      ? `正常 ${health.value.ok} / ${health.value.total} 路；失败源逐一列在信源分级页，不隐藏。`
      : `— ${EMPTY_WAIT}：还没有逐源健康数据。`
  },
  {
    title: '稍后读队列',
    tag: 'LATER',
    body: laterIds.value.length ? `本机稍后读 ${laterIds.value.length} 条` : '— 队列为空，进入详情可加入稍后读。'
  },
  {
    title: '今日概览',
    tag: 'TODAY',
    body: `L0 ${tierCounts.value.L0} 条 · L1 ${tierCounts.value.L1} 条 · L2 ${tierCounts.value.L2} 条（池内分位）`
  }
])

function go(key: string | undefined): void {
  if (key) emit('navigate', key)
}
</script>

<style scoped>
.gd-panel-link {
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--gd-brand);
  font-size: var(--gd-fs-panels);
  cursor: pointer;
}
.gd-panel-link:hover {
  color: color-mix(in srgb, var(--gd-brand) 72%, var(--gd-brand2));
}
</style>

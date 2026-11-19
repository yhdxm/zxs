<!--
  统一空态 / 失败态 / 陈旧态
  ---------------------------------------------------------------
  一条铁律：**没有数据就明说没有，不许补演示数据**。
  旧版差值台在没有网关时会静默回退 32 条演示数据，顶栏还写「实时」——
  那是最坏的一种产品行为（看起来正常，实际全是假的）。
  所以这里四种状态各自有明确文案，失败态还会把每个 DOWN 源的 last_msg 摊开。
-->
<template>
  <div class="ges" :class="`ges-${type}`">
    <div class="ges-icon">
      <el-icon :class="{ 'ges-spin': type === 'loading' }">
        <component :is="iconComp" />
      </el-icon>
    </div>

    <p class="ges-title">{{ title || defaultTitle }}</p>
    <p v-if="desc || defaultDesc" class="ges-desc">{{ desc || defaultDesc }}</p>

    <ul v-if="detail && detail.length" class="ges-detail">
      <li v-for="(line, i) in detail.slice(0, 8)" :key="i">{{ line }}</li>
    </ul>

    <el-button
      v-if="actionText"
      class="ges-action"
      size="small"
      type="primary"
      plain
      @click="emit('action')"
    >
      {{ actionText }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Document, Loading, WarningFilled } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    /** empty=确实没有 / loading=加载中 / error=请求失败 / stale=展示的是旧镜像 */
    type: 'empty' | 'loading' | 'error' | 'stale'
    title?: string
    desc?: string
    /** 失败源与 last_msg 等明细，最多展示 8 行 */
    detail?: string[]
    actionText?: string
  }>(),
  { title: '', desc: '', detail: () => [], actionText: '' }
)

const emit = defineEmits<{ (e: 'action'): void }>()

const ICONS = {
  empty: Document,
  loading: Loading,
  error: WarningFilled,
  stale: Clock
} as const

const iconComp = computed(() => ICONS[props.type])

/** 缺省文案：把「为什么空」说清楚，而不是一句「暂无数据」 */
const defaultTitle = computed(() => {
  switch (props.type) {
    case 'loading':
      return '正在拉取本轮差值…'
    case 'error':
      return '数据暂时取不到'
    case 'stale':
      return '当前展示的是离线镜像'
    default:
      return '这一屏暂时没有差值'
  }
})

const defaultDesc = computed(() => {
  switch (props.type) {
    case 'loading':
      return '采集任务每 30 分钟跑一轮，稍等片刻'
    case 'error':
      return '网络或数据库不可达。已保留上一次成功加载的内容，恢复后会自动补齐'
    case 'stale':
      return '云端暂时不可达，下面是本地缓存的上一份结果 —— 分数与热度可能已过期'
    default:
      return '差值阈值为 85 分，当前时间窗内没有达到阈值的事件；可放宽行业筛选或等待下一轮采集'
  }
})
</script>

<style scoped>
.ges {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 20px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--surface, #fff);
  text-align: center;
}
.ges-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-soft, rgba(0, 0, 0, 0.04));
  font-size: 22px;
  color: var(--text-muted, #909399);
}
.ges-error .ges-icon {
  color: #ff3358;
  background: rgba(255, 51, 88, 0.1);
}
.ges-stale .ges-icon {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
}
.ges-loading .ges-icon {
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.1);
}
.ges-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong, #303133);
}
.ges-desc {
  margin: 0;
  max-width: 460px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted, #909399);
}
.ges-detail {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  text-align: left;
  max-width: 520px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-muted, #909399);
}
.ges-detail li::before {
  content: '· ';
}
.ges-action {
  margin-top: 6px;
  min-height: 44px;
}
.ges-spin {
  animation: ges-rotate 1s linear infinite;
}
@keyframes ges-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>

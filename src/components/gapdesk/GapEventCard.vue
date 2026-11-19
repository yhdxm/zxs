<!--
  差值事件卡
  ---------------------------------------------------------------
  信息层级（从上到下就是用户的判断顺序）：
     ① 哪个行业 / 哪一层先报  → ② 差多少（双轨标尺）→ ③ 为什么算差（reason）
     → ④ 原文在哪（可点开核对，绝不截断后当结论）
  所有数字都来自库里的真实列，卡片不做任何推测；没有链接就不显示链接位。
-->
<template>
  <article
    class="gec"
    :class="[`gec-${tone}`, { 'gec-active': active }]"
    @click="emit('open', event.id)"
  >
    <header class="gec-top">
      <span class="gec-ind">
        <i class="gec-dot" :style="{ background: indOption.color }" />
        {{ indOption.label }}
      </span>
      <span class="gec-layer">{{ layerLabel }}</span>
      <span class="gec-spacer" />
      <span class="gec-score" :title="`原始分 ${event.gap_raw}｜池内分位`">{{ event.gap }}</span>
    </header>

    <h3 class="gec-title">{{ event.title }}</h3>

    <div class="gec-meta">
      <span class="gec-time">{{ timeText }}</span>
      <span class="gec-sep">·</span>
      <span>{{ event.src_count }} 路源</span>
      <template v-if="(event.mass_heat ?? 0) > 0">
        <span class="gec-sep">·</span>
        <span class="gec-mass">已出圈 {{ event.mass_on || '' }}</span>
      </template>
    </div>

    <GapDualTrack
      class="gec-track"
      compact
      :ins-heat="event.ins_heat ?? 0"
      :pub-heat="event.pub_heat ?? 0"
      :gap="event.gap"
    />

    <p v-if="event.reason" class="gec-reason">{{ event.reason }}</p>

    <footer class="gec-foot" @click.stop>
      <a
        v-if="event.url"
        class="gec-link"
        :href="event.url"
        target="_blank"
        rel="noopener"
        @click.stop
      >
        原文
      </a>
      <span v-else class="gec-link gec-link-off">无原文链接</span>
      <span class="gec-spacer" />
      <el-button
        class="gec-fav"
        size="small"
        text
        :title="favorite ? '取消收藏' : '收藏'"
        @click.stop="emit('favorite', event.id)"
      >
        <el-icon :class="{ 'gec-fav-on': favorite }">
          <StarFilled v-if="favorite" />
          <Star v-else />
        </el-icon>
      </el-button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Star, StarFilled } from '@element-plus/icons-vue'
import GapDualTrack from './GapDualTrack.vue'
import { GAP_IND_MAP, GAP_LAYER_LABEL } from '../../config/gapdeskConfig'
import { fmtAgo, gapTone } from '../../utils/gapdeskFormat'
import type { GapEventRow, GapInd } from '../../types/gapdesk'

const props = withDefaults(
  defineProps<{
    event: GapEventRow
    /** 详情抽屉打开时高亮当前卡 */
    active?: boolean
    /** 收藏态由父级统一持有（列表里多个入口共享同一份状态） */
    favorite?: boolean
  }>(),
  { active: false, favorite: false }
)

const emit = defineEmits<{
  (e: 'open', eventId: number): void
  (e: 'favorite', eventId: number): void
}>()

/** 行业标签：库里 ind 理论上受约束，但历史脏数据不能让卡片炸掉，故带兜底 */
const indOption = computed(() => {
  const hit = GAP_IND_MAP[props.event.ind as GapInd]
  return hit ?? { key: props.event.ind, label: String(props.event.ind || '未分类'), color: '#909399' }
})

/** 来源层：kind 存的是主层（insider/main/rare/tech） */
const layerLabel = computed(() => GAP_LAYER_LABEL[props.event.kind] ?? '情报')

/** 差值分档决定卡片左侧色条 */
const tone = computed(() => gapTone(props.event.gap))

/**
 * 时间口径：
 *   · 有发布时间 → 显示「发布距今」（这是差值台的核心时间语义）
 *   · 无发布时间（榜单类 ts=0）→ 只能显示「入池距今」，并如实说明是入池时间
 */
const timeText = computed(() => {
  if (props.event.ts_published > 0) return fmtAgo(props.event.ts_published)
  return `入池 ${fmtAgo(props.event.ts_first_seen)}`
})
</script>

<style scoped>
.gec {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 12px 18px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}
.gec:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}
.gec-active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}
/* 左侧色条：hot 红 / warm 橙 / cool 灰 */
.gec::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #c0c4cc;
}
.gec-hot::before {
  background: #ff3358;
}
.gec-warm::before {
  background: #f59e0b;
}
.gec-cool::before {
  background: #c0c4cc;
}

.gec-top {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted, #909399);
  min-width: 0;
}
.gec-ind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gec-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.gec-layer {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-soft, rgba(0, 0, 0, 0.04));
  color: var(--text-muted, #909399);
}
.gec-spacer {
  flex: 1;
}
.gec-score {
  flex: none;
  padding: 1px 7px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #ff3358;
  background: rgba(255, 51, 88, 0.08);
}
.gec-warm .gec-score {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}
.gec-cool .gec-score {
  color: #909399;
  background: rgba(144, 147, 153, 0.12);
}

.gec-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--text-strong, #303133);
  /* 标题最多两行，超出省略：差值台的标题必须能被一眼扫完 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.gec-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted, #909399);
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.gec-sep {
  opacity: 0.6;
}
.gec-mass {
  color: #0ba36f;
}
.gec-reason {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted, #909399);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gec-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.gec-link {
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;
  /* 触控目标 ≥44px */
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.gec-link:hover {
  text-decoration: underline;
}
.gec-link-off {
  color: var(--text-muted, #909399);
  cursor: default;
}
.gec-fav {
  width: 44px;
  height: 44px;
  padding: 0;
}
.gec-fav-on {
  color: #f59e0b;
}

/* 移动端：内边距收紧，标题字号略降，收藏按钮保持 44px 触控区 */
@media (max-width: 768px) {
  .gec {
    padding: 12px 12px 10px 14px;
  }
  .gec-title {
    font-size: 13.5px;
  }
}
</style>

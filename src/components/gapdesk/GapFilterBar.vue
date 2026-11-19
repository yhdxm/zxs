<!--
  筛选栏（情报流 5 个视图共用）
  ---------------------------------------------------------------
  直接读写 useGapDesk().filters 单例：筛选状态必须跨视图共享，
  在「今日」里筛了 AI，切到「矩阵」还应该是 AI —— 这是用户对同一台仪器的预期。
  props 不传数据，避免出现「父传一份、store 一份」的双源。
-->
<template>
  <div class="gfb">
    <!-- 行业 chips：PC 与移动端都用，移动端横向滚动 -->
    <div class="gfb-inds">
      <button
        v-for="ind in GAP_IND"
        :key="ind.key"
        type="button"
        class="gfb-chip"
        :class="{ 'gfb-chip-on': filters.inds.includes(ind.key) }"
        :style="filters.inds.includes(ind.key) ? { borderColor: ind.color, color: ind.color, background: `${ind.color}14` } : undefined"
        :title="`${ind.label}（⌘/Ctrl + 点击可多选）`"
        @click="onInd(ind.key, $event)"
      >
        <i class="gfb-dot" :style="{ background: ind.color }" />
        {{ ind.label }}
      </button>
      <button v-if="filters.inds.length" type="button" class="gfb-clear" @click="filters.inds = []">
        全部
      </button>

      <!-- 移动端：其余控件收进抽屉 -->
      <button type="button" class="gfb-more" @click="drawer = true">筛选</button>
    </div>

    <!-- 桌面端：窗口 / 排序 / 关键词 / 订阅 / 命中数 -->
    <div class="gfb-ctl">
      <div class="gfb-group">
        <span class="gfb-lb">时间窗</span>
        <el-radio-group :model-value="filters.windowH" size="small" @update:model-value="onWindow">
          <el-radio-button v-for="h in GAP_WINDOW_OPTIONS" :key="h" :value="h">{{ h }}h</el-radio-button>
        </el-radio-group>
      </div>

      <div class="gfb-group">
        <span class="gfb-lb">排序</span>
        <el-radio-group :model-value="filters.sort" size="small" @update:model-value="onSort">
          <el-radio-button value="gap">差值优先</el-radio-button>
          <el-radio-button value="latest">最新优先</el-radio-button>
        </el-radio-group>
      </div>

      <el-input
        v-model="keywordInput"
        class="gfb-kw"
        size="small"
        clearable
        placeholder="标题 / 摘要关键词"
      />

      <el-switch
        v-model="onlySubModel"
        size="small"
        :disabled="!mySubs.length"
        :title="mySubs.length ? '只看我订阅的行业' : '还没有订阅任何行业（去「雷达」页打开行业开关）'"
        active-text="仅订阅"
      />

      <span class="gfb-count">{{ pool.length }} 条</span>
    </div>

    <!-- 移动端抽屉：与桌面同一套控件（同一份 store，改哪边都一样） -->
    <el-drawer v-model="drawer" title="筛选" direction="btt" size="46%" class="gfb-drawer">
      <div class="gfb-drawer-body">
        <div class="gfb-group">
          <span class="gfb-lb">时间窗</span>
          <el-radio-group :model-value="filters.windowH" size="small" @update:model-value="onWindow">
            <el-radio-button v-for="h in GAP_WINDOW_OPTIONS" :key="h" :value="h">{{ h }}h</el-radio-button>
          </el-radio-group>
        </div>
        <div class="gfb-group">
          <span class="gfb-lb">排序</span>
          <el-radio-group :model-value="filters.sort" size="small" @update:model-value="onSort">
            <el-radio-button value="gap">差值优先</el-radio-button>
            <el-radio-button value="latest">最新优先</el-radio-button>
          </el-radio-group>
        </div>
        <el-input v-model="keywordInput" size="small" clearable placeholder="标题 / 摘要关键词" />
        <el-switch
          v-model="onlySubModel"
          size="small"
          :disabled="!mySubs.length"
          :title="mySubs.length ? '只看我订阅的行业' : '还没有订阅任何行业'"
          active-text="仅订阅"
        />
        <el-button size="small" plain @click="reset">重置筛选</el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { GAP_IND } from '../../config/gapdeskConfig'
import { GAP_WINDOW_OPTIONS, useGapDesk } from '../../composables/useGapDesk'
import type { GapInd } from '../../types/gapdesk'

const { filters, pool, mySubs, setWindow, setSort, setKeyword, toggleInd, resetFilters } = useGapDesk()

const drawer = ref(false)

/** 关键词防抖：输入框本地受控，300ms 后才写进 store，避免每敲一个字就重算整池 */
const keywordInput = ref(filters.keyword)
let kwTimer: ReturnType<typeof setTimeout> | null = null
watch(keywordInput, (v) => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = setTimeout(() => setKeyword(v), 300)
})
onBeforeUnmount(() => {
  if (kwTimer) clearTimeout(kwTimer)
})

const onlySubModel = computed({
  get: () => filters.onlySub,
  set: (v: boolean) => {
    filters.onlySub = v
  }
})

/**
 * 行业选择语义：
 *   普通点击 = 单选（再点同一个 → 取消，回到「全部」）
 *   ⌘/Ctrl + 点击 = 多选追加/移除
 * 不做「默认全选」，因为「全部」和「选了 8 个」在语义上不同（前者不限制，后者是显式白名单）。
 */
function onInd(ind: GapInd, ev: MouseEvent): void {
  if (ev.metaKey || ev.ctrlKey) {
    toggleInd(ind)
    return
  }
  const isOnlyThis = filters.inds.length === 1 && filters.inds[0] === ind
  filters.inds = isOnlyThis ? [] : [ind]
}

function onWindow(v: string | number | boolean | undefined): void {
  const h = Number(v)
  if (Number.isFinite(h) && h > 0) setWindow(h)
}

function onSort(v: string | number | boolean | undefined): void {
  if (v === 'gap' || v === 'latest') setSort(v)
}

function reset(): void {
  keywordInput.value = ''
  resetFilters()
}
</script>

<style scoped>
.gfb {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--surface, #fff);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

/* ---------- 行业 chips ---------- */
.gfb-inds {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.gfb-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--surface, #fff);
  color: var(--text-muted, #606266);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.gfb-chip-on {
  font-weight: 600;
}
.gfb-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex: none;
}
.gfb-clear {
  flex: none;
  min-height: 32px;
  padding: 0 8px;
  border: none;
  background: none;
  color: var(--text-muted, #909399);
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}
.gfb-more {
  display: none;
}

/* ---------- 桌面控件行 ---------- */
.gfb-ctl {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  min-width: 0;
}
.gfb-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.gfb-lb {
  font-size: 11px;
  color: var(--text-muted, #909399);
  white-space: nowrap;
}
.gfb-kw {
  width: 200px;
}
.gfb-count {
  margin-left: auto;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted, #909399);
  white-space: nowrap;
}
.gfb-drawer-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ---------- 移动端 ---------- */
@media (max-width: 768px) {
  .gfb-inds {
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .gfb-inds::-webkit-scrollbar {
    display: none;
  }
  .gfb-more {
    display: inline-flex;
    align-items: center;
    flex: none;
    min-height: 44px;
    padding: 0 12px;
    margin-left: auto;
    border-radius: 999px;
    border: 1px solid var(--el-color-primary-light-5);
    background: var(--surface, #fff);
    color: var(--el-color-primary);
    font-size: 12px;
    cursor: pointer;
  }
  .gfb-ctl {
    display: none;
  }
  .gfb-chip,
  .gfb-clear {
    min-height: 44px;
  }
  /* 底部安全区：筛选抽屉 teleport 到 body，吃不到 App.vue 主内容区的补偿 */
  .gfb-drawer-body,
  .gfb-drawer :deep(.el-drawer__body) {
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }
}
</style>

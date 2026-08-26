<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import type { SideItem } from '../config/appMenu'

const props = defineProps<{
  items: SideItem[]
  depth?: number
  isActive: (key: string) => boolean
  navigate: (item: SideItem) => void
  toggle: (key: string) => void
}>()

function handleNavigate(item: SideItem) {
  props.navigate(item)
}
function handleToggle(key: string) {
  props.toggle(key)
}
const isNested = (depth?: number) => Boolean(depth && depth > 0)
</script>

<template>
  <template v-for="item in items" :key="item.key">
    <button
      v-if="!item.to && !item.href"
      class="side-item side-item--disabled"
      :class="[isNested(depth) ? 'side-child' : '']"
      disabled
    >
      <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
      <span v-if="isNested(depth)" class="child-dot"></span>
      <span>{{ item.label }}</span>
    </button>

    <button
      v-else-if="!item.children"
      class="side-item"
      :class="[isNested(depth) ? 'side-child' : '', { active: isActive(item.key) }]"
      @click="handleNavigate(item)"
    >
      <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
      <span v-if="isNested(depth)" class="child-dot"></span>
      <span>{{ item.label }}</span>
    </button>

    <div v-else class="side-group">
      <button
        class="side-item side-group-title"
        :class="{ active: isActive(item.key), expanded: item.expanded }"
        @click="handleToggle(item.key)"
      >
        <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
        <el-icon class="group-arrow"><ArrowDown /></el-icon>
      </button>
      <div v-show="item.expanded" class="side-group-children">
        <SideNavNode
          :items="item.children"
          :depth="(depth || 0) + 1"
          :is-active="isActive"
          :navigate="navigate"
          :toggle="toggle"
        />
      </div>
    </div>
  </template>
</template>

<style scoped>
/* ===== 侧边栏导航项（递归渲染，支持任意层级嵌套） ===== */
.side-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  position: relative;
}
.side-item :deep(svg) { font-size: 17px; }
.side-item:hover {
  background: var(--nav-hover);
  color: var(--text-strong);
}
.side-item--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.side-item--disabled:hover {
  background: transparent;
  color: var(--text);
}
.side-item.active {
  background: var(--nav-active-bg);
  color: var(--nav-active-text);
  font-weight: 600;
  box-shadow: 0 0 18px var(--nav-active-glow), inset 0 0 0 1px var(--border-strong);
}
.side-item:active {
  transform: scale(0.96);
}
.side-child:active {
  transform: scale(0.96);
}
.side-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, var(--primary-2), var(--primary));
  box-shadow: 0 0 10px var(--accent-glow-2);
}
.side-group-title {
  justify-content: flex-start;
}
.side-group-title .group-arrow {
  margin-left: auto;
  font-size: 12px;
  transition: transform 0.2s;
  color: var(--text-faint);
}
.side-group-title.expanded .group-arrow {
  transform: rotate(180deg);
}
.side-group-children {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 12px;
  margin-top: 2px;
}
.side-child {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.side-child .child-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-faint);
  flex-shrink: 0;
}
.side-child.active .child-dot {
  background: var(--primary-2);
}
.side-child.active {
  color: var(--text);
}
</style>

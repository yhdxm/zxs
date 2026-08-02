<template>
  <svg
    :viewBox="`0 0 68 68`"
    :width="size"
    :height="size"
    :class="['compass-logo', { glow }]"
    role="img"
    :aria-label="label"
  >
    <defs>
      <linearGradient :id="`${uid}-ga`" x1="8" y1="8" x2="34" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#b794f6" />
        <stop offset="1" stop-color="#6366f1" />
      </linearGradient>
      <linearGradient :id="`${uid}-gb`" x1="20" y1="40" x2="62" y2="62" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#38bdf8" />
        <stop offset="1" stop-color="#2dd4bf" />
      </linearGradient>
    </defs>

    <!-- 外围四角装饰圆点（上下左右，青绿色） -->
    <circle cx="34" cy="3" r="2.6" fill="#2dd4bf" />
    <circle cx="34" cy="65" r="2.6" fill="#2dd4bf" />
    <circle cx="3" cy="34" r="2.6" fill="#2dd4bf" />
    <circle cx="65" cy="34" r="2.6" fill="#2dd4bf" />

    <clipPath :id="`${uid}-clip`">
      <rect x="6" y="6" width="56" height="56" rx="18" ry="18" />
    </clipPath>

    <g :clip-path="`url(#${uid}-clip)`">
      <!-- 左上：淡紫→蓝紫 -->
      <rect x="6" y="6" width="56" height="56" :fill="`url(#${uid}-ga)`" />
      <!-- 右下：天蓝→青绿（S 形波浪分割线） -->
      <path d="M6,34 C22,26 30,52 46,44 C54,40 58,50 62,46 L62,62 L6,62 Z" :fill="`url(#${uid}-gb)`" />

      <!-- 罗盘：白色环形底圈 -->
      <circle cx="34" cy="34" r="16" fill="#ffffff" />
      <!-- 内层蓝色刻度圆盘 -->
      <circle cx="34" cy="34" r="13.5" fill="#1e3a8a" />

      <!-- 16 根刻度（8 长 8 短） -->
      <g stroke-linecap="round">
        <line x1="34" y1="20.5" x2="34" y2="23" stroke="#e2e8f0" stroke-width="1.4" />
        <line x1="39.2" y1="21.5" x2="38.6" y2="22.9" stroke="#93c5fd" stroke-width="1.1" />
        <line x1="43.6" y1="24.5" x2="41.8" y2="26.2" stroke="#e2e8f0" stroke-width="1.4" />
        <line x1="46.5" y1="28.8" x2="45.1" y2="29.4" stroke="#93c5fd" stroke-width="1.1" />
        <line x1="47.5" y1="34" x2="45" y2="34" stroke="#e2e8f0" stroke-width="1.4" />
        <line x1="46.5" y1="39.2" x2="45.1" y2="38.6" stroke="#93c5fd" stroke-width="1.1" />
        <line x1="43.6" y1="43.6" x2="41.8" y2="41.8" stroke="#e2e8f0" stroke-width="1.4" />
        <line x1="39.2" y1="46.5" x2="38.6" y2="45.1" stroke="#93c5fd" stroke-width="1.1" />
        <line x1="34" y1="47.5" x2="34" y2="45" stroke="#e2e8f0" stroke-width="1.4" />
        <line x1="28.8" y1="46.5" x2="29.4" y2="45.1" stroke="#93c5fd" stroke-width="1.1" />
        <line x1="24.5" y1="43.6" x2="26.2" y2="41.8" stroke="#e2e8f0" stroke-width="1.4" />
        <line x1="21.5" y1="39.2" x2="22.9" y2="38.6" stroke="#93c5fd" stroke-width="1.1" />
        <line x1="20.5" y1="34" x2="23" y2="34" stroke="#e2e8f0" stroke-width="1.4" />
        <line x1="21.5" y1="28.8" x2="22.9" y2="29.4" stroke="#93c5fd" stroke-width="1.1" />
        <line x1="24.5" y1="24.5" x2="26.2" y2="26.2" stroke="#e2e8f0" stroke-width="1.4" />
        <line x1="28.8" y1="21.5" x2="29.4" y2="22.9" stroke="#93c5fd" stroke-width="1.1" />
      </g>

      <!-- 指针（北青绿 / 南淡紫）+ 中心枢纽；animated 时整体绕盘心旋转 -->
      <g>
        <polygon points="34,21 30.5,34 37.5,34" fill="#2dd4bf" />
        <polygon points="34,47 30.5,34 37.5,34" fill="#c4b5fd" />
        <circle cx="34" cy="34" r="3.2" fill="#1e3a8a" />
        <circle cx="34" cy="34" r="1.5" fill="#2dd4bf" />
        <animateTransform
          v-if="animated"
          attributeName="transform"
          type="rotate"
          from="0 34 34"
          to="360 34 34"
          dur="6s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
// 模块级计数器：保证同页多实例（侧栏 + 抽屉）的渐变 id 不冲突
let _seq = 0
</script>

<script setup lang="ts">
defineProps<{
  size?: number | string
  animated?: boolean
  glow?: boolean
  label?: string
}>()

const uid = `compass-${++_seq}`
</script>

<style scoped>
.compass-logo {
  display: block;
}
.compass-logo.glow {
  filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.5));
}
</style>

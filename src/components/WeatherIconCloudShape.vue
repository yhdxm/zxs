<template>
  <g :transform="transform" fill="#94a3b8">
    <circle cx="20" cy="32" r="10" />
    <circle cx="34" cy="26" r="13" />
    <circle cx="48" cy="32" r="10" />
    <rect x="20" y="32" width="28" height="18" />
  </g>
</template>

<script setup lang="ts">
const props = defineProps<{ x?: number; y?: number; scale?: number }>()
const x = props.x ?? 0
const y = props.y ?? 0
const s = props.scale ?? 1
const transform = `translate(${x}, ${y}) scale(${s})`
</script>

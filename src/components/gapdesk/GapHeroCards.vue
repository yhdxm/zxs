<!--
  差值台 GAPDESK · hero 数字卡统一渲染
  复用现有 .hero / .hcard / .gd-mono，数字等宽，样式单一真源在 components.css。
  l 缺省时回落到 label，d 为空则不渲染那一行（不留空壳）。
-->
<template>
  <div class="hero">
    <div v-for="(item, i) in items" :key="`${item.label}-${i}`" class="hcard">
      <span class="n gd-mono" :class="{ grad: item.grad === true }">{{ item.n }}</span>
      <span class="l">{{ item.l ?? item.label }}</span>
      <span v-if="item.d" class="d gd-mono">{{ item.d }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface HeroItem {
  /** 卡片标签；同时作为无障碍 title */
  label: string
  n: string | number
  /** 可选的第二行标签，缺省用 label */
  l?: string
  /** 说明行，走等宽小字 */
  d?: string
  /** 数字走 --gd-grad 渐变强调 */
  grad?: boolean
}

withDefaults(defineProps<{ items: HeroItem[] }>(), { items: () => [] })
</script>

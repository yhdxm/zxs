<template>
  <svg class="weather-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <!-- 晴 -->
    <g v-if="isClear">
      <circle cx="32" cy="32" r="10" fill="#f59e0b" />
      <g stroke="#f59e0b" stroke-width="3" stroke-linecap="round">
        <line x1="32" y1="10" x2="32" y2="16" />
        <line x1="32" y1="48" x2="32" y2="54" />
        <line x1="10" y1="32" x2="16" y2="32" />
        <line x1="48" y1="32" x2="54" y2="32" />
        <line x1="16.4" y1="16.4" x2="20.6" y2="20.6" />
        <line x1="43.4" y1="43.4" x2="47.6" y2="47.6" />
        <line x1="16.4" y1="47.6" x2="20.6" y2="43.4" />
        <line x1="43.4" y1="20.6" x2="47.6" y2="16.4" />
      </g>
    </g>

    <!-- 大致晴朗 -->
    <g v-else-if="isMainlyClear">
      <circle cx="26" cy="26" r="9" fill="#f59e0b" />
      <g stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round">
        <line x1="26" y1="9" x2="26" y2="13" />
        <line x1="26" y1="39" x2="26" y2="43" />
        <line x1="9" y1="26" x2="13" y2="26" />
        <line x1="39" y1="26" x2="43" y2="26" />
        <line x1="15" y1="15" x2="18" y2="18" />
        <line x1="34" y1="34" x2="37" y2="37" />
        <line x1="15" y1="37" x2="18" y2="34" />
        <line x1="34" y1="18" x2="37" y2="15" />
      </g>
      <CloudShape :x="14" :y="24" :scale="0.85" />
    </g>

    <!-- 局部多云 -->
    <g v-else-if="isPartlyCloudy">
      <circle cx="22" cy="22" r="8" fill="#f59e0b" />
      <g stroke="#f59e0b" stroke-width="2" stroke-linecap="round">
        <line x1="22" y1="8" x2="22" y2="11" />
        <line x1="22" y1="33" x2="22" y2="36" />
        <line x1="8" y1="22" x2="11" y2="22" />
        <line x1="33" y1="22" x2="36" y2="22" />
      </g>
      <CloudShape :x="12" :y="22" :scale="0.95" />
    </g>

    <!-- 阴 / 雾 / 霾 -->
    <g v-else-if="isOvercast || isFog">
      <CloudShape :x="8" :y="18" :scale="1" />
    </g>

    <!-- 毛毛雨 / 小雨 -->
    <g v-else-if="isDrizzle || isLightRain">
      <CloudShape :x="8" :y="16" :scale="1" />
      <g stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round">
        <line x1="22" y1="42" x2="20" y2="50" />
        <line x1="32" y1="42" x2="30" y2="50" />
        <line x1="42" y1="42" x2="40" y2="50" />
      </g>
    </g>

    <!-- 中雨 / 大雨 / 冻雨 -->
    <g v-else-if="isRain">
      <CloudShape :x="8" :y="14" :scale="1" />
      <g stroke="#38bdf8" stroke-width="3" stroke-linecap="round">
        <line x1="20" y1="44" x2="17" y2="54" />
        <line x1="32" y1="44" x2="29" y2="54" />
        <line x1="44" y1="44" x2="41" y2="54" />
      </g>
    </g>

    <!-- 阵雨 / 强阵雨 / 暴雨 -->
    <g v-else-if="isShower">
      <CloudShape :x="8" :y="14" :scale="1" />
      <g stroke="#38bdf8" stroke-width="3" stroke-linecap="round">
        <line x1="22" y1="44" x2="16" y2="54" />
        <line x1="32" y1="44" x2="26" y2="54" />
        <line x1="42" y1="44" x2="36" y2="54" />
      </g>
    </g>

    <!-- 雪 / 阵雪 -->
    <g v-else-if="isSnow">
      <CloudShape :x="8" :y="16" :scale="1" />
      <g fill="#bae6fd">
        <circle cx="22" cy="48" r="2.5" />
        <circle cx="32" cy="52" r="2.5" />
        <circle cx="42" cy="48" r="2.5" />
      </g>
    </g>

    <!-- 雷暴 -->
    <g v-else-if="isThunder">
      <CloudShape :x="8" :y="14" :scale="1" />
      <path d="M30 40 L26 50 L32 50 L28 60 L40 46 L34 46 L38 40 Z" fill="#f59e0b" stroke="#f59e0b" stroke-width="1" stroke-linejoin="round" />
    </g>

    <!-- 默认 -->
    <g v-else>
      <CloudShape :x="8" :y="18" :scale="1" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CloudShape from './WeatherIconCloudShape.vue'

const props = defineProps<{ code: number }>()

const c = computed(() => Number(props.code) || 0)

const isClear = computed(() => c.value === 0)
const isMainlyClear = computed(() => c.value === 1)
const isPartlyCloudy = computed(() => c.value === 2)
const isOvercast = computed(() => c.value === 3)
const isFog = computed(() => c.value === 45 || c.value === 48)
const isDrizzle = computed(() => c.value >= 51 && c.value <= 57)
const isLightRain = computed(() => c.value === 61)
const isRain = computed(() => c.value >= 63 && c.value <= 67)
const isShower = computed(() => c.value >= 80 && c.value <= 82)
const isSnow = computed(() =>
  (c.value >= 71 && c.value <= 77) || c.value === 85 || c.value === 86
)
const isThunder = computed(() => c.value >= 95)
</script>

<style scoped>
.weather-icon {
  width: 1em;
  height: 1em;
  display: inline-block;
  vertical-align: middle;
}
</style>

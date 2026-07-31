<template>
  <div class="weather-effects" aria-hidden="true">
    <!-- 晴天：光晕与光线 -->
    <template v-if="isSunny">
      <div class="sun-glow"></div>
      <div class="sun-rays"></div>
    </template>

    <!-- 多云 / 阴：飘动的云 -->
    <template v-if="isCloudy">
      <div v-for="i in 4" :key="'cloud-' + i" class="cloud" :class="'cloud-' + i"></div>
    </template>

    <!-- 雨 / 阵雨 / 雷暴：下落雨滴 -->
    <template v-if="isRainy">
      <div v-for="i in rainCount" :key="'rain-' + i" class="raindrop" :style="rainStyle(i)"></div>
    </template>

    <!-- 雪：下落雪花 -->
    <template v-if="isSnowy">
      <div v-for="i in snowCount" :key="'snow-' + i" class="snowflake" :style="snowStyle(i)"></div>
    </template>

    <!-- 雷暴：闪电闪烁 -->
    <template v-if="isThunder">
      <div class="lightning" :style="{ animationDelay: thunderDelay + 's' }"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ code: number }>()
const c = computed(() => Number(props.code) || 0)

const isSunny = computed(() => c.value === 0)
const isCloudy = computed(() => c.value >= 2 && c.value <= 3)
const isRainy = computed(() =>
  (c.value >= 51 && c.value <= 67) || (c.value >= 80 && c.value <= 82) || c.value >= 95
)
const isSnowy = computed(() =>
  (c.value >= 71 && c.value <= 77) || c.value === 85 || c.value === 86
)
const isThunder = computed(() => c.value >= 95)

const rainCount = 50
const snowCount = 40
const thunderDelay = Math.random() * 4

function rainStyle(i: number) {
  const left = Math.random() * 100
  const duration = 0.6 + Math.random() * 0.5
  const delay = Math.random() * 2
  const height = 12 + Math.random() * 18
  return {
    left: `${left}%`,
    height: `${height}px`,
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`
  }
}

function snowStyle(i: number) {
  const left = Math.random() * 100
  const duration = 2 + Math.random() * 3
  const delay = Math.random() * 5
  const size = 3 + Math.random() * 5
  return {
    left: `${left}%`,
    width: `${size}px`,
    height: `${size}px`,
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`
  }
}
</script>

<style scoped>
.weather-effects {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

/* 晴天光晕 */
.sun-glow {
  position: absolute;
  top: -120px;
  right: -120px;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.14) 0%, rgba(245, 158, 11, 0.04) 45%, transparent 70%);
  animation: sunPulse 6s ease-in-out infinite;
}

@keyframes sunPulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.08); opacity: 1; }
}

/* 晴天光线 */
.sun-rays {
  position: absolute;
  top: 30px;
  right: 60px;
  width: 120px;
  height: 120px;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(245, 158, 11, 0.08) 10deg,
    transparent 20deg,
    transparent 30deg,
    rgba(245, 158, 11, 0.08) 40deg,
    transparent 50deg,
    transparent 60deg,
    rgba(245, 158, 11, 0.08) 70deg,
    transparent 80deg,
    transparent 90deg,
    rgba(245, 158, 11, 0.08) 100deg,
    transparent 110deg,
    transparent 120deg,
    rgba(245, 158, 11, 0.08) 130deg,
    transparent 140deg,
    transparent 150deg,
    rgba(245, 158, 11, 0.08) 160deg,
    transparent 170deg,
    transparent 180deg,
    rgba(245, 158, 11, 0.08) 190deg,
    transparent 200deg,
    transparent 210deg,
    rgba(245, 158, 11, 0.08) 220deg,
    transparent 230deg,
    transparent 240deg,
    rgba(245, 158, 11, 0.08) 250deg,
    transparent 260deg,
    transparent 270deg,
    rgba(245, 158, 11, 0.08) 280deg,
    transparent 290deg,
    transparent 300deg,
    rgba(245, 158, 11, 0.08) 310deg,
    transparent 320deg,
    transparent 330deg,
    rgba(245, 158, 11, 0.08) 340deg,
    transparent 350deg,
    transparent 360deg
  );
  border-radius: 50%;
  animation: sunRotate 20s linear infinite;
  opacity: 0.6;
}

@keyframes sunRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 云 */
.cloud {
  position: absolute;
  background: rgba(148, 163, 184, 0.14);
  border-radius: 50px;
  filter: blur(8px);
  animation: cloudDrift linear infinite;
}
.cloud::before,
.cloud::after {
  content: '';
  position: absolute;
  background: inherit;
  border-radius: 50%;
}
.cloud-1 { width: 140px; height: 50px; top: 12%; animation-duration: 35s; }
.cloud-1::before { width: 60px; height: 60px; top: -28px; left: 18px; }
.cloud-1::after { width: 50px; height: 50px; top: -20px; right: 20px; }
.cloud-2 { width: 100px; height: 38px; top: 28%; animation-duration: 45s; animation-delay: -10s; }
.cloud-2::before { width: 45px; height: 45px; top: -22px; left: 14px; }
.cloud-2::after { width: 38px; height: 38px; top: -16px; right: 16px; }
.cloud-3 { width: 160px; height: 56px; top: 55%; animation-duration: 40s; animation-delay: -22s; }
.cloud-3::before { width: 70px; height: 70px; top: -32px; left: 22px; }
.cloud-3::after { width: 55px; height: 55px; top: -24px; right: 24px; }
.cloud-4 { width: 120px; height: 44px; top: 78%; animation-duration: 50s; animation-delay: -5s; }
.cloud-4::before { width: 52px; height: 52px; top: -26px; left: 16px; }
.cloud-4::after { width: 44px; height: 44px; top: -20px; right: 18px; }

@keyframes cloudDrift {
  from { transform: translateX(-200px); }
  to { transform: translateX(calc(100vw + 200px)); }
}

/* 雨滴 */
.raindrop {
  position: absolute;
  top: -24px;
  width: 2px;
  background: linear-gradient(to bottom, transparent, rgba(56, 189, 248, 0.6));
  border-radius: 2px;
  animation-name: rainFall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes rainFall {
  from { transform: translateY(-10vh); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  to { transform: translateY(110vh); opacity: 0; }
}

/* 雪花 */
.snowflake {
  position: absolute;
  top: -10px;
  background: rgba(186, 230, 253, 0.8);
  border-radius: 50%;
  animation-name: snowFall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes snowFall {
  from { transform: translateY(-10vh) translateX(0); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  to { transform: translateY(110vh) translateX(20px); opacity: 0; }
}

/* 闪电 */
.lightning {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.15);
  opacity: 0;
  animation: flash 5s infinite;
}

@keyframes flash {
  0%, 90%, 100% { opacity: 0; }
  92% { opacity: 0.8; }
  93% { opacity: 0; }
  94% { opacity: 0.6; }
  96% { opacity: 0; }
}
</style>

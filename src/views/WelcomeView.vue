<template>
  <div class="welcome-shell">
    <!-- 顶部真实烟花：辉光核心 + 放射粒子 + 拖尾，错峰绽放 -->
    <div class="fw" aria-hidden="true">
      <svg class="fw-svg" viewBox="0 0 420 200" preserveAspectRatio="xMidYMin slice">
        <defs>
          <filter id="fw-bloom" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>
        <g v-for="(f, idx) in fireworks" :key="idx" :transform="`translate(${f.x} ${f.y})`">
          <g class="fw-burst" :class="`fw-b${idx}`">
            <circle class="fw-core" r="2.6" :fill="f.color" />
            <g class="fw-rays" filter="url(#fw-bloom)">
              <line
                v-for="i in 12"
                :key="i"
                :x1="0"
                :y1="0"
                :x2="0"
                :y2="-24"
                :stroke="f.color"
                stroke-width="1.5"
                :transform="`rotate(${(i - 1) * 30})`"
                stroke-linecap="round"
              />
            </g>
          </g>
        </g>
      </svg>
    </div>

    <div class="welcome-center">
      <CompassLogo :size="104" animated glow class="wl-logo" />
      <h1 class="wl-title">智习罗盘欢迎你</h1>
      <p class="wl-hint">从左上角菜单进入各功能模块</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import CompassLogo from '../components/CompassLogo.vue'

const fireworks = [
  { x: 70, y: 72, color: '#fbbf24' },
  { x: 180, y: 46, color: '#f472b6' },
  { x: 300, y: 78, color: '#34d399' },
  { x: 360, y: 50, color: '#a78bfa' },
  { x: 240, y: 96, color: '#38bdf8' }
]
</script>

<style scoped>
.welcome-shell {
  position: relative;
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(120% 90% at 50% 0%, #f3f0ff 0%, #eef2fb 45%, #f7f9fd 100%);
  overflow: hidden;
}

/* 烟花层 */
.fw {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 220px;
  pointer-events: none;
}
.fw-svg {
  width: 100%;
  height: 100%;
}
.fw-burst {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  animation: fw-burst 3.6s ease-out infinite;
}
.fw-b0 { animation-delay: 0s; }
.fw-b1 { animation-delay: 0.9s; }
.fw-b2 { animation-delay: 1.8s; }
.fw-b3 { animation-delay: 0.5s; }
.fw-b4 { animation-delay: 2.5s; }
@keyframes fw-burst {
  0% { transform: scale(0.15); opacity: 0; }
  12% { opacity: 1; }
  55% { transform: scale(1); opacity: 0.95; }
  100% { transform: scale(1.2); opacity: 0; }
}

/* 中心内容 */
.welcome-center {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 0 20px;
  text-align: center;
}
.wl-logo {
  animation: wl-float 4s ease-in-out infinite;
}
@keyframes wl-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* 立体淡蓝紫流光标题 */
.wl-title {
  margin: 0;
  font-size: clamp(32px, 8vw, 60px);
  font-weight: 900;
  letter-spacing: 3px;
  background: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 45%, #7c3aed 100%);
  background-size: 100% 220%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 3px 6px rgba(109, 40, 217, 0.35));
  animation: wl-flow 4s linear infinite;
}
@keyframes wl-flow {
  0% { background-position: 0% 0%; }
  100% { background-position: 0% 220%; }
}

.wl-hint {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #8b8fb5;
  letter-spacing: 0.5px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .welcome-center { gap: 18px; }
  .wl-hint { font-size: 13px; }
}
@media (max-width: 380px) {
  .welcome-center { gap: 14px; }
}
</style>

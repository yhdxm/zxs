<template>
  <div class="rc-view">
    <PageHeader
      title="自适应效果展示"
      subtitle="按你列出的 6 类设备（苹果 / 安卓 / 华为 / PDA / Win / Mac）逐档预览 UI 表现，定位溢出与错乱；顶部为真实视口检测，可在任意真机浏览器打开本页自检。"
    />

    <!-- 实时视口检测（真机有效） -->
    <div class="rc-detect" :class="{ 'rc-detect--warn': overflowX }">
      <div class="rc-d-row">
        <div class="rc-d-item">
          <span class="rc-d-k">当前视口</span>
          <span class="rc-d-v">{{ vw }} × {{ vh }}</span>
        </div>
        <div class="rc-d-item">
          <span class="rc-d-k">命中档位</span>
          <span class="rc-d-v">{{ currentTier }}</span>
        </div>
        <div class="rc-d-item rc-d-item--state">
          <span class="rc-d-k">横向溢出</span>
          <span class="rc-d-v" :class="overflowX ? 'is-bad' : 'is-ok'">
            {{ overflowX ? '⚠ 存在横向滚动，需修复' : '✓ 无溢出' }}
          </span>
        </div>
      </div>
      <p class="rc-d-tip">
        提示：在真实 iPhone / 安卓 / 华为 / PDA / Win / Mac 浏览器打开本页，上面的数值就是该设备真实表现；
        下方设备框是在桌面端按视口宽度模拟布局（能反映换行/溢出，但无法模拟各浏览器内核差异）。
      </p>
    </div>

    <!-- 响应式规范清单（已落地，可对照自检） -->
    <div class="rc-rules">
      <h3 class="rc-rules-title">响应式规范（项目已落地，可对照自检）</h3>
      <div class="rc-rules-grid">
        <div v-for="(r, i) in rules" :key="i" class="rc-rule" :class="{ 'rc-rule--ok': r.ok }">
          <el-icon class="rc-rule-icon"><component :is="r.ok ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
          <span class="rc-rule-text">{{ r.text }}</span>
        </div>
      </div>
    </div>

    <!-- 设备预览网格 -->
    <div class="rc-grid">
      <div
        v-for="d in devices"
        :key="d.key"
        class="rc-card"
        :class="{ 'rc-card--wide': d.platform === 'desktop' }"
      >
        <div class="rc-card-head">
          <span class="rc-card-name"><el-icon><Monitor /></el-icon> {{ d.name }}</span>
          <span class="rc-card-spec">{{ d.width }} × {{ d.height }} · {{ d.os }}</span>
        </div>

        <div class="rc-stage" :class="{ 'rc-stage--desktop': d.platform === 'desktop' }">
          <!-- 桌面类：缩放展示，保持真实多列布局 -->
          <template v-if="d.platform === 'desktop'">
            <div class="rc-scale-wrap" :style="scaledSize(d)">
              <div class="rc-frame rc-frame--desktop" :style="frameStyle(d)">
                <div class="rc-winbar"><i></i><i></i><i></i><span class="rc-win-title">影仓智核 · 自适应预览</span></div>
                <div class="rc-screen" :style="{ height: d.height - 26 + 'px' }">
                  <UiSample :os="d.os" />
                </div>
              </div>
            </div>
          </template>

          <!-- 手机 / PDA：真实宽度渲染，外框可横滚看全 -->
          <template v-else>
            <div
              class="rc-frame"
              :class="d.platform === 'pda' ? 'rc-frame--pda' : 'rc-frame--phone'"
              :style="frameStyle(d)"
            >
              <div v-if="d.platform === 'mobile'" class="rc-notch"></div>
              <div v-if="d.platform === 'pda'" class="rc-pda-tag">PDA</div>
              <div class="rc-screen">
                <UiSample :os="d.os" />
              </div>
            </div>
          </template>
        </div>

        <div class="rc-info">
          <p class="rc-info-label">常见显示问题</p>
          <p class="rc-info-text">{{ d.notes }}</p>
          <p class="rc-info-label rc-info-label--ok">优化建议</p>
          <p class="rc-info-text">{{ d.advice }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import UiSample from '../components/UiSample.vue'
import { Monitor, CircleCheckFilled, WarningFilled } from '@element-plus/icons-vue'

interface DeviceSpec {
  key: string
  name: string
  platform: 'mobile' | 'pda' | 'desktop'
  width: number
  height: number
  os: string
  notes: string
  advice: string
  scale?: number
}

interface RuleItem {
  ok: boolean
  text: string
}

/** 项目已落地的响应式规范清单（与全局铁律一致，可对照自检） */
const rules: RuleItem[] = [
  { ok: true, text: '移动优先：以 360px 为最小基准断点验证，所有页面支持到约 320px（PDA 手持终端）。' },
  { ok: true, text: '栅格与卡片：Element Plus 栅格 + minmax(0,1fr) 自适应卡片网格，不写死列宽、不溢出。' },
  { ok: true, text: '断点体系：≥1200 多列 / 768–1199 两列 / ≤768 单列 / ≤480 紧凑 / ≤360 极窄 / ≤320 PDA 横屏。' },
  { ok: true, text: '表格自适应：超宽表格外层 overflow-x:auto 横向滚动，绝不撑破整体布局。' },
  { ok: true, text: '图表自适应：图表容器用百分比宽 + 监听窗口 resize / ResizeObserver 重绘，不写死像素宽。' },
  { ok: true, text: '弹窗与抽屉：移动端宽度取 min(720px, 94vw)，按钮与表单项纵向堆叠、可单手操作。' },
  { ok: true, text: '安全区适配：移动端底部操作区加 env(safe-area-inset-*) 内边距，避免被系统手势条/工具栏遮挡。' },
  { ok: true, text: '持续巡检：本页设备框 + 顶部真机视口检测用于回归验证，发现横向溢出立即定位修复。' }
]

const devices: DeviceSpec[] = [
  {
    key: 'iphone',
    name: '苹果 iPhone',
    platform: 'mobile',
    width: 390,
    height: 844,
    os: 'iOS / Safari',
    notes: '刘海 / 灵动岛占用顶部安全区；底部 Home Indicator 占用安全区；Safari 底部工具栏会遮挡 fixed 元素。',
    advice: '关键操作区加 env(safe-area-inset-bottom) 内边距；底部固定栏高度 ≥ 34px + 安全区；避免贴底 fixed 按钮被工具栏盖住。'
  },
  {
    key: 'android',
    name: '安卓手机',
    platform: 'mobile',
    width: 412,
    height: 915,
    os: 'Android / Chrome',
    notes: '机型碎片化严重（360~430 宽都有）；部分厂商有底部手势条；WebView 内核有差异。',
    advice: '不要写死 390/414，按 360 最小宽度设计；用 minmax / 百分比而非固定宽；手势条同样加安全区内边距。'
  },
  {
    key: 'huawei',
    name: '华为手机',
    platform: 'mobile',
    width: 360,
    height: 800,
    os: 'HarmonyOS / 华为浏览器',
    notes: '常见宽度 360，比 iPhone 更窄；部分旧机型 WebView 对复杂 Grid 支持略弱；状态栏较高。',
    advice: '以 360px 为移动端最小基准断点验证；复杂 Grid 降级为 flex-wrap 双保险；正文字号不小于 14px。'
  },
  {
    key: 'pda',
    name: 'PDA 手持终端',
    platform: 'pda',
    width: 320,
    height: 480,
    os: 'Android（工业）',
    notes: '视口常仅 320px 宽，且多为横屏（640×320）；触控笔 / 手套操作，目标小易误触；设备性能弱。',
    advice: '必须支持 320px 竖屏与 640×320 横屏；触控目标 ≥ 40×40px；禁用大图 / 重动画；任何固定宽元素都会直接横向溢出。'
  },
  {
    key: 'win',
    name: 'Windows 电脑',
    platform: 'desktop',
    width: 1366,
    height: 768,
    os: 'Windows / Chrome·Edge',
    scale: 0.46,
    notes: '最小笔记本 1366×768；超宽屏下内容若无限拉伸会留白过多、单行阅读过长。',
    advice: '内容区加 max-width（如 1400px）居中约束；栅格设最大列数；避免满屏铺开导致单行过长难读。'
  },
  {
    key: 'mac',
    name: '苹果 Mac',
    platform: 'desktop',
    width: 1440,
    height: 900,
    os: 'macOS / Safari',
    scale: 0.42,
    notes: '常见 1440×900 / 1280×800；Safari 对 backdrop-filter 支持好，但部分 CSS 前缀与 Chrome 略有差异。',
    advice: '同 Windows 用 max-width 约束内容；Safari 与 Chrome 的 flex / gap 表现基本一致，一般无需特殊处理。'
  }
]

const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
const overflowX = ref(false)

function detect() {
  vw.value = window.innerWidth
  vh.value = window.innerHeight
  // 文档实际宽度大于视口宽度即判定存在横向溢出
  overflowX.value = document.documentElement.scrollWidth > window.innerWidth + 1
}
onMounted(() => {
  detect()
  window.addEventListener('resize', detect)
})
onUnmounted(() => window.removeEventListener('resize', detect))

const currentTier = computed(() => {
  const w = vw.value
  if (w <= 320) return 'PDA / 极窄屏 (≤320)'
  if (w <= 480) return '手机竖屏 (≤480)'
  if (w <= 768) return '平板 / 大手机 (≤768)'
  if (w <= 1024) return '小笔记本 (≤1024)'
  if (w <= 1440) return '笔记本 / 桌面 (≤1440)'
  return '大屏桌面 (>1440)'
})

function frameStyle(d: DeviceSpec): Record<string, string> {
  if (d.platform === 'desktop' && d.scale) {
    return {
      width: d.width + 'px',
      height: d.height + 'px',
      transform: `scale(${d.scale})`,
      transformOrigin: 'top left'
    }
  }
  return { width: d.width + 'px' }
}
function scaledSize(d: DeviceSpec) {
  const s = d.scale || 1
  return { width: d.width * s + 'px', height: d.height * s + 'px' }
}
</script>

<style scoped>
.rc-view {
  padding: 0 4px 24px;
}
/* 检测条 */
.rc-detect {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.rc-detect--warn {
  background: #fef2f2;
  border-color: #fecaca;
}
.rc-d-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  align-items: center;
}
.rc-d-item { display: flex; flex-direction: column; gap: 2px; }
.rc-d-k { font-size: 12px; color: #6b7280; }
.rc-d-v { font-size: 15px; font-weight: 700; color: #111827; }
.rc-d-item--state .rc-d-v.is-ok { color: #059669; }
.rc-d-item--state .rc-d-v.is-bad { color: #dc2626; }
.rc-d-tip { margin: 10px 0 0; font-size: 12px; color: #6b7280; line-height: 1.6; }

/* 响应式规范清单 */
.rc-rules {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 16px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}
.rc-rules-title { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #1f2937; }
.rc-rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px 18px;
}
.rc-rule {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12.5px;
  color: #4b5563;
  line-height: 1.6;
}
.rc-rule-icon { margin-top: 2px; flex-shrink: 0; font-size: 16px; color: #d1d5db; }
.rc-rule--ok .rc-rule-icon { color: #10b981; }
.rc-rule-text { min-width: 0; }

/* 设备网格 */
.rc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 16px;
}
.rc-card--wide { grid-column: 1 / -1; }
.rc-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.rc-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}
.rc-card-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 14px;
  color: #1f2937;
}
.rc-card-spec { font-size: 12px; color: #9ca3af; }

/* 舞台：手机/PDA 可横滚；桌面用缩放包裹 */
.rc-stage {
  background: #eef2f7;
  padding: 14px;
  display: flex;
  justify-content: center;
  overflow: auto;
  min-height: 240px;
}
.rc-stage--desktop { overflow: hidden; }

/* 设备外框 */
.rc-frame {
  background: #fff;
  position: relative;
  flex: none;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}
.rc-frame--phone {
  border-radius: 30px;
  border: 10px solid #1f2937;
  overflow: hidden;
}
.rc-frame--pda {
  border-radius: 8px;
  border: 6px solid #374151;
  overflow: hidden;
}
.rc-frame--desktop {
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  overflow: hidden;
}
.rc-notch {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 22px;
  background: #1f2937;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  z-index: 5;
}
.rc-pda-tag {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #374151;
  color: #fff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  z-index: 5;
}
.rc-screen {
  background: #f5f7fa;
  overflow-y: auto;
  height: 600px;
}
.rc-frame--desktop .rc-screen { background: #f5f7fa; }
.rc-winbar {
  height: 26px;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-bottom: 1px solid #cbd5e1;
}
.rc-winbar i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f87171;
  display: inline-block;
}
.rc-winbar i:nth-child(2) { background: #fbbf24; }
.rc-winbar i:nth-child(3) { background: #34d399; }
.rc-win-title { margin-left: 8px; font-size: 11px; color: #64748b; }
.rc-scale-wrap { overflow: hidden; }

/* 诊断信息 */
.rc-info {
  padding: 12px 14px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
}
.rc-info-label {
  font-size: 12px;
  font-weight: 700;
  color: #b45309;
  margin: 0 0 4px;
}
.rc-info-label--ok { color: #047857; margin-top: 8px; }
.rc-info-text {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.6;
  margin: 0;
}

/* 窄屏卡片单列铺满 */
@media (max-width: 768px) {
  .rc-grid { grid-template-columns: 1fr; }
}
</style>

<template>
  <el-dialog
    v-model="visible"
    :title="title || '资料预览'"
    class="pdfv-dialog"
    :class="{ 'pdfv--fullscreen': isFullscreen, 'pdfv--scroll': mode === 'scroll' }"
    width="96vw"
    top="2vh"
    :fullscreen="isMobile"
  >
    <div ref="rootEl" class="pdfv-root" @fullscreenchange="onFullscreenChange">
      <!-- 工具栏 -->
      <div class="pdfv-bar">
        <div v-if="!useNative" class="pdfv-bar-left">
          <button v-if="!isMobile" type="button" class="pdfv-btn" @click="toggleMode">
            {{ mode === 'scroll' ? '单页' : '滚动' }}
          </button>
          <button type="button" class="pdfv-btn" @click="prev" :disabled="pageNum <= 1">‹</button>

          <template v-if="mode === 'single'">
            <span class="pdfv-page">
              <input
                v-model.number="pageInput"
                type="number"
                min="1"
                :max="numPages"
                class="pdfv-page-input"
                @change="jumpFromInput"
              />
              <span>/ {{ numPages }}</span>
            </span>
            <button type="button" class="pdfv-btn" @click="next" :disabled="pageNum >= numPages">›</button>
          </template>

          <template v-else>
            <span class="pdfv-page">
              <input
                v-model.number="pageInput"
                type="number"
                min="1"
                :max="numPages"
                class="pdfv-page-input"
                @change="jumpFromInput"
              />
              <span>/ {{ numPages }}</span>
            </span>
          </template>
        </div>

        <div class="pdfv-bar-right">
          <span v-if="loadSource && !useNative" class="pdfv-src">{{ loadSource }}</span>
          <!-- 系统阅读器：PC 端兜底；移动端 iframe 实测白屏，不显示 -->
          <button
            v-if="!isMobile"
            type="button"
            class="pdfv-btn"
            :class="{ 'pdfv-on': useNative }"
            title="用浏览器自带的 PDF 阅读器打开，兼容性最好"
            @click="toggleNative"
          >
            {{ useNative ? '高级阅读' : '系统阅读器' }}
          </button>
          <button type="button" class="pdfv-btn pdfv-fullscreen" @click="toggleFullscreen">
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </button>
          <a class="pdfv-dl" :href="url" target="_blank" rel="noopener">⬇ 下载</a>
        </div>
      </div>

      <!-- 加载进度：百分比数字 + 横条，避免用户以为卡死 -->
      <div v-if="phase === 'loading' && !useNative" class="pdfv-progress">
        <div class="pdfv-progress-track">
          <div class="pdfv-progress-bar" :style="{ width: progress + '%' }"></div>
        </div>
        <span class="pdfv-progress-txt">{{ progress }}%</span>
      </div>

      <!-- 主体 -->
      <div ref="bodyEl" class="pdfv-body" @scroll="onScrollThrottled">
        <!-- 系统阅读器：浏览器原生渲染 PDF，移动端兼容性最好 -->
        <div v-if="useNative" class="pdfv-native-wrap">
          <iframe :src="url" class="pdfv-native" title="PDF 预览" frameborder="0"></iframe>
          <div class="pdfv-native-hint">
            <p>预览已交给系统查看器。若上方区域空白（部分手机内核不支持内嵌 PDF），请用下方按钮：</p>
            <div class="pdfv-native-acts">
              <a class="pdfv-dl" :href="url" target="_blank" rel="noopener">📖 全屏打开</a>
              <a class="pdfv-dl" :href="url" download rel="noopener">⬇ 下载保存</a>
            </div>
          </div>
        </div>

        <template v-else>
          <div v-if="phase === 'loading'" class="pdfv-tip">
            正在加载 PDF…（{{ loadSource || '准备中' }}）
          </div>
          <div v-else-if="phase === 'error'" class="pdfv-tip pdfv-err">
            {{ errMsg }}
            <div v-if="lastRenderError" class="pdfv-err-debug">{{ lastRenderError }}</div>
            <div class="pdfv-err-sub">
              请
              <a :href="url" target="_blank" rel="noopener">下载后查看</a>
            </div>
          </div>

        <template v-else>
          <!-- 单页模式：当前页（支持左右滑动手势翻页） -->
          <div
            v-if="mode === 'single'"
            class="pdfv-page-wrap pdfv-page-wrap--single"
            @touchstart="onSwipeStart"
            @touchend="onSwipeEnd"
          >
            <canvas ref="canvasEl" class="pdfv-canvas"></canvas>
          </div>

          <!-- 连续滚动模式：所有页面容器 -->
          <div v-else class="pdfv-scroll">
            <div
              v-for="i in numPages"
              :key="i"
              class="pdfv-page-wrap"
              :data-page="i"
            >
              <canvas :ref="(el) => setPageRef(el, i)" class="pdfv-canvas"></canvas>
            </div>
          </div>
        </template>
        </template>
      </div>

      <!-- 滚动模式回到顶部/底部 -->
      <div v-if="mode === 'scroll' && phase === 'ready'" class="pdfv-float">
        <button type="button" class="pdfv-btn" @click="scrollToPage(1)">顶部</button>
        <button type="button" class="pdfv-btn" @click="scrollToPage(numPages)">底部</button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElDialog } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  url: string
  title?: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const isMobile = ref(false)
if (typeof window !== 'undefined') {
  isMobile.value = window.innerWidth <= 768
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth <= 768
  })
}

const PDFJS_VER = '3.11.174'
// 加载优先级：① 本地 public/pdfjs（离线可用，不依赖网络，移动端成功率最高）
//            ② jsDelivr CDN  ③ unpkg CDN（前两级都失败时的兜底）
const BASE = import.meta.env.BASE_URL || './'
const SOURCES = [
  { js: `${BASE}pdfjs/pdf.min.js`, worker: `${BASE}pdfjs/pdf.worker.min.js`, name: '本地' },
  {
    js: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.min.js`,
    worker: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.worker.min.js`,
    name: 'jsDelivr'
  },
  {
    js: `https://unpkg.com/pdfjs-dist@${PDFJS_VER}/build/pdf.min.js`,
    worker: `https://unpkg.com/pdfjs-dist@${PDFJS_VER}/build/pdf.worker.min.js`,
    name: 'unpkg'
  }
]

const phase = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const errMsg = ref('')
const pageNum = ref(1)
const numPages = ref(0)
const pageInput = ref(1)
const mode = ref<'single' | 'scroll'>('single')
const isFullscreen = ref(false)
/** 实际生效的 pdf.js 加载源（本地/CDN），用于状态提示 */
const loadSource = ref('')
/** 文档加载进度 0-100（含下载与解析） */
const progress = ref(0)
/** 是否改用系统阅读器（iframe 原生预览）。PC 端允许用户手动切换；移动端 iframe 实测白屏，强制走 pdf.js。 */
const useNative = ref(false)
/** 最近一次渲染失败的具体原因，用于 UI 显式提示（不再只在 console） */
const lastRenderError = ref('')
/** 用户手动选择的模式；null 表示未手动选。仅在 PC 端生效 */
let userMode: boolean | null = null

const rootEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const pageCanvasMap = ref<Record<number, HTMLCanvasElement>>({})

let pdfDoc: any = null
let pdfDocUrl = ''
let renderTask: any = null
let observer: IntersectionObserver | null = null
let scrollTimer: number | null = null
const renderedPages = new Set<number>()
/** 单页模式左右滑动手势起点 */
let touchStartX = 0
let touchStartY = 0

function loadScript(src: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const exist = document.querySelector<HTMLScriptElement>(`script[data-pdfjs="${src}"]`)
    if (exist) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.pdfjs = src
    // 超时兜底：CDN 被墙/网络挂起时 onerror 不触发，必须定时放弃并尝试下一源，避免永远"准备中"
    const timer = window.setTimeout(() => {
      s.onload = null
      s.onerror = null
      reject(new Error('load timeout'))
    }, timeoutMs)
    s.onload = () => {
      window.clearTimeout(timer)
      resolve()
    }
    s.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('load fail'))
    }
    document.head.appendChild(s)
  })
}

/** 依次尝试 本地 → jsDelivr → unpkg，任一成功即返回；全部失败抛错 */
async function ensurePdfjs(): Promise<any> {
  const g = window as any
  if (g.pdfjsLib) return g.pdfjsLib
  let lastErr: unknown = null
  for (const s of SOURCES) {
    try {
      await loadScript(s.js)
      const lib = g.pdfjsLib
      if (!lib) throw new Error('脚本已加载但 pdfjsLib 未挂载')
      lib.GlobalWorkerOptions.workerSrc = s.worker
      loadSource.value = s.name
      return lib
    } catch (e) {
      lastErr = e
      console.warn('[PdfViewer] 加载源失败:', s.name, e)
    }
  }
  throw new Error('PDF 阅读器加载失败（本地与 CDN 均不可用）')
}

async function openDoc() {
  if (!props.url) return
  // 移动端强制 pdf.js 应用内渲染：IQOO 等国产 Chromium 内核 iframe 内嵌 PDF 白屏，不可依赖。
  // 移动端默认「连续滚动」阅读器（上下滑看所有页，体验同普通阅读器）；PC 端尊重用户手动选择。
  useNative.value = isMobile.value ? false : (userMode ?? false)
  if (isMobile.value) {
    mode.value = 'scroll'
  } else {
    mode.value = userMode ? 'scroll' : 'single'
  }
  if (useNative.value) {
    phase.value = 'ready'
    numPages.value = 0
    return
  }
  phase.value = 'loading'
  errMsg.value = ''
  progress.value = 0
  try {
    const lib = await ensurePdfjs()
    if (pdfDocUrl !== props.url) {
      if (pdfDoc?.destroy) {
        try {
          await pdfDoc.destroy()
        } catch {
          /* noop */
        }
      }
      renderedPages.clear()
      pageCanvasMap.value = {}
      // 省内存三件套之一：disableAutoFetch+disableStream 走 HTTP Range 分块按需下载，
      // 只拉当前阅读位置附近的数据块，20MB 大文件不再整本吃进内存（GitHub Pages 支持 Range）
      pdfDoc = await lib.getDocument({
        url: props.url,
        disableAutoFetch: true,
        disableStream: true,
        onProgress: (p: { loaded?: number; total?: number }) => {
          if (p?.loaded != null) {
            if (p.total) {
              progress.value = Math.min(99, Math.round((p.loaded / p.total) * 100))
            } else {
              // pdfjs 某些下载阶段不传 total（流式/range 请求），给个 indeterminate 进度让用户看到在动
              progress.value = Math.min(90, (progress.value || 10) + 5)
            }
          }
        }
      }).promise
      pdfDocUrl = props.url
      numPages.value = pdfDoc.numPages || 0
      pageNum.value = 1
      pageInput.value = 1
      progress.value = 100
    }
    phase.value = 'ready'
    await nextTick()
    // 等一帧：确保 el-dialog 过渡结束、容器宽度已就绪（移动端真机 clientWidth 常为 0→canvas 白屏主因）
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (mode.value === 'single') {
      await renderPage(pageNum.value, canvasEl.value)
    } else {
      setupScrollObserver()
      await renderVisiblePages()
    }
  } catch (e: any) {
    // pdf.js 加载/解析失败：移动端 iframe 实测白屏，不再自动切换；直接提示下载查看。
    console.warn('[PdfViewer] 打开失败', e)
    if (!isMobile.value) {
      userMode = true
      useNative.value = true
      phase.value = 'ready'
      numPages.value = 0
      errMsg.value = ''
    } else {
      phase.value = 'error'
      errMsg.value = 'PDF 预览加载失败，请下载后查看'
    }
  }
}

async function renderPage(p: number, canvas: HTMLCanvasElement | null | undefined) {
  if (!pdfDoc || !canvas || !rootEl.value) return
  if (renderedPages.has(p) && mode.value === 'scroll') {
    // 滚动模式里每张 canvas 只渲染一次，除非容器宽度变了
  }
  try {
    const page = await pdfDoc.getPage(p)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 容器宽度保护：弹窗过渡未结束时 clientWidth 可能为 0，导致 canvas 尺寸异常→真机白屏。
    // 移动端优先用 visualViewport/innderWidth 取整屏可用宽（避免 el-dialog 内边距吃掉宽度），
    // 非移动端/全屏用 rootEl 宽度，最后兜底保证拿到正数。
    const vpWidth = (window as any).visualViewport?.width || window.innerWidth || 390
    let containerW = isMobile.value
      ? Math.max(vpWidth - (isFullscreen.value ? 0 : 2), (rootEl.value?.clientWidth || 0) - 4)
      : (rootEl.value?.clientWidth || 0) - 24
    if (containerW <= 0) containerW = (window.innerWidth || 390) - (isMobile.value ? 2 : 40)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.max(containerW / base.width, 0.5)
    // 清晰度提升：移动端按设备真实 DPR 渲染（IQOO Neo9 DPR=3），使 canvas 物理像素对齐设备像素，
    // 不再被 2.0 上限压糊（之前 360 CSS 宽只渲染 720 物理像素、被拉伸到 1080 设备像素→发虚）。
    // 单页模式同时只渲染一页，内存约 6-7MB 完全可控；上限 3 防止超高分屏爆内存。
    const dprCap = isMobile.value ? 3 : 2
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
    let viewport = page.getViewport({ scale: scale * dpr })
    const maxPx = isMobile.value ? 1700 : 1700
    if (viewport.width > maxPx) {
      viewport = page.getViewport({ scale: (scale * maxPx) / base.width })
    }

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${Math.floor(base.width * scale)}px`
    canvas.style.height = `${Math.floor(base.height * scale)}px`
    // 先铺白底，避免某些内核渲染首帧前透明露出导致的「空白」观感
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (renderTask) {
      try {
        renderTask.cancel()
      } catch {
        /* noop */
      }
    }
    renderTask = page.render({ canvasContext: ctx, viewport })
    await renderTask.promise
    renderedPages.add(p)
  } catch (e: any) {
    if (e?.name !== 'RenderingCancelledException') {
      console.warn('[PdfViewer] 渲染失败', e)
      lastRenderError.value = String(e?.message || e || '未知渲染错误')
    }
  }
}

/* ==================== 单页模式 ==================== */
function prev() {
  if (pageNum.value > 1) {
    pageNum.value--
    pageInput.value = pageNum.value
    if (mode.value === 'single') renderPage(pageNum.value, canvasEl.value)
    else scrollToPage(pageNum.value)
  }
}
function next() {
  if (pageNum.value < numPages.value) {
    pageNum.value++
    pageInput.value = pageNum.value
    if (mode.value === 'single') renderPage(pageNum.value, canvasEl.value)
    else scrollToPage(pageNum.value)
  }
}
function jumpFromInput() {
  let n = Number(pageInput.value)
  if (Number.isNaN(n)) return
  n = Math.max(1, Math.min(numPages.value, n))
  pageInput.value = n
  pageNum.value = n
  if (mode.value === 'single') {
    renderPage(n, canvasEl.value)
  } else {
    scrollToPage(n)
  }
}

/* ==================== 移动端左右滑动手势翻页 ==================== */
function onSwipeStart(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!t) return
  touchStartX = t.clientX
  touchStartY = t.clientY
}
function onSwipeEnd(e: TouchEvent) {
  if (mode.value !== 'single') return
  const t = e.changedTouches[0]
  if (!t) return
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  // 横向位移 > 32px 且大于纵向，才算翻页手势（避免与上下滚动冲突）
  if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) next()
    else prev()
  }
}

/* ==================== 滚动模式 ==================== */
function setPageRef(el: unknown, i: number) {
  if (el instanceof HTMLCanvasElement) {
    pageCanvasMap.value[i] = el
  }
}

function setupScrollObserver() {
  if (observer) observer.disconnect()
  if (!bodyEl.value) return
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const p = Number((entry.target as HTMLElement).dataset.page)
        if (entry.isIntersecting && p) {
          void renderPage(p, pageCanvasMap.value[p])
          updateCurrentPageFromScroll()
          trimDistantPages(pageNum.value)
        }
      })
    },
    { root: bodyEl.value, threshold: 0.15 }
  )
  const wraps = bodyEl.value.querySelectorAll('.pdfv-page-wrap[data-page]')
  wraps.forEach((w) => observer?.observe(w))
}

function updateCurrentPageFromScroll() {
  if (!bodyEl.value || mode.value !== 'scroll') return
  const wrap = bodyEl.value.querySelector('.pdfv-scroll')
  if (!wrap) return
  const rect = bodyEl.value.getBoundingClientRect()
  let closestPage = 0
  let closestDist = Infinity
  wrap.querySelectorAll<HTMLElement>('.pdfv-page-wrap[data-page]').forEach((el) => {
    const p = Number(el.dataset.page)
    if (!p) return
    const r = el.getBoundingClientRect()
    const dist = Math.abs(r.top - rect.top)
    if (dist < closestDist) {
      closestDist = dist
      closestPage = p
    }
  })
  if (closestPage > 0) {
    pageNum.value = closestPage
    pageInput.value = closestPage
  }
}

function onScrollThrottled() {
  if (mode.value !== 'scroll' || scrollTimer) return
  scrollTimer = window.setTimeout(() => {
    scrollTimer = null
    updateCurrentPageFromScroll()
  }, 150)
}

function scrollToPage(p: number) {
  const el = pageCanvasMap.value[p]?.parentElement
  if (el && bodyEl.value) {
    bodyEl.value.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
  }
}

/** 省内存三件套之三：滚动模式只保留当前页 ±3 页的画布，远页释放显存（保留 CSS 占位尺寸防滚动跳动） */
function trimDistantPages(current: number) {
  if (mode.value !== 'scroll') return
  const keep = 3
  for (const key of Object.keys(pageCanvasMap.value)) {
    const p = Number(key)
    if (!p || Math.abs(p - current) <= keep || !renderedPages.has(p)) continue
    const canvas = pageCanvasMap.value[p]
    if (!canvas) continue
    canvas.width = 1
    canvas.height = 1
    renderedPages.delete(p)
  }
}

async function renderVisiblePages() {
  if (!bodyEl.value) return
  const rect = bodyEl.value.getBoundingClientRect()
  const wraps = bodyEl.value.querySelectorAll<HTMLElement>('.pdfv-page-wrap[data-page]')
  for (const el of wraps) {
    const r = el.getBoundingClientRect()
    if (r.bottom >= rect.top && r.top <= rect.bottom) {
      const p = Number(el.dataset.page)
      if (!renderedPages.has(p)) {
        await renderPage(p, pageCanvasMap.value[p])
      }
    }
  }
  trimDistantPages(pageNum.value)
}

function toggleMode() {
  // 移动端强制单页，禁止切滚动；PC 端自由切换
  if (isMobile.value) return
  mode.value = mode.value === 'scroll' ? 'single' : 'scroll'
  renderedPages.clear()
  nextTick(() => {
    if (mode.value === 'single') {
      if (observer) {
        observer.disconnect()
        observer = null
      }
      renderPage(pageNum.value, canvasEl.value)
    } else {
      setupScrollObserver()
      renderVisiblePages()
    }
  })
}

/* ==================== 系统阅读器切换 ==================== */
function toggleNative() {
  if (isMobile.value) return
  userMode = !useNative.value
  useNative.value = userMode
  if (useNative.value) {
    // 系统阅读器：交给浏览器/手机原生 PDF 渲染，兼容性最好
    phase.value = 'ready'
    numPages.value = 0
    progress.value = 0
  } else {
    // 切回高级阅读：重新走 pdf.js 加载
    void openDoc()
  }
}

/* ==================== 全屏 ==================== */
function toggleFullscreen() {
  if (!rootEl.value) return
  if (!isFullscreen.value) {
    rootEl.value.requestFullscreen?.().catch(() => {
      // 浏览器不支持或不允许时，用 dialog fullscreen 兜底
      isFullscreen.value = false
    })
  } else {
    document.exitFullscreen?.().catch(() => {})
  }
}
function onFullscreenChange() {
  isFullscreen.value = Boolean(document.fullscreenElement)
  // 全屏切换后容器尺寸改变，按新视口重新渲染当前页：文档自适应放大、撑满可用空间，不再留白。
  // 延迟 320ms 等浏览器完成全屏布局（部分内核全屏后 clientWidth 仍短暂为旧值，导致 canvas 仍偏小）。
  if (!props.modelValue) return
  window.setTimeout(() => {
    if (mode.value === 'single') {
      void renderPage(pageNum.value, canvasEl.value)
    } else {
      setupScrollObserver()
      void renderVisiblePages()
    }
  }, 320)
}

/* ==================== 生命周期 ==================== */
watch(
  () => [props.modelValue, props.url],
  () => {
    if (props.modelValue && props.url) {
      void openDoc()
    }
  },
  { immediate: true }
)

watch(
  () => props.url,
  () => {
    // URL 切换时重置状态。移动端默认 pdf.js 连续滚动；PC 端保留手动选择。
    if (isMobile.value) {
      userMode = null
      useNative.value = false
      mode.value = 'scroll'
    } else {
      mode.value = userMode ? 'scroll' : 'single'
    }
    pdfDocUrl = ''
    renderedPages.clear()
    pageCanvasMap.value = {}
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }
)

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (scrollTimer) window.clearTimeout(scrollTimer)
})
</script>

<style scoped>
.pdfv-dialog :deep(.el-dialog__body) {
  padding: 0;
}
.pdfv-root {
  display: flex;
  flex-direction: column;
  height: 80vh;
}

/* 全屏模式 */
.pdfv-root:fullscreen {
  width: 100vw;
  height: 100vh;
  background: #0f172a;
}
/* 真·全屏（浏览器 Fullscreen API）下，顶部为系统状态栏叠加区，给画布区补安全区避免被遮。
   同样用 max(env, 下限) 把固定值设为硬下限：env 已定义但报 0 时 fallback 不触发，必须用 max 兜底。 */
.pdfv-root:fullscreen .pdfv-bar {
  padding-top: calc(6px + 28px);
  padding-top: calc(6px + max(env(safe-area-inset-top, 0px), 28px));
}
.pdfv-root:fullscreen .pdfv-body {
  padding: 0;
  padding-top: 6px;
  padding-top: calc(6px + max(env(safe-area-inset-top, 0px), 6px));
  /* 全屏时让单页 canvas 区真正撑满可用空间，可上下滑浏览长页。
     纵向 flex：justify-content:flex-start = 垂直顶部对齐（避免 center 把长页顶部裁掉无法回滚）；
     align-items:center = 水平居中。 */
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
}
.pdfv-root:fullscreen .pdfv-page-wrap--single {
  padding: 0;
  width: 100%;
  min-height: calc(100% - 6px);
}
/* 全屏滚动模式：让纵向页列表撑满可用宽度（全屏 body 是 flex，scroll 作为 item 需显式 100%） */
.pdfv-root:fullscreen .pdfv-scroll {
  width: 100%;
}
.pdfv-root:fullscreen .pdfv-bar {
  background: #0f172a;
  border-color: #334155;
}
.pdfv-root:fullscreen .pdfv-bar,
.pdfv-root:fullscreen .pdfv-page {
  color: #e2e8f0;
}

/* 工具栏 */
.pdfv-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-wrap: wrap;
}
.pdfv-bar-left,
.pdfv-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pdfv-btn {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12.5px;
  cursor: pointer;
  color: #334155;
  font-weight: 600;
  min-height: 34px;
  transition: all 0.15s ease;
}
.pdfv-btn:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}
.pdfv-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.pdfv-page {
  font-size: 13px;
  color: #475569;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pdfv-page-input {
  width: 54px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 13px;
  text-align: center;
  font-weight: 700;
}
.pdfv-fullscreen {
  color: #5b6cff;
  border-color: #dbe1ff;
}
.pdfv-dl {
  font-size: 12.5px;
  color: #5b6cff;
  text-decoration: none;
  font-weight: 700;
  border: 1px solid #dbe1ff;
  background: #fff;
  border-radius: 8px;
  padding: 7px 12px;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
}

/* 主体 */
.pdfv-body {
  flex: 1;
  background: #0f172a;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  text-align: center;
  padding: 8px;
}
/* 系统阅读器（iframe 原生预览）：撑满主体区域 */
.pdfv-native-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 60vh;
}
.pdfv-native {
  flex: 1;
  width: 100%;
  min-height: 50vh;
  border: 0;
  display: block;
  background: #fff;
  border-radius: 8px;
}
.pdfv-native-hint {
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  font-size: 12.5px;
  color: #94a3b8;
  background: #0f172a;
  text-align: left;
}
.pdfv-native-hint p {
  margin: 0 0 8px;
}
.pdfv-native-acts {
  display: flex;
  gap: 10px;
}
.pdfv-native-acts .pdfv-dl {
  flex: 1;
  justify-content: center;
  padding: 11px 12px;
  font-size: 13.5px;
}
.pdfv-page-wrap {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 120px;
  padding: 8px 0;
  width: 100%;
  box-sizing: border-box;
}
.pdfv-page-wrap--single {
  min-height: 100%;
  /* 关键：用 flex-start 而非 center。PDF 单页常比屏幕高，若 center 会把页面顶部
     推出滚动原点导致顶部被裁且无法向上滚动；flex-start 让页面从顶部开始、可向下滚动看完整页。 */
  align-items: flex-start;
}
.pdfv-canvas {
  display: block;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  max-width: 100%;
  width: auto;
  height: auto;
}
.pdfv-scroll {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  padding-bottom: 20px;
}
/* 滚动模式每页用 A4 比例占位（纵向 1:1.414），未渲染的 canvas 不会塌成默认 300x150 白块，
   保证纵向滚动位置稳定、不跳动；渲染后由 canvas 真实高度接管。IQOO 自带 Chromium 支持 aspect-ratio。 */
.pdfv-scroll .pdfv-page-wrap {
  min-height: 0;
  aspect-ratio: 1 / 1.414;
}
/* 未渲染的 canvas 设为透明，避免默认 300x150 白块在深色背景上露出；渲染后内部 fillRect 画白底 */
.pdfv-scroll .pdfv-canvas {
  background: transparent;
}
.pdfv-tip {
  padding: 60px 12px;
  font-size: 13px;
  color: #94a3b8;
}
.pdfv-err {
  color: #f87171;
}
.pdfv-err-sub {
  margin-top: 8px;
  font-size: 12.5px;
  color: #cbd5e1;
}
.pdfv-err-sub a {
  color: #93c5fd;
  font-weight: 700;
}
.pdfv-err-debug {
  margin-top: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: #fca5a5;
  text-align: left;
  word-break: break-all;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
}
.pdfv-float {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}

  /* 移动端 */
  @media (max-width: 768px) {
    .pdfv-root {
      height: 100vh;
      height: 100dvh;
    }
  .pdfv-bar {
    padding: calc(8px + env(safe-area-inset-top, 0px)) 10px 8px;
  }
  .pdfv-btn,
  .pdfv-dl {
    padding: 6px 10px;
    font-size: 12px;
  }
  .pdfv-page-input {
    width: 46px;
  }
  .pdfv-body {
    padding: 0;
  }
  .pdfv-page-wrap {
    padding: 0;
  }
  .pdfv-page-wrap--single {
    padding: 0 0 env(safe-area-inset-bottom, 8px) 0;
  }
  .pdfv-float {
    right: 10px;
    bottom: 10px;
  }
}
</style>

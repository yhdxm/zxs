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
        <div class="pdfv-bar-left">
          <button type="button" class="pdfv-btn" @click="toggleMode">
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
          <!-- 系统阅读器：常驻可切换，用浏览器原生渲染，成功率最高 -->
          <button
            type="button"
            class="pdfv-btn"
            :class="{ 'pdfv-on': useNative }"
            title="用手机/浏览器自带的 PDF 阅读器打开，兼容性最好"
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
        <iframe
          v-if="useNative"
          :src="url"
          class="pdfv-native"
          title="PDF 预览"
          frameborder="0"
        ></iframe>

        <template v-else>
          <div v-if="phase === 'loading'" class="pdfv-tip">
            正在加载 PDF…（{{ loadSource || '准备中' }}）
          </div>
          <div v-else-if="phase === 'error'" class="pdfv-tip pdfv-err">
            {{ errMsg }}
            <div class="pdfv-err-sub">
              可切换到
              <a href="javascript:void(0)" @click="toggleNative">系统阅读器</a>
              打开，或
              <a :href="url" target="_blank" rel="noopener">下载后查看</a>
            </div>
          </div>

        <template v-else>
          <!-- 单页模式：当前页 -->
          <div v-if="mode === 'single'" class="pdfv-page-wrap pdfv-page-wrap--single">
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
const mode = ref<'single' | 'scroll'>('scroll')
const isFullscreen = ref(false)
/** 实际生效的 pdf.js 加载源（本地/CDN），用于状态提示 */
const loadSource = ref('')
/** 文档加载进度 0-100（含下载与解析） */
const progress = ref(0)
/** 是否改用系统阅读器（iframe 原生预览），用户可随时切换 */
const useNative = ref(false)

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

function loadScript(src: string): Promise<void> {
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
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('load fail'))
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
  // 系统阅读器模式：直接交给浏览器原生渲染，不走 pdf.js
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
      // 进度回调：实时反馈下载/解析进度，避免"一直转圈看不到进展"
      pdfDoc = await lib.getDocument({
        url: props.url,
        onProgress: (p: { loaded?: number; total?: number }) => {
          if (p?.total && p.loaded != null) {
            progress.value = Math.min(99, Math.round((p.loaded / p.total) * 100))
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
    if (mode.value === 'single') {
      await renderPage(pageNum.value, canvasEl.value)
    } else {
      setupScrollObserver()
      await renderVisiblePages()
    }
  } catch (e: any) {
    errMsg.value = 'PDF 预览加载失败（可能是网络问题）。'
    phase.value = 'error'
    console.warn('[PdfViewer] 打开失败', e)
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

    const containerW = rootEl.value.clientWidth - 24
    const base = page.getViewport({ scale: 1 })
    const scale = Math.max(containerW / base.width, 0.5)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const viewport = page.getViewport({ scale: scale * dpr })

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${Math.floor(base.width * scale)}px`
    canvas.style.height = `${Math.floor(base.height * scale)}px`

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
}

function toggleMode() {
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
  useNative.value = !useNative.value
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
    // URL 切换时重置状态
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
.pdfv-page-wrap {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 120px;
  padding: 8px 0;
}
.pdfv-page-wrap--single {
  min-height: 100%;
  align-items: center;
}
.pdfv-canvas {
  display: inline-block;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  max-width: 100%;
}
.pdfv-scroll {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  padding-bottom: 20px;
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
    height: 100%;
  }
  .pdfv-bar {
    padding: 8px 10px;
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
    padding: 4px;
  }
  .pdfv-float {
    right: 10px;
    bottom: 10px;
  }
}
</style>

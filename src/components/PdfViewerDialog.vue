<template>
  <el-dialog
    v-model="visible"
    :title="title || '资料预览'"
    class="pdfv-dialog"
    :fullscreen="isMobile"
    width="900px"
    top="4vh"
  >
    <div class="pdfv-bar">
      <button type="button" :disabled="pageNum <= 1" @click="prev">‹ 上一页</button>
      <span class="pdfv-page">{{ numPages ? `${pageNum} / ${numPages}` : '—' }}</span>
      <button type="button" :disabled="pageNum >= numPages" @click="next">下一页 ›</button>
      <a class="pdfv-dl" :href="url" target="_blank" rel="noopener">⬇ 下载</a>
    </div>

    <div ref="wrapEl" class="pdfv-canvas-wrap">
      <div v-if="phase === 'loading'" class="pdfv-tip">正在加载 PDF 阅读器…</div>
      <div v-else-if="phase === 'error'" class="pdfv-tip pdfv-err">
        {{ errMsg }}
        <div class="pdfv-err-sub">
          可直接
          <a :href="url" target="_blank" rel="noopener">下载后查看</a>
        </div>
      </div>
      <canvas v-show="phase === 'ready'" ref="canvasEl" class="pdfv-canvas"></canvas>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElDialog } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  /** PDF 地址（相对站点根或绝对 URL） */
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

// pdf.js 固定版本，避免 CDN 漂移；走 jsDelivr，国内可达
const PDFJS_VER = '3.11.174'
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.min.js`
const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VER}/build/pdf.worker.min.js`
// 兜底 CDN（jsDelivr 不可达时切换）
const PDFJS_CDN_ALT = `https://unpkg.com/pdfjs-dist@${PDFJS_VER}/build/pdf.min.js`
const PDFJS_WORKER_ALT = `https://unpkg.com/pdfjs-dist@${PDFJS_VER}/build/pdf.worker.min.js`

const phase = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const errMsg = ref('')
const pageNum = ref(1)
const numPages = ref(0)
const wrapEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

// 缓存已打开的文档，翻页/缩放无需重新下载
let pdfDoc: any = null
let pdfDocUrl = ''
let renderTask: any = null

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

/** 运行时加载 pdf.js（不进打包，绕开 pdfjs-dist 与当前构建环境的兼容问题） */
async function ensurePdfjs(): Promise<any> {
  const g = window as any
  if (g.pdfjsLib) return g.pdfjsLib
  try {
    await loadScript(PDFJS_CDN)
  } catch {
    await loadScript(PDFJS_CDN_ALT)
  }
  const lib = g.pdfjsLib
  if (!lib) throw new Error('PDF 阅读器加载失败')
  lib.GlobalWorkerOptions.workerSrc = g.pdfjsLib?.GlobalWorkerOptions?.workerSrc || PDFJS_WORKER
  // worker 也做一次兜底：主 CDN 失败时用备用
  try {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
  } catch {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_ALT
  }
  return lib
}

async function openDoc() {
  if (!props.url) return
  phase.value = 'loading'
  errMsg.value = ''
  try {
    const lib = await ensurePdfjs()
    if (pdfDocUrl !== props.url) {
      // 取消上一个加载任务，避免快速切换时竞态
      if (pdfDoc?.destroy) {
        try {
          await pdfDoc.destroy()
        } catch {
          /* noop */
        }
      }
      pdfDoc = await lib.getDocument({ url: props.url }).promise
      pdfDocUrl = props.url
      numPages.value = pdfDoc.numPages || 0
      pageNum.value = 1
    }
    await renderPage()
    phase.value = 'ready'
  } catch (e: any) {
    errMsg.value = 'PDF 预览加载失败（可能是网络问题）。'
    phase.value = 'error'
    console.warn('[PdfViewer] 打开失败', e)
  }
}

async function renderPage() {
  if (!pdfDoc || !canvasEl.value || !wrapEl.value) return
  try {
    const page = await pdfDoc.getPage(pageNum.value)
    const canvas = canvasEl.value
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 按容器宽度自适应，移动端不会溢出
    const containerW = wrapEl.value.clientWidth || window.innerWidth
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(containerW / base.width, 2)

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
  } catch (e: any) {
    // render 被 cancel 属正常中断，不算错误
    if (e?.name !== 'RenderingCancelledException') {
      errMsg.value = '页面渲染失败。'
      phase.value = 'error'
    }
  }
}

function prev() {
  if (pageNum.value > 1) {
    pageNum.value--
    void renderPage()
  }
}
function next() {
  if (pageNum.value < numPages.value) {
    pageNum.value++
    void renderPage()
  }
}

watch(
  () => [props.modelValue, props.url],
  async () => {
    if (props.modelValue && props.url) {
      await nextTick()
      void openDoc()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.pdfv-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-wrap: wrap;
}
.pdfv-bar button {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 12.5px;
  cursor: pointer;
  color: #334155;
  font-weight: 600;
  min-height: 36px;
}
.pdfv-bar button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.pdfv-page {
  font-size: 12.5px;
  color: #64748b;
  font-weight: 600;
  min-width: 62px;
  text-align: center;
}
.pdfv-dl {
  margin-left: auto;
  font-size: 12.5px;
  color: #5b6cff;
  text-decoration: none;
  font-weight: 700;
  border: 1px solid #dbe1ff;
  background: #fff;
  border-radius: 8px;
  padding: 7px 12px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
}
.pdfv-canvas-wrap {
  padding: 12px;
  background: #f1f5f9;
  min-height: 320px;
  max-height: 70vh;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  text-align: center;
}
.pdfv-canvas {
  display: inline-block;
  background: #fff;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.12);
  max-width: 100%;
}
.pdfv-tip {
  padding: 60px 12px;
  font-size: 13px;
  color: #64748b;
}
.pdfv-err {
  color: #b91c1c;
}
.pdfv-err-sub {
  margin-top: 8px;
  font-size: 12.5px;
  color: #64748b;
}
.pdfv-err-sub a {
  color: #5b6cff;
  font-weight: 700;
}
</style>

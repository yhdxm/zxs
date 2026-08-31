<template>
  <div class="wl-page">
    <div class="wl-head">
      <div>
        <h2>自选股</h2>
        <p class="wl-sub">本地保存（localStorage）· 支持 A 股 / 美股 / 黄金代码 · 免费腾讯财经行情</p>
      </div>
      <div class="wl-add">
        <el-input
          v-model="input"
          placeholder="输入代码或名称，如 sh600519 / usIXIC / hf_XAUUSD"
          @keyup.enter="addItem"
          style="width: 280px"
        />
        <el-button type="primary" :loading="loading" @click="addItem">+ 添加自选</el-button>
        <el-switch v-model="autoRefresh" active-text="自动刷新(3秒)" style="margin-left: 8px" />
      </div>
    </div>

    <div v-if="!watchlist.length" class="wl-empty">
      还没有自选。试试添加：sh600519（贵州茅台）、sz300750（宁德时代）、hf_XAUUSD（黄金）。
    </div>

    <div v-else class="wl-grid">
      <div v-for="q in quotes" :key="q.code" class="wl-card" :class="trendClass(q)">
        <div class="wl-card-head">
          <div>
            <div class="wl-name">{{ q.name }}</div>
            <div class="wl-code">{{ q.code.toUpperCase() }}</div>
          </div>
          <button class="wl-x" @click="removeItem(q.code)">×</button>
        </div>
        <div class="wl-price">{{ formatNum(q.price, 2) }}</div>
        <div class="wl-ch" :class="trendClass(q)">
          {{ q.change >= 0 ? '+' : '' }}{{ formatNum(q.change, 2) }}
          {{ q.changePercent >= 0 ? '+' : '' }}{{ formatNum(q.changePercent, 2) }}%
        </div>
        <svg :viewBox="`0 0 200 40`" class="wl-spark" preserveAspectRatio="none">
          <polyline
            v-if="spark(q.code).length"
            :points="sparkPoints(q.code)"
            fill="none"
            :stroke="q.change >= 0 ? '#ef4444' : '#16a34a'"
            stroke-width="1.4"
          />
        </svg>
        <div class="wl-spark-foot">近 30 日</div>
        <button class="wl-kbtn" @click="openKline(q)">查看 K 线</button>
      </div>
    </div>

    <KLineDialog
      :visible="klineVisible"
      :code="klineCode"
      :name="klineName"
      :quote="klineQuote"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useCloudSync } from '../../composables/useCloudSync'
import { fetchQuotes, fetchKline, type Quote } from '../../services/tencentFinance'
import { loadUserBlob, saveUserBlob, type BlobKey } from '../../services/userBlobService'
import KLineDialog from './KLineDialog.vue'

const BLOB_KEY: BlobKey = 'watchlist'
const DEFAULT_LIST = ['sh600519', 'sz300750', 'hf_XAUUSD']
const watchlist = ref<string[]>([])
const quotes = ref<Quote[]>([])
const loading = ref(false)
const input = ref('')
const autoRefresh = ref(true)
const sparks = ref<Record<string, number[]>>({})
let timer: number | undefined

async function loadList(): Promise<void> {
  watchlist.value = await loadUserBlob(BLOB_KEY, DEFAULT_LIST)
}
async function saveList(): Promise<void> {
  await saveUserBlob(BLOB_KEY, watchlist.value)
}

function formatNum(v: number, d = 2): string {
  return (v || 0).toFixed(d)
}
function trendClass(q: Quote): string {
  if (q.change > 0) return 'up'
  if (q.change < 0) return 'down'
  return 'flat'
}

function spark(code: string): number[] {
  return sparks.value[code] || []
}
function sparkPoints(code: string): string {
  const arr = spark(code)
  if (arr.length < 2) return ''
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const span = max - min || 1
  const stepX = 200 / (arr.length - 1)
  return arr.map((v, i) => `${i * stepX},${38 - ((v - min) / span) * 36}`).join(' ')
}

async function loadSparks(codes: string[]): Promise<void> {
  const entries = await Promise.all(
    codes.map(async (c) => {
      const pts = await fetchKline(c, 'day', 30)
      return [c, pts.map((p) => p.close)] as const
    })
  )
  const map: Record<string, number[]> = {}
  entries.forEach(([c, arr]) => (map[c] = arr))
  sparks.value = map
}

async function refresh(): Promise<void> {
  if (!watchlist.value.length) {
    quotes.value = []
    return
  }
  loading.value = true
  try {
    quotes.value = await fetchQuotes(watchlist.value, 'custom')
    await loadSparks(watchlist.value)
  } catch (e) {
    console.error('[自选] 加载失败', e)
  } finally {
    loading.value = false
  }
}

function addItem(): void {
  const code = input.value.trim()
  if (!code) return
  if (watchlist.value.includes(code)) {
    input.value = ''
    return
  }
  watchlist.value.push(code)
  input.value = ''
  void refresh()
}
function removeItem(code: string): void {
  watchlist.value = watchlist.value.filter((c) => c !== code)
  void refresh()
}

// 数据变更自动同步（云端 + 本地镜像）
watch(
  watchlist,
  () => {
    void saveList()
  },
  { deep: true }
)

// ===== K 线 =====
const klineVisible = ref(false)
const klineCode = ref('')
const klineName = ref('')
const klineQuote = ref<Quote | null>(null)
function openKline(q: Quote): void {
  klineVisible.value = true
  klineCode.value = q.code
  klineName.value = q.name
  klineQuote.value = q
}

function startAuto(): void {
  stopAuto()
  timer = window.setInterval(() => void refresh(), 3000)
}
function stopAuto(): void {
  if (timer) window.clearInterval(timer)
}

watch(autoRefresh, (v) => (v ? startAuto() : stopAuto()))

useCloudSync({
  tables: ['user_json_blobs'],
  reload: loadList,
  immediate: false
})

onMounted(async () => {
  await loadList()
  void refresh()
  if (autoRefresh.value) startAuto()
})
onUnmounted(() => stopAuto())
</script>

<style scoped>
.wl-page {
  padding: 24px;
  max-width: 1180px;
  margin: 0 auto;
  color: var(--text);
}
.wl-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.wl-head h2 {
  margin: 0 0 4px;
  font-size: 22px;
  color: var(--text-strong);
}
.wl-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.wl-add {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.wl-empty {
  padding: 40px;
  text-align: center;
  color: var(--text-faint);
  font-size: 14px;
  border: 1px dashed var(--border);
  border-radius: 12px;
}
.wl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.wl-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 3px solid var(--border-strong);
  border-radius: 14px;
  padding: 14px 16px;
  position: relative;
}
.wl-card.up {
  border-top-color: #ef4444;
}
.wl-card.down {
  border-top-color: #16a34a;
}
.wl-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.wl-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}
.wl-code {
  font-size: 11px;
  color: var(--text-faint);
}
.wl-x {
  border: none;
  background: transparent;
  color: var(--text-faint);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}
.wl-price {
  font-size: 24px;
  font-weight: 800;
  margin: 6px 0 2px;
  font-variant-numeric: tabular-nums;
}
.wl-ch {
  font-size: 13px;
  font-weight: 600;
}
.wl-card.up .wl-price,
.wl-card.up .wl-ch {
  color: #ef4444;
}
.wl-card.down .wl-price,
.wl-card.down .wl-ch {
  color: #16a34a;
}
.wl-spark {
  width: 100%;
  height: 40px;
  display: block;
  margin-top: 8px;
}
.wl-spark-foot {
  font-size: 11px;
  color: var(--text-faint);
  text-align: right;
}
.wl-kbtn {
  margin-top: 8px;
  width: 100%;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  background: var(--surface-soft);
  color: var(--text-muted);
  cursor: pointer;
}
.wl-kbtn:hover {
  border-color: var(--brand, #378ADD);
  color: var(--brand, #378ADD);
}
</style>

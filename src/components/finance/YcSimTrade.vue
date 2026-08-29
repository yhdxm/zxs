<template>
  <div class="st-page">
    <div class="st-head">
      <div>
        <h2>模拟炒股</h2>
        <p class="st-sub">虚拟资金 100,000 · 零风险练手 · 市价成交（基于免费实时行情）· 数据本地保存</p>
      </div>
      <button class="st-reset" @click="reset">重置账户</button>
    </div>

    <!-- 资产概览 -->
    <div class="st-kpis">
      <div class="st-kpi">
        <div class="st-k-t">总资产</div>
        <div class="st-k-v">{{ formatNum(totalAsset) }}</div>
        <div class="st-k-s" :class="totalProfit >= 0 ? 'up' : 'down'">
          {{ totalProfit >= 0 ? '+' : '' }}{{ formatNum(totalProfit) }}（{{ totalProfitPct >= 0 ? '+' : '' }}{{ formatNum(totalProfitPct) }}%）
        </div>
      </div>
      <div class="st-kpi"><div class="st-k-t">可用资金</div><div class="st-k-v">{{ formatNum(state.cash) }}</div></div>
      <div class="st-kpi"><div class="st-k-t">持仓市值</div><div class="st-k-v">{{ formatNum(holdValue) }}</div></div>
      <div class="st-kpi">
        <div class="st-k-t">当日盈亏</div>
        <div class="st-k-v" :class="dayProfit >= 0 ? 'up' : 'down'">{{ dayProfit >= 0 ? '+' : '' }}{{ formatNum(dayProfit) }}</div>
        <div class="st-k-s" :class="dayProfit >= 0 ? 'up' : 'down'">
          {{ dayProfitPct >= 0 ? '+' : '' }}{{ formatNum(dayProfitPct) }}%
        </div>
      </div>
    </div>

    <div class="st-main">
      <!-- 左：交易面板 + 自选 -->
      <div class="st-col">
        <div class="st-card">
          <div class="st-trade-title">
            交易
            <div class="st-side">
              <button :class="{ on: side === 'buy' }" @click="side = 'buy'">买入</button>
              <button :class="{ on: side === 'sell' }" @click="side = 'sell'">卖出</button>
            </div>
          </div>

          <div class="st-trade-row">
            <input v-model="code" placeholder="代码/名称，如 sh600519" class="st-in" list="st-pick" />
            <datalist id="st-pick">
              <option v-for="s in picks" :key="s.code" :value="s.code">{{ s.name }}</option>
            </datalist>
            <input v-model="qty" type="number" placeholder="数量" class="st-in st-qty" />
          </div>

          <div class="st-quick">
            <span class="st-quick-label">快捷数量</span>
            <button v-for="p in [0.25, 0.5, 1]" :key="p" class="st-qbtn" @click="setQty(p)">
              {{ p === 1 ? '全仓' : p * 100 + '%' }}
            </button>
            <span v-if="livePrice" class="st-live">现价 {{ formatNum(livePrice) }}</span>
          </div>

          <div class="st-actions">
            <button class="st-buy" :disabled="side === 'sell'" @click="buy">买入</button>
            <button class="st-sell" :disabled="side === 'buy'" @click="sell">卖出</button>
          </div>
          <div class="st-msg" :class="{ err: isErr }" v-if="msg">{{ msg }}</div>
          <div class="st-hint">市价成交 · 免费实时行情，非交易所 Level-2；休市时段按最近收盘价撮合</div>
        </div>

        <div class="st-card">
          <div class="st-card-title">自选标的（点击填入）</div>
          <div class="st-picks">
            <button v-for="s in picks" :key="s.code" class="st-pick" @click="code = s.code">{{ s.name }}</button>
          </div>
        </div>
      </div>

      <!-- 右：持仓分布 + 持仓表 -->
      <div class="st-col">
        <div class="st-card">
          <div class="st-card-title">持仓分布</div>
          <EChart v-if="pieOption" :option="pieOption" height="220px" />
          <div v-else class="st-empty">暂无持仓</div>
        </div>
      </div>
    </div>

    <!-- 当前持仓 -->
    <div class="st-card">
      <div class="st-card-title">当前持仓（点击名称看 K 线）</div>
      <div class="st-table-wrap">
        <table class="st-table">
          <thead>
            <tr>
              <th style="text-align: left">名称</th>
              <th>持仓</th>
              <th>成本价</th>
              <th>现价</th>
              <th>市值</th>
              <th>盈亏</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in positionRows" :key="p.code">
              <td style="text-align: left">
                <span class="st-name" @click="openKline(p)">{{ p.name }}</span>
                <span class="st-c">{{ p.code }}</span>
              </td>
              <td>{{ p.qty }}</td>
              <td>{{ formatNum(p.cost) }}</td>
              <td :class="p.price >= p.cost ? 'up' : 'down'">{{ formatNum(p.price) }}</td>
              <td>{{ formatNum(p.qty * p.price) }}</td>
              <td :class="p.profit >= 0 ? 'up' : 'down'">
                {{ p.profit >= 0 ? '+' : '' }}{{ formatNum(p.profit) }}
                <small>({{ p.profitPct >= 0 ? '+' : '' }}{{ formatNum(p.profitPct) }}%)</small>
              </td>
              <td>
                <button class="st-mini" @click="sellPos(p)">卖</button>
              </td>
            </tr>
            <tr v-if="!positionRows.length">
              <td colspan="7" class="st-empty">暂无持仓，先从左侧自选标的买入试试</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 交易记录 -->
    <div class="st-card">
      <div class="st-card-title">交易记录</div>
      <div class="st-trades">
        <div v-for="(t, i) in state.trades.slice().reverse()" :key="i" class="st-trade-item">
          <span :class="t.side === 'buy' ? 'up' : 'down'">{{ t.side === 'buy' ? '买' : '卖' }}</span>
          {{ t.name }} ×{{ t.qty }} @{{ formatNum(t.price) }}
          <span class="st-tt">{{ t.time }}</span>
        </div>
        <div v-if="!state.trades.length" class="st-empty">暂无交易</div>
      </div>
    </div>

    <KLineDialog v-model:visible="klineVisible" :code="klineCode" :quote="klineQuote" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import EChart from '../EChart.vue'
import KLineDialog from './KLineDialog.vue'
import {
  fetchQuotes,
  marketStatusOf,
  supportsKline,
  type Quote
} from '../../services/tencentFinance'

interface Position {
  code: string
  name: string
  qty: number
  cost: number
}
interface Trade {
  code: string
  name: string
  qty: number
  price: number
  side: 'buy' | 'sell'
  time: string
}
interface SimState {
  cash: number
  positions: Position[]
  trades: Trade[]
}

const STORAGE_KEY = 'zxs_simtrade'
const INIT_CASH = 100000

/** 自选标的（代码 + 名称，便于一键填入交易面板） */
const PICKS: { code: string; name: string }[] = [
  { code: 'sh600519', name: '贵州茅台' },
  { code: 'sz300750', name: '宁德时代' },
  { code: 'sz002594', name: '比亚迪' },
  { code: 'sh601318', name: '中国平安' },
  { code: 'sh600036', name: '招商银行' },
  { code: 'sh600276', name: '恒瑞医药' },
  { code: 'sh000001', name: '上证指数' },
  { code: 'sz399006', name: '创业板指' }
]

const state = reactive<SimState>({ cash: INIT_CASH, positions: [], trades: [] })
const prices = ref<Record<string, Quote>>({})
const code = ref('')
const qty = ref<number | null>(null)
const side = ref<'buy' | 'sell'>('buy')
const msg = ref('')
const isErr = ref(false)
const dayBase = ref<Record<string, number>>({})

const picks = PICKS

const livePrice = computed(() => {
  const c = code.value.trim()
  return c && prices.value[c] ? prices.value[c].price : 0
})

const holdValue = computed(() =>
  state.positions.reduce((s, p) => s + p.qty * (prices.value[p.code]?.price || p.cost), 0)
)
const totalCost = computed(() => state.positions.reduce((s, p) => s + p.qty * p.cost, 0))
const totalAsset = computed(() => state.cash + holdValue.value)
const totalProfit = computed(() => holdValue.value - totalCost.value)
const totalProfitPct = computed(() => (totalCost.value > 0 ? (totalProfit.value / totalCost.value) * 100 : 0))
const dayProfit = computed(() => {
  let p = 0
  state.positions.forEach((pos) => {
    const base = dayBase.value[pos.code] ?? pos.cost
    p += pos.qty * ((prices.value[pos.code]?.price || base) - base)
  })
  return p
})
const dayProfitPct = computed(() => {
  const base = state.positions.reduce((s, p) => s + p.qty * (dayBase.value[p.code] ?? p.cost), 0)
  return base > 0 ? (dayProfit.value / base) * 100 : 0
})

const positionRows = computed(() =>
  state.positions.map((p) => {
    const price = prices.value[p.code]?.price || p.cost
    const market = p.qty * price
    const profit = market - p.qty * p.cost
    const profitPct = p.cost > 0 ? (profit / (p.qty * p.cost)) * 100 : 0
    return { code: p.code, name: p.name, qty: p.qty, cost: p.cost, price, profit, profitPct }
  })
)

const pieOption = computed<EChartsOption | null>(() => {
  if (!positionRows.value.length) return null
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: 'var(--text-muted)', fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: 'var(--surface)', borderWidth: 2 },
        label: { show: false },
        data: positionRows.value.map((p) => ({ name: p.name, value: Number((p.qty * p.price).toFixed(2)) }))
      }
    ]
  }
})

function formatNum(v: number): string {
  return (v || 0).toFixed(2)
}
function nowStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function setMsg(text: string, err = false): void {
  msg.value = text
  isErr.value = err
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}
function load(): void {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) {
      const parsed = JSON.parse(s) as SimState
      state.cash = parsed.cash
      state.positions = parsed.positions
      state.trades = parsed.trades
    }
  } catch {
    /* ignore */
  }
}

async function refreshPrices(): Promise<void> {
  const codes = state.positions.map((p) => p.code)
  if (!codes.length) return
  try {
    const qs = await fetchQuotes(codes, 'custom')
    const map: Record<string, Quote> = {}
    qs.forEach((q) => (map[q.code] = q))
    prices.value = map
  } catch {
    /* ignore */
  }
}

function maxQty(): number {
  const c = code.value.trim()
  const price = prices.value[c]?.price || 0
  if (side.value === 'buy') {
    if (!price) return 0
    return Math.floor(state.cash / price)
  }
  const pos = state.positions.find((p) => p.code === c)
  return pos ? pos.qty : 0
}
function setQty(ratio: number): void {
  const m = maxQty()
  if (!m) {
    setMsg('请先填入有效代码（买入需有行情、卖出需有持仓）', true)
    return
  }
  qty.value = Math.max(1, Math.floor(m * ratio))
}

async function ensureQuote(c: string): Promise<Quote | null> {
  const local = prices.value[c]
  if (local) return local
  try {
    const qs = await fetchQuotes([c], 'custom')
    if (qs[0]) {
      prices.value = { ...prices.value, [c]: qs[0] }
      return qs[0]
    }
  } catch {
    /* ignore */
  }
  return null
}

async function buy(): Promise<void> {
  setMsg('')
  const c = code.value.trim()
  const q = Number(qty.value)
  if (!c || !(q > 0)) {
    setMsg('请填写代码与数量', true)
    return
  }
  const quote = await ensureQuote(c)
  if (!quote) {
    setMsg('未获取到该标的行情，请检查代码', true)
    return
  }
  const amount = quote.price * q
  if (amount > state.cash) {
    setMsg('可用资金不足', true)
    return
  }
  state.cash -= amount
  const pos = state.positions.find((p) => p.code === c)
  if (pos) {
    const newQty = pos.qty + q
    pos.cost = (pos.cost * pos.qty + amount) / newQty
    pos.qty = newQty
    pos.name = quote.name
  } else {
    state.positions.push({ code: c, name: quote.name, qty: q, cost: quote.price })
    dayBase.value[c] = quote.price
  }
  state.trades.push({ code: c, name: quote.name, qty: q, price: quote.price, side: 'buy', time: nowStr() })
  save()
  await refreshPrices()
  setMsg(`已买入 ${quote.name} ×${q} @${formatNum(quote.price)}`)
}

async function sell(): Promise<void> {
  setMsg('')
  const c = code.value.trim()
  const q = Number(qty.value)
  if (!c || !(q > 0)) {
    setMsg('请填写代码与数量', true)
    return
  }
  const pos = state.positions.find((p) => p.code === c)
  if (!pos || pos.qty < q) {
    setMsg('持仓不足', true)
    return
  }
  const quote = await ensureQuote(c)
  if (!quote) {
    setMsg('未获取到该标的行情', true)
    return
  }
  const amount = quote.price * q
  state.cash += amount
  pos.qty -= q
  if (pos.qty === 0) state.positions = state.positions.filter((p) => p.code !== c)
  state.trades.push({ code: c, name: quote.name, qty: q, price: quote.price, side: 'sell', time: nowStr() })
  save()
  await refreshPrices()
  setMsg(`已卖出 ${quote.name} ×${q} @${formatNum(quote.price)}`)
}

async function sellPos(p: Position): Promise<void> {
  code.value = p.code
  qty.value = p.qty
  side.value = 'sell'
  await sell()
}

function reset(): void {
  state.cash = INIT_CASH
  state.positions = []
  state.trades = []
  prices.value = {}
  dayBase.value = {}
  save()
  setMsg('账户已重置')
}

// ===== K 线入口 =====
const klineVisible = ref(false)
const klineCode = ref('')
const klineQuote = ref<Quote | null>(null)
function openKline(p: Position): void {
  if (!supportsKline(p.code)) {
    setMsg(`${p.name} 当前免费源暂不支持 K 线`, true)
    return
  }
  klineCode.value = p.code
  klineQuote.value = prices.value[p.code] ?? null
  klineVisible.value = true
}

// ===== 实时价格自动刷新（交易时段 3 秒，休市降频）=====
let timer: number | undefined
function startTimer(): void {
  stopTimer()
  const tick = (): void => {
    void refreshPrices()
    // 仅当仍有持仓时继续；无持仓不浪费免费额度
    if (!state.positions.length) return stopTimer()
    const anyOpen = state.positions.some((p) => marketStatusOf(p.code).isRealtime)
    timer = window.setTimeout(tick, anyOpen ? 3000 : 60000)
  }
  timer = window.setTimeout(tick, 1000)
}
function stopTimer(): void {
  if (timer) {
    window.clearTimeout(timer)
    timer = undefined
  }
}

onMounted(async () => {
  load()
  await refreshPrices()
  // 记录开盘基准（用于当日盈亏）：以当前价计，本会话内稳定
  const base: Record<string, number> = {}
  state.positions.forEach((p) => (base[p.code] = prices.value[p.code]?.price || p.cost))
  dayBase.value = base
  startTimer()
})
onBeforeUnmount(stopTimer)
</script>

<style scoped>
.st-page {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
  color: var(--text);
}
.st-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}
.st-head h2 {
  margin: 0 0 4px;
  font-size: 22px;
  color: var(--text-strong);
}
.st-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.st-reset {
  flex-shrink: 0;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
  background: var(--surface-soft);
  color: var(--text-muted);
  cursor: pointer;
}
.st-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.st-kpi {
  background: var(--surface-soft);
  border-radius: 10px;
  padding: 12px 14px;
  text-align: center;
}
.st-k-t {
  font-size: 12px;
  color: var(--text-faint);
}
.st-k-v {
  font-size: 18px;
  font-weight: 700;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.st-k-s {
  font-size: 11px;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.st-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.st-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.st-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
}
.st-card-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}
.st-trade-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.st-side {
  display: flex;
  gap: 6px;
}
.st-side button {
  border: 1px solid var(--border);
  background: var(--surface-soft);
  border-radius: 8px;
  padding: 4px 14px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-muted);
}
.st-side button.on {
  color: #fff;
  border-color: transparent;
}
.st-side button.on:first-child {
  background: #ef4444;
}
.st-side button.on:last-child {
  background: #16a34a;
}
.st-trade-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.st-in {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  flex: 1;
  min-width: 0;
}
.st-qty {
  width: 90px;
  flex: none;
}
.st-quick {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.st-quick-label {
  font-size: 12px;
  color: var(--text-faint);
}
.st-qbtn {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  background: var(--surface-soft);
  cursor: pointer;
  color: var(--text-muted);
}
.st-live {
  font-size: 12px;
  color: var(--brand, #378add);
  margin-left: auto;
}
.st-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.st-buy,
.st-sell {
  flex: 1;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  color: #fff;
}
.st-buy {
  background: #ef4444;
}
.st-sell {
  background: #16a34a;
}
.st-buy:disabled,
.st-sell:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.st-msg {
  margin-top: 8px;
  font-size: 12px;
  color: #0f6e56;
}
.st-msg.err {
  color: #dc2626;
}
.st-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.5;
}
.st-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.st-pick {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 5px 12px;
  font-size: 12px;
  background: var(--surface-soft);
  cursor: pointer;
  color: var(--text-muted);
}
.st-pick:hover {
  border-color: var(--brand, #378add);
  color: var(--brand, #378add);
}
.st-table-wrap {
  overflow-x: auto;
}
.st-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 560px;
}
.st-table th {
  text-align: right;
  color: var(--text-faint);
  font-weight: 400;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
.st-table td {
  text-align: right;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}
.st-name {
  cursor: pointer;
  color: var(--text-strong);
  font-weight: 600;
}
.st-name:hover {
  color: var(--brand, #378add);
  text-decoration: underline;
}
.st-c {
  font-size: 11px;
  color: var(--text-faint);
  margin-left: 4px;
}
.st-mini {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 12px;
  font-size: 12px;
  background: var(--surface-soft);
  cursor: pointer;
  color: var(--text-muted);
}
.st-trades {
  font-size: 13px;
  line-height: 2;
}
.st-trade-item {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.st-tt {
  color: var(--text-faint);
  font-size: 11px;
}
.st-empty {
  color: var(--text-faint);
  font-size: 13px;
  text-align: center;
  padding: 18px;
}
.up {
  color: #ef4444;
}
.down {
  color: #16a34a;
}
@media (max-width: 768px) {
  .st-page {
    padding: 16px;
  }
  .st-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
  .st-main {
    grid-template-columns: 1fr;
  }
}
</style>

<template>
  <div class="st-page">
    <div class="st-head">
      <h2>模拟炒股</h2>
      <p class="st-sub">虚拟资金 100,000 · 零风险练手 · 数据本地保存</p>
      <button class="st-reset" @click="reset">重置账户</button>
    </div>

    <div class="st-kpis">
      <div class="st-kpi"><div class="st-k-t">总资产</div><div class="st-k-v">{{ formatNum(totalAsset) }}</div></div>
      <div class="st-kpi"><div class="st-k-t">可用资金</div><div class="st-k-v">{{ formatNum(state.cash) }}</div></div>
      <div class="st-kpi"><div class="st-k-t">持仓市值</div><div class="st-k-v">{{ formatNum(holdValue) }}</div></div>
      <div class="st-kpi"><div class="st-k-t">当日盈亏</div><div class="st-k-v" :class="dayProfit >= 0 ? 'up' : 'down'">{{ dayProfit >= 0 ? '+' : '' }}{{ formatNum(dayProfit) }}</div></div>
    </div>

    <div class="st-trade">
      <div class="st-trade-title">交易</div>
      <div class="st-trade-row">
        <input v-model="code" placeholder="代码/名称，如 sh600519" class="st-in" />
        <input v-model="qty" type="number" placeholder="数量" class="st-in st-qty" />
        <button class="st-buy" @click="buy">买入</button>
        <button class="st-sell" @click="sell">卖出</button>
        <span class="st-hint">市价成交 · 基于实时行情</span>
      </div>
      <div class="st-msg" v-if="msg">{{ msg }}</div>
    </div>

    <div class="st-card">
      <div class="st-card-title">当前持仓</div>
      <table class="st-table">
        <thead>
          <tr>
            <th style="text-align:left;">名称</th>
            <th>持仓</th>
            <th>成本价</th>
            <th>现价</th>
            <th>市值</th>
            <th>盈亏</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in positionRows" :key="p.code">
            <td style="text-align:left;">{{ p.name }} <span class="st-c">{{ p.code }}</span></td>
            <td>{{ p.qty }}</td>
            <td>{{ formatNum(p.cost) }}</td>
            <td :class="p.price >= p.cost ? 'up' : 'down'">{{ formatNum(p.price) }}</td>
            <td>{{ formatNum(p.qty * p.price) }}</td>
            <td :class="p.profit >= 0 ? 'up' : 'down'">
              {{ p.profit >= 0 ? '+' : '' }}{{ formatNum(p.profit) }}
              ({{ p.profitPct >= 0 ? '+' : '' }}{{ formatNum(p.profitPct) }}%)
            </td>
          </tr>
          <tr v-if="!positionRows.length">
            <td colspan="6" style="text-align:center;color:var(--text-faint);padding:18px;">暂无持仓，先买入试试</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="st-card">
      <div class="st-card-title">交易记录</div>
      <div class="st-trades">
        <div v-for="(t, i) in state.trades.slice().reverse()" :key="i" class="st-trade-item">
          <span :class="t.side === 'buy' ? 'up' : 'down'">{{ t.side === 'buy' ? '买' : '卖' }}</span>
          {{ t.name }} ×{{ t.qty }} @{{ formatNum(t.price) }}
          <span class="st-tt">{{ t.time }}</span>
        </div>
        <div v-if="!state.trades.length" style="color:var(--text-faint);font-size:13px;">暂无交易</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { fetchQuotes, type Quote } from '../../services/tencentFinance'

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

const state = reactive<SimState>({ cash: INIT_CASH, positions: [], trades: [] })
const prices = ref<Record<string, Quote>>({})
const code = ref('')
const qty = ref<number | null>(null)
const msg = ref('')
const dayBase = ref<Record<string, number>>({})

const holdValue = computed(() => state.positions.reduce((s, p) => s + p.qty * (prices.value[p.code]?.price || p.cost), 0))
const totalAsset = computed(() => state.cash + holdValue.value)
const dayProfit = computed(() => {
  let p = 0
  state.positions.forEach((pos) => {
    const base = dayBase.value[pos.code] ?? pos.cost
    p += pos.qty * ((prices.value[pos.code]?.price || base) - base)
  })
  return p
})

const positionRows = computed(() =>
  state.positions.map((p) => {
    const price = prices.value[p.code]?.price || p.cost
    const market = p.qty * price
    const profit = market - p.qty * p.cost
    const profitPct = p.cost > 0 ? (profit / (p.qty * p.cost)) * 100 : 0
    return {
      code: p.code,
      name: p.name,
      qty: p.qty,
      cost: p.cost,
      price,
      profit,
      profitPct
    }
  })
)

function formatNum(v: number): string {
  return (v || 0).toFixed(2)
}
function nowStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
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

async function buy(): Promise<void> {
  msg.value = ''
  const c = code.value.trim()
  const q = Number(qty.value)
  if (!c || !(q > 0)) {
    msg.value = '请填写代码与数量'
    return
  }
  try {
    const qs = await fetchQuotes([c], 'custom')
    const quote = qs[0]
    if (!quote) {
      msg.value = '未获取到该标的行情，请检查代码'
      return
    }
    const amount = quote.price * q
    if (amount > state.cash) {
      msg.value = '可用资金不足'
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
    }
    state.trades.push({ code: c, name: quote.name, qty: q, price: quote.price, side: 'buy', time: nowStr() })
    save()
    await refreshPrices()
    msg.value = `已买入 ${quote.name} ×${q} @${formatNum(quote.price)}`
  } catch (e) {
    msg.value = '买入失败：' + (e instanceof Error ? e.message : String(e))
  }
}

async function sell(): Promise<void> {
  msg.value = ''
  const c = code.value.trim()
  const q = Number(qty.value)
  if (!c || !(q > 0)) {
    msg.value = '请填写代码与数量'
    return
  }
  const pos = state.positions.find((p) => p.code === c)
  if (!pos || pos.qty < q) {
    msg.value = '持仓不足'
    return
  }
  try {
    const qs = await fetchQuotes([c], 'custom')
    const quote = qs[0]
    if (!quote) {
      msg.value = '未获取到该标的行情'
      return
    }
    const amount = quote.price * q
    state.cash += amount
    pos.qty -= q
    if (pos.qty === 0) state.positions = state.positions.filter((p) => p.code !== c)
    state.trades.push({ code: c, name: quote.name, qty: q, price: quote.price, side: 'sell', time: nowStr() })
    save()
    await refreshPrices()
    msg.value = `已卖出 ${quote.name} ×${q} @${formatNum(quote.price)}`
  } catch (e) {
    msg.value = '卖出失败：' + (e instanceof Error ? e.message : String(e))
  }
}

function reset(): void {
  state.cash = INIT_CASH
  state.positions = []
  state.trades = []
  prices.value = {}
  dayBase.value = {}
  save()
}

onMounted(async () => {
  load()
  // 记录当日基准成本，用于当日盈亏
  await refreshPrices()
  const base: Record<string, number> = {}
  state.positions.forEach((p) => (base[p.code] = p.cost))
  dayBase.value = base
})
</script>

<style scoped>
.st-page {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
  color: var(--text);
}
.st-head {
  position: relative;
  margin-bottom: 16px;
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
  position: absolute;
  right: 0;
  top: 0;
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
@media (max-width: 640px) {
  .st-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
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
.st-trade {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.st-trade-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}
.st-trade-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.st-in {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}
.st-qty {
  width: 90px;
}
.st-buy,
.st-sell {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}
.st-buy {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
}
.st-sell {
  background: #16a34a;
  color: #fff;
  border-color: #16a34a;
}
.st-hint {
  font-size: 12px;
  color: var(--text-faint);
}
.st-msg {
  margin-top: 8px;
  font-size: 12px;
  color: #0f6e56;
}
.st-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}
.st-card-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}
.st-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
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
.st-c {
  font-size: 11px;
  color: var(--text-faint);
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
.up {
  color: #ef4444;
}
.down {
  color: #16a34a;
}
</style>

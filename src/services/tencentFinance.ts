// 腾讯财经实时行情（免费、无需 Key、纯前端直连）
//
// 数据源：腾讯财经公开行情接口 qt.gtimg.cn，返回形如
//   v_sh000001="1~上证指数~000001~3833.65~...";
// 的 JS 片段。该接口不返回 CORS 头，浏览器 fetch 直连会被拦，
// 故采用 <script> JSONP 注入方式直连（最稳、零依赖、零额度消耗、免费）。
//
// 重要：接口返回的中文（如“贵州茅台”）是 GBK 编码，必须给 script 标签
// 设置 charset="gbk"，否则名称会乱码。
//
// K 线 / 分时来自 web.ifzq.gtimg.cn（免费、通常允许跨域）。

export interface Quote {
  code: string
  name: string
  /** 当前价 */
  price: number
  /** 昨收 */
  prevClose: number
  /** 今开 */
  open: number
  /** 涨跌（点 / 元） */
  change: number
  /** 涨跌幅（%） */
  changePercent: number
  /** 最高 */
  high: number
  /** 最低 */
  low: number
  /** 原始时间字符串 YYYYMMDDHHmmss */
  rawTime: string
  /** 已格式化为 YYYY-MM-DD HH:mm:ss */
  time: string
  /** 五档买盘（买一~买五） */
  bids: { price: number; vol: number }[]
  /** 五档卖盘（卖一~卖五） */
  asks: { price: number; vol: number }[]
  /** 分组：cn=国内指数，global=全球市场，stock=个股/自选 */
  group: 'cn' | 'global' | 'stock' | 'custom'
}

// 默认展示：A 股核心指数
export const INDEX_CODES = [
  'sh000001', // 上证指数
  'sz399001', // 深证成指
  'sz399006', // 创业板指
  'sh000300', // 沪深300
  'sh000016', // 上证50
  'sh000905' // 中证500
]

// 全球市场：美股 / 港股 / 日经 / 黄金 / 白银 / 原油（免费接口，盘中有延迟属正常）
export const GLOBAL_CODES = [
  'usDJI', // 道琼斯
  'usIXIC', // 纳斯达克
  'usINX', // 标普500
  'r_hkHSI', // 恒生指数
  'r_jpN225', // 日经225
  'hf_XAUUSD', // 伦敦金（现货黄金）
  'hf_XAGUSD', // 伦敦银（现货白银）
  'hf_CL' // WTI 原油
]

// 热门个股（演示用，可自行替换）
export const HOT_STOCKS = [
  'sh600519', // 贵州茅台
  'sz300750', // 宁德时代
  'sz002594', // 比亚迪
  'sh601318', // 中国平安
  'sh600036', // 招商银行
  'sh600276' // 恒瑞医药
]

function toNum(v: string | undefined): number {
  const n = parseFloat(v || '')
  return Number.isNaN(n) ? 0 : n
}

function parseTime(raw: string): string {
  const s = (raw || '').trim()
  if (s.length < 14) return ''
  const y = s.slice(0, 4)
  const m = s.slice(4, 6)
  const d = s.slice(6, 8)
  const hh = s.slice(8, 10)
  const mm = s.slice(10, 12)
  const ss = s.slice(12, 14)
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

/** 解析五档买卖盘（腾讯标准字段 9~28） */
function parseBidsAsks(p: string[]): {
  bids: { price: number; vol: number }[]
  asks: { price: number; vol: number }[]
} {
  const g = (i: number) => toNum(p[i])
  const bids = [
    { price: g(9), vol: g(10) },
    { price: g(13), vol: g(14) },
    { price: g(17), vol: g(18) },
    { price: g(21), vol: g(22) },
    { price: g(25), vol: g(26) }
  ]
  const asks = [
    { price: g(11), vol: g(12) },
    { price: g(15), vol: g(16) },
    { price: g(19), vol: g(20) },
    { price: g(23), vol: g(24) },
    { price: g(27), vol: g(28) }
  ]
  return { bids, asks }
}

/** 将单条 v_<code> 字符串解析为结构化行情（字段索引已按 qt.gtimg.cn 实测确认） */
export function parseQuote(code: string, raw: string, group: Quote['group'] = 'custom'): Quote {
  const p = raw.split('~')
  const price = toNum(p[3])
  const prevClose = toNum(p[4])
  const open = toNum(p[5])
  const isForex = code.startsWith('hf_')
  // 外盘（贵金属/原油期货）字段含义略有差异：优先用 [31]/[32]，失败则按现价推算
  let change = toNum(p[31])
  let changePercent = toNum(p[32])
  if (isForex && Math.abs(change) < 1e-9 && prevClose > 0) {
    change = Number((price - prevClose).toFixed(3))
    changePercent = Number(((change / prevClose) * 100).toFixed(2))
  }
  const { bids, asks } = parseBidsAsks(p)
  return {
    code,
    name: (p[1] || code).trim(),
    price,
    prevClose,
    open,
    change,
    changePercent,
    high: toNum(p[33]),
    low: toNum(p[34]),
    rawTime: (p[30] || '').trim(),
    time: parseTime(p[30] || ''),
    bids,
    asks,
    group
  }
}

/** 通过注入 <script> 直连腾讯财经，返回 code -> 原始字符串 的映射 */
function loadQuotes(codes: string[]): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://qt.gtimg.cn/q=${codes.join(',')}`
    script.charset = 'gbk' // 关键：接口中文为 GBK，否则名称乱码
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('腾讯财经行情请求超时'))
    }, 9000)
    const cleanup = () => {
      window.clearTimeout(timer)
      script.remove()
    }
    script.onload = () => {
      const res: Record<string, string> = {}
      for (const c of codes) {
        const g = (window as unknown as Record<string, string>)['v_' + c]
        if (typeof g === 'string') res[c] = g
      }
      cleanup()
      resolve(res)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('腾讯财经行情加载失败（网络可能被限制）'))
    }
    document.body.appendChild(script)
  })
}

/** 批量获取行情，按传入顺序返回结构化结果（失败的 code 自动跳过） */
export async function fetchQuotes(codes: string[], group: Quote['group'] = 'custom'): Promise<Quote[]> {
  if (!codes.length) return []
  const rawMap = await loadQuotes(codes)
  return codes
    .filter((c) => rawMap[c])
    .map((c) => parseQuote(c, rawMap[c]!, group))
}

export function fetchIndices(): Promise<Quote[]> {
  return fetchQuotes(INDEX_CODES, 'cn')
}

export function fetchGlobal(): Promise<Quote[]> {
  return fetchQuotes(GLOBAL_CODES, 'global')
}

export function fetchHotStocks(): Promise<Quote[]> {
  return fetchQuotes(HOT_STOCKS, 'stock')
}

// ===================== K 线 / 分时 =====================

export type KLinePeriod = 'minute' | 'day' | 'week' | 'month' | 'quarter'

export interface KLinePoint {
  /** 日期或时间，如 2026-07-31 或 0930 */
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

const PERIOD_PARAM: Record<Exclude<KLinePeriod, 'minute'>, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'month' // 季K 暂用月K近似（免费接口无季K）
}

/**
 * 获取 K 线 / 分时数据（免费接口 web.ifzq.gtimg.cn）。
 * 该接口通常允许跨域；若被网络限制则返回空数组，由组件降级提示。
 */
export async function fetchKline(code: string, period: KLinePeriod, limit = 120): Promise<KLinePoint[]> {
  try {
    if (period === 'minute') {
      const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`
      const r = await fetch(url, { signal: AbortSignal.timeout(9000) })
      const json = await r.json()
      const node = json?.data?.[code]?.data
      if (!node || !Array.isArray(node.minute)) return []
      return node.minute
        .map((row: string) => {
          const parts = row.split(' ')
          const price = toNum(parts[1])
          return {
            date: parts[0] || '',
            open: price,
            close: price,
            high: price,
            low: price,
            volume: toNum(parts[2])
          }
        })
        .filter((p: KLinePoint) => p.close > 0)
        .slice(-limit)
    }

    const param = `${code},${PERIOD_PARAM[period]},,,${limit},qfq`
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${param}`
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) })
    const json = await r.json()
    const node = json?.data?.[code]
    const key = period === 'day' ? 'qfqday' : period === 'week' ? 'qfqweek' : 'qfqmonth'
    const arr = node?.[key] || node?.qfqday || []
    if (!Array.isArray(arr)) return []
    return arr.slice(-limit).map((row: Record<string, string>) => ({
      date: (row.date || '').slice(0, 10),
      open: toNum(row.open),
      close: toNum(row.close),
      high: toNum(row.high),
      low: toNum(row.low),
      volume: toNum(row.volume)
    }))
  } catch (e) {
    console.error('[影仓智核] K线加载失败', e)
    return []
  }
}

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

// 全球股指：美股 / 港股（代码均已实测可用，免费接口盘中有延迟属正常）
// 注意：腾讯行情不提供日经 225（r_jpN225 为无效代码，会导致整段数据缺失），故不纳入。
export const GLOBAL_CODES = [
  'usDJI', // 道琼斯
  'usIXIC', // 纳斯达克
  'usINX', // 标普500
  'r_hkHSI', // 恒生指数
  'hkHSTECH', // 恒生科技指数
  'r_hkHSCEI' // 国企指数
]

/**
 * 大宗商品 / 贵金属 / 能源（腾讯外盘 hf_ 前缀，逗号分隔格式，已逐个实测）。
 * 之前使用的 hf_XAUUSD / hf_XAGUSD 为无效代码，接口不返回任何数据，
 * 导致「黄金 / 白银」整块缺失；同时 hf_ 数据是逗号分隔，用 ~ 解析会得到错误数值。
 */
export const COMMODITY_CODES = [
  'hf_XAU', // 伦敦金（现货黄金）
  'hf_XAG', // 伦敦银（现货白银）
  'hf_GC', // 纽约黄金（COMEX）
  'hf_SI', // 纽约白银（COMEX）
  'hf_CL', // 纽约原油（WTI）
  'hf_OIL', // 布伦特原油
  'hf_NG', // 美国天然气
  'hf_CAD' // 伦铜
]

/** 商品单位说明（展示用，避免用户误解价格口径） */
export const COMMODITY_UNITS: Record<string, string> = {
  hf_XAU: '美元/盎司',
  hf_XAG: '美元/盎司',
  hf_GC: '美元/盎司',
  hf_SI: '美元/盎司',
  hf_CL: '美元/桶',
  hf_OIL: '美元/桶',
  hf_NG: '美元/百万英热',
  hf_CAD: '美元/吨'
}

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
  if (!s) return ''
  // 美股 / 港股返回的已是 "2026-07-31 17:22:18" 或 "2026/07/31 18:31:39"，直接归一化
  if (/[-/:]/.test(s)) return s.replace(/\//g, '-')
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

/**
 * 外盘（hf_ 前缀：贵金属 / 原油 / 有色 / 农产品）解析。
 * 实测返回为「逗号分隔」，与 A 股 / 美股的 ~ 分隔完全不同，例如：
 *   v_hf_XAU="4046.42,-1.39,4046.42,4047.11,4111.65,4021.08,04:55:00,4103.42,4103.93,0,0,0,2026-08-01,伦敦金（现货黄金）"
 * 字段：0 最新价 | 1 涨跌幅% | 2 买价 | 3 卖价 | 4 最高 | 5 最低 | 6 时间
 *       7 昨收 | 8 今开 | 9 持仓 | 10 买量 | 11 卖量 | 12 日期 | 13 名称
 */
function parseForeignQuote(code: string, raw: string, group: Quote['group']): Quote {
  const p = raw.split(',')
  const price = toNum(p[0])
  const changePercent = toNum(p[1])
  const bid = toNum(p[2])
  const ask = toNum(p[3])
  const high = toNum(p[4])
  const low = toNum(p[5])
  const hhmmss = (p[6] || '').trim()
  const prevClose = toNum(p[7])
  const open = toNum(p[8])
  const bidVol = toNum(p[10])
  const askVol = toNum(p[11])
  const dateStr = (p[12] || '').trim()
  const name = (p[13] || code).trim()
  // 涨跌额接口未直接给出，用「最新价 - 昨收」推算（与接口给出的涨跌幅一致）
  const change = prevClose > 0 ? Number((price - prevClose).toFixed(3)) : 0
  const timeText = dateStr && hhmmss ? `${dateStr} ${hhmmss}` : dateStr || hhmmss
  return {
    code,
    name,
    price,
    prevClose,
    open,
    change,
    changePercent,
    high,
    low,
    rawTime: timeText,
    time: timeText,
    bids: [{ price: bid, vol: bidVol }],
    asks: [{ price: ask, vol: askVol }],
    group
  }
}

/** 将单条 v_<code> 字符串解析为结构化行情（字段索引已按 qt.gtimg.cn 实测确认） */
export function parseQuote(code: string, raw: string, group: Quote['group'] = 'custom'): Quote {
  // 外盘商品走独立解析（逗号分隔）
  if (code.startsWith('hf_')) return parseForeignQuote(code, raw, group)

  const p = raw.split('~')
  const price = toNum(p[3])
  const prevClose = toNum(p[4])
  const open = toNum(p[5])
  let change = toNum(p[31])
  let changePercent = toNum(p[32])
  // 个别标的 [31]/[32] 为空，用昨收推算兜底，保证涨跌数据准确
  if (Math.abs(change) < 1e-9 && prevClose > 0 && Math.abs(price - prevClose) > 1e-9) {
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

/** 大宗商品 / 贵金属 / 能源（黄金、白银、原油等） */
export function fetchCommodities(): Promise<Quote[]> {
  return fetchQuotes(COMMODITY_CODES, 'global')
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

/** K 线附带上下文（用于分时图算涨跌幅、判断数据可用性） */
export interface KLineResult {
  points: KLinePoint[]
  /** 昨收价（分时图基准；K 线取首根的前收，可能为空） */
  prevClose: number
  /** 数据源标识，便于排障 */
  source: string
}

const PERIOD_PARAM: Record<Exclude<KLinePeriod, 'minute'>, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'month' // 季K 暂用月K近似（免费接口无季K）
}

/** 标的市场分类（决定走哪个 K 线端点） */
export type MarketKind = 'cn-stock' | 'cn-index' | 'us' | 'hk' | 'foreign'

export function marketOf(code: string): MarketKind {
  if (code.startsWith('hf_')) return 'foreign'
  if (code.startsWith('us')) return 'us'
  if (code.startsWith('hk') || code.startsWith('r_hk')) return 'hk'
  // A 股：指数 6 位以 000/399 开头；个股 sh60/sz00/sz30/sh68 等
  return /^(sh|sz)\d{6}$/.test(code) && /^(sh000|sz399)/.test(code) ? 'cn-index' : 'cn-stock'
}

/**
 * 外盘商品（hf_ 前缀）腾讯免费接口**不提供 K 线**（实测 param error）。
 * 改用东方财富「环球期货 / 外汇贵金属」免费接口拿 K 线（浏览器端 CORS 头为 *，可直连，无需 Key）。
 * 下方映射经逐个实测确认 secid 有效（伦敦金=外汇贵金属板、纽约金/银/COMEX铜=COMEX、WTI/天然气=NYMEX、布伦特=ICE）。
 * 伦铜（LME）东财仅暴露人民币小型合约、无干净主连，退而用 COMEX 铜（全球铜价基准）作免费近似。
 */
export const COMMODITY_KLINE_SECIDS: Record<string, string> = {
  hf_XAU: '122.XAU', // 伦敦金（现货黄金/美元）
  hf_XAG: '122.XAG', // 伦敦银（现货白银/美元）
  hf_GC: '101.GC00Y', // 纽约金（COMEX 黄金连续）
  hf_SI: '101.SI00Y', // 纽约银（COMEX 白银连续）
  hf_CL: '102.CL00Y', // WTI 原油（NYMEX 原油连续）
  hf_OIL: '112.B00Y', // 布伦特原油（ICE 当月连续）
  hf_NG: '102.NG00Y', // 美国天然气（NYMEX 天然气连续）
  hf_CAD: '101.HG00Y' // 伦铜（用 COMEX 铜作免费近似）
}

/** 外盘商品是否已有可用的免费 K 线源（东方财富） */
export function supportsKline(code: string): boolean {
  return marketOf(code) !== 'foreign' || Boolean(COMMODITY_KLINE_SECIDS[code])
}

/** 东方财富 K 线周期 → klt 参数 */
const EM_KLT: Record<KLinePeriod, number> = {
  minute: 1,
  day: 101,
  week: 102,
  month: 103,
  quarter: 104
}

/**
 * 东方财富 K 线（免费、浏览器端 CORS * 可直连）。
 * 返回 klines 为逗号分隔字符串：date,open,close,high,low,volume,amount,振幅,涨跌幅,涨跌额,换手。
 */
export async function fetchEastmoneyKline(
  secid: string,
  period: KLinePeriod,
  limit = 160
): Promise<KLineResult> {
  const empty: KLineResult = { points: [], prevClose: 0, source: 'none' }
  if (!secid) return empty
  try {
    const klt = EM_KLT[period]
    const url =
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}` +
      `&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61` +
      `&klt=${klt}&fqt=0&end=20500101&lmt=${limit}`
    const r = await fetch(url, {
      headers: { Referer: 'https://quote.eastmoney.com/' },
      signal: AbortSignal.timeout(9000)
    })
    const json = await r.json()
    const klines: string[] | undefined = json?.data?.klines
    if (!Array.isArray(klines) || !klines.length) return empty
    const points: KLinePoint[] = klines
      .map((row) => {
        const f = String(row).split(',')
        return {
          date: (f[0] || '').slice(0, 10),
          open: toNum(f[1]),
          close: toNum(f[2]),
          high: toNum(f[3]),
          low: toNum(f[4]),
          volume: toNum(f[5])
        }
      })
      .filter((p) => p.close > 0)
    if (!points.length) return empty
    // 分时无昨收字段，用首根开盘作涨跌幅基准；日/周/月蜡烛无需昨收
    const prevClose = period === 'minute' ? (points[0]?.open ?? 0) : 0
    return { points, prevClose, source: 'eastmoney' }
  } catch (e) {
    console.error('[影仓智核] 东财 K线加载失败', e)
    return empty
  }
}

/**
 * 腾讯 K 线接口返回的响应 key 与请求 code 并非总是一致：
 * - A 股 / 港股：与 code 相同（sh000001 / hkHSI）
 * - 美股：返回 `us.DJI`（点号分隔），请求用 `usDJI`
 * 港股实时行情用 `r_hkHSI`，但 K 线必须用 `hkHSI`，故需要归一化。
 */
function klineCodeOf(code: string): string {
  if (marketOf(code) === 'hk') return code.replace(/^r_/, '')
  return code
}
function responseKeyOf(code: string): string {
  if (marketOf(code) === 'us') return 'us.' + code.replace(/^us/, '')
  return klineCodeOf(code)
}

/** 腾讯 K 线每行是**数组**而非对象：[日期, 开, 收, 高, 低, 量] */
function toPoints(rows: unknown, limit: number): KLinePoint[] {
  if (!Array.isArray(rows)) return []
  return rows
    .slice(-limit)
    .map((row: unknown) => {
      // 兼容数组格式与（极少数情况的）对象格式
      const r = row as unknown as string[] & Record<string, string>
      if (Array.isArray(row)) {
        return {
          date: String(r[0] || '').slice(0, 10),
          open: toNum(r[1]),
          close: toNum(r[2]),
          high: toNum(r[3]),
          low: toNum(r[4]),
          volume: toNum(r[5])
        }
      }
      return {
        date: String(r.date || '').slice(0, 10),
        open: toNum(r.open),
        close: toNum(r.close),
        high: toNum(r.high),
        low: toNum(r.low),
        volume: toNum(r.volume)
      }
    })
    .filter((p: KLinePoint) => p.close > 0)
}

/**
 * 获取 K 线 / 分时数据（免费接口 web.ifzq.gtimg.cn）。
 *
 * 实测端点矩阵：
 * - A 股个股：`fqkline/get?param=<code>,<period>,,,<n>,qfq` → `qfqday|qfqweek|qfqmonth`
 * - 指数 / 美股 / 港股：`kline/kline?param=<code>,<period>,,,<n>` → `day|week|month`
 * - 外盘商品（hf_）：不支持 K 线
 * - 分时：`minute/query?code=<code>` → `data[code].data.data`，每行 "HHMM 价格 累计量 累计额"
 *
 * 注意：K 线每行是**数组** [date,open,close,high,low,volume]，
 * 早期版本按对象字段 row.date 解析会得到全 0，导致 K 线画不出来。
 */
export async function fetchKline(code: string, period: KLinePeriod, limit = 120): Promise<KLinePoint[]> {
  return (await fetchKlineWithMeta(code, period, limit)).points
}

/** 与 fetchKline 相同，但额外返回昨收等上下文，供分时图计算涨跌幅 */
export async function fetchKlineWithMeta(
  code: string,
  period: KLinePeriod,
  limit = 120
): Promise<KLineResult> {
  const empty: KLineResult = { points: [], prevClose: 0, source: 'none' }
  if (!supportsKline(code) && period !== 'minute') return empty

  // 外盘商品：腾讯无 K 线，改走东方财富免费源（浏览器端 CORS 可直连）
  if (marketOf(code) === 'foreign') {
    const secid = COMMODITY_KLINE_SECIDS[code]
    if (secid) return await fetchEastmoneyKline(secid, period, limit)
    return empty
  }

  try {
    if (period === 'minute') {
      const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`
      const r = await fetch(url, { signal: AbortSignal.timeout(9000) })
      const json = await r.json()
      const top = json?.data?.[code]
      const node = top?.data
      if (!node || !Array.isArray(node.data)) return empty
      // 每行格式："0930 3950.24 4488109 8595747495.80"（时间 价格 累计成交量 累计成交额）
      const rows: string[] = node.data
      const parsed = rows
        .map((row) => {
          const parts = String(row).split(' ')
          return {
            date: parts[0] || '',
            price: toNum(parts[1]),
            cumVol: toNum(parts[2])
          }
        })
        .filter((p) => p.price > 0)
      // 接口第 3 列是「累计」成交量，需差分还原为每分钟成交量，否则柱状图会画成单调递增
      let prevCum = 0
      const points = parsed.map((p, i) => {
        const vol = i === 0 ? p.cumVol : Math.max(0, p.cumVol - prevCum)
        prevCum = p.cumVol
        return {
          date: p.date,
          open: p.price,
          close: p.price,
          high: p.price,
          low: p.price,
          volume: vol
        }
      })
      // 昨收在同级的 qt 节点里（qt.<code>[4]），用于分时图涨跌幅基准
      const prevClose = toNum(top?.qt?.[code]?.[4] ?? 0)
      return { points: points.slice(-limit), prevClose, source: 'minute/query' }
    }

    const p = PERIOD_PARAM[period]
    const kCode = klineCodeOf(code)
    const kind = marketOf(code)
    // A 股个股走复权接口（前后复权更贴近真实走势），其余走通用 K 线接口
    const url =
      kind === 'cn-stock'
        ? `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${kCode},${p},,,${limit},qfq`
        : `https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=${kCode},${p},,,${limit}`
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) })
    const json = await r.json()
    const node = json?.data?.[responseKeyOf(code)]
    if (!node) return empty
    const keys = kind === 'cn-stock' ? ['qfq' + p, p] : [p, 'qfq' + p]
    let arr: unknown = null
    for (const k of keys) {
      if (Array.isArray(node[k])) {
        arr = node[k]
        break
      }
    }
    const points = toPoints(arr, limit)
    if (!points.length) return empty
    return { points, prevClose: 0, source: kind === 'cn-stock' ? 'fqkline/get' : 'kline/kline' }
  } catch (e) {
    console.error('[影仓智核] K线加载失败', e)
    return empty
  }
}

// ===================== 市场状态 =====================

export type MarketStatus = 'open' | 'close' | 'premarket' | 'afterhours'

export interface MarketSession {
  status: MarketStatus
  label: string
  /** 当前是否为实时交易时段 */
  isRealtime: boolean
}

/**
 * 根据标的市场与当前北京时间，判断市场状态。
 * 仅用于 UI 提示，不保证交易所官方精确时段；美股/外盘按常见北京时间折算。
 */
export function marketStatusOf(code: string): MarketSession {
  const now = new Date()
  // 强制按北京时间（UTC+8）计算
  const cst = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000)
  const day = cst.getDay()
  const hh = cst.getHours()
  const mm = cst.getMinutes()
  const hm = hh * 60 + mm
  const isWeekday = day >= 1 && day <= 5

  // A 股指数 / 个股
  if (/^(sh|sz)\d{6}$/.test(code)) {
    if (!isWeekday) return { status: 'close', label: '周末休市', isRealtime: false }
    // 09:30-11:30, 13:00-15:00
    if ((hm >= 570 && hm <= 690) || (hm >= 780 && hm <= 900)) {
      return { status: 'open', label: '交易中', isRealtime: true }
    }
    if (hm >= 540 && hm < 570) return { status: 'premarket', label: '盘前竞价', isRealtime: false }
    if (hm > 900 && hm <= 930) return { status: 'afterhours', label: '盘后整理', isRealtime: false }
    return { status: 'close', label: '已休市', isRealtime: false }
  }

  // 港股
  if (/^r_hk/.test(code) || /^hk/.test(code)) {
    if (!isWeekday) return { status: 'close', label: '周末休市', isRealtime: false }
    // 09:30-12:00, 13:00-16:00
    if ((hm >= 570 && hm <= 720) || (hm >= 780 && hm <= 960)) {
      return { status: 'open', label: '交易中', isRealtime: true }
    }
    return { status: 'close', label: '已休市', isRealtime: false }
  }

  // 美股（北京时间 21:30-次日 04:00）
  if (/^us/.test(code)) {
    if (!isWeekday && !(day === 6 && hm < 240) && !(day === 0 && hm >= 1290)) {
      return { status: 'close', label: '周末休市', isRealtime: false }
    }
    if (hm >= 1290 || hm < 240) {
      return { status: 'open', label: '交易中', isRealtime: true }
    }
    if (hm >= 1200 && hm < 1290) return { status: 'premarket', label: '盘前', isRealtime: false }
    if (hm >= 240 && hm < 360) return { status: 'afterhours', label: '盘后', isRealtime: false }
    return { status: 'close', label: '已休市', isRealtime: false }
  }

  // 外盘商品：多数 24h 但有维护窗口，保守标记为「持续报价」
  if (code.startsWith('hf_')) {
    return { status: 'open', label: '持续报价', isRealtime: true }
  }

  return { status: 'close', label: '—', isRealtime: false }
}

// ===================== 数据鲜度 =====================

export interface Freshness {
  /** 距数据时间的秒数；无法解析时为 null */
  seconds: number | null
  /** 展示文案，如「12 秒前」「3 分钟前」 */
  text: string
  /** 等级：fresh=60s 内、normal=5 分钟内、stale=超过 5 分钟或无法解析 */
  level: 'fresh' | 'normal' | 'stale'
}

/**
 * 计算行情数据的「鲜度」，解决用户看不到时效性的问题。
 * 支持 A 股 YYYYMMDDHHmmss 与美股/港股 YYYY-MM-DD HH:mm:ss 两种格式。
 */
export function freshnessOf(time: string, now = Date.now()): Freshness {
  const s = (time || '').trim().replace(/\//g, '-')
  if (!s) return { seconds: null, text: '时间未知', level: 'stale' }
  let ts: number
  if (/^\d{14}$/.test(s)) {
    const d = new Date(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)) - 1,
      Number(s.slice(6, 8)),
      Number(s.slice(8, 10)),
      Number(s.slice(10, 12)),
      Number(s.slice(12, 14))
    )
    ts = d.getTime()
  } else {
    const d = new Date(s.replace(' ', 'T'))
    ts = d.getTime()
  }
  if (Number.isNaN(ts)) return { seconds: null, text: '时间未知', level: 'stale' }
  const seconds = Math.max(0, Math.round((now - ts) / 1000))
  let text: string
  if (seconds < 60) text = `${seconds} 秒前`
  else if (seconds < 3600) text = `${Math.floor(seconds / 60)} 分钟前`
  else if (seconds < 86400) text = `${Math.floor(seconds / 3600)} 小时前`
  else text = `${Math.floor(seconds / 86400)} 天前`
  const level = seconds <= 60 ? 'fresh' : seconds <= 300 ? 'normal' : 'stale'
  return { seconds, text, level }
}

// ===================== 专业图表快捷标的池 =====================

/** 图表页可切换的标的（指数 / 热门个股 / 海外市场），均为实测可用代码 */
export const CHART_TARGETS: { group: string; items: { code: string; name: string }[] }[] = [
  {
    group: 'A股指数',
    items: [
      { code: 'sh000001', name: '上证指数' },
      { code: 'sz399001', name: '深证成指' },
      { code: 'sz399006', name: '创业板指' },
      { code: 'sh000300', name: '沪深300' },
      { code: 'sh000016', name: '上证50' },
      { code: 'sh000905', name: '中证500' }
    ]
  },
  {
    group: '海外指数',
    items: [
      { code: 'usDJI', name: '道琼斯' },
      { code: 'usIXIC', name: '纳斯达克' },
      { code: 'usINX', name: '标普500' },
      { code: 'hkHSI', name: '恒生指数' },
      { code: 'hkHSTECH', name: '恒生科技' },
      { code: 'hkHSCEI', name: '国企指数' }
    ]
  },
  {
    group: '热门个股',
    items: [
      { code: 'sh600519', name: '贵州茅台' },
      { code: 'sz300750', name: '宁德时代' },
      { code: 'sz002594', name: '比亚迪' },
      { code: 'sh601318', name: '中国平安' },
      { code: 'sh600036', name: '招商银行' },
      { code: 'sh600276', name: '恒瑞医药' }
    ]
  }
]

// ===================== 行情缓存（省免费额度、防重复调用） =====================
//
// 免费公开接口没有额度，但高频重复请求容易被限速甚至临时封 IP。
// 这里做进程内缓存，解决两类重复调用：
//   1) 切 Tab / 组件重挂载时立刻又打一次接口
//   2) 多个视图同时订阅同一批标的
// 缓存寿命按市场状态区分：交易中数据变化快（短），休市数据不动（长）。

export interface QuoteSnapshot {
  indices: Quote[]
  globals: Quote[]
  commodities: Quote[]
  stocks: Quote[]
  /** 快照时间（Date.now()） */
  at: number
}

let snapshot: QuoteSnapshot | null = null

export function getSnapshot(): QuoteSnapshot | null {
  return snapshot
}

export function setSnapshot(s: QuoteSnapshot): void {
  snapshot = s
}

/**
 * 缓存是否仍然新鲜。
 * @param maxAgeSec 允许的最大存活秒数（交易中建议 4s，休市建议 120s）
 */
export function isSnapshotFresh(maxAgeSec: number): boolean {
  if (!snapshot) return false
  return (Date.now() - snapshot.at) / 1000 < maxAgeSec
}

/**
 * 任一 A 股标的处于交易时段 → 认为整体处于「盘中」，需要高频刷新。
 * 全休市时返回 false，调用方据此降频到长间隔甚至暂停自动刷新。
 */
export function isAnyMarketOpen(): boolean {
  return INDEX_CODES.some((c) => marketStatusOf(c).status === 'open')
}

/** 按市场状态给出建议的自动刷新间隔（毫秒） */
export function suggestedRefreshMs(): number {
  return isAnyMarketOpen() ? 3000 : 60000
}

// 腾讯财经实时行情（免费、无需 Key、纯前端直连）
//
// 数据源：腾讯财经公开行情接口 qt.gtimg.cn，返回形如
//   v_sh000001="1~上证指数~000001~3833.65~...";
// 的 JS 片段。该接口不返回 CORS 头，浏览器 fetch 直连会被拦，
// 故采用 <script> JSONP 注入方式直连（最稳、零依赖、零额度消耗、免费）。
//
// 重要：接口返回的中文（如“贵州茅台”）是 GBK 编码，必须给 script 标签
// 设置 charset="gbk"，否则名称会乱码。

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

/** 将单条 v_<code> 字符串解析为结构化行情（字段索引已按 qt.gtimg.cn 实测确认） */
export function parseQuote(code: string, raw: string): Quote {
  const p = raw.split('~')
  return {
    code,
    name: (p[1] || code).trim(),
    price: toNum(p[3]),
    prevClose: toNum(p[4]),
    open: toNum(p[5]),
    change: toNum(p[31]),
    changePercent: toNum(p[32]),
    high: toNum(p[33]),
    low: toNum(p[34]),
    rawTime: (p[30] || '').trim(),
    time: parseTime(p[30] || '')
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
export async function fetchQuotes(codes: string[]): Promise<Quote[]> {
  if (!codes.length) return []
  const rawMap = await loadQuotes(codes)
  return codes
    .filter((c) => rawMap[c])
    .map((c) => parseQuote(c, rawMap[c]))
}

export function fetchIndices(): Promise<Quote[]> {
  return fetchQuotes(INDEX_CODES)
}

export function fetchHotStocks(): Promise<Quote[]> {
  return fetchQuotes(HOT_STOCKS)
}

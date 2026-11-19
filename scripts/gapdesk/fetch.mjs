/* =========================================================
   GAPDESK 采集管道 · 抓取与文本清洗
   零 npm 依赖：只用 Node 22 内置 fetch / AbortController。
   ---------------------------------------------------------
   本文件只做「取回来 + 洗干净」，不含任何行业判断逻辑
   （判断在 keywords.mjs，聚类在 cluster.mjs，打分在 score.mjs）。
   ========================================================= */

/** 采集 UA：带上项目地址，便于对方站点识别来源（不伪装浏览器） */
export const UA =
  'Mozilla/5.0 (compatible; GAPDESK/1.0; +https://github.com/yhdxm/zxs)'

/** 单源默认硬超时（毫秒）。实测 25 路里最慢的 Europe PMC / arXiv 需放宽，见 sources.mjs 的 timeout */
export const DEFAULT_TIMEOUT_MS = 12000

/**
 * 按 URL 记录冷却到期时间：429 → 30 分钟，5xx → 5 分钟，其余错误 → 1 分钟。
 * 冷却期内不重试（Actions 每 30 分钟一轮，重试只会继续挨打），直接沿用上一轮数据。
 */
export const COOLDOWN = new Map()

/** 该 URL 是否处于冷却期 */
export function isCooling(url) {
  const until = COOLDOWN.get(url) || 0
  return until > Date.now()
}

/** 冷却剩余毫秒（0 表示未冷却），供 summary 展示 */
export function cooldownLeft(url) {
  return Math.max(0, (COOLDOWN.get(url) || 0) - Date.now())
}

/**
 * 带超时的 fetch。超时/HTTP 错误一律 throw，由调用方按源记账（不中断整轮）。
 * @param {string} url
 * @param {number} ms 硬超时毫秒
 * @param {object} opts fetch 选项（headers / method / body）
 * @returns {Promise<{ct:string, body:any, status:number, ms:number}>}
 */
export async function timedFetch(url, ms = DEFAULT_TIMEOUT_MS, opts = {}) {
  const t0 = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ac.signal,
      headers: { 'user-agent': UA, accept: '*/*', ...(opts.headers || {}) },
    })
    if (!res.ok) {
      // 429 = 被限流，冷却 30 分钟；5xx = 对方抖动，冷却 5 分钟；其余 1 分钟
      const cost = res.status === 429 ? 30 * 60 * 1000 : res.status >= 500 ? 5 * 60 * 1000 : 60 * 1000
      COOLDOWN.set(url, Date.now() + cost)
      const err = new Error(`HTTP ${res.status}`)
      err.status = res.status
      err.cooldown = cost
      throw err
    }
    const ct = res.headers.get('content-type') || ''
    const body = ct.includes('json') ? await res.json() : await res.text()
    return { ct, body, status: res.status, ms: Date.now() - t0 }
  } catch (e) {
    // 超时也记一次短冷却，避免下一轮同一源继续占满 12s 预算
    if (e && (e.name === 'AbortError' || /aborted/i.test(String(e.message)))) {
      COOLDOWN.set(url, Date.now() + 60 * 1000)
      const err = new Error(`timeout ${ms}ms`)
      err.timeout = true
      throw err
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** 展开 CDATA：必须在任何 XML 解析之前调用，否则含 CDATA 的源（如极客公园）会 0 条 */
export function cdata(s = '') {
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

/** HTML 实体解码（&amp; 放最后，避免二次解码） */
export function entity(s = '') {
  return cdata(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}

/** 去 HTML 标签 + 压缩空白；标签替换为空格（不是空串），避免「A</b>B」粘成「AB」 */
export function stripTags(s = '') {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 标题清洗：`【真标题】正文摘要` 取【】内的真标题；
 * 顺手去掉首尾方括号残留（部分源用 [标题] 形式）。
 */
export function cleanTitle(t = '') {
  const s = stripTags(t)
  const m = s.match(/^【([^】]{4,60})】([\s\S]*)$/)
  if (m) return (m[1] + (m[2] ? ` —— ${m[2].trim().slice(0, 40)}` : '')).trim()
  return s.replace(/^[[【]|[]】]$/g, '').trim()
}

/**
 * 榜单热度解析：「763 万热度」「1.2亿」「3456」都要能吃进来。
 * 返回整数热度；无法解析返回 0（0 表示「没测到」，不是「热度为 0」）。
 */
export function parseHot(v) {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : 0
  const m = String(v).match(/([0-9]+(?:\.[0-9]+)?)\s*(亿|万|w|W)?/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (!Number.isFinite(n)) return 0
  const unit = m[2] || ''
  if (unit === '亿') return Math.round(n * 1e8)
  if (unit === '万' || unit === 'w' || unit === 'W') return Math.round(n * 1e4)
  return Math.round(n)
}

/**
 * 时间字段归一为 epoch 毫秒。三种真实格式：
 *   ① unix 秒（10 位）  ② unix 毫秒（13 位）  ③ 'YYYY-MM-DD HH:mm:ss' / ISO 字符串
 * 返回 0 表示「源站没给时间」，调用方不得用 0 参与时差计算。
 */
export function tsOf(v) {
  if (v == null || v === '') return 0
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return 0
    if (v > 1e12) return Math.round(v)
    if (v > 1e9) return Math.round(v * 1000)
    return 0
  }
  const s = String(v).trim()
  if (/^\d+$/.test(s)) return tsOf(Number(s))
  let t = Date.parse(s)
  // 兼容 'YYYY-MM-DD HH:mm:ss'（部分源的 pubDate 不带 T/Z）
  if (Number.isNaN(t)) t = Date.parse(s.replace(/-/g, '/'))
  return Number.isNaN(t) ? 0 : t
}

/**
 * 轻量 RSS/Atom 解析（不引 xml 库）。
 * @param {string} xml 原始 XML
 * @param {number} limit 单源最多取多少条
 * @returns {{t:string,s:string,u:string,ts:number}[]}
 */
export function parseRSS(xml, limit = 25) {
  const out = []
  const body = entity(cdata(String(xml || '')))
  const blocks = body.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/g) || []
  for (const block of blocks) {
    const pick = (re) => {
      const m = block.match(re)
      return m ? stripTags(entity(m[1])) : ''
    }
    const t = pick(/<(?:title|h4)[^>]*>([\s\S]*?)<\/(?:title|h4)>/)
    if (!t) continue
    const link =
      (block.match(/<link[^>]*?href="([^"]+)"/) || block.match(/<link[^>]*?>([\s\S]*?)<\/link>/) || [])[1] || ''
    const desc = pick(
      /<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/
    ).slice(0, 170)
    const pd =
      (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ||
        block.match(/<(?:updated|published|dc:date|date)>([\s\S]*?)<\/(?:updated|published|dc:date|date)>/) ||
        [])[1] || ''
    out.push({ t, s: desc || t, u: stripTags(link), ts: tsOf(pd) })
    if (out.length >= limit) break
  }
  return out
}

/**
 * 中央新鲜度闸门。
 * 血泪教训：只验 HTTP 200 会漏掉「停更僵尸源」——新浪财经滚动/人民网/新华网都返回 200，
 * 但最新条目停在 2008/2014/2022 年，会把陈年旧闻当成今日差值。故按发布时间硬性截断。
 *
 * ⚠️ 默认 48h（不是 7 天）：产品口径是「只留近 48 小时」，
 * 且库里 events 的 expire_at 也按 48h 滚动（见 collect.mjs 的 toEventRow）。
 * 若闸门比 48h 宽，发布时间在 48~168h 的条目会「一写入就已过期」，既白占写入又永远读不到。
 * @param {object[]} items 归一后的条目（含 ts / srcName）
 * @param {number} maxAgeH 最大允许年龄（小时），默认 48h
 * @returns {{items:object[], dropped:number, bySource:Record<string,number>}}
 */
export function freshnessGate(items, maxAgeH = 48) {
  const keep = []
  const bySource = {}
  let dropped = 0
  const now = Date.now()
  for (const it of items) {
    // ts=0 表示源站未给时间：不能判它过期，如实保留（前端显示「时间未知」）
    const tooOld = it.ts > 0 && now - it.ts > maxAgeH * 3600 * 1000
    if (tooOld) {
      dropped++
      const name = it.srcName || it.srcId || '未知源'
      bySource[name] = (bySource[name] || 0) + 1
      continue
    }
    keep.push(it)
  }
  return { items: keep, dropped, bySource }
}

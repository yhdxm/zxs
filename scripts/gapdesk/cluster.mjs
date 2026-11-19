/* =========================================================
   GAPDESK 采集管道 · 指纹、相似度与三遍聚类
   口径严格对齐 server.mjs 第 253 / 291-325 / 698-732 行。
   ---------------------------------------------------------
   为什么要在 .mjs 里重写一份 FNV-1a，而不 import src/utils/gapdeskFormat.ts：
   Node 22 直接 import .ts 需要实验开关（--experimental-strip-types），
   GitHub Actions 上会多一次解析开销且版本敏感。两处算法必须逐位一致，
   故由 smoke.mjs 用固定标题把 TS 版输出的期望值写死做断言（见 smoke.mjs 末尾）。
   ========================================================= */

/**
 * FNV-1a 32 位，返回 hex（**不补零**）。
 * 不补零是硬要求：补零会让 `1a2b` 变成 `00001a2b`，与前端 eventKeyOf 算出的
 * event_key 不一致 → 同一条事件入库两次。
 */
export function sha(s) {
  const str = String(s == null ? '' : s)
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

/**
 * 标题指纹（= 库表 gap_events.event_key）。
 * 归一化：小写 + 去掉所有空白 + 取前 28 字符，
 * 与 src/utils/gapdeskFormat.ts 的 eventKeyOf 完全一致。
 */
export function eventKeyOf(title) {
  return sha(String(title == null ? '' : title).toLowerCase().replace(/\s/g, '').slice(0, 28))
}

/** 去标签 + 小写 + 只留中英文数字，再切 2-gram 集合 */
export function bigrams(s) {
  const clean = String(s == null ? '' : s)
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '')
  const g = new Set()
  for (let i = 0; i < clean.length - 1; i++) g.add(clean.slice(i, i + 2))
  // 单字标题（如「长鑫」被清洗后只剩 1 字）保底成 1 个 gram，否则永远匹配不上
  if (!g.size && clean) g.add(clean)
  return g
}

/** Jaccard 相似度 */
export function sim(a, b) {
  if (!a || !b || !a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

/** 交集大小 */
export function interN(a, b) {
  if (!a || !b) return 0
  let i = 0
  for (const x of a) if (b.has(x)) i++
  return i
}

/** 重叠系数（交集 / 较小集合）：短标题与长标题匹配时比 Jaccard 稳 */
export function ov(a, b) {
  if (!a || !b || !a.size || !b.size) return 0
  return interN(a, b) / Math.min(a.size, b.size)
}

/**
 * 数字锚点：40年 / 3.5万户 / 180亿美元 这类是「改写型重复」最稳的锚。
 * 取数字前 4 位 + 单位，避免 1234567 这种长数字因末尾差异漏配。
 */
export function numAnchors(t) {
  const out = new Set()
  const re =
    /([0-9][0-9.,]*)\s*(万|亿|%|pct|元|美元|户|席|吨|台|套|倍|个百分点|年|月|日|小时|分钟|人|条|款|代|周|公里|MW|GW|kWh|P|T|美元亿)/g
  for (const m of String(t || '').matchAll(re)) out.add(m[1].replace(/[.,]/g, '').slice(0, 4) + m[2])
  return out
}

/** 新闻泛词停用表：不参与关键词袋，否则「方面」「表示」会把任何两条新闻连起来 */
export const KWSTOP = new Set([
  '今日', '昨日', '记者', '表示', '消息', '认为', '方面', '同时', '目前', '进行', '相关', '报道',
  '以及', '以下', '以上', '年内', '本月', '本周', '第一', '第二', '晚报', '早报', '人士', '了解',
  '显示', '发布', '截至', '对于', '这是', '一个', '我们', '他们', '可能', '已经', '成为', '没有',
  '什么', '为什么', '如何', '怎么', '这个', '那个', '时候', '问题', '回答', '评论', '来源', '原文',
  '点击', '兴趣', '持续', '公司', '集团', '平台', '左右', '其中', '一些', '非常', '出现', '超过',
  '数据', '报告', '项目', '价格', '亿元', '万元', '同比', '环比', '完成', '宣布', '继续',
])

/** 关键词袋：中英数字 2-gram，去掉泛词与含数字的 gram（防「40年」这类数字巧合误合） */
export function kwSet(t) {
  const out = new Set()
  const c = String(t || '')
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '')
  for (let i = 0; i < c.length - 1; i++) {
    const g2 = c.slice(i, i + 2)
    if (!KWSTOP.has(g2) && !/[0-9]/.test(g2)) out.add(g2)
  }
  return out
}

/** 字袋（单字集合，去标点空格）：跨改写/跨语言粗重合 */
export function bag(t) {
  return new Set(
    String(t || '')
      .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '')
      .split('')
  )
}

/** 早报/盘点/汇总类聚合标题：跨源相似度天然很高，强制不参与合并，否则会把一整天并成一条 */
export const DIGEST = /(早报|晚报|日报|晨报|午报|快讯集锦|盘点|汇总|一图看懂|合集)/

/**
 * 同一事件判定（三条件任一成立即合并）：
 *   ① 数字锚点有交集 + 字袋重合 ≥0.36 + 关键词共享 ≥5
 *   ② bigram 重叠系数 ≥0.60
 *   ③ 同站点（同 host）+ 重叠系数 ≥0.55（同站改写/转载）
 * 聚合类标题（早报/盘点）一律否，避免整日合并。
 * @param {object} a {g, t, text, kw, bag, na, host}
 * @param {object} b 同上
 */
export function sameEvent(a, b) {
  const na = a.na || numAnchors(a.text || a.t)
  const nb = b.na || numAnchors(b.text || b.t)
  let anchorHit = 0
  for (const x of na) {
    if (nb.has(x)) {
      anchorHit++
      break
    }
  }

  const ba = a.bag || bag(a.t || a.text)
  const bb = b.bag || bag(b.t || b.text)
  const akw = a.kw || kwSet(a.text || a.t)
  const bkw = b.kw || kwSet(b.text || b.t)

  let kw = 0
  for (const x of akw) {
    if (bkw.has(x)) kw++
    if (kw >= 5) break
  }

  const small = Math.min(ba.size || 1, bb.size || 1)
  let inter = 0
  for (const x of ba) if (bb.has(x)) inter++
  const cov = inter / small

  const grams = ov(a.g, b.g)
  const isDigest = DIGEST.test(a.text || a.t || '') || DIGEST.test(b.text || b.t || '')

  const byAnchor = anchorHit >= 1 && cov >= 0.36 && kw >= 5
  const byGrams = grams >= 0.60
  const byHost = !!(a.host && b.host && a.host === b.host && grams >= 0.55)

  return {
    anchorHit,
    cov: +cov.toFixed(2),
    grams: +grams.toFixed(2),
    kw,
    digest: isDigest,
    yes: !isDigest && (byAnchor || byGrams || byHost),
  }
}

/**
 * 大众榜外溢探针：判断候选事件是否已出圈到微博/知乎/抖音/头条。
 * 命中判据（宁漏不误）：
 *   direct 重叠系数≥0.5 且共享 bigram≥3；或 重叠系数≥0.34 且共享≥3 且三条件判定通过。
 * 大众榜标题常常只有 4 字（如「长鑫存储」），所以不能用统一的高阈值。
 * @param {object[]} items 候选（含 g）
 * @param {object[]} massItems 大众层条目（含 t/s/h）
 * @returns {object[]} 附上 massHeat / massOn 的候选
 */
export function probeMass(items, massItems) {
  const massGrams = massItems
    .map((m) => ({ g: m.g || bigrams(m.t), heat: m.h || 0, name: m.srcName, t: m.t, s: m.s || '' }))
    .filter((x) => x.g.size)

  for (const e of items) {
    const g = e.g || bigrams(e.t)
    e.g = g
    let mh = 0
    let mName = null
    for (const mm of massGrams) {
      const o = ov(g, mm.g)
      const shared = interN(g, mm.g)
      const direct = o >= 0.5 && shared >= 3
      const hit =
        direct ||
        (o >= 0.34 &&
          shared >= 3 &&
          sameEvent(
            { g, t: e.t, text: `${e.t} ${e.s || ''}`, host: e.host },
            { g: mm.g, t: mm.t, text: `${mm.t} ${mm.s || ''}`, host: '' }
          ).yes)
      if (hit && mm.heat > mh) {
        mh = mm.heat
        mName = mm.name
      }
    }
    e.massHeat = Math.round(mh)
    e.massOn = mName
  }
  return items
}

/**
 * 三遍聚类（口径同 server.mjs）：
 *   ① 精确指纹：标题归一化后指纹相同的直接并簇
 *   ② 近似：Jaccard 或「重叠系数>0.72 折算 0.5 分」>0.42 并入（跨媒体转载/微改标题）
 *   ③ 双条件：数字锚点 + 字袋 + 关键词袋（同一事件被不同措辞改写）
 * @param {object[]} items 候选条目（含 t/s/text，可选 g）
 * @returns {{events:object[], funnel:object}}
 */
export function dedupe(items) {
  const list = items.map((e) => ({
    ...e,
    g: e.g || bigrams(e.t),
    text: e.text || `${e.t} ${e.s || ''}`,
  }))

  /* ---- 第一遍：精确指纹 ---- */
  const clusters = []
  const byKey = new Map()
  for (const e of list) {
    const key = eventKeyOf(e.t)
    const ex = byKey.get(key)
    if (ex) {
      // 修复 server.mjs 的历史缺陷：第 3 条同 key 会被 seenRound 误丢，导致 src_count 少算
      ex.items.push(e)
      ex.massHeat = Math.max(ex.massHeat, e.massHeat || 0)
      ex.massOn = ex.massOn || e.massOn || null
      continue
    }
    const c = {
      key,
      rep: e,
      items: [e],
      g: e.g,
      massHeat: e.massHeat || 0,
      massOn: e.massOn || null,
    }
    clusters.push(c)
    byKey.set(key, c)
  }

  /* ---- 第二遍：近似合并 ---- */
  const merged = []
  for (const c of clusters) {
    let hit = null
    let best = 0
    /**
     * 聚合类标题（早报/盘点/汇总/一图看懂/合集）**不允许参与近似合并**。
     * 为什么守卫必须放在这一遍：DIGEST 原本只在第三遍 sameEvent() 里生效，
     * 而第二遍的阈值（sim/ov > 0.42）比第三遍宽松得多 —— 实测两条
     * 「今日早报：A股三大指数集体低开 光伏板块领涨 / 领跌」的 sim 高达 0.90，
     * 第三遍还没跑到就已经被并成一条，第三遍的 DIGEST 保护形同虚设。
     * 判定用簇代表条目的标题（c.rep.t）：聚合标题的代表条目一定是那条聚合稿本身。
     */
    const cDigest = c.isDigest !== undefined ? c.isDigest : DIGEST.test(c.rep.t || '')
    c.isDigest = cDigest
    for (const m of merged) {
      // 任一侧是聚合类标题就跳过：早报既不吞别人，也不被别人吞
      if (cDigest || m.isDigest) continue
      const score = Math.max(sim(c.g, m.g), ov(c.g, m.g) > 0.72 ? 0.5 : 0)
      if (score > best) {
        best = score
        hit = m
      }
    }
    if (!(hit && best > 0.42)) hit = null
    if (hit) {
      hit.items.push(...c.items)
      hit.massHeat = Math.max(hit.massHeat, c.massHeat)
      hit.massOn = hit.massOn || c.massOn
    } else {
      merged.push(c)
    }
  }

  /* ---- 第三遍：数字锚点 + 字袋 + 关键词袋 ---- */
  // 预计算 text/kw/bag/na，避免 O(n²) 比较里反复构造集合（43 源时实测会超时）
  for (const c of merged) {
    c.text = c.items.map((i) => i.text || i.t).join(' ')
    c.kw = kwSet(c.text)
    c.bag = bag(c.rep.t || c.text)
    c.na = numAnchors(c.text)
  }

  const events = []
  const mergeLog = []
  for (const c of merged) {
    let hit = null
    for (const m of events) {
      const r = sameEvent(
        { g: c.g, t: c.rep.t, text: c.text, kw: c.kw, bag: c.bag, na: c.na, host: c.rep.host },
        { g: m.g, t: m.rep.t, text: m.text, kw: m.kw, bag: m.bag, na: m.na, host: m.rep.host }
      )
      if (r.yes) {
        hit = m
        if (mergeLog.length < 50) mergeLog.push([c.rep.t.slice(0, 16), m.rep.t.slice(0, 16), r])
        break
      }
    }
    if (hit) {
      hit.items.push(...c.items)
      hit.massHeat = Math.max(hit.massHeat, c.massHeat)
      hit.massOn = hit.massOn || c.massOn
      // 合并后文本变长，刷新派生集合，供后续（可能还有第四条）比较
      hit.text = hit.items.map((i) => i.text || i.t).join(' ')
      hit.kw = kwSet(hit.text)
      hit.na = numAnchors(hit.text)
    } else {
      events.push(c)
    }
  }

  return {
    events,
    mergeLog,
    funnel: {
      raw: items.length,
      candidates: list.length,
      exact: clusters.length,
      approx: merged.length,
      event: events.length,
    },
  }
}

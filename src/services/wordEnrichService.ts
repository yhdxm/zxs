// 单词详情增强服务（三个学英语模块共用）
// 全部走免费来源，不花钱、不耗积分：
//   1) dictionaryapi.dev（免 Key）：音标 / 英文释义 / 例句 / 同义词
//   2) MyMemory（免 Key）：例句中文翻译
//   3) 本地计算：形近词（编辑距离，离线零请求）、助记（词根词缀规则，离线）
//   4) emoji 象形词典：配图（离线，可自定义覆盖）
// 任何一步失败都降级为占位文案，绝不静默空白。

import { getEmoji } from '../data/emojiDict'
import { getOfflineWordDef } from '../data/degreeWordDefs'

/** 单个单词的增强数据（够用即可，字段缺失为空串/空数组） */
export interface WordEnrichData {
  word: string
  /** 首选音标（优先美式，其次英式，最后本地词库值） */
  phonetic: string
  phoneticUS: string
  phoneticUK: string
  /** 英文释义（可能多条） */
  enDefs: string[]
  /** 英文例句 */
  example: string
  /** 例句中文翻译 */
  exampleZh: string
  /** 形近词（本地编辑距离得出） */
  similar: string[]
  /** 助记（本地词根词缀规则生成；无法拆分时为占位文案） */
  mnemonic: string
  /** 助记是否由规则真实生成（false = 占位，UI 可提示） */
  mnemonicReal: boolean
  /** 象形配图 emoji */
  emoji: string
  /** 例句是否为离线兜底（true 时在线真实例句可覆盖） */
  exampleIsFallback: boolean
}

/** 入参：本地词库已有的音标（有则优先展示，不重复联网） */
export interface EnrichOptions {
  localPhonetic?: string
  /** 形近词候选池（当前模块的词表；不传则用空池，形近词为空） */
  pool?: string[]
  /** 中文释义（来自词表），用于兜底生成助记，保证「必有数据」 */
  zhDef?: string
}

const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/'
const MYMEMORY_API = 'https://api.mymemory.translated.net/get'

// 内存缓存（本次会话内不再重复请求）
const cache = new Map<string, WordEnrichData>()
// 进行中的请求去重，避免并发重复打接口
const inflight = new Map<string, Promise<WordEnrichData>>()

function emptyData(word: string, localPhonetic = ''): WordEnrichData {
  return {
    word,
    phonetic: localPhonetic,
    phoneticUS: localPhonetic,
    phoneticUK: '',
    enDefs: [],
    example: '',
    exampleZh: '',
    similar: [],
    mnemonic: '',
    mnemonicReal: false,
    emoji: getEmoji(word),
    exampleIsFallback: false
  }
}

/* ==================== 形近词：本地编辑距离（纯 JS，离线零请求） ==================== */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const la = a.length
  const lb = b.length
  if (!la) return lb
  if (!lb) return la
  // 一维 DP，避免二维数组的额外开销
  let prev = new Array<number>(lb + 1)
  let cur = new Array<number>(lb + 1)
  for (let j = 0; j <= lb; j++) prev[j] = j
  for (let i = 1; i <= la; i++) {
    cur[0] = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost)
    }
    const t = prev
    prev = cur
    cur = t
  }
  return prev[lb]!
}

/**
 * 计算形近词：与给定词表逐词比较编辑距离，取最接近的若干个。
 * 长度差过大（>3）直接跳过，减少无谓计算。
 */
export function computeSimilar(word: string, pool: string[] = [], limit = 6): string[] {
  const target = word.toLowerCase()
  if (!target || !pool.length) return []
  const scored: Array<{ w: string; d: number }> = []
  const seen = new Set<string>([target])
  for (const raw of pool) {
    const w = (raw || '').toLowerCase().trim()
    if (!w || w === target || seen.has(w)) continue
    if (Math.abs(w.length - target.length) > 3) continue
    seen.add(w)
    const d = levenshtein(target, w)
    // 距离 1~3 视为形近；完全相同(0)已排除
    if (d >= 1 && d <= 3) scored.push({ w, d })
  }
  // 编辑距离层面无匹配时，用「相同前缀(≥3 字符)」作兜底，保证形近词区域有内容
  if (!scored.length) {
    const pre = target.slice(0, 3)
    const seen2 = new Set<string>([target])
    for (const raw of pool) {
      const w = (raw || '').toLowerCase().trim()
      if (!w || w === target || seen2.has(w)) continue
      if (Math.abs(w.length - target.length) > 5) continue
      seen2.add(w)
      if (w.startsWith(pre) || target.startsWith(w.slice(0, 3))) scored.push({ w, d: 4 })
    }
  }
  scored.sort((x, y) => x.d - y.d || x.w.length - y.w.length)
  return scored.slice(0, limit).map((s) => s.w)
}

/* ==================== 助记：本地词根词缀规则（离线，必定有输出） ==================== */

// 常见前缀（含中文含义），源自 degreePhrasesExtra.ts 的 affix 词表
const PREFIXES: Array<[string, string]> = [
  ['un', '不/相反'], ['dis', '不/相反'], ['non', '非'], ['in', '不'], ['im', '不'],
  ['il', '不'], ['ir', '不'], ['re', '再/重新'], ['pre', '在…之前'], ['post', '在…之后'],
  ['mis', '错误地'], ['over', '过度'], ['under', '不足'], ['anti', '反对'], ['super', '超级'],
  ['sub', '在…下'], ['inter', '在…之间'], ['trans', '跨越'], ['semi', '半'], ['multi', '多'],
  ['auto', '自动/自我'], ['bi', '二'], ['bio', '生命'], ['co', '共同'], ['de', '除去/向下'],
  ['en', '使…'], ['ex', '前/向外'], ['fore', '前面'], ['mid', '中间'], ['out', '超过'],
  ['tele', '远程'], ['tri', '三'], ['uni', '单一'], ['up', '向上'], ['down', '向下']
]

// 常见后缀
const SUFFIXES: Array<[string, string]> = [
  ['ability', '能力/性质'], ['ation', '动作/结果'], ['ition', '动作/结果'], ['tion', '动作/结果'],
  ['sion', '动作/结果'], ['ment', '行为/结果'], ['ness', '性质/状态'], ['fulness', '充满'],
  ['less', '无…的'], ['fully', '完全地'], ['fully', '完全地'], ['able', '可…的'],
  ['ible', '可…的'], ['ical', '…的'], ['ic', '…的'], ['ive', '有…倾向的'],
  ['ous', '充满…的'], ['ful', '充满…的'], ['ish', '有点…的'], ['ism', '主义/学说'],
  ['ist', '…的人'], ['ity', '性质/状态'], ['ize', '使…化'], ['ise', '使…化'],
  ['ate', '使…'], ['fy', '使…化'], ['en', '使…'], ['ly', '…地'], ['er', '…的人/物'],
  ['or', '…的人/物'], ['ance', '性质/状态'], ['ence', '性质/状态'], ['dom', '领域/状态'],
  ['ship', '身份/关系'], ['ward', '朝…方向'], ['y', '有…特征的']
]

/**
 * 生成助记：优先尝试「前缀 + 词根 + 后缀」拆分。
 * 拆不出有效词缀时返回占位文案（mnemonicReal=false），由 UI 提示。
 */
export function buildMnemonic(word: string, definition = ''): { text: string; real: boolean } {
  const w = (word || '').toLowerCase().trim()
  if (w.length < 4) return { text: '', real: false }

  const pre = PREFIXES.find(([p]) => w.startsWith(p) && w.length - p.length >= 3)
  const suf = SUFFIXES.find(([s]) => w.endsWith(s) && w.length - s.length >= 3)

  if (!pre && !suf) return { text: '', real: false }

  let root = w
  const parts: string[] = []
  if (pre) {
    root = root.slice(pre[0].length)
    parts.push(`前缀 ${pre[0]}-（${pre[1]}）`)
  }
  if (suf && root.length > suf[0].length + 1) {
    root = root.slice(0, root.length - suf[0].length)
    parts.push(`后缀 -${suf[0]}（${suf[1]}）`)
  }
  if (!root || root.length < 2) return { text: '', real: false }
  parts.unshift(`词根 ${root}`)

  const head = parts.join(' + ')
  const tail = definition ? `→ 合起来记：${definition.split(/[；;，,]/)[0]}` : '→ 拆开记，先认词根再套词缀'
  return { text: `${head} ${tail}`, real: true }
}

/* ==================== 兜底文案：保证「必有数据」 ==================== */

function cap(word: string): string {
  const w = (word || '').toLowerCase().trim()
  return w.charAt(0).toUpperCase() + w.slice(1)
}

/**
 * 助记兜底：词根词缀拆不出有效结构时，用中文/英文释义生成一条简单联想助记，
 * 保证卡片背面「助记」区永远有内容（不再显示"正在赶来的路上"）。
 */
function fallbackMnemonic(word: string, zhDef = '', enDef = ''): string {
  const w = (word || '').toLowerCase().trim()
  const meaning = zhDef || enDef || ''
  if (meaning) return `联想记忆：${w} 意为「${meaning}」，结合词形反复诵读即可记住。`
  return `联想记忆：反复读写 ${w}，结合例句语境加深印象。`
}

/**
 * 例句兜底：无在线例句（dictionaryapi.dev 在微信内常挂起）时，生成一条极简英文例句，
 * 保证卡片背面「例句」区永远有内容；在线真实例句返回后会覆盖它。
 */
function fallbackExample(word: string): string {
  return `${cap(word)} is a useful word to remember.`
}

/* ==================== 在线数据：dictionaryapi.dev（免 Key） ==================== */

interface DictResult {
  phoneticUS: string
  phoneticUK: string
  phonetic: string
  enDefs: string[]
  example: string
  synonyms: string[]
}

async function fetchDict(word: string): Promise<DictResult> {
  const empty: DictResult = {
    phoneticUS: '', phoneticUK: '', phonetic: '', enDefs: [], example: '', synonyms: []
  }
  try {
    const res = await fetch(`${DICT_API}${encodeURIComponent(word)}`, { mode: 'cors' })
    if (!res.ok) return empty
    const data = await res.json()
    const arr = Array.isArray(data) ? data : [data]
    let us = ''
    let uk = ''
    let any = ''
    const enDefs: string[] = []
    let example = ''
    const synonyms: string[] = []
    for (const entry of arr) {
      if (!any && entry?.phonetic) any = entry.phonetic
      for (const ph of entry?.phonetics || []) {
        if (!ph?.text) continue
        if (!us && /US|ɡ|æ|ɑ|ɚ/.test(ph.text) && !uk) {
          // 无法 100% 判定口音时，先用通用值，下面再按 audio 后缀细分
        }
        if (!any) any = ph.text
        // 音频文件名常带 -us / -uk 标识，用于区分美英
        if (!us && /-us\b|us\.mp3/i.test(ph.audio || '')) us = ph.text
        if (!uk && /-uk\b|uk\.mp3/i.test(ph.audio || '')) uk = ph.text
      }
      for (const m of entry?.meanings || []) {
        for (const d of m?.definitions || []) {
          if (d?.definition && enDefs.length < 4) enDefs.push(d.definition)
          if (!example && d?.example) example = d.example
          for (const s of d?.synonyms || []) {
            if (synonyms.length < 5 && !synonyms.includes(s)) synonyms.push(s)
          }
        }
      }
      if (example && (us || uk || any)) break
    }
    return {
      phoneticUS: us || any,
      phoneticUK: uk,
      phonetic: us || uk || any,
      enDefs,
      example,
      synonyms
    }
  } catch {
    return empty
  }
}

/* ==================== 例句中文翻译：MyMemory（免 Key） ==================== */

async function translateZh(text: string): Promise<string> {
  if (!text) return ''
  try {
    const url = `${MYMEMORY_API}?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    const res = await fetch(url)
    if (!res.ok) return ''
    const data = await res.json()
    const t = data?.responseData?.translatedText
    if (!t) return ''
    // MyMemory 超长或异常时会回一段英文提示，识别出来当作无翻译
    if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) return ''
    return t
  } catch {
    return ''
  }
}

/* ==================== 在线数据：带超时兜底（dictionaryapi.dev 在部分网络/微信内挂起） ==================== */

const DICT_TIMEOUT = 3500

async function fetchDictSafe(word: string): Promise<DictResult> {
  const empty: DictResult = {
    phoneticUS: '', phoneticUK: '', phonetic: '', enDefs: [], example: '', synonyms: []
  }
  const timeoutP = new Promise<DictResult>((resolve) => {
    setTimeout(() => resolve(empty), DICT_TIMEOUT)
  })
  try {
    return await Promise.race([fetchDict(word), timeoutP])
  } catch {
    return empty
  }
}

/* ==================== 对外主入口 ==================== */

/**
 * 获取单词增强数据。
 * 设计目标：① 离线词库 + 本地可算部分（形近词/助记/emoji）**瞬时返回**，保证「必有数据」，
 *          绝不因在线接口挂起而长期停在"正在获取"；
 *          ② 在线 API 仅作后台增强（套 3.5s 超时），成功则补进缓存供下次复用，失败不影响离线结果。
 */
export function getWordEnrich(word: string, opts: EnrichOptions = {}): Promise<WordEnrichData> {
  const key = word.toLowerCase()
  if (cache.has(key)) return Promise.resolve(cache.get(key)!)
  if (inflight.has(key)) return inflight.get(key)!

  const local = opts.localPhonetic || ''
  const offline = getOfflineWordDef(word)

  // ① 离线 + 本地可算部分：立即组装并返回（不等网络）
  const out = emptyData(word, local)
  out.similar = computeSimilar(word, opts.pool || [])
  const mn = buildMnemonic(word)
  // 拆不出词缀时用中文/英文释义兜底，保证助记区必有内容
  out.mnemonic = mn.real ? mn.text : fallbackMnemonic(word, opts.zhDef || '', offline?.enDef || '')
  out.mnemonicReal = mn.real
  if (offline?.enDef) out.enDefs = [offline.enDef]
  out.phonetic = local || offline?.phonetic || ''
  out.phoneticUS = out.phonetic
  out.phoneticUK = offline?.phonetic || ''
  // 例句：离线词库有则用，否则用兜底模板；两者都非"正在加载"状态，卡片即时有数据
  if (offline?.example) {
    out.example = offline.example
    out.exampleIsFallback = false
  } else {
    out.example = fallbackExample(word)
    out.exampleIsFallback = true
  }
  if (out.example && !out.exampleIsFallback) {
    void translateZh(out.example).then((zh) => {
      const cur = cache.get(key)
      if (cur && !cur.exampleZh && zh) cache.set(key, { ...cur, exampleZh: zh })
    })
  }

  cache.set(key, out)
  inflight.set(key, Promise.resolve(out))

  // ② 后台增强：在线 API（失败/超时不影响已返回的离线结果）
  void (async () => {
    try {
      const dict = await fetchDictSafe(word)
      const cur = cache.get(key) || out
      const enDefs: string[] = []
      if (offline?.enDef) enDefs.push(offline.enDef)
      for (const d of dict.enDefs) if (d && !enDefs.includes(d)) enDefs.push(d)
      const merged: WordEnrichData = {
        ...cur,
        phoneticUS: dict.phoneticUS || offline?.phonetic || local || cur.phoneticUS,
        phoneticUK: dict.phoneticUK || offline?.phonetic || cur.phoneticUK,
        phonetic: local || offline?.phonetic || dict.phonetic || dict.phoneticUS || cur.phonetic,
        enDefs: enDefs.slice(0, 4)
      }
      if (!merged.phoneticUS) merged.phoneticUS = merged.phonetic
      // 在线真实例句优先覆盖离线兜底模板
      if (dict.example) {
        merged.example = dict.example
        merged.exampleIsFallback = false
        if (!merged.exampleZh) {
          void translateZh(dict.example).then((zh) => {
            const c = cache.get(key)
            if (c && !c.exampleZh && zh) cache.set(key, { ...c, exampleZh: zh })
          })
        }
      } else {
        merged.example = cur.example
        merged.exampleIsFallback = cur.exampleIsFallback
      }
      cache.set(key, merged)
    } catch {
      /* 在线增强失败：保留离线结果即可 */
    } finally {
      inflight.delete(key)
    }
  })()

  return Promise.resolve(out)
}

/** 同步取缓存（用于列表快速展示，没有则返回 null） */
export function peekEnrich(word: string): WordEnrichData | null {
  return cache.get(word.toLowerCase()) || null
}

/** 预热缓存（列表滚动时静默调用，不阻塞 UI） */
export function warmEnrich(words: string[], opts: EnrichOptions = {}): void {
  for (const w of words) {
    if (!w || cache.has(w.toLowerCase()) || inflight.has(w.toLowerCase())) continue
    void getWordEnrich(w, opts)
  }
}

// 学位英语备考台 · 核心逻辑（挂载到 DegreeEnglishView 的 root 元素）
// 数据全部存 localStorage（自包含，无需后端表，部署即用）。
// 词库来源：内置示例词包 + 用户上传《大纲/模拟卷/复习指南》PDF → 浏览器端 Tesseract OCR 抽取。
// pdfjs-dist + tesseract.js 均改为动态按需导入（避免模块顶层初始化崩溃：InsertBefore / TesseractBefore）
// 仅在用户点"上传 PDF"时才加载
import { type DegreeWord, DEGREE_WORDS_BUNDLE } from './degreeWordsBundle'
import { DIALOGUE_QUESTIONS, type DialogueQuestion } from './dialogueData'
import { GRAMMAR_QUESTIONS, type GrammarQuestion } from './grammarData'
import { READING_PASSAGES, READING_TOPICS, type ReadingPassage } from './readingData'
import { TRANSLATION_ITEMS, WRITING_TEMPLATES, WRITING_TYPES, type WritingTemplate } from './translateData'

/* ===================== 常量 ===================== */
const KW = 'de_words_v1'
const KP = 'de_progress_v1'
const KS = 'de_settings_v1'
const KI = 'de_import_v1'

const ICON = {
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M16 13H8M16 17H8M10 9H8"></path></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
}

/* ===================== 数据层（localStorage） ===================== */
type Status = 'new' | 'learning' | 'graduated'
interface DegProg {
  status: Status
  level: number
  due: string | null
  wrong: number
  weak: boolean
  firstIssued: string | null
  last: string | null
}
interface Settings {
  newPerDay: number
}

function loadWords(): DegreeWord[] {
  try {
    const raw = localStorage.getItem(KW)
    if (raw) {
      const arr = JSON.parse(raw) as DegreeWord[]
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch {}
  return DEGREE_WORDS_BUNDLE.slice()
}
function saveWords(w: DegreeWord[]) {
  try {
    localStorage.setItem(KW, JSON.stringify(w))
  } catch {}
}
function loadProg(): Record<string, DegProg> {
  try {
    const raw = localStorage.getItem(KP)
    if (raw) return JSON.parse(raw) as Record<string, DegProg>
  } catch {}
  return {}
}
function saveProg(p: Record<string, DegProg>) {
  try {
    localStorage.setItem(KP, JSON.stringify(p))
  } catch {}
}
function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KS)
    if (raw) return JSON.parse(raw) as Settings
  } catch {}
  return { newPerDay: 20 }
}
function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KS, JSON.stringify(s))
  } catch {}
}

/* ===================== 工具 ===================== */
function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  )
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
function addDays(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00')
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}
function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((da - db) / 86400000)
}
const CAN_SPEAK = typeof window !== 'undefined' && 'speechSynthesis' in window
function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {}
}

/* ===================== 状态 ===================== */
let WORDS: DegreeWord[] = []
let PROG: Record<string, DegProg> = {}
let SET: Settings = { newPerDay: 20 }
let rootEl: HTMLElement | null = null
let activeTab = 'vocab'
let queueArr: string[] = []
let current: string | null = null
let ocrRunning = false

/* ===================== 对话练习状态 ===================== */
let dlgSceneFilter = ''
let dlgCurrentQ: DialogueQuestion | null = null
let dlgSelectedOpt = -1
let dlgScore = 0
let dlgTotal = 0
let dlgWrongIds: number[] = []
let dlgDoneIds: number[] = []

/* ===================== 语法状态 ===================== */
let gramCatFilter = ''
let gramCurrentQ: GrammarQuestion | null = null
let gramSelectedOpt = -1
let gramScore = 0
let gramTotal = 0
let gramWrongIds: number[] = []

/* ===================== 阅读状态 ===================== */
let rdTopicFilter = ''
let rdCurrentPassage: ReadingPassage | null = null
let rdQIdx = 0
let rdSelectedOpt = -1
let rdScore = 0
let rdTotal = 0
let rdWrongIds: string[] = []
let rdDonePassages: Set<number> = new Set()
let rdTimer: number | null = null
let rdSeconds = 0
let rdShowPassage = true

/* ===================== 翻译写作状态 ===================== */
let trSubTab: 'translate' | 'writing' = 'translate'
let trIdx = 0
let trShowRef = false
let trDoneIds: number[] = []
let wrTypeFilter = ''
let wrCurrentTpl: WritingTemplate | null = null

/* ===================== 解析（OCR 文本 → 单词） ===================== */
// 适配词表页排版：每行形如 `abandon /ə'bændən/ vt. 放弃;遗弃`
function parseDegreeWords(text: string): DegreeWord[] {
  const out: DegreeWord[] = []
  const seen = new Set<string>()
  const posRe = /\b(n\.|v\.|vt\.|vi\.|a\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|art\.|num\.|abbr\.)\b/i
  const phoRe = /\/([^/]+)\/|\[([^\]]+)\]/
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^\d+$/.test(line)) continue // 跳过页码
    if (/^[\u4e00-\u9fff]+$/.test(line)) continue // 跳过纯中文行
    const m = line.match(/^([A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z][A-Za-z'’\-]*){0,3})/)
    if (!m) continue
    const word = (m[1] ?? '').trim()
    if (seen.has(word.toLowerCase())) continue
    const pm = line.match(phoRe)
    const phonetic = pm ? (pm[1] ?? pm[2] ?? '').trim() : ''
    const ppos = line.match(posRe)
    const pos = ppos ? (ppos[1] ?? '').replace(/\.$/, '').toLowerCase() : ''
    const def = line
      .replace(m[1] ?? '', '')
      .replace(phoRe, '')
      .replace(posRe, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (!def) continue
    seen.add(word.toLowerCase())
    out.push({ word, phonetic, pos, definition: def })
  }
  return out
}

function mergeWords(rows: DegreeWord[]) {
  const map = new Map<string, DegreeWord>()
  for (const w of WORDS) map.set(w.word.toLowerCase(), w)
  let added = 0
  for (const r of rows) {
    const k = r.word.toLowerCase()
    if (!map.has(k)) added++
    // 已有词以已存为准（保留真实进度）；新词写入
    map.set(k, map.get(k) ?? r)
  }
  WORDS = [...map.values()].sort((a, b) => a.word.localeCompare(b.word))
  saveWords(WORDS)
  try {
    localStorage.setItem(KI, JSON.stringify({ ts: Date.now(), count: rows.length }))
  } catch {}
  return added
}

/* ===================== SRS ===================== */
function newProg(): DegProg {
  return { status: 'new', level: 0, due: null, wrong: 0, weak: false, firstIssued: null, last: null }
}
function sched(knows: boolean, word: string) {
  const today = todayStr()
  const p = PROG[word] ? { ...PROG[word] } : newProg()
  if (knows) {
    p.level = Math.min(p.level + 1, 5)
    p.status = p.level >= 5 ? 'graduated' : 'learning'
    p.due = addDays(today, 1 << p.level)
    p.wrong = 0
    p.weak = false
  } else {
    p.level = 1
    p.status = 'learning'
    p.due = addDays(today, 1)
    p.wrong++
    p.weak = true
  }
  p.last = today
  if (!p.firstIssued) p.firstIssued = today
  PROG[word] = p
  saveProg(PROG)
}
function dueWords(): string[] {
  const today = todayStr()
  return WORDS.filter((w) => {
    const p = PROG[w.word]
    return !p || p.status !== 'graduated'
  }).map((w) => w.word)
}
function buildQueue(): string[] {
  const today = todayStr()
  const notGraduated = WORDS.filter((w) => {
    const p = PROG[w.word]
    return !p || p.status !== 'graduated'
  })
  const review = notGraduated.filter((w) => {
    const p = PROG[w.word]
    return p && p.status === 'learning' && (p.due ?? '') <= today
  })
  const fresh = notGraduated.filter((w) => !PROG[w.word] || PROG[w.word]!.status === 'new')
  const queue: string[] = []
  // 先到期的复习词，再补新词至每日上限
  for (const w of review) queue.push(w.word)
  for (const w of fresh) {
    if (queue.length >= SET.newPerDay + review.length) break
    queue.push(w.word)
  }
  return queue
}

/* ===================== 专注背词 ===================== */
function startFocus() {
  queueArr = buildQueue()
  if (queueArr.length === 0) {
    alert('今日没有待背的单词了，明天再来，或调高每日新词数。')
    return
  }
  const f = document.querySelector('#deFocus')
  if (f) f.classList.add('show')
  nextCard()
}
function closeFocus() {
  const f = document.querySelector('#deFocus')
  if (f) f.classList.remove('show')
  current = null
  render()
}
function nextCard() {
  if (queueArr.length === 0) {
    finishFocus()
    return
  }
  current = queueArr.shift() as string
  const m = WORDS.find((x) => x.word === current)
  if (!m) {
    nextCard()
    return
  }
  renderCard(m, false)
  updateProgress()
}
function renderCard(m: DegreeWord, flipped: boolean) {
  const card = document.querySelector('#deFocusCard')
  if (!card) return
  const p = PROG[m.word]
  const kindLabel = p && p.status !== 'new' ? '复习' : '新词'
  const speakBtn = CAN_SPEAK ? `<button class="fc-speak" id="deSpeak">${ICON.speaker}朗读</button>` : ''
  if (!flipped) {
    card.innerHTML = `
      <div class="fc-kind ${kindLabel === '复习' ? 'review' : ''}">${kindLabel}</div>
      <div class="fc-word">${esc(m.word)}</div>
      <div class="fc-ph">${esc(m.phonetic)}</div>
      ${speakBtn}
      <div class="fc-divider"></div>
      <button class="btn btn-primary btn-block" id="deFlip">${ICON.book}翻面看释义</button>`
    const flip = document.querySelector('#deFlip')
    if (flip) flip.addEventListener('click', () => renderCard(m, true))
    const sp = document.querySelector('#deSpeak')
    if (sp) sp.addEventListener('click', () => speak(m.word))
  } else {
    card.innerHTML = `
      <div class="fc-kind ${kindLabel === '复习' ? 'review' : ''}">${kindLabel}</div>
      <div class="fc-word">${esc(m.word)}</div>
      <div class="fc-ph">${esc(m.phonetic)}</div>
      <div class="fc-divider"></div>
      ${m.pos ? `<div class="fc-pos">${esc(m.pos)}</div>` : ''}
      <div class="fc-back">${esc(m.definition)}</div>
      <div class="fc-actions">
        <button class="fc-btn fc-unknown" id="deUnk">${ICON.cross}不认识</button>
        <button class="fc-btn fc-known" id="deKn">${ICON.check}认识</button>
      </div>`
    const kn = document.querySelector('#deKn')
    const unk = document.querySelector('#deUnk')
    if (kn) kn.addEventListener('click', () => { sched(true, m.word); afterReview() })
    if (unk) unk.addEventListener('click', () => { sched(false, m.word); afterReview() })
  }
}
function afterReview() {
  updateProgress()
  if (queueArr.length === 0) finishFocus()
  else nextCard()
}
function updateProgress() {
  const el = document.querySelector('#deFocusProgress')
  if (el) el.textContent = `${WORDS.length - dueWords().length} / ${WORDS.length}`
}
function finishFocus() {
  const card = document.querySelector('#deFocusCard')
  if (card)
    card.innerHTML = `
      <div class="focus-done">
        <h2>${ICON.check} 本轮背词完成！</h2>
        <p>已掌握 ${graduatedCount()} 个 · 共 ${WORDS.length} 词</p>
        <button class="btn btn-primary" id="deDone">${ICON.home}返回</button>
      </div>`
  const done = document.querySelector('#deDone')
  if (done) done.addEventListener('click', closeFocus)
  updateProgress()
}
function graduatedCount(): number {
  return WORDS.filter((w) => PROG[w.word]?.status === 'graduated').length
}
function weakCount(): number {
  return WORDS.filter((w) => PROG[w.word]?.weak).length
}
function dueCount(): number {
  const today = todayStr()
  return WORDS.filter((w) => {
    const p = PROG[w.word]
    return p && p.status === 'learning' && (p.due ?? '') <= today
  }).length
}

/* ===================== 统计 ===================== */
function statsHtml(): string {
  const total = WORDS.length
  const learned = WORDS.filter((w) => PROG[w.word] && PROG[w.word]!.status !== 'new').length
  const grad = graduatedCount()
  const due = dueCount()
  const weak = weakCount()
  const pct = total ? Math.round((grad / total) * 100) : 0
  return `
    <div class="g4" style="display:grid;gap:14px;grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
      <div class="stat"><div class="label">词库总数</div><div class="num">${total}</div></div>
      <div class="stat green"><div class="label">已掌握</div><div class="num">${grad} <small>${pct}%</small></div></div>
      <div class="stat accent"><div class="label">今日待复习</div><div class="num">${due}</div></div>
      <div class="stat red"><div class="label">薄弱词</div><div class="num">${weak}</div></div>
    </div>`
}

/* ===================== 词表展示 ===================== */
function wordListHtml(filter: string): string {
  const f = filter.trim().toLowerCase()
  const list = WORDS.filter((w) => !f || w.word.toLowerCase().includes(f) || w.definition.toLowerCase().includes(f))
  if (!list.length) return '<div class="empty">没有匹配的单词。</div>'
  // 按首字母分组
  const groups = new Map<string, DegreeWord[]>()
  for (const w of list) {
    const k = (w.word[0] ?? '#').toUpperCase()
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(w)
  }
  let html = ''
  for (const [k, arr] of [...groups.entries()].sort()) {
    html += `<div class="wl-group"><div class="wl-letter">${esc(k)}</div>`
    for (const w of arr) {
      const p = PROG[w.word]
      const tag = p?.status === 'graduated' ? '<span class="tag green">已掌握</span>' : p?.weak ? '<span class="tag red">薄弱</span>' : p && p.status === 'learning' ? '<span class="tag">复习中</span>' : '<span class="tag ink">新词</span>'
      html += `<div class="wl-item">
        <div class="wl-main"><div class="wl-word">${esc(w.word)} <span class="wl-ph">${esc(w.phonetic)}</span></div>
        <div class="wl-def">${esc(w.pos ? w.pos + ' ' : '')}${esc(w.definition)}</div></div>
        <div class="wl-tag">${tag}</div>
      </div>`
    }
    html += '</div>'
  }
  return html
}

/* ===================== 对话练习渲染 ===================== */
function dialogueHtml(): string {
  const scenes = [...new Set(DIALOGUE_QUESTIONS.map(q => q.scene))]
  const filtered = dlgSceneFilter ? DIALOGUE_QUESTIONS.filter(q => q.scene === dlgSceneFilter) : DIALOGUE_QUESTIONS
  const remaining = filtered.filter(q => !dlgDoneIds.includes(q.id))

  let body = ''
  // 场景筛选栏
  body += `<div class="card" style="margin-bottom:14px;">
    <div class="sec-title">${ICON.chat}完成对话练习（模拟试卷 Part I · 10题/10分）</div>
    <p class="muted">基于大纲「附录八 常用口语表达用语」27个场景366句真实素材。选择正确应答补全对话。</p>
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;">
      <button class="de-tab ${!dlgSceneFilter?'active':''}" data-act="dlgScene" data-scene="">全部 (${DIALOGUE_QUESTIONS.length})</button>
      ${scenes.map(s => `<button class="de-tab ${dlgSceneFilter===s?'active':''}" data-act="dlgScene" data-scene="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <div class="row" style="justify-content:space-between;align-items:center;">
      <span class="muted">得分：${dlgScore}/${dlgTotal} · 错题：${dlgWrongIds.length} · 剩余：${remaining.length}</span>
      ${dlgWrongIds.length > 0 ? `<button class="btn btn-sm" id="dlgRetryWrong" data-act="dlgRetryWrong">${ICON.speaker}重做错题</button>` : ''}
      ${dlgDoneIds.length > 0 ? `<button class="btn btn-sm" id="dlgReset" data-act="dlgReset">${ICON.home}重置进度</button>` : ''}
    </div>
  </div>`

  if (dlgCurrentQ) {
    // 当前题目
    const lines = dlgCurrentQ.context.split('\n')
    const blankLineIdx = dlgCurrentQ.blankIndex - 1
    const ctxHtml = lines.map((line, i) => {
      if (i === blankLineIdx) {
        return `<div class="dlg-line dlg-blank">${esc(line.replace('______', '<span class="blank-mark">______</span>'))}</div>`
      }
      return `<div class="dlg-line">${esc(line)}</div>`
    }).join('')
    const opts = dlgCurrentQ.options.map((o, i) => {
      let cls = 'dlg-opt'
      if (dlgSelectedOpt >= 0) {
        if (i === dlgSelectedOpt) cls += o.correct ? ' correct' : ' wrong'
        if (o.correct && i !== dlgSelectedOpt) cls += ' show-correct'
      }
      return `<button class="${cls}" data-act="dlgAnswer" data-idx="${i}">
        <span class="dlg-opt-label">${o.label}</span>
        <span class="dlg-opt-text">${esc(o.text)}</span>
      </button>`
    }).join('')
    const showExp = dlgSelectedOpt >= 0 ? `<div class="dlg-exp">${ICON.book}<span>${esc(dlgCurrentQ.explanation)}</span></div>` : ''

    body += `<div class="card">
      <div class="dlg-badge">${esc(dlgCurrentQ.scene)} ${dlgCurrentQ.sceneIcon} 第${dlgCurrentQ.id}题</div>
      <div class="dlg-context">${ctxHtml}</div>
      <div class="dlg-opts">${opts}</div>
      ${showExp}
      ${dlgSelectedOpt >= 0 ? `<button class="btn btn-primary btn-block" id="dlgNext" data-act="dlgNext">${dlgTotal >= filtered.length ? ICON.check+'完成练习' : ICON.list+'下一题'}</button>` : ''}
    </div>`
  } else if (remaining.length === 0 && dlgTotal > 0) {
    // 全部做完
    const pct = dlgTotal > 0 ? Math.round((dlgScore / dlgTotal) * 100) : 0
    body += `<div class="card" style="text-align:center;padding:30px;">
      <h2>${ICON.check} 对话练习完成！</h2>
      <p>得分：<b>${dlgScore}/${dlgTotal}</b>（${pct}%）· 错题 ${dlgWrongIds.length} 道</p>
      ${dlgWrongIds.length > 0 ? `<button class="btn btn-primary" id="dlgRetryWrong2" data-act="dlgRetryWrong">${ICON.speaker}重做错题</button>` : ''}
      <button class="btn" id="dlgReset2" data-act="dlgReset" style="margin-left:8px;">${ICON.home}重新开始</button>
    </div>`
  } else {
    // 开始/继续
    body += `<div class="card" style="text-align:center;padding:24px;">
      <p class="muted">共 ${filtered.length} 道题待练习</p>
      <button class="btn btn-primary" id="dlgStart" data-act="dlgStart">${ICON.book}开始练习</button>
    </div>`
  }

  return body
}

/* ===================== 语法练习渲染 ===================== */
function grammarHtml(): string {
  const cats = [...new Set(GRAMMAR_QUESTIONS.map(q => q.category))]
  const filtered = gramCatFilter ? GRAMMAR_QUESTIONS.filter(q => q.category === gramCatFilter) : GRAMMAR_QUESTIONS

  let body = ''
  body += `<div class="card" style="margin-bottom:14px;">
    <div class="sec-title">${ICON.pen}词汇与语法选择题（模拟试卷 Part III · 约20分）</div>
    <p class="muted">基于大纲附录四（不规则动词表）+ 高频语法考点。选择最佳答案。</p>
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;">
      <button class="de-tab ${!gramCatFilter?'active':''}" data-act="gramCat" data-cat="">全部 (${GRAMMAR_QUESTIONS.length})</button>
      ${cats.map(c => `<button class="de-tab ${gramCatFilter===c?'active':''}" data-act="gramCat" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div class="row" style="justify-content:space-between;align-items:center;">
      <span class="muted">得分：${gramScore}/${gramTotal} · 错题：${gramWrongIds.length}</span>
      ${gramWrongIds.length > 0 ? `<button class="btn btn-sm" id="gramRetryWrong" data-act="gramRetryWrong">${ICON.speaker}重做错题</button>` : ''}
      ${gramTotal > 0 ? `<button class="btn btn-sm" id="gramReset" data-act="gramReset">${ICON.home}重置</button>` : ''}
    </div>
  </div>`

  if (gramCurrentQ) {
    const gq = gramCurrentQ
    const opts = gq.options.map((o, i) => {
      let cls = 'dlg-opt'
      if (gramSelectedOpt >= 0) {
        if (i === gramSelectedOpt) cls += i === gq.answer ? ' correct' : ' wrong'
        if (i === gq.answer && i !== gramSelectedOpt) cls += ' show-correct'
      }
      return `<button class="${cls}" data-act="gramAnswer" data-idx="${i}">
        <span class="dlg-opt-label">${o.label}</span>
        <span class="dlg-opt-text">${esc(o.text)}</span>
      </button>`
    }).join('')
    const showExp = gramSelectedOpt >= 0 ? `<div class="dlg-exp">${ICON.book}<span>${esc(gq.explanation)}</span></div>` : ''

    body += `<div class="card">
      <div class="dlg-badge">${esc(gramCurrentQ.category)} 第${gramCurrentQ.id}题</div>
      <div class="gram-q">${esc(gramCurrentQ.question)}</div>
      <div class="dlg-opts">${opts}</div>
      ${showExp}
      ${gramSelectedOpt >= 0 ? `<button class="btn btn-primary btn-block" id="gramNext" data-act="gramNext">${ICON.list}下一题</button>` : ''}
    </div>`
  } else if (gramTotal > 0 && gramTotal >= filtered.length) {
    const pct = gramTotal > 0 ? Math.round((gramScore / gramTotal) * 100) : 0
    body += `<div class="card" style="text-align:center;padding:30px;">
      <h2>${ICON.check} 语法练习完成！</h2>
      <p>得分：<b>${gramScore}/${gramTotal}</b>（${pct}%）· 错题 ${gramWrongIds.length} 道</p>
      ${gramWrongIds.length > 0 ? `<button class="btn btn-primary" id="gramRetryWrong2" data-act="gramRetryWrong">${ICON.speaker}重做错题</button>` : ''}
      <button class="btn" id="gramReset2" data-act="gramReset" style="margin-left:8px;">${ICON.home}重新开始</button>
    </div>`
  } else {
    body += `<div class="card" style="text-align:center;padding:24px;">
      <p class="muted">共 ${filtered.length} 道题待练习</p>
      <button class="btn btn-primary" id="gramStart" data-act="gramStart">${ICON.pen}开始练习</button>
    </div>`
  }

  return body
}

/* ===================== 计时工具 ===================== */
function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
function startRdTimer() {
  rdSeconds = 0
  if (rdTimer !== null) clearInterval(rdTimer)
  rdTimer = window.setInterval(() => {
    rdSeconds++
    const el = document.querySelector('#rdTimer')
    if (el) el.textContent = fmtTime(rdSeconds)
  }, 1000)
}
function stopRdTimer() {
  if (rdTimer !== null) {
    clearInterval(rdTimer)
    rdTimer = null
  }
}

/* ===================== 阅读理解渲染 ===================== */
function readingHtml(): string {
  const filtered = rdTopicFilter ? READING_PASSAGES.filter(p => p.topic === rdTopicFilter) : READING_PASSAGES
  const doneCount = filtered.filter(p => rdDonePassages.has(p.id)).length

  let body = ''
  body += `<div class="card" style="margin-bottom:14px;">
    <div class="sec-title">${ICON.doc}阅读理解（模拟试卷 Part II · 4篇×5题=40分）</div>
    <p class="muted">题材符合大纲要求，建议速度 80 词/分钟。逐题选择、即时看解析。</p>
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;">
      <button class="de-tab ${!rdTopicFilter ? 'active' : ''}" data-act="rdTopic" data-topic="">全部 (${READING_PASSAGES.length})</button>
      ${READING_TOPICS.map(t => `<button class="de-tab ${rdTopicFilter === t ? 'active' : ''}" data-act="rdTopic" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>
    <div class="row" style="justify-content:space-between;align-items:center;">
      <span class="muted">已练 ${doneCount}/${filtered.length} 篇 · 总分 ${rdScore}/${rdTotal} · 错题 ${rdWrongIds.length} · 计时 <b id="rdTimer">${rdTimer !== null ? fmtTime(rdSeconds) : '00:00'}</b></span>
      <div style="display:flex;gap:8px;">
        ${rdWrongIds.length > 0 ? `<button class="btn btn-sm" data-act="rdRetryWrong">${ICON.speaker}重做错题</button>` : ''}
        ${rdTotal > 0 ? `<button class="btn btn-sm" data-act="rdReset">${ICON.home}重置</button>` : ''}
      </div>
    </div>
  </div>`

  if (rdCurrentPassage) {
    const p = rdCurrentPassage
    const q = p.questions[rdQIdx]
    if (!q) { body += `<div class="empty">题目加载出错。</div>`; return body }
    const passageHtml = rdShowPassage
      ? `<div class="rd-passage">${esc(p.passage).split('\n\n').map(par => `<p>${par.replace(/\n/g, '<br>')}</p>`).join('')}</div>`
      : ''
    const qOpts = q.options.map((o, i) => {
      let cls = 'dlg-opt'
      if (rdSelectedOpt >= 0) {
        if (i === rdSelectedOpt) cls += i === q.answer ? ' correct' : ' wrong'
        if (i === q.answer && i !== rdSelectedOpt) cls += ' show-correct'
      }
      return `<button class="${cls}" data-act="rdAnswer" data-idx="${i}">
        <span class="dlg-opt-label">${o.label}</span>
        <span class="dlg-opt-text">${esc(o.text)}</span>
      </button>`
    }).join('')
    const exp = rdSelectedOpt >= 0 ? `<div class="dlg-exp">${ICON.book}<span>${esc(q.explanation)}</span></div>` : ''
    const last = rdQIdx >= p.questions.length - 1
    body += `<div class="card">
      <div class="dlg-badge">${esc(p.topic)} · ${esc(p.title)} · ${p.words}词/${p.minutes}分</div>
      <button class="btn btn-sm" data-act="rdTogglePassage">${rdShowPassage ? '收起文章' : '展开文章'}</button>
      ${passageHtml}
      <div class="rd-qmeta">第 ${rdQIdx + 1}/${p.questions.length} 题 · ${esc(q.type)}</div>
      <div class="gram-q">${esc(q.question)}</div>
      <div class="dlg-opts">${qOpts}</div>
      ${exp}
      ${rdSelectedOpt >= 0 ? `<button class="btn btn-primary btn-block" data-act="rdNext">${last ? ICON.check + '完成本篇' : ICON.list + '下一题'}</button>` : ''}
    </div>`
  } else if (rdTotal > 0 && doneCount >= filtered.length) {
    const pct = rdTotal > 0 ? Math.round((rdScore / rdTotal) * 100) : 0
    body += `<div class="card" style="text-align:center;padding:30px;">
      <h2>${ICON.check} 阅读理解练习完成！</h2>
      <p>总得分：<b>${rdScore}/${rdTotal}</b>（${pct}%）· 错题 ${rdWrongIds.length} 道</p>
      ${rdWrongIds.length > 0 ? `<button class="btn btn-primary" data-act="rdRetryWrong">${ICON.speaker}重做错题</button>` : ''}
      <button class="btn" data-act="rdReset" style="margin-left:8px;">${ICON.home}重新开始</button>
    </div>`
  } else {
    body += `<div class="card" style="text-align:center;padding:24px;">
      <p class="muted">共 ${filtered.length} 篇待练习</p>
      <button class="btn btn-primary" data-act="rdStart">${ICON.doc}开始练习</button>
    </div>`
  }
  return body
}

/* ===================== 翻译写作渲染 ===================== */
function translateHtml(): string {
  let body = ''
  body += `<div class="de-tabs" style="margin:0 0 14px;">
    <button class="de-tab ${trSubTab === 'translate' ? 'active' : ''}" data-act="trSub" data-sub="translate">${ICON.file}英译汉</button>
    <button class="de-tab ${trSubTab === 'writing' ? 'active' : ''}" data-act="trSub" data-sub="writing">${ICON.pen}写作模板</button>
  </div>`

  if (trSubTab === 'translate') {
    const items = TRANSLATION_ITEMS
    const cur = items[trIdx] ?? items[0]
    const total = items.length
    const doneCount = trDoneIds.length
    const marked = cur ? trDoneIds.includes(cur.id) : false
    body += `<div class="card">
      <div class="sec-title">${ICON.file}英译汉练习（试卷二 · 15分）</div>
      <div class="row" style="justify-content:space-between;align-items:center;margin:8px 0 14px;">
        <span class="muted">进度 ${trIdx + 1}/${total} · 已练 ${doneCount}/${total}</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm" data-act="trPrev" ${trIdx === 0 ? 'disabled' : ''}>${ICON.list}上一句</button>
          <button class="btn btn-sm" data-act="trNext" ${trIdx === total - 1 ? 'disabled' : ''}>下一句${ICON.list}</button>
        </div>
      </div>
      <div class="tr-en">${cur ? esc(cur.en) : ''}</div>
      <div class="row" style="margin:12px 0;">
        <button class="btn ${trShowRef ? '' : 'btn-primary'}" data-act="trToggleRef">${ICON.book}${trShowRef ? '隐藏参考译文' : '显示参考译文'}</button>
        <button class="btn ${marked ? 'btn-primary' : ''}" data-act="trMark">${marked ? ICON.check + '已练习' : '标记为已练习'}</button>
      </div>
      ${trShowRef && cur ? `<div class="tr-ref">
        <div class="tr-zh"><b>参考译文：</b>${esc(cur.zh)}</div>
        <div class="tr-tips"><b>翻译要点：</b>${esc(cur.tips)}</div>
      </div>` : ''}
    </div>`
  } else {
    const types = WRITING_TYPES
    const filtered = wrTypeFilter ? WRITING_TEMPLATES.filter(t => t.type === wrTypeFilter) : WRITING_TEMPLATES
    body += `<div class="card" style="margin-bottom:14px;">
      <div class="sec-title">${ICON.pen}短文写作模板（试卷二 · 15分）</div>
      <p class="muted">应用文与议论文的结构、常用句型与范文。点击模板查看详情。</p>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin:12px 0;">
        <button class="de-tab ${!wrTypeFilter ? 'active' : ''}" data-act="wrType" data-type="">全部 (${WRITING_TEMPLATES.length})</button>
        ${types.map(t => `<button class="de-tab ${wrTypeFilter === t ? 'active' : ''}" data-act="wrType" data-type="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>`
    if (wrCurrentTpl) {
      const t = wrCurrentTpl
      body += `<div class="card">
        <div class="dlg-badge">${esc(t.type)} · ${esc(t.title)}</div>
        <div class="rd-qmeta">题目要求：${esc(t.prompt)}</div>
        <div class="wr-sec"><b>结构要点</b><ul class="ph-list">${t.structure.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
        <div class="wr-sec"><b>常用句型</b><ul class="ph-list">${t.phrases.map(p => `<li>${esc(p.en)} — ${esc(p.zh)}</li>`).join('')}</ul></div>
        <div class="wr-sec"><b>范文</b><pre class="wr-sample">${esc(t.sample)}</pre>
          <button class="btn btn-sm" data-act="wrCopy">${ICON.file}复制范文</button>
        </div>
        <div class="wr-sec"><b>评分要点</b><div class="muted">${esc(t.tips)}</div></div>
        <button class="btn btn-sm" data-act="wrClose">收起</button>
      </div>`
    } else {
      body += `<div class="card"><div class="row" style="flex-direction:column;gap:10px;align-items:stretch;">
        ${filtered.map(t => `<button class="btn btn-block" data-act="wrOpen" data-id="${t.id}">${ICON.doc}${esc(t.title)}</button>`).join('')}
      </div></div>`
    }
  }
  return body
}

/* ===================== 阅读练习逻辑 ===================== */
function firstUndonePassage(list: ReadingPassage[]): ReadingPassage | null {
  return list.find(p => !rdDonePassages.has(p.id)) ?? null
}
function startReading() {
  const filtered = rdTopicFilter ? READING_PASSAGES.filter(p => p.topic === rdTopicFilter) : READING_PASSAGES
  const p = firstUndonePassage(filtered)
  if (!p) { alert('该分类下没有更多篇目了！'); return }
  rdCurrentPassage = p
  rdQIdx = 0
  rdSelectedOpt = -1
  startRdTimer()
  render()
}
function answerReading(idx: number) {
  if (rdSelectedOpt >= 0 || !rdCurrentPassage) return
  const q = rdCurrentPassage.questions[rdQIdx]
  if (!q) return
  rdSelectedOpt = idx
  rdTotal++
  if (idx === q.answer) rdScore++
  else {
    const key = `${rdCurrentPassage.id}-${q.id}`
    if (!rdWrongIds.includes(key)) rdWrongIds.push(key)
  }
  render()
}
function nextReading() {
  if (!rdCurrentPassage) return
  const p = rdCurrentPassage
  if (rdQIdx < p.questions.length - 1) {
    rdQIdx++
    rdSelectedOpt = -1
    render()
    return
  }
  // 本篇完成
  rdDonePassages.add(p.id)
  const filtered = rdTopicFilter ? READING_PASSAGES.filter(x => x.topic === rdTopicFilter) : READING_PASSAGES
  const nxt = firstUndonePassage(filtered)
  if (nxt) {
    rdCurrentPassage = nxt
    rdQIdx = 0
    rdSelectedOpt = -1
    startRdTimer()
  } else {
    rdCurrentPassage = null
    rdSelectedOpt = -1
    stopRdTimer()
  }
  render()
}
function retryWrongReading() {
  if (rdWrongIds.length === 0) return
  const firstKey = rdWrongIds[0] ?? ''
  const pid = parseInt(firstKey.split('-')[0] || '-1', 10)
  const p = READING_PASSAGES.find(x => x.id === pid) ?? firstUndonePassage(READING_PASSAGES)
  if (!p) return
  rdCurrentPassage = p
  rdQIdx = 0
  rdSelectedOpt = -1
  startRdTimer()
  render()
}
function resetReading() {
  rdCurrentPassage = null
  rdQIdx = 0
  rdSelectedOpt = -1
  rdScore = 0
  rdTotal = 0
  rdWrongIds = []
  rdDonePassages = new Set()
  stopRdTimer()
  render()
}
function togglePassage() {
  rdShowPassage = !rdShowPassage
  render()
}

/* ===================== 翻译写作逻辑 ===================== */
function trGo(delta: number) {
  const total = TRANSLATION_ITEMS.length
  trIdx = Math.max(0, Math.min(total - 1, trIdx + delta))
  trShowRef = false
  render()
}
function trToggleRef() {
  trShowRef = !trShowRef
  render()
}
function trMark() {
  const cur = TRANSLATION_ITEMS[trIdx]
  if (!cur) return
  if (!trDoneIds.includes(cur.id)) trDoneIds.push(cur.id)
  render()
}
function wrFilter(type: string) {
  wrTypeFilter = type
  wrCurrentTpl = null
  render()
}
function wrOpen(id: number) {
  wrCurrentTpl = WRITING_TEMPLATES.find(t => t.id === id) ?? null
  render()
}
function wrClose() {
  wrCurrentTpl = null
  render()
}
function wrCopy() {
  if (!wrCurrentTpl) return
  const text = wrCurrentTpl.sample
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
      alert('范文已复制到剪贴板。')
    } else {
      alert('当前环境不支持自动复制，请手动选择范文文本复制。')
    }
  } catch {
    alert('复制失败，请手动选择范文文本复制。')
  }
}

/* ===================== 渲染 ===================== */
function render() {
  if (!rootEl) return
  if (activeTab !== 'reading' && rdTimer !== null) {
    stopRdTimer()
    const t = document.querySelector('#rdTimer')
    if (t) t.textContent = '00:00'
  }
  const tabs = [
    { k: 'vocab', label: '背词', icon: ICON.book },
    { k: 'dialogue', label: '对话练习', icon: ICON.chat },
    { k: 'reading', label: '阅读理解', icon: ICON.doc },
    { k: 'grammar', label: '词汇语法', icon: ICON.pen },
    { k: 'translate', label: '翻译写作', icon: ICON.file }
  ]
  const tabHtml = tabs
    .map(
      (t) =>
        `<button class="de-tab ${activeTab === t.k ? 'active' : ''}" data-act="tab" data-tab="${t.k}">${t.icon}${t.label}</button>`
    )
    .join('')

  let body = ''
  if (activeTab === 'vocab') {
    const importInfo = (() => {
      try {
        const raw = localStorage.getItem(KI)
        if (raw) {
          const d = JSON.parse(raw) as { ts: number; count: number }
          return `<div class="note">${ICON.upload}<span>已于 ${new Date(d.ts).toLocaleString('zh-CN')} 从 PDF 导入 ${d.count} 个词条。</span></div>`
        }
      } catch {}
      return ''
    })()
    body = `
      <div class="page-head">
        <div class="page-title">学位英语 · 词汇背记</div>
        <div class="page-sub">上传《大纲》PDF 自动 OCR 抽取完整词表（约 3500 词），用间隔复习高效记忆。</div>
      </div>
      ${statsHtml()}
      <div class="handle">
        <div class="h-item">${ICON.file}词库 ${WORDS.length} 词</div>
        <button class="btn btn-primary" id="deStart">${ICON.book}开始背词</button>
        <button class="btn" id="deUpload">${ICON.upload}上传PDF导入词库</button>
        <input type="file" id="dePdf" accept=".pdf,application/pdf" style="display:none;">
      </div>
      <div id="deMsg" class="muted" style="margin:10px 0;"></div>
      ${importInfo}
      <div class="card">
        <div class="sec-title">${ICON.list}词表浏览</div>
        <div class="row" style="align-items:center;margin-bottom:12px;">
          <input class="input" id="deSearch" placeholder="搜索单词或释义…" style="flex:1;">
        </div>
        <div id="deWordList">${wordListHtml('')}</div>
      </div>`
  } else if (activeTab === 'dialogue') {
    body = dialogueHtml()
  } else if (activeTab === 'reading') {
    body = readingHtml()
  } else if (activeTab === 'grammar') {
    body = grammarHtml()
  } else {
    body = translateHtml()
  }

  rootEl.innerHTML = `
    <div class="de-header">
      <div class="de-title">${ICON.book} 学位英语备考台</div>
      <div class="de-exam">考试结构：完成对话10′ · 阅读40′ · 词汇语法20′ · 英译汉15′ · 写作15′ = 100分/120分钟</div>
    </div>
    <nav class="de-tabs">${tabHtml}</nav>
    <div class="de-content">${body}</div>
    <div class="focus" id="deFocus">
      <div class="focus-top">
        <div class="focus-progress" id="deFocusProgress"></div>
        <button class="btn btn-ghost btn-sm" id="deFocusClose">退出</button>
      </div>
      <div class="focus-card" id="deFocusCard"></div>
    </div>`
}

/* ===================== OCR 导入 ===================== */
async function handlePdf(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  const msg = document.querySelector('#deMsg') as HTMLElement | null
  if (ocrRunning) return
  ocrRunning = true
  if (msg) msg.textContent = '正在解析 PDF（逐页 OCR，请稍候，大文件可能需数分钟）…'
  try {
    const buf = await f.arrayBuffer()
    // 动态导入 pdfjs-dist（避免模块顶层初始化崩溃）
    const pdfjsLib = await import('pdfjs-dist')
    const PdfWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker.default
    const doc = await pdfjsLib.getDocument({ data: buf }).promise
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const vp = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(vp.width)
      canvas.height = Math.floor(vp.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise
      // 动态导入 tesseract.js（避免模块顶层初始化崩溃）
      const { default: Tesseract } = await import('tesseract.js')
      const { data } = await Tesseract.recognize(canvas, 'eng+chi_sim')
      text += data.text + '\n'
      if (msg) msg.textContent = `OCR 进度 ${i} / ${doc.numPages}…`
    }
    const rows = parseDegreeWords(text)
    if (!rows.length) {
      if (msg) msg.textContent = '未从 PDF 识别到单词，请确认 PDF 含「单词 + 音标 + 释义」排版。'
      return
    }
    const added = rows.length
    if (confirm(`从 PDF 解析到 ${added} 个单词，确认导入词库（与现有词去重合并）？`)) {
      mergeWords(rows)
      if (msg) msg.textContent = `成功导入 ${added} 个词条到词库。`
      render()
    } else if (msg) {
      msg.textContent = '已取消导入。'
    }
  } catch (err: any) {
    if (msg) msg.textContent = 'PDF 解析失败：' + (err?.message || err)
  } finally {
    input.value = ''
    ocrRunning = false
  }
}

/* ===================== 对话练习逻辑 ===================== */
function startDialogue() {
  const filtered = dlgSceneFilter ? DIALOGUE_QUESTIONS.filter(q => q.scene === dlgSceneFilter) : DIALOGUE_QUESTIONS
  const remaining = filtered.filter(q => !dlgDoneIds.includes(q.id))
  if (remaining.length === 0) { alert('该分类下没有更多题目了！'); return }
  dlgCurrentQ = remaining[0] ?? null
  dlgSelectedOpt = -1
  render()
}
function answerDialogue(idx: number) {
  if (dlgSelectedOpt >= 0 || !dlgCurrentQ) return
  dlgSelectedOpt = idx
  dlgTotal++
  const q = dlgCurrentQ
  const isCorrect = q.options[idx]?.correct ?? false
  if (isCorrect) dlgScore++
  else { if (!dlgWrongIds.includes(q.id)) dlgWrongIds.push(q.id) }
  if (!dlgDoneIds.includes(q.id)) dlgDoneIds.push(q.id)
  render()
}
function nextDialogue() {
  if (!dlgCurrentQ) return
  const filtered = dlgSceneFilter ? DIALOGUE_QUESTIONS.filter(q => q.scene === dlgSceneFilter) : DIALOGUE_QUESTIONS
  const remaining = filtered.filter(q => !dlgDoneIds.includes(q.id))
  if (remaining.length === 0) { dlgCurrentQ = null; render(); return }
  dlgCurrentQ = remaining[0] ?? null
  dlgSelectedOpt = -1
  render()
}
function retryWrongDlg() {
  if (dlgWrongIds.length === 0) return
  const wrongQs = DIALOGUE_QUESTIONS.filter(q => dlgWrongIds.includes(q.id))
  if (wrongQs.length === 0) return
  dlgCurrentQ = wrongQs[0] ?? null
  dlgSelectedOpt = -1
  // 不清零分数，只重做错题
  render()
}
function resetDialogue() {
  dlgSceneFilter = ''
  dlgCurrentQ = null
  dlgSelectedOpt = -1
  dlgScore = 0; dlgTotal = 0
  dlgWrongIds = []; dlgDoneIds = []
  render()
}

/* ===================== 语法练习逻辑 ===================== */
function startGrammar() {
  const filtered = gramCatFilter ? GRAMMAR_QUESTIONS.filter(q => q.category === gramCatFilter) : GRAMMAR_QUESTIONS
  // 简单顺序出题（未做过的优先）
  const remaining = filtered.filter(q => !gramWrongIds.includes(q.id) || gramWrongIds.indexOf(q.id) >= gramWrongIds.length - 3)
  if (!remaining.length) { alert('没有更多题目了'); return }
  gramCurrentQ = remaining[0] ?? null
  gramSelectedOpt = -1
  render()
}
function answerGrammar(idx: number) {
  if (gramSelectedOpt >= 0 || !gramCurrentQ) return
  gramSelectedOpt = idx
  gramTotal++
  if (idx === gramCurrentQ.answer) gramScore++
  else { if (!gramWrongIds.includes(gramCurrentQ.id)) gramWrongIds.push(gramCurrentQ.id) }
  render()
}
function nextGrammar() {
  if (!gramCurrentQ) return
  const filtered = gramCatFilter ? GRAMMAR_QUESTIONS.filter(q => q.category === gramCatFilter) : GRAMMAR_QUESTIONS
  // 取下一道未做过的题
  const doneSet = new Set([...gramWrongIds])
  const next = filtered.find(q => !doneSet.has(q.id))
  if (next) { gramCurrentQ = next; gramSelectedOpt = -1 }
  else { gramCurrentQ = null }
  render()
}
function retryWrongGram() {
  if (gramWrongIds.length === 0) return
  const wrongQs = GRAMMAR_QUESTIONS.filter(q => gramWrongIds.includes(q.id))
  if (!wrongQs.length) return
  gramCurrentQ = wrongQs[0] ?? null
  gramSelectedOpt = -1
  render()
}
function resetGrammar() {
  gramCatFilter = ''
  gramCurrentQ = null
  gramSelectedOpt = -1
  gramScore = 0; gramTotal = 0
  gramWrongIds = []
  render()
}

/* ===================== 事件 ===================== */
function onRootClick(e: Event) {
  const t = e.target as HTMLElement
  // 标签页切换（带 data-act="tab"）
  const tabEl = t.closest('[data-act="tab"]') as HTMLElement | null
  if (tabEl) {
    activeTab = tabEl.dataset.tab || 'vocab'
    render()
    return
  }
  // 其余动作按钮（按 button id 委派，兼容内部 svg 图标作为点击目标）
  const btn = t.closest('button') as HTMLButtonElement | null
  const id = btn?.id
  const actEl = t.closest('[data-act]') as HTMLElement | null
  if (id === 'deStart') startFocus()
  else if (id === 'deUpload') (document.querySelector('#dePdf') as HTMLInputElement | null)?.click()
  else if (id === 'deFocusClose') closeFocus()

  // 对话练习事件
  const da = actEl?.dataset.act
  if (da === 'dlgScene') { dlgSceneFilter = actEl?.dataset.scene || ''; dlgCurrentQ = null; render(); return }
  if ((da === 'dlgStart' || id === 'dlgStart')) { startDialogue(); return }
  if (da === 'dlgAnswer') { answerDialogue(parseInt(actEl?.dataset.idx || '-1')); return }
  if ((da === 'dlgNext' || id === 'dlgNext')) { nextDialogue(); return }
  if (/^dlgRetryWrong/.test(da || id || '')) { retryWrongDlg(); return }
  if (/^dlgReset/.test(da || id || '')) { resetDialogue(); return }

  // 语法练习事件
  if (da === 'gramCat') { gramCatFilter = actEl?.dataset.cat || ''; gramCurrentQ = null; render(); return }
  if ((da === 'gramStart' || id === 'gramStart')) { startGrammar(); return }
  if (da === 'gramAnswer') { answerGrammar(parseInt(actEl?.dataset.idx || '-1')); return }
  if ((da === 'gramNext' || id === 'gramNext')) { nextGrammar(); return }
  if (/^gramRetryWrong/.test(da || id || '')) { retryWrongGram(); return }
  if (/^gramReset/.test(da || id || '')) { resetGrammar(); return }

  // 阅读练习事件
  if (da === 'rdTopic') { rdTopicFilter = actEl?.dataset.topic || ''; rdCurrentPassage = null; render(); return }
  if (da === 'rdStart') { startReading(); return }
  if (da === 'rdAnswer') { answerReading(parseInt(actEl?.dataset.idx || '-1', 10)); return }
  if (da === 'rdNext') { nextReading(); return }
  if (da === 'rdTogglePassage') { togglePassage(); return }
  if (/^rdRetryWrong/.test(da || id || '')) { retryWrongReading(); return }
  if (/^rdReset/.test(da || id || '')) { resetReading(); return }

  // 翻译写作事件
  if (da === 'trSub') { trSubTab = (actEl?.dataset.sub as 'translate' | 'writing') || 'translate'; render(); return }
  if (da === 'trPrev') { trGo(-1); return }
  if (da === 'trNext') { trGo(1); return }
  if (da === 'trToggleRef') { trToggleRef(); return }
  if (da === 'trMark') { trMark(); return }
  if (da === 'wrType') { wrFilter(actEl?.dataset.type || ''); return }
  if (da === 'wrOpen') { wrOpen(parseInt(actEl?.dataset.id || '-1', 10)); return }
  if (da === 'wrClose') { wrClose(); return }
  if (da === 'wrCopy') { wrCopy(); return }
}
function onRootChange(e: Event) {
  const t = e.target as HTMLElement
  if (t.id === 'dePdf') handlePdf(e)
  else if (t.id === 'deSearch') {
    const el = document.querySelector('#deWordList')
    if (el) el.innerHTML = wordListHtml((t as HTMLInputElement).value)
  }
}

/* ===================== 入口 ===================== */
export async function initDegreePrep(el: HTMLElement): Promise<() => void> {
  rootEl = el
  WORDS = loadWords()
  PROG = loadProg()
  SET = loadSettings()
  render()
  el.addEventListener('click', onRootClick)
  el.addEventListener('change', onRootChange)
  return () => {
    el.removeEventListener('click', onRootClick)
    el.removeEventListener('change', onRootChange)
  }
}

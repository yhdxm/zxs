// 四六级备考台 · 核心逻辑（与 UI 渲染、算法），存储层由外部注入的 Supabase 适配器提供。
// 该模块以「挂载到指定根元素」的方式运行：CetPrepView.vue 在 onMounted 调用 initPrep(root, storage)。
// 移植自 public/cet-prep.html，所有 localStorage 读写已替换为 storage.* 异步调用。
import {
  type PrepWord,
  type WordProgress,
  type PracticeRec,
  type MistakeRec,
  type CheckinRec,
  type PrepSettings,
  type PrepState,
  newId
} from '../services/cetPrepService'
import { MASTER_WORDS_BUNDLE } from './masterWordsBundle'
import { speakEn } from '../prep/degreeSpeech'
import { getEmoji } from '../data/emojiDict'

export interface PrepStorage {
  fetchMasterWords(): Promise<PrepWord[]>
  loadAll(): Promise<PrepState>
  persistProgress(word: string, st: WordProgress): Promise<void>
  persistPractice(rec: PracticeRec): Promise<void>
  removePractice(id: string): Promise<void>
  persistMistake(rec: MistakeRec): Promise<void>
  removeMistake(id: string): Promise<void>
  persistCheckin(date: string, c: CheckinRec): Promise<void>
  persistSettings(s: PrepSettings): Promise<void>
  replaceAll(state: {
    words: Record<string, WordProgress>
    practice: PracticeRec[]
    mistakes: MistakeRec[]
    checkins: Record<string, CheckinRec>
    settings: PrepSettings
  }): Promise<void>
  clearSampleData(): Promise<void>
  isAdmin(): Promise<boolean>
  seedMasterWords(rows: PrepWord[]): Promise<number>
}

// 持久化失败时静默兜底（UI 以内存 S 为准，DB 仅做备份同步）
function p(pr: Promise<unknown>) {
  pr.catch((e) => console.error('[cetPrep] persist failed', e))
}

/* ===================== 常量 ===================== */
const SRS = [1, 2, 4, 7, 15, 30] as const // 背词复习间隔
const MIS = [1, 3, 7, 15, 30] as const // 错题复习间隔
const TYPES = [
  { key: 'listening', label: '听力' },
  { key: 'reading', label: '阅读' },
  { key: 'writing', label: '写作' },
  { key: 'translate', label: '翻译' }
]

// 主词表来自数据库；库为空/拉取失败时回退到内置全量词库（src/prep/masterWordsBundle.ts，4544 词）。
// 确保任何部署/设备都至少有完整四级词库，绝不再退回 97 个演示词。用户学习进度仍存 Supabase 数据库。
let MASTER: PrepWord[] = []

/* ===================== 状态 ===================== */
interface PrepS {
  newPerDay: number
  examDate: string
  manualStreak: number | null
  words: Record<string, WordProgress>
  practice: PracticeRec[]
  mistakes: MistakeRec[]
  checkins: Record<string, CheckinRec>
  linkedGoal: string | null
  dayMark: string | null
  dayPlan: number
}
let S: PrepS = defaults()
let storage: PrepStorage
let IS_ADMIN = false
let USING_FALLBACK_MASTER = false

function defaults() {
  const y = new Date().getFullYear()
  return {
    newPerDay: 10,
    examDate: thirdSatOfNov(y),
    manualStreak: null,
    words: {},
    practice: [],
    mistakes: [],
    checkins: {},
    linkedGoal: null,
    dayMark: null,
    dayPlan: 0
  }
}
function settings(): PrepSettings {
  return { newPerDay: S.newPerDay, examDate: S.examDate, manualStreak: S.manualStreak, linkedGoal: S.linkedGoal }
}
function buildFullState() {
  return {
    words: S.words,
    practice: S.practice,
    mistakes: S.mistakes,
    checkins: S.checkins,
    settings: settings()
  }
}

/* ===================== 日期工具 ===================== */
function fmt(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}
function todayStr() {
  return fmt(new Date())
}
function parse(s: string) {
  const p = s.split('-').map(Number)
  return new Date(p[0] || 0, (p[1] || 1) - 1, p[2] || 0)
}
function addDays(s: string, n: number) {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return fmt(d)
}
function diffDays(a: string, b: string) {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000)
}
function thirdSatOfNov(year: number) {
  const sats: number[] = []
  for (let i = 1; i <= 30; i++) {
    const x = new Date(year, 10, i)
    if (x.getDay() === 6) sats.push(i)
  }
  const d = sats[2]
  return year + '-11-' + String(d).padStart(2, '0')
}

/* ===================== 单词状态 ===================== */
function wstate(w: string): WordProgress {
  if (!S.words[w])
    S.words[w] = {
      status: 'new',
      level: 0,
      due: null,
      firstIssued: null,
      wrongStreak: 0,
      wrongStreakDate: null,
      weak: false,
      last: null
    }
  return S.words[w]!
}

/* 构建今日队列：新词(可改数量)+到期复习旧词。昨日未完成新词自动滚入（firstIssued<今日仍为new）。
   注意：本函数为纯计算，不修改 firstIssued，避免 render/stats 等只读调用误发词。 */
function buildQueue() {
  const t = todayStr()
  const reviews: string[] = []
  const rolled: string[] = []
  const fresh: string[] = []
  let newToday = 0
  for (const m of MASTER) {
    const w = m[0]
    const st = wstate(w)
    if (st.status === 'new') {
      if (st.firstIssued && st.firstIssued < t) rolled.push(w)
      else if (st.firstIssued === t) newToday++
      else fresh.push(w)
    } else if (st.status === 'learning' && st.due && st.due <= t) {
      reviews.push(w)
    }
  }
  const quota = Math.max(0, S.newPerDay - newToday)
  const take = fresh.slice(0, quota)
  const q: { w: string; kind: string }[] = []
  take.forEach((w) => q.push({ w, kind: 'new' }))
  rolled.forEach((w) => q.push({ w, kind: 'new' }))
  reviews.forEach((w) => q.push({ w, kind: 'review' }))
  return q
}

/* 真正把队列中的新词标记为今日已发放，并持久化到数据库。仅在用户点击"开始背词"时调用。 */
function issueQueueWords(queue: { w: string; kind: string }[]) {
  const t = todayStr()
  for (const item of queue) {
    if (item.kind !== 'new') continue
    const st = wstate(item.w)
    if (!st.firstIssued) {
      st.firstIssued = t
      p(storage.persistProgress(item.w, st))
    }
  }
}

/* ===================== 打卡 / 连续天数 / 热力 ===================== */
function addCheckin(date: string, kind: 'words' | 'practice') {
  const c = S.checkins[date] || (S.checkins[date] = { words: 0, practice: 0 })
  c[kind]++
  p(storage.persistCheckin(date, c))
}
function todayReviewed() {
  const c = S.checkins[todayStr()]
  return c ? c.words : 0
}
function streak() {
  // 用户手动校准过连续天数时，优先使用手动值
  if (S.manualStreak != null && S.manualStreak >= 0) return S.manualStreak
  let n = 0
  let d = todayStr()
  let c = S.checkins[d]
  while (c && c.words > 0) {
    n++
    d = addDays(d, -1)
    c = S.checkins[d]
  }
  return n
}

/* ===================== 背词复习逻辑 ===================== */
function reviewWord(w: string, known: boolean) {
  const st = wstate(w)
  const t = todayStr()
  st.last = t
  addCheckin(t, 'words')
  if (st.status === 'new') {
    if (known) {
      st.status = 'learning'
      st.level = 0
      st.due = addDays(t, SRS[0])
    } else handleWrong(st, w)
  } else {
    if (known) {
      st.level++
      if (st.level >= SRS.length) {
        st.status = 'graduated'
        st.due = null
        st.weak = false
      } else st.due = addDays(t, SRS[st.level] ?? 30)
    } else handleWrong(st, w)
  }
  p(storage.persistProgress(w, st))
}
function handleWrong(st: WordProgress, w: string) {
  const t = todayStr()
  if (st.wrongStreakDate === t) st.wrongStreak++
  else {
    st.wrongStreak = 1
    st.wrongStreakDate = t
  }
  st.weak = true
  if (st.wrongStreak >= 3) {
    st.due = addDays(t, 1) // 当天连续3次不认识→改到明天
  } else {
    queueArr.push({ w, kind: st.status === 'new' ? 'new' : 'review' }) // 回今日队尾
  }
}

/* ===================== 发音（系统朗读） ===================== */
const CAN_SPEAK = typeof window !== 'undefined' && 'speechSynthesis' in window
function speak(word: string) {
  if (!CAN_SPEAK) return
  // 复用 degreeSpeech.speakEn：选英文 voice + 移动端 AudioContext 解锁 + pause/resume 兜底，
  // 确保手机浏览器（iOS Safari / Android Chrome）能稳定播放英文读音。
  speakEn(word)
}

/* ===================== 图标（内联 SVG，无 emoji） ===================== */
const ICON = {
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  practice:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V6a2 2 0 0 1 2-2h11l3 3v12.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h9M8 15h6"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M19 3v16"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
  speaker:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a3 3 0 0 1 0 6"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
  cross:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 21h16"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h12l-2 4 2 4H5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
}

/* ===================== 工具 ===================== */
function esc(s: any) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c] as string))
}
function $(s: string) {
  return document.querySelector(s) as HTMLElement | null
}
function typeLabel(k: string) {
  const t = TYPES.find((t) => t.key === k)
  return t ? t.label : k
}
function totalRecords() {
  let n = S.practice.length + S.mistakes.length
  for (const w in S.words) {
    const st = S.words[w]
    if (st && (st.status !== 'new' || st.firstIssued)) n++
  }
  return n
}
function dueMistakes() {
  return S.mistakes.filter((m: MistakeRec) => !m.removed && m.due && m.due <= todayStr() && m.level < MIS.length)
}
function weakWords() {
  return MASTER.map((m) => m[0]).filter((w) => {
    const st = wstate(w)
    return st.weak && st.status !== 'graduated'
  })
}

/* ===================== 导航 ===================== */
const NAV = [
  { key: 'today', label: '今日', icon: ICON.home },
  { key: 'practice', label: '刷题', icon: ICON.practice },
  { key: 'mistakes', label: '错本', icon: ICON.book },
  { key: 'mine', label: '我的', icon: ICON.user }
]
let view = 'today'
let filterType = ''
let filterReason = ''

function buildNav() {
  const itemHtml = NAV.map(
    (n) => `<button class="nav-item" data-view="${n.key}">${n.icon}<span>${n.label}</span></button>`
  ).join('')
  const top = document.querySelector('#topNav')
  const bottom = document.querySelector('#bottomNav')
  if (top) top.innerHTML = itemHtml
  if (bottom) bottom.innerHTML = itemHtml
}
function setView(v: string) {
  view = v
  document.querySelectorAll('.nav-item').forEach((b) => {
    const el = b as HTMLElement
    el.classList.toggle('active', el.dataset.view === v)
  })
  render()
}

/* ===================== 渲染分发 ===================== */
function render() {
  const c = document.querySelector('#content') as HTMLElement | null
  if (!c) return
  if (view === 'today') c.innerHTML = renderToday()
  else if (view === 'practice') c.innerHTML = renderPractice()
  else if (view === 'mistakes') c.innerHTML = renderMistakes()
  else c.innerHTML = renderMine()
  bindView()
}

/* ============ 今日 ============ */
function renderToday() {
  const t = todayStr()
  const q = buildQueue()
  const remaining = q.length
  const reviewed = todayReviewed()
  const total = Math.max(reviewed + remaining, 1)
  const pct = Math.min(100, Math.round((reviewed / total) * 100))
  const practicedToday = S.practice.some((p: PracticeRec) => p.date === t)
  const dueM = dueMistakes().length
  const daysLeft = diffDays(S.examDate, t)

  const ring = ringSvg(pct)
  const heat = heatmapHtml()

  const vocabBanner = MASTER.length < 200 ? `
    <div class="prep-vocab-banner">
      ${ICON.warn}当前词库仅 <b>${MASTER.length}</b> 个演示单词，建议管理员在「我的」页导入完整四级词库（CSV/JSON），否则很快会出现「今日队列已清空」。
    </div>` : ''

  return `
  ${totalRecords() >= 20 ? backupBanner() : ''}
  ${vocabBanner}
  <div class="page-head">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <h1 class="page-title">今日备考</h1>
        <p class="page-sub">距考试 ${daysLeft >= 0 ? daysLeft + ' 天' : '已过期'} · 连续背词 ${streak()} 天 · 词库共 ${MASTER.length} 词</p>
      </div>
      <button class="btn btn-sm" data-act="gotoSettings" title="修改考试日期、每日新词数、连续天数">${ICON.gear}设置</button>
    </div>
  </div>

  <div class="handle">
    <div class="h-title">${ICON.flag}今天要处理</div>
    <div class="h-item">剩余单词 <b>${remaining}</b></div>
    <div class="h-item ${practicedToday ? '' : 'warn'}">刷题记录 <b>${practicedToday ? '今日已记' : '未记录'}</b></div>
    <div class="h-item ${dueM ? 'warn' : ''}">到期错题 <b>${dueM}</b></div>
    <div class="spacer"></div>
    <button class="btn btn-primary" data-act="startFocus">${ICON.book}开始背词</button>
    ${practicedToday ? '' : `<button class="btn" data-act="goto" data-v="practice">去刷题</button>`}
    ${dueM ? `<button class="btn" data-act="goto" data-v="mistakes">去错本</button>` : ''}
  </div>

  <div class="grid g2" style="margin-top:16px;">
    <div class="card">
      <div class="sec-title">${ICON.home}今日背词进度</div>
      <div class="ring-wrap">
        ${ring}
        <div>
          <div style="font-size:14px;color:var(--ink-soft);">今日已背 <b style="color:var(--orange)">${reviewed}</b> / 共 ${total}</div>
          <div style="margin-top:8px;font-size:13px;color:var(--ink-soft);">剩余 <b>${remaining}</b> 个待处理</div>
          <button class="btn btn-primary btn-sm" style="margin-top:12px;" data-act="startFocus">${ICON.book}进入专注背词</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="sec-title">${ICON.calendar}近 30 天打卡热力图</div>
      ${heat}
      <div class="hm-legend"><span>少</span><span class="hm-cell lvl1" style="width:12px;height:12px;"></span><span class="hm-cell lvl2" style="width:12px;height:12px;"></span><span class="hm-cell lvl3" style="width:12px;height:12px;"></span><span class="hm-cell lvl4" style="width:12px;height:12px;"></span><span>多</span></div>
    </div>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.download}今日战绩</div>
    <p class="muted" style="margin:0 0 12px;">生成一张竖版 PNG 战报，可分享或留存。</p>
    <button class="btn btn-primary" data-act="png">${ICON.download}下载今日战绩 PNG</button>
  </div>
  `
}

/* ============ 刷题记录 ============ */
function renderPractice() {
  const t = todayStr()
  const logs = S.practice.slice().sort((a: PracticeRec, b: PracticeRec) => (a.date < b.date ? 1 : -1))
  const chart = lineChart14()

  const logRows = logs.length
    ? logs
        .map(
          (p) => `
    <div class="li">
      <div class="li-main">
        <div class="li-t">${typeLabel(p.type)} <span class="tag ink">${esc(p.date)}</span></div>
        <div class="li-d">做题 ${p.total} · 正确 ${p.correct} · 正确率 <b style="color:var(--green)">${rate(p.correct, p.total)}%</b> ${p.sample ? '<span class="tag">示例</span>' : ''}</div>
      </div>
      <div class="li-actions">
        <button class="btn btn-ghost btn-sm" data-act="delPractice" data-id="${p.id}">${ICON.trash}</button>
      </div>
    </div>`
        )
        .join('')
    : `<div class="empty">还没有刷题记录，下面添加一条吧。</div>`

  return `
  <div class="page-head">
    <h1 class="page-title">刷题记录</h1>
    <p class="page-sub">记录听力 / 阅读 / 写作 / 翻译，自动计算正确率</p>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.plus}添加刷题记录</div>
    <div class="row">
      <div class="field" style="margin:0;"><label>题型</label>
        <select class="select" id="pfType">${TYPES.map((t) => `<option value="${t.key}">${t.label}</option>`).join('')}</select>
      </div>
      <div class="field" style="margin:0;"><label>做题数</label><input class="input" id="pfTotal" type="number" min="0" placeholder="如 20"></div>
      <div class="field" style="margin:0;"><label>正确数</label><input class="input" id="pfCorrect" type="number" min="0" placeholder="如 15"></div>
    </div>
    <button class="btn btn-primary" style="margin-top:12px;" data-act="addPractice">${ICON.plus}记录</button>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.practice}近 14 天正确率</div>
    <div class="chart-box">${chart}</div>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.flag}四级题型结构（参考）</div>
    <div class="struct-row"><span class="s-name">写作</span><span class="s-pct">约 15%</span></div>
    <div class="struct-row"><span class="s-name">听力理解</span><span class="s-pct">约 35%</span></div>
    <div class="struct-row"><span class="s-name">阅读理解</span><span class="s-pct">约 35%</span></div>
    <div class="struct-row"><span class="s-name">翻译</span><span class="s-pct">约 15%</span></div>
    <div class="note">${ICON.warn}<span>以上为常见题型结构占比，具体分值与题型以<b>官方考试大纲</b>公告为准。</span></div>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.practice}全部记录（${logs.length}）</div>
    ${logRows}
  </div>
  `
}

/* ============ 错本 ============ */
function renderMistakes() {
  const due = dueMistakes()
  const weak = weakWords()
  const all = S.mistakes.filter((m: MistakeRec) => !m.removed)

  const typeOpts = `<option value="">全部题型</option>${TYPES.map(
    (t) => `<option value="${t.key}" ${filterType === t.key ? 'selected' : ''}>${t.label}</option>`
  ).join('')}<option value="vocab" ${filterType === 'vocab' ? 'selected' : ''}>生词</option>`
  const reasonOpts = `<option value="">全部错因</option>${[
    ...new Set(S.mistakes.map((m: MistakeRec) => m.reason).filter(Boolean))
  ]
    .map((r) => `<option value="${esc(r)}" ${filterReason === r ? 'selected' : ''}>${esc(r)}</option>`)
    .join('')}`
  const ft = filterType
  const fr = filterReason

  let filtered = all
  if (ft) {
    filtered = filtered.filter((m: MistakeRec) => (ft === 'vocab' ? false : m.type === ft))
  }
  if (fr) {
    filtered = filtered.filter((m: MistakeRec) => m.reason === fr)
  }

  const dueRows = due.length
    ? due.map((m) => mistakeRow(m, true)).join('')
    : `<div class="empty">暂无到期错题，保持得很好。</div>`
  const weakRows = weak.length
    ? weak
        .map((w) => {
          const st = wstate(w)
          const m = MASTER.find((x) => x[0] === w) as PrepWord
          return `<div class="li">
      <div class="li-main"><div class="li-t">${esc(m[0])} <span class="tag">生词</span></div>
      <div class="li-d">${esc(m[2])} ${esc(m[3])} ${st.due && st.due <= todayStr() ? '<span class="tag red">到期复习</span>' : ''}</div></div>
      <div class="li-actions"><button class="btn btn-sm" data-act="reviewWeak" data-w="${esc(w)}">标已掌握</button><button class="btn btn-ghost btn-sm" data-act="removeWeak" data-w="${esc(w)}">移出</button></div>
    </div>`
        })
        .join('')
    : `<div class="empty">生词本为空。</div>`

  const filteredRows = filtered.length
    ? filtered.map((m: MistakeRec) => mistakeRow(m, false)).join('')
    : `<div class="empty">没有符合筛选条件的错题。</div>`

  return `
  <div class="page-head">
    <h1 class="page-title">错本</h1>
    <p class="page-sub">生词自动收编 · 错题按 1/3/7/15/30 天复习</p>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.plus}登记一道错题</div>
    <div class="row">
      <div class="field" style="margin:0;"><label>题型</label><select class="select" id="mType">${TYPES.map(
        (t) => `<option value="${t.key}">${t.label}</option>`
      ).join('')}</select></div>
      <div class="field" style="margin:0;"><label>错因</label><input class="input" id="mReason" placeholder="如：长难句理解偏差"></div>
    </div>
    <div class="field" style="margin-top:12px;"><label>正确思路</label><textarea class="textarea" id="mApproach" placeholder="这题正确的解法 / 关键知识点"></textarea></div>
    <button class="btn btn-primary" data-act="addMistake">${ICON.plus}加入错本</button>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.warn}到期需复习（${due.length}）</div>
    ${dueRows}
  </div>

  <div class="card">
    <div class="sec-title">${ICON.book}生词本（${weak.length}）</div>
    ${weakRows}
  </div>

  <div class="card">
    <div class="sec-title">${ICON.flag}全部错题（按筛选）</div>
    <div class="filters">
      <select class="select" id="filterType" data-act="filter">${typeOpts}</select>
      <select class="select" id="filterReason" data-act="filter">${reasonOpts}</select>
    </div>
    ${filteredRows}
  </div>
  `
}
function mistakeRow(m: MistakeRec, due: boolean) {
  const next = addDays(m.due || todayStr(), MIS[Math.min(m.level, MIS.length - 1)] ?? 30)
  return `<div class="li ${due ? 'due' : ''}">
    <div class="li-main">
      <div class="li-t">${typeLabel(m.type || '')} <span class="tag ${due ? 'red' : 'ink'}">${due ? '到期' : 'Lv' + (m.level + 1)}</span> ${m.sample ? '<span class="tag">示例</span>' : ''}</div>
      <div class="li-d">错因：${esc(m.reason || '—')} · 下次 ${esc(m.due || todayStr())}</div>
      <div class="li-d" style="margin-top:4px;color:var(--ink)">正确思路：${esc(m.approach || '—')}</div>
    </div>
    <div class="li-actions">
      <button class="btn btn-green btn-sm" data-act="masterMistake" data-id="${m.id}">${ICON.check}掌握</button>
      <button class="btn btn-ghost btn-sm" data-act="delMistake" data-id="${m.id}">${ICON.trash}</button>
    </div>
  </div>`
}

/* ============ 我的 ============ */
function renderMine() {
  const speakNote = CAN_SPEAK
    ? ''
    : `<div class="note">${ICON.warn}<span>当前浏览器不支持系统朗读（Web Speech），发音按钮已自动隐藏。</span></div>`
  const adminNote = IS_ADMIN
    ? `<div class="card">
      <div class="sec-title">${ICON.book}词库管理（管理员）</div>
      <p class="muted" style="margin:0 0 12px;">导入完整四级词表（CSV / JSON）。字段：<b>word, phonetic, pos, definition, collocation</b>。导入会按单词去重合并进主词表。</p>
      <div class="row">
        <button class="btn btn-primary" data-act="pickWords">${ICON.download}选择词库文件导入</button>
        <input type="file" id="wordFile" accept=".csv,.json,application/json,text/csv" style="display:none;">
      </div>
      <div id="seedMsg" class="muted" style="margin-top:10px;"></div>
    </div>`
    : ''

  const currentStreak = streak()
  return `
  <div class="page-head">
    <h1 class="page-title">我的</h1>
    <p class="page-sub">数据导出 / 导入 · 备份 · 清空</p>
  </div>

  ${totalRecords() >= 20 ? backupBanner() : ''}

  ${adminNote}

  <div class="card" id="prepSettingsCard">
    <div class="sec-title">${ICON.gear}备考设置</div>
    <div class="field">
      <label>考试日期</label>
      <input class="input" type="date" id="settingExamDate" value="${S.examDate}">
    </div>
    <div class="field">
      <label>每日新词数</label>
      <input class="input" type="number" id="settingNewPerDay" min="1" max="200" value="${S.newPerDay}">
    </div>
    <div class="field">
      <label>连续背词天数</label>
      <input class="input" type="number" id="settingManualStreak" min="0" max="9999" placeholder="留空则按打卡记录自动计算（当前 ${currentStreak} 天）" value="${S.manualStreak ?? ''}">
    </div>
    <p class="muted" style="margin:0 0 12px;">修改后点击保存会立即写入云端数据库，刷新或换设备仍生效。</p>
    <button class="btn btn-primary" data-act="saveSettings">${ICON.check}保存设置</button>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.download}导出 / 导入</div>
    <p class="muted" style="margin:0 0 12px;">全部数据（单词进度、刷题、错本、设置）存于云端数据库，可导出 JSON 备份或换设备导入。</p>
    <div class="row">
      <button class="btn btn-primary" data-act="export">${ICON.download}导出 JSON</button>
      <button class="btn" data-act="import">${ICON.link}导入 JSON</button>
      <input type="file" id="importFile" accept="application/json" style="display:none;">
    </div>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.warn}示例数据</div>
    <p class="muted" style="margin:0 0 12px;">首次打开时已预置少量刷题、打卡与错题示例。可单独清除示例，保留你自己的数据。</p>
    <button class="btn" data-act="clearSamples">${ICON.trash}只清除示例数据</button>
  </div>

  <div class="card">
    <div class="sec-title">${ICON.trash}清空全部数据</div>
    <p class="muted" style="margin:0 0 10px;">此操作不可恢复。请输入「清空」以确认。</p>
    <div class="row">
      <input class="input" id="clearInput" placeholder="在此输入：清空">
      <button class="btn btn-red" id="clearBtn" disabled data-act="clearAll">确认清空</button>
    </div>
  </div>

  ${speakNote}
  `
}

/* ===================== 组件 HTML ===================== */
function ringSvg(pct: number) {
  const R = 52
  const C = 2 * Math.PI * R
  const off = C * (1 - pct / 100)
  return `<svg class="ring" viewBox="0 0 120 120">
    <circle class="ring-bg" cx="60" cy="60" r="${R}"></circle>
    <circle class="ring-fg" cx="60" cy="60" r="${R}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(
    1
  )}" transform="rotate(-90 60 60)"></circle>
    <text x="60" y="58" text-anchor="middle" class="ring-center" fill="var(--ink)">${pct}%</text>
    <text x="60" y="76" text-anchor="middle" fill="var(--ink-soft)" style="font-size:11px;">完成度</text>
  </svg>`
}
function heatmapHtml() {
  const t = todayStr()
  let cells = ''
  for (let i = 29; i >= 0; i--) {
    const d = addDays(t, -i)
    const c = S.checkins[d]
    const n = c ? c.words : 0
    const lvl = n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4
    cells += `<div class="hm-cell lvl${lvl}" title="${d}：背词 ${n} 个"></div>`
  }
  return `<div class="heatmap">${cells}</div>`
}
function lineChart14() {
  const t = todayStr()
  const days: { date: string; rate: number | null }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i)
    const ps = S.practice.filter((p: PracticeRec) => p.date === d)
    let rateRes: number | null = null
    if (ps.length) {
      const tot = ps.reduce((s: number, p: PracticeRec) => s + p.total, 0)
      const cor = ps.reduce((s: number, p: PracticeRec) => s + p.correct, 0)
      rateRes = tot ? Math.round((cor / tot) * 100) : 0
    }
    days.push({ date: d, rate: rateRes })
  }
  const W = 680
  const H = 210
  const padL = 38
  const padR = 14
  const padT = 16
  const padB = 28
  const xstep = (W - padL - padR) / (days.length - 1)
  const yMax = 100
  const yMin = 0
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB)
  const x = (i: number) => padL + i * xstep
  let pts = ''
  let dots = ''
  let labels = ''
  days.forEach((d, i) => {
    if (d.rate !== null) {
      pts += `${x(i).toFixed(1)},${y(d.rate).toFixed(1)} `
      dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(d.rate).toFixed(1)}" r="3.5" fill="var(--orange)"></circle>`
    }
    if (i % 2 === 0 || i === days.length - 1) {
      labels += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="var(--ink-soft)" style="font-size:10px;">${d.date.slice(
        5
      )}</text>`
    }
  })
  let grid = ''
  ;[0, 25, 50, 75, 100].forEach((g) => {
    grid += `<line x1="${padL}" y1="${y(g).toFixed(1)}" x2="${W - padR}" y2="${y(g).toFixed(1)}" stroke="var(--border-2)" stroke-width="1"></line><text x="${
      padL - 6
    }" y="${(y(g) + 3).toFixed(1)}" text-anchor="end" fill="var(--ink-soft)" style="font-size:10px;">${g}</text>`
  })
  const poly = pts.trim()
    ? `<polyline points="${pts.trim()}" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>`
    : ''
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${poly}${dots}${labels}</svg>`
}
function backupBanner() {
  return `<div class="backup-banner">${ICON.warn}<div>已累计 <b>${totalRecords()}</b> 条记录，建议导出 JSON 备份（「我的」→ 导出）。</div></div>`
}
function rate(c: number, t: number) {
  return t ? Math.round((c / t) * 100) : 0
}

/* ===================== 事件绑定 ===================== */
function bindView() {
  const c = document.querySelector('#content')
  if (!c) return
  c.querySelectorAll('[data-act]').forEach((el) => {
    const e = el as HTMLElement
    if (e.tagName === 'SELECT') e.addEventListener('change', onAct)
    else e.addEventListener('click', onAct)
  })
  const ci = document.querySelector('#clearInput') as HTMLInputElement | null
  if (ci) {
    ci.addEventListener('input', () => {
      const btn = document.querySelector('#clearBtn') as HTMLButtonElement | null
      if (btn) btn.disabled = ci.value.trim() !== '清空'
    })
  }
  const imp = document.querySelector('#importFile') as HTMLInputElement | null
  if (imp && !imp.dataset.bound) {
    imp.dataset.bound = '1'
    imp.addEventListener('change', handleImportFile)
  }
  const wf = document.querySelector('#wordFile') as HTMLInputElement | null
  if (wf && !wf.dataset.bound) {
    wf.dataset.bound = '1'
    wf.addEventListener('change', handleWordFile)
  }
}
function onAct(e: Event) {
  const el = e.currentTarget as HTMLElement
  const act = el.dataset.act
  const v = el.dataset.v
  const id = el.dataset.id
  const w = el.dataset.w
  if (act === 'startFocus') startFocus()
  else if (act === 'goto') setView(v || '')
  else if (act === 'png') downloadPng()
  else if (act === 'pickPdf') {
    alert('PDF 词表导入功能暂不可用（PDF 解析库与当前环境兼容性问题）。\n请使用内置词库或「上传词表文件」功能（支持 .txt/.csv）。')
  }
  else if (act === 'pickWords') {
    const wf = document.querySelector('#wordFile') as HTMLInputElement | null
    if (wf) wf.click()
  } else if (act === 'addPractice') {
    const type = (document.querySelector('#pfType') as HTMLSelectElement)?.value
    const total = parseInt((document.querySelector('#pfTotal') as HTMLInputElement)?.value || '', 10)
    const correct = parseInt((document.querySelector('#pfCorrect') as HTMLInputElement)?.value || '', 10)
    if (isNaN(total) || isNaN(correct) || total < 0 || correct < 0 || correct > total) {
      alert('请填写有效做题数与正确数（正确数不超过做题数）。')
      return
    }
    const rec: PracticeRec = { id: newId(), date: todayStr(), type, total, correct, sample: false }
    S.practice.push(rec)
    addCheckin(todayStr(), 'practice')
    p(storage.persistPractice(rec))
    render()
  } else if (act === 'delPractice') {
    S.practice = S.practice.filter((p: PracticeRec) => p.id !== id)
    p(storage.removePractice(id || ''))
    render()
  } else if (act === 'addMistake') {
    const type = (document.querySelector('#mType') as HTMLSelectElement)?.value
    const reason = ((document.querySelector('#mReason') as HTMLInputElement)?.value || '').trim()
    const approach = ((document.querySelector('#mApproach') as HTMLTextAreaElement)?.value || '').trim()
    if (!reason || !approach) {
      alert('请填写错因与正确思路。')
      return
    }
    const rec: MistakeRec = {
      id: newId(),
      date: todayStr(),
      type,
      reason,
      approach,
      level: 0,
      due: todayStr(),
      removed: false,
      sample: false
    }
    S.mistakes.push(rec)
    p(storage.persistMistake(rec))
    render()
  } else if (act === 'masterMistake') {
    const m = S.mistakes.find((x: MistakeRec) => x.id === id)
    if (!m) return
    m.level++
    if (m.level >= MIS.length) m.removed = true
    else m.due = addDays(todayStr(), MIS[m.level] ?? 30)
    p(storage.persistMistake(m))
    render()
  } else if (act === 'delMistake') {
    S.mistakes = S.mistakes.filter((x: MistakeRec) => x.id !== id)
    p(storage.removeMistake(id || ''))
    render()
  } else if (act === 'reviewWeak') {
    const st = wstate(w || '')
    st.weak = false
    if (st.status === 'new') {
      st.status = 'learning'
      st.level = 0
      st.due = addDays(todayStr(), SRS[0])
    }
    p(storage.persistProgress(w || '', st))
    render()
  } else if (act === 'removeWeak') {
    wstate(w || '').weak = false
    p(storage.persistProgress(w || '', wstate(w || '')))
    render()
  } else if (act === 'filter') {
    if (el.id === 'filterType') filterType = (el as HTMLSelectElement).value
    else filterReason = (el as HTMLSelectElement).value
    render()
  } else if (act === 'export') exportJson()
  else if (act === 'import') {
    const imp = document.querySelector('#importFile') as HTMLInputElement | null
    if (imp) imp.click()
  } else if (act === 'clearSamples') clearSamples()
  else if (act === 'clearAll') clearAll()
  else if (act === 'linkGoal') linkGoal()
  else if (act === 'gotoSettings') {
    setView('mine')
    setTimeout(() => {
      const el = document.querySelector('#prepSettingsCard')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  } else if (act === 'saveSettings') saveSettings()
}
function handleImportFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const r = new FileReader()
  r.onload = () => {
    try {
      const data = JSON.parse(String(r.result))
      if (confirm('导入将覆盖当前全部数据，确定继续？')) {
        S = Object.assign(defaults(), data)
        storage
          .replaceAll(buildFullState())
          .then(() => {
            render()
            alert('导入成功。')
          })
          .catch((err) => alert('导入失败：' + err.message))
      }
    } catch (err: any) {
      alert('文件解析失败，请确认是有效的备份 JSON。')
    }
  }
  r.readAsText(f)
  ;(e.target as HTMLInputElement).value = ''
}
function handleWordFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const msg = document.querySelector('#seedMsg')
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const rows = parseWordFile(String(reader.result), f.name)
      if (!rows.length) {
        if (msg) msg.textContent = '未解析到有效词条，请检查文件格式。'
        return
      }
      storage
        .seedMasterWords(rows)
        .then((n) => {
          if (msg) msg.textContent = `成功导入 ${n} 个词条到主词表。`
          // 重新拉取主词表（含新词）
          storage.fetchMasterWords().then((mw) => {
            MASTER = mw.length ? mw : MASTER_WORDS_BUNDLE
            render()
          })
        })
        .catch((err) => {
          if (msg) msg.textContent = '导入失败：' + err.message
        })
    } catch (err: any) {
      if (msg) msg.textContent = '解析失败：' + err.message
    }
  }
  reader.readAsText(f)
  ;(e.target as HTMLInputElement).value = ''
}

/* ===================== PDF 词表导入（暂不可用） ===================== */

// PDF 文本提取（暂不可用：pdfjs-dist 与当前打包环境不兼容）
async function extractPdfText(_buf: ArrayBuffer): Promise<string> {
  throw new Error('PDF 解析暂不可用，请使用内置词库或上传 .txt/.csv 词表文件')
}

// 启发式：从每行抽取 word / 音标(/.../ 或 [...]) / 词性(n. v. adj. 等) / 释义，跳过页码与纯中文行
function parsePdfWords(text: string): PrepWord[] {
  const out: PrepWord[] = []
  const seen = new Set<string>()
  const posRe = /\b(n\.|v\.|vt\.|vi\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|art\.|num\.|abbr\.)\b/i
  const phoRe = /\/([^/]+)\/|\[([^\]]+)\]/
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^\d+$/.test(line)) continue
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
    out.push([word, phonetic, pos, def, ''])
  }
  return out
}
// 解析词库文件：支持 JSON 数组 或 CSV（首行表头 word,phonetic,pos,definition,collocation）
// RFC4180 感知的 CSV 行解析：正确处理双引号包裹字段内的逗号/换行
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = false
      } else cur += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
  }
  out.push(cur)
  return out
}

function parseWordFile(text: string, fileName: string): PrepWord[] {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed)
    const arr = Array.isArray(data) ? data : data.words || []
    return arr
      .map((r: any): PrepWord | null => {
        if (Array.isArray(r)) return [r[0], r[1] || '', r[2] || '', r[3] || '', r[4] || '']
        if (r && r.word) return [r.word, r.phonetic || '', r.pos || '', r.definition || '', r.collocation || '']
        return null
      })
      .filter(Boolean) as PrepWord[]
  }
  // CSV
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const header = splitCsvLine(lines[0] ?? '').map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)
  const wi = idx('word')
  if (wi < 0) throw new Error('CSV 缺少 word 列')
  const pi = idx('phonetic')
  const posi = idx('pos')
  const di = idx('definition')
  const ci = idx('collocation')
  const out: PrepWord[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i] ?? '')
    out.push([
      (cols[wi] || '').trim(),
      pi >= 0 ? (cols[pi] || '').trim() : '',
      posi >= 0 ? (cols[posi] || '').trim() : '',
      di >= 0 ? (cols[di] || '').trim() : '',
      ci >= 0 ? (cols[ci] || '').trim() : ''
    ])
  }
  return out.filter((r) => r[0])
}

/* ===================== 专注背词 ===================== */
let queueArr: { w: string; kind: string }[] = []
let current: { w: string; kind: string } | null = null
function startFocus() {
  queueArr = buildQueue()
  issueQueueWords(queueArr)
  if (queueArr.length === 0) {
    if (MASTER.length < 200) {
      alert('演示词库已用完。请管理员在「我的」页导入完整四级词库（CSV/JSON），或执行 scripts/cet4_prep.sql 后导入词表。')
    } else {
      alert('今日队列已清空，明天再来或调高每日新词数。')
    }
    return
  }
  const f = document.querySelector('#focus')
  if (f) f.classList.add('show')
  nextCard()
}
function closeFocus() {
  const f = document.querySelector('#focus')
  if (f) f.classList.remove('show')
  current = null
  render()
}
function nextCard() {
  if (queueArr.length === 0) {
    finishFocus()
    return
  }
  current = queueArr.shift() as { w: string; kind: string }
  const m = MASTER.find((x) => x[0] === current!.w)
  // L5 修复：词库重拉（re-seed/导入）后队列里可能残留已不存在的词引用，
  // 此时 m 为 undefined，直接 renderCard(m) 会读 m[0] 抛错导致白屏。跳过该失效卡片。
  if (!m) {
    current = null
    render()
    return
  }
  renderCard(m, false)
  updateProgress()
}
function renderCard(m: PrepWord, flipped: boolean) {
  const card = document.querySelector('#focusCard')
  if (!card) return
  const speakBtn = CAN_SPEAK ? `<button class="fc-speak" id="fcSpeak">${ICON.speaker}朗读</button>` : ''
  if (!flipped) {
    card.innerHTML = `
      <div class="fc-kind ${current!.kind === 'review' ? 'review' : ''}">${current!.kind === 'review' ? '复习' : '新词'}</div>
      <div class="fc-emoji">${getEmoji(m[0])}</div>
      <div class="fc-word">${esc(m[0])}</div>
      <div class="fc-ph">${esc(m[1])}</div>
      ${speakBtn}
      <div class="fc-divider"></div>
      <button class="btn btn-primary btn-block" id="fcFlip">${ICON.book}翻面看释义</button>
    `
    const flip = document.querySelector('#fcFlip')
    if (flip) flip.addEventListener('click', () => renderCard(m, true))
    const sp = document.querySelector('#fcSpeak')
    if (sp) sp.addEventListener('click', () => speak(m[0]))
  } else {
    card.innerHTML = `
      <div class="fc-kind ${current!.kind === 'review' ? 'review' : ''}">${current!.kind === 'review' ? '复习' : '新词'}</div>
      <div class="fc-emoji">${getEmoji(m[0])}</div>
      <div class="fc-word">${esc(m[0])}</div>
      <div class="fc-ph">${esc(m[1])}</div>
      <div class="fc-divider"></div>
      <div class="fc-pos">${esc(m[2])}</div>
      <div class="fc-back">${esc(m[3])}</div>
      <div class="fc-coll">常考：${esc(m[4])}</div>
      <div class="fc-actions">
        <button class="fc-btn fc-unknown" id="fcUnk">${ICON.cross}不认识</button>
        <button class="fc-btn fc-known" id="fcKn">${ICON.check}认识</button>
      </div>
    `
    const kn = document.querySelector('#fcKn')
    const unk = document.querySelector('#fcUnk')
    // 关键：判断认识/不认识后必须调用 afterReview() 前进到下一个卡片（修复卡片卡死）
    if (kn) kn.addEventListener('click', () => { reviewWord(current!.w, true); afterReview() })
    if (unk) unk.addEventListener('click', () => { reviewWord(current!.w, false); afterReview() })
  }
}
function afterReview() {
  updateProgress()
  if (queueArr.length === 0) finishFocus()
  else nextCard()
}
function updateProgress() {
  const done = todayReviewed()
  const total = Math.max(done + queueArr.length, 1)
  const el = document.querySelector('#focusProgress')
  if (el) el.textContent = `${done} / ${total}`
}
function finishFocus() {
  const card = document.querySelector('#focusCard')
  if (!card) return
  card.innerHTML = `
    <div class="focus-done">
      <h2>${ICON.check} 今日背词完成！</h2>
      <p>连续背词 ${streak()} 天 · 今日共背 ${todayReviewed()} 个</p>
      <button class="btn btn-primary" id="fcDone">${ICON.home}返回</button>
    </div>`
  celebrate()
  const done = document.querySelector('#fcDone')
  if (done) done.addEventListener('click', closeFocus)
  updateProgress()
}
function celebrate() {
  if (!current) return
  const fc = document.querySelector('#confetti')
  if (!fc) return
  fc.innerHTML = ''
  const cols = ['#F0922B', '#FFB877', '#2E9E5B', '#22304E', '#E0492F']
  for (let i = 0; i < 46; i++) {
    const s = document.createElement('i')
    s.style.left = Math.random() * 100 + '%'
    s.style.background = cols[i % cols.length]!
    s.style.animationDelay = Math.random() * 0.5 + 's'
    s.style.transform = 'rotate(' + Math.random() * 360 + 'deg)'
    fc.appendChild(s)
  }
  setTimeout(() => {
    if (fc) fc.innerHTML = ''
  }, 2200)
}

/* ===================== 导出 / 导入 / 清空 ===================== */
function exportJson() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'cet4-prep-' + todayStr() + '.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
function clearSamples() {
  if (!confirm('仅清除预置的示例数据（刷题/错题示例），你的真实数据保留。确定？')) return
  storage
    .clearSampleData()
    .then(() => storage.loadAll())
    .then((st) => {
      S = buildS(st)
      render()
      alert('示例数据已清除。')
    })
    .catch((err) => alert('清除失败：' + err.message))
}
function clearAll() {
  if (!confirm('将清空全部数据且不可恢复，确定？')) return
  storage
    .replaceAll(buildFullStateFromDefaults())
    .then(() => {
      S = defaults()
      render()
      alert('已清空全部数据。')
    })
    .catch((err) => alert('清空失败：' + err.message))
}
function buildS(st: PrepState) {
  return {
    newPerDay: st.settings.newPerDay,
    examDate: st.settings.examDate || thirdSatOfNov(new Date().getFullYear()),
    manualStreak: st.settings.manualStreak ?? null,
    words: st.words,
    practice: st.practice,
    mistakes: st.mistakes,
    checkins: st.checkins,
    linkedGoal: st.settings.linkedGoal,
    dayMark: null,
    dayPlan: 0
  }
}
function buildFullStateFromDefaults() {
  const d = defaults()
  return {
    words: d.words,
    practice: d.practice,
    mistakes: d.mistakes,
    checkins: d.checkins,
    settings: { newPerDay: d.newPerDay, examDate: d.examDate, manualStreak: d.manualStreak, linkedGoal: d.linkedGoal }
  }
}

/* ===================== 关联系统学习目标（简化为记录关联目标） ===================== */
function linkGoal() {
  const goalName = '四六级每日背词'
  S.linkedGoal = goalName
  p(storage.persistSettings(settings()))
  alert('已在备考设置中记录关联目标「' + goalName + '」。可在系统学习目标模块手动建立对应目标。')
}

function saveSettings() {
  const examDateEl = document.querySelector('#settingExamDate') as HTMLInputElement | null
  const newPerDayEl = document.querySelector('#settingNewPerDay') as HTMLInputElement | null
  const manualStreakEl = document.querySelector('#settingManualStreak') as HTMLInputElement | null

  const newPerDay = parseInt(newPerDayEl?.value || '10', 10)
  if (!Number.isFinite(newPerDay) || newPerDay < 1 || newPerDay > 200) {
    alert('每日新词数请填写 1-200 之间的数字。')
    return
  }

  const examDate = examDateEl?.value?.trim() || todayStr()
  const manualStreakRaw = manualStreakEl?.value?.trim() || ''
  const manualStreak = manualStreakRaw === '' ? null : parseInt(manualStreakRaw, 10)
  if (manualStreak !== null && (!Number.isFinite(manualStreak) || manualStreak < 0 || manualStreak > 9999)) {
    alert('连续背词天数请填写 0-9999 之间的数字，或留空自动计算。')
    return
  }

  S.newPerDay = newPerDay
  S.examDate = examDate
  S.manualStreak = manualStreak
  storage
    .persistSettings(settings())
    .then(() => {
      alert('设置已保存。')
      render()
    })
    .catch((err: any) => alert('保存失败：' + (err?.message || err)))
}

/* ===================== 今日战绩 PNG ===================== */
function downloadPng() {
  const c = document.createElement('canvas')
  c.width = 480
  c.height = 800
  const x = c.getContext('2d')
  if (!x) return
  const g = x.createLinearGradient(0, 0, 0, 800)
  g.addColorStop(0, '#FBF6EE')
  g.addColorStop(1, '#FDEBD6')
  x.fillStyle = g
  x.fillRect(0, 0, 480, 800)
  x.fillStyle = '#22304E'
  x.font = 'bold 30px sans-serif'
  x.textAlign = 'center'
  x.fillText('今日备考战绩', 240, 70)
  x.fillStyle = '#F0922B'
  x.font = '14px sans-serif'
  x.fillText(todayStr(), 240, 98)
  const items: [string, string][] = [
    ['今日已背词', todayReviewed() + ' 个'],
    ['连续背词', streak() + ' 天'],
    ['剩余待处理', buildQueue().length + ' 个'],
    ['到期错题', dueMistakes().length + ' 道'],
    ['刷题正确率', overallRate() + '%'],
    ['距考试', Math.max(0, diffDays(S.examDate, todayStr())) + ' 天']
  ]
  let y = 160
  items.forEach((it) => {
    x.fillStyle = '#FFFFFF'
    roundRect(x, 40, y, 400, 86, 16)
    x.fill()
    x.strokeStyle = '#ECE0CE'
    x.lineWidth = 1
    roundRect(x, 40, y, 400, 86, 16)
    x.stroke()
    x.fillStyle = '#5B6A86'
    x.font = '15px sans-serif'
    x.textAlign = 'left'
    x.fillText(it[0], 66, y + 34)
    x.fillStyle = '#22304E'
    x.font = 'bold 30px sans-serif'
    x.fillText(it[1], 66, y + 66)
    y += 104
  })
  x.fillStyle = '#E0492F'
  x.font = '12px sans-serif'
  x.textAlign = 'center'
  x.fillText('四六级备考台 · 云端同步', 240, 780)
  c.toBlob((b) => {
    if (!b) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = 'cet4-today-' + todayStr() + '.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  })
}
function overallRate() {
  if (!S.practice.length) return 0
  const tot = S.practice.reduce((s: number, p: PracticeRec) => s + p.total, 0)
  const cor = S.practice.reduce((s: number, p: PracticeRec) => s + p.correct, 0)
  return tot ? Math.round((cor / tot) * 100) : 0
}
function roundRect(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) {
  x.beginPath()
  x.moveTo(X + r, Y)
  x.arcTo(X + W, Y, X + W, Y + H, r)
  x.arcTo(X + W, Y + H, X, Y + H, r)
  x.arcTo(X, Y + H, X, Y, r)
  x.arcTo(X, Y, X + W, Y, r)
  x.closePath()
}

/* ===================== 示例数据 ===================== */
function loadSamples() {
  if (S.practice.length > 0 || S.mistakes.length > 0) return
  const t = todayStr()
  const pdefs: [string, number, number][] = [
    ['listening', 20, 15],
    ['reading', 30, 22],
    ['writing', 15, 11],
    ['translate', 10, 7],
    ['listening', 25, 18],
    ['reading', 30, 20]
  ]
  pdefs.forEach((d, i) => {
    const rec: PracticeRec = {
      id: newId(),
      date: addDays(t, -(i + 1)),
      type: d[0],
      total: d[1],
      correct: d[2],
      sample: true
    }
    S.practice.push(rec)
    p(storage.persistPractice(rec))
  })
  for (let i = 0; i < 12; i++) {
    const dt = addDays(t, -i)
    const c = { words: i < 9 ? 3 + (i % 4) : 0, practice: 1 }
    S.checkins[dt] = c
    p(storage.persistCheckin(dt, c))
  }
  const mdefs: [string, string, string, string][] = [
    ['listening', '没抓住关键词', '先预读选项再听', addDays(t, -1)],
    ['reading', '长难句理解偏差', '拆分句子结构', addDays(t, 2)],
    ['writing', '词汇匮乏', '背诵高分句型', addDays(t, -3)]
  ]
  mdefs.forEach((m, i) => {
    const rec: MistakeRec = {
      id: newId(),
      date: addDays(t, -(i + 1)),
      type: m[0],
      reason: m[1],
      approach: m[2],
      level: i % 2,
      due: m[3],
      removed: false,
      sample: true
    }
    S.mistakes.push(rec)
    p(storage.persistMistake(rec))
  })
}

/* ===================== 启动 ===================== */
function ensureDay() {
  const t = todayStr()
  if (S.dayMark !== t) {
    S.dayMark = t
    S.dayPlan = buildQueue().length
  }
}
async function init() {
  MASTER = await storage.fetchMasterWords()
  USING_FALLBACK_MASTER = !MASTER.length
  if (!MASTER.length) MASTER = MASTER_WORDS_BUNDLE
  IS_ADMIN = await storage.isAdmin()
  const st = await storage.loadAll()
  S = buildS(st)
  loadSamples()
  ensureDay()
  buildNav()
  setView('today')
}

/**
 * 挂载备考台到指定根元素。返回清理函数（组件卸载时调用，移除根级事件监听）。
 */
export async function initPrep(root: HTMLElement, store: PrepStorage): Promise<() => void> {
  storage = store
  const navHandler = (e: Event) => {
    const b = (e.target as HTMLElement).closest('.nav-item') as HTMLElement | null
    if (b) setView(b.dataset.view || '')
  }
  root.addEventListener('click', navHandler)
  const focusClose = root.querySelector('#focusClose')
  const fcClose = () => closeFocus()
  if (focusClose) focusClose.addEventListener('click', fcClose)

  await init()

  return () => {
    root.removeEventListener('click', navHandler)
    if (focusClose) focusClose.removeEventListener('click', fcClose)
  }
}

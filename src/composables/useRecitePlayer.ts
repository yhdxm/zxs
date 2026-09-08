// 朗读中心 · 顺序朗读播放引擎
// 核心：用单一 HTMLAudioElement 做「队列顺序播放」，每段音频（字母 / 整词 / 中文）
// 通过同一 <audio> 媒体元素 onended 串联。媒体播放属于系统媒体会话，
// Android / iQOO 锁屏后不中断 —— 满足「手机灭屏也能听」。
// 英文与中文统一走有道 dictvoice（免费、国内可直连）；离线降级 speechSynthesis（亮屏）。
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { speakEn, type SpeechAccent } from '../prep/degreeSpeech'

export type ReciteItem = {
  text: string
  zh: string
  phonetic?: string
  kind: 'word' | 'phrase'
}

type Seg = {
  itemIndex: number
  kind: 'letter' | 'whole' | 'zh'
  text: string
  letterPos?: number
}

const YOUDAO = 'https://dict.youdao.com/dictvoice'
const PROGRESS_KEY = 'zxs_recite_progress_v1'

let audioEl: HTMLAudioElement | null = null
let currentResolve: ((ok: boolean) => void) | null = null

function getAudio(): HTMLAudioElement {
  if (!audioEl) audioEl = new Audio()
  return audioEl
}

/** 单段播放：走有道 dictvoice（type 1=美/2=英，对中文无影响）。返回是否成功起播完。 */
function segPlay(text: string, type: number, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      resolve(false)
      return
    }
    if (!text || !text.trim()) {
      resolve(true) // 空文本视为跳过
      return
    }
    try {
      const el = getAudio()
      el.playbackRate = rate
      el.src = `${YOUDAO}?audio=${encodeURIComponent(text)}&type=${type}`
      let done = false
      const finish = (ok: boolean) => {
        if (!done) {
          done = true
          el.onended = null
          el.onerror = null
          currentResolve = null
          resolve(ok)
        }
      }
      currentResolve = finish
      el.onended = () => finish(true)
      el.onerror = () => finish(false)
      const p = el.play() as Promise<void> | undefined
      if (p && typeof p.catch === 'function') p.catch(() => finish(false))
      // 单段超时 8s，避免网络异常时悬挂拖垮自动连播
      window.setTimeout(() => finish(false), 8000)
    } catch {
      resolve(false)
    }
  })
}

/** 本地 speechSynthesis 读中文（亮屏场景兜底，仅当在线有道失败时使用）。 */
function speakZhLocal(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
      resolve(false)
      return
    }
    try {
      const synth = window.speechSynthesis
      const vs = synth.getVoices?.() || []
      const zh = vs.find((v) => /zh|chinese|中文|普通话/i.test(v.lang))
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'
      if (zh) u.voice = zh
      let done = false
      const finish = (ok: boolean) => {
        if (!done) {
          done = true
          resolve(ok)
        }
      }
      u.onend = () => finish(true)
      u.onerror = () => finish(false)
      synth.speak(u)
      window.setTimeout(() => finish(false), 9000)
    } catch {
      resolve(false)
    }
  })
}

/** 中文段：有道 dictvoice（国内直连、<audio> 媒体锁屏可听）为主，全部失败降级本地 speechSynthesis 中文。 */
async function zhPlay(text: string, rate: number): Promise<boolean> {
  if (typeof window === 'undefined' || !text || !text.trim()) return true
  const ok = await segPlay(text, 2, rate) // type 对中文无意义，占位
  if (ok) return true
  return speakZhLocal(text)
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

export function useRecitePlayer() {
  const items = ref<ReciteItem[]>([])
  const accent = ref<SpeechAccent>('en-US')
  const spell = ref(true) // 逐字母拼写（单词恒拼写；词组受此开关影响）
  const autoplay = ref(true) // 自动连播（到末尾回到开头继续）
  const gapMs = ref(0) // 段间停顿
  const rate = ref(1) // 朗读倍速（0.75 / 1 / 1.25 / 1.5 / 2）
  const repeatCount = ref(1) // 每个词朗读遍数（1 / 2 / 3 / 5）
  const segments = ref<Seg[]>([])
  const cursor = ref(0)
  const playing = ref(false)
  let runToken = 0
  let currentSource = ''

  const currentSeg = computed<Seg | null>(() => segments.value[cursor.value] || null)
  const currentItemIndex = computed(() => currentSeg.value?.itemIndex ?? -1)
  const currentItem = computed<ReciteItem | null>(() => items.value[currentItemIndex.value] || null)
  const progress = computed(() => ({
    index: currentItemIndex.value >= 0 ? currentItemIndex.value + 1 : 0,
    total: items.value.length
  }))

  function rebuild() {
    const prev = currentItemIndex.value
    const segs: Seg[] = []
    items.value.forEach((it, i) => {
      const doSpell = it.kind === 'word' || spell.value
      if (doSpell) {
        const letters = (it.text || '').replace(/[^a-zA-Z]/g, '').toUpperCase().split('')
        letters.forEach((L, p) => segs.push({ itemIndex: i, kind: 'letter', text: L, letterPos: p }))
        segs.push({ itemIndex: i, kind: 'whole', text: it.text })
      } else {
        segs.push({ itemIndex: i, kind: 'whole', text: it.text })
      }
      segs.push({ itemIndex: i, kind: 'zh', text: it.zh })
    })
    segments.value = segs
    const idx = segs.findIndex((s) => s.itemIndex === prev)
    cursor.value = idx >= 0 ? idx : 0
  }

  // 切换「逐字母」开关时重建队列，并停留在本词
  watch(spell, () => rebuild())

  function firstSegOf(i: number): number {
    const idx = segments.value.findIndex((s) => s.itemIndex === i)
    return idx >= 0 ? idx : 0
  }

  /** 记忆：当前读到第几个词（按来源分别记录） */
  function persist() {
    if (!currentSource) return
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ source: currentSource, index: Math.max(0, currentItemIndex.value) }))
    } catch {
      /* 隐私模式等忽略 */
    }
  }
  /** 读取某来源上次读到的词序号（无记录/不匹配返回 0） */
  function loadProgressIndex(source: string): number {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY)
      if (!raw) return 0
      const o = JSON.parse(raw)
      if (o && o.source === source && typeof o.index === 'number') return o.index
    } catch {
      /* ignore */
    }
    return 0
  }

  // ===== Media Session：锁屏控制条（灭屏也能暂停 / 上一词 / 下一词）=====
  // 朗读走单一 <audio> 媒体播放，系统锁屏默认只显示播放/暂停；注册 metadata + action handler
  // 后可在锁屏展示当前词条（标题=英文 / 副标题=中文 / 专辑=来源）并直接控制切词。
  const sourceLabel = ref('朗读中心')
  const SOURCE_LABELS: Record<string, string> = { cards: '背单词卡', phrase: '词组', cet4: '四级单词' }
  const MS_ARTWORK =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
        '<rect width="96" height="96" rx="18" fill="#185fa5"/>' +
        '<text x="48" y="66" font-size="54" text-anchor="middle" fill="#ffffff" font-family="sans-serif">读</text>' +
        '</svg>'
    )

  function updateMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const it = currentItem.value
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: it ? it.text : '智习·朗读中心',
        artist: it ? it.zh || sourceLabel.value : sourceLabel.value,
        album: '智习·朗读中心 · ' + sourceLabel.value,
        artwork: [{ src: MS_ARTWORK, sizes: '96x96', type: 'image/svg+xml' }]
      })
    } catch {
      /* 旧浏览器不支持 metadata */
    }
  }
  function updateMediaState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.playbackState = playing.value ? 'playing' : 'paused'
    } catch {
      /* ignore */
    }
  }
  function setupMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.setActionHandler('play', () => play())
      navigator.mediaSession.setActionHandler('pause', () => pause())
      navigator.mediaSession.setActionHandler('previoustrack', () => prev())
      navigator.mediaSession.setActionHandler('nexttrack', () => next())
    } catch {
      /* 部分浏览器不支持某些 action */
    }
  }
  function teardownMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    ;(['play', 'pause', 'previoustrack', 'nexttrack'] as const).forEach((a) => {
      try {
        ms.setActionHandler(a, null)
      } catch {
        /* ignore */
      }
    })
  }

  async function run() {
    const token = ++runToken
    playing.value = true
    let curItem = -1
    let repeatLeft = 0
    while (playing.value && token === runToken) {
      if (cursor.value >= segments.value.length) {
        if (autoplay.value && items.value.length) {
          cursor.value = 0
          curItem = -1
        } else {
          playing.value = false
          break
        }
      }
      if (!playing.value || token !== runToken) break
      const seg = segments.value[cursor.value]
      if (!seg) {
        playing.value = false
        break
      }
      // 进入新词：重置重复计数 + 记忆进度
      if (seg.itemIndex !== curItem) {
        curItem = seg.itemIndex
        repeatLeft = repeatCount.value
        persist()
      }
      let ok: boolean
      if (seg.kind === 'zh') {
        ok = await zhPlay(seg.text, rate.value)
      } else {
        const vType = accent.value === 'en-GB' ? 1 : 2
        ok = await segPlay(seg.text, vType, rate.value)
        // 在线英文失败 → 降级本地/在线 speechSynthesis（亮屏）
        if (!ok) await speakEn(seg.text, rate.value, accent.value)
      }
      if (token !== runToken || !playing.value) break
      if (gapMs.value > 0) await wait(gapMs.value)
      if (token !== runToken || !playing.value) break
      // 该词是否为最后一段（zh 是每词末段）；未播够遍数则回到词首重读
      const nextSeg = segments.value[cursor.value + 1]
      const isItemEnd = !nextSeg || nextSeg.itemIndex !== seg.itemIndex
      if (isItemEnd && repeatLeft > 1) {
        repeatLeft--
        cursor.value = firstSegOf(curItem)
        continue
      }
      cursor.value++
    }
    playing.value = false
  }

  function play() {
    if (!segments.value.length) return
    if (cursor.value >= segments.value.length) cursor.value = 0
    run()
  }
  function pause() {
    playing.value = false
    runToken++
    pauseAudio()
  }
  function toggle() {
    playing.value ? pause() : play()
  }
  function playItem(i: number) {
    if (i < 0 || i >= items.value.length) return
    cursor.value = firstSegOf(i)
    persist()
    play()
  }
  function next() {
    const i = currentItemIndex.value
    if (i < items.value.length - 1) playItem(i + 1)
  }
  function prev() {
    const i = currentItemIndex.value
    if (i > 0) playItem(i - 1)
  }
  function repeat() {
    const i = currentItemIndex.value
    if (i >= 0) {
      cursor.value = firstSegOf(i)
      play()
    }
  }
  function stop() {
    playing.value = false
    runToken++
    pauseAudio()
    cursor.value = 0
  }
  function setItems(list: ReciteItem[], a?: SpeechAccent, spellMode?: boolean, source?: string, startIndex?: number) {
    items.value = list
    if (a) accent.value = a
    if (typeof spellMode === 'boolean') spell.value = spellMode
    currentSource = source || ''
    sourceLabel.value = SOURCE_LABELS[source || ''] || source || '朗读中心'
    cursor.value = 0
    rebuild()
    // 续读：定位到上次进度所在词（首次进入/切回来源时生效）
    if (typeof startIndex === 'number' && startIndex > 0 && startIndex < items.value.length) {
      cursor.value = firstSegOf(startIndex)
    }
  }

  // 注册锁屏控制条（仅浏览器支持时生效）；进度/来源变化同步 metadata，播放态同步 playbackState
  setupMediaSession()
  updateMediaSession()
  watch([currentItem, sourceLabel], updateMediaSession)
  watch(playing, updateMediaState)
  onBeforeUnmount(() => {
    teardownMediaSession()
    stop()
  })

  return {
    items,
    currentItem,
    currentItemIndex,
    currentSeg,
    progress,
    playing,
    accent,
    spell,
    autoplay,
    rate,
    repeatCount,
    gapMs,
    play,
    pause,
    toggle,
    playItem,
    next,
    prev,
    repeat,
    stop,
    setItems,
    setRate: (r: number) => {
      rate.value = r
    },
    setRepeat: (n: number) => {
      repeatCount.value = n
    },
    loadProgressIndex
  }
}

function pauseAudio() {
  try {
    if (audioEl) {
      audioEl.pause()
      audioEl.onended = null
      audioEl.onerror = null
    }
  } catch {
    /* noop */
  }
  if (currentResolve) {
    const f = currentResolve
    currentResolve = null
    f(false)
  }
}

// 朗读中心 · 顺序朗读播放引擎
// 核心：用单一 HTMLAudioElement 做「队列顺序播放」，每段音频（字母 / 整词 / 中文）
// 通过同一 <audio> 媒体元素 onended 串联。媒体播放属于系统媒体会话，
// Android / iQOO 锁屏后不中断 —— 满足「手机灭屏也能听」。
// 网络异常时降级 speechSynthesis（亮屏）。
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
// 中文 TTS：Google 翻译接口返回 mp3，<audio> 媒体播放，锁屏仍可听；国内镜像优先，海外兜底
const ZH_TTS = [
  'https://translate.google.cn/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=',
  'https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q='
]

let audioEl: HTMLAudioElement | null = null
let currentResolve: ((ok: boolean) => void) | null = null

function getAudio(): HTMLAudioElement {
  if (!audioEl) audioEl = new Audio()
  return audioEl
}

/** 英文/字母段：走有道 dictvoice（免费、国内可直连）。返回是否成功起播完。 */
function segPlay(text: string, accent: SpeechAccent, rate: number): Promise<boolean> {
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
      const vType = accent === 'en-GB' ? 1 : 2
      el.playbackRate = rate
      el.src = `${YOUDAO}?audio=${encodeURIComponent(text)}&type=${vType}`
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

/** 本地 speechSynthesis 读中文（亮屏场景兜底）。 */
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

/** 中文段：优先 Google TTS（<audio> 媒体，锁屏可听），全部候选失败则降级本地 speechSynthesis 中文。 */
async function zhPlay(text: string, rate: number): Promise<boolean> {
  if (typeof window === 'undefined' || !text || !text.trim()) return true
  for (const base of ZH_TTS) {
    const ok = await new Promise<boolean>((resolve) => {
      try {
        const el = getAudio()
        el.playbackRate = rate
        el.src = base + encodeURIComponent(text)
        let done = false
        const finish = (o: boolean) => {
          if (!done) {
            done = true
            el.onended = null
            el.onerror = null
            currentResolve = null
            resolve(o)
          }
        }
        currentResolve = finish
        el.onended = () => finish(true)
        el.onerror = () => finish(false)
        const p = el.play() as Promise<void> | undefined
        if (p && typeof p.catch === 'function') p.catch(() => finish(false))
        window.setTimeout(() => finish(false), 9000)
      } catch {
        resolve(false)
      }
    })
    if (ok) return true
  }
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
  const segments = ref<Seg[]>([])
  const cursor = ref(0)
  const playing = ref(false)
  let runToken = 0

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

  async function run() {
    const token = ++runToken
    playing.value = true
    while (playing.value && token === runToken) {
      if (cursor.value >= segments.value.length) {
        if (autoplay.value && items.value.length) cursor.value = 0
        else {
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
      let ok: boolean
      if (seg.kind === 'zh') {
        // 中文：专用中文 TTS，不降级英文通道
        ok = await zhPlay(seg.text, rate.value)
      } else {
        ok = await segPlay(seg.text, accent.value, rate.value)
        // 在线英文失败 → 降级本地/在线 speechSynthesis（亮屏）
        if (!ok) await speakEn(seg.text, rate.value, accent.value)
      }
      if (token !== runToken || !playing.value) break
      if (gapMs.value > 0) await wait(gapMs.value)
      if (token !== runToken || !playing.value) break
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
  function setItems(list: ReciteItem[], a?: SpeechAccent, spellMode?: boolean) {
    items.value = list
    if (a) accent.value = a
    if (typeof spellMode === 'boolean') spell.value = spellMode
    cursor.value = 0
    rebuild()
  }

  onBeforeUnmount(stop)

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
    rebuild
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

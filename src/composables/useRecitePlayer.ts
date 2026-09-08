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

let audioEl: HTMLAudioElement | null = null
let currentResolve: ((ok: boolean) => void) | null = null

function segPlay(text: string, accent: SpeechAccent): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      resolve(false)
      return
    }
    if (!text || !text.trim()) {
      resolve(true)
      return
    }
    try {
      audioEl = audioEl || new Audio()
      const el = audioEl
      const vType = accent === 'en-GB' ? 1 : 2
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
      // 兜底：单段最长等 20s，避免网络异常时永久悬挂
      window.setTimeout(() => finish(false), 20000)
    } catch {
      resolve(false)
    }
  })
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

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

export function useRecitePlayer() {
  const items = ref<ReciteItem[]>([])
  const accent = ref<SpeechAccent>('en-US')
  const spell = ref(true) // 逐字母拼写（单词恒拼写；词组受此开关影响）
  const autoplay = ref(true) // 自动连播（到末尾回到开头继续）
  const gapMs = ref(0) // 段间停顿
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
      const ok = await segPlay(seg.text, accent.value)
      if (token !== runToken || !playing.value) break
      // 在线音频失败 → 降级本地/在线 speechSynthesis（亮屏）
      if (!ok) await speakEn(seg.text, 0.95, accent.value)
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
    rebuild
  }
}

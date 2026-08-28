// 学位英语 2.0 · 通用语音朗读 + 免费划词翻译（复用 DegreeEnglishView 的成熟实现，统一出口）
// 语音：浏览器内置 SpeechSynthesis（离线可用、免费）；翻译：MyMemory 公开 API（无需 Key、免费）。
import { ElMessage } from 'element-plus'

let voicesWarmed = false
export function warmVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const tryWarm = () => {
    const v = window.speechSynthesis.getVoices()
    if (v.length) voicesWarmed = true
  }
  tryWarm()
  if (!voicesWarmed && 'onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = tryWarm
  }
}

function pickEnVoice(): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis.getVoices()
  return (
    vs.find((v) => /en[-_]?(US|GB)/i.test(v.lang)) ||
    vs.find((v) => v.lang.toLowerCase().startsWith('en'))
  )
}

let currentUtterance: SpeechSynthesisUtterance | null = null
let audioCtx: AudioContext | null = null
function unlockAudioContext() {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audioCtx = audioCtx || new Ctor()
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  } catch {
    /* noop */
  }
}

/* ===== 在线发音降级（有道 dictvoice：免费、无需 Key、国内可直连）=====
   背景：iQOO / vivo / 华为 / 小米等国产 Android 自带浏览器基于 Chromium，
   但系统未内置英文 TTS 引擎 —— speechSynthesis 接口存在、调用不报错、
   却静默无声（onstart 不触发）。因此在检测到无可用英文语音时，
   自动改用在线音频，保证「点得响」。 */
const SPEECH_ENGINE_KEY = 'zxs_speech_engine'
export type SpeechEngine = 'auto' | 'online' | 'local'

export function getSpeechEngine(): SpeechEngine {
  try {
    const v = localStorage.getItem(SPEECH_ENGINE_KEY)
    if (v === 'online' || v === 'local' || v === 'auto') return v
  } catch {
    /* noop */
  }
  return 'auto'
}
export function setSpeechEngine(v: SpeechEngine) {
  try {
    localStorage.setItem(SPEECH_ENGINE_KEY, v)
  } catch {
    /* noop */
  }
}

/** 供 UI 展示：当前是否检测到系统英文语音（null=列表尚未就绪） */
export function detectEnVoiceNow(): boolean | null {
  warmVoices()
  return hasEnVoice()
}

let onlineAudio: HTMLAudioElement | null = null
/** 在线发音（有道 dictvoice）。resolve(true)=已起播 */
function playOnline(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      resolve(false)
      return
    }
    let settled = false
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true
        resolve(ok)
      }
    }
    try {
      onlineAudio = onlineAudio || new Audio()
      const el = onlineAudio
      el.onplaying = () => done(true)
      el.onerror = () => done(false)
      // type=2 美音 / type=1 英音
      el.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`
      const p = el.play()
      if (p && typeof p.then === 'function') p.then(() => done(true)).catch(() => done(false))
      // 网络慢/被拦截时兜底，避免 Promise 悬挂
      window.setTimeout(() => done(false), 3500)
    } catch {
      done(false)
    }
  })
}

/** 是否存在可用英文语音；null=语音列表尚未就绪（首次加载常见） */
function hasEnVoice(): boolean | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const vs = window.speechSynthesis.getVoices?.() || []
  if (!vs.length) return null
  return vs.some((v) => /^en/i.test(v.lang || ''))
}

/** 本地 TTS，带「起播验证」：700ms 内未触发 onstart 即判定为静音失败 */
function speakLocal(text: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true
        resolve(ok)
      }
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      done(false)
      return
    }
    try {
      const synth = window.speechSynthesis
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-US'
      u.rate = rate
      const v = pickEnVoice()
      if (v) u.voice = v
      u.onstart = () => done(true)
      u.onerror = () => done(false)
      currentUtterance = u
      try {
        synth.cancel()
      } catch {
        /* noop */
      }
      window.setTimeout(() => {
        try {
          synth.speak(u)
        } catch {
          done(false)
          return
        }
        // pause-resume 兜底：部分内核起播后立刻被挂起
        if (synth.paused) synth.resume()
        window.setTimeout(() => done(false), 700)
      }, 60)
    } catch {
      done(false)
    }
  })
}

/**
 * 朗读英文文本（自动择优：本地 TTS → 在线发音）。
 * - auto（默认）：有系统英文语音用本地（可离线）；无则自动走在线，解决国产浏览器静音问题。
 * - local / online：可在「个人设置 → 发音引擎」强制指定。
 */
export async function speakEn(text: string, rate = 0.95) {
  const t = (text || '').trim()
  if (!t) return
  unlockAudioContext()
  warmVoices()

  const pref = getSpeechEngine()
  const localVoice = hasEnVoice()

  // 1) 本地 TTS（仅确认有英文语音，或用户强制 local 时）
  if (pref === 'local' || (pref === 'auto' && localVoice === true)) {
    const ok = await speakLocal(t, rate)
    if (ok) return
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* noop */
    }
    if (pref === 'local') {
      ElMessage.warning('系统语音未发声，建议在「个人设置 → 发音引擎」改用「在线发音」')
      return
    }
  }

  // 2) 在线发音降级（国产浏览器主力路径）
  const onlineOk = await playOnline(t)
  if (onlineOk) return

  // 3) 兜底：在线失败且本地尚未尝试（语音列表未就绪）时再试本地
  if (pref === 'auto' && localVoice !== true) {
    const ok = await speakLocal(t, rate)
    if (ok) return
  }

  ElMessage.warning('发音不可用：请检查网络，或在「个人设置 → 发音引擎」中切换')
}

/** 免费划词翻译（MyMemory，en→zh-CN，无需 Key）。 */
export function translateText(text: string): Promise<string> {
  const q = (text || '').trim()
  if (!q) return Promise.resolve('')
  return fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|zh-CN`)
    .then((r) => r.json())
    .then((d) => (d?.responseData?.translatedText as string) || '（翻译暂不可用）')
    .catch(() => '（网络异常，翻译失败）')
}

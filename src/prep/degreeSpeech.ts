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

/** 朗读英文文本（内置 TTS，离线可用）。移动端需用户手势触发。 */
export function speakEn(text: string, rate = 0.95) {
  if (!text) return
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    ElMessage.warning('当前浏览器不支持语音朗读，请使用 Chrome / Edge / Safari 重试')
    return
  }
  unlockAudioContext()
  warmVoices()
  const synth = window.speechSynthesis
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = rate
  const voice = pickEnVoice()
  if (voice) u.voice = voice
  currentUtterance = u
  try {
    synth.cancel()
  } catch {
    /* noop */
  }
  window.setTimeout(() => {
    if (!currentUtterance) return
    synth.speak(currentUtterance)
    if (synth.paused) synth.resume()
    let ticks = 0
    const keep = window.setInterval(() => {
      if (!currentUtterance || ticks > 6) {
        window.clearInterval(keep)
        return
      }
      ticks++
      if (synth.paused) synth.resume()
    }, 40)
  }, 80)
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

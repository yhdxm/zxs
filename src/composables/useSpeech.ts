// 英语语音朗读组合式（Vue 侧）。
// 底层 degreeSpeech.speakEn 已升级为「本地 TTS + 在线发音降级」双通道，
// 可覆盖 iQOO / vivo 等国产浏览器（有 speechSynthesis 接口但无英文引擎、静默无声）的场景。
// 额外提供 speaking 响应式状态，便于按钮展示「朗读中」。
import { ref } from 'vue'
import { speakEn } from '../prep/degreeSpeech'

export function useSpeech() {
  const speaking = ref(false)
  // 本地 TTS 与在线 Audio 二者任一可用即可发音
  const isSupported =
    typeof window !== 'undefined' &&
    ('speechSynthesis' in window || typeof Audio !== 'undefined')

  async function speak(text: string) {
    if (!text) return
    // 估算朗读时长，与 speakEn 实际完成取较晚者收尾（跨端无可靠的 end 事件）
    const ms = Math.min(5000, 700 + text.length * 70)
    speaking.value = true
    try {
      await Promise.all([
        speakEn(text),
        new Promise((r) => window.setTimeout(r, ms))
      ])
    } finally {
      speaking.value = false
    }
  }

  return { speak, speaking, isSupported }
}

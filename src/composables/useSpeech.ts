// 英语语音朗读组合式（Vue 侧），基于浏览器内置 SpeechSynthesis（离线、免费）。
// 内部复用 degreeSpeech.speakEn（已处理移动端 AudioContext 解锁 / 英文 voice 选择 / pause-resume 兜底）。
// 额外提供 speaking 响应式状态，便于按钮展示「朗读中」。
import { ref } from 'vue'
import { speakEn } from '../prep/degreeSpeech'

export function useSpeech() {
  const speaking = ref(false)
  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window

  function speak(text: string) {
    if (!text) return
    // 估算朗读时长，用于收尾 speaking 状态（speechSynthesis 无可靠 end 事件跨端一致）
    const ms = Math.min(5000, 700 + text.length * 70)
    speaking.value = true
    speakEn(text)
    window.setTimeout(() => {
      speaking.value = false
    }, ms)
  }

  return { speak, speaking, isSupported }
}

// 英语象形 emoji 组合式（Vue 侧）。vanilla 模块（CET prepApp）直接调 getEmoji / setEmojiOverride。
// 通过模块级响应式版本号，使「自定义覆盖」变更能即时刷新所有消费者。
import { computed, ref } from 'vue'
import { getEmoji as rawGetEmoji, setEmojiOverride } from '../data/emojiDict'

const overridesVersion = ref(0)

/**
 * @param source 返回单词字符串的 getter（可为 () => props.word 或 () => w.word）
 * 返回的 emoji 是 computed，自动随 source 变化；自定义覆盖变更时也会刷新。
 */
export function useEmoji(source: () => string) {
  const emoji = computed(() => {
    // 读取版本号建立依赖，自定义覆盖变更即重算
    void overridesVersion.value
    return rawGetEmoji(source())
  })
  function setCustom(emoji: string) {
    setEmojiOverride(source(), emoji)
    overridesVersion.value++
  }
  return { emoji, setCustom }
}

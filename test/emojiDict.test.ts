import { describe, it, expect, beforeEach } from 'vitest'
import { getEmoji, getEmojiOverride, setEmojiOverride, FALLBACK } from '../src/data/emojiDict'

beforeEach(() => {
  localStorage.clear()
})

describe('emojiDict 象形映射', () => {
  it('已知词返回词典 emoji', () => {
    expect(getEmoji('cat')).toBe('🐱')
    expect(getEmoji('CAT')).toBe('🐱') // 大小写不敏感
    expect(getEmoji('  Sun ')).toBe('☀️')
  })

  it('未知词回退兜底', () => {
    expect(getEmoji('zzzznotaword')).toBe(FALLBACK)
    expect(getEmoji('')).toBe(FALLBACK)
  })

  it('自定义覆盖优先于词典，清空后回退', () => {
    setEmojiOverride('cat', '🦁')
    expect(getEmojiOverride('cat')).toBe('🦁')
    expect(getEmoji('cat')).toBe('🦁')
    setEmojiOverride('cat', '') // 清除
    expect(getEmojiOverride('cat')).toBeUndefined()
    expect(getEmoji('cat')).toBe('🐱')
  })

  it('覆盖按小写 word 存储，跨大小写生效', () => {
    setEmojiOverride('Apple', '🍎')
    expect(getEmoji('APPLE')).toBe('🍎')
  })
})

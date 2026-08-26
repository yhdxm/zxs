import { describe, it, expect } from 'vitest'
import {
  buildQuiz,
  wordWeight,
  type BuildQuizOptions,
  type QuizItem
} from '../src/prep/adaptiveQuiz'
import type { DegreeWord, WordProgress } from '../src/prep/degreeTypes'

const mkWord = (word: string, definition: string): DegreeWord => ({
  word,
  definition,
  productive: false
})

const WORDS: DegreeWord[] = [
  mkWord('apple', '苹果'),
  mkWord('banana', '香蕉'),
  mkWord('cat', '猫'),
  mkWord('dog', '狗'),
  mkWord('sun', '太阳'),
  mkWord('moon', '月亮')
]

describe('adaptiveQuiz 出题引擎', () => {
  it('wordWeight：薄弱/连错高于新词，已毕业为负', () => {
    const today = '2026-08-26'
    const weak: WordProgress = { status: 'learning', level: 2, due: today, weak: true, wrongStreak: 1 }
    const fresh: WordProgress = { status: 'new', level: 0, due: null, weak: false, wrongStreak: 0 }
    const grad: WordProgress = { status: 'graduated', level: 6, due: null, weak: false, wrongStreak: 0 }
    expect(wordWeight(WORDS[0], weak, today)).toBeGreaterThan(wordWeight(WORDS[0], fresh, today))
    expect(wordWeight(WORDS[0], grad, today)).toBeLessThan(0)
  })

  it('buildQuiz：数量、选项数、答案正确（wordToDef）', () => {
    const prog: Record<string, WordProgress> = {}
    const quiz = buildQuiz(WORDS, prog, { count: 3, mode: 'wordToDef' })
    expect(quiz.length).toBe(3)
    quiz.forEach((q: QuizItem) => {
      expect(q.choices.length).toBe(4)
      expect(q.choices[q.answerIndex]).toBe(q.definition)
      expect(q.prompt).toBe(q.word)
    })
  })

  it('buildQuiz：defToWord 答案下标指向正确单词', () => {
    const quiz = buildQuiz(WORDS, {}, { count: 2, mode: 'defToWord' })
    quiz.forEach((q) => {
      expect(q.choices[q.answerIndex]).toBe(q.word)
      expect(q.prompt).toBe(q.definition)
    })
  })

  it('buildQuiz：词库不足时不超过可用数量', () => {
    const quiz = buildQuiz(WORDS.slice(0, 2), {}, { count: 10 })
    expect(quiz.length).toBe(2)
  })

  it('buildQuiz：默认排除已毕业词', () => {
    const prog: Record<string, WordProgress> = {
      apple: { status: 'graduated', level: 6, due: null, weak: false, wrongStreak: 0 }
    }
    // 仅 apple 毕业、其余未学：抽 1 题不应是 apple
    const quiz = buildQuiz(WORDS, prog, { count: 1 })
    expect(quiz.length).toBe(1)
    expect(quiz[0].word).not.toBe('apple')
  })

  it('buildQuiz：rng=0 时优先抽取权重更高者', () => {
    const today = '2026-08-26'
    const weak: WordProgress = { status: 'learning', level: 3, due: today, weak: true, wrongStreak: 3 }
    const words: DegreeWord[] = [mkWord('zebra', '斑马'), mkWord('yoyo', '溜溜球')]
    const prog: Record<string, WordProgress> = { zebra: weak }
    // weak 词排在前，rng=0 始终取 remaining[0]
    const quiz = buildQuiz(words, prog, { count: 1, rng: () => 0 })
    expect(quiz[0].word).toBe('zebra')
  })
})

import { describe, it, expect } from 'vitest'
import {
  buildWeaknessReport,
  attributeByType,
  attributeByReason,
  attributeByQuestion,
  trendBy,
  normalizeType,
  normalizeReason,
  WEAKNESS_MIN_SAMPLE,
  type WeaknessMistakeInput
} from '../src/prep/weakness'

const mk = (over: Partial<WeaknessMistakeInput> = {}): WeaknessMistakeInput => ({
  type: null,
  reason: null,
  questionId: null,
  createdAt: null,
  ...over
})

describe('weakness 归因纯函数', () => {
  it('normalizeType 空值归为「未分类」', () => {
    expect(normalizeType(null)).toBe('未分类')
    expect(normalizeType('  ')).toBe('未分类')
    expect(normalizeType('reading')).toBe('reading')
  })

  it('normalizeReason 空值归为「未标注错因」', () => {
    expect(normalizeReason('')).toBe('未标注错因')
    expect(normalizeReason('词汇不认识')).toBe('词汇不认识')
  })

  it('attributeByType 计数 + 降序 + 占比', () => {
    const items = [mk({ type: 'A' }), mk({ type: 'A' }), mk({ type: 'B' }), mk({ type: null })]
    const r = attributeByType(items)
    expect(r[0]).toMatchObject({ label: 'A', count: 2 })
    expect(r.find((x) => x.label === '未分类')?.count).toBe(1)
    expect(r[0].ratio).toBeCloseTo(0.5)
  })

  it('attributeByReason 常见错因 Top', () => {
    const items = [mk({ reason: '粗心' }), mk({ reason: '粗心' }), mk({ reason: '不会' }), mk({ reason: '' })]
    const r = attributeByReason(items)
    expect(r[0]).toMatchObject({ label: '粗心', count: 2 })
    expect(r.find((x) => x.label === '未标注错因')?.count).toBe(1)
  })

  it('attributeByQuestion 按题号聚合（学位英语）', () => {
    const items = [mk({ questionId: 'q1' }), mk({ questionId: 'q1' }), mk({ questionId: 'q2' })]
    const r = attributeByQuestion(items)
    expect(r[0]).toMatchObject({ label: 'q1', count: 2 })
  })

  it('trendBy month 按月聚合并升序', () => {
    const items = [mk({ createdAt: '2026-01-15' }), mk({ createdAt: '2026-03-02' }), mk({ createdAt: '2026-01-20' })]
    expect(trendBy(items, 'month')).toEqual([
      { period: '2026-01', count: 2 },
      { period: '2026-03', count: 1 }
    ])
  })

  it('trendBy 忽略无效时间', () => {
    const items = [mk({ createdAt: 'not-a-date' }), mk({ createdAt: '2026-02-01' })]
    expect(trendBy(items, 'month')).toEqual([{ period: '2026-02', count: 1 }])
  })

  it('buildWeaknessReport 样本阈值 enough 正确', () => {
    const small = Array.from({ length: WEAKNESS_MIN_SAMPLE - 1 }, () => mk({ type: 'A' }))
    const smallReport = buildWeaknessReport(small)
    expect(smallReport.enough).toBe(false)
    expect(smallReport.total).toBe(WEAKNESS_MIN_SAMPLE - 1)

    const big = Array.from({ length: WEAKNESS_MIN_SAMPLE }, () => mk({ type: 'A' }))
    const bigReport = buildWeaknessReport(big)
    expect(bigReport.enough).toBe(true)
    expect(bigReport.total).toBe(WEAKNESS_MIN_SAMPLE)
  })
})

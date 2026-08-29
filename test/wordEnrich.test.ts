// 单词详情增强服务单测（全部为纯函数，不依赖网络）
import { describe, it, expect } from 'vitest'
import {
  levenshtein,
  computeSimilar,
  buildMnemonic
} from '../src/services/wordEnrichService'

describe('levenshtein 编辑距离', () => {
  it('相同单词距离为 0', () => {
    expect(levenshtein('abandon', 'abandon')).toBe(0)
  })
  it('空串距离为另一个串长度', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })
  it('单字符替换距离为 1', () => {
    expect(levenshtein('cat', 'bat')).toBe(1)
  })
  it('插入与删除可正确计算', () => {
    expect(levenshtein('abandon', 'abandons')).toBe(1)
    expect(levenshtein('monitor', 'monito')).toBe(1)
  })
})

describe('computeSimilar 形近词', () => {
  const pool = ['abandon', 'abundant', 'aboard', 'ability', 'academic', 'monitor', 'absolute']

  it('能找出编辑距离相近的词', () => {
    const sim = computeSimilar('abandon', pool)
    expect(sim).toContain('abundant')
  })
  it('结果不包含原词自身', () => {
    const sim = computeSimilar('abandon', pool)
    expect(sim).not.toContain('abandon')
  })
  it('长度差过大时不参与匹配', () => {
    // disproportionate 与 abandon 长度差 > 3，应被跳过
    const sim = computeSimilar('abandon', ['disproportionate'])
    expect(sim).toHaveLength(0)
  })
  it('空池或空词返回空数组', () => {
    expect(computeSimilar('abandon', [])).toEqual([])
    expect(computeSimilar('', pool)).toEqual([])
  })
  it('按距离升序返回', () => {
    const sim = computeSimilar('monitor', ['monito', 'monitoring', 'monetary', 'monitor'])
    // 'monito' 距离 1，应排在最前（monitoring 长度差 3，monetary 距离 2）
    expect(sim[0]).toBe('monito')
  })
})

describe('buildMnemonic 助记（本地词根词缀规则，离线）', () => {
  it('能识别常见前缀并给出拆分', () => {
    const r = buildMnemonic('unhappy')
    expect(r.real).toBe(true)
    expect(r.text).toContain('un')
  })
  it('能识别常见后缀并给出拆分', () => {
    const r = buildMnemonic('carefulness')
    expect(r.real).toBe(true)
    expect(r.text).toContain('后缀')
  })
  it('能把中文释义并入提示', () => {
    const r = buildMnemonic('unhappy', '不高兴的；悲伤的')
    expect(r.real).toBe(true)
    expect(r.text).toContain('不高兴的')
  })
  it('无可拆分词缀时返回占位标记 real=false', () => {
    const r = buildMnemonic('apple', '苹果')
    expect(r.real).toBe(false)
    expect(r.text).toBe('')
  })
  it('过短单词不生成助记', () => {
    const r = buildMnemonic('ox', '公牛')
    expect(r.real).toBe(false)
  })
  it('空输入安全返回', () => {
    const r = buildMnemonic('')
    expect(r.real).toBe(false)
    expect(r.text).toBe('')
  })
})

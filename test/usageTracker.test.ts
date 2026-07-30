import { describe, it, expect, beforeEach } from 'vitest'
import { classifyFree, recordUsage, getUsageStats, getBailianUsage, clearUsage } from '../src/services/usageTracker'

describe('M9 免费模型判定 classifyFree', () => {
  it('ollama 一律免费', () => {
    expect(classifyFree('ollama', 'llama3')).toBe(true)
  })
  it('openrouter 含 :free 为免费', () => {
    expect(classifyFree('openrouter', 'meta/llama-3-8b:free')).toBe(true)
    expect(classifyFree('openrouter', 'anthropic/claude-3')).toBe(false)
  })
  it('siliconflow 命中开源免费档（deepseek/qwen/glm/llama/qwq）为免费', () => {
    expect(classifyFree('siliconflow', 'deepseek-ai/deepseek-chat')).toBe(true)
    expect(classifyFree('siliconflow', 'Qwen/Qwen2.5-7B')).toBe(true)
    expect(classifyFree('siliconflow', 'some-paid-model')).toBe(false)
  })
  it('zhipu 的 flash 档免费', () => {
    expect(classifyFree('zhipu', 'glm-4-flash')).toBe(true)
    expect(classifyFree('zhipu', 'glm-4-plus')).toBe(false)
  })
  it('deepseek 的 chat/reasoner 近似免费', () => {
    expect(classifyFree('deepseek', 'deepseek-chat')).toBe(true)
    expect(classifyFree('deepseek', 'deepseek-reasoner')).toBe(true)
  })
  it('volcengine seed 系列每日免费额度', () => {
    expect(classifyFree('volcengine', 'doubao-seed-1.6')).toBe(true)
  })
  it('bailian 免费额度档按免费计（用户控制台免费档）；openai-compatible 默认付费', () => {
    expect(classifyFree('bailian', 'qwen-max')).toBe(true)
    expect(classifyFree('openai-compatible', 'gpt-4')).toBe(false)
  })
})

describe('M9 用量统计 getUsageStats', () => {
  beforeEach(() => clearUsage())

  it('记录并统计免费/付费占比', () => {
    recordUsage({ provider: 'ollama', model: 'llama3', promptText: 'hello world', completionText: 'hi' })
    recordUsage({ provider: 'bailian', model: 'qwen-max', promptText: 'a'.repeat(40), completionText: 'b'.repeat(40) })
    const s = getUsageStats()
    expect(s.totalCalls).toBe(2)
    expect(s.freeCalls).toBe(2)
    expect(s.paidCalls).toBe(0)
    expect(s.freeRatio).toBe(100)
  })
})

describe('M9 真实 usage 记录 + 阿里百炼本地用量（Fix #2）', () => {
  beforeEach(() => clearUsage())

  it('传入真实 usage 时记录真实 tokens，否则按字符估算', () => {
    // 估算
    recordUsage({ provider: 'ollama', model: 'llama3', promptText: 'hello', completionText: 'hi' })
    // 真实
    recordUsage({
      provider: 'bailian',
      model: 'qwen-max',
      promptText: 'x'.repeat(100),
      completionText: 'y'.repeat(100),
      realUsage: { promptTokens: 25, completionTokens: 30, totalTokens: 55 }
    })
    const s = getUsageStats()
    expect(s.totalCalls).toBe(2)
    expect(s.bailianUsed).toBe(1)
    const bailian = s.byModel.find((m) => m.model === 'qwen-max')
    expect(bailian?.tokens).toBe(55)
  })

  it('getBailianUsage 仅统计 bailian 调用', () => {
    recordUsage({ provider: 'ollama', model: 'llama3', promptText: 'a', completionText: 'b' })
    recordUsage({ provider: 'bailian', model: 'qwen-turbo', promptText: 'a', completionText: 'b', realUsage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } })
    recordUsage({ provider: 'bailian', model: 'qwen-turbo', promptText: 'a', completionText: 'b', realUsage: { promptTokens: 4, completionTokens: 5, totalTokens: 9 } })
    const u = getBailianUsage()
    expect(u.totalCalls).toBe(2)
    expect(u.totalTokens).toBe(12)
    expect(u.byModel.length).toBe(1)
    expect(u.byModel[0].calls).toBe(2)
  })
})

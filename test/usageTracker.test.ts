import { describe, it, expect, beforeEach } from 'vitest'
import { classifyFree, recordUsage, getUsageStats, clearUsage } from '../src/services/usageTracker'

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
  it('bailian 等默认按付费计', () => {
    expect(classifyFree('bailian', 'qwen-max')).toBe(false)
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
    expect(s.freeCalls).toBe(1)
    expect(s.paidCalls).toBe(1)
    expect(s.freeRatio).toBe(50)
  })
})

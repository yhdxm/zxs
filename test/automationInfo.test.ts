import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// appDataService：组件直接用 refreshSavedUser；aiService / newsService 也各自桩化，
// 因此这里不必提供 aiService 内部所需的 loadOwnAiKey 等导出（避免旧桩缺导出报错）。
const appMocks = vi.hoisted(() => ({
  refreshSavedUser: vi.fn(async () => ({ id: 'u1', email: 'u1@test.com' })),
}))

vi.mock('../src/services/appDataService', () => ({
  refreshSavedUser: appMocks.refreshSavedUser,
}))

// aiService：桩化 AI 配置加载与热点提炼，隔离真实网络。
const aiMocks = vi.hoisted(() => ({
  loadAiConfig: vi.fn(async () => ({ provider: 'openai', model: 'gpt-4', apiKey: 'k', baseUrl: '' })),
  extractHotspotsFromNews: vi.fn(async () => [
    { rank: 1, title: 'AI 完成 B 轮融资', summary: '某 AI 公司完成大额融资', source: '量子位', pubDate: '2024-01-01 10:00' },
  ]),
}))

vi.mock('../src/services/aiService', () => ({
  loadAiConfig: aiMocks.loadAiConfig,
  extractHotspotsFromNews: aiMocks.extractHotspotsFromNews,
}))

// newsService：桩化 fetchNewsAll，避免触达真实 Google News 抓取。
const newsMocks = vi.hoisted(() => ({
  fetchNewsAll: vi.fn(async () => [
    {
      id: 'n1',
      title: 'AI 新模型发布',
      link: 'https://news.example/1',
      source: '量子位',
      pubDate: '',
      pubTimestamp: Date.now(),
      description: 'd',
      thumbnail: '',
    },
  ]),
}))

vi.mock('../src/services/newsService', () => ({
  NEWS_CATEGORIES: [{ key: 'tech', label: '科技', mode: 'topic', value: 'TECHNOLOGY', color: '#0ea5e9' }],
  findCategory: (k: string) => ({ key: k, label: k, mode: 'topic', value: '', color: '#000' }),
  fetchNewsAll: newsMocks.fetchNewsAll,
}))

// element-plus 的 ElMessage：桩化，避免测试时真实挂载消息节点。
const elMocks = vi.hoisted(() => ({
  warning: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: elMocks,
}))

import AutomationInfoView from '../src/views/AutomationInfoView.vue'

const EL_STUBS = {
  'el-button': true,
  'el-input-number': true,
  'el-select': true,
  'el-option': true,
  'el-date-picker': true,
  'el-tag': true,
  'el-empty': true,
  'el-alert': true,
  'el-icon': true,
  'el-input': true,
}

async function mountView() {
  const w = mount(AutomationInfoView, { global: { stubs: EL_STUBS } })
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

describe('M8 沸爻机热点提炼组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appMocks.refreshSavedUser.mockResolvedValue({ id: 'u1', email: 'u1@test.com' })
    aiMocks.loadAiConfig.mockResolvedValue({ provider: 'openai', model: 'gpt-4', apiKey: 'k', baseUrl: '' })
    aiMocks.extractHotspotsFromNews.mockResolvedValue([
      { rank: 1, title: 'AI 完成 B 轮融资', summary: '某 AI 公司完成大额融资', source: '量子位', pubDate: '2024-01-01 10:00' },
    ])
    newsMocks.fetchNewsAll.mockResolvedValue([
      { id: 'n1', title: 'AI 新模型发布', link: 'https://news.example/1', source: '量子位', pubDate: '', pubTimestamp: Date.now(), description: 'd', thumbnail: '' },
    ])
  })

  it('挂载渲染标题与控制栏，并触发 loadAiConfig + refreshSavedUser', async () => {
    const w = await mountView()
    expect(w.text()).toContain('沸爻机')
    expect(appMocks.refreshSavedUser).toHaveBeenCalled()
    expect(aiMocks.loadAiConfig).toHaveBeenCalled()
  })

  it('未填写提取要求时不调用 fetchNewsAll / extractHotspotsFromNews', async () => {
    const w = await mountView()
    w.vm.instruction = ''
    await w.vm.generate()
    await flushPromises()
    expect(newsMocks.fetchNewsAll).not.toHaveBeenCalled()
    expect(aiMocks.extractHotspotsFromNews).not.toHaveBeenCalled()
    expect(elMocks.warning).toHaveBeenCalled()
  })

  it('填写要求后拉取新闻并交给 AI 提炼', async () => {
    const w = await mountView()
    w.vm.instruction = '提取与人工智能相关的融资事件'
    await w.vm.generate()
    await flushPromises()
    expect(newsMocks.fetchNewsAll).toHaveBeenCalledWith({ category: 'tech' })
    expect(aiMocks.extractHotspotsFromNews).toHaveBeenCalled()
    expect(w.vm.results.length).toBeGreaterThan(0)
    expect(w.vm.results[0].title).toBe('AI 完成 B 轮融资')
  })
})

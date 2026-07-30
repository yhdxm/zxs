import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// 把 appDataService 桩化，避免触达真实 Supabase；仅验证组件内的保留天数/过期判定逻辑
const mocks = vi.hoisted(() => ({
  getAppSetting: vi.fn(async () => undefined),
  setAppSetting: vi.fn(async () => {}),
  listAutomationInfo: vi.fn(async () => []),
  deleteAutomationInfo: vi.fn(async () => {}),
  clearExpiredAutomationInfo: vi.fn(async () => 0),
  refreshSavedUser: vi.fn(async () => ({ id: 'u1' })),
}))

vi.mock('../src/services/appDataService', () => ({
  getAppSetting: mocks.getAppSetting,
  setAppSetting: mocks.setAppSetting,
  listAutomationInfo: mocks.listAutomationInfo,
  deleteAutomationInfo: mocks.deleteAutomationInfo,
  clearExpiredAutomationInfo: mocks.clearExpiredAutomationInfo,
  refreshSavedUser: mocks.refreshSavedUser,
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
}

async function mountView() {
  const w = mount(AutomationInfoView, { global: { stubs: EL_STUBS } })
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

describe('M8 自动化缓存保留天数 + 过期判定', () => {
  beforeEach(() => {
    mocks.getAppSetting.mockResolvedValue(undefined)
  })

  it('默认保留 7 天（未配置时写入默认 7）', async () => {
    const w = await mountView()
    expect(w.vm.retentionDays).toBe(7)
    expect(mocks.setAppSetting).toHaveBeenCalledWith('automation_cache_days', 7)
  })

  it('从 app_settings 读取保留天数', async () => {
    mocks.getAppSetting.mockResolvedValue(14)
    const w = await mountView()
    expect(w.vm.retentionDays).toBe(14)
  })

  it('保留天数越界（>365）回退默认 7', async () => {
    mocks.getAppSetting.mockResolvedValue(999)
    const w = await mountView()
    expect(w.vm.retentionDays).toBe(7)
  })

  it('状态判定：已过期 / 即将过期 / 正常 / 缺字段（三态）', async () => {
    const w = await mountView()
    expect(w.vm.cacheState({ expire_at: new Date(Date.now() - 1000).toISOString() })).toBe('expired')
    expect(w.vm.cacheState({ expire_at: new Date(Date.now() + 3600_000).toISOString() })).toBe('expiring')
    expect(w.vm.cacheState({ expire_at: new Date(Date.now() + 86400000).toISOString() })).toBe('normal')
    expect(w.vm.cacheState({ expire_at: '' })).toBe('normal')
    expect(w.vm.cacheState({})).toBe('normal')
  })
})

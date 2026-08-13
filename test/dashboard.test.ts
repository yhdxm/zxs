import { vi } from 'vitest'
import { describe, it, expect, beforeEach } from 'vitest'

/**
 * 可控 Supabase 客户端 mock：覆盖 setup.ts 的全局 proxy，
 * 让 dashboard CRUD 的「成功 / 失败 / 异常 / 实时订阅」分支都可确定性触发。
 * state 用 vi.hoisted 提升到模块顶部，供 vi.mock 工厂与测试共享。
 */
const state = vi.hoisted(() => ({
  queryResult: { data: null as any, error: null as any },
  throwOnQuery: false,
  onCallback: null as ((p: any) => void) | null,
  removeChannelCalled: false,
}))

vi.mock('../src/lib/supabaseClient', () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => builder,
    upsert: () => builder,
  }
  // 使 `await builder` 解析为受控的 queryResult（或按 throwOnQuery 拒绝）
  builder.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
    if (state.throwOnQuery) {
      const e = new Error('simulated network failure')
      return reject ? reject(e) : Promise.reject(e)
    }
    return resolve(state.queryResult)
  }
  const supabase = {
    from: () => builder,
    channel: (_name: string) => {
      const obj: any = {
        on: (_evt: string, _filter: any, cb: any) => {
          state.onCallback = cb
          return obj
        },
        subscribe: () => obj,
      }
      return obj
    },
    removeChannel: () => {
      state.removeChannelCalled = true
    },
  }
  return { supabase }
})

import {
  loadDashboardData,
  saveDashboardData,
  subscribeDashboardChanges,
  type AppDashboardData,
  type DashboardChangeEvent,
} from '../src/services/appDataService'

const emptyData: AppDashboardData = { todos: [], points: [], contents: [] }

describe('数据交互: saveDashboardData（CRUD 写 + 离线降级）', () => {
  beforeEach(() => {
    state.queryResult = { data: null, error: null }
    state.throwOnQuery = false
  })

  it('Supabase 成功（error=null）返回 true', async () => {
    state.queryResult = { data: null, error: null }
    expect(await saveDashboardData('user1', emptyData)).toBe(true)
  })

  it('Supabase 返回 error 时返回 false（离线降级标志，数据暂存内存）', async () => {
    state.queryResult = { data: null, error: { message: 'network down' } }
    expect(await saveDashboardData('user1', emptyData)).toBe(false)
  })

  it('Supabase 抛异常时捕获并返回 false（不崩溃、不挂起）', async () => {
    state.throwOnQuery = true
    expect(await saveDashboardData('user1', emptyData)).toBe(false)
  })
})

describe('数据交互: loadDashboardData（CRUD 读 + 优雅降级）', () => {
  beforeEach(() => {
    state.queryResult = { data: null, error: null }
    state.throwOnQuery = false
  })

  /** 降级路径返回的是「预填充默认工作台数据」：结构有效且非空，而非崩溃/空壳 */
  function expectValidDefault(r: AppDashboardData) {
    expect(Array.isArray(r.todos)).toBe(true)
    expect(Array.isArray(r.points)).toBe(true)
    expect(Array.isArray(r.contents)).toBe(true)
    expect(r.todos.length).toBeGreaterThan(0)
  }

  it('Supabase 返回合法 payload 时解析并返回', async () => {
    state.queryResult = {
      data: {
        payload: {
          todos: [{ id: 't1', title: '任务A', status: 'todo', priority: 'medium', createdAt: new Date().toISOString() }],
          points: [],
          contents: [],
        },
      },
      error: null,
    }
    const r = await loadDashboardData('user1')
    expect(r.todos.length).toBe(1)
    expect(r.todos[0].id).toBe('t1')
    expect(Array.isArray(r.points)).toBe(true)
    expect(Array.isArray(r.contents)).toBe(true)
  })

  it('Supabase error 时降级返回可用默认数据（不抛、不挂起）', async () => {
    state.queryResult = { data: null, error: { message: 'boom' } }
    const r = await loadDashboardData('user1')
    expectValidDefault(r)
  })

  it('payload 缺失（data=null）时降级返回可用默认数据', async () => {
    state.queryResult = { data: null, error: null }
    const r = await loadDashboardData('user1')
    expectValidDefault(r)
  })

  it('Supabase 抛异常时降级返回可用默认数据（离线兜底）', async () => {
    state.throwOnQuery = true
    const r = await loadDashboardData('user1')
    expectValidDefault(r)
  })
})

describe('数据交互: subscribeDashboardChanges（跨端实时同步）', () => {
  beforeEach(() => {
    state.onCallback = null
    state.removeChannelCalled = false
  })

  it('返回可调用的取消订阅函数', () => {
    const unsub = subscribeDashboardChanges('user1', () => {})
    expect(typeof unsub).toBe('function')
    expect(state.onCallback).toBeTruthy()
  })

  it('匹配 user_id 的 INSERT/UPDATE 事件触发 onEvent 回调', () => {
    const events: DashboardChangeEvent[] = []
    subscribeDashboardChanges('user1', (e) => events.push(e))
    state.onCallback!({ eventType: 'INSERT', new: { user_id: 'user1' }, old: {} })
    state.onCallback!({ eventType: 'UPDATE', new: { user_id: 'user1' }, old: {} })
    expect(events).toEqual(['INSERT', 'UPDATE'])
  })

  it('非本用户变更被二次过滤忽略（防匿名策略串号）', () => {
    const events: DashboardChangeEvent[] = []
    subscribeDashboardChanges('user1', (e) => events.push(e))
    state.onCallback!({ eventType: 'INSERT', new: { user_id: 'other-user' }, old: {} })
    expect(events.length).toBe(0)
  })

  it('DELETE 事件映射为 DELETE 类型', () => {
    const events: DashboardChangeEvent[] = []
    subscribeDashboardChanges('user1', (e) => events.push(e))
    state.onCallback!({ eventType: 'DELETE', new: {}, old: { user_id: 'user1' } })
    expect(events).toEqual(['DELETE'])
  })

  it('调用 unsubscribe 触发 removeChannel 取消订阅', () => {
    const unsub = subscribeDashboardChanges('user1', () => {})
    unsub()
    expect(state.removeChannelCalled).toBe(true)
  })
})

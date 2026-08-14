import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---- 可控的 Supabase mock：链式调用返回带 then 的对象，await 末端 resolve currentResult ----
// 真实 Supabase 客户端在链式末端（如 .eq() 之后）是 thenable，await 触发请求并返回 { data, error }。
// mock 让末端对象带 then，error 为真时产品代码会 throw 并进入 catch 分支（登记删除意图 / 入队）。
const currentResult: { data: any; error: any } = { data: null, error: null }
const mkChain = () => {
  const obj: any = {
    select: () => obj,
    eq: () => obj,
    order: () => obj,
    range: () => obj,
    maybeSingle: () => obj,
    delete: () => obj,
    update: () => obj,
    upsert: () => obj,
    insert: () => obj,
    single: () => obj,
    limit: () => obj
  }
  obj.then = (resolve: any) => Promise.resolve(currentResult).then(resolve)
  return obj
}

vi.mock('../src/lib/supabaseClient', () => ({
  supabase: { from: () => mkChain() }
}))
vi.mock('../src/services/appDataService', () => ({
  getSavedUser: async () => ({ id: 'u1', role: 'user' })
}))

import * as reli from '../src/prep/reliability'
import * as cet from '../src/services/cetPrepService'
import * as deg from '../src/prep/degreeService'

const USER = 'u1'

describe('reliability 原语', () => {
  beforeEach(() => {
    localStorage.clear()
    reli.clearQueue()
  })

  it('markDeleted 后 getDeletedIds 能查到', () => {
    reli.markDeleted(USER, 't1', 'id-1')
    expect(reli.getDeletedIds(USER, 't1').has('id-1')).toBe(true)
    expect(reli.isDeleted(USER, 't1', 'id-1')).toBe(true)
  })

  it('不同 user/table 的删除意图互不干扰', () => {
    reli.markDeleted(USER, 't1', 'a')
    reli.markDeleted('u2', 't1', 'a')
    expect(reli.getDeletedIds(USER, 't1').has('a')).toBe(true)
    expect(reli.getDeletedIds('u2', 't1').has('a')).toBe(true)
    expect(reli.getDeletedIds(USER, 't2').has('a')).toBe(false)
  })

  it('enqueue 删除操作去重（同表同 id 只留一条）', () => {
    reli.enqueue({ table: 't1', type: 'delete', id: 'x' })
    reli.enqueue({ table: 't1', type: 'delete', id: 'x' })
    const q = reli.getQueue()
    expect(q.filter((o) => o.type === 'delete' && o.id === 'x')).toHaveLength(1)
  })

  it('enqueue upsert 有 id 按表+id 去重只留最新', () => {
    reli.enqueue({ table: 't1', type: 'upsert', row: { id: 'x', v: 1 } })
    reli.enqueue({ table: 't1', type: 'upsert', row: { id: 'x', v: 2 } })
    const ups = reli.getQueue().filter((o) => o.type === 'upsert')
    expect(ups).toHaveLength(1)
    expect((ups[0] as any).row.v).toBe(2)
  })

  it('enqueue upsert 无 id（如 settings）按表去重只留最新', () => {
    reli.enqueue({ table: 'cet4_prep_settings', type: 'upsert', row: { a: 1 } })
    reli.enqueue({ table: 'cet4_prep_settings', type: 'upsert', row: { a: 2 } })
    const ups = reli.getQueue().filter((o) => o.table === 'cet4_prep_settings')
    expect(ups).toHaveLength(1)
    expect((ups[0] as any).row.a).toBe(2)
  })

  it('镜像读写', () => {
    expect(reli.mirrorGet(USER)).toBeNull()
    reli.mirrorSet(USER, {
      words: {},
      practice: [],
      mistakes: [],
      checkins: {},
      settings: { newPerDay: 10, examDate: null, manualStreak: null, linkedGoal: null }
    })
    expect(reli.mirrorGet(USER)).not.toBeNull()
  })
})

describe('Supabase 报错时删除不丢意图', () => {
  beforeEach(() => {
    localStorage.clear()
    reli.clearQueue()
    currentResult.data = null
    currentResult.error = new Error('network fail') // 模拟所有 Supabase 调用失败
  })

  it('cetPrepService.removeMistake：硬删+软删均失败 → 仍登记删除意图并入离线队列', async () => {
    await cet.removeMistake('mid-1')
    expect(reli.getDeletedIds(USER, 'cet4_prep_mistakes').has('mid-1')).toBe(true)
    const q = reli.getQueue()
    expect(q.some((o) => o.type === 'delete' && o.id === 'mid-1' && o.table === 'cet4_prep_mistakes')).toBe(true)
  })

  it('degreeService.removeFavorite：硬删+软删均失败 → 仍登记删除意图并入离线队列', async () => {
    await deg.removeFavorite('fid-1')
    expect(reli.getDeletedIds(USER, 'degree_favorites').has('fid-1')).toBe(true)
    const q = reli.getQueue()
    expect(q.some((o) => o.type === 'delete' && o.id === 'fid-1' && o.table === 'degree_favorites')).toBe(true)
  })

  it('degreeService.removeMistake：软删失败 → 仍登记删除意图并入离线队列', async () => {
    await deg.removeMistake('mid-1')
    expect(reli.getDeletedIds(USER, 'degree_mistakes').has('mid-1')).toBe(true)
    const q = reli.getQueue()
    expect(q.some((o) => o.type === 'delete' && o.id === 'mid-1' && o.table === 'degree_mistakes')).toBe(true)
  })
})

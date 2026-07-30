import { describe, it, expect } from 'vitest'
import {
  computeDashboardCounts,
  type AppDashboardData,
  type TodoItem,
  type PointItem,
  type ContentItem,
} from '../src/services/appDataService'

// ---- 确定性日期工具：避免依赖“今日”的不确定性 ----
const NOW = new Date()
const isoNow = () => NOW.toISOString()
const isoDaysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString()

function buildData(
  todos: Array<Partial<TodoItem>>,
  points: Array<Partial<PointItem>>,
  contents: Array<Partial<ContentItem>>
): AppDashboardData {
  return {
    todos: todos.map(
      (t, i) =>
        ({
          id: `t${i}`,
          title: t.title ?? `todo${i}`,
          status: t.status ?? 'todo',
          priority: t.priority ?? 'medium',
          createdAt: t.createdAt ?? isoNow(),
          ...t,
        } as TodoItem)
    ),
    points: points.map(
      (p, i) =>
        ({
          id: `p${i}`,
          name: p.name ?? `point${i}`,
          address: p.address ?? '',
          note: p.note ?? '',
          status: p.status ?? 'pending',
          createdAt: p.createdAt ?? isoNow(),
          ...p,
        } as PointItem)
    ),
    contents: contents.map(
      (c, i) =>
        ({
          id: `c${i}`,
          title: c.title ?? `content${i}`,
          content: c.content ?? '',
          date: c.date ?? isoNow().slice(0, 10),
          time: c.time ?? '09:00',
          image: c.image ?? '',
          createdAt: c.createdAt ?? isoNow(),
          ...c,
        } as ContentItem)
    ),
  }
}

describe('M6 看板统计口径 computeDashboardCounts', () => {
  it('点位：剔除「已巡查(done)」不计入看板，且总条数 = 剔除后 - 今日新增', () => {
    const data = buildData(
      [],
      [
        { status: 'pending', createdAt: isoNow() }, // 未巡查 + 今日
        { status: 'pending', createdAt: isoDaysAgo(1) }, // 未巡查 + 昨日
        { status: 'issue', createdAt: isoNow() }, // 异常 + 今日
        { status: 'done', createdAt: isoNow() }, // 已巡查 → 剔除
        { status: 'done', createdAt: isoDaysAgo(5) }, // 已巡查 → 剔除
      ],
      []
    )
    const r = computeDashboardCounts(data)
    // 剔除 2 条 done 后剩余 3 条；其中 2 条(pending今日 + issue今日)为新增
    expect(r.points.total).toBe(3)
    expect(r.points.newCount).toBe(2)
    expect(r.points.count).toBe(1) // 3 - 2
  })

  it('内容：剔除「已完成(done)」不计入看板', () => {
    const data = buildData(
      [],
      [],
      [
        { status: 'undone', createdAt: isoNow() },
        { status: 'undone', createdAt: isoDaysAgo(1) },
        { status: 'done', createdAt: isoNow() }, // 已完成 → 剔除
        { status: 'done', createdAt: isoNow() }, // 已完成 → 剔除
      ]
    )
    const r = computeDashboardCounts(data)
    // 剔除 2 条 done 后剩余 2 条；其中 1 条(undone今日)为新增
    expect(r.contents.total).toBe(2)
    expect(r.contents.newCount).toBe(1)
    expect(r.contents.count).toBe(1) // 2 - 1
  })

  it('待办：done 仍计入看板（与点位/内容口径不同）', () => {
    const data = buildData(
      [
        { status: 'done', createdAt: isoNow() }, // 已完成 + 今日 → 仍计入
        { status: 'done', createdAt: isoNow() }, // 已完成 + 今日 → 仍计入
        { status: 'doing', createdAt: isoDaysAgo(1) },
        { status: 'todo', createdAt: isoNow() },
      ],
      [],
      []
    )
    const r = computeDashboardCounts(data)
    // 全部 4 条计入；3 条今日新增(done*2 + todo)
    expect(r.todos.total).toBe(4)
    expect(r.todos.newCount).toBe(3)
    expect(r.todos.count).toBe(1) // 4 - 3
  })

  it('新增口径：仅 createdAt 日期等于今日才算新增（昨日不算）', () => {
    const data = buildData(
      [
        { status: 'todo', createdAt: isoNow() },
        { status: 'todo', createdAt: isoDaysAgo(1) },
        { status: 'todo', createdAt: isoDaysAgo(2) },
      ],
      [],
      []
    )
    const r = computeDashboardCounts(data)
    expect(r.todos.total).toBe(3)
    expect(r.todos.newCount).toBe(1)
    expect(r.todos.count).toBe(2)
  })

  it('空数据返回全 0', () => {
    const r = computeDashboardCounts(buildData([], [], []))
    expect(r.todos).toEqual({ total: 0, newCount: 0, count: 0 })
    expect(r.points).toEqual({ total: 0, newCount: 0, count: 0 })
    expect(r.contents).toEqual({ total: 0, newCount: 0, count: 0 })
  })

  it('count 不为负：Math.max(0, ...) 兜底', () => {
    // 理论上 newCount <= total，但防御性验证
    const data = buildData([{ status: 'todo', createdAt: isoNow() }], [], [])
    const r = computeDashboardCounts(data)
    expect(r.todos.count).toBeGreaterThanOrEqual(0)
  })
})

import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ModuleManager from '../src/components/ModuleManager.vue'
import type { AppDashboardData, TodoItem, PointItem, ContentItem } from '../src/services/appDataService'

const iso = () => new Date().toISOString()
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString()

const EL_STUBS = {
  'el-input': true,
  'el-date-picker': true,
  'el-select': true,
  'el-option': true,
  'el-button': true,
  'el-dropdown': true,
  'el-dropdown-menu': true,
  'el-dropdown-item': true,
  'el-dialog': true,
  'el-form': true,
  'el-form-item': true,
  'el-tag': true,
  'el-icon': true,
}

function makeDashboard(
  todos: Array<Partial<TodoItem>>,
  points: Array<Partial<PointItem>>,
  contents: Array<Partial<ContentItem>>
): AppDashboardData {
  return {
    todos: todos.map((t, i) => ({ id: `t${i}`, title: t.title ?? `t${i}`, status: t.status ?? 'todo', priority: t.priority ?? 'medium', createdAt: t.createdAt ?? iso(), ...t } as TodoItem)),
    points: points.map((p, i) => ({ id: `p${i}`, name: p.name ?? `p${i}`, address: '', note: '', status: p.status ?? 'pending', createdAt: p.createdAt ?? iso(), ...p } as PointItem)),
    contents: contents.map((c, i) => ({ id: `c${i}`, title: c.title ?? `c${i}`, content: '', date: c.date ?? '2024-01-01', time: '09:00', image: '', createdAt: c.createdAt ?? iso(), ...c } as ContentItem)),
  }
}

function mountMgr(type: 'todos' | 'points' | 'contents', dashboard: AppDashboardData) {
  return mount(ModuleManager, { props: { type, dashboard }, global: { stubs: EL_STUBS } })
}

describe('M6 状态优先级排序（ModuleManager.filteredList）', () => {
  it('点位：异常 > 待巡查 > 已巡查，同状态按日期倒序', () => {
    const dashboard = makeDashboard(
      [],
      [
        { id: 'p_done', status: 'done', createdAt: iso() },
        { id: 'p_pending_today', status: 'pending', createdAt: iso() },
        { id: 'p_issue', status: 'issue', createdAt: iso() },
        { id: 'p_pending_yest', status: 'pending', createdAt: daysAgo(1) },
      ],
      []
    )
    const order = mountMgr('points', dashboard).vm.filteredList.map((x: any) => x.id)
    expect(order).toEqual(['p_issue', 'p_pending_today', 'p_pending_yest', 'p_done'])
  })

  it('待办：优先级 高>中>低；同级 未开始>进行中>已完成；再按日期倒序', () => {
    const dashboard = makeDashboard(
      [
        { id: 'high_todo', status: 'todo', priority: 'high', createdAt: iso() },
        { id: 'low_doing', status: 'doing', priority: 'low', createdAt: iso() },
        { id: 'med_todo', status: 'todo', priority: 'medium', createdAt: iso() },
        { id: 'high_done', status: 'done', priority: 'high', createdAt: iso() },
      ],
      [],
      []
    )
    const order = mountMgr('todos', dashboard).vm.filteredList.map((x: any) => x.id)
    expect(order).toEqual(['high_todo', 'high_done', 'med_todo', 'low_doing'])
  })

  it('内容：未完成 > 已完成', () => {
    const dashboard = makeDashboard(
      [],
      [],
      [
        { id: 'c_done', status: 'done', createdAt: iso() },
        { id: 'c_undone1', status: 'undone', createdAt: iso() },
        { id: 'c_undone2', status: 'undone', createdAt: iso() },
      ]
    )
    const order = mountMgr('contents', dashboard).vm.filteredList.map((x: any) => x.id)
    expect(order).toEqual(['c_undone1', 'c_undone2', 'c_done'])
  })
})

describe('M6 模块内交互（点击/输入有响应，防“没反应”回归）', () => {
  it('搜索框输入实时过滤列表（交互生效）', async () => {
    const dashboard = makeDashboard(
      [
        { title: '苹果待办' },
        { title: '香蕉待办' },
        { title: '橙子待办' },
      ],
      [],
      []
    )
    const wrapper = mountMgr('todos', dashboard)
    expect(wrapper.vm.filteredList.length).toBe(3)
    const input = wrapper.findComponent({ name: 'ElInput' })
    await input.setValue('苹果')
    await nextTick()
    expect(wrapper.vm.filteredList.length).toBe(1)
    expect(wrapper.vm.filteredList[0].title).toBe('苹果待办')
  })

  it('清空搜索后恢复全部列表', async () => {
    const dashboard = makeDashboard([{ title: 'A任务' }, { title: 'B任务' }], [], [])
    const wrapper = mountMgr('todos', dashboard)
    const input = wrapper.findComponent({ name: 'ElInput' })
    await input.setValue('A')
    await nextTick()
    expect(wrapper.vm.filteredList.length).toBe(1)
    await input.setValue('')
    await nextTick()
    expect(wrapper.vm.filteredList.length).toBe(2)
  })

  it('待办状态筛选下拉改变 filteredList（下拉交互生效）', async () => {
    const dashboard = makeDashboard(
      [
        { title: '已完成项', status: 'done' },
        { title: '未开始项', status: 'todo' },
      ],
      [],
      []
    )
    const wrapper = mountMgr('todos', dashboard)
    expect(wrapper.vm.filteredList.length).toBe(2)
    // 切换为“已完成”过滤
    wrapper.vm.todoFilter = 'done'
    await nextTick()
    expect(wrapper.vm.filteredList.length).toBe(1)
    expect(wrapper.vm.filteredList[0].title).toBe('已完成项')
  })
})

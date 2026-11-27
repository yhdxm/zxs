/**
 * GAPDESK 审查修复的聚焦回归：
 *  1) 跨导航后 useCloudSync 能重新注册（syncBound 复位 + 多实例引用计数）
 *  2) 登录后本地/云端稍后读合并不丢条目
 *  3) 证据链晚到请求不覆盖当前事件（竞态串台）
 *  4) 时间窗与采集闸门同源（静态契约，防止后续改回双真源）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cloudStub = vi.hoisted(() => ({ useCloudSync: vi.fn() }))
vi.mock('../src/composables/useCloudSync', () => ({ useCloudSync: cloudStub.useCloudSync }))

const detailStub = vi.hoisted(() => ({ loadEventDetail: vi.fn() }))
vi.mock('../src/services/gapdeskService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/gapdeskService')>()
  return { ...actual, loadEventDetail: detailStub.loadEventDetail }
})

import GapRightCol from '../src/components/gapdesk/GapRightCol.vue'
import {
  GAP_WINDOW_OPTIONS,
  mergeLaterIds,
  useGapDesk,
  useGapDeskRealtime
} from '../src/composables/useGapDesk'
import type { RankedEvent } from '../src/types/gapdesk'

const readSource = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8')
const store = useGapDesk()

function makeRanked(id: number, title: string, tier: RankedEvent['tier'] = 'L0'): RankedEvent {
  const now = Date.now()
  return {
    id,
    event_key: `fix-${id}`,
    uniq_keep: '',
    title,
    summary: '',
    url: '',
    ind: 'ai',
    dim: 'policy',
    kind: 'insider',
    gap: 90,
    gap_raw: 70,
    b_json: [20, 20, 20, 20],
    tags: [],
    ts_published: now,
    ts_first_seen: now,
    ins_heat: 10,
    pub_heat: 5,
    mass_on: null,
    mass_heat: 0,
    lag_h: 0,
    src_count: 2,
    reason: '',
    action: '',
    is_foreign: false,
    expire_at: '',
    created_at: '',
    updated_at: '',
    tier,
    rank: id
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  cloudStub.useCloudSync.mockClear()
  detailStub.loadEventDetail.mockReset()
  store.evidences.value = []
  store.events.value = []
  store.laterIds.value = []
})

describe('useGapDeskRealtime · 卸载复位后可再次注册', () => {
  it('离开再回来重新注册同步；多实例并存只注册一份', () => {
    const Host = defineComponent({
      setup() {
        useGapDeskRealtime()
        return () => h('div')
      }
    })

    const first = mount(Host)
    expect(cloudStub.useCloudSync).toHaveBeenCalledTimes(1)
    first.unmount()

    const second = mount(Host)
    expect(cloudStub.useCloudSync).toHaveBeenCalledTimes(2)
    second.unmount()

    const a = mount(Host)
    const b = mount(Host)
    expect(cloudStub.useCloudSync).toHaveBeenCalledTimes(3)
    a.unmount()
    const c = mount(Host) // a 走了但 b 还在：不应重复注册
    expect(cloudStub.useCloudSync).toHaveBeenCalledTimes(3)
    b.unmount()
    c.unmount()
  })
})

describe('稍后读合并 · event id 去重且两侧都不丢', () => {
  it('云端按 created_at 排序，本机未同步条目追加在后，重复 id 只留一条', () => {
    expect(mergeLaterIds([3, 2], [
      { event_id: 2, created_at: '2024-01-02T00:00:00Z' },
      { event_id: 1, created_at: '2024-01-03T00:00:00Z' }
    ])).toEqual([1, 2, 3])
    // 只增不减：原有 6/12/24/48 与筛选栏的 3/72 都在导出数组里
    for (const h of [3, 6, 12, 24, 48, 72]) expect(GAP_WINDOW_OPTIONS).toContain(h)
  })
})

describe('GapRightCol · 证据链异步竞态', () => {
  it('A 晚于 B 返回时仍只展示 B 的证据行', async () => {
    const a = deferred<{ data: typeof store.evidences.value; error: string | null }>()
    const b = deferred<{ data: typeof store.evidences.value; error: string | null }>()
    detailStub.loadEventDetail.mockImplementation((id: number) => (id === 1 ? a.promise : b.promise))

    const wrapper = mount(GapRightCol, { props: { event: makeRanked(1, 'A 事件') } })
    await wrapper.setProps({ event: makeRanked(2, 'B 事件') })

    b.resolve({
      data: [{ id: 20, event_id: 2, source_name: '源B', layer: null, publish_ts: 0, heat: null, url: null }],
      error: null
    })
    await nextTick()
    a.resolve({
      data: [{ id: 10, event_id: 1, source_name: '源A', layer: null, publish_ts: 0, heat: null, url: null }],
      error: null
    })
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('源B')
    expect(wrapper.text()).not.toContain('源A')
    wrapper.unmount()
  })
})

describe('采集与镜像契约 · 静态口径', () => {
  it('新鲜度闸门与 48h TTL 同源，局部失败不覆盖好镜像', () => {
    expect(readSource('scripts/gapdesk/collect.mjs')).toContain('freshnessGate(items, TTL_HOURS)')
    expect(readSource('src/composables/useGapDesk.ts')).toContain('if (res.error === null) cacheSet(CACHE_KEY, res.data)')
  })

  it('登录后稍后读合并后写回本地镜像', () => {
    const src = readSource('src/composables/useGapDesk.ts')
    expect(src).toContain('mergeLaterIds(localBeforeLogin, later.data)')
    expect(src).toContain('JSON.stringify(laterIds.value)')
  })
})

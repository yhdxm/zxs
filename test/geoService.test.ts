import { describe, it, expect, beforeEach } from 'vitest'
import { haversine, readFreeApiKey, writeFreeApiKey, tiandituTileUrl, OSM_TILE_URL } from '../src/services/geoService'

describe('M9b 公里测距 haversine', () => {
  it('杭州 vs 上海 距离落在合理区间 (~165-175km)', () => {
    const hangzhou = { lat: 30.2741, lon: 120.1551 }
    const shanghai = { lat: 31.2304, lon: 121.4737 }
    const d = haversine(hangzhou, shanghai)
    expect(d).toBeGreaterThanOrEqual(160)
    expect(d).toBeLessThanOrEqual(175)
  })

  it('相同坐标距离为 0', () => {
    const a = { lat: 39.9042, lon: 116.4074 }
    expect(haversine(a, a)).toBeCloseTo(0, 6)
  })

  it('对称性：haversine(a,b) === haversine(b,a)', () => {
    const a = { lat: 22.5431, lon: 114.0579 } // 深圳
    const b = { lat: 23.1291, lon: 113.2644 } // 广州
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 9)
  })

  it('参数约定：必须传 {lat, lon}（经度），仅传 {lat, lng} 会因读取 .lon 为 undefined 得到 NaN', () => {
    // 调用方（MapPanel.recalcDistance）负责把 {lat,lng} 映射到 {lat,lon}，
    // 若直接把 {lat,lng} 当作入参，.lon 为 undefined → 结果为 NaN，证明转换不可或缺。
    const bad = haversine(
      { lat: 30.2741, lng: 120.1551 } as unknown as { lat: number; lon: number },
      { lat: 31.2304, lng: 121.4737 } as unknown as { lat: number; lon: number }
    )
    expect(Number.isNaN(bad)).toBe(true)
  })

  it('经度/纬度不可互换：交换后距离明显不同', () => {
    const a = { lat: 30.2741, lon: 120.1551 }
    const b = { lat: 31.2304, lon: 121.4737 }
    const correct = haversine(a, b)
    const swapped = haversine({ lat: a.lon, lon: a.lat }, { lat: b.lon, lon: b.lat })
    expect(swapped).not.toBeCloseTo(correct, 1)
  })
})

describe('M9 免费 API Key 本地读写（天地图/天行）', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('readFreeApiKey 从 localStorage 的 zxs_free_apis 读取对应 provider', async () => {
    window.localStorage.setItem(
      'zxs_free_apis',
      JSON.stringify({ tianditu: 'TDT-KEY', tianxing: 'TX-KEY' })
    )
    expect(await readFreeApiKey('tianditu')).toBe('TDT-KEY')
    expect(await readFreeApiKey('tianxing')).toBe('TX-KEY')
  })

  it('readFreeApiKey 缺失/解析失败返回空串', async () => {
    expect(await readFreeApiKey('tianditu')).toBe('')
    window.localStorage.setItem('zxs_free_apis', 'not-json')
    expect(await readFreeApiKey('tianxing')).toBe('')
  })

  it('writeFreeApiKey 合并写入，不覆盖其它 provider', () => {
    writeFreeApiKey('tianditu', 'A')
    writeFreeApiKey('tianxing', 'B')
    const raw = JSON.parse(window.localStorage.getItem('zxs_free_apis') as string)
    expect(raw).toEqual({ tianditu: 'A', tianxing: 'B' })
  })
})

describe('M9b 天地图瓦片 URL（Fix #7）', () => {
  it('LAYER 参数必须为 vec / cva（不含 _w），路径段保留 _w', () => {
    const vec = tiandituTileUrl('vec', 'MYKEY')
    expect(vec).toContain('/vec_w/wmts')
    expect(vec).toContain('LAYER=vec')
    expect(vec).not.toContain('LAYER=vec_w')
    expect(vec).toContain('tk=MYKEY')

    const cva = tiandituTileUrl('cva', 'MYKEY')
    expect(cva).toContain('/cva_w/wmts')
    expect(cva).toContain('LAYER=cva')
    expect(cva).not.toContain('LAYER=cva_w')
  })

  it('OSM 降级瓦片 URL 正确', () => {
    expect(OSM_TILE_URL).toContain('{s}.tile.openstreetmap.org')
    expect(OSM_TILE_URL).toContain('{z}/{x}/{y}.png')
  })
})

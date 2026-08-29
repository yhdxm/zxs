// 按新逻辑直连真实接口验证（与 tencentFinance.ts 实现保持一致）
function toNum(v) { const n = parseFloat(v || ''); return Number.isNaN(n) ? 0 : n }
function marketOf(code) {
  if (code.startsWith('hf_')) return 'foreign'
  if (code.startsWith('us')) return 'us'
  if (code.startsWith('hk') || code.startsWith('r_hk')) return 'hk'
  return /^(sh|sz)\d{6}$/.test(code) && /^(sh000|sz399)/.test(code) ? 'cn-index' : 'cn-stock'
}
function supportsKline(code) { return marketOf(code) !== 'foreign' }
function klineCodeOf(code) { return marketOf(code) === 'hk' ? code.replace(/^r_/, '') : code }
function responseKeyOf(code) { return marketOf(code) === 'us' ? 'us.' + code.replace(/^us/, '') : klineCodeOf(code) }
function toPoints(rows, limit) {
  if (!Array.isArray(rows)) return []
  return rows.slice(-limit).map((row) => {
    if (Array.isArray(row)) return { date: String(row[0] || '').slice(0, 10), open: toNum(row[1]), close: toNum(row[2]), high: toNum(row[3]), low: toNum(row[4]), volume: toNum(row[5]) }
    return { date: String(row.date || '').slice(0, 10), open: toNum(row.open), close: toNum(row.close), high: toNum(row.high), low: toNum(row.low), volume: toNum(row.volume) }
  }).filter((p) => p.close > 0)
}
const PERIOD_PARAM = { day: 'day', week: 'week', month: 'month', quarter: 'month' }

async function fetchKlineWithMeta(code, period, limit = 120) {
  const empty = { points: [], prevClose: 0, source: 'none' }
  if (!supportsKline(code) && period !== 'minute') return empty
  try {
    if (period === 'minute') {
      const r = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`, { signal: AbortSignal.timeout(9000) })
      const json = await r.json()
      const node = json?.data?.[code]?.data
      if (!node || !Array.isArray(node.data)) return empty
      const parsed = node.data.map((row) => { const p = String(row).split(' '); return { date: p[0] || '', price: toNum(p[1]), cumVol: toNum(p[2]) } }).filter((p) => p.price > 0)
      let prevCum = 0
      const points = parsed.map((p, i) => { const vol = i === 0 ? p.cumVol : Math.max(0, p.cumVol - prevCum); prevCum = p.cumVol; return { date: p.date, open: p.price, close: p.price, high: p.price, low: p.price, volume: vol } })
      const prevClose = toNum(node.qt?.[code]?.[4] ?? node.preClose ?? 0)
      return { points: points.slice(-limit), prevClose, source: 'minute/query' }
    }
    const p = PERIOD_PARAM[period]
    const kCode = klineCodeOf(code)
    const kind = marketOf(code)
    const url = kind === 'cn-stock'
      ? `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${kCode},${p},,,${limit},qfq`
      : `https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=${kCode},${p},,,${limit}`
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) })
    const json = await r.json()
    const node = json?.data?.[responseKeyOf(code)]
    if (!node) return empty
    const keys = kind === 'cn-stock' ? ['qfq' + p, p] : [p, 'qfq' + p]
    let arr = null
    for (const k of keys) { if (Array.isArray(node[k])) { arr = node[k]; break } }
    const points = toPoints(arr, limit)
    if (!points.length) return empty
    return { points, prevClose: 0, source: kind === 'cn-stock' ? 'fqkline/get' : 'kline/kline' }
  } catch (e) { return { ...empty, err: String(e) } }
}

const cases = [
  ['sh000001', 'day'], ['sh000001', 'week'], ['sh000001', 'month'], ['sh000001', 'quarter'],
  ['sh600519', 'day'], ['sz300750', 'week'],
  ['usDJI', 'day'], ['usIXIC', 'week'], ['usINX', 'month'],
  ['hkHSI', 'day'], ['r_hkHSI', 'day'], ['hkHSTECH', 'week'], ['hkHSCEI', 'month'],
  ['hf_XAU', 'day']
]
for (const [c, p] of cases) {
  const res = await fetchKlineWithMeta(c, p, 60)
  const last = res.points[res.points.length - 1]
  console.log(
    (c + '/' + p).padEnd(20),
    'n=' + String(res.points.length).padEnd(4),
    res.source.padEnd(13),
    last ? `last ${last.date} O${last.open} C${last.close} H${last.high} L${last.low} V${last.volume}` : 'NO DATA'
  )
}
const mm = await fetchKlineWithMeta('sh000001', 'minute', 300)
console.log('MINUTE sh000001 n=' + mm.points.length, 'prevClose=' + mm.prevClose, 'first=', JSON.stringify(mm.points[0]), 'last=', JSON.stringify(mm.points[mm.points.length - 1]))
const volSum = mm.points.reduce((s, p) => s + p.volume, 0)
console.log('  分时量合计=' + volSum.toFixed(0), '（差分后应≈当日总量而非逐分钟累加的累计值）')
const hf = await fetchKlineWithMeta('hf_XAU', 'minute', 60)
console.log('MINUTE hf_XAU n=' + hf.points.length)

async function kline(code, period, limit = 10) {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${code},${period},,,${limit},qfq`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const j = await r.json()
    const node = j?.data?.[code]
    const key = period === 'day' ? 'qfqday' : period === 'week' ? 'qfqweek' : 'qfqmonth'
    const arr = node?.[key] || node?.qfqday || []
    return { code, period, ok: r.status, n: Array.isArray(arr) ? arr.length : 0, last: Array.isArray(arr) ? arr[arr.length - 1] : null }
  } catch (e) {
    return { code, period, err: String(e) }
  }
}
async function minute(code) {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${code}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const j = await r.json()
    const node = j?.data?.[code]?.data
    const m = node?.minute
    return { code, ok: r.status, n: Array.isArray(m) ? m.length : 0, sample: Array.isArray(m) ? m.slice(-2) : null, keys: node ? Object.keys(node) : null }
  } catch (e) {
    return { code, err: String(e) }
  }
}
const codes = ['sh000001', 'sz399001', 'sh000300', 'sh600519', 'usDJI', 'usIXIC', 'usINX', 'r_hkHSI', 'hkHSTECH', 'r_hkHSCEI', 'hf_XAU', 'hf_CL']
for (const c of codes) console.log('DAY ', JSON.stringify(await kline(c, 'day')))
for (const c of ['sh000001', 'sh600519', 'usDJI', 'hf_XAU']) console.log('MIN ', JSON.stringify(await minute(c)))

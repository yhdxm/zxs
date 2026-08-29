async function raw(url, label, cut = 420) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const t = await r.text()
    console.log('===', label, r.status, 'len', t.length)
    console.log(t.slice(0, cut))
  } catch (e) {
    console.log('===', label, 'ERR', String(e))
  }
}
// 港股各种代码
for (const c of ['hkHSI', 'hkHSTECH', 'hkHSCEI', 'r_hkHSI']) {
  await raw(`https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=${c},day,,,3`, 'HK ' + c)
}
// 外盘商品 mkline
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/mkline?param=hf_XAU,m30,,20', 'HF mkline m30')
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/mkline?param=hf_CL,m30,,20', 'HF CL mkline m30')
// 外盘期货 kline/kline 其它写法
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=hf_XAU,m30,,20', 'HF kline m30')
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=hf_XAU,day,,,3,qfq', 'HF kline qfq')
// A股分钟K
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=sh600519,m30,,20', 'A m30')
// 美股 分钟
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=usDJI,m30,,20', 'US m30')
// 指数周K
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=sh000001,week,,,3', 'INDEX week')
// 分时
await raw('https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh000001', 'MINUTE sh000001', 300)
await raw('https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh600519', 'MINUTE sh600519', 300)

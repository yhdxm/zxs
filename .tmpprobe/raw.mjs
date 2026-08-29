async function raw(url, label) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const t = await r.text()
    console.log('===', label, r.status, 'len', t.length)
    console.log(t.slice(0, 700))
  } catch (e) {
    console.log('===', label, 'ERR', String(e))
  }
}

// 1. 个股 fqq 原始结构
await raw('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,5,qfq', 'STOCK fqkline qfq')
// 2. 指数：不带复权
await raw('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000001,day,,,5,', 'INDEX fqkline no-fq')
// 3. 指数：kline/kline 老接口
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=sh000001,day,,,5', 'INDEX kline/kline')
// 4. 美股
await raw('https://web.ifzq.gtimg.cn/appstock/app/usKline/kline?param=usDJI,day,,,5', 'US usKline')
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=usDJI,day,,,5', 'US kline/kline')
// 5. 港股
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=r_hkHSI,day,,,5', 'HK kline/kline')
// 6. 外盘商品
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=hf_XAU,day,,,5', 'HF kline/kline')
await raw('https://web.ifzq.gtimg.cn/appstock/app/hkKline/kline?param=hf_XAU,day,,,5', 'HF hkKline')

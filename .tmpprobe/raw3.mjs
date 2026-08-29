async function raw(url, label, cut = 300) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const t = await r.text()
    console.log('===', label, r.status, 'len', t.length, t.slice(0, cut))
  } catch (e) {
    console.log('===', label, 'ERR', String(e))
  }
}
// A股分钟K 各种参数格式
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=sh600519,m30,,,20', 'A m30 a')
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/mkline?param=sh600519,m30,,20', 'A m30 mkline')
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=sh600519,m5,,,20', 'A m5')
// 外盘商品 K线 各种尝试
await raw('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=hf_XAU,day,,,10', 'HF fqkline')
await raw('https://web.ifzq.gtimg.cn/appstock/app/newfqkline/get?param=hf_XAU,day,,,10,qfq', 'HF newfqkline')
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=hf_XAU,day,,,10,', 'HF trailing')
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/mkline?param=hf_XAU,m30,,20', 'HF mkline2')
// 外盘分时
await raw('https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=hf_XAU', 'HF minute', 200)
// 美股月K
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=usDJI,month,,,6', 'US month', 260)
// 港股周K
await raw('https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param=hkHSI,week,,,6', 'HK week', 260)

const j = await (await fetch('https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh000001')).json()
const top = j.data.sh000001
console.log('top keys:', Object.keys(top))
console.log('qt type:', Array.isArray(top.qt) ? 'array' : typeof top.qt)
console.log('qt sample:', JSON.stringify(top.qt).slice(0, 400))
const d = top.data
console.log('data keys:', Object.keys(d))
for (const k of Object.keys(d)) {
  const v = d[k]
  console.log('  ', k, Array.isArray(v) ? 'array len=' + v.length : typeof v, Array.isArray(v) ? '' : JSON.stringify(v).slice(0,200))
}

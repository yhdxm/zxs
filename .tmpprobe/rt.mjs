const codes = [
  'sh000001', 'sz399001', 'sz399006', 'sh000300', 'sh000016', 'sh000905',
  'usDJI', 'usIXIC', 'usINX', 'r_hkHSI', 'hkHSTECH', 'r_hkHSCEI',
  'hf_XAU', 'hf_XAG', 'hf_GC', 'hf_SI', 'hf_CL', 'hf_OIL', 'hf_NG', 'hf_CAD',
  'sh600519', 'sz300750', 'sz002594', 'sh601318', 'sh600036', 'sh600276',
  'hkHSI', 'hkHSCEI'
]
const url = 'https://qt.gtimg.cn/q=' + codes.join(',')
const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
const buf = Buffer.from(await r.arrayBuffer())
let text
try {
  text = new TextDecoder('gbk').decode(buf)
} catch {
  text = buf.toString('latin1')
}
console.log('status', r.status, 'len', text.length)
for (const line of text.split('\n')) {
  const m = line.match(/^v_(\S+?)="([\s\S]*)";$/)
  if (!m) continue
  const code = m[1]
  const body = m[2]
  if (!body.trim()) { console.log('EMPTY  ', code); continue }
  if (code.startsWith('hf_')) {
    const p = body.split(',')
    console.log('HF     ', code, '| name=', p[13], '| price=', p[0], '| pct=', p[1], '| prev=', p[7], '| open=', p[8], '| time=', p[12], p[6])
  } else {
    const p = body.split('~')
    console.log('QUOTE  ', code, '| name=', p[1], '| price=', p[3], '| prev=', p[4], '| open=', p[5], '| chg=', p[31], '| pct=', p[32], '| high=', p[33], '| low=', p[34], '| time=', p[30])
  }
}

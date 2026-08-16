import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())

const degreeText = fs.readFileSync(path.join(root, 'src/prep/degreeWords.ts'), 'utf-8')
const degreeEntries = []
const degreeRegex = /\{ word: '([^']+)', phonetic: '([^']*)', definition: '([^']*)', productive: (true|false), sourceBooks: \[([^\]]*)\] \}/g
let m
while ((m = degreeRegex.exec(degreeText))) {
  degreeEntries.push({ word: m[1], definition: m[3].replace(/\\'/g, "'") })
}

const cet4Text = fs.readFileSync(path.join(root, 'scripts/cet4_words.csv'), 'utf-8')
const refMap = new Map()
for (const line of cet4Text.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue
  const parts = line.split(',')
  if (parts.length < 4) continue
  const [word, _phonetic, pos, definition] = parts
  refMap.set(word.trim().toLowerCase(), { pos, definition })
}

function extractPosPrefix(def) {
  const match = def.match(/^(n\.|v\.|a\.|ad\.|prep\.|conj\.|pron\.|art\.|num\.|int\.|vt\.|vi\.|t\.|ut\.|ot\.)\s*/)
  if (!match) return null
  return match[1]
}

function normalizePos(p) {
  return p.replace(/\.$/, '').toLowerCase()
}

let suspicious = 0
const examples = []
for (const e of degreeEntries) {
  const key = e.word.toLowerCase()
  const ref = refMap.get(key)
  if (!ref) continue
  const degreePos = extractPosPrefix(e.definition)
  if (!degreePos) continue
  const refPosSet = new Set(ref.pos.toLowerCase().split(/\//).map(s => s.trim()))
  const degPosNorm = normalizePos(degreePos)
  // 映射 degree 到 reference 的 pos 命名
  const posMap = { a: 'adj', ad: 'adv' }
  const mappedDeg = posMap[degPosNorm] || degPosNorm
  if (!refPosSet.has(mappedDeg)) {
    suspicious++
    if (examples.length < 30) {
      examples.push({ word: e.word, degreeDef: e.definition, degreePos, refPos: ref.pos, refDef: ref.definition })
    }
  }
}

console.log('degreeWords 总数:', degreeEntries.length)
console.log('CET4 覆盖:', degreeEntries.filter(e => refMap.has(e.word.toLowerCase())).length)
console.log('词性不匹配（可疑）:', suspicious)
console.log('\n前 30 例：')
for (const ex of examples) {
  console.log(`- ${ex.word}`)
  console.log(`  当前: [${ex.degreePos}] ${ex.degreeDef.substring(0, 60)}`)
  console.log(`  参考: [${ex.refPos}] ${ex.refDef.substring(0, 60)}`)
}

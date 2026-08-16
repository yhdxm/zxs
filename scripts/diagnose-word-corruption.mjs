import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())

// 读取 degreeWords.ts 文本
const degreeText = fs.readFileSync(path.join(root, 'src/prep/degreeWords.ts'), 'utf-8')
const degreeEntries = []
const degreeRegex = /\{ word: '([^']+)', phonetic: '([^']*)', definition: '([^']*)', productive: (true|false), sourceBooks: \[([^\]]*)\] \}/g
let m
while ((m = degreeRegex.exec(degreeText))) {
  degreeEntries.push({ word: m[1], definition: m[3].replace(/\\'/g, "'") })
}
console.log('degreeWords 总数:', degreeEntries.length)

// 读取 CET4 csv
const cet4Text = fs.readFileSync(path.join(root, 'scripts/cet4_words.csv'), 'utf-8')
const cet4Map = new Map()
for (const line of cet4Text.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue
  const parts = line.split(',')
  if (parts.length < 4) continue
  const [word, phonetic, pos, definition] = parts
  cet4Map.set(word.trim().toLowerCase(), { word: word.trim(), phonetic, pos, definition })
}
console.log('CET4 总数:', cet4Map.size)

// 读取 masterWordsBundle.ts
const masterText = fs.readFileSync(path.join(root, 'src/prep/masterWordsBundle.ts'), 'utf-8')
const masterMap = new Map()
const masterRegex = /\[\s*"([^"]+)",\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\]/g
while ((m = masterRegex.exec(masterText))) {
  masterMap.set(m[1].toLowerCase(), { word: m[1], phonetic: m[2], pos: m[3], definition: m[4], example: m[5] || '' })
}
console.log('masterWords 总数:', masterMap.size)

let inCet4 = 0
let inMaster = 0
let inBoth = 0
let inNeither = 0
for (const e of degreeEntries) {
  const key = e.word.toLowerCase()
  const hasCet4 = cet4Map.has(key)
  const hasMaster = masterMap.has(key)
  if (hasCet4) inCet4++
  if (hasMaster) inMaster++
  if (hasCet4 && hasMaster) inBoth++
  if (!hasCet4 && !hasMaster) inNeither++
}
console.log('degreeWords 在 CET4 中:', inCet4)
console.log('degreeWords 在 masterWords 中:', inMaster)
console.log('degreeWords 在两者中:', inBoth)
console.log('degreeWords 不在两者中:', inNeither)

// 输出前 30 个可疑条目：definition 中出现明显不匹配的 pos 标签或包含其他词释义
const suspicious = []
for (const e of degreeEntries.slice(0, 100)) {
  const def = e.definition
  // 启发式：definition 里同时出现多种词性前缀，或长度异常
  const posTags = (def.match(/\b(n\.|v\.|a\.|ad\.|prep\.|conj\.|pron\.|art\.|num\.|int\.|vt\.|vi\.|ut\.|ot\.)\b/g) || []).length
  if (posTags >= 2 || def.length > 40) {
    const ref = cet4Map.get(e.word.toLowerCase()) || masterMap.get(e.word.toLowerCase())
    suspicious.push({ word: e.word, definition: def, ref: ref ? ref.definition : null })
  }
}
console.log('\n前 100 条中可疑条目（多词性或超长）:', suspicious.length)
for (const s of suspicious.slice(0, 30)) {
  console.log(`- ${s.word}: ${s.definition.substring(0, 60)}`)
  if (s.ref) console.log(`  参考: ${s.ref.substring(0, 60)}`)
}

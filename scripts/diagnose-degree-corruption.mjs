import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const degreeText = fs.readFileSync(path.join(root, 'src/prep/degreeWords.ts'), 'utf-8')

const entryRegex = /\{ word: '((?:[^'\\]|\\.)*)', phonetic: '((?:[^'\\]|\\.)*)', definition: '((?:[^'\\]|\\.)*)', productive: (true|false), sourceBooks: (\[[^\]]*\]) \}/g
const entries = []
let m
while ((m = entryRegex.exec(degreeText))) {
  entries.push({
    word: m[1],
    phonetic: m[2].replace(/\\'/g, "'"),
    definition: m[3].replace(/\\'/g, "'")
  })
}

// 词性前缀
const posRegex = /\b(n\.|v\.|a\.|ad\.|prep\.|conj\.|pron\.|art\.|num\.|int\.|vt\.|vi\.|t\.|ut\.|ot\.)\b/g

function corruptionScore(def) {
  let score = 0
  const posTags = (def.match(posRegex) || []).length
  if (posTags >= 2) score += 3
  if (posTags >= 3) score += 5
  if (def.length > 35) score += 2
  if (def.length > 60) score += 3
  // 包含明显不属于一个释义的分隔符，如 | 或大量分号
  if (def.includes('|')) score += 4
  // 包含明显错位特征：" prep." 出现在非介词常用词中（粗略）
  return score
}

const corrupted = entries
  .map(e => ({ ...e, score: corruptionScore(e.definition) }))
  .filter(e => e.score >= 4)
  .sort((a, b) => b.score - a.score)

console.log(`总词数: ${entries.length}, 明显疑似错配: ${corrupted.length}`)
console.log('\nTop 100 疑似错配（按严重度排序）：')
for (const e of corrupted.slice(0, 100)) {
  console.log(`[${e.score}] ${e.word}: ${e.definition.substring(0, 70)}`)
}

// 统计不同严重度
console.log('\n严重度分布:')
console.log('score>=4:', corrupted.filter(e => e.score >= 4).length)
console.log('score>=6:', corrupted.filter(e => e.score >= 6).length)
console.log('score>=8:', corrupted.filter(e => e.score >= 8).length)

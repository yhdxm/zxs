import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())

function posToDegree(pos) {
  const map = {
    n: 'n.', v: 'v.', adj: 'a.', adv: 'ad.', prep: 'prep.', conj: 'conj.',
    pron: 'pron.', art: 'art.', num: 'num.', int: 'int.', vt: 'vt.', vi: 'vi.'
  }
  return map[pos] || `${pos}.`
}

// 读取 degreeWords.ts
const degreePath = path.join(root, 'src/prep/degreeWords.ts')
let degreeText = fs.readFileSync(degreePath, 'utf-8')

// 读取 CET4 csv
const cet4Text = fs.readFileSync(path.join(root, 'scripts/cet4_words.csv'), 'utf-8')
const refMap = new Map()
for (const line of cet4Text.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue
  const parts = line.split(',')
  if (parts.length < 4) continue
  const [word, phonetic, pos, definition] = parts
  const key = word.trim().toLowerCase()
  refMap.set(key, { word: word.trim(), phonetic, pos, definition })
}

// 读取 masterWordsBundle.ts（补充 CET4 没有但 degree 有的词）
const masterText = fs.readFileSync(path.join(root, 'src/prep/masterWordsBundle.ts'), 'utf-8')
const masterRegex = /\[\s*"([^"]+)",\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\]/g
let m
while ((m = masterRegex.exec(masterText))) {
  const key = m[1].toLowerCase()
  if (!refMap.has(key)) {
    refMap.set(key, { word: m[1], phonetic: m[2], pos: m[3], definition: m[4] })
  }
}

let replaced = 0
let notFound = 0
let unchanged = 0

// 逐条替换：保留原行的 productive/sourceBooks，替换 definition/phonetic
const seen = new Set()
degreeText = degreeText.replace(
  /\{ word: '([^']+)', phonetic: '([^']*)', definition: '([^']*)', productive: (true|false), sourceBooks: (\[[^\]]*\]) \}/g,
  (match, word, _oldPhonetic, _oldDef, productive, sourceBooks) => {
    const key = word.toLowerCase()
    if (seen.has(key)) return match
    seen.add(key)
    const ref = refMap.get(key)
    if (!ref) {
      notFound++
      unchanged++
      return match
    }
    const newDef = `${posToDegree(ref.pos)}${ref.definition}`
    const newPhonetic = (ref.phonetic || '').replace(/'/g, "\\'")
    replaced++
    return `{ word: '${word}', phonetic: '${newPhonetic}', definition: '${newDef.replace(/'/g, "\\'")}', productive: ${productive}, sourceBooks: ${sourceBooks} }`
  }
)

fs.writeFileSync(degreePath, degreeText)
console.log(`完成。替换 ${replaced} 条，未找到参考 ${notFound} 条。`)

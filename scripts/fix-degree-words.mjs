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

function escapeSingleQuotes(str) {
  return str.replace(/'/g, "\\'")
}

function normalizeWord(word) {
  return word.trim().toLowerCase().replace(/\s+/g, ' ')
}

// 从 degree 词形生成候选匹配键（处理美式/英式、括号、等号、斜杠等变体）
function candidateKeys(word) {
  const base = normalizeWord(word)
  const candidates = [base]
  // 处理 a/an, ad = advertisement, anybody=anyone, bike=bicycle 等
  if (base.includes('=')) {
    const parts = base.split('=').map(s => s.trim()).filter(Boolean)
    candidates.push(...parts)
  }
  // 处理 analyze/-se, center/-re, colo(u)r 等
  const variants = [
    [/-se\b/, ''], [/\(se\)/, ''], [/\(u\)/, ''], [/\(u\)r/, 'r'],
    [/\(u\)rful/, 'rful'], [/\(re\)/, ''], [/\(gue\)/, ''], [/-re\b/, ''],
    [/\(te\)/, ''], [/\(ce\)/, ''], [/\(our\)/, 'or'], [/\(or\)/, 'our'],
    [/\(ise\)/, 'ize'], [/\(ize\)/, 'ise'], [/\(logue\)/, 'log'],
    [/\(log\)/, 'logue'], [/\(disk\)/, 'disc'], [/\(disc\)/, 'disk'],
    [/\(er\)/, 're'], [/\(re\)/, 'er'], [/\(m\)/, ''], [/\(gramme\)/, 'gram'],
    [/\(gram\)/, 'gramme']
  ]
  for (const [regex, repl] of variants) {
    const v = base.replace(regex, repl)
    if (v !== base && !candidates.includes(v)) candidates.push(v)
  }
  // 去掉所有非字母数字字符再试一次
  const stripped = base.replace(/[^a-z0-9]/g, '')
  if (stripped && stripped !== base && !candidates.includes(stripped)) candidates.push(stripped)
  return candidates
}

// 读取参考词库
const refMap = new Map()

const cet4Text = fs.readFileSync(path.join(root, 'scripts/cet4_words.csv'), 'utf-8')
for (const line of cet4Text.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue
  const parts = line.split(',')
  if (parts.length < 4) continue
  const [word, phonetic, pos, definition] = parts
  const key = word.trim().toLowerCase()
  if (!refMap.has(key)) {
    refMap.set(key, { word: word.trim(), phonetic, pos, definition })
  }
}

const masterText = fs.readFileSync(path.join(root, 'src/prep/masterWordsBundle.ts'), 'utf-8')
const masterRegex = /\[\s*"([^"]+)",\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\]/g
let m
while ((m = masterRegex.exec(masterText))) {
  const key = m[1].toLowerCase()
  if (!refMap.has(key)) {
    refMap.set(key, { word: m[1], phonetic: m[2], pos: m[3], definition: m[4] })
  }
}

function findRef(word) {
  for (const key of candidateKeys(word)) {
    const ref = refMap.get(key)
    if (ref) return ref
  }
  return null
}

// 读取 degreeWords.ts
const degreePath = path.join(root, 'src/prep/degreeWords.ts')
const degreeText = fs.readFileSync(degreePath, 'utf-8')

// 提取数组主体
const startIdx = degreeText.indexOf('export const degreeWords: DegreeWord[] = [')
const endIdx = degreeText.lastIndexOf(']')
if (startIdx === -1 || endIdx === -1) {
  console.error('无法定位数组主体')
  process.exit(1)
}
const prefix = degreeText.slice(0, startIdx)
const arrayBody = degreeText.slice(startIdx, endIdx + 1)
const suffix = degreeText.slice(endIdx + 1)

let replaced = 0
let notFound = 0

// 匹配单条：允许 definition/phonetic 内部含转义单引号
const entryRegex = /\{ word: '((?:[^'\\]|\\.)*)', phonetic: '((?:[^'\\]|\\.)*)', definition: '((?:[^'\\]|\\.)*)', productive: (true|false), sourceBooks: (\[[^\]]*\]) \}/g
const newArrayBody = arrayBody.replace(entryRegex, (match, word, _oldPhonetic, _oldDef, productive, sourceBooks) => {
  const ref = findRef(word)
  if (!ref) {
    notFound++
    return match
  }
  const newDef = `${posToDegree(ref.pos)}${ref.definition}`
  const newPhonetic = escapeSingleQuotes(ref.phonetic || '')
  replaced++
  return `{ word: '${escapeSingleQuotes(word)}', phonetic: '${newPhonetic}', definition: '${escapeSingleQuotes(newDef)}', productive: ${productive}, sourceBooks: ${sourceBooks} }`
})

fs.writeFileSync(degreePath, prefix + newArrayBody + suffix)
console.log(`完成。替换 ${replaced} 条，未找到参考 ${notFound} 条。`)

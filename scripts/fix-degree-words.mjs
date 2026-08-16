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
  let candidates = [base]

  // 1. 等号连接：a/an, ad = advertisement, anybody=anyone, bike=bicycle
  if (base.includes('=')) {
    const parts = base.split('=').map(s => s.trim()).filter(Boolean)
    candidates.push(...parts)
  }

  // 2. 斜杠连接变体：analyze/-se, center/-re, first-rate, easy-going
  //    将 "x/-y" 视为 x 或 xy；"x/y" 视为 x 或 y
  if (base.includes('/')) {
    const expanded = []
    for (const c of candidates) {
      const parts = c.split('/')
      // 对每一对相邻部分，尝试合并或单独使用
      const tryCombine = (arr, i) => {
        if (i >= arr.length) return ['']
        const rest = tryCombine(arr, i + 1)
        const cur = arr[i].trim()
        const result = []
        // 当前部分单独作为开头
        for (const r of rest) result.push((cur + r).trim())
        // 当前部分与下一部分合并（去掉开头 '-'）
        if (cur.startsWith('-') && i + 1 < arr.length) {
          const merged = (arr[i + 1].trim() + cur.slice(1) + (rest.length > 0 ? rest[0].replace(arr[i + 1].trim(), '') : '')).trim()
          // 简单处理：合并 cur 去掉 - 与下一部分
          const next = arr[i + 1].trim()
          const combined = next + cur.slice(1)
          for (const r of rest.slice(1).length ? rest.slice(1) : ['']) result.push((combined + r).trim())
        }
        return result
      }
      // 简化为：把所有 / 去掉，以及把 /-suffix 合并到前项
      expanded.push(c.replace(/\//g, ''))
      expanded.push(c.replace(/\/(-?\w+)/g, '$1'))
      const slashParts = c.split('/')
      if (slashParts.length === 2) {
        expanded.push(slashParts[0].trim())
        expanded.push(slashParts[1].trim())
        if (slashParts[1].trim().startsWith('-')) {
          expanded.push(slashParts[0].trim() + slashParts[1].trim().slice(1))
        }
      }
    }
    candidates.push(...expanded)
  }

  // 3. 括号可选：colo(u)r, behavio(u)r, ax(e), gram(me), analyze/-se 中 (se)
  const expanded = []
  for (const c of candidates) {
    // 找到所有括号段，生成包含/不包含两种组合
    const parts = c.split(/(\([^)]+\))/g).filter(Boolean)
    function gen(i) {
      if (i >= parts.length) return ['']
      const rest = gen(i + 1)
      const part = parts[i]
      const out = []
      if (part.startsWith('(') && part.endsWith(')')) {
        const inside = part.slice(1, -1)
        for (const r of rest) out.push(r) // 去掉括号
        for (const r of rest) out.push(inside + r) // 保留内容
      } else {
        for (const r of rest) out.push(part + r)
      }
      return out
    }
    expanded.push(...gen(0))
  }
  candidates.push(...expanded)

  // 4. 去掉所有非字母数字字符（兜底）
  const stripped = base.replace(/[^a-z0-9]/g, '')
  if (stripped && stripped !== base) candidates.push(stripped)

  // 去重、过滤空字符串
  return [...new Set(candidates.map(s => s.trim()).filter(Boolean))]
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

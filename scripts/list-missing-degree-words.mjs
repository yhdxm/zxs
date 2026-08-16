import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const degreeText = fs.readFileSync(path.join(root, 'src/prep/degreeWords.ts'), 'utf-8')
const cet4Text = fs.readFileSync(path.join(root, 'scripts/cet4_words.csv'), 'utf-8')
const masterText = fs.readFileSync(path.join(root, 'src/prep/masterWordsBundle.ts'), 'utf-8')

const refSet = new Set()
for (const line of cet4Text.split(/\r?\n/).slice(1)) {
  const word = line.split(',')[0]
  if (word) refSet.add(word.trim().toLowerCase())
}
const masterRegex = /\[\s*"([^"]+)",/g
let m
while ((m = masterRegex.exec(masterText))) {
  refSet.add(m[1].toLowerCase())
}

const entryRegex = /\{ word: '((?:[^'\\]|\\.)*)', phonetic: '((?:[^'\\]|\\.)*)', definition: '((?:[^'\\]|\\.)*)', productive: (true|false), sourceBooks: (\[[^\]]*\]) \}/g
const missing = []
while ((m = entryRegex.exec(degreeText))) {
  const word = m[1]
  const def = m[3].replace(/\\'/g, "'")
  let inRef = false
  const key = word.toLowerCase()
  if (refSet.has(key)) inRef = true
  if (!inRef) missing.push({ word, def })
}

console.log('Missing words count:', missing.length)
console.log('\nFirst 200:')
for (const item of missing.slice(0, 200)) {
  console.log(`- ${item.word}: ${item.def.substring(0, 60)}`)
}

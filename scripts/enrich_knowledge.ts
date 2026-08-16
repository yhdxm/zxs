import fs from 'fs'
import path from 'path'

const file = path.resolve('src/services/degreeKnowledge.ts')
const code = fs.readFileSync(file, 'utf8')
const m = code.match(/export const DEGREE_BOOKS: DegreeKnowledgeBook\[\]\s*=\s*(\[[\s\S]*?\])\s*\nexport const DEGREE_KNOWLEDGE_FLAT/)
if (!m) {
  console.error('无法匹配 DEGREE_BOOKS')
  process.exit(1)
}
const books = JSON.parse(m[1])

function cleanSentence(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/#/g, '').trim()
}

function generateSummary(lesson: any): string {
  const body: string[] = (lesson.body || []).map((s: string) => s.trim()).filter(Boolean)
  const title = lesson.title
  // 优先取前两句有意义的句子
  const sentences: string[] = []
  for (const p of body.slice(0, 8)) {
    const clean = cleanSentence(p)
    if (clean.length >= 10 && clean.length <= 200 && !clean.includes('ISBN') && !clean.includes('定价') && !clean.includes('CIP')) {
      sentences.push(clean)
    }
    if (sentences.length >= 2) break
  }
  if (sentences.length === 0) {
    // 退一步：取最长一段
    const longest = body
      .map(cleanSentence)
      .filter((s) => s.length >= 10 && !s.includes('ISBN'))
      .sort((a, b) => b.length - a.length)[0]
    if (longest) sentences.push(longest.slice(0, 120))
  }
  const sum = sentences.join('；').slice(0, 160)
  return sum || `本节讲解「${title}」的核心内容与考试要点。`
}

function needsSummary(s: string | undefined, title: string): boolean {
  if (!s) return true
  if (s === title) return true
  if (s.length < 10) return true
  return false
}

function generateTags(lesson: any): string[] {
  const text = `${lesson.title} ${(lesson.body || []).join(' ')}`.toLowerCase()
  const tags: string[] = []
  const map: Record<string, string[]> = {
    '考试大纲': ['考试大纲'],
    '复习指南': ['复习指南'],
    '完成对话': ['完成对话', '交际用语'],
    '阅读理解': ['阅读理解'],
    '词汇和语法': ['词汇', '语法'],
    '英译汉': ['英译汉', '翻译'],
    '短文写作': ['写作'],
    '虚拟语气': ['虚拟语气'],
    '定语从句': ['定语从句'],
    '时态': ['时态'],
    '被动': ['被动语态'],
    '非谓语': ['非谓语动词'],
    '倒装': ['倒装'],
    '强调': ['强调句'],
    '主谓一致': ['主谓一致'],
    '模拟试卷': ['模拟试卷'],
    '考点': ['考点', '考点点睛']
  }
  for (const [k, v] of Object.entries(map)) {
    if (text.includes(k.toLowerCase())) tags.push(...v)
  }
  return [...new Set(tags)].slice(0, 4)
}

function estimateDuration(lesson: any): number {
  const words = (lesson.body || []).join(' ').split(/\s+/).length
  return Math.max(1, Math.min(30, Math.round(words / 250)))
}

const bookDescMap: Record<string, string> = {
  dagang: '官方考试大纲，明确考试性质、要求、试卷结构、题型、分值与答题时间。',
  zhinan: '系统复习指南，覆盖完成对话、阅读理解、词汇语法、英译汉、短文写作五大题型。',
  moni: '全真模拟试卷与考点点睛，提供 5 套完整模拟题及逐题解析。'
}

for (const book of books) {
  // 修正图书 desc
  book.desc = bookDescMap[book.id] || book.desc
  for (const chapter of book.chapters) {
    const chapterSummaries: string[] = []
    for (const lesson of chapter.lessons) {
      // 清理 dagang 前言正文
      if (book.id === 'dagang' && chapter.id === 'dg-preface' && lesson.id === 'sy000') {
        lesson.body = [
          '《成人学士学位英语水平考试大纲（非英语专业）》（第二版）是学位英语考试的官方指导性文件。',
          '本大纲由教育部学位与研究生教育发展中心组编，高等教育出版社出版。',
          '大纲规定了考试性质、考试要求、试卷结构、题型、题量、记分及答题时间。',
          '考生应依据本大纲制定复习计划，重点掌握 4400 左右词汇及基本语法项目。'
        ]
        lesson.summary = '官方考试大纲说明，包含考试性质、要求、试卷结构与评分标准。'
      } else if (needsSummary(lesson.summary, lesson.title)) {
        lesson.summary = generateSummary(lesson)
      }
      if (!lesson.tags || lesson.tags.length === 0) {
        lesson.tags = generateTags(lesson)
      }
      if (!lesson.duration) {
        lesson.duration = estimateDuration(lesson)
      }
      if (lesson.summary) chapterSummaries.push(lesson.summary)
    }
    if (needsSummary(chapter.summary, chapter.title)) {
      chapter.summary = chapterSummaries.slice(0, 2).join(' ') || `${chapter.title}的系统讲解与练习。`
    }
  }
}

const newArr = JSON.stringify(books, null, 2)
const newCode = code.replace(m[1], newArr)
fs.writeFileSync(file, newCode, 'utf8')
console.log('已 enrich degreeKnowledge.ts：补充摘要、标签、时长，清理 dagang 前言。')

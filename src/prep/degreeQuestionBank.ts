// 学位英语 · 统一训练题库（组合层，不改动自动生成的 degreeQuestions.ts）
// 把三本 PDF 派生数据源（对话 / 阅读 / 翻译）映射为统一的 DegreeQuestion，
// 与内置 degreeQuestions（词汇语法 + 少量真题）合并导出 allDegreeQuestions。
// 答案统一用字母（A/B/C/D），与 DegreeEnglishView 的 optLetter 判定逻辑一致。
import type { DegreeQuestion } from './degreeTypes'
import { degreeQuestions } from './degreeQuestions'
import { DIALOGUE_QUESTIONS } from './dialogueData'
import { READING_PASSAGES } from './readingData'
import { TRANSLATION_ITEMS } from './translateData'

function letterOf(idx: number): string {
  return String.fromCharCode(65 + (idx < 0 ? 0 : idx))
}

// ====== 完成对话（来源：大纲附录八 口语表达，真实场景素材） ======
const dialogueQs: DegreeQuestion[] = DIALOGUE_QUESTIONS.map((d) => {
  const correctIdx = d.options.findIndex((o) => o.correct)
  return {
    id: `dlg${d.id}`,
    type: 'dialogue',
    stem: d.context,
    options: d.options.map((o) => o.text),
    answer: letterOf(correctIdx),
    explanation: d.explanation,
    difficulty: 1,
    source: {
      book: '考试大纲',
      page: 0,
      section: '附录八 口语表达',
      generated: false,
      basis: `大纲附录八 ${d.scene}`
    }
  }
})

// ====== 阅读理解（来源：readingData 真实风格短文，4篇×5题） ======
const readingQs: DegreeQuestion[] = []
for (const p of READING_PASSAGES) {
  for (const q of p.questions) {
    readingQs.push({
      id: `rd${p.id}_${q.id}`,
      type: 'reading',
      stem: q.question,
      passage: p.passage,
      options: q.options.map((o) => o.text),
      answer: letterOf(q.answer),
      explanation: q.explanation,
      difficulty: 2,
      source: {
        book: '复习指南',
        page: 0,
        section: `阅读理解 ${p.title}`,
        generated: false,
        basis: `阅读理解 ${p.title}（${q.type}）`
      }
    })
  }
}

// ====== 英译汉（来源：translateData 常见句型翻译，逐句练习，点击看参考译文） ======
const translationQs: DegreeQuestion[] = TRANSLATION_ITEMS.map((t) => ({
  id: `tr${t.id}`,
  type: 'translation',
  stem: t.en,
  answer: t.zh,
  explanation: t.tips,
  difficulty: 2,
  source: {
    book: '模拟试卷',
    page: 0,
    section: '英译汉',
    generated: false,
    basis: '英译汉 常见句型翻译练习'
  }
}))

// 统一导出：内置题库（词汇语法 + 少量真题）+ 对话 + 阅读 + 翻译
export const allDegreeQuestions: DegreeQuestion[] = [
  ...degreeQuestions,
  ...dialogueQs,
  ...readingQs,
  ...translationQs
]

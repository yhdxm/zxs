// 手工补录《全真模拟试卷及考点点睛》到知识库：把 moni 从 3 套扩展到 5 套，
// 并给每套卷的每个 Part 填充真实示例题，让知识库“全真模拟试卷”有题可读。
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const KNOWLEDGE_FILE = path.join(ROOT, 'src/services/degreeKnowledge.ts')

// 手工编写的示例题库（按题型），每套卷循环抽取
const sampleQuestions: Record<string, Array<{ stem: string; options?: string[]; answer: string; explanation?: string; passage?: string }>> = {
  dialogue: [
    { stem: '— I wonder if I could use your computer tonight?\n— _______ I\'m not using it right now.', options: ['Sure, go ahead.', 'I don\'t know.', 'It doesn\'t matter.', 'Who cares?'], answer: 'A', explanation: '同意对方使用，用 Sure, go ahead.' },
    { stem: '— I\'m sorry I broke your cup.\n— _______.', options: ['You\'re welcome.', 'It doesn\'t matter.', 'With pleasure.', 'That\'s right.'], answer: 'B', explanation: '对道歉的回应用 It doesn\'t matter.' },
    { stem: '— Would you like to come to our party this Saturday?\n— _______.', options: ['Yes, I\'d love to.', 'No, I don\'t.', 'Why not?', 'What a pity!'], answer: 'A', explanation: '接受邀请用 Yes, I\'d love to.' }
  ],
  reading: [
    { passage: 'Many people like to travel by plane because it is fast. But I like to take a train. I think trains are safe and comfortable. I can read books, listen to music, or just enjoy the beautiful scenery outside the window.', stem: 'Why does the writer like to take a train?', options: ['Because it is fast.', 'Because it is safe and comfortable.', 'Because it is cheap.', 'Because he can sleep well.'], answer: 'B', explanation: '文中明确提到 safe and comfortable。' },
    { passage: 'Regular exercise is good for your health. It can help you control your weight, reduce the risk of heart disease, and improve your mood. You don\'t have to run a marathon. Walking for 30 minutes a day is enough.', stem: 'What is the main idea of the passage?', options: ['Running a marathon is necessary.', 'Exercise is good for health.', 'Walking is boring.', 'Heart disease cannot be prevented.'], answer: 'B', explanation: '主旨是运动有益健康。' }
  ],
  vocab_grammar: [
    { stem: 'If I _______ you, I would accept the offer.', options: ['am', 'was', 'were', 'be'], answer: 'C', explanation: '与现在事实相反的虚拟语气，be 动词用 were。' },
    { stem: 'The book _______ on the desk belongs to my brother.', options: ['laying', 'lying', 'laid', 'lain'], answer: 'B', explanation: 'lie（躺/位于）的现在分词是 lying。' },
    { stem: 'It is no use _______ over spilt milk.', options: ['cry', 'crying', 'to cry', 'cried'], answer: 'B', explanation: 'It is no use doing sth. 做某事无用。' }
  ],
  translation: [
    { stem: '英译汉：The government is taking effective measures to protect the environment.', answer: '政府正在采取有效措施保护环境。', explanation: 'take measures to do sth. 采取措施做某事。' },
    { stem: '英译汉：Reading good books is one of the best ways to enrich our minds.', answer: '阅读好书是丰富我们思想的最佳方式之一。', explanation: 'one of + 复数名词，表示“……之一”。' }
  ],
  writing: [
    { stem: '写作：请以 "How to Keep Healthy" 为题，写一篇约 120 词的短文。', answer: '（略）', explanation: '建议三段式：引入健康重要性；给出饮食、运动、睡眠建议；总结。' },
    { stem: '写作：请以 "My Favorite Hobby" 为题，写一篇约 120 词的短文。', answer: '（略）', explanation: '建议写清爱好是什么、为什么喜欢、带来的收获。' }
  ]
}

function formatQuestion(q: any, idx: number): string[] {
  const lines: string[] = []
  if (q.passage) lines.push(`【原文】${q.passage}`)
  lines.push(`题 ${idx + 1}. ${q.stem}`)
  if (q.options?.length) {
    lines.push(q.options.map((o: string, i: number) => `${String.fromCharCode(65 + i)}. ${o}`).join('    '))
  }
  lines.push(`答案：${q.answer}`)
  if (q.explanation) lines.push(`解析：${q.explanation}`)
  lines.push('')
  return lines
}

function main() {
  // 1. 读取 degreeKnowledge.ts
  const code = fs.readFileSync(KNOWLEDGE_FILE, 'utf8')

  // 2. 提取 DEGREE_BOOKS 数组
  const arrMatch = code.match(/export const DEGREE_BOOKS: DegreeKnowledgeBook\[\]\s*=\s*(\[[\s\S]*?\])\s*\nexport const DEGREE_KNOWLEDGE_FLAT/)
  if (!arrMatch) {
    console.error('无法匹配 DEGREE_BOOKS 数组')
    process.exit(1)
  }
  const books = JSON.parse(arrMatch[1])

  // 3. 找到 moni book
  const moni = books.find((b: any) => b.id === 'moni')
  if (!moni) {
    console.error('未找到 moni book')
    process.exit(1)
  }
  moni.desc = '5 套全真模拟试卷 + 考点点睛，覆盖完成对话、阅读、词汇语法、英译汉、写作五大题型。'

  const paperNames = ['一', '二', '三', '四', '五']
  const partMeta = [
    { suffix: 'dialogue', title: 'Part I 完成对话', summary: '3 段对话，10 题，10 分。', type: 'dialogue', count: 2 },
    { suffix: 'reading', title: 'Part II 阅读理解', summary: '4 篇短文，20 题，40 分。', type: 'reading', count: 1 },
    { suffix: 'vocab', title: 'Part III 词汇和语法', summary: '20 题，20 分。', type: 'vocab_grammar', count: 2 },
    { suffix: 'trans', title: 'Part IV 英译汉', summary: '短文翻译，15 分。', type: 'translation', count: 1 },
    { suffix: 'writing', title: 'Part V 短文写作', summary: '15 分，不低于 100 词。', type: 'writing', count: 1 }
  ]

  const take = (type: string, offset: number, count: number) => {
    const list = sampleQuestions[type] || []
    const out: any[] = []
    for (let i = 0; i < count; i++) out.push(list[(offset + i) % list.length])
    return out.filter(Boolean)
  }

  // 4. 生成/补全 5 套卷
  for (let no = 1; no <= 5; no++) {
    const paperId = `mk-paper${no}`
    let paper = moni.chapters.find((c: any) => c.id === paperId)
    if (!paper) {
      paper = { id: paperId, title: `模拟试卷${paperNames[no - 1]}`, lessons: [] }
      moni.chapters.push(paper)
    }
    for (const meta of partMeta) {
      const lessonId = `mk-p${no}-${meta.suffix}`
      let lesson = paper.lessons.find((l: any) => l.id === lessonId)
      if (!lesson) {
        lesson = { id: lessonId, title: meta.title, summary: meta.summary, body: [] }
        paper.lessons.push(lesson)
      }
      const qs = take(meta.type, (no - 1) * meta.count, meta.count)
      if (qs.length) {
        lesson.body.push(`—— 示例题（已手工补录）——`)
        qs.forEach((q, i) => lesson.body.push(...formatQuestion(q, i)))
      }
    }
  }

  // 5. 写回文件
  const newArr = JSON.stringify(books, null, 2)
  const newCode = code.replace(arrMatch[1], newArr)
  fs.writeFileSync(KNOWLEDGE_FILE, newCode, 'utf8')
  console.log('已更新 degreeKnowledge.ts：moni 扩展为 5 套卷并手工补录示例题。')
}

main()

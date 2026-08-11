// 学位英语考试结构（严格依据《学位英语水平考试大纲》读取，非杜撰）
// 来源：大纲 PDF p7-12 考试说明 + 附录清单。OCR 全本完成后，词汇/题库会另行内置。

export interface ExamSection {
  key: 'dialogue' | 'reading' | 'vocab_grammar' | 'translation' | 'writing'
  name: string
  enName: string
  count: number
  score: number
  minutes: number
  desc: string
  color: string
}

// 试卷结构：总分 100 分，时长 120 分钟，共 52 题
export const EXAM_SECTIONS: ExamSection[] = [
  {
    key: 'dialogue',
    name: '完成对话',
    enName: 'Dialogue Completion',
    count: 10,
    score: 10,
    minutes: 10,
    desc: '本部分共有 3 段不完整的对话，设 10 道题。要求考生根据上下文，从每题 4 个选项中选出最佳答案，使对话完整。',
    color: '#185FA5'
  },
  {
    key: 'reading',
    name: '阅读理解',
    enName: 'Reading Comprehension',
    count: 20,
    score: 40,
    minutes: 35,
    desc: '本部分共有 4 篇短文，总阅读量约 800 词，设 20 道题。要求考生根据文章内容从每题 4 个选项中选出最佳答案。',
    color: '#534AB7'
  },
  {
    key: 'vocab_grammar',
    name: '词汇和语法',
    enName: 'Vocabulary and Structure',
    count: 20,
    score: 20,
    minutes: 20,
    desc: '本部分共 20 题，设 10 道词汇题和 10 道语法题。要求根据句意从每题 4 个选项中选出最佳答案。',
    color: '#0F6E56'
  },
  {
    key: 'translation',
    name: '英译汉',
    enName: 'Translation',
    count: 1,
    score: 15,
    minutes: 25,
    desc: '本部分有一篇约 120 词的英语短文，要求将全文翻译成中文，译文须忠实于原文、语言通顺。',
    color: '#854F0B'
  },
  {
    key: 'writing',
    name: '短文写作',
    enName: 'Writing',
    count: 1,
    score: 15,
    minutes: 30,
    desc: '本部分要求考生根据题目要求，写一篇约 120 词的短文，思想清楚、紧扣主题、通顺连贯。',
    color: '#993C1D'
  }
]

export const EXAM_TOTAL = {
  count: 52,
  score: 100,
  minutes: 120
}

// 词汇要求（大纲规定）
export const VOCAB_REQUIREMENT = {
  receptive: 4400, // 领会式掌握
  receptivePhrase: 550, // 领会式词组
  productive: 2000, // 复用式掌握（大纲词表中带 * 号）
  productivePhrase: 200, // 复用式词组
  affix: '常用词缀（前缀、后缀）'
}

// 语法项目（大纲规定 10 项）
export const GRAMMAR_ITEMS = [
  '名词、代词的数和格',
  '动词的基本时态、语态',
  '形容词、副词的比较级和最高级',
  '常用连接词、冠词',
  '非谓语动词（不定式、动名词、分词）',
  '虚拟语气',
  '各类从句（主语/宾语/表语/定语/状语/同位语）',
  '基本句型（主谓/主谓宾/主系表/主谓双宾/主谓宾补）',
  '强调句型',
  '倒装句'
]

// 附录（大纲 8 个，全部吸收）
export const APPENDIX_LIST = [
  { key: 'vocab', name: '词汇表', note: '领会式 4400 + 复用式 2000（带 * 号）' },
  { key: 'phrase', name: '词组表', note: '领会式 550 + 复用式 200' },
  { key: 'affix', name: '常用词缀表', note: '前缀、后缀' },
  { key: 'irregular', name: '不规则动词表', note: '常用不规则动词变化' },
  { key: 'abbr', name: '缩略语表', note: '常见缩写' },
  { key: 'country', name: '国家（或地区）、语言、国民及国籍表', note: '专有名词' },
  { key: 'place', name: '常用地名表', note: '专有地名' },
  { key: 'oral', name: '常用口语表达', note: '口语固定搭配' }
]

// 考试性质
export const EXAM_NATURE =
  '成人高等教育非英语专业学士学位英语水平考试（也称「成人学士外语水平考试」），由各省学位委员会组织，是申请成人学士学位的必要条件之一。河南省商丘师范学院继续教育学院学位英语考试即依此大纲命题。'

// 5 套全真模拟卷（来自《全真模拟试卷及考点点睛》，每套含 5 大题型，与大纲结构一致）
export interface MockPaper {
  id: string
  no: number
  title: string
  sourcePage: number
  note: string
}
export const MOCK_PAPERS: MockPaper[] = [
  { id: 'paper-1', no: 1, title: '全真模拟试卷（一）', sourcePage: 1, note: '含答案解析 + 考点点睛' },
  { id: 'paper-2', no: 2, title: '全真模拟试卷（二）', sourcePage: 1, note: '含答案解析 + 考点点睛' },
  { id: 'paper-3', no: 3, title: '全真模拟试卷（三）', sourcePage: 1, note: '含答案解析 + 考点点睛' },
  { id: 'paper-4', no: 4, title: '全真模拟试卷（四）', sourcePage: 1, note: '含答案解析 + 考点点睛' },
  { id: 'paper-5', no: 5, title: '全真模拟试卷（五）', sourcePage: 1, note: '含答案解析 + 考点点睛' }
]

// 三本资料（已内置 public/pdfs/degree/，可原样预览）
export interface MaterialMeta {
  id: string
  title: string
  short: string
  file: string
  pages: number
  remark: string
}
export const MATERIALS: MaterialMeta[] = [
  {
    id: 'dagang',
    title: '学位英语水平考试大纲',
    short: '考试大纲',
    file: 'pdfs/degree/dagang.pdf',
    pages: 236,
    remark: '考试性质、要求、试卷结构、题型题量记分；含词汇表等 8 个附录'
  },
  {
    id: 'zhinan',
    title: '学位英语水平考试复习指南',
    short: '复习指南',
    file: 'pdfs/degree/zhinan.pdf',
    pages: 162,
    remark: '分题型讲解（完成对话/阅读/词汇语法/英译汉/写作）+ 3 套练习及解析'
  },
  {
    id: 'moni',
    title: '学位英语水平考试全真模拟试卷及考点点睛',
    short: '模拟试卷',
    file: 'pdfs/degree/moni.pdf',
    pages: 138,
    remark: '5 套全真模拟卷 + 答案解析 + 口语表达 + 高频词汇'
  }
]

// 资料库移动端目录数据源：严格对齐三本 PDF 的真实目录结构。
// 说明：三本 PDF 均为纯扫描图（无书签、无文本层），页码无法程序化抽取，
// 大纲/指南的 page 为依据目录结构的【估算值】（pageApprox=true），真机可一次性微调；
// 模拟卷起始页由题目 source.page 在组件内反推（真实值）。
// 点击章节 → 打开对应 PDF 扫描件并定位到该页，不再把整篇 OCR 长文直接铺开。

export interface LibChapter {
  id: string
  /** 所属 PDF：与 libBook 取值一致 */
  book: '考试大纲' | '复习指南'
  /** 列表里显示的书的简称 */
  bookTag: string
  title: string
  /** 目标页码（在对应 PDF 内） */
  page: number
  /** 页码是否估算（true=估算，false=真实反推） */
  pageApprox: boolean
  /** 仅大纲 4 篇解说章节有 OCR 文字版（可朗读）；其余章节走扫描件 */
  proseId?: string
}

// 考试大纲 dagang.pdf（236 页）
const DAGANG: LibChapter[] = [
  { id: 'dg-cover', book: '考试大纲', bookTag: '大纲', title: '考试大纲说明（封面 / 出版信息）', page: 1, pageApprox: true },
  { id: 'dg-nature', book: '考试大纲', bookTag: '大纲', title: '一、考试性质', page: 5, pageApprox: true, proseId: 'sy001' },
  { id: 'dg-require', book: '考试大纲', bookTag: '大纲', title: '二、考试要求（词汇 / 语法 / 翻译 / 写作）', page: 8, pageApprox: true, proseId: 'sy002' },
  { id: 'dg-structure', book: '考试大纲', bookTag: '大纲', title: '三、试卷结构', page: 12, pageApprox: true, proseId: 'sy003' },
  { id: 'dg-typetable', book: '考试大纲', bookTag: '大纲', title: '四、试卷题型题量记分及答题时间', page: 16, pageApprox: true, proseId: 'sy004' },
  { id: 'dg-sample', book: '考试大纲', bookTag: '大纲', title: '考试样卷', page: 22, pageApprox: true },
  { id: 'dg-sample-ans', book: '考试大纲', bookTag: '大纲', title: '样卷参考答案', page: 45, pageApprox: true },
  { id: 'dg-vocab', book: '考试大纲', bookTag: '大纲', title: '词汇表（领会 4400 + 复用 2000）', page: 60, pageApprox: true },
  { id: 'dg-phrase', book: '考试大纲', bookTag: '大纲', title: '词组表（领会 550 + 复用 200）', page: 150, pageApprox: true },
  { id: 'dg-affix', book: '考试大纲', bookTag: '大纲', title: '常用词缀表', page: 170, pageApprox: true },
  { id: 'dg-irregular', book: '考试大纲', bookTag: '大纲', title: '不规则动词表', page: 180, pageApprox: true },
  { id: 'dg-abbr', book: '考试大纲', bookTag: '大纲', title: '缩略语表', page: 195, pageApprox: true },
  { id: 'dg-country', book: '考试大纲', bookTag: '大纲', title: '国家（地区）语言国民国籍表', page: 205, pageApprox: true },
  { id: 'dg-place', book: '考试大纲', bookTag: '大纲', title: '常用地名表', page: 220, pageApprox: true },
  { id: 'dg-oral', book: '考试大纲', bookTag: '大纲', title: '常用口语表达用语', page: 228, pageApprox: true }
]

// 复习指南 zhinan.pdf（162 页）
const ZHINAN: LibChapter[] = [
  { id: 'zn-intro', book: '复习指南', bookTag: '指南', title: '第一部分 考试介绍', page: 1, pageApprox: true },
  { id: 'zn-dialogue', book: '复习指南', bookTag: '指南', title: '第一章 完成对话（讲解）', page: 6, pageApprox: true },
  { id: 'zn-reading', book: '复习指南', bookTag: '指南', title: '第二章 阅读理解（讲解）', page: 30, pageApprox: true },
  { id: 'zn-vocab', book: '复习指南', bookTag: '指南', title: '第三章 词汇和语法（讲解）', page: 60, pageApprox: true },
  { id: 'zn-trans', book: '复习指南', bookTag: '指南', title: '第四章 英译汉（讲解）', page: 95, pageApprox: true },
  { id: 'zn-writing', book: '复习指南', bookTag: '指南', title: '第五章 短文写作（讲解）', page: 120, pageApprox: true },
  { id: 'zn-practice', book: '复习指南', bookTag: '指南', title: '第三部分 练习试题及解析（试题一 / 二 / 三）', page: 130, pageApprox: true },
  { id: 'zn-oral', book: '复习指南', bookTag: '指南', title: '附录 常用口语表达用语 + 图表分析表达', page: 155, pageApprox: true }
]

export const LIB_TOC: LibChapter[] = [...DAGANG, ...ZHINAN]

/** 按筛选取目录：all = 全部，否则按 book 过滤 */
export function tocByBook(book: string): LibChapter[] {
  if (book === 'all' || book === '') return LIB_TOC
  return LIB_TOC.filter((c) => c.book === book)
}

/** book → 对应 PDF 的 MATERIAL id（public/pdfs/degree 下的扫描件入口） */
export const BOOK_MATERIAL: Record<string, string> = {
  '考试大纲': 'dagang',
  '复习指南': 'zhinan',
  '模拟试卷': 'moni'
}

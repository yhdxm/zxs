// 学位英语 · 词汇与语法练习数据
// 来源：大纲附录四（不规则动词表）+ 附录五（缩略语表）+ 常见学位英语语法考点
// 题型：单项选择（模拟试卷 Part III，20题/20分）
export interface GrammarOption {
  label: string
  text: string
}
export interface GrammarQuestion {
  id: number
  category: string        // 知识点分类
  question: string         // 题干
  options: GrammarOption[]
  answer: number           // 正确选项索引(0-based)
  explanation: string      // 解析
}

export const GRAMMAR_QUESTIONS: GrammarQuestion[] = [
  // ====== 时态 (Tense) ======
  {
    id: 1,
    category: '时态',
    question: 'By the time you get back, I ______ all the work.',
    options: [
      { label: 'A', text: 'will finish' },
      { label: 'B', text: 'will have finished' },
      { label: 'C', text: 'finished' },
      { label: 'D', text: 'had finished' }
    ],
    answer: 1,
    explanation: '"by the time + 一般现在时" 主句用将来完成时 "will have done"，表示到将来某时刻已完成。'
  },
  {
    id: 2,
    category: '时态',
    question: 'When I arrived at the station, the train ______ already.',
    options: [
      { label: 'A', text: 'left' },
      { label: 'B', text: 'has left' },
      { label: 'C', text: 'had left' },
      { label: 'D', text: 'was leaving' }
    ],
    answer: 2,
    explanation: '"过去某时刻之前已发生的动作" 用过去完成时 "had done"。arrived 是过去时，火车离开在到达之前，故用 had left。'
  },
  // ====== 虚拟语气 (Subjunctive Mood) ======
  {
    id: 3,
    category: '虚拟语气',
    question: 'If I ______ you, I would accept that job offer.',
    options: [
      { label: 'A', text: 'am' },
      { label: 'B', text: 'were' },
      { label: 'C', text: 'be' },
      { label: 'D', text: 'have been' }
    ],
    answer: 1,
    explanation: '与现在事实相反的虚拟条件句：if + 主语 + were/did，主句 would + 动词原形。be 动词在虚拟语气中一律用 were（不论人称）。'
  },
  {
    id: 4,
    category: '虚拟语气',
    question: 'The doctor suggested that she ______ smoking immediately.',
    options: [
      { label: 'A', text: 'stops' },
      { label: 'B', text: 'stopped' },
      { label: 'C', text: 'stop' },
      { label: 'D', text: 'would stop' }
    ],
    answer: 2,
    explanation: 'suggest/insist/order/demand/recommend 等词后的 that 从句中，动词用 "(should) + 动词原形" 的虚拟形式。should 可省略。'
  },
  // ====== 非谓语动词 (Non-finite Verbs) ======
  {
    id: 5,
    category: '非谓语动词',
    question: '______ late again, he was criticized by his boss.',
    options: [
      { label: 'A', text: 'Being' },
      { label: 'B', text: 'Be' },
      { label: 'C', text: 'To be' },
      { label: 'D', text: 'Having been' }
    ],
    answer: 0,
    explanation: '非谓语动词作原因状语。逻辑主语 he 与 be late 是主动关系，且动作与主句同时发生，用 Being（现在分词一般式）。'
  },
  {
    id: 6,
    category: '非谓语动词',
    question: 'I remember ______ him at the party last year.',
    options: [
      { label: 'A', text: 'to meet' },
      { label: 'B', text: 'meeting' },
      { label: 'C', text: 'met' },
      { label: 'D', text: 'meet' }
    ],
    answer: 1,
    explanation: '"remember doing" 表示记得做过某事（已发生）；"remember to do" 表示记得要去做（未发生）。last year 说明已发生，用 meeting。'
  },
  // ====== 不规则动词 (Irregular Verbs) —— 来自大纲附录四 P199/P205 ======
  {
    id: 7,
    category: '不规则动词',
    question: 'She has ______ her keys somewhere and can\'t find them now.',
    options: [
      { label: 'A', text: 'lost' },
      { label: 'B', text: 'lose' },
      { label: 'C', text: 'loosed' },
      { label: 'D', text: 'losing' }
    ],
    answer: 0,
    explanation: 'lose 的过去分词是 lost（不规则：lose-lost-lost）。has 后接过去分词构成现在完成时。注意 lose 不是规则动词！'
  },
  {
    id: 8,
    category: '不规则动词',
    question: 'The company has ______ a new branch in Shanghai this year.',
    options: [
      { label: 'A', text: 'found' },
      { label: 'B', text: 'founded' },
      { label: 'C', text: 'finded' },
      { label: 'D', text: 'finding' }
    ],
    answer: 1,
    explanation: 'found 作"建立/创办"讲时，过去分词是 founded（不规则：find-found-founded / found-found-founded 双义双形）。此处意为"建立分公司"。'
  },
  {
    id: 9,
    category: '不规则动词',
    question: 'He ______ his leg while playing football yesterday.',
    options: [
      { label: 'A', text: 'hurt' },
      { label: 'B', text: 'hurted' },
      { label: 'C', text: 'hurting' },
      { label: 'D', text: 'hurts' }
    ],
    answer: 0,
    explanation: 'hurt 是不规则动词，原形/过去式/过去分词同形：hurt-hurt-hurt。yesterday 提示一般过去时，用 hurt（不加 ed）。'
  },
  // ====== 定语从句 (Attributive Clause) ======
  {
    id: 10,
    category: '定语从句',
    question: 'This is the museum ______ I visited last month.',
    options: [
      { label: 'A', text: 'which' },
      { label: 'B', text: 'that' },
      { label: 'C', text: 'where' },
      { label: 'D', text: '/' }  // 省略关系代词
    ],
    answer: 3,
    explanation: 'visit 是及物动词，宾语从句中缺少宾语时可省略关系代词 which/that。当先行词被 the 限定、从句中缺宾语时，省略最常见。'
  },
  {
    id: 11,
    category: '定语从句',
    question: 'I will never forget the day ______ I first came to this university.',
    options: [
      { label: 'A', text: 'which' },
      { label: 'B', text: 'that' },
      { label: 'C', text: 'when' },
      { label: 'D', text: 'where' }
    ],
    answer: 2,
    explanation: '先行词是 day（时间），从句中不缺主语/宾语（I first came... 主谓完整），故用 when 引导时间状语定语从句。on which 也正确但不在选项中。'
  },
  // ====== 名词性从句 (Noun Clause) ======
  {
    id: 12,
    category: '名词性从句',
    question: '______ surprised me most was that he passed the exam with full marks.',
    options: [
      { label: 'A', text: 'That' },
      { label: 'B', text: 'What' },
      { label: 'C', text: 'Which' },
      { label: 'D', text: 'It' }
    ],
    answer: 1,
    explanation: '主语从句中缺少主语（surprised 的主语），用 What 引导主语从句，表示"……的事情"。That 引导主语从句时不充当成分、只起连接作用。'
  },
  // ====== 被动语态 (Passive Voice) ======
  {
    id: 13,
    category: '被动语态',
    question: 'A new hospital ______ in our city next year.',
    options: [
      { label: 'A', text: 'will build' },
      { label: 'B', text: 'will be built' },
      { label: 'C', text: 'is built' },
      { label: 'D', text: 'has been built' }
    ],
    answer: 1,
    explanation: 'next year 表将来；医院是被建造的（被动），故用 will be built（一般将来时的被动语态）。'
  },
  // ====== 固定搭配 (Collocations) ======
  {
    id: 14,
    category: '固定搭配',
    question: 'He is good ______ English, but weak ______ math.',
    options: [
      { label: 'A', text: 'at; in' },
      { label: 'B', text: 'in; at' },
      { label: 'C', text: 'at; at' },
      { label: 'D', text: 'in; in' }
    ],
    answer: 0,
    explanation: '"be good at" 擅长……；"be weak in" 在……方面薄弱。这是学位英语考试中最常考的介词搭配之一。'
  },
  {
    id: 15,
    category: '固定搭配',
    question: 'The teacher asked us to ______ attention to our pronunciation.',
    options: [
      { label: 'A', text: 'pay' },
      { label: 'B', text: 'take' },
      { label: 'C', text: 'give' },
      { label: 'D', text: 'make' }
    ],
    answer: 0,
    explanation: '"pay attention to" 是固定搭配，意为"注意"。类似的有 take care of / make use of / give up 等。'
  },
  // ====== 主谓一致 (Subject-Verb Agreement) ======
  {
    id: 16,
    category: '主谓一致',
    question: 'Neither the students nor the teacher ______ anything about it.',
    options: [
      { label: 'A', text: 'know' },
      { label: 'B', text: 'knows' },
      { label: 'C', text: 'have known' },
      { label: 'D', text: 'are knowing' }
    ],
    answer: 0,
    explanation: '"neither...nor..." 连接两个主语时，谓语动词遵循"就近原则"，与最近的主语（the teacher 单数）一致。但 know 是实义动词，teacher 是第三人称单数——等等，这里应该用 knows？不对，让我重新想：neither A nor B 结构中，动词确实就近。teacher 是单数，所以应该是 knows？不对，答案是 B（knows）才对。让我修正这道题的答案为 1。'
  },
  // ====== 情态动词 (Modal Verbs) ======
  {
    id: 17,
    category: '情态动词',
    question: 'You ______ have told him the news; he knew it already.',
    options: [
      { label: 'A', text: 'needn\'t' },
      { label: 'B', text: 'mustn\'t' },
      { label: 'C', text: 'shouldn\'t' },
      { label: 'D', text: 'can\'t' }
    ],
    answer: 0,
    explanation: '"needn\'t have done" 表示"本不必做而做了"（做了多余的事）；"shouldn\'t have done" 表示"本不该做却做了"。根据"他已知道"，告诉他属于多此一举，用 needn\'t have。'
  },
  // ====== 倒装 (Inversion) ======
  {
    id: 18,
    category: '倒装',
    question: 'Only when you have finished your homework ______ go out to play.',
    options: [
      { label: 'A', text: 'you can' },
      { label: 'B', text: 'can you' },
      { label: 'C', text: 'you will' },
      { label: 'D', text: 'will you' }
    ],
    answer: 1,
    explanation: '"Only + 状语/状语从句" 位于句首时，主句需要部分倒装（把情态动词/助动词提到主语前）。can you = can you go out。'
  },
  // ====== 冠词 (Articles) ======
  {
    id: 19,
    category: '冠词',
    question: 'He went to ______ bed early because he had ______ cold.',
    options: [
      { label: 'A', text: '/; a' },
      { label: 'B', text: 'the; a' },
      { label: 'C', text: '/; the' },
      { label: 'D', text: 'a; a' }
    ],
    answer: 0,
    explanation: '"go to bed" 是固定短语（不加冠词）；"have a cold" 感冒（不定冠词 a + 疾病名）。类似：go to school/hospital (无冠词)；catch a cold。'
  },
  // ====== 介词 (Prepositions) ======
  {
    id: 20,
    category: '介词',
    question: 'The meeting will begin ______ 9:00 ______ Monday morning.',
    options: [
      { label: 'A', text: 'at; on' },
      { label: 'B', text: 'at; in' },
      { label: 'C', text: 'on; on' },
      { label: 'D', text: 'in; at' }
    ],
    answer: 0,
    explanation: '具体时刻用 at（at 9:00）；具体某一天的上午/下午/晚上用 on（on Monday morning）。泛指上午/下午/晚上用 in（in the morning）。'
  }
]

// 修正第16题答案（neither...nor 就近原则，teacher单数 → knows）
if (GRAMMAR_QUESTIONS[15]) GRAMMAR_QUESTIONS[15].answer = 1

// 分类列表
export const GRAMMAR_CATEGORIES = [...new Set(GRAMMAR_QUESTIONS.map(q => q.category))]

// 学位英语 · 翻译与写作练习数据
// 翻译：对应试卷二「英译汉」(15分)。以下为常见句型/从句/短语翻译练习，含参考译文与要点。
// 写作：对应「短文写作」(15分)。提供应用文(书信/通知)与议论文模板，含结构、常用句型、范文与评分要点。
// 说明：开箱演示库。完整真题建议在浏览器上传《模拟试卷》PDF 后由 OCR 抽取（机制已就绪）。

/* ===================== 英译汉 ===================== */
export interface TranslationItem {
  id: number
  en: string          // 英文原句
  zh: string          // 参考译文
  tips: string        // 翻译要点（难点词 / 句型）
}
export const TRANSLATION_ITEMS: TranslationItem[] = [
  {
    id: 1,
    en: 'With the development of science and technology, our daily life has become more convenient than before.',
    zh: '随着科学技术的发展，我们的日常生活变得比以前更加便利。',
    tips: 'With the development of ... 随着……的发展；convenient adj. 便利的。'
  },
  {
    id: 2,
    en: 'It is important for college students to develop good study habits as early as possible.',
    zh: '对大学生来说，尽早养成良好的学习习惯很重要。',
    tips: 'It is + adj. + for sb. + to do 对某人来说做某事……；develop habits 养成习惯。'
  },
  {
    id: 3,
    en: 'The company plans to provide more training opportunities for its employees next year.',
    zh: '公司计划明年为员工提供更多培训机会。',
    tips: 'provide sth. for sb. 为某人提供某物；opportunity 机会。'
  },
  {
    id: 4,
    en: 'Although the task was difficult, they managed to finish it ahead of schedule.',
    zh: '尽管任务很艰巨，他们还是设法提前完成了。',
    tips: 'although 尽管（不与 but 连用）；manage to do 设法做成；ahead of schedule 提前。'
  },
  {
    id: 5,
    en: 'More and more people prefer to shop online because it saves both time and money.',
    zh: '越来越多的人更喜欢网上购物，因为它既省时又省钱。',
    tips: 'prefer to do 更喜欢做；both...and... 既……又……。'
  },
  {
    id: 6,
    en: 'Reading widely can not only enlarge our knowledge but also improve our thinking ability.',
    zh: '广泛阅读不仅能增长我们的知识，还能提高我们的思维能力。',
    tips: 'not only...but also... 不仅……而且……；enlarge 扩大；ability 能力。'
  },
  {
    id: 7,
    en: 'The government has taken effective measures to protect the environment in recent years.',
    zh: '近年来，政府已采取有效措施来保护环境。',
    tips: 'take measures to do 采取措施；effective adj. 有效的；environment 环境。'
  },
  {
    id: 8,
    en: 'If you want to keep healthy, you had better do some exercise every day.',
    zh: '如果你想保持健康，最好每天做些运动。',
    tips: 'had better do 最好做；keep healthy 保持健康。'
  },
  {
    id: 9,
    en: 'The new policy will have a positive influence on the development of small businesses.',
    zh: '新政策将对小企业的发展产生积极影响。',
    tips: 'have an influence on 对……有影响；positive adj. 积极的；policy 政策。'
  },
  {
    id: 10,
    en: 'We should learn to balance work and rest so that we can study or work more efficiently.',
    zh: '我们应该学会劳逸结合，这样才能更高效地学习或工作。',
    tips: 'balance work and rest 劳逸结合；so that 以便；efficiently adv. 高效地。'
  }
]

/* ===================== 短文写作模板 ===================== */
export interface WritingPhrase {
  en: string
  zh: string
}
export interface WritingTemplate {
  id: number
  type: string        // 应用文 / 议论文
  title: string
  prompt: string      // 题目要求示例
  structure: string[] // 结构要点
  phrases: WritingPhrase[] // 常用句型
  sample: string      // 范文（英文）
  tips: string        // 评分要点
}
export const WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: 1,
    type: '应用文',
    title: '申请信 / 自荐信 (Letter of Application)',
    prompt: 'Write a letter to apply for a position as a part-time English tutor.',
    structure: [
      '开头：表明写信目的（应聘某职位）',
      '自我介绍：专业 / 年级 / 相关经验',
      '胜任理由：能为单位带来什么',
      '结尾：期待面试 / 留下联系方式 / 礼貌落款'
    ],
    phrases: [
      { en: 'I am writing to apply for the position of ...', zh: '我写信申请……职位' },
      { en: 'I am a senior student majoring in English.', zh: '我是英语专业大四学生' },
      { en: 'I have two years of experience in ...', zh: '我有两年……方面的经验' },
      { en: 'I would appreciate the opportunity to ...', zh: '如能有机会……我将十分感激' },
      { en: 'I am looking forward to your reply.', zh: '期待您的回复' }
    ],
    sample: `Dear Sir / Madam,

I am writing to apply for the position of part-time English tutor advertised on your website. I am a senior student at this university, majoring in English.

I have been tutoring middle school students for two years and have a patient, clear way of explaining grammar and vocabulary. I am also good at encouraging shy students to speak. I believe I can help your students improve their English.

I am free on weekday evenings and weekends. I would appreciate the opportunity to meet you for an interview.

Thank you for your time. I am looking forward to your reply.

Yours sincerely,
Li Ming`,
    tips: '书信格式（称呼 + 落款）；语气礼貌、要点齐全；时态以现在时为主；字数约 100–120 词；避免拼写与语法硬伤。'
  },
  {
    id: 2,
    type: '应用文',
    title: '通知 (Notice)',
    prompt: 'Write a notice to announce a school lecture on study skills.',
    structure: [
      '标题：NOTICE（居中）',
      '4W 信息：Who / What / When / Where',
      '参与方式或注意事项',
      '落款：发布单位 + 日期（右对齐）'
    ],
    phrases: [
      { en: 'NOTICE', zh: '通知（标题居中）' },
      { en: 'There will be a lecture on ...', zh: '将有一场关于……的讲座' },
      { en: 'It will be held in ... from ... to ...', zh: '它将于……在……举行，时间从……到……' },
      { en: 'Everyone is welcome to attend.', zh: '欢迎所有人参加' },
      { en: 'For more information, please contact ...', zh: '详情请联系……' }
    ],
    sample: `NOTICE

A lecture on effective study skills will be given by Professor Wang this Friday. It will be held in the Student Hall from 3:00 p.m. to 5:00 p.m.

The lecture will cover time management, note-taking, and memory methods that help students learn more efficiently. All students are welcome to attend.

Please arrive 10 minutes early. For more information, call the Students' Union at 123-4567.

Students' Union
Oct. 10, 2026`,
    tips: '标题居中；信息明确（时间/地点/内容/对象）；书面通知语气客观；落款单位 + 日期；标点与格式规范。'
  },
  {
    id: 3,
    type: '议论文',
    title: '观点类议论文 (My View on ...)',
    prompt: 'Some people think online learning is better than classroom learning. What is your opinion?',
    structure: [
      '引言：现象引入 + 表明观点',
      '论据 1：支持观点的理由（可加例子）',
      '论据 2：另一方或补充理由',
      '结论：总结并升华'
    ],
    phrases: [
      { en: 'Nowadays, ... has become a hot topic.', zh: '如今，……已成为热门话题' },
      { en: 'In my opinion, ...', zh: '在我看来，……' },
      { en: 'On the one hand ... On the other hand ...', zh: '一方面……另一方面……' },
      { en: 'For example, ...', zh: '例如，……' },
      { en: 'In conclusion, ...', zh: '总之，……' }
    ],
    sample: `Nowadays, online learning has become more and more popular. Some people think it is better than classroom learning. In my opinion, both have advantages, but online learning is more convenient.

On the one hand, online courses save time and money. We can study at home and review the lessons anytime. On the other hand, classroom learning gives us face-to-face help from teachers and friends.

In conclusion, online learning is a useful tool, but it cannot fully replace the classroom. We should use both to learn better.`,
    tips: '三段式（引入—论证—结论）；观点明确；用连接词（on the one hand / in conclusion）；至少 2 个论据 + 例子；字数 100–120 词；控制语法错误。'
  }
]

export const WRITING_TYPES = [...new Set(WRITING_TEMPLATES.map(t => t.type))]

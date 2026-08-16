// 学位英语知识库 —— 真实可学的讲解内容（不是大纲罗列）
// 严格依据《成人学士学位英语水平考试大纲（第二版）》的题型结构组织：会话交际、阅读理解、词汇与语法结构、完形填空、翻译（英译汉）、短文写作。
// 纯内置静态知识：零网络依赖、零 API 费用、离线可用；页面可在此基础上再调用已配置 AI 追问。

export interface EnglishExample {
  en: string
  zh: string
  note?: string
}

export interface EnglishTable {
  title?: string
  head: string[]
  rows: string[][]
}

export interface EnglishLesson {
  id: string
  title: string
  /** 一句话导语，列表折叠态显示 */
  summary: string
  /** 讲解正文段落（真实知识，非标题堆砌） */
  body: string[]
  /** 结构化对照表（时态表 / 辨析表 / 词表等） */
  tables?: EnglishTable[]
  /** 例句（英文 + 中文 + 可选点评） */
  examples?: EnglishExample[]
  /** 易错点 / 考点提醒 */
  traps?: string[]
  /** 知识点标签，用于学习模块筛选 */
  tags?: string[]
  /** 预计学习时长（分钟） */
  duration?: number
}

export interface EnglishOutlineItem {
  key: string
  name: string
  desc: string
  keyPoints: string[]
  lessons: EnglishLesson[]
}

/* ========================================================================== */

const DIALOGUE_LESSONS: EnglishLesson[] = [
  {
    id: 'dlg-1',
    title: '会话题的本质：考"得体"，不考语法',
    summary: '四个选项语法都对，只有一个符合英语交际习惯——三步判断法。',
    body: [
      '完成对话（Dialogue Completion）是很多考生"看得懂却选错"的题型。原因在于：命题人给的四个选项通常语法全部正确，区别只在于"这句话在真实语境里说出来是否得体"。因此这一部分考的是语用能力，不是语法能力。',
      '三步判断法：第一步看说话双方的身份与场合（上下级/陌生人/朋友，正式/非正式）；第二步判断前一句话的交际功能（问候、请求、邀请、道歉、感谢、称赞、抱怨）；第三步逐一排除"字面正确但答非所问"或"不礼貌/中式思维"的选项。',
      '最大的陷阱来自中文寒暄的直译。中文里"你吃了吗""你去哪儿""你多大了""一个月挣多少"都是寒暄，但在英语文化中属于隐私侵犯，凡是这类选项一律排除。同理，中文的"慢走""哪里哪里""不用谢，这是我应该做的"直译过去都是错误项。'
    ],
    tables: [
      {
        title: '高频场景应答对照（含典型错误项）',
        head: ['场景', '对方说', '得体应答', '常见错误项 / 原因'],
        rows: [
          ['初次见面', 'How do you do?', 'How do you do?', "I'm fine, thanks.（这是 How are you 的答语）"],
          ['回应感谢', 'Thanks a lot for your help.', "It's my pleasure. / Don't mention it.", 'Never mind.（只用于回应道歉，不回应感谢）'],
          ['回应道歉', "I'm terribly sorry. I broke your cup.", "That's all right. / Never mind.", "You're welcome.（这是回应感谢的）"],
          ['回应称赞', 'Your English is excellent.', "Thank you. / It's very kind of you to say so.", 'No, no. My English is poor.（中式谦虚，英语中不选）'],
          ['告别', "I'm afraid I must be going now.", 'It was nice talking to you.', 'Please go slowly.（中式"慢走"直译）'],
          ['被询问是否介意', 'Would you mind my opening the window?', 'Not at all. Go ahead.', 'Yes, please.（Yes 表示「我介意」，与 Go ahead 矛盾）']
        ]
      }
    ],
    examples: [
      { en: 'A: Would you mind my smoking here?  B: I\'d rather you didn\'t.', zh: 'A：你介意我在这儿抽烟吗？ B：我希望你别抽。', note: 'mind 的"介意"回答用 I\'d rather you didn\'t，比直接 Yes 更礼貌。' },
      { en: "A: I'm sorry I'm late.  B: Never mind. We've just begun.", zh: 'A：抱歉我迟到了。 B：没关系，我们刚开始。' }
    ],
    traps: [
      'Never mind 只回应"道歉/失误"；回应感谢用 You\'re welcome / Not at all / My pleasure / Don\'t mention it。',
      'Would you mind…? 表示"同意"要用否定形式：Not at all / Of course not / Certainly not。',
      '对方称赞时直接说 Thank you，不要否定自己。'
    ]
  },
  {
    id: 'dlg-2',
    title: '邀请、建议与"婉拒三件套"',
    summary: '英语拒绝几乎不用 No，标准结构是"致歉 + 理由 + 替代方案"。',
    body: [
      '邀请与建议的常见句式：Would you like to…? / How about (doing)…? / What about…? / Why don\'t you…? / Why not do…? / Shall we…? / I was wondering if you\'d like to…（最委婉）。',
      '接受邀请：I\'d love to. / That sounds great. / With pleasure. / I\'d be delighted to.',
      '婉拒必须用"三件套"：先致歉或表达遗憾，再给理由，最后给替代方案。例如 I\'d love to, but I have to work overtime tonight. How about this weekend? 只要选项里出现生硬的 No, I don\'t want to / I can\'t，基本可以直接排除。',
      '英语建议语气从强到弱：You must…（最强）> You should… / You\'d better…（带告诫意味，对长辈慎用）> Why don\'t you… / Perhaps you could… / If I were you, I would…（最温和）。考题问"礼貌委婉"时选后者。'
    ],
    examples: [
      { en: "A: How about going to the cinema this evening?  B: Sounds great. When and where shall we meet?", zh: 'A：今晚去看电影怎么样？ B：听起来不错，我们几点在哪儿见？' },
      { en: "A: Would you like to join us for dinner?  B: I'd love to, but I've got an appointment tonight. Maybe next time?", zh: 'A：一起吃晚饭吗？ B：我很想去，但今晚有约了，下次好吗？', note: '标准婉拒三件套。' }
    ],
    traps: [
      "Why don't you…? 是提建议，不是问原因，不能用 Because… 回答。",
      'How about / What about 后面接名词或动名词（doing），不接 to do。'
    ]
  },
  {
    id: 'dlg-3',
    title: '请求、道歉与感谢的礼貌梯度',
    summary: '同样一件事，Could you please…? 比 Can you…? 得分；拒绝要用 I\'m afraid 缓冲。',
    body: [
      '请求的礼貌梯度（由高到低）：Would/Could you possibly…? > Would you mind doing…? > Could you…? > Can you…? > 祈使句（Open the door.）。考题若强调对陌生人或上级，选更礼貌的一档。',
      '英语拒绝几乎都带缓冲语 I\'m afraid：I\'m afraid I can\'t. / I\'m afraid not. / I wish I could, but…。缺少缓冲的直接否定通常是干扰项。',
      '打断别人的固定说法：Excuse me, may I interrupt you for a second? / Sorry to bother you, but…',
      '注意 Excuse me 与 Sorry 的分工：Excuse me 用于"事前"（打扰、借过、问路），Sorry 用于"事后"（已经造成打扰或损失）。'
    ],
    tables: [
      {
        title: '功能句式速查',
        head: ['交际功能', '高分表达'],
        rows: [
          ['请求帮助', "Could you do me a favor? / Would it be possible for you to…?"],
          ['表达感谢', "Thanks a million. / I really appreciate your help."],
          ['回应感谢', "You're welcome. / Not at all. / It's my pleasure. / Don't mention it."],
          ['表示歉意', "I'm terribly sorry. / I do apologize for the delay."],
          ['接受歉意', "That's OK. / Forget it. / No harm done."],
          ['委婉拒绝', "I'm afraid I can't. / I wish I could, but…"],
          ['请求重复', "Pardon? / I beg your pardon? / Could you say that again, please?"]
        ]
      }
    ],
    traps: [
      'I beg your pardon 升调＝"请再说一遍"，降调＝"对不起"，题干标点可作线索。',
      '别人帮忙后说 Thank you，回应不要用 Never mind。'
    ]
  },
  {
    id: 'dlg-4',
    title: '五大高频场景固定说法：电话 / 问路 / 购物 / 就餐 / 看病',
    summary: '这些场景的说法是"死"的，背下来就是送分题。',
    body: [
      '打电话：自报家门用 This is Tom (speaking).，不说 I am Tom；问对方是谁用 Who is that (speaking)?，不说 Who are you?；其它固定说法：Hold on, please. / I\'ll put you through.（我给你转接）/ He is not available at the moment. Can I take a message? / The line is busy. / You must have dialed the wrong number.',
      '问路：Excuse me, could you tell me the way to the railway station? / How can I get to…? / Is there a bank near here? 指路：Go straight ahead and turn left at the second crossing. It\'s about ten minutes\' walk. / You can\'t miss it.（你肯定能找到）',
      '购物：Can I help you? — I\'m just looking around, thanks. / What size do you wear? / Can I try it on? / It\'s a bit tight. Do you have a larger one? / Can you come down a little?（能便宜点吗）',
      '就餐：Are you ready to order? / What would you like to have? / I\'ll have the same. / Could we have the bill (check), please? / It\'s on me.（我请客）',
      '看病：What seems to be the trouble? — I\'ve got a sore throat and a running nose. / Take this medicine three times a day. / You\'d better stay in bed for a couple of days.'
    ],
    examples: [
      { en: 'A: Hello, may I speak to Mr. Green?  B: Sorry, he is out. Would you like to leave a message?', zh: 'A：你好，请找格林先生。 B：抱歉他不在，需要留言吗？' },
      { en: "A: How long does it take to get there?  B: About twenty minutes by bus.", zh: 'A：到那儿要多久？ B：坐公交约二十分钟。' }
    ],
    traps: [
      '电话中"我是某某"必须用 This is…；"你是谁"用 Who is that，绝不用 Who are you（很不礼貌）。',
      '店员的 Can I help you? 若不需要帮助，答 I\'m just looking, thank you.，不要只说 No。'
    ]
  }
]

/* ========================================================================== */

const VOCAB_LESSONS: EnglishLesson[] = [
  {
    id: 'voc-1',
    title: '近义词辨析的三把尺子',
    summary: '搭配、语义色彩、句法结构——按这三条筛，四选一立刻剩一个。',
    body: [
      '尺子一「搭配」：先看空格前后的固定介词或名词。deal with a problem / cope with pressure / meet the requirement / achieve the goal —— 搭配对不上的直接排除，这一条能解决约一半的题。',
      '尺子二「语义色彩与语域」：同义词有褒贬和正式度差异。例如 famous（褒，出名）/ notorious（贬，臭名昭著）；child（中性）/ kid（口语）；buy（口语）/ purchase（正式书面）。文体正式的文章里选正式词。',
      '尺子三「句法结构」：看后面跟什么。rob 后面跟"人/地点"（rob sb. of sth.），steal 后面跟"物"（steal sth. from sb.）；suggest 后不能跟 sb. to do；hope 不能跟 sb. to do，但 want / wish / expect 可以。'
    ],
    tables: [
      {
        title: '学位英语高频易混词对照（考频最高的 12 组）',
        head: ['易混词', '区别', '例句'],
        rows: [
          ['affect / effect', 'affect 动词"影响"；effect 名词"效果"', 'Smoking affects health. / It has a bad effect on health.'],
          ['adapt / adopt', 'adapt to 适应、改编；adopt 采用、收养', 'adapt to the climate / adopt a new method'],
          ['principle / principal', 'principle 原则(n.)；principal 主要的(adj.)、校长(n.)', 'in principle / the principal reason'],
          ['economic / economical', 'economic 经济(方面)的；economical 节约的', 'economic growth / an economical car'],
          ['considerable / considerate', '相当大的 / 体贴周到的', 'a considerable sum / be considerate of others'],
          ['sensible / sensitive', '明智的、通情理的 / 敏感的', 'a sensible choice / be sensitive to criticism'],
          ['industrial / industrious', '工业的 / 勤勉的', 'industrial output / an industrious student'],
          ['respectable / respectful / respective', '值得尊敬的 / 恭敬的 / 各自的', 'a respectable job / be respectful to elders / their respective duties'],
          ['alive / living / live / lively', '活着的(表语/后置) / 活的(定语) / 现场直播的 / 活泼的', 'He is still alive. / a living creature / a live show / a lively girl'],
          ['raise / rise', 'raise 及物"提高"；rise 不及物"上升"', 'raise wages / Prices are rising.'],
          ['lay / lie', 'lay-laid-laid 放置；lie-lay-lain 躺；lie-lied-lied 说谎', 'lay the book on the desk / lie on the bed'],
          ['except / besides / except for', 'except 不包括；besides 除…之外还有；except for 整体肯定局部否定', 'All went except Tom. / Besides English, he knows French. / The paper is good except for a few mistakes.']
        ]
      }
    ],
    traps: [
      'affect 与 effect 是词性之争，看空格前有没有冠词/形容词：有 an / a bad → 用名词 effect。',
      '-ible / -able 结尾并不决定词义，别靠后缀猜 sensible / sensitive。'
    ]
  },
  {
    id: 'voc-2',
    title: '构词法：用词缀和词根"猜"出上千个词',
    summary: '大纲约 3600 词，死记效率低；掌握词缀后遇到生词也能推出大意。',
    body: [
      '英语单词由「前缀 + 词根 + 后缀」构成。前缀改变词义方向，后缀决定词性，词根承载核心含义。考试中遇到没见过的词，先拆解再判断。',
      '举例：incomprehensible = in(否定) + com(共同) + prehend(抓住) + ible(可…的) → "无法一起抓住的" → 不可理解的。再如 underestimate = under(不足) + estimate(估计) → 低估。'
    ],
    tables: [
      {
        title: '高频前缀',
        head: ['前缀', '含义', '例词'],
        rows: [
          ['un- / in- / im- / il- / ir- / dis- / non-', '否定', 'unfair, incorrect, impossible, illegal, irregular, dislike, nonsense'],
          ['re-', '再、回', 'rebuild, review, replace, recover'],
          ['pre- / fore-', '前、预先', 'preview, prepare, forecast, foresee'],
          ['post-', '后', 'postwar, postgraduate'],
          ['over- / under-', '过度 / 不足', 'overwork, overlook, underestimate, undergo'],
          ['inter-', '相互、之间', 'international, interview, interact'],
          ['trans-', '横过、转变', 'transport, translate, transform'],
          ['co- / com- / con-', '共同', 'cooperate, combine, connect'],
          ['sub-', '下、次', 'subway, subordinate, submarine'],
          ['auto- / tele-', '自动 / 远', 'automatic, telephone, television']
        ]
      },
      {
        title: '高频后缀（决定词性）',
        head: ['词性', '后缀', '例词'],
        rows: [
          ['名词', '-tion/-sion, -ment, -ness, -ity, -ship, -ance/-ence, -er/-or/-ist', 'education, development, kindness, ability, friendship, importance, scientist'],
          ['形容词', '-ful, -less, -able/-ible, -ive, -ous, -al, -ic, -y', 'useful, careless, comfortable, active, famous, national, economic, cloudy'],
          ['动词', '-ize/-ise, -ify, -en, -ate', 'modernize, simplify, widen, create'],
          ['副词', '-ly, -ward(s)', 'quickly, forward, afterwards']
        ]
      },
      {
        title: '常考词根',
        head: ['词根', '含义', '派生词'],
        rows: [
          ['dict', '说', 'predict, dictionary, contradict'],
          ['duc/duct', '引导', 'introduce, conduct, produce, reduce'],
          ['port', '搬运', 'transport, export, import, portable'],
          ['spect', '看', 'inspect, respect, prospect, spectator'],
          ['vis/vid', '看', 'visible, television, evidence'],
          ['scrib/script', '写', 'describe, prescription, manuscript'],
          ['press', '压', 'express, impress, depress, pressure'],
          ['fer', '带来', 'transfer, refer, differ, offer']
        ]
      }
    ]
  },
  {
    id: 'voc-3',
    title: '熟词生义：认识的词，考的却是你不知道的意思',
    summary: '阅读与词汇题的隐形杀手，只有 10% 的考生会专门准备。',
    body: [
      '命题人偏爱用"简单词的冷门义"制造区分度。这些词你都认识，但考的不是你熟悉的那个意思。下面这张表是学位英语与四级共通的高频熟词生义清单，建议直接背下来。'
    ],
    tables: [
      {
        title: '高频熟词生义',
        head: ['单词', '你熟悉的意思', '考试真正考的意思'],
        rows: [
          ['address', '地址', 'v. 处理、着手解决；发表演说（address the issue）'],
          ['appreciate', '欣赏', 'v. 感激；意识到（I would appreciate it if you could…）'],
          ['figure', '数字、人物', 'v. 认为、算出（figure out）'],
          ['observe', '观察', 'v. 遵守（observe the rules）；庆祝（observe a festival）'],
          ['present', '礼物', 'v. 提出、呈现；adj. 出席的、当前的（the present situation）'],
          ['subject', '科目', 'be subject to 易受…影响、须服从'],
          ['account', '账户', 'account for 解释 / 占比；on account of 因为'],
          ['last', '最后的', 'v. 持续（The meeting lasted two hours.）'],
          ['bear', '熊', 'v. 忍受、承担（bear the responsibility）'],
          ['mean', '意思是', 'adj. 吝啬的、卑鄙的；n. means 手段、方法'],
          ['company', '公司', 'n. 陪伴（keep sb. company）'],
          ['capital', '首都', 'n. 资本；adj. 大写的、主要的'],
          ['interest', '兴趣', 'n. 利息；利益（in the interest of）'],
          ['practice', '练习', 'n. 惯例、实践（in practice 实际上）'],
          ['spell', '拼写', 'n. 一段时间（a spell of cold weather）'],
          ['stand', '站立', 'v. 忍受（I can\'t stand it.）']
        ]
      }
    ]
  },
  {
    id: 'voc-4',
    title: '固定搭配：动词 / 形容词 / 名词 + 介词',
    summary: '搭配题占词汇部分近一半，"记搭配"比"记单词"性价比高得多。',
    body: [
      '介词搭配没有道理可讲，只能成组记忆。下面按"中心词词性"分类，收录学位英语真题反复出现的搭配。建议每天默写 10 条，两周即可覆盖。',
      '特别注意一个高频陷阱：某些 to 是介词而不是不定式符号，后面必须接 doing。'
    ],
    tables: [
      {
        title: '动词 + 介词',
        head: ['搭配', '含义', '搭配', '含义'],
        rows: [
          ['apply for / apply to', '申请 / 适用于', 'depend on', '依靠、取决于'],
          ['result in / result from', '导致 / 起因于', 'insist on', '坚持'],
          ['concentrate on', '专注于', 'prevent … from', '阻止'],
          ['prefer A to B', '喜欢 A 胜过 B', 'replace A with B', '用 B 替换 A'],
          ['refer to', '提到、参考', 'contribute to', '促成、贡献'],
          ['deal with / cope with', '处理 / 应付', 'consist of', '由…组成'],
          ['account for', '解释、占比', 'take advantage of', '利用'],
          ['make up for', '弥补', 'put up with', '忍受']
        ]
      },
      {
        title: '形容词 + 介词',
        head: ['搭配', '含义', '搭配', '含义'],
        rows: [
          ['be good at', '擅长', 'be aware of', '意识到'],
          ['be capable of', '有能力', 'be responsible for', '对…负责'],
          ['be familiar with / to', '熟悉某物 / 为某人所熟悉', 'be superior to', '优于'],
          ['be similar to', '与…相似', 'be different from', '与…不同'],
          ['be absent from', '缺席', 'be crowded with', '挤满'],
          ['be short of', '缺少', 'be worthy of', '值得']
        ]
      },
      {
        title: '★ to 是介词，后接 doing（必背）',
        head: ['搭配', '例句'],
        rows: [
          ['look forward to doing', 'I am looking forward to hearing from you.'],
          ['be / get used to doing', 'He is used to getting up early.'],
          ['be accustomed to doing', 'She is accustomed to living alone.'],
          ['object to doing', 'They objected to building a new factory here.'],
          ['devote oneself to doing', 'He devoted himself to teaching.'],
          ['contribute to doing', 'Exercise contributes to keeping fit.'],
          ['pay attention to doing', 'Pay attention to crossing the road.'],
          ['lead to doing', 'Carelessness led to failing the exam.']
        ]
      }
    ],
    traps: [
      'be used to do（被用来做）与 be used to doing（习惯于做）意思完全不同，必考。',
      'be familiar with（人熟悉物）vs be familiar to（物为人所熟悉），主语不同。'
    ]
  }
]

/* ========================================================================== */

const GRAMMAR_LESSONS: EnglishLesson[] = [
  {
    id: 'gra-1',
    title: '时态：只需吃透 8 种，覆盖 95% 考点',
    summary: '十六时态里真正常考的只有 8 种，关键在"时间信号词"。',
    body: [
      '时态题几乎都能靠"时间状语信号词"直接判定，不需要理解全文。看到 yesterday / ago / last… → 一般过去；看到 for / since / already / yet / so far / recently → 现在完成；看到 by the time / before + 过去句 → 过去完成；看到 by + 将来时间 → 将来完成。',
      '两条最重要的规则：一是"主将从现"——时间/条件状语从句（when, if, as soon as, until, before, after）中用一般现在时表示将来；二是"过去的过去用过去完成"——两个过去动作有先后时，先发生的用 had done。'
    ],
    tables: [
      {
        title: '八大常考时态',
        head: ['时态', '结构', '典型信号词', '例句'],
        rows: [
          ['一般现在', 'do / does', 'usually, every day, 真理', 'Water boils at 100 ℃.'],
          ['一般过去', 'did', 'yesterday, ago, in 1990, last week', 'He left for Beijing last week.'],
          ['一般将来', 'will do / be going to do', 'tomorrow, next week, soon', 'We will start at six.'],
          ['现在进行', 'am/is/are doing', 'now, at present, look!, listen!', 'They are having a meeting now.'],
          ['过去进行', 'was/were doing', 'at that time, when / while', 'I was cooking when he came in.'],
          ['现在完成', 'have/has done', 'for, since, already, yet, ever, never, so far', 'He has lived here for ten years.'],
          ['过去完成', 'had done', 'by the time, before, after, 过去的过去', 'The train had left before we arrived.'],
          ['将来完成', 'will have done', 'by + 将来时间', 'By next June, I will have graduated.']
        ]
      }
    ],
    examples: [
      { en: 'If it rains tomorrow, we will stay at home.', zh: '如果明天下雨，我们就待在家。', note: '主将从现：从句 rains 不能写成 will rain。' },
      { en: 'By the end of last year, they had built five bridges.', zh: '到去年年底，他们已经建了五座桥。', note: 'by the end of + 过去时间 → 过去完成时。' }
    ],
    traps: [
      '现在完成时不能与明确的过去时间点连用：✗ I have seen him yesterday. ✓ I saw him yesterday.',
      '非延续性动词不能与 for / since 连用，须转换：die→be dead，buy→have，leave→be away，join→be in / be a member of，begin→be on。',
      'This is the first time that… 后接现在完成时；It was the first time that… 后接过去完成时。'
    ]
  },
  {
    id: 'gra-2',
    title: '被动语态：什么时候必须用被动',
    summary: 'be + 过去分词；但有一批动词永远不能变被动。',
    body: [
      '基本结构 be + done，各时态只需改 be 的形式：is done / was done / will be done / is being done / has been done / can be done。',
      '什么时候用被动：① 主语是动作的承受者；② 不知道或不必说明施动者；③ 科技、说明、新闻文体习惯用被动使表述客观。',
      '不及物动词及部分特殊动词没有被动语态：happen, take place, break out, appear, disappear, belong to, consist of, last, cost, fit, suit, resemble。看到这些词出现在被动结构里，直接判错。',
      '短语动词变被动时要保持完整：The meeting was put off.（不能丢掉 off）/ He was looked after by his aunt.（不能丢掉 after）。',
      '主动形式表被动含义：The book sells well. / The pen writes smoothly. / The door won\'t lock. 以及 need / want / require / deserve + doing = to be done：The window needs cleaning. = The window needs to be cleaned.'
    ],
    traps: [
      '✗ The accident was happened yesterday. ✓ The accident happened yesterday.',
      '带双宾语的动词变被动有两种形式：I was given a book. / A book was given to me.',
      '含有 make / see / hear / watch 等使役感官动词的主动句省略 to，变被动时 to 要还原：He was made to work overtime.'
    ]
  },
  {
    id: 'gra-3',
    title: '非谓语动词：to do / doing / done 三分法',
    summary: '最容易失分的语法点，核心是"谁跟哪个"和"逻辑主语一致"。',
    body: [
      '三种形式的基本语感：不定式 to do 表"目的、将来、具体一次"；动名词 doing 表"一般性、抽象、已发生"；分词中 doing 表"主动/进行"，done 表"被动/完成"。',
      '只跟动名词的动词（口诀：建议+避免+完成+享受+承认否认）：enjoy, avoid, mind, finish, practise, suggest, consider, imagine, admit, deny, escape, risk, keep, delay, miss, appreciate, can\'t help。',
      '只跟不定式的动词：want, hope, wish, decide, expect, promise, refuse, manage, afford, pretend, agree, offer, fail, happen, seem。',
      '两者都能跟但意思不同的动词，是考试重灾区，必须精确掌握（见下表）。',
      '分词作状语时，其逻辑主语必须与主句主语一致，这叫"垂悬分词"考点：✗ Walking in the street, a car hit him. ✓ Walking in the street, he was hit by a car.'
    ],
    tables: [
      {
        title: '跟 to do 与跟 doing 意思不同的动词',
        head: ['动词', '+ to do', '+ doing'],
        rows: [
          ['remember / forget', '记得/忘记「要去做」（未做）', '记得/忘记「做过」（已做）'],
          ['regret', '遗憾地「要去」通知/告知', '后悔「做过」'],
          ['stop', '停下来「去做另一件事」', '停止「正在做的事」'],
          ['try', '努力去做', '试着做做看'],
          ['mean', '打算做', '意味着'],
          ['go on', '接着做另一件事', '继续做同一件事']
        ]
      }
    ],
    examples: [
      { en: 'Remember to lock the door when you leave.', zh: '走时记得锁门。（还没锁）' },
      { en: 'I remember locking the door before I left.', zh: '我记得走之前锁过门了。（已经锁了）' },
      { en: 'Given more time, we could have done it better.', zh: '如果给我们更多时间，本可以做得更好。', note: '过去分词短语作条件状语。' }
    ],
    traps: [
      'It is no use / no good / a waste of time + doing（不能用 to do）。',
      'have difficulty / trouble / a hard time (in) doing。',
      'be busy doing，spend time (in) doing，prevent sb. from doing。'
    ]
  },
  {
    id: 'gra-4',
    title: '定语从句：三步锁定关系词',
    summary: '看先行词 → 看从句缺什么 → 看有无特殊限制，三步必出答案。',
    body: [
      '第一步看先行词：指人用 who / whom / that；指物用 which / that；表所属用 whose（人物皆可，= of which / of whom）。',
      '第二步看从句缺什么成分：缺主语或宾语 → 用关系代词（who/which/that）；不缺成分（句子完整）→ 用关系副词（where/when/why）。这是最快的判断法。关系副词等于"介词 + which"：where = in/at/on which，when = on/in/during which，why = for which。',
      '第三步看特殊限制：只能用 that 的情况——先行词被 the only / the very / the same / 最高级 / 序数词修饰；先行词是 all, everything, nothing, anything, little, much, none；先行词同时包含人和物；先行词前有 who/which 疑问词。只能用 which 的情况——非限制性定语从句（逗号后）；介词后面（in which, for which, with whom）。',
      '非限制性定语从句中的 which 可以指代整个主句：He passed the exam, which surprised us all.（which 指"他通过考试"这件事）。'
    ],
    examples: [
      { en: 'This is the factory where I worked ten years ago.', zh: '这就是我十年前工作的工厂。', note: '从句 I worked 完整，不缺成分 → 用 where（= in which）。' },
      { en: 'This is the factory which I visited last week.', zh: '这就是我上周参观的工厂。', note: 'visited 缺宾语 → 用 which/that。' },
      { en: 'As is known to all, China is a developing country.', zh: '众所周知，中国是发展中国家。', note: 'as 引导的非限制性从句可放句首，which 不可以。' }
    ],
    traps: [
      '介词后面绝不能用 that，也不能用 who（要用 whom）：the man with whom I talked。',
      '关系代词作宾语时可以省略，作主语时不能省略。',
      '同一个先行词，逗号有无决定限制性还是非限制性，翻译含义完全不同。'
    ]
  },
  {
    id: 'gra-5',
    title: '名词性从句：that 与 what 的分水岭',
    summary: '从句"完整"用 that，从句"缺成分"用 what——这一条能解决大半题目。',
    body: [
      '名词性从句包括主语从句、宾语从句、表语从句、同位语从句，四者引导词规则一致。',
      '核心判定：that 只起连接作用、不作任何成分、无实际意义（从句是完整句）；what 既连接又在从句中作主语/宾语/表语（从句缺成分）。例：What he said is true.（said 缺宾语，用 what）/ That he came late is true.（came late 完整，用 that）。',
      'whether 与 if 的区别：介词后、句首主语从句、与 or not 直接连用、后接不定式，这四种情况只能用 whether；if 只能引导宾语从句。',
      '同位语从句 vs 定语从句：同位语从句解释抽象名词的"内容"（fact, news, idea, hope, problem, question, doubt, conclusion），that 不作成分；定语从句修饰先行词，that 要作主语或宾语。对比：The news that he won the game is true.（同位语，说明 news 的内容）/ The news that he told me is true.（定语，told 缺宾语）。',
      '主语从句常用 it 作形式主语：It is necessary / important / strange that + (should) do（虚拟语气）；It is said / reported / believed that…'
    ],
    traps: [
      '宾语从句时态呼应：主句是过去时，从句一般用相应的过去时；但客观真理仍用一般现在时。',
      'doubt 用于肯定句后接 whether，用于否定/疑问句后接 that：I doubt whether he will come. / I don\'t doubt that he will come.'
    ]
  },
  {
    id: 'gra-6',
    title: '虚拟语气：三大条件句 + 五类固定场景',
    summary: '学位英语必考，且几乎年年考"省略 if 的倒装"。',
    body: [
      '虚拟语气表示与事实相反或难以实现的假设。三大条件句是骨架，务必把"从句用什么、主句用什么"背成条件反射。',
      '错综时间条件句：从句与主句时间不同步时，各自按各自的时间选形式。例：If you had taken my advice, you would be better now.（从句与过去相反，主句与现在相反）。',
      '省略 if 的倒装：把 were / had / should 提到句首，去掉 if。Were I you, I would accept it. / Had he come earlier, he wouldn\'t have missed the train. / Should it rain tomorrow, we would cancel the trip. 这是高频送分题，认准句首的 Were / Had / Should。'
    ],
    tables: [
      {
        title: '三大条件句',
        head: ['类型', 'if 从句', '主句'],
        rows: [
          ['与现在事实相反', 'did / were', 'would / could / might + do'],
          ['与过去事实相反', 'had done', 'would / could / might + have done'],
          ['与将来可能相反', 'did / were to do / should do', 'would / could / might + do']
        ]
      },
      {
        title: '五类固定虚拟场景',
        head: ['场景', '规则', '例句'],
        rows: [
          ['wish 后的从句', '现在 did / 过去 had done / 将来 would do', 'I wish I were younger.'],
          ['would rather 后的从句', '用过去式表现在，过去完成表过去', "I'd rather you came tomorrow."],
          ['as if / as though', '与事实相反用过去式', 'He talks as if he knew everything.'],
          ["It's (high) time that…", '用过去式或 should + do', "It's high time that we left."],
          ['建议/命令/要求类词后', '(should) + 动词原形', 'He suggested that we (should) start early.']
        ]
      }
    ],
    traps: [
      '"一坚持二命令三建议四要求"后接 (should) do：insist, order/command, suggest/advise/propose/recommend, demand/require/request/desire。',
      'suggest 表"暗示、表明"、insist 表"坚称"时用陈述语气，不用虚拟：The evidence suggests that he is guilty.',
      'It is necessary / essential / important / strange / natural that + (should) do。'
    ]
  },
  {
    id: 'gra-7',
    title: '主谓一致：就近、就远与整体三原则',
    summary: '每年必考 1—2 题，规则清晰，属于稳拿分。',
    body: [
      '就近原则（谓语随最靠近的主语）：there be 句型、or、either…or、neither…nor、not only…but also、not…but。例：Neither you nor he is right.',
      '就远/整体原则（谓语随前面那个主语）：with, along with, together with, as well as, including, rather than, except, besides 连接时，谓语与前面的主语一致。例：The teacher, together with his students, is going to the park.',
      '数量表达：a number of + 复数名词 + 复数动词（许多）；the number of + 复数名词 + 单数动词（…的数量）。分数、百分数、most of、half of + of 后名词决定单复数。',
      'each, every, either, neither, one of, many a + 单数名词 + 单数动词；none of 与 all of 视 of 后名词而定。',
      '集合名词 family, team, class, government, audience：强调整体用单数，强调成员用复数。The + 形容词表一类人，用复数：The rich are not always happy.',
      '主语是不定式、动名词或从句时，谓语用单数：Reading English aloud every morning is helpful.'
    ],
    traps: [
      'A number of students are… / The number of students is… 这两句是经典对比题。',
      'Many a student has passed…（many a + 单数 + 单数动词）。'
    ]
  },
  {
    id: 'gra-8',
    title: '倒装、强调与比较结构',
    summary: '句首出现否定词或 only，立刻想到部分倒装。',
    body: [
      '完全倒装：地点方位副词或介词短语置于句首（Here comes the bus. / In the room sat an old man. / Under the tree stands a boy.）；There be 句型。',
      '部分倒装（只把助动词/情态动词/be 提前）：① 否定词或半否定词置于句首——Never, Seldom, Rarely, Hardly, Scarcely, Little, Not until, No sooner…than, Hardly…when, By no means, In no case；② Only + 状语（副词/介词短语/状语从句）置于句首；③ so / neither / nor + 助动词 + 主语（表示"也…"）；④ 省略 if 的虚拟倒装。',
      '强调句型：It is / was + 被强调部分 + that / who + 其余部分。判断口诀——把 It is…that 去掉，剩下的仍是完整句子，就是强调句；否则是定语从句或主语从句。强调谓语动词用 do / does / did + 动词原形：I do hope you can come.',
      '比较结构必背：the + 比较级…, the + 比较级…（越…越…）；not so much A as B（与其说 A 不如说 B）；no more…than（两者都不）；would rather A than B；as…as 与 not so/as…as；倍数表达 A is three times as large as B = A is three times the size of B。',
      '部分否定：all / both / every / everyone / always + not = 并非都…。All that glitters is not gold.（发光的并非都是金子）。'
    ],
    examples: [
      { en: 'Not until he came back did we start the meeting.', zh: '直到他回来我们才开始开会。', note: 'Not until 置于句首，主句部分倒装。' },
      { en: 'It was in the park that I met her yesterday.', zh: '我昨天是在公园遇见她的。', note: '强调状语；去掉 It was…that 后句子完整。' },
      { en: 'Only in this way can we solve the problem.', zh: '只有这样我们才能解决问题。' }
    ],
    traps: [
      'Only 后接主语时不倒装：Only he knows the answer.（不倒装）。',
      'so…that 中 so + adj./adv. 置于句首要倒装：So excited was he that he couldn\'t sleep.'
    ]
  }
]

/* ========================================================================== */

const READING_LESSONS: EnglishLesson[] = [
  {
    id: 'rd-1',
    title: '五类题型的识别与固定解法',
    summary: '题干长什么样，就用什么方法——不要用一套方法打天下。',
    body: [
      '阅读理解通常 4 篇文章 20 题，考的题型高度固定。先根据题干判断题型，再套对应解法，是提分最快的路径。'
    ],
    tables: [
      {
        title: '题型速查',
        head: ['题型', '题干特征', '解法'],
        rows: [
          ['主旨大意', 'main idea / mainly about / best title / What is the passage about', '看首末段与各段首句；选覆盖全文的，不选过宽或过窄的'],
          ['细节事实', 'According to the passage / Which of the following is true / mentioned', '用定位词回原文找出处，选与原文同义改写的选项'],
          ['推理判断', 'infer / imply / suggest / conclude / learn from', '基于原文小幅推理，不能脑补；答案在原文一定有依据句'],
          ['词义猜测', 'The word "X" in Line n probably means', '看上下文的并列、转折、因果、举例、同位关系'],
          ['观点态度', "attitude / tone / What does the author think of", '找情感形容词与评价性副词；无明显褒贬则选 objective/neutral']
        ]
      }
    ],
    traps: [
      '主旨题不要只看第一段就选，很多文章第一段是引子，真正主旨在第二段首句或末段。',
      '词义猜测题的正确答案往往不是这个词最常用的意思。'
    ]
  },
  {
    id: 'rd-2',
    title: '定位与同义替换：阅读的底层机制',
    summary: '正确选项极少与原文字面相同，它是原文的"改写版"。',
    body: [
      '学位英语阅读的命题逻辑是：把原文某句用同义词/换句式改写成正确选项。因此解题就是"找到原文出处 → 判断哪个选项是它的同义改写"。',
      '定位三步：① 从题干圈出"不可被替换的词"（专有名词、数字、年份、大写词、生僻名词）；② 回原文扫描这个词；③ 精读该词所在句及前后各一句。',
      '注意：能被替换的词（如 important, many, because）不能作定位词，因为原文很可能换了说法。'
    ],
    tables: [
      {
        title: '高频同义改写对照',
        head: ['原文常见说法', '选项常见改写'],
        rows: [
          ['a large number of / plenty of', 'numerous / considerable / a great deal of'],
          ['because of / thanks to', 'due to / owing to / as a result of'],
          ['important', 'vital / crucial / significant / essential'],
          ['difficult', 'challenging / demanding / tough'],
          ['use', 'utilize / employ / make use of'],
          ['increase', 'rise / grow / go up / boost'],
          ['help', 'facilitate / contribute to / benefit'],
          ['show', 'indicate / demonstrate / reveal / suggest']
        ]
      }
    ]
  },
  {
    id: 'rd-3',
    title: '干扰项的五大特征（会认就会排除）',
    summary: '与其纠结哪个对，不如快速识别哪三个一定错。',
    body: [
      '一、无中生有：选项内容本身很合理，但原文根本没提。这是最常见的错项，尤其在推理题中。',
      '二、偷换概念：把原文的主语、对象、时间、范围悄悄换掉。例如原文说"部分年轻人"，选项说"所有学生"。',
      '三、以偏概全 / 绝对化：出现 always, all, never, only, must, none, completely 等绝对词的选项，正确率极低（除非原文本身就是绝对表述）。相反，含有 may, might, some, often, tend to 等模糊词的选项更可能正确。',
      '四、张冠李戴：把 A 的观点安到 B 头上，常见于有多个人物/机构观点的文章。',
      '五、过度推理：原文只说了一个趋势或现象，选项直接下结论、给对策，超出原文范围。'
    ],
    traps: [
      '正确答案通常"语气温和、范围保守"；错误答案往往"说得太满"。',
      '如果两个选项意思相反，答案常在这两个之中。'
    ]
  },
  {
    id: 'rd-4',
    title: '时间分配与做题顺序',
    summary: '4 篇 20 题约 40 分钟，每篇不超过 10 分钟。',
    body: [
      '推荐顺序：先扫题干圈定位词（约 1 分钟）→ 带着问题读文章（约 4 分钟）→ 逐题回原文定位作答（约 4 分钟）→ 主旨题最后做（约 1 分钟）。',
      '题目顺序与文章行文顺序基本一致：第 1 题的答案通常在前 1/3，最后一题通常在末段。这一规律可用于快速缩小定位范围。',
      '遇到生词不要停：先用词根词缀 + 上下文推测；只有当这个词是定位词或考点词时才值得反复琢磨。',
      '遇到长难句只抓主谓宾，把从句、插入语、介词短语先整体括起来。',
      '严格控时：某篇卡住超过 10 分钟就先蒙一个答案标记，做完其它篇再回头。阅读占分最高（通常 40 分），不能被一篇拖垮。'
    ]
  }
]

/* ========================================================================== */

const CLOZE_LESSONS: EnglishLesson[] = [
  {
    id: 'cz-1',
    title: '完形填空四步法',
    summary: '一篇约 200 词短文挖空，考的是"语篇逻辑"而不是单个空。',
    body: [
      '第一步：跳过空格通读全文，抓住主旨。完形填空的首句通常不设空，它就是主旨句，务必读透。',
      '第二步：判断每个空的考点类型——① 词义辨析（四个选项同词性近义）；② 固定搭配（空格前后有介词/名词提示）；③ 逻辑连接（空格在句首且后有逗号）；④ 语法结构（时态、非谓语、代词）。判断类型后用对应方法处理。',
      '第三步：利用"复现"原则。完形填空的正确答案有很高概率在上下文出现过它的同根词、同义词或反义词。当四个选项难以取舍时，回原文找哪个词与上下文形成呼应。',
      '第四步：把答案代入通读一遍，检查语篇是否连贯、代词指代是否清楚、时态是否统一。'
    ],
    traps: [
      '不要一个空一个空地孤立做，超过一半的空需要跨句判断。',
      '若某空实在不确定，看该选项在文章的"语义场"里是否协调（讲环保的文章不会突然出现商业术语）。'
    ]
  },
  {
    id: 'cz-2',
    title: '逻辑信号词表（完形与阅读通用）',
    summary: '看到句首空格 + 逗号，90% 是在考逻辑连接词。',
    body: [
      '逻辑关系是完形填空最稳定的得分点。先判断前后两句的关系（转折/因果/递进/让步/举例/总结/对比），再从选项中挑对应的词。'
    ],
    tables: [
      {
        title: '逻辑关系与信号词',
        head: ['关系', '常用信号词'],
        rows: [
          ['转折', 'but, however, yet, nevertheless, on the contrary, instead, while'],
          ['因果', 'because, since, as, for, therefore, thus, hence, consequently, as a result'],
          ['递进', 'besides, moreover, furthermore, in addition, what is more, also'],
          ['让步', 'although, though, even if, even though, despite, in spite of, nonetheless'],
          ['举例', 'for example, for instance, such as, take … for example'],
          ['总结', 'in short, in a word, to sum up, in conclusion, on the whole'],
          ['对比', 'while, whereas, on the other hand, by contrast, unlike'],
          ['顺序', 'first, then, afterwards, finally, meanwhile']
        ]
      }
    ],
    traps: [
      'despite / in spite of 后接名词或动名词，不能接句子；although / though 后接句子。',
      'although 与 but 不能同时出现在一个句子里（because 与 so 同理）。'
    ]
  },
  {
    id: 'cz-3',
    title: '完形高频细碎考点：代词、数量词与近义词组',
    summary: 'other / another / the other / others 这类小词年年考。',
    body: [
      'other + 复数名词（其它的，泛指）；another + 单数名词（另一个，三者及以上）；the other 两者中的另一个；others = other + 名词（泛指其他人/物）；the others 剩下的全部。',
      'few / a few + 可数复数（few 几乎没有，含否定；a few 有一些，含肯定）；little / a little + 不可数，用法同理。',
      'too（用于肯定句末）/ either（用于否定句末）/ also（句中）/ as well（句末，肯定）。',
      'no longer（不再，时间）/ no more（不再，数量或程度）；not…any longer = no longer。',
      'because（原因，回答 why）/ since、as（已知原因，语气弱）/ for（补充说明，不置句首）；so（结果）/ such（后接名词）。',
      'affect（动词）/ influence（可名可动）/ impact（名词为主，have an impact on）。'
    ]
  }
]

/* ========================================================================== */

const TRANSLATION_LESSONS: EnglishLesson[] = [
  {
    id: 'tr-1',
    title: '长难句拆分五步法',
    summary: '看不懂长句不是词汇问题，是"没找到主干"。',
    body: [
      '第一步：找出主句谓语动词，确定"主 + 谓 + 宾"主干。技巧是先划掉所有从句、介词短语、插入语，剩下的就是主干。',
      '第二步：标出从句引导词（that, which, who, when, because, if, although…），确定每个从句修饰谁、作什么成分。',
      '第三步：标出非谓语结构（doing / done / to do），判断它是定语、状语还是补语。',
      '第四步：按中文习惯重排语序。英语的后置定语要前置为"…的"；英语被动多译为中文主动；英语的原因、条件、让步状语从句在中文里习惯前置。',
      '第五步：通读润色，去掉"翻译腔"。检查是否漏译数字、否定词、时间状语。'
    ],
    examples: [
      {
        en: 'Although the government has taken a series of measures to control air pollution, the problem remains far from being solved.',
        zh: '尽管政府已经采取了一系列措施治理空气污染，但这一问题远未得到解决。',
        note: '让步从句前置，far from being solved 转译为"远未得到解决"。'
      },
      {
        en: 'It is generally believed that the rapid development of the Internet has changed the way people communicate with each other.',
        zh: '人们普遍认为，互联网的迅速发展改变了人们相互交流的方式。',
        note: 'It is believed that… 译成中文无主句"人们普遍认为"。'
      }
    ]
  },
  {
    id: 'tr-2',
    title: '三类难点结构的中文处理法',
    summary: '定语从句、被动语态、状语语序——考点集中在这三处。',
    body: [
      '定语从句三种译法：① 前置法（从句短）——译成"…的"放在名词前：The book which I bought yesterday is interesting. → 我昨天买的那本书很有意思。② 后置法（从句长）——单独成句，重复先行词：He has a son, who works in Beijing. → 他有个儿子，这个儿子在北京工作。③ 融合法——把主句和从句合译：There is a man who wants to see you. → 有人想见你。',
      '被动语态四种译法：① 加泛指主语"人们/有人/大家/我们"：It is said that… → 据说…；② 译成中文被动"被/受到/得到/由…所"；③ 译成无主句："必须指出…"；④ 直接转为主动，把 by 后的对象作主语。',
      '状语语序：英语状语可后置，中文习惯前置。原因、条件、让步、时间状语翻译时通常移到句首。'
    ],
    tables: [
      {
        title: '被动句常见套译',
        head: ['英文', '地道中译'],
        rows: [
          ['It is said that…', '据说…'],
          ['It is reported that…', '据报道…'],
          ['It is generally believed that…', '人们普遍认为…'],
          ['It must be pointed out that…', '必须指出…'],
          ['It has been proved that…', '已经证明…'],
          ['It should be noted that…', '应当注意…']
        ]
      }
    ]
  },
  {
    id: 'tr-3',
    title: '翻译常见扣分点自查清单',
    summary: '阅卷按点给分，漏一个否定词可能整句作废。',
    body: [
      '一、漏译：数字、否定词（not / no / hardly / few / seldom）、时间状语、程度副词最容易漏，且往往是采分点。',
      '二、词性硬译：英语名词化倾向强，中文动词化倾向强。The implementation of the policy… 译作"政策的实施"生硬，译作"实施这项政策"更地道。',
      '三、多义词选错义项：结合上下文与学科背景确定，不要凭第一反应。',
      '四、中文不通顺：长定语堆砌是典型翻译腔，应拆成短句。',
      '五、专有名词：常见国家、机构、人名按通用译名；不确定的可保留英文原文，不要臆造。',
      '六、时间不足：翻译建议控制在 10—12 分钟，先保证句子完整通顺，再润色用词。'
    ]
  }
]

/* ========================================================================== */

const WRITING_LESSONS: EnglishLesson[] = [
  {
    id: 'wr-1',
    title: '三段式结构与时间分配',
    summary: '100—120 词，25 分钟，结构固定就不会跑题。',
    body: [
      '第一段（2—3 句）：引出话题 + 亮明观点或概述现象。不要写与主题无关的铺垫。',
      '第二段（4—5 句）：给出 2—3 个理由，每个理由后跟一句支撑（例子、常识、简要说明）。这是拉开分差的地方——只列观点不展开会被判为"内容单薄"。',
      '第三段（2 句）：总结全文 + 提出建议或展望。',
      '时间分配：审题 3 分钟（务必看清是议论、说明还是应用文，看清提纲每一点都要覆盖）→ 列中文提纲 3 分钟 → 成文 16—18 分钟 → 检查 3 分钟。',
      '字数：低于要求会直接扣分；超出不加分反而增加出错概率。100—120 词大致是 8—11 个句子。'
    ],
    traps: [
      '提纲作文必须逐条覆盖提纲要点，漏一点扣一档。',
      '不要通篇简单句，也不要冒险堆砌没把握的长句，宁可"稳"。'
    ]
  },
  {
    id: 'wr-2',
    title: '范文一：观点议论文（含完整范文）',
    summary: '题目：Should College Students Take Part-time Jobs?',
    body: [
      '这是最常考的文体。结构：现象/背景 → 我的观点 → 理由 1 + 支撑 → 理由 2 + 支撑 → 让步（承认反面）→ 总结建议。',
      '下面是一篇符合字数要求（约 115 词）的完整范文，可直接背诵框架，替换主题词即可套用。'
    ],
    examples: [
      {
        en: 'Nowadays, more and more college students choose to take part-time jobs in their spare time. In my opinion, this is a positive trend. \n\nFirst of all, a part-time job helps students gain practical experience which cannot be learned from textbooks. For example, working as a tutor improves both communication skills and patience. Besides, it enables students to earn some money and reduce the financial burden on their parents. However, every coin has two sides. If students spend too much time working, their studies may be affected. \n\nIn conclusion, taking a part-time job is beneficial as long as students keep a balance between work and study.',
        zh: '如今，越来越多的大学生选择在业余时间做兼职。在我看来，这是一个积极的趋势。\n\n首先，兼职能让学生获得课本上学不到的实践经验。例如，做家教既能提高沟通能力，也能锻炼耐心。此外，兼职还能让学生赚些钱，减轻父母的经济负担。然而，凡事都有两面。如果学生花太多时间打工，学业可能会受影响。\n\n总之，只要能平衡好工作与学习，做兼职就是有益的。',
        note: '注意其中的加分点：定语从句 which cannot be learned…、However 让步、as long as 条件从句。'
      }
    ]
  },
  {
    id: 'wr-3',
    title: '范文二：应用文书信（申请信 / 建议信 / 道歉信）',
    summary: '格式固定，三段清楚，落款别忘。',
    body: [
      '书信格式：称呼 Dear Sir or Madam, / Dear Mr. Smith,（顶格，后加逗号）→ 第一段说明写信目的 → 第二段展开细节 → 第三段表达期待并致谢 → 落款 Yours sincerely, + 换行 + Li Ming（如题目未给姓名，一律用 Li Ming）。',
      '常用开头：I am writing to apply for… / I am writing to express my apology for… / I am writing to make some suggestions about…',
      '常用结尾：I would appreciate it if you could give me an early reply. / Thank you for your time and consideration. / I am looking forward to your reply.'
    ],
    examples: [
      {
        en: 'Dear Mr. Smith,\n\nI am writing to apply for the position of English translator advertised on your website.\n\nI graduated from Beijing Normal University with a bachelor\'s degree in English. During the past three years, I have worked as a part-time translator, which has greatly improved my language skills. Moreover, I am hard-working and good at teamwork.\n\nI would appreciate it if you could give me an interview opportunity. Thank you for your time and consideration.\n\nYours sincerely,\nLi Ming',
        zh: '尊敬的史密斯先生：\n\n我写信是想应聘贵网站上刊登的英语翻译一职。\n\n我毕业于北京师范大学，获英语学士学位。过去三年里我做过兼职翻译，这大大提升了我的语言能力。此外，我工作勤奋，善于团队协作。\n\n如能给我一次面试机会，我将不胜感激。感谢您抽出时间考虑我的申请。\n\n此致\n李明'
      }
    ],
    traps: [
      '不要写真实姓名与学校（避免违规），统一用 Li Ming。',
      '落款 Yours sincerely 后面有逗号，姓名另起一行。'
    ]
  },
  {
    id: 'wr-4',
    title: '高分句型 12 条与自查清单',
    summary: '每篇作文用上 3—4 个高分句型即可明显提档。',
    body: [
      '下面 12 个句型覆盖开头、展开、让步、结尾，全部为可安全使用的地道表达。建议默写到能不假思索写出。'
    ],
    tables: [
      {
        title: '高分句型',
        head: ['位置', '句型'],
        rows: [
          ['开头', 'With the rapid development of society, more and more people come to realize the importance of …'],
          ['开头', 'When it comes to …, opinions vary from person to person.'],
          ['开头', 'There is no doubt that … plays an increasingly important role in our daily life.'],
          ['观点', 'As far as I am concerned, the advantages far outweigh the disadvantages.'],
          ['观点', 'It is universally acknowledged that …'],
          ['展开', 'To begin with, … What is more, … Last but not least, …'],
          ['举例', 'Take … for example. / A case in point is that …'],
          ['因果', '…, which contributes a lot to …'],
          ['让步', 'However, every coin has two sides. / Admittedly, … but …'],
          ['对比', 'On the one hand, … On the other hand, …'],
          ['结尾', 'Only by … can we …（注意倒装）'],
          ['结尾', 'In conclusion, it is high time that we took effective measures to …']
        ]
      },
      {
        title: '交卷前 8 项自查',
        head: ['#', '检查项'],
        rows: [
          ['1', '主谓一致：第三人称单数的 -s 有没有漏'],
          ['2', '时态是否统一，描述现象用一般现在时'],
          ['3', '名词单复数、可数不可数是否正确'],
          ['4', '冠词 a / an / the 有没有漏或多'],
          ['5', '句首大写、句末标点、专有名词大写'],
          ['6', '是否至少有 2 个从句 + 1 个非谓语结构'],
          ['7', '是否分了 3 段、每段有没有明显主题句'],
          ['8', '字数是否达标，卷面是否整洁无涂改']
        ]
      }
    ]
  }
]

/* ========================================================================== */

const VOCAB_LIST_LESSONS: EnglishLesson[] = [
  {
    id: 'vl-1',
    title: '高频名词 24 个（带搭配）',
    summary: '记名词一定要连搭配一起记，考的就是搭配。',
    body: ['以下词汇在历年学位英语真题的词汇题、完形与写作中反复出现。建议配合本页「查词收藏」功能加入生词本循环复习。'],
    tables: [
      {
        head: ['单词', '词性/释义', '高频搭配或例句'],
        rows: [
          ['ability', 'n. 能力', 'the ability to do sth.'],
          ['access', 'n. 通道、获取权', 'have access to the Internet'],
          ['advantage', 'n. 优势', 'take advantage of / have an advantage over'],
          ['attention', 'n. 注意', 'pay attention to / draw attention'],
          ['benefit', 'n./v. 益处；受益', 'be of great benefit to / benefit from'],
          ['certificate', 'n. 证书', 'a degree certificate'],
          ['challenge', 'n./v. 挑战', 'face a challenge / meet the challenge'],
          ['circumstance', 'n. 情况、环境', 'under no circumstances（倒装）'],
          ['communication', 'n. 交流', 'effective communication'],
          ['confidence', 'n. 信心', 'have confidence in / build up confidence'],
          ['consequence', 'n. 后果', 'as a consequence of'],
          ['contribution', 'n. 贡献', 'make a contribution to'],
          ['effect', 'n. 效果、影响', 'have a great effect on / come into effect'],
          ['environment', 'n. 环境', 'protect the environment'],
          ['evidence', 'n. 证据（不可数）', 'a piece of evidence / in evidence'],
          ['influence', 'n./v. 影响', 'have an influence on'],
          ['opportunity', 'n. 机会', 'take the opportunity to do'],
          ['pressure', 'n. 压力', 'under great pressure / cope with pressure'],
          ['progress', 'n. 进步（不可数）', 'make great progress in'],
          ['requirement', 'n. 要求', 'meet the requirements'],
          ['responsibility', 'n. 责任', 'take responsibility for'],
          ['significance', 'n. 重要性', 'be of great significance'],
          ['solution', 'n. 解决办法', 'a solution to the problem'],
          ['tendency', 'n. 趋势', 'have a tendency to do']
        ]
      }
    ]
  },
  {
    id: 'vl-2',
    title: '高频动词 24 个（带句型）',
    summary: '动词记"后面跟什么"比记中文意思更重要。',
    body: ['注意每个动词后面接不定式、动名词还是从句——这正是词汇与语法题的考点。'],
    tables: [
      {
        head: ['单词', '释义', '句型/搭配'],
        rows: [
          ['achieve', '实现、取得', 'achieve one\'s goal'],
          ['acquire', '获得、习得', 'acquire knowledge / skills'],
          ['adjust', '调整、适应', 'adjust to the new environment'],
          ['afford', '负担得起', 'can afford to do sth.'],
          ['apply', '申请、应用', 'apply for a job / apply to sth.'],
          ['assume', '假定、承担', 'assume that … / assume responsibility'],
          ['avoid', '避免', 'avoid doing sth.（不能跟 to do）'],
          ['consider', '考虑、认为', 'consider doing / consider sb. (to be) …'],
          ['contribute', '贡献、促成', 'contribute to (doing) sth.'],
          ['convince', '使信服', 'convince sb. of sth. / convince sb. that …'],
          ['demand', '要求', 'demand that sb. (should) do'],
          ['deserve', '值得', 'deserve to be done / deserve doing'],
          ['emphasize', '强调', 'emphasize the importance of'],
          ['encourage', '鼓励', 'encourage sb. to do sth.'],
          ['ensure', '确保', 'ensure that … / ensure sb. sth.'],
          ['involve', '涉及、使参与', 'be involved in / involve doing'],
          ['maintain', '维持、主张', 'maintain that … / maintain a balance'],
          ['obtain', '获得', 'obtain a degree'],
          ['prevent', '阻止', 'prevent sb. from doing'],
          ['promote', '促进、提升', 'promote economic growth'],
          ['reduce', '减少', 'reduce the cost by 20%'],
          ['remind', '提醒', 'remind sb. of sth. / remind sb. to do'],
          ['suggest', '建议；表明', 'suggest (sb.\'s) doing / suggest that sb. (should) do'],
          ['tend', '倾向于', 'tend to do sth.']
        ]
      }
    ]
  },
  {
    id: 'vl-3',
    title: '高频形容词与副词 24 个',
    summary: '写作换掉 good / bad / very，作文档次立刻提升。',
    body: ['作文中把 good 换成 beneficial、把 bad 换成 harmful、把 very important 换成 crucial，是最低成本的提分动作。'],
    tables: [
      {
        head: ['单词', '释义', '用法示例'],
        rows: [
          ['abundant', '丰富的', 'abundant natural resources'],
          ['accurate', '准确的', 'accurate data'],
          ['adequate', '充足的', 'adequate preparation'],
          ['appropriate', '合适的', 'an appropriate method'],
          ['beneficial', '有益的', 'be beneficial to health'],
          ['considerable', '相当大的', 'a considerable amount of'],
          ['crucial', '至关重要的', 'play a crucial role in'],
          ['efficient', '高效的', 'an efficient way'],
          ['essential', '必要的', 'It is essential that … (should) do'],
          ['flexible', '灵活的', 'flexible working hours'],
          ['harmful', '有害的', 'be harmful to'],
          ['inevitable', '不可避免的', 'an inevitable result'],
          ['numerous', '许多的', 'numerous examples'],
          ['practical', '实际的、实用的', 'practical experience'],
          ['reliable', '可靠的', 'a reliable source'],
          ['significant', '重大的', 'a significant improvement'],
          ['sufficient', '足够的', 'sufficient evidence'],
          ['temporary', '暂时的', 'a temporary solution'],
          ['gradually', 'ad. 逐渐地', 'The situation improved gradually.'],
          ['consequently', 'ad. 因此', 'Consequently, prices went up.'],
          ['furthermore', 'ad. 此外', 'Furthermore, it saves money.'],
          ['nevertheless', 'ad. 然而', 'Nevertheless, we must try.'],
          ['obviously', 'ad. 显然', 'Obviously, he is right.'],
          ['particularly', 'ad. 尤其', 'particularly in rural areas']
        ]
      }
    ]
  }
]

/* ========================================================================== */

const PHRASE_LESSONS: EnglishLesson[] = [
  {
    id: 'ph-1',
    title: '核心动词短语 30 条',
    summary: '完形与词汇题的主战场，按动词归类记忆最省力。',
    body: ['同一个动词加不同小品词意思天差地别，成组记忆能大幅减少混淆。'],
    tables: [
      {
        title: 'take / make / put / get 家族',
        head: ['短语', '含义', '短语', '含义'],
        rows: [
          ['take place', '发生（无被动）', 'make up', '组成；编造；化妆'],
          ['take up', '占据；开始从事', 'make up for', '弥补'],
          ['take over', '接管', 'make out', '辨认出；理解'],
          ['take on', '呈现；承担', 'make sense', '有意义、讲得通'],
          ['take after', '长得像', 'put off', '推迟'],
          ['take for granted', '想当然', 'put up with', '忍受'],
          ['get along with', '与…相处', 'put forward', '提出'],
          ['get rid of', '摆脱', 'put out', '扑灭'],
          ['get through', '通过；接通电话', 'put into practice', '付诸实践'],
          ['get used to', '习惯于', 'put an end to', '结束']
        ]
      },
      {
        title: 'look / come / go / bring 家族',
        head: ['短语', '含义', '短语', '含义'],
        rows: [
          ['look into', '调查', 'come up with', '想出（主意）'],
          ['look after', '照顾', 'come across', '偶然遇到'],
          ['look forward to', '期待', 'come true', '实现'],
          ['look up', '查阅', 'come to an end', '结束'],
          ['look down upon', '轻视', 'go through', '经历；仔细检查'],
          ['bring about', '导致、引起', 'go over', '复习；检查'],
          ['bring up', '抚养；提出', 'go in for', '爱好、从事'],
          ['break out', '爆发（无被动）', 'break down', '出故障；崩溃'],
          ['carry out', '执行、实施', 'carry on', '继续'],
          ['set up', '建立', 'set about doing', '着手做']
        ]
      }
    ]
  },
  {
    id: 'ph-2',
    title: '介词短语与固定表达 30 条',
    summary: '这些短语常直接作为完形的答案出现。',
    body: ['介词短语多为整体记忆，注意有无冠词、名词单复数。'],
    tables: [
      {
        head: ['短语', '含义', '短语', '含义'],
        rows: [
          ['in terms of', '就…而言', 'with regard to', '关于'],
          ['in addition to', '除…之外还', 'apart from', '除…之外'],
          ['as a result of', '由于', 'due to / owing to', '由于'],
          ['in spite of', '尽管', 'regardless of', '不管、不顾'],
          ['on behalf of', '代表', 'in favor of', '赞成'],
          ['at the expense of', '以…为代价', 'in exchange for', '交换'],
          ['in the long run', '从长远看', 'for the time being', '暂时'],
          ['by no means', '决不（倒装）', 'in no case', '决不（倒装）'],
          ['in charge of', '负责', 'in the charge of', '由…负责'],
          ['on the contrary', '相反', 'on the whole', '总体上'],
          ['to some extent', '在某种程度上', 'in general', '一般来说'],
          ['ahead of time', '提前', 'in advance', '预先'],
          ['at random', '随机地', 'on purpose', '故意地'],
          ['in vain', '徒劳', 'at ease', '轻松、自在'],
          ['out of the question', '不可能', 'out of question', '毫无疑问']
        ]
      }
    ],
    traps: [
      'in charge of（某人负责某事）与 in the charge of（某事由某人负责）主语相反。',
      'out of the question = impossible；out of question = no problem，一字之差意思相反。'
    ]
  },
  {
    id: 'ph-3',
    title: '易混短语精确对比',
    summary: '形近意远，命题人最爱在这里设坑。',
    body: ['以下每一组都在真题中作为四个选项同时出现过，必须精确区分。'],
    tables: [
      {
        head: ['组别', '区别'],
        rows: [
          ['in the way / in a way / by the way / on the way', '挡道 / 在某种程度上 / 顺便说 / 在途中'],
          ['at all / after all / above all / in all', '根本（否定句）/ 毕竟 / 首要的是 / 总共'],
          ['no less than / not less than', '多达（强调多）/ 不少于（客观数量）'],
          ['as well as / as well', '和…一样也（连词，就远）/ 也（句末）'],
          ['instead / instead of', '代替（副词，句末）/ 而不是（介词，后接名词或动名词）'],
          ['because of / thanks to', '因为（中性）/ 多亏（褒义）'],
          ['such as / for example', '举例列举同类（后接名词）/ 举例说明（可接句子）'],
          ['on time / in time', '准时 / 及时'],
          ['at the end of / in the end / by the end of', '在…末尾 / 最后（副词短语）/ 到…末为止（常接完成时）'],
          ['used to do / be used to doing / be used to do', '过去常常 / 习惯于 / 被用来做']
        ]
      }
    ]
  }
]

/* ========================================================================== */

const TEMPLATE_LESSONS: EnglishLesson[] = [
  {
    id: 'tp-1',
    title: '模板一：现象分析型（原因 + 影响 + 建议）',
    summary: '适用于"某现象越来越普遍，分析原因并谈看法"类题目。',
    body: [
      '骨架：现象描述 → 原因分析（2 条）→ 影响评价 → 结论建议。把方括号里的内容替换成题目主题即可。',
      '注意：模板只是骨架，务必填入与题目直接相关的具体内容，否则会被判为套作。'
    ],
    examples: [
      {
        en: 'In recent years, [现象] has become increasingly common in our society. \n\nThere are several reasons for this phenomenon. On the one hand, [原因一]. On the other hand, [原因二], which further encourages people to [做某事]. \n\nAs far as I am concerned, this trend brings both benefits and problems. It [好处], but at the same time it may [坏处]. \n\nTherefore, it is high time that we took effective measures to [建议]. Only in this way can we [期待结果].',
        zh: '近年来，[现象] 在我们社会中越来越普遍。\n\n造成这一现象有若干原因。一方面，[原因一]；另一方面，[原因二]，这进一步促使人们 [做某事]。\n\n就我而言，这一趋势既有益处也有问题。它 [好处]，但同时也可能 [坏处]。\n\n因此，现在是我们采取有效措施 [建议] 的时候了。只有这样，我们才能 [期待结果]。'
      }
    ]
  },
  {
    id: 'tp-2',
    title: '模板二：正反观点对比型（利弊分析）',
    summary: '适用于"有人认为…有人认为…，你的看法"类题目。',
    body: ['骨架：争议引入 → 支持方理由 → 反对方理由 → 我的立场与理由 → 总结。']
    ,
    examples: [
      {
        en: 'When it comes to [话题], opinions vary from person to person. \n\nSome people hold the view that [观点 A], because [理由 A]. Others, however, argue that [观点 B]. They believe [理由 B]. \n\nIn my opinion, [我的立场]. The main reason is that [理由]. Take [例子] for example, which clearly shows [说明]. \n\nIn conclusion, although both sides have their points, I firmly believe that [重申立场].',
        zh: '谈到 [话题]，人们的看法各不相同。\n\n有人认为 [观点 A]，因为 [理由 A]。然而也有人认为 [观点 B]，他们相信 [理由 B]。\n\n在我看来，[我的立场]。主要原因在于 [理由]。以 [例子] 为例，这清楚地说明了 [说明]。\n\n总之，尽管双方各有道理，我坚信 [重申立场]。'
      }
    ]
  },
  {
    id: 'tp-3',
    title: '模板三：书信/通知类应用文骨架',
    summary: '把"目的—细节—期待"三段填满，格式分先拿到手。',
    body: [
      '申请信：I am writing to apply for … → 学历/经验/优势 → I would appreciate it if you could grant me an interview.',
      '建议信：I am writing to make some suggestions about … → 建议 1 / 建议 2 → I hope you will find these suggestions helpful.',
      '道歉信：I am writing to express my sincere apology for … → 说明原因 → 提出补救 → Please accept my apology.',
      '感谢信：I am writing to express my heartfelt thanks for … → 具体说明帮助 → 表达回报意愿。',
      '邀请信：I am writing to invite you to … → 时间地点安排 → I do hope you can come.',
      '通知（Notice）：标题居中写 NOTICE → 正文说明时间、地点、内容、要求 → 落款单位与日期。'
    ],
    traps: [
      '应用文一律不写真实个人信息，署名统一 Li Ming。',
      '书信正文分段清晰，不要写成一大坨。'
    ]
  }
]

/* ========================================================================== */

const TIPS_LESSONS: EnglishLesson[] = [
  {
    id: 'tip-1',
    title: '分值结构与考场时间分配',
    summary: '按分值分配精力：阅读是绝对重心，绝不能被前面的小题拖时间。',
    body: [
      '各省市成人学位英语（学位英语水平考试）的具体题型与分值略有差异，下表为最常见的一种结构，仅作备考参考，最终以你所在省市学位办/考试院当年公告为准。',
      '核心策略：单位时间得分效率最高的是"会话技能"和"词汇语法"（题短、判断快），分值最高的是"阅读理解"。因此顺序建议：会话 → 词汇语法 → 阅读 → 完形 → 写作/翻译；写作务必预留完整 25 分钟，不要压到最后 10 分钟。'
    ],
    tables: [
      {
        title: '常见分值与建议用时（参考）',
        head: ['部分', '题型', '常见分值', '建议用时'],
        rows: [
          ['Part I', '会话技能 Dialogue Completion', '约 15 分', '10 分钟'],
          ['Part II', '阅读理解 Reading Comprehension（4 篇）', '约 40 分', '40 分钟'],
          ['Part III', '词汇与语法 Vocabulary & Structure', '约 15 分', '15 分钟'],
          ['Part IV', '完形填空 Cloze', '约 15 分', '12 分钟'],
          ['Part V', '写作 / 英译汉', '约 15 分', '25 分钟'],
          ['—', '合计', '100 分', '约 120 分钟']
        ]
      }
    ],
    traps: [
      '涂卡时间要单独留出 5 分钟，不要做完一题涂一题（费时），也不要全部做完才涂（有风险）。建议每完成一个部分统一涂卡一次。',
      '不倒扣分，所有题目都要填，不留空。'
    ]
  },
  {
    id: 'tip-2',
    title: '30 天冲刺安排（可直接执行）',
    summary: '时间紧张时按这个顺序投入，性价比最高。',
    body: [
      '第 1—10 天「打地基」：每天 40 分钟背高频词（用本页生词本，每天 30 词，滚动复习）+ 30 分钟过语法（按本知识库语法模块顺序，每天 1 讲）+ 1 篇阅读精读（生词全查、长句拆分）。',
      '第 11—20 天「上强度」：每天 2 篇阅读限时训练（每篇 8 分钟）+ 1 篇完形 + 复习错题。开始背写作模板与高分句型，每两天默写一篇范文。',
      '第 21—27 天「刷套题」：每两天做一整套真题/模拟题，严格计时 120 分钟，做完当天订正，把错题按"词汇/语法/定位/推理"归类，找出自己的主要失分类型集中补。',
      '第 28—30 天「回归基础」：不做新题。只做三件事——过错题本、背作文模板与高分句型、复习会话固定应答表（这是最容易临时提分的部分）。',
      '每天保底 90 分钟；如果时间实在不够，优先级排序为：高频词 > 阅读 > 作文模板 > 语法 > 完形。'
    ]
  },
  {
    id: 'tip-3',
    title: '考前与考场注意事项',
    summary: '这些不是英语能力问题，但每年都有人因此丢分。',
    body: [
      '证件与文具：准考证、身份证提前一晚放包里；2B 铅笔两支、黑色签字笔两支、橡皮、手表（很多考场不允许带手机，无表就无法控时）。',
      '提前 30 分钟到考场，熟悉座位与答题卡格式。',
      '拿到卷子先通览题型顺序与分值，按自己的顺序做，不必严格按卷面顺序。',
      '涂卡务必核对题号，尤其在跳题之后。',
      '作文写在指定区域内，超出边框可能无法被扫描评阅。',
      '遇到完全不会的题，果断标记跳过，回头再看；一道选择题不值得超过 90 秒。'
    ]
  }
]

/* ========================================================================== */

const SYLLABUS_LESSONS: EnglishLesson[] = [
  {
    id: 'syl-1',
    title: '考试性质与试卷结构（严格对照大纲第二版）',
    summary: '本知识库按《成人学士学位英语水平考试大纲（第二版）》的六大题型逐块组织，下面是题号与对应模块。',
    body: [
      '考试性质：成人高等教育本科毕业生申请学士学位的英语水平考试（非英语专业），重点考查英语语言运用能力，尤其是阅读、翻译与写作能力。',
      '试卷满分一般为 100 分，考试时间 120 分钟；题型以客观题为主，辅以英译汉与短文写作两项主观题。',
      '本知识库严格按大纲题型结构组织，每个模块对应大纲的一个部分：会话交际、阅读理解、词汇与语法结构、完形填空、翻译（英译汉）、短文写作；此外补充高频词汇、短语搭配、写作模板与应试策略，帮助系统备考。'
    ],
    tables: [
      {
        title: '大纲题型 ↔ 本库模块 对应表',
        head: ['大纲部分', '题型（大纲名称）', '本库对应模块', '常见分值'],
        rows: [
          ['Part I', '会话交际 Dialogue Communication', '会话交际（完成对话）', '约 15 分'],
          ['Part II', '阅读理解 Reading Comprehension', '阅读理解', '约 40 分'],
          ['Part III', '词汇与语法结构 Vocabulary and Structure', '词汇（词语用法）+ 语法结构', '约 15 分'],
          ['Part IV', '完形填空 Cloze', '完形填空', '约 15 分'],
          ['Part V', '翻译（英译汉） Translation', '翻译（英译汉）', '约 15 分'],
          ['Part VI', '短文写作 Writing', '短文写作', '约 15—20 分']
        ]
      }
    ],
    traps: [
      '各省市学位英语的具体题型顺序与分值略有差异，上表为第二版大纲通用结构，最终以你所在省市学位办 / 考试院当年公告为准。',
      '写作与翻译合计约 30—35 分，是主观题提分关键，务必为这两部分预留充足时间。'
    ]
  }
]

/* ========================================================================== */

/**
 * 学位英语知识库总表：12 个模块 / 40+ 讲真实讲解内容。
 * 严格按《成人学士学位英语水平考试大纲（第二版）》题型结构组织，首项「考试大纲导览」明确大纲与知识库的对应关系。
 */
export const ENGLISH_OUTLINE: EnglishOutlineItem[] = [
  {
    key: 'syllabus',
    name: '考试大纲导览',
    desc: '一句话说明本库依据《成人学士学位英语水平考试大纲（第二版）》的六大题型组织，并给出题号与模块的对照关系。',
    keyPoints: ['考试性质与时长', '六大题型与分值', '本库模块对应关系'],
    lessons: SYLLABUS_LESSONS
  },
  {
    key: 'dialogue',
    name: '会话交际（完成对话）',
    desc: '从备选项中选出最符合语境的应答，考查日常交际用语与语用能力。四个选项语法通常都对，区别在"得体"。',
    keyPoints: ['问候、介绍、告别', '邀约、道歉、道谢、请求', '打电话、问路、购物、就餐、看病'],
    lessons: DIALOGUE_LESSONS
  },
  {
    key: 'vocabulary',
    name: '词汇（词语用法）',
    desc: '考查词语辨析、构词法、固定搭配与语境中最恰当用词，大纲要求约 3600 词汇量。',
    keyPoints: ['近义词与形近词辨析', '构词法：词缀 + 词根', '熟词生义与固定搭配'],
    lessons: VOCAB_LESSONS
  },
  {
    key: 'grammar',
    name: '语法结构',
    desc: '考查时态语态、非谓语、三大从句、虚拟语气、主谓一致、倒装与强调等核心语法点。',
    keyPoints: ['时态与被动语态', '非谓语动词三分法', '定语/名词性从句与虚拟语气'],
    lessons: GRAMMAR_LESSONS
  },
  {
    key: 'reading',
    name: '阅读理解',
    desc: '通常 4 篇约 1000—1200 词，20 题，分值最高。考查主旨、细节、推理、词义猜测与作者态度。',
    keyPoints: ['五类题型识别与解法', '定位与同义替换机制', '干扰项五大特征'],
    lessons: READING_LESSONS
  },
  {
    key: 'cloze',
    name: '完形填空',
    desc: '一篇约 200 词短文挖空，综合考查词汇、语法与语篇逻辑，重点在上下文呼应。',
    keyPoints: ['四步解题法', '逻辑信号词表', '代词与近义词组细碎考点'],
    lessons: CLOZE_LESSONS
  },
  {
    key: 'translation',
    name: '英译汉（翻译）',
    desc: '将一段英文（约 100—120 词）译成通顺准确的中文，考查理解与中文表达。',
    keyPoints: ['长难句拆分五步法', '定语从句 / 被动语态的中文处理', '扣分点自查清单'],
    lessons: TRANSLATION_LESSONS
  },
  {
    key: 'writing',
    name: '写作',
    desc: '按要求写一篇约 100—120 词的短文（提纲/图画/情景/应用文），考查结构组织与语言表达。',
    keyPoints: ['三段式结构与时间分配', '议论文与书信完整范文', '高分句型与自查清单'],
    lessons: WRITING_LESSONS
  },
  {
    key: 'vocab-list',
    name: '高频核心词汇表',
    desc: '按名词/动词/形容词副词三类整理的 72 个高频词，全部附高频搭配，可直接加入生词本循环记忆。',
    keyPoints: ['高频名词 + 搭配', '高频动词 + 句型', '写作提档形容词副词'],
    lessons: VOCAB_LIST_LESSONS
  },
  {
    key: 'phrases',
    name: '常考短语搭配',
    desc: '动词短语、介词短语与易混短语共 70+ 条，完形与写作的高频得分点。',
    keyPoints: ['take/make/put/get 家族', '介词短语固定表达', '易混短语精确对比'],
    lessons: PHRASE_LESSONS
  },
  {
    key: 'templates',
    name: '写作模板与范文',
    desc: '三套可直接套用的写作骨架（现象分析、正反对比、应用文），附中英对照。',
    keyPoints: ['现象分析型模板', '正反观点对比型模板', '书信/通知应用文骨架'],
    lessons: TEMPLATE_LESSONS
  },
  {
    key: 'tips',
    name: '应试策略与冲刺计划',
    desc: '分值结构、时间分配、30 天冲刺安排与考场注意事项，把会的分全部拿到手。',
    keyPoints: ['分值结构与用时分配', '30 天冲刺日程', '考前与考场注意事项'],
    lessons: TIPS_LESSONS
  }
]

/** 全部讲次扁平列表（供全局搜索用） */
export const ENGLISH_LESSON_INDEX: { moduleKey: string; moduleName: string; lesson: EnglishLesson }[] =
  ENGLISH_OUTLINE.flatMap((m) => m.lessons.map((l) => ({ moduleKey: m.key, moduleName: m.name, lesson: l })))

/** 知识库统计：模块数 / 讲次数 */
export const ENGLISH_KB_STATS = {
  modules: ENGLISH_OUTLINE.length,
  lessons: ENGLISH_LESSON_INDEX.length
}

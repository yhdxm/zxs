// 学位英语 · 阅读理解练习数据
// 来源：依据大纲「阅读理解」题材要求（社会生活 / 科普知识 / 文化教育 / 健康生活等）编写的真实风格短文
//         + 模拟试卷 Part II 题型（4篇×5题，每篇约 40 分中的 10 分；阅读速度要求 80 词/分钟）
// 说明：本文件为「开箱演示题库」。完整真题库建议在浏览器上传《模拟试卷》PDF 后由 OCR 抽取（机制已就绪）。
export interface ReadingOption {
  label: string
  text: string
}
export interface ReadingQuestion {
  id: number
  question: string
  options: ReadingOption[]
  answer: number
  type: string         // 题型：主旨/细节/推断/词义/态度
  explanation: string
}
export interface ReadingPassage {
  id: number
  title: string
  topic: string        // 题材分类（用于筛选）
  words: number        // 词数
  minutes: number      // 建议用时（分钟）
  passage: string      // 正文（段落以 \n\n 分隔）
  questions: ReadingQuestion[]
}

export const READING_PASSAGES: ReadingPassage[] = [
  // ======  Passage 1 · 社会生活 ======
  {
    id: 1,
    title: 'The Power of Volunteering',
    topic: '社会生活',
    words: 232,
    minutes: 3,
    passage: `Volunteering has become an important part of community life in many cities. Every weekend, thousands of people give their time to help others without being paid. They work in hospitals, libraries, animal shelters, and environmental groups. Why do they do it?

Research shows that volunteering brings benefits to both the community and the volunteers themselves. For the community, it provides much-needed services that would otherwise cost a lot of money. For volunteers, the experience can reduce stress and create a sense of purpose. A study from a national university found that people who volunteered regularly reported higher levels of happiness than those who did not.

However, not all volunteer work is easy. Some tasks are physically tiring, and others require special skills. To make the experience better, many organizations now offer training before volunteers start. They also match people with jobs that fit their interests and abilities.

In recent years, online platforms have made it easier to find volunteer opportunities. With just a few clicks, a person can sign up to help at a local food bank or join a neighborhood clean-up. As more people take part, communities become stronger and more connected.`,
    questions: [
      {
        id: 1, type: '主旨',
        question: 'What is the main purpose of the passage?',
        options: [
          { label: 'A', text: 'To explain how to find a well-paid job' },
          { label: 'B', text: 'To describe the benefits and growth of volunteering' },
          { label: 'C', text: 'To criticize people who never volunteer' },
          { label: 'D', text: 'To compare different cities in the world' }
        ],
        answer: 1,
        explanation: '全文围绕志愿服务展开：先说它成为社区生活的重要部分，再讲对社区和志愿者个人的好处，最后说线上平台让它更容易参与。B 最全面。A/C/D 均与主旨无关。'
      },
      {
        id: 2, type: '细节',
        question: 'According to the university study, people who volunteered regularly ______.',
        options: [
          { label: 'A', text: 'earned more money than others' },
          { label: 'B', text: 'reported higher levels of happiness' },
          { label: 'C', text: 'worked only in hospitals' },
          { label: 'D', text: 'were mostly university students' }
        ],
        answer: 1,
        explanation: '原文第二段末句："people who volunteered regularly reported higher levels of happiness than those who did not." 定期做志愿者的幸福感更高。'
      },
      {
        id: 3, type: '推断',
        question: 'What can we infer about volunteer training from the passage?',
        options: [
          { label: 'A', text: 'It is required by law in every city' },
          { label: 'B', text: 'It helps match volunteers’ skills with suitable tasks' },
          { label: 'C', text: 'It is very expensive for organizations' },
          { label: 'D', text: 'It can replace the need for volunteers' }
        ],
        answer: 1,
        explanation: '第三段说许多机构现在先提供培训，并把人和"fit their interests and abilities"的工作匹配起来，可推断培训帮助人岗匹配。A/C/D 文中无依据。'
      },
      {
        id: 4, type: '词义',
        question: 'The phrase "a sense of purpose" in Paragraph 2 most probably means ______.',
        options: [
          { label: 'A', text: 'a feeling that one’s life is meaningful' },
          { label: 'B', text: 'the ability to earn money' },
          { label: 'C', text: 'a fear of failure' },
          { label: 'D', text: 'great physical strength' }
        ],
        answer: 0,
        explanation: '结合上文"reduce stress"（减轻压力）及志愿服务的语境，a sense of purpose 指"目标感 / 生活有意义的感觉"，与幸福感并列。选 A。'
      },
      {
        id: 5, type: '细节',
        question: 'How do online platforms help volunteering?',
        options: [
          { label: 'A', text: 'They pay volunteers for their work' },
          { label: 'B', text: 'They make it easier to find opportunities' },
          { label: 'C', text: 'They take the place of training' },
          { label: 'D', text: 'They criticize weak communities' }
        ],
        answer: 1,
        explanation: '末段首句："online platforms have made it easier to find volunteer opportunities." 平台让寻找机会更容易。'
      }
    ]
  },
  // ======  Passage 2 · 科普知识 ======
  {
    id: 2,
    title: 'Screens and Your Sleep',
    topic: '科普知识',
    words: 226,
    minutes: 3,
    passage: `Most people know that a good night’s sleep is important for health. Yet many of us spend the last hour before bed looking at phones, tablets, or televisions. Scientists warn that this habit may be harming our sleep more than we realize.

The screens of electronic devices give off a kind of light called blue light. This light can trick the brain into thinking it is still daytime. As a result, the body produces less melatonin, a hormone that helps us fall asleep. When melatonin levels drop, it becomes harder to fall asleep and the sleep we get is often lighter.

A survey of university students found that those who used screens within an hour of bedtime took longer to fall asleep and felt more tired the next morning. The effect was strongest for people who used social media, perhaps because the content kept their minds active.

The good news is that small changes can help. Experts suggest turning off screens at least 30 minutes before sleep. Reading a book, listening to calm music, or doing gentle stretching are better choices. If a device must be used, setting it to "night mode" can reduce — but not remove — the blue light.`,
    questions: [
      {
        id: 1, type: '主旨',
        question: 'What is the passage mainly about?',
        options: [
          { label: 'A', text: 'How to buy better electronic devices' },
          { label: 'B', text: 'The effect of screen light on sleep' },
          { label: 'C', text: 'Why students fail their exams' },
          { label: 'D', text: 'The benefits of using social media' }
        ],
        answer: 1,
        explanation: '全文讲屏幕蓝光如何干扰睡眠以及应对建议，核心是"屏幕光线对睡眠的影响"。选 B。'
      },
      {
        id: 2, type: '细节',
        question: 'Blue light affects sleep by ______.',
        options: [
          { label: 'A', text: 'producing more melatonin' },
          { label: 'B', text: 'reducing the body’s melatonin' },
          { label: 'C', text: 'making the bedroom brighter' },
          { label: 'D', text: 'waking the body with sound' }
        ],
        answer: 1,
        explanation: '第二段："the body produces less melatonin"，蓝光让身体分泌更少褪黑素，从而难以入睡。'
      },
      {
        id: 3, type: '细节',
        question: 'The student survey found that using screens before bed made people ______.',
        options: [
          { label: 'A', text: 'sleep better than before' },
          { label: 'B', text: 'take longer to fall asleep' },
          { label: 'C', text: 'study more efficiently' },
          { label: 'D', text: 'feel happier the next day' }
        ],
        answer: 1,
        explanation: '第三段："those who used screens within an hour of bedtime took longer to fall asleep and felt more tired"——睡前用屏幕的人入睡更慢、更累。'
      },
      {
        id: 4, type: '词义',
        question: 'The word "hormone" in Paragraph 2 most probably means ______.',
        options: [
          { label: 'A', text: 'a chemical substance made by the body' },
          { label: 'B', text: 'a type of phone screen' },
          { label: 'C', text: 'a machine that helps sleep' },
          { label: 'D', text: 'a kind of bright light' }
        ],
        answer: 0,
        explanation: '后接定语从句 "that helps us fall asleep"（帮助我们入睡），且由身体产生，可推断 hormone 是"身体分泌的化学物质（激素）"。'
      },
      {
        id: 5, type: '态度',
        question: 'What do experts suggest people do?',
        options: [
          { label: 'A', text: 'Use devices only in night mode' },
          { label: 'B', text: 'Turn off screens at least 30 minutes before sleep' },
          { label: 'C', text: 'Read books on a tablet in bed' },
          { label: 'D', text: 'Keep the TV on while sleeping' }
        ],
        answer: 1,
        explanation: '末段："Experts suggest turning off screens at least 30 minutes before sleep." 专家建议在睡前至少 30 分钟关掉屏幕。'
      }
    ]
  },
  // ======  Passage 3 · 文化教育 ======
  {
    id: 3,
    title: 'Learning for Life',
    topic: '文化教育',
    words: 228,
    minutes: 3,
    passage: `Learning does not stop when a person leaves school. In today’s fast-changing world, the ability to keep learning has become one of the most useful skills a person can have. This idea is called lifelong learning.

One reason lifelong learning matters is that many jobs are changing. Tasks that were done by people a few years ago are now done by machines. At the same time, new kinds of work appear that did not exist before. Workers who keep learning can move into these new roles, while those who stop may find their skills out of date.

Online courses have made lifelong learning easier than ever. A person can study a foreign language, learn to code, or take a business class from home, often at low cost or for free. Many platforms also give certificates that help with job hunting. However, success still depends on self-discipline, since no teacher is pushing you to attend.

Schools and companies are also changing. Some universities now offer short programs for adults who want to learn new skills quickly. Forward-looking companies encourage employees to spend part of their work time on training. As the need grows, lifelong learning is becoming a normal part of life, not just an option for a few.`,
    questions: [
      {
        id: 1, type: '主旨',
        question: 'What is the passage mainly about?',
        options: [
          { label: 'A', text: 'Why traditional schools are useless' },
          { label: 'B', text: 'The importance and growing ease of lifelong learning' },
          { label: 'C', text: 'How to find a first job' },
          { label: 'D', text: 'The history of old universities' }
        ],
        answer: 1,
        explanation: '全文讲"终身学习"为何重要（工作变化）以及如何变得更容易（在线课程、机构变革）。选 B。'
      },
      {
        id: 2, type: '细节',
        question: 'Why do many jobs now require continuous learning?',
        options: [
          { label: 'A', text: 'Machines replace old tasks while new work appears' },
          { label: 'B', text: 'Schools teach too little knowledge' },
          { label: 'C', text: 'Workers are generally lazy' },
          { label: 'D', text: 'Certificates have become useless' }
        ],
        answer: 0,
        explanation: '第二段：旧任务被机器取代，新工作出现，所以持续学习才能跟上。选 A。'
      },
      {
        id: 3, type: '细节',
        question: 'Online courses help learners mainly because they are ______.',
        options: [
          { label: 'A', text: 'expensive but of high quality' },
          { label: 'B', text: 'low-cost or free and flexible' },
          { label: 'C', text: 'only designed for children' },
          { label: 'D', text: 'taught by a fixed teacher' }
        ],
        answer: 1,
        explanation: '第三段："study ... from home, often at low cost or for free"——在家学、低成本或免费、灵活。选 B。'
      },
      {
        id: 4, type: '词义',
        question: 'The phrase "out of date" in Paragraph 2 most probably means ______.',
        options: [
          { label: 'A', text: 'modern and popular' },
          { label: 'B', text: 'no longer useful or current' },
          { label: 'C', text: 'very well paid' },
          { label: 'D', text: 'highly trained' }
        ],
        answer: 1,
        explanation: '与 "keep learning can move into new roles" 对比，stop learning 的人技能会"过时 / 不再适用"。选 B。'
      },
      {
        id: 5, type: '推断',
        question: 'What can be inferred about successful online learning?',
        options: [
          { label: 'A', text: 'It requires strong self-discipline' },
          { label: 'B', text: 'It is almost impossible' },
          { label: 'C', text: 'It needs a teacher pushing you' },
          { label: 'D', text: 'It is always very costly' }
        ],
        answer: 0,
        explanation: '第三段末："success still depends on self-discipline, since no teacher is pushing you"——成功取决于自律。选 A。'
      }
    ]
  },
  // ======  Passage 4 · 健康生活 ======
  {
    id: 4,
    title: 'The Magic of a Daily Walk',
    topic: '健康生活',
    words: 223,
    minutes: 3,
    passage: `Walking is perhaps the simplest form of exercise, yet its health benefits are surprisingly large. Unlike running or weightlifting, walking needs no special equipment and can be done almost anywhere. For this reason, doctors often call it the perfect exercise for beginners.

Regular walking strengthens the heart and improves blood flow. Studies show that people who walk at a brisk pace for 30 minutes a day lower their risk of heart disease and high blood pressure. Walking also helps control weight, because it burns calories without putting stress on the joints.

Beyond the body, walking is good for the mind. A short walk outdoors can reduce feelings of anxiety and improve mood. Some research even suggests that walking meetings help people think more creatively than sitting ones.

To get the most from walking, experts suggest a few steps. First, aim for at least 150 minutes of walking each week. Second, keep a speed at which you can talk but not sing — a sign you are working at a moderate level. Finally, make it a habit by walking at the same time each day, such as during a lunch break. With consistency, a simple daily walk can lead to lasting health.`,
    questions: [
      {
        id: 1, type: '主旨',
        question: 'What is the main idea of the passage?',
        options: [
          { label: 'A', text: 'Running is better than walking' },
          { label: 'B', text: 'Walking is simple yet highly beneficial' },
          { label: 'C', text: 'Gyms are necessary for health' },
          { label: 'D', text: 'Walking is only for beginners' }
        ],
        answer: 1,
        explanation: '首句点题："simplest ... yet its health benefits are surprisingly large"，通篇讲步行简单却益处大。选 B。'
      },
      {
        id: 2, type: '细节',
        question: 'Brisk walking for 30 minutes a day can ______.',
        options: [
          { label: 'A', text: 'increase blood pressure' },
          { label: 'B', text: 'lower the risk of heart disease' },
          { label: 'C', text: 'put stress on the joints' },
          { label: 'D', text: 'cause weight gain' }
        ],
        answer: 1,
        explanation: '第二段："lower their risk of heart disease and high blood pressure"——降低心脏病和高血压风险。'
      },
      {
        id: 3, type: '细节',
        question: 'Walking helps the mind by ______.',
        options: [
          { label: 'A', text: 'causing more anxiety' },
          { label: 'B', text: 'reducing anxiety and improving mood' },
          { label: 'C', text: 'making people feel tired' },
          { label: 'D', text: 'replacing all medicine' }
        ],
        answer: 1,
        explanation: '第三段："reduce feelings of anxiety and improve mood"——减轻焦虑、改善情绪。'
      },
      {
        id: 4, type: '词义',
        question: 'The word "brisk" in Paragraph 2 most probably means ______.',
        options: [
          { label: 'A', text: 'slow and lazy' },
          { label: 'B', text: 'fast and energetic' },
          { label: 'C', text: 'very careful' },
          { label: 'D', text: 'completely quiet' }
        ],
        answer: 1,
        explanation: 'brisk pace 指"轻快的 / 有活力的快步"，与后文 "you can talk but not sing"（能说话但不能唱歌）的中等强度一致。选 B。'
      },
      {
        id: 5, type: '细节',
        question: 'What do experts suggest about walking?',
        options: [
          { label: 'A', text: 'At least 150 minutes per week at a moderate pace' },
          { label: 'B', text: 'Only on weekends at full speed' },
          { label: 'C', text: 'As fast as possible every time' },
          { label: 'D', text: 'Without forming any habit' }
        ],
        answer: 0,
        explanation: '末段建议：每周至少 150 分钟、中等强度（能说话不能唱歌）、每天固定时间养成习惯。选 A。'
      }
    ]
  }
]

// 题材分类列表（用于筛选）
export const READING_TOPICS = [...new Set(READING_PASSAGES.map(p => p.topic))]

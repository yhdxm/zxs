// 学位英语 · 对话练习数据
// 来源：大纲「附录八 常用口语表达用语」27个场景366句真实素材
// 题型：完成对话填空选择（模拟试卷 Part I，10题/10分）
export interface DialogueOption {
  label: string
  text: string
  correct: boolean
}
export interface DialogueQuestion {
  id: number
  scene: string
  sceneIcon: string
  context: string
  blankIndex: number
  options: DialogueOption[]
  explanation: string
}

export const DIALOGUE_QUESTIONS: DialogueQuestion[] = [
  {
    id: 1, scene: '感谢 (Thanks)', sceneIcon: '🙏',
    context: `A: Thank you so much for helping me with my English homework.\nB: ______`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "Don't mention it. It's my pleasure.", correct: true },
      { label: 'B', text: "No, I don't think so.", correct: false },
      { label: 'C', text: "I'm afraid I can't help you.", correct: false },
      { label: 'D', text: "You're welcome to ask again.", correct: false }
    ],
    explanation: `当对方表示感谢时，常用回应有 "You're welcome" / "My pleasure" / "Don't mention it" / "It's nothing"。选项 A "It's my pleasure" 是最礼貌的正式回应。大纲附录八 Thanks 类 #37-48。`
  },
  {
    id: 2, scene: '道歉 (Apologies)', sceneIcon: '😔',
    context: `A: I'm really sorry for being late. The traffic was terrible.\nB: ______`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "That's OK. These things happen.", correct: true },
      { label: 'B', text: "You should have left earlier.", correct: false },
      { label: 'C', text: "I don't want to hear your excuse.", correct: false },
      { label: 'D', text: "Please apologize properly.", correct: false }
    ],
    explanation: `接受道歉时常用 "That's OK" / "Never mind" / "It doesn't matter" / "These things happen"。选项 A 最自然得体。大纲 Apologies 类 #49-61。`
  },
  {
    id: 3, scene: '邀请 (Invitation)', sceneIcon: '📧',
    context: `A: Would you like to come to my birthday party this Saturday evening?\nB: ______`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "I'd love to! What time should I arrive?", correct: true },
      { label: 'B', text: "No, I don't like parties.", correct: false },
      { label: 'C', text: "I'm not sure about Saturday.", correct: false },
      { label: 'D', text: "Why do you invite me?", correct: false }
    ],
    explanation: `接受邀请用 "I'd love to" / "I'd be happy to" + 追问细节；婉拒用 "I'm afraid I can't" + 理由。选项 A 既接受又追问时间，最符合社交礼仪。大纲 Invitation 类 #62-72。`
  },
  {
    id: 4, scene: '建议 (Advice & Suggestions)', sceneIcon: '💡',
    context: `A: I've been feeling very tired lately, and I can't focus on my studies.\nB: ______`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "If I were you, I'd go see a doctor and get more rest.", correct: true },
      { label: 'B', text: "You should stop studying completely.", correct: false },
      { label: 'C', text: "It's not my problem.", correct: false },
      { label: 'D', text: "Tiredness is normal for students.", correct: false }
    ],
    explanation: `提建议常用虚拟语气 "If I were you, I'd..." 或 "You'd better..." 或 "I advise/recommend..."。选项 A 用了虚拟语气提建议，既关切又实用。大纲 Advice & Suggestions 类 #237-250。`
  },
  {
    id: 5, scene: '告别 (Farewells)', sceneIcon: '👋',
    context: `A: It's getting late. I must be going now.\nB: ______`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "OK. Take care and keep in touch!", correct: true },
      { label: 'B', text: "Why are you leaving so early?", correct: false },
      { label: 'C', text: "You shouldn't go yet.", correct: false },
      { label: 'D', text: "See you tomorrow at the same time.", correct: false }
    ],
    explanation: `告别时常用 "Take care" / "Have a pleasant journey" / "Keep in touch" / "See you later"。选项 A "Take care and keep in touch!" 是最温暖自然的告别语。大纲 Farewells 类 #24-36。`
  },
  {
    id: 6, scene: '购物 (Shopping)', sceneIcon: '🛒',
    context: `A: This shirt looks nice. How much is it?\nB: It's 200 yuan.\nA: That's a bit expensive. ______\nB: We're having a sale today. Everything is 20% off.`,
    blankIndex: 3,
    options: [
      { label: 'A', text: "Could you bring the price down a little?", correct: true },
      { label: 'B', text: "I'll take two of them.", correct: false },
      { label: 'C', text: "Do you have it in blue?", correct: false },
      { label: 'D', text: "Can I pay by credit card?", correct: false }
    ],
    explanation: `购物砍价常用 "Could you bring the price down?" / "Is there any discount?" / "That's too expensive, can you give me a better price?"。根据 B 的回答提到打折，A 应该是在问能否便宜点。大纲 Shopping 类 #190-212。`
  },
  {
    id: 7, scene: '问路 (Asking the Way)', sceneIcon: '🗺️',
    context: `A: Excuse me, could you tell me how to get to the nearest hospital?\nB: ______\nA: About how long does it take to walk there?\nB: About 15 minutes.`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "Go straight ahead, turn left at the second crossing, and you'll see it.", correct: true },
      { label: 'B', text: "The hospital is very far from here.", correct: false },
      { label: 'C', text: "I don't know where the hospital is.", correct: false },
      { label: 'D', text: "You should take a taxi instead.", correct: false }
    ],
    explanation: `指路常用 "Go straight ahead" / "Turn left/right" / "Take the first/second turning" / "It's on your left/right"。选项 A 给出了完整路线指引，且 A 后续追问步行时间说明接受了指引。大纲 Asking the Way 类 #213-222。`
  },
  {
    id: 8, scene: '请求帮助 (Asking for Help)', sceneIcon: '🤝',
    context: `A: I wonder if you could help me move this heavy box.\nB: ______`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "Sure, I'd be happy to help. Let me give you a hand.", correct: true },
      { label: 'B', text: "Why don't you ask someone else?", correct: false },
      { label: 'C', text: "The box is not that heavy.", correct: false },
      { label: 'D', text: "I'm too busy right now.", correct: false }
    ],
    explanation: `答应帮忙用 "Sure" / "Of course" / "I'd be happy to" / "Let me give you a hand"；拒绝用 "I'm afraid I can't" + 理由。选项 A 既答应又用了 "give you a hand" 这个地道表达。大纲 Offering/Asking for Help 类 #102-111。`
  },
  {
    id: 9, scene: '电话 (Telephone Calls)', sceneIcon: '📞',
    context: `A: May I speak to Mr. Wang, please?\nB: ______\nA: This is Li Ming from ABC Company.\nB: Just a moment, please.`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "May I ask who's calling?", correct: true },
      { label: 'B', text: "Mr. Wang is not here.", correct: false },
      { label: 'C', text: "You have the wrong number.", correct: false },
      { label: 'D', text: "He's in a meeting right now.", correct: false }
    ],
    explanation: `电话用语中接电话后询问对方身份用 "May I ask who's calling?" / "Who's speaking, please?"。根据后续 B 说 "Just a moment" 说明要转接，所以先问了是谁打的。大纲 Telephone Calls 类 #125-152。`
  },
  {
    id: 10, scene: '看病 (Seeing a Doctor)', sceneIcon: '🏥',
    context: `A: What seems to be the trouble?\nB: I've had a bad headache for three days, and I feel feverish.\nA: ______\nB: Yes, it's about 39 degrees.`,
    blankIndex: 3,
    options: [
      { label: 'A', text: "Let me take your temperature. Have you taken your temperature?", correct: true },
      { label: 'B', text: "You should drink more water.", correct: false },
      { label: 'C', text: "You need to stay in bed.", correct: false },
      { label: 'D', text: "I'll write a prescription for you.", correct: false }
    ],
    explanation: `看病场景中医生先了解症状再检查。"Let me take your temperature" 是量体温的标准说法，B 回答体温数值证实了这一点。大纲 Seeing a Doctor 类 #172-189。`
  },
  {
    id: 11, scene: '天气 (Weather)', sceneIcon: '🌤️',
    context: `A: What will the weather be like tomorrow?\nB: ______\nA: That's great! I'm planning a picnic.`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "It says it'll be sunny and warm, around 25°C.", correct: true },
      { label: 'B', text: "I don't care about the weather.", correct: false },
      { label: 'C', text: "The weather forecast is always wrong.", correct: false },
      { label: 'D', text: "It has been raining all week.", correct: false }
    ],
    explanation: `谈论天气常用 "What's the weather like?" / "How's the weather?"；预报相关 "The weather forecast says..." / "It'll be..."。A 的回答引出好天气，与后续 "great! picnic" 衔接。大纲 Weather 类 #223-236。`
  },
  {
    id: 12, scene: '祝愿/祝贺 (Wishes & Congratulations)', sceneIcon: '🎉',
    context: `A: I heard you passed the degree English exam! Congratulations!\nB: ______`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "Thank you so much! I've been preparing for months.", correct: true },
      { label: 'B', text: "It was very easy.", correct: false },
      { label: 'C', text: "Everyone passed the exam.", correct: false },
      { label: 'D', text: "I don't deserve congratulations.", correct: false }
    ],
    explanation: `回应祝贺用 "Thank you" + 表达感受/努力过程。大纲 Wishes & Congratulations 类 #83-101。`
  },
  {
    id: 13, scene: '表达态度 (Showing Attitude)', sceneIcon: '💬',
    context: `A: What do you think of the new English teacher?\nB: ______ Her classes are really interesting.`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "I think she's wonderful!", correct: true },
      { label: 'B', text: "I don't like her at all.", correct: false },
      { label: 'C', text: "She is too strict.", correct: false },
      { label: 'D', text: "I haven't met her yet.", correct: false }
    ],
    explanation: `表达正面评价用 "She's wonderful/great/terrific/brilliant" 等。后半句 "Her classes are interesting" 证明 B 持正面态度。大纲 Showing Attitude 类 #251-264。`
  },
  {
    id: 14, scene: '同意/不同意 (Agreeing/Disagreeing)', sceneIcon: '✅❌',
    context: `A: I think we should start preparing for the exam earlier next time.\nB: ______ You're absolutely right.`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "I couldn't agree with you more.", correct: true },
      { label: 'B', text: "I don't think so at all.", correct: false },
      { label: 'C', text: "That's not a good idea.", correct: false },
      { label: 'D', text: "It has nothing to do with me.", correct: false }
    ],
    explanation: `强烈同意用 "I couldn't agree more" / "Absolutely" / "Exactly" / "You said it"；不同意用 "I don't think so" / "I'm afraid I disagree"。后续 "You're absolutely right" 证明 B 同意。大纲 Agreeing/Disagreeing 类 #353-366。`
  },
  {
    id: 15, scene: '鼓励 (Encouragement)', sceneIcon: '💪',
    context: `A: I failed the mock exam again. I feel like giving up.\nB: ______ Keep trying, and you'll make it.`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "Come on! Don't give up. If at first you don't succeed, try, try, and try again.", correct: true },
      { label: 'B', text: "Maybe you should just quit.", correct: false },
      { label: 'C', text: "Failing is normal, but you should accept it.", correct: false },
      { label: 'D', text: "Other students did better than you.", correct: false }
    ],
    explanation: `鼓励用语："Come on" / "Don't give up" / "Keep it up" / "You can do it" / "I believe in you"。选项 A 用了大纲原句 #311 "try, try, and try again"，最贴合。大纲 Encouragement 类 #307-316。`
  },
  {
    id: 16, scene: '表达确定/不确定 (Certainty/Uncertainty)', sceneIcon: '❓',
    context: `A: Do you think it will rain tomorrow?\nB: ______ The weather report says clear skies all day.`,
    blankIndex: 2,
    options: [
      { label: 'A', text: "I'm absolutely positive that it won't rain.", correct: true },
      { label: 'B', text: "I have no idea about the weather.", correct: false },
      { label: 'C', text: "It might rain, who knows?", correct: false },
      { label: 'D', text: "I really can't tell.", correct: false }
    ],
    explanation: `表达确定性用 "I'm sure/certain/positive" / "There's no doubt" / "absolutely"；不确定用 "I'm not sure" / "I have no idea" / "It's hard to say"。后半句引用天气预报说明 B 很确定。大纲 Certainty/Uncertainty 类 #336-352。`
  }
]

export const DIALOGUE_SCENES = [...new Set(DIALOGUE_QUESTIONS.map(q => q.scene))]

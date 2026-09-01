// 英语单词 → Emoji 象形映射（离线、免费、零 Key、零网络）
// 设计：
//   - 内置常用词词典（exact match，小写）覆盖高频考试词；
//   - 每词可自定义覆盖（localStorage，按 word 小写存），vanilla 与 Vue 模块共用；
//   - 未命中回退 🔤，绝不抛错，绝不依赖网络。
// 三个模块（四六级 / 学位英语 / 通用学习）相互独立，本文件不污染任何业务数据。

const OVERRIDE_KEY = 'zxs_emoji_overrides'
const FALLBACK = '🔤'

// 常用词 → emoji（象形/表意）。覆盖动物/自然/人物/物品/食物/动作/学习/身体/天气等高频场景。
const DICT: Record<string, string> = {
  // 动物
  cat: '🐱', dog: '🐶', bird: '🐦', fish: '🐟', horse: '🐴', cow: '🐮', pig: '🐷',
  sheep: '🐑', rabbit: '🐰', lion: '🦁', tiger: '🐯', bear: '🐻', elephant: '🐘',
  monkey: '🐵', snake: '🐍', bee: '🐝', butterfly: '🦋', fox: '🦊', wolf: '🐺',
  mouse: '🐭', duck: '🦆', chicken: '🐔', frog: '🐸', snail: '🐌', deer: '🦌',
  // 自然
  water: '💧', fire: '🔥', sun: '☀️', moon: '🌙', star: '⭐', tree: '🌳',
  flower: '🌸', grass: '🌿', wind: '🌬️', rain: '🌧️', snow: '❄️', mountain: '⛰️',
  river: '🌊', cloud: '☁️', earth: '🌍', sky: '🌌', leaf: '🍃', sea: '🌊',
  forest: '🌲', lake: '🏞️', stone: '🪨', sand: '🏖️', ice: '🧊', storm: '⛈️',
  // 人物
  teacher: '👩‍🏫', student: '🧑‍🎓', doctor: '👨‍⚕️', nurse: '👩‍⚕️', friend: '🧑‍🤝‍🧑',
  child: '👶', man: '👨', woman: '👩', baby: '👶', king: '👑', queen: '👑',
  people: '👥', farmer: '👨‍🌾', worker: '👷', police: '👮', soldier: '💂',
  father: '👨', mother: '👩', brother: '👦', sister: '👧', parent: '🧑‍🍼',
  // 物品
  book: '📖', pen: '🖊️', pencil: '✏️', paper: '📄', door: '🚪', window: '🪟',
  table: '🪑', chair: '🪑', bed: '🛏️', clock: '⏰', key: '🔑', lock: '🔒',
  money: '💰', coin: '🪙', phone: '📱', computer: '💻', car: '🚗', bus: '🚌',
  train: '🚆', boat: '⛵', ship: '🚢', plane: '✈️', house: '🏠', school: '🏫',
  bag: '🎒', box: '📦', bottle: '🍶', cup: '🥤', bowl: '🥣', plate: '🍽️',
  knife: '🔪', fork: '🍴', spoon: '🥄', umbrella: '☂️', map: '🗺️', road: '🛣️',
  city: '🏙️', country: '🏞️', bridge: '🌉', light: '💡', lamp: '🛋️', gift: '🎁',
  letter: '✉️', stamp: '📮', camera: '📷', tv: '📺', radio: '📻', watch: '⌚',
  // 食物
  apple: '🍎', banana: '🍌', bread: '🍞', rice: '🍚', egg: '🥚', meat: '🍖',
  milk: '🥛', tea: '🍵', coffee: '☕', salt: '🧂', sugar: '🍬', cake: '🍰',
  vegetable: '🥦', fruit: '🍓', meat2: '🥩', soup: '🍲', honey: '🍯', wine: '🍷',
  // 动作 / 状态
  love: '❤️', hate: '💢', happy: '😊', sad: '😢', think: '🤔', learn: '📚',
  read: '📖', write: '✍️', speak: '🗣️', listen: '👂', run: '🏃', walk: '🚶',
  eat: '🍽️', drink: '🥤', sleep: '😴', work: '💼', play: '🎮', sing: '🎤',
  dance: '💃', swim: '🏊', fly: '🕊️', cry: '😭', smile: '😄', angry: '😠',
  // 学习 / 考试
  exam: '📝', test: '📝', question: '❓', answer: '✅', lesson: '📚', class: '🏫',
  study: '📚', knowledge: '🧠', idea: '💡', problem: '🧩', math: '📐', science: '🔬',
  language: '🗣️', word: '🔤', sentence: '📝', grammar: '📏', dictionary: '📕',
  degree: '🎓', certificate: '📜', graduate: '🎓', school2: '🏫', note: '📝',
  // 身体
  eye: '👁️', ear: '👂', nose: '👃', mouth: '👄', hand: '✋', foot: '🦶',
  head: '🤕', heart: '❤️', blood: '🩸', face: '😀', tooth: '🦷', hair: '💇',
  // 时间 / 数字 / 颜色
  time: '⏰', day: '🌞', night: '🌜', year: '📅', week: '🗓️', number: '🔢',
  color: '🌈', red: '🔴', blue: '🔵', green: '🟢', black: '⚫', white: '⚪',
  yellow: '🟡', money2: '💵', gold: '🥇', silver: '🥈', bronze: '🥉',
  // 天气 / 季节
  weather: '🌤️', spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️',
  // 交通 / 旅行
  travel: '🧳', ticket: '🎫', hotel: '🏨', airport: '✈️', station: '🚉',
  // 其他常用
  music: '🎵', song: '🎶', game: '🎮', sport: '⚽', ball: '⚾', team: '👥',
  health: '🏥', hospital: '🏥', medicine: '💊', plant: '🌱', sun2: '🌞',
  world: '🌍', country2: '🏳️', flag: '🚩', peace: '🕊️', war: '⚔️', law: '⚖️',
  government: '🏛️',   art: '🎨', music2: '🎼', story: '📖', poem: '📜', song2: '🎤',
  // 职业 / 身份（学位英语高频）
  composer: '🎼', writer: '✍️', author: '✍️', poet: '🖊️', artist: '🎨',
  painter: '🖌️', singer: '🎤', actor: '🎭', dancer: '💃', musician: '🎻',
  scientist: '🔬', engineer: '🛠️', inventor: '💡', researcher: '🔍',
  builder: '🏗️', designer: '📐', leader: '🧭', manager: '💼', founder: '🏛️',
  member: '🧑', owner: '🔑', user: '🖱️', buyer: '🛒', seller: '💲',
  winner: '🏆', hero: '🦸', judge: '⚖️', lawyer: '📜',
  thief: '🥷', criminal: '🔗', victim: '🆘', witness: '👁️', customer: '🛍️',
  patient: '🤕', client: '🤝', sailor: '⛵', pilot: '✈️', speaker: '📢',
  listener: '👂', reader: '📖', thinker: '🤔', learner: '📚', creator: '🌟',
  neighbor: '🏘️', guest: '🤝', host: '🛎️', enemy: '⚔️', partner: '🤝',
  // 抽象概念（学位英语高频名词）
  ability: '💪', action: '⚡', change: '🔄', chance: '🎲', choice: '🔘',
  condition: '📋', decision: '🤔', development: '🌱', difference: '🔀',
  effect: '💥', effort: '💦', event: '📅', experience: '🧳', fact: '📌',
  freedom: '🕊️', future: '🔮', growth: '🌿', history: '📜', importance: '⭐',
  increase: '📈', industry: '🏭', information: 'ℹ️', intention: '🎯',
  learning: '📚', meaning: '💭', method: '🧮',
  mind: '🧠', nature: '🌿', opportunity: '🚪', opinion: '💬', original: '🆕',
  pain: '😣', period: '⏳', plan: '🗺️', policy: '📜',
  power: '🔋', practice: '🔁', process: '⚙️', progress: '📊',
  purpose: '🎯', quality: '✨', reason: '💡', relation: '🔗',
  result: '🏁', rule: '📏', society: '👥', solution: '💡', source: '💧',
  success: '🎉', system: '🧩', thought: '💭', truth: '✅', value: '💎',
  variety: '🌈', view: '👀', culture: '🏛️',
  education: '🎓', economy: '💹', environment: '🌳', technology: '⚙️',
  literature: '📚', philosophy: '🤔', psychology: '🧠',
  // 常见动词 / 形容词
  build: '🛠️', design: '🎨', create: '🌟', improve: '📈', protect: '🛡️',
  discover: '🔭', explore: '🧭', achieve: '🏆', succeed: '🎉', fail: '💔',
  understand: '💡', explain: '🗣️', describe: '📝', compare: '⚖️', connect: '🔗',
  communicate: '💬', participate: '🙋', contribute: '🤝', compete: '🏅',
  cooperate: '🤝', encourage: '👏', discourage: '📉', require: '📋', provide: '📦',
  produce: '🏭', reduce: '📉', increase2: '📈', develop: '🌱', influence: '🌊'
}

function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** 读取某词的自定义 emoji 覆盖（无则返回 undefined）。 */
export function getEmojiOverride(word: string): string | undefined {
  const w = (word || '').trim().toLowerCase()
  if (!w) return undefined
  return loadOverrides()[w]
}

/** 设置/清除某词的自定义 emoji（empty 则清除覆盖，回退到词典/兜底）。 */
export function setEmojiOverride(word: string, emoji: string): void {
  const w = (word || '').trim().toLowerCase()
  if (!w) return
  const o = loadOverrides()
  const e = (emoji || '').trim()
  if (e) o[w] = e
  else delete o[w]
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o))
  } catch {
    /* 忽略：隐私模式等 localStorage 不可用时静默降级 */
  }
}

/** 取某词的象形 emoji：自定义覆盖 > 词典 > 兜底 🔤。 */
export function getEmoji(word: string): string {
  const w = (word || '').trim().toLowerCase()
  if (!w) return FALLBACK
  const ov = getEmojiOverride(w)
  if (ov) return ov
  if (DICT[w]) return DICT[w]
  return FALLBACK
}

export { FALLBACK }

import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const filePath = path.join(root, 'src/prep/degreePhrases.ts')
let text = fs.readFileSync(filePath, 'utf-8')

function escape(str) {
  return str.replace(/'/g, "\\'")
}

const patches = {
  "a few':": '少许，一些',
  'after all': '毕竟',
  'and so forth': '等等',
  'at a loss': '困惑，不知所措',
  'and so on': '等等',
  'at a time': '每次，一次',
  'apply...to': '将应用于；涂，抹',
  'at best': '充其量，至多',
  'approve of': '赞赏，同意；批准，通过',
  'at first': '最初，首先',
  'around the clock/round the clock': '昼夜不断地，连续24小时地',
  'at hand': '在手边，在附近',
  'asamatterof fact': '实际上',
  'at heart': '在内心，实质上',
  'as a result': '因此',
  'at home': '在家；在国内；自在，自如',
  'as a rule': '通常',
  'at large': '总的，一般；在逃的',
  'as far as': '只要；就…而言',
  'at last': '最终，终于',
  'as for/as to': '至于；就…而言',
  "at least':": '最低限度',
  'as if/as though': '好像，仿佛',
  'at most': '最多，至多',
  'as long as/so long as': '只要，如果',
  "at once':": '立刻，马上',
  'at present': '目前，现在',
  'at the cost of': '以为代价',
  'at the moment': '此刻',
  "as well as':": '既…又，除…之外（还）',
  'at the same time': '与此同时',
  'as well': '也；同样地',
  'act on': '对…起作用；按…行动；作用于',
  'based on': '以…为基础',
  'by way of': '经由；通过…方式',
  'can not help': '禁不住；忍不住',
  'go by': '过去；依照',
  'go off': '爆炸；离去；走调',
  'let alone': '更不用说',
  'leave behind': '留下；忘带；使落后',
  'make out': '理解；辨认出；开列',
  'on fire': '着火',
  'pull down...': '拆毁；拉下',
  'put away': '把…收起来；放好',
  'So far': '到目前为止',
  'take in': '吸收；理解；欺骗',
  'take on': '承担；呈现；接纳',
  'touch on': '谈及；涉及',
  'under the circumstances': '在这种情况下',
  'turn on': '打开；发动',
  'so long as': '只要',
  'onfoot': '在手边，临近',
  'on top of': '在…之上；除…之外',
  'each other': '互相',
  'feel like': '想要；感觉像',
  'for themoment': '目前，暂时',
  'for the present': '目前，暂时',
  'in case of': '假如；防备'
}

let count = 0
for (const [en, zh] of Object.entries(patches)) {
  const escapedEn = escape(en)
  // 在 degreePhrases.ts 中，en 用单引号包裹，且可能带转义
  const regex = new RegExp(`(\\{ id: '[^']+', category: 'phrase', en: '${escapedEn}', zh: )'((?:[^'\\\\]|\\\\.)*)'`)
  text = text.replace(regex, (match, prefix, _oldZh) => {
    count++
    return `${prefix}'${escape(zh)}'`
  })
}

fs.writeFileSync(filePath, text)
console.log(`词组补丁完成：${count} 条`)

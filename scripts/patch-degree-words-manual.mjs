import fs from 'fs'
import path from 'path'

const root = path.resolve(process.cwd())
const degreePath = path.join(root, 'src/prep/degreeWords.ts')
let text = fs.readFileSync(degreePath, 'utf-8')

function escape(str) {
  return str.replace(/'/g, "\\'")
}

const patches = {
  write: { phonetic: '/raɪt/', def: 'v.写，书写；写作；写信' },
  service: { phonetic: '/\'sɜːvɪs/', def: 'n.服务；公共设施；维修' },
  tight: { phonetic: '/taɪt/', def: 'a.紧的；紧身的；密封的' },
  wherever: { phonetic: '/weər\'evə(r)/', def: 'ad./conj.无论在哪里；究竟在哪里' },
  wild: { phonetic: '/waɪld/', def: 'a.野生的；野蛮的；荒芜的' },
  swan: { phonetic: '/swɒn/', def: 'n.天鹅' },
  bribe: { phonetic: '/braɪb/', def: 'v./n.贿赂；行贿' },
  bride: { phonetic: '/braɪd/', def: 'n.新娘' },
  boyfriend: { phonetic: '/\'bɔɪfrend/', def: 'n.男朋友' },
  beforehand: { phonetic: '/bɪ\'fɔːhænd/', def: 'ad.预先，事先' },
  booklet: { phonetic: '/\'bʊklət/', def: 'n.小册子' },
  broaden: { phonetic: '/\'brɔːdn/', def: 'v.变宽；扩大' },
  browse: { phonetic: '/braʊz/', def: 'v./n.浏览；吃草' },
  burial: { phonetic: '/\'beriəl/', def: 'n.埋葬；葬礼' },
  cab: { phonetic: '/kæb/', def: 'n.出租车；驾驶室' },
  capability: { phonetic: '/ˌkeɪpə\'bɪləti/', def: 'n.能力；才能' },
  cereal: { phonetic: '/\'sɪəriəl/', def: 'n.谷物；谷类食品' },
  champagne: { phonetic: '/ʃæm\'peɪn/', def: 'n.香槟酒' },
  cling: { phonetic: '/klɪŋ/', def: 'vi.紧紧抓住；黏附' },
  clinical: { phonetic: '/\'klɪnɪkl/', def: 'a.临床的；诊所的' },
  clip: { phonetic: '/klɪp/', def: 'n.夹子；回形针；v.剪' },
  clockwise: { phonetic: '/\'klɒkwaɪz/', def: 'ad./a.顺时针方向地（的）' },
  commute: { phonetic: '/kə\'mjuːt/', def: 'v.通勤；交换' },
  comic: { phonetic: '/\'kɒmɪk/', def: 'a.喜剧的；滑稽的；n.喜剧演员' },
  commodity: { phonetic: '/kə\'mɒdəti/', def: 'n.商品；日用品' },
  composer: { phonetic: '/kəm\'pəʊzə(r)/', def: 'n.作曲家' },
  consequent: { phonetic: '/\'kɒnsɪkwənt/', def: 'a.作为结果的；随之发生的' },
  confusing: { phonetic: '/kən\'fjuːzɪŋ/', def: 'a.令人困惑的' },
  corrupt: { phonetic: '/kə\'rʌpt/', def: 'a.腐败的；v.使腐败' },
  corruption: { phonetic: '/kə\'rʌpʃn/', def: 'n.腐败；贪污' },
  costume: { phonetic: '/\'kɒstjuːm/', def: 'n.服装；戏装' },
  couch: { phonetic: '/kaʊtʃ/', def: 'n.长沙发' },
  cradle: { phonetic: '/\'kreɪdl/', def: 'n.摇篮；发源地' },
  creation: { phonetic: '/kri\'eɪʃn/', def: 'n.创造；创作物' },
  credible: { phonetic: '/\'kredəbl/', def: 'a.可信的；可靠的' },
  cowboy: { phonetic: '/\'kaʊbɔɪ/', def: 'n.牛仔' },
  cultural: { phonetic: '/\'kʌltʃərəl/', def: 'a.文化的' },
  crowded: { phonetic: '/\'kraʊdɪd/', def: 'a.拥挤的' },
  cute: { phonetic: '/kjuːt/', def: 'a.可爱的；聪明的' },
  cyclist: { phonetic: '/\'saɪklɪst/', def: 'n.骑自行车的人' },
  dean: { phonetic: '/diːn/', def: 'n.院长；系主任' },
  decoration: { phonetic: '/ˌdekə\'reɪʃn/', def: 'n.装饰；装饰品' },
  deliberately: { phonetic: '/dɪ\'lɪbərətli/', def: 'ad.故意地；谨慎地' },
  'defense/-ce': { phonetic: '/dɪ\'fens/', def: 'n.防御；防卫' },
  deficiency: { phonetic: '/dɪ\'fɪʃnsi/', def: 'n.缺乏；不足' },
  demanding: { phonetic: '/dɪ\'mɑːndɪŋ/', def: 'a.要求高的；费力的' },
  defy: { phonetic: '/dɪ\'faɪ/', def: 'v.违抗；蔑视' },
  denial: { phonetic: '/dɪ\'naɪəl/', def: 'n.否认；拒绝' },
  dentist: { phonetic: '/\'dentɪst/', def: 'n.牙医' },
  dependence: { phonetic: '/dɪ\'pendəns/', def: 'n.依赖；依靠' },
  destructive: { phonetic: '/dɪ\'strʌktɪv/', def: 'a.破坏性的' },
  dialogue: { phonetic: '/\'daɪəlɒɡ/', def: 'n.对话' },
  diet: { phonetic: '/\'daɪət/', def: 'n.饮食；节食' },
  diagnosis: { phonetic: '/ˌdaɪəɡ\'nəʊsɪs/', def: 'n.诊断' },
  dignity: { phonetic: '/\'dɪɡnəti/', def: 'n.尊严；高贵' },
  disapprove: { phonetic: '/ˌdɪsə\'pruːv/', def: 'v.不赞成；反对' },
  diplomat: { phonetic: '/\'dɪpləmæt/', def: 'n.外交官' },
  disco: { phonetic: '/\'dɪskəʊ/', def: 'n.迪斯科舞厅' },
  disabled: { phonetic: '/dɪs\'eɪbld/', def: 'a.残疾的' },
  dizzy: { phonetic: '/\'dɪzi/', def: 'a.头晕目眩的' },
  downtown: { phonetic: '/ˌdaʊn\'taʊn/', def: 'ad./a.在/往商业区（的）' },
  dwarf: { phonetic: '/dwɔːf/', def: 'n.矮子；侏儒' },
  economics: { phonetic: '/ˌiːkə\'nɒmɪks/', def: 'n.经济学' },
  edit: { phonetic: '/\'edɪt/', def: 'v.编辑；剪辑' },
  educated: { phonetic: '/\'edʒukeɪtɪd/', def: 'a.受过教育的' },
  electrician: { phonetic: '/ɪˌlek\'trɪʃn/', def: 'n.电工' },
  eggplant: { phonetic: '/\'eɡplɑːnt/', def: 'n.茄子' },
  embarrassing: { phonetic: '/ɪm\'bærəsɪŋ/', def: 'a.令人尴尬的' },
  enterprise: { phonetic: '/\'entəpraɪz/', def: 'n.企业；事业心' },
  enjoyable: { phonetic: '/ɪn\'dʒɔɪəbl/', def: 'a.愉快的；有趣的' },
  enjoyment: { phonetic: '/ɪn\'dʒɔɪmənt/', def: 'n.享受；乐趣' },
  euro: { phonetic: '/\'jʊərəʊ/', def: 'n.欧元' },
  excited: { phonetic: '/ɪk\'saɪtɪd/', def: 'a.兴奋的；激动的' },
  facial: { phonetic: '/\'feɪʃl/', def: 'a.面部的；n.美容' },
  fake: { phonetic: '/feɪk/', def: 'a.假的；n.假货；v.伪造' },
  fat: { phonetic: '/fæt/', def: 'a.胖的；肥的；n.脂肪' },
  farming: { phonetic: '/\'fɑːmɪŋ/', def: 'n.农业；耕作' },
  fax: { phonetic: '/fæks/', def: 'n./v.传真' },
  firewood: { phonetic: '/\'faɪəwʊd/', def: 'n.木柴' },
  fossil: { phonetic: '/\'fɒsl/', def: 'n.化石' },
  freeway: { phonetic: '/\'friːweɪ/', def: 'n.高速公路' },
  frightening: { phonetic: '/\'fraɪtnɪŋ/', def: 'a.令人恐惧的' },
  gamble: { phonetic: '/\'ɡæmbl/', def: 'v./n.赌博；冒险' },
  garment: { phonetic: '/\'ɡɑːmənt/', def: 'n.衣服；服装' },
  genetic: { phonetic: '/dʒə\'netɪk/', def: 'a.遗传的；基因的' },
  geology: { phonetic: '/dʒi\'ɒlədʒi/', def: 'n.地质学' },
  girlfriend: { phonetic: '/\'ɡɜːlfrend/', def: 'n.女朋友' }
}

let count = 0
for (const [word, { phonetic, def }] of Object.entries(patches)) {
  const escapedWord = escape(word)
  const regex = new RegExp(`\\{ word: '${escapedWord}', phonetic: '((?:[^'\\\\]|\\\\.)*)', definition: '((?:[^'\\\\]|\\\\.)*)', productive: (true|false), sourceBooks: (\\[[^\\]]*\\]) \\}`)
  text = text.replace(regex, (match, _p, _d, productive, sourceBooks) => {
    count++
    return `{ word: '${escapedWord}', phonetic: '${escape(phonetic)}', definition: '${escape(def)}', productive: ${productive}, sourceBooks: ${sourceBooks} }`
  })
}

fs.writeFileSync(degreePath, text)
console.log(`手动补丁完成：${count} 条`)

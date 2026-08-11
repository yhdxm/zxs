// 学位英语备考 · 内置示例词包（仅开箱演示用）
// 真实完整词表（约 3500 词）通过「上传《大纲》PDF → 浏览器 OCR」自动导入，覆盖更全面。
// 每条：[单词, 音标, 词性, 释义]
export interface DegreeWord {
  word: string
  phonetic: string
  pos: string
  definition: string
}

export const DEGREE_WORDS_BUNDLE: DegreeWord[] = [
  { word: 'abandon', phonetic: 'əˈbændən', pos: 'vt.', definition: '放弃；遗弃；离弃' },
  { word: 'ability', phonetic: 'əˈbɪləti', pos: 'n.', definition: '能力；才能；才干' },
  { word: 'able', phonetic: 'ˈeɪbl', pos: 'a.', definition: '有能力的；能干的' },
  { word: 'absence', phonetic: 'ˈæbsəns', pos: 'n.', definition: '缺席；缺乏' },
  { word: 'absent', phonetic: 'ˈæbsənt', pos: 'a.', definition: '(from)缺席的；缺乏的' },
  { word: 'absorb', phonetic: 'əbˈzɔːb', pos: 'vt.', definition: '吸收；吸引；使专心' },
  { word: 'academic', phonetic: 'ˌækəˈdemɪk', pos: 'a.', definition: '学院的；学术的' },
  { word: 'accept', phonetic: 'əkˈsept', pos: 'vt.', definition: '接受；同意；认可' },
  { word: 'access', phonetic: 'ˈækses', pos: 'n.', definition: '接近；通道；进入' },
  { word: 'accompany', phonetic: 'əˈkʌmpəni', pos: 'vt.', definition: '陪伴；伴随；为…伴奏' },
  { word: 'accomplish', phonetic: 'əˈkʌmplɪʃ', pos: 'vt.', definition: '完成；实现；达到' },
  { word: 'accurate', phonetic: 'ˈækjərət', pos: 'a.', definition: '准确的；精确的' },
  { word: 'achieve', phonetic: 'əˈtʃiːv', pos: 'vt.', definition: '完成；达到；实现' },
  { word: 'acquire', phonetic: 'əˈkwaɪə', pos: 'vt.', definition: '取得；获得；学到' },
  { word: 'adapt', phonetic: 'əˈdæpt', pos: 'v.', definition: '适应；改编；改写' },
  { word: 'adequate', phonetic: 'ˈædɪkwət', pos: 'a.', definition: '充足的；适当的' },
  { word: 'adjust', phonetic: 'əˈdʒʌst', pos: 'v.', definition: '调整；调节；适应' },
  { word: 'advance', phonetic: 'ədˈvɑːns', pos: 'v.', definition: '推进；促进；前进' },
  { word: 'advantage', phonetic: 'ədˈvɑːntɪdʒ', pos: 'n.', definition: '优点；好处；优势' },
  { word: 'affect', phonetic: 'əˈfekt', pos: 'vt.', definition: '影响；感动；假装' },
  { word: 'afford', phonetic: 'əˈfɔːd', pos: 'vt.', definition: '负担得起；提供' },
  { word: 'aggressive', phonetic: 'əˈgresɪv', pos: 'a.', definition: '侵略的；有进取心的' },
  { word: 'alike', phonetic: 'əˈlaɪk', pos: 'a.', definition: '相同的；相似的' },
  { word: 'allocate', phonetic: 'ˈæləkeɪt', pos: 'vt.', definition: '分配；分派；拨给' },
  { word: 'alternative', phonetic: 'ɔːlˈtɜːnətɪv', pos: 'n.', definition: '抉择；替代物' },
  { word: 'analyze', phonetic: 'ˈænəlaɪz', pos: 'vt.', definition: '分析；分解' },
  { word: 'ancient', phonetic: 'ˈeɪnʃənt', pos: 'a.', definition: '古代的；古老的' },
  { word: 'anxiety', phonetic: 'æŋˈzaɪəti', pos: 'n.', definition: '焦虑；忧虑；渴望' },
  { word: 'apparent', phonetic: 'əˈpærənt', pos: 'a.', definition: '显然的；表面上的' },
  { word: 'appreciate', phonetic: 'əˈpriːʃieɪt', pos: 'vt.', definition: '欣赏；感激；领会' },
  { word: 'approach', phonetic: 'əˈprəʊtʃ', pos: 'v.', definition: '靠近；探讨；处理' },
  { word: 'appropriate', phonetic: 'əˈprəʊpriət', pos: 'a.', definition: '适当的；恰当的' },
  { word: 'argue', phonetic: 'ˈɑːɡjuː', pos: 'v.', definition: '争论；主张；论证' },
  { word: 'arise', phonetic: 'əˈraɪz', pos: 'vi.', definition: '出现；发生；升起' },
  { word: 'aspect', phonetic: 'ˈæspekt', pos: 'n.', definition: '方面；外表；朝向' },
  { word: 'assess', phonetic: 'əˈses', pos: 'vt.', definition: '评估；估价；评定' },
  { word: 'assign', phonetic: 'əˈsaɪn', pos: 'vt.', definition: '指派；分配；布置' },
  { word: 'assist', phonetic: 'əˈsɪst', pos: 'v.', definition: '援助；帮助；协助' },
  { word: 'assume', phonetic: 'əˈsjuːm', pos: 'vt.', definition: '假定；承担；呈现' },
  { word: 'assure', phonetic: 'əˈʃʊə', pos: 'vt.', definition: '使确信；向…保证' },
  { word: 'attach', phonetic: 'əˈtætʃ', pos: 'vt.', definition: '系；贴；使依附' },
  { word: 'attain', phonetic: 'əˈteɪn', pos: 'vt.', definition: '达到；获得；完成' },
  { word: 'attribute', phonetic: 'əˈtrɪbjuːt', pos: 'vt.', definition: '把…归因于；认为…属于' },
  { word: 'authority', phonetic: 'ɔːˈθɒrəti', pos: 'n.', definition: '权威；权力；当局' },
  { word: 'available', phonetic: 'əˈveɪləbl', pos: 'a.', definition: '可用的；可得到的' },
  { word: 'aware', phonetic: 'əˈweə', pos: 'a.', definition: '意识到的；知道的' },
  { word: 'benefit', phonetic: 'ˈbenɪfɪt', pos: 'n.', definition: '利益；好处；救济金' },
  { word: 'burden', phonetic: 'ˈbɜːdn', pos: 'n.', definition: '负担；重负；责任' },
  { word: 'capacity', phonetic: 'kəˈpæsəti', pos: 'n.', definition: '容量；能力；身份' },
  { word: 'career', phonetic: 'kəˈrɪə', pos: 'n.', definition: '职业；事业；生涯' },
  { word: 'circumstance', phonetic: 'ˈsɜːkəmstəns', pos: 'n.', definition: '情况；环境；境遇' },
  { word: 'comment', phonetic: 'ˈkɒment', pos: 'n.', definition: '评论；意见；注释' }
]

// 内置六级词库占位（默认空）。
// 获取免费六级词表（如 KyleBing/english-vocabulary 的「6 六级-乱序.txt」，格式：单词<TAB>释义），
// 保存到 scripts/cet6_words.csv，然后运行 `node scripts/gen-cet6-bundle.mjs` 即可自动填充本文件。
// 与四级一致：作为数据库主词表拉取失败/为空时的内置兜底，确保离线、免费可用。
import type { PrepWord } from '../services/cetPrepService'

export const CET6_WORDS_BUNDLE: PrepWord[] = []

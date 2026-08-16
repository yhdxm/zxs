<template>
  <div class="le-root">
    <PageHeader
      title="学位英语"
      subtitle="备考助手 · 内置知识库（11 模块 / 40+ 讲真实讲解）+ Free Dictionary 查词 + 已配置 AI · 依据《成人学士学位英语水平考试大纲（第二版）》"
      :icon="School"
    >
      <div class="le-clock-box" title="北京时间">
        <span class="le-dot"></span><span class="le-clock">{{ nowText }}</span><span class="le-clock-hint">北京时间</span>
      </div>
    </PageHeader>

    <!-- 模块入口 -->
    <nav class="le-entries">
      <button
        v-for="m in MODULES"
        :key="m.key"
        type="button"
        class="le-entry"
        :class="{ on: active === m.key }"
        :style="{ '--c': m.color }"
        @click="switchModule(m.key)"
      >
        <span class="le-bar"></span>
        <span class="le-icon"><el-icon><component :is="m.icon" /></el-icon></span>
        <span class="le-text">
          <span class="le-label">{{ m.label }}</span>
          <span class="le-desc">{{ m.desc }}</span>
        </span>
      </button>
    </nav>

    <Transition name="le-fade" mode="out-in">
      <section :key="active" class="le-body">
        <!-- 查词收藏 -->
        <div v-if="active === 'word' && wordSub === 'home'" class="le-card">
          <h3 class="le-h">查词 · 生词本</h3>
          <div class="le-row">
            <el-input v-model="word" placeholder="输入英文单词，如 vocabulary / sustainable" class="le-input" @keyup.enter="lookup" />
            <el-button type="primary" :loading="loading" @click="lookup">查询</el-button>
            <el-button :disabled="!def && !builtin" @click="explain">AI 讲解</el-button>
            <el-button :disabled="!word" @click="addWord">加入生词本</el-button>
          </div>
          <p v-if="!cfg" class="le-warn">未检测到 AI 配置，AI 讲解不可用；请先到「AI 助手」配置密钥。</p>

          <div v-if="def" class="le-def">
            <div class="le-word">{{ def.word }}
              <span v-for="(p, i) in def.phonetics.filter(Boolean)" :key="i" class="le-phon">/{{ p.text }}/</span>
            </div>
            <div v-for="(m, i) in def.meanings" :key="i" class="le-mean">
              <span class="le-pos">{{ m.partOfSpeech }}</span>
              <ol><li v-for="(d, j) in m.definitions" :key="j">{{ d.definition }}<span v-if="d.example" class="le-ex"> — {{ d.example }}</span></li></ol>
            </div>
          </div>
          <div v-else-if="builtin" class="le-def">
            <div class="le-word">{{ word.trim() }}
              <span class="le-phon">/{{ builtin.phonetic }}/</span>
              <span class="le-pos">{{ builtin.pos }}</span>
            </div>
            <div class="le-mean">{{ builtin.def }}<span v-if="builtin.example" class="le-ex"> — {{ builtin.example }}</span></div>
            <p class="le-tip">（Free Dictionary 暂不可达，已用内置大纲词库兜底，仍可加入生词本）</p>
          </div>
          <p v-else-if="searched && !loading" class="le-empty">未找到「{{ lastWord }}」的释义，检查拼写或换词试试。</p>

          <div v-if="explainText" class="le-answer">{{ explainText }}</div>

          <h3 class="le-h" style="margin-top:18px;">我的生词本</h3>
          <p class="le-sub">点「翻译」查看中文释义：优先显示收藏时已保存的释义，无释义时自动联网翻译。</p>
          <div class="le-grid">
            <div v-for="b in words" :key="b.id" class="le-worditem">
              <div class="le-wordname">{{ b.title }}</div>
              <div class="le-word-actions">
                <button class="le-mini" @click="translateWord(b, false)">翻译</button>
                <button v-if="b.note && transMap[b.id]?.text" class="le-mini" @click="translateWord(b, true)">联网校对</button>
                <button class="le-mini danger" @click="removeWord(b.id)">删除</button>
              </div>
              <div v-if="transMap[b.id]?.loading" class="le-trans le-trans-load">翻译中…</div>
              <div v-else-if="transMap[b.id]?.text" class="le-trans">{{ transMap[b.id]?.text }}</div>
            </div>
            <p v-if="!words.length" class="le-empty">生词本为空，查词后可一键收藏。</p>
          </div>

          <h3 class="le-h" style="margin-top:22px;">背单词卡训练</h3>
          <p class="le-sub">以三本 PDF 中的单词与词组为数据来源，强化听写、拼写、跟读与翻译。今日待复习/待学 <b>{{ degreeDueCount }}</b> 个。</p>
          <div class="le-training-grid">
            <button type="button" class="le-training-card" @click="wordSub = 'flash'">
              <span class="le-training-icon">🎴</span>
              <span class="le-training-name">闪卡</span>
              <span class="le-training-desc">卡片式记忆</span>
            </button>
            <button type="button" class="le-training-card" @click="wordSub = 'dictation'">
              <span class="le-training-icon">🎧</span>
              <span class="le-training-name">听写</span>
              <span class="le-training-desc">听音频写单词</span>
            </button>
            <button type="button" class="le-training-card" @click="wordSub = 'spelling'">
              <span class="le-training-icon">✏️</span>
              <span class="le-training-name">拼写</span>
              <span class="le-training-desc">看释义写单词</span>
            </button>
            <button type="button" class="le-training-card" @click="wordSub = 'shadow'">
              <span class="le-training-icon">🎤</span>
              <span class="le-training-name">跟读</span>
              <span class="le-training-desc">听音跟读练习</span>
            </button>
            <button type="button" class="le-training-card" @click="wordSub = 'translate'">
              <span class="le-training-icon">📝</span>
              <span class="le-training-name">翻译</span>
              <span class="le-training-desc">英译汉句子训练</span>
            </button>
            <button type="button" class="le-training-card review" :disabled="degreeDueCount === 0" @click="openReviewOnly('degree')">
              <span class="le-training-icon">🔁</span>
              <span class="le-training-name">待复习</span>
              <span class="le-training-desc">{{ degreeDueCount }} 个到期/待学</span>
            </button>
          </div>
        </div>

        <!-- 背单词卡训练面板（内嵌，不跳转） -->
        <div v-else-if="active === 'word'" class="le-card">
          <WordTrainingPanel source="degree" :mode="(wordSub === 'review' ? 'flash' : wordSub as any)" :review-only="wordSub === 'review'" @close="wordSub = 'home'" />
        </div>

        <!-- 四六级单词：首页（级别 + 训练入口） -->
        <div v-else-if="active === 'cet' && cetSub === 'home'" class="le-card">
          <h3 class="le-h">四六级单词卡</h3>
          <p class="le-sub">内置免费词库（离线可用，无需联网/付费），支持闪卡、听写、拼写、跟读训练。</p>
          <div class="le-level">
            <button type="button" class="le-level-btn" :class="{ active: cetLevel === 'cet4' }" @click="cetLevel = 'cet4'">四级（{{ MASTER_WORDS_BUNDLE.length }} 词）</button>
            <button type="button" class="le-level-btn" :class="{ active: cetLevel === 'cet6' }" :disabled="!cet6Ready" @click="cetLevel = 'cet6'">六级（{{ cet6Ready ? CET6_WORDS_BUNDLE.length : '待补充' }} 词）</button>
          </div>
          <el-alert
            v-if="cetLevel === 'cet6' && !cet6Ready"
            type="info"
            :closable="false"
            show-icon
            title="六级词库待补充"
            description="将免费六级词表（如 KyleBing/english-vocabulary 的「6 六级-乱序.txt」，格式：单词<TAB>释义）保存到 scripts/cet6_words.csv，运行命令 node scripts/gen-cet6-bundle.mjs 即可生成内置六级词库。"
          />
          <p class="le-sub">今日待复习/待学 <b>{{ cetDueCount }}</b> 个。</p>
          <div class="le-training-grid">
            <button type="button" class="le-training-card" @click="cetSub = 'flash'">
              <span class="le-training-icon">🎴</span><span class="le-training-name">闪卡</span><span class="le-training-desc">卡片式记忆</span>
            </button>
            <button type="button" class="le-training-card" @click="cetSub = 'dictation'">
              <span class="le-training-icon">🎧</span><span class="le-training-name">听写</span><span class="le-training-desc">听音频写单词</span>
            </button>
            <button type="button" class="le-training-card" @click="cetSub = 'spelling'">
              <span class="le-training-icon">✏️</span><span class="le-training-name">拼写</span><span class="le-training-desc">看释义写单词</span>
            </button>
            <button type="button" class="le-training-card" @click="cetSub = 'shadow'">
              <span class="le-training-icon">🎤</span><span class="le-training-name">跟读</span><span class="le-training-desc">听音跟读练习</span>
            </button>
            <button type="button" class="le-training-card review" :disabled="cetDueCount === 0" @click="openReviewOnly('cet')">
              <span class="le-training-icon">🔁</span><span class="le-training-name">待复习</span><span class="le-training-desc">{{ cetDueCount }} 个到期/待学</span>
            </button>
          </div>
        </div>

        <!-- 四六级单词训练面板（内嵌） -->
        <div v-else-if="active === 'cet'" class="le-card">
          <WordTrainingPanel source="cet" :cet-level="cetLevel" :mode="(cetSub === 'review' ? 'flash' : cetSub as any)" :review-only="cetSub === 'review'" @close="cetSub = 'home'" />
        </div>

        <!-- 知识库：学习模块 -->
        <div v-else-if="active === 'outline'" class="le-card le-kb">
          <!-- 头部 -->
          <div class="le-kb-head">
            <div class="le-kb-headtext">
              <template v-if="!kbBook">
                <h3 class="le-h">学位英语知识库</h3>
                <p class="le-sub">按官方三本 PDF 分册系统学习：考试大纲 → 复习指南 → 全真模拟试卷</p>
              </template>
              <template v-else-if="!kbChapter">
                <el-button text :icon="ArrowLeft" @click="backToBooks">返回图书列表</el-button>
                <h3 class="le-h" style="margin-top:8px;">{{ currentBook?.name }}</h3>
                <p class="le-sub">{{ currentBook?.desc }}</p>
              </template>
              <template v-else>
                <el-button text :icon="ArrowLeft" @click="backToChapters">返回章列表</el-button>
                <h3 class="le-h" style="margin-top:8px;">{{ currentChapter?.title }}</h3>
                <p class="le-sub">{{ currentChapter?.summary }}</p>
              </template>
            </div>
            <el-input v-model="kbSearch" clearable :placeholder="kbBook ? '在当前图书中搜索…' : '搜索知识点：虚拟语气 / 定语从句 / 婉拒…'" class="le-kb-search" />
          </div>

          <!-- 搜索结果 -->
          <div v-if="kbSearch.trim()" class="le-kb-results">
            <p class="le-sub">匹配到 {{ searchResults.length }} 讲</p>
            <button
              v-for="r in searchResults"
              :key="r.id"
              type="button"
              class="le-kb-rescard"
              @click="startLesson(r._bookId || 'dagang', r._chapterId || '', r.id)"
            >
              <span class="le-kb-resmod">{{ r._book }} · {{ r._chapter }}</span>
              <span class="le-kb-restitle">{{ r.title }}</span>
              <span class="le-kb-ressum">{{ r.summary }}</span>
            </button>
            <p v-if="!searchResults.length" class="le-empty">没有匹配的知识点，换个关键词试试（如 时态、被动、翻译、作文）。</p>
          </div>

          <!-- 图书列表页 -->
          <template v-else-if="!kbBook">
            <!-- 继续学习 -->
            <div v-if="continueLesson" class="le-continue" @click="startLesson(continueLesson.bookId, continueLesson.chapterId, continueLesson.lesson.id)">
              <div class="le-continue-main">
                <span class="le-continue-tag">继续学习</span>
                <span class="le-continue-title">{{ continueLesson.lesson.title }}</span>
                <span class="le-continue-meta">{{ continueLesson.book }} · {{ continueLesson.chapter }}</span>
                <span class="le-continue-sum">{{ continueLesson.lesson.summary }}</span>
              </div>
              <div class="le-continue-btn">继续学习 →</div>
            </div>

            <!-- 学习统计 -->
            <div class="le-kb-stats">
              <div class="le-kb-stat"><b>{{ kbTotalLessons }}</b><span>总讲数</span></div>
              <div class="le-kb-stat"><b>{{ kbDoneCount }}</b><span>已完成</span></div>
              <div class="le-kb-stat"><b>{{ kbTotalProgress }}%</b><span>总进度</span></div>
            </div>

            <!-- 三本书入口 -->
            <div class="le-book-grid">
              <button
                v-for="b in DEGREE_BOOKS"
                :key="b.id"
                type="button"
                class="le-book-card"
                @click="selectBook(b.id)"
              >
                <span class="le-book-icon">📖</span>
                <span class="le-book-name">{{ b.name }}</span>
                <span class="le-book-desc">{{ b.desc }}</span>
                <span class="le-book-meta">{{ b.chapters.length }} 章 / {{ totalLessons(b) }} 讲</span>
                <div class="le-book-progress"><div class="le-book-progress-bar" :style="{ width: bookProgress(b) + '%' }"></div><span>{{ bookProgress(b) }}%</span></div>
              </button>
            </div>
          </template>

          <!-- 章列表页 -->
          <template v-else-if="!kbChapter">
            <div class="le-chapter-grid">
              <button
                v-for="(c, i) in currentBook?.chapters"
                :key="c.id"
                type="button"
                class="le-chapter-card"
                :class="{ done: chapterProgress(c) === 100 }"
                @click="selectChapter(c.id)"
              >
                <span class="le-chapter-no">{{ i + 1 }}</span>
                <span class="le-chapter-title">{{ c.title }}</span>
                <span class="le-chapter-sum">{{ c.summary }}</span>
                <span class="le-chapter-meta">{{ c.lessons.length }} 讲 · 进度 {{ chapterProgress(c) }}%</span>
                <div class="le-chapter-progress"><div class="le-chapter-progress-bar" :style="{ width: chapterProgress(c) + '%' }"></div></div>
              </button>
            </div>
          </template>

          <!-- 课列表页 -->
          <template v-else>
            <div class="le-lesson-grid">
              <article
                v-for="(l, i) in currentChapter?.lessons"
                :id="'les-' + l.id"
                :key="l.id"
                class="le-lesson-card"
                :class="{ done: isDone(l.id), doing: isDoing(l.id) && !isDone(l.id) }"
              >
                <div class="le-lesson-top">
                  <span class="le-lesson-no">{{ i + 1 }}</span>
                  <div class="le-lesson-tags">
                    <span v-for="t in (l.tags || []).slice(0, 3)" :key="t" class="le-tag">{{ t }}</span>
                    <span v-if="l.duration" class="le-tag time">{{ l.duration }}min</span>
                  </div>
                </div>
                <h4 class="le-lesson-title">{{ l.title }}</h4>
                <p class="le-lesson-sum">{{ l.summary }}</p>
                <div class="le-lesson-actions">
                  <el-button type="primary" size="small" @click="startLesson(kbBook, kbChapter, l.id)">
                    {{ isDone(l.id) ? '再次学习' : (isDoing(l.id) ? '继续学习' : '开始学习') }}
                  </el-button>
                  <el-button :type="isDone(l.id) ? 'success' : 'default'" size="small" :icon="isDone(l.id) ? CircleCheck : undefined" @click="toggleDone(l.id)">
                    {{ isDone(l.id) ? '已完成' : '标记完成' }}
                  </el-button>
                  <el-button text size="small" @click="toggleLesson(l.id)">
                    {{ openMap[l.id] ? '收起' : '展开' }}正文
                  </el-button>
                </div>

                <div v-show="openMap[l.id]" class="le-lesson-body">
                  <p v-for="(p, pi) in l.body" :key="'p' + pi" class="le-p">{{ p }}</p>

                  <div v-for="(t, ti) in (l.tables || [])" :key="'t' + ti" class="le-tbl-wrap">
                    <div v-if="t.title" class="le-tbl-title">{{ t.title }}</div>
                    <div class="le-tbl-scroll">
                      <table class="le-tbl">
                        <thead><tr><th v-for="(h, hi) in t.head" :key="hi">{{ h }}</th></tr></thead>
                        <tbody>
                          <tr v-for="(r, ri) in t.rows" :key="ri">
                            <td v-for="(c, ci) in r" :key="ci">{{ c }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div v-if="l.examples && l.examples.length" class="le-exs">
                    <div class="le-block-h">例句</div>
                    <div v-for="(e, ei) in l.examples" :key="'e' + ei" class="le-ex-item">
                      <div class="le-ex-en">{{ e.en }}</div>
                      <div class="le-ex-zh">{{ e.zh }}</div>
                      <div v-if="e.note" class="le-ex-note">提示：{{ e.note }}</div>
                    </div>
                  </div>

                  <div v-if="l.traps && l.traps.length" class="le-traps">
                    <div class="le-block-h warn">易错点 / 考点提醒</div>
                    <ul><li v-for="(t, ti2) in l.traps" :key="'tr' + ti2">{{ t }}</li></ul>
                  </div>

                  <div class="le-row">
                    <button class="le-mini" @click="explainLesson(l)">AI 换种说法再讲一遍</button>
                    <button class="le-mini" @click="quizLesson(l)">AI 出 3 道练习题</button>
                  </div>
                  <div v-if="lessonAi[l.id]" class="le-know-explain">{{ lessonAi[l.id] }}</div>
                </div>
              </article>
            </div>
          </template>
        </div>

        <!-- 学习计划 -->
        <div v-else-if="active === 'plan'" class="le-card">
          <h3 class="le-h">备考学习计划</h3>
          <p class="le-sub">上传你的备考资料（.txt/.md），填写考试时间与目标，由 AI 按大纲生成可执行计划；计划存入云端，按账号隔离。</p>
          <div class="le-plan-form">
            <div class="le-pf-row">
              <label>考试时间</label>
              <el-date-picker v-model="examDate" type="date" placeholder="选择考试日期" value-format="YYYY-MM-DD" style="flex:1;" />
            </div>
            <div class="le-pf-row">
              <label>当前水平</label>
              <el-input v-model="planLevel" placeholder="如：四级擦边 / 多年未学英语" style="flex:1;" />
            </div>
            <div class="le-pf-row">
              <label>目标</label>
              <el-input v-model="planTarget" placeholder="如：一次通过，重点突破阅读与写作" style="flex:1;" />
            </div>
            <div class="le-pf-row le-pf-col">
              <label>重点模块</label>
              <div class="le-chks">
                <el-checkbox v-for="o in DEGREE_BOOKS.flatMap((b) => b.chapters)" :key="o.id" v-model="planFocus" :value="o.title" size="small">{{ o.title }}</el-checkbox>
              </div>
            </div>
            <div class="le-pf-row">
              <label>备考资料</label>
              <input ref="fileInput" type="file" accept=".txt,.md,.text" style="display:none" @change="onFile" />
              <el-button @click="fileInput?.click()">{{ materialName || '选择 .txt/.md 文件' }}</el-button>
              <span v-if="materialName" class="le-file-ok">已读取（{{ materialText.length }} 字）</span>
            </div>
            <div class="le-row">
              <el-button type="primary" :loading="planLoading" :disabled="!examDate || !cfg" @click="genPlan">生成备考计划</el-button>
              <el-button v-if="plan" :disabled="!examDate" @click="savePlan">保存计划</el-button>
              <span v-if="!cfg" class="le-warn">未检测到 AI 配置，无法生成计划。</span>
            </div>
          </div>

          <div v-if="plan" class="le-plan">
            <div class="le-plan-meta">距考试约 <b>{{ plan.totalDays }}</b> 天 · 重点：{{ plan.focus.join('、') || '全模块' }}</div>
            <div v-for="(ph, i) in plan.phases" :key="i" class="le-phase">
              <div class="le-phase-h"><span class="le-phase-no">{{ i + 1 }}</span>{{ ph.title }} <span class="le-phase-days">{{ ph.days }}</span></div>
              <div class="le-phase-block"><b>目标</b><ul><li v-for="(g, j) in ph.goals" :key="j">{{ g }}</li></ul></div>
              <div class="le-phase-block"><b>方法</b><ul><li v-for="(m, j) in ph.methods" :key="j">{{ m }}</li></ul></div>
            </div>
            <div class="le-tips"><b>备考提示</b><ul><li v-for="(t, i) in plan.tips" :key="i">{{ t }}</li></ul></div>
          </div>

          <h3 class="le-h" style="margin-top:18px;">已保存的计划（云端）</h3>
          <div class="le-grid2">
            <div v-for="p in savedPlans" :key="p.id" class="le-know">
              <div class="le-know-title">{{ p.title }}</div>
              <div class="le-row">
                <button class="le-mini" @click="loadPlan(p)">查看</button>
                <button class="le-mini danger" @click="delPlan(p.id)">删除</button>
              </div>
            </div>
            <p v-if="!savedPlans.length" class="le-empty">还没有保存的计划。</p>
          </div>
        </div>

        <!-- AI 答疑 -->
        <div v-else-if="active === 'ai'" class="le-card">
          <h3 class="le-h">AI 英语答疑</h3>
          <p class="le-sub">基于你已配置的 AI 回答语法、词汇、备考策略等问题。</p>
          <el-input v-model="qaQuestion" type="textarea" :rows="3" placeholder="例如：完形填空总错，怎么提高？虚拟语气怎么记？" />
          <div class="le-row">
            <el-button type="primary" :loading="qaLoading" @click="runQa">向 AI 提问</el-button>
            <span v-if="!cfg" class="le-warn">未检测到 AI 配置。</span>
          </div>
          <div v-if="qaAnswer" class="le-answer">{{ qaAnswer }}</div>
        </div>

        <!-- 薄弱点分析 -->
        <div v-else-if="active === 'weakness'" class="le-card">
          <h3 class="le-h">薄弱点分析</h3>
          <p class="le-sub">结合错题本、练习记录、模考与单词进度，定位最该优先补的题型与词汇。</p>

          <div v-if="weakLoading" class="le-empty">加载中…</div>
          <div v-else-if="!weakEnough" class="le-empty">
            当前错题/练习样本不足（至少 {{ WEAKNESS_MIN_SAMPLE }} 条），多练几套题后再来看画像。
          </div>
          <div v-else class="le-weak-grid">
            <div class="le-weak-card">
              <div class="le-weak-title">最薄弱题型</div>
              <div class="le-weak-value">{{ weakTopType }}</div>
              <button class="le-mini" @click="router.push('/degree/weakness')">查看完整分析</button>
            </div>
            <div class="le-weak-card">
              <div class="le-weak-title">高频错因</div>
              <div class="le-weak-value">{{ weakTopReason }}</div>
              <button class="le-mini" @click="router.push('/degree/practice')">去专项练习</button>
            </div>
            <div class="le-weak-card">
              <div class="le-weak-title">薄弱单词</div>
              <div class="le-weak-value">{{ weakTopWord }}</div>
              <button class="le-mini" @click="router.push('/degree/words')">去词库复习</button>
            </div>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { School, Reading, Collection, Calendar, ChatDotRound, ArrowDown, ArrowLeft, Odometer, CircleCheck, Notebook } from '@element-plus/icons-vue'
import PageHeader from '../components/PageHeader.vue'
import { loadAiConfig, callAi, type AiConfig } from '../services/aiService'
import {
  fetchDefinitionSafe,
  explainWord,
  explainTopic,
  generateStudyPlan,
  parseMaterialFile,
  type WordDefinition,
  type EnglishLesson,
  type StudyPlan
} from '../services/learningService'
import {
  DEGREE_BOOKS,
  DEGREE_KNOWLEDGE_FLAT,
  type DegreeKnowledgeBook,
  type DegreeKnowledgeChapter
} from '../services/degreeKnowledge'
import {
  listLearnBookmarks,
  addLearnBookmark,
  removeLearnBookmark,
  listStudyPlans,
  saveStudyPlan,
  removeStudyPlan,
  type LearnBookmark
} from '../services/learnDb'
import { loadMistakes } from '../prep/degreeService'
import { buildWeaknessReport, WEAKNESS_MIN_SAMPLE } from '../prep/weakness'
import type { MistakeRec, WordProgress } from '../prep/degreeTypes'
import WordTrainingPanel from '../components/WordTrainingPanel.vue'
import { MASTER_WORDS_BUNDLE } from '../prep/masterWordsBundle'
import { CET6_WORDS_BUNDLE } from '../prep/cet6WordsBundle'
import { loadWords as loadDegreeWords, loadPhrases as loadDegreePhrases } from '../prep/degreeDb'
import { countDueToday } from '../prep/trainingSrs'
import { loadLearnWordProgress } from '../services/learnWordProgressService'
import { loadCetProgress } from '../services/cetProgressService'
import type { PrepWord } from '../services/cetPrepService'
import {
  loadKnowledgeProgress,
  markLessonDone,
  markLessonDoing,
  type KnowledgeProgressState
} from '../services/learnKnowledgeProgressService'

const MODULES = [
  { key: 'word', label: '背单词卡', desc: '查词 · 生词本 · 听写/拼写/跟读/翻译', color: '#0891b2', icon: Reading },
  { key: 'outline', label: '知识库', desc: '按三本 PDF 精读', color: '#7c3aed', icon: Collection },
  { key: 'plan', label: '学习计划', desc: '资料→AI 计划', color: '#e08a00', icon: Calendar },
  { key: 'ai', label: 'AI 答疑', desc: '语法/备考', color: '#0ea5e9', icon: ChatDotRound },
  { key: 'weakness', label: '薄弱点分析', desc: '错题 · 练习 · 模考画像', color: '#534ab7', icon: Odometer },
  { key: 'cet', label: '四六级单词', desc: '内置免费词库·闪卡/听写/拼写/跟读', color: '#d97706', icon: Notebook },
  { key: 'prep', label: '备考台', desc: '今日/刷题/错本/我的/模考', color: '#3c3489', icon: School }
]
const active = ref('word')
const wordSub = ref<'home' | 'flash' | 'dictation' | 'spelling' | 'shadow' | 'translate' | 'review'>('home')
const cetSub = ref<'home' | 'flash' | 'dictation' | 'spelling' | 'shadow' | 'review'>('home')
const cetLevel = ref<'cet4' | 'cet6'>('cet4')
const router = useRouter()

// 学习中心 · 背单词卡 / 四六级：待复习计数（云端优先+本地镜像）
const wordProgress = ref<Record<string, WordProgress>>({})
const cetProgress = ref<Record<string, WordProgress>>({})
const degreeItems = ref<{ word: string; definition: string }[]>([])
const wordStatsLoading = ref(false)

async function loadWordStats(): Promise<void> {
  wordStatsLoading.value = true
  try {
    const [words, phrases, prog, cet4, cet6] = await Promise.all([
      loadDegreeWords(),
      loadDegreePhrases(),
      loadLearnWordProgress(),
      loadCetProgress('cet4'),
      loadCetProgress('cet6')
    ])
    degreeItems.value = [
      ...words.map((w) => ({ word: w.word, definition: w.definition })),
      ...phrases.map((p) => ({ word: p.en, definition: p.zh || p.extra || '' }))
    ]
    wordProgress.value = prog
    cetProgress.value = { ...cet4, ...cet6 }
  } catch {
    /* ignore */
  }
  wordStatsLoading.value = false
}

const degreeDueCount = computed(() => {
  const newPerDay = 15
  return countDueToday(degreeItems.value, wordProgress.value, newPerDay)
})

const cetDueCount = computed(() => {
  const bundle = (cetLevel.value === 'cet6' ? CET6_WORDS_BUNDLE : MASTER_WORDS_BUNDLE) as PrepWord[]
  const items = bundle.map((p) => ({ word: p[0], definition: p[3] }))
  const prog = (cetLevel.value === 'cet6'
    ? Object.fromEntries(Object.entries(cetProgress.value).filter(([k]) => CET6_WORDS_BUNDLE.some((p) => p[0] === k)))
    : Object.fromEntries(Object.entries(cetProgress.value).filter(([k]) => MASTER_WORDS_BUNDLE.some((p) => p[0] === k)))
  )
  return countDueToday(items, prog, 15)
})

function openReviewOnly(source: 'degree' | 'cet'): void {
  if (source === 'degree') wordSub.value = 'review'
  else cetSub.value = 'review'
}

const nowText = ref('')
let clockTimer: number | undefined
function pad(n: number): string { return String(n).padStart(2, '0') }
function updateClock(): void {
  const d = new Date()
  nowText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const cfg = ref<AiConfig | null>(null)

function switchModule(key: string): void {
  if (key === 'prep') {
    router.push('/learn/english/prep')
    return
  }
  if (key === 'cet') {
    active.value = 'cet'
    cetSub.value = 'home'
    void loadWordStats()
    return
  }
  active.value = key
  if (key === 'word') {
    if (!words.value.length) void loadWords()
    void loadWordStats()
  }
  if (key === 'outline') void loadKbProgress()
  if (key === 'plan' && !savedPlans.value.length) void loadPlans()
  if (key === 'weakness') void loadWeakness()
}

/* ================= 查词 ================= */
const word = ref('vocabulary')
const lastWord = ref('')
const def = ref<WordDefinition | null>(null)
const builtin = ref<{ phonetic: string; pos: string; def: string; example?: string } | null>(null)
const searched = ref(false)
const loading = ref(false)
const explainText = ref('')
async function lookup(): Promise<void> {
  const w = word.value.trim()
  if (!w) return
  lastWord.value = w
  searched.value = true
  loading.value = true
  def.value = null
  builtin.value = null
  const r = await fetchDefinitionSafe(w)
  def.value = r.def
  builtin.value = r.builtin || null
  loading.value = false
}
async function explain(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  explainText.value = 'AI 解读中…'
  try {
    explainText.value = await explainWord(word.value.trim(), def.value, cfg.value)
  } catch (e) { explainText.value = '解读失败：' + (e as Error).message }
}
const words = ref<LearnBookmark[]>([])
const transMap = reactive<Record<string, { text: string; loading: boolean }>>({})
const cet6Ready = CET6_WORDS_BUNDLE.length > 0

async function loadWords(): Promise<void> {
  try {
    words.value = await listLearnBookmarks('word')
  } catch (e) {
    ElMessage.error('生词本读取失败：' + (e as Error).message)
    words.value = []
  }
}

function wordMeaning(): string {
  if (def.value) {
    return def.value.meanings
      .map((m) => `${m.partOfSpeech} ${m.definitions.map((d) => d.definition).join('；')}`)
      .join('；')
  }
  if (builtin.value) {
    return `${builtin.value.pos} ${builtin.value.def}${builtin.value.example ? ' — ' + builtin.value.example : ''}`
  }
  return ''
}

async function addWord(): Promise<void> {
  const w = word.value.trim().toLowerCase()
  if (!w) return
  let meaning = wordMeaning()
  // 如果用户直接输入未查询，自动查一次，把释义一起存进去
  if (!meaning) {
    try {
      const r = await fetchDefinitionSafe(w)
      meaning = r.def
        ? r.def.meanings.map((m) => `${m.partOfSpeech} ${m.definitions.map((d) => d.definition).join('；')}`).join('；')
        : r.builtin
          ? `${r.builtin.pos} ${r.builtin.def}${r.builtin.example ? ' — ' + r.builtin.example : ''}`
          : ''
    } catch { /* 留空，后续点翻译再联网补 */ }
  }
  try {
    await addLearnBookmark('word', w, w, meaning)
    await loadWords()
    ElMessage.success('已加入生词本' + (meaning ? '（已保存释义）' : ''))
  } catch (e) {
    ElMessage.error('加入生词本失败：' + (e as Error).message)
  }
}

async function translateWord(b: LearnBookmark, forceOnline = false): Promise<void> {
  // 优先显示收藏时已保存的释义（离线、免费、稳定）
  if (!forceOnline && b.note && !transMap[b.id]?.text) {
    transMap[b.id] = { text: b.note, loading: false }
    return
  }
  if (transMap[b.id]?.loading) return
  const existing = transMap[b.id]?.text || ''
  transMap[b.id] = { text: existing, loading: true }
  try {
    const r = await fetchDefinitionSafe(b.title)
    const t = r.def
      ? r.def.meanings.map((m) => `${m.partOfSpeech} ${m.definitions.map((d) => d.definition).join('；')}`).join('；')
      : r.builtin
        ? `${r.builtin.pos} ${r.builtin.def}${r.builtin.example ? ' — ' + r.builtin.example : ''}`
        : '未找到释义'
    transMap[b.id] = { text: t, loading: false }
  } catch (e) {
    transMap[b.id] = { text: '翻译失败：' + (e as Error).message, loading: false }
  }
}

async function removeWord(id: string): Promise<void> {
  try {
    await removeLearnBookmark(id)
    await loadWords()
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error('删除失败：' + (e as Error).message)
  }
}

/* ================= 知识库（按三本 PDF 分册 · 学习模块） ================= */
const kbSearch = ref('')
const kbBook = ref('')
const kbChapter = ref('')
const openMap = reactive<Record<string, boolean>>({})
const moduleAi = reactive<Record<string, string>>({})
const lessonAi = reactive<Record<string, string>>({})

const KB_LAST_KEY = 'degree_kb_last_v1'

interface KbProgress extends KnowledgeProgressState {
  lastBook?: string
  lastChapter?: string
  lastLesson?: string
}

const kbProgress = reactive<KbProgress>({ done: [], doing: [] })
const kbLoading = ref(false)

async function loadKbProgress(): Promise<void> {
  kbLoading.value = true
  try {
    const p = await loadKnowledgeProgress()
    kbProgress.done = p.done
    kbProgress.doing = p.doing
    const last = localStorage.getItem(KB_LAST_KEY)
    if (last) {
      const l = JSON.parse(last)
      kbProgress.lastBook = l.lastBook
      kbProgress.lastChapter = l.lastChapter
      kbProgress.lastLesson = l.lastLesson
    }
  } catch (e) {
    ElMessage.error('知识库进度读取失败：' + (e as Error).message)
  } finally {
    kbLoading.value = false
  }
}
function saveKbLast(): void {
  localStorage.setItem(KB_LAST_KEY, JSON.stringify({
    lastBook: kbProgress.lastBook,
    lastChapter: kbProgress.lastChapter,
    lastLesson: kbProgress.lastLesson
  }))
}
function isDone(id: string): boolean { return kbProgress.done.includes(id) }
function isDoing(id: string): boolean { return kbProgress.doing.includes(id) }
async function toggleDone(id: string): Promise<void> {
  const next = !isDone(id)
  try {
    await markLessonDone(id, next)
    if (next) {
      kbProgress.done = [...kbProgress.done, id]
      kbProgress.doing = kbProgress.doing.filter((x) => x !== id)
    } else {
      kbProgress.done = kbProgress.done.filter((x) => x !== id)
    }
  } catch (e) {
    const msg = (e as Error).message || ''
    ElMessage.error('标记完成失败：' + msg)
    if (msg.includes('row-level security')) {
      ElMessage.warning('请让管理员在 Supabase SQL Editor 执行 scripts/fix-learn-progress-rls.sql')
    }
  }
}
async function startLesson(bookId: string, chapterId: string, lessonId: string): Promise<void> {
  kbProgress.lastBook = bookId
  kbProgress.lastChapter = chapterId
  kbProgress.lastLesson = lessonId
  saveKbLast()
  if (!isDone(lessonId) && !isDoing(lessonId)) {
    try {
      await markLessonDoing(lessonId, true)
      kbProgress.doing = [...kbProgress.doing, lessonId]
    } catch (e) {
      const msg = (e as Error).message || ''
      ElMessage.error('开始学习失败：' + msg)
      if (msg.includes('row-level security')) {
        ElMessage.warning('请让管理员在 Supabase SQL Editor 执行 scripts/fix-learn-progress-rls.sql')
      }
    }
  }
  gotoLesson(bookId, chapterId, lessonId)
}

const currentBook = computed<DegreeKnowledgeBook | null>(
  () => DEGREE_BOOKS.find((b) => b.id === kbBook.value) ?? null
)
const currentChapter = computed<DegreeKnowledgeChapter | null>(
  () => currentBook.value?.chapters.find((c) => c.id === kbChapter.value) ?? null
)

function totalLessons(book: DegreeKnowledgeBook): number {
  return book.chapters.reduce((s, c) => s + c.lessons.length, 0)
}
function bookProgress(book: DegreeKnowledgeBook): number {
  const total = totalLessons(book)
  if (!total) return 0
  const done = book.chapters.flatMap((c) => c.lessons).filter((l) => isDone(l.id)).length
  return Math.round((done / total) * 100)
}
function chapterProgress(chapter: DegreeKnowledgeChapter): number {
  if (!chapter.lessons.length) return 0
  const done = chapter.lessons.filter((l) => isDone(l.id)).length
  return Math.round((done / chapter.lessons.length) * 100)
}

const continueLesson = computed(() => {
  if (!kbProgress.lastLesson) return null
  const lesson = DEGREE_KNOWLEDGE_FLAT.find((l) => l.id === kbProgress.lastLesson)
  if (!lesson) return null
  return {
    book: lesson._book || '',
    chapter: lesson._chapter || '',
    bookId: lesson._bookId || '',
    chapterId: lesson._chapterId || '',
    lesson
  }
})

const kbTotalLessons = computed(() => DEGREE_BOOKS.reduce((s, b) => s + totalLessons(b), 0))
const kbDoneCount = computed(() => DEGREE_BOOKS.reduce((s, b) => s + b.chapters.flatMap((c) => c.lessons).filter((l) => isDone(l.id)).length, 0))
const kbTotalProgress = computed(() => (kbTotalLessons.value ? Math.round((kbDoneCount.value / kbTotalLessons.value) * 100) : 0))

function selectBook(id: string): void {
  kbBook.value = id
  kbChapter.value = ''
}
function backToBooks(): void {
  kbBook.value = ''
  kbChapter.value = ''
  kbSearch.value = ''
}
function selectChapter(id: string): void {
  kbChapter.value = id
  Object.keys(openMap).forEach((k) => { delete openMap[k] })
}
function backToChapters(): void {
  kbChapter.value = ''
}
function toggleLesson(id: string): void { openMap[id] = !openMap[id] }
function expandAll(v: boolean): void {
  currentChapter.value?.lessons.forEach((l) => { openMap[l.id] = v })
}

const searchResults = computed(() => {
  const q = kbSearch.value.trim().toLowerCase()
  if (!q) return []
  return DEGREE_KNOWLEDGE_FLAT.filter((lesson) => {
    const hay = [
      lesson._book || '',
      lesson._chapter || '',
      lesson.title,
      lesson.summary,
      lesson.body.join(' '),
      (lesson.traps || []).join(' '),
      (lesson.examples || []).map((e) => e.en + e.zh).join(' '),
      (lesson.tables || []).map((t) => (t.title || '') + t.head.join(' ') + t.rows.map((r) => r.join(' ')).join(' ')).join(' ')
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })
})

function gotoLesson(bookId: string, chapterId: string, lessonId: string): void {
  kbSearch.value = ''
  kbBook.value = bookId
  kbChapter.value = chapterId
  openMap[lessonId] = true
  void nextTick(() => {
    document.getElementById('les-' + lessonId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function explainChapter(m: DegreeKnowledgeChapter): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  moduleAi[m.id] = 'AI 解读中…'
  try {
    moduleAi[m.id] = await explainTopic(`学位英语「${m.title}」`, cfg.value)
  } catch (e) { moduleAi[m.id] = '解读失败：' + (e as Error).message }
}
async function explainLesson(l: EnglishLesson): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  lessonAi[l.id] = 'AI 解读中…'
  try {
    lessonAi[l.id] = await callAi(
      cfg.value,
      '你是学位英语辅导老师。请用更通俗、更口语化的方式重新讲解下面这一讲，配 1 个生活化类比和 2 个新例句（含中文翻译），300 字内，不要编造考试政策。\n' +
      `标题：${l.title}\n要点：${l.summary}\n原讲解：${l.body.join(' ')}`
    )
  } catch (e) { lessonAi[l.id] = '解读失败：' + (e as Error).message }
}
async function quizLesson(l: EnglishLesson): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  lessonAi[l.id] = 'AI 出题中…'
  try {
    lessonAi[l.id] = await callAi(
      cfg.value,
      '请针对下面这一讲的知识点，出 3 道成人学位英语难度的单项选择题（A/B/C/D），每题后紧跟【答案】与一句话解析。只输出题目与解析，不要寒暄。\n' +
      `知识点：${l.title} —— ${l.summary}\n讲解要点：${l.body.join(' ').slice(0, 800)}`
    )
  } catch (e) { lessonAi[l.id] = '出题失败：' + (e as Error).message }
}

/* ================= 学习计划 ================= */
const examDate = ref('')
const planLevel = ref('')
const planTarget = ref('')
const planFocus = ref<string[]>([])
const materialName = ref('')
const materialText = ref('')
const planLoading = ref(false)
const plan = ref<StudyPlan | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
async function onFile(e: Event): Promise<void> {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    materialText.value = await parseMaterialFile(f)
    materialName.value = f.name
    ElMessage.success('资料已读取')
  } catch (err) {
    materialName.value = ''
    materialText.value = ''
    ElMessage.error((err as Error).message)
  }
}
async function genPlan(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  if (!examDate.value) { ElMessage.warning('请选择考试时间'); return }
  planLoading.value = true
  try {
    plan.value = await generateStudyPlan(cfg.value, {
      materialText: materialText.value || undefined,
      examDate: examDate.value,
      currentLevel: planLevel.value || undefined,
      target: planTarget.value || undefined,
      focusModules: planFocus.value.length ? planFocus.value : undefined
    })
    ElMessage.success('计划已生成，可点击「保存计划」存入云端')
  } catch (e) { ElMessage.error('生成失败：' + (e as Error).message) }
  finally { planLoading.value = false }
}
async function savePlan(): Promise<void> {
  if (!plan.value || !examDate.value) return
  await saveStudyPlan(plan.value, examDate.value)
  await loadPlans()
  ElMessage.success('已保存到云端')
}
const savedPlans = ref<LearnBookmark[]>([])
async function loadPlans(): Promise<void> { savedPlans.value = await listStudyPlans() }
function loadPlan(p: LearnBookmark): void {
  try { plan.value = JSON.parse(p.ref_id) as StudyPlan; examDate.value = p.title.replace('学习计划 · ', '') } catch { ElMessage.error('计划解析失败') }
}
async function delPlan(id: string): Promise<void> { await removeStudyPlan(id); await loadPlans() }

/* ================= AI 答疑 ================= */
const qaQuestion = ref('完形填空总错，怎么提高得分？')
const qaLoading = ref(false)
const qaAnswer = ref('')
async function runQa(): Promise<void> {
  if (!cfg.value) { ElMessage.warning('请先配置 AI 密钥'); return }
  qaLoading.value = true
  try {
    qaAnswer.value = await callAi(cfg.value, '你是学位英语备考辅导老师，用通俗中文解答，结合《学位英语水平考试大纲（第二版）》。\n问题：' + qaQuestion.value)
  } catch (e) { ElMessage.error('AI 调用失败：' + (e as Error).message) }
  finally { qaLoading.value = false }
}

/* ================= 薄弱点分析 ================= */
const weakLoading = ref(false)
const weakMistakes = ref<MistakeRec[]>([])
const weakEnough = ref(false)
const weakTopType = ref('—')
const weakTopReason = ref('—')
const weakTopWord = ref('—')

const typeLabelMap: Record<string, string> = {
  dialogue: '完成对话',
  reading: '阅读理解',
  vocab_grammar: '词汇语法',
  translation: '英译汉',
  writing: '短文写作'
}

async function loadWeakness(): Promise<void> {
  weakLoading.value = true
  try {
    weakMistakes.value = await loadMistakes()
    const report = buildWeaknessReport(
      weakMistakes.value.map((m) => ({ type: m.type, reason: m.reason || '未标注', questionId: m.questionId, createdAt: m.createdAt || null })),
      { period: 'month' }
    )
    weakEnough.value = report.enough
    if (report.enough) {
      const topTypeLabel = report.byType[0]?.label
      weakTopType.value = (topTypeLabel && typeLabelMap[topTypeLabel]) || topTypeLabel || '—'
      weakTopReason.value = report.byReason[0]?.label || '—'
      weakTopWord.value = '词汇语法'
    }
  } catch (e) {
    ElMessage.error('薄弱点加载失败：' + (e as Error).message)
  } finally {
    weakLoading.value = false
  }
}

onMounted(async () => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
  await loadKbProgress()
  try { cfg.value = await loadAiConfig() } catch { /* ignore */ }
  await loadWords()
  await lookup()
  await loadPlans()
  void loadWordStats()
})
onUnmounted(() => { if (clockTimer) window.clearInterval(clockTimer) })
</script>

<style scoped>
.le-root { min-height: 100%; padding: 0 20px; }
@media (max-width: 768px) { .le-root { padding: 0 14px; } }
.le-clock-box { display: inline-flex; align-items: center; gap: 6px; }
.le-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); animation: leBlink 2s ease-in-out infinite; }
@keyframes leBlink { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
.le-clock { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--text-strong); }
.le-clock-hint { font-size: 11px; color: var(--text-faint); }

.le-entries { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
.le-entry-degree { border-color: rgba(83, 74, 183, 0.45); box-shadow: 0 0 0 1px rgba(83, 74, 183, 0.15) inset; }
.le-entry {
  position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 14px 12px 16px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-card);
  cursor: pointer; text-align: left; min-width: 0; overflow: hidden; transition: transform .18s ease, border-color .18s ease, background .18s ease;
}
.le-entry:hover { transform: translateY(-2px); border-color: var(--c); }
.le-entry.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 7%, var(--surface)); }
.le-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); opacity: 0; transition: opacity .18s ease; }
.le-entry.on .le-bar { opacity: 1; }
.le-icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c); }
.le-icon :deep(svg) { font-size: 17px; }
.le-text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.3; }
.le-label { font-size: 13.5px; font-weight: 600; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.le-desc { font-size: 11px; color: var(--text-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.le-body { min-height: 320px; }
.le-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; box-shadow: var(--shadow-card); }
.le-h { font-size: 15px; color: var(--text-strong); margin: 0 0 6px; }
.le-sub { font-size: 12px; color: var(--text-faint); margin: 0 0 12px; }
.le-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.le-input { width: 300px; max-width: 100%; }
.le-warn { font-size: 12px; color: #f59e0b; }
.le-def { margin-top: 14px; padding: 14px; background: var(--surface-soft); border-radius: 10px; }
.le-word { font-size: 20px; font-weight: 700; color: var(--text-strong); margin-bottom: 8px; }
.le-phon { font-size: 13px; color: var(--text-faint); margin-left: 8px; }
.le-mean { margin-bottom: 8px; }
.le-pos { font-size: 12px; font-style: italic; color: var(--brand, #378add); margin-right: 6px; }
.le-ex { color: var(--text-faint); font-size: 12px; }
.le-tip { font-size: 12px; color: var(--text-faint); margin-top: 8px; }
.le-answer { margin-top: 14px; padding: 12px; background: var(--surface-soft); border-radius: 8px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; color: var(--text); }
.le-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.le-grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.le-empty { grid-column: 1 / -1; color: var(--text-faint); font-size: 13px; padding: 16px; text-align: center; }
.le-know { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); }
.le-know-title { font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }
.le-know-explain { margin-top: 10px; padding: 10px 12px; border: 1px dashed var(--border); border-radius: 8px; background: var(--surface-soft); font-size: 12.5px; color: var(--text); white-space: pre-wrap; line-height: 1.7; }
.le-mini { border: 1px solid var(--border); background: var(--surface); color: var(--brand, #378add); border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; text-decoration: none; display: inline-block; }
.le-mini:hover { border-color: var(--brand, #378add); }
.le-mini.danger { color: #ef4444; }
.le-worditem { display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-soft); }
.le-wordname { font-size: 14px; font-weight: 600; color: var(--text-strong); text-transform: capitalize; }
.le-word-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.le-trans { font-size: 13px; color: var(--text); background: var(--surface); border: 1px dashed var(--border); border-radius: 6px; padding: 6px 8px; line-height: 1.5; }
.le-trans-load { color: var(--text-muted); }
.le-level { display: flex; gap: 10px; margin: 12px 0 6px; flex-wrap: wrap; }
.le-level-btn {
  border: 1px solid var(--border); background: var(--surface); color: var(--text-strong);
  border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer;
}
.le-level-btn.active { border-color: #d97706; color: #d97706; background: #fff7ed; font-weight: 600; }
.le-level-btn:disabled { opacity: .5; cursor: not-allowed; }

/* ---------- 知识库 ---------- */
.le-kb-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.le-kb-headtext { min-width: 0; flex: 1; }
.le-kb-search { width: 320px; max-width: 100%; }

.le-kb-results { margin-top: 6px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
.le-kb-results > .le-sub { grid-column: 1 / -1; margin: 0; }
.le-kb-rescard { display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); cursor: pointer; transition: border-color .16s ease, transform .16s ease; }
.le-kb-rescard:hover { border-color: #7c3aed; transform: translateY(-2px); }
.le-kb-resmod { font-size: 11px; color: #7c3aed; }
.le-kb-restitle { font-size: 13px; font-weight: 600; color: var(--text-strong); }
.le-kb-ressum { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

.le-kb-main { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 16px; margin-top: 8px; }
.le-kb-nav { display: flex; flex-direction: column; gap: 6px; position: sticky; top: 12px; align-self: start; max-height: calc(100vh - 120px); overflow: auto; }
.le-kb-navi { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); cursor: pointer; text-align: left; transition: all .16s ease; }
.le-kb-navi:hover { border-color: #7c3aed; }
.le-kb-navi.on { border-color: #7c3aed; background: color-mix(in srgb, #7c3aed 8%, var(--surface)); }
.le-kb-navname { font-size: 12.5px; color: var(--text-strong); line-height: 1.35; }
.le-kb-navi.on .le-kb-navname { font-weight: 600; color: #7c3aed; }
.le-kb-navnum { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }

.le-kb-content { min-width: 0; }
.le-kb-intro { padding: 14px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); margin-bottom: 12px; }
.le-kb-title { font-size: 16px; font-weight: 700; color: var(--text-strong); margin-bottom: 6px; }
.le-kb-desc { font-size: 12.5px; color: var(--text-muted); line-height: 1.7; margin: 0 0 8px; }
.le-kb-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.le-kb-tag { font-size: 11px; color: #7c3aed; background: color-mix(in srgb, #7c3aed 10%, transparent); border-radius: 999px; padding: 2px 9px; }

.le-lesson { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); margin-bottom: 10px; overflow: hidden; }
.le-lesson.open { border-color: color-mix(in srgb, #7c3aed 45%, var(--border)); }
.le-lesson-h { display: flex; align-items: center; gap: 10px; padding: 11px 13px; cursor: pointer; user-select: none; }
.le-lesson-h:hover { background: var(--surface-soft); }
.le-lesson-no { flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; background: color-mix(in srgb, #7c3aed 12%, transparent); color: #7c3aed; }
.le-lesson-hh { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
.le-lesson-t { font-size: 13.5px; font-weight: 600; color: var(--text-strong); line-height: 1.4; }
.le-lesson-s { font-size: 12px; color: var(--text-faint); line-height: 1.5; }
.le-lesson-arrow { flex-shrink: 0; color: var(--text-faint); transition: transform .2s ease; }
.le-lesson.open .le-lesson-arrow { transform: rotate(180deg); }
.le-lesson-b { padding: 4px 15px 15px; border-top: 1px dashed var(--border); }
.le-p { font-size: 13px; color: var(--text); line-height: 1.85; margin: 10px 0 0; }

.le-tbl-wrap { margin-top: 12px; }
.le-tbl-title { font-size: 12.5px; font-weight: 600; color: var(--text-strong); margin-bottom: 6px; }
.le-tbl-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--border); border-radius: 8px; }
.le-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 420px; }
.le-tbl th { background: var(--surface-soft); color: var(--text-strong); font-weight: 600; text-align: left; padding: 8px 10px; white-space: nowrap; }
.le-tbl td { padding: 8px 10px; color: var(--text-muted); border-top: 1px solid var(--border); line-height: 1.6; vertical-align: top; }
.le-tbl tbody tr:hover { background: var(--surface-soft); }

.le-block-h { font-size: 12.5px; font-weight: 600; color: var(--text-strong); margin: 14px 0 6px; }
.le-block-h.warn { color: #d97706; }
.le-ex-item { padding: 9px 12px; border-left: 3px solid #0891b2; background: var(--surface-soft); border-radius: 0 8px 8px 0; margin-bottom: 8px; }
.le-ex-en { font-size: 13px; color: var(--text-strong); line-height: 1.7; white-space: pre-wrap; }
.le-ex-zh { font-size: 12.5px; color: var(--text-muted); line-height: 1.7; margin-top: 3px; white-space: pre-wrap; }
.le-ex-note { font-size: 11.5px; color: #0891b2; margin-top: 4px; line-height: 1.6; }
.le-traps ul { margin: 0; padding-left: 18px; }
.le-traps li { font-size: 12.5px; color: var(--text-muted); line-height: 1.8; }

.le-plan-form { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
.le-pf-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.le-pf-row > label { width: 72px; flex-shrink: 0; font-size: 13px; color: var(--text-muted); }
.le-pf-col { align-items: flex-start; }
.le-chks { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.le-file-ok { font-size: 12px; color: #16a34a; }
.le-plan { margin-top: 16px; }
.le-plan-meta { font-size: 13px; color: var(--text-strong); margin-bottom: 10px; }
.le-phase { border: 1px solid var(--border); border-left: 3px solid #0891b2; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: var(--surface); }
.le-phase-h { font-size: 14px; font-weight: 600; color: var(--text-strong); margin-bottom: 8px; }
.le-phase-no { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #0891b2; color: #fff; font-size: 12px; margin-right: 8px; }
.le-phase-days { font-size: 12px; color: var(--text-faint); font-weight: 400; margin-left: 8px; }
.le-phase-block { font-size: 12.5px; color: var(--text-muted); margin: 4px 0; }
.le-phase-block ul, .le-tips ul { margin: 4px 0 0; padding-left: 18px; }
.le-tips { font-size: 12.5px; color: var(--text-muted); background: var(--surface-soft); border-radius: 8px; padding: 10px 14px; margin-top: 6px; }

.le-fade-enter-active, .le-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.le-fade-enter-from { opacity: 0; transform: translateY(6px); }
.le-fade-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 1200px) {
  .le-entries { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .le-lesson-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .le-kb-main { grid-template-columns: 1fr; }
  .le-kb-nav { position: static; max-height: none; flex-direction: row; overflow-x: auto; padding-bottom: 4px; }
  .le-kb-navi { flex-shrink: 0; }
  .le-kb-navname { white-space: nowrap; }
}
@media (max-width: 760px) {
  .le-card { padding: 14px; }
  .le-entries { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .le-entry { padding: 10px 10px 10px 13px; gap: 8px; }
  .le-icon { width: 30px; height: 30px; border-radius: 9px; }
  .le-label { font-size: 12.5px; }
  .le-desc { display: none; }
  .le-kb-search { width: 100%; }
  .le-input { width: 100%; }
  .le-pf-row { flex-direction: column; align-items: stretch; gap: 6px; }
  .le-pf-row > label { width: auto; }
  .le-lesson-b { padding: 4px 12px 13px; }
  .le-p { font-size: 12.5px; line-height: 1.8; }
}
/* ---------- 背单词卡训练 ---------- */
.le-training-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.le-training-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 10px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface-soft); cursor: pointer; transition: transform .16s ease, border-color .16s ease;
}
.le-training-card:hover { transform: translateY(-2px); border-color: var(--brand, #378add); }
.le-training-card.review { border-color: #f59e0b; background: color-mix(in srgb, #f59e0b 8%, var(--surface-soft)); }
.le-training-card.review:hover { border-color: #f59e0b; }
.le-training-card.review:disabled { opacity: .55; cursor: not-allowed; }
.le-training-icon { font-size: 24px; }
.le-training-name { font-size: 13px; font-weight: 600; color: var(--text-strong); }
.le-training-desc { font-size: 11px; color: var(--text-faint); text-align: center; }

/* ---------- 知识库图书入口 ---------- */
.le-book-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 8px; }
.le-book-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  padding: 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-soft);
  cursor: pointer; text-align: left; transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.le-book-card:hover { transform: translateY(-2px); border-color: #7c3aed; box-shadow: 0 6px 18px rgba(124,58,237,.08); }
.le-book-icon { font-size: 28px; }
.le-book-name { font-size: 15px; font-weight: 700; color: var(--text-strong); }
.le-book-desc { font-size: 12.5px; color: var(--text-muted); line-height: 1.6; }
.le-book-meta { font-size: 11px; color: #7c3aed; background: color-mix(in srgb, #7c3aed 10%, transparent); border-radius: 999px; padding: 2px 10px; margin-top: 4px; }
.le-book-progress { margin-top: auto; width: 100%; display: flex; align-items: center; gap: 8px; }
.le-book-progress::before { content: ''; flex: 1; height: 6px; border-radius: 999px; background: var(--border); }
.le-book-progress-bar { height: 6px; border-radius: 999px; background: #7c3aed; }
.le-book-progress span { font-size: 12px; color: var(--text-faint); }

/* ---------- 学习模块：继续学习与统计 ---------- */
.le-continue { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border: 1px solid #7c3aed; border-radius: 12px; background: color-mix(in srgb, #7c3aed 7%, var(--surface)); cursor: pointer; transition: transform .16s ease, box-shadow .16s ease; margin-bottom: 14px; }
.le-continue:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(124,58,237,.1); }
.le-continue-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1; }
.le-continue-tag { align-self: flex-start; font-size: 11px; color: #fff; background: #7c3aed; border-radius: 999px; padding: 2px 9px; }
.le-continue-title { font-size: 15px; font-weight: 700; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.le-continue-meta { font-size: 12px; color: #7c3aed; }
.le-continue-sum { font-size: 12.5px; color: var(--text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.le-continue-btn { flex-shrink: 0; font-size: 13px; font-weight: 600; color: #7c3aed; white-space: nowrap; }

.le-kb-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.le-kb-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-soft); }
.le-kb-stat b { font-size: 20px; color: var(--text-strong); }
.le-kb-stat span { font-size: 12px; color: var(--text-faint); }

/* ---------- 章列表 ---------- */
.le-chapter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-top: 8px; }
.le-chapter-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-soft);
  cursor: pointer; text-align: left; transition: transform .16s ease, border-color .16s ease;
}
.le-chapter-card:hover { transform: translateY(-2px); border-color: #7c3aed; }
.le-chapter-card.done { border-color: #16a34a; background: color-mix(in srgb, #16a34a 6%, var(--surface-soft)); }
.le-chapter-no { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 700; color: #fff; background: #7c3aed; }
.le-chapter-card.done .le-chapter-no { background: #16a34a; }
.le-chapter-title { font-size: 14px; font-weight: 700; color: var(--text-strong); }
.le-chapter-sum { font-size: 12px; color: var(--text-muted); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.le-chapter-meta { font-size: 11px; color: var(--text-faint); }
.le-chapter-progress { width: 100%; height: 5px; border-radius: 999px; background: var(--border); margin-top: auto; }
.le-chapter-progress-bar { height: 5px; border-radius: 999px; background: #7c3aed; }
.le-chapter-card.done .le-chapter-progress-bar { background: #16a34a; }

/* ---------- 课列表 ---------- */
.le-lesson-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 8px; }
.le-lesson-card { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-soft); transition: border-color .16s ease, box-shadow .16s ease; }
.le-lesson-card:hover { border-color: #7c3aed; box-shadow: 0 4px 12px rgba(124,58,237,.06); }
.le-lesson-card.done { border-color: #16a34a; background: color-mix(in srgb, #16a34a 5%, var(--surface-soft)); }
.le-lesson-card.doing { border-color: #0891b2; background: color-mix(in srgb, #0891b2 5%, var(--surface-soft)); }
.le-lesson-top { display: flex; align-items: center; gap: 8px; }
.le-lesson-no { width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; font-weight: 600; color: #fff; background: #7c3aed; flex-shrink: 0; }
.le-lesson-card.done .le-lesson-no { background: #16a34a; }
.le-lesson-tags { display: flex; flex-wrap: wrap; gap: 5px; flex: 1; }
.le-tag { font-size: 11px; color: #7c3aed; background: color-mix(in srgb, #7c3aed 10%, transparent); border-radius: 999px; padding: 2px 8px; }
.le-tag.time { color: #0891b2; background: color-mix(in srgb, #0891b2 10%, transparent); }
.le-lesson-title { font-size: 14px; font-weight: 700; color: var(--text-strong); line-height: 1.4; margin: 0; }
.le-lesson-sum { font-size: 12.5px; color: var(--text-muted); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin: 0; }
.le-lesson-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.le-lesson-body { border-top: 1px dashed var(--border); padding-top: 12px; margin-top: 4px; }

/* ---------- 薄弱点 ---------- */
.le-weak-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.le-weak-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft);
}
.le-weak-title { font-size: 12px; color: var(--text-faint); }
.le-weak-value { font-size: 15px; font-weight: 700; color: var(--text-strong); }

@media (max-width: 768px) {
  .le-training-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .le-weak-grid { grid-template-columns: 1fr; }
  .le-book-grid { grid-template-columns: 1fr; }
  .le-chapter-grid { grid-template-columns: 1fr; }
  .le-lesson-grid { grid-template-columns: 1fr; }
  .le-kb-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .le-continue { flex-direction: column; align-items: flex-start; }
}
@media (max-width: 460px) { .le-entries { grid-template-columns: 1fr; } }
</style>

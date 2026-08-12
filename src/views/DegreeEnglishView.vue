<template>
  <div class="degree-view">
    <!-- 顶部导航栏（PC端：与 AI/四六级模块风格完全一致） -->
    <nav class="de-topnav">
      <button class="de-nav-item" :class="{ active: topNav === 'today' }" @click="topNav = 'today'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>今日</span>
      </button>
      <button class="de-nav-item" :class="{ active: topNav === 'practice' }" @click="topNav = 'practice'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>刷题</span>
      </button>
      <button class="de-nav-item" :class="{ active: topNav === 'mistakes' }" @click="topNav = 'mistakes'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        <span>错本</span>
      </button>
      <button class="de-nav-item" :class="{ active: topNav === 'mine' }" @click="topNav = 'mine'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>我的</span>
      </button>
    </nav>

    <!-- 移动端底部导航（与顶部相同4项，≤768px显示） -->
    <nav class="de-bottom-nav">
      <button class="de-nav-item" :class="{ active: topNav === 'today' }" @click="topNav = 'today'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>今日</span>
      </button>
      <button class="de-nav-item" :class="{ active: topNav === 'practice' }" @click="topNav = 'practice'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>刷题</span>
      </button>
      <button class="de-nav-item" :class="{ active: topNav === 'mistakes' }" @click="topNav = 'mistakes'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        <span>错本</span>
      </button>
      <button class="de-nav-item" :class="{ active: topNav === 'mine' }" @click="topNav = 'mine'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>我的</span>
      </button>
    </nav>

    <!-- ===== 今日视图：原有全部内容（品牌头+统计+功能tab+各面板） ===== -->
    <template v-if="topNav === 'today'">
    <!-- 统一顶部：品牌头 + 统计 + 导航 tab（对齐 AI/CET 模块风格） -->
    <header class="degree-header">
      <div class="dh-brand">
        <span class="dh-icon">📚</span>
        <div class="dh-text">
          <h2 class="dh-title">学位英语备考台</h2>
          <p class="dh-sub">大纲 {{ MATERIALS[0]?.pages ?? 0 }}页 · 指南 {{ MATERIALS[1]?.pages ?? 0 }}页 · 模拟卷 {{ MATERIALS[2]?.pages ?? 0 }}页 · 目标：{{ settings.targetSchool || '商丘师范学院继续教育学院' }}</p>
        </div>
      </div>
      <div class="dh-actions">
        <el-button text :icon="Setting" @click="settingsVisible = true">设置</el-button>
        <el-button type="primary" round :icon="VideoPlay" @click="startStudy">开始学习</el-button>
      </div>
    </header>

    <!-- 统计行 -->
    <div class="dh-stats">
      <div class="dh-stat"><span class="dh-stat-label">今日新词</span><span class="dh-stat-val purple">{{ settings.newPerDay }}</span></div>
      <div class="dh-stat"><span class="dh-stat-label">连续学习</span><span class="dh-stat-val blue">{{ streakDays }}<small>天</small></span></div>
      <div class="dh-stat"><span class="dh-stat-label">词汇掌握</span><span class="dh-stat-val green">{{ graduatedCount }}<small>/{{ degreeWords.length || VOCAB_REQUIREMENT.receptive }}</small></span></div>
      <div class="dh-stat"><span class="dh-stat-label">题库总量</span><span class="dh-stat-val orange">{{ degreeQuestions.length }}</span></div>
    </div>

    <!-- 导航 tab（nav-item 圆角按钮风格，与系统其他模块统一） -->
    <nav class="dh-nav">
      <button v-for="t in tabs" :key="t.key" class="dh-nav-item" :class="{ active: activeTab === t.key }" @click="activeTab = t.key">
        {{ t.label }}
      </button>
    </nav>

    <!-- 概览（分步向导：逐步展示，非一次性全展开） -->
    <section v-show="activeTab === 'overview'" class="panel">
      <!-- 步骤指示器 -->
      <div class="step-indicator">
        <div
          v-for="(step, i) in OVERVIEW_STEPS"
          :key="i"
          class="step-dot"
          :class="{ active: overviewStep >= i, current: overviewStep === i }"
          @click="overviewStep = i"
        >
          <span class="step-num">{{ i + 1 }}</span>
          <span class="step-label">{{ step }}</span>
        </div>
      </div>

      <!-- 步骤 0：今日学习计划 -->
      <div v-if="overviewStep === 0" class="step-content">
        <div class="overview-top">
          <div class="plan-card">
            <div class="card-title">今日学习计划</div>
            <ul class="plan-list">
              <li>新学单词 <b>{{ settings.newPerDay }}</b> 个</li>
              <li>复习待巩固词 <b>{{ reviewCount }}</b> 个</li>
              <li>题型训练：<b>{{ EXAM_SECTIONS.find((s) => s.key === trainingType)?.name || '词汇和语法' }}</b></li>
              <li v-if="settings.examDate">距考试还有 <b>{{ daysToExam }}</b> 天</li>
            </ul>
            <el-button type="primary" round size="small" @click="startStudy">开始今日学习</el-button>
          </div>
          <div class="ring-card">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#eceaf8" stroke-width="12" />
              <circle
                cx="60" cy="60" r="50" fill="none" stroke="#534ab7" stroke-width="12" stroke-linecap="round"
                :stroke-dasharray="`${ringLen} 314`" transform="rotate(-90 60 60)"
              />
              <text x="60" y="66" text-anchor="middle" font-size="22" font-weight="600" fill="#3c3489">{{ masteryPercent }}%</text>
            </svg>
            <div class="ring-cap">总掌握进度</div>
          </div>
        </div>
        <div class="step-nav">
          <div></div>
          <el-button type="primary" @click="overviewStep = 1">下一步：查看五大题型 →</el-button>
        </div>
      </div>

      <!-- 步骤 1：五大题型 -->
      <div v-if="overviewStep === 1" class="step-content">
        <div class="card-title">五大题型（严格按大纲）</div>
        <div class="type-grid">
          <div
            v-for="s in EXAM_SECTIONS"
            :key="s.key"
            class="type-card"
            :style="{ borderTopColor: s.color }"
            :class="{ 'type-empty': questionCountByType(s.key) === 0 }"
            @click="questionCountByType(s.key) > 0 && goTraining(s.key)"
          >
            <div class="type-name" :style="{ color: s.color }">{{ s.name }}</div>
            <div class="type-meta">{{ s.count }}题 · {{ s.score }}分 · {{ s.minutes }}min</div>
            <div class="type-desc">{{ s.desc }}</div>
            <div v-if="questionCountByType(s.key) === 0" class="type-empty-badge">暂无题目</div>
          </div>
        </div>
        <div class="step-nav">
          <el-button @click="overviewStep = 0">← 上一步</el-button>
          <el-button type="primary" @click="overviewStep = 2">下一步：大纲规定详情 →</el-button>
        </div>
      </div>

      <!-- 步骤 2：词汇要求 & 语法项目 -->
      <div v-if="overviewStep === 2" class="step-content">
        <div class="card-title">词汇要求 &amp; 语法项目（大纲规定）</div>
        <div class="req-grid">
          <div class="req-card">
            <div class="req-h">词汇要求</div>
            <div class="req-row">领会式掌握：<b>{{ VOCAB_REQUIREMENT.receptive }}</b> 词 + {{ VOCAB_REQUIREMENT.receptivePhrase }} 词组</div>
            <div class="req-row">复用式掌握：<b>{{ VOCAB_REQUIREMENT.productive }}</b> 词 + {{ VOCAB_REQUIREMENT.productivePhrase }} 词组（大纲带 <span class="star">*</span>）</div>
            <div class="req-row">另需掌握：{{ VOCAB_REQUIREMENT.affix }}</div>
          </div>
          <div class="req-card">
            <div class="req-h">语法项目（{{ GRAMMAR_ITEMS.length }} 项）</div>
            <div v-for="(g, i) in GRAMMAR_ITEMS" :key="i" class="grammar-item">{{ i + 1 }}. {{ g }}</div>
          </div>
        </div>
        <div class="step-nav">
          <el-button @click="overviewStep = 1">← 上一步</el-button>
          <div></div>
        </div>
      </div>
    </section>

    <!-- 单词本 -->
    <section v-show="activeTab === 'words'" class="panel">
      <div class="toolbar">
        <el-input v-model="wordQuery" placeholder="搜索单词 / 释义" clearable style="max-width: 320px" />
        <el-radio-group v-model="wordSrc" size="small">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="考试大纲">大纲</el-radio-button>
          <el-radio-button value="复习指南">指南</el-radio-button>
          <el-radio-button value="模拟试卷">模拟</el-radio-button>
        </el-radio-group>
        <el-tag v-if="degreeWords.length" type="info" effect="plain">共 {{ filteredWords.length }} 词</el-tag>
        <el-tag v-else type="warning" effect="plain">OCR 生成中，稍候自动填充</el-tag>
      </div>
      <div v-if="filteredWords.length" class="word-list">
        <div v-for="w in visibleWords" :key="w.word" class="word-item" :class="{ weak: wordProgress[w.word]?.weak }">
          <div class="word-main">
            <span class="word-text">{{ w.word }}<span v-if="w.productive" class="star">*</span></span>
            <button class="speak-btn" :title="'朗读 ' + w.word" @click="speak(w.word)">🔊</button>
            <button class="speak-btn" :title="'查看例句 ' + w.word" @click="loadExample(w.word)" :disabled="exampleLoading[w.word]">📖</button>
          </div>
          <div class="word-def">{{ w.definition }}</div>
          <div class="word-example" v-if="examples[w.word]">
            <span class="ex-label">例句</span> {{ examples[w.word] }}
            <button class="trans-btn" @click="translateExample(w.word)" :disabled="translating[w.word]">
              {{ translations[w.word] ? '已翻译' : '翻译' }}
            </button>
            <div class="word-translation" v-if="translations[w.word]">📝 {{ translations[w.word] }}</div>
          </div>
          <div class="word-src">
            <el-tag v-for="b in (w.sourceBooks || [])" :key="b" size="small" :type="srcTagType(b)" effect="plain">{{ b }}</el-tag>
          </div>
          <div class="word-ops">
            <el-button size="small" @click="cycleWord(w.word)">
              {{ wordProgress[w.word]?.status === 'graduated' ? '已掌握' : wordProgress[w.word]?.status === 'learning' ? '学习中' : '标记学习' }}
            </el-button>
            <el-button size="small" text type="primary" @click="addWordBook(w)">加入生词本</el-button>
          </div>
        </div>
      </div>
      <div class="load-more" v-if="filteredWords.length > wordLimit">
        <el-button @click="wordLimit = filteredWords.length">显示全部 {{ filteredWords.length }} 词</el-button>
      </div>
      <el-empty v-else description="词汇表正在由《考试大纲》OCR 提取，完成后这里会显示全部 4400+ 词，并标注复用式（*）" />
    </section>

    <!-- 背单词闪卡（学位英语专属：逐个展示） -->
    <section v-show="activeTab === 'cards'" class="panel">
      <div v-if="!cardStarted" class="card-start-screen">
        <div class="card-start-icon">📚</div>
        <h3 style="margin: 0 0 8px">学位英语背单词</h3>
        <p style="color: var(--text-muted); margin: 0 0 16px; font-size: 13.5px">
          共 <b>{{ filteredWords.length }}</b> 词 · 今日新学 {{ settings.newPerDay }} · 待复习 {{ reviewCount }}
        </p>
        <el-button type="primary" size="large" round :icon="VideoPlay" @click="startCardMode">
          开始背单词
        </el-button>
      </div>

      <template v-else>
        <!-- 闪卡进度条 -->
        <div class="flashcard-progress">
          <span class="flashcard-pos">{{ cardIndex + 1 }} / {{ filteredWords.length }}</span>
          <div class="flashcard-bar"><div class="flashcard-fill" :style="{ width: cardPercent + '%' }"></div></div>
          <button class="flashcard-exit" @click="exitCardMode" title="退出背词">✕</button>
        </div>

        <!-- 单张闪卡 -->
        <div v-if="currentCardWord" class="flashcard" :class="{ flipped: cardFlipped }" @click="cardFlipped = !cardFlipped">
          <div class="flashcard-inner">
            <!-- 正面：单词 -->
            <div class="flashcard-front">
              <div class="fc-word-row">
                <span class="fc-word">{{ currentCardWord.word }}<span v-if="currentCardWord.productive" class="star">*</span></span>
                <button class="speak-btn fc-speak" @click.stop="speak(currentCardWord.word)" title="朗读">🔊</button>
              </div>
              <div v-if="currentCardWord.phonetic" class="fc-phonetic">{{ currentCardWord.phonetic }}</div>
              <div class="fc-hint">点击翻转查看释义</div>
            </div>
            <!-- 背面：释义+例句 -->
            <div class="flashcard-back">
              <div class="fc-def">{{ currentCardWord.definition }}</div>
              <div class="fc-src" v-if="currentCardWord.sourceBooks?.length">
                <el-tag v-for="b in currentCardWord.sourceBooks" :key="b" size="small" :type="srcTagType(b)" effect="plain">{{ b }}</el-tag>
              </div>
              <div class="fc-example" v-if="examples[currentCardWord.word]">
                <span class="ex-label">例句</span> {{ examples[currentCardWord.word] }}
                <button class="trans-btn" @click.stop="translateExample(currentCardWord.word)" :disabled="translating[currentCardWord.word]">
                  {{ translations[currentCardWord.word] ? '已翻译' : '翻译' }}
                </button>
                <div class="fc-translation" v-if="translations[currentCardWord.word]">📝 {{ translations[currentCardWord.word] }}</div>
              </div>
              <button class="fc-load-ex" v-if="!examples[currentCardWord.word] && !exampleLoading[currentCardWord.word]" @click.stop="loadExample(currentCardWord.word)">📖 加载例句</button>
            </div>
          </div>
        </div>

        <!-- 操作栏 -->
        <div class="flashcard-ops">
          <button class="fc-nav-btn" :disabled="cardIndex <= 0" @click="prevCard">← 上一个</button>
          <div class="fc-actions">
            <el-button size="small" type="success" @click="cycleWord(currentCardWord!.word); nextCard()">掌握 ✓</el-button>
            <el-button size="small" type="warning" @click="addWordBook(currentCardWord!)">生词本</el-button>
            <el-button size="small" @click="nextCard()">跳过 →</el-button>
          </div>
          <button class="fc-nav-btn" :disabled="cardIndex >= filteredWords.length - 1" @click="nextCard">下一个 →</button>
        </div>

        <!-- 快捷键提示 -->
        <div class="fc-shortcuts" v-if="!isMobileDevice">← → 翻页 · 空格 翻转 · ✓ 掌握并下一张</div>
      </template>
    </section>

    <!-- 词组 / 语句 -->
    <section v-show="activeTab === 'phrases'" class="panel">
      <div class="toolbar">
        <el-radio-group v-model="phraseCat">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="phrase">词组表</el-radio-button>
          <el-radio-button value="spoken">口语表达</el-radio-button>
          <el-radio-button value="affix">常用词缀</el-radio-button>
          <el-radio-button value="irregular">不规则动词</el-radio-button>
        </el-radio-group>
        <el-input v-model="phraseQuery" placeholder="搜索英文 / 中文" clearable style="max-width: 300px" />
        <el-tag type="info" effect="plain">共 {{ filteredPhrases.length }} 条</el-tag>
      </div>
      <div v-if="filteredPhrases.length" class="phrase-list">
        <div v-for="p in filteredPhrases" :key="p.id" class="phrase-item" :class="p.category">
          <div class="phrase-top">
            <span class="phrase-en">{{ p.en }}<span v-if="p.productive" class="star">*</span></span>
            <span class="phrase-cat">{{ catLabel(p.category) }}</span>
          </div>
          <div class="phrase-zh" v-if="p.zh">{{ p.zh }}</div>
          <div class="phrase-extra" v-if="p.extra">
            {{ p.category === 'irregular' ? '过去式 / 过去分词：' : p.category === 'affix' ? '例词：' : '' }}{{ p.extra }}
          </div>
        </div>
      </div>
      <el-empty v-else description="词组 / 语句数据正在由《考试大纲》OCR 提取" />
    </section>

    <!-- 题型训练 -->
    <section v-show="activeTab === 'training'" class="panel">
      <div class="toolbar">
        <el-radio-group v-model="trainingType" @change="pickQuestion">
          <el-radio-button v-for="s in EXAM_SECTIONS" :key="s.key" :value="s.key">{{ s.name }}</el-radio-button>
        </el-radio-group>
        <el-tag type="info" effect="plain">{{ questionsOfType.length }} 题</el-tag>
      </div>

      <div v-if="currentQ" class="quiz-card">
        <div class="quiz-stem">{{ currentQ.stem }}</div>
        <div v-if="currentQ.passage" class="quiz-passage">{{ currentQ.passage }}</div>
        <div v-if="currentQ.options" class="quiz-options">
          <label v-for="(o, i) in currentQ.options" :key="i" class="opt" :class="{ right: showAnswer && isRight(o), wrong: showAnswer && myAnswer === o && !isRight(o) }">
            <input type="radio" :name="'q'" :value="o" v-model="myAnswer" :disabled="showAnswer" />
            <span>{{ String.fromCharCode(65 + i) }}. {{ o }}</span>
          </label>
        </div>
        <div class="quiz-actions">
          <el-button v-if="!showAnswer" type="primary" @click="revealAnswer">提交 / 看答案</el-button>
          <el-button v-else @click="nextQuestion">下一题</el-button>
          <el-button v-if="showAnswer" text type="danger" @click="markMistake(currentQ)">错题收藏</el-button>
        </div>
        <div v-if="showAnswer" class="quiz-explain">
          <div class="ex-h">答案：<b>{{ currentQ.answer }}</b></div>
          <div class="ex-b">解析：{{ currentQ.explanation }}</div>
          <div class="ex-src">来源：{{ currentQ.source.basis }}（{{ currentQ.source.book }} 第 {{ currentQ.source.page }} 页）</div>
        </div>
      </div>
      <el-empty v-else :description="`《${trainingTypeLabel}》题库正在由 PDF 原题 + 大纲生成，完成后即可逐题练习并看解析`" />
    </section>

    <!-- 模拟考试 -->
    <section v-show="activeTab === 'mock'" class="panel">
      <div class="card-title" style="margin-bottom: 10px">全真模拟考试（5 套，计时交卷 + 判分）</div>
      <div class="paper-grid">
        <div v-for="p in MOCK_PAPERS" :key="p.id" class="paper-card">
          <div class="paper-no">第 {{ p.no }} 套</div>
          <div class="paper-title">{{ p.title }}</div>
          <div class="paper-note">{{ p.note }}</div>
          <div class="paper-meta">满分 100 · 120 分钟 · 52 题</div>
          <el-button type="primary" plain size="small" round @click="startMock(p)">开始模考</el-button>
        </div>
      </div>
      <el-alert
        v-if="!degreeQuestions.length"
        type="info"
        :closable="false"
        style="margin-top: 12px"
        title="模拟卷原题题库正在由《全真模拟试卷及考点点睛》OCR 生成，完成后可直接在线计时模考、交卷判分与薄弱项分析。"
      />
    </section>

    <!-- 资料库 -->
    <section v-show="activeTab === 'library'" class="panel">
      <div class="card-title" style="margin-bottom: 10px">资料库（三本 PDF 内容已全量内置，可在线阅读讲解正文）</div>
      <div class="lib-layout">
        <div class="lib-side">
          <el-radio-group v-model="libBook" size="small" class="lib-filter">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="考试大纲">大纲</el-radio-button>
            <el-radio-button value="复习指南">指南</el-radio-button>
          </el-radio-group>
          <div class="lib-list">
            <div v-for="a in libraryArticles" :key="a.id" class="lib-item" :class="{ active: activeArticle?.id === a.id }" @click="openArticle(a)">
              <span class="lib-book">{{ a.book === '复习指南' ? '指南' : '大纲' }}</span>
              <span class="lib-title">{{ a.title }}</span>
            </div>
          </div>
        </div>
        <div class="lib-reader">
          <template v-if="activeArticle">
            <div class="reader-head">
              <span class="reader-book">{{ activeArticle.book }}</span>
              <h3 class="reader-title">{{ activeArticle.title }}</h3>
              <el-button size="small" text :icon="Reading" @click="speakText(activeArticle.content)">朗读全文</el-button>
            </div>
            <div class="reader-body">{{ activeArticle.content }}</div>
          </template>
          <el-empty v-else description="从左侧选择一篇讲解开始阅读" :image-size="70" />
        </div>
      </div>
      <div class="card-title" style="margin: 16px 0 10px">原文件（点开看扫描件）</div>
      <div class="material-grid">
        <div v-for="m in MATERIALS" :key="m.id" class="material-card">
          <div class="material-title">{{ m.title }}</div>
          <div class="material-meta">{{ m.pages }} 页 · {{ m.remark }}</div>
          <div class="material-ops">
            <el-button size="small" type="primary" :icon="Picture" @click="openPreview(m)">预览</el-button>
            <el-button size="small" text @click="addMaterialNote(m.title)">记笔记</el-button>
          </div>
        </div>
      </div>
    </section>

    <!-- 读写中心 -->
    <section v-show="activeTab === 'rw'" class="panel">
      <div class="rw-grid">
        <div class="rw-col">
          <div class="card-title">学习笔记 <el-button size="small" text type="primary" @click="addNote()">＋写笔记</el-button></div>
          <div v-if="notes.length" class="note-list">
            <div v-for="n in notes" :key="n.id" class="note-item">
              <div class="note-body">{{ n.content }}</div>
              <el-button size="small" text type="danger" @click="removeFav(n.id)">删除</el-button>
            </div>
          </div>
          <el-empty v-else description="写下你的学习笔记、好句摘抄" :image-size="60" />
        </div>
        <div class="rw-col">
          <div class="card-title">错题本（可重练）</div>
          <div v-if="mistakes.length" class="note-list">
            <div v-for="m in mistakes" :key="m.id" class="note-item">
              <div class="note-body">{{ m.reason || '错题' }} <span class="muted">（{{ typeLabel(m.type) }}）</span></div>
              <el-button size="small" text type="primary" @click="removeFav(m.id, true)">移除</el-button>
            </div>
          </div>
          <el-empty v-else description="做错的题会自动归集到这里" :image-size="60" />
        </div>
        <div class="rw-col">
          <div class="card-title">生词本</div>
          <div v-if="wordBook.length" class="note-list">
            <div v-for="w in wordBook" :key="w.id" class="note-item">
              <div class="note-body">{{ w.content }}</div>
              <el-button size="small" text type="danger" @click="removeFav(w.id)">删除</el-button>
            </div>
          </div>
          <el-empty v-else description="单词本里「加入生词本」的词会在这里" :image-size="60" />
        </div>
      </div>
    </section>
    </template><!-- /end 今日视图 -->

    <!-- ===== 刷题视图：直接进入题型训练 ===== -->
    <section v-if="topNav === 'practice'" class="panel">
      <div class="card-title" style="margin-bottom: 10px">题型训练</div>
      <div class="toolbar">
        <el-radio-group v-model="trainingType" @change="pickQuestion">
          <el-radio-button v-for="s in EXAM_SECTIONS" :key="s.key" :value="s.key">{{ s.name }}</el-radio-button>
        </el-radio-group>
        <el-tag type="info" effect="plain">{{ questionsOfType.length }} 题</el-tag>
        <el-button type="primary" size="small" @click="topNav = 'today'; activeTab = 'training'">完整模式</el-button>
      </div>

      <div v-if="currentQ" class="quiz-card">
        <div class="quiz-stem">{{ currentQ.stem }}</div>
        <div v-if="currentQ.passage" class="quiz-passage">{{ currentQ.passage }}</div>
        <div v-if="currentQ.options" class="quiz-options">
          <label v-for="(o, i) in currentQ.options" :key="i" class="opt" :class="{ right: showAnswer && isRight(o), wrong: showAnswer && myAnswer === o && !isRight(o) }">
            <input type="radio" :name="'qp'" :value="o" v-model="myAnswer" :disabled="showAnswer" />
            <span>{{ String.fromCharCode(65 + i) }}. {{ o }}</span>
          </label>
        </div>
        <div class="quiz-actions">
          <el-button v-if="!showAnswer" type="primary" @click="revealAnswer">提交 / 看答案</el-button>
          <el-button v-else @click="nextQuestion">下一题</el-button>
          <el-button v-if="showAnswer" text type="danger" @click="markMistake(currentQ)">错题收藏</el-button>
        </div>
        <div v-if="showAnswer" class="quiz-explain">
          <div class="ex-h">答案：<b>{{ currentQ.answer }}</b></div>
          <div class="ex-b">解析：{{ currentQ.explanation }}</div>
          <div class="ex-src">来源：{{ currentQ.source.basis }}（{{ currentQ.source.book }} 第 {{ currentQ.source.page }} 页）</div>
        </div>
      </div>
      <el-empty v-else description="题库正在由 PDF 原题 + 大纲生成，完成后即可逐题练习" />
    </section>

    <!-- ===== 错本视图：错题集中营 ===== -->
    <section v-if="topNav === 'mistakes'" class="panel">
      <div class="card-title" style="margin-bottom: 10px">错题本 <el-tag size="small" :type="mistakes.length ? 'danger' : 'info'">{{ mistakes.length }} 题</el-tag></div>
      <div v-if="mistakes.length" class="note-list">
        <div v-for="m in mistakes" :key="m.id" class="note-item">
          <div class="note-body">{{ m.reason || '错题' }} <span class="muted">（{{ typeLabel(m.type) }}）</span></div>
          <div class="note-ops-inline">
            <el-button size="small" text type="primary" @click="retryMistake(m)">重练</el-button>
            <el-button size="small" text type="danger" @click="removeFav(m.id, true)">移除</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="做错的题会自动归集到这里，目前还没有错题哦 🎉" :image-size="80" />

      <div class="card-title" style="margin: 20px 0 10px">生词本 <el-tag size="small" :type="wordBook.length ? 'warning' : 'info'">{{ wordBook.length }} 词</el-tag></div>
      <div v-if="wordBook.length" class="note-list">
        <div v-for="w in wordBook" :key="w.id" class="note-item">
          <div class="note-body">{{ w.content }}</div>
          <el-button size="small" text type="danger" @click="removeFav(w.id)">删除</el-button>
        </div>
      </div>
      <el-empty v-else description="点击「加入生词本」收藏生词" :image-size="60" />
    </section>

    <!-- ===== 我的视图：学习统计 + 设置入口 ===== -->
    <section v-if="topNav === 'mine'" class="panel">
      <div class="mine-header">
        <div class="mine-avatar">🎓</div>
        <div class="mine-info">
          <h3 class="mine-name">{{ settings.targetSchool || '学位英语备考' }}</h3>
          <p class="mine-desc">已坚持学习 <b>{{ streakDays }}</b> 天 · 目标每日新学 <b>{{ settings.newPerDay }}</b> 词</p>
        </div>
      </div>

      <div class="mine-stats">
        <div class="mine-stat-card">
          <div class="mine-stat-num purple">{{ graduatedCount }}</div>
          <div class="mine-stat-label">已掌握单词</div>
        </div>
        <div class="mine-stat-card">
          <div class="mine-stat-num blue">{{ reviewCount }}</div>
          <div class="mine-stat-label">待巩固</div>
        </div>
        <div class="mine-stat-card">
          <div class="mine-stat-num green">{{ degreeWords.length }}</div>
          <div class="mine-stat-label">总词汇量</div>
        </div>
        <div class="mine-stat-card">
          <div class="mine-stat-num orange">{{ degreeQuestions.length }}</div>
          <div class="mine-stat-label">题库总量</div>
        </div>
      </div>

      <div class="mine-progress">
        <div class="card-title">总掌握进度</div>
        <div class="mine-ring-row">
          <svg width="140" height="140" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#eceaf8" stroke-width="12" />
            <circle cx="60" cy="60" r="50" fill="none" stroke="#534ab7" stroke-width="12" stroke-linecap="round"
              :stroke-dasharray="`${ringLen} 314`" transform="rotate(-90 60 60)" />
            <text x="60" y="66" text-anchor="middle" font-size="24" font-weight="700" fill="#3c3489">{{ masteryPercent }}%</text>
          </svg>
          <div class="mine-ring-info">
            <p>领会式词汇 <b>{{ VOCAB_REQUIREMENT.receptive }}</b> 词</p>
            <p>复用式词汇 <b>{{ VOCAB_REQUIREMENT.productive }}</b> 词（带 *）</p>
            <p>已掌握 <b>{{ graduatedCount }}</b> / {{ degreeWords.length || VOCAB_REQUIREMENT.receptive }}</p>
          </div>
        </div>
      </div>

      <div class="mine-actions">
        <el-button type="primary" round :icon="Setting" @click="settingsVisible = true">备考设置</el-button>
        <el-button round @click="topNav = 'today'">返回今日</el-button>
      </div>
    </section>

    <!-- PDF 预览（全局弹窗，不受 topNav 影响） -->
    <el-dialog v-model="previewVisible" :title="previewTitle" width="90%" top="5vh" class="pdf-dialog">
      <iframe :src="previewUrl" class="pdf-frame" />
    </el-dialog>

    <!-- 设置 -->
    <el-dialog v-model="settingsVisible" title="备考设置" width="420px">
      <el-form label-width="92px">
        <el-form-item label="目标院校">
          <el-input v-model="settings.targetSchool" placeholder="如 商丘师范学院继续教育学院" />
        </el-form-item>
        <el-form-item label="考试日期">
          <el-date-picker v-model="settings.examDate" type="date" value-format="YYYY-MM-DD" placeholder="选择考试日" style="width: 100%" />
        </el-form-item>
        <el-form-item label="每日新词">
          <el-input-number v-model="settings.newPerDay" :min="1" :max="50" />
        </el-form-item>
        <el-form-item label="连续天数">
          <el-input-number v-model="manualStreakInput" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settingsVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>

    <!-- 写笔记 -->
    <el-dialog v-model="noteVisible" title="学习笔记" width="460px">
      <el-input v-model="noteTitleInput" placeholder="标题（可选）" style="margin-bottom: 10px" />
      <el-input v-model="noteInput" type="textarea" :rows="5" placeholder="写下你的笔记、好句、心得……" />
      <template #footer>
        <el-button @click="noteVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNote">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Reading, Setting, VideoPlay, Picture } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import {
  EXAM_SECTIONS,
  VOCAB_REQUIREMENT,
  GRAMMAR_ITEMS,
  MATERIALS,
  MOCK_PAPERS,
  type MaterialMeta
} from '../prep/degreeExamStructure'
import { degreeWords } from '../prep/degreeWords'
import { degreeQuestions } from '../prep/degreeQuestions'
import { degreePhrases } from '../prep/degreePhrases'
import { guideArticles } from '../prep/degreeGuide'
import { syllabusProse } from '../prep/degreeSyllabusProse'
import type { DegreeSettings, WordProgress, MistakeRec, FavoriteRec, QuestionType, DegreeQuestion, DegreePhrase, PhraseCategory, SourceBook, DegreeArticle } from '../prep/degreeTypes'
import * as svc from '../prep/degreeService'

// 资料库：三本 PDF 正文切分后的可读文章（确保内容不遗漏）
const allArticles: DegreeArticle[] = [...syllabusProse, ...guideArticles]
const libBook = ref<'all' | string>('all')
const activeArticle = ref<DegreeArticle | null>(null)
const libraryArticles = computed(() =>
  libBook.value === 'all' ? allArticles : allArticles.filter((a) => a.book === libBook.value)
)
function openArticle(a: DegreeArticle) {
  activeArticle.value = a
}
function speakText(t: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(t)
  u.lang = 'en-US'
  u.rate = 0.95
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

const base = import.meta.env.BASE_URL

const tabs = [
  { key: 'overview', label: '概览' },
  { key: 'words', label: '单词本' },
  { key: 'cards', label: '背单词卡' },
  { key: 'phrases', label: '词组/语句' },
  { key: 'training', label: '题型训练' },
  { key: 'mock', label: '模拟考试' },
  { key: 'library', label: '资料库' },
  { key: 'rw', label: '读写中心' }
]
const activeTab = ref('overview')

// 顶部导航（与 AI/四六级模块一致：今日/刷题/错本/我的）
const topNav = ref<'today' | 'practice' | 'mistakes' | 'mine'>('today')

// 概览分步向导
const OVERVIEW_STEPS = ['今日学习计划', '五大题型', '大纲规定'] as const
const overviewStep = ref(0)

// 按题型统计题数（用于空状态标注）
function questionCountByType(type: string): number {
  return degreeQuestions.filter((q) => q.type === type).length
}

const settings = ref<DegreeSettings>({ targetSchool: '商丘师范学院继续教育学院', examDate: null, newPerDay: 15, manualStreak: null })
const manualStreakInput = ref(0)
const wordProgress = ref<Record<string, WordProgress>>({})
const mistakes = ref<MistakeRec[]>([])
const notes = ref<FavoriteRec[]>([])
const wordBook = ref<FavoriteRec[]>([])

const wordQuery = ref('')
const wordSrc = ref<'all' | SourceBook>('all')
const wordLimit = ref(300)
const filteredWords = computed(() => {
  const q = wordQuery.value.trim().toLowerCase()
  return degreeWords.filter((w) => {
    if (wordSrc.value !== 'all' && !(w.sourceBooks || []).includes(wordSrc.value)) return false
    if (!q) return true
    return w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q)
  })
})
const visibleWords = computed(() => filteredWords.value.slice(0, wordLimit.value))

// 单词读音（浏览器内置 TTS，离线可用） + 例句（免费词典 API，按需加载并缓存）
const examples = ref<Record<string, string>>({})
const exampleLoading = ref<Record<string, boolean>>({})
// 例句中文翻译（MyMemory 免费 API，无需 Key）
const translations = ref<Record<string, string>>({})
const translating = ref<Record<string, boolean>>({})
function srcTagType(b: SourceBook): 'success' | 'warning' | 'info' {
  if (b === '考试大纲') return 'success'
  if (b === '复习指南') return 'warning'
  return 'info'
}
function speak(word: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}
async function loadExample(word: string) {
  if (examples.value[word] || exampleLoading.value[word]) return
  exampleLoading.value = { ...exampleLoading.value, [word]: true }
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    if (res.ok) {
      const data = await res.json()
      const arr = Array.isArray(data) ? data : [data]
      let found = ''
      for (const entry of arr) {
        for (const m of entry.meanings || []) {
          for (const d of m.definitions || []) {
            if (d.example) { found = d.example; break }
          }
          if (found) break
        }
        if (found) break
      }
      examples.value = { ...examples.value, [word]: found || `（暂无例句）Please memorize "${word}".` }
    } else {
      examples.value = { ...examples.value, [word]: `Please memorize "${word}".` }
    }
  } catch {
    examples.value = { ...examples.value, [word]: `Please memorize "${word}".` }
  } finally {
    exampleLoading.value = { ...exampleLoading.value, [word]: false }
  }
}

async function translateExample(word: string) {
  if (!examples.value[word] || translations.value[word] || translating.value[word]) return
  translating.value = { ...translating.value, [word]: true }
  try {
    const text = examples.value[word]
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`)
    if (res.ok) {
      const data = await res.json()
      const zh = data?.responseData?.translatedText
      if (zh && zh !== text) {
        translations.value = { ...translations.value, [word]: zh }
      } else {
        translations.value = { ...translations.value, [word]: '（翻译暂不可用）' }
      }
    } else {
      translations.value = { ...translations.value, [word]: '（翻译服务暂时不可用）' }
    }
  } catch {
    translations.value = { ...translations.value, [word]: '（网络异常，翻译失败）' }
  } finally {
    translating.value = { ...translating.value, [word]: false }
  }
}

// 词组 / 语句
const phraseCat = ref<'all' | PhraseCategory>('all')
const phraseQuery = ref('')
const CAT_LABEL: Record<PhraseCategory, string> = {
  phrase: '词组',
  spoken: '口语',
  affix: '词缀',
  irregular: '不规则动词'
}
function catLabel(c: PhraseCategory) {
  return CAT_LABEL[c]
}
const filteredPhrases = computed(() => {
  const q = phraseQuery.value.trim().toLowerCase()
  const list = degreePhrases.filter((p) => {
    if (phraseCat.value !== 'all' && p.category !== phraseCat.value) return false
    if (!q) return true
    return (
      p.en.toLowerCase().includes(q) ||
      (p.zh || '').toLowerCase().includes(q) ||
      (p.extra || '').toLowerCase().includes(q)
    )
  })
  return list.slice(0, 300)
})

const graduatedCount = computed(() => Object.values(wordProgress.value).filter((p) => p.status === 'graduated').length)
const reviewCount = computed(() => Object.values(wordProgress.value).filter((p) => p.status === 'learning' || p.weak).length)
const masteryPercent = computed(() => {
  const total = degreeWords.length || VOCAB_REQUIREMENT.receptive
  return Math.round((graduatedCount.value / total) * 100)
})
const ringLen = computed(() => (masteryPercent.value / 100) * 314)
const streakDays = computed(() => settings.value.manualStreak ?? 0)
const daysToExam = computed(() => {
  if (!settings.value.examDate) return null
  const d = new Date(settings.value.examDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(d / 86400000))
})

const trainingType = ref<QuestionType>('vocab_grammar')
const trainingTypeLabel = computed(() => EXAM_SECTIONS.find((s) => s.key === trainingType.value)?.name || '')
const questionsOfType = computed(() => degreeQuestions.filter((q) => q.type === trainingType.value))
const currentQ = ref<DegreeQuestion | null>(null)
const showAnswer = ref(false)
const myAnswer = ref('')

const previewVisible = ref(false)
const previewUrl = ref('')
const previewTitle = ref('')
const settingsVisible = ref(false)
const noteVisible = ref(false)
const noteInput = ref('')
const noteTitleInput = ref('')

function typeLabel(t?: QuestionType | null) {
  return EXAM_SECTIONS.find((s) => s.key === t)?.name || '通用'
}

async function loadAll() {
  settings.value = await svc.loadDegreeSettings()
  manualStreakInput.value = settings.value.manualStreak ?? 0
  wordProgress.value = await svc.loadWordProgress()
  mistakes.value = await svc.loadMistakes()
  notes.value = await svc.loadFavorites('note')
  wordBook.value = await svc.loadFavorites('word')
}

function startStudy() {
  activeTab.value = 'cards'
}

// ===== 闪卡模式（逐个背单词） =====
const cardStarted = ref(false)
const cardIndex = ref(0)
const cardFlipped = ref(false)
const isMobileDevice = ref(typeof window !== 'undefined' && window.innerWidth <= 768)

const currentCardWord = computed(() => filteredWords.value[cardIndex.value] ?? null)
const cardPercent = computed(() => {
  const total = Math.max(filteredWords.value.length, 1)
  return Math.round(((cardIndex.value + 1) / total) * 100)
})

function startCardMode() {
  cardStarted.value = true
  cardIndex.value = 0
  cardFlipped.value = false
  // 自动加载当前词的例句
  if (currentCardWord.value && !examples.value[currentCardWord.value.word]) {
    loadExample(currentCardWord.value.word)
  }
}

function exitCardMode() {
  cardStarted.value = false
  cardFlipped.value = false
}

function nextCard() {
  if (cardIndex.value < filteredWords.value.length - 1) {
    cardIndex.value++
    cardFlipped.value = false
    const w = currentCardWord.value
    if (w && !examples.value[w.word]) loadExample(w.word)
  }
}

function prevCard() {
  if (cardIndex.value > 0) {
    cardIndex.value--
    cardFlipped.value = false
  }
}

// 键盘快捷键（PC端）
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!cardStarted.value) return
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextCard() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevCard() }
    else if (e.key === 'Enter') { e.preventDefault(); cardFlipped.value = !cardFlipped.value }
  })
}

function goTraining(key: QuestionType) {
  trainingType.value = key
  activeTab.value = 'training'
  pickQuestion()
}

function pickQuestion() {
  const list = questionsOfType.value
  if (list.length) {
    currentQ.value = list[Math.floor(Math.random() * list.length)] ?? null
    showAnswer.value = false
    myAnswer.value = ''
  } else {
    currentQ.value = null
  }
}
function revealAnswer() {
  showAnswer.value = true
  if (currentQ.value && myAnswer.value && myAnswer.value !== currentQ.value.answer) {
    svc.addMistake({ questionId: currentQ.value.id, type: currentQ.value.type, userAnswer: myAnswer.value, reason: `你的答案：${myAnswer.value}`, due: null })
  }
}
function isRight(o: string) {
  return currentQ.value?.answer === o
}
function nextQuestion() {
  pickQuestion()
}
async function markMistake(q: DegreeQuestion) {
  await svc.addMistake({ questionId: q.id, type: q.type, userAnswer: myAnswer.value || null, reason: q.explanation, due: null })
  mistakes.value = await svc.loadMistakes()
  ElMessage.success('已收入错题本')
}
async function retryMistake(m: MistakeRec) {
  // 找到原题并进入刷题模式
  const orig = degreeQuestions.find((q) => q.id === m.questionId)
  if (orig) {
    trainingType.value = m.type || 'vocab_grammar'
    currentQ.value = orig
    showAnswer.value = false
    myAnswer.value = ''
    topNav.value = 'practice'
  } else {
    ElMessage.warning('原题未找到，可能题库已更新')
  }
}

async function cycleWord(word: string) {
  const cur = wordProgress.value[word]?.status || 'new'
  const next = cur === 'new' ? 'learning' : cur === 'learning' ? 'graduated' : 'new'
  const p: WordProgress = { status: next, level: 0, due: null, weak: false }
  wordProgress.value = { ...wordProgress.value, [word]: p }
  await svc.saveWordProgress(word, p)
}
async function addWordBook(w: { word: string; definition: string }) {
  await svc.addFavorite('word', `${w.word} ${w.definition}`)
  wordBook.value = await svc.loadFavorites('word')
  ElMessage.success('已加入生词本')
}

function openPreview(m: MaterialMeta) {
  previewUrl.value = base + m.file
  previewTitle.value = m.title
  previewVisible.value = true
}
function startMock(p: { id: string; title: string }) {
  ElMessage.info(`「${p.title}」原题题库生成后即可在线计时模考`)
}

async function saveSettings() {
  settings.value.manualStreak = manualStreakInput.value
  await svc.saveDegreeSettings(settings.value)
  settingsVisible.value = false
  ElMessage.success('已保存')
}

function addNote(prefix = '') {
  noteTitleInput.value = prefix
  noteInput.value = ''
  noteVisible.value = true
}
function addMaterialNote(title: string) {
  noteTitleInput.value = title
  noteInput.value = ''
  noteVisible.value = true
}
async function saveNote() {
  if (!noteInput.value.trim()) {
    ElMessage.warning('笔记内容不能为空')
    return
  }
  await svc.addFavorite('note', noteInput.value, null, noteTitleInput.value || null)
  notes.value = await svc.loadFavorites('note')
  noteVisible.value = false
  ElMessage.success('笔记已保存')
}

async function removeFav(id: string, isMistake = false) {
  await svc.removeFavorite(id)
  if (isMistake) mistakes.value = await svc.loadMistakes()
  else {
    notes.value = await svc.loadFavorites('note')
    wordBook.value = await svc.loadFavorites('word')
  }
}

onMounted(loadAll)
</script>

<style scoped>
.degree-view {
  max-width: 1180px;
  margin: 0 auto;
  padding: 4px 4px calc(40px + env(safe-area-inset-bottom));
  /* 移动端为底部固定导航留空间，避免tab被遮挡无法点击 */
}

/* ===== 顶部导航栏（与 AI/四六级模块风格完全一致） ===== */
.de-topnav {
  display: flex;
  position: relative;
  z-index: 20;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e6e3f2);
  border-radius: 16px;
  box-shadow: 0 3px 10px rgba(34, 48, 78, 0.06);
  padding: 10px 12px;
  margin: 0 auto 14px;
  max-width: 1180px;
  width: calc(100% - 52px);
  gap: 6px;
  overflow-x: auto;
}
.de-nav-item {
  flex: 1 1 0;
  min-width: 72px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 14px;
  border-radius: 11px;
  background: transparent;
  color: #5B6A86;
  font-weight: 700;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.de-nav-item svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.de-nav-item:hover { background: #F4F3FB; color: #22304E; }
.de-nav-item.active {
  background: linear-gradient(135deg, #534ab7, #7c6fd6);
  color: #fff;
  box-shadow: 0 4px 12px rgba(83, 74, 183, 0.25);
}

/* 移动端底部导航（≤768px 显示，PC端隐藏） */
.de-bottom-nav {
  display: none;
}
/* ===== 统一顶部（对齐 AI/CET 模块风格）===== */
.degree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px 20px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}
.dh-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  width: 100%;
}
.dh-icon { font-size: 28px; flex-shrink: 0; }
.dh-text {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}
.dh-title {
  font-size: 18px; font-weight: 800; margin: 0; line-height: 1.3;
  color: var(--text-strong);
  word-break: keep-all;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dh-sub {
  font-size: 12.5px; color: var(--text-muted); margin: 2px 0 0; line-height: 1.4;
  word-break: break-all;
}
.dh-actions { display: flex; gap: 8px; flex-shrink: 0; }

.dh-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.dh-stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 14px;
  text-align: center;
}
.dh-stat-label {
  display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 4px;
}
.dh-stat-val {
  font-size: 22px; font-weight: 700;
}
.dh-stat-val.purple { color: #534ab7; }
.dh-stat-val.blue { color: #185fa5; }
.dh-stat-val.green { color: #0f6e56; }
.dh-stat-val.orange { color: #854f0b; }
.dh-stat-val small { font-size: 13px; font-weight: 400; }

/* 导航 tab（nav-item 圆角按钮风格，与系统其他模块统一） */
.dh-nav {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  margin-bottom: 16px;
  padding-bottom: 2px;
}
.dh-nav-item {
  flex: 1 1 0;
  min-width: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 11px;
  background: transparent;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 13px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.dh-nav-item:hover { background: var(--surface-2, #f5f5fa); color: var(--text-strong); }
.dh-nav-item.active {
  background: linear-gradient(135deg, #534ab7, #7c6fd6);
  color: #fff;
  box-shadow: 0 4px 12px rgba(83, 74, 183, 0.25);
}
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow-card);
  touch-action: pan-y;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}
/* 分步向导 */
.step-indicator {
  display: flex;
  gap: 0;
  margin-bottom: 18px;
}
.step-dot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: #f0eeff;
  color: #999;
  border: none;
  flex: 1;
  justify-content: center;
}
.step-dot.active { background: #e8e4ff; color: #534ab7; }
.step-dot.current { background: #534ab7; color: #fff; box-shadow: 0 2px 8px rgba(83,74,183,0.2); }
.step-num {
  width: 22px; height: 22px; border-radius: 50%; background: currentColor; color: #fff;
  display: inline-flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;
}
.step-dot.current .step-num { background: #fff; color: #534ab7; }
.step-label { white-space: nowrap; }

.step-content {
  animation: fadeIn 0.25s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.step-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

/* 空题型卡片 */
.type-empty { opacity: 0.65; pointer-events: none; }
.type-empty-badge {
  position: absolute; top: 8px; right: 8px;
  background: #f0c987; color: #7a500a; font-size: 11px; font-weight: 700;
  padding: 2px 8px; border-radius: 10px;
}
.overview-top {
  display: flex;
  gap: 16px;
  align-items: stretch;
  flex-wrap: wrap;
}
.plan-card {
  flex: 1 1 320px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: linear-gradient(180deg, #f6f5ff, #fff);
}
.plan-list {
  list-style: none;
  padding: 0;
  margin: 10px 0 14px;
  font-size: 14px;
  color: var(--text-strong);
  line-height: 2;
}
.ring-card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
}
.ring-cap {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 6px;
}
.type-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.type-card {
  border: 1px solid var(--border);
  border-top: 3px solid #534ab7;
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  background: #fff;
  transition: transform 0.12s;
}
.type-card:hover {
  transform: translateY(-2px);
}
.type-name {
  font-size: 14px;
  font-weight: 600;
}
.type-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin: 6px 0;
}
.type-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}
.req-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.req-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}
.req-h {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #534ab7;
}
.req-row {
  font-size: 13px;
  color: var(--text-strong);
  line-height: 1.9;
}
.grammar-item {
  font-size: 13px;
  color: var(--text-strong);
  line-height: 1.9;
}
.star {
  color: #993c1d;
  font-weight: 700;
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.word-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.word-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
}
.word-item.weak {
  border-color: #f09595;
  background: #fdf3f3;
}
.word-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.word-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-strong);
}
.word-phon {
  font-size: 12px;
  color: var(--text-muted);
}
.word-pos {
  font-size: 12px;
  color: #185fa5;
}
.word-def {
  font-size: 13px;
  color: var(--text-strong);
  margin: 6px 0 10px;
  line-height: 1.6;
}
.word-ops {
  display: flex;
  gap: 8px;
}
.speak-btn {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 8px;
  width: 30px;
  height: 30px;
  font-size: 15px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.speak-btn:hover {
  border-color: #534ab7;
  background: #f3f1ff;
}
.speak-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.word-example {
  font-size: 12.5px;
  color: var(--text-strong);
  background: #f7f8ff;
  border-left: 3px solid #c9c2ff;
  border-radius: 6px;
  padding: 6px 8px;
  margin: 6px 0 8px;
  line-height: 1.6;
}
.ex-label {
  color: #6b5bd6;
  font-weight: 600;
  margin-right: 4px;
}
.trans-btn {
  border: 1px solid #c9c2ff;
  background: #fff;
  border-radius: 10px;
  padding: 1px 10px;
  font-size: 11.5px;
  color: #6b5bd6;
  cursor: pointer;
  margin-left: 8px;
  transition: all 0.15s;
}
.trans-btn:hover:not(:disabled) {
  background: #edeaff;
  border-color: #9588e8;
}
.trans-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}
.word-translation {
  font-size: 12px;
  color: #2d7a4f;
  margin-top: 5px;
  padding: 4px 8px;
  background: #f0faf4;
  border-radius: 4px;
  line-height: 1.5;
}
.word-src {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.load-more {
  text-align: center;
  margin-top: 14px;
}

/* ===== 闪卡模式（逐个背单词） ===== */
.card-start-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}
.card-start-icon { font-size: 56px; margin-bottom: 16px; }

.flashcard-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.flashcard-pos {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}
.flashcard-bar {
  flex: 1;
  height: 6px;
  background: #edeaff;
  border-radius: 3px;
  overflow: hidden;
}
.flashcard-fill {
  height: 100%;
  background: linear-gradient(90deg, #534ab7, #7c6fd6);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.flashcard-exit {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 8px;
  width: 28px; height: 28px;
  font-size: 14px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.flashcard {
  perspective: 1000px;
  cursor: pointer;
  margin-bottom: 16px;
}
.flashcard-inner {
  position: relative;
  width: 100%;
  min-height: 260px;
  transition: transform 0.5s;
  transform-style: preserve-3d;
}
.flipped .flashcard-inner {
  transform: rotateY(180deg);
}
.flashcard-front, .flashcard-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  background: #fff;
  box-shadow: var(--shadow-card);
}
.flashcard-back {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, #faf8ff, #f3f0ff);
  justify-content: flex-start;
  overflow-y: auto;
}
.fc-word-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.fc-word {
  font-size: 28px;
  font-weight: 800;
  color: #3c3489;
  word-break: keep-all;
}
.fc-speak { width: 36px; height: 36px; font-size: 18px; }
.fc-phonetic {
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}
.fc-hint {
  margin-top: auto;
  padding-top: 20px;
  font-size: 12.5px;
  color: #aaa;
  text-align: center;
}
.fc-def {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-strong);
  line-height: 1.6;
  margin-bottom: 10px;
}
.fc-src { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.fc-example {
  font-size: 13px;
  color: var(--text-strong);
  background: #f7f8ff;
  border-left: 3px solid #c9c2ff;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;
  line-height: 1.6;
}
.fc-translation {
  font-size: 12px;
  color: #2d7a4f;
  margin-top: 5px;
  padding: 4px 8px;
  background: #f0faf4;
  border-radius: 4px;
}
.fc-load-ex {
  border: 1px solid #c9c2ff;
  background: #fff;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  color: #6b5bd6;
  cursor: pointer;
  margin-top: 8px;
  align-self: flex-start;
}

.flashcard-ops {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
}
.fc-nav-btn {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-strong);
  transition: all 0.15s;
  white-space: nowrap;
}
.fc-nav-btn:hover:not(:disabled) { background: #f5f5fa; border-color: #ccc; }
.fc-nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.fc-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.fc-shortcuts {
  text-align: center;
  font-size: 11.5px;
  color: #aaa;
  margin-top: 10px;
}

/* 背单词卡（学位英语专属） */
.card-banner {
  background: linear-gradient(135deg, #6b5bd6, #8a7be0);
  color: #fff;
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 14px;
}
.card-banner-title {
  font-size: 16px;
  font-weight: 700;
}
.card-banner-sub {
  font-size: 12.5px;
  opacity: 0.92;
  margin-top: 4px;
  line-height: 1.5;
}
.card-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.word-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff;
  display: flex;
  flex-direction: column;
  transition: all 0.15s;
}
.word-card:hover {
  border-color: #534ab7;
  box-shadow: 0 4px 14px rgba(83, 74, 183, 0.12);
}
.word-card.graduated {
  background: #f3fbf4;
  border-color: #c7e9cd;
}
.word-card.weak {
  border-color: #f0c987;
}
.wc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.wc-word {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
  word-break: break-word;
}
.wc-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.wc-def {
  font-size: 13.5px;
  color: var(--text-strong);
  margin: 8px 0 6px;
  line-height: 1.6;
}
.wc-example {
  font-size: 12.5px;
  color: var(--text-strong);
  background: #f7f8ff;
  border-left: 3px solid #c9c2ff;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
  line-height: 1.6;
}
.wc-translation {
  font-size: 12px;
  color: #2d7a4f;
  margin-top: 5px;
  padding: 4px 8px;
  background: #f0faf4;
  border-radius: 4px;
  line-height: 1.5;
}
.wc-src {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.wc-ops {
  display: flex;
  gap: 8px;
  margin-top: auto;
}
.quiz-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
}
.quiz-stem {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
}
.quiz-passage {
  font-size: 13px;
  color: var(--text-muted);
  background: #f7f7fb;
  border-radius: 8px;
  padding: 10px;
  margin: 10px 0;
  line-height: 1.7;
}
.quiz-options {
  display: grid;
  gap: 8px;
  margin: 12px 0;
}
.opt {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
}
.opt.right {
  border-color: #0f6e56;
  background: #eaf3de;
}
.opt.wrong {
  border-color: #a32d2d;
  background: #fcebeb;
}
.quiz-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.quiz-explain {
  margin-top: 14px;
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}
.ex-h {
  font-size: 14px;
}
.ex-b {
  font-size: 13px;
  color: var(--text-strong);
  line-height: 1.7;
  margin-top: 6px;
}
.ex-src {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}
.paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.paper-card {
  border: 1px solid var(--border);
  border-top: 3px solid #534ab7;
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.paper-no {
  font-size: 13px;
  color: var(--text-muted);
}
.paper-title {
  font-size: 15px;
  font-weight: 600;
  margin: 4px 0;
}
.paper-note {
  font-size: 12px;
  color: var(--text-muted);
}
.paper-meta {
  font-size: 12px;
  color: #185fa5;
  margin: 8px 0 10px;
}
.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.material-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
.material-title {
  font-size: 15px;
  font-weight: 600;
}
.material-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin: 8px 0 12px;
  line-height: 1.6;
}
.material-ops {
  display: flex;
  gap: 8px;
}
.lib-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  min-height: 420px;
}
.lib-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-right: 1px solid var(--border);
  padding-right: 12px;
}
.lib-filter {
  flex-wrap: wrap;
}
.lib-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  max-height: 560px;
}
.lib-item {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.5;
}
.lib-item:hover {
  background: #f3f1ff;
}
.lib-item.active {
  background: #ece8ff;
  font-weight: 600;
}
.lib-book {
  flex: none;
  font-size: 11px;
  color: #6b5bd6;
  background: #efeaff;
  border-radius: 4px;
  padding: 0 5px;
}
.lib-title {
  color: var(--text-strong);
}
.lib-reader {
  overflow-y: auto;
  max-height: 600px;
  padding: 4px 8px;
}
.reader-head {
  display: flex;
  align-items: center;
  gap: 10px;
  position: sticky;
  top: 0;
  background: var(--bg, #fff);
  padding: 6px 0 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}
.reader-book {
  font-size: 11px;
  color: #6b5bd6;
  background: #efeaff;
  border-radius: 4px;
  padding: 2px 6px;
}
.reader-title {
  font-size: 16px;
  margin: 0;
  flex: 1;
  color: var(--text-strong);
}
.reader-body {
  font-size: 13.5px;
  line-height: 1.9;
  white-space: pre-wrap;
  color: var(--text-strong);
}
.rw-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.rw-col {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}
.note-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}
.note-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}
.note-body {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.muted {
  color: var(--text-muted);
  font-size: 12px;
}
.pdf-frame {
  width: 100%;
  height: 82vh;
  border: none;
  border-radius: 8px;
}
.phrase-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.phrase-item {
  border: 1px solid var(--border);
  border-left: 3px solid #534ab7;
  border-radius: 10px;
  padding: 12px 14px;
}
.phrase-item.spoken {
  border-left-color: #0f6e56;
}
.phrase-item.affix {
  border-left-color: #185fa5;
}
.phrase-item.irregular {
  border-left-color: #854f0b;
}
.phrase-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.phrase-en {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
  word-break: break-word;
}
.phrase-cat {
  font-size: 11px;
  color: #fff;
  background: #534ab7;
  border-radius: 10px;
  padding: 1px 8px;
  white-space: nowrap;
}
.phrase-item.spoken .phrase-cat {
  background: #0f6e56;
}
.phrase-item.affix .phrase-cat {
  background: #185fa5;
}
.phrase-item.irregular .phrase-cat {
  background: #854f0b;
}
.phrase-zh {
  font-size: 13px;
  color: var(--text-strong);
  margin-top: 6px;
  line-height: 1.6;
}
.phrase-extra {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
  line-height: 1.6;
  word-break: break-word;
}

/* ===== 我的视图 ===== */
.mine-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  background: linear-gradient(135deg, #f6f5ff, #fff);
  border-radius: 12px;
  margin-bottom: 16px;
}
.mine-avatar {
  font-size: 48px;
  flex-shrink: 0;
}
.mine-name { font-size: 18px; font-weight: 800; margin: 0 0 4px; color: var(--text-strong); }
.mine-desc { font-size: 13.5px; color: var(--text-muted); margin: 0; line-height: 1.6; }
.mine-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.mine-stat-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 10px;
  text-align: center;
}
.mine-stat-num { font-size: 26px; font-weight: 800; }
.mine-stat-num.purple { color: #534ab7; }
.mine-stat-num.blue { color: #185fa5; }
.mine-stat-num.green { color: #0f6e56; }
.mine-stat-num.orange { color: #854f0b; }
.mine-stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.mine-progress { margin-bottom: 16px; }
.mine-ring-row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px;
  background: #faf8ff;
  border-radius: 12px;
}
.mine-ring-info { font-size: 13.5px; color: var(--text-strong); line-height: 2; }
.mine-ring-info b { color: #534ab7; }
.mine-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

/* 错本操作行 */
.note-ops-inline {
  display: flex;
  gap: 6px;
}
@media (max-width: 900px) {
  .type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .req-grid,
  .rw-grid {
    grid-template-columns: 1fr;
  }
  .lib-layout {
    grid-template-columns: 1fr;
  }
  .lib-side {
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding-right: 0;
    padding-bottom: 10px;
  }
  .lib-list {
    max-height: 240px;
  }
}

@media (max-width: 768px) {
  /* 移动端：顶部导航隐藏，改用底部固定导航 */
  .de-topnav { display: none; }
  .de-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 40;
    height: calc(60px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, #fff 92%, transparent);
    backdrop-filter: saturate(160%) blur(14px);
    -webkit-backdrop-filter: saturate(160%) blur(14px);
    border-top: 1px solid var(--border, #e6e3f2);
    box-shadow: 0 -4px 18px rgba(15, 23, 42, 0.06);
    gap: 6px;
  }
  .de-bottom-nav .de-nav-item {
    flex-direction: column;
    gap: 3px;
    padding: 6px 2px;
    font-size: 11.5px;
    min-height: 48px;
    border-radius: 10px;
  }
  .de-bottom-nav .de-nav-item svg { width: 22px; height: 22px; }
  .de-bottom-nav .de-nav-item.active {
    color: #534ab7;
    background: #ECEAF8;
    box-shadow: none;
  }

  /* 为底部导航留白 */
  .degree-view { padding-bottom: calc(100px + env(safe-area-inset-bottom)); }
  .dh-header { padding: 10px 12px; }
  .dh-title { font-size: 17px; }
  .dh-sub { font-size: 12px; -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
  .dh-stats { grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .dh-stat { padding: 8px 8px; }
  .dh-stat-val { font-size: 20px; }
  .dh-nav { gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .dh-nav-item { min-width: 56px; padding: 7px 10px; font-size: 12px; border-radius: 9px; flex: 0 0 auto; }
  .step-indicator { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }
  .step-dot { flex: 0 0 auto; }
  .panel { padding: 14px; }
  .card-wall { grid-template-columns: 1fr; }
  .phrase-list { grid-template-columns: 1fr; }
  /* 闪卡移动端 */
  .flashcard-inner { min-height: 220px; }
  .fc-word { font-size: 24px; }
  .fc-def { font-size: 15px; }
  .flashcard-ops { flex-wrap: wrap; justify-content: center; }
  .fc-nav-btn { padding: 6px 12px; font-size: 12px; }
  .fc-actions { width: 100%; justify-content: center; }
}

@media (max-width: 560px) {
  .dh-header {
    flex-direction: column; align-items: stretch; padding: 12px 14px;
  }
  .dh-brand { flex-wrap: nowrap; gap: 8px; }
  .dh-title { font-size: 16px; white-space: normal; word-break: keep-all; }
  .dh-sub { font-size: 11.5px; line-height: 1.35; -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
  .dh-actions { width: 100%; justify-content: flex-end; flex-shrink: 0; }
  .dh-stats { grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .dh-stat { padding: 8px 10px; }
  .dh-stat-val { font-size: 18px; }
  .dh-nav { gap: 4px; }
  .dh-nav-item { min-width: 52px; padding: 7px 10px; font-size: 12px; border-radius: 9px; }
  .step-indicator { flex-direction: column; gap: 6px; }
  .step-dot { padding: 6px 12px; font-size: 12px; }
  .type-grid {
    grid-template-columns: 1fr;
  }
  .panel {
    padding: 14px;
  }
  .card-wall {
    grid-template-columns: 1fr;
  }
  .toolbar {
    flex-wrap: wrap;
  }
  /* 闪卡小屏 */
  .flashcard-inner { min-height: 200px; }
  .fc-word { font-size: 22px; }
  .flashcard-front, .flashcard-back { padding: 20px 16px; }
  .fc-def { font-size: 14.5px; }
  .fc-nav-btn { width: 100%; text-align: center; margin-bottom: 4px; }
  .fc-actions { width: 100%; flex-direction: column; }
  .fc-actions .el-button { width: 100%; }
  /* 我的视图小屏 */
  .mine-stats { grid-template-columns: repeat(2, 1fr); }
  .mine-header { flex-direction: column; text-align: center; padding: 14px; }
  .mine-ring-row { flex-direction: column; text-align: center; }
  .mine-actions { flex-direction: column; }
  .mine-actions .el-button { width: 100%; }
}
</style>

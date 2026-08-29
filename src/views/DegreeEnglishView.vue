<template>
  <div class="degree-view">
    <!-- 模块标题栏（与 AI 助手/四六级 PageHeader 完全一致） -->
    <header class="page-header-card deg-header-main">
      <div class="ph-inner">
        <div class="ph-brand">
          <span class="ph-icon">
            <el-icon :size="20" color="#fff"><Reading /></el-icon>
          </span>
          <div class="ph-text">
            <h2 class="ph-title">学位英语备考台</h2>
            <p class="ph-sub">上传你的《大纲/模拟卷/复习指南》PDF，自动 OCR 生成专题词库与背诵计划，按考试 5 大题型系统备考。</p>
          </div>
        </div>
        <div class="ph-actions">
          <el-button :icon="ArrowLeft" @click="router.push('/learn/english')">返回学习中心</el-button>
          <el-button text :icon="Setting" @click="settingsVisible = true">设置</el-button>
          <el-button type="primary" round :icon="VideoPlay" @click="startStudy">开始学习</el-button>
        </div>
      </div>
    </header>

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
      <button class="de-nav-item" @click="router.push('/degree/weakness')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
        <span>薄弱点</span>
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
      <button class="de-nav-item" @click="router.push('/degree/weakness')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
        <span>薄弱点</span>
      </button>
      <button class="de-nav-item" :class="{ active: topNav === 'mine' }" @click="topNav = 'mine'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>我的</span>
      </button>
    </nav>

    <!-- ===== 今日视图 ===== -->
    <template v-if="topNav === 'today'">
    <!-- 统计行 -->
    <div class="dh-stats">
      <div class="dh-stat"><span class="dh-stat-label">今日新词</span><span class="dh-stat-val purple">{{ cardNewToday + phraseNewToday }}</span><small class="dh-stat-sub">已学 {{ degreeTodayLearned + phraseTodayLearned }} 个</small></div>
      <div class="dh-stat"><span class="dh-stat-label">今日待复习</span><span class="dh-stat-val orange">{{ cardDueCount + phraseDueCount }}</span></div>
      <div class="dh-stat"><span class="dh-stat-label">连续学习</span><span class="dh-stat-val blue">{{ streakDays }}<small>天</small></span></div>
      <div class="dh-stat"><span class="dh-stat-label">词汇掌握</span><span class="dh-stat-val green">{{ graduatedCount }}<small>/{{ degreeWords.length || VOCAB_REQUIREMENT.receptive }}</small></span></div>
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
              <li>今日待复习 <b>{{ reviewCount }}</b> 个</li>
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

      <!-- 记忆与掌握可视化（免费 ECharts，移动端可折叠减少首屏滚动） -->
      <div class="card-title memory-title" role="button" @click="memOpen = !memOpen">
        <span>📈 记忆与掌握</span>
        <span class="mem-caret">{{ memOpen ? '▾' : '▸' }}</span>
      </div>
      <div class="memory-grid" v-show="memOpen">
        <div class="memory-cell">
          <div class="mc-label">词汇掌握率</div>
          <EChart :option="masteryOption" :height="isMobile ? '140px' : '172px'" />
        </div>
        <div class="memory-cell">
          <div class="mc-label">艾宾浩斯遗忘曲线（理论保持率）</div>
          <EChart :option="memoryOption" :height="isMobile ? '140px' : '172px'" />
        </div>
        <div class="memory-cell memory-cell-wide">
          <div class="mc-label">待复习分布（按下次复习时间）</div>
          <EChart :option="reviewDistOption" :height="isMobile ? '150px' : '188px'" />
        </div>
      </div>
    </section>

    <!-- 单词本 -->
    <section v-if="renderedTabs.has('words')" v-show="activeTab === 'words'" class="panel">
      <div class="toolbar">
        <el-input v-model="wordQuery" placeholder="搜索单词 / 释义" clearable style="max-width: 320px" />
        <el-radio-group :model-value="wordSrc" size="small" @change="wordSrc = $event as 'all' | SourceBook">
          <el-radio-button value="all">全部({{ wordCountBySrc.all }})</el-radio-button>
          <el-radio-button value="考试大纲">大纲({{ wordCountBySrc.outline }})</el-radio-button>
          <el-radio-button value="复习指南">指南({{ wordCountBySrc.guide }})</el-radio-button>
          <el-radio-button value="模拟试卷">模拟({{ wordCountBySrc.mock }})</el-radio-button>
        </el-radio-group>
        <el-tag v-if="degreeWords.length" type="info" effect="plain">当前共 {{ filteredWords.length }} 词</el-tag>
        <el-tag v-else type="warning" effect="plain">OCR 生成中，稍候自动填充</el-tag>
      </div>
      <div v-if="filteredWords.length" class="word-list">
        <div v-for="w in visibleWords" :key="w.word" class="word-item" :class="{ weak: wordProgress[w.word]?.weak }">
          <div class="word-main word-main-click" @click="openWordDetail(w)" title="点击查看详情">
            <span class="word-text">{{ w.word }}<span v-if="w.productive" class="star">*</span><span v-if="wordPhonetic(w.word)" class="word-phonetic">{{ wordPhonetic(w.word) }}</span></span>
            <button class="speak-btn" :title="'朗读 ' + w.word" @click.stop="speak(w.word)">🔊</button>
            <button class="speak-btn" :title="'查看例句 ' + w.word" @click.stop="loadExample(w.word)" :disabled="exampleLoading[w.word]">📖</button>
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
    <section v-if="renderedTabs.has('cards')" v-show="activeTab === 'cards'" ref="cardsSection" :class="['panel', { immersive: immersive }]">
      <div v-if="!cardStarted" class="card-start-screen">
        <div class="card-start-icon">📚</div>
        <h3 style="margin: 0 0 8px">学位英语背单词</h3>
        <p style="color: var(--text-muted); margin: 0 0 16px; font-size: 13.5px">
          共 <b>{{ degreeWords.length }}</b> 词 · 已掌握 {{ graduatedCount }} · 连续学习 <b>{{ streakDays }}</b> 天
        </p>
        <div class="card-dash">
          <div class="card-dash-stat"><b class="blue">{{ cardNewToday }}</b><span>今日新学</span><small class="card-dash-sub">已学 {{ degreeTodayLearned }} 个</small></div>
          <div class="card-dash-stat"><b class="orange">{{ cardDueCount }}</b><span>待复习</span></div>
          <div class="card-dash-stat"><b class="green">{{ graduatedCount }}</b><span>已掌握</span></div>
          <div class="card-dash-stat"><b class="purple">{{ streakDays }}</b><span>连续(天)</span></div>
        </div>
        <el-alert v-if="degreeRemindDue && cardDueCount > 0" type="warning" :closable="false" show-icon
          style="margin: 0 0 14px" title="待复习提醒" :description="`今日有 ${cardDueCount} 个单词到期，记得复习哦`" />
        <div class="card-start-actions">
          <el-button type="primary" size="large" round :icon="VideoPlay" @click="startCardMode">
            开始背单词
          </el-button>
          <el-button size="large" round type="warning" :disabled="cardDueCount === 0" @click="startCardReviewMode">
            待复习 {{ cardDueCount }} 个
          </el-button>
        </div>
      </div>

      <template v-else>
        <!-- 闪卡进度条 -->
        <div class="flashcard-progress">
          <span class="flashcard-pos">已学 {{ cardReviewedCount }} · 剩余 {{ cardQueue.length }} · 已掌握 {{ graduatedCount }}</span>
          <div class="flashcard-bar"><div class="flashcard-fill" :style="{ width: cardPercent + '%' }"></div></div>
          <button v-if="immersive" class="flashcard-exit immersive-exit" @click="exitImmersiveOnly" title="退出沉浸式">⛶ 退出沉浸</button>
          <button class="flashcard-exit" @click="exitCardMode" title="退出背词">✕</button>
        </div>

        <template v-if="cardQueue.length">
          <!-- 单张闪卡 -->
          <div class="flashcard" :class="{ flipped: cardFlipped }" @click="cardFlipped = !cardFlipped" @touchstart="onCardTouchStart" @touchend="onCardTouchEnd">
            <div class="flashcard-inner">
              <!-- 正面：单词 -->
              <div class="flashcard-front">
                <div class="fc-word-row">
                  <span class="fc-word">{{ currentCardWord!.word }}<span v-if="currentCardWord!.productive" class="star">*</span></span>
                  <button class="speak-btn fc-speak" @click.stop="speak(currentCardWord!.word)" title="朗读">🔊</button>
                </div>
                <div v-if="wordPhonetic(currentCardWord!.word)" class="fc-phonetic">{{ wordPhonetic(currentCardWord!.word) }}</div>
                <div class="fc-hint">点击翻转查看释义</div>
              </div>
              <!-- 背面：释义+例句 -->
              <div class="flashcard-back">
                <div class="fc-def">{{ currentCardWord!.definition }}</div>
                <div class="fc-src" v-if="currentCardWord!.sourceBooks?.length">
                  <el-tag v-for="b in currentCardWord!.sourceBooks" :key="b" size="small" :type="srcTagType(b)" effect="plain">{{ b }}</el-tag>
                </div>
                <div class="fc-example" v-if="examples[currentCardWord!.word]">
                  <span class="ex-label">例句</span> {{ examples[currentCardWord!.word] }}
                  <button class="trans-btn" @click.stop="translateExample(currentCardWord!.word)" :disabled="translating[currentCardWord!.word]">
                    {{ translations[currentCardWord!.word] ? '已翻译' : '翻译' }}
                  </button>
                  <div class="fc-translation" v-if="translations[currentCardWord!.word]">📝 {{ translations[currentCardWord!.word] }}</div>
                </div>
                <button class="fc-load-ex" v-if="!examples[currentCardWord!.word] && !exampleLoading[currentCardWord!.word]" @click.stop="loadExample(currentCardWord!.word)">📖 加载例句</button>
              </div>
            </div>
          </div>

          <!-- 操作栏 -->
          <div class="flashcard-ops">
            <button class="fc-nav-btn immersible-btn" :class="{ on: immersive }" @click="toggleImmersive">{{ immersive ? '📱 退出沉浸' : '⛶ 沉浸式' }}</button>
            <div class="fc-accent">
              <span class="accent-label">读音</span>
              <button class="accent-opt" :class="{ on: voiceAccent === 'en-US' }" @click="voiceAccent = 'en-US'">美</button>
              <button class="accent-opt" :class="{ on: voiceAccent === 'en-GB' }" @click="voiceAccent = 'en-GB'">英</button>
            </div>
            <div class="fc-actions">
              <el-button size="small" type="danger" @click="gradeCard('again')">忘记</el-button>
              <el-button size="small" type="warning" @click="addWordBook(currentCardWord!)">生词本</el-button>
              <el-button size="small" type="primary" @click="gradeCard('good')">认识</el-button>
              <el-button size="small" type="success" @click="gradeCard('easy')">简单</el-button>
              <el-button size="small" @click="skipCard">跳过 →</el-button>
            </div>
          </div>

          <!-- 快捷键提示 -->
          <div class="fc-shortcuts" v-if="!isMobileDevice">空格 翻转 · 1 忘记 · 2 认识 · 3 简单 · S 跳过</div>
        </template>

        <el-result v-else icon="success" title="本轮背词完成" :sub-title="`今日已学 ${cardReviewedCount} 词`">
          <template #extra>
            <el-button type="primary" @click="startCardMode">再来一轮</el-button>
            <el-button @click="exitCardMode">返回</el-button>
          </template>
        </el-result>
      </template>
    </section>

    <!-- 词组 / 语句 -->
    <section v-if="renderedTabs.has('phrases')" v-show="activeTab === 'phrases'" class="panel">
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

      <!-- 词组卡片训练入口 -->
      <div v-if="!phraseStarted" class="card-start-screen" style="padding: 30px 20px;">
        <div class="card-start-icon">🗣️</div>
        <h3 style="margin: 0 0 8px">词组 / 语句 逐个背</h3>
        <p style="color: var(--text-muted); margin: 0 0 16px; font-size: 13.5px">
          共 <b>{{ allDegreePhrases.length }}</b> 条 · 已掌握 {{ phraseGraduatedCount }} · 连续学习 <b>{{ streakDays }}</b> 天
        </p>
        <div class="card-dash">
          <div class="card-dash-stat"><b class="blue">{{ phraseNewToday }}</b><span>今日新学</span><small class="card-dash-sub">已学 {{ phraseTodayLearned }} 个</small></div>
          <div class="card-dash-stat"><b class="orange">{{ phraseDueCount }}</b><span>待复习</span></div>
          <div class="card-dash-stat"><b class="green">{{ phraseGraduatedCount }}</b><span>已掌握</span></div>
          <div class="card-dash-stat"><b class="purple">{{ streakDays }}</b><span>连续(天)</span></div>
        </div>
        <el-alert v-if="degreeRemindDue && phraseDueCount > 0" type="warning" :closable="false" show-icon
          style="margin: 0 0 14px" title="待复习提醒" :description="`今日有 ${phraseDueCount} 条词组到期，记得复习哦`" />
        <div class="card-start-actions">
          <el-button type="primary" size="large" round :icon="VideoPlay" @click="startPhraseMode(false)">开始背词组</el-button>
          <el-button size="large" round type="warning" :disabled="phraseDueCount === 0" @click="startPhraseMode(true)">待复习 {{ phraseDueCount }} 条</el-button>
        </div>
        <el-link type="primary" style="margin-top: 16px" @click="showPhraseList = true">查看完整词组表</el-link>
      </div>

      <!-- 词组卡片训练 -->
      <template v-else>
        <div class="flashcard-progress">
          <span class="flashcard-pos">已学 {{ phraseReviewedCount }} · 剩余 {{ phraseQueue.length }} · 已掌握 {{ phraseGraduatedCount }}</span>
          <div class="flashcard-bar"><div class="flashcard-fill" :style="{ width: phrasePercent + '%' }"></div></div>
          <button class="flashcard-exit" @click="exitPhraseMode" title="退出">✕</button>
        </div>

        <template v-if="phraseQueue.length">
          <div class="flashcard" :class="{ flipped: phraseFlipped }" @click="phraseFlipped = !phraseFlipped">
            <div class="flashcard-inner">
              <div class="flashcard-front">
                <div class="fc-word-row">
                  <span class="fc-word">{{ currentPhrase!.en }}</span>
                  <button class="speak-btn fc-speak" @click.stop="speakPhrase(currentPhrase!.en)" title="朗读">🔊</button>
                </div>
                <div class="fc-hint">点击翻转查看释义 / 翻译</div>
              </div>
              <div class="flashcard-back">
                <div class="fc-def">{{ currentPhrase!.zh || '（暂无中文释义）' }}</div>
                <div class="fc-def" v-if="currentPhrase!.extra" style="font-size: 13px; color: var(--text-muted);">
                  {{ currentPhrase!.category === 'irregular' ? '过去式 / 过去分词：' : currentPhrase!.category === 'affix' ? '例词：' : '' }}{{ currentPhrase!.extra }}
                </div>
                <div class="fc-example" v-if="phraseTranslations[currentPhrase!.en]">📝 {{ phraseTranslations[currentPhrase!.en] }}</div>
                <button class="trans-btn" @click.stop="translatePhrase(currentPhrase!)" :disabled="phraseTranslating[currentPhrase!.en]">
                  {{ phraseTranslations[currentPhrase!.en] ? '已翻译' : '翻译' }}
                </button>
              </div>
            </div>
          </div>

          <div class="flashcard-ops">
            <div class="fc-actions">
              <el-button size="small" type="danger" @click="gradePhrase('again')">忘记</el-button>
              <el-button size="small" type="primary" @click="gradePhrase('good')">认识</el-button>
              <el-button size="small" type="success" @click="gradePhrase('easy')">简单</el-button>
              <el-button size="small" @click="skipPhrase">跳过 →</el-button>
            </div>
          </div>
        </template>

        <el-result v-else icon="success" title="本轮词组已学完" :sub-title="`今日已学 ${phraseReviewedCount} 条`">
          <template #extra>
            <el-button type="primary" @click="startPhraseMode(false)">再来一轮</el-button>
            <el-button @click="exitPhraseMode">返回</el-button>
          </template>
        </el-result>
      </template>

      <!-- 词组表（未开始学习时可通过「查看完整词组表」展开） -->
      <div v-if="showPhraseList && !phraseStarted" class="phrase-list">
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
      <el-empty v-if="!filteredPhrases.length && !phraseStarted" description="没有匹配的词组 / 语句，换个关键词试试" />
    </section>

    <!-- 题型训练 -->
    <section v-if="renderedTabs.has('training')" v-show="activeTab === 'training'" class="panel">
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
          <label v-for="(o, i) in currentQ.options" :key="i" class="opt" :class="{ right: showAnswer && currentQ.answer === optLetter(i), wrong: showAnswer && myAnswer === optLetter(i) && currentQ.answer !== optLetter(i) }">
            <input type="radio" :name="'q'" :value="optLetter(i)" v-model="myAnswer" :disabled="showAnswer" />
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
          <div class="ex-src">来源：{{ currentQ.source.basis }}（{{ currentQ.source.book }}{{ currentQ.source.page ? ' 第 ' + currentQ.source.page + ' 页' : '' }}）</div>
        </div>
      </div>
      <el-empty v-else :description="`《${trainingTypeLabel}》题库正在由 PDF 原题 + 大纲生成，完成后即可逐题练习并看解析`" />
    </section>

    <!-- 模拟考试 -->
    <section v-if="renderedTabs.has('mock')" v-show="activeTab === 'mock'" class="panel">
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
        v-if="!allDegreeQuestions.length"
        type="info"
        :closable="false"
        style="margin-top: 12px"
        title="模拟卷原题题库正在由《全真模拟试卷及考点点睛》OCR 生成，完成后可直接在线计时模考、交卷判分与薄弱项分析。"
      />
    </section>

    <!-- 资料库 -->
    <section v-if="renderedTabs.has('library')" v-show="activeTab === 'library'" class="panel">
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
          <div class="card-title">生词本 <span class="ext-tag">拓展 · 非三本PDF大纲</span></div>
          <div v-if="wordBook.length" class="note-list">
            <div v-for="w in wordBook" :key="w.id" class="note-item">
              <div class="note-body">{{ w.content }}</div>
              <el-button size="small" text type="danger" @click="removeFav(w.id)">删除</el-button>
            </div>
          </div>
          <el-empty v-else description="从单词本「加入生词本」的词会在这里（个人拓展词库，独立于三本PDF大纲词）" :image-size="60" />
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
          <label v-for="(o, i) in currentQ.options" :key="i" class="opt" :class="{ right: showAnswer && currentQ.answer === optLetter(i), wrong: showAnswer && myAnswer === optLetter(i) && currentQ.answer !== optLetter(i) }">
            <input type="radio" :name="'qp'" :value="optLetter(i)" v-model="myAnswer" :disabled="showAnswer" />
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
          <div class="ex-src">来源：{{ currentQ.source.basis }}（{{ currentQ.source.book }}{{ currentQ.source.page ? ' 第 ' + currentQ.source.page + ' 页' : '' }}）</div>
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

      <div class="card-title" style="margin: 20px 0 10px">生词本 <el-tag size="small" :type="wordBook.length ? 'warning' : 'info'">{{ wordBook.length }} 词</el-tag> <span class="ext-tag">拓展 · 非三本PDF大纲</span></div>
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
          <div class="mine-stat-label">待复习</div>
        </div>
        <div class="mine-stat-card">
          <div class="mine-stat-num green">{{ degreeWords.length }}</div>
          <div class="mine-stat-label">总词汇量</div>
        </div>
        <div class="mine-stat-card">
          <div class="mine-stat-num orange">{{ allDegreeQuestions.length }}</div>
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

    <!-- PDF 预览：pdf.js 渲染到 canvas，移动端不再变成下载；仍保留「下载」入口 -->
    <PdfViewerDialog v-model="previewVisible" :url="previewUrl" :title="previewTitle" />

    <!-- 设置 -->
    <el-dialog v-model="settingsVisible" title="备考设置" width="min(92vw, 420px)">
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
        <el-form-item label="待复习提醒">
          <el-switch v-model="degreeRemindDue" />
          <span class="de-set-hint">背单词卡 / 词组有待复习时在看板高亮提醒</span>
        </el-form-item>
        <el-form-item label="已掌握回流">
          <el-switch v-model="degreeGraduatedReturn" />
          <span class="de-set-hint">已掌握的单词 / 词组重新进入复习，可返回「学习单词中」</span>
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
    <el-dialog v-model="noteVisible" title="学习笔记" width="min(92vw, 460px)">
      <el-input v-model="noteTitleInput" placeholder="标题（可选）" style="margin-bottom: 10px" />
      <el-input v-model="noteInput" type="textarea" :rows="5" placeholder="写下你的笔记、好句、心得……" />
      <template #footer>
        <el-button @click="noteVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNote">保存</el-button>
      </template>
    </el-dialog>

    <!-- 划词翻译浮层（免费：朗读 + MyMemory 翻译） -->
    <transition name="fade">
      <div v-if="floatSel.visible" class="word-float" :style="{ left: floatSel.x + 'px', top: floatSel.y + 'px' }" @click.stop>
        <div class="wf-text">{{ floatSel.text }}</div>
        <div class="wf-actions">
          <button class="wf-btn" @click="floatSpeak">🔊 朗读</button>
          <button class="wf-btn" :disabled="floatSel.translating" @click="floatTranslate">
            {{ floatSel.translating ? '翻译中…' : '📝 翻译' }}
          </button>
        </div>
        <div v-if="floatSel.result" class="wf-result">{{ floatSel.result }}</div>
        <button class="wf-close" @click="hideFloatSel" title="关闭">✕</button>
      </div>
    </transition>

    <!-- 模拟考试 -->
    <MockExamDialog
      v-model="mockExamVisible"
      :paper="currentMockPaper"
      :all-questions="allDegreeQuestions"
    />

    <!-- 统一单词详情（三模块共用同一组件） -->
    <WordDetailDialog
      v-model="wordDetailVisible"
      :word="wordDetail?.word || ''"
      :phonetic="wordDetail?.phonetic || ''"
      :pos="wordDetail?.pos || ''"
      :definition="wordDetail?.definition || ''"
      :pool="degreeWordList"
      module-label="学位英语 · 备考台"
      @add-word-book="onDetailAddWordBook"
      @mastered="onDetailMastered"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { MOBILE_MAX } from '../config/breakpoints'
import { Reading, Setting, VideoPlay, Picture, ArrowLeft, ArrowRight, Star } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import EChart from '../components/EChart.vue'
import MockExamDialog from '../components/degree/MockExamDialog.vue'
import type { EChartsOption } from 'echarts'
import {
  EXAM_SECTIONS,
  VOCAB_REQUIREMENT,
  GRAMMAR_ITEMS,
  MATERIALS,
  MOCK_PAPERS,
  type MaterialMeta
} from '../prep/degreeExamStructure'
import { degreeWords } from '../prep/degreeWords'
import { degreePhrases } from '../prep/degreePhrases'
import { spokenPhrases, affixPhrases, irregularPhrases } from '../prep/degreePhrasesExtra'
// 重型数据改为按需动态 import（题库约 907KB、资料库文章约 394KB），
// 避免进入备考台时同步解析阻塞首屏 —— 见下方 ensureQuestions() / ensureArticles()
import type { DegreeSettings, DegreeWord, WordProgress, MistakeRec, FavoriteRec, PracticeRec, QuestionType, DegreeQuestion, DegreePhrase, PhraseCategory, SourceBook, DegreeArticle } from '../prep/degreeTypes'
import * as svc from '../prep/degreeService'
import { ensureContentSeeded } from '../prep/degreeDb'
import {
  buildReviewQueue as buildDegreeReviewQueue,
  reviewWord,
  todayStr,
  type SrsGrade
} from '../prep/degreeSrs'
import { buildReviewQueue as buildGenericReviewQueue } from '../prep/trainingSrs'
import { getStudySettings, saveStudySettings, countLearnedToday, computeStreakFromDates, collectStudyDates } from '../services/studySettingsService'
import { speakEn } from '../prep/degreeSpeech'
import WordDetailDialog from '../components/WordDetailDialog.vue'
import PdfViewerDialog from '../components/PdfViewerDialog.vue'

// ===== 重型数据按需加载（提速：进入备考台不再同步解析 1.3MB 数据） =====
// 题库（约 907KB）：进入页面后后台加载，不阻塞首屏；开模考前确保就绪
const allDegreeQuestions = ref<DegreeQuestion[]>([])
let questionsLoaded = false
let questionsLoading: Promise<void> | null = null
function ensureQuestions(): Promise<void> {
  if (questionsLoaded) return Promise.resolve()
  if (questionsLoading) return questionsLoading
  questionsLoading = import('../prep/degreeQuestionBank')
    .then((m) => {
      allDegreeQuestions.value = m.allDegreeQuestions
      questionsLoaded = true
    })
    .catch((e) => {
      console.warn('[DegreeEnglish] 题库加载失败', e)
    })
    .finally(() => {
      questionsLoading = null
    })
  return questionsLoading
}

// 资料库文章（约 394KB）：切到「资料库」时才加载
const allArticles = ref<DegreeArticle[]>([])
let articlesLoaded = false
let articlesLoading: Promise<void> | null = null
function ensureArticles(): Promise<void> {
  if (articlesLoaded) return Promise.resolve()
  if (articlesLoading) return articlesLoading
  articlesLoading = Promise.all([
    import('../prep/degreeSyllabusProse'),
    import('../prep/degreeGuide')
  ])
    .then(([prose, guide]) => {
      allArticles.value = [...prose.syllabusProse, ...guide.guideArticles]
      articlesLoaded = true
    })
    .catch((e) => {
      console.warn('[DegreeEnglish] 资料库文章加载失败', e)
    })
    .finally(() => {
      articlesLoading = null
    })
  return articlesLoading
}

const libBook = ref<'all' | string>('all')
const activeArticle = ref<DegreeArticle | null>(null)
const libraryArticles = computed(() =>
  libBook.value === 'all' ? allArticles.value : allArticles.value.filter((a) => a.book === libBook.value)
)
function openArticle(a: DegreeArticle) {
  activeArticle.value = a
}
// ===== 单词/例句读音 =====
// 统一复用 degreeSpeech.speakEn 的双通道实现（本地 TTS → 在线发音自动降级），
// 解决 iQOO / vivo 等国产浏览器「有 speechSynthesis 接口却无英文引擎、点了朗读静默无声」的问题。
// 备考台原有的「美 / 英」切换通过第三个参数 accent 透传，功能完整保留。
const voiceAccent = ref<'en-US' | 'en-GB'>('en-US')
function speakWord(text: string, rate = 0.9) {
  if (!text) return
  void speakEn(text, rate, voiceAccent.value)
}
function speakText(t: string) {
  if (!t) return
  void speakEn(t, 0.95, voiceAccent.value)
}

// ===== 划词翻译浮层（免费 MyMemory，无需 Key） =====
function translateText(text: string): Promise<string> {
  const q = (text || '').trim()
  if (!q) return Promise.resolve('')
  return fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|zh-CN`)
    .then((r) => r.json())
    .then((d) => (d?.responseData?.translatedText as string) || '（翻译暂不可用）')
    .catch(() => '（网络异常，翻译失败）')
}
const floatSel = reactive({ visible: false, x: 0, y: 0, text: '', translating: false, result: '' })
function hideFloatSel() {
  floatSel.visible = false
  floatSel.result = ''
}
function onTextSelected(e?: Event) {
  // 来自浮层自身的交互不触发（否则点按钮会先被 mouseup 关掉）
  const t = e?.target as HTMLElement | null
  if (t && t.closest && t.closest('.word-float')) return
  const sel = typeof window !== 'undefined' ? window.getSelection() : null
  if (!sel || sel.isCollapsed || !sel.rangeCount) {
    hideFloatSel()
    return
  }
  const text = sel.toString().trim()
  if (!text || text.length > 120) {
    hideFloatSel()
    return
  }
  const rect = sel.getRangeAt(0).getBoundingClientRect()
  floatSel.visible = true
  floatSel.x = Math.max(12, rect.left + rect.width / 2)
  floatSel.y = Math.max(12, rect.top)
  floatSel.text = text
  floatSel.result = ''
}
function floatTranslate() {
  floatSel.translating = true
  translateText(floatSel.text).then((r) => {
    floatSel.result = r
    floatSel.translating = false
  })
}
function floatSpeak() {
  speakWord(floatSel.text, 0.9)
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
const router = useRouter()
const activeTab = ref('overview')
const renderedTabs = ref<Set<string>>(new Set(['overview']))
watch(activeTab, (tab) => {
  renderedTabs.value.add(tab)
}, { immediate: true })

// 移动端响应式：记忆与掌握区在窄屏默认折叠，砍掉首屏一大段滚动
const isMobile = ref(false)
const memOpen = ref(true)
function syncMobile() {
  isMobile.value = window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches
}
function onMobileChange(e: MediaQueryListEvent) {
  isMobile.value = e.matches
  if (e.matches) memOpen.value = false
}

// 顶部导航（与 AI/四六级模块一致：今日/刷题/错本/我的）
const topNav = ref<'today' | 'practice' | 'mistakes' | 'mine'>('today')

// 概览分步向导
const OVERVIEW_STEPS = ['今日学习计划', '五大题型', '大纲规定'] as const
const overviewStep = ref(0)

// 按题型统计题数（用于空状态标注）
function questionCountByType(type: string): number {
  return allDegreeQuestions.value.filter((q) => q.type === type).length
}

const settings = ref<DegreeSettings>({ targetSchool: '商丘师范学院继续教育学院', examDate: null, newPerDay: 15, manualStreak: null })
const manualStreakInput = ref(0)
// 备考台单词学习设置（与学习中心两模块各自独立，本地存储）
const degreeRemindDue = ref(true)
const degreeGraduatedReturn = ref(false)
// 今日已学新词数（从云端进度派生，跨端同步）：背单词卡 / 词组 各自独立统计
const degreeTodayLearned = computed(() => countLearnedToday(wordProgress.value, undefined, { onlyPhrase: false }))
const phraseTodayLearned = computed(() => countLearnedToday(wordProgress.value, undefined, { onlyPhrase: true }))
const wordProgress = ref<Record<string, WordProgress>>({})
const mistakes = ref<MistakeRec[]>([])
const notes = ref<FavoriteRec[]>([])
const wordBook = ref<FavoriteRec[]>([])
const practice = ref<PracticeRec[]>([])

const wordQuery = ref('')
const wordSrc = ref<'all' | SourceBook>('all')
const wordLimit = ref(50)
const filteredWords = computed(() => {
  const q = wordQuery.value.trim().toLowerCase()
  return degreeWords.filter((w) => {
    if (wordSrc.value !== 'all' && !(w.sourceBooks || []).includes(wordSrc.value)) return false
    if (!q) return true
    return w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q)
  })
})
const visibleWords = computed(() => filteredWords.value.slice(0, wordLimit.value))
const wordCountBySrc = computed(() => {
  let outline = 0, guide = 0, mock = 0
  for (const w of degreeWords) {
    const books = w.sourceBooks || []
    if (books.includes('考试大纲')) outline++
    if (books.includes('复习指南')) guide++
    if (books.includes('模拟试卷')) mock++
  }
  return { all: degreeWords.length, outline, guide, mock }
})

// 单词读音（浏览器内置 TTS，离线可用） + 例句/音标（免费词典 API，按需加载并缓存）
const examples = ref<Record<string, string>>({})
const phonetics = ref<Record<string, string>>({})
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
  speakWord(word, 0.9)
}
function wordPhonetic(word: string): string {
  if (phonetics.value[word]) return phonetics.value[word]
  const w = degreeWords.find((x) => x.word === word)
  return w?.phonetic || ''
}
async function ensurePhonetic(word: string) {
  if (wordPhonetic(word)) return
  await loadExample(word)
}

// 单词本可见词音标懒加载：避免首屏 300 词同时请求，按队列串行拉取
let phoneticFetchTimer: number | null = null
let phoneticFetchQueue: string[] = []
async function processPhoneticQueue() {
  const word = phoneticFetchQueue.shift()
  if (!word) return
  if (!wordPhonetic(word) && !exampleLoading.value[word]) {
    await loadExample(word)
  }
  if (phoneticFetchQueue.length) {
    window.setTimeout(processPhoneticQueue, 120)
  }
}
watch(visibleWords, (list) => {
  if (!list.length) return
  const missing = list.filter((w) => !wordPhonetic(w.word) && !exampleLoading.value[w.word]).map((w) => w.word)
  if (!missing.length) return
  // 去重并限制队列长度，避免搜索/翻页时无限累积
  phoneticFetchQueue = Array.from(new Set([...phoneticFetchQueue, ...missing])).slice(0, 80)
  if (phoneticFetchTimer) window.clearTimeout(phoneticFetchTimer)
  phoneticFetchTimer = window.setTimeout(processPhoneticQueue, 200)
}, { immediate: false, flush: 'post' })
async function loadExample(word: string) {
  if ((examples.value[word] && phonetics.value[word]) || exampleLoading.value[word]) return
  exampleLoading.value = { ...exampleLoading.value, [word]: true }
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
    if (res.ok) {
      const data = await res.json()
      const arr = Array.isArray(data) ? data : [data]
      let found = ''
      let phonetic = ''
      for (const entry of arr) {
        // 优先取美式音标，其次英式，最后任意音标
        if (!phonetic && entry.phonetic) phonetic = entry.phonetic
        for (const ph of entry.phonetics || []) {
          if (ph.text && voiceAccent.value === 'en-US' && /\u02c8|\u02cc|\u0251/.test(ph.text)) {
            phonetic = ph.text
            break
          }
          if (ph.text && !phonetic) phonetic = ph.text
        }
        for (const m of entry.meanings || []) {
          for (const d of m.definitions || []) {
            if (d.example) { found = d.example; break }
          }
          if (found) break
        }
        if (found && phonetic) break
      }
      examples.value = { ...examples.value, [word]: found || `（暂无例句）Please memorize "${word}".` }
      if (phonetic) phonetics.value = { ...phonetics.value, [word]: phonetic }
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
  const src = examples.value[word]
  const zh = await translateText(src)
  translations.value = { ...translations.value, [word]: zh }
  translating.value = { ...translating.value, [word]: false }
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
const allDegreePhrases = [...degreePhrases, ...spokenPhrases, ...affixPhrases, ...irregularPhrases]
const filteredPhrases = computed(() => {
  const q = phraseQuery.value.trim().toLowerCase()
  const list = allDegreePhrases.filter((p) => {
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

// ===== 词组/语句 卡片训练（与背单词卡一致：语音+翻译+逐个背+待复习） =====
const phraseStarted = ref(false)
const phraseQueue = ref<DegreePhrase[]>([])
const phraseReviewedCount = ref(0)
const phraseFlipped = ref(false)
const phraseTranslations = ref<Record<string, string>>({})
const phraseTranslating = ref<Record<string, boolean>>({})
const showPhraseList = ref(false)

// 词组进度统一使用 'ph:' 前缀 key，与单词（裸英文 key）隔离，避免同名词/词组互相覆盖（C2 修复）
const phraseNewToday = computed(() => {
  const fresh = allDegreePhrases.filter((p) => !wordProgress.value['ph:' + p.en]).length
  return Math.min(fresh, settings.value.newPerDay || 15)
})
const phraseDueCount = computed(() => {
  const today = todayStr()
  let due = 0
  for (const p of allDegreePhrases) {
    const prog = wordProgress.value['ph:' + p.en]
    if (!prog) continue
    if (prog.status !== 'graduated' && (prog.due ?? today) <= today) due++
  }
  return due // 仅到期复习（不含新词）
})
const currentPhrase = computed(() => phraseQueue.value[0] ?? null)
const phrasePercent = computed(() => {
  const total = phraseQueue.value.length + phraseReviewedCount.value
  if (!total) return 0
  return Math.round((phraseReviewedCount.value / total) * 100)
})

function buildPhraseQueue(dueOnly = false) {
  const phraseItems = allDegreePhrases.map((p) => ({ ...p, word: 'ph:' + p.en }))
  phraseQueue.value = buildGenericReviewQueue(phraseItems, wordProgress.value, {
    newPerDay: settings.value.newPerDay || 15,
    dueOnly,
    includeGraduated: getStudySettings('degree').graduatedReturn
  })
  phraseReviewedCount.value = 0
}
function startPhraseMode(dueOnly = false) {
  buildPhraseQueue(dueOnly)
  phraseStarted.value = true
  phraseFlipped.value = false
}
function exitPhraseMode() {
  phraseStarted.value = false
  phraseFlipped.value = false
}
async function gradePhrase(g: SrsGrade) {
  const p = currentPhrase.value
  if (!p) return
  const key = 'ph:' + p.en
  const prev = wordProgress.value[key]
  const next = reviewWord(prev, g)
  wordProgress.value = { ...wordProgress.value, [key]: next }
  await svc.saveWordProgress(key, next)
  phraseReviewedCount.value++
  if (g === 'again') phraseQueue.value.push(p)
  phraseQueue.value.shift()
  phraseFlipped.value = false
}
function skipPhrase() {
  const p = currentPhrase.value
  if (!p) return
  phraseQueue.value.shift()
  phraseFlipped.value = false
}
function speakPhrase(text: string) { speak(text) }
async function translatePhrase(p: DegreePhrase) {
  if (phraseTranslations.value[p.en] || phraseTranslating.value[p.en]) return
  // 优先使用词组表自带中文释义（本地、免费、即时），避免联网失败时翻译不生效
  if (p.zh && p.zh.trim()) {
    phraseTranslations.value = { ...phraseTranslations.value, [p.en]: p.zh.trim() }
    return
  }
  phraseTranslating.value = { ...phraseTranslating.value, [p.en]: true }
  try {
    const t = await translateText(p.en)
    phraseTranslations.value = { ...phraseTranslations.value, [p.en]: t || '（翻译暂不可用）' }
  } catch {
    phraseTranslations.value = { ...phraseTranslations.value, [p.en]: '（翻译暂不可用）' }
  } finally {
    phraseTranslating.value = { ...phraseTranslating.value, [p.en]: false }
  }
}

const phraseGraduatedCount = computed(() => allDegreePhrases.filter((p) => wordProgress.value['ph:' + p.en]?.status === 'graduated').length)
// 已掌握单词：只统计裸英文 key（单词），排除 'ph:' 前缀的词组进度，口径与分母 degreeWords 对齐（A2 修复）
const graduatedCount = computed(() => Object.entries(wordProgress.value).filter(([k, p]) => !k.startsWith('ph:') && p.status === 'graduated').length)
// 待复习（今日到期）：单词 + 词组 的到期数合计，与今日页「今日待复习」口径一致（B2 修复）
const reviewCount = computed(() => cardDueCount.value + phraseDueCount.value)
const masteryPercent = computed(() => {
  const total = degreeWords.length || VOCAB_REQUIREMENT.receptive
  return Math.round((graduatedCount.value / total) * 100)
})
const ringLen = computed(() => (masteryPercent.value / 100) * 314)
// 连续学习天数：由云端练习/错题/背词日期共同推算（跨端同步），回退到手动校准值。
// 背词或刷题任一发生都推进连续天数，与旧本地计数口径一致。
const streakDays = computed(() => {
  const dates: string[] = []
  for (const p of practice.value) if (p.date) dates.push(p.date)
  for (const m of mistakes.value) if (m.createdAt) dates.push(String(m.createdAt).slice(0, 10))
  // 合并背单词卡 + 词组的 lastStudied，保证「只刷词不刷题」也累计连续学习
  dates.push(...collectStudyDates(wordProgress.value))
  const manual = settings.value.manualStreak ?? 0
  const derived = computeStreakFromDates(dates)
  return Math.max(derived, manual)
})
const daysToExam = computed(() => {
  if (!settings.value.examDate) return null
  const d = new Date(settings.value.examDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(d / 86400000))
})

// ===== 记忆曲线与量化可视化（ECharts，免费） =====
// 待复习分布：按 next-due 落入的时间桶统计（今天/1-3天/4-7天/8-14天/15天+）
const reviewBuckets = computed(() => {
  const buckets: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  const now = new Date().setHours(0, 0, 0, 0)
  for (const p of Object.values(wordProgress.value)) {
    if (p.status === 'new') continue
    if (!p.due) {
      buckets[0]++
      continue
    }
    const diff = Math.ceil((new Date(p.due).setHours(0, 0, 0, 0) - now) / 86400000)
    if (diff <= 0) buckets[0]++
    else if (diff <= 3) buckets[1]++
    else if (diff <= 7) buckets[2]++
    else if (diff <= 14) buckets[3]++
    else buckets[4]++
  }
  return buckets
})
const masteryOption = computed<EChartsOption>(() => ({
  series: [
    {
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      progress: { show: true, width: 14, itemStyle: { color: '#534ab7' } },
      axisLine: { lineStyle: { width: 14, color: [[1, '#eceaf8']] } },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: { valueAnimation: true, fontSize: 26, fontWeight: 700, color: '#3c3489', formatter: '{value}%', offsetCenter: [0, 0] },
      data: [{ value: masteryPercent.value }]
    }
  ]
}))
const memoryOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 44, right: 16, top: 24, bottom: 30 },
  xAxis: { type: 'category', data: ['第1天', '第2天', '第4天', '第7天', '第15天', '第30天'], axisLabel: { fontSize: 11 } },
  yAxis: { type: 'value', max: 100, name: '保持率%', axisLabel: { fontSize: 11 } },
  series: [
    {
      name: '记忆保持率',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 7,
      data: [100, 58, 35, 25, 21, 20],
      lineStyle: { color: '#534ab7', width: 3 },
      itemStyle: { color: '#534ab7' },
      areaStyle: { color: 'rgba(83,74,183,0.15)' }
    }
  ]
}))
const reviewDistOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 16, top: 16, bottom: 30 },
  xAxis: { type: 'category', data: ['今天', '1-3天', '4-7天', '8-14天', '15天+'], axisLabel: { fontSize: 11 } },
  yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
  series: [
    {
      type: 'bar',
      data: reviewBuckets.value,
      barWidth: '52%',
      itemStyle: { color: '#3c3489', borderRadius: [4, 4, 0, 0] }
    }
  ]
}))

// ===== 移动端沉浸式背词 =====
const immersive = ref(false)
const cardsSection = ref<HTMLElement | null>(null)
function toggleImmersive() {
  immersive.value = !immersive.value
  const el = cardsSection.value
  if (immersive.value) {
    // 请求真实全屏（移动端隐藏地址栏，获得纯净沉浸区）
    el?.requestFullscreen?.().catch(() => {})
  } else if (typeof document !== 'undefined' && document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {})
  }
}
function exitImmersiveOnly() {
  immersive.value = false
  if (typeof document !== 'undefined' && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
}
let touchStartX = 0
let touchStartY = 0
function onCardTouchStart(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!t) return
  touchStartX = t.clientX
  touchStartY = t.clientY
}
function onCardTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!t) return
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  // 横向滑动：左滑=认识，右滑=忘记；纵向滑动忽略（防止误触）
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) void gradeCard('good')
    else void gradeCard('again')
  }
}

const trainingType = ref<QuestionType>('vocab_grammar')
const trainingTypeLabel = computed(() => EXAM_SECTIONS.find((s) => s.key === trainingType.value)?.name || '')
const questionsOfType = computed(() => allDegreeQuestions.value.filter((q) => q.type === trainingType.value))
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
const mockExamVisible = ref(false)
const currentMockPaper = ref<{ id: string; title: string; no: number }>({ id: '', title: '', no: 1 })

function typeLabel(t?: QuestionType | null) {
  return EXAM_SECTIONS.find((s) => s.key === t)?.name || '通用'
}

async function loadAll() {
  const [settingsData, progressData, mistakesData, practiceData, notesData, wordBookData] = await Promise.all([
    svc.loadDegreeSettings(),
    svc.loadWordProgress(),
    svc.loadMistakes(),
    svc.loadPractice(),
    svc.loadFavorites('note'),
    svc.loadFavorites('word')
  ])
  settings.value = settingsData
  manualStreakInput.value = settingsData.manualStreak ?? 0
  const ds = getStudySettings('degree')
  degreeRemindDue.value = ds.remindDue
  degreeGraduatedReturn.value = ds.graduatedReturn
  wordProgress.value = progressData
  mistakes.value = mistakesData
  practice.value = practiceData
  notes.value = notesData
  wordBook.value = wordBookData
}

function startStudy() {
  activeTab.value = 'cards'
}

// ===== 闪卡模式（SRS 复习队列：到期词优先 + 每日新词上限） =====
const cardStarted = ref(false)
const cardQueue = ref<(typeof degreeWords)[number][]>([])
const cardReviewedCount = ref(0)
const cardFlipped = ref(false)
const isMobileDevice = ref(typeof window !== 'undefined' && window.innerWidth <= 768)
// 注意：卡片统计与训练队列统一基于「全量词库」，不随词书筛选器变化（B1 修复：避免切 tab 后统计漂移）
const cardNewToday = computed(() => {
  const fresh = degreeWords.filter((w) => !wordProgress.value[w.word]).length
  return Math.min(fresh, settings.value.newPerDay || 15)
})
const cardDueCount = computed(() => {
  const today = todayStr()
  let due = 0
  for (const w of degreeWords) {
    const p = wordProgress.value[w.word]
    if (!p) continue
    if (p.status !== 'graduated' && (p.due ?? today) <= today) due++
  }
  return due // 仅到期复习（不含新词）
})

const currentCardWord = computed(() => cardQueue.value[0] ?? null)
const cardPercent = computed(() => {
  const total = cardQueue.value.length + cardReviewedCount.value
  if (!total) return 0
  return Math.round((cardReviewedCount.value / total) * 100)
})

function buildCardQueue(dueOnly = false) {
  cardQueue.value = buildDegreeReviewQueue(degreeWords, wordProgress.value, {
    newPerDay: settings.value.newPerDay || 15,
    dueOnly,
    includeGraduated: getStudySettings('degree').graduatedReturn
  })
  cardReviewedCount.value = 0
}

function startCardMode() {
  buildCardQueue(false)
  cardStarted.value = true
  cardFlipped.value = false
  const w = currentCardWord.value
  if (w && !examples.value[w.word]) loadExample(w.word)
}

function startCardReviewMode() {
  buildCardQueue(true)
  cardStarted.value = true
  cardFlipped.value = false
  const w = currentCardWord.value
  if (w && !examples.value[w.word]) loadExample(w.word)
}

function exitCardMode() {
  if (immersive.value) {
    exitImmersiveOnly()
    return
  }
  cardStarted.value = false
  cardFlipped.value = false
}

async function gradeCard(g: SrsGrade) {
  const w = currentCardWord.value
  if (!w) return
  const prev = wordProgress.value[w.word]
  const next = reviewWord(prev, g)
  wordProgress.value = { ...wordProgress.value, [w.word]: next }
  await svc.saveWordProgress(w.word, next)
  cardReviewedCount.value++
  if (g === 'again') {
    cardQueue.value.push(w)
  }
  cardQueue.value.shift()
  cardFlipped.value = false
  const nextW = currentCardWord.value
  if (nextW && !examples.value[nextW.word]) loadExample(nextW.word)
}

function skipCard() {
  const w = currentCardWord.value
  if (!w) return
  cardQueue.value.shift()
  cardFlipped.value = false
  const nextW = currentCardWord.value
  if (nextW && !examples.value[nextW.word]) loadExample(nextW.word)
}

// 键盘快捷键（PC端）
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!cardStarted.value) return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cardFlipped.value = !cardFlipped.value }
    else if (e.key === '1') { e.preventDefault(); void gradeCard('again') }
    else if (e.key === '2') { e.preventDefault(); void gradeCard('good') }
    else if (e.key === '3') { e.preventDefault(); void gradeCard('easy') }
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); skipCard() }
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
function optLetter(i: number): string {
  return String.fromCharCode(65 + i)
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
  const orig = allDegreeQuestions.value.find((q) => q.id === m.questionId)
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

// ===== 统一单词详情（三模块共用同一组件） =====
const wordDetailVisible = ref(false)
const wordDetail = ref<DegreeWord | null>(null)
/** 形近词候选池：本模块全部单词 */
const degreeWordList = computed(() => degreeWords.map((w) => w.word))
function openWordDetail(w: DegreeWord) {
  wordDetail.value = w
  wordDetailVisible.value = true
}
async function onDetailAddWordBook(word: string) {
  const w = degreeWords.find((x) => x.word === word)
  await addWordBook({ word, definition: w?.definition || '' })
}
async function onDetailMastered(word: string) {
  // 循环推进到「已掌握」即停，避免多次点击
  for (let i = 0; i < 3; i++) {
    if (wordProgress.value[word]?.status === 'graduated') break
    await cycleWord(word)
  }
  ElMessage.success('已标记为掌握')
}

function openPreview(m: MaterialMeta) {
  previewUrl.value = base + m.file
  previewTitle.value = m.title
  previewVisible.value = true
}
async function startMock(p: { id: string; title: string; no: number }) {
  // 题库已改为按需加载，开考前确保就绪，避免弹窗里没有题目
  await ensureQuestions()
  currentMockPaper.value = p
  mockExamVisible.value = true
}

async function saveSettings() {
  settings.value.manualStreak = manualStreakInput.value
  await svc.saveDegreeSettings(settings.value)
  // 备考台单词学习设置（待复习提醒 / 已掌握回流）存本地，三模块各自独立
  saveStudySettings('degree', { remindDue: degreeRemindDue.value, graduatedReturn: degreeGraduatedReturn.value })
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
  const content = noteInput.value.trim()
  if (!content) {
    ElMessage.warning('笔记内容不能为空')
    return
  }
  const title = noteTitleInput.value.trim() || null
  // 乐观更新：先清空输入并关闭弹窗，再同步云端，避免用户以为没保存成功
  noteInput.value = ''
  noteTitleInput.value = ''
  noteVisible.value = false
  const tempId = `local_${Date.now()}`
  const tempRec: FavoriteRec = {
    id: tempId,
    kind: 'note',
    refId: null,
    title,
    content,
    createdAt: new Date().toISOString()
  }
  notes.value.unshift(tempRec)
  try {
    await svc.addFavorite('note', content, null, title)
    notes.value = await svc.loadFavorites('note')
    ElMessage.success('笔记已保存')
  } catch (e) {
    ElMessage.warning('笔记已保存到本地，但云端同步失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

async function removeFav(id: string, isMistake = false) {
  if (isMistake) {
    await svc.removeMistake(id)
    mistakes.value = await svc.loadMistakes()
  } else {
    await svc.removeFavorite(id)
    notes.value = await svc.loadFavorites('note')
    wordBook.value = await svc.loadFavorites('word')
  }
}

onMounted(() => {
  loadAll()
  // 重型数据延后加载（题库 907KB + 资料库文章 394KB）：
  // 先让首屏渲染出来，再后台补齐，避免进入备考台时同步解析大数组造成卡顿
  window.setTimeout(() => {
    void ensureQuestions()
  }, 300)
  window.setTimeout(() => {
    void ensureArticles()
  }, 1500)
  // 移动端检测：窄屏默认折叠记忆区
  syncMobile()
  if (isMobile.value) memOpen.value = false
  window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').addEventListener('change', onMobileChange)
  // 进入页面即补发离线队列中未成功的删除/写入（数据可靠性兜底）
  svc.flushQueue().catch((e) => console.warn('[DegreeEnglish] 离线队列重试失败', e))
  // 内容数据落地数据库：首次进入且云端内容表为空时，后台批量注入词库/题库/词组（不阻塞 UI，失败静默兜底）
  ensureContentSeeded().catch((e) => console.warn('[DegreeEnglish] 内容 lazy-seed 失败', e))
  // 划词翻译浮层：监听选区变化（桌面 mouseup / 移动端 touchend）
  if (typeof document !== 'undefined') {
    document.addEventListener('mouseup', onTextSelected)
    document.addEventListener('touchend', onTextSelected)
    document.addEventListener('scroll', hideFloatSel, true)
    // 系统手势退出全屏时同步关闭沉浸式
    document.addEventListener('fullscreenchange', onFullscreenChange)
  }
})
function onFullscreenChange() {
  if (typeof document !== 'undefined' && !document.fullscreenElement) immersive.value = false
}
onBeforeUnmount(() => {
  window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').removeEventListener('change', onMobileChange)
  if (typeof document !== 'undefined') {
    document.removeEventListener('mouseup', onTextSelected)
    document.removeEventListener('touchend', onTextSelected)
    document.removeEventListener('scroll', hideFloatSel, true)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  }
  if (typeof document !== 'undefined' && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
})
</script>

<style scoped>
/* ===== 模块标题栏（与 PageHeader / AI 助手页完全一致，对齐图3） ===== */
.page-header-card {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e6e3f2);
  border-radius: var(--radius);
  box-shadow: 0 2px 12px rgba(34, 48, 78, 0.06);
  margin-bottom: 14px;
}
/* 2.0 备考台入口引导卡 */
.deg-v2-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  margin-bottom: 14px;
  border-radius: var(--radius, 14px);
  background: linear-gradient(135deg, rgba(124, 111, 214, 0.10), rgba(83, 74, 183, 0.06));
  border: 1px solid rgba(83, 74, 183, 0.18);
  cursor: pointer;
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.deg-v2-banner:hover {
  box-shadow: 0 6px 18px rgba(83, 74, 183, 0.16);
  transform: translateY(-1px);
}
.deg-v2-ico {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(135deg, #7c6fd6, #534ab7);
  box-shadow: 0 6px 16px rgba(83, 74, 183, 0.3);
}
.deg-v2-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.deg-v2-text strong {
  font-size: 15px;
  color: var(--text-strong, #1a1a2e);
  font-weight: 600;
}
.deg-v2-text span {
  font-size: 12.5px;
  color: var(--text-muted, #8a86a8);
  line-height: 1.45;
}
.deg-v2-banner .el-button {
  flex-shrink: 0;
}
@media (max-width: 768px) {
  .deg-v2-banner {
    flex-wrap: wrap;
    padding: 12px 14px;
  }
  .deg-v2-text {
    flex-basis: 100%;
    order: 3;
  }
  .deg-v2-banner .el-button {
    margin-left: auto;
  }
}
/* 学位英语品牌色：紫色渐变图标 */
.deg-header-main .ph-icon {
  background: linear-gradient(135deg, #7c6fd6, #534ab7) !important;
  box-shadow: 0 6px 16px rgba(83, 74, 183, 0.3) !important;
}
.ph-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  min-width: 0;
}
.ph-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.ph-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, #7c6fd6, #534ab7);
  color: #fff;
  box-shadow: 0 6px 16px rgba(83, 74, 183, 0.3);
}
.ph-text { min-width: 0; }
.ph-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-strong, #1a1a2e);
  line-height: 1.3;
  /* 防止中文标题在任何情况下竖排 */
  word-break: keep-all;
  white-space: nowrap;
}
.ph-sub {
  margin: 2px 0 0;
  font-size: 12.5px;
  font-weight: 400;
  color: var(--text-muted, #888);
  line-height: 1.55;
}
.ph-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.degree-view {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 18px calc(18px + env(safe-area-inset-bottom));
  width: 100%;
  box-sizing: border-box;
  /* 与现有系统白底一致 */
  background: #f8fafc;
  /* 与 AI 助手页 .ai-page 完全一致的容器尺寸 */
}

/* ===== 顶部导航栏（与四六级 .topnav 完全一致的尺寸规格） ===== */
.de-topnav {
  display: flex;
  position: relative;
  z-index: 20;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e6e3f2);
  border-radius: var(--radius);
  box-shadow: 0 3px 10px rgba(34, 48, 78, 0.06);
  padding: 8px 12px;
  margin: 0 auto 12px;
  /* 与四六级一致：满宽不受额外缩进 */
  max-width: none;
  width: 100%;
  gap: 4px;
  overflow-x: auto;
}
.de-nav-item {
  flex: 1 1 0;
  min-width: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 9px;
  background: transparent;
  color: #5B6A86;
  font-weight: 700;
  font-size: 13px;
  border: none;
  cursor: pointer;
  transition: all 0.12s ease-out; /* 缩短过渡 */
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transform: translateZ(0);
  will-change: background-color, color, box-shadow;
}
.de-nav-item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.de-nav-item:hover { background: #F4F3FB; color: #22304E; }
.de-nav-item:active { transform: scale(0.97); }
.de-nav-item.active {
  background: linear-gradient(135deg, #534ab7, #7c6fd6);
  color: #fff;
  box-shadow: 0 4px 12px rgba(83, 74, 183, 0.25);
}

/* ===== 区块分割线（主要区域之间） ===== */
.degree-view > .page-header-card,
.degree-view > .de-topnav,
.degree-view > .dh-stats,
.degree-view > .dh-nav,
.degree-view > .panel {
  margin-bottom: 12px;
}
.degree-view > .dh-stats {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border, #e6e3f2);
}
.degree-view > .dh-nav {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border, #e6e3f2);
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
  gap: 16px;
  margin-bottom: 12px;
}
.dh-stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  text-align: center;
}
.dh-stat-label {
  display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 3px;
}
.dh-stat-val {
  font-size: 22px; font-weight: 800;
}
.dh-stat-val.purple { color: #534ab7; }
.dh-stat-val.blue { color: #185fa5; }
.dh-stat-val.green { color: #0f6e56; }
.dh-stat-val.orange { color: #854f0b; }
.dh-stat-val small { font-size: 13px; font-weight: 400; }
.dh-stat-sub { display: block; font-size: 11px; color: var(--text-faint); font-weight: 400; margin-top: 2px; }

/* 导航 tab（nav-item 圆角按钮风格，与系统其他模块统一，对齐图3） */
.dh-nav {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  margin-bottom: 12px;
  padding-bottom: 2px;
}
.dh-nav-item {
  flex: 1 1 0;
  min-width: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 9px;
  background: transparent;
  color: var(--text-muted);
  font-weight: 700;
  font-size: 12.5px;
  border: none;
  cursor: pointer;
  transition: all 0.12s ease-out; /* 缩短过渡时间加快响应感 */
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  transform: translateZ(0);
  will-change: background-color, color, box-shadow;
}
.dh-nav-item:hover { background: var(--surface-2, #f5f5fa); color: var(--text-strong); }
.dh-nav-item:active { transform: scale(0.97); }
.dh-nav-item.active {
  background: linear-gradient(135deg, #534ab7, #7c6fd6);
  color: #fff;
  box-shadow: 0 4px 12px rgba(83, 74, 183, 0.25);
}
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  touch-action: pan-y;
}
/* 卡片/按钮通用点击反馈 */
.panel:active,
.type-card:active,
.quiz-card:active,
.req-card:active { transform: scale(0.995); }
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
  border-radius: 10px;
  padding: 14px;
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
  padding: 10px;
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
  border-radius: 10px;
  padding: 12px;
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
  padding: 10px 12px;
}
.word-item.weak {
  border-color: #f09595;
  background: #fdf3f3;
}
.word-main-click {
  cursor: pointer;
  border-radius: 10px;
  transition: background 0.18s ease;
}
.word-main-click:active {
  background: #f1f5f9;
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
.word-phon,
.word-phonetic {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: 6px;
  font-weight: 400;
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
.card-start-actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.card-dash {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
  width: 100%; max-width: 460px; margin-bottom: 14px;
}
.card-dash-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 6px; }
.card-dash-stat b { display: block; font-size: 19px; font-weight: 800; line-height: 1.2; }
.card-dash-stat span { font-size: 11px; color: var(--text-faint); }
.card-dash-stat .card-dash-sub { display: block; font-size: 10px; color: var(--text-faint); margin-top: 2px; }
.card-dash-stat b.blue { color: #0ea5e9; }
.card-dash-stat b.orange { color: #f59e0b; }
.card-dash-stat b.green { color: #2e9e6b; }
.card-dash-stat b.purple { color: #534ab7; }
.de-set-hint { font-size: 11px; color: var(--text-faint); margin-left: 8px; }
@media (max-width: 640px) {
  .card-dash { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

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
  border-radius: 10px;
  padding: 14px 16px;
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
  padding: 12px;
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
  border-radius: 10px;
  padding: 14px;
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
  grid-template-columns: 260px 1fr;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  min-height: 400px;
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
  border-radius: 10px;
  padding: 12px;
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
  padding: 10px 12px;
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
  gap: 14px;
  padding: 14px;
  background: linear-gradient(135deg, #f6f5ff, #fff);
  border-radius: 10px;
  margin-bottom: 12px;
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
  border-radius: 10px;
  padding: 12px 8px;
  text-align: center;
}
.mine-stat-num { font-size: 22px; font-weight: 800; }
.mine-stat-num.purple { color: #534ab7; }
.mine-stat-num.blue { color: #185fa5; }
.mine-stat-num.green { color: #0f6e56; }
.mine-stat-num.orange { color: #854f0b; }
.mine-stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.mine-progress { margin-bottom: 16px; }
.mine-ring-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: #faf8ff;
  border-radius: 10px;
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
  /* 标题栏移动端适配（核心修复：防止竖排） */
  .page-header-card { margin-bottom: 10px; }
  .page-header-card .ph-inner {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }
  .page-header-card .ph-brand {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .page-header-card .ph-title {
    font-size: 16px;
    /* 防止中文标题竖排：禁止折行 */
    word-break: keep-all;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .page-header-card .ph-sub { display: none; }
  .page-header-card .ph-actions {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 8px;
  }
  .page-header-card .ph-actions .el-button { margin: 0; }
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
  .degree-view { padding: 0 14px calc(84px + env(safe-area-inset-bottom)); }
  .dh-header { padding: 10px 12px; }
  .dh-title { font-size: 17px; }
  .dh-sub { font-size: 12px; -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
  .degree-view > .dh-stats,
  .degree-view > .dh-nav { margin-bottom: 10px; padding-bottom: 8px; }
  /* 统计卡：2x2 等宽对齐，值不溢出 */
  .dh-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .dh-stat { padding: 10px 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .dh-stat-label { font-size: 12px; }
  .dh-stat-val { font-size: 19px; line-height: 1.15; word-break: break-word; }
  .dh-stat-val small { font-size: 11px; }
  /* 导航 tab：4 列网格、2 行对齐，彻底去掉横向滚动 */
  .dh-nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; overflow: visible; }
  .dh-nav-item { min-width: 0; flex: initial; padding: 9px 4px; font-size: 12px; border-radius: 9px; }
  /* 步骤指示器：等宽一行不滚动，标签截断防溢出 */
  .step-indicator { flex-wrap: nowrap; overflow: visible; gap: 6px; margin-bottom: 12px; }
  .step-dot { flex: 1 1 0; min-width: 0; padding: 7px 6px; }
  .step-label { overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .panel { padding: 14px; }
  /* 记忆区移动端：标题可点、间距收紧、图表更矮 */
  .memory-title { margin-top: 12px; }
  .memory-grid { gap: 8px; }
  .memory-cell { padding: 8px 10px; }
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
  /* 标题栏超小屏：图标+标题横排不变，按钮全宽 */
  .page-header-card .ph-inner { padding: 10px 12px; gap: 8px; }
  .page-header-card .ph-brand { gap: 8px; }
  .page-header-card .ph-icon { width: 36px; height: 36px; border-radius: 10px; }
  .page-header-card .ph-title { font-size: 15px; }
  .page-header-card .ph-sub { font-size: 11px; -webkit-line-clamp: 1; }
  .page-header-card .ph-actions {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 6px;
  }
  .page-header-card .ph-actions .el-button { width: auto; margin: 0; }

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
  .step-indicator { flex-wrap: nowrap; gap: 6px; }
  .step-dot { padding: 7px 6px; font-size: 12px; }
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
  /* 闪卡小屏：操作按钮严格统一宽度/边距/高度，左右对齐 */
  .flashcard-inner { min-height: 200px; }
  .fc-word { font-size: 22px; }
  .flashcard-front, .flashcard-back { padding: 20px 16px; }
  .fc-def { font-size: 14.5px; }
  .flashcard-ops {
    flex-direction: column;
    gap: 8px;
    padding: 0 2px;
  }
  .flashcard-ops > .fc-nav-btn,
  .flashcard-ops > .fc-accent,
  .flashcard-ops > .fc-actions {
    width: 100%;
    box-sizing: border-box;
  }
  .fc-nav-btn {
    width: 100%;
    text-align: center;
    margin: 0;
    padding: 10px 14px;
    font-size: 14px;
    border-radius: 10px;
  }
  .fc-accent {
    justify-content: center;
    margin: 0;
  }
  .fc-actions {
    flex-direction: column;
    gap: 8px;
  }
  .fc-actions .el-button {
    width: 100%;
    margin: 0 !important;
    padding: 10px 14px;
    font-size: 14px;
    border-radius: 10px;
    height: auto;
  }
  .fc-actions .el-button + .el-button {
    margin-left: 0 !important;
  }
  /* 我的视图小屏 */
  .mine-stats { grid-template-columns: repeat(2, 1fr); }
  .mine-header { flex-direction: column; text-align: center; padding: 14px; }
  .mine-ring-row { flex-direction: column; text-align: center; }
  .mine-actions { flex-direction: column; }
  .mine-actions .el-button { width: 100%; }
}

/* ===== 划词翻译浮层 ===== */
.word-float {
  position: fixed;
  transform: translate(-50%, -100%);
  z-index: 3000;
  min-width: 180px;
  max-width: 82vw;
  background: #fff;
  border: 1px solid var(--border, #e6e3f2);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(40, 30, 90, 0.18);
  padding: 10px 12px;
  color: #2b2350;
}
.word-float .wf-text {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  word-break: break-word;
  padding-right: 18px;
}
.word-float .wf-actions { display: flex; gap: 8px; }
.word-float .wf-btn {
  flex: 1;
  border: 1px solid var(--border, #e6e3f2);
  background: #f5f3ff;
  color: #3c3489;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
}
.word-float .wf-btn:active { background: #e9e5ff; }
.word-float .wf-btn:disabled { opacity: 0.6; cursor: default; }
.word-float .wf-result {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #4a4170;
  background: #f7f6ff;
  border-radius: 8px;
  padding: 6px 8px;
}
.word-float .wf-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: #9a93c0;
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ===== 移动端沉浸式背词 ===== */
.flashcard-section.immersive,
section.immersive {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2500 !important;
  background: var(--surface, #fff);
  margin: 0 !important;
  border-radius: 0 !important;
  border: none !important;
  padding: 16px !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.immersive .flashcard-progress { flex: none; margin-bottom: 10px; }
.immersive .flashcard {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.immersive .flashcard-inner {
  flex: 1 1 auto;
  min-height: 0;
}
.immersive .flashcard-back {
  justify-content: flex-start;
  overflow-y: auto;
}
.immersive .flashcard-ops {
  flex: none;
  margin-top: 10px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.immersive .fc-shortcuts { flex: none; margin-top: 6px; }
.immersive-exit {
  background: #3c3489 !important;
  color: #fff !important;
  font-size: 12px !important;
  padding: 4px 10px !important;
}
.immersible-btn.on { background: #3c3489; color: #fff; }
/* 读音美/英切换 */
.fc-accent {
  display: flex;
  align-items: center;
  gap: 4px;
}
.fc-accent .accent-label { font-size: 12px; color: #6b6390; }
.fc-accent .accent-opt {
  border: 1px solid var(--border, #e6e3f2);
  background: #fff;
  color: #6b6390;
  border-radius: 6px;
  width: 28px;
  height: 26px;
  font-size: 12px;
  cursor: pointer;
}
.fc-accent .accent-opt.on { background: #534ab7; color: #fff; border-color: #534ab7; }

/* ===== 记忆与掌握可视化 ===== */
.memory-title { margin-top: 18px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
.mem-caret { color: var(--text-muted); font-size: 13px; font-weight: 400; }
.memory-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.memory-cell {
  background: var(--surface-soft, #f7f6ff);
  border: 1px solid var(--border, #e6e3f2);
  border-radius: 12px;
  padding: 10px 12px;
}
.memory-cell-wide { grid-column: 1 / -1; }
.mc-label { font-size: 13px; color: #6b6390; margin-bottom: 4px; font-weight: 600; }
.ext-tag {
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  background: #b9a7ff;
  border-radius: 6px;
  padding: 1px 7px;
  vertical-align: middle;
  white-space: nowrap;
}
@media (max-width: 768px) {
  .memory-grid { grid-template-columns: 1fr; }
  .memory-cell-wide { grid-column: auto; }
}
</style>

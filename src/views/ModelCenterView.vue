<template>
  <div class="mc-shell">
    <PageHeader
      title="模型中心"
      subtitle="实时额度 · 已配置模型 · 免费模型清单 · 全程本地记录，不消耗任何积分"
      :icon="MagicStick"
    >
      <el-switch v-model="autoRefresh" active-text="自动检测(60s)" @change="toggleAuto" />
      <el-button type="primary" :loading="checking" @click="runCheck">
        <el-icon><Refresh /></el-icon> 立即检测
      </el-button>
    </PageHeader>

    <!-- ===== 实时额度卡片（硅基流动） ===== -->
    <div class="mc-balance" :class="{ ok: balance.supported, warn: !balance.supported }">
      <div class="mc-balance-head">
        <div class="mc-balance-title">
          <el-icon><Coin /></el-icon>
          <span>硅基流动 · 实时额度</span>
        </div>
        <el-tag v-if="balance.supported" type="success" effect="light" size="small">已连接</el-tag>
        <el-tag v-else type="info" effect="light" size="small">未获取</el-tag>
      </div>

      <div v-if="balance.supported" class="mc-balance-body">
        <div class="mc-balance-main">
          <span class="mc-balance-num">{{ formatMoney(balance.totalBalance) }}</span>
          <span class="mc-balance-unit">{{ balance.currency || 'CNY' }}</span>
        </div>
        <div class="mc-balance-sub">
          <span v-if="balance.freeBalance !== undefined">免费额度：{{ formatMoney(balance.freeBalance) }}</span>
          <span class="mc-balance-time">更新于 {{ fmtTime(balance.fetchedAt) }}</span>
        </div>
      </div>
      <div v-else class="mc-balance-hint">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ balance.hint || '请在「AI 助手」配置中填入硅基流动 API Key 后查看额度' }}</span>
      </div>
    </div>

    <!-- ===== 用量统计卡片 ===== -->
    <div class="mc-cards">
      <div class="mc-stat">
        <div class="mc-stat-label">总调用次数</div>
        <div class="mc-stat-value">{{ usage.totalCalls }}</div>
      </div>
      <div class="mc-stat">
        <div class="mc-stat-label">今日调用</div>
        <div class="mc-stat-value">{{ usage.todayCalls }}</div>
      </div>
      <div class="mc-stat">
        <div class="mc-stat-label">免费调用占比</div>
        <div class="mc-stat-value accent">{{ usage.freeRatio }}%</div>
      </div>
      <div class="mc-stat">
        <div class="mc-stat-label">预估消耗 Tokens</div>
        <div class="mc-stat-value">{{ tokenText(usage.totalEstTokens) }}</div>
      </div>
    </div>

    <!-- 阿里百炼·本地用量统计（Fix #2）：真实调用记录，非官方实时额度 -->
    <div class="mc-quota mc-quota-bailian">
      <div class="mc-quota-head">
        <div>
          <h3>阿里百炼 · 本地用量统计</h3>
          <p>
            阿里百炼官方未开放实时余额/额度查询 API，此处展示<strong>本应用真实调用记录</strong>
            （调用次数 + 响应 tokens，来自实际 API 返回，绝不伪造），仅存本地不上云。
          </p>
        </div>
        <div class="mc-quota-actions">
          <el-button link type="primary" @click="openCallDetail">
            <el-icon><DataLine /></el-icon> 查看调用详情
          </el-button>
          <el-button link type="primary" @click="openBailianConsole">查看官方免费额度 ↗</el-button>
          <el-button v-if="bailianQuota === null" link type="primary" @click="enableQuota">设置额度</el-button>
        </div>
      </div>

      <div class="mc-bailian-stats">
        <div class="mc-bailian-stat">
          <div class="mc-bailian-num">{{ bailianUsage.totalCalls }}</div>
          <div class="mc-bailian-label">总调用次数</div>
        </div>
        <div class="mc-bailian-stat">
          <div class="mc-bailian-num">{{ bailianUsage.todayCalls }}</div>
          <div class="mc-bailian-label">今日调用</div>
        </div>
        <div class="mc-bailian-stat">
          <div class="mc-bailian-num">{{ tokenText(bailianUsage.totalTokens) }}</div>
          <div class="mc-bailian-label">累计 Tokens</div>
        </div>
        <div class="mc-bailian-stat">
          <div class="mc-bailian-num">{{ bailianUsage.byModel.length }}</div>
          <div class="mc-bailian-label">调用模型数</div>
        </div>
      </div>

      <div v-if="bailianUsage.byModel.length" class="mc-bailian-models">
        <div class="mc-bailian-model" v-for="m in bailianUsage.byModel" :key="m.model">
          <span class="mc-bm-name" :title="m.model">{{ m.model }}</span>
          <span class="mc-bm-calls">{{ m.calls }} 次</span>
          <span class="mc-bm-tokens">{{ tokenText(m.tokens) }} tok</span>
        </div>
      </div>
      <div v-else class="mc-bailian-empty">暂无百炼调用记录，使用阿里百炼模型对话后将自动累计。</div>

      <!-- 阿里百炼免费模型额度清单：卡片网格 + 搜索/筛选/排序 -->
      <div class="mc-quota-models">
        <div class="mc-qm-head">
          <div class="mc-qm-title">
            <span>阿里百炼免费模型额度（共 {{ bailianQuotaRows.length }} 个）</span>
            <span class="mc-qm-sub">
              已用 {{ usedCount }} 个 · 未用 {{ bailianQuotaRows.length - usedCount }} 个 · 快用完 {{ dangerCount }} 个
            </span>
          </div>
          <span class="mc-qm-tip">免费额度 1,000,000 / 模型 · 有效期至 2026-09-20</span>
        </div>

        <div class="mc-qm-toolbar">
          <el-input
            v-model="searchText"
            placeholder="搜索模型名称"
            clearable
            :prefix-icon="Search"
            class="mc-qm-search"
          />
          <el-radio-group v-model="filterType" size="small">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="used">已使用</el-radio-button>
            <el-radio-button label="unused">未使用</el-radio-button>
            <el-radio-button label="danger">快用完</el-radio-button>
          </el-radio-group>
          <el-select v-model="sortType" size="small" class="mc-qm-sort">
            <el-option label="智能优先级" value="priority" />
            <el-option label="使用率从高到低" value="usageDesc" />
            <el-option label="使用率从低到高" value="usageAsc" />
            <el-option label="模型名称" value="name" />
          </el-select>
        </div>

        <div class="mc-qm-grid">
          <div
            v-for="r in pagedRows"
            :key="r.id"
            class="mc-qm-card"
            :class="{ danger: r.status === 'danger', unused: r.used === 0 }"
          >
            <div class="mc-qm-card-head">
              <span class="mc-qm-name" :title="r.model">{{ r.model }}</span>
              <el-tag v-if="r.used === 0" type="info" effect="plain" size="small">未使用</el-tag>
              <el-tag v-else-if="r.status === 'danger'" type="danger" effect="plain" size="small">快用完</el-tag>
              <el-tag v-else type="success" effect="plain" size="small">正常</el-tag>
            </div>
            <div class="mc-qm-card-bar">
              <div
                class="mc-quota-fill"
                :class="{ danger: r.status === 'danger' }"
                :style="{ width: r.percent + '%' }"
              ></div>
            </div>
            <div class="mc-qm-card-nums">
              <div>
                <div class="mc-qm-num-label">剩余</div>
                <div class="mc-qm-num remaining">{{ formatNumber(r.remaining) }}</div>
              </div>
              <div class="mc-qm-num-div">/</div>
              <div>
                <div class="mc-qm-num-label">总额度</div>
                <div class="mc-qm-num">{{ formatNumber(r.free) }}</div>
              </div>
              <div class="mc-qm-num-div">·</div>
              <div>
                <div class="mc-qm-num-label">已用</div>
                <div class="mc-qm-num used">{{ formatNumber(r.used) }}</div>
              </div>
            </div>
            <div class="mc-qm-card-meta">
              <span>{{ r.percent }}%</span>
              <span>到期 {{ r.freeUntil }}</span>
            </div>
            <div class="mc-qm-card-foot">
              <el-button link type="primary" size="small" @click="openCalibrate(r)">
                <el-icon><Edit /></el-icon> 校准剩余
              </el-button>
            </div>
          </div>
        </div>

        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[24, 48, 96, 135]"
          :total="filteredRows.length"
          layout="total, sizes, prev, pager, next"
          class="mc-qm-pagination"
        />
      </div>

      <!-- 可选：用户已知额度（免费额度 / 购买额度）自填，用于进度提示 -->
      <div v-if="bailianQuota !== null" class="mc-quota-sub">
        <div class="mc-quota-form">
          <span class="mc-quota-label">已知额度上限</span>
          <el-input-number v-model="quotaInput" :min="0" :step="100" controls-position="right" />
          <el-button type="primary" plain @click="saveQuota">保存额度</el-button>
        </div>
        <div v-if="bailianQuota > 0" class="mc-quota-bar">
          <div class="mc-quota-fill" :class="{ danger: quotaPercent >= 90 }" :style="{ width: quotaPercent + '%' }"></div>
        </div>
        <div v-if="bailianQuota > 0" class="mc-quota-meta">
          已用 {{ bailianUsage.totalCalls }} / 额度 {{ bailianQuota }}（{{ quotaPercent }}%）
        </div>
      </div>
    </div>

    <!-- ===== 超管专用：账号 API 总览（普通账号不渲染，接口层 RLS 双重保险） ===== -->
    <div v-if="isSuperadmin" class="mc-quota mc-admin mc-quota-admin">
      <div class="mc-quota-head">
        <div>
          <h3>账号 API 总览（超管专用）</h3>
          <p>
            每个账号的 API Key 由本人配置、云端加密留存、互相不可见；
            超级管理员可在此<strong>查看明文</strong>并<strong>一键使用</strong>任意账号的 API 配置。
            各账号的「调用量/问答」仅在本人「AI 助手 / 模型中心」内可见，互不串号。
          </p>
        </div>
        <div class="mc-quota-actions">
          <el-tag v-if="adminRows.length" type="info" effect="plain" size="small">
            共 {{ adminRows.length }} 个账号 · {{ adminRows.filter((r) => r.hasKey).length }} 个已配置 Key
          </el-tag>
          <el-button link type="warning" @click="openSetPwdDialog">
            {{ adminPwdHash ? '修改查看密码' : '设置查看密码' }}
          </el-button>
          <el-button link type="primary" :loading="adminLoading" @click="loadAdminOverview">刷新</el-button>
        </div>
      </div>

      <el-alert
        v-if="adminError"
        type="warning"
        :closable="false"
        show-icon
        class="mc-admin-alert"
        :title="adminError"
      />

      <div class="mc-table-wrap mc-admin-table">
        <el-table :data="adminRows" v-loading="adminLoading" empty-text="暂无账号数据（若始终为空，请确认已执行 rls_secure.sql / ai_keys.sql）" style="width: 100%">
          <el-table-column label="账号" min-width="150">
            <template #default="{ row }">
              <div class="mc-acc">
                <span class="mc-acc-name">{{ row.nickname || row.username }}</span>
                <span class="mc-acc-sub">{{ row.username }} · {{ roleText(row.role) }}<template v-if="row.isSelf">（我）</template></span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="服务商" width="120">
            <template #default="{ row }">{{ row.provider ? providerLabel(row.provider) : '—' }}</template>
          </el-table-column>
          <el-table-column label="模型" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.model || '—' }}</template>
          </el-table-column>
          <el-table-column label="API Key" min-width="220">
            <template #default="{ row }">
              <template v-if="row.hasKey">
                <code class="mc-key" :class="{ plain: row.revealedKey }">{{ row.revealedKey || '••••••••••••••••' }}</code>
              </template>
              <el-tag v-else type="info" effect="light" size="small">未配置</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="累计用量" width="110">
            <template #default="{ row }">{{ tokenText(row.usedTokens) }} tok</template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.hasKey" link type="primary" @click="revealKey(row)">
                {{ row.revealedKey ? '隐藏' : '查看' }}
              </el-button>
              <el-button v-if="row.hasKey" link type="success" @click="useKey(row)">使用此 Key</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="mc-tabs">
      <!-- ===== 已配置模型 ===== -->
      <el-tab-pane label="已配置模型" name="configured">
        <div class="mc-banner">
          <el-icon><Setting /></el-icon>
          <span>这里展示你当前在「AI 助手」中激活的配置。可在 <b>AI 助手 → 配置</b> 中切换更多已验证模型。</span>
        </div>
        <div class="mc-table-wrap">
          <el-table :data="configuredModels" empty-text="尚未配置任何模型" style="width: 100%">
            <el-table-column label="厂商" width="160">
              <template #default="{ row }">
                <span>{{ providerLabel(row.provider) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="model" label="模型" min-width="220" />
            <el-table-column prop="baseUrl" label="接口地址" min-width="240" show-overflow-tooltip />
            <el-table-column label="类型" width="110">
              <template #default="{ row }">
                <el-tag :type="row.isFree ? 'success' : 'warning'" effect="light" size="small">
                  {{ row.isFree ? '免费' : '付费' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="密钥状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.hasKey ? 'success' : 'info'" effect="light" size="small">
                  {{ row.hasKey ? '已配置' : '未配置' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ===== 免费模型清单 ===== -->
      <el-tab-pane label="免费模型清单" name="free">
        <div class="mc-banner">
          <el-icon><Promotion /></el-icon>
          <span>
            免费模型来自各厂商公开免费档、<b>OpenRouter 实时模型列表</b>（前端直连探测）与<b>你自定义的免费模型</b>。
            纯前端调用，<b>不消耗任何积分/额度</b>，也不写入云端。来源为「实时」的会现场探测可调用性，方便你直接配置与调用。
          </span>
        </div>

        <!-- 筛选栏：厂商 / 状态 / 来源 + 刷新 + 添加自定义 -->
        <div class="mc-free-toolbar">
          <el-select v-model="freeProviderFilter" placeholder="厂商" clearable size="default" class="mc-free-sel">
            <el-option label="全部厂商" value="" />
            <el-option v-for="p in freeProviders" :key="p" :label="providerLabel(p)" :value="p" />
          </el-select>
          <el-select v-model="freeStatusFilter" placeholder="状态" clearable size="default" class="mc-free-sel">
            <el-option label="全部状态" value="" />
            <el-option label="可调用" value="callable" />
            <el-option label="受限" value="limited" />
            <el-option label="暂不可用" value="unavailable" />
            <el-option label="未知" value="unknown" />
          </el-select>
          <el-select v-model="freeSourceFilter" placeholder="来源" clearable size="default" class="mc-free-sel">
            <el-option label="全部来源" value="" />
            <el-option label="实时" value="live" />
            <el-option label="预置" value="curated" />
            <el-option label="自定义" value="custom" />
          </el-select>
          <div class="mc-free-spacer"></div>
          <el-button :loading="checking" @click="refreshFreeList">
            <el-icon><Refresh /></el-icon> 刷新检测
          </el-button>
          <el-button type="primary" plain @click="openCustomDialog">
            <el-icon><Plus /></el-icon> 添加自定义
          </el-button>
        </div>

        <div class="mc-table-wrap">
          <el-table :data="pagedFreeList" empty-text="点击「刷新检测」获取免费模型清单" style="width: 100%">
            <el-table-column label="厂商" width="130">
              <template #default="{ row }">{{ providerLabel(row.provider) }}</template>
            </el-table-column>
            <el-table-column prop="model" label="模型" min-width="200" />
            <el-table-column prop="note" label="说明" min-width="150" show-overflow-tooltip />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <span class="mc-status" :class="statusClass(row.status)">
                  <span class="dot"></span>{{ statusText(row.status) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="来源" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.source === 'live' ? 'success' : row.source === 'custom' ? 'warning' : 'info'" effect="light">
                  {{ row.source === 'live' ? '实时' : row.source === 'custom' ? '自定义' : '预置' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最近监测" width="150">
              <template #default="{ row }">{{ fmtTime(row.lastChecked) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button v-if="row.source === 'custom'" link type="danger" size="small" @click="removeCustom(row)">删除</el-button>
                <el-button link type="primary" size="small" @click="goConfig(row)">去配置</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="mc-free-foot">
            <span class="mc-free-foot-info">
              默认展示最新 {{ freePageSize }} 条（按最近监测倒序），共 {{ filteredFreeList.length }} 条
            </span>
            <el-pagination
              v-model:current-page="freePage"
              :page-size="freePageSize"
              :total="filteredFreeList.length"
              layout="prev, pager, next"
              small
              background
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 超管查看密码设置/验证弹框 -->
    <el-dialog
      v-model="pwdDialogVisible"
      :title="pwdDialogMode === 'set' ? '设置 API Key 查看密码' : '验证查看密码'"
      width="420px"
      :close-on-click-modal="false"
      destroy-on-close
      class="mc-pwd-dialog"
    >
      <div v-if="pwdDialogMode === 'set'" class="mc-pwd-tips">
        设置后，点击「查看」或「使用此 Key」需先输入密码才能解密明文。
        <br>密码仅保存其 SHA-256 摘要，不存明文；验证通过后仅在内存中保留 10 分钟。
      </div>
      <div v-else class="mc-pwd-tips">
        请输入查看密码以解密该账号的 API Key 明文。
      </div>

      <el-form label-position="top" class="mc-pwd-form">
        <el-form-item label="查看密码">
          <el-input
            v-model="pwdForm.password"
            type="password"
            placeholder="请输入查看密码"
            show-password
            maxlength="32"
            @keyup.enter="submitPwdDialog"
          />
        </el-form-item>
        <el-form-item v-if="pwdDialogMode === 'set'" label="确认密码">
          <el-input
            v-model="pwdForm.confirm"
            type="password"
            placeholder="再次输入查看密码"
            show-password
            maxlength="32"
            @keyup.enter="submitPwdDialog"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPwdDialog">{{ pwdDialogMode === 'set' ? '保存' : '确认' }}</el-button>
      </template>
    </el-dialog>

    <!-- 调用详情弹框（SVG 自绘折线，不引入图表库） -->
    <el-dialog v-model="callDetailVisible" title="模型调用详情" width="880px" class="mc-call-dialog" destroy-on-close>
      <div class="mc-call-stats">
        <div class="mc-call-stat">
          <div class="mc-call-num">{{ callDetail.modelCount }}</div>
          <div class="mc-call-label">调用模型数</div>
        </div>
        <div class="mc-call-stat">
          <div class="mc-call-num">{{ callDetail.successCalls }}</div>
          <div class="mc-call-label">调用成功总次数</div>
        </div>
        <div class="mc-call-stat">
          <div class="mc-call-num">{{ tokenText(callDetail.totalTokens) }}</div>
          <div class="mc-call-label">Token 总量</div>
        </div>
        <div class="mc-call-stat">
          <div class="mc-call-num">{{ tokenText(callDetail.avgTokens) }}</div>
          <div class="mc-call-label">平均单次 Token</div>
        </div>
      </div>

      <div class="mc-call-chart">
        <div class="mc-call-chart-head">
          <span>逐小时调用 Token 量（本周期 vs 上周期）</span>
          <div class="mc-call-legend">
            <span class="lg lg-today">本周期（今天）</span>
            <span class="lg lg-yesterday">上周期（昨天）</span>
          </div>
        </div>
        <div class="mc-call-chart-body" v-html="callChartSvg"></div>
      </div>

      <div class="mc-call-table">
        <el-table :data="callDetail.byModel" empty-text="暂无调用明细" max-height="220" style="width: 100%">
          <el-table-column prop="model" label="模型" min-width="200" />
          <el-table-column label="调用次数" width="110">
            <template #default="{ row }">{{ row.calls }} 次</template>
          </el-table-column>
          <el-table-column label="Tokens" width="120">
            <template #default="{ row }">{{ tokenText(row.tokens) }} tok</template>
          </el-table-column>
          <el-table-column label="最后调用" width="170">
            <template #default="{ row }">{{ row.lastUsed ? fmtTime(row.lastUsed) : '—' }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 自定义免费模型弹框 -->
    <el-dialog
      v-model="customDialogVisible"
      :title="customForm.id ? '编辑自定义免费模型' : '添加自定义免费模型'"
      width="440px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-position="top" class="mc-custom-form">
        <el-form-item label="厂商" required>
          <el-input v-model="customForm.provider" placeholder="例如：WorkBuddy / 本地 Ollama / 自建" maxlength="40" />
        </el-form-item>
        <el-form-item label="模型名称" required>
          <el-input v-model="customForm.model" placeholder="例如：HY3 / qwen2.5-7b" maxlength="80" />
        </el-form-item>
        <el-form-item label="接口地址（可选）">
          <el-input v-model="customForm.baseUrl" placeholder="https://...  留空表示本地/默认地址" maxlength="200" />
        </el-form-item>
        <el-form-item label="备注（可选）">
          <el-input v-model="customForm.note" type="textarea" :rows="2" placeholder="说明该模型的免费额度/使用方式" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="customSaving" @click="submitCustom">保存</el-button>
      </template>
    </el-dialog>

    <!-- 校准剩余 token 弹框 -->
    <el-dialog v-model="calibrateVisible" title="校准模型剩余 Token" width="420px" :close-on-click-modal="false" destroy-on-close>
      <div v-if="calibrateRow" class="mc-calib">
        <div class="mc-calib-model">{{ calibrateRow.model }}</div>
        <el-form label-position="top">
          <el-form-item label="当前真实剩余 Token">
            <el-input-number v-model="calibrateRemaining" :min="0" :step="1000" controls-position="right" style="width: 100%" />
          </el-form-item>
        </el-form>
        <div class="mc-calib-hint">
          将自动反算：已用 = 总额度 {{ formatNumber(calibrateRow.free) }} − 剩余 {{ formatNumber(calibrateRemaining) }}
          = <b>{{ formatNumber(Math.max(0, calibrateRow.free - calibrateRemaining)) }}</b>
        </div>
      </div>
      <template #footer>
        <el-button @click="calibrateVisible = false">取消</el-button>
        <el-button type="primary" :loading="calibrateSaving" @click="submitCalibrate">保存校准</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick, Refresh, Promotion, Setting, Coin, InfoFilled, Search, DataLine, Edit, Plus } from '@element-plus/icons-vue'
import {
  getUsageStats,
  clearUsage,
  setBailianQuota,
  getBailianQuota,
  classifyFree,
  getBailianUsage,
  getHourlyTokens,
  type UsageSummary,
  type BailianUsage
} from '../services/usageTracker'
import {
  checkFreeModelsV2,
  appendCustomFreeModels,
  sortByLastChecked,
  type FreeModelStatusV2,
  type FreeModelStatusKind
} from '../services/freeModels'
import { getProviderBalance, type ProviderBalance } from '../services/balanceService'
import { loadAiConfig, saveAiConfig, type AiConfig } from '../services/aiService'
import {
  getSavedUser,
  getAllModelUsage,
  listAccounts,
  listAiKeysForAdmin,
  getAllModelUsageForAdmin,
  setModelUsage,
  loadCustomFreeModels,
  saveCustomFreeModel,
  deleteCustomFreeModel,
  type AccountRecord,
  type AiKeyRecord
} from '../services/appDataService'
import PageHeader from '../components/PageHeader.vue'
import { decryptSecret } from '../services/secret'
import { CALLABLE_MODELS } from '../services/modelCatalog'

const PROVIDER_LABELS: Record<string, string> = {
  siliconflow: '硅基流动',
  zhipu: '智谱 AI',
  deepseek: 'DeepSeek',
  volcengine: '火山方舟',
  openrouter: 'OpenRouter',
  ollama: '本地 Ollama',
  bailian: '阿里百炼',
  'openai-compatible': 'OpenAI 兼容'
}
const providerLabel = (p: string): string => PROVIDER_LABELS[p] || p

const router = useRouter()

const activeTab = ref<'configured' | 'free'>('configured')
const usage = ref<UsageSummary>({
  totalCalls: 0,
  todayCalls: 0,
  freeCalls: 0,
  paidCalls: 0,
  freeRatio: 0,
  totalEstTokens: 0,
  byModel: [],
  bailianUsed: 0
})
const bailianQuota = ref<number | null>(null)
const quotaInput = ref<number>(0)

/** 阿里百炼本地真实用量（Fix #2）：调用次数 + 响应 tokens，非官方额度 */
const bailianUsage = ref<BailianUsage>({
  totalCalls: 0,
  todayCalls: 0,
  totalTokens: 0,
  byModel: []
})

const balance = ref<ProviderBalance>({
  provider: 'siliconflow',
  totalBalance: 0,
  fetchedAt: 0,
  supported: false
})

const freeList = ref<FreeModelStatusV2[]>([])
const checking = ref(false)
const autoRefresh = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

/** 阿里百炼各模型额度账本（model_id -> 已用 tokens），来自 Supabase model_usage 表 */
const modelUsageMap = ref<Record<string, number>>({})

/* 百炼额度卡片：搜索 / 筛选 / 排序 / 分页 */
const searchText = ref('')
const filterType = ref<'all' | 'used' | 'unused' | 'danger'>('all')
const sortType = ref<'priority' | 'usageDesc' | 'usageAsc' | 'name'>('priority')
const page = ref(1)
const pageSize = ref(24)

const usedCount = computed(() => bailianQuotaRows.value.filter((r) => r.used > 0).length)
const dangerCount = computed(() => bailianQuotaRows.value.filter((r) => r.remaining < 10000).length)

/**
 * 展示优先级（用户要求：用完的模型不要排在最前）。
 * 快用完(剩<1万且>0) > 正常已用(剩≥1万) > 未使用(已用=0) > 已用完(剩=0 排最后)
 */
const priorityOf = (r: { used: number; remaining: number }): number => {
  if (r.remaining <= 0) return 4
  if (r.used === 0) return 3
  if (r.remaining < 10000) return 1
  return 2
}

const filteredRows = computed(() => {
  let rows = bailianQuotaRows.value
  const kw = searchText.value.trim().toLowerCase()
  if (kw) {
    rows = rows.filter((r) => r.model.toLowerCase().includes(kw))
  }
  // 已使用：剩余 < 免费额度（即已用 > 0）
  if (filterType.value === 'used') rows = rows.filter((r) => r.used > 0)
  if (filterType.value === 'unused') rows = rows.filter((r) => r.used === 0)
  // 快用完：剩余不足 10,000，状态标红
  if (filterType.value === 'danger') rows = rows.filter((r) => r.remaining < 10000)

  if (sortType.value === 'priority') {
    rows = [...rows].sort((a, b) => {
      const pa = priorityOf(a)
      const pb = priorityOf(b)
      if (pa !== pb) return pa - pb
      return b.percent - a.percent // 同档按使用率从高到低
    })
  }
  if (sortType.value === 'usageDesc') rows = [...rows].sort((a, b) => b.percent - a.percent)
  if (sortType.value === 'usageAsc') rows = [...rows].sort((a, b) => a.percent - b.percent)
  if (sortType.value === 'name') rows = [...rows].sort((a, b) => a.model.localeCompare(b.model))

  return rows
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

/* =========================================================================
 * 百炼额度卡「校准剩余」：手动反算已用 = 总额度 - 剩余，直接 upsert 当前账号行
 * ========================================================================= */
interface CalibrateRow { id: string; model: string; free: number; used: number; remaining: number }
const calibrateVisible = ref(false)
const calibrateSaving = ref(false)
const calibrateRow = ref<CalibrateRow | null>(null)
const calibrateRemaining = ref(0)
const openCalibrate = (r: CalibrateRow) => {
  calibrateRow.value = { ...r }
  calibrateRemaining.value = r.remaining
  calibrateVisible.value = true
}
const submitCalibrate = async () => {
  if (!calibrateRow.value) return
  calibrateSaving.value = true
  try {
    const used = Math.max(0, calibrateRow.value.free - calibrateRemaining.value)
    const ok = await setModelUsage(calibrateRow.value.id, used)
    if (ok) {
      ElMessage.success(`已校准：剩余 ${formatNumber(calibrateRemaining.value)}，已用 ${formatNumber(used)}`)
      calibrateVisible.value = false
      await loadModelUsage()
    } else {
      ElMessage.error('校准失败，请重试')
    }
  } finally {
    calibrateSaving.value = false
  }
}

/* =========================================================================
 * 调用详情弹框（SVG 自绘折线图，不引入图表库）
 * ========================================================================= */
interface CallDetailRow { model: string; calls: number; tokens: number; lastUsed: number | null }
interface CallDetail {
  modelCount: number
  successCalls: number
  totalTokens: number
  avgTokens: number
  byModel: CallDetailRow[]
  todayHourly: number[]
  yesterdayHourly: number[]
}
const callDetailVisible = ref(false)
const callDetail = ref<CallDetail>({
  modelCount: 0,
  successCalls: 0,
  totalTokens: 0,
  avgTokens: 0,
  byModel: [],
  todayHourly: [],
  yesterdayHourly: []
})

const openCallDetail = () => {
  const u = usage.value
  const byModel: CallDetailRow[] = u.byModel.map((m) => ({
    model: m.model,
    calls: m.calls,
    tokens: m.tokens,
    lastUsed: m.lastUsed
  }))
  const successCalls = u.totalCalls
  const totalTokens = u.totalEstTokens
  callDetail.value = {
    modelCount: byModel.length,
    successCalls,
    totalTokens,
    avgTokens: successCalls > 0 ? totalTokens / successCalls : 0,
    byModel,
    todayHourly: getHourlyTokens(0),
    yesterdayHourly: getHourlyTokens(1)
  }
  callDetailVisible.value = true
}

/** 自绘逐小时折线图（今天 vs 昨天） */
const callChartSvg = computed(() => {
  const today = callDetail.value.todayHourly
  const yest = callDetail.value.yesterdayHourly
  const W = 800
  const H = 240
  const PL = 44
  const PR = 16
  const PT = 16
  const PB = 28
  const plotW = W - PL - PR
  const plotH = H - PT - PB
  const maxV = Math.max(1, ...today, ...yest)
  const xAt = (i: number) => PL + (plotW * i) / 23
  const yAt = (v: number) => PT + plotH - (plotH * v) / maxV
  const pts = (arr: number[]) => arr.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
  let grid = ''
  for (let g = 0; g <= 4; g++) {
    const y = PT + (plotH * g) / 4
    const val = Math.round((maxV * (4 - g)) / 4)
    grid += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>`
    grid += `<text x="${PL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#94a3b8">${val}</text>`
  }
  let xlab = ''
  for (const i of [0, 6, 12, 18, 23]) {
    xlab += `<text x="${xAt(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${i}时</text>`
  }
  const yestLine = `<polyline fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="5 4" points="${pts(yest)}"/>`
  const todayLine = `<polyline fill="none" stroke="#7c3aed" stroke-width="2.5" points="${pts(today)}"/>`
  let dots = ''
  today.forEach((v, i) => {
    if (v > 0) dots += `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="2.5" fill="#7c3aed"/>`
  })
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">${grid}${xlab}${yestLine}${todayLine}${dots}</svg>`
})

/* =========================================================================
 * 免费模型清单：厂商/状态/来源筛选 + 默认最新 10 条 + 自定义模型
 * ========================================================================= */
const freeProviderFilter = ref('')
const freeStatusFilter = ref('')
const freeSourceFilter = ref('')
const freePage = ref(1)
const freePageSize = ref(10)
const freeProviders = computed(() => Array.from(new Set(freeList.value.map((m) => m.provider))))

const filteredFreeList = computed(() => {
  let list = freeList.value
  if (freeProviderFilter.value) list = list.filter((m) => m.provider === freeProviderFilter.value)
  if (freeStatusFilter.value) list = list.filter((m) => m.status === freeStatusFilter.value)
  if (freeSourceFilter.value) list = list.filter((m) => m.source === freeSourceFilter.value)
  return sortByLastChecked(list)
})
const pagedFreeList = computed(() => {
  const start = (freePage.value - 1) * freePageSize.value
  return filteredFreeList.value.slice(start, start + freePageSize.value)
})

watch([freeProviderFilter, freeStatusFilter, freeSourceFilter], () => {
  freePage.value = 1
})

/** 仅刷新免费模型清单（不动其他模块） */
const refreshFreeList = async () => {
  checking.value = true
  try {
    const base = await checkFreeModelsV2()
    const custom = await loadCustomFreeModels()
    freeList.value = appendCustomFreeModels(base, custom)
  } catch {
    ElMessage.error('免费模型刷新失败，请检查网络')
  } finally {
    checking.value = false
  }
}

const removeCustom = async (row: FreeModelStatusV2) => {
  if (!row.id) return
  try {
    await ElMessageBox.confirm(`确定删除自定义模型「${row.model}」？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const ok = await deleteCustomFreeModel(row.id)
  if (ok) {
    ElMessage.success('已删除')
    await refreshFreeList()
  } else {
    ElMessage.error('删除失败')
  }
}

const goConfig = (_row: FreeModelStatusV2) => {
  router.push('/ai')
}

/* 自定义免费模型弹框 */
const customDialogVisible = ref(false)
const customSaving = ref(false)
const customForm = ref<{ id?: string; provider: string; model: string; baseUrl: string; note: string }>({
  provider: '',
  model: '',
  baseUrl: '',
  note: ''
})
const openCustomDialog = () => {
  customForm.value = { provider: '', model: '', baseUrl: '', note: '' }
  customDialogVisible.value = true
}
const submitCustom = async () => {
  if (!customForm.value.provider.trim() || !customForm.value.model.trim()) {
    ElMessage.warning('厂商和模型名称必填')
    return
  }
  customSaving.value = true
  try {
    const ok = await saveCustomFreeModel({
      id: customForm.value.id,
      provider: customForm.value.provider.trim(),
      model: customForm.value.model.trim(),
      baseUrl: customForm.value.baseUrl.trim() || undefined,
      note: customForm.value.note.trim() || undefined
    })
    if (ok) {
      ElMessage.success('已保存自定义免费模型')
      customDialogVisible.value = false
      await refreshFreeList()
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    customSaving.value = false
  }
}

/* =========================================================================
 * 超管专用：账号 API 总览
 * 超级管理员可查看/使用所有账号配置的 API Key 与用量；
 * 普通账号受 RLS 限制，接口只会返回自己的数据，前端也不渲染此面板。
 * ========================================================================= */
const isSuperadmin = ref(false)
const currentUid = ref('')

interface AdminApiRow {
  userId: string
  username: string
  nickname: string
  role: string
  provider: string
  model: string
  baseUrl: string
  hasKey: boolean
  encryptedKey: string
  revealedKey: string
  usedTokens: number
  isSelf: boolean
}
const adminRows = ref<AdminApiRow[]>([])
const adminLoading = ref(false)
const adminError = ref('')

const roleText = (r: string) => (r === 'superadmin' ? '超管' : r === 'admin' ? '管理员' : '用户')

/* =====================================================================
 * 超管 API Key 明文查看密码保护
 * - 密码哈希（SHA-256）存 localStorage，不存明文
 * - 验证通过后，10 分钟内查看/使用无需重复输密码（仅存内存）
 * - 窗口失焦 5 秒后自动隐藏已展示的明文 Key
 * 注意：前端实现无法 100% 防御 F12 调试，但可阻止「随手点一下就看到明文」。
 * ===================================================================== */
interface PwdForm { password: string; confirm: string }
const pwdDialogVisible = ref(false)
const pwdDialogMode = ref<'set' | 'verify'>('set')
const pwdForm = ref<PwdForm>({ password: '', confirm: '' })
const adminPwdHash = ref('')
const adminPwdVerified = ref(false)
let pwdVerifyTimer: ReturnType<typeof setTimeout> | null = null
let blurHideTimer: ReturnType<typeof setTimeout> | null = null

const getAdminPwdKey = () => `mc-admin-key-pwd-hash:${currentUid.value || 'unknown'}`

const hashPwd = async (pwd: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // 降级：非安全环境使用简单摘要（仍优于明文存储）
  let h = 0
  for (let i = 0; i < pwd.length; i++) {
    h = (h << 5) - h + pwd.charCodeAt(i)
    h |= 0
  }
  return 'fallback:' + Math.abs(h).toString(16)
}

const loadAdminPwdHash = () => {
  if (typeof window === 'undefined' || !currentUid.value) return
  adminPwdHash.value = window.localStorage.getItem(getAdminPwdKey()) || ''
}

const saveAdminPwdHash = (hash: string) => {
  if (typeof window === 'undefined' || !currentUid.value) return
  window.localStorage.setItem(getAdminPwdKey(), hash)
  adminPwdHash.value = hash
}

const clearPwdVerify = () => {
  adminPwdVerified.value = false
  if (pwdVerifyTimer) {
    clearTimeout(pwdVerifyTimer)
    pwdVerifyTimer = null
  }
}

const setPwdVerified = () => {
  adminPwdVerified.value = true
  if (pwdVerifyTimer) clearTimeout(pwdVerifyTimer)
  pwdVerifyTimer = setTimeout(() => {
    adminPwdVerified.value = false
    hideAllRevealedKeys()
  }, 10 * 60 * 1000)
}

const hideAllRevealedKeys = () => {
  for (const row of adminRows.value) {
    row.revealedKey = ''
  }
}

const openSetPwdDialog = () => {
  loadAdminPwdHash()
  pwdDialogMode.value = 'set'
  pwdForm.value = { password: '', confirm: '' }
  pwdDialogVisible.value = true
}

const openVerifyDialog = () => {
  pwdDialogMode.value = 'verify'
  pwdForm.value = { password: '', confirm: '' }
  pwdDialogVisible.value = true
}

const submitPwdDialog = async () => {
  const pwd = pwdForm.value.password
  if (!pwd || pwd.length < 4) {
    ElMessage.warning('密码至少 4 位')
    return
  }

  if (pwdDialogMode.value === 'set') {
    if (pwd !== pwdForm.value.confirm) {
      ElMessage.warning('两次输入的密码不一致')
      return
    }
    const hash = await hashPwd(pwd)
    saveAdminPwdHash(hash)
    setPwdVerified()
    ElMessage.success('查看密码已设置')
    pwdDialogVisible.value = false
    return
  }

  // 验证模式
  const hash = await hashPwd(pwd)
  if (hash !== adminPwdHash.value) {
    ElMessage.error('密码错误')
    return
  }
  setPwdVerified()
  ElMessage.success('验证通过')
  pwdDialogVisible.value = false
  // 验证成功后，继续执行之前挂起的查看操作
  if (pendingRevealRow.value) {
    const row = pendingRevealRow.value
    pendingRevealRow.value = null
    await revealKey(row)
  }
  if (pendingUseRow.value) {
    const row = pendingUseRow.value
    pendingUseRow.value = null
    await useKey(row)
  }
}

const pendingRevealRow = ref<AdminApiRow | null>(null)
const pendingUseRow = ref<AdminApiRow | null>(null)

const loadAdminOverview = async () => {
  if (!isSuperadmin.value) return
  adminLoading.value = true
  adminError.value = ''
  try {
    const [accounts, keys, usageAll] = await Promise.all([
      listAccounts(),
      listAiKeysForAdmin(),
      getAllModelUsageForAdmin()
    ])
    const keyMap = new Map<string, AiKeyRecord>(keys.map((k) => [k.userId, k]))
    adminRows.value = (accounts as AccountRecord[])
      .filter((a) => a.authUserId)
      .map((a) => {
        const k = a.authUserId ? keyMap.get(a.authUserId) : undefined
        const usage = (a.authUserId && usageAll[a.authUserId]) || {}
        const usedTokens = Object.values(usage).reduce((s, n) => s + (Number(n) || 0), 0)
        return {
          userId: a.authUserId || '',
          username: a.username,
          nickname: a.nickname,
          role: a.role,
          provider: k?.provider || '',
          model: k?.model || '',
          baseUrl: k?.baseUrl || '',
          hasKey: Boolean(k?.encryptedKey),
          encryptedKey: k?.encryptedKey || '',
          revealedKey: '',
          usedTokens,
          isSelf: a.authUserId === currentUid.value
        }
      })
    if (adminRows.value.length === 0) {
      adminError.value = '未读取到任何账号记录。请确认：①已在 Supabase 执行 rls_secure.sql（提供 list_accounts_for_admin）；②当前账号在 app_accounts 表中存在且 role=superadmin。'
    }
  } catch (e) {
    console.warn('[modelCenter] 账号 API 总览加载失败', e)
    adminError.value = '账号 API 总览加载失败：' + (e instanceof Error ? e.message : String(e))
  } finally {
    adminLoading.value = false
  }
}

/** 查看/隐藏某账号 Key 明文（仅超管，需先通过查看密码验证） */
const revealKey = async (row: AdminApiRow) => {
  if (!row.hasKey) return
  if (row.revealedKey) {
    row.revealedKey = ''
    return
  }

  loadAdminPwdHash()
  if (!adminPwdHash.value) {
    ElMessageBox.confirm(
      '当前未设置查看密码，任何人点击「查看」即可看到明文 Key。是否立即前往设置？',
      '安全提示',
      { confirmButtonText: '去设置', cancelButtonText: '取消', type: 'warning' }
    )
      .then(() => openSetPwdDialog())
      .catch(() => {})
    return
  }

  if (!adminPwdVerified.value) {
    pendingRevealRow.value = row
    openVerifyDialog()
    return
  }

  const plain = await decryptSecret(row.encryptedKey)
  if (!plain) {
    ElMessage.error('解密失败，密文可能已损坏')
    return
  }
  row.revealedKey = plain
}

/** 一键把某账号的 API 配置应用到超管当前会话（厂商/地址/模型/Key 全套切换） */
const useKey = async (row: AdminApiRow) => {
  if (!row.hasKey) return

  loadAdminPwdHash()
  if (!adminPwdHash.value) {
    ElMessageBox.confirm(
      '当前未设置查看密码，「使用此 Key」会先解密明文。建议先设置查看密码以防误操作。',
      '安全提示',
      { confirmButtonText: '去设置', cancelButtonText: '继续使用', type: 'warning' }
    )
      .then(() => {
        pendingUseRow.value = row
        openSetPwdDialog()
      })
      .catch(async () => {
        await applyUseKey(row)
      })
    return
  }

  if (!adminPwdVerified.value) {
    pendingUseRow.value = row
    openVerifyDialog()
    return
  }

  await applyUseKey(row)
}

const applyUseKey = async (row: AdminApiRow) => {
  const plain = row.revealedKey || (await decryptSecret(row.encryptedKey))
  if (!plain) {
    ElMessage.error('解密失败，无法使用该 Key')
    return
  }
  const cfg: AiConfig = await loadAiConfig(currentUid.value)
  saveAiConfig(
    {
      ...cfg,
      provider: (row.provider || cfg.provider) as AiConfig['provider'],
      baseUrl: row.baseUrl || cfg.baseUrl,
      model: row.model || cfg.model,
      apiKey: plain
    },
    currentUid.value
  )
  ElMessage.success(`已切换为「${row.nickname || row.username}」的 API 配置`)
  await loadConfigured()
}

const bailianQuotaRows = computed(() =>
  CALLABLE_MODELS.filter((m) => m.provider === 'bailian').map((m) => {
    const free = m.freeQuota ?? 1000000
    const used = modelUsageMap.value[m.id] || 0
    const remaining = Math.max(0, free - used)
    const percent = free > 0 ? Math.min(100, Math.round((used / free) * 100)) : 0
    // 状态：未使用(已用=0) > 快用完(剩余<1万, 标红) > 正常(已用>0 且剩余>=1万)
    const status: 'unused' | 'danger' | 'normal' =
      used === 0 ? 'unused' : remaining < 10000 ? 'danger' : 'normal'
    return {
      id: m.id,
      model: m.model,
      label: m.label,
      free,
      used,
      remaining,
      percent,
      status,
      freeUntil: m.freeUntil || '2026-09-20'
    }
  })
)

interface ConfiguredModelRow {
  provider: string
  model: string
  baseUrl: string
  isFree: boolean
  hasKey: boolean
}
const configuredModels = ref<ConfiguredModelRow[]>([])

const refreshUsage = () => {
  usage.value = getUsageStats()
  bailianQuota.value = getBailianQuota()
  quotaInput.value = bailianQuota.value ?? 0
  bailianUsage.value = getBailianUsage()
}

/** 读取当前激活配置，构建「已配置模型」列表 */
const loadConfigured = async () => {
  const user = await getSavedUser()
  const cfg: AiConfig = await loadAiConfig(user?.id || undefined)
  configuredModels.value = [
    {
      provider: cfg.provider,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      isFree: classifyFree(cfg.provider, cfg.model),
      hasKey: Boolean(cfg.apiKey && cfg.apiKey.trim())
    }
  ]
}

/** 查询硅基流动实时额度 */
const loadBalance = async () => {
  const user = await getSavedUser()
  const cfg: AiConfig = await loadAiConfig(user?.id || undefined)
  balance.value = await getProviderBalance(cfg.provider as string, cfg.baseUrl, cfg.apiKey)
}

/** 拉取阿里百炼各模型额度账本（已用 tokens），剩余 = 1,000,000 - 已用 */
const loadModelUsage = async () => {
  modelUsageMap.value = await getAllModelUsage()
}

const runCheck = async () => {
  checking.value = true
  try {
    await Promise.all([loadConfigured(), loadBalance(), loadModelUsage()])
    const base = await checkFreeModelsV2()
    const custom = await loadCustomFreeModels()
    freeList.value = appendCustomFreeModels(base, custom)
  } catch {
    ElMessage.error('检测失败，请检查网络后重试')
  } finally {
    checking.value = false
  }
}

const toggleAuto = (val: boolean) => {
  if (val) {
    timer = setInterval(runCheck, 60000)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const enableQuota = () => {
  bailianQuota.value = 0
  quotaInput.value = 0
}

const saveQuota = () => {
  setBailianQuota(quotaInput.value || 0)
  bailianQuota.value = getBailianQuota()
  ElMessage.success('阿里额度已更新（仅本地记录，不上云）')
}

/** 跳转阿里云百炼控制台（查看官方免费额度 / 用量） */
const openBailianConsole = () => {
  const url = 'https://bailian.console.aliyun.com/?tab=model#/api-key'
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener')
  }
}

const confirmClear = async () => {
  try {
    const { ElMessageBox } = await import('element-plus')
    await ElMessageBox.confirm('确定清空本地用量记录？此操作不可恢复。', '清空确认', { type: 'warning' })
    clearUsage()
    refreshUsage()
    ElMessage.success('已清空')
  } catch {
    /* 取消 */
  }
}

const tokenText = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n))
const formatNumber = (n: number) => n.toLocaleString('zh-CN')
const fmtTime = (ts: number | null) =>
  ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'
const formatMoney = (n: number) => (n >= 1 ? n.toFixed(2) : n.toFixed(4))

const statusText = (s: FreeModelStatusKind) =>
  ({ callable: '可调用', limited: '受限', unavailable: '暂不可用', unknown: '未知' } as const)[s]
const statusClass = (s: FreeModelStatusKind) =>
  ({ callable: 'ok', limited: 'warn', unavailable: 'bad', unknown: 'unknown' } as const)[s]

const quotaPercent = computed(() =>
  bailianQuota.value && bailianQuota.value > 0
    ? Math.min(100, Math.round((usage.value.bailianUsed / bailianQuota.value) * 100))
    : 0
)

// 暴露给模板的清空入口（保持与旧交互一致，可由父级或内部按钮触发）
void confirmClear

onMounted(async () => {
  refreshUsage()
  try {
    const user = await getSavedUser()
    currentUid.value = user?.id || ''
    isSuperadmin.value = user?.role === 'superadmin'
    loadAdminPwdHash()
  } catch { /* ignore */ }
  runCheck()
  if (isSuperadmin.value) {
    void loadAdminOverview()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', onWindowBlur)
  }
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (pwdVerifyTimer) clearTimeout(pwdVerifyTimer)
  if (blurHideTimer) clearTimeout(blurHideTimer)
  if (typeof window !== 'undefined') {
    window.removeEventListener('blur', onWindowBlur)
  }
})

const onWindowBlur = () => {
  if (blurHideTimer) clearTimeout(blurHideTimer)
  blurHideTimer = setTimeout(() => {
    hideAllRevealedKeys()
    clearPwdVerify()
  }, 5000)
}
</script>

<style scoped>
.mc-shell {
  padding: 0 18px 18px;
  max-width: 1400px;
  margin: 0 auto;
  color: var(--text);
}

/* 页头统一使用 PageHeader 卡片组件（与数据库监测中心一致） */
.mc-shell :deep(.ph-actions .el-button) { display: inline-flex; align-items: center; gap: 4px; }

/* 实时额度卡片 */
.mc-balance {
  background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
  padding: 18px 20px; margin-bottom: 16px; box-shadow: var(--shadow-card);
}
.mc-balance.ok { border-color: rgba(16, 185, 129, 0.35); }
.mc-balance-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.mc-balance-title { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--text-strong); }
.mc-balance-title :deep(svg) { color: #10b981; font-size: 18px; }
.mc-balance-body { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.mc-balance-main { display: flex; align-items: baseline; gap: 6px; }
.mc-balance-num { font-size: 34px; font-weight: 800; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.mc-balance-unit { font-size: 14px; color: var(--text-muted); }
.mc-balance-sub { display: flex; gap: 16px; align-items: center; font-size: 13px; color: var(--text-muted); flex-wrap: wrap; }
.mc-balance-time { color: var(--text-faint); }
.mc-balance-hint { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--text-muted); line-height: 1.6; }
.mc-balance-hint :deep(svg) { color: #f59e0b; margin-top: 2px; flex-shrink: 0; }

/* 用量统计卡片 */
.mc-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.mc-stat {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 16px 18px; box-shadow: var(--shadow-card);
}
.mc-stat-label { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.mc-stat-value { font-size: 26px; font-weight: 800; color: var(--text-strong); }
.mc-stat-value.accent { color: var(--primary); }

/* 阿里额度 */
.mc-quota {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 16px 18px; margin-bottom: 16px; box-shadow: var(--shadow-card);
}
.mc-quota-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.mc-quota-head h3 { margin: 0 0 4px; font-size: 15px; color: var(--text-strong); }
.mc-quota-head p { margin: 0; font-size: 12px; color: var(--text-muted); max-width: 620px; line-height: 1.6; }
.mc-quota-head p strong { color: var(--text-strong); }
.mc-quota-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
.mc-bailian-stats {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px; margin-top: 14px;
}
.mc-bailian-stat {
  background: var(--surface-soft); border: 1px solid var(--border); border-radius: 12px;
  padding: 12px 14px; text-align: center;
}
.mc-bailian-num { font-size: 22px; font-weight: 800; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.mc-bailian-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.mc-bailian-models { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.mc-bailian-model {
  display: flex; align-items: center; gap: 12px; font-size: 12px;
  background: var(--surface-soft); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px;
}
.mc-bm-name { flex: 1; min-width: 0; color: var(--text-strong); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-bm-calls { color: var(--text-muted); flex-shrink: 0; }
.mc-bm-tokens { color: var(--primary); flex-shrink: 0; font-weight: 600; }
.mc-bailian-empty { margin-top: 12px; font-size: 12px; color: var(--text-faint); }
.mc-quota-sub { margin-top: 16px; border-top: 1px dashed var(--border); padding-top: 14px; }
.mc-quota-form { display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap; }
.mc-quota-label { font-size: 12px; color: var(--text-muted); }
.mc-quota-bar {
  margin-top: 14px; height: 10px; border-radius: 999px; background: var(--surface-soft); overflow: hidden;
}
.mc-quota-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--primary-3), var(--primary-2)); transition: width 0.4s ease;
}
.mc-quota-fill.danger { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.mc-quota-meta { margin-top: 8px; font-size: 12px; color: var(--text-muted); }

/* 百炼免费模型额度清单 */
.mc-quota-models { margin-top: 18px; border-top: 1px dashed var(--border); padding-top: 16px; }
.mc-qm-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; font-size: 13px; font-weight: 600; color: var(--text-strong); margin-bottom: 12px; }
.mc-qm-title { display: flex; flex-direction: column; gap: 4px; }
.mc-qm-sub { font-size: 12px; color: var(--text-muted); font-weight: 400; }
.mc-qm-tip { font-size: 12px; color: var(--text-muted); font-weight: 400; }
.mc-qm-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.mc-qm-search { width: 240px; }
.mc-qm-sort { width: 150px; }
.mc-qm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.mc-qm-card { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 12px; padding: 14px; transition: transform 0.15s, box-shadow 0.15s; }
.mc-qm-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
.mc-qm-card.danger { border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.04); }
.mc-qm-card.unused { opacity: 0.85; }
.mc-qm-card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; }
.mc-qm-card-head .mc-qm-name { font-size: 13px; }
.mc-qm-card-bar { height: 8px; border-radius: 999px; background: var(--surface); overflow: hidden; margin-bottom: 12px; }
.mc-qm-card-nums { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 8px; align-items: end; margin-bottom: 10px; }
.mc-qm-num-label { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
.mc-qm-num { font-size: 15px; font-weight: 700; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.mc-qm-num.remaining { color: var(--primary); }
.mc-qm-num.used { color: var(--text-muted); }
.mc-qm-num-div { color: var(--text-faint); font-size: 12px; padding-bottom: 2px; }
.mc-qm-card-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); }
.mc-qm-pagination { margin-top: 18px; justify-content: flex-end; }

/* 超管账号 API 总览 */
.mc-admin-table { margin-top: 14px; padding: 0; border: none; box-shadow: none; background: transparent; }
.mc-admin-alert { margin-top: 14px; }
.mc-pwd-dialog .mc-pwd-tips {
  font-size: 13px; color: var(--text-muted); line-height: 1.7; margin-bottom: 16px;
  background: var(--surface-soft); border-radius: 8px; padding: 10px 12px;
}
.mc-pwd-form .el-form-item { margin-bottom: 14px; }
.mc-pwd-form .el-form-item:last-child { margin-bottom: 0; }
.mc-acc { display: flex; flex-direction: column; line-height: 1.35; min-width: 0; }
.mc-acc-name { font-size: 13px; font-weight: 600; color: var(--text-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-acc-sub { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
  color: var(--text-faint); letter-spacing: 1px; word-break: break-all;
}
.mc-key.plain { color: var(--primary); letter-spacing: 0; user-select: all; }

/* 表格区 */
.mc-tabs { --el-tabs-header-height: auto; }
.mc-tabs :deep(.el-tabs__header) { margin-bottom: 16px; }
.mc-tabs :deep(.el-tabs__item) { font-size: 15px; font-weight: 600; }
.mc-table-wrap {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 14px 16px; box-shadow: var(--shadow-card); overflow-x: auto;
}
.mc-table-wrap :deep(.el-table) { background: transparent; color: var(--text-strong); }
.mc-table-wrap :deep(.el-table th.el-table__cell) { background: var(--surface-soft); color: var(--text-muted); font-weight: 600; }
.mc-table-wrap :deep(.el-table td.el-table__cell) { background: transparent; border-color: var(--border); }

/* 免费清单 */
.mc-banner {
  display: flex; align-items: flex-start; gap: 10px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.08));
  border: 1px solid var(--border-strong); border-radius: 12px;
  padding: 12px 14px; margin-bottom: 16px; font-size: 13px; color: var(--text-muted); line-height: 1.7;
}
.mc-banner :deep(svg) { color: #10b981; font-size: 18px; margin-top: 2px; flex-shrink: 0; }
.mc-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
.mc-status .dot { width: 8px; height: 8px; border-radius: 50%; }
.mc-status.ok { color: #10b981; } .mc-status.ok .dot { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.6); }
.mc-status.warn { color: #d97706; } .mc-status.warn .dot { background: #d97706; }
.mc-status.bad { color: #ef4444; } .mc-status.bad .dot { background: #ef4444; }
.mc-status.unknown { color: var(--text-faint); } .mc-status.unknown .dot { background: var(--text-faint); }
.mc-status-src { font-size: 11px; color: var(--text-faint); margin-top: 2px; }

/* 模块色彩边界：用左侧色条 + 同色标题区分各区块，避免连成一片 */
.mc-balance { border-left: 4px solid #10b981; }
.mc-quota-bailian { border-left: 4px solid #7c3aed; }
.mc-quota-admin { border-left: 4px solid #f59e0b; }
.mc-balance-title { color: #059669; }
.mc-quota-bailian .mc-quota-head h3 { color: #7c3aed; }
.mc-quota-admin .mc-quota-head h3 { color: #d97706; }
/* 每张用量卡片顶部加蓝色条，彼此界限更清晰 */
.mc-stat { border-top: 3px solid #185fa5; }

/* 百炼额度卡：校准按钮 */
.mc-qm-card-foot { margin-top: 10px; display: flex; justify-content: flex-end; }

/* 免费模型清单筛选栏 */
.mc-free-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.mc-free-sel { width: 130px; }
.mc-free-spacer { flex: 1; }
.mc-free-foot { margin-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mc-free-foot-info { font-size: 12px; color: var(--text-muted); }

/* 调用详情弹框 */
.mc-call-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.mc-call-stat { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; text-align: center; }
.mc-call-num { font-size: 22px; font-weight: 800; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.mc-call-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.mc-call-chart { background: var(--surface-soft); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; }
.mc-call-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--text-strong); font-weight: 600; margin-bottom: 10px; flex-wrap: wrap; }
.mc-call-legend { display: flex; gap: 14px; font-size: 12px; color: var(--text-muted); font-weight: 400; }
.lg { display: inline-flex; align-items: center; gap: 5px; }
.lg::before { content: ''; width: 14px; height: 3px; border-radius: 2px; }
.lg-today::before { background: #7c3aed; }
.lg-yesterday::before { background: #10b981; }
.mc-call-chart-body { width: 100%; overflow-x: auto; }
.mc-call-table { margin-top: 4px; }

/* 自定义免费模型 / 校准弹框 */
.mc-custom-form .el-form-item { margin-bottom: 14px; }
.mc-calib-model { font-size: 14px; font-weight: 700; color: var(--text-strong); margin-bottom: 12px; }
.mc-calib-hint { font-size: 12px; color: var(--text-muted); line-height: 1.7; background: var(--surface-soft); border-radius: 8px; padding: 10px 12px; margin-top: 6px; }
.mc-calib-hint b { color: var(--primary); }

@media (max-width: 768px) {
  .mc-shell { padding: 0 14px 14px; }
  .mc-shell :deep(.ph-actions) { width: 100%; justify-content: space-between; }
  .mc-call-stats { grid-template-columns: repeat(2, 1fr); }
}
</style>

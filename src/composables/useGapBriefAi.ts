// GAPDESK · AI 研判（PC / 移动端共用状态与口径）
// 铁律：双端同源同数据；模型只是辅助，失败/未配置一律降级到规则版，不伪造结论。
import { computed, onMounted, ref } from 'vue'
import { useGapDesk } from './useGapDesk'
import {
  defaultAiConfig,
  loadAiConfig,
  saveAiConfig,
  type AiConfig
} from '../services/aiService'
import {
  FREE_BRIEF_MODELS,
  briefConfigReady,
  freeModelToConfig,
  generateGapBrief,
  peekBriefCache
} from '../services/gapdeskBriefService'

export type BriefStatus = 'idle' | 'loading' | 'done' | 'error'

export function useGapBriefAi() {
  const { ranked, titleOf, userId } = useGapDesk()

  const status = ref<BriefStatus>('idle')
  const text = ref('')
  const modelLabel = ref('')
  const cached = ref(false)
  const error = ref('')
  const keyInput = ref('')
  const modelPick = ref(FREE_BRIEF_MODELS[0]?.id ?? '')
  const configReady = ref(false)
  let config: AiConfig | null = null

  const freeModels = FREE_BRIEF_MODELS
  const canGenerate = computed(() => ranked.value.length > 0 && status.value !== 'loading')

  async function init() {
    try {
      config = await loadAiConfig(userId.value || undefined)
      configReady.value = briefConfigReady(config)
      // 命中 48h 缓存：直接展示，不重复消耗额度
      const hit = peekBriefCache(config, ranked.value)
      if (hit) {
        text.value = hit.text
        modelLabel.value = hit.model
        cached.value = true
        status.value = 'done'
      }
    } catch {
      configReady.value = false
    }
  }

  /** 一键套用免费模型；Key 输入一次即加密持久化（账号隔离），下次免填 */
  function applyFreeModel() {
    const picked = freeModelToConfig(modelPick.value)
    if (!picked || !config) return false
    const key = keyInput.value.trim() || config.apiKey
    config = { ...config, ...picked, apiKey: key } as AiConfig
    configReady.value = briefConfigReady(config)
    if (key) {
      saveAiConfig(config, userId.value || undefined)
      keyInput.value = ''
    }
    return true
  }

  async function generate(force = false) {
    if (status.value === 'loading') return
    if (!ranked.value.length) {
      error.value = '当前 48h 池没有可研判的真实事件'
      status.value = 'error'
      return
    }
    if (!config) await init()
    if (!config || !briefConfigReady(config)) {
      configReady.value = false
      error.value = '请先选一个免费模型并填入它的 Key（只需一次）'
      status.value = 'error'
      return
    }
    status.value = 'loading'
    error.value = ''
    try {
      const result = await generateGapBrief(config, ranked.value, titleOf, force)
      text.value = result.text
      modelLabel.value = result.model
      cached.value = result.cached
      status.value = 'done'
    } catch (e) {
      // 降级：保留规则版研判，不伪造模型输出
      error.value = e instanceof Error ? e.message : '模型调用失败，已保留下方规则版研判'
      status.value = 'error'
    }
  }

  onMounted(() => void init())

  return {
    status,
    text,
    modelLabel,
    cached,
    error,
    keyInput,
    modelPick,
    configReady,
    canGenerate,
    freeModels,
    init,
    applyFreeModel,
    generate
  }
}

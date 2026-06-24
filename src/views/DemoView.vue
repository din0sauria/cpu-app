<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MarkdownIt from 'markdown-it'

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8090').replace(/\/$/, '')
const WS_BASE = (import.meta.env.VITE_WS_BASE || 'ws://127.0.0.1:8090').replace(/\/$/, '')
const STORAGE_KEY = 'pocexp_frontend_report_cache_v1'
const MODULES_PAGE_SIZE = 8
const md = new MarkdownIt({ html: false, linkify: true })

const modules = ref([])
const modulePage = ref(1)
const moduleEtaMin = ref({})
const selected = ref(new Set())
const commands = ref([])
const activeCommand = ref(null)
const ws = ref(null)
const heartbeatAt = ref(0)
const heartbeatTimer = ref(null)
const uiTimer = ref(null)
const keyEvents = ref([])

const workflow = ref({
  runId: null,
  runStartedAt: null,
  queue: [],
  current: null,
  paused: false,
  running: false,
  stoppedByUser: false,
  moduleStartAt: null,
  phaseMap: new Map(),
  currentPhaseIndex: 0,
  reportsByModule: {},
  results: []
})

const history = ref(loadHistory())

const wsState = ref('未连接')
const heartbeatStatus = ref({ mode: 'offline', text: '无信号' })
const currentModule = ref('-')
const currentPhase = ref('-')
const currentEta = ref('-')
const currentElapsed = ref('-')
const currentRemaining = ref('-')
const runSummary = ref('等待开始')
const phaseBar = ref(0)
const phaseText = ref('等待开始')
const phaseTrack = ref([])
const liveLog = ref([])
const showReportDialog = ref(false)
const reportTitle = ref('')
const reportContent = ref('')
const reportHighlights = ref({
  detectionItem: '-',
  vulnerabilityConclusion: '-',
  expectedTarget: '-'
})

const isRunning = computed(() => workflow.value.running)
const isPaused = computed(() => workflow.value.paused)
const moduleTotalPages = computed(() => Math.max(1, Math.ceil(modules.value.length / MODULES_PAGE_SIZE)))
const pagedModules = computed(() => {
  const start = (modulePage.value - 1) * MODULES_PAGE_SIZE
  return modules.value.slice(start, start + MODULES_PAGE_SIZE)
})
const reportHtml = computed(() => md.render(emphasizeReportMarkdown(String(reportContent.value || ''))))

function clampModulePage() {
  if (modulePage.value < 1) modulePage.value = 1
  if (modulePage.value > moduleTotalPages.value) modulePage.value = moduleTotalPages.value
}

function prevModulePage() {
  if (modulePage.value <= 1) return
  modulePage.value -= 1
}

function nextModulePage() {
  if (modulePage.value >= moduleTotalPages.value) return
  modulePage.value += 1
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value))
}

function fmtTime(d) {
  return new Date(d).toLocaleString()
}

function nowIso() {
  return new Date().toISOString()
}

function formatSeconds(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0))
  const m = Math.floor(n / 60)
  const s = n % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function updateRunSummary(text) {
  runSummary.value = text || '等待开始'
}

function pushKeyEvent(text, level = 'info') {
  keyEvents.value.unshift({
    at: new Date().toLocaleTimeString(),
    text,
    level
  })
  keyEvents.value = keyEvents.value.slice(0, 12)
}

function updateCurrentTiming() {
  const current = workflow.value.current
  if (!current || !workflow.value.moduleStartAt) {
    currentElapsed.value = '已耗时: -'
    currentRemaining.value = '剩余估计: -'
    return
  }
  const elapsed = Math.floor((Date.now() - new Date(workflow.value.moduleStartAt).getTime()) / 1000)
  const eta = Number(moduleEtaMin.value[current] || 0)
  const remain = Math.max(0, eta - elapsed)
  currentElapsed.value = `已耗时: ${formatSeconds(elapsed)}`
  currentRemaining.value = `剩余估计: ${formatSeconds(remain)}`
}

function logLine(text, level = 'info') {
  liveLog.value.unshift({
    id: Date.now(),
    text: `[${new Date().toLocaleTimeString()}] ${text}`,
    level
  })
}

function setHeartbeat(mode, text) {
  heartbeatStatus.value = { mode, text }
}

function markHeartbeat() {
  heartbeatAt.value = Date.now()
  setHeartbeat('live', `活跃 (${new Date().toLocaleTimeString()})`)
}

function markAgentActivity() {
  heartbeatAt.value = Date.now()
  setHeartbeat('live', '活跃')
}

function startHeartbeatWatcher() {
  if (heartbeatTimer.value) clearInterval(heartbeatTimer.value)
  heartbeatTimer.value = setInterval(() => {
    if (!heartbeatAt.value) {
      setHeartbeat('offline', '无信号')
      return
    }
    const age = Math.floor((Date.now() - heartbeatAt.value) / 1000)
    if (age <= 20) setHeartbeat('live', `活跃 (${age}s)`)
    else if (age <= 45) setHeartbeat('warn', `延迟 (${age}s)`)
    else setHeartbeat('offline', `超时 (${age}s)`)
  }, 1000)
}

function severityFromType(type) {
  if (!type) return 'info'
  if (String(type).includes('error')) return 'error'
  if (String(type).includes('warn')) return 'warn'
  if (String(type).includes('complete') || String(type).includes('result')) return 'ok'
  return 'info'
}

function renderPhaseTrack() {
  const ordered = [...workflow.value.phaseMap.entries()].sort((a, b) => a[0] - b[0])
  phaseTrack.value = ordered.map(([idx, name], i) => ({
    idx,
    name,
    done: idx < workflow.value.currentPhaseIndex,
    active: idx === workflow.value.currentPhaseIndex,
    last: i === ordered.length - 1
  }))
}

function setPhase(name, percent, text) {
  currentPhase.value = `阶段: ${name || '-'}`
  if (typeof percent === 'number') {
    phaseBar.value = Math.max(0, Math.min(100, percent))
  }
  if (text) phaseText.value = text
}

function resetCurrentView() {
  currentModule.value = '模块: -'
  currentPhase.value = '阶段: -'
  currentEta.value = '预计: -'
  currentElapsed.value = '已耗时: -'
  currentRemaining.value = '剩余估计: -'
  phaseBar.value = 0
  phaseText.value = '等待开始'
  phaseTrack.value = []
  updateRunSummary('等待开始')
}

function clearLivePanels() {
  liveLog.value = []
  keyEvents.value = []
}

function renderResults() {
  return workflow.value.results
}

function extractField(content, fieldName) {
  const re = new RegExp(`(?:^|\\n)\\s*-?\\s*${fieldName}\\s*[:：]\\s*(.+)$`, 'm')
  const m = String(content || '').match(re)
  return m?.[1]?.trim() || ''
}

function parseReportHighlights(title, content) {
  const raw = String(content || '')
  const detection = extractField(raw, '检测项') || String(title || '').replace(/\s*报告\s*$/, '').trim() || '-'
  const conclusion = extractField(raw, '漏洞结论') || '-'
  const target = extractField(raw, '预期窃取目标') || '-'
  return {
    detectionItem: detection,
    vulnerabilityConclusion: conclusion,
    expectedTarget: target
  }
}

function conclusionClass(text) {
  const value = String(text || '')
  if (value === '-' || !value) return 'unknown'
  if (/(存在|可利用|高风险|显著)/.test(value) && !/(未发现|不存在|无漏洞|未检出)/.test(value)) return 'danger'
  if (/(未发现|不存在|无漏洞|未检出|安全)/.test(value)) return 'safe'
  return 'unknown'
}

function emphasizeReportMarkdown(content) {
  const lines = String(content || '').split('\n')
  let inFence = false
  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return line

      const m = line.match(/^\s*(?:[-*]\s*)?(检测项|漏洞结论|预期窃取目标)\s*[:：]\s*(.+?)\s*$/)
      if (!m) return line

      const label = m[1]
      const value = m[2]
      return `> **${label}**：${value}`
    })
    .join('\n')
}

function showReport(title, content) {
  reportTitle.value = title
  reportContent.value = content || '暂无报告'
  reportHighlights.value = parseReportHighlights(title, reportContent.value)
  showReportDialog.value = true
}

function closeReport() {
  showReportDialog.value = false
}

function pushRunToHistory() {
  if (!workflow.value.runId) return
  const items = workflow.value.results.map(x => ({ ...x }))
  history.value.unshift({
    run_id: workflow.value.runId,
    run_started_at: workflow.value.runStartedAt,
    run_label: new Date(workflow.value.runStartedAt).toLocaleString(),
    items
  })
  saveHistory()
}

function deleteHistoryItem(idx) {
  history.value.splice(idx, 1)
  saveHistory()
  logLine('已删除一个报告批次', 'warn')
}

function toggleHistoryList(item) {
  item.expanded = !item.expanded
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`
  return fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  }).then(async (r) => {
    const text = await r.text()
    let body
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = { raw: text }
    }
    if (!r.ok) throw new Error(JSON.stringify(body))
    return body
  })
}

function normalizeErrorMessage(raw) {
  const text = String(raw || '')
  try {
    const obj = JSON.parse(text)
    if (typeof obj?.detail === 'string') return obj.detail
    if (obj?.detail?.message) return obj.detail.message
    return text
  } catch {
    return text
  }
}

function resolveFrontendWsUrl(item) {
  const raw = String(item?.frontend_ws_url || '').trim()
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
    return raw
  }
  const sessionId = String(item?.session_id || '').trim()
  if (!sessionId) return ''
  return `${WS_BASE}/ws/frontend/${sessionId}`
}

async function loadModules() {
  try {
    const mods = await api('/api/v1/modules')
    const [validation, docs] = await Promise.all([
      api('/api/v1/registry/validate').catch(() => null),
      api('/api/v1/modules/docs').catch(() => null)
    ])
    const all = Object.keys(mods.modules || {})
    let validSet = null
    if (validation && validation.results) {
      validSet = new Set(
        Object.entries(validation.results)
          .filter(([, v]) => v && v.valid === true)
          .map(([name]) => name)
      )
    }

    moduleEtaMin.value = {}
    const docMods = (docs && docs.modules) || {}
    all.forEach((name) => {
      const spec = docMods?.[name]?.module_spec || {}
      const eta = spec.estimated_runtime_seconds || {}
      moduleEtaMin.value[name] = Number.isFinite(Number(eta.min)) ? Number(eta.min) : 0
    })

    modules.value = validSet ? all.filter((m) => validSet.has(m)) : all
    if (all.length > 0 && modules.value.length === 0) {
      modules.value = all
      logLine('校验接口返回 0 个可用模块，已降级为显示全部模块', 'warn')
    }
    clampModulePage()
    selected.value = new Set([...selected.value].filter((m) => modules.value.includes(m)))
    const hidden = Math.max(all.length - modules.value.length, 0)
    logLine(`可用模块 ${modules.value.length}` + (hidden ? `，未就绪 ${hidden}` : ''), 'info')
  } catch (e) {
    const msg = normalizeErrorMessage(e.message || String(e))
    logLine(`模块加载失败: ${msg}`, 'error')
  }
}

async function createBundle() {
  const mods = [...selected.value]
  if (!mods.length) {
    logLine('请至少选择一个模块', 'warn')
    return
  }

  try {
    const resp = await api('/api/v1/bundles/create', {
      method: 'POST',
      body: JSON.stringify({ modules: mods, auto_start: false, ttl_hours: 24 })
    })

    const rawCommands = Array.isArray(resp.commands) && resp.commands.length ? resp.commands : [{
      platform: 'linux',
      modules: mods,
      session_id: resp.session_id,
      command: resp.command,
      frontend_ws_url: resp.frontend_ws_url,
      estimated_runtime_seconds: resp.estimated_runtime || { min: 0, max: 0 }
    }]
    commands.value = rawCommands.map((x) => ({
      ...x,
      frontend_ws_url: resolveFrontendWsUrl(x)
    }))

    setActiveCommand(commands.value[0])
    logLine('命令已生成，执行后将自动接入', 'ok')
    pushKeyEvent('命令已生成，可在目标机执行', 'ok')
  } catch (e) {
    const msg = normalizeErrorMessage(e.message || String(e))
    logLine(`生成命令失败: ${msg}`, 'error')
  }
}

function setActiveCommand(item) {
  activeCommand.value = item
  updateRunSummary('会话已选择，等待用户在目标机执行命令并开始检测')
  autoConnectWs()
}

function ensureWsClosed() {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
}

function autoConnectWs() {
  if (!activeCommand.value?.frontend_ws_url) {
    logLine('当前会话缺少 WS 地址，请检查后端返回或配置', 'error')
    pushKeyEvent('WS 地址缺失，无法连接', 'error')
    return
  }
  ensureWsClosed()

  const websocket = new WebSocket(activeCommand.value.frontend_ws_url)
  ws.value = websocket

  websocket.onopen = () => {
    wsState.value = '已连接'
    setHeartbeat('warn', '已连接，等待保活')
    logLine('前端连接已建立', 'ok')
    pushKeyEvent('前端连接已建立', 'ok')
  }

  websocket.onclose = () => {
    wsState.value = '已断开'
    heartbeatAt.value = 0
    setHeartbeat('offline', '无信号')
    if (workflow.value.running && !workflow.value.paused) {
      pauseWorkflow(true)
    }
    logLine('连接已断开', 'warn')
    pushKeyEvent('连接已断开', 'warn')
  }

  websocket.onerror = () => {
    wsState.value = '连接异常'
    logLine('连接异常', 'error')
  }

  websocket.onmessage = (ev) => {
    let msg = {}
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }

    const type = msg.type || 'unknown'

    if (type === 'agent_heartbeat') {
      markHeartbeat()
      return
    }

    if (type === 'frontend_connected') {
      markAgentActivity()
      logLine('会话已就绪，等待用户在目标机执行命令', 'info')
      updateRunSummary('会话已就绪，等待用户执行命令并点击开始检测')
      pushKeyEvent('会话已就绪', 'info')
      return
    }

    if (type === 'agent_status') {
      if (msg.status === 'online') {
        markAgentActivity()
      }
      logLine(`Agent 状态: ${msg.status || 'unknown'}`, msg.status === 'online' ? 'ok' : 'warn')
      return
    }

    if (type === 'module_status') {
      markAgentActivity()
      handleModuleStatus(msg.module, msg.status || '')
      return
    }

    if (type === 'module_event') {
      markAgentActivity()
      handleModuleEvent(msg.module, msg.payload || {})
      return
    }

    if (type === 'module_result') {
      markAgentActivity()
      const ok = msg?.result?.ok === true
      if (!ok) logLine(`${msg.module}/${msg.action} 失败`, 'warn')
      return
    }

    if (type === 'agent_error') {
      logLine(msg.message || 'agent error', 'error')
      return
    }

    if (type === 'agent_log') {
      markAgentActivity()
      const level = severityFromType(msg.level || 'info')
      if (String(msg.message || '').includes('heartbeat')) return
      logLine(msg.message || 'agent log', level)
      return
    }
  }
}

function handleModuleStatus(module, status) {
  const current = workflow.value.current
  if (current && module !== current) return

  const progressMap = {
    venv_creating: [6, '创建虚拟环境'],
    venv_ready: [15, '虚拟环境就绪'],
    dependencies_installing: [30, '安装依赖中'],
    dependencies_ready: [90, '依赖完成'],
    backend_ready: [100, '后端就绪']
  }
  if (progressMap[status]) {
    const [p, t] = progressMap[status]
    setPhase('environment_build', p, t)
    updateRunSummary(`当前模块 ${module}：${t}`)
  }
}

function rememberReport(module, content) {
  workflow.value.reportsByModule[module] = content || ''
}

function finishCurrentModule(vulnerable, reasonText) {
  const module = workflow.value.current
  if (!module) return

  const endedAt = nowIso()
  workflow.value.results.push({
    module,
    started_at: workflow.value.moduleStartAt || endedAt,
    ended_at: endedAt,
    vulnerable,
    reason: reasonText || '',
    report: workflow.value.reportsByModule[module] || '暂无报告'
  })

  logLine(`${module} 检测结束: ${vulnerable === true ? '存在漏洞' : vulnerable === false ? '未发现漏洞' : '未知'}`, vulnerable === true ? 'error' : 'ok')
  pushKeyEvent(
    `${module} 检测结束：${vulnerable === true ? '存在漏洞' : vulnerable === false ? '未发现漏洞' : '未知'}`,
    vulnerable === true ? 'error' : 'ok'
  )
  workflow.value.current = null
  workflow.value.moduleStartAt = null
  currentEta.value = '预计: -'
  currentElapsed.value = '已耗时: -'
  currentRemaining.value = '剩余估计: -'

  if (workflow.value.running && !workflow.value.paused) {
    startNextModule()
  }
}

function handleModuleEvent(module, payload) {
  const type = payload?.type || 'unknown'
  const current = workflow.value.current
  if (current && module !== current) return

  if (type === 'phase_start') {
    const idx = Number(payload.phase_index || payload.phase_id + 1 || 0)
    const name = payload.phase_name || payload.phase || `phase_${idx}`
    if (idx > 0) {
      workflow.value.phaseMap.set(idx, name)
      workflow.value.currentPhaseIndex = idx
      renderPhaseTrack()
    }
    setPhase(name, idx === 1 ? 10 : undefined, payload.display || '阶段开始')
    logLine(`阶段开始: ${name}`, 'info')
    updateRunSummary(`阶段开始：${name}`)
    return
  }

  if (type === 'phase_progress') {
    const idx = Number(payload.phase_index || 0)
    const name = payload.phase_name || `phase_${idx}`
    const pct = Number(payload?.progress?.percent ?? 0)
    if (idx > 0) {
      workflow.value.phaseMap.set(idx, name)
      workflow.value.currentPhaseIndex = idx
      renderPhaseTrack()
    }
    setPhase(name, pct, payload.display || '')
    if (payload.display) updateRunSummary(payload.display)
    return
  }

  if (type === 'phase_complete') {
    const idx = Number(payload.phase_index || 0)
    const name = payload.phase_name || `phase_${idx}`
    if (idx > 0) {
      workflow.value.phaseMap.set(idx, name)
      workflow.value.currentPhaseIndex = idx
      renderPhaseTrack()
    }
    setPhase(name, 100, payload.display || '阶段完成')
    logLine(`阶段完成: ${name}`, 'ok')
    updateRunSummary(`阶段完成：${name}`)
    return
  }

  if (type === 'report_file') {
    const content = payload?.report_file?.content || ''
    rememberReport(module, content)
    logLine('报告已生成', 'ok')
    return
  }

  if (type === 'attack_complete') {
    finishCurrentModule(payload.success === true, 'attack_complete')
    return
  }

  if (type === 'error') {
    logLine(payload.message || JSON.stringify(payload), 'error')
    finishCurrentModule(false, payload.message || 'error')
    return
  }

  if (type === 'log' || type === 'process_output' || type === 'dependency_output') {
    const line = payload.line || payload.display || JSON.stringify(payload)
    if (line && !line.includes('agent_heartbeat')) {
      logLine(line, type === 'dependency_output' ? 'warn' : 'info')
    }
    return
  }

  logLine(`${type}: ${JSON.stringify(payload)}`, severityFromType(type))
}

async function postModuleAction(module, action, params = {}) {
  if (!activeCommand.value?.session_id) throw new Error('没有可用会话')
  const path = `/api/v1/sessions/${encodeURIComponent(activeCommand.value.session_id)}/modules/${encodeURIComponent(module)}/${encodeURIComponent(action)}`
  return api(path, { method: 'POST', body: JSON.stringify({ params }) })
}

function buildQueueByEta(mods) {
  return [...mods].sort((a, b) => (moduleEtaMin.value[a] || 0) - (moduleEtaMin.value[b] || 0))
}

async function startNextModule() {
  if (!workflow.value.running || workflow.value.paused) return
  if (workflow.value.current) return

  const next = workflow.value.queue.shift()
  if (!next) {
    workflow.value.running = false
    pushRunToHistory()
    logLine('本轮检测已完成', 'ok')
    updateRunSummary('本轮检测已完成')
    pushKeyEvent('本轮检测已完成', 'ok')
    return
  }

  workflow.value.current = next
  workflow.value.moduleStartAt = nowIso()
  workflow.value.phaseMap = new Map()
  workflow.value.currentPhaseIndex = 0
  currentModule.value = `模块: ${next}`
  const eta = Number(moduleEtaMin.value[next] || 0)
  currentEta.value = `预计: ${eta > 0 ? formatSeconds(eta) : '-'}`
  currentElapsed.value = '已耗时: 0s'
  currentRemaining.value = `剩余估计: ${eta > 0 ? formatSeconds(eta) : '-'}`
  resetCurrentPhaseOnly()
  logLine(`开始检测模块: ${next}`, 'info')
  updateRunSummary(`正在检测 ${next}`)
  pushKeyEvent(`开始检测 ${next}`, 'info')

  try {
    await postModuleAction(next, 'start', {})
  } catch (e) {
    logLine(`启动失败: ${next} ${e.message || e}`, 'error')
    finishCurrentModule(false, 'start_failed')
  }
}

function resetCurrentPhaseOnly() {
  currentPhase.value = '阶段: -'
  phaseBar.value = 0
  phaseText.value = '检测中'
  phaseTrack.value = []
}

async function startWorkflow() {
  if (!activeCommand.value) {
    logLine('请先生成命令并选择会话', 'warn')
    return
  }
  if (workflow.value.running) {
    logLine('检测已在进行中', 'warn')
    return
  }
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) autoConnectWs()

  workflow.value.runId = `run_${Date.now()}`
  workflow.value.runStartedAt = nowIso()
  workflow.value.queue = buildQueueByEta(activeCommand.value.modules || [])
  workflow.value.current = null
  workflow.value.paused = false
  workflow.value.running = true
  workflow.value.stoppedByUser = false
  workflow.value.moduleStartAt = null
  workflow.value.phaseMap = new Map()
  workflow.value.currentPhaseIndex = 0
  workflow.value.reportsByModule = {}
  workflow.value.results = []
  clearLivePanels()
  resetCurrentView()

  updateRunSummary('检测进行中')
  pushKeyEvent('开始检测', 'ok')

  await startNextModule()
}

async function pauseWorkflow(fromDisconnect = false) {
  if (!workflow.value.running) return
  workflow.value.paused = true
  logLine(fromDisconnect ? '连接终止，检测已暂停' : '检测已暂停', 'warn')
  updateRunSummary(fromDisconnect ? '连接终止，检测已暂停' : '检测已暂停')
  pushKeyEvent(fromDisconnect ? '连接终止，检测已暂停' : '检测已暂停', 'warn')

  const current = workflow.value.current
  if (current) {
    try {
      await postModuleAction(current, 'stop', {})
    } catch {
      logLine(`暂停时 stop 失败: ${current}`, 'warn')
    }
  }
}

async function resumeWorkflow() {
  if (!workflow.value.running) return
  if (!workflow.value.paused) return
  workflow.value.paused = false
  logLine('继续检测', 'ok')
  updateRunSummary('继续检测')
  pushKeyEvent('继续检测', 'ok')

  if (workflow.value.current) {
    try {
      await postModuleAction(workflow.value.current, 'start', {})
    } catch (e) {
      logLine(`恢复失败: ${e.message || e}`, 'error')
      finishCurrentModule(false, 'resume_failed')
    }
    return
  }
  await startNextModule()
}

async function skipCurrent() {
  if (!workflow.value.running || !workflow.value.current) return
  const m = workflow.value.current
  logLine(`跳过 ${m}`, 'warn')
  pushKeyEvent(`跳过 ${m}`, 'warn')
  try {
    await postModuleAction(m, 'stop', {})
  } catch {}
  try {
    await postModuleAction(m, 'reset', {})
  } catch {}
  finishCurrentModule(null, 'skipped')
}

async function terminateConnection() {
  if (workflow.value.running && !workflow.value.paused) {
    await pauseWorkflow(true)
  }
  ensureWsClosed()
  wsState.value = '已终止'
  updateRunSummary('连接已终止')
  pushKeyEvent('连接已终止', 'warn')
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(
    () => logLine('命令已复制', 'ok'),
    () => logLine('复制失败，请手动复制', 'warn')
  )
}

onMounted(() => {
  startHeartbeatWatcher()
  uiTimer.value = setInterval(updateCurrentTiming, 1000)
  loadModules()
})

onUnmounted(() => {
  if (heartbeatTimer.value) clearInterval(heartbeatTimer.value)
  if (uiTimer.value) clearInterval(uiTimer.value)
  ensureWsClosed()
})
</script>

<template>
  <div class="demo-view">
    <div class="demo-header glass-card">
      <div class="header-left">
        <h1 class="page-title">主机漏洞检测</h1>
      </div>
      <div class="header-right">
        <span class="status-badge" :class="wsState === '已连接' ? 'connected' : 'disconnected'">
          {{ wsState }}
        </span>
      </div>
    </div>

    <div class="demo-content">
      <div class="left-panel">
        <div class="card glass-card">
          <h3>1️⃣ 选择模块并生成命令</h3>
          <div class="toolbar module-toolbar">
            <button class="btn-primary" @click="createBundle">生成命令</button>
            <div v-if="modules.length > 0" class="module-pager">
              <button class="pager-btn" @click="prevModulePage" :disabled="modulePage <= 1" aria-label="上一页">
                <span class="pager-icon">◀</span>
              </button>
              <span class="pager-info">漏洞选项 {{ modulePage }} / {{ moduleTotalPages }}</span>
              <button class="pager-btn" @click="nextModulePage" :disabled="modulePage >= moduleTotalPages" aria-label="下一页">
                <span class="pager-icon">▶</span>
              </button>
            </div>
          </div>
          <div class="module-list">
            <label v-for="name in pagedModules" :key="name" class="module-item">
              <input 
                type="checkbox" 
                :checked="selected.has(name)"
                @change="(e) => e.target.checked ? selected.add(name) : selected.delete(name)"
              />
              <span>{{ name }}</span>
            </label>
            <div v-if="!modules.length" class="module-item empty">模块加载中...</div>
          </div>
          <div v-if="commands.length" class="command-list">
            <div v-for="(item, idx) in commands" :key="idx" class="command-item">
              <div class="command-head">
                <span>平台: {{ item.platform }} | 预计 {{ item.estimated_runtime_seconds?.min || 0 }}-{{ item.estimated_runtime_seconds?.max || 0 }}s</span>
                <span v-if="activeCommand?.session_id === item.session_id" class="active-badge">当前会话</span>
              </div>
              <pre class="code">{{ item.command }}</pre>
              <div class="toolbar">
                <button @click="copyText(item.command)">复制命令</button>
                <button class="btn-primary" @click="setActiveCommand(item)">使用此命令会话</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card glass-card">
          <h3>2️⃣ 连接与控制</h3>
          <div class="status-row">
            <div class="status-item">
              <span class="status-label">会话</span>
              <span class="status-value">{{ activeCommand?.session_id || '未创建' }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">连接状态</span>
              <span class="badge" :class="wsState === '已连接' ? 'connected' : ''">{{ wsState }}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Agent 保活</span>
              <span class="heartbeat">
                <i class="dot" :class="heartbeatStatus.mode"></i>
                <span>{{ heartbeatStatus.text }}</span>
              </span>
            </div>
          </div>
          <div class="toolbar">
            <button class="btn-primary" @click="startWorkflow" :disabled="isRunning">开始检测</button>
            <button @click="isPaused ? resumeWorkflow() : pauseWorkflow()" :disabled="!isRunning">
              {{ isPaused ? '继续检测' : '停止检测' }}
            </button>
            <button @click="skipCurrent" :disabled="!isRunning || isPaused">跳过当前漏洞</button>
            <button class="btn-danger" @click="terminateConnection" :disabled="!activeCommand">终止连接</button>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="card glass-card">
          <h3>3️⃣ 当前检测窗口</h3>
          <div class="current-head">
            <span class="pill">{{ currentModule }}</span>
            <span class="pill">{{ currentPhase }}</span>
            <span class="pill">{{ currentEta }}</span>
            <span class="pill">{{ currentElapsed }}</span>
            <span class="pill">{{ currentRemaining }}</span>
          </div>
          <div class="run-summary">{{ runSummary }}</div>
          
          <div class="key-events-wrap">
            <div class="key-events-title">关键事件</div>
            <div class="key-events">
              <div v-if="!keyEvents.length" class="key-event empty">暂无关键事件</div>
              <div 
                v-for="(e, idx) in keyEvents" 
                :key="idx" 
                class="key-event event-card"
                :class="e.level"
              >
                <span class="event-icon" :class="e.level">
                  {{ e.level === 'ok' ? '✓' : e.level === 'warn' ? '!' : e.level === 'error' ? '✕' : '•' }}
                </span>
                <div class="event-body">
                  <div class="event-text">{{ e.text }}</div>
                  <div class="event-time">{{ e.at }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="phaseTrack.length" class="phase-track">
            <template v-for="(node, idx) in phaseTrack" :key="idx">
              <span class="phase-node" :class="{done: node.done, active: node.active}">
                {{ node.idx }}.{{ node.name }}
              </span>
              <span v-if="!node.last" class="phase-arrow">→</span>
            </template>
          </div>
          
          <div class="progress-wrap">
            <div class="progress-bar" :style="{width: phaseBar + '%'}"></div>
          </div>
          <div class="phase-text">{{ phaseText }}</div>

          <div class="live-log">
            <div 
              v-for="log in liveLog" 
              :key="log.id" 
              class="log-line"
              :class="'log-' + log.level"
            >
              {{ log.text }}
            </div>
            <div v-if="!liveLog.length" class="log-line empty">等待日志输出...</div>
          </div>
        </div>

        <div class="card glass-card">
          <h3>4️⃣ 检测结果列表</h3>
          <div class="result-list">
            <div v-if="!workflow.results.length" class="result-item empty">暂无结果</div>
            <div v-for="(r, idx) in workflow.results" :key="idx" class="result-item">
              <div class="result-meta">
                <div>模块: {{ r.module }}</div>
                <div>开始: {{ fmtTime(r.started_at) }}</div>
                <div>结束: {{ fmtTime(r.ended_at) }}</div>
                <div>结论: {{ r.vulnerable === true ? '存在漏洞' : r.vulnerable === false ? '未发现漏洞' : '未知/跳过' }}</div>
              </div>
              <div class="result-actions">
                <button @click="showReport(`${r.module} 报告`, r.report)">查看报告</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card glass-card">
          <h3>5️⃣ 报告缓存（按检测批次）</h3>
          <div class="history-list">
            <div v-if="!history.length" class="history-item empty">暂无缓存批次</div>
            <div v-for="(run, idx) in history" :key="idx" class="history-item">
              <div class="history-head">
                批次: {{ run.run_label }} | 开始: {{ fmtTime(run.run_started_at) }} | 报告数: {{ run.items?.length || 0 }}
              </div>
              <div class="history-actions">
                <button @click="toggleHistoryList(run)">{{ run.expanded ? '收起' : '展开' }}报告列表</button>
                <button class="btn-danger" @click="deleteHistoryItem(idx)">删除该批次</button>
              </div>
              <div v-if="run.expanded" class="history-items">
                <div v-for="(it, i) in run.items" :key="i" class="result-item">
                  <div class="result-meta">
                    <div>模块: {{ it.module }}</div>
                    <div>开始: {{ fmtTime(it.started_at) }}</div>
                    <div>结束: {{ fmtTime(it.ended_at) }}</div>
                    <div>结论: {{ it.vulnerable === true ? '存在漏洞' : it.vulnerable === false ? '未发现漏洞' : '未知' }}</div>
                  </div>
                  <div class="result-actions">
                    <button @click="showReport(`${it.module} 报告`, it.report)">查看报告</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" :class="{active: showReportDialog}" @click="closeReport">
      <div class="modal-content report-modal" @click.stop>
        <div class="modal-header">
          <strong class="modal-title">{{ reportTitle }}</strong>
          <button class="modal-close" @click="closeReport">×</button>
        </div>
        <div class="report-focus-grid">
          <div class="focus-card detection">
            <div class="focus-label">检测项</div>
            <div class="focus-value">{{ reportHighlights.detectionItem }}</div>
          </div>
          <div class="focus-card" :class="`conclusion-${conclusionClass(reportHighlights.vulnerabilityConclusion)}`">
            <div class="focus-label">漏洞结论</div>
            <div class="focus-value">{{ reportHighlights.vulnerabilityConclusion }}</div>
          </div>
          <div class="focus-card target">
            <div class="focus-label">预期窃取目标</div>
            <div class="focus-value">{{ reportHighlights.expectedTarget }}</div>
          </div>
        </div>
        <article class="report-content markdown-body" v-html="reportHtml"></article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-view {
  width: 100%;
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.page-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 24px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--secondary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}

.status-badge {
  padding: 6px 15px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.status-badge.connected {
  background: rgba(0, 255, 157, 0.2);
  color: var(--success);
}

.status-badge.disconnected {
  background: rgba(255, 51, 102, 0.2);
  color: var(--danger);
}

.demo-content {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 20px;
}

.left-panel, .right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  padding: 20px;
}

.card h3 {
  font-family: 'Orbitron', sans-serif;
  font-size: 16px;
  color: var(--secondary);
  margin-bottom: 15px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
}

.module-toolbar {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.btn-primary {
  background: linear-gradient(135deg, var(--secondary), var(--primary));
}

.btn-danger {
  background: linear-gradient(135deg, var(--danger), #cc2952);
}

.module-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-bottom: 15px;
}

.module-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
}

.pager-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--border-glow);
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pager-icon {
  color: var(--secondary);
  font-size: 14px;
  line-height: 1;
  transform: translateY(-0.5px);
}

.pager-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  min-width: 110px;
  text-align: center;
}

.module-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.module-item.empty {
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.command-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.command-item {
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
}

.command-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.active-badge {
  padding: 2px 8px;
  background: rgba(0, 255, 157, 0.2);
  border-radius: 10px;
  font-size: 10px;
  color: var(--success);
}

.code {
  margin: 0 0 10px 0;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-glow);
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  white-space: pre-wrap;
  overflow-x: auto;
}

.status-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 15px;
}

.status-item {
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
}

.status-label {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.status-value {
  font-size: 12px;
  color: #fff;
}

.badge {
  display: inline-block;
  padding: 3px 10px;
  border: 1px solid var(--border-glow);
  border-radius: 12px;
  font-size: 12px;
}

.badge.connected {
  border-color: var(--success);
  color: var(--success);
}

.heartbeat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6a7380;
}

.dot.live {
  background: var(--success);
  box-shadow: 0 0 8px rgba(0, 255, 157, 0.8);
  animation: blink 1.1s infinite ease-in-out;
}

.dot.warn {
  background: var(--warning);
  box-shadow: 0 0 8px rgba(255, 170, 0, 0.8);
}

.dot.offline {
  background: #6a7380;
}

@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0.35; }
  100% { opacity: 1; }
}

.current-head {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.pill {
  padding: 4px 12px;
  background: rgba(0, 212, 255, 0.15);
  border: 1px solid var(--border-glow);
  border-radius: 15px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.run-summary {
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 15px;
}

.key-events-wrap {
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  margin-bottom: 15px;
  overflow: hidden;
}

.key-events-title {
  padding: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  border-bottom: 1px dashed var(--border-glow);
}

.key-events {
  max-height: 150px;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.key-event {
  padding: 8px 10px;
  border: 1px solid var(--border-glow);
  border-radius: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.key-event.empty {
  border-style: dashed;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.event-card {
  display: flex;
  align-items: center;
  gap: 10px;
}

.event-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border: 1px solid var(--border-glow);
  background: rgba(0, 0, 0, 0.3);
}

.event-icon.ok {
  color: #032718;
  background: var(--success);
  border-color: var(--success);
  box-shadow: 0 0 8px rgba(0, 255, 157, 0.45);
}

.event-icon.warn {
  color: #352003;
  background: var(--warning);
  border-color: var(--warning);
  box-shadow: 0 0 8px rgba(255, 170, 0, 0.4);
}

.event-icon.error {
  color: #380a0a;
  background: var(--danger);
  border-color: var(--danger);
  box-shadow: 0 0 8px rgba(255, 51, 102, 0.4);
}

.event-icon.info {
  color: #022a35;
  background: var(--secondary);
  border-color: var(--secondary);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.35);
}

.event-body {
  flex: 1;
  min-width: 0;
}

.event-text {
  font-size: 12px;
  line-height: 1.3;
}

.event-time {
  margin-top: 2px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
}

.phase-track {
  display: flex;
  gap: 6px;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.phase-node {
  padding: 3px 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.phase-node.done {
  color: #d6fff0;
  border-color: var(--success);
  background: rgba(0, 255, 157, 0.12);
}

.phase-node.active {
  color: #e9f5ff;
  border-color: var(--secondary);
  background: rgba(0, 212, 255, 0.16);
}

.phase-arrow {
  color: rgba(255, 255, 255, 0.4);
}

.progress-wrap {
  width: 100%;
  height: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--success), var(--secondary));
  transition: width 0.3s;
}

.phase-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 15px;
}

.live-log {
  height: 200px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  padding: 10px;
}

.log-line {
  padding: 4px 0;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
  word-break: break-all;
}

.log-line:last-child {
  border-bottom: none;
}

.log-line.empty {
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-style: italic;
}

.log-info { color: rgba(255, 255, 255, 0.8); }
.log-ok { color: var(--success); }
.log-warn { color: var(--warning); }
.log-error { color: var(--danger); }

.result-list, .history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-item, .history-item {
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
}

.result-item.empty, .history-item.empty {
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-style: italic;
}

.result-meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 10px;
}

.result-actions, .history-actions {
  display: flex;
  gap: 8px;
}

.history-head {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 10px;
}

.history-items {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-glow);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-modal {
  max-width: 900px;
  width: 90%;
}

.report-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.report-modal .modal-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 16px;
  color: var(--secondary);
}

.report-modal .modal-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.report-content {
  margin: 0;
  padding: 15px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  white-space: normal;
  max-height: 60vh;
  overflow-y: auto;
}

.report-focus-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.focus-card {
  padding: 10px 12px;
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
}

.focus-card.detection {
  border-color: rgba(0, 212, 255, 0.65);
  box-shadow: inset 0 0 0 1px rgba(0, 212, 255, 0.2);
}

.focus-card.target {
  border-color: rgba(255, 170, 0, 0.65);
  box-shadow: inset 0 0 0 1px rgba(255, 170, 0, 0.18);
}

.focus-card.conclusion-danger {
  border-color: rgba(255, 51, 102, 0.75);
  box-shadow: inset 0 0 0 1px rgba(255, 51, 102, 0.25);
}

.focus-card.conclusion-safe {
  border-color: rgba(0, 255, 157, 0.75);
  box-shadow: inset 0 0 0 1px rgba(0, 255, 157, 0.2);
}

.focus-card.conclusion-unknown {
  border-color: rgba(255, 255, 255, 0.25);
}

.focus-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.focus-value {
  font-size: 13px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.95);
  word-break: break-word;
}

.markdown-body {
  line-height: 1.6;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  color: var(--secondary);
  margin-top: 0.95em;
  margin-bottom: 0.45em;
}

.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote) {
  margin: 0.45em 0;
}

.markdown-body :deep(blockquote) {
  margin: 0.55em 0;
  padding: 0.45em 0.8em;
  border-left: 3px solid var(--secondary);
  border-radius: 6px;
  background: rgba(0, 212, 255, 0.1);
}

.markdown-body :deep(blockquote p) {
  margin: 0.1em 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.2em;
}

.markdown-body :deep(li) {
  margin: 0.15em 0;
}

.markdown-body :deep(li > p) {
  margin: 0.15em 0;
}

.markdown-body :deep(code) {
  font-family: 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 2px 6px;
}

.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-glow);
  border-radius: 10px;
  padding: 12px;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  border: none;
  padding: 0;
  background: transparent;
}

.markdown-body :deep(a) {
  color: var(--secondary);
}

@media (max-width: 1200px) {
  .demo-content {
    grid-template-columns: 1fr;
  }

  .module-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .report-focus-grid {
    grid-template-columns: 1fr;
  }
}
</style>

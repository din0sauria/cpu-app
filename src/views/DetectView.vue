<script setup>
import { ref, reactive, computed, onUnmounted, nextTick } from 'vue'

const API_BASE = 'http://10.201.66.137:5000'

const isAnalyzing = ref(false)
const uploadFile = ref(null)
const analysisResults = ref([])
const generatedExp = ref('')
const activeTab = ref('vuln')
const showResult = ref(false)
const errorMessage = ref('')
const serverLogs = ref([])
const sse = ref(null)
const taskId = ref('')
const targetBin = ref('')
const selectedDetectors = ref([])
const isDragging = ref(false)
const backendUrl = ref(API_BASE)

const availableDetectors = [
  { value: 'flush_reload_branch', label: 'flush_reload_branch' },
  { value: 'prime_probe_array', label: 'prime_probe_array' }
]

const pipelineSteps = reactive([
  { id: 0, name: 'Phase 0', label: '初始化', status: 'pending', key: 'phase_0' },
  { id: 1, name: 'Phase 1', label: '预处理', status: 'pending', key: 'phase_1' },
  { id: 2, name: 'Phase 2', label: '静态分析', status: 'pending', key: 'phase_2' },
  { id: 3, name: 'Phase 3', label: 'AI审计', status: 'pending', key: 'phase_3' },
  { id: 4, name: 'Phase 4', label: '报告生成', status: 'pending', key: 'phase_4' }
])

const currentPhase = ref(-1)
const phaseText = ref('等待任务开始')
const taskStatus = ref('idle')

const toolState = reactive({
  isScanning: false,
  query: '暂无',
  result: '暂无',
  status: 'wait'
})

const batchInfo = reactive({
  current: 0,
  total: 0,
  percent: 0,
  label: '批次进度: 暂无'
})

const candidates = ref([])
const shortlist = ref([])
const auditReports = ref([])
const finalReport = ref(null)

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    uploadFile.value = {
      name: file.name,
      size: file.size,
      type: file.type,
      file: file
    }
    errorMessage.value = ''
  }
}

const handleDragOver = (event) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragging.value = false
  const file = event.dataTransfer.files[0]
  if (file && file.name.endsWith('.zip')) {
    uploadFile.value = {
      name: file.name,
      size: file.size,
      type: file.type,
      file: file
    }
    errorMessage.value = ''
  } else {
    errorMessage.value = '请上传 .zip 格式的文件'
  }
}

const removeFile = () => {
  uploadFile.value = null
  const fileInput = document.getElementById('fileInput')
  if (fileInput) fileInput.value = ''
}

const resetDisplay = () => {
  serverLogs.value = []
  phaseText.value = '等待任务开始'
  currentPhase.value = -1
  taskStatus.value = 'idle'
  pipelineSteps.forEach(step => step.status = 'pending')
  
  candidates.value = []
  shortlist.value = []
  auditReports.value = []
  finalReport.value = null
  
  toolState.isScanning = false
  toolState.query = '暂无'
  toolState.result = '暂无'
  toolState.status = 'wait'
  
  batchInfo.current = 0
  batchInfo.total = 0
  batchInfo.percent = 0
  batchInfo.label = '批次进度: 暂无'
}

const startAnalysis = async () => {
  if (!uploadFile.value) {
    errorMessage.value = '请先上传项目压缩包'
    return
  }

  isAnalyzing.value = true
  showResult.value = false
  errorMessage.value = ''
  
  resetDisplay()
  taskStatus.value = 'uploading'
  
  addLog('system', `正在上传 ${uploadFile.value.name} ...`)

  const formData = new FormData()
  formData.append('file', uploadFile.value.file)
  if (targetBin.value) {
    formData.append('target_bin', targetBin.value)
  }
  if (selectedDetectors.value.length > 0) {
    formData.append('detectors', selectedDetectors.value.join(','))
  }

  const baseUrl = backendUrl.value.trim().replace(/\/$/, '')

  try {
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: formData
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || '上传失败')
    }

    taskId.value = data.task_id
    taskStatus.value = 'submitted'
    addLog('start', data.message || '任务已创建')
    
    bindSSE(data.task_id, baseUrl)

  } catch (error) {
    console.error('上传错误:', error)
    errorMessage.value = '上传失败: ' + error.message
    isAnalyzing.value = false
    taskStatus.value = 'failed'
    addLog('error', error.message || String(error))
  }
}

const bindSSE = (tid, baseUrl) => {
  if (sse.value) {
    sse.value.close()
  }
  
  const streamUrl = `${baseUrl}/stream/${tid}`
  sse.value = new EventSource(streamUrl)
  taskStatus.value = 'streaming'
  addLog('system', `SSE 已连接: ${streamUrl}`)

  const eventNames = [
    'start', 'info', 'warning', 'error',
    'phase_0', 'phase_1', 'phase_2', 'phase_3', 'phase_4',
    'candidates', 'shortlist', 'audit_reports',
    'agent_step', 'tool_call', 'tool_result',
    'final_report', 'finished', 'complete'
  ]

  eventNames.forEach(eventName => {
    sse.value.addEventListener(eventName, (ev) => {
      let payload
      try {
        payload = JSON.parse(ev.data)
      } catch {
        payload = { stage: eventName, message: ev.data, data: null }
      }

      const stage = payload.stage || eventName
      const message = payload.message || ''
      const data = payload.data

      const parsedBatch = parseBatchInfo(message)
      if (parsedBatch) {
        batchInfo.current = parsedBatch.currentBatch
        batchInfo.total = parsedBatch.totalBatches
        batchInfo.percent = parsedBatch.percent
        batchInfo.label = `批次 ${parsedBatch.currentBatch}/${parsedBatch.totalBatches} · 处理 ${parsedBatch.start}-${parsedBatch.end}/${parsedBatch.total}`
      }

      addLog(stage, message)

      if (stage.startsWith('phase_')) {
        markPhase(stage, message || stage)
      }

      if (stage === 'candidates') {
        renderCandidates(data)
      }
      if (stage === 'shortlist') {
        renderShortlist(data)
      }
      if (stage === 'audit_reports') {
        renderAuditReports(data)
      }
      if (stage === 'final_report') {
        renderFinalReport(data)
      }
      if (stage === 'agent_step') {
        setToolVisual('idle', `轮次: ${message || '新一轮思考'}`)
      }
      if (stage === 'tool_call') {
        const querySummary = typeof message === 'string' && message.trim() ? message : JSON.stringify(data || {}, null, 2)
        setToolVisual('searching', querySummary)
      }
      if (stage === 'tool_result') {
        const resultSummary = typeof message === 'string' && message.trim() ? message : JSON.stringify(data || {}, null, 2)
        setToolVisual('done', null, resultSummary)
      }
      if (stage === 'error') {
        taskStatus.value = 'error'
        setToolVisual('idle', null, '流程异常，工具查询中止')
      }
      if (stage === 'complete') {
        taskStatus.value = 'complete'
      }
      if (stage === 'finished') {
        taskStatus.value = 'finished'
        finishAnalysis()
      }
    })
  })

  sse.value.onerror = () => {
    addLog('error', 'SSE 连接异常或已关闭')
    if (sse.value && sse.value.readyState === EventSource.CLOSED) {
      taskStatus.value = 'closed'
    }
  }
}

const parseBatchInfo = (message) => {
  if (!message || typeof message !== 'string') return null
  
  const match = message.match(/(\d+)\s*[~\-]\s*(\d+)\s*\/\s*(\d+)/)
  if (!match) return null

  const start = Number(match[1])
  const end = Number(match[2])
  const total = Number(match[3])
  
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(total) || total <= 0) {
    return null
  }

  const safeStart = Math.max(1, start)
  const safeEnd = Math.min(Math.max(end, safeStart), total)
  const unit = Math.max(1, safeEnd - safeStart + 1)
  const totalBatches = Math.max(1, Math.ceil(total / unit))
  const currentBatch = Math.min(totalBatches, Math.max(1, Math.ceil(safeEnd / unit)))
  const percent = Math.min(100, Math.max(0, (safeEnd / total) * 100))

  return { start: safeStart, end: safeEnd, total, currentBatch, totalBatches, percent }
}

const markPhase = (stage, text) => {
  const phaseIndex = parseInt(stage.replace('phase_', ''))
  pipelineSteps.forEach((step, idx) => {
    if (idx < phaseIndex) step.status = 'completed'
    else if (idx === phaseIndex) step.status = 'active'
    else step.status = 'pending'
  })
  currentPhase.value = phaseIndex
  phaseText.value = text
}

const setToolVisual = (state, queryText, resultText) => {
  if (state === 'searching') {
    toolState.isScanning = true
    toolState.status = 'searching'
  } else if (state === 'done') {
    toolState.isScanning = false
    toolState.status = 'done'
  } else {
    toolState.isScanning = false
    toolState.status = 'wait'
  }

  if (queryText) {
    toolState.query = batchInfo.current > 0 
      ? `[批次 ${batchInfo.current}/${batchInfo.total}] ${queryText}`
      : queryText
  }
  if (resultText) {
    toolState.result = batchInfo.current > 0
      ? `[批次 ${batchInfo.current}/${batchInfo.total}] ${resultText}`
      : resultText
  }
}

const renderCandidates = (data) => {
  candidates.value = Array.isArray(data) ? data : []
}

const renderShortlist = (data) => {
  shortlist.value = Array.isArray(data) ? data : []
}

const renderAuditReports = (data) => {
  auditReports.value = Array.isArray(data) ? data : []
  analysisResults.value = auditReports.value
}

const renderFinalReport = (data) => {
  finalReport.value = data
}

const finishAnalysis = () => {
  pipelineSteps.forEach(step => {
    if (step.status === 'active') step.status = 'completed'
  })
  isAnalyzing.value = false
  showResult.value = true
  toolState.isScanning = false
  
  if (sse.value) {
    sse.value.close()
    sse.value = null
  }
}

const stopSSE = () => {
  if (sse.value) {
    sse.value.close()
    sse.value = null
  }
  taskStatus.value = 'stopped'
  addLog('system', '手动断开 SSE')
  isAnalyzing.value = false
}

const addLog = (type, message) => {
  serverLogs.value.push({
    type,
    message,
    timestamp: new Date().toLocaleTimeString()
  })
  
  if (serverLogs.value.length > 500) {
    serverLogs.value.shift()
  }
  
  nextTick(() => {
    const container = document.querySelector('.terminal-output')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

const generateExp = (vuln) => {
  generatedExp.value = `/*
 * AI Generated Exploit Code
 * Target: ${vuln.func_name || 'unknown'}
 * Vulnerability: ${vuln.attack_type || '侧信道漏洞'}
 * Generated at: ${new Date().toISOString()}
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <x86intrin.h>

// ============================================
// Target: ${vuln.func_name || 'unknown'}
// Attack Type: ${vuln.attack_type || '侧信道攻击'}
// Leaked Info: ${vuln.leaked_info || '敏感信息'}
// Reason: ${vuln.reason || '存在侧信道漏洞'}
// ============================================

#define CACHE_HIT_THRESHOLD 80
#define STRIDE_LENGTH 4096

uint8_t probe[256 * STRIDE_LENGTH];

void flush_probe_buffer() {
    for (int i = 0; i < 256; i++) {
        _mm_clflush(&probe[i * STRIDE_LENGTH]);
    }
}

uint64_t time_access(void *addr) {
    uint64_t start, end;
    start = __rdtsc();
    volatile uint8_t x = *(uint8_t *)addr;
    end = __rdtsc();
    return end - start;
}

int check_cache_hit(int index) {
    uint64_t time = time_access(&probe[index * STRIDE_LENGTH]);
    return time < CACHE_HIT_THRESHOLD;
}

int main(int argc, char **argv) {
    printf("[*] Exploit for ${vuln.attack_type || '侧信道漏洞'}\\n");
    printf("[!] Target function: ${vuln.func_name || 'unknown'}\\n");
    printf("[!] Reason: ${vuln.reason || '存在侧信道漏洞'}\\n");
    printf("[+] Leaked Info: ${vuln.leaked_info || '敏感信息'}\\n");
    
    memset(probe, 1, sizeof(probe));
    printf("[+] Exploit completed\\n");
    return 0;
}`
  
  activeTab.value = 'exp'
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const downloadExp = () => {
  if (!generatedExp.value) return
  const blob = new Blob([generatedExp.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `exploit_${Date.now()}.c`
  a.click()
  URL.revokeObjectURL(url)
}

const copyExp = async () => {
  if (!generatedExp.value) return
  try {
    await navigator.clipboard.writeText(generatedExp.value)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

const escapeHtml = (raw) => {
  return String(raw)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const classifyLog = (eventName) => {
  if (eventName === 'warning') return 'log-warning'
  if (eventName === 'error') return 'log-error'
  if (eventName === 'agent_step' || eventName === 'tool_call' || eventName === 'tool_result') return 'log-ai'
  if (eventName === 'start' || eventName === 'finished' || eventName === 'complete' || eventName === 'system') return 'log-control'
  return 'log-info'
}

const formatArgs = (args) => {
  if (!Array.isArray(args)) return '-'
  return args.map((arg, idx) => {
    if (arg && typeof arg === 'object') {
      const type = arg.type ? String(arg.type).trim() : ''
      const name = arg.name ? String(arg.name).trim() : `arg_${idx}`
      return `${type} ${name}`.trim() || `arg_${idx}`
    }
    return String(arg)
  }).join(', ')
}

onUnmounted(() => {
  if (sse.value) {
    sse.value.close()
  }
})
</script>

<template>
  <div class="detect-container">
    <div class="bg-grid"></div>
    
    <div class="hero-section">
      <h1 class="hero-title">
        <span class="title-icon">🔍</span>
        侧信道漏洞智能检测
      </h1>
      <p class="hero-desc">基于大语言模型的代码审计系统，自动识别潜在侧信道漏洞并生成利用代码</p>
    </div>

    <div class="main-layout">
      <aside class="left-panel">
        <div class="panel config-panel">
          <div class="panel-head">
            <h2>⚙️ 任务配置</h2>
          </div>
          
          <div class="panel-body">
            <label class="form-label">
              后端地址
              <input 
                type="url" 
                v-model="backendUrl"
                class="form-input"
                placeholder="http://127.0.0.1:5000"
              />
            </label>

            <div 
              class="upload-zone"
              :class="{ 'drag-over': isDragging, 'has-file': uploadFile }"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
            >
              <input 
                type="file" 
                id="fileInput" 
                @change="handleFileSelect"
                accept=".zip"
                class="file-input"
              />
              <label for="fileInput" class="upload-content">
                <div class="upload-icon" :class="{ 'bounce': isDragging }">
                  <span v-if="!uploadFile">📁</span>
                  <span v-else class="success-icon">✅</span>
                </div>
                <div class="upload-text">
                  <span class="upload-title" v-if="!uploadFile">待审计 ZIP 包</span>
                  <span class="upload-title" v-else>{{ uploadFile.name }}</span>
                  <span class="upload-hint">点击或拖拽上传</span>
                </div>
              </label>
              <button v-if="uploadFile" class="remove-btn" @click.prevent="removeFile">×</button>
            </div>

            <label class="form-label">
              target_bin (可选)
              <input 
                type="text" 
                v-model="targetBin"
                placeholder="例如: gpg"
                class="form-input"
              />
            </label>

            <div class="detector-section">
              <div class="detector-label">detectors (可选，多选)</div>
              <div class="checks">
                <label v-for="detector in availableDetectors" :key="detector.value" class="check-item">
                  <input 
                    type="checkbox" 
                    :value="detector.value"
                    v-model="selectedDetectors"
                  />
                  <span class="check-box"></span>
                  <span class="check-label">{{ detector.label }}</span>
                </label>
              </div>
            </div>

            <div class="btn-row">
              <button 
                class="btn-primary"
                @click="startAnalysis"
                :disabled="isAnalyzing || !uploadFile"
              >
                <span v-if="!isAnalyzing">🚀 上传并分析</span>
                <span v-else class="loading-text">
                  <span class="spinner"></span>
                  分析中...
                </span>
              </button>
              <button 
                class="btn-secondary"
                @click="stopSSE"
                :disabled="!isAnalyzing"
              >
                断开 SSE
              </button>
            </div>

            <div class="meta-info">
              <span class="pill">task: {{ taskId || '未创建' }}</span>
              <span class="pill" :class="'status-' + taskStatus">status: {{ taskStatus }}</span>
            </div>
          </div>
        </div>

        <div class="panel pipeline-panel">
          <div class="panel-head">
            <h2>📊 流程阶段</h2>
          </div>
          
          <div class="panel-body">
            <div class="phase-line">
              <div 
                v-for="step in pipelineSteps" 
                :key="step.id" 
                class="phase"
                :class="step.status"
                :title="step.label"
              >
                <div class="phase-name">{{ step.name }}</div>
                <div class="phase-indicator"></div>
              </div>
            </div>
            <div class="phase-text">{{ phaseText }}</div>
          </div>
        </div>
      </aside>

      <main class="right-panel">
        <div class="panel terminal-panel">
          <div class="panel-head">
            <h2>🖥️ 实时控制台 / AI 活动</h2>
            <span class="log-count">{{ serverLogs.length }} 条</span>
          </div>
          
          <div class="panel-body">
            <div class="terminal-output">
              <div 
                v-for="(log, index) in serverLogs" 
                :key="index" 
                class="log-line"
                :class="classifyLog(log.type)"
              >
                <span class="log-time">[{{ log.timestamp }}]</span>
                <span class="log-type">[{{ log.type }}]</span>
                <span class="log-msg">{{ log.message }}</span>
              </div>
              <div v-if="serverLogs.length === 0" class="log-empty">
                等待分析开始...
              </div>
            </div>
          </div>
        </div>

        <div class="panel tool-panel">
          <div class="panel-head">
            <h2>🤖 Agent 工具查询可视化</h2>
          </div>
          
          <div class="panel-body">
            <div class="tool-visual">
              <div class="pulse-stage" :class="{ 'scan': toolState.isScanning, 'idle': !toolState.isScanning }">
                <div class="pulse-center"></div>
                <div class="pulse-ring ring-1"></div>
                <div class="pulse-ring ring-2"></div>
                <div class="pulse-ring ring-3"></div>
              </div>
              
              <div class="tool-meta">
                <span class="tool-status" :class="toolState.status">
                  {{ toolState.status === 'searching' ? '工具查询中' : toolState.status === 'done' ? '查询完成' : '等待工具调用' }}
                </span>
                
                <div class="batch-meta">
                  <div class="batch-label">{{ batchInfo.label }}</div>
                  <div class="batch-progress">
                    <div class="batch-fill" :style="{ width: batchInfo.percent + '%' }"></div>
                  </div>
                </div>
                
                <div class="tool-section">
                  <div class="tool-section-label">最近一次工具请求</div>
                  <div class="tool-query">{{ toolState.query }}</div>
                </div>
                
                <div class="tool-section">
                  <div class="tool-section-label">最近一次工具结果摘要</div>
                  <div class="tool-result">{{ toolState.result }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel-head">
              <h2>📋 candidates</h2>
              <span class="data-count" v-if="candidates.length">{{ candidates.length }} 条</span>
            </div>
            <div class="panel-body data-panel">
              <div v-if="candidates.length > 0" class="scroll-box">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>name</th>
                      <th>detector</th>
                      <th>pattern</th>
                      <th>imbalance</th>
                      <th>args</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in candidates" :key="idx">
                      <td>{{ item.name }}</td>
                      <td>{{ item.detector }}</td>
                      <td>{{ item.pattern }}</td>
                      <td>{{ item.imbalance }}</td>
                      <td class="args-cell">{{ formatArgs(item.args) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty-state">暂无数据</div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h2>🎯 shortlist</h2>
              <span class="data-count" v-if="shortlist.length">{{ shortlist.length }} 条</span>
            </div>
            <div class="panel-body data-panel">
              <div v-if="shortlist.length > 0" class="scroll-box list-box">
                <ol class="shortlist-ol">
                  <li v-for="(name, idx) in shortlist" :key="idx">{{ name }}</li>
                </ol>
              </div>
              <div v-else class="empty-state">暂无数据</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="panel">
            <div class="panel-head">
              <h2>📊 audit_reports</h2>
              <span class="data-count" v-if="auditReports.length">{{ auditReports.length }} 条</span>
            </div>
            <div class="panel-body data-panel">
              <div v-if="auditReports.length > 0" class="scroll-box">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>func_name</th>
                      <th>attack_type</th>
                      <th>leaked_info</th>
                      <th>reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in auditReports" :key="idx" class="audit-row" @click="generateExp(item)">
                      <td class="func-cell">{{ item.func_name }}</td>
                      <td class="type-cell">{{ item.attack_type }}</td>
                      <td class="leak-cell">{{ item.leaked_info }}</td>
                      <td class="reason-cell">{{ item.reason }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty-state">暂无数据</div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h2>📄 final_report</h2>
            </div>
            <div class="panel-body data-panel">
              <div v-if="finalReport" class="scroll-box">
                <pre class="final-report-pre">{{
                  typeof finalReport === 'string' 
                    ? finalReport 
                    : (finalReport.content || JSON.stringify(finalReport, null, 2))
                }}</pre>
              </div>
              <div v-else class="empty-state">暂无数据</div>
            </div>
          </div>
        </div>

        <div class="panel result-panel" v-if="showResult && auditReports.length > 0">
          <div class="panel-head">
            <h2>💥 EXP 生成</h2>
            <div class="exp-actions">
              <button class="btn-copy" @click="copyExp">📋 复制</button>
              <button class="btn-download" @click="downloadExp">⬇️ 下载</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="exp-code">
              <pre>{{ generatedExp || '点击上方 audit_reports 表格中的行生成 EXP' }}</pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

.detect-container {
  min-height: 100vh;
  padding: 20px;
  position: relative;
  font-family: 'Space Grotesk', 'Rajdhani', sans-serif;
}

.bg-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.15;
  background-image: 
    linear-gradient(to right, rgba(0, 212, 255, 0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 212, 255, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(circle at center, black 20%, transparent 80%);
  z-index: 0;
}

.hero-section {
  text-align: center;
  padding: 25px 20px;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
  animation: fadeInDown 0.6s ease-out;
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.hero-title {
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(22px, 2.8vw, 32px);
  font-weight: 700;
  background: linear-gradient(135deg, var(--secondary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.title-icon {
  font-size: 1.1em;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.hero-desc {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  max-width: 550px;
  margin: 0 auto;
}

.main-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 18px;
  position: relative;
  z-index: 1;
}

@media (max-width: 1100px) {
  .main-layout { grid-template-columns: 1fr; }
}

.left-panel, .right-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel {
  background: var(--bg-card);
  border: 1px solid var(--border-glow);
  border-radius: 14px;
  overflow: hidden;
  backdrop-filter: blur(12px);
  position: relative;
  animation: scaleIn 0.5s ease-out backwards;
}

.panel:nth-child(1) { animation-delay: 0.05s; }
.panel:nth-child(2) { animation-delay: 0.1s; }
.panel:nth-child(3) { animation-delay: 0.15s; }
.panel:nth-child(4) { animation-delay: 0.2s; }

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--secondary), transparent);
}

.panel-head {
  padding: 14px 18px;
  border-bottom: 1px dashed rgba(0, 212, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel-head h2 {
  font-family: 'Orbitron', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--secondary);
  margin: 0;
}

.panel-body {
  padding: 14px 18px 18px;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
}

.form-input {
  width: 100%;
  padding: 9px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  transition: all 0.2s ease;
}

.form-input:focus {
  border-color: var(--secondary);
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2);
  outline: none;
}

.upload-zone {
  position: relative;
  border: 2px dashed rgba(0, 212, 255, 0.3);
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
  transition: all 0.25s ease;
  background: rgba(0, 0, 0, 0.2);
  margin-bottom: 12px;
}

.upload-zone:hover {
  border-color: var(--secondary);
  background: rgba(0, 212, 255, 0.05);
}

.upload-zone.drag-over {
  border-color: var(--accent);
  background: rgba(0, 255, 157, 0.1);
  transform: scale(1.02);
}

.upload-zone.has-file {
  border-style: solid;
  border-color: var(--accent);
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.upload-icon {
  font-size: 36px;
  transition: transform 0.3s ease;
}

.upload-icon.bounce {
  animation: bounce 0.5s ease infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.success-icon {
  animation: successPop 0.4s ease;
}

@keyframes successPop {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.upload-title {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.upload-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 50%;
  background: rgba(255, 51, 102, 0.2);
  border: 1px solid rgba(255, 51, 102, 0.4);
  color: var(--danger);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: rgba(255, 51, 102, 0.4);
  transform: scale(1.1);
}

.detector-section {
  margin-bottom: 14px;
}

.detector-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.checks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 7px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  transition: all 0.2s ease;
}

.check-item:hover {
  background: rgba(0, 212, 255, 0.1);
}

.check-item input { display: none; }

.check-box {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 212, 255, 0.5);
  border-radius: 3px;
  position: relative;
  transition: all 0.2s ease;
}

.check-item input:checked + .check-box {
  background: var(--secondary);
  border-color: var(--secondary);
}

.check-item input:checked + .check-box::after {
  content: '✓';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000;
  font-size: 11px;
  font-weight: bold;
}

.check-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-family: 'IBM Plex Mono', monospace;
}

.btn-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.btn-primary, .btn-secondary {
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-primary {
  background: linear-gradient(135deg, var(--secondary), var(--primary));
  border: none;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 0 25px rgba(0, 212, 255, 0.4);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.loading-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.meta-info {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  background: rgba(0, 212, 255, 0.15);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 10px;
  font-family: 'IBM Plex Mono', monospace;
  color: var(--secondary);
}

.pill.status-streaming { background: rgba(0, 255, 157, 0.15); border-color: rgba(0, 255, 157, 0.3); color: var(--accent); }
.pill.status-error { background: rgba(255, 51, 102, 0.15); border-color: rgba(255, 51, 102, 0.3); color: var(--danger); }
.pill.status-finished { background: rgba(0, 255, 157, 0.2); border-color: var(--accent); color: var(--accent); }

.phase-line {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.phase {
  position: relative;
  padding: 10px 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  text-align: center;
  transition: all 0.3s ease;
}

.phase-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'IBM Plex Mono', monospace;
}

.phase-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: var(--secondary);
  transition: width 0.3s ease;
}

.phase.active {
  background: rgba(0, 212, 255, 0.15);
  border-color: var(--secondary);
}

.phase.active .phase-name { color: var(--secondary); font-weight: 600; }
.phase.active .phase-indicator { width: 50%; }

.phase.completed {
  background: rgba(0, 255, 157, 0.1);
  border-color: var(--accent);
}

.phase.completed .phase-name { color: var(--accent); }

.phase-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

.terminal-panel .panel-body { padding: 0; }

.log-count {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'IBM Plex Mono', monospace;
}

.terminal-output {
  min-height: 180px;
  max-height: 280px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.4);
  padding: 10px 14px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  line-height: 1.5;
}

.log-line {
  margin-bottom: 3px;
  display: flex;
  gap: 6px;
  animation: logSlide 0.25s ease;
}

@keyframes logSlide {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

.log-time { color: rgba(255, 255, 255, 0.4); flex-shrink: 0; }
.log-type { color: rgba(255, 255, 255, 0.5); flex-shrink: 0; }
.log-msg { word-break: break-word; }

.log-line.log-info .log-msg { color: var(--secondary); }
.log-line.log-warning .log-msg { color: var(--warning); }
.log-line.log-error .log-msg { color: var(--danger); }
.log-line.log-ai .log-msg { color: #9dd8ff; }
.log-line.log-control .log-msg { color: var(--accent); }

.log-empty {
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  padding: 30px;
}

.tool-visual {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 16px;
  align-items: center;
}

@media (max-width: 600px) {
  .tool-visual { grid-template-columns: 1fr; }
}

.pulse-stage {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: radial-gradient(circle at center, rgba(0, 212, 255, 0.25) 0%, rgba(0, 212, 255, 0.08) 40%, transparent 70%);
  border: 1px solid rgba(0, 212, 255, 0.4);
  position: relative;
  display: grid;
  place-items: center;
  margin: 0 auto;
}

.pulse-center {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--secondary), var(--accent));
  box-shadow: 0 0 18px rgba(0, 212, 255, 0.5);
  z-index: 2;
}

.pulse-stage.scan .pulse-center {
  animation: heartbeat 1.2s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}

.pulse-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(0, 212, 255, 0.5);
  pointer-events: none;
}

.ring-1 { inset: 12px; }
.ring-2 { inset: 24px; border-style: dashed; }
.ring-3 { inset: 36px; border-width: 2px; }

.pulse-stage.scan .ring-1 { animation: ringExpand 2s linear infinite; }
.pulse-stage.scan .ring-2 { animation: ringExpand 2s linear infinite 0.4s; }
.pulse-stage.scan .ring-3 { animation: ringExpand 2s linear infinite 0.8s; }

@keyframes ringExpand {
  0% { transform: scale(0.85); opacity: 0.7; }
  100% { transform: scale(1.25); opacity: 0; }
}

.pulse-stage.idle .pulse-center,
.pulse-stage.idle .pulse-ring { opacity: 0.4; }

.tool-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.tool-status {
  display: inline-block;
  width: fit-content;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.tool-status.wait { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.6); }
.tool-status.searching { background: rgba(0, 212, 255, 0.2); color: var(--secondary); animation: pulse 1s ease infinite; }
.tool-status.done { background: rgba(0, 255, 157, 0.2); color: var(--accent); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.batch-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.batch-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'IBM Plex Mono', monospace;
}

.batch-progress {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 212, 255, 0.2);
  overflow: hidden;
}

.batch-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--secondary), var(--accent));
  transition: width 0.3s ease;
}

.tool-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-section-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.tool-query, .tool-result {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 6px;
  padding: 8px 10px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  min-height: 40px;
  max-height: 70px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.tool-result {
  border-color: rgba(0, 255, 157, 0.3);
  color: var(--accent);
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

@media (max-width: 900px) {
  .grid-2 { grid-template-columns: 1fr; }
}

.data-count {
  font-size: 10px;
  color: var(--accent);
  background: rgba(0, 255, 157, 0.15);
  padding: 2px 8px;
  border-radius: 999px;
  font-family: 'IBM Plex Mono', monospace;
}

.data-panel {
  min-height: 120px;
}

.scroll-box {
  max-height: 220px;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.data-table th {
  background: rgba(0, 0, 0, 0.3);
  padding: 8px 10px;
  text-align: left;
  font-weight: 600;
  color: var(--secondary);
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
  white-space: nowrap;
  position: sticky;
  top: 0;
}

.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.args-cell {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
}

.list-box {
  padding: 8px;
}

.shortlist-ol {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.shortlist-ol li {
  margin-bottom: 4px;
  padding: 4px 0;
}

.audit-row {
  cursor: pointer;
  transition: background 0.2s ease;
}

.audit-row:hover {
  background: rgba(0, 212, 255, 0.08);
}

.func-cell {
  font-weight: 600;
  color: #fff;
}

.type-cell { color: var(--warning); }
.leak-cell { color: var(--accent); }
.reason-cell { font-size: 10px; color: rgba(255, 255, 255, 0.7); }

.final-report-pre {
  margin: 0;
  padding: 10px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  padding: 30px;
  font-size: 12px;
}

.result-panel .panel-head {
  flex-wrap: wrap;
}

.exp-actions {
  display: flex;
  gap: 6px;
}

.btn-copy, .btn-download {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-copy {
  background: rgba(0, 212, 255, 0.2);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: var(--secondary);
}

.btn-copy:hover { background: rgba(0, 212, 255, 0.3); }

.btn-download {
  background: linear-gradient(135deg, var(--accent), #00cc7d);
  border: none;
  color: #000;
}

.btn-download:hover { box-shadow: 0 0 15px rgba(0, 255, 157, 0.4); }

.exp-code {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 8px;
  overflow: auto;
  max-height: 300px;
}

.exp-code pre {
  padding: 12px;
  margin: 0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

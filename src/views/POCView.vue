<script setup>
import { ref, computed, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import { useVulnStore } from '../stores/vulnStore'

const vulnStore = useVulnStore()
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

const API_BASE = (
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_HOST_DETECT_API_BASE ||
  'http://127.0.0.1:8090'
).replace(/\/$/, '')

const searchKeyword = ref('')
const selectedCveType = ref('')
const selectedAttackType = ref('')
const selectedArch = ref('')
const selectedRisk = ref('')

const showModal = ref(false)
const selectedVuln = ref(null)
const actionError = ref('')

const showReportModal = ref(false)
const reportLoading = ref(false)
const reportError = ref('')
const reportTitle = ref('')
const reportHtml = ref('')

const riskLevels = [
  { label: '全部风险', value: '' },
  { label: '高危', value: 'high' },
  { label: '中危', value: 'medium' },
  { label: '低危', value: 'low' }
]

const cveTypes = computed(() => [{ label: '全部类型', value: '' }, ...vulnStore.cveTypes])
const attackTypes = computed(() => [{ label: '全部攻击类型', value: '' }, ...vulnStore.attackTypes])
const architectures = computed(() => [{ label: '全部架构', value: '' }, ...vulnStore.architectures])

const filteredVulns = computed(() => {
  return vulnStore.searchVulns(searchKeyword.value, {
    cveType: selectedCveType.value,
    attackType: selectedAttackType.value,
    architecture: selectedArch.value,
    riskLevel: selectedRisk.value
  })
})

const hasCodeType = (vuln, type) => Array.isArray(vuln?.codeTags) && vuln.codeTags.includes(type)

const openDetail = (vuln) => {
  selectedVuln.value = vuln
  actionError.value = ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedVuln.value = null
  actionError.value = ''
}

const parseFilename = (contentDisposition, fallback) => {
  if (!contentDisposition) return fallback
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match && utf8Match[1]) return decodeURIComponent(utf8Match[1])
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] || fallback
}

const downloadCode = async (vuln, artifact) => {
  actionError.value = ''
  const fallback = `${vuln.name}_${artifact}.c`
  const url = `${API_BASE}/api/v1/vulnerabilities/by-name/${encodeURIComponent(vuln.name)}/artifacts/${encodeURIComponent(artifact)}`

  try {
    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `下载失败(${response.status})`)
    }

    const blob = await response.blob()
    const filename = parseFilename(response.headers.get('content-disposition'), fallback)
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    a.click()
    URL.revokeObjectURL(href)
  } catch (err) {
    actionError.value = err.message || '下载失败，请稍后重试'
  }
}

const resolveReportPath = (vuln) => {
  if (vuln.reportPath && String(vuln.reportPath).trim()) {
    return vuln.reportPath
  }
  return `/reports/${encodeURIComponent(vuln.name)}.md`
}

const openReport = async (vuln) => {
  reportTitle.value = `${vuln.name} 实验报告`
  reportLoading.value = true
  reportError.value = ''
  reportHtml.value = ''
  showReportModal.value = true

  try {
    const response = await fetch(resolveReportPath(vuln), { cache: 'no-cache' })
    if (!response.ok) {
      throw new Error(`报告加载失败(${response.status})`)
    }
    const markdown = await response.text()
    reportHtml.value = md.render(markdown)
  } catch (err) {
    reportError.value = err.message || '报告加载失败'
  } finally {
    reportLoading.value = false
  }
}

const closeReport = () => {
  showReportModal.value = false
  reportLoading.value = false
  reportError.value = ''
  reportHtml.value = ''
}

onMounted(() => {
  vulnStore.loadVulnerabilities()
})
</script>

<template>
  <div class="poc-view">
    <div class="filter-section glass-card">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索漏洞名称、CVE编号、简介..."
          class="search-input"
        />
      </div>

      <div class="filter-group">
        <select v-model="selectedCveType" class="filter-select">
          <option v-for="item in cveTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>

        <select v-model="selectedAttackType" class="filter-select">
          <option v-for="item in attackTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>

        <select v-model="selectedArch" class="filter-select">
          <option v-for="item in architectures" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>

        <select v-model="selectedRisk" class="filter-select">
          <option v-for="item in riskLevels" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>

      <div class="result-count">
        找到 <span class="count">{{ filteredVulns.length }}</span> 个漏洞详情
      </div>
    </div>

    <div v-if="vulnStore.loadError" class="empty-state">
      <h3>漏洞数据加载失败</h3>
      <p>{{ vulnStore.loadError }}</p>
    </div>

    <div v-else class="poc-grid">
      <div
        v-for="vuln in filteredVulns"
        :key="vuln.id"
        class="vuln-card glass-card"
        :class="vuln.riskLevel"
      >
        <div class="vuln-header">
          <h3 class="vuln-name">{{ vuln.name }}</h3>
          <span class="risk-badge" :class="vuln.riskLevel">{{ vuln.riskText }}</span>
        </div>

        <div class="vuln-meta">
          <span class="meta-item"><span class="meta-icon">🆔</span>{{ vuln.cveId }}</span>
          <span class="meta-item"><span class="meta-icon">🎯</span>{{ vuln.attackType }}</span>
          <span class="meta-item"><span class="meta-icon">💻</span>{{ vuln.architecture }}</span>
        </div>

        <p class="vuln-desc">{{ vuln.summary }}</p>

        <div class="code-types">
          <span v-if="hasCodeType(vuln, 'poc')" class="type-badge poc">POC</span>
          <span v-if="hasCodeType(vuln, 'exp')" class="type-badge exp">EXP</span>
        </div>

        <div class="vuln-stats">
          <div class="stat">
            <span class="stat-label">平均检测用时</span>
            <span class="stat-value">{{ vuln.avgTime }}</span>
          </div>
        </div>

        <div class="vuln-actions">
          <button class="btn-detail" @click="openDetail(vuln)">📖 查看详情</button>
          <button v-if="hasCodeType(vuln, 'poc')" class="btn-download" @click.stop="downloadCode(vuln, 'poc')">⬇️ 下载POC</button>
          <button v-if="hasCodeType(vuln, 'exp')" class="btn-download exp-btn" @click.stop="downloadCode(vuln, 'exp')">⬇️ 下载EXP</button>
        </div>
      </div>
    </div>

    <div v-if="!vulnStore.loadError && filteredVulns.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>未找到匹配的漏洞</h3>
      <p>请尝试调整筛选条件</p>
    </div>

    <div class="modal-overlay" :class="{active: showModal}" @click="closeModal">
      <div class="modal-content" v-if="selectedVuln" @click.stop>
        <div class="modal-header">
          <div class="modal-title-wrap">
            <h3 class="modal-title">{{ selectedVuln.name }}</h3>
            <span class="risk-badge" :class="selectedVuln.riskLevel">{{ selectedVuln.riskText }}</span>
          </div>
          <button class="modal-close" @click="closeModal">×</button>
        </div>

        <div class="modal-body">
          <div class="vuln-section">
            <h4>📌 基本信息</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">漏洞名</span>
                <span class="info-value">{{ selectedVuln.name }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">CVE编号</span>
                <span class="info-value">{{ selectedVuln.cveId }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">攻击类型</span>
                <span class="info-value">{{ selectedVuln.attackType }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">风险级别</span>
                <span class="info-value">{{ selectedVuln.riskText }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">处理器平台</span>
                <span class="info-value">{{ selectedVuln.architecture }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">平均检测用时</span>
                <span class="info-value">{{ selectedVuln.avgTime }}</span>
              </div>
            </div>
          </div>

          <div class="vuln-section">
            <h4>🔍 一句话简介</h4>
            <p>{{ selectedVuln.summary }}</p>
          </div>

          <div class="vuln-section">
            <h4>⚙️ 适用平台</h4>
            <div class="platform-list">
              <span class="platform-item" v-for="os in selectedVuln.osSupport" :key="os">{{ os }}</span>
            </div>
          </div>

          <div v-if="actionError" class="run-error">{{ actionError }}</div>

          <div class="modal-actions">
            <button class="btn-detail" @click="openReport(selectedVuln)">🧪 查看实验报告</button>
            <button v-if="hasCodeType(selectedVuln, 'poc')" class="btn-download" @click="downloadCode(selectedVuln, 'poc')">⬇️ 下载POC代码</button>
            <button v-if="hasCodeType(selectedVuln, 'exp')" class="btn-download exp-btn" @click="downloadCode(selectedVuln, 'exp')">⬇️ 下载EXP代码</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" :class="{active: showReportModal}" @click="closeReport">
      <div class="modal-content report-modal" @click.stop>
        <div class="modal-header">
          <div class="modal-title-wrap">
            <h3 class="modal-title">{{ reportTitle }}</h3>
          </div>
          <button class="modal-close" @click="closeReport">×</button>
        </div>
        <div class="modal-body report-body">
          <div v-if="reportLoading" class="empty-state"><p>报告加载中...</p></div>
          <div v-else-if="reportError" class="run-error">{{ reportError }}</div>
          <article v-else class="markdown-body" v-html="reportHtml"></article>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.poc-view {
  width: 100%;
}

.filter-section {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding: 20px;
}

.search-box {
  flex: 1;
  min-width: 300px;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 10px;
  padding: 0 15px;
}

.search-icon {
  font-size: 16px;
  margin-right: 10px;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 12px 0;
}

.filter-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-select {
  min-width: 150px;
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
}

.result-count {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.result-count .count {
  color: var(--secondary);
  font-weight: 600;
}

.poc-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.vuln-card {
  transition: all 0.3s;
}

.vuln-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0, 212, 255, 0.2);
}

.vuln-card.high { border-left: 3px solid var(--danger); }
.vuln-card.medium { border-left: 3px solid var(--warning); }
.vuln-card.low { border-left: 3px solid var(--success); }

.vuln-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.vuln-name {
  font-family: 'Orbitron', sans-serif;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.risk-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.risk-badge.high { background: rgba(255, 51, 102, 0.2); color: var(--danger); }
.risk-badge.medium { background: rgba(255, 170, 0, 0.2); color: var(--warning); }
.risk-badge.low { background: rgba(0, 255, 157, 0.2); color: var(--success); }

.vuln-meta {
  display: flex;
  gap: 15px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.meta-icon {
  font-size: 14px;
}

.vuln-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.code-types {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.type-badge {
  padding: 3px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
}

.type-badge.poc {
  background: rgba(0, 212, 255, 0.15);
  color: var(--secondary);
}

.type-badge.exp {
  background: rgba(255, 51, 102, 0.15);
  color: var(--danger);
}

.vuln-stats {
  display: flex;
  gap: 20px;
  padding: 12px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 15px;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--secondary);
}

.vuln-actions {
  display: flex;
  gap: 10px;
}

.btn-detail, .btn-download {
  flex: 0 0 auto;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.btn-detail {
  flex: 1.2;
  background: rgba(0, 212, 255, 0.15);
  color: var(--secondary);
  border: 1px solid var(--border-glow);
}

.btn-download {
  flex: 1;
  background: linear-gradient(135deg, var(--secondary), var(--primary));
  color: #fff;
}

.btn-detail:hover {
  background: rgba(0, 212, 255, 0.25);
}

.btn-download:hover {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
}

.btn-download.exp-btn {
  background: linear-gradient(135deg, #ff3366, #cc2952);
}

.btn-download.exp-btn:hover {
  box-shadow: 0 0 20px rgba(255, 51, 102, 0.4);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

.empty-state h3 {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10px;
}

.empty-state p {
  color: rgba(255, 255, 255, 0.5);
}

.modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 15px;
}

.modal-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.vuln-section {
  margin-bottom: 25px;
}

.vuln-section h4 {
  font-family: 'Orbitron', sans-serif;
  font-size: 14px;
  color: var(--secondary);
  margin-bottom: 12px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: #fff;
}

.platform-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.platform-item {
  padding: 6px 14px;
  background: rgba(0, 255, 157, 0.15);
  border-radius: 20px;
  font-size: 12px;
  color: var(--success);
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-glow);
}

.run-error {
  margin-top: 10px;
  padding: 12px;
  background: rgba(255, 51, 102, 0.12);
  border: 1px solid rgba(255, 51, 102, 0.3);
  border-radius: 8px;
  color: #ff7b99;
  font-size: 12px;
}

.report-modal {
  width: min(1000px, 90vw);
}

.report-body {
  max-height: 70vh;
  overflow: auto;
}

.markdown-body {
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.75;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  color: var(--secondary);
  margin-top: 1.2em;
}

.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.35);
  padding: 2px 6px;
  border-radius: 6px;
}

.markdown-body :deep(pre) {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-glow);
  border-radius: 10px;
  padding: 12px;
  overflow-x: auto;
}

.markdown-body :deep(a) {
  color: var(--secondary);
}

@media (max-width: 1400px) {
  .poc-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 900px) {
  .poc-grid {
    grid-template-columns: 1fr;
  }

  .filter-section {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    min-width: unset;
  }

  .modal-actions {
    flex-direction: column;
  }

  .vuln-actions {
    flex-direction: column;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>

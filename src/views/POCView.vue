<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useVulnStore } from '../stores/vulnStore'

const router = useRouter()
const vulnStore = useVulnStore()

const searchKeyword = ref('')
const selectedCveType = ref('')
const selectedAttackType = ref('')
const selectedArch = ref('')
const selectedRisk = ref('')

const showModal = ref(false)
const selectedVuln = ref(null)

const filteredVulns = computed(() => {
  return vulnStore.searchVulns(searchKeyword.value, {
    cveType: selectedCveType.value,
    attackType: selectedAttackType.value,
    architecture: selectedArch.value,
    riskLevel: selectedRisk.value
  })
})

const cveTypes = [
  { label: '全部类型', value: '' },
  { label: '侧信道漏洞', value: '侧信道漏洞' },
  { label: '瞬态执行漏洞', value: '瞬态执行漏洞' },
  { label: '架构错误漏洞', value: '架构错误漏洞' }
]

const attackTypes = [
  { label: '全部攻击类型', value: '' },
  { label: 'Cache侧信道攻击', value: 'Cache侧信道攻击' },
  { label: 'Timing侧信道攻击', value: 'Timing侧信道攻击' },
  { label: 'Power侧信道攻击', value: 'Power侧信道攻击' },
  { label: 'Meltdown类攻击', value: 'Meltdown类攻击' },
  { label: 'Spectre类攻击', value: 'Spectre类攻击' },
  { label: '架构错误', value: '架构错误' }
]

const architectures = [
  { label: '全部架构', value: '' },
  { label: 'Intel', value: 'Intel' },
  { label: 'AMD', value: 'AMD' },
  { label: 'ARM', value: 'ARM' },
  { label: 'RISC-V', value: 'RISC-V' }
]

const riskLevels = [
  { label: '全部风险', value: '' },
  { label: '高危', value: 'high' },
  { label: '中危', value: 'medium' },
  { label: '低危', value: 'low' }
]

const openDetail = (vuln) => {
  selectedVuln.value = vuln
  showModal.value = true
}

const downloadCode = (vuln, codeType) => {
  const code = codeType === 'poc' ? vuln.pocCode : vuln.expAttackerCode
  const filename = `${vuln.name}_${codeType}.c`
  
  const blob = new Blob([code], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const closeModal = () => {
  showModal.value = false
  selectedVuln.value = null
}
</script>

<template>
  <div class="poc-view">
    <!-- 搜索和筛选区域 -->
    <div class="filter-section glass-card">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input 
          v-model="searchKeyword" 
          type="text" 
          placeholder="搜索漏洞名称、CVE类型、描述..."
          class="search-input"
        />
      </div>
      
      <div class="filter-group">
        <select v-model="selectedCveType" class="filter-select">
          <option v-for="item in cveTypes" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        
        <select v-model="selectedAttackType" class="filter-select">
          <option v-for="item in attackTypes" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        
        <select v-model="selectedArch" class="filter-select">
          <option v-for="item in architectures" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        
        <select v-model="selectedRisk" class="filter-select">
          <option v-for="item in riskLevels" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </div>
      
      <div class="result-count">
        找到 <span class="count">{{ filteredVulns.length }}</span> 个漏洞POC
      </div>
    </div>

    <!-- POC卡片列表 -->
    <div class="poc-grid">
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
          <span class="meta-item">
            <span class="meta-icon">🎯</span>
            {{ vuln.attackType }}
          </span>
          <span class="meta-item">
            <span class="meta-icon">💻</span>
            {{ vuln.architecture }}
          </span>
        </div>
        
        <p class="vuln-desc">{{ vuln.description }}</p>
        
        <div class="vuln-tags">
          <span v-for="tag in vuln.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        
        <div class="vuln-stats">
          <div class="stat">
            <span class="stat-label">成功率</span>
            <span class="stat-value">{{ vuln.successRate }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">平均耗时</span>
            <span class="stat-value">{{ vuln.avgTime }}</span>
          </div>
        </div>
        
        <div class="vuln-actions">
          <button class="btn-detail" @click="openDetail(vuln)">
            📖 查看详情
          </button>
          <button class="btn-download" @click.stop="downloadCode(vuln, 'poc')">
            ⬇️ 下载POC
          </button>
        </div>
      </div>
    </div>

    <!-- 无结果提示 -->
    <div v-if="filteredVulns.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>未找到匹配的漏洞</h3>
      <p>请尝试调整筛选条件</p>
    </div>

    <!-- 详情弹窗 -->
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
                <span class="info-label">CVE类型</span>
                <span class="info-value">{{ selectedVuln.cveType }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">攻击类型</span>
                <span class="info-value">{{ selectedVuln.attackType }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">处理器架构</span>
                <span class="info-value">{{ selectedVuln.architecture }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">成功率</span>
                <span class="info-value">{{ selectedVuln.successRate }}</span>
              </div>
            </div>
          </div>

          <div class="vuln-section">
            <h4>🔍 攻击原理</h4>
            <p>{{ selectedVuln.description }}</p>
          </div>

          <div class="vuln-section">
            <h4>💻 POC代码</h4>
            <div class="code-block">
              <pre>{{ selectedVuln.pocCode }}</pre>
            </div>
          </div>

          <div class="vuln-section">
            <h4>⚙️ 支持平台</h4>
            <div class="platform-list">
              <span class="platform-item" v-for="os in selectedVuln.osSupport" :key="os">
                {{ os }}
              </span>
            </div>
            <div class="cpu-list">
              <span v-for="cpu in selectedVuln.cpuModels" :key="cpu" class="cpu-item">
                {{ cpu }}
              </span>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn-download" @click="downloadCode(selectedVuln, 'poc')">
              ⬇️ 下载POC代码
            </button>
          </div>
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

.vuln-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 15px;
}

.tag {
  padding: 4px 10px;
  background: rgba(0, 212, 255, 0.15);
  border-radius: 15px;
  font-size: 11px;
  color: var(--secondary);
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
  flex: 1;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.btn-detail {
  background: rgba(0, 212, 255, 0.15);
  color: var(--secondary);
  border: 1px solid var(--border-glow);
}

.btn-detail:hover {
  background: rgba(0, 212, 255, 0.25);
}

.btn-download {
  background: linear-gradient(135deg, var(--secondary), var(--primary));
  color: #fff;
}

.btn-download:hover {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
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

.platform-list, .cpu-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.platform-item {
  padding: 6px 14px;
  background: rgba(0, 255, 157, 0.15);
  border-radius: 20px;
  font-size: 12px;
  color: var(--success);
}

.cpu-item {
  padding: 6px 14px;
  background: rgba(0, 212, 255, 0.15);
  border-radius: 20px;
  font-size: 12px;
  color: var(--secondary);
}

.modal-actions {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-glow);
}

@media (max-width: 1200px) {
  .poc-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .poc-grid {
    grid-template-columns: 1fr;
  }
  
  .filter-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group {
    width: 100%;
  }
  
  .filter-select {
    flex: 1;
    min-width: auto;
  }
}
</style>

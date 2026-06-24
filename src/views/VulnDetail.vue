<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVulnStore } from '../stores/vulnStore'

const route = useRoute()
const router = useRouter()
const vulnStore = useVulnStore()

const vuln = ref(null)
const activeTab = ref('info')
const loading = ref(true)

onMounted(() => {
  const id = route.params.id
  vuln.value = vulnStore.getVulnById(id)
  loading.value = false
})

const downloadCode = async (codeType) => {
  if (!vuln.value) return

  const artifact = codeType === 'poc' ? 'poc' : 'exp'
  const filename = `${vuln.value.name}_${artifact}.zip`
  const path = `/artifacts/${encodeURIComponent(filename)}`

  try {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-cache' })
    if (!response.ok) throw new Error()
    const a = document.createElement('a')
    a.href = path
    a.download = filename
    a.click()
  } catch {
    window.alert(`未找到文件：${filename}`)
  }
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="detail-view">
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
    
    <div v-else-if="!vuln" class="not-found">
      <div class="not-found-icon">🔍</div>
      <h2>未找到漏洞信息</h2>
      <button @click="goBack">返回</button>
    </div>
    
    <div v-else class="detail-content">
      <!-- 返回按钮 -->
      <button class="btn-back" @click="goBack">
        ← 返回
      </button>
      
      <!-- 头部信息 -->
      <div class="detail-header glass-card">
        <div class="header-left">
          <h1 class="vuln-title">{{ vuln.name }}</h1>
          <div class="vuln-badges">
            <span class="risk-badge" :class="vuln.riskLevel">{{ vuln.riskText }}</span>
            <span class="type-badge">{{ vuln.cveType }}</span>
            <span class="arch-badge">{{ vuln.architecture }}</span>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-download" @click="downloadCode('poc')">
            ⬇️ 下载POC
          </button>
          <button class="btn-download exp" @click="downloadCode('attacker')">
            💥 下载EXP
          </button>
        </div>
      </div>
      
      <!-- 标签页 -->
      <div class="detail-tabs">
        <button 
          class="tab-btn" 
          :class="{active: activeTab === 'info'}"
          @click="activeTab = 'info'"
        >
          📌 基本信息
        </button>
        <button 
          class="tab-btn" 
          :class="{active: activeTab === 'code'}"
          @click="activeTab = 'code'"
        >
          💻 代码示例
        </button>
        <button 
          class="tab-btn" 
          :class="{active: activeTab === 'report'}"
          @click="activeTab = 'report'"
        >
          📄 分析报告
        </button>
      </div>
      
      <!-- 基本信息 -->
      <div v-if="activeTab === 'info'" class="tab-content">
        <div class="info-section glass-card">
          <h3>攻击原理</h3>
          <p>{{ vuln.description }}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-card glass-card">
            <h4>📊 统计信息</h4>
            <div class="stat-row">
              <span class="stat-label">成功率</span>
              <span class="stat-value">{{ vuln.successRate }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">平均耗时</span>
              <span class="stat-value">{{ vuln.avgTime }}</span>
            </div>
          </div>
          
          <div class="info-card glass-card">
            <h4>💻 支持平台</h4>
            <div class="platform-tags">
              <span v-for="os in vuln.osSupport" :key="os" class="platform-tag">
                {{ os }}
              </span>
            </div>
            <div class="cpu-tags">
              <span v-for="cpu in vuln.cpuModels" :key="cpu" class="cpu-tag">
                {{ cpu }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="info-card glass-card">
          <h4>🏷️ 标签</h4 class="tags-list>
          <div>
            <span v-for="tag in vuln.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
      
      <!-- 代码示例 -->
      <div v-if="activeTab === 'code'" class="tab-content">
        <div class="code-section glass-card">
          <div class="code-header">
            <h3>🎯 POC代码</h3>
            <button class="btn-copy" @click="downloadCode('poc')">⬇️ 下载</button>
          </div>
          <div class="code-block">
            <pre>{{ vuln.pocCode }}</pre>
          </div>
        </div>
        
        <div class="code-section glass-card">
          <div class="code-header">
            <h3>💀 攻击者代码</h3>
            <button class="btn-copy" @click="downloadCode('attacker')">⬇️ 下载</button>
          </div>
          <div class="code-block">
            <pre>{{ vuln.expAttackerCode }}</pre>
          </div>
        </div>
        
        <div class="code-section glass-card">
          <div class="code-header">
            <h3>🛡️ 受害者代码</h3>
            <button class="btn-copy" @click="downloadCode('victim')">⬇️ 下载</button>
          </div>
          <div class="code-block">
            <pre>{{ vuln.expVictimCode }}</pre>
          </div>
        </div>
      </div>
      
      <!-- 分析报告 -->
      <div v-if="activeTab === 'report'" class="tab-content">
        <div class="report-section glass-card">
          <div class="report-header">
            <h3>📄 漏洞分析报告</h3>
            <p>详细的技术分析报告 (MD格式)</p>
          </div>
          
          <div class="report-placeholder">
            <div class="placeholder-icon">📝</div>
            <h4>报告模板</h4>
            <p>请在 assets/report/ 目录下创建对应的 MD 报告文件</p>
            <p class="file-hint">文件名格式: {{ vuln.name.toLowerCase() }}.md</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-view {
  width: 100%;
}

.loading, .not-found {
  text-align: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid var(--border-glow);
  border-top-color: var(--secondary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.not-found-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

.not-found h2 {
  margin-bottom: 20px;
  color: rgba(255, 255, 255, 0.7);
}

.btn-back {
  background: rgba(0, 212, 255, 0.15);
  border: 1px solid var(--border-glow);
  color: var(--secondary);
  padding: 10px 20px;
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.vuln-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 28px;
  color: #fff;
  margin-bottom: 12px;
}

.vuln-badges {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.risk-badge {
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.risk-badge.high { background: rgba(255, 51, 102, 0.2); color: var(--danger); }
.risk-badge.medium { background: rgba(255, 170, 0, 0.2); color: var(--warning); }
.risk-badge.low { background: rgba(0, 255, 157, 0.2); color: var(--success); }

.type-badge, .arch-badge {
  padding: 5px 15px;
  background: rgba(0, 212, 255, 0.15);
  border-radius: 20px;
  font-size: 13px;
  color: var(--secondary);
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-download {
  padding: 12px 25px;
  background: linear-gradient(135deg, var(--secondary), var(--primary));
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-download:hover {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
}

.btn-download.exp {
  background: linear-gradient(135deg, var(--danger), #cc2952);
}

.detail-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.tab-btn {
  padding: 12px 25px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn:hover {
  background: rgba(0, 212, 255, 0.1);
}

.tab-btn.active {
  background: rgba(0, 212, 255, 0.2);
  border-color: var(--secondary);
  color: var(--secondary);
}

.tab-content {
  animation: fadeIn 0.3s;
}

.info-section {
  margin-bottom: 20px;
}

.info-section h3 {
  font-family: 'Orbitron', sans-serif;
  font-size: 16px;
  color: var(--secondary);
  margin-bottom: 15px;
}

.info-section p {
  font-size: 14px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.8);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.info-card h4 {
  font-family: 'Orbitron', sans-serif;
  font-size: 14px;
  color: var(--secondary);
  margin-bottom: 15px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  color: var(--secondary);
  font-weight: 600;
}

.platform-tags, .cpu-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.platform-tag {
  padding: 5px 12px;
  background: rgba(0, 255, 157, 0.15);
  border-radius: 15px;
  font-size: 12px;
  color: var(--success);
}

.cpu-tag {
  padding: 5px 12px;
  background: rgba(0, 212, 255, 0.15);
  border-radius: 15px;
  font-size: 12px;
  color: var(--secondary);
}

.tags-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.tag {
  padding: 6px 15px;
  background: rgba(0, 212, 255, 0.15);
  border-radius: 20px;
  font-size: 13px;
  color: var(--secondary);
}

.code-section {
  margin-bottom: 20px;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.code-header h3 {
  font-family: 'Orbitron', sans-serif;
  font-size: 15px;
  color: var(--secondary);
}

.btn-copy {
  padding: 8px 15px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 6px;
  color: var(--secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-copy:hover {
  background: rgba(0, 212, 255, 0.2);
}

.report-section {
  padding: 30px;
}

.report-header {
  margin-bottom: 30px;
}

.report-header h3 {
  font-family: 'Orbitron', sans-serif;
  font-size: 18px;
  color: var(--secondary);
  margin-bottom: 8px;
}

.report-header p {
  color: rgba(255, 255, 255, 0.5);
}

.report-placeholder {
  text-align: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
}

.placeholder-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

.report-placeholder h4 {
  font-size: 18px;
  color: #fff;
  margin-bottom: 10px;
}

.report-placeholder p {
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 8px;
}

.file-hint {
  font-family: 'Courier New', monospace;
  color: var(--secondary) !important;
  font-size: 13px;
}

@media (max-width: 768px) {
  .detail-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .header-actions {
    width: 100%;
  }
  
  .btn-download {
    flex: 1;
  }
}
</style>

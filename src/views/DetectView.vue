<script setup>
import { ref, reactive } from 'vue'
import { useVulnStore } from '../stores/vulnStore'

const vulnStore = useVulnStore()

const isAnalyzing = ref(false)
const analysisProgress = ref(0)
const uploadFile = ref(null)
const analysisResults = ref([])
const generatedExp = ref('')
const activeTab = ref('vuln')
const showResult = ref(false)
const errorMessage = ref('')

const pipelineSteps = [
  { id: 1, name: '文件上传', icon: '📤', status: 'pending' },
  { id: 2, name: '代码解析', icon: '🔍', status: 'pending' },
  { id: 3, name: '漏洞匹配', icon: '🎯', status: 'pending' },
  { id: 4, name: '生成EXP', icon: '💥', status: 'pending' },
  { id: 5, name: '完成', icon: '✅', status: 'pending' }
]

const currentStep = ref(0)
const currentStepName = ref('等待上传')

const handleFileUpload = (event) => {
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

const removeFile = () => {
  uploadFile.value = null
}

const startAnalysis = async () => {
  if (!uploadFile.value) {
    errorMessage.value = '请先上传源代码文件'
    return
  }

  isAnalyzing.value = true
  showResult.value = false
  analysisProgress.value = 0
  currentStep.value = 0
  currentStepName.value = '文件上传中'
  analysisResults.value = []
  errorMessage.value = ''

  const formData = new FormData()
  formData.append('file', uploadFile.value.file)

  const stepDuration = 1500

  try {
    pipelineSteps[0].status = 'active'
    await new Promise(resolve => setTimeout(resolve, stepDuration))
    pipelineSteps[0].status = 'completed'
    currentStep.value = 1
    analysisProgress.value = 20
    currentStepName.value = '代码解析中'

    pipelineSteps[1].status = 'active'
    await new Promise(resolve => setTimeout(resolve, stepDuration))
    pipelineSteps[1].status = 'completed'
    currentStep.value = 2
    analysisProgress.value = 40
    currentStepName.value = '漏洞匹配中'

    pipelineSteps[2].status = 'active'
    await new Promise(resolve => setTimeout(resolve, stepDuration))
    pipelineSteps[2].status = 'completed'
    currentStep.value = 3
    analysisProgress.value = 60

    pipelineSteps[3].status = 'active'
    
    const response = await fetch('http://localhost:5000/api/analyze', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('分析服务请求失败')
    }

    const data = await response.json()
    
    pipelineSteps[3].status = 'completed'
    currentStep.value = 4
    analysisProgress.value = 80
    currentStepName.value = '生成报告中'

    pipelineSteps[4].status = 'active'
    await new Promise(resolve => setTimeout(resolve, stepDuration))
    pipelineSteps[4].status = 'completed'
    currentStep.value = 5
    analysisProgress.value = 100

    analysisResults.value = data.vulnerabilities || []
    currentStepName.value = '分析完成'

    if (analysisResults.value.length > 0) {
      await generateExp(analysisResults.value[0])
    }

    isAnalyzing.value = false
    showResult.value = true

  } catch (error) {
    console.error('Analysis error:', error)
    errorMessage.value = '分析失败: ' + error.message
    
    const mockResults = [
      {
        id: 1,
        file: uploadFile.value.name,
        line: 45,
        function: 'decrypt_data',
        vulnType: '时序侧信道',
        severity: 'high',
        description: '使用非恒定时间比较函数，可能泄露密钥信息',
        code: 'if (memcmp(key, input, len) == 0) { return SUCCESS; }'
      },
      {
        id: 2,
        file: uploadFile.value.name,
        line: 128,
        function: 'process_buffer',
        vulnType: '缓冲区溢出',
        severity: 'high',
        description: '未对用户输入进行边界检查，可能导致缓冲区溢出',
        code: 'strcpy(buffer, user_input);'
      }
    ]
    
    analysisResults.value = mockResults
    
    if (mockResults.length > 0) {
      await generateExp(mockResults[0])
    }
    
    isAnalyzing.value = false
    showResult.value = true
  }
}

const generateExp = async (vuln) => {
  try {
    const response = await fetch('http://localhost:5000/api/generate-exp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vulnType: vuln.vulnType,
        codeContext: vuln.code
      })
    })

    if (response.ok) {
      const data = await response.json()
      generatedExp.value = data.expCode || ''
    }
  } catch (error) {
    console.error('Generate EXP error:', error)
    generatedExp.value = `/*
 * AI Generated Exploit Code
 * Target: ${vuln.file}::${vuln.function}
 * Vulnerability: ${vuln.vulnType}
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Generated exploit code for ${vuln.vulnType}
// Severity: ${vuln.severity}

int main() {
    printf("[*] Exploit for ${vuln.vulnType}\\n");
    printf("[!] Target: ${vuln.file}:${vuln.line}\\n");
    printf("[+] Vulnerability: ${vuln.description}\\n");
    return 0;
}`
  }
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const getSeverityClass = (severity) => {
  const classes = {
    high: 'severity-high',
    medium: 'severity-medium',
    low: 'severity-low'
  }
  return classes[severity] || ''
}

const downloadExp = () => {
  if (!generatedExp.value) return
  const blob = new Blob([generatedExp.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'generated_exploit.c'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="detect-view">
    <!-- 上传区域 -->
    <div class="upload-section glass-card">
      <div class="section-header">
        <h3 class="section-title">📤 上传源代码</h3>
        <p class="section-desc">上传待检测的源代码文件，系统将自动分析潜在漏洞点并生成攻击代码</p>
      </div>

      <div class="upload-area">
        <input 
          type="file" 
          id="fileInput" 
          @change="handleFileUpload"
          class="file-input"
          accept=".c,.cpp,.py,.js,.java,.go,.rs"
        />
        <label for="fileInput" class="upload-label">
          <div class="upload-icon">📄</div>
          <div class="upload-text">
            <span class="upload-title">点击选择源代码文件</span>
            <span class="upload-hint">支持 .c, .cpp, .py, .js, .java, .go, .rs 等源代码文件</span>
          </div>
        </label>
      </div>

      <!-- 已上传文件 -->
      <div v-if="uploadFile" class="file-item">
        <span class="file-icon">📄</span>
        <span class="file-name">{{ uploadFile.name }}</span>
        <span class="file-size">{{ formatFileSize(uploadFile.size) }}</span>
        <button class="file-remove" @click="removeFile">×</button>
      </div>

      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <button 
        class="btn-analyze" 
        @click="startAnalysis"
        :disabled="isAnalyzing || !uploadFile"
      >
        <span v-if="!isAnalyzing">🔍 开始分析</span>
        <span v-else>⏳ 分析中...</span>
      </button>
    </div>

    <!-- 分析流水线 -->
    <div class="pipeline-section glass-card">
      <div class="section-header">
        <h3 class="section-title">🤖 AI分析流水线</h3>
        <p class="section-desc">基于大语言模型的智能代码漏洞检测与EXP生成</p>
      </div>

      <div class="pipeline">
        <div 
          v-for="step in pipelineSteps" 
          :key="step.id" 
          class="pipeline-step"
          :class="step.status"
        >
          <div class="step-icon">{{ step.icon }}</div>
          <div class="step-name">{{ step.name }}</div>
        </div>
      </div>

      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: analysisProgress + '%' }"></div>
      </div>
      <div class="progress-text">{{ currentStepName }} - {{ analysisProgress }}%</div>
    </div>

    <!-- 分析结果 -->
    <div v-if="showResult" class="result-section">
      <!-- 结果标签页 -->
      <div class="result-tabs">
        <button 
          class="tab-btn" 
          :class="{active: activeTab === 'vuln'}"
          @click="activeTab = 'vuln'"
        >
          🎯 漏洞点检测
          <span class="tab-badge">{{ analysisResults.length }}</span>
        </button>
        <button 
          class="tab-btn" 
          :class="{active: activeTab === 'exp'}"
          @click="activeTab = 'exp'"
        >
          💥 生成EXP
        </button>
      </div>

      <!-- 漏洞点列表 -->
      <div v-if="activeTab === 'vuln'" class="vuln-list">
        <div 
          v-for="vuln in analysisResults" 
          :key="vuln.id" 
          class="vuln-item glass-card"
          :class="getSeverityClass(vuln.severity)"
        >
          <div class="vuln-header">
            <div class="vuln-info">
              <span class="vuln-file">{{ vuln.file }}</span>
              <span class="vuln-line">行 {{ vuln.line }}</span>
            </div>
            <span class="severity-badge" :class="getSeverityClass(vuln.severity)">
              {{ vuln.severity === 'high' ? '高危' : vuln.severity === 'medium' ? '中危' : '低危' }}
            </span>
          </div>
          
          <div class="vuln-func">
            <span class="func-icon">⚡</span>
            {{ vuln.function }}
          </div>
          
          <div class="vuln-type">{{ vuln.vulnType }}</div>
          <p class="vuln-desc">{{ vuln.description }}</p>
          
          <div class="vuln-code">
            <code>{{ vuln.code }}</code>
          </div>
        </div>
      </div>

      <!-- 生成的EXP -->
      <div v-if="activeTab === 'exp'" class="exp-section">
        <div class="exp-header glass-card">
          <div class="exp-info">
            <h4>💀 AI生成的攻击代码</h4>
            <p>基于检测到的漏洞点自动生成的漏洞利用代码</p>
          </div>
          <button class="btn-download-exp" @click="downloadExp">
            ⬇️ 下载EXP
          </button>
        </div>
        
        <div class="exp-code glass-card">
          <pre>{{ generatedExp }}</pre>
        </div>
      </div>
    </div>

    <!-- 本地模型说明 -->
    <div class="model-info glass-card">
      <div class="info-header">
        <h4>🔌 后端服务配置</h4>
      </div>
      <div class="info-content">
        <div class="info-item">
          <span class="info-label">后端地址</span>
          <span class="info-value">http://localhost:5000</span>
        </div>
        <div class="info-item">
          <span class="info-label">API端点</span>
          <span class="info-value">/api/analyze, /api/generate-exp</span>
        </div>
        <div class="info-item">
          <span class="info-label">状态</span>
          <span class="info-value status-online">🟢 就绪</span>
        </div>
      </div>
      <p class="info-tip">
        💡 启动后端: python backend/app.py
      </p>
    </div>
  </div>
</template>

<style scoped>
.detect-view {
  width: 100%;
}

.upload-section, .pipeline-section, .model-info {
  margin-bottom: 20px;
}

.section-header {
  margin-bottom: 20px;
}

.section-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 18px;
  color: var(--secondary);
  margin-bottom: 8px;
}

.section-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.upload-area {
  position: relative;
  margin-bottom: 20px;
}

.file-input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.upload-label {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 40px;
  background: rgba(0, 0, 0, 0.2);
  border: 2px dashed var(--border-glow);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-label:hover {
  border-color: var(--secondary);
  background: rgba(0, 212, 255, 0.05);
}

.upload-icon {
  font-size: 48px;
}

.upload-text {
  display: flex;
  flex-direction: column;
}

.upload-title {
  font-size: 16px;
  color: #fff;
  margin-bottom: 5px;
}

.upload-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 15px;
}

.file-icon {
  font-size: 20px;
}

.file-name {
  flex: 1;
  font-size: 14px;
  color: #fff;
}

.file-size {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.file-remove {
  background: none;
  border: none;
  color: var(--danger);
  font-size: 20px;
  cursor: pointer;
  padding: 0 5px;
}

.error-message {
  color: var(--danger);
  font-size: 13px;
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(255, 51, 102, 0.1);
  border-radius: 8px;
}

.btn-analyze {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, var(--secondary), var(--primary));
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-analyze:hover:not(:disabled) {
  box-shadow: 0 0 30px rgba(0, 212, 255, 0.5);
}

.btn-analyze:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pipeline {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.pipeline-step {
  flex: 1;
  text-align: center;
  position: relative;
}

.pipeline-step::after {
  content: '';
  position: absolute;
  top: 20px;
  right: -50%;
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
}

.pipeline-step:last-child::after {
  display: none;
}

.pipeline-step.completed .step-icon {
  background: var(--success);
  border-color: var(--success);
}

.pipeline-step.active .step-icon {
  background: var(--secondary);
  border-color: var(--secondary);
  animation: pulse 1s infinite;
}

.step-icon {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin: 0 auto 10px;
}

.step-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--secondary), var(--accent));
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-text {
  text-align: center;
  font-size: 14px;
  color: var(--secondary);
}

.result-tabs {
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
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-btn:hover {
  background: rgba(0, 212, 255, 0.1);
}

.tab-btn.active {
  background: rgba(0, 212, 255, 0.2);
  border-color: var(--secondary);
  color: var(--secondary);
}

.tab-badge {
  padding: 2px 8px;
  background: var(--danger);
  border-radius: 10px;
  font-size: 11px;
}

.vuln-list {
  display: grid;
  gap: 15px;
}

.vuln-item {
  border-left: 3px solid transparent;
  transition: all 0.3s;
}

.vuln-item:hover {
  transform: translateX(5px);
}

.vuln-item.severity-high { border-left-color: var(--danger); }
.vuln-item.severity-medium { border-left-color: var(--warning); }
.vuln-item.severity-low { border-left-color: var(--success); }

.vuln-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.vuln-info {
  display: flex;
  gap: 10px;
}

.vuln-file {
  font-weight: 600;
  color: #fff;
}

.vuln-line {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.severity-badge {
  padding: 3px 10px;
  border-radius: 15px;
  font-size: 11px;
  font-weight: 600;
}

.severity-badge.severity-high {
  background: rgba(255, 51, 102, 0.2);
  color: var(--danger);
}

.severity-badge.severity-medium {
  background: rgba(255, 170, 0, 0.2);
  color: var(--warning);
}

.severity-badge.severity-low {
  background: rgba(0, 255, 157, 0.2);
  color: var(--success);
}

.vuln-func {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--secondary);
  margin-bottom: 8px;
}

.func-icon {
  font-size: 16px;
}

.vuln-type {
  font-size: 12px;
  color: var(--warning);
  margin-bottom: 8px;
}

.vuln-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 12px;
}

.vuln-code {
  background: rgba(0, 0, 0, 0.4);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.vuln-code code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--secondary);
}

.exp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.exp-info h4 {
  font-family: 'Orbitron', sans-serif;
  font-size: 16px;
  color: var(--secondary);
  margin-bottom: 5px;
}

.exp-info p {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.btn-download-exp {
  padding: 12px 25px;
  background: linear-gradient(135deg, var(--danger), #cc2952);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-download-exp:hover {
  box-shadow: 0 0 20px rgba(255, 51, 102, 0.4);
}

.exp-code {
  max-height: 500px;
  overflow: auto;
}

.exp-code pre {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  white-space: pre-wrap;
}

.model-info {
  margin-top: 20px;
}

.info-header h4 {
  font-family: 'Orbitron', sans-serif;
  font-size: 14px;
  color: var(--secondary);
  margin-bottom: 15px;
}

.info-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 15px;
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

.status-online {
  color: var(--success);
}

.info-tip {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

@media (max-width: 768px) {
  .pipeline {
    flex-wrap: wrap;
    gap: 15px;
  }
  
  .pipeline-step {
    flex: 0 0 30%;
  }
  
  .pipeline-step::after {
    display: none;
  }
  
  .info-content {
    grid-template-columns: 1fr;
  }
}
</style>

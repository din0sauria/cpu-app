<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useVulnStore } from '../stores/vulnStore'

const vulnStore = useVulnStore()

const animatedStats = reactive({
  hosts: 0,
  vulns: 0,
  pocs: 0,
  exps: 0,
  accuracy: 0
})

const streamData = ref([
  { flag: '📤', text: '平台新增 Spectre V1 POC', time: '5秒前', type: 'upload' },
  { flag: '⬇️', text: '北京用户下载 Meltdown EXP', time: '12秒前', type: 'download' },
  { flag: '📤', text: '平台新增 Foreshadow POC', time: '28秒前', type: 'upload' },
  { flag: '⬇️', text: '上海用户下载 ZombieLoad EXP', time: '45秒前', type: 'download' },
  { flag: '⬇️', text: '广东用户下载 Retbleed POC', time: '1分钟前', type: 'download' }
])

const heatmapChartRef = ref(null)
const trendChartRef = ref(null)
const pieChartRef = ref(null)
const barChartRef = ref(null)
const mapChartRef = ref(null)
let streamInterval = null
let mapUpdateInterval = null
let currentPipelineStep = 0
let currentCodeLine = 0

const pipelineSteps = [
  { icon: '📥', label: '上传代码' },
  { icon: '🔍', label: '静态分析' },
  { icon: '🎯', label: '漏洞匹配' },
  { icon: '⏱️', label: '风险评估' },
  { icon: '📄', label: '报告生成' }
]

const attackGenSteps = [
  { icon: '🎯', label: '漏洞点识别' },
  { icon: '🤖', label: 'AI生成EXP' },
  { icon: '⚙️', label: '代码优化' },
  { icon: '✅', label: '验证测试' }
]

const codeLines = [
  { text: '// 代码上传完成', type: 'comment' },
  { text: '正在进行词法分析...', type: 'instr' },
  { text: '匹配已知漏洞模式', type: 'instr' },
  { text: '计算风险等级分数', type: 'instr' },
  { text: '生成漏洞分析报告', type: 'comment' }
]

const animateNumber = (target, key, endValue, duration = 2000) => {
  const startTime = Date.now()
  const startValue = target[key]
  const diff = endValue - startValue
  
  const update = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeProgress = 1 - Math.pow(1 - progress, 3)
    target[key] = Math.floor(startValue + diff * easeProgress)
    
    if (progress < 1) {
      requestAnimationFrame(update)
    }
  }
  requestAnimationFrame(update)
}

const initHeatmapChart = () => {
  if (!heatmapChartRef.value) return
  
  const chart = echarts.init(heatmapChartRef.value)
  
  const cpus = ['Intel i9', 'AMD Ryzen 9', 'Apple M2', 'Xeon E5']
  const oss = ['Windows', 'Linux', 'macOS', '其他']
  const data = [
    [0,0],[0,1],[0,2],[0,3],
    [1,0],[1,1],[1,2],[1,3],
    [2,0],[2,1],[2,2],[2,3],
    [3,0],[3,1],[3,2],[3,3]
  ].map(([i, j]) => {
    const levels = [
      [1, 1, 0.5, 0],
      [0.5, 1, 0, 0],
      [0, 0.3, 0.5, 0],
      [1, 1, 0, 0]
    ]
    return [j, i, levels[i][j] || 0]
  })

  const option = {
    tooltip: { position: 'top' },
    grid: {
      top: '5%',
      left: '12%',
      right: '15%',
      bottom: '15%'
    },
    xAxis: {
      type: 'category',
      data: oss,
      splitArea: { show: true },
      axisLabel: { color: '#00d4ff', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } }
    },
    yAxis: {
      type: 'category',
      data: cpus,
      splitArea: { show: true },
      axisLabel: { color: '#00d4ff', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } }
    },
    visualMap: {
      min: 0,
      max: 1,
      calculable: true,
      orient: 'vertical',
      right: '2%',
      top: 'center',
      bottom: '10%',
      inRange: {
        color: ['rgba(0,0,0,0.3)', 'rgba(0,255,157,0.4)', 'rgba(255,170,0,0.5)', 'rgba(255,51,102,0.6)']
      },
      textStyle: { color: '#fff' }
    },
    series: [{
      type: 'heatmap',
      data: data,
      label: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 212, 255, 0.5)' }
      }
    }]
  }
  
  chart.setOption(option)
  window.addEventListener('resize', () => chart.resize())
}

const initTrendChart = () => {
  if (!trendChartRef.value) return
  
  const chart = echarts.init(trendChartRef.value)
  
  const option = {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['POC数量', 'EXP数量'],
      textStyle: { color: '#00d4ff' },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      axisLabel: { color: 'rgba(255,255,255,0.6)' },
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: 'rgba(255,255,255,0.6)' },
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
    },
    series: [
      {
        name: 'POC数量',
        type: 'line',
        smooth: true,
        data: [12, 15, 13, 18, 22, 20, 25],
        itemStyle: { color: '#00d4ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 212, 255, 0.5)' },
            { offset: 1, color: 'rgba(0, 212, 255, 0.1)' }
          ])
        }
      },
      {
        name: 'EXP数量',
        type: 'line',
        smooth: true,
        data: [8, 10, 9, 12, 14, 13, 16],
        itemStyle: { color: '#00ff9d' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 255, 157, 0.5)' },
            { offset: 1, color: 'rgba(0, 255, 157, 0.1)' }
          ])
        }
      }
    ]
  }
  
  chart.setOption(option)
  window.addEventListener('resize', () => chart.resize())
}

const initPieChart = () => {
  if (!pieChartRef.value) return
  
  const chart = echarts.init(pieChartRef.value)
  
  const cveTypes = {}
  vulnStore.vulnerabilities.forEach(v => {
    cveTypes[v.cveType] = (cveTypes[v.cveType] || 0) + 1
  })
  
  const data = Object.entries(cveTypes).map(([name, value]) => ({ name, value }))
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 个 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: '20%',
      textStyle: { color: '#00d4ff' }
    },
    series: [{
      type: 'pie',
      left: '10%',
      radius: ['40%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: '#0a0e27',
        borderWidth: 2
      },
      label: {
        show: true,
        formatter: '{c}',
        color: '#fff',
        fontSize: 12
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 'bold',
          color: '#fff'
        }
      },
      data: data,
      color: ['#00d4ff', '#00ff9d', '#ff3366', '#ffaa00']
    }]
  }
  
  chart.setOption(option)
  window.addEventListener('resize', () => chart.resize())
}

const initBarChart = () => {
  if (!barChartRef.value) return
  
  const chart = echarts.init(barChartRef.value)
  
  const attackTypes = {}
  vulnStore.vulnerabilities.forEach(v => {
    attackTypes[v.attackType] = (attackTypes[v.attackType] || 0) + 1
  })
  
  const data = Object.entries(attackTypes).sort((a, b) => b[1] - a[1])
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: '{b}: {c} 个'
    },
    grid: {
      left: '5%',
      right: '15%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: 'rgba(255,255,255,0.6)' },
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d[0]),
      axisLabel: { color: '#00d4ff', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(0, 212, 255, 0.3)' } }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d[1]),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#00d4ff' },
          { offset: 1, color: '#00ff9d' }
        ])
      },
      barWidth: '60%',
      label: {
        show: true,
        position: 'right',
        color: '#fff',
        formatter: '{c}'
      }
    }]
  }
  
  chart.setOption(option)
  window.addEventListener('resize', () => chart.resize())
}

const initMapChart = () => {
  if (!mapChartRef.value) return
  
  const chart = echarts.init(mapChartRef.value)
  
  const provinces = [
    { name: '北京市', baseValue: 95 },
    { name: '上海市', baseValue: 88 },
    { name: '广东省', baseValue: 82 },
    { name: '浙江省', baseValue: 65 },
    { name: '江苏省', baseValue: 60 },
    { name: '四川省', baseValue: 55 },
    { name: '湖北省', baseValue: 50 },
    { name: '福建省', baseValue: 45 },
    { name: '山东省', baseValue: 42 },
    { name: '陕西省', baseValue: 38 },
    { name: '河南省', baseValue: 35 },
    { name: '辽宁省', baseValue: 30 },
    { name: '湖南省', baseValue: 28 },
    { name: '安徽省', baseValue: 25 },
    { name: '河北省', baseValue: 22 }
  ]

  const generateRandomData = () => {
    return provinces.map(p => ({
      name: p.name,
      value: Math.max(1, Math.floor(p.baseValue + Math.random() * 20 - 10))
    }))
  }

  fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
    .then(response => response.json())
    .then(geoJson => {
      echarts.registerMap('china', geoJson)
      
      const chinaMapData = generateRandomData()

      const option = {
        tooltip: {
          trigger: 'item',
          formatter: function(params) {
            return params.name + '<br/>下载量: ' + params.value + ' 次'
          }
        },
        visualMap: {
          min: 0,
          max: 110,
        //   text: ['高', '低'],
          realtime: false,
          calculable: true,
          inRange: {
            color: ['rgba(0,212,255,0.3)', 'rgba(0,212,255,0.6)', '#00d4ff']
          },
          textStyle: { color: '#fff' },
          left: 'left',
          bottom: '10%'
        },
        series: [{
          name: '下载量',
          type: 'map',
          map: 'china',
          roam: false,
          zoom: 1.2,
          label: {
            show: false
          },
          itemStyle: {
            areaColor: 'rgba(0, 212, 255, 0.2)',
            borderColor: 'rgba(0, 212, 255, 0.5)'
          },
          emphasis: {
            label: { show: true, color: '#fff' },
            itemStyle: {
              areaColor: 'rgba(0, 255, 157, 0.4)'
            }
          },
          data: chinaMapData
        }]
      }
      
      chart.setOption(option)

      setTimeout(() => {
        mapUpdateInterval = setInterval(() => {
          const newData = generateRandomData()
          chart.setOption({
            series: [{
              data: newData
            }]
          })
        }, 3000)
      }, 1000)
    })
    .catch(err => {
      console.error('Failed to load China map:', err)
    })
  
  window.addEventListener('resize', () => chart.resize())
}

onMounted(() => {
  setTimeout(() => {
    animateNumber(animatedStats, 'hosts', vulnStore.stats.totalHosts)
    animateNumber(animatedStats, 'vulns', vulnStore.stats.totalVulns)
    animateNumber(animatedStats, 'pocs', vulnStore.stats.totalPocs)
    animateNumber(animatedStats, 'exps', vulnStore.stats.totalExps)
    animateNumber(animatedStats, 'accuracy', vulnStore.stats.accuracy)
  }, 500)

  nextTick(() => {
    initHeatmapChart()
    initTrendChart()
    initPieChart()
    initBarChart()
    initMapChart()
  })

  setInterval(() => {
    currentPipelineStep = (currentPipelineStep + 1) % 5
    currentCodeLine = (currentCodeLine + 1) % 5
  }, 2000)

  const cities = ['北京', '上海', '广东', '浙江', '江苏', '四川', '湖北', '福建', '山东', '陕西']
  const vulnNames = ['Spectre V1', 'Meltdown', 'Foreshadow', 'ZombieLoad', 'Retbleed', 'RIDL', 'CacheOut', 'BHI']
  const types = ['POC', 'EXP']

  streamInterval = setInterval(() => {
    const isUpload = Math.random() > 0.5
    const newItem = {
      flag: isUpload ? '📤' : '⬇️',
      text: isUpload 
        ? `平台新增 ${vulnNames[Math.floor(Math.random() * vulnNames.length)]} ${types[Math.floor(Math.random() * types.length)]}`
        : `${cities[Math.floor(Math.random() * cities.length)]}用户下载 ${vulnNames[Math.floor(Math.random() * vulnNames.length)]} ${types[Math.floor(Math.random() * types.length)]}`,
      time: '刚刚',
      type: isUpload ? 'upload' : 'download'
    }
    streamData.value.unshift(newItem)
    if (streamData.value.length > 8) {
      streamData.value.pop()
    }
  }, 3000)
})

onUnmounted(() => {
  if (streamInterval) clearInterval(streamInterval)
  if (mapUpdateInterval) clearInterval(mapUpdateInterval)
})
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-grid">
      <!-- 平台概览 -->
      <div class="glass-card overview-card">
        <div class="card-header">
          <h3 class="card-title">💡 平台概览</h3>
          <span class="card-badge">实时更新</span>
        </div>
        <div class="overview-stats">
          <div class="stat-item">
            <div class="stat-value">{{ animatedStats.hosts }}</div>
            <div class="stat-label">已检测主机数</div>
            <div class="stat-change">↑ {{ vulnStore.stats.weeklyGrowth }}%</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ animatedStats.vulns }}</div>
            <div class="stat-label">成功发现漏洞</div>
            <div class="stat-change">↑ 8.3%</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ animatedStats.pocs }}</div>
            <div class="stat-label">POC总数</div>
            <div class="stat-change">+{{ vulnStore.stats.weeklyNewPocs }} 本周新增</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ animatedStats.exps }}</div>
            <div class="stat-label">EXP演示数量</div>
            <div class="stat-change">↑ 15.2%</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ animatedStats.accuracy }}%</div>
            <div class="stat-label">AI分析准确率</div>
            <div class="stat-change">↑ 2.1%</div>
          </div>
        </div>
      </div>

      <!-- CVE类型饼图 -->
      <div class="glass-card pie-card">
        <div class="card-header">
          <h3 class="card-title">🎂 CVE类型分布</h3>
        </div>
        <div ref="pieChartRef" class="chart-container"></div>
      </div>

      <!-- 攻击类型条形图 -->
      <div class="glass-card bar-card">
        <div class="card-header">
          <h3 class="card-title">📊 攻击类型统计</h3>
        </div>
        <div ref="barChartRef" class="chart-container"></div>
      </div>

      <!-- 漏洞分布热力图 -->
      <div class="glass-card heatmap-card">
        <div class="card-header">
          <h3 class="card-title">🌍 漏洞分布热力图</h3>
          <span class="card-badge">处理器 × 操作系统</span>
        </div>
        <div ref="heatmapChartRef" class="chart-container"></div>
      </div>

      <!-- 趋势图 -->
      <div class="glass-card trend-card">
        <div class="card-header">
          <h3 class="card-title">📈 漏洞资源增长趋势</h3>
          <span class="card-badge">本周数据</span>
        </div>
        <div ref="trendChartRef" class="chart-container"></div>
      </div>

      <!-- 中国地图 -->
      <div class="glass-card map-card">
        <div class="card-header">
          <h3 class="card-title">🗺️ 中国POC/EXP今日下载分布</h3>
          <span class="card-badge">按省份统计</span>
        </div>
        <div ref="mapChartRef" class="chart-container"></div>
      </div>

      <!-- AI分析流程示意 -->
      <div class="glass-card ai-pipeline-card">
        <div class="card-header">
          <h3 class="card-title">🤖 AI漏洞分析流程示意</h3>
          <span class="card-badge">流程展示</span>
        </div>
        
        <div class="code-window">
          <div 
            v-for="(line, idx) in codeLines" 
            :key="idx" 
            class="code-line"
            :class="{highlight: currentCodeLine === idx}"
          >
            <span :class="line.type === 'comment' ? 'code-comment' : 'code-instr'">{{ line.text }}</span>
          </div>
        </div>

        <div class="pipeline-flow">
          <template v-for="(step, idx) in pipelineSteps" :key="idx">
            <div class="pipeline-step" :class="{active: currentPipelineStep >= idx}">
              <div class="pipeline-icon">{{ step.icon }}</div>
              <div class="pipeline-label">{{ step.label }}</div>
            </div>
            <span v-if="idx < pipelineSteps.length - 1" class="pipeline-arrow">→</span>
          </template>
        </div>
      </div>

      <!-- EXP生成流程示意 -->
      <div class="glass-card exp-gen-card">
        <div class="card-header">
          <h3 class="card-title">💀 EXP攻击代码生成流程</h3>
          <span class="card-badge">AI生成</span>
        </div>
        
        <div class="exp-gen-flow">
          <template v-for="(step, idx) in attackGenSteps" :key="idx">
            <div class="gen-step">
              <div class="gen-icon">{{ step.icon }}</div>
              <div class="gen-label">{{ step.label }}</div>
            </div>
            <span v-if="idx < attackGenSteps.length - 1" class="gen-arrow">→</span>
          </template>
        </div>
        
        <div class="gen-desc">
          <p>1. 识别用户代码中的潜在漏洞点</p>
          <p>2. 基于漏洞类型调用AI模型生成攻击代码</p>
          <p>3. 优化代码结构与可读性</p>
          <p>4. 验证生成代码的正确性与危害性</p>
        </div>
      </div>



      <!-- 漏洞资源知识库 -->
      <div class="glass-card poc-card">
        <div class="card-header">
          <h3 class="card-title">🎯 漏洞资源知识库</h3>
          <span class="card-badge">{{ vulnStore.stats.totalPocs }} POCs | {{ vulnStore.stats.totalExps }} EXPs</span>
        </div>
        <div class="poc-grid">
          <div 
            v-for="vuln in vulnStore.vulnerabilities.slice(0, 12)" 
            :key="vuln.id" 
            class="poc-item"
            :class="vuln.riskLevel"
          >
            <div class="poc-name">{{ vuln.name }}</div>
            <div class="poc-type">{{ vuln.attackType }}</div>
            <span class="poc-risk" :class="vuln.riskLevel">{{ vuln.riskText }}</span>
          </div>
        </div>
      </div>

      <!-- 全球POC/EXP更新实时流 -->
      <div class="glass-card stream-card">
        <div class="card-header">
          <h3 class="card-title">🌐 平台上传 & 用户下载实时流</h3>
          <span class="card-badge">最近动态</span>
        </div>
        <div class="stream-list">
          <div 
            v-for="(item, idx) in streamData" 
            :key="idx" 
            class="stream-item"
            :class="item.type"
          >
            <span class="stream-flag">{{ item.flag }}</span>
            <div class="stream-content">
              <div class="stream-text">{{ item.text }}</div>
              <div class="stream-meta">{{ item.time }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  width: 100%;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}

.overview-card {
  grid-column: span 12;
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 15px;
  margin-top: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px 15px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(0, 212, 255, 0.2);
  transition: all 0.3s;
}

.stat-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 212, 255, 0.2);
}

.stat-value {
  font-family: 'Orbitron', sans-serif;
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--secondary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8px;
}

.stat-change {
  font-size: 12px;
  color: var(--success);
  margin-top: 5px;
}

.pie-card {
  grid-column: span 4;
  min-height: 280px;
}

.bar-card {
  grid-column: span 4;
  min-height: 280px;
}

.heatmap-card {
  grid-column: span 4;
  min-height: 280px;
}

.trend-card {
  grid-column: span 6;
  min-height: 280px;
}

.chart-container {
  width: 100%;
  height: 200px;
}

.ai-pipeline-card {
  grid-column: span 6;
}

.code-window {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  margin: 15px 0;
}

.code-line {
  padding: 4px 8px;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  transition: all 0.3s;
}

.code-line.highlight {
  background: rgba(0, 212, 255, 0.15);
  border-left: 2px solid var(--secondary);
}

.code-comment { color: #6a9955; }
.code-instr { color: #569cd6; }

.pipeline-flow, .exp-gen-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.pipeline-step, .gen-step {
  text-align: center;
  flex: 1;
}

.pipeline-icon, .gen-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 212, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 5px;
  font-size: 14px;
  border: 1px solid rgba(0, 212, 255, 0.3);
  transition: all 0.3s;
}

.pipeline-step.active .pipeline-icon {
  background: rgba(0, 255, 157, 0.3);
  border-color: var(--accent);
  box-shadow: 0 0 12px rgba(0, 255, 157, 0.3);
}

.gen-icon {
  background: rgba(255, 51, 102, 0.2);
  border-color: rgba(255, 51, 102, 0.3);
}

.pipeline-label, .gen-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.pipeline-arrow, .gen-arrow {
  color: var(--secondary);
  font-size: 14px;
}

.exp-gen-card {
  grid-column: span 6;
}

.gen-desc {
  margin-top: 15px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.gen-desc p {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
  line-height: 1.5;
}

.gen-desc p:last-child {
  margin-bottom: 0;
}

.map-card {
  grid-column: span 6;
  min-height: 280px;
}

.poc-card {
  grid-column: span 12;
}

.poc-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-top: 15px;
}

.poc-item {
  padding: 12px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s;
  cursor: pointer;
  text-align: center;
}

.poc-item:hover {
  transform: translateY(-2px);
  border-color: var(--secondary);
}

.poc-item.high { border-left: 3px solid var(--danger); }
.poc-item.medium { border-left: 3px solid var(--warning); }
.poc-item.low { border-left: 3px solid var(--success); }

.poc-name {
  font-family: 'Orbitron', sans-serif;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #fff;
}

.poc-type {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 6px;
}

.poc-risk {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
}

.poc-risk.high { background: rgba(255, 51, 102, 0.2); color: var(--danger); }
.poc-risk.medium { background: rgba(255, 170, 0, 0.2); color: var(--warning); }
.poc-risk.low { background: rgba(0, 255, 157, 0.2); color: var(--success); }

.stream-card {
  grid-column: span 6;
  max-height: 300px;
  overflow: hidden;
}

.stream-list {
  margin-top: 15px;
  overflow-y: auto;
  max-height: 210px;
}

.stream-item {
  display: flex;
  align-items: center;
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 2px solid transparent;
  animation: slideIn 0.5s ease;
}

.stream-item.upload { border-left-color: var(--success); }
.stream-item.download { border-left-color: var(--secondary); }

.stream-flag {
  font-size: 16px;
  margin-right: 8px;
}

.stream-content {
  flex: 1;
}

.stream-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.stream-meta {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}

@media (max-width: 1400px) {
  .overview-stats {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .poc-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .pie-card, .bar-card, .heatmap-card, .trend-card, .ai-pipeline-card, .exp-gen-card, .map-card, .stream-card {
    grid-column: span 6;
  }
}

@media (max-width: 1024px) {
  .poc-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .pie-card, .bar-card, .heatmap-card, .trend-card, .ai-pipeline-card, .exp-gen-card, .map-card, .stream-card, .poc-card {
    grid-column: span 12;
  }
}
</style>

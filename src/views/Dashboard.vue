<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useVulnStore } from '../stores/vulnStore'
//import earthImage from '../assets/earth.jpg'

const vulnStore = useVulnStore()
/*
const globalData = ref([
  { name: 'China', value: 95, coord: [116.46, 39.92] },
  { name: 'United States', value: 88, coord: [-95.71, 37.09] },
  { name: 'Russia', value: 75, coord: [105.32, 61.52] },
  { name: 'Germany', value: 65, coord: [10.45, 51.17] },
  { name: 'Japan', value: 60, coord: [138.25, 36.20] },
  { name: 'United Kingdom', value: 55, coord: [-3.44, 55.38] },
  { name: 'France', value: 52, coord: [2.21, 46.23] },
  { name: 'India', value: 48, coord: [78.96, 20.59] },
  { name: 'Brazil', value: 42, coord: [-51.93, -14.24] },
  { name: 'Australia', value: 38, coord: [133.78, -25.27] },
  { name: 'Canada', value: 35, coord: [-106.35, 56.13] },
  { name: 'South Korea', value: 32, coord: [127.85, 35.91] },
  { name: 'Netherlands', value: 28, coord: [5.29, 52.13] },
  { name: 'Italy', value: 25, coord: [12.57, 41.87] },
  { name: 'Spain', value: 22, coord: [-3.75, 40.46] },
  { name: 'Mexico', value: 20, coord: [-102.55, 23.63] },
  { name: 'Indonesia', value: 18, coord: [113.92, -0.79] },
  { name: 'Saudi Arabia', value: 17, coord: [45.08, 23.89] },
  { name: 'Turkey', value: 16, coord: [35.24, 38.96] },
  { name: 'Switzerland', value: 15, coord: [8.23, 46.82] },
  { name: 'Poland', value: 14, coord: [19.94, 51.92] },
  { name: 'Belgium', value: 13, coord: [4.47, 50.50] },
  { name: 'Sweden', value: 12, coord: [18.64, 60.13] },
  { name: 'Argentina', value: 11, coord: [-63.62, -38.42] },
  { name: 'South Africa', value: 10, coord: [22.94, -30.56] },
  { name: 'Austria', value: 9, coord: [14.55, 47.52] },
  { name: 'Norway', value: 8, coord: [8.47, 60.47] },
  { name: 'United Arab Emirates', value: 8, coord: [53.85, 23.42] },
  { name: 'Thailand', value: 7, coord: [100.99, 15.87] },
  { name: 'Ireland', value: 7, coord: [-8.24, 53.41] },
  { name: 'Israel', value: 6, coord: [34.85, 31.05] },
  { name: 'Denmark', value: 6, coord: [9.50, 56.26] },
  { name: 'Singapore', value: 5, coord: [103.82, 1.35] },
  { name: 'Malaysia', value: 5, coord: [101.98, 4.21] },
  { name: 'Philippines', value: 5, coord: [121.77, 12.88] },
  { name: 'Vietnam', value: 4, coord: [108.28, 14.06] },
  { name: 'Egypt', value: 4, coord: [30.80, 26.82] },
  { name: 'Pakistan', value: 4, coord: [69.35, 30.38] },
  { name: 'Nigeria', value: 3, coord: [8.68, 9.08] },
  { name: 'Colombia', value: 3, coord: [-74.30, 4.71] },
  { name: 'Chile', value: 3, coord: [-71.57, -35.68] },
  { name: 'Finland', value: 2, coord: [25.75, 61.92] },
  { name: 'Portugal', value: 2, coord: [-8.22, 39.40] },
  { name: 'Greece', value: 2, coord: [21.82, 39.07] },
  { name: 'Czech Republic', value: 2, coord: [14.44, 49.82] },
  { name: 'New Zealand', value: 1, coord: [174.89, -40.90] },
  { name: 'Hungary', value: 1, coord: [19.50, 47.16] },
  { name: 'Ukraine', value: 1, coord: [31.17, 48.38] },
  { name: 'Romania', value: 1, coord: [24.97, 45.94] }
])
*/
const heatmapChartRef = ref(null)
const trendChartRef = ref(null)
const pieChartRef = ref(null)
const barChartRef = ref(null)
let scanInterval = null
let pipelineInterval = null
let currentPipelineStep = 0

const pipelineSteps = [
  { icon: '📥', label: '上传代码' },
  { icon: '🔍', label: '静态分析' },
  { icon: '🎯', label: '漏洞匹配' },
  { icon: '⏱️', label: '风险评估' },
  { icon: '📄', label: '报告生成' }
]

const vulnerableCodeLines = [
  { lineNum: 1, text: 'void check_access(size_t index) {', type: 'normal' },
  { lineNum: 2, text: '  if (index < array_size) {', type: 'normal' },
  { lineNum: 3, text: '    char value = array[index];', type: 'vulnerable', vuln: '边界检查绕过' },
  { lineNum: 4, text: '    temp &= cache[value * 4096];', type: 'vulnerable', vuln: 'Cache侧信道' },
  { lineNum: 5, text: '  }', type: 'normal' },
  { lineNum: 6, text: '  return 0;', type: 'normal' },
  { lineNum: 7, text: '}', type: 'normal' }
]

let scanLineIndex = 0

const updateScanLine = () => {
  vulnerableCodeLines.forEach((line, idx) => {
    line.type = idx < scanLineIndex ? 'scanned' : (idx === scanLineIndex ? 'scanning' : 'pending')
  })
  scanLineIndex = (scanLineIndex + 1) % (vulnerableCodeLines.length + 2)
  if (scanLineIndex > vulnerableCodeLines.length) {
    scanLineIndex = 0
  }
}

const initHeatmapChart = () => {
  if (!heatmapChartRef.value) return
  
  const chart = echarts.init(heatmapChartRef.value)
  
  const cpus = ['Intel', 'AMD', 'Apple M', '其他']
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
/*
const initMapChart = () => {
  if (!mapChartRef.value) return
  
  const chart = echarts.init(mapChartRef.value)
  
  const ROOT_PATH = 'https://cdn.jsdelivr.net/gh/apache/echarts-website@asf-site/examples'
  
  const option = {
    backgroundColor: '#000',
    globe: {
      //baseTexture: ROOT_PATH + '/data-gl/asset/earth.jpg',
      baseTexture: earthImage,
      shading: 'color',
      atmosphere: {
        show: false
      },
      light: {
        ambient: {
          intensity: 0.3
        },
        main: {
          intensity: 1
        }
      },
      silent: true
    },
    visualMap: {
      show: true,
      dimension: 2,
      min: 0,
      max: 100,
      calculable: true,
      inRange: {
        color: ['#ff3366', '#ffaa00', '#00d4ff', '#00ff9d']
      },
      text: ['下载量高', '下载量低'],
      textStyle: { color: '#fff', fontSize: 10 },
      right: 30,
      top: 'center',
      itemWidth: 15,
      itemHeight: 200
    },
    series: [{
      type: 'bar3D',
      coordinateSystem: 'globe',
      data: globalData.value.map(item => ({
        name: item.name,
        value: [...item.coord, item.value]
      })),
      barSize: 4,
      minHeight: 0.5,
      maxHeight: 25,
      shading: 'lambert',
      itemStyle: {
        opacity: 0.9
      },
      emphasis: {
        itemStyle: {
          opacity: 1
        }
      }
    }],
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        return params.name + '<br/>下载量: ' + params.value[2] + ' 次'
      }
    }
  }
  
  chart.setOption(option)
  window.addEventListener('resize', () => chart.resize())
}
*/
onMounted(() => {
  nextTick(() => {
    initHeatmapChart()
    initTrendChart()
    initPieChart()
    initBarChart()
    //initMapChart()
  })

  pipelineInterval = setInterval(() => {
    currentPipelineStep = (currentPipelineStep + 1) % 5
  }, 2000)

  updateScanLine()
  scanInterval = setInterval(() => {
    updateScanLine()
  }, 1500)
})

onUnmounted(() => {
  if (pipelineInterval) clearInterval(pipelineInterval)
  if (scanInterval) clearInterval(scanInterval)
})
</script>

<template>
  <div class="dashboard">
    <div class="dashboard-grid">
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


      <!-- 趋势图 -->
      <div class="glass-card trend-card">
        <div class="card-header">
          <h3 class="card-title">📈 漏洞资源增长趋势</h3>
          <span class="card-badge">本周数据</span>
        </div>
        <div ref="trendChartRef" class="chart-container" style="height: 300px;"></div>
      </div>



      <!-- AI分析流程示意 -->
      <div class="glass-card ai-pipeline-card">
        <div class="card-header">
          <h3 class="card-title">🤖 AI漏洞分析流程示意</h3>
          <span class="card-badge">代码扫描</span>
        </div>
        
        <div class="scan-code-window">
          <div class="scan-header">
            <span class="file-name">vulnerable_code.c</span>
            <span class="scan-status" v-if="vulnerableCodeLines.some(l => l.type === 'scanning')">🔍 扫描中...</span>
          </div>
          <div class="code-lines">
            <div 
              v-for="line in vulnerableCodeLines" 
              :key="line.lineNum" 
              class="code-line-item"
              :class="line.type"
            >
              <span class="line-num">{{ line.lineNum }}</span>
              <span class="line-text">{{ line.text }}</span>
              <span v-if="line.vuln" class="vuln-tag">{{ line.vuln }}</span>
            </div>
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

      <!-- 全球地图 + 排行榜 -->
<!-- 
      
      <div class="glass-card map-card-full">
        <div class="card-header">
          <h3 class="card-title">🌍 全球POC/EXP下载分布</h3>
          <span class="card-badge">全球分布</span>
        </div>
        <div class="map-split-container">
          <div class="ranking-panel">
            <div class="ranking-title">📊 下载量TOP10</div>
            <div class="ranking-list">
              <div 
                v-for="(item, idx) in globalData.slice(0, 10)" 
                :key="item.name" 
                class="ranking-item"
                :class="{top3: idx < 3}"
              >
                <span class="rank-num" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
                <span class="rank-name">{{ item.name }}</span>
                <span class="rank-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
          <div ref="mapChartRef" class="map-container"></div>
        </div>
      </div>
       -->
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

.scan-code-window {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  border: 1px solid rgba(0, 212, 255, 0.2);
  margin: 15px 0;
  overflow: hidden;
}

.scan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 212, 255, 0.1);
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
}

.file-name {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--secondary);
}

.scan-status {
  font-size: 11px;
  color: var(--warning);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.5; }
}

.code-lines {
  padding: 8px 0;
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

.code-line-item {
  display: flex;
  align-items: center;
  padding: 3px 12px;
  transition: all 0.3s;
}

.code-line-item.pending {
  color: rgba(255, 255, 255, 0.5);
}

.code-line-item.scanning {
  color: var(--warning);
  background: rgba(255, 170, 0, 0.1);
}

.code-line-item.scanning .line-num {
  color: var(--warning);
}

.code-line-item.scanned {
  color: rgba(255, 255, 255, 0.7);
}

.code-line-item.scanned .line-num {
  color: rgba(255, 255, 255, 0.4);
}

.code-line-item.vulnerable {
  color: var(--danger);
}

.code-line-item.vulnerable .line-num {
  color: var(--danger);
}

.line-num {
  width: 28px;
  color: rgba(255, 255, 255, 0.3);
  text-align: right;
  padding-right: 12px;
  user-select: none;
}

.line-text {
  flex: 1;
}

.vuln-tag {
  margin-left: 8px;
  padding: 1px 6px;
  background: rgba(255, 51, 102, 0.2);
  color: var(--danger);
  border-radius: 4px;
  font-size: 9px;
  white-space: nowrap;
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

.pipeline-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.pipeline-step {
  text-align: center;
  flex: 1;
}

.pipeline-icon {
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

.pipeline-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.pipeline-arrow {
  color: var(--secondary);
  font-size: 14px;
}

.map-card {
  grid-column: span 6;
  min-height: 280px;
}

.map-card-full {
  grid-column: span 12;
  min-height: 450px;
}

.map-split-container {
  display: flex;
  gap: 20px;
  height: 380px;
  margin-top: 15px;
}

.ranking-panel {
  width: 280px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 15px;
  flex-shrink: 0;
}

.ranking-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 310px;
  overflow-y: auto;
  padding-right: 5px;
}

.ranking-list::-webkit-scrollbar {
  width: 4px;
}

.ranking-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.ranking-list::-webkit-scrollbar-thumb {
  background: rgba(0, 212, 255, 0.4);
  border-radius: 2px;
}

.ranking-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 212, 255, 0.6);
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  transition: all 0.3s;
}

.ranking-item:hover {
  background: rgba(0, 212, 255, 0.1);
}

.ranking-item.top3 {
  background: rgba(0, 212, 255, 0.15);
}

.rank-num {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  margin-right: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.rank-num.rank-1 {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #000;
}

.rank-num.rank-2 {
  background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
  color: #000;
}

.rank-num.rank-3 {
  background: linear-gradient(135deg, #cd7f32, #b87333);
  color: #000;
}

.rank-name {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.rank-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--secondary);
}

.map-container {
  flex: 1;
  height: 100%;
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

@media (max-width: 1400px) {
  .poc-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .pie-card, .bar-card, .heatmap-card, .trend-card, .ai-pipeline-card, .map-card {
    grid-column: span 6;
  }
}

@media (max-width: 1024px) {
  .poc-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .pie-card, .bar-card, .heatmap-card, .trend-card, .ai-pipeline-card, .map-card, .poc-card {
    grid-column: span 12;
  }

  .map-split-container{
    flex-direction: column;
    height: 800px;
  }

  .ranking-panel {
    width: 100%;
    max-height: 350px;
    overflow: hidden;
  }

  .map-container {
    min-height: 400px;
  }
}
</style>

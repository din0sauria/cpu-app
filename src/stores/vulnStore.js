import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const VULN_DATA_PATH = '/data/vulnerabilities.json'

const RISK_TEXT_MAP = {
  high: '高危',
  medium: '中危',
  low: '低危'
}

const normalizeVuln = (item) => {
  const processors = Array.isArray(item.processorPlatforms) ? item.processorPlatforms : []
  const osPlatforms = Array.isArray(item.osPlatforms) ? item.osPlatforms : []
  const codeTags = Array.isArray(item.codeTags) ? item.codeTags : []

  return {
    id: item.id,
    name: item.name,
    cveId: item.cveId || 'N/A',
    cveType: item.cveType || '未知类型',
    attackType: item.attackType || '未知攻击类型',
    riskLevel: item.riskLevel || 'medium',
    riskText: RISK_TEXT_MAP[item.riskLevel] || '中危',
    summary: item.summary || '',
    description: item.summary || '',
    avgTime: item.avgDetectTime || '-',
    osSupport: osPlatforms,
    osPlatforms,
    processorPlatforms: processors,
    architecture: processors.join('、') || '-',
    cpuModels: processors,
    codeTags,
    tags: [...new Set([item.name, item.attackType, ...processors])],
    reportPath: item.reportPath || '',
    runSupport: false
  }
}

export const useVulnStore = defineStore('vuln', () => {
  const vulnerabilities = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const loadError = ref('')

  const loadVulnerabilities = async (force = false) => {
    if (loading.value) return
    if (loaded.value && !force) return

    loading.value = true
    loadError.value = ''

    try {
      const response = await fetch(VULN_DATA_PATH, { cache: 'no-cache' })
      if (!response.ok) {
        throw new Error(`加载漏洞JSON失败: ${response.status}`)
      }
      const raw = await response.json()
      const list = Array.isArray(raw) ? raw : []
      vulnerabilities.value = list.map(normalizeVuln)
      loaded.value = true
    } catch (err) {
      vulnerabilities.value = []
      loaded.value = false
      loadError.value = err.message || '漏洞数据加载失败'
      console.error('[vulnStore] load failed:', err)
    } finally {
      loading.value = false
    }
  }

  const stats = computed(() => ({
    totalPocs: vulnerabilities.value.filter(v => v.codeTags.includes('poc')).length,
    totalExps: vulnerabilities.value.filter(v => v.codeTags.includes('exp')).length,
    totalVulns: vulnerabilities.value.length,
    totalHosts: 1287,
    accuracy: 94,
    weeklyNewPocs: 5,
    weeklyGrowth: 12.5
  }))

  const cveTypes = computed(() => {
    const types = [...new Set(vulnerabilities.value.map(v => v.cveType))]
    return types.map(type => ({ label: type, value: type }))
  })

  const attackTypes = computed(() => {
    const types = [...new Set(vulnerabilities.value.map(v => v.attackType))]
    return types.map(type => ({ label: type, value: type }))
  })

  const architectures = computed(() => {
    const archs = []
    vulnerabilities.value.forEach((v) => {
      v.processorPlatforms.forEach((p) => {
        if (!archs.includes(p)) archs.push(p)
      })
    })
    return archs.map(a => ({ label: a, value: a }))
  })

  const getVulnById = (id) => vulnerabilities.value.find(v => v.id === parseInt(id, 10))

  const searchVulns = (keyword, filters = {}) => {
    let results = vulnerabilities.value

    if (keyword) {
      const kw = keyword.toLowerCase()
      results = results.filter(v =>
        v.name.toLowerCase().includes(kw) ||
        v.summary.toLowerCase().includes(kw) ||
        v.cveType.toLowerCase().includes(kw) ||
        v.cveId.toLowerCase().includes(kw) ||
        v.attackType.toLowerCase().includes(kw)
      )
    }

    if (filters.cveType) results = results.filter(v => v.cveType === filters.cveType)
    if (filters.attackType) results = results.filter(v => v.attackType === filters.attackType)
    if (filters.architecture) results = results.filter(v => v.processorPlatforms.includes(filters.architecture))
    if (filters.riskLevel) results = results.filter(v => v.riskLevel === filters.riskLevel)

    return results
  }

  // Auto-load once so dashboards and list views can render without manual bootstrapping.
  loadVulnerabilities()

  return {
    vulnerabilities,
    loading,
    loaded,
    loadError,
    loadVulnerabilities,
    stats,
    cveTypes,
    attackTypes,
    architectures,
    getVulnById,
    searchVulns
  }
})

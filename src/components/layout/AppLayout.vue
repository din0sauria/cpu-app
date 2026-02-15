<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const isMobile = ref(false)
const mobileMenuOpen = ref(false)
const showSystemModal = ref(false)

const currentPath = computed(() => route?.path || '/')
const pageTitle = computed(() => route?.meta?.title || '控制中心')

const systemInfo = ref({
  cpuModel: 'Intel i7-13700H',
  osType: 'Windows 11'
})

const cpuOptions = [
  'Intel i7-13700H',
  'Intel i9-13900K',
  'Intel i5-13600K',
  'Intel i3-13100',
  'AMD Ryzen 9 7950X',
  'AMD Ryzen 7 7800X3D',
  'AMD Ryzen 5 7600X',
  'AMD Ryzen 9 5900X',
  'Apple M2 Pro',
  'Apple M2 Max',
  'Intel Xeon W-3375',
  'AMD EPYC 7763'
]

const osOptions = [
  'Windows 11',
  'Windows 10',
  'Ubuntu 22.04',
  'Ubuntu 20.04',
  'CentOS 8',
  'Debian 12',
  'macOS Ventura',
  'macOS Monterey',
  'Kali Linux 2023'
]

const menuItems = [
  { 
    name: '首页', 
    path: '/', 
    icon: '🏠',
    children: [] 
  },
  { 
    name: '漏洞POC', 
    path: '/poc', 
    icon: '🎯',
    children: [] 
  },
  { 
    name: '漏洞EXP', 
    path: '/exp', 
    icon: '💥',
    children: [] 
  },
  { 
    name: '代码检测', 
    path: '/detect', 
    icon: '🔍',
    children: [] 
  }
]

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

onMounted(() => {
  window.addEventListener('resize', checkMobile)
})

const isActive = (path) => {
  if (path === '/') return currentPath.value === '/'
  return currentPath.value.startsWith(path)
}

const openSystemModal = () => {
  showSystemModal.value = true
}

const closeSystemModal = () => {
  showSystemModal.value = false
}

const saveSystemInfo = () => {
  showSystemModal.value = false
}
</script>

<template>
  <div class="app-layout">
    <div class="bg-grid"></div>
    <div class="particles" id="particles"></div>
    
    <!-- 左侧导航 -->
    <aside class="sidebar" :class="{ 'mobile-open': mobileMenuOpen }">
      <div class="logo">
        <h1>NeuralCore</h1>
        <p>AI CPU漏洞检测平台</p>
      </div>
      
      <nav class="nav-menu">
        <RouterLink 
          v-for="item in menuItems" 
          :key="item.path"
          :to="item.path" 
          class="nav-link"
          :class="{ active: isActive(item.path) }"
          @click="mobileMenuOpen = false"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-text">{{ item.name }}</span>
        </RouterLink>
      </nav>
      
      <div class="sidebar-footer">
        <button class="system-btn" @click="openSystemModal">
          <span class="system-icon">💻</span>
          <div class="system-info">
            <span class="system-label">当前系统</span>
            <span class="system-name">{{ systemInfo.cpuModel }}</span>
            <span class="system-os">{{ systemInfo.osType }}</span>
          </div>
          <span class="edit-icon">✏️</span>
        </button>
      </div>
    </aside>

    <div 
      v-if="mobileMenuOpen" 
      class="mobile-overlay"
      @click="mobileMenuOpen = false"
    ></div>

    <!-- 主内容区 -->
    <main class="main-content">
      <header class="top-bar">
        <div class="top-left">
          <button class="mobile-menu-btn" @click="mobileMenuOpen = !mobileMenuOpen">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <h2 class="page-title">{{ pageTitle }}</h2>
        </div>
        <div class="top-right">
          <div class="current-system" @click="openSystemModal">
            <span class="system-badge">💻</span>
            <span class="system-text">{{ systemInfo.cpuModel }}</span>
            <span class="system-divider">|</span>
            <span class="system-text">{{ systemInfo.osType }}</span>
          </div>
        </div>
      </header>

      <div class="page-content">
        <slot></slot>
      </div>
    </main>

    <!-- 系统信息选择弹窗 -->
    <div class="modal-overlay" :class="{active: showSystemModal}" @click="closeSystemModal">
      <div class="modal-content system-modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">💻 选择系统信息</h3>
          <button class="modal-close" @click="closeSystemModal">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>处理器型号</label>
            <select v-model="systemInfo.cpuModel" class="form-select">
              <option v-for="cpu in cpuOptions" :key="cpu" :value="cpu">{{ cpu }}</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>操作系统</label>
            <select v-model="systemInfo.osType" class="form-select">
              <option v-for="os in osOptions" :key="os" :value="os">{{ os }}</option>
            </select>
          </div>
          
          <button class="btn-save" @click="saveSystemInfo">保存设置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  position: relative;
}

.bg-grid {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  opacity: 0.08;
  background-image: 
    linear-gradient(rgba(0, 212, 255, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.1) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: gridMove 20s linear infinite;
}

@keyframes gridMove {
  0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
  100% { transform: perspective(500px) rotateX(60deg) translateY(50px); }
}

.particles {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  width: 260px;
  height: 100vh;
  background: linear-gradient(180deg, rgba(10, 14, 39, 0.98) 0%, rgba(16, 22, 58, 0.95) 100%);
  border-right: 1px solid var(--border-glow);
  z-index: 100;
  padding: 20px 0;
  display: flex;
  flex-direction: column;
}

.logo {
  text-align: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-glow);
  margin-bottom: 20px;
}

.logo h1 {
  font-family: 'Orbitron', sans-serif;
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--secondary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo p {
  font-size: 11px;
  color: var(--secondary);
  margin-top: 5px;
  opacity: 0.8;
}

.nav-menu {
  flex: 1;
  padding: 0 15px;
}

.nav-link {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  border-radius: 10px;
  transition: all 0.3s ease;
  font-size: 15px;
  margin-bottom: 5px;
}

.nav-link:hover {
  background: rgba(0, 212, 255, 0.1);
  color: var(--secondary);
}

.nav-link.active {
  background: rgba(0, 212, 255, 0.15);
  color: var(--secondary);
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);
}

.nav-icon {
  font-size: 18px;
  margin-right: 12px;
}

.nav-text {
  font-weight: 500;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid var(--border-glow);
}

.system-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: left;
}

.system-btn:hover {
  background: rgba(0, 212, 255, 0.1);
  border-color: var(--secondary);
}

.system-icon {
  font-size: 24px;
}

.system-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.system-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 2px;
}

.system-name {
  font-size: 12px;
  color: #fff;
  font-weight: 600;
}

.system-os {
  font-size: 11px;
  color: var(--secondary);
}

.edit-icon {
  font-size: 14px;
  opacity: 0.6;
}

.main-content {
  flex: 1;
  margin-left: 260px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  z-index: 10;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 25px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-glow);
}

.top-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.mobile-menu-btn {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 8px;
  background: none;
}

.mobile-menu-btn span {
  display: block;
  width: 25px;
  height: 2px;
  background: var(--secondary);
}

.page-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.current-system {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 15px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.current-system:hover {
  border-color: var(--secondary);
}

.system-badge {
  font-size: 16px;
}

.system-text {
  font-size: 13px;
  color: #fff;
}

.system-divider {
  color: rgba(255, 255, 255, 0.3);
}

.page-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
}

.system-modal {
  width: 450px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.modal-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 18px;
  color: var(--secondary);
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

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}

.form-select {
  width: 100%;
  padding: 12px 15px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-glow);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.form-select:focus {
  border-color: var(--secondary);
  outline: none;
}

.btn-save {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, var(--secondary), var(--primary));
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-save:hover {
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
}

@media (max-width: 1024px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  .main-content {
    margin-left: 0;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .mobile-overlay {
    display: block;
  }
  
  .current-system {
    display: none;
  }
}
</style>

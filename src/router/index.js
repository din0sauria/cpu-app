import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { title: '数据大屏' }
  },
  {
    path: '/poc',
    name: 'POC',
    component: () => import('../views/POCView.vue'),
    meta: { title: '漏洞POC展示' }
  },
  {
    path: '/exp',
    name: 'EXP',
    component: () => import('../views/EXPView.vue'),
    meta: { title: '漏洞EXP展示' }
  },
  {
    path: '/detect',
    name: 'Detect',
    component: () => import('../views/DetectView.vue'),
    meta: { title: '代码安全检测' }
  },
  {
    path: '/detail/:id',
    name: 'Detail',
    component: () => import('../views/VulnDetail.vue'),
    meta: { title: '漏洞详情' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || 'CPU漏洞检测平台'} - NeuralCore`
  next()
})

export default router

# CPU漏洞检测平台 (CPU-POC)

一个专业的CPU漏洞检测与漏洞代码资源下载平台，基于Vue 3 + Vite构建，采用科技风数据大屏界面设计。

## 平台简介

CPU漏洞检测平台是一个专注于CPU处理器漏洞研究、检测和漏洞代码资源分享的系统。平台提供漏洞知识库浏览、POC/EXP代码下载、源代码漏洞分析等功能，帮助安全研究人员快速了解漏洞信息并进行防御性研究。

## 功能特色

### 🖥️ 数据大屏 (Dashboard)
- **平台概览统计** - 实时展示已检测主机数、漏洞发现数、POC总数、EXP数量、AI分析准确率
- **CVE类型分布** - 饼状图展示不同CVE类型漏洞的分布情况
- **攻击类型统计** - 条形图展示各类型攻击的数量对比
- **漏洞分布热力图** - 展示不同CPU型号与操作系统的漏洞分布矩阵
- **增长趋势图** - 展示POC/EXP数量的周度变化趋势
- **AI分析流程示意** - 可视化展示代码上传到漏洞分析的完整流程
- **EXP生成流程** - 展示从漏洞识别到攻击代码生成的AI工作流
- **中国地图分布** - 动态展示各省份POC/EXP下载热度
- **漏洞知识库** - 展示平台收录的20+主流CPU漏洞

### 🔍 POC浏览 (POC列表)
- 漏洞搜索与关键词过滤
- CVE类型分类筛选
- 攻击类型筛选
- 风险等级筛选
- 漏洞卡片展示（含名称、类型、风险等级、成功率等）
- POC代码在线预览
- POC代码下载功能

### 💀 EXP浏览 (EXP列表)
- 漏洞EXP代码展示
- 攻击者代码/受害者代码Tab切换
- 攻击代码语法高亮
- 代码复制功能

### 🛡️ 代码检测 (Detect)
- 单文件源代码上传
- AI漏洞分析流程动画展示
- 漏洞检测结果展示（漏洞名称、类型、风险等级）
- 基于漏洞类型生成攻击代码（EXP）
- 攻击代码在线预览与下载

### 📱 漏洞详情
- 完整漏洞信息展示
- POC代码展示
- EXP攻击代码/受害者代码展示
- 支持的CPU型号列表
- 操作系统兼容性
- 攻击成功率与平均耗时

## 技术栈

### 前端技术
- **Vue 3** - 渐进式前端框架，采用Composition API
- **Vite** - 下一代前端构建工具
- **Pinia** -  Vue 3的状态管理解决方案
- **Vue Router** - Vue.js官方路由管理器
- **ECharts** - 强大的数据可视化图表库
- **@jiaminghi/data-view** - 数据大屏可视化组件库

### 开发工具
- **ESLint** - JavaScript/JSX代码检查
- **Vite Single File** - 单文件HTML打包插件

## 项目结构

```
cpu-app/
├── src/
│   ├── assets/           # 静态资源
│   ├── components/
│   │   └── layout/      # 布局组件
│   │       └── AppLayout.vue
│   ├── router/
│   │   └── index.js     # 路由配置
│   ├── stores/
│   │   └── vulnStore.js # 漏洞数据状态管理
│   ├── views/
│   │   ├── Dashboard.vue    # 数据大屏
│   │   ├── POCView.vue     # POC列表页
│   │   ├── EXPView.vue     # EXP列表页
│   │   ├── DetectView.vue  # 代码检测页
│   │   └── VulnDetail.vue  # 漏洞详情页
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── dist/                # 构建输出目录
├── package.json
└── vite.config.js       # Vite配置文件
```

## 快速开始

### 安装依赖

```bash
npm install
# 或使用 pnpm
pnpm install
```

### 开发模式

```bash
npm run dev
```

启动后访问 http://localhost:5173

### 构建部署

```bash
# 标准构建（多文件输出）
npm run build

# 单文件构建（适合本地直接打开）
# 使用 vite-plugin-singlefile 插件
npm run build
```

构建输出在 `dist/` 目录

### 预览构建结果

```bash
npm run preview
```

## 部署方法

### 方法1：Web服务器部署
将 `dist` 目录内容部署到任意Web服务器（Nginx、Apache、IIS等）

### 方法2：单文件HTML部署
构建后的单文件 `dist/index.html` 可直接在浏览器打开（需要HTTP服务器避免CORS问题）

```bash
# 预览单文件
npm run preview
```

### 方法3：静态托管平台
可直接部署到 Vercel、Netlify、GitHub Pages 等平台

## 后端API（可选）

平台支持连接后端进行实际的代码漏洞分析：

### Flask后端
位于 `backend/app.py`

```bash
cd backend
pip install -r requirements.txt
python app.py
```

后端提供以下API：
- `POST /api/analyze` - 分析上传的代码文件
- `POST /api/generate-exp` - 根据漏洞类型生成攻击代码

前端默认连接 `http://localhost:5000`

## 预设漏洞数据

平台内置20个主流CPU漏洞数据，包括：

| 漏洞名称 | CVE类型 | 攻击类型 | 风险等级 |
|---------|---------|---------|---------|
| Spectre V1 | 瞬态执行漏洞 | Spectre类攻击 | 高危 |
| Meltdown | 瞬态执行漏洞 | Meltdown类攻击 | 高危 |
| Foreshadow | 瞬态执行漏洞 | Meltdown类攻击 | 高危 |
| ZombieLoad | 瞬态执行漏洞 | Meltdown类攻击 | 高危 |
| Retbleed | 瞬态执行漏洞 | Spectre类攻击 | 高危 |
| RIDL | 瞬态执行漏洞 | Meltdown类攻击 | 高危 |
| CacheOut | 瞬态执行漏洞 | Meltdown类攻击 | 高危 |
| BHI | 瞬态执行漏洞 | Spectre类攻击 | 高危 |

## 注意事项

⚠️ **免责声明**：本平台仅供安全研究教育目的，请勿将这些技术用于非法用途。作者不对任何滥用负责。

## 许可证

MIT License

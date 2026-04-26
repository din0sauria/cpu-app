# 漏洞数据填写规范（`public/data/vulnerabilities.json`）

本文档给负责补充真实漏洞数据的同学使用。  
前端多个页面（漏洞详情、首页图表、筛选条件、报告入口）都直接读取这个 JSON，请严格按本规范填写。

---

## 1. 文件位置

- 数据文件：`public/data/vulnerabilities.json`
- 报告目录：`public/reports/`

---

## 2. 顶层结构

`vulnerabilities.json` 顶层必须是**数组**，每一项是一个漏洞对象：

```json
[
  {
    "id": 1,
    "name": "Spectre V1",
    "codeTags": ["poc"],
    "cveId": "CVE-2017-5753",
    "cveType": "瞬态执行漏洞",
    "osPlatforms": ["Linux", "Windows", "macOS"],
    "processorPlatforms": ["Intel", "AMD", "ARM"],
    "attackType": "Spectre类攻击",
    "riskLevel": "high",
    "summary": "一句话简介...",
    "avgDetectTime": "12.3ms",
    "reportPath": ""
  }
]
```

---

## 3. 字段说明（逐项）

### `id`
- 类型：`number`（整数）
- 要求：全局唯一，建议从小到大递增
- 用途：前端列表 key、详情定位

### `name`
- 类型：`string`
- 要求：漏洞名称，建议与报告文件名一致
- 示例：`"Meltdown"`、`"Spectre V2"`

### `codeTags`
- 类型：`string[]`
- 含义：该漏洞是否提供下载工件
- 可选值：`"poc"`、`"exp"`
- 规则：
  - 只有 `["poc"]`：只显示“下载POC”
  - 只有 `["exp"]`：只显示“下载EXP”
  - 两者都有：两个按钮都显示
  - 空数组：不显示下载按钮（不推荐）

### `cveId`
- 类型：`string`
- 示例：`"CVE-2022-0001"` 或 `"N/A"`
- 说明：首页“按CVE年份趋势图”会解析 `CVE-YYYY-xxxx` 的年份；写 `N/A` 的项不会计入年份趋势

### `cveType`
- 类型：`string`
- 含义：漏洞分类（用于筛选和图表）
- 示例：`"瞬态执行漏洞"`、`"侧信道漏洞"`、`"架构错误漏洞"`

### `osPlatforms`
- 类型：`string[]`
- 含义：适用操作系统
- 常用值：`"Linux"`、`"Windows"`、`"macOS"`、`"其他"`

### `processorPlatforms`
- 类型：`string[]`
- 含义：适用处理器平台
- 常用值：`"Intel"`、`"AMD"`、`"ARM"`、`"Apple M"`、`"其他"`

### `attackType`
- 类型：`string`
- 含义：攻击类型（用于筛选和图表）
- 示例：`"Spectre类攻击"`、`"Meltdown类攻击"`、`"Cache侧信道攻击"`

### `riskLevel`
- 类型：`string`
- 只允许：`"high"`、`"medium"`、`"low"`
- 说明：前端会自动映射成“高危/中危/低危”

### `summary`
- 类型：`string`
- 含义：一句话简介（列表卡片核心描述）

### `avgDetectTime`
- 类型：`string`
- 含义：平均检测用时
- 示例：`"8.5ms"`、`"120.0ms"`

### `reportPath`
- 类型：`string`
- 含义：Markdown 实验报告路径
- 规则：
  - 若填写：使用你填写的路径（从网站根路径开始，例如 `"/reports/Meltdown.md"`）
  - 若留空字符串 `""`：前端自动使用默认路径 `"/reports/<name>.md"`
    - 例：`name = "Spectre V1"` -> `"/reports/Spectre V1.md"`

---

## 4. 报告文件规范（`public/reports/*.md`）

- 编码：UTF-8
- 后缀：`.md`
- 若使用默认路径，请确保文件名与 `name` 完全一致（含空格、大小写、特殊字符）
- 前端会渲染 Markdown，不会显示源码文本

---

## 5. 新增一条漏洞的推荐流程

1. 在 `vulnerabilities.json` 新增对象，补齐字段  
2. 在 `public/reports/` 新增对应 `.md` 报告（或填写 `reportPath` 指向现有文件）  
3. 检查 `id` 是否唯一  
4. 检查 `riskLevel` 是否是 `high/medium/low`  
5. 检查 JSON 语法（逗号、引号、数组闭合）

---

## 6. 常见错误（务必避免）

- `riskLevel` 写成中文（如“高危”）  
  正确：`"high"`（前端会自动显示中文）

- `codeTags` 写成字符串  
  错误：`"poc"`  
  正确：`["poc"]`

- `osPlatforms` / `processorPlatforms` 不是数组  
  错误：`"Linux"`  
  正确：`["Linux"]`

- `reportPath` 填相对磁盘路径  
  错误：`"public/reports/a.md"`  
  正确：`"/reports/a.md"`

- `cveId` 不是标准格式但希望参与年份趋势  
  若要计入趋势，请使用 `CVE-YYYY-xxxx` 形式

---

## 7. 可直接复用的模板

```json
{
  "id": 999,
  "name": "示例漏洞名",
  "codeTags": ["poc", "exp"],
  "cveId": "CVE-2026-12345",
  "cveType": "侧信道漏洞",
  "osPlatforms": ["Linux", "Windows"],
  "processorPlatforms": ["Intel", "AMD"],
  "attackType": "Cache侧信道攻击",
  "riskLevel": "medium",
  "summary": "一句话说明漏洞机理与影响。",
  "avgDetectTime": "18.2ms",
  "reportPath": ""
}
```

---

## 8. 变更影响范围（供评估）

修改 `vulnerabilities.json` 会直接影响：

- 漏洞详情页卡片与筛选
- “查看详情”弹窗与报告入口
- 首页统计图（CVE类型分布、攻击类型统计、处理器×操作系统热力图、按CVE年份趋势）
- 主机漏洞检测页中的部分统计展示

如需新增字段，请先和前端同学同步，再扩展解析逻辑。

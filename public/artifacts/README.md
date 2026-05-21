# 漏洞代码压缩包目录（前端直链下载）

下载按钮不再请求后端接口，统一从本目录按文件名直链下载。

## 命名规则

- POC: `漏洞名_poc.zip`
- EXP: `漏洞名_exp.zip`

其中“漏洞名”必须与 `public/data/vulnerabilities.json` 的 `name` 字段完全一致（大小写、空格、符号都要一致）。

## 示例

- `Spectre V1_poc.zip`
- `Spectre V1_exp.zip`
- `Flush+Reload_poc.zip`

## 下载路径

- `/artifacts/<文件名>`

例如：`/artifacts/Spectre%20V1_poc.zip`

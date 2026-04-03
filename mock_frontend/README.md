# 模拟前端使用说明

## 1. 启动方式
在项目根目录执行：

```bash
python3 -m http.server 8088 -d mock_frontend
```

浏览器打开：

```text
http://127.0.0.1:8088
```

## 2. 操作流程
1. 后端地址保持默认 `http://127.0.0.1:5000`（如果容器映射不同请改成对应地址）。
2. 选择一个待审计项目的 ZIP 文件。
3. 可选填写 `target_bin`。
4. 可选勾选 detectors（不勾选表示让后端使用全部检测器）。
5. 点击“上传并分析”。

## 3. 页面能力
- 对接 `POST /upload`，创建任务。
- 自动对接 `GET /stream/<task_id>` SSE。
- 长列表和长表格启用内部滚动，避免面板之间发生重叠。
- 监听并展示以下事件：
  - `start` `info` `warning` `error`
  - `phase_0` 到 `phase_4`
  - `candidates` `shortlist` `audit_reports`
  - `agent_step` `tool_call` `tool_result`
  - `final_report` `finished` `complete`
- 新增 Agent 工具查询可视化：
  - 收到 `tool_call` 时触发扫描动画并显示本轮查询内容。
  - 收到 `tool_result` 时切为完成态并显示结果摘要。

## 4. 注意事项
- 需要浏览器支持 SSE（现代浏览器均支持）。
- 本模拟前端不会替代正式业务前端，只用于联调和演示。

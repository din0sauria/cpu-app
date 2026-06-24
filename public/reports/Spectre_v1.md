# Spectre V1 实验报告

## 1. 本项目具体说明

Spectre V1（Bounds Check Bypass，CVE-2017-5753）利用了分支预测器对边界检查的错误预测：CPU 在边界条件尚未完成校验时先执行后续访存指令，导致本不应访问的秘密数据在瞬态执行窗口中被读取并通过缓存侧信道泄露。本实验基于 transientfail 的 PHT `sa_ip` 变体，在本机 Ubuntu 24.04 环境中复现实验。

## 2. 涉及资源

- **Pattern History Table (PHT) / 条件分支预测器**
  - **位置**: CPU 分支预测单元。
  - **功能**: 预测分支条件结果，减少流水线停顿。
  - **利用**: 通过重复合法索引训练，让 CPU 倾向于预测“条件成立”，随后使用越界索引触发错误推测执行。

- **Flush+Reload 缓存侧信道**
  - **位置**: CPU Cache（主要是 L1/L2/L3 层级可观测延迟）。
  - **功能**: 通过访问延迟区分缓存命中/未命中。
  - **利用**: 将秘密字节值编码到不同缓存行，再用计时恢复字符。

- **缓存命中阈值（CACHE_MISS）**
  - **位置**: PoC 用户态逻辑中自动探测得到。
  - **功能**: 区分命中与未命中的时间阈值。
  - **利用**: 阈值稳定性决定泄露字符解码质量。

## 3. 攻击原理

1. 准备包含公开前缀和私有后缀（`INACCESSIBLE SECRET`）的数据数组。
2. 用合法索引反复调用 `access_array(0)`，训练分支预测器认为边界检查为真。
3. 切换到越界索引访问，诱导 CPU 在推测执行中进入本应受保护的路径。
4. 推测路径执行 `cache_encode(data[x])`，把秘密字节编码进缓存。
5. 通过 Flush+Reload 测时恢复字符，逐步重建秘密字符串。

## 4. 项目核心代码文件

- `unified_platform/program/spectre_v1/pocs/spectre/PHT/sa_ip/main.c`
  - `access_array(int x)`：边界检查 + 推测路径缓存编码。
  - `main()`：训练循环、越界触发、侧信道解码。
- `unified_platform/program/spectre_v1/pocs/spectre/PHT/sa_ip/Makefile`
  - 生成 `poc_x86`。
- `unified_platform/program/spectre_v1/pocs/libcache/cacheutils.h`
  - 提供 `flush`、`flush_reload`、`detect_flush_reload_threshold` 等原语。

## 5. 运行环境

- **操作系统**: Ubuntu 24.04 LTS
- **内核**: Linux 6.17.0-22-generic
- **CPU**: AMD Ryzen 7 7840H (x86_64)
- **漏洞状态（系统接口）**:
  - `spectre_v1`: `Vulnerable: __user pointer sanitization and usercopy barriers only; no swapgs barriers`

## 6. 执行步骤

1. 进入 PoC 目录并编译：
```bash
cd unified_platform/program/spectre_v1/pocs/spectre/PHT/sa_ip
make x86
```

2. 运行漏洞验证程序：
```bash
./poc_x86
```

## 7. 实测结果

```text
(.venv) gaoxiang@gaoxiang-Legion-R7000P-APH8:~/vscode-workspace/POC_EXP_Backend/unified_platform/program/spectre_v1/pocs/spectre/PHT/sa_ip$ ./poc_x86
[*] Flush+Reload Threshold: 258
[ ]  INACCESSIBLE SECRET

[>] Done
```

## 8. 结果分析

- 程序成功打印 `INACCESSIBLE SECRET`，说明侧信道已恢复出预期秘密内容。
- 出现 `[>] Done`，表明 PoC 完成了泄露判定并正常结束。
- 阈值为 `258`，本次运行下信号质量较稳定，未出现明显乱码干扰。

## 9. 结论

本次 Spectre V1（PHT/sa_ip）实验在目标环境中复现成功，证明边界检查绕过型瞬态执行路径可被触发并可观测到秘密泄露痕迹。

